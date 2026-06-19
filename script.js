const state = {
    cart: [],
    productCards: [],
    activeCategorySlug: "",
};

let searchInput;
let searchStatus;
let toastTimer;

function normalizeText(value) {
    return value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d");
}

function normalizeFilterKey(value) {
    return normalizeText(String(value || ""))
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

const categorySlugByFilter = new Map([
    ["trai cay viet nam", "trai-cay-viet-nam"],
    ["rau sach", "rau-sach"],
    ["cu", "cu-va-hat"],
    ["cu hat", "cu-va-hat"],
    ["thit ca hai san", "thit-ca-va-hai-san"],
    ["tap hoa viet nam", "tap-hoa-vn"],
    ["tap hoa vn", "tap-hoa-vn"],
]);

function categorySlugFromFilter(value) {
    return categorySlugByFilter.get(normalizeFilterKey(value)) || "";
}

function productCategorySlug(card) {
    return card.dataset.categorySlug || card.closest(".hot-category")?.dataset.categorySlug || "";
}

function formatCurrency(value) {
    return `${new Intl.NumberFormat("vi-VN").format(value)}đ`;
}

function parsePrice(priceText) {
    const number = Number(priceText.replace(/[^\d]/g, ""));
    return Number.isFinite(number) ? number : 0;
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => {
        const map = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;",
        };

        return map[char];
    });
}

function productCardTemplate(product) {
    const images = Array.isArray(product.images) ? product.images : [];
    const primaryImage = images.find((image) => image.is_primary)?.image_url || images[0]?.image_url;
    const fallbackImage = "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=700&q=80";
    const imageUrl = primaryImage || fallbackImage;
    const imageList = images.map((image) => image.image_url).filter(Boolean).join("|");
    const badge = product.badge || (product.is_hot_week ? "Hot tuần" : product.is_featured ? "Nổi bật" : "Tươi mới");
    const description = product.description || product.short_description || "Sản phẩm tươi ngon được tuyển chọn kỹ.";
    const cardDescription = product.short_description || description;
    const keywords = `${product.category_name || ""} ${product.name || ""} ${product.origin || ""}`;

    return `
        <div class="product-card" data-product-id="${Number(product.id)}"
            data-category-slug="${escapeHtml(product.category_slug || "")}"
            data-keywords="${escapeHtml(keywords)}"
            data-images="${escapeHtml(imageList)}">
            <div class="product-img">
                <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.name)}" />
                <span class="badge">${escapeHtml(badge)}</span>
                <button class="product-detail-btn" type="button">Xem chi tiết</button>
            </div>
            <div class="product-info">
                <h3>${escapeHtml(product.name)}</h3>
                <p class="product-description">${escapeHtml(cardDescription)}</p>
                <p class="product-full-description" hidden>${escapeHtml(description)}</p>
                <p class="price">${formatCurrency(Number(product.price))} / ${escapeHtml(product.unit)}</p>
                <button class="product-detail-action" type="button">Xem chi tiết</button>
            </div>
        </div>`;
}

async function loadProductsFromApi() {
    if (window.location.protocol === "file:") return false;

    try {
        const response = await fetch("/api/products", { headers: { Accept: "application/json" } });
        if (!response.ok) return false;
        const products = await response.json();
        if (!Array.isArray(products) || !products.length) return false;

        document.querySelectorAll(".hot-category[data-category-slug]").forEach((categorySection) => {
            const categoryProducts = products.filter(
                (product) => product.category_slug === categorySection.dataset.categorySlug
            );
            const grid = categorySection.querySelector(".product-grid");

            categorySection.hidden = categoryProducts.length === 0;
            if (grid && categoryProducts.length) {
                grid.innerHTML = categoryProducts.map(productCardTemplate).join("");
            }
        });

        const today = new Date().toISOString().slice(0, 10);
        const weeklyProducts = products
            .filter((product) => product.is_hot_week && (!product.hot_until || product.hot_until >= today))
            .slice(0, 4);
        const weeklySection = document.querySelector("#weeklyHot");
        const weeklyGrid = weeklySection?.querySelector(".weekly-hot-grid");

        if (weeklySection) weeklySection.hidden = weeklyProducts.length === 0;
        if (weeklyGrid && weeklyProducts.length) {
            weeklyGrid.innerHTML = weeklyProducts.map(productCardTemplate).join("");
        }

        return true;
    } catch (error) {
        console.warn("Không tải được sản phẩm từ API, đang dùng dữ liệu HTML dự phòng.", error);
        return false;
    }
}

