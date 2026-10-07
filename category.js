const params = new URLSearchParams(window.location.search);
const categoryId = params.get("id");

const categoryTitle = document.querySelector("#category-title");
const productsContainer = document.querySelector("#category-products");
const cartCount = document.querySelector("#cartCount");

const cart = JSON.parse(localStorage.getItem("cart")) || [];

if (cartCount) {
    const totalQuantity = cart.reduce(function (sum, item) {
        return sum + item.quantity;
    }, 0);

    cartCount.textContent = totalQuantity;
}

fetch("http://localhost:3000/categories")
    .then(function (response) {
        if (!response.ok) {
            throw new Error("Не вдалося отримати категорії");
        }

        return response.json();
    })
    .then(function (categories) {
        const category = categories.find(function (item) {
            return item.id === Number(categoryId);
        });

        if (!category) {
            throw new Error("Категорію не знайдено");
        }

        categoryTitle.textContent = category.name;
    })
    .catch(function (error) {
        console.log(error);
    });

fetch("http://localhost:3000/products/category/" + categoryId)
    .then(function (response) {
        if (!response.ok) {
            throw new Error("Не вдалося отримати товари");
        }

        return response.json();
    })
    .then(function (products) {
        products.forEach(function (product) {
            const article = document.createElement("article");
            article.className = "product";

            const image = document.createElement("img");
            image.src = product.image;
            image.alt = product.name;

            const info = document.createElement("div");

            const title = document.createElement("h2");
            title.textContent = product.name;

            const description = document.createElement("p");
            description.textContent = product.description;

            info.appendChild(title);
            info.appendChild(description);

            const button = document.createElement("button");
            button.type = "button";
            button.textContent = "Перейти до товару";

            button.addEventListener("click", function () {
                window.location.href =
                    "product.html?id=" + product.id;
            });

            article.appendChild(image);
            article.appendChild(info);
            article.appendChild(button);

            productsContainer.appendChild(article);
        });
    })
    .catch(function (error) {
        console.log(error);
    });