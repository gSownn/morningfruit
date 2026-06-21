const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const session = require("express-session");
const multer = require("multer");
const mysql = require("mysql2/promise");
require("dotenv").config();

const app = express();
const port = Number(process.env.PORT) || 3000;
const rootDirectory = __dirname;
const uploadDirectory = path.join(rootDirectory, "uploads");
const cloudinaryConfig = {
    cloudName: String(process.env.CLOUDINARY_CLOUD_NAME || "").trim(),
    apiKey: String(process.env.CLOUDINARY_API_KEY || "").trim(),
    apiSecret: String(process.env.CLOUDINARY_API_SECRET || "").trim(),
    folder: String(process.env.CLOUDINARY_FOLDER || "morningfruit/products").trim(),
};
const cloudinaryEnabled = Boolean(
    cloudinaryConfig.cloudName && cloudinaryConfig.apiKey && cloudinaryConfig.apiSecret
);
const databaseSslCaPath = String(process.env.DB_SSL_CA_PATH || "").trim();
const databaseSsl = databaseSslCaPath
    ? {
          ca: fs.readFileSync(
              path.isAbsolute(databaseSslCaPath)
                  ? databaseSslCaPath
                  : path.resolve(rootDirectory, databaseSslCaPath),
              "utf8"
          ),
          rejectUnauthorized: true,
      }
    : undefined;

if (!cloudinaryEnabled) fs.mkdirSync(uploadDirectory, { recursive: true });

if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);

const pool = mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "gs_k_food",
    charset: "utf8mb4_unicode_ci",
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
    decimalNumbers: true,
    dateStrings: true,
    ssl: databaseSsl,
});

const imageExtensions = new Map([
    ["image/jpeg", ".jpg"],
    ["image/png", ".png"],
    ["image/webp", ".webp"],
    ["image/gif", ".gif"],
]);
const imageUpload = multer({
    storage: cloudinaryEnabled
        ? multer.memoryStorage()
        : multer.diskStorage({
              destination: (_request, _file, callback) => callback(null, uploadDirectory),
              filename: (_request, file, callback) => {
                  const extension = imageExtensions.get(file.mimetype) || ".img";
                  callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
              },
          }),
    limits: { fileSize: 5 * 1024 * 1024, files: 10 },
    fileFilter: (_request, file, callback) => {
        if (!imageExtensions.has(file.mimetype)) {
            return callback(new Error("Chỉ chấp nhận ảnh JPG, PNG, WEBP hoặc GIF."));
        }
        return callback(null, true);
    },
});

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(
    session({
        name: "gs_k_food_admin",
        secret: process.env.SESSION_SECRET || "development-only-change-me",
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: 8 * 60 * 60 * 1000,
        },
    })
);

