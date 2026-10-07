require("dotenv").config();

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { fromFile } = require("file-type");
const { Pool } = require("pg");
const { AfterShip } = require("@aftership/tracking-sdk");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const express = require("express");

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "health_food",
    password: process.env.DB_PASSWORD,
    port: 5432
});

const novaPoshtaApiKey =
    process.env.NOVA_POSHTA_API_KEY;

const afterShipApiKey =
    process.env.AFTERSHIP_API_KEY;

const telegramBotToken =
    process.env.TELEGRAM_BOT_TOKEN;

const adminSecret =
    process.env.ADMIN_SECRET;

const adminSessions = new Map();

const SESSION_DURATION =
    1000 * 60 * 60 * 8;

function createLiqPayData(amount, orderId) {
    const params = {
        public_key: process.env.LIQPAY_PUBLIC_KEY,
        version: 7,
        action: "pay",
        amount: amount,
        currency: "UAH",
        description: "Замовлення Health Food",
        order_id: orderId,
        server_url: process.env.LIQPAY_SERVER_URL
    };

    const jsonString =
        JSON.stringify(params);

    const data = Buffer
        .from(jsonString)
        .toString("base64");

    const signString =
        process.env.LIQPAY_PRIVATE_KEY +
        data +
        process.env.LIQPAY_PRIVATE_KEY;

    const signature = crypto
        .createHash("sha3-256")
        .update(signString)
        .digest("base64");

    return {
        data: data,
        signature: signature
    };
}

function checkAdmin(req, res, next) {
    const token =
        req.cookies.admin_session;

    const session = token
        ? adminSessions.get(token)
        : null;

    if (!session) {
        return res.status(401).send(
            "Доступ заборонено"
        );
    }

    if (
        Date.now() - session.createdAt >
        SESSION_DURATION
    ) {
        adminSessions.delete(token);

        res.clearCookie(
            "admin_session"
        );

        return res.status(401).send(
            "Сесія закінчилася"
        );
    }

    next();
}

async function sendTelegramMessage(
    chatId,
    text
) {
    const response = await fetch(
        `https://api.telegram.org/bot${telegramBotToken}/sendMessage`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: text
            })
        }
    );

    await response.json();
}

let telegramOffset = 0;

async function processTelegramUpdates() {
    try {
        const response = await fetch(
            `https://api.telegram.org/bot${telegramBotToken}/getUpdates?offset=${telegramOffset}`
        );

        const data =
            await response.json();

        if (
            !data.ok ||
            data.result.length === 0
        ) {
            return;
        }

        for (const update of data.result) {
            telegramOffset =
                update.update_id + 1;

            if (!update.message) {
                continue;
            }

            const chatId =
                update.message.chat.id;

            const text =
                update.message.text;

            if (
                !text ||
                !text.startsWith("/start")
            ) {
                continue;
            }

            const parts =
                text.split(" ");

            const orderId =
                parts[1];

            if (!orderId) {
                continue;
            }

            await pool.query(
                "UPDATE orders SET telegram_chat_id = $1 WHERE id = $2",
                [chatId, orderId]
            );

            await sendTelegramMessage(
                chatId,
                "Замовлення №" +
                    orderId +
                    " успішно підключено. Ми повідомимо вас у Telegram після доставки."
            );
        }
    } catch (error) {
        console.log(
            "Помилка Telegram:",
            error.message
        );
    }
}

setInterval(
    processTelegramUpdates,
    3000
);

const aftership = new AfterShip({
    api_key: afterShipApiKey
});

