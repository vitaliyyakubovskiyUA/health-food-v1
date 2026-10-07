const secretInput = document.querySelector("#admin-secret");
const loginButton = document.querySelector("#login-button");
const adminLogin = document.querySelector(".admin-login");
const adminProducts = document.querySelector("#admin-products");
const adminMessage = document.querySelector("#admin-message");

const categorySelect = document.querySelector("#product-category");
const packagingsContainer = document.querySelector("#packagings");
const addPackagingButton = document.querySelector("#add-packaging-button");
const productPriceInput = document.querySelector("#product-price");

const createProductButton =
    document.querySelector("#create-product-button");

const cancelEditButton =
    document.querySelector("#cancel-edit-button");

const productFormTitle =
    document.querySelector("#product-form-title");

const newCategoryNameInput =
    document.querySelector("#new-category-name");

const addCategoryButton =
    document.querySelector("#add-category-button");

const newCategoryImageInput =
    document.querySelector("#new-category-image");

const adminCategoriesList =
    document.querySelector("#admin-categories-list");

let editingProductId = null;

async function uploadProductImage() {
    const imageInput = document.querySelector("#product-image");

    if (imageInput.files.length === 0) {
        return "";
    }

    const formData = new FormData();

    formData.append("image", imageInput.files[0]);

    const response = await fetch(
        "http://localhost:3000/admin/upload-image",
        {
            method: "POST",
            credentials: "include",
            body: formData
        }
    );

    console.log("UPLOAD STATUS:", response.status);

    if (!response.ok) {
        const data = await response.json();

        throw new Error(
            data.message ||
            "Не вдалося завантажити зображення"
        );
    }

    const data = await response.json();

    return data.image;
}

function openAdminPanel() {
    adminLogin.style.display = "none";
    adminProducts.style.display = "block";

    adminMessage.textContent = "Вхід виконано";

    loadCategories();
    loadAdminCategories();
    loadProducts();
    loadOrders();

    console.log("LOAD ORDERS ЗАПУЩЕН");
}

loginButton.addEventListener("click", function () {
    const secret = secretInput.value.trim();

    if (secret === "") {
        adminMessage.textContent =
            "Введіть пароль адміністратора";

        return;
    }

    fetch(
        "http://localhost:3000/admin/login",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({
                secret: secret
            })
        }
    )
        .then(function (response) {
            if (!response.ok) {
                throw new Error("Неправильний пароль");
            }

            return response.json();
        })
        .then(function (data) {
            if (!data.success) {
                throw new Error("Неправильний пароль");
            }

            secretInput.value = "";

            openAdminPanel();
        })
        .catch(function (error) {
            adminMessage.textContent = error.message;
        });
});

function loadCategories() {
    categorySelect.innerHTML = `
        <option value="" disabled selected>
            Оберіть категорію
        </option>
    `;

    fetch("http://localhost:3000/categories")
        .then(function (response) {
            if (!response.ok) {
                throw new Error(
                    "Не вдалося отримати категорії"
                );
            }

            return response.json();
        })
        .then(function (categories) {
            categories.forEach(function (category) {
                const option =
                    document.createElement("option");

                option.value = category.id;
                option.textContent = category.name;

                categorySelect.appendChild(option);
            });
        })
        .catch(function (error) {
            adminMessage.textContent = error.message;
        });
}

function updatePriceField() {
    const packagingRows =
        document.querySelectorAll(".packaging-row");

    if (packagingRows.length > 0) {
        productPriceInput.value = "";
        productPriceInput.disabled = true;
        productPriceInput.placeholder =
            "Ціна вказується у фасовках";
    } else {
        productPriceInput.disabled = false;
        productPriceInput.placeholder = "Ціна";
    }
}

function resetProductForm() {
    editingProductId = null;

    document.querySelector("#product-name").value = "";
    document.querySelector("#product-description").value = "";

    productPriceInput.value = "";
    document.querySelector("#product-image").value = "";
    categorySelect.value = "";

    packagingsContainer.innerHTML = "";

    const currentImage =
        document.querySelector("#current-product-image");

    if (currentImage) {
        currentImage.remove();
    }

    productFormTitle.textContent = "Додати товар";
    createProductButton.textContent = "Створити товар";
    cancelEditButton.style.display = "none";

    updatePriceField();
}