function debounce(callback, delay = 180) {
    let timer;

    return (...args) => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => callback(...args), delay);
    };
}

function searchProduct(options = {}) {
    const settings = typeof options === "string" ? { keyword: options } : options;
    const keyword = settings.keyword ?? searchInput?.value ?? "";
    const query = normalizeText(keyword.trim());
    const shouldScroll = settings.scroll ?? true;

    if (settings.categorySlug !== undefined) {
        state.activeCategorySlug = settings.categorySlug;
    }
    const activeCategorySlug = state.activeCategorySlug;

    if (searchInput && settings.keyword !== undefined) {
        searchInput.value = keyword;
    }

    let found = 0;

    state.productCards.forEach((card) => {
        const searchableText = normalizeText(`${card.textContent} ${card.dataset.keywords || ""}`);
        const matchesSearch = !query || searchableText.includes(query);
        const matchesCategory = !activeCategorySlug || productCategorySlug(card) === activeCategorySlug;
        const isMatch = matchesSearch && matchesCategory;

        card.classList.toggle("is-hidden", !isMatch);
        card.classList.toggle("is-match", Boolean(query && isMatch));

        if (isMatch) {
            found += 1;
        }
    });

    document.querySelectorAll(".hot-category").forEach((category) => {
        const hasVisibleProduct = Array.from(category.querySelectorAll(".product-card")).some(
            (card) => !card.classList.contains("is-hidden")
        );

        category.classList.toggle("is-hidden", Boolean((query || activeCategorySlug) && !hasVisibleProduct));
    });

    document.querySelectorAll(".products-section").forEach((section) => {
        const hasVisibleProduct = Array.from(section.querySelectorAll(".product-card")).some(
            (card) => !card.classList.contains("is-hidden")
        );

        section.classList.toggle("section-empty", Boolean((query || activeCategorySlug) && !hasVisibleProduct));
    });

    document.querySelectorAll(
        ".category-item, .category-tab[data-filter], .nav a[data-filter], [data-category-view-all]"
    ).forEach((item) => {
        const itemCategorySlug = categorySlugFromFilter(item.dataset.filter || item.textContent);
        item.classList.toggle("is-active", Boolean(activeCategorySlug && itemCategorySlug === activeCategorySlug));
    });

    document.querySelectorAll("[data-show-all]").forEach((item) => {
        item.classList.toggle("is-active", !query && !activeCategorySlug);
    });

    if (searchStatus) {
        if (!query && !activeCategorySlug) {
            searchStatus.textContent = "";
        } else if (found > 0) {
            searchStatus.textContent = `Tìm thấy ${found} sản phẩm phù hợp.`;
        } else {
            searchStatus.textContent = "Chưa có sản phẩm phù hợp, bạn có thể gọi hotline để được tư vấn.";
        }
    }

    if (query && shouldScroll) {
        document.querySelector("#products")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}

window.searchProduct = searchProduct;

document.addEventListener("DOMContentLoaded", async () => {
    await loadProductsFromApi();
    document.querySelectorAll(".product-info > button").forEach((button) => {
        button.textContent = "Xem chi tiết";
        button.disabled = false;
    });
    searchInput = document.querySelector("#searchInput");
    searchStatus = document.querySelector("#searchStatus");
    state.productCards = Array.from(document.querySelectorAll(".product-card"));

    setupMenu();
    setupSmoothScroll();
    setupSearch();
    setupCategories();
    setupCart();
    setupProductDetails();
    setupRevealEffects();
    setupScrollEffects();
});

function setupMenu() {
    const menuButton = document.querySelector(".menu-toggle");
    const nav = document.querySelector("#mainNav");

    if (!menuButton || !nav) return;

    const closeMenu = () => {
        nav.classList.remove("is-open");
        menuButton.classList.remove("is-open");
        menuButton.setAttribute("aria-expanded", "false");
    };

    menuButton.addEventListener("click", () => {
        const isOpen = nav.classList.toggle("is-open");
        menuButton.classList.toggle("is-open", isOpen);
        menuButton.setAttribute("aria-expanded", String(isOpen));
    });

    nav.addEventListener("click", (event) => {
        if (event.target.closest("a")) {
            closeMenu();
        }
    });

    document.addEventListener("click", (event) => {
        if (!nav.contains(event.target) && !menuButton.contains(event.target)) {
            closeMenu();
        }
    });

    window.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeMenu();
        }
    });
}