async function checkNovaPoshta(
    trackingNumber,
    orderId
) {
    const orderStatus =
        await pool.query(
            "SELECT status FROM orders WHERE id = $1",
            [orderId]
        );

    if (
        orderStatus.rows.length === 0 ||
        orderStatus.rows[0].status === "Виконано"
    ) {
        return;
    }

    if (!/^\d{14}$/.test(trackingNumber)) {
        return;
    }

    const response = await fetch(
        "https://api.novaposhta.ua/v2.0/json/",
        {
            method: "POST",
            headers: {
                "Content-Type":
                    "application/json"
            },
            body: JSON.stringify({
                apiKey: novaPoshtaApiKey,
                modelName:
                    "TrackingDocument",
                calledMethod:
                    "getStatusDocuments",
                methodProperties: {
                    Documents: [
                        {
                            DocumentNumber:
                                trackingNumber
                        }
                    ]
                }
            })
        }
    );

    const data =
        await response.json();

    if (!data.success) {
        console.log(
            "Не вдалося перевірити замовлення №" +
                orderId +
                ":",
            data.errors
        );

        return data;
    }

    if (
        data.data.length > 0 &&
        data.data[0].StatusCode === "9"
    ) {
        const orderResult =
            await pool.query(
                "UPDATE orders SET status = 'Виконано' WHERE id = $1 AND status = 'Відправлено' RETURNING telegram_chat_id",
                [orderId]
            );

        if (
            orderResult.rows.length === 0
        ) {
            return;
        }

        const chatId =
            orderResult.rows[0]
                .telegram_chat_id;

        if (chatId) {
            await sendTelegramMessage(
                chatId,
                "Ваше замовлення №" +
                    orderId +
                    " виконано!"
            );
        }
    }

    return data;
}

async function checkUkrposhta(
    trackingNumber,
    orderId
) {
    const orderResult =
        await pool.query(
            "SELECT status, telegram_chat_id, aftership_tracking_id FROM orders WHERE id = $1",
            [orderId]
        );

    if (orderResult.rows.length === 0) {
        return;
    }

    const order =
        orderResult.rows[0];

    if (order.status === "Виконано") {
        return;
    }

    if (!/^\d{13}$/.test(trackingNumber)) {
        return;
    }

    let aftershipTrackingId =
        order.aftership_tracking_id;

    let result;

    if (aftershipTrackingId) {
        result =
            await aftership.tracking.getTrackingById(
                aftershipTrackingId,
                {}
            );
    } else {
        try {
            result =
                await aftership.tracking.createTracking(
                    {
                        tracking_number:
                            trackingNumber,
                        slug: "ukrposhta"
                    }
                );

            aftershipTrackingId =
                result.data.id;

            await pool.query(
                "UPDATE orders SET aftership_tracking_id = $1 WHERE id = $2",
                [
                    aftershipTrackingId,
                    orderId
                ]
            );
        } catch (error) {
            if (
                error.code ===
                "TRACKING_ALREADY_EXIST"
            ) {
                const existingTrackingId =
                    JSON.parse(
                        error.response_body
                    ).data.id;

                aftershipTrackingId =
                    existingTrackingId;

                await pool.query(
                    "UPDATE orders SET aftership_tracking_id = $1 WHERE id = $2",
                    [
                        aftershipTrackingId,
                        orderId
                    ]
                );

                result =
                    await aftership.tracking.getTrackingById(
                        aftershipTrackingId,
                        {}
                    );
            } else {
                throw error;
            }
        }
    }

    if (
        result &&
        result.data &&
        result.data.tag === "Delivered"
    ) {
        const updatedOrder =
            await pool.query(
                "UPDATE orders SET status = 'Виконано' WHERE id = $1 AND status = 'Відправлено' RETURNING telegram_chat_id",
                [orderId]
            );

        if (
            updatedOrder.rows.length === 0
        ) {
            return;
        }

        const chatId =
            updatedOrder.rows[0]
                .telegram_chat_id;

        if (chatId) {
            await sendTelegramMessage(
                chatId,
                "Ваше замовлення №" +
                    orderId +
                    " виконано!"
            );
        }
    }
}

async function checkSentOrders() {
    const result =
        await pool.query(
            "SELECT id, tracking_code, delivery_method FROM orders WHERE status = 'Відправлено' AND tracking_code IS NOT NULL"
        );

    for (const order of result.rows) {
        if (
            order.delivery_method ===
            "Нова Пошта"
        ) {
            await checkNovaPoshta(
                order.tracking_code,
                order.id
            );
        } else {
            await checkUkrposhta(
                order.tracking_code,
                order.id
            );
        }
    }
}