addPackagingButton.addEventListener("click", function () {
    const packagingRow =
        document.createElement("div");

    packagingRow.className = "packaging-row";

    const packagingInput =
        document.createElement("input");

    packagingInput.type = "text";
    packagingInput.placeholder = "Фасовка";

    const packagingPriceInput =
        document.createElement("input");

    packagingPriceInput.type = "number";
    packagingPriceInput.placeholder = "Ціна";

    const removeButton =
        document.createElement("button");

    removeButton.type = "button";
    removeButton.textContent = "Видалити";

    removeButton.addEventListener("click", function () {
        packagingRow.remove();
        updatePriceField();
    });

    packagingRow.appendChild(packagingInput);
    packagingRow.appendChild(packagingPriceInput);
    packagingRow.appendChild(removeButton);

    packagingsContainer.appendChild(packagingRow);

    updatePriceField();
});

updatePriceField();

createProductButton.addEventListener(
    "click",
    async function () {
        const name =
            document.querySelector("#product-name")
                .value
                .trim();

        const description =
            document.querySelector("#product-description")
                .value
                .trim();

        const price =
            Number(productPriceInput.value);

        const imageInput =
            document.querySelector("#product-image");

        const categoryId =
            Number(categorySelect.value);

        const packagingRows =
            document.querySelectorAll(".packaging-row");

        const packagings = [];

        packagingRows.forEach(function (row) {
            const inputs =
                row.querySelectorAll("input");

            const packaging =
                inputs[0].value.trim();

            const packagingPrice =
                Number(inputs[1].value);

            if (
                packaging !== "" &&
                packagingPrice > 0
            ) {
                packagings.push({
                    packaging: packaging,
                    price: packagingPrice
                });
            }
        });

        if (
            name === "" ||
            description === "" ||
            !categoryId
        ) {
            adminMessage.textContent =
                "Заповніть усі основні поля товару";

            return;
        }

        if (
            !editingProductId &&
            imageInput.files.length === 0
        ) {
            adminMessage.textContent =
                "Оберіть зображення товару";

            return;
        }

        if (
            packagings.length === 0 &&
            !price
        ) {
            adminMessage.textContent =
                "Вкажіть ціну товару";

            return;
        }

        if (
            packagingRows.length > 0 &&
            packagings.length === 0
        ) {
            adminMessage.textContent =
                "Заповніть фасовки та їхні ціни";

            return;
        }

        try {
            let image = "";

            if (imageInput.files.length > 0) {
                adminMessage.textContent =
                    "Завантаження зображення...";

                image = await uploadProductImage();
            }

            if (
                editingProductId &&
                image === ""
            ) {
                image =
                    document.querySelector(
                        "#current-product-image"
                    )?.dataset.image || "";
            }

            const product = {
                name: name,
                description: description,
                price: price,
                image: image,
                categoryId: categoryId,
                packagings: packagings
            };

            const url = editingProductId
                ? "http://localhost:3000/admin/products/" +
                  editingProductId
                : "http://localhost:3000/admin/products";

            const method = editingProductId
                ? "PUT"
                : "POST";

            const response = await fetch(
                url,
                {
                    method: method,
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(product)
                }
            );

            if (!response.ok) {
                const data = await response.json();

                throw new Error(
                    data.message ||
                    "Не вдалося зберегти товар"
                );
            }

            await response.json();

            adminMessage.textContent =
                editingProductId
                    ? "Товар оновлено"
                    : "Товар створено";

            resetProductForm();

            loadProducts();
        } catch (error) {
            adminMessage.textContent =
                error.message;
        }
    }
);

cancelEditButton.addEventListener(
    "click",
    function () {
        resetProductForm();

        adminMessage.textContent =
            "Редагування скасовано";
    }
);

