const fs = require("node:fs/promises");
const path = require("node:path");
const mysql = require("mysql2/promise");
require("dotenv").config();

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || "127.0.0.1",
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME || "gs_k_food",
        charset: "utf8mb4_unicode_ci",
        multipleStatements: true,
    });

    try {
        const migrationPath = path.join(__dirname, "migrate_utf8_shipping.sql");
        const sql = await fs.readFile(migrationPath, "utf8");
        await connection.query(sql);
        console.log("Migration UTF-8 và giá vận chuyển đã hoàn tất.");
    } finally {
        await connection.end();
    }
}

migrate().catch((error) => {
    console.error("Migration thất bại:", error.message);
    process.exitCode = 1;
});