const app = express();

app.use(cookieParser());

app.use(
    cors({
        origin: [
            "http://127.0.0.1:5500",
            "http://localhost:5500"
        ],
        credentials: true
    })
);

app.use(
    helmet({
        crossOriginResourcePolicy: {
            policy: "cross-origin"
        }
    })
);

app.use(
    express.json({
        limit: "100kb"
    })
);

app.use(
    express.urlencoded({
        extended: false
    })
);

const adminLoginLimiter =
    rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 10,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: {
            success: false,
            message:
                "Забагато спроб. Спробуйте пізніше."
        }
    });

const orderLimiter =
    rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 20,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: {
            success: false,
            message:
                "Забагато запитів. Спробуйте пізніше."
        }
    });

app.use(
    "/images",
    express.static(
        path.join(
            __dirname,
            "..",
            "images"
        )
    )
);

const upload = multer({
    dest: path.join(
        __dirname,
        "..",
        "images"
    ),
    limits: {
        fileSize:
            15 * 1024 * 1024
    }
});

app.get("/", function (req, res) {
    res.send(
        "Привіт! Сервер працює."
    );
});

app.get(
    "/admin/check",
    checkAdmin,
    function (req, res) {
        res.json({
            success: true
        });
    }
);

app.post(
    "/admin/logout",
    function (req, res) {
        const token =
            req.cookies.admin_session;

        if (token) {
            adminSessions.delete(token);
        }

        res.clearCookie(
            "admin_session"
        );

        res.json({
            success: true
        });
    }
);

app.get(
    "/products",
    function (req, res) {
        const query = `
            SELECT
                products.id,
                products.name,
                products.description,
                products.price,
                products.image,
                products.category_id,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id',
                            product_packagings.id,
                            'packaging',
                            product_packagings.packaging,
                            'price',
                            product_packagings.price
                        )
                        ORDER BY product_packagings.id
                    ) FILTER (
                        WHERE product_packagings.id IS NOT NULL
                    ),
                    '[]'
                ) AS packagings
            FROM products
            LEFT JOIN product_packagings
                ON products.id =
                    product_packagings.product_id
            GROUP BY products.id
            ORDER BY products.id
        `;

        pool.query(
            query,
            function (error, result) {
                if (error) {
                    console.log(error);

                    return res.status(500).json({
                        message:
                            "Помилка отримання товарів"
                    });
                }

                res.json(
                    result.rows
                );
            }
        );
    }
);

app.get(
    "/products/category/:id",
    function (req, res) {
        const categoryId =
            req.params.id;

        const query = `
            SELECT
                id,
                name,
                description,
                image
            FROM products
            WHERE category_id = $1
            ORDER BY id
        `;

        pool.query(
            query,
            [categoryId],
            function (error, result) {
                if (error) {
                    console.log(error);

                    return res.status(500).json({
                        message:
                            "Помилка отримання товарів категорії"
                    });
                }

                res.json(
                    result.rows
                );
            }
        );
    }
);

app.get(
    "/products/:id",
    function (req, res) {
        const productId =
            req.params.id;

        const query = `
            SELECT
                products.id,
                products.name,
                products.description,
                products.price,
                products.image,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id',
                            product_packagings.id,
                            'packaging',
                            product_packagings.packaging,
                            'price',
                            product_packagings.price
                        )
                        ORDER BY product_packagings.id
                    ) FILTER (
                        WHERE product_packagings.id IS NOT NULL
                    ),
                    '[]'
                ) AS packagings
            FROM products
            LEFT JOIN product_packagings
                ON products.id =
                    product_packagings.product_id
            WHERE products.id = $1
            GROUP BY products.id
        `;

        pool.query(
            query,
            [productId],
            function (error, result) {
                if (error) {
                    console.log(error);

                    return res.status(500).json({
                        message:
                            "Помилка отримання товару"
                    });
                }

                if (
                    result.rows.length === 0
                ) {
                    return res.status(404).json({
                        message:
                            "Товар не знайдено"
                    });
                }

                res.json(
                    result.rows[0]
                );
            }
        );
    }
);

