-- Chạy file này MỘT LẦN cho database gs_k_food đã tạo từ phiên bản cũ.
-- File sửa charset, tên tiếng Việt và thêm giá vận chuyển vào sản phẩm.

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER DATABASE gs_k_food
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE gs_k_food;

ALTER TABLE categories CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE products CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE product_images CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE orders CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE order_items CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @shipping_fee_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'products'
      AND COLUMN_NAME = 'shipping_fee'
);
SET @shipping_fee_sql = IF(
    @shipping_fee_exists = 0,
    'ALTER TABLE products ADD COLUMN shipping_fee DECIMAL(12, 2) NOT NULL DEFAULT 0 AFTER price',
    'SELECT 1'
);
PREPARE shipping_fee_statement FROM @shipping_fee_sql;
EXECUTE shipping_fee_statement;
DEALLOCATE PREPARE shipping_fee_statement;

UPDATE categories SET name = 'Trái cây Việt Nam' WHERE slug = 'trai-cay-viet-nam';
UPDATE categories SET name = 'Rau sạch' WHERE slug = 'rau-sach';
UPDATE categories SET name = 'Củ & hạt' WHERE slug = 'cu-va-hat';
UPDATE categories SET name = 'Thịt cá & hải sản' WHERE slug = 'thit-ca-va-hai-san';
UPDATE categories SET name = 'Tạp hóa VN' WHERE slug = 'tap-hoa-vn';

UPDATE products SET name = 'Xoài cát Hòa Lộc' WHERE sku = 'TC-XOAI-HL-001';
UPDATE products SET name = 'Nho đen Ninh Thuận' WHERE sku = 'TC-NHO-NT-002';
UPDATE products SET name = 'Cam sành miền Tây' WHERE sku = 'TC-CAM-MT-003';
UPDATE products SET name = 'Cải bó xôi Đà Lạt' WHERE sku = 'RAU-CAI-BX-001';
UPDATE products SET name = 'Bông cải xanh' WHERE sku = 'RAU-BCX-002';
UPDATE products SET name = 'Xà lách thủy canh' WHERE sku = 'RAU-XALACH-003';
UPDATE products SET name = 'Khoai tây Đà Lạt' WHERE sku = 'CU-KHOAITAY-001';
UPDATE products SET name = 'Khoai lang mật' WHERE sku = 'CU-KHOAILANG-002';
UPDATE products SET name = 'Hạt điều rang muối' WHERE sku = 'HAT-DIEU-003';
UPDATE products SET name = 'Cá hồi phi lê' WHERE sku = 'HS-CAHOI-001';
UPDATE products SET name = 'Tôm sú tươi' WHERE sku = 'HS-TOMSU-002';
UPDATE products SET name = 'Thịt bò thăn' WHERE sku = 'THIT-BOTHAN-003';
UPDATE products SET name = 'Gạo thơm ST25' WHERE sku = 'TH-GAO-ST25-001';
UPDATE products SET name = 'Cà phê Buôn Ma Thuột' WHERE sku = 'TH-CAPHE-002';
UPDATE products SET name = 'Mật ong Tây Nguyên' WHERE sku = 'TH-MATONG-003';