function loadProducts() {
    const productsList =
        document.querySelector("#admin-products-list");

    productsList.innerHTML = "";

    fetch("http://localhost:3000/products")
        .then(function (response) {
            if (!response.ok) {
                throw new Error(
                    "Не вдалося отримати товари"
                );
            }

            return response.json();
        })
        .then(function (products) {
            products.reverse();

            products.forEach(function (product) {
                const productRow =
                    document.createElement("div");

                productRow.className =
                    "admin-product-row";

                if (product.image) {
                    const productImage =
                        document.createElement("img");

                    productImage.src =
                        product.image;

                    productImage.alt =
                        product.name;

                    productImage.className =
                        "admin-product-image";

                    productRow.appendChild(
                        productImage
                    );
                }

                const productName =
                    document.createElement("strong");

                productName.textContent =
                    product.name;

                productRow.appendChild(
                    productName
                );

                const productPrice =
                    document.createElement("span");

                if (
                    product.packagings &&
                    product.packagings.length > 0
                ) {
                    productPrice.textContent =
                        "Є фасовки";
                } else {
                    productPrice.textContent =
                        product.price + " грн";
                }

                productRow.appendChild(
                    productPrice
                );

                const editButton =
                    document.createElement("button");

                editButton.type = "button";
                editButton.textContent =
                    "Редагувати";

                editButton.addEventListener(
                    "click",
                    function () {
                        editingProductId =
                            product.id;

                        document.querySelector(
                            "#product-name"
                        ).value = product.name;

                        document.querySelector(
                            "#product-description"
                        ).value =
                            product.description;

                        const imageInput =
                            document.querySelector(
                                "#product-image"
                            );

                        imageInput.value = "";

                        let currentImage =
                            document.querySelector(
                                "#current-product-image"
                            );

                        if (currentImage) {
                            currentImage.remove();
                        }

                        if (product.image) {
                            currentImage =
                                document.createElement(
                                    "img"
                                );

                            currentImage.id =
                                "current-product-image";

                            currentImage.src =
                                product.image;

                            currentImage.alt =
                                product.name;

                            currentImage.dataset.image =
                                product.image;

                            imageInput.insertAdjacentElement(
                                "afterend",
                                currentImage
                            );

                            imageInput.onchange =
                                function () {
                                    if (
                                        imageInput.files
                                            .length === 0
                                    ) {
                                        return;
                                    }

                                    currentImage.src =
                                        URL.createObjectURL(
                                            imageInput.files[0]
                                        );
                                };
                        }

                        categorySelect.value =
                            product.category_id;

                        packagingsContainer.innerHTML =
                            "";

                        if (
                            product.packagings &&
                            product.packagings.length > 0
                        ) {
                            product.packagings.forEach(
                                function (packaging) {
                                    const packagingRow =
                                        document.createElement(
                                            "div"
                                        );

                                    packagingRow.className =
                                        "packaging-row";

                                    const packagingInput =
                                        document.createElement(
                                            "input"
                                        );

                                    packagingInput.type =
                                        "text";

                                    packagingInput.value =
                                        packaging.packaging;

                                    const packagingPriceInput =
                                        document.createElement(
                                            "input"
                                        );

                                    packagingPriceInput.type =
                                        "number";

                                    packagingPriceInput.value =
                                        packaging.price;

                                    const removeButton =
                                        document.createElement(
                                            "button"
                                        );

                                    removeButton.type =
                                        "button";

                                    removeButton.textContent =
                                        "Видалити";

                                    removeButton.addEventListener(
                                        "click",
                                        function () {
                                            packagingRow.remove();
                                            updatePriceField();
                                        }
                                    );

                                    packagingRow.appendChild(
                                        packagingInput
                                    );

                                    packagingRow.appendChild(
                                        packagingPriceInput
                                    );

                                    packagingRow.appendChild(
                                        removeButton
                                    );

                                    packagingsContainer.appendChild(
                                        packagingRow
                                    );
                                }
                            );

                            productPriceInput.value = "";
                        } else {
                            productPriceInput.value =
                                product.price;
                        }

                        updatePriceField();

                        productFormTitle.firstChild.textContent =
                            "Редагувати товар ";

                        createProductButton.textContent =
                            "Зберегти зміни";

                        cancelEditButton.style.display =
                            "block";

                        adminMessage.textContent =
                            "Редагування товару: " +
                            product.name;

                        productBlock.classList.remove(
                            "product-collapsed"
                        );

                        window.scrollTo({
                            top: 0,
                            behavior: "smooth"
                        });
                    }
                );

                const actions =
                    document.createElement("div");

                actions.className =
                    "admin-product-actions";

                actions.appendChild(
                    editButton
                );

                const deleteButton =
                    document.createElement("button");

                deleteButton.type = "button";
                deleteButton.textContent = "";
                deleteButton.className =
                    "delete-product-button";

                deleteButton.addEventListener(
                    "click",
                    function () {
                        const confirmed =
                            confirm(
                                "Видалити товар «" +
                                product.name +
                                "»?"
                            );

                        if (!confirmed) {
                            return;
                        }

                        fetch(
                            "http://localhost:3000/admin/products/" +
                            product.id,
                            {
                                method: "DELETE",
                                credentials: "include"
                            }
                        )
                            .then(function (response) {
                                if (!response.ok) {
                                    throw new Error(
                                        "Не вдалося видалити товар"
                                    );
                                }

                                return response.json();
                            })
                            .then(function () {
                                loadProducts();

                                adminMessage.textContent =
                                    "Товар видалено";
                            })
                            .catch(function (error) {
                                adminMessage.textContent =
                                    error.message;
                            });
                    }
                );

                actions.appendChild(
                    deleteButton
                );

                productRow.appendChild(
                    actions
                );

                productsList.appendChild(
                    productRow
                );
            });
        })
        .catch(function (error) {
            adminMessage.textContent =
                error.message;
        });
}