app.get(
    "/categories",
    function (req, res) {
        pool.query(
            "SELECT * FROM categories ORDER BY id",
            function (error, result) {
                if (error) {
                    console.log(error);

                    return res.status(500).json({
                        message:
                            "Помилка отримання категорій"
                    });
                }

                res.json(
                    result.rows
                );
            }
        );
    }
);

app.post(
    "/admin/categories",
    checkAdmin,
    function (req, res) {
        const name =
            typeof req.body.name === "string"
                ? req.body.name.trim()
                : "";

        const image =
            typeof req.body.image === "string"
                ? req.body.image.trim()
                : "";

        if (name === "") {
            return res.status(400).json({
                message:
                    "Введіть назву категорії"
            });
        }

        if (image === "") {
            return res.status(400).json({
                message:
                    "Оберіть зображення категорії"
            });
        }

        pool.query(
            "INSERT INTO categories (name, image) VALUES ($1, $2) RETURNING id, name, image",
            [name, image],
            function (error, result) {
                if (error) {
                    console.log(error);

                    return res.status(500).json({
                        message:
                            "Помилка створення категорії"
                    });
                }

                res.json(
                    result.rows[0]
                );
            }
        );
    }
);

app.put(
    "/admin/categories/:id",
    checkAdmin,
    function (req, res) {
        const categoryId =
            req.params.id;

        const name =
            typeof req.body.name === "string"
                ? req.body.name.trim()
                : "";

        const image =
            typeof req.body.image === "string"
                ? req.body.image.trim()
                : "";

        if (name === "") {
            return res.status(400).json({
                message:
                    "Введіть назву категорії"
            });
        }

        if (image === "") {
            return res.status(400).json({
                message:
                    "Оберіть зображення категорії"
            });
        }

        const query = `
            UPDATE categories
            SET
                name = $1,
                image = $2
            WHERE id = $3
        `;

        pool.query(
            query,
            [
                name,
                image,
                categoryId
            ],
            function (error, result) {
                if (error) {
                    console.log(error);

                    return res.status(500).json({
                        message:
                            "Помилка оновлення категорії"
                    });
                }

                if (
                    result.rowCount === 0
                ) {
                    return res.status(404).json({
                        message:
                            "Категорію не знайдено"
                    });
                }

                res.json({
                    message:
                        "Категорію оновлено"
                });
            }
        );
    }
);

app.delete(
    "/admin/categories/:id",
    checkAdmin,
    function (req, res) {
        const categoryId =
            req.params.id;

        pool.query(
            "DELETE FROM categories WHERE id = $1",
            [categoryId],
            function (error, result) {
                if (error) {
                    console.log(error);

                    return res.status(500).json({
                        message:
                            "Не вдалося видалити категорію. Спочатку видаліть товари з цієї категорії."
                    });
                }

                if (
                    result.rowCount === 0
                ) {
                    return res.status(404).json({
                        message:
                            "Категорію не знайдено"
                    });
                }

                res.json({
                    message:
                        "Категорію видалено"
                });
            }
        );
    }
);