function safeCompare(left, right) {
    const leftBuffer = Buffer.from(String(left));
    const rightBuffer = Buffer.from(String(right));

    return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function requireAdmin(request, response, next) {
    if (request.session.isAdmin) return next();
    return response.status(401).json({ message: "Bạn cần đăng nhập quản trị." });
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

function optionalText(value, maxLength) {
    const text = String(value ?? "").trim();
    return text ? text.slice(0, maxLength) : null;
}

function multilineText(value, maxLength) {
    const text = String(value ?? "").replace(/\r\n?/g, "\n").slice(0, maxLength);
    return text.trim() ? text : null;
}

function parseNumber(value, fallback = null) {
    if (value === "" || value === null || value === undefined) return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function parsePriceOptions(options, fallbackUnit, fallbackPrice, fallbackShippingFee) {
    const source = Array.isArray(options) && options.length
        ? options
        : [{ label: fallbackUnit, price: fallbackPrice, shipping_fee: fallbackShippingFee }];

    if (source.length > 12) throw new Error("Mỗi sản phẩm chỉ được tối đa 12 mức giá.");

    const parsedOptions = source.map((option, index) => {
        const label = optionalText(option?.label, 80);
        const price = parseNumber(option?.price);
        const shippingFee = parseNumber(option?.shipping_fee, 0);
        if (!label) throw new Error(`Tên mức giá ${index + 1} là bắt buộc.`);
        if (price === null || price < 0) throw new Error(`Giá của mức ${label} không hợp lệ.`);
        if (![0, 5000].includes(shippingFee)) {
            throw new Error(`Phí vận chuyển của mức ${label} chỉ được là 5k tb hoặc btb.`);
        }
        return { label, price, shipping_fee: shippingFee, sort_order: index };
    });
    const normalizedLabels = parsedOptions.map((option) => option.label.toLocaleLowerCase("vi"));
    if (new Set(normalizedLabels).size !== normalizedLabels.length) {
        throw new Error("Tên các mức giá không được trùng nhau.");
    }
    return parsedOptions;
}

function parseImages(images, productName) {
    if (!Array.isArray(images)) return [];

    return images
        .map((image) => (typeof image === "string" ? image : image?.image_url))
        .map((imageUrl) => String(imageUrl || "").trim())
        .filter((imageUrl) => {
            if (/^\/uploads\/[a-zA-Z0-9._-]+$/.test(imageUrl)) return true;
            try {
                const url = new URL(imageUrl);
                return url.protocol === "http:" || url.protocol === "https:";
            } catch {
                return false;
            }
        })
        .slice(0, 10)
        .map((imageUrl, index) => ({
            image_url: imageUrl,
            alt_text: `${productName} - hình ${index + 1}`,
            sort_order: index + 1,
            is_primary: index === 0,
        }));
}

function localUploadPath(imageUrl) {
    if (!/^\/uploads\/[a-zA-Z0-9._-]+$/.test(imageUrl || "")) return null;
    return path.join(uploadDirectory, path.basename(imageUrl));
}

function createCloudinarySignature(parameters) {
    const value = Object.keys(parameters)
        .sort()
        .map((key) => `${key}=${parameters[key]}`)
        .join("&");
    return crypto.createHash("sha1").update(`${value}${cloudinaryConfig.apiSecret}`).digest("hex");
}

async function uploadToCloudinary(file) {
    const timestamp = Math.floor(Date.now() / 1000);
    const parameters = {
        folder: cloudinaryConfig.folder,
        public_id: crypto.randomUUID(),
        timestamp,
    };
    const formData = new FormData();

    formData.append("file", new Blob([file.buffer], { type: file.mimetype }), file.originalname);
    formData.append("api_key", cloudinaryConfig.apiKey);
    Object.entries(parameters).forEach(([key, value]) => formData.append(key, String(value)));
    formData.append("signature", createCloudinarySignature(parameters));

    const cloudinaryResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudinaryConfig.cloudName)}/image/upload`,
        {
            method: "POST",
            body: formData,
            signal: AbortSignal.timeout(30_000),
        }
    );
    const result = await cloudinaryResponse.json().catch(() => ({}));

    if (!cloudinaryResponse.ok || !result.secure_url) {
        const error = new Error(result.error?.message || "Cloudinary không thể tải ảnh lên.");
        error.statusCode = 502;
        throw error;
    }

    return {
        image_url: result.secure_url,
        original_name: file.originalname,
    };
}

async function uploadFilesToCloudinary(files) {
    const results = await Promise.allSettled(files.map(uploadToCloudinary));
    const images = results
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value);
    const failedUpload = results.find((result) => result.status === "rejected");

    if (failedUpload) {
        await removeStoredImages(images.map((image) => image.image_url));
        throw failedUpload.reason;
    }

    return images;
}

function cloudinaryPublicId(imageUrl) {
    if (!cloudinaryEnabled) return null;

    try {
        const url = new URL(imageUrl);
        if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com") return null;

        const segments = url.pathname.split("/").filter(Boolean);
        const uploadIndex = segments.findIndex(
            (segment, index) => segment === "upload" && segments[index - 1] === "image"
        );
        if (segments[0] !== cloudinaryConfig.cloudName || uploadIndex < 0) return null;

        const publicIdSegments = segments.slice(uploadIndex + 1);
        if (/^v\d+$/.test(publicIdSegments[0])) publicIdSegments.shift();
        if (!publicIdSegments.length) return null;

        const lastIndex = publicIdSegments.length - 1;
        publicIdSegments[lastIndex] = publicIdSegments[lastIndex].replace(/\.[a-zA-Z0-9]+$/, "");
        return publicIdSegments.map(decodeURIComponent).join("/");
    } catch {
        return null;
    }
}

async function destroyCloudinaryImage(imageUrl) {
    const publicId = cloudinaryPublicId(imageUrl);
    if (!publicId) return;

    const parameters = {
        invalidate: "true",
        public_id: publicId,
        timestamp: Math.floor(Date.now() / 1000),
    };
    const body = new URLSearchParams({
        ...parameters,
        api_key: cloudinaryConfig.apiKey,
        signature: createCloudinarySignature(parameters),
    });
    const cloudinaryResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudinaryConfig.cloudName)}/image/destroy`,
        {
            method: "POST",
            body,
            signal: AbortSignal.timeout(30_000),
        }
    );
    const result = await cloudinaryResponse.json().catch(() => ({}));

    if (!cloudinaryResponse.ok || !["ok", "not found"].includes(result.result)) {
        throw new Error(result.error?.message || "Cloudinary không thể xóa ảnh.");
    }
}

