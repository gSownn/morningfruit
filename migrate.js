const fs = require("node:fs/promises");
const path = require("node:path");
const mysql = require("mysql2/promise");
require("dotenv").config();

async function migrate() {
    const sslCaPath = String(process.env.DB_SSL_CA_PATH || "").trim();
    const ssl = sslCaPath
        ? {
              ca: await fs.readFile(
                  path.isAbsolute(sslCaPath) ? sslCaPath : path.join(__dirname, sslCaPath),
                  "utf8"
              ),
              rejectUnauthorized: true,
          }
        : undefined;
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || "127.0.0.1",
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME || "gs_k_food",
        charset: "utf8mb4_unicode_ci",
        multipleStatements: true,
        ssl,
    });

    try {
        const migrations = ["migrate_product_price_options.sql"];
        if (String(process.env.RUN_LEGACY_MIGRATION || "").toLowerCase() === "true") {
            migrations.unshift("migrate_utf8_shipping.sql");
        }
        for (const fileName of migrations) {
            const sql = await fs.readFile(path.join(__dirname, fileName), "utf8");
            await connection.query(sql);
            console.log(`Đã chạy ${fileName}.`);
        }
        console.log("Migration đã hoàn tất.");
    } finally {
        await connection.end();
    }
}

migrate().catch((error) => {
    console.error("Migration thất bại:", error.message);
    process.exitCode = 1;
});
