require("dotenv").config();

const { app, pool } = require("./server");

(async () => {
    let server;
    let productId;

    try {
        server = app.listen(0);
        await new Promise((resolve) => server.once("listening", resolve));
        const baseUrl = `http://127.0.0.1:${server.address().port}`;
        const description = ["Dòng thứ nhất", "Dòng thứ hai", "", "Dòng thứ tư"].join("\n");
        const loginResponse = await fetch(`${baseUrl}/api/admin/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: process.env.ADMIN_USERNAME || "admin",
                password: process.env.ADMIN_PASSWORD || "",
            }),
        });
        if (!loginResponse.ok) throw new Error(`Đăng nhập thất bại: ${loginResponse.status}`);

        const cookie = loginResponse.headers.get("set-cookie").split(";")[0];
        const categories = await (await fetch(`${baseUrl}/api/categories`)).json();
        const suffix = Date.now();
        const createResponse = await fetch(`${baseUrl}/api/admin/products`, {
            method: "POST",
            headers: { Cookie: cookie, "Content-Type": "application/json" },
            body: JSON.stringify({
                category_id: categories[0].id,
                sku: `LINES-${suffix}`,
                name: `Multiline probe ${suffix}`,
                slug: `multiline-probe-${suffix}`,
                description,
                unit: "item",
                price: 1,
                shipping_fee: 0,
                status: "draft",
                images: ["https://images.unsplash.com/photo-1610832958506-aa56368176cf"],
            }),
        });
        const createResult = await createResponse.json();
        if (!createResponse.ok) throw new Error(JSON.stringify(createResult));
        productId = createResult.id;

        const products = await (
            await fetch(`${baseUrl}/api/admin/products`, { headers: { Cookie: cookie } })
        ).json();
        const savedProduct = products.find((product) => product.id === productId);
        if (savedProduct?.description !== description) throw new Error("Mô tả đọc lại không khớp.");

        const deleteResponse = await fetch(`${baseUrl}/api/admin/products/${productId}`, {
            method: "DELETE",
            headers: { Cookie: cookie },
        });
        if (!deleteResponse.ok) throw new Error(`Xóa dữ liệu thử thất bại: ${deleteResponse.status}`);
        productId = null;

        console.log(JSON.stringify({ savedExactly: true, lineCount: 4, deleteStatus: 200 }));
    } finally {
        if (productId) {
            await pool.query("DELETE FROM product_images WHERE product_id = ?", [productId]).catch(() => {});
            await pool.query("DELETE FROM inventory WHERE product_id = ?", [productId]).catch(() => {});
            await pool.query("DELETE FROM products WHERE id = ?", [productId]).catch(() => {});
        }
        await new Promise((resolve) => (server ? server.close(resolve) : resolve()));
        await pool.end();
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