async function removeLocalUploadedFile(filePath) {
    try {
        await fs.promises.unlink(filePath);
    } catch (error) {
        if (error.code === "ENOENT") return;
        if (error.code !== "EPERM") throw error;

        await fs.promises.chmod(filePath, 0o666).catch(() => {});
        await fs.promises.unlink(filePath);
    }
}

async function removeStoredImages(imageUrls) {
    const uniqueUrls = [...new Set(imageUrls.filter(Boolean))];
    const results = await Promise.allSettled(
        uniqueUrls.map((imageUrl) => {
            const filePath = localUploadPath(imageUrl);
            if (filePath) return removeLocalUploadedFile(filePath);
            if (cloudinaryPublicId(imageUrl)) return destroyCloudinaryImage(imageUrl);
            return Promise.resolve();
        })
    );

    results.forEach((result, index) => {
        if (result.status === "rejected") {
            console.warn(`Không thể dọn ảnh ${uniqueUrls[index]}: ${result.reason.message}`);
        }
    });
}

function validateProductPayload(body) {
    const name = optionalText(body.name, 200);
    const sku = optionalText(body.sku, 60)?.toUpperCase();
    const categoryId = Number(body.category_id);
    const priceOptions = parsePriceOptions(
        body.price_options,
        body.unit,
        body.price,
        body.shipping_fee
    );
    const primaryPrice = priceOptions[0];
    const description = multilineText(body.description, 10000);
    const allowedStatuses = new Set(["draft", "active", "out_of_stock", "archived"]);
    const status = allowedStatuses.has(body.status) ? body.status : "draft";

    if (!name) throw new Error("Tên sản phẩm là bắt buộc.");
    if (!sku) throw new Error("SKU là bắt buộc.");
    if (!Number.isInteger(categoryId) || categoryId <= 0) throw new Error("Danh mục không hợp lệ.");
    if (!description) throw new Error("Mô tả sản phẩm là bắt buộc.");

    const product = {
        category_id: categoryId,
        sku,
        name,
        slug: slugify(body.slug || name),
        short_description: description.slice(0, 500),
        description,
        origin: optionalText(body.origin, 200),
        storage_instructions: optionalText(body.storage_instructions, 300),
        badge: optionalText(body.badge, 60) || "Tươi mới",
        unit: primaryPrice.label.slice(0, 40),
        price: primaryPrice.price,
        shipping_fee: primaryPrice.shipping_fee,
        status,
        is_featured: Boolean(body.is_featured),
        is_hot_week: Boolean(body.is_hot_week),
        hot_until: optionalText(body.hot_until, 10),
    };

    if (!product.slug) throw new Error("Slug không hợp lệ.");
    const images = parseImages(body.images, name);
    if (!images.length) throw new Error("Sản phẩm cần ít nhất một URL hình ảnh hợp lệ.");

    return {
        product,
        priceOptions,
        images,
    };
}