function loadAdminCategories() {
    fetch("http://localhost:3000/categories")
        .then(function (response) {
            return response.json();
        })
        .then(function (categories) {
            adminCategoriesList.innerHTML = "";

            categories.forEach(function (category) {
                const categoryRow =
                    document.createElement("div");

                categoryRow.className =
                    "admin-category-row";

                const categoryName =
                    document.createElement("span");

                categoryName.textContent =
                    category.name;

                const editButton =
                    document.createElement("button");

                editButton.type = "button";
                editButton.textContent =
                    "Редагувати";

                editButton.addEventListener(
                    "click",
                    function () {
                        categoryRow.innerHTML = "";

                        const nameInput =
                            document.createElement(
                                "input"
                            );

                        nameInput.type = "text";
                        nameInput.value =
                            category.name;

                        const imageInput =
                            document.createElement(
                                "input"
                            );

                        imageInput.type = "file";
                        imageInput.accept =
                            "image/jpeg,image/png,image/webp";

                        const saveButton =
                            document.createElement(
                                "button"
                            );

                        saveButton.type = "button";
                        saveButton.textContent =
                            "Зберегти";

                        const cancelButton =
                            document.createElement(
                                "button"
                            );

                        cancelButton.type = "button";
                        cancelButton.textContent =
                            "Скасувати";

                        categoryRow.appendChild(
                            nameInput
                        );

                        categoryRow.appendChild(
                            imageInput
                        );

                        categoryRow.appendChild(
                            saveButton
                        );

                        categoryRow.appendChild(
                            cancelButton
                        );

                        cancelButton.addEventListener(
                            "click",
                            function () {
                                loadAdminCategories();
                            }
                        );

                        saveButton.addEventListener(
                            "click",
                            async function () {
                                const name =
                                    nameInput.value.trim();

                                if (name === "") {
                                    adminMessage.textContent =
                                        "Введіть назву категорії";

                                    return;
                                }

                                let image =
                                    category.image;

                                if (
                                    imageInput.files.length >
                                    0
                                ) {
                                    const formData =
                                        new FormData();

                                    formData.append(
                                        "image",
                                        imageInput.files[0]
                                    );

                                    const uploadResponse =
                                        await fetch(
                                            "http://localhost:3000/admin/upload-image",
                                            {
                                                method: "POST",
                                                credentials: "include",
                                                body: formData
                                            }
                                        );

                                    const imageData =
                                        await uploadResponse.json();

                                    if (
                                        !uploadResponse.ok
                                    ) {
                                        adminMessage.textContent =
                                            imageData.message ||
                                            "Не вдалося завантажити зображення";

                                        return;
                                    }

                                    image =
                                        imageData.image;
                                }

                                const response =
                                    await fetch(
                                        "http://localhost:3000/admin/categories/" +
                                        category.id,
                                        {
                                            method: "PUT",
                                            credentials: "include",
                                            headers: {
                                                "Content-Type":
                                                    "application/json"
                                            },
                                            body:
                                                JSON.stringify({
                                                    name: name,
                                                    image: image
                                                })
                                        }
                                    );

                                const data =
                                    await response.json();

                                if (!response.ok) {
                                    adminMessage.textContent =
                                        data.message ||
                                        "Помилка оновлення категорії";

                                    return;
                                }

                                adminMessage.textContent =
                                    "Категорію оновлено";

                                loadAdminCategories();
                                loadCategories();
                            }
                        );
                    }
                );

                const deleteButton =
                    document.createElement("button");

                deleteButton.type = "button";
                deleteButton.textContent =
                    "Видалити";

                deleteButton.addEventListener(
                    "click",
                    function () {
                        fetch(
                            "http://localhost:3000/admin/categories/" +
                            category.id,
                            {
                                method: "DELETE",
                                credentials: "include"
                            }
                        )
                            .then(function (response) {
                                return response.json();
                            })
                            .then(function (data) {
                                adminMessage.textContent =
                                    data.message;

                                if (
                                    data.message ===
                                    "Категорію видалено"
                                ) {
                                    loadAdminCategories();
                                    loadCategories();
                                }
                            });
                    }
                );

                categoryRow.appendChild(
                    categoryName
                );

                categoryRow.appendChild(
                    editButton
                );

                categoryRow.appendChild(
                    deleteButton
                );

                adminCategoriesList.appendChild(
                    categoryRow
                );
            });
        });
}

