const searchInput = document.querySelector("#searchInput");
const searchResults = document.querySelector("#searchResults");

const searchWords = [
    "Висівки",
    "Солод",
    "Борошно",
    "Крупи"
];

let searchWordIndex = 0;
let searchLetterIndex = 0;
let isDeleting = false;

let searchProducts = [];
let searchPlaceholderTimer = null;

function animateSearchPlaceholder() {
    clearTimeout(searchPlaceholderTimer);

    if (!searchInput) {
        return;
    }

    if (searchInput.value !== "") {
        return;
    }

    const currentWord = searchWords[searchWordIndex];

    if (!isDeleting) {
        searchInput.placeholder = currentWord.substring(
            0,
            searchLetterIndex + 1
        );

        searchLetterIndex++;

        if (searchLetterIndex === currentWord.length) {
            isDeleting = true;

            searchPlaceholderTimer = setTimeout(
                animateSearchPlaceholder,
                400
            );

            return;
        }
    } else {
        searchInput.placeholder = currentWord.substring(
            0,
            searchLetterIndex - 1
        );

        searchLetterIndex--;

        if (searchLetterIndex === 0) {
            isDeleting = false;

            searchWordIndex++;

            if (searchWordIndex === searchWords.length) {
                searchWordIndex = 0;
            }
        }
    }

    searchPlaceholderTimer = setTimeout(
        animateSearchPlaceholder,
        isDeleting ? 70 : 120
    );
}

animateSearchPlaceholder();

function getSearchScore(query, text) {
    query = query.toLowerCase().trim();
    text = text.toLowerCase().trim();

    if (text.includes(query)) {
        return 100;
    }

    let queryIndex = 0;

    for (let i = 0; i < text.length; i++) {
        if (text[i] === query[queryIndex]) {
            queryIndex++;
        }
    }

    const orderedMatches = queryIndex / query.length;

    if (orderedMatches < 0.5) {
        return 0;
    }

    const distance = Math.abs(text.length - query.length);

    let score = orderedMatches * 70;

    if (text[0] === query[0]) {
        score += 15;
    }

    if (text[text.length - 1] === query[query.length - 1]) {
        score += 15;
    }

    score -= distance * 5;

    return Math.max(0, Math.round(score));
}

if (searchInput && searchResults) {
    searchInput.addEventListener("input", function () {
        searchInput.placeholder = "";

        const query = searchInput.value.trim().toLowerCase();

        if (query === "") {
            searchResults.innerHTML = "";
            searchResults.style.display = "none";
            return;
        }

        const matches = searchProducts
            .map(function (product) {
                const name = product.name || "";
                const description = product.description || "";

                const nameScore = getSearchScore(query, name);
                const descriptionScore = getSearchScore(
                    query,
                    description
                );

                return {
                    product: product,
                    score: Math.max(
                        nameScore,
                        descriptionScore
                    )
                };
            })
            .filter(function (item) {
                return item.score >= 40;
            })
            .sort(function (a, b) {
                return b.score - a.score;
            });

        searchResults.innerHTML = "";

        matches.slice(0, 6).forEach(function (item) {
            const product = item.product;

            const result = document.createElement("div");
            result.className = "search-result";

            const resultImage = document.createElement("img");
            resultImage.src =
                "http://localhost:3000/" + product.image;
            resultImage.alt = product.name;

            const resultInfo = document.createElement("div");
            resultInfo.className = "search-result-info";

            const resultName = document.createElement("div");
            resultName.className = "search-result-name";
            resultName.textContent = product.name;

            const resultPrice = document.createElement("div");
            resultPrice.className = "search-result-price";

            if (product.packagings && product.packagings.length > 0) {
                resultPrice.textContent =
                    "від " + product.packagings[0].price + " грн";
            } else {
                resultPrice.textContent =
                    product.price + " грн";
            }

            resultInfo.appendChild(resultName);
            resultInfo.appendChild(resultPrice);

            result.appendChild(resultImage);
            result.appendChild(resultInfo);

            result.addEventListener("click", function () {
                window.location.href =
                    "product.html?id=" + product.id;
            });

            searchResults.appendChild(result);
        });

        if (matches.length > 0) {
            searchResults.style.display = "block";
            searchResults.style.opacity = "0";
            searchResults.style.transform = "translateY(-12px)";

            requestAnimationFrame(function () {
                searchResults.style.opacity = "1";
                searchResults.style.transform = "translateY(0)";
            });
        } else {
            searchResults.style.opacity = "0";
            searchResults.style.transform = "translateY(-12px)";

            setTimeout(function () {
                searchResults.style.display = "none";
            }, 200);
        }
    });
}

document.addEventListener("click", function (event) {
    if (
        searchInput &&
        searchResults &&
        !searchInput.contains(event.target) &&
        !searchResults.contains(event.target)
    ) {
        searchResults.style.display = "none";

        if (searchInput.value === "") {
            searchLetterIndex = 0;
            isDeleting = false;
            animateSearchPlaceholder();
        }
    }
});

fetch("http://localhost:3000/products")
    .then(function (response) {
        if (!response.ok) {
            throw new Error("Не вдалося отримати товари");
        }

        return response.json();
    })
    .then(function (products) {
        searchProducts = products;
    })
    .catch(function (error) {
        console.log(error);
    });