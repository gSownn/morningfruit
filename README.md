# G&S K-Food

Website bán hàng dùng Node.js + Express + MySQL 8, kèm trang quản trị sản phẩm.

## 1. Chuẩn bị

Cài các phần mềm sau:

- Node.js 20 trở lên.
- MySQL Server 8.0 trở lên.
- MySQL Workbench nếu muốn thao tác database bằng giao diện.

## 2. Khởi tạo database

Cách dễ nhất bằng MySQL Workbench:

1. Mở MySQL Workbench và kết nối tới MySQL trên máy.
2. Chọn **File → Open SQL Script**.
3. Mở file `database.sql`.
4. Nhấn biểu tượng tia sét để chạy toàn bộ script.

Script sẽ tạo database `gs_k_food`, năm danh mục, 15 sản phẩm mẫu, hình ảnh và tồn kho.

Nếu đã có MySQL CLI trong `PATH`, mở MySQL:

```powershell
mysql -u root -p
```

Sau đó chạy lệnh sau trong cửa sổ MySQL:

```sql
SOURCE D:/morningfruit/database.sql;
```

`database.sql` dành cho lần cài mới. Nếu đã tạo database từ phiên bản schema cũ, hãy sao lưu dữ liệu trước khi cập nhật.

Nếu database cũ đang lỗi chữ Việt, mở và chạy `migrate_utf8_shipping.sql` **một lần**.
File này chuẩn hóa `utf8mb4`, sửa tên danh mục/sản phẩm mẫu và thêm cột `shipping_fee`.

Cũng có thể chạy migration bằng Node:

```powershell
npm run migrate
```

## 3. Cấu hình kết nối

Tạo file `.env` từ file mẫu:

```powershell
Copy-Item .env.example .env
```

Mở `.env` và sửa tối thiểu các giá trị:

```env
DB_USER=root
DB_PASSWORD=mat-khau-mysql-cua-ban
DB_NAME=gs_k_food

ADMIN_USERNAME=admin
ADMIN_PASSWORD=mat-khau-admin-moi
SESSION_SECRET=mot-chuoi-ngau-nhien-dai-va-kho-doan
```

Nếu MySQL cloud yêu cầu SSL (ví dụ Aiven), tải CA certificate vào `certs/ca.pem`
và thêm:

```env
DB_SSL_CA_PATH=certs/ca.pem
```

Khi dùng MySQL local, để trống biến này.

Không đưa file `.env` lên Git hoặc gửi công khai.

Khi deploy, nên lưu ảnh trên Cloudinary thay vì ổ đĩa tạm của hosting. Tạo tài khoản
Cloudinary, mở phần API Keys rồi thêm đủ các biến sau vào `.env` hoặc Environment
Variables của hosting:

```env
CLOUDINARY_CLOUD_NAME=ten-cloud
CLOUDINARY_API_KEY=api-key
CLOUDINARY_API_SECRET=api-secret
CLOUDINARY_FOLDER=morningfruit/products
```

Khi đủ ba khóa Cloudinary, server tự upload và xóa ảnh trên Cloudinary. Nếu để trống,
server tiếp tục dùng thư mục `uploads` local để tiện phát triển trên máy.

## 4. Cài package và chạy web

```powershell
npm install
npm start
```

Sau đó mở:

- Cửa hàng: `http://localhost:3000`
- Quản trị: `http://localhost:3000/admin.html`
- Kiểm tra MySQL: `http://localhost:3000/api/health`

Khi phát triển và muốn server tự khởi động lại sau mỗi lần sửa:

```powershell
npm run dev
```

## 5. Sử dụng trang admin

1. Đăng nhập bằng `ADMIN_USERNAME` và `ADMIN_PASSWORD` trong `.env`.
2. Điền tên, SKU, danh mục, mô tả, giá, phí vận chuyển, đơn vị và nhãn.
3. Ở phần **Hình ảnh sản phẩm**, chọn trực tiếp nhiều ảnh từ máy. Ảnh đầu tiên là ảnh đại diện; các ảnh còn lại xuất hiện trong gallery “Xem chi tiết”.
4. Chọn **Đang bán** để sản phẩm xuất hiện ngoài cửa hàng.
5. Bật **Hàng hot trong tuần** và chọn ngày kết thúc nếu muốn sản phẩm xuất hiện ở khu hàng hot.
6. Nhấn **Sửa** trong bảng để cập nhật. Nút **Xóa** xóa vĩnh viễn sản phẩm và các ảnh upload liên quan.

## 6. Luồng dữ liệu

```text
Trang chủ / Admin
       ↓ HTTP JSON
Express API (server.js)
       ↓ SQL có tham số
MySQL (categories, products, product_images, inventory)
```

Trang chủ gọi `GET /api/products`. Nếu API/MySQL chưa chạy, JavaScript giữ lại sản phẩm tĩnh trong HTML làm dữ liệu dự phòng.

Các API quản trị chính:

- `POST /api/admin/login`
- `GET /api/admin/products`
- `POST /api/admin/products`
- `PUT /api/admin/products/:id`
- `DELETE /api/admin/products/:id` — lưu trữ sản phẩm

## 7. Trước khi đưa lên internet

- Bắt buộc đổi mật khẩu admin và `SESSION_SECRET`.
- Dùng HTTPS và đặt `NODE_ENV=production`.
- Thay session lưu trong bộ nhớ bằng Redis hoặc MySQL session store.
- Cấu hình Cloudinary để ảnh không mất khi hosting khởi động lại hoặc thay phiên bản deploy.
- Sao lưu database định kỳ.