addCategoryButton.addEventListener(
    "click",
    function () {
        const name =
            newCategoryNameInput.value.trim();

        const imageFile =
            newCategoryImageInput.files[0];

        if (name === "") {
            adminMessage.textContent =
                "Введіть назву категорії";

            return;
        }

        if (!imageFile) {
            adminMessage.textContent =
                "Оберіть зображення категорії";

            return;
        }

        const formData = new FormData();

        formData.append(
            "image",
            imageFile
        );

        fetch(
            "http://localhost:3000/admin/upload-image",
            {
                method: "POST",
                credentials: "include",
                body: formData
            }
        )
            .then(function (response) {
                return response.json();
            })
            .then(function (imageData) {
                if (!imageData.image) {
                    throw new Error(
                        imageData.message ||
                        "Не вдалося завантажити зображення"
                    );
                }

                return fetch(
                    "http://localhost:3000/admin/categories",
                    {
                        method: "POST",
                        credentials: "include",
                        headers: {
                            "Content-Type":
                                "application/json"
                        },
                        body: JSON.stringify({
                            name: name,
                            image: imageData.image
                        })
                    }
                );
            })
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                adminMessage.textContent =
                    data.message ||
                    "Категорію створено";

                if (data.id) {
                    newCategoryNameInput.value = "";
                    newCategoryImageInput.value = "";

                    loadAdminCategories();
                    loadCategories();
                }
            })
            .catch(function (error) {
                adminMessage.textContent =
                    error.message;
            });
    }
);

const categoriesToggle =
    document.querySelector("#categories-toggle");

const categoriesBlock =
    document.querySelector(".admin-categories");

categoriesBlock.classList.add(
    "categories-collapsed"
);

categoriesToggle.addEventListener(
    "click",
    function () {
        categoriesBlock.classList.toggle(
            "categories-collapsed"
        );

        categoriesToggle.classList.toggle(
            "section-open",
            !categoriesBlock.classList.contains(
                "categories-collapsed"
            )
        );
    }
);

const ordersToggle =
    document.querySelector("#orders-toggle");

const ordersBlock =
    document.querySelector(".admin-orders-list");

ordersBlock.classList.add(
    "orders-collapsed"
);

ordersToggle.addEventListener(
    "click",
    function () {
        ordersBlock.classList.toggle(
            "orders-collapsed"
        );

        ordersToggle.classList.toggle(
            "section-open",
            !ordersBlock.classList.contains(
                "orders-collapsed"
            )
        );
    }
);

