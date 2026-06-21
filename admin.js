const adminState = {
    categories: [],
    products: [],
    editingId: null,
    existingImages: [],
    pendingFiles: [],
    previewUrls: [],
    uploadedThisSession: [],
};

const loginView = document.querySelector("#loginView");
const adminView = document.querySelector("#adminView");
const loginForm = document.querySelector("#loginForm");
const loginMessage = document.querySelector("#loginMessage");
const logoutButton = document.querySelector("#logoutButton");
const productForm = document.querySelector("#productForm");
const productMessage = document.querySelector("#productMessage");
const productTableBody = document.querySelector("#productTableBody");
const productSearch = document.querySelector("#productSearch");
const emptyState = document.querySelector("#emptyState");
const formTitle = document.querySelector("#formTitle");
const saveButton = document.querySelector("#saveButton");
const cancelEditButton = document.querySelector("#cancelEditButton");
const resetButton = document.querySelector("#resetButton");
const productImagesInput = document.querySelector("#productImages");
const imagePreview = document.querySelector("#imagePreview");
const priceOptionsList = document.querySelector("#priceOptionsList");
const addPriceOptionButton = document.querySelector("#addPriceOptionButton");

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
        const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
        return entities[character];
    });
}

function formatCurrency(value) {
    return `${new Intl.NumberFormat("vi-VN").format(Number(value) || 0)}w`;
}

function formatShippingFee(value) {
    return Number(value) === 5000 ? "+ 5k tb" : "btb";
}

function productPriceOptions(product) {
    return product.price_options?.length
        ? product.price_options
        : [{
              label: product.unit || "sản phẩm",
              price: product.price || 0,
              shipping_fee: Number(product.shipping_fee) === 0 ? 0 : 5000,
          }];
}

function priceOptionRowMarkup(option = {}) {
    const shippingFee = Number(option.shipping_fee) === 0 ? 0 : 5000;
    return `
        <div class="price-option-row">
            <input type="text" data-price-label maxlength="80" placeholder="VD: 1 cân"
                value="${escapeHtml(option.label || "")}" aria-label="Tên mức giá" required />
            <input type="number" data-price-value min="0" step="1000" placeholder="Giá bán"
                value="${option.price ?? ""}" aria-label="Giá bán" required />
            <select data-price-shipping aria-label="Phí vận chuyển">
                <option value="5000"${shippingFee === 5000 ? " selected" : ""}>5k tb</option>
                <option value="0"${shippingFee === 0 ? " selected" : ""}>btb</option>
            </select>
            <button type="button" class="price-option-remove" aria-label="Xóa mức giá">×</button>
        </div>`;
}

function renderPriceOptionRows(options = [{ label: "1 cân", price: "", shipping_fee: 5000 }]) {
    const rows = options.length ? options : [{ label: "1 cân", price: "", shipping_fee: 5000 }];
    priceOptionsList.innerHTML = rows.map(priceOptionRowMarkup).join("");
}

function readPriceOptions() {
    return Array.from(priceOptionsList.querySelectorAll(".price-option-row")).map((row) => ({
        label: row.querySelector("[data-price-label]").value.trim(),
        price: Number(row.querySelector("[data-price-value]").value),
        shipping_fee: Number(row.querySelector("[data-price-shipping]").value),
    }));
}

function slugify(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

async function api(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
    });

    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Không thể kết nối máy chủ.");
    return data;
}

function showMessage(element, message, success = false) {
    element.textContent = message;
    element.classList.toggle("is-success", success);
}

function setAuthenticated(isAuthenticated) {
    loginView.hidden = isAuthenticated;
    adminView.hidden = !isAuthenticated;
}

