const cart = JSON.parse(localStorage.getItem("cart")) || [];

const categoriesContainer = document.querySelector("#categories");
const cartCount = document.querySelector("#cartCount");

function updateCartCount() {
    let totalQuantity = 0;

    cart.forEach(function (product) {
        totalQuantity = totalQuantity + product.quantity;
    });

    if (cartCount) {
        cartCount.textContent = totalQuantity;
    }
}

if (categoriesContainer) {
    fetch("http://localhost:3000/categories")
        .then(function (response) {
            return response.json();
        })
        .then(function (categories) {

            categories.forEach(function (category) {

                if (!category.image) {
                    return;
                }

                const link = document.createElement("a");

                link.href = "category.html?id=" + category.id;
                link.className = "category";

                const image = document.createElement("img");

                image.src = "http://localhost:3000/" + category.image;
                image.alt = category.name;

                const title = document.createElement("h2");

                title.textContent = category.name;

                link.appendChild(image);
                link.appendChild(title);

                categoriesContainer.appendChild(link);
            });
        })
        .catch(function (error) {
            console.log(error);
        });
}

updateCartCount();