const productsToggle =
    document.querySelector("#products-toggle");

const productsBlock =
    document.querySelector(".admin-products-list");

productsBlock.classList.add(
    "products-collapsed"
);

productsToggle.addEventListener(
    "click",
    function () {
        productsBlock.classList.toggle(
            "products-collapsed"
        );

        productsToggle.classList.toggle(
            "section-open",
            !productsBlock.classList.contains(
                "products-collapsed"
            )
        );
    }
);

const productToggle =
    document.querySelector("#product-form-title");

const productBlock =
    document.querySelector(".admin-add-product");

productBlock.classList.add(
    "product-collapsed"
);

productToggle.addEventListener(
    "click",
    function () {
        productBlock.classList.toggle(
            "product-collapsed"
        );

        productToggle.classList.toggle(
            "section-open",
            !productBlock.classList.contains(
                "product-collapsed"
            )
        );
    }
);

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function loadOrders() {
    const response = await fetch(
        "http://localhost:3000/orders",
        {
            credentials: "include"
        }
    );

    const orders = await response.json();

    const ordersList =
        document.querySelector("#admin-orders-list");

    ordersList.innerHTML = "";

    orders.forEach(function (order) {
        const orderElement =
            document.createElement("div");

        orderElement.className =
            "admin-order";

        const statusText =
            order.status === "Нове"
                ? "Нове замовлення"
                : order.status;

        const isNewOrder =
            order.status === "Нове";

        orderElement.classList.toggle(
            "order-expanded",
            isNewOrder
        );

        const safeCustomerName =
            escapeHtml(order.customer_name);

        const safeCustomerPhone =
            escapeHtml(order.customer_phone);

        const safeCustomerAddress =
            escapeHtml(order.customer_address);

        const safeStatus =
            escapeHtml(statusText);

        orderElement.innerHTML = `
            <div class="admin-order-compact">
                <strong>№${order.id}</strong>

                <span>
                    ${safeCustomerName}
                </span>

                <span>
                    ${safeCustomerPhone}
                </span>

                <span>
                    ${safeStatus}
                </span>

                <button
                    type="button"
                    class="order-toggle-button order-status-dot"
                    data-status="${order.status}"
                ></button>
            </div>

            <div class="admin-order-full">

                <h3>Замовлення №${order.id}</h3>

                <div class="admin-order-row">
                    Дата:
                    ${new Date(
                        order.created_at
                    ).toLocaleString("uk-UA")}
                </div>

                <div class="admin-order-row">
                    Клієнт:
                    ${safeCustomerName}
                </div>

                <div class="admin-order-row">
                    Телефон:
                    ${safeCustomerPhone}
                </div>

                <div class="admin-order-row">
                    Доставка:
                    ${escapeHtml(order.delivery_method)}
                </div>

                <div class="admin-order-row">
                    Область:
                    ${escapeHtml(
                        order.customer_address.split(", ")[0]
                    )}
                </div>

                <div class="admin-order-row">
                    Місто:
                    ${escapeHtml(
                        order.customer_address.split(", ")[1]
                    )}
                </div>

                <div class="admin-order-row">
                    Відділення / адреса:
                    ${escapeHtml(
                        order.customer_address.split(", ")[2]
                    )}
                </div>

                <div class="admin-order-row">
                    Оплата:
                    ${
                        order.payment_status === "paid"
                            ? "Оплачено"
                            : escapeHtml(
                                order.payment_status
                            )
                    }
                </div>

                <div class="admin-order-row">
                    Сума:
                    ${order.total} грн
                </div>

                <div class="admin-order-row">
                    Статус:
                    ${safeStatus}
                </div>

                <div class="admin-order-row">
                    <strong>Товари:</strong>

                    ${
                        order.items
                            .map(function (item) {
                                return `
                                    <div>
                                        ${escapeHtml(item.name)}
                                        — ${escapeHtml(item.packaging)}
                                        — ${item.quantity} шт.
                                        — ${item.price} грн
                                    </div>
                                `;
                            })
                            .join("")
                    }
                </div>

                <div class="admin-order-row">
                    Трек-код:

                    <input
                        type="text"
                        class="tracking-input"
                        value="${escapeHtml(
                            order.tracking_code || ""
                        )}"
                        placeholder="Введіть трек-код"
                        data-order-id="${order.id}"
                    >
                </div>

                <div class="admin-order-row">
                    Telegram:
                    ${
                        order.telegram_chat_id
                            ? "підключено"
                            : "не підключено"
                    }
                </div>

                <button
                    type="button"
                    class="delete-order-button"
                    data-order-id="${order.id}"
                >
                    Видалити замовлення
                </button>

            </div>
        `;

        ordersList.appendChild(
            orderElement
        );
    });
}