async function fetchProducts({ publicOnly = false } = {}) {
    const whereClause = publicOnly ? "WHERE p.status = 'active'" : "";
    const [products] = await pool.query(
        `SELECT
            p.*,
            c.name AS category_name,
            c.slug AS category_slug,
            COALESCE(i.stock_quantity, 0) AS stock_quantity,
            COALESCE(i.reserved_quantity, 0) AS reserved_quantity,
            COALESCE(i.low_stock_threshold, 0) AS low_stock_threshold
         FROM products AS p
         JOIN categories AS c ON c.id = p.category_id
         LEFT JOIN inventory AS i ON i.product_id = p.id
         ${whereClause}
         ORDER BY c.sort_order, p.is_featured DESC, p.is_hot_week DESC, p.created_at DESC, p.id DESC`
    );

    if (!products.length) return [];

    const productIds = products.map((product) => product.id);
    const [images] = await pool.query(
        `SELECT id, product_id, image_url, alt_text, sort_order, is_primary
         FROM product_images
         WHERE product_id IN (?)
         ORDER BY product_id, is_primary DESC, sort_order, id`,
        [productIds]
    );
    const [priceOptions] = await pool.query(
        `SELECT id, product_id, label, price, shipping_fee, sort_order
         FROM product_price_options
         WHERE product_id IN (?)
         ORDER BY product_id, sort_order, id`,
        [productIds]
    );
    const imagesByProduct = new Map();
    const pricesByProduct = new Map();

    images.forEach((image) => {
        const productImages = imagesByProduct.get(image.product_id) || [];
        productImages.push({ ...image, is_primary: Boolean(image.is_primary) });
        imagesByProduct.set(image.product_id, productImages);
    });
    priceOptions.forEach((option) => {
        const productPrices = pricesByProduct.get(option.product_id) || [];
        productPrices.push(option);
        pricesByProduct.set(option.product_id, productPrices);
    });

    return products.map((product) => ({
        ...product,
        is_featured: Boolean(product.is_featured),
        is_hot_week: Boolean(product.is_hot_week),
        images: imagesByProduct.get(product.id) || [],
        price_options: pricesByProduct.get(product.id) || [
            {
                label: product.unit,
                price: product.price,
                shipping_fee: Number(product.shipping_fee) === 0 ? 0 : 5000,
                sort_order: 0,
            },
        ],
    }));
}

async function replaceProductImages(connection, productId, images) {
    await connection.query("DELETE FROM product_images WHERE product_id = ?", [productId]);
    if (!images.length) return;

    const values = images.map((image) => [
        productId,
        image.image_url,
        image.alt_text,
        image.sort_order,
        image.is_primary,
    ]);
    await connection.query(
        `INSERT INTO product_images
            (product_id, image_url, alt_text, sort_order, is_primary)
         VALUES ?`,
        [values]
    );
}

async function replaceProductPriceOptions(connection, productId, priceOptions) {
    await connection.query("DELETE FROM product_price_options WHERE product_id = ?", [productId]);
    const values = priceOptions.map((option) => [
        productId,
        option.label,
        option.price,
        option.shipping_fee,
        option.sort_order,
    ]);
    await connection.query(
        `INSERT INTO product_price_options (product_id, label, price, shipping_fee, sort_order)
         VALUES ?`,
        [values]
    );
}

app.get("/api/health", async (_request, response) => {
    try {
        await pool.query("SELECT 1");
        response.json({ ok: true, database: "connected" });
    } catch (error) {
        response.status(503).json({ ok: false, database: "disconnected", message: error.message });
    }
});

app.get("/api/categories", async (_request, response, next) => {
    try {
        const [categories] = await pool.query(
            `SELECT id, name, slug, description, image_url, sort_order
             FROM categories
             WHERE is_active = TRUE
             ORDER BY sort_order, name`
        );
        response.json(categories);
    } catch (error) {
        next(error);
    }
});

app.get("/api/products", async (_request, response, next) => {
    try {
        response.json(await fetchProducts({ publicOnly: true }));
    } catch (error) {
        next(error);
    }
});

app.post("/api/admin/login", (request, response) => {
    const expectedUsername = process.env.ADMIN_USERNAME || "admin";
    const expectedPassword = process.env.ADMIN_PASSWORD || "change-this-password";
    const usernameMatches = safeCompare(request.body?.username || "", expectedUsername);
    const passwordMatches = safeCompare(request.body?.password || "", expectedPassword);

    if (!usernameMatches || !passwordMatches) {
        return response.status(401).json({ message: "Tên đăng nhập hoặc mật khẩu không đúng." });
    }

    request.session.regenerate((error) => {
        if (error) return response.status(500).json({ message: "Không thể tạo phiên đăng nhập." });
        request.session.isAdmin = true;
        request.session.username = expectedUsername;
        return response.json({ username: expectedUsername });
    });
});