function renderCategoryOptions() {
    const categorySelect = productForm.elements.category_id;
    categorySelect.innerHTML = adminState.categories
        .map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`)
        .join("");
}

function renderStats() {
    const active = adminState.products.filter((product) => product.status === "active").length;
    const hot = adminState.products.filter((product) => product.is_hot_week).length;

    document.querySelector("#totalProducts").textContent = adminState.products.length;
    document.querySelector("#activeProducts").textContent = active;
    document.querySelector("#hotProducts").textContent = hot;
}

function renderProducts() {
    const query = productSearch.value.trim().toLowerCase();
    const products = adminState.products.filter((product) =>
        `${product.name} ${product.sku} ${product.category_name}`.toLowerCase().includes(query)
    );
    const statusLabels = {
        active: "Đang bán",
        draft: "Bản nháp",
        out_of_stock: "Hết hàng",
        archived: "Lưu trữ",
    };

    productTableBody.innerHTML = products
        .map((product) => {
            const image = product.images?.[0]?.image_url;
            const imageMarkup = image
                ? `<img src="${escapeHtml(image)}" alt="" />`
                : '<span class="image-placeholder"></span>';
            const pricesMarkup = productPriceOptions(product)
                .map(
                    (option) => `${escapeHtml(option.label)}: <strong>${formatCurrency(option.price)}</strong>
                        ${formatShippingFee(option.shipping_fee)}`
                )
                .join("<br>");

            return `
                <tr>
                    <td>
                        <div class="product-cell">
                            ${imageMarkup}
                            <div>
                                <strong>${escapeHtml(product.name)}</strong>
                                <small>${escapeHtml(product.sku)}${product.is_hot_week ? " · 🔥 Hot" : ""}</small>
                            </div>
                        </div>
                    </td>
                    <td>${escapeHtml(product.category_name)}</td>
                    <td>${pricesMarkup}</td>
                    <td><span class="status-pill ${escapeHtml(product.status)}">${statusLabels[product.status] || product.status}</span></td>
                    <td>
                        <div class="table-actions">
                            <button type="button" data-action="edit" data-id="${product.id}">Sửa</button>
                            <button type="button" class="button-danger" data-action="delete" data-id="${product.id}">Xóa</button>
                        </div>
                    </td>
                </tr>`;
        })
        .join("");

    emptyState.hidden = products.length > 0;
    renderStats();
}

function clearPreviewUrls() {
    adminState.previewUrls.forEach((url) => URL.revokeObjectURL(url));
    adminState.previewUrls = [];
}

function renderImagePreviews() {
    clearPreviewUrls();
    const existingMarkup = adminState.existingImages.map((imageUrl, index) => `
        <figure class="image-preview-item">
            <img src="${escapeHtml(imageUrl)}" alt="Ảnh sản phẩm ${index + 1}" />
            <button type="button" data-image-kind="existing" data-index="${index}" aria-label="Xóa ảnh">×</button>
            ${index === 0 ? '<figcaption>Ảnh đại diện</figcaption>' : ""}
        </figure>`);
    const pendingMarkup = adminState.pendingFiles.map((file, index) => {
        const previewUrl = URL.createObjectURL(file);
        adminState.previewUrls.push(previewUrl);
        const displayIndex = adminState.existingImages.length + index;
        return `
            <figure class="image-preview-item is-new">
                <img src="${escapeHtml(previewUrl)}" alt="Ảnh mới ${index + 1}" />
                <button type="button" data-image-kind="pending" data-index="${index}" aria-label="Bỏ ảnh">×</button>
                ${displayIndex === 0 ? '<figcaption>Ảnh đại diện</figcaption>' : ""}
            </figure>`;
    });

    imagePreview.innerHTML = [...existingMarkup, ...pendingMarkup].join("");
    imagePreview.classList.toggle("is-empty", !adminState.existingImages.length && !adminState.pendingFiles.length);
}

async function cleanupUnattachedUploads() {
    if (!adminState.uploadedThisSession.length) return;
    const images = [...adminState.uploadedThisSession];
    adminState.uploadedThisSession = [];
    await cleanupUploadUrls(images);
}

async function cleanupUploadUrls(images) {
    if (!images.length) return;
    try {
        await api("/api/admin/uploads", {
            method: "DELETE",
            body: JSON.stringify({ images }),
        });
    } catch {
        // File rác có thể được dọn định kỳ; không chặn thao tác của admin.
    }
}

async function uploadPendingImages() {
    if (!adminState.pendingFiles.length) return [];
    const formData = new FormData();
    adminState.pendingFiles.forEach((file) => formData.append("images", file));
    const response = await fetch("/api/admin/uploads", { method: "POST", body: formData });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Không thể tải ảnh lên.");
    const imageUrls = (data.images || []).map((image) => image.image_url);
    adminState.uploadedThisSession.push(...imageUrls);
    adminState.existingImages.push(...imageUrls);
    adminState.pendingFiles = [];
    productImagesInput.value = "";
    renderImagePreviews();
    return imageUrls;
}

function resetProductForm() {
    void cleanupUnattachedUploads();
    adminState.editingId = null;
    adminState.existingImages = [];
    adminState.pendingFiles = [];
    clearPreviewUrls();
    productForm.reset();
    productForm.elements.id.value = "";
    productForm.elements.badge.value = "Tươi mới";
    productForm.elements.status.value = "active";
    productImagesInput.value = "";
    delete productForm.elements.slug.dataset.edited;
    formTitle.textContent = "Thêm sản phẩm mới";
    saveButton.textContent = "Lưu sản phẩm";
    cancelEditButton.hidden = true;
    showMessage(productMessage, "");
    renderPriceOptionRows();
    renderImagePreviews();
}

function editProduct(productId) {
    const product = adminState.products.find((item) => item.id === productId);
    if (!product) return;

    void cleanupUnattachedUploads();
    adminState.editingId = productId;
    adminState.existingImages = (product.images || []).map((image) => image.image_url);
    adminState.pendingFiles = [];
    const fields = [
        "sku",
        "name",
        "slug",
        "description",
        "origin",
        "storage_instructions",
        "badge",
        "status",
        "hot_until",
    ];

    productForm.elements.id.value = product.id;
    productForm.elements.category_id.value = product.category_id;
    fields.forEach((field) => {
        if (productForm.elements[field]) productForm.elements[field].value = product[field] ?? "";
    });
    renderPriceOptionRows(productPriceOptions(product));
    productImagesInput.value = "";
    renderImagePreviews();
    productForm.elements.is_featured.checked = Boolean(product.is_featured);
    productForm.elements.is_hot_week.checked = Boolean(product.is_hot_week);
    formTitle.textContent = `Sửa: ${product.name}`;
    saveButton.textContent = "Cập nhật sản phẩm";
    cancelEditButton.hidden = false;
    showMessage(productMessage, "");
    document.querySelector(".product-form-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function formToPayload() {
    const formData = new FormData(productForm);
    const payload = Object.fromEntries(formData.entries());
    payload.category_id = Number(payload.category_id);
    payload.price_options = readPriceOptions();
    payload.unit = payload.price_options[0]?.label || "sản phẩm";
    payload.price = payload.price_options[0]?.price || 0;
    payload.shipping_fee = payload.price_options[0]?.shipping_fee || 0;
    payload.is_featured = productForm.elements.is_featured.checked;
    payload.is_hot_week = productForm.elements.is_hot_week.checked;
    payload.images = [...adminState.existingImages];
    delete payload.id;
    return payload;
}

async function loadAdminData() {
    const [categories, products] = await Promise.all([
        api("/api/categories"),
        api("/api/admin/products"),
    ]);
    adminState.categories = categories;
    adminState.products = products;
    renderCategoryOptions();
    renderProducts();
}

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = loginForm.querySelector("button[type='submit']");
    submitButton.disabled = true;
    showMessage(loginMessage, "");

    try {
        const formData = new FormData(loginForm);
        await api("/api/admin/login", {
            method: "POST",
            body: JSON.stringify(Object.fromEntries(formData.entries())),
        });
        await loadAdminData();
        setAuthenticated(true);
    } catch (error) {
        showMessage(loginMessage, error.message);
    } finally {
        submitButton.disabled = false;
    }
});

logoutButton.addEventListener("click", async () => {
    try {
        await api("/api/admin/logout", { method: "POST" });
    } finally {
        setAuthenticated(false);
        loginForm.reset();
    }
});

productForm.elements.name.addEventListener("input", () => {
    if (!adminState.editingId && !productForm.elements.slug.dataset.edited) {
        productForm.elements.slug.value = slugify(productForm.elements.name.value);
    }
});

productForm.elements.slug.addEventListener("input", () => {
    productForm.elements.slug.dataset.edited = productForm.elements.slug.value ? "true" : "";
});

addPriceOptionButton.addEventListener("click", () => {
    const rowCount = priceOptionsList.querySelectorAll(".price-option-row").length;
    if (rowCount >= 12) {
        showMessage(productMessage, "Mỗi sản phẩm chỉ được tối đa 12 mức giá.");
        return;
    }
    priceOptionsList.insertAdjacentHTML("beforeend", priceOptionRowMarkup());
    priceOptionsList.querySelector(".price-option-row:last-child [data-price-label]")?.focus();
});

priceOptionsList.addEventListener("click", (event) => {
    const removeButton = event.target.closest(".price-option-remove");
    if (!removeButton) return;
    const rows = priceOptionsList.querySelectorAll(".price-option-row");
    if (rows.length === 1) {
        rows[0].querySelector("[data-price-label]").value = "";
        rows[0].querySelector("[data-price-value]").value = "";
        return;
    }
    removeButton.closest(".price-option-row").remove();
});

productImagesInput.addEventListener("change", () => {
    const selectedFiles = Array.from(productImagesInput.files || []);
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
    const validFiles = selectedFiles.filter((file) => allowedTypes.has(file.type) && file.size <= 5 * 1024 * 1024);
    const availableSlots = 10 - adminState.existingImages.length - adminState.pendingFiles.length;

    if (validFiles.length !== selectedFiles.length) {
        showMessage(productMessage, "Chỉ nhận JPG, PNG, WEBP, GIF và tối đa 5 MB mỗi ảnh.");
    }
    if (availableSlots <= 0) {
        showMessage(productMessage, "Mỗi sản phẩm chỉ được tối đa 10 ảnh.");
        productImagesInput.value = "";
        return;
    }

    adminState.pendingFiles.push(...validFiles.slice(0, availableSlots));
    productImagesInput.value = "";
    renderImagePreviews();
});

imagePreview.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-image-kind]");
    if (!button) return;
    const index = Number(button.dataset.index);

    if (button.dataset.imageKind === "existing") {
        const [removedImage] = adminState.existingImages.splice(index, 1);
        const uploadedIndex = adminState.uploadedThisSession.indexOf(removedImage);
        if (uploadedIndex >= 0) {
            adminState.uploadedThisSession.splice(uploadedIndex, 1);
            void cleanupUploadUrls([removedImage]);
        }
    } else {
        adminState.pendingFiles.splice(index, 1);
    }
    renderImagePreviews();
});

productForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    saveButton.disabled = true;
    showMessage(productMessage, "Đang lưu...");

    try {
        const editingId = adminState.editingId;
        if (!adminState.existingImages.length && !adminState.pendingFiles.length) {
            throw new Error("Sản phẩm cần ít nhất một hình ảnh.");
        }
        await uploadPendingImages();
        const payload = formToPayload();
        const result = await api(editingId ? `/api/admin/products/${editingId}` : "/api/admin/products", {
            method: editingId ? "PUT" : "POST",
            body: JSON.stringify(payload),
        });
        adminState.uploadedThisSession = [];
        await loadAdminData();
        resetProductForm();
        showMessage(productMessage, result.message, true);
    } catch (error) {
        showMessage(productMessage, error.message);
    } finally {
        saveButton.disabled = false;
    }
});

productTableBody.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const productId = Number(button.dataset.id);

    if (button.dataset.action === "edit") {
        editProduct(productId);
        return;
    }

    const product = adminState.products.find((item) => item.id === productId);
    if (!product || !window.confirm(`Xóa vĩnh viễn sản phẩm "${product.name}"? Thao tác này không thể hoàn tác.`)) return;

    button.disabled = true;
    try {
        await api(`/api/admin/products/${productId}`, { method: "DELETE" });
        await loadAdminData();
        if (adminState.editingId === productId) resetProductForm();
    } catch (error) {
        window.alert(error.message);
    } finally {
        button.disabled = false;
    }
});

productSearch.addEventListener("input", renderProducts);
resetButton.addEventListener("click", resetProductForm);
cancelEditButton.addEventListener("click", resetProductForm);

renderPriceOptionRows();

(async function initializeAdmin() {
    try {
        await api("/api/admin/me");
        setAuthenticated(true);
        await loadAdminData();
    } catch {
        setAuthenticated(false);
    }
})();