function setupSmoothScroll() {
    const links = document.querySelectorAll('a[href^="#"]');

    links.forEach((link) => {
        link.addEventListener("click", (event) => {
            const target = document.querySelector(link.getAttribute("href"));

            if (!target) return;

            event.preventDefault();
            target.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    });
}

function setupSearch() {
    const searchButton = document.querySelector("#searchButton");
    const searchToggle = document.querySelector(".search-toggle");
    const searchArea = document.querySelector(".search-area");
    const showAllLinks = document.querySelectorAll("[data-show-all]");

    searchToggle?.addEventListener("click", () => {
        const isOpen = searchArea?.classList.toggle("is-open");
        searchToggle.classList.toggle("is-active", Boolean(isOpen));

        if (isOpen) {
            window.setTimeout(() => searchInput?.focus(), 120);
        }
    });

    searchButton?.addEventListener("click", () => {
        searchProduct({ categorySlug: "" });
    });

    if (searchInput) {
        searchInput.addEventListener(
            "input",
            debounce(() => {
                searchProduct({ categorySlug: "", scroll: false });
            })
        );

        searchInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                searchProduct({ categorySlug: "" });
            }
        });
    }

    showAllLinks.forEach((link) => {
        link.addEventListener("click", (event) => {
            event.preventDefault();
            if (searchInput) {
                searchInput.value = "";
            }

            searchProduct({ categorySlug: "", scroll: false });
            const target = document.querySelector(link.dataset.scrollTarget || "#products");
            target?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    });
}

function setupCategories() {
    document.querySelectorAll(
        ".category-item, .category-tab[data-filter], .nav a[data-filter], [data-category-view-all]"
    ).forEach((item) => {
        item.addEventListener("click", (event) => {
            if (item.matches("a")) event.preventDefault();
            const categorySlug = categorySlugFromFilter(item.dataset.filter || item.textContent);
            if (!categorySlug) return;

            searchProduct({
                keyword: "",
                categorySlug,
                scroll: true,
            });
        });
    });
}

function setupCart() {
    const cartButton = document.querySelector(".cart-btn");
    const cartCount = document.querySelector(".cart-count");
    const cartOverlay = document.querySelector("#cartOverlay");
    const cartClose = document.querySelector(".cart-close");
    const cartItems = document.querySelector(".cart-items");
    const cartEmpty = document.querySelector(".cart-empty");
    const cartTotal = document.querySelector(".cart-total strong");
    const toast = document.querySelector("#toast");

    const updateCart = () => {
        const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
        const totalPrice = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

        if (cartCount) {
            cartCount.textContent = totalItems;
        }

        if (cartEmpty) {
            cartEmpty.hidden = state.cart.length > 0;
        }

        if (cartTotal) {
            cartTotal.textContent = formatCurrency(totalPrice);
        }

        if (cartItems) {
            cartItems.innerHTML = state.cart
                .map(
                    (item, index) => `
                    <div class="cart-row">
                        <div>
                            <strong>${escapeHtml(item.name)}</strong>
                            <span>${escapeHtml(item.priceText)}</span>
                        </div>
                        <div class="quantity-control">
                            <button type="button" data-cart-action="decrease" data-index="${index}" aria-label="Giảm số lượng">−</button>
                            <span>${item.quantity}</span>
                            <button type="button" data-cart-action="increase" data-index="${index}" aria-label="Tăng số lượng">+</button>
                        </div>
                    </div>
                `
                )
                .join("");
        }
    };

    const showToast = (message) => {
        if (!toast) return;

        toast.textContent = message;
        toast.classList.add("is-visible");
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => {
            toast.classList.remove("is-visible");
        }, 2500);
    };

    const openCart = () => {
        cartOverlay?.classList.add("is-open");
        cartOverlay?.setAttribute("aria-hidden", "false");
        document.body.classList.add("no-scroll");
    };

    const closeCart = () => {
        cartOverlay?.classList.remove("is-open");
        cartOverlay?.setAttribute("aria-hidden", "true");
        document.body.classList.remove("no-scroll");
    };

    document.querySelectorAll(".product-info button[data-add-to-cart]").forEach((button) => {
        button.addEventListener("click", () => {
            const card = button.closest(".product-card");
            const name = card?.querySelector("h3")?.textContent.trim();
            const priceText = card?.querySelector(".price")?.textContent.trim();

            if (!name || !priceText) return;

            const existingItem = state.cart.find((item) => item.name === name);

            if (existingItem) {
                existingItem.quantity += 1;
            } else {
                state.cart.push({
                    name,
                    priceText,
                    price: parsePrice(priceText),
                    quantity: 1,
                });
            }

            updateCart();
            showToast(`Đã thêm "${name}" vào giỏ hàng.`);
            cartButton?.classList.add("is-bumping");
            window.setTimeout(() => cartButton?.classList.remove("is-bumping"), 450);
        });
    });

    cartItems?.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-cart-action]");
        if (!button) return;

        const item = state.cart[Number(button.dataset.index)];
        if (!item) return;

        if (button.dataset.cartAction === "increase") {
            item.quantity += 1;
        } else {
            item.quantity -= 1;
            if (item.quantity <= 0) {
                state.cart.splice(Number(button.dataset.index), 1);
            }
        }

        updateCart();
    });

    cartButton?.addEventListener("click", openCart);
    cartClose?.addEventListener("click", closeCart);

    cartOverlay?.addEventListener("click", (event) => {
        if (event.target === cartOverlay) {
            closeCart();
        }
    });

    window.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeCart();
        }
    });

    updateCart();
}