UPDATE products
SET
    short_description = CASE sku
        WHEN 'TC-XOAI-HL-001' THEN 'Xoài chín tự nhiên, vị ngọt thơm.'
        WHEN 'TC-NHO-NT-002' THEN 'Nho tươi vị ngọt thanh.'
        WHEN 'TC-CAM-MT-003' THEN 'Cam mọng nước, thu hoạch trong ngày.'
        WHEN 'RAU-CAI-BX-001' THEN 'Rau canh tác theo tiêu chuẩn VietGAP.'
        WHEN 'RAU-BCX-002' THEN 'Bông cải giòn ngọt, giàu dinh dưỡng.'
        WHEN 'RAU-XALACH-003' THEN 'Xà lách sạch thu hoạch trong ngày.'
        WHEN 'CU-KHOAITAY-001' THEN 'Khoai tây dẻo thơm, củ đều.'
        WHEN 'CU-KHOAILANG-002' THEN 'Khoai lang mật dẻo ngọt tự nhiên.'
        WHEN 'HAT-DIEU-003' THEN 'Hạt điều rang giòn, vị mặn vừa.'
        WHEN 'HS-CAHOI-001' THEN 'Cá hồi phi lê sơ chế sẵn.'
        WHEN 'HS-TOMSU-002' THEN 'Tôm sú tươi giao nhanh trong ngày.'
        WHEN 'THIT-BOTHAN-003' THEN 'Thịt bò thăn mềm, sơ chế trong ngày.'
        WHEN 'TH-GAO-ST25-001' THEN 'Gạo thơm dẻo, đóng túi 5kg.'
        WHEN 'TH-CAPHE-002' THEN 'Cà phê rang xay nguyên chất.'
        WHEN 'TH-MATONG-003' THEN 'Mật ong nguyên chất chai 500ml.'
        ELSE short_description
    END,
    origin = CASE sku
        WHEN 'TC-XOAI-HL-001' THEN 'Tiền Giang'
        WHEN 'TC-NHO-NT-002' THEN 'Ninh Thuận'
        WHEN 'TC-CAM-MT-003' THEN 'Vĩnh Long'
        WHEN 'RAU-CAI-BX-001' THEN 'Đà Lạt'
        WHEN 'RAU-BCX-002' THEN 'Lâm Đồng'
        WHEN 'RAU-XALACH-003' THEN 'Đà Lạt'
        WHEN 'CU-KHOAITAY-001' THEN 'Lâm Đồng'
        WHEN 'CU-KHOAILANG-002' THEN 'Đà Lạt'
        WHEN 'HAT-DIEU-003' THEN 'Bình Phước'
        WHEN 'HS-CAHOI-001' THEN 'Nhập khẩu'
        WHEN 'HS-TOMSU-002' THEN 'Việt Nam'
        WHEN 'THIT-BOTHAN-003' THEN 'Việt Nam'
        WHEN 'TH-GAO-ST25-001' THEN 'Sóc Trăng'
        WHEN 'TH-CAPHE-002' THEN 'Đắk Lắk'
        WHEN 'TH-MATONG-003' THEN 'Tây Nguyên'
        ELSE origin
    END,
    badge = CASE sku
        WHEN 'TC-XOAI-HL-001' THEN 'Hot'
        WHEN 'TC-NHO-NT-002' THEN 'Bán chạy'
        WHEN 'TC-CAM-MT-003' THEN 'Tươi mới'
        WHEN 'RAU-CAI-BX-001' THEN 'Rau sạch'
        WHEN 'RAU-BCX-002' THEN 'Bán chạy'
        WHEN 'RAU-XALACH-003' THEN 'Mới về'
        WHEN 'CU-KHOAITAY-001' THEN 'Bán chạy'
        WHEN 'CU-KHOAILANG-002' THEN 'Đặc sản'
        WHEN 'HAT-DIEU-003' THEN 'Hot'
        WHEN 'HS-CAHOI-001' THEN 'Cao cấp'
        WHEN 'HS-TOMSU-002' THEN 'Tươi sống'
        WHEN 'THIT-BOTHAN-003' THEN 'Bán chạy'
        WHEN 'TH-GAO-ST25-001' THEN 'Đặc sản'
        WHEN 'TH-CAPHE-002' THEN 'Bán chạy'
        WHEN 'TH-MATONG-003' THEN 'Nguyên chất'
        ELSE badge
    END,
    unit = CASE sku
        WHEN 'RAU-CAI-BX-001' THEN 'bó'
        WHEN 'RAU-XALACH-003' THEN 'túi'
        WHEN 'HAT-DIEU-003' THEN 'hộp'
        WHEN 'HS-CAHOI-001' THEN '500g'
        WHEN 'THIT-BOTHAN-003' THEN '500g'
        WHEN 'TH-GAO-ST25-001' THEN 'túi 5kg'
        WHEN 'TH-CAPHE-002' THEN 'gói'
        WHEN 'TH-MATONG-003' THEN 'chai'
        ELSE 'kg'
    END,
    storage_instructions = 'Bảo quản theo hướng dẫn trên sản phẩm',
    is_featured = is_hot_week
WHERE sku IN (
    'TC-XOAI-HL-001', 'TC-NHO-NT-002', 'TC-CAM-MT-003',
    'RAU-CAI-BX-001', 'RAU-BCX-002', 'RAU-XALACH-003',
    'CU-KHOAITAY-001', 'CU-KHOAILANG-002', 'HAT-DIEU-003',
    'HS-CAHOI-001', 'HS-TOMSU-002', 'THIT-BOTHAN-003',
    'TH-GAO-ST25-001', 'TH-CAPHE-002', 'TH-MATONG-003'
);

UPDATE products
SET description = COALESCE(NULLIF(short_description, ''), name)
WHERE sku IN (
    'TC-XOAI-HL-001', 'TC-NHO-NT-002', 'TC-CAM-MT-003',
    'RAU-CAI-BX-001', 'RAU-BCX-002', 'RAU-XALACH-003',
    'CU-KHOAITAY-001', 'CU-KHOAILANG-002', 'HAT-DIEU-003',
    'HS-CAHOI-001', 'HS-TOMSU-002', 'THIT-BOTHAN-003',
    'TH-GAO-ST25-001', 'TH-CAPHE-002', 'TH-MATONG-003'
);

UPDATE products
SET shipping_fee = CASE
    WHEN category_id = (SELECT id FROM categories WHERE slug = 'thit-ca-va-hai-san') THEN 35000
    WHEN category_id = (SELECT id FROM categories WHERE slug = 'tap-hoa-vn') THEN 20000
    ELSE 25000
END;

UPDATE product_images AS pi
JOIN products AS p ON p.id = pi.product_id
SET pi.alt_text = CONCAT(p.name, ' - hình ', pi.sort_order);