async function saveTracking(
    orderId,
    trackingCode
) {
    const response = await fetch(
        `http://localhost:3000/orders/${orderId}/tracking`,
        {
            method: "PATCH",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                trackingCode: trackingCode
            })
        }
    );

    const result =
        await response.text();

    if (!response.ok) {
        throw new Error(result);
    }

    return result;
}

async function handleTrackingSave(input) {
    const orderId =
        input.dataset.orderId;

    const trackingCode =
        input.value.trim();

    if (!trackingCode) {
        return;
    }

    try {
        await saveTracking(
            orderId,
            trackingCode
        );

        await loadOrders();
    } catch (error) {
        console.log(error);

        alert(
            "Помилка збереження трек-коду"
        );
    }
}

document.addEventListener(
    "click",
    function (event) {
        const compactRow =
            event.target.closest(
                ".admin-order-compact"
            );

        if (!compactRow) {
            return;
        }

        const orderElement =
            compactRow.closest(
                ".admin-order"
            );

        const button =
            compactRow.querySelector(
                ".order-toggle-button"
            );

        if (event.target === button) {
            orderElement.classList.remove(
                "order-expanded"
            );

            return;
        }

        orderElement.classList.add(
            "order-expanded"
        );
    }
);

document.addEventListener(
    "keydown",
    async function (event) {
        if (
            !event.target.classList.contains(
                "tracking-input"
            )
        ) {
            return;
        }

        if (event.key !== "Enter") {
            return;
        }

        event.preventDefault();

        await handleTrackingSave(
            event.target
        );
    }
);

document.addEventListener(
    "focusout",
    async function (event) {
        if (
            !event.target.classList.contains(
                "tracking-input"
            )
        ) {
            return;
        }

        await handleTrackingSave(
            event.target
        );
    }
);

document.addEventListener(
    "click",
    async function (event) {
        if (
            !event.target.classList.contains(
                "delete-order-button"
            )
        ) {
            return;
        }

        const button = event.target;

        const orderId =
            button.dataset.orderId;

        const confirmed =
            confirm(
                "Ви точно хочете видалити це замовлення?"
            );

        if (!confirmed) {
            return;
        }

        try {
            button.disabled = true;
            button.textContent =
                "Видалення...";

            const response =
                await fetch(
                    `http://localhost:3000/orders/${orderId}`,
                    {
                        method: "DELETE",
                        credentials: "include"
                    }
                );

            const result =
                await response.text();

            if (!response.ok) {
                throw new Error(result);
            }

            alert("Замовлення видалено");

            await loadOrders();
        } catch (error) {
            console.log(error);

            alert(
                "Помилка видалення замовлення"
            );
        } finally {
            button.disabled = false;
            button.textContent =
                "Видалити замовлення";
        }
    }
);

fetch(
    "http://localhost:3000/admin/check",
    {
        credentials: "include"
    }
)
    .then(function (response) {
        if (!response.ok) {
            throw new Error(
                "Сесія недійсна"
            );
        }

        return response.json();
    })
    .then(function (data) {
        if (data.success) {
            openAdminPanel();

            document.getElementById(
                "logout-button"
            ).style.display = "block";
        }
    })
    .catch(function () {
        // Користувач ще не увійшов
    });

document
    .getElementById("logout-button")
    .addEventListener(
        "click",
        async function () {
            const response =
                await fetch(
                    "http://localhost:3000/admin/logout",
                    {
                        method: "POST",
                        credentials: "include"
                    }
                );

            if (!response.ok) {
                return;
            }

            window.location.reload();
        }
    );