function setupProductDetails() {
    const overlay = document.querySelector("#detailOverlay");
    const panel = overlay?.querySelector(".detail-panel");
    const closeButton = overlay?.querySelector(".detail-close");
    const image = overlay?.querySelector(".detail-image");
    const thumbnails = overlay?.querySelector(".detail-thumbnails");
    const title = overlay?.querySelector("#detailTitle");
    const badge = overlay?.querySelector(".detail-badge");
    const description = overlay?.querySelector(".detail-description");
    const price = overlay?.querySelector(".detail-price");

    if (!overlay || !panel || !image || !thumbnails || !title || !badge || !description || !price) return;

    const createImageVariants = (card, productImage) => {
        const explicitImages = (card.dataset.images || "")
            .split("|")
            .map((url) => url.trim())
            .filter(Boolean);
        const mainImage = productImage.currentSrc || productImage.src;

        const declaredImages = [...new Set([mainImage, ...explicitImages])];
        if (declaredImages.length > 1) return declaredImages;

        try {
            const source = new URL(mainImage);
            const sizes = [
                [1100, 760],
                [900, 900],
                [760, 1000],
            ];
            const variants = sizes.map(([width, height]) => {
                const variant = new URL(source);
                variant.searchParams.set("fit", "crop");
                variant.searchParams.set("w", String(width));
                variant.searchParams.set("h", String(height));
                variant.searchParams.set("q", "85");
                return variant.href;
            });

            return [...new Set([mainImage, ...variants])];
        } catch {
            return [mainImage];
        }
    };

    const renderGallery = (images, productName) => {
        const selectImage = (selectedUrl, selectedIndex) => {
            image.src = selectedUrl;
            image.alt = `${productName} - hình ${selectedIndex + 1}`;
            thumbnails.querySelectorAll(".detail-thumbnail").forEach((thumbnail, index) => {
                thumbnail.classList.toggle("is-active", index === selectedIndex);
                thumbnail.setAttribute("aria-pressed", String(index === selectedIndex));
            });
        };

        const thumbnailButtons = images.map((url, index) => {
            const thumbnailButton = document.createElement("button");
            const thumbnailImage = document.createElement("img");

            thumbnailButton.type = "button";
            thumbnailButton.className = "detail-thumbnail";
            thumbnailButton.setAttribute("aria-label", `Xem hình ${index + 1} của ${productName}`);
            thumbnailButton.setAttribute("aria-pressed", String(index === 0));
            thumbnailImage.src = url;
            thumbnailImage.alt = "";
            thumbnailButton.append(thumbnailImage);
            thumbnailButton.addEventListener("click", () => selectImage(url, index));
            return thumbnailButton;
        });

        thumbnails.replaceChildren(...thumbnailButtons);
        selectImage(images[0], 0);
    };

    const closeDetails = () => {
        overlay.classList.remove("is-open");
        overlay.setAttribute("aria-hidden", "true");
        document.body.classList.remove("no-scroll");
    };

    document.querySelectorAll(".product-detail-btn, .product-info > button").forEach((button) => {
        button.addEventListener("click", () => {
            const card = button.closest(".product-card");
            const productImage = card?.querySelector(".product-img img");

            if (!card || !productImage) return;

            const productName = card.querySelector("h3")?.textContent.trim() || "Chi tiết sản phẩm";

            title.textContent = productName;
            badge.textContent = card.querySelector(".badge")?.textContent.trim() || "Tươi ngon";
            description.textContent = card.querySelector(".product-full-description")?.textContent ||
                card.querySelector(".product-description")?.textContent.trim() ||
                "Sản phẩm tươi ngon được tuyển chọn kỹ.";
            price.textContent = card.querySelector(".price")?.textContent.trim() || "";
            renderGallery(createImageVariants(card, productImage), productName);

            overlay.classList.add("is-open");
            overlay.setAttribute("aria-hidden", "false");
            document.body.classList.add("no-scroll");
            closeButton?.focus();
        });
    });

    closeButton?.addEventListener("click", closeDetails);
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) closeDetails();
    });
    window.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && overlay.classList.contains("is-open")) {
            closeDetails();
        }
    });
}