app.post("/api/admin/logout", requireAdmin, (request, response) => {
    request.session.destroy(() => {
        response.clearCookie("gs_k_food_admin");
        response.status(204).end();
    });
});

app.get("/api/admin/me", (request, response) => {
    if (!request.session.isAdmin) return response.status(401).json({ authenticated: false });
    return response.json({ authenticated: true, username: request.session.username });
});

app.post("/api/admin/uploads", requireAdmin, imageUpload.array("images", 10), async (request, response, next) => {
    try {
        const files = request.files || [];
        if (!files.length) return response.status(400).json({ message: "Bạn chưa chọn ảnh để tải lên." });

        const images = cloudinaryEnabled
            ? await uploadFilesToCloudinary(files)
            : files.map((file) => ({
                  image_url: `/uploads/${file.filename}`,
                  original_name: file.originalname,
              }));

        return response.status(201).json({ images });
    } catch (error) {
        next(error);
    }
});

app.delete("/api/admin/uploads", requireAdmin, async (request, response, next) => {
    try {
        const requestedImages = Array.isArray(request.body.images)
            ? request.body.images.filter(
                  (imageUrl) => localUploadPath(imageUrl) || cloudinaryPublicId(imageUrl)
              )
            : [];
        if (!requestedImages.length) return response.status(204).end();

        const [referencedImages] = await pool.query(
            "SELECT image_url FROM product_images WHERE image_url IN (?)",
            [requestedImages]
        );
        const referenced = new Set(referencedImages.map((image) => image.image_url));
        await removeStoredImages(requestedImages.filter((imageUrl) => !referenced.has(imageUrl)));
        return response.status(204).end();
    } catch (error) {
        next(error);
    }
});

app.get("/api/admin/products", requireAdmin, async (_request, response, next) => {
    try {
        response.json(await fetchProducts());
    } catch (error) {
        next(error);
    }
});

