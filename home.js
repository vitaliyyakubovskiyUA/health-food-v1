const homeProductsContainer = document.querySelector("#products");

if (homeProductsContainer) {

    fetch("http://localhost:3000/products")
        .then(function (response) {

            if (!response.ok) {
                throw new Error("Не вдалося отримати товари");
            }

            return response.json();
        })
        .then(function (products) {

            const newProducts = [...products]
                .sort(function (a, b) {
                    return b.id - a.id;
                })
                .slice(0, 8);

            const title = document.createElement("h2");

            title.className = "new-products-title";
            title.textContent = "Нові надходження";

            homeProductsContainer.before(title);

            newProducts.forEach(function (product) {

                const link = document.createElement("a");

                link.href = "product.html?id=" + product.id;
                link.className = "product";

                const image = document.createElement("img");

                image.src = "http://localhost:3000/" + product.image;
                image.alt = product.name;

                const productTitle = document.createElement("h2");

                productTitle.textContent = product.name;

                link.appendChild(image);
                link.appendChild(productTitle);

                homeProductsContainer.appendChild(link);
            });
        })
        .catch(function (error) {
            console.log(error);
        });
}