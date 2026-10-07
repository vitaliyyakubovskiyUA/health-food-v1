const cart = JSON.parse(localStorage.getItem("cart")) || [];

const cartCount = document.querySelector("#cartCount");

let totalQuantity = 0;

cart.forEach(function (product) {
    totalQuantity = totalQuantity + product.quantity;
});

if (cartCount) {
    cartCount.textContent = totalQuantity;
}