app.post(
    "/admin/products",
    checkAdmin,
    async function (req, res) {
        const product =
            req.body;

        const name =
            typeof product.name === "string"
                ? product.name.trim()
                : "";

        const description =
            typeof product.description === "string"
                ? product.description.trim()
                : "";

        const image =
            typeof product.image === "string"
                ? product.image.trim()
                : "";

        const categoryId =
            Number(product.categoryId);

        const price =
            Number(product.price);

        const packagings =
            Array.isArray(
                product.packagings
            )
                ? product.packagings
                : [];

        if (
            name === "" ||
            description === "" ||
            image === "" ||
            !categoryId
        ) {
            return res.status(400).json({
                message:
                    "Заповніть усі основні поля товару"
            });
        }

        if (
            packagings.length === 0 &&
            !price
        ) {
            return res.status(400).json({
                message:
                    "Для товару без фасовок потрібно вказати ціну"
            });
        }

        if (packagings.length > 0) {
            for (
                const packaging of packagings
            ) {
                const packagingName =
                    typeof packaging.packaging === "string"
                        ? packaging.packaging.trim()
                        : "";

                const packagingPrice =
                    Number(packaging.price);

                if (
                    packagingName === "" ||
                    !packagingPrice ||
                    packagingPrice <= 0
                ) {
                    return res.status(400).json({
                        message:
                            "Усі фасовки повинні мати назву та ціну"
                    });
                }
            }
        }

        const client =
            await pool.connect();

        try {
            await client.query(
                "BEGIN"
            );

            const productPrice =
                packagings.length > 0
                    ? null
                    : price;

            const productResult =
                await client.query(
                    `
                    INSERT INTO products (
                        name,
                        description,
                        price,
                        image,
                        category_id
                    )
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING id
                    `,
                    [
                        name,
                        description,
                        productPrice,
                        image,
                        categoryId
                    ]
                );

            const productId =
                productResult.rows[0].id;

            for (
                const packaging of packagings
            ) {
                await client.query(
                    `
                    INSERT INTO product_packagings (
                        product_id,
                        packaging,
                        price
                    )
                    VALUES ($1, $2, $3)
                    `,
                    [
                        productId,
                        packaging.packaging.trim(),
                        Number(packaging.price)
                    ]
                );
            }

            await client.query(
                "COMMIT"
            );

            res.json({
                message:
                    "Товар створено",
                productId:
                    productId
            });
        } catch (error) {
            await client.query(
                "ROLLBACK"
            );

            console.log(error);

            res.status(500).json({
                message:
                    "Помилка створення товару"
            });
        } finally {
            client.release();
        }
    }
);

app.put(
    "/admin/products/:id",
    checkAdmin,
    async function (req, res) {
        const productId =
            req.params.id;

        const product =
            req.body;

        const name =
            typeof product.name === "string"
                ? product.name.trim()
                : "";

        const description =
            typeof product.description === "string"
                ? product.description.trim()
                : "";

        const image =
            typeof product.image === "string"
                ? product.image.trim()
                : "";

        const categoryId =
            Number(product.categoryId);

        const price =
            Number(product.price);

        const packagings =
            Array.isArray(
                product.packagings
            )
                ? product.packagings
                : [];

        if (
            name === "" ||
            description === "" ||
            image === "" ||
            !categoryId
        ) {
            return res.status(400).json({
                message:
                    "Заповніть усі основні поля товару"
            });
        }

        if (
            packagings.length === 0 &&
            !price
        ) {
            return res.status(400).json({
                message:
                    "Для товару без фасовок потрібно вказати ціну"
            });
        }

        if (packagings.length > 0) {
            for (
                const packaging of packagings
            ) {
                const packagingName =
                    typeof packaging.packaging === "string"
                        ? packaging.packaging.trim()
                        : "";

                const packagingPrice =
                    Number(packaging.price);

                if (
                    packagingName === "" ||
                    !packagingPrice ||
                    packagingPrice <= 0
                ) {
                    return res.status(400).json({
                        message:
                            "Усі фасовки повинні мати назву та ціну"
                    });
                }
            }
        }

        const client =
            await pool.connect();

        try {
            await client.query(
                "BEGIN"
            );

            const productPrice =
                packagings.length > 0
                    ? null
                    : price;

            const productResult =
                await client.query(
                    `
                    UPDATE products
                    SET
                        name = $1,
                        description = $2,
                        price = $3,
                        image = $4,
                        category_id = $5
                    WHERE id = $6
                    `,
                    [
                        name,
                        description,
                        productPrice,
                        image,
                        categoryId,
                        productId
                    ]
                );

            if (
                productResult.rowCount === 0
            ) {
                await client.query(
                    "ROLLBACK"
                );

                return res.status(404).json({
                    message:
                        "Товар не знайдено"
                });
            }

            await client.query(
                `
                DELETE FROM product_packagings
                WHERE product_id = $1
                `,
                [productId]
            );

            for (
                const packaging of packagings
            ) {
                await client.query(
                    `
                    INSERT INTO product_packagings (
                        product_id,
                        packaging,
                        price
                    )
                    VALUES ($1, $2, $3)
                    `,
                    [
                        productId,
                        packaging.packaging.trim(),
                        Number(packaging.price)
                    ]
                );
            }

            await client.query(
                "COMMIT"
            );

            res.json({
                message:
                    "Товар оновлено"
            });
        } catch (error) {
            await client.query(
                "ROLLBACK"
            );

            console.log(error);

            res.status(500).json({
                message:
                    "Помилка оновлення товару"
            });
        } finally {
            client.release();
        }
    }
);

