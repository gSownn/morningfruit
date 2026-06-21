-- Schema quản lý sản phẩm cho G&S K-Food
-- Hệ quản trị giả định: MySQL 8.0+

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS gs_k_food
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE gs_k_food;

CREATE TABLE categories (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(140) NOT NULL UNIQUE,
    description TEXT NULL,
    image_url VARCHAR(1000) NULL,
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE products (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category_id BIGINT UNSIGNED NOT NULL,
    sku VARCHAR(60) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(220) NOT NULL UNIQUE,
    short_description VARCHAR(500) NULL,
    description TEXT NULL,
    origin VARCHAR(200) NULL,
    storage_instructions VARCHAR(300) NULL,
    badge VARCHAR(60) NULL,
    unit VARCHAR(40) NOT NULL DEFAULT 'sản phẩm',
    price DECIMAL(12, 2) NOT NULL,
    shipping_fee DECIMAL(12, 2) NOT NULL DEFAULT 0,
    compare_at_price DECIMAL(12, 2) NULL,
    cost_price DECIMAL(12, 2) NULL,
    status ENUM('draft', 'active', 'out_of_stock', 'archived') NOT NULL DEFAULT 'draft',
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_hot_week BOOLEAN NOT NULL DEFAULT FALSE,
    hot_until DATE NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_products_category
        FOREIGN KEY (category_id) REFERENCES categories(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_products_price CHECK (price >= 0),
    CONSTRAINT chk_products_shipping_fee CHECK (shipping_fee >= 0),
    CONSTRAINT chk_products_compare_price CHECK (compare_at_price IS NULL OR compare_at_price >= 0),
    INDEX idx_products_category_status (category_id, status),
    INDEX idx_products_hot (is_hot_week, hot_until),
    INDEX idx_products_name (name)
) ENGINE=InnoDB;

-- Một sản phẩm có thể có nhiều mức giá: 1 cân, 2 cân, 5 cân...
CREATE TABLE product_price_options (
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
) ENGINE=InnoDB;

-- Một sản phẩm có nhiều ảnh. Frontend dùng các dòng này để tạo gallery thumbnail.
CREATE TABLE product_images (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT UNSIGNED NOT NULL,
    image_url VARCHAR(1000) NOT NULL,
    alt_text VARCHAR(250) NULL,
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_product_images_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    INDEX idx_product_images_order (product_id, sort_order),
    INDEX idx_product_images_primary (product_id, is_primary)
) ENGINE=InnoDB;

-- Dùng DECIMAL để quản lý được cả sản phẩm theo kg và sản phẩm theo cái/hộp.
CREATE TABLE inventory (
    product_id BIGINT UNSIGNED PRIMARY KEY,
    stock_quantity DECIMAL(12, 3) NOT NULL DEFAULT 0,
    reserved_quantity DECIMAL(12, 3) NOT NULL DEFAULT 0,
    low_stock_threshold DECIMAL(12, 3) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_inventory_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT chk_inventory_stock CHECK (stock_quantity >= 0),
    CONSTRAINT chk_inventory_reserved CHECK (reserved_quantity >= 0)
) ENGINE=InnoDB;

CREATE TABLE orders (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_code VARCHAR(30) NOT NULL UNIQUE,
    customer_name VARCHAR(150) NOT NULL,
    customer_phone VARCHAR(30) NOT NULL,
    customer_email VARCHAR(200) NULL,
    shipping_address VARCHAR(500) NOT NULL,
    note TEXT NULL,
    status ENUM('pending', 'confirmed', 'preparing', 'shipping', 'completed', 'cancelled')
        NOT NULL DEFAULT 'pending',
    subtotal DECIMAL(14, 2) NOT NULL DEFAULT 0,
    shipping_fee DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_orders_phone (customer_phone),
    INDEX idx_orders_status_created (status, created_at)
) ENGINE=InnoDB;

-- Lưu cả tên/SKU/giá tại thời điểm mua để đơn cũ không đổi khi sản phẩm được sửa.
CREATE TABLE order_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NULL,
    product_sku VARCHAR(60) NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    unit VARCHAR(40) NOT NULL,
    quantity DECIMAL(12, 3) NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    line_total DECIMAL(14, 2)
        GENERATED ALWAYS AS (quantity * unit_price) STORED,
    CONSTRAINT fk_order_items_order
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_order_items_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT chk_order_items_quantity CHECK (quantity > 0),
    CONSTRAINT chk_order_items_price CHECK (unit_price >= 0),
    INDEX idx_order_items_order (order_id),
    INDEX idx_order_items_product (product_id)
) ENGINE=InnoDB;

INSERT INTO categories (name, slug, sort_order) VALUES
    ('Trái cây Việt Nam', 'trai-cay-viet-nam', 1),
    ('Rau sạch', 'rau-sach', 2),
    ('Củ & hạt', 'cu-va-hat', 3),
    ('Thịt cá & hải sản', 'thit-ca-va-hai-san', 4),
    ('Tạp hóa VN', 'tap-hoa-vn', 5);

-- Dữ liệu mẫu ban đầu cho website. Sau khi cài đặt, quản lý các dòng này qua /admin.html.
START TRANSACTION;

INSERT INTO products (
    category_id, sku, name, slug, short_description, description, origin, storage_instructions,
    badge, unit, price, shipping_fee, status, is_featured, is_hot_week, hot_until
)
SELECT
    c.id, seed.sku, seed.name, seed.product_slug, seed.short_description, seed.short_description, seed.origin,
    'Bảo quản theo hướng dẫn trên sản phẩm', seed.badge, seed.unit, seed.price,
    CASE
        WHEN seed.category_slug = 'thit-ca-va-hai-san' THEN 35000
        WHEN seed.category_slug = 'tap-hoa-vn' THEN 20000
        ELSE 25000
    END,
    'active', seed.is_hot, seed.is_hot,
    CASE WHEN seed.is_hot = TRUE THEN DATE_ADD(CURRENT_DATE, INTERVAL 7 DAY) ELSE NULL END
FROM (
    SELECT 'trai-cay-viet-nam' category_slug, 'TC-XOAI-HL-001' sku, 'Xoài cát Hòa Lộc' name,
        'xoai-cat-hoa-loc' product_slug, 'Xoài chín tự nhiên, vị ngọt thơm.' short_description,
        'Tiền Giang' origin, 'Hot' badge, 'kg' unit, 85000 price, TRUE is_hot
    UNION ALL SELECT 'trai-cay-viet-nam', 'TC-NHO-NT-002', 'Nho đen Ninh Thuận',
        'nho-den-ninh-thuan', 'Nho tươi vị ngọt thanh.', 'Ninh Thuận', 'Bán chạy', 'kg', 120000, FALSE
    UNION ALL SELECT 'trai-cay-viet-nam', 'TC-CAM-MT-003', 'Cam sành miền Tây',
        'cam-sanh-mien-tay', 'Cam mọng nước, thu hoạch trong ngày.', 'Vĩnh Long', 'Tươi mới', 'kg', 45000, FALSE
    UNION ALL SELECT 'rau-sach', 'RAU-CAI-BX-001', 'Cải bó xôi Đà Lạt',
        'cai-bo-xoi-da-lat', 'Rau canh tác theo tiêu chuẩn VietGAP.', 'Đà Lạt', 'Rau sạch', 'bó', 32000, TRUE
    UNION ALL SELECT 'rau-sach', 'RAU-BCX-002', 'Bông cải xanh',
        'bong-cai-xanh', 'Bông cải giòn ngọt, giàu dinh dưỡng.', 'Lâm Đồng', 'Bán chạy', 'kg', 48000, FALSE
    UNION ALL SELECT 'rau-sach', 'RAU-XALACH-003', 'Xà lách thủy canh',
        'xa-lach-thuy-canh', 'Xà lách sạch thu hoạch trong ngày.', 'Đà Lạt', 'Mới về', 'túi', 39000, FALSE
    UNION ALL SELECT 'cu-va-hat', 'CU-KHOAITAY-001', 'Khoai tây Đà Lạt',
        'khoai-tay-da-lat', 'Khoai tây dẻo thơm, củ đều.', 'Lâm Đồng', 'Bán chạy', 'kg', 35000, FALSE
    UNION ALL SELECT 'cu-va-hat', 'CU-KHOAILANG-002', 'Khoai lang mật',
        'khoai-lang-mat', 'Khoai lang mật dẻo ngọt tự nhiên.', 'Đà Lạt', 'Đặc sản', 'kg', 42000, FALSE
    UNION ALL SELECT 'cu-va-hat', 'HAT-DIEU-003', 'Hạt điều rang muối',
        'hat-dieu-rang-muoi', 'Hạt điều rang giòn, vị mặn vừa.', 'Bình Phước', 'Hot', 'hộp', 165000, FALSE
    UNION ALL SELECT 'thit-ca-va-hai-san', 'HS-CAHOI-001', 'Cá hồi phi lê',
        'ca-hoi-phi-le', 'Cá hồi phi lê sơ chế sẵn.', 'Nhập khẩu', 'Cao cấp', '500g', 289000, TRUE
    UNION ALL SELECT 'thit-ca-va-hai-san', 'HS-TOMSU-002', 'Tôm sú tươi',
        'tom-su-tuoi', 'Tôm sú tươi giao nhanh trong ngày.', 'Việt Nam', 'Tươi sống', 'kg', 235000, FALSE
    UNION ALL SELECT 'thit-ca-va-hai-san', 'THIT-BOTHAN-003', 'Thịt bò thăn',
        'thit-bo-than', 'Thịt bò thăn mềm, sơ chế trong ngày.', 'Việt Nam', 'Bán chạy', '500g', 189000, FALSE
    UNION ALL SELECT 'tap-hoa-vn', 'TH-GAO-ST25-001', 'Gạo thơm ST25',
        'gao-thom-st25', 'Gạo thơm dẻo, đóng túi 5kg.', 'Sóc Trăng', 'Đặc sản', 'túi 5kg', 185000, TRUE
    UNION ALL SELECT 'tap-hoa-vn', 'TH-CAPHE-002', 'Cà phê Buôn Ma Thuột',
        'ca-phe-buon-ma-thuot', 'Cà phê rang xay nguyên chất.', 'Đắk Lắk', 'Bán chạy', 'gói', 125000, FALSE
    UNION ALL SELECT 'tap-hoa-vn', 'TH-MATONG-003', 'Mật ong Tây Nguyên',
        'mat-ong-tay-nguyen', 'Mật ong nguyên chất chai 500ml.', 'Tây Nguyên', 'Nguyên chất', 'chai', 149000, FALSE
) AS seed
JOIN categories AS c ON c.slug = seed.category_slug;

INSERT INTO product_price_options (product_id, label, price, shipping_fee, sort_order)
SELECT id, unit, price, CASE WHEN shipping_fee = 0 THEN 0 ELSE 5000 END, 0
FROM products;

INSERT INTO product_images (product_id, image_url, alt_text, sort_order, is_primary)
SELECT p.id, seed.image_url, CONCAT(p.name, ' - ảnh chính'), 1, TRUE
FROM (
    SELECT 'TC-XOAI-HL-001' sku, 'https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=1000&q=85' image_url
    UNION ALL SELECT 'TC-NHO-NT-002', 'https://images.unsplash.com/photo-1596363505729-4190a9506133?auto=format&fit=crop&w=1000&q=85'
    UNION ALL SELECT 'TC-CAM-MT-003', 'https://images.unsplash.com/photo-1547514701-42782101795e?auto=format&fit=crop&w=1000&q=85'
    UNION ALL SELECT 'RAU-CAI-BX-001', 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=1000&q=85'
    UNION ALL SELECT 'RAU-BCX-002', 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?auto=format&fit=crop&w=1000&q=85'
    UNION ALL SELECT 'RAU-XALACH-003', 'https://images.unsplash.com/photo-1557844352-761f2565b576?auto=format&fit=crop&w=1000&q=85'
    UNION ALL SELECT 'CU-KHOAITAY-001', 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=1000&q=85'
    UNION ALL SELECT 'CU-KHOAILANG-002', 'https://images.unsplash.com/photo-1596097635121-14b63b7a0c19?auto=format&fit=crop&w=1000&q=85'
    UNION ALL SELECT 'HAT-DIEU-003', 'https://images.unsplash.com/photo-1508747703725-719777637510?auto=format&fit=crop&w=1000&q=85'
    UNION ALL SELECT 'HS-CAHOI-001', 'https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?auto=format&fit=crop&w=1000&q=85'
    UNION ALL SELECT 'HS-TOMSU-002', 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=1000&q=85'
    UNION ALL SELECT 'THIT-BOTHAN-003', 'https://images.unsplash.com/photo-1588347818036-558601350947?auto=format&fit=crop&w=1000&q=85'
    UNION ALL SELECT 'TH-GAO-ST25-001', 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=1000&q=85'
    UNION ALL SELECT 'TH-CAPHE-002', 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1000&q=85'
    UNION ALL SELECT 'TH-MATONG-003', 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=1000&q=85'
) AS seed
JOIN products AS p ON p.sku = seed.sku;

-- Thêm hai ảnh phụ mẫu cho Xoài; admin có thể thêm tối đa 10 ảnh cho mỗi sản phẩm.
INSERT INTO product_images (product_id, image_url, alt_text, sort_order, is_primary)
SELECT id, 'https://images.unsplash.com/photo-1605027990121-cbae9e0642df?auto=format&fit=crop&w=1000&q=85',
    'Xoài cát Hòa Lộc - góc chụp 2', 2, FALSE
FROM products WHERE sku = 'TC-XOAI-HL-001';

INSERT INTO product_images (product_id, image_url, alt_text, sort_order, is_primary)
SELECT id, 'https://images.unsplash.com/photo-1519096845289-95806ee03a1a?auto=format&fit=crop&w=1000&q=85',
    'Xoài cát Hòa Lộc - góc chụp 3', 3, FALSE
FROM products WHERE sku = 'TC-XOAI-HL-001';

INSERT INTO inventory (product_id, stock_quantity, reserved_quantity, low_stock_threshold)
SELECT id, 50, 0, 5 FROM products;

SET @new_product_id = (SELECT id FROM products WHERE sku = 'TC-XOAI-HL-001' LIMIT 1);

COMMIT;

-- Danh sách sản phẩm đang bán kèm ảnh đại diện và tồn khả dụng.
SELECT
    p.id,
    p.sku,
    p.name,
    c.name AS category_name,
    p.price,
    p.shipping_fee,
    p.unit,
    pi.image_url AS primary_image,
    COALESCE(i.stock_quantity - i.reserved_quantity, 0) AS available_quantity
FROM products AS p
JOIN categories AS c ON c.id = p.category_id
LEFT JOIN product_images AS pi
    ON pi.product_id = p.id AND pi.is_primary = TRUE
LEFT JOIN inventory AS i ON i.product_id = p.id
WHERE p.status = 'active'
ORDER BY c.sort_order, p.name;

-- Lấy toàn bộ ảnh cho trang chi tiết một sản phẩm.
SELECT id, image_url, alt_text, sort_order, is_primary
FROM product_images
WHERE product_id = @new_product_id
ORDER BY is_primary DESC, sort_order, id;

-- Hàng hot còn hiệu lực trong tuần.
SELECT p.*
FROM products AS p
WHERE p.status = 'active'
  AND p.is_hot_week = TRUE
  AND (p.hot_until IS NULL OR p.hot_until >= CURRENT_DATE)
ORDER BY p.updated_at DESC;

-- Minh họa trừ tồn kho an toàn khi xác nhận đơn hàng.
START TRANSACTION;

SELECT stock_quantity, reserved_quantity
FROM inventory
WHERE product_id = @new_product_id
FOR UPDATE;

UPDATE inventory
SET stock_quantity = stock_quantity - 1
WHERE product_id = @new_product_id
  AND stock_quantity - reserved_quantity >= 1;

-- Trong luồng đặt hàng thật, chỉ COMMIT khi câu UPDATE tác động đúng 1 dòng.
-- File mẫu dùng ROLLBACK để không làm giảm tồn kho khi khởi tạo database.
ROLLBACK;
