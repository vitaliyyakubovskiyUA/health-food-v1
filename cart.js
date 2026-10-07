const cart = JSON.parse(localStorage.getItem("cart")) || [];

const cartCount = document.querySelector("#cartCount");
const cartItems = document.querySelector("#cart-items");

function updateCartCount() {
    let totalQuantity = 0;

    cart.forEach(function (product) {
        totalQuantity = totalQuantity + product.quantity;
    });

    if (cartCount) {
        cartCount.textContent = totalQuantity;
    }
}

function saveCart() {
    localStorage.setItem("cart", JSON.stringify(cart));
}

cartItems.style.visibility = "hidden";

async function checkCartProducts() {
    try {
        const response = await fetch("http://localhost:3000/products");

        if (!response.ok) {
            throw new Error("Не вдалося отримати товари");
        }

        const products = await response.json();

        const actualProductIds = products.map(function (product) {
            return product.id;
        });

        const removedProducts = cart.filter(function (cartProduct) {
            return !actualProductIds.includes(cartProduct.id);
        });

        if (removedProducts.length > 0) {
            removedProducts.forEach(function (removedProduct) {
                const item = document.querySelector(
                    '.cart-item[data-product-id="' + removedProduct.id + '"]'
                );

                if (item) {
                    item.remove();
                }
            });

            const filteredCart = cart.filter(function (cartProduct) {
                return actualProductIds.includes(cartProduct.id);
            });

            cart.length = 0;

            filteredCart.forEach(function (product) {
                cart.push(product);
            });

            saveCart();
            updateCartCount();

            if (cart.length === 0) {
                showEmptyCart();
            } else {
                updateTotal();
            }
        }

        cartItems.style.visibility = "visible";

    } catch (error) {
        console.log("Помилка перевірки товарів:", error);
        cartItems.style.visibility = "visible";
    }
}

updateCartCount();

const customerDataKeys = [
    "customerName",
    "customerPhone",
    "customerRegion",
    "customerCity",
    "customerAddress",
    "customerDelivery",
    "customerIndex",
    "customerComment"
];

function clearCustomerData() {
    customerDataKeys.forEach(function (key) {
        localStorage.removeItem(key);
    });
}

function showEmptyCart() {
    cartItems.innerHTML = `
        <h2>Ваш кошик порожній</h2>
        <button type="button" onclick="window.location.href='index.html'">
            Повернутися до покупок
        </button>
    `;
}

const cartLayout = document.createElement("div");
cartLayout.className = "cart-layout";

const cartProducts = document.createElement("div");
cartProducts.className = "cart-products";

const cartHeader = document.createElement("div");
cartHeader.className = "cart-header";

cartHeader.innerHTML = `
    <div>Фото</div>
    <div>Товар / Фасовка</div>
    <div>Ціна</div>
    <div>Кількість</div>
    <div>Разом</div>
    <div></div>
`;

const checkoutForm = document.createElement("div");
checkoutForm.className = "checkout-form";

const checkoutTitle = document.createElement("h2");
checkoutTitle.textContent = "Оформлення замовлення";

checkoutForm.appendChild(checkoutTitle);

cartProducts.appendChild(document.querySelector(".cart-title"));
cartProducts.appendChild(cartHeader);

cartLayout.appendChild(cartProducts);
cartLayout.appendChild(checkoutForm);

if (cart.length === 0) {
    showEmptyCart();
} else {
    cartItems.appendChild(cartLayout);
}