app.post(
    "/liqpay-callback",
    async function (req, res) {
        const data =
            req.body.data;

        const signature =
            req.body.signature;

        if (!data || !signature) {
            return res.status(400).send(
                "Invalid callback"
            );
        }

        const expectedSignature =
            crypto
                .createHash("sha3-256")
                .update(
                    process.env.LIQPAY_PRIVATE_KEY +
                    data +
                    process.env.LIQPAY_PRIVATE_KEY
                )
                .digest("base64");

        const receivedSignatureBuffer =
            Buffer.from(
                signature,
                "utf8"
            );

        const expectedSignatureBuffer =
            Buffer.from(
                expectedSignature,
                "utf8"
            );

        if (
            receivedSignatureBuffer.length !==
            expectedSignatureBuffer.length
        ) {
            return res.status(403).send(
                "Invalid signature"
            );
        }

        if (
            !crypto.timingSafeEqual(
                receivedSignatureBuffer,
                expectedSignatureBuffer
            )
        ) {
            return res.status(403).send(
                "Invalid signature"
            );
        }

        let paymentData;

        try {
            paymentData =
                JSON.parse(
                    Buffer.from(
                        data,
                        "base64"
                    ).toString("utf8")
                );
        } catch (error) {
            return res.status(400).send(
                "Invalid data"
            );
        }

        const orderId =
            paymentData.order_id;

        const status =
            paymentData.status;

        const paymentAmount =
            Number(paymentData.amount);

        const paymentCurrency =
            paymentData.currency;

        if (!orderId) {
            return res.status(400).send(
                "Missing order_id"
            );
        }

        if (status !== "success") {
            return res.status(200).send(
                "Callback received"
            );
        }

        if (
            !Number.isFinite(
                paymentAmount
            ) ||
            paymentCurrency !== "UAH"
        ) {
            return res.status(400).send(
                "Invalid payment data"
            );
        }

        try {
            const orderResult =
                await pool.query(
                    `
                    SELECT
                        total,
                        payment_status
                    FROM orders
                    WHERE id = $1
                    `,
                    [orderId]
                );

            if (
                orderResult.rows.length === 0
            ) {
                console.log(
                    "LiqPay: замовлення",
                    orderId,
                    "не знайдено"
                );

                return res.status(404).send(
                    "Order not found"
                );
            }

            const order =
                orderResult.rows[0];

            const orderTotal =
                Number(order.total);

            if (
                paymentAmount !==
                orderTotal
            ) {
                console.log(
                    "LiqPay: невідповідність суми для замовлення",
                    orderId,
                    "Очікувалось:",
                    orderTotal,
                    "Отримано:",
                    paymentAmount
                );

                return res.status(400).send(
                    "Invalid payment amount"
                );
            }

            if (
                order.payment_status ===
                "paid"
            ) {
                return res.status(200).send(
                    "Already paid"
                );
            }

            const updateResult =
                await pool.query(
                    `
                    UPDATE orders
                    SET payment_status = 'paid'
                    WHERE id = $1
                    AND payment_status = 'pending'
                    `,
                    [orderId]
                );

            if (
                updateResult.rowCount === 0
            ) {
                return res.status(409).send(
                    "Payment status was already changed"
                );
            }

            console.log(
                "LiqPay: замовлення",
                orderId,
                "підтверджено як paid"
            );

            res.status(200).send(
                "OK"
            );
        } catch (error) {
            console.error(
                "Помилка LiqPay callback:",
                error
            );

            res.status(500).send(
                "Database error"
            );
        }
    }
);