app.post("/api/admin/products", requireAdmin, async (request, response, next) => {
    let connection;
    try {
        const payload = validateProductPayload(request.body);
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const product = payload.product;
        const [result] = await connection.query(
            `INSERT INTO products (
                category_id, sku, name, slug, short_description, description, origin,
                storage_instructions, badge, unit, price, shipping_fee,
                status, is_featured, is_hot_week, hot_until
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                product.category_id,
                product.sku,
                product.name,
                product.slug,
                product.short_description,
                product.description,
                product.origin,
                product.storage_instructions,
                product.badge,
                product.unit,
                product.price,
                product.shipping_fee,
                product.status,
                product.is_featured,
                product.is_hot_week,
                product.hot_until,
            ]
        );

        await replaceProductPriceOptions(connection, result.insertId, payload.priceOptions);
        await replaceProductImages(connection, result.insertId, payload.images);
        await connection.query(
            `INSERT INTO inventory (product_id, stock_quantity, low_stock_threshold)
             VALUES (?, ?, ?)`,
            [result.insertId, 999999, 0]
        );
        await connection.commit();
        response.status(201).json({ id: result.insertId, message: "Đã thêm sản phẩm." });
    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        connection?.release();
    }
});

app.put("/api/admin/products/:id", requireAdmin, async (request, response, next) => {
    let connection;
    let staleImageUrls = [];
    try {
        const productId = Number(request.params.id);
        if (!Number.isInteger(productId) || productId <= 0) {
            return response.status(400).json({ message: "ID sản phẩm không hợp lệ." });
        }

        const payload = validateProductPayload(request.body);
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [oldImages] = await connection.query(
            "SELECT image_url FROM product_images WHERE product_id = ?",
            [productId]
        );
        const product = payload.product;
        const [result] = await connection.query(
            `UPDATE products SET
                category_id = ?, sku = ?, name = ?, slug = ?, short_description = ?,
                description = ?, origin = ?, storage_instructions = ?, badge = ?, unit = ?,
                price = ?, shipping_fee = ?, status = ?,
                is_featured = ?, is_hot_week = ?, hot_until = ?
             WHERE id = ?`,
            [
                product.category_id,
                product.sku,
                product.name,
                product.slug,
                product.short_description,
                product.description,
                product.origin,
                product.storage_instructions,
                product.badge,
                product.unit,
                product.price,
                product.shipping_fee,
                product.status,
                product.is_featured,
                product.is_hot_week,
                product.hot_until,
                productId,
            ]
        );

        if (!result.affectedRows) {
            await connection.rollback();
            return response.status(404).json({ message: "Không tìm thấy sản phẩm." });
        }

        const newImageUrls = new Set(payload.images.map((image) => image.image_url));
        staleImageUrls = oldImages
            .map((image) => image.image_url)
            .filter((imageUrl) => !newImageUrls.has(imageUrl));
        await replaceProductPriceOptions(connection, productId, payload.priceOptions);
        await replaceProductImages(connection, productId, payload.images);
        await connection.commit();
        await removeStoredImages(staleImageUrls);
        response.json({ id: productId, message: "Đã cập nhật sản phẩm." });
    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        connection?.release();
    }
});

app.delete("/api/admin/products/:id", requireAdmin, async (request, response, next) => {
    let connection;
    try {
        const productId = Number(request.params.id);
        if (!Number.isInteger(productId) || productId <= 0) {
            return response.status(400).json({ message: "ID sản phẩm không hợp lệ." });
        }
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [images] = await connection.query(
            "SELECT image_url FROM product_images WHERE product_id = ?",
            [productId]
        );
        await connection.query("UPDATE order_items SET product_id = NULL WHERE product_id = ?", [productId]);
        await connection.query("DELETE FROM product_images WHERE product_id = ?", [productId]);
        await connection.query("DELETE FROM inventory WHERE product_id = ?", [productId]);
        const [result] = await connection.query("DELETE FROM products WHERE id = ?", [productId]);
        if (!result.affectedRows) {
            await connection.rollback();
            return response.status(404).json({ message: "Không tìm thấy sản phẩm." });
        }
        await connection.commit();
        await removeStoredImages(images.map((image) => image.image_url));
        response.json({ message: "Đã xóa sản phẩm vĩnh viễn." });
    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        connection?.release();
    }
});

const staticFiles = new Map([
    ["/style.css", "style.css"],
    ["/script.js", "script.js"],
    ["/admin.css", "admin.css"],
    ["/admin.js", "admin.js"],
]);

app.use("/uploads", express.static(uploadDirectory, {
    dotfiles: "deny",
    index: false,
    maxAge: "1d",
}));
app.use("/assets", express.static(path.join(rootDirectory, "assets"), {
    dotfiles: "deny",
    index: false,
    maxAge: "7d",
}));

app.get("/", (_request, response) => response.sendFile(path.join(rootDirectory, "index.html")));
app.get(["/admin", "/admin.html"], (_request, response) =>
    response.sendFile(path.join(rootDirectory, "admin.html"))
);
staticFiles.forEach((fileName, route) => {
    app.get(route, (_request, response) => response.sendFile(path.join(rootDirectory, fileName)));
});

app.use((error, _request, response, _next) => {
    console.error(error);
    if (error instanceof multer.MulterError) {
        return response.status(400).json({ message: `Tải ảnh thất bại: ${error.message}` });
    }
    if (error.statusCode) {
        return response.status(error.statusCode).json({ message: error.message });
    }
    if (error.code === "ER_DUP_ENTRY") {
        return response.status(409).json({ message: "SKU hoặc slug đã tồn tại." });
    }
    if (error.message && !error.code) {
        return response.status(400).json({ message: error.message });
    }
    return response.status(500).json({ message: "Có lỗi máy chủ. Hãy kiểm tra kết nối MySQL." });
});

if (require.main === module) {
    app.listen(port, () => {
        console.log(`G&S K-Food đang chạy tại http://localhost:${port}`);
        if (!process.env.SESSION_SECRET || !process.env.ADMIN_PASSWORD) {
            console.warn("Cảnh báo: hãy tạo file .env và đổi ADMIN_PASSWORD, SESSION_SECRET trước khi triển khai.");
        }
        const hasPartialCloudinaryConfig = [
            process.env.CLOUDINARY_CLOUD_NAME,
            process.env.CLOUDINARY_API_KEY,
            process.env.CLOUDINARY_API_SECRET,
        ].some(Boolean) && !cloudinaryEnabled;
        if (hasPartialCloudinaryConfig) {
            console.warn("Cảnh báo: cấu hình Cloudinary chưa đủ; ảnh đang được lưu vào thư mục uploads local.");
        }
    });
}

module.exports = { app, pool };