cart.forEach(function (product) {
    const item = document.createElement("div");
    item.className = "cart-item";
    item.dataset.productId = product.id;

    const itemImage = document.createElement("img");
    itemImage.src = product.image;
    itemImage.alt = product.name;

    const itemName = document.createElement("div");
    itemName.textContent =
        product.name +
        (product.packaging ? " / " + product.packaging : "");

    const itemPrice = document.createElement("div");
    itemPrice.textContent = product.price + " грн";

    const itemQuantity = document.createElement("div");
    itemQuantity.textContent = product.quantity;

    const quantityContainer = document.createElement("div");
    quantityContainer.className = "quantity-container";

    const minusButton = document.createElement("button");
    minusButton.type = "button";
    minusButton.textContent = "-";

    const plusButton = document.createElement("button");
    plusButton.type = "button";
    plusButton.textContent = "+";

    quantityContainer.appendChild(minusButton);
    quantityContainer.appendChild(itemQuantity);
    quantityContainer.appendChild(plusButton);

    const itemTotalElement = document.createElement("div");

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-button";

    removeButton.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 6H21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M8 6V4C8 3.45 8.45 3 9 3H15C15.55 3 16 3.45 16 4V6" stroke="currentColor" stroke-width="2"/>
            <path d="M19 6L18 21H6L5 6" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            <path d="M10 10V17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M14 10V17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
    `;

    function updateItemTotal() {
        itemQuantity.textContent = product.quantity;
        itemTotalElement.textContent =
            product.price * product.quantity + " грн";
    }

    function removeProduct() {
        const index = cart.indexOf(product);

        cart.splice(index, 1);

        saveCart();

        item.remove();
        updateTotal();

        if (cart.length === 0) {
            showEmptyCart();
        }
    }

    minusButton.addEventListener("click", function () {
        if (product.quantity > 1) {
            product.quantity = product.quantity - 1;

            updateItemTotal();
            saveCart();
            updateTotal();
        } else {
            removeProduct();
        }
    });

    plusButton.addEventListener("click", function () {
        product.quantity = product.quantity + 1;

        updateItemTotal();
        saveCart();
        updateTotal();
    });

    removeButton.addEventListener("click", function () {
        removeProduct();
    });

    updateItemTotal();

item.appendChild(itemImage);
item.appendChild(itemName);
item.appendChild(itemPrice);
item.appendChild(quantityContainer);
item.appendChild(itemTotalElement);
item.appendChild(removeButton);

    cartProducts.appendChild(item);
});

const totalElement = document.createElement("p");
totalElement.className = "cart-total";

if (cart.length > 0) {
    cartProducts.appendChild(totalElement);
}

function updateTotal() {
    let total = 0;

    cart.forEach(function (product) {
        total = total + product.price * product.quantity;
    });

    if (totalElement) {
        totalElement.textContent = "До сплати: " + total + " грн";
    }

    updateCartCount();

    return total;
}

updateTotal();
checkCartProducts();
const nameInput = document.createElement("input");
nameInput.placeholder = "Ваше ім'я";
checkoutForm.appendChild(nameInput);

const phoneInput = document.createElement("input");
phoneInput.placeholder = "Номер телефону";
checkoutForm.appendChild(phoneInput);

const regionSelect = document.createElement("select");

const regionPlaceholder = document.createElement("option");
regionPlaceholder.textContent = "Оберіть область";
regionPlaceholder.value = "";
regionPlaceholder.disabled = true;
regionPlaceholder.selected = true;

regionSelect.appendChild(regionPlaceholder);

const regions = [
    "Вінницька область",
    "Волинська область",
    "Дніпропетровська область",
    "Донецька область",
    "Житомирська область",
    "Закарпатська область",
    "Запорізька область",
    "Івано-Франківська область",
    "Київська область",
    "Кіровоградська область",
    "Львівська область",
    "Миколаївська область",
    "Одеська область",
    "Полтавська область",
    "Рівненська область",
    "Сумська область",
    "Тернопільська область",
    "Харківська область",
    "Херсонська область",
    "Хмельницька область",
    "Черкаська область",
    "Чернівецька область",
    "Чернігівська область"
];

regions.forEach(function (region) {
    const option = document.createElement("option");

    option.textContent = region;
    option.value = region;

    regionSelect.appendChild(option);
});

checkoutForm.appendChild(regionSelect);

const cityInput = document.createElement("input");
cityInput.placeholder = "Місто";
checkoutForm.appendChild(cityInput);

const addressInput = document.createElement("input");
addressInput.placeholder = "Відділення / адреса доставки";
checkoutForm.appendChild(addressInput);

const deliverySelect = document.createElement("select");

const deliveryPlaceholder = document.createElement("option");
deliveryPlaceholder.textContent = "Оберіть спосіб доставки";
deliveryPlaceholder.value = "";
deliveryPlaceholder.disabled = true;
deliveryPlaceholder.selected = true;

deliverySelect.appendChild(deliveryPlaceholder);

const novaPoshtaOption = document.createElement("option");
novaPoshtaOption.textContent = "Нова Пошта";
novaPoshtaOption.value = "Нова Пошта";

const ukrPoshtaOption = document.createElement("option");
ukrPoshtaOption.textContent = "Укрпошта";
ukrPoshtaOption.value = "Укрпошта";

deliverySelect.appendChild(novaPoshtaOption);
deliverySelect.appendChild(ukrPoshtaOption);

checkoutForm.appendChild(deliverySelect);

const indexInput = document.createElement("input");
indexInput.placeholder = "Поштовий індекс";
indexInput.style.display = "none";

checkoutForm.appendChild(indexInput);

const commentInput = document.createElement("textarea");
commentInput.placeholder = "Коментарій до замовлення";

checkoutForm.appendChild(commentInput);

nameInput.value = localStorage.getItem("customerName") || "";
phoneInput.value = localStorage.getItem("customerPhone") || "";
regionSelect.value = localStorage.getItem("customerRegion") || "";
cityInput.value = localStorage.getItem("customerCity") || "";
addressInput.value = localStorage.getItem("customerAddress") || "";
deliverySelect.value = localStorage.getItem("customerDelivery") || "";
indexInput.value = localStorage.getItem("customerIndex") || "";
commentInput.value = localStorage.getItem("customerComment") || "";

if (deliverySelect.value === "Укрпошта") {
    indexInput.style.display = "block";
}

nameInput.addEventListener("input", function () {
    localStorage.setItem("customerName", nameInput.value);
});

phoneInput.addEventListener("input", function () {
    localStorage.setItem("customerPhone", phoneInput.value);
});

regionSelect.addEventListener("change", function () {
    localStorage.setItem("customerRegion", regionSelect.value);
});

cityInput.addEventListener("input", function () {
    localStorage.setItem("customerCity", cityInput.value);
});

addressInput.addEventListener("input", function () {
    localStorage.setItem("customerAddress", addressInput.value);
});

deliverySelect.addEventListener("change", function () {
    localStorage.setItem("customerDelivery", deliverySelect.value);

    if (deliverySelect.value === "Укрпошта") {
        indexInput.style.display = "block";
    } else {
        indexInput.style.display = "none";
        indexInput.value = "";
        localStorage.removeItem("customerIndex");
    }
});

indexInput.addEventListener("input", function () {
    localStorage.setItem("customerIndex", indexInput.value);
});

commentInput.addEventListener("input", function () {
    localStorage.setItem("customerComment", commentInput.value);
});

const confirmButton = document.createElement("button");
confirmButton.type = "button";
confirmButton.textContent = "Підтвердити замовлення";
confirmButton.className = "confirm-order-button";

checkoutForm.appendChild(confirmButton);

confirmButton.addEventListener("click", function () {
    if (cart.length === 0) {
        alert("Кошик порожній");
        return;
    }

    if (
        nameInput.value.trim() === "" ||
        phoneInput.value.trim() === "" ||
        regionSelect.value === "" ||
        cityInput.value.trim() === "" ||
        addressInput.value.trim() === "" ||
        deliverySelect.value === ""
    ) {
        alert("Заповніть дані для відправлення замовлення");
        return;
    }

    if (nameInput.value.trim().length < 2) {
        alert("Ім'я має містити щонайменше 2 символи");
        return;
    }

    if (!/^[A-Za-zА-Яа-яЁёЇїІіЄєҐґ' ]+$/.test(nameInput.value.trim())) {
        alert("Ім'я може містити тільки букви");
        return;
    }

    if (phoneInput.value.trim().length < 10) {
        alert("Номер телефону має містити щонайменше 10 символів");
        return;
    }

    if (!/^[0-9+ ]+$/.test(phoneInput.value.trim())) {
        alert("Номер телефону може містити тільки цифри, пробіли та знак +");
        return;
    }

    if (regionSelect.value === "") {
        alert("Оберіть область");
        return;
    }

    if (cityInput.value.trim().length < 2) {
        alert("Місто має містити щонайменше 2 символи");
        return;
    }

    if (addressInput.value.trim().length < 2) {
        alert("Введіть відділення або адресу доставки");
        return;
    }

    if (deliverySelect.value === "") {
        alert("Оберіть спосіб доставки");
        return;
    }

    if (
        deliverySelect.value === "Укрпошта" &&
        !/^[0-9]{5}$/.test(indexInput.value.trim())
    ) {
        alert("Індекс має містити 5 цифр");
        return;
    }

    const total = updateTotal();

    const order = {
        customerName: nameInput.value.trim(),
        customerPhone: phoneInput.value.trim(),
        customerAddress:
            regionSelect.value +
            ", " +
            cityInput.value.trim() +
            ", " +
            addressInput.value.trim(),
        deliveryMethod: deliverySelect.value,
        comment: commentInput.value.trim(),
        items: cart,
        total: total
    };

    fetch("http://localhost:3000/order", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(order)
    })
        .then(function (response) {
            if (!response.ok) {
                throw new Error("Помилка сервера: " + response.status);
            }

            return response.json();
        })
        .then(function (data) {
            if (!data.orderId) {
                throw new Error("Не отримано ID замовлення");
            }

            const liqpayCheckout = document.createElement("div");
            liqpayCheckout.id = "liqpay_checkout";

            document.body.appendChild(liqpayCheckout);

            window.LiqPayCheckoutCallback = function () {
                LiqPayCheckout.init({
                    data: data.liqpayData,
                    signature: data.liqpaySignature,
                    embedTo: "#liqpay_checkout",
                    language: "uk",
                    mode: "popup"
 }).on("liqpay.callback", function (paymentData) {
    if (paymentData.status === "success") {
        cart.length = 0;

        saveCart();

        cartItems.innerHTML = "";

        clearCustomerData();

        const successMessage =
            document.createElement("div");

        successMessage.id = "successMessage";

        successMessage.textContent =
            "Ваше замовлення №" +
            data.orderId +
            " успішно оформлено!";

        const telegramLink =
            document.createElement("a");

        telegramLink.textContent =
            "Підключити Telegram";

        telegramLink.className =
            "telegram-button";

        telegramLink.href =
            "https://t.me/Health_Food_Shop_bot?start=" +
            data.orderId;

        telegramLink.target = "_blank";

        const closeButton =
            document.createElement("button");

        closeButton.type = "button";
        closeButton.textContent = "×";
        closeButton.className =
            "close-success-button";

        closeButton.addEventListener(
            "click",
            function () {
                successMessage.remove();
                showEmptyCart();
            }
        );

        successMessage.appendChild(telegramLink);
        successMessage.appendChild(closeButton);

        document.body.appendChild(successMessage);

        setTimeout(function () {
            successMessage.remove();
            showEmptyCart();
        }, 30000);
    }
});
            };

            if (
                !document.querySelector(
                    'script[src="https://static.liqpay.ua/libjs/checkout.js"]'
                )
            ) {
                const liqpayScript = document.createElement("script");

                liqpayScript.src =
                    "https://static.liqpay.ua/libjs/checkout.js";

                document.body.appendChild(liqpayScript);
            }
        })
        .catch(function () {
            alert(
                "Не вдалося оформити замовлення. Спробуйте ще раз."
            );
        });
});