app.post(
    "/order",
    orderLimiter,
    async function (req, res) {
        const order =
            req.body;

        const name =
            order.customerName;

        const phone =
            order.customerPhone;

        const address =
            order.customerAddress;

        const delivery =
            order.deliveryMethod;

        const items =
            order.items;

        if (
            !name ||
            !phone ||
            !address ||
            !delivery ||
            !Array.isArray(items) ||
            items.length === 0
        ) {
            return res.status(400).json({
                message:
                    "Некоректні дані замовлення"
            });
        }

        try {
            let total = 0;

            const verifiedItems = [];

            for (
                const item of items
            ) {
                const productId =
                    Number(item.id);

                const quantity =
                    Number(item.quantity);

                if (
                    !Number.isInteger(
                        productId
                    ) ||
                    !Number.isInteger(
                        quantity
                    ) ||
                    quantity < 1
                ) {
                    return res.status(400).json({
                        message:
                            "Некоректний товар у замовленні"
                    });
                }

                const productResult =
                    await pool.query(
                        `
                        SELECT
                            products.id,
                            products.name,
                            products.price,
                            products.image
                        FROM products
                        WHERE products.id = $1
                        `,
                        [productId]
                    );

                if (
                    productResult.rows.length === 0
                ) {
                    return res.status(400).json({
                        message:
                            "Товар не знайдено"
                    });
                }

                const product =
                    productResult.rows[0];

                let realPrice =
                    Number(product.price);

                let realPackaging =
                    null;

                if (item.packaging) {
                    const packagingResult =
                        await pool.query(
                            `
                            SELECT
                                packaging,
                                price
                            FROM product_packagings
                            WHERE product_id = $1
                            AND packaging = $2
                            `,
                            [
                                productId,
                                item.packaging
                            ]
                        );

                    if (
                        packagingResult.rows.length === 0
                    ) {
                        return res.status(400).json({
                            message:
                                "Фасовку товару не знайдено"
                        });
                    }

                    realPackaging =
                        packagingResult.rows[0]
                            .packaging;

                    realPrice =
                        Number(
                            packagingResult.rows[0]
                                .price
                        );
                }

                const itemTotal =
                    realPrice * quantity;

                total =
                    total + itemTotal;

                verifiedItems.push({
                    id: product.id,
                    name: product.name,
                    packaging:
                        realPackaging,
                    price: realPrice,
                    quantity: quantity,
                    image: product.image
                });
            }

            const query = `
                INSERT INTO orders (
                    customer_name,
                    customer_phone,
                    customer_address,
                    delivery_method,
                    payment_method,
                    payment_status,
                    items,
                    total
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8
                )
                RETURNING id
            `;

            const result =
                await pool.query(
                    query,
                    [
                        name,
                        phone,
                        address,
                        delivery,
                        "LiqPay",
                        "pending",
                        JSON.stringify(
                            verifiedItems
                        ),
                        total
                    ]
                );

            const orderId =
                result.rows[0].id;

            const payment =
                createLiqPayData(
                    total,
                    orderId
                );

            res.json({
                message:
                    "Замовлення збережено",
                orderId:
                    orderId,
                liqpayData:
                    payment.data,
                liqpaySignature:
                    payment.signature
            });
        } catch (error) {
            console.log(
                "Помилка створення замовлення:",
                error
            );

            res.status(500).json({
                message:
                    "Помилка збереження замовлення"
            });
        }
    }
);

