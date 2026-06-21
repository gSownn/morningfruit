SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_price_options (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT UNSIGNED NOT NULL,
    label VARCHAR(80) NOT NULL,
    price DECIMAL(12, 2) NOT NULL,
    shipping_fee DECIMAL(12, 2) NOT NULL DEFAULT 0,
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_product_price_options_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT chk_product_price_options_price CHECK (price >= 0),
    CONSTRAINT chk_product_price_options_shipping CHECK (shipping_fee IN (0, 5000)),
    UNIQUE KEY uq_product_price_options_order (product_id, sort_order),
    INDEX idx_product_price_options_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @price_option_shipping_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'product_price_options'
      AND COLUMN_NAME = 'shipping_fee'
);
SET @price_option_shipping_sql = IF(
    @price_option_shipping_exists = 0,
    'ALTER TABLE product_price_options ADD COLUMN shipping_fee DECIMAL(12, 2) NOT NULL DEFAULT 0 AFTER price',
    'SELECT 1'
);
PREPARE price_option_shipping_statement FROM @price_option_shipping_sql;
EXECUTE price_option_shipping_statement;
DEALLOCATE PREPARE price_option_shipping_statement;

-- Giữ nguyên giá hiện tại của sản phẩm cũ làm mức giá đầu tiên.
INSERT INTO product_price_options (product_id, label, price, shipping_fee, sort_order)
SELECT p.id, p.unit, p.price, CASE WHEN p.shipping_fee = 0 THEN 0 ELSE 5000 END, 0
FROM products AS p
WHERE NOT EXISTS (
    SELECT 1
    FROM product_price_options AS option_row
    WHERE option_row.product_id = p.id
);

UPDATE product_price_options AS option_row
JOIN products AS p ON p.id = option_row.product_id
SET option_row.shipping_fee = CASE WHEN p.shipping_fee = 0 THEN 0 ELSE 5000 END
WHERE option_row.sort_order = 0
  AND p.shipping_fee NOT IN (0, 5000);

UPDATE products AS p
JOIN product_price_options AS option_row
  ON option_row.product_id = p.id AND option_row.sort_order = 0
SET p.shipping_fee = option_row.shipping_fee;