function setupRevealEffects() {
    const revealItems = document.querySelectorAll(
        ".hero-text, .hero-card, .category-item, .product-card, .about-content > *, .contact-box"
    );

    revealItems.forEach((item, index) => {
        item.classList.add("reveal");
        item.style.transitionDelay = `${Math.min((index % 6) * 70, 280)}ms`;
    });

    if (!("IntersectionObserver" in window)) {
        revealItems.forEach((item) => item.classList.add("is-visible"));
        return;
    }

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-visible");
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.15 }
    );

    revealItems.forEach((item) => observer.observe(item));
}

function setupScrollEffects() {
    const header = document.querySelector(".header");
    const backToTop = document.querySelector(".back-to-top");
    const sections = Array.from(document.querySelectorAll("section[id]"));
    const navLinks = Array.from(document.querySelectorAll(".nav a"));
    let lastScrollY = window.scrollY;
    let scrollTicking = false;

    const updateScrollUi = () => {
        const currentY = window.scrollY;
        const headerControlIsOpen = Boolean(
            header?.querySelector(".nav.is-open, .search-area.is-open")
        );

        header?.classList.toggle("is-scrolled", currentY > 20);
        if (currentY < 80 || currentY < lastScrollY - 8 || headerControlIsOpen) {
            header?.classList.remove("is-hidden-on-scroll");
            lastScrollY = currentY;
        } else if (currentY > 160 && currentY > lastScrollY + 8) {
            header?.classList.add("is-hidden-on-scroll");
            lastScrollY = currentY;
        }

        backToTop?.classList.toggle("is-visible", currentY > 520);

        const activeSection = sections
            .slice()
            .reverse()
            .find((section) => section.offsetTop - 130 <= currentY);

        navLinks.forEach((link) => {
            link.classList.toggle("is-active", link.getAttribute("href") === `#${activeSection?.id}`);
        });

        scrollTicking = false;
    };

    backToTop?.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    window.addEventListener(
        "scroll",
        () => {
            if (!scrollTicking) {
                window.requestAnimationFrame(updateScrollUi);
                scrollTicking = true;
            }
        },
        { passive: true }
    );
    updateScrollUi();
}