app.post(
    "/admin/login",
    adminLoginLimiter,
    function (req, res) {
        const secret =
            req.body.secret;

        if (secret !== adminSecret) {
            return res.status(401).send(
                "Неверный пароль"
            );
        }

        const token =
            crypto
                .randomBytes(32)
                .toString("hex");

        adminSessions.set(
            token,
            {
                createdAt: Date.now()
            }
        );

        res.cookie(
            "admin_session",
            token,
            {
                httpOnly: true,
                sameSite: "strict",
                secure: false,
                maxAge:
                    SESSION_DURATION
            }
        );

        res.json({
            success: true
        });
    }
);

app.post(
    "/admin/upload-image",
    checkAdmin,
    upload.single("image"),
    async function (req, res) {
        if (!req.file) {
            return res.status(400).json({
                message:
                    "Файл не вибрано"
            });
        }

        const originalName =
            req.file.originalname;

        const extension =
            path.extname(
                originalName
            ).toLowerCase();

        const allowedExtensions = [
            ".jpg",
            ".jpeg",
            ".png",
            ".webp"
        ];

        if (
            !allowedExtensions.includes(
                extension
            )
        ) {
            fs.unlinkSync(
                req.file.path
            );

            return res.status(400).json({
                message:
                    "Дозволені тільки JPG, JPEG, PNG та WEBP"
            });
        }

        const oldPath =
            req.file.path;

        const newFileName =
            req.file.filename +
            extension;

        const fileType =
            await fromFile(
                oldPath
            );

        if (
            !fileType ||
            ![
                "jpg",
                "jpeg",
                "png",
                "webp"
            ].includes(fileType.ext)
        ) {
            fs.unlinkSync(
                oldPath
            );

            return res.status(400).json({
                message:
                    "Файл не є справжнім зображенням"
            });
        }

        const newPath =
            path.join(
                __dirname,
                "..",
                "images",
                newFileName
            );

        fs.renameSync(
            oldPath,
            newPath
        );

        res.json({
            message:
                "Зображення завантажено",
            image:
                "images/" +
                newFileName
        });
    }
);

app.get(
    "/orders",
    checkAdmin,
    function (req, res) {
        pool.query(
            "SELECT * FROM orders ORDER BY created_at DESC",
            function (error, result) {
                if (error) {
                    console.log(error);

                    return res.status(500).send(
                        "Помилка отримання замовлень"
                    );
                }

                res.json(
                    result.rows
                );
            }
        );
    }
);

app.delete(
    "/orders/:id",
    checkAdmin,
    function (req, res) {
        const id =
            req.params.id;

        pool.query(
            "DELETE FROM orders WHERE id = $1",
            [id],
            function (error, result) {
                if (error) {
                    console.log(error);

                    return res.status(500).send(
                        "Помилка видалення замовлення"
                    );
                }

                res.send(
                    "Замовлення видалено"
                );
            }
        );
    }
);

app.patch(
    "/orders/:id/tracking",
    checkAdmin,
    function (req, res) {
        const id =
            req.params.id;

        const trackingCode =
            req.body.trackingCode;

        pool.query(
            "UPDATE orders SET tracking_code = $1, status = 'Відправлено' WHERE id = $2",
            [
                trackingCode,
                id
            ],
            function (error, result) {
                if (error) {
                    console.log(error);

                    return res.status(500).send(
                        "Помилка збереження трек-коду"
                    );
                }

                res.send(
                    "Трек-код збережено"
                );
            }
        );
    }
);

app.delete(
    "/admin/products/:id",
    checkAdmin,
    function (req, res) {
        const productId =
            req.params.id;

        const query = `
            DELETE FROM products
            WHERE id = $1
        `;

        pool.query(
            query,
            [productId],
            function (error, result) {
                if (error) {
                    console.log(error);

                    return res.status(500).json({
                        message:
                            "Помилка видалення товару"
                    });
                }

                if (
                    result.rowCount === 0
                ) {
                    return res.status(404).json({
                        message:
                            "Товар не знайдено"
                    });
                }

                res.json({
                    message:
                        "Товар видалено"
                });
            }
        );
    }
);

checkSentOrders();

setInterval(
    checkSentOrders,
    5 * 60 * 1000
);

app.listen(
    3000,
    function () {
        console.log(
            "Server is running on port 3000"
        );
    }
);