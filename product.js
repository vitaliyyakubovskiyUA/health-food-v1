const params = new URLSearchParams(window.location.search);
const productId = params.get("id");

const cartCount = document.querySelector("#cartCount");
const cart = JSON.parse(localStorage.getItem("cart")) || [];

function updateCartCount() {
    let totalQuantity = 0;

    cart.forEach(function (item) {
        totalQuantity = totalQuantity + item.quantity;
    });

    if (cartCount) {
        cartCount.textContent = totalQuantity;
    }
}

updateCartCount();

fetch("http://localhost:3000/products/" + productId)
    .then(function (response) {

        if (!response.ok) {
            throw new Error("Не вдалося отримати товар");
        }

        return response.json();
    })
    .then(function (product) {

        const title = document.querySelector("#product-title");
        const description = document.querySelector("#product-description");
        const imageContainer = document.querySelector("#product-image");
        const price = document.querySelector("#product-price");
        const packagingContainer = document.querySelector("#product-packaging");
        const addToCartButton = document.querySelector("#add-to-cart");

        title.textContent = product.name;
        description.textContent = product.description;

        imageContainer.innerHTML =
            '<img src="' +
            product.image +
            '" alt="' +
            product.name +
            '">';

        packagingContainer.innerHTML = "";

        let selectedPackaging = "";

        if (product.packagings && product.packagings.length > 0) {

            selectedPackaging = product.packagings[0].packaging;

            price.textContent =
                product.packagings[0].price + " грн";

            product.packagings.forEach(function (packaging, index) {

                const button = document.createElement("button");

                button.type = "button";
                button.textContent = packaging.packaging;

                if (index === 0) {
                    button.className = "selected-packaging";
                }

                button.addEventListener("click", function () {

                    const buttons =
                        packagingContainer.querySelectorAll("button");

                    buttons.forEach(function (button) {
                        button.classList.remove("selected-packaging");
                    });

                    button.classList.add("selected-packaging");

                    selectedPackaging = packaging.packaging;

                    price.textContent =
                        packaging.price + " грн";
                });

                packagingContainer.appendChild(button);
            });

        } else {
            price.textContent = product.price + " грн";
        }

        addToCartButton.addEventListener("click", function () {

            let selectedPrice = Number(product.price);

            if (product.packagings && product.packagings.length > 0) {

                const selectedPackagingData =
                    product.packagings.find(function (item) {
                        return item.packaging === selectedPackaging;
                    });

                if (selectedPackagingData) {
                    selectedPrice =
                        Number(selectedPackagingData.price);
                }
            }

            const existingProduct = cart.find(function (item) {
                return (
                    item.id === product.id &&
                    item.packaging === selectedPackaging
                );
            });

            if (existingProduct) {

                existingProduct.name = product.name;
                existingProduct.price = selectedPrice;
                existingProduct.image = product.image;
                existingProduct.quantity =
                    existingProduct.quantity + 1;

            } else {

                cart.push({
                    id: product.id,
                    name: product.name,
                    price: selectedPrice,
                    quantity: 1,
                    image: product.image,
                    packaging: selectedPackaging
                });
            }

            localStorage.setItem(
                "cart",
                JSON.stringify(cart)
            );

            updateCartCount();
        });
    })
    .catch(function (error) {
        console.log(error);
    });