const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const WebSocket = require("ws");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const multer = require("multer");
const fs = require("fs");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
const path = require("path");

// Static files configuration
const frontEndPath = path.resolve(__dirname, "..", "front end");
console.log("📁 Frontend Path:", frontEndPath);
console.log("📄 Files check:");
console.log(
  "  - index.html exists:",
  fs.existsSync(path.join(frontEndPath, "index.html")),
);
console.log(
  "  - login.html exists:",
  fs.existsSync(path.join(frontEndPath, "login.html")),
);

app.use(express.static(frontEndPath));

// Create uploads folder
const uploadsDir = path.join(frontEndPath, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

// Multer setup for profile pictures
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "profile-" + uniqueSuffix + ext);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("الملف يجب أن يكون صورة"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

// ========== Nodemailer Setup ==========
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER || "your-email@gmail.com",
    pass: process.env.EMAIL_PASS || "your-app-password",
  },
});

// ========== WebSocket Server ==========
const wss = new WebSocket.Server({ port: 8080 });
let clients = [];

wss.on("connection", (ws) => {
  console.log("✅ عميل جديد متصل بـ WebSocket");
  clients.push(ws);

  ws.on("close", () => {
    clients = clients.filter((client) => client !== ws);
    console.log("❌ عميل disconnected من WebSocket");
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
});

function broadcastNotification(title, message, type, data = {}) {
  const notification = {
    id: Date.now(),
    title: title,
    message: message,
    type: type,
    data: data,
    timestamp: new Date().toISOString(),
    read: false,
  };

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(notification));
    }
  });

  console.log(`📢 إشعار فوري: ${title} - ${message}`);
}

// ========== Database Setup ==========
const { pool: db, testConnection } = require("./src/config/database");

async function initDatabase() {
  try {
    const connected = await testConnection();
    if (!connected) {
      console.error(
        "⚠️ فشل الاتصال بقاعدة البيانات. السيرفر سيستمر لكن قد تحدث مشاكل.",
      );
      return;
    }

    // Users table
    await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255),
                name VARCHAR(255) NOT NULL,
                role ENUM('admin', 'storekeeper', 'cashier') DEFAULT 'cashier',
                googleId VARCHAR(255),
                profile_picture VARCHAR(500),
                phone VARCHAR(20),
                address TEXT,
                account_status ENUM('pending', 'active', 'rejected', 'suspended') DEFAULT 'pending',
                is_active BOOLEAN DEFAULT FALSE,
                is_approved BOOLEAN DEFAULT FALSE,
                approved_by INT,
                approved_at TIMESTAMP NULL,
                otp_code VARCHAR(10),
                otp_expires DATETIME,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
    console.log("✅ Table users ready");

    // User activity log
    await db.query(`
            CREATE TABLE IF NOT EXISTS user_activity_log (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                user_name VARCHAR(255),
                action VARCHAR(100) NOT NULL,
                description TEXT,
                page VARCHAR(100),
                ip_address VARCHAR(50),
                user_agent TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_id (user_id),
                INDEX idx_timestamp (timestamp),
                INDEX idx_action (action)
            )
        `);
    console.log("✅ Table user_activity_log ready");

    // Registration requests
    await db.query(`
            CREATE TABLE IF NOT EXISTS registration_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'cashier',
                status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                processed_by VARCHAR(255),
                processed_at TIMESTAMP NULL
            )
        `);
    console.log("✅ Table registration_requests ready");

    // Products
    await db.query(`
            CREATE TABLE IF NOT EXISTS products (
                id BIGINT PRIMARY KEY,
                code VARCHAR(50) NOT NULL UNIQUE,
                name VARCHAR(255) NOT NULL,
                category VARCHAR(100),
                purchasePrice DECIMAL(10,2) DEFAULT 0,
                sellingPrice DECIMAL(10,2) DEFAULT 0,
                minStock INT DEFAULT 5,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
    console.log("✅ Table products ready");

    // Stock
    await db.query(`
            CREATE TABLE IF NOT EXISTS stock (
                id INT AUTO_INCREMENT PRIMARY KEY,
                productId BIGINT NOT NULL,
                quantity INT DEFAULT 0,
                locationId INT DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
                INDEX idx_productId (productId),
                INDEX idx_locationId (locationId)
            )
        `);
    console.log("✅ Table stock ready");

    // Stock Transfers
    await db.query(`
            CREATE TABLE IF NOT EXISTS stock_transfers (
                id BIGINT PRIMARY KEY,
                transferNumber VARCHAR(50) NOT NULL UNIQUE,
                fromLocationId INT NOT NULL,
                toLocationId INT NOT NULL,
                date DATE NOT NULL,
                totalValue DECIMAL(10,2) DEFAULT 0,
                notes TEXT,
                createdBy VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (fromLocationId) REFERENCES locations(id) ON DELETE CASCADE,
                FOREIGN KEY (toLocationId) REFERENCES locations(id) ON DELETE CASCADE
            )
        `);
    console.log("✅ Table stock_transfers ready");

    // Stock Transfer Items
    await db.query(`
            CREATE TABLE IF NOT EXISTS stock_transfer_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                transferId BIGINT NOT NULL,
                productId BIGINT NOT NULL,
                productName VARCHAR(255),
                quantity INT DEFAULT 0,
                price DECIMAL(10,2) DEFAULT 0,
                total DECIMAL(10,2) DEFAULT 0,
                FOREIGN KEY (transferId) REFERENCES stock_transfers(id) ON DELETE CASCADE
            )
        `);
    console.log("✅ Table stock_transfer_items ready");

    // Sale invoices
    await db.query(`
            CREATE TABLE IF NOT EXISTS sale_invoices (
                id BIGINT PRIMARY KEY,
                invoiceNumber VARCHAR(50) NOT NULL UNIQUE,
                date DATE NOT NULL,
                time VARCHAR(20),
                customer VARCHAR(255),
                seller VARCHAR(255),
                subtotal DECIMAL(10,2) DEFAULT 0,
                wholesaleDiscount DECIMAL(10,2) DEFAULT 0,
                extraDiscount DECIMAL(10,2) DEFAULT 0,
                total DECIMAL(10,2) DEFAULT 0,
                paid DECIMAL(10,2) DEFAULT 0,
                \`change\` DECIMAL(10,2) DEFAULT 0,
                paymentMethod VARCHAR(50),
                transactionNumber VARCHAR(100),
                deliveryMethod VARCHAR(50),
                deliveryAddress TEXT,
                createdBy VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_deferred BOOLEAN DEFAULT FALSE,
                down_payment DECIMAL(10,2) DEFAULT 0,
                due_date DATE NULL,
                notes TEXT
            )
        `);
    console.log("✅ Table sale_invoices ready");

    // Sale invoice items
    await db.query(`
            CREATE TABLE IF NOT EXISTS sale_invoice_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                invoiceId BIGINT NOT NULL,
                productId BIGINT NOT NULL,
                productName VARCHAR(255),
                quantity INT DEFAULT 0,
                price DECIMAL(10,2) DEFAULT 0,
                originalPrice DECIMAL(10,2) DEFAULT 0,
                FOREIGN KEY (invoiceId) REFERENCES sale_invoices(id) ON DELETE CASCADE
            )
        `);
    console.log("✅ Table sale_invoice_items ready");

    // Purchase invoices
    await db.query(`
            CREATE TABLE IF NOT EXISTS purchase_invoices (
                id BIGINT PRIMARY KEY,
                invoiceNumber VARCHAR(50) NOT NULL UNIQUE,
                date DATE NOT NULL,
                supplier VARCHAR(255),
                total DECIMAL(10,2) DEFAULT 0,
                createdBy VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    console.log("✅ Table purchase_invoices ready");

    // Purchase invoice items
    await db.query(`
            CREATE TABLE IF NOT EXISTS purchase_invoice_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                invoiceId BIGINT NOT NULL,
                productId BIGINT NOT NULL,
                productName VARCHAR(255),
                quantity INT DEFAULT 0,
                price DECIMAL(10,2) DEFAULT 0,
                locationId INT DEFAULT 1,
                FOREIGN KEY (invoiceId) REFERENCES purchase_invoices(id) ON DELETE CASCADE
            )
        `);
    console.log("✅ Table purchase_invoice_items ready");

    // Customers
    await db.query(`
            CREATE TABLE IF NOT EXISTS customers (
                id BIGINT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                phone VARCHAR(50),
                address TEXT,
                balance DECIMAL(10,2) DEFAULT 0,
                totalPurchases DECIMAL(10,2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    console.log("✅ Table customers ready");

    // Customer debts
    await db.query(`
            CREATE TABLE IF NOT EXISTS customer_debts (
                id BIGINT PRIMARY KEY,
                customerId BIGINT NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                description TEXT,
                date DATE NOT NULL,
                remaining DECIMAL(10,2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE
            )
        `);
    console.log("✅ Table customer_debts ready");

    // Customer payments
    await db.query(`
            CREATE TABLE IF NOT EXISTS customer_payments (
                id BIGINT PRIMARY KEY,
                customerId BIGINT NOT NULL,
                debtId BIGINT,
                amount DECIMAL(10,2) NOT NULL,
                paymentDate DATE NOT NULL,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE,
                FOREIGN KEY (debtId) REFERENCES customer_debts(id) ON DELETE SET NULL
            )
        `);
    console.log("✅ Table customer_payments ready");

    // Suppliers
    await db.query(`
            CREATE TABLE IF NOT EXISTS suppliers (
                id BIGINT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                phone VARCHAR(50),
                address TEXT,
                balance DECIMAL(10,2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    console.log("✅ Table suppliers ready");

    // Locations
    await db.query(`
            CREATE TABLE IF NOT EXISTS locations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    console.log("✅ Table locations ready");

    // Audit log
    await db.query(`
            CREATE TABLE IF NOT EXISTS audit_log (
                id BIGINT PRIMARY KEY,
                date DATETIME NOT NULL,
                user VARCHAR(255),
                action TEXT,
                device VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_date (date),
                INDEX idx_user (user)
            )
        `);
    console.log("✅ Table audit_log ready");

    // Returns
    await db.query(`
            CREATE TABLE IF NOT EXISTS returns (
                id BIGINT PRIMARY KEY,
                returnNumber VARCHAR(50) NOT NULL UNIQUE,
                date DATE NOT NULL,
                type ENUM('sale', 'purchase') NOT NULL,
                invoiceNumber VARCHAR(50) NOT NULL,
                party VARCHAR(255),
                total DECIMAL(10,2) DEFAULT 0,
                reason TEXT,
                createdBy VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    console.log("✅ Table returns ready");

    // Return items
    await db.query(`
            CREATE TABLE IF NOT EXISTS return_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                returnId BIGINT NOT NULL,
                productId BIGINT NOT NULL,
                productName VARCHAR(255),
                quantity INT DEFAULT 0,
                price DECIMAL(10,2) DEFAULT 0,
                total DECIMAL(10,2) DEFAULT 0,
                FOREIGN KEY (returnId) REFERENCES returns(id) ON DELETE CASCADE
            )
        `);
    console.log("✅ Table return_items ready");

    // User permissions
    await db.query(`
            CREATE TABLE IF NOT EXISTS user_permissions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                permission_id VARCHAR(100) NOT NULL,
                enabled BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY unique_user_permission (user_id, permission_id)
            )
        `);
    console.log("✅ Table user_permissions ready");

    // ========== Admin account ==========
    const [existingAdmin] = await db.query(
      `SELECT * FROM users WHERE email = 'admin@inventory.com'`,
    );
    if (existingAdmin.length === 0) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      await db.query(
        `INSERT INTO users (email, password, name, role, is_active, is_approved, account_status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "admin@inventory.com",
          hashedPassword,
          "مدير النظام",
          "admin",
          true,
          true,
          "active",
        ],
      );
      console.log(
        "✅ Default admin user created: admin@inventory.com / admin123",
      );
    } else {
      const admin = existingAdmin[0];
      if (
        admin.is_active !== 1 ||
        admin.is_approved !== 1 ||
        admin.account_status !== "active"
      ) {
        await db.query(
          `UPDATE users SET is_active = 1, is_approved = 1, account_status = 'active', 
                     otp_code = NULL, otp_expires = NULL WHERE email = 'admin@inventory.com'`,
        );
        console.log("✅ Admin account fixed");
      }
      console.log("✅ Admin account ready: admin@inventory.com / admin123");
    }

    // Test users
    const [testUsers] = await db.query(
      `SELECT * FROM users WHERE email LIKE '%test%'`,
    );
    if (testUsers.length === 0) {
      const testPassword = await bcrypt.hash("123456", 10);

      await db.query(
        `INSERT INTO users (email, password, name, role, is_active, is_approved, account_status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "test1@example.com",
          testPassword,
          "مستخدم تجريبي 1",
          "storekeeper",
          true,
          false,
          "pending",
        ],
      );

      await db.query(
        `INSERT INTO users (email, password, name, role, is_active, is_approved, account_status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "test2@example.com",
          testPassword,
          "مستخدم تجريبي 2",
          "cashier",
          true,
          false,
          "pending",
        ],
      );

      await db.query(
        `INSERT INTO users (email, password, name, role, is_active, is_approved, account_status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "test3@example.com",
          testPassword,
          "مستخدم مقبول",
          "storekeeper",
          true,
          true,
          "active",
        ],
      );

      await db.query(
        `INSERT INTO users (email, password, name, role, is_active, is_approved, account_status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "test4@example.com",
          testPassword,
          "مستخدم مرفوض",
          "cashier",
          true,
          false,
          "rejected",
        ],
      );

      console.log("✅ تم إضافة 4 مستخدمين تجريبيين للاختبار");
    }

    // Default locations
    const [existingLocation] = await db.query(
      `SELECT * FROM locations WHERE id = 1`,
    );
    if (existingLocation.length === 0) {
      await db.query(
        `INSERT INTO locations (id, name) VALUES (1, 'المستودع الرئيسي')`,
      );
      console.log("✅ Default location created");
    }

    const [existingLocation2] = await db.query(
      `SELECT * FROM locations WHERE id = 2`,
    );
    if (existingLocation2.length === 0) {
      await db.query(
        `INSERT INTO locations (id, name) VALUES (2, 'المستودع الفرعي')`,
      );
      console.log("✅ Second location created");
    }
  } catch (error) {
    console.error("Database initialization error:", error);
  }
}

initDatabase();

// ========== Helper Functions ==========
async function sendEmail(email, subject, text) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📧 محاكاة إرسال بريد إلكتروني:`);
  console.log(`   المستلم: ${email}`);
  console.log(`   الموضوع: ${subject}`);
  console.log(`   المحتوى: ${text}`);
  console.log(`${"=".repeat(60)}\n`);

  if (
    process.env.EMAIL_USER &&
    process.env.EMAIL_USER !== "your-email@gmail.com"
  ) {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: subject,
      text: text,
    };
    try {
      await transporter.sendMail(mailOptions);
      console.log(`📧 تم إرسال البريد الإلكتروني الفعلي إلى ${email}`);
      return true;
    } catch (error) {
      console.error("Error sending email:", error);
      return false;
    }
  }
  return true;
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTPEmail(email, name, otp) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📧 محاكاة إرسال OTP`);
  console.log(`   المستلم: ${email}`);
  console.log(`   الاسم: ${name}`);
  console.log(`   🔐 كود OTP: ${otp}`);
  console.log(`   ⏰ صلاحية: 10 دقائق`);
  console.log(`${"=".repeat(60)}\n`);
  return true;
}

async function sendApprovalEmail(email, name, status) {
  const isApproved = status === "approved";
  const mailOptions = {
    from: process.env.EMAIL_USER || "your-email@gmail.com",
    to: email,
    subject: isApproved ? "✅ تم قبول طلب التسجيل" : "❌ تم رفض طلب التسجيل",
    html: `
            <div dir="rtl" style="font-family: 'Cairo', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc; border-radius: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #4361ee;">📦 نظام إدارة المخازن</h1>
                </div>
                <div style="background: white; padding: 30px; border-radius: 16px; text-align: center;">
                    <div style="font-size: 60px; margin-bottom: 20px;">
                        ${isApproved ? "✅" : "❌"}
                    </div>
                    <p style="color: #1f2937; font-size: 18px;">عزيزي ${name}،</p>
                    <p style="color: #1f2937; margin: 20px 0;">
                        ${
                          isApproved
                            ? "تم قبول طلب التسجيل الخاص بك! يمكنك الآن تسجيل الدخول إلى النظام."
                            : "نأسف لإبلاغك أنه تم رفض طلب التسجيل الخاص بك. يرجى التواصل مع المدير لمزيد من المعلومات."
                        }
                    </p>
                    ${isApproved ? `<a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/login.html" style="display: inline-block; background: #4361ee; color: white; padding: 12px 30px; border-radius: 30px; text-decoration: none; margin-top: 20px;">تسجيل الدخول</a>` : ""}
                </div>
            </div>
        `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 تم إرسال إشعار ${status} إلى ${email}`);
    return true;
  } catch (error) {
    console.error("Error sending approval email:", error);
    return false;
  }
}

async function addAuditLog(userName, action, req) {
  try {
    const id = Date.now();
    const device = req?.headers?.["user-agent"] || "غير معروف";
    await db.query(
      `INSERT INTO audit_log (id, date, user, action, device) VALUES (?, NOW(), ?, ?, ?)`,
      [id, userName, action, device],
    );
  } catch (error) {
    console.error("Error adding audit log:", error);
  }
}

// ============================================================
// ========== 🔐 API المصادقة (AUTH) ==========
// ============================================================

// POST - Register
app.post("/api/auth/register", async (req, res) => {
  console.log("🎯 تم استقبال طلب تسجيل جديد:", req.body.email);
  const { email, password, name, role } = req.body;

  if (!email || !password || !name) {
    return res
      .status(400)
      .json({
        success: false,
        message: "البريد الإلكتروني وكلمة المرور والاسم مطلوبين",
      });
  }

  if (email.toLowerCase() === "admin@inventory.com") {
    return res.status(400).json({
      success: false,
      message:
        "⚠️ هذا البريد الإلكتروني محجوز لمدير النظام. يرجى استخدام بريد آخر.",
    });
  }

  try {
    const [existing] = await db.query(
      "SELECT id, is_active FROM users WHERE email = ?",
      [email],
    );
    if (existing.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: "البريد الإلكتروني مستخدم بالفعل" });
    }

    const [existingRequest] = await db.query(
      'SELECT * FROM registration_requests WHERE email = ? AND status = "pending"',
      [email],
    );
    if (existingRequest.length > 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: "لديك طلب تسجيل قيد المراجعة حالياً",
        });
    }

    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query(
      `INSERT INTO registration_requests (email, name, role, status) VALUES (?, ?, ?, 'pending')`,
      [email, name, role || "cashier"],
    );

    await db.query(
      `INSERT INTO users (email, password, name, role, is_active, is_approved, otp_code, otp_expires) 
             VALUES (?, ?, ?, ?, false, false, ?, ?)`,
      [email, hashedPassword, name, role || "cashier", otp, otpExpires],
    );

    await sendOTPEmail(email, name, otp);

    broadcastNotification(
      "👤 طلب تسجيل جديد",
      `${name} (${email}) يطلب التسجيل في النظام`,
      "info",
      { email, name, role },
    );

    res.json({
      success: true,
      message:
        "تم إرسال كود التفعيل إلى بريدك الإلكتروني. بعد التفعيل، سيتم إشعار المدير للموافقة على حسابك.",
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في إنشاء الحساب",
        error: error.message,
      });
  }
});

// POST - Verify OTP
app.post("/api/auth/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res
      .status(400)
      .json({
        success: false,
        message: "البريد الإلكتروني وكود التفعيل مطلوبين",
      });
  }

  try {
    const [users] = await db.query(
      "SELECT id, name, otp_code, otp_expires FROM users WHERE email = ? AND is_active = false",
      [email],
    );

    if (users.length === 0) {
      return res
        .status(404)
        .json({
          success: false,
          message: "المستخدم غير موجود أو تم تفعيله بالفعل",
        });
    }

    const user = users[0];

    if (user.otp_code !== otp) {
      return res
        .status(400)
        .json({ success: false, message: "كود التفعيل غير صحيح" });
    }

    if (new Date(user.otp_expires) < new Date()) {
      return res
        .status(400)
        .json({ success: false, message: "انتهت صلاحية كود التفعيل" });
    }

    await db.query(
      "UPDATE users SET is_active = true, otp_code = NULL, otp_expires = NULL WHERE id = ?",
      [user.id],
    );

    broadcastNotification(
      "🔓 حساب مفعل ينتظر الموافقة",
      `${user.name} قام بتفعيل حسابه وهو ينتظر موافقتك`,
      "warning",
      { userId: user.id, email, name: user.name },
    );

    res.json({
      success: true,
      message: "تم تفعيل حسابك بنجاح. ينتظر موافقة المدير الآن.",
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في التحقق من الكود",
        error: error.message,
      });
  }
});

// POST - Resend OTP
app.post("/api/auth/resend-otp", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: "البريد الإلكتروني مطلوب" });
  }

  try {
    const [users] = await db.query(
      "SELECT id, name FROM users WHERE email = ? AND is_active = false",
      [email],
    );

    if (users.length === 0) {
      return res
        .status(404)
        .json({
          success: false,
          message: "المستخدم غير موجود أو تم تفعيله بالفعل",
        });
    }

    const user = users[0];
    const newOtp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await db.query(
      "UPDATE users SET otp_code = ?, otp_expires = ? WHERE id = ?",
      [newOtp, otpExpires, user.id],
    );

    await sendOTPEmail(email, user.name, newOtp);

    res.json({ success: true, message: "تم إعادة إرسال كود التفعيل" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في إعادة إرسال الكود",
        error: error.message,
      });
  }
});

// GET - Check approval status
app.get("/api/check-approval-status", async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: "البريد الإلكتروني مطلوب" });
  }

  try {
    const [users] = await db.query(
      "SELECT account_status, is_approved, is_active FROM users WHERE email = ?",
      [email],
    );

    if (users.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "المستخدم غير موجود" });
    }

    const user = users[0];

    res.json({
      success: true,
      status: user.account_status,
      approved: user.is_approved,
      active: user.is_active,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في التحقق من الحالة",
        error: error.message,
      });
  }
});

// GET - Pending accounts
app.get("/api/pending-accounts", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, email, name, role, phone, address, 
                    account_status, is_active, is_approved, created_at
             FROM users 
             ORDER BY created_at DESC`,
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error in /api/pending-accounts:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في جلب الحسابات",
        error: error.message,
      });
  }
});

// POST - Approve account
app.post("/api/approve-account", async (req, res) => {
  const { email, approved, adminName, reason } = req.body;

  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: "البريد الإلكتروني مطلوب" });
  }

  try {
    const [users] = await db.query(
      "SELECT id, name, email FROM users WHERE email = ?",
      [email],
    );

    if (users.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "المستخدم غير موجود" });
    }

    const user = users[0];

    const [admins] = await db.query(
      "SELECT id FROM users WHERE name = ? LIMIT 1",
      [adminName],
    );
    const adminId = admins.length > 0 ? admins[0].id : null;

    if (approved) {
      await db.query(
        `UPDATE users 
                 SET account_status = 'active', is_active = true, is_approved = true, 
                     approved_by = ?, approved_at = NOW() 
                 WHERE id = ?`,
        [adminId, user.id],
      );

      await db.query(
        'UPDATE registration_requests SET status = "approved", processed_by = ?, processed_at = NOW() WHERE email = ?',
        [adminName, email],
      );

      await addAuditLog(
        adminName,
        `وافق على تسجيل المستخدم: ${user.name} (${user.email})`,
        req,
      );
      await sendApprovalEmail(email, user.name, "approved");

      broadcastNotification(
        "✅ موافقة على تسجيل",
        `تمت الموافقة على تسجيل المستخدم ${user.name}`,
        "success",
        { userId: user.id, email, name: user.name },
      );

      res.json({ success: true, message: "تم قبول المستخدم بنجاح" });
    } else {
      await db.query(
        `UPDATE users SET account_status = 'rejected', is_active = false, is_approved = false WHERE id = ?`,
        [user.id],
      );

      await db.query(
        'UPDATE registration_requests SET status = "rejected", processed_by = ?, processed_at = NOW() WHERE email = ?',
        [adminName, email],
      );

      await addAuditLog(
        adminName,
        `رفض تسجيل المستخدم: ${user.name} (${user.email})`,
        req,
      );
      await sendApprovalEmail(email, user.name, "rejected");

      broadcastNotification(
        "❌ رفض تسجيل",
        `تم رفض تسجيل المستخدم ${user.name}`,
        "error",
        { email, name: user.name },
      );

      res.json({
        success: true,
        message: "تم رفض المستخدم وتحديث حالته إلى مرفوض",
      });
    }
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في معالجة الطلب",
        error: error.message,
      });
  }
});

// POST - Suspend account
app.post("/api/suspend-account", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: "البريد الإلكتروني مطلوب" });
  }

  try {
    const [users] = await db.query(
      "SELECT id, name FROM users WHERE email = ?",
      [email],
    );

    if (users.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "المستخدم غير موجود" });
    }

    await db.query(
      "UPDATE users SET account_status = ?, is_approved = ? WHERE email = ?",
      ["suspended", false, email],
    );

    await sendEmail(
      email,
      "إيقاف حساب مؤقت",
      `مرحباً ${users[0].name},\n\nتم إيقاف حسابك مؤقتاً من قبل الإدارة. للاستفسار يرجى التواصل معنا.`,
    );

    broadcastNotification(
      "⛔ تم إيقاف حساب",
      `تم إيقاف حساب ${users[0].name}`,
      "warning",
    );

    res.json({ success: true, message: "تم إيقاف الحساب بنجاح" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في إيقاف الحساب",
        error: error.message,
      });
  }
});

// POST - Login
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({
        success: false,
        message: "البريد الإلكتروني وكلمة المرور مطلوبين",
      });
  }

  try {
    const [users] = await db.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (users.length === 0) {
      return res
        .status(401)
        .json({
          success: false,
          message: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
        });
    }

    const user = users[0];

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res
        .status(401)
        .json({
          success: false,
          message: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
        });
    }

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message:
          "حسابك غير مفعل. يرجى التحقق من بريدك الإلكتروني وإدخال كود التفعيل",
        needsVerification: true,
      });
    }

    if (!user.is_approved && user.role !== "admin") {
      return res.status(401).json({
        success: false,
        message: "حسابك في انتظار موافقة المدير. سيتم إشعارك عند الموافقة",
        needsApproval: true,
      });
    }

    await addAuditLog(user.name, `تسجيل دخول`, req);

    res.json({
      success: true,
      message: "تم تسجيل الدخول بنجاح",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في تسجيل الدخول",
        error: error.message,
      });
  }
});

// GET - Users list
app.get("/api/auth/users", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, email, name, role, is_active, is_approved, created_at FROM users ORDER BY created_at DESC",
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في جلب المستخدمين",
        error: error.message,
      });
  }
});

// DELETE - Delete user
app.delete("/api/auth/users/:id", async (req, res) => {
  try {
    const [users] = await db.query(
      "SELECT name, email FROM users WHERE id = ?",
      [req.params.id],
    );
    if (users.length > 0) {
      await addAuditLog(
        "مدير النظام",
        `حذف المستخدم: ${users[0].name} (${users[0].email})`,
        req,
      );
      broadcastNotification(
        "🗑️ حذف مستخدم",
        `تم حذف المستخدم: ${users[0].name}`,
        "warning",
        {},
      );
    }
    await db.query("DELETE FROM users WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "تم حذف المستخدم بنجاح" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في حذف المستخدم",
        error: error.message,
      });
  }
});

// POST - Google Login
app.post("/api/auth/google", async (req, res) => {
  const { email, name, googleId } = req.body;

  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: "البريد الإلكتروني مطلوب" });
  }

  try {
    let [users] = await db.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (users.length === 0) {
      await db.query(
        `INSERT INTO users (email, name, googleId, role, is_active, is_approved) 
                 VALUES (?, ?, ?, ?, true, false)`,
        [email, name || email.split("@")[0], googleId, "cashier"],
      );

      await db.query(
        `INSERT INTO registration_requests (email, name, role, status) VALUES (?, ?, ?, 'pending')`,
        [email, name || email.split("@")[0], "cashier"],
      );

      broadcastNotification(
        "👤 تسجيل جديد عبر Google",
        `${name || email.split("@")[0]} (${email}) قام بالتسجيل عبر Google ويحتاج موافقتك`,
        "info",
        { email, name: name || email.split("@")[0] },
      );

      return res.json({
        success: false,
        message: "تم تسجيل حسابك. ينتظر موافقة المدير.",
        needsApproval: true,
      });
    }

    const user = users[0];

    if (!user.is_approved && user.role !== "admin") {
      return res.status(401).json({
        success: false,
        message: "حسابك في انتظار موافقة المدير",
        needsApproval: true,
      });
    }

    await addAuditLog(user.name, `تسجيل دخول عبر Google`, req);

    res.json({
      success: true,
      message: "تم تسجيل الدخول بنجاح",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في تسجيل الدخول بـ Google",
        error: error.message,
      });
  }
});

// ============================================================
// ========== 👤 API الصلاحيات (PERMISSIONS) ==========
// ============================================================

// POST - Save user permissions
app.post("/api/save-user-permissions", async (req, res) => {
  const { userId, userName, permissions, updatedBy } = req.body;

  if (!userId || !permissions) {
    return res
      .status(400)
      .json({ success: false, message: "البيانات غير مكتملة" });
  }

  try {
    await db.query("DELETE FROM user_permissions WHERE user_id = ?", [userId]);

    const permissionIds = Object.keys(permissions);
    let enabledCount = 0;

    for (const permId of permissionIds) {
      if (permissions[permId] === true) {
        await db.query(
          "INSERT INTO user_permissions (user_id, permission_id, enabled) VALUES (?, ?, ?)",
          [userId, permId, true],
        );
        enabledCount++;
      }
    }

    await addAuditLog(
      updatedBy || "نظام",
      `تحديث صلاحيات المستخدم: ${userName || userId} - ${enabledCount} صلاحية مفعلة`,
      req,
    );

    res.json({
      success: true,
      message: `تم حفظ ${enabledCount} صلاحية للمستخدم بنجاح`,
      data: { userId, enabledCount },
    });
  } catch (error) {
    console.error("Error saving user permissions:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في حفظ الصلاحيات",
        error: error.message,
      });
  }
});

// GET - Get user permissions
app.get("/api/user-permissions/:userId", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT permission_id, enabled FROM user_permissions WHERE user_id = ?",
      [req.params.userId],
    );

    const permissions = {};
    for (const row of rows) {
      permissions[row.permission_id] = row.enabled === 1;
    }

    res.json({ success: true, data: permissions });
  } catch (error) {
    console.error("Error fetching user permissions:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في جلب صلاحيات المستخدم",
        error: error.message,
      });
  }
});

// ============================================================
// ========== 📦 API المنتجات (PRODUCTS) ==========
// ============================================================

// GET - Products
app.get("/api/products", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM products ORDER BY id DESC");
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error in /api/products:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في جلب المنتجات",
        error: error.message,
      });
  }
});

// POST - Add product
app.post("/api/products", async (req, res) => {
  const code = req.body.code;
  const name = req.body.name;
  const category = req.body.category || "";
  const sellingPrice = req.body.sellingPrice || 0;
  const purchasePrice = req.body.purchasePrice || 0;
  const minStock = req.body.minStock || 5;
  const locationId = parseInt(req.body.locationId) || 1;

  if (!code || !name) {
    return res
      .status(400)
      .json({ success: false, message: "الكود واسم المنتج مطلوبين" });
  }

  try {
    const [existing] = await db.query(
      "SELECT id FROM products WHERE code = ?",
      [code],
    );
    if (existing.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: "الكود موجود مسبقاً" });
    }

    const productId = Date.now();

    await db.query(
      `INSERT INTO products (id, code, name, category, sellingPrice, purchasePrice, minStock) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [productId, code, name, category, sellingPrice, purchasePrice, minStock],
    );

    const [existingStock] = await db.query(
      "SELECT * FROM stock WHERE productId = ? AND locationId = ?",
      [productId, locationId],
    );

    if (existingStock.length === 0) {
      await db.query(
        "INSERT INTO stock (productId, quantity, locationId) VALUES (?, 0, ?)",
        [productId, locationId],
      );
    }

    broadcastNotification(
      "📦 منتج جديد",
      `تم إضافة منتج جديد: ${name} (${code})`,
      "info",
      { productId, code, name },
    );

    res.json({
      success: true,
      message: "تم إضافة المنتج بنجاح",
      data: { id: productId },
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في إضافة المنتج",
        error: error.message,
      });
  }
});

// PUT - Edit product
app.put("/api/products/:id", async (req, res) => {
  const { code, name, category, purchasePrice, sellingPrice, minStock } =
    req.body;

  if (!code || !name) {
    return res
      .status(400)
      .json({ success: false, message: "الكود واسم المنتج مطلوبين" });
  }

  try {
    const [existing] = await db.query(
      "SELECT id FROM products WHERE code = ? AND id != ?",
      [code, req.params.id],
    );
    if (existing.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: "الكود موجود مسبقاً" });
    }

    await db.query(
      `UPDATE products SET 
                code = ?, name = ?, category = ?, 
                purchasePrice = ?, sellingPrice = ?, minStock = ? 
             WHERE id = ?`,
      [
        code,
        name,
        category,
        purchasePrice,
        sellingPrice,
        minStock,
        req.params.id,
      ],
    );

    await addAuditLog("نظام", `تعديل منتج: ${name} (${code})`, req);

    res.json({ success: true, message: "تم تعديل المنتج بنجاح" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في تعديل المنتج",
        error: error.message,
      });
  }
});

// DELETE - Delete product
app.delete("/api/products/:id", async (req, res) => {
  try {
    const [product] = await db.query(
      "SELECT name, code FROM products WHERE id = ?",
      [req.params.id],
    );

    await db.query("DELETE FROM stock WHERE productId = ?", [req.params.id]);
    await db.query("DELETE FROM products WHERE id = ?", [req.params.id]);

    if (product.length > 0) {
      broadcastNotification(
        "🗑️ حذف منتج",
        `تم حذف المنتج: ${product[0].name} (${product[0].code})`,
        "warning",
        { productId: req.params.id },
      );
    }

    res.json({ success: true, message: "تم حذف المنتج بنجاح" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في حذف المنتج",
        error: error.message,
      });
  }
});

// ============================================================
// ========== 📦 API المخزون (STOCK) ==========
// ============================================================

// GET - Stock
app.get("/api/stock", async (req, res) => {
  try {
    const [rows] = await db.query(`
            SELECT s.*, p.name as productName, p.code, p.sellingPrice 
            FROM stock s 
            JOIN products p ON s.productId = p.id
        `);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error in /api/stock:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في جلب المخزون",
        error: error.message,
      });
  }
});

// POST - Update stock
app.post("/api/stock/update", async (req, res) => {
  const { productId, quantity, operation, locationId } = req.body;

  if (!productId || quantity === undefined || !operation) {
    return res
      .status(400)
      .json({ success: false, message: "بيانات غير مكتملة" });
  }

  try {
    const locId = locationId || 1;

    const [existing] = await db.query(
      "SELECT * FROM stock WHERE productId = ? AND locationId = ?",
      [productId, locId],
    );

    if (operation === "add") {
      if (existing.length === 0) {
        await db.query(
          "INSERT INTO stock (productId, quantity, locationId) VALUES (?, ?, ?)",
          [productId, quantity, locId],
        );
      } else {
        await db.query(
          "UPDATE stock SET quantity = quantity + ? WHERE productId = ? AND locationId = ?",
          [quantity, productId, locId],
        );
      }
    } else if (operation === "subtract") {
      if (existing.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "المنتج غير موجود في المخزون" });
      }
      if (existing[0].quantity < quantity) {
        return res
          .status(400)
          .json({ success: false, message: "الكمية غير متوفرة في المخزون" });
      }
      await db.query(
        "UPDATE stock SET quantity = quantity - ? WHERE productId = ? AND locationId = ?",
        [quantity, productId, locId],
      );
    } else {
      return res
        .status(400)
        .json({ success: false, message: "عملية غير معروفة" });
    }

    await addAuditLog(
      "نظام",
      `تحديث مخزون المنتج ${productId} - ${operation} ${quantity}`,
      req,
    );

    res.json({ success: true, message: "تم تحديث المخزون بنجاح" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في تحديث المخزون",
        error: error.message,
      });
  }
});

// ============================================================
// ========== 🔄 API التحويلات الداخلية (TRANSFERS) ==========
// ============================================================

// GET - جلب جميع التحويلات
app.get("/api/stock/transfers", async (req, res) => {
  try {
    const [rows] = await db.query(`
            SELECT 
                t.*,
                fl.name as fromLocationName,
                tl.name as toLocationName
            FROM stock_transfers t
            LEFT JOIN locations fl ON t.fromLocationId = fl.id
            LEFT JOIN locations tl ON t.toLocationId = tl.id
            ORDER BY t.created_at DESC
        `);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error in /api/stock/transfers:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في جلب التحويلات",
        error: error.message,
      });
  }
});

// GET - جلب تحويل معين + عناصره
app.get("/api/stock/transfers/:id", async (req, res) => {
  try {
    const [rows] = await db.query(
      `
            SELECT 
                t.*,
                fl.name as fromLocationName,
                tl.name as toLocationName
            FROM stock_transfers t
            LEFT JOIN locations fl ON t.fromLocationId = fl.id
            LEFT JOIN locations tl ON t.toLocationId = tl.id
            WHERE t.id = ?
        `,
      [req.params.id],
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "التحويل غير موجود" });
    }

    // جلب عناصر التحويل
    const [items] = await db.query(
      "SELECT * FROM stock_transfer_items WHERE transferId = ?",
      [req.params.id],
    );

    res.json({
      success: true,
      data: {
        ...rows[0],
        items: items,
      },
    });
  } catch (error) {
    console.error("Error in /api/stock/transfers/:id:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في جلب تفاصيل التحويل",
        error: error.message,
      });
  }
});

// POST - إنشاء تحويل جديد
app.post("/api/stock/transfer", async (req, res) => {
  const { fromLocationId, toLocationId, items, notes, createdBy } = req.body;

  console.log("📝 استقبال طلب تحويل:", {
    fromLocationId,
    toLocationId,
    itemsCount: items?.length,
  });

  if (!fromLocationId || !toLocationId || !items || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: "بيانات غير مكتملة: fromLocationId, toLocationId, items مطلوبين",
    });
  }

  if (fromLocationId === toLocationId) {
    return res.status(400).json({
      success: false,
      message: "لا يمكن التحويل لنفس المخزن",
    });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // حساب القيمة الإجمالية
    let totalValue = 0;
    for (const item of items) {
      totalValue += (item.quantity || 0) * (item.price || 0);
    }

    // إنشاء رقم تحويل
    const transferId = Date.now();
    const transferNumber = "TRF-" + String(transferId).slice(-8);
    const date = new Date().toISOString().slice(0, 10);

    console.log("📝 إنشاء تحويل:", { transferId, transferNumber, totalValue });

    // إدراج التحويل
    await connection.query(
      `
            INSERT INTO stock_transfers 
            (id, transferNumber, fromLocationId, toLocationId, date, totalValue, notes, createdBy) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
      [
        transferId,
        transferNumber,
        fromLocationId,
        toLocationId,
        date,
        totalValue,
        notes || "",
        createdBy || "نظام",
      ],
    );

    // إدراج عناصر التحويل وتحديث المخزون
    for (const item of items) {
      const productId = item.productId;
      const quantity = item.quantity || 0;
      const price = item.price || 0;
      const productName = item.productName || "غير معروف";
      const itemTotal = quantity * price;

      console.log(
        `📦 منتج: ${productName}, الكمية: ${quantity}, السعر: ${price}`,
      );

      // إدراج عنصر التحويل
      await connection.query(
        `
                INSERT INTO stock_transfer_items 
                (transferId, productId, productName, quantity, price, total) 
                VALUES (?, ?, ?, ?, ?, ?)
            `,
        [transferId, productId, productName, quantity, price, itemTotal],
      );

      // خصم الكمية من المخزن المصدر
      const [sourceStock] = await connection.query(
        "SELECT * FROM stock WHERE productId = ? AND locationId = ?",
        [productId, fromLocationId],
      );

      if (sourceStock.length === 0) {
        throw new Error(`المنتج ${productName} غير موجود في المخزن المصدر`);
      }

      if (sourceStock[0].quantity < quantity) {
        throw new Error(
          `الكمية غير متوفرة للمنتج ${productName} في المخزن المصدر. المتاح: ${sourceStock[0].quantity}, المطلوب: ${quantity}`,
        );
      }

      await connection.query(
        "UPDATE stock SET quantity = quantity - ? WHERE productId = ? AND locationId = ?",
        [quantity, productId, fromLocationId],
      );

      // إضافة الكمية إلى المخزن المستلم
      const [targetStock] = await connection.query(
        "SELECT * FROM stock WHERE productId = ? AND locationId = ?",
        [productId, toLocationId],
      );

      if (targetStock.length === 0) {
        await connection.query(
          "INSERT INTO stock (productId, quantity, locationId) VALUES (?, ?, ?)",
          [productId, quantity, toLocationId],
        );
      } else {
        await connection.query(
          "UPDATE stock SET quantity = quantity + ? WHERE productId = ? AND locationId = ?",
          [quantity, productId, toLocationId],
        );
      }
    }

    await connection.commit();
    connection.release();

    // تسجيل النشاط
    await addAuditLog(
      createdBy || "نظام",
      `تحويل مخزون: ${transferNumber}`,
      req,
    );

    // إشعار فوري
    broadcastNotification(
      "🔄 تحويل مخزون جديد",
      `تم تحويل منتجات من مخزن إلى آخر - رقم: ${transferNumber}`,
      "success",
      { transferId, transferNumber },
    );

    res.json({
      success: true,
      message: "تم تحويل المخزون بنجاح",
      data: { id: transferId, transferNumber },
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("خطأ في التراجع:", rollbackError);
      }
      connection.release();
    }
    console.error("❌ Error in /api/stock/transfer:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في تحويل المخزون: " + error.message,
      error: error.message,
    });
  }
});

// DELETE - حذف تحويل
app.delete("/api/stock/transfers/:id", async (req, res) => {
  try {
    const [transfer] = await db.query(
      "SELECT transferNumber FROM stock_transfers WHERE id = ?",
      [req.params.id],
    );

    if (transfer.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "التحويل غير موجود" });
    }

    // حذف عناصر التحويل
    await db.query("DELETE FROM stock_transfer_items WHERE transferId = ?", [
      req.params.id,
    ]);
    await db.query("DELETE FROM stock_transfers WHERE id = ?", [req.params.id]);

    await addAuditLog(
      "نظام",
      `حذف تحويل مخزون: ${transfer[0].transferNumber}`,
      req,
    );

    broadcastNotification(
      "🗑️ حذف تحويل",
      `تم حذف التحويل: ${transfer[0].transferNumber}`,
      "warning",
    );

    res.json({ success: true, message: "تم حذف التحويل بنجاح" });
  } catch (error) {
    console.error("Error deleting transfer:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في حذف التحويل",
        error: error.message,
      });
  }
});

// ============================================================
// ========== 📍 API الأماكن (LOCATIONS) ==========
// ============================================================

// GET - Locations
app.get("/api/locations", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM locations ORDER BY id DESC");
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error in /api/locations:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في جلب الأماكن",
        error: error.message,
      });
  }
});

// POST - Add location
app.post("/api/locations", async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res
      .status(400)
      .json({ success: false, message: "اسم المكان مطلوب" });
  }

  try {
    const [result] = await db.query(`INSERT INTO locations (name) VALUES (?)`, [
      name,
    ]);
    res.json({
      success: true,
      message: "تم إضافة المكان بنجاح",
      data: { id: result.insertId },
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في إضافة المكان",
        error: error.message,
      });
  }
});

// PUT - Update location
app.put("/api/locations/:id", async (req, res) => {
  const { name } = req.body;
  const id = req.params.id;

  if (!name) {
    return res
      .status(400)
      .json({ success: false, message: "اسم المكان مطلوب" });
  }

  try {
    await db.query("UPDATE locations SET name = ? WHERE id = ?", [name, id]);
    res.json({ success: true, message: "تم تحديث المكان بنجاح" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في تحديث المكان",
        error: error.message,
      });
  }
});

// DELETE - Delete location
app.delete("/api/locations/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM locations WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "تم حذف المكان بنجاح" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في حذف المكان",
        error: error.message,
      });
  }
});

// ============================================================
// ========== 👥 API العملاء (CUSTOMERS) ==========
// ============================================================

// GET - Customers
app.get("/api/customers", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM customers ORDER BY id DESC");
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error in /api/customers:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في جلب العملاء",
        error: error.message,
      });
  }
});

// GET - Customer by ID
app.get("/api/customers/:id", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM customers WHERE id = ?", [
      req.params.id,
    ]);

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "العميل غير موجود" });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("Error in /api/customers/:id:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في جلب بيانات العميل",
        error: error.message,
      });
  }
});

// POST - Add customer
app.post("/api/customers", async (req, res) => {
  const { name, phone, address, balance } = req.body;

  if (!name) {
    return res
      .status(400)
      .json({ success: false, message: "اسم العميل مطلوب" });
  }

  try {
    const id = Date.now();
    await db.query(
      `INSERT INTO customers (id, name, phone, address, balance) VALUES (?, ?, ?, ?, ?)`,
      [id, name, phone || "", address || "", balance || 0],
    );

    res.json({ success: true, message: "تم إضافة العميل بنجاح", data: { id } });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في إضافة العميل",
        error: error.message,
      });
  }
});

// PUT - Edit customer
app.put("/api/customers/:id", async (req, res) => {
  const { name, phone, address, balance } = req.body;

  if (!name) {
    return res
      .status(400)
      .json({ success: false, message: "اسم العميل مطلوب" });
  }

  try {
    await db.query(
      `UPDATE customers SET name = ?, phone = ?, address = ?, balance = ? WHERE id = ?`,
      [name, phone || "", address || "", balance || 0, req.params.id],
    );

    await addAuditLog("نظام", `تعديل عميل: ${name}`, req);

    res.json({ success: true, message: "تم تعديل العميل بنجاح" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في تعديل العميل",
        error: error.message,
      });
  }
});

// DELETE - Delete customer
app.delete("/api/customers/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM customers WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "تم حذف العميل بنجاح" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في حذف العميل",
        error: error.message,
      });
  }
});

// POST - Import customers
app.post("/api/customers/import", async (req, res) => {
  const { customers } = req.body;

  if (!customers || !Array.isArray(customers) || customers.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "لا توجد بيانات للاستيراد" });
  }

  try {
    await db.query("START TRANSACTION");

    let imported = 0;
    let skipped = 0;

    for (const customer of customers) {
      const { name, phone, address, balance, debts, payments } = customer;

      if (!name) {
        skipped++;
        continue;
      }

      const customerId = Date.now() + imported;
      await db.query(
        `INSERT INTO customers (id, name, phone, address, balance, totalPurchases) 
                 VALUES (?, ?, ?, ?, ?, 0)`,
        [customerId, name, phone || "", address || "", balance || 0],
      );

      if (debts && Array.isArray(debts)) {
        for (let i = 0; i < debts.length; i++) {
          const debt = debts[i];
          if (debt.amount && debt.amount > 0) {
            const debtId = Date.now() + imported + i + 1000;
            await db.query(
              `INSERT INTO customer_debts (id, customerId, amount, description, date, remaining) 
                             VALUES (?, ?, ?, ?, ?, ?)`,
              [
                debtId,
                customerId,
                debt.amount,
                debt.description || "",
                debt.date || new Date().toISOString().slice(0, 10),
                debt.amount,
              ],
            );
          }
        }
      }

      if (payments && Array.isArray(payments)) {
        for (let i = 0; i < payments.length; i++) {
          const payment = payments[i];
          if (payment.amount && payment.amount > 0) {
            const paymentId = Date.now() + imported + i + 5000;
            await db.query(
              `INSERT INTO customer_payments (id, customerId, debtId, amount, paymentDate, notes) 
                             VALUES (?, ?, NULL, ?, ?, ?)`,
              [
                paymentId,
                customerId,
                payment.amount,
                payment.date || new Date().toISOString().slice(0, 10),
                payment.notes || "",
              ],
            );
          }
        }
      }

      imported++;
    }

    await db.query("COMMIT");

    res.json({
      success: true,
      message: `تم استيراد ${imported} عميل بنجاح${skipped > 0 ? ` (تم تخطي ${skipped})` : ""}`,
      data: { imported, skipped },
    });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في استيراد العملاء",
        error: error.message,
      });
  }
});

// ============================================================
// ========== 💰 API المديونيات والدفعات ==========
// ============================================================

// GET - Customer debts
app.get("/api/customers/:customerId/debts", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM customer_debts WHERE customerId = ? ORDER BY date DESC",
      [req.params.customerId],
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error in /api/customers/:customerId/debts:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في جلب المديونيات",
        error: error.message,
      });
  }
});

// GET - All customer debts (by name)
app.get("/api/customer-debts-all", async (req, res) => {
  try {
    const [rows] = await db.query(`
            SELECT cd.*, c.name as customerName 
            FROM customer_debts cd
            LEFT JOIN customers c ON cd.customerId = c.id
            ORDER BY cd.date DESC
        `);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error in /api/customer-debts-all:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في جلب كل المديونيات",
        error: error.message,
      });
  }
});

// POST - Add debt
app.post("/api/customers/:customerId/debts", async (req, res) => {
  const { amount, description, date } = req.body;
  const customerId = req.params.customerId;

  if (!amount || amount <= 0) {
    return res
      .status(400)
      .json({
        success: false,
        message: "المبلغ مطلوب ويجب أن يكون أكبر من صفر",
      });
  }

  try {
    const id = Date.now();
    await db.query(
      `INSERT INTO customer_debts (id, customerId, amount, description, date, remaining) 
             VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        customerId,
        amount,
        description || "",
        date || new Date().toISOString().slice(0, 10),
        amount,
      ],
    );

    await db.query("UPDATE customers SET balance = balance + ? WHERE id = ?", [
      amount,
      customerId,
    ]);

    res.json({
      success: true,
      message: "تم إضافة المديونية بنجاح",
      data: { id },
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في إضافة المديونية",
        error: error.message,
      });
  }
});

// GET - Customer payments
app.get("/api/customers/:customerId/payments", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM customer_payments WHERE customerId = ? ORDER BY paymentDate DESC`,
      [req.params.customerId],
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error in /api/customers/:customerId/payments:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في جلب الدفعات",
        error: error.message,
      });
  }
});

// GET - All customer payments
app.get("/api/customer-payments", async (req, res) => {
  try {
    const [rows] = await db.query(`
            SELECT 
                cp.id,
                cp.customerId,
                cp.debtId,
                cp.amount,
                cp.paymentDate,
                cp.notes,
                cp.created_at,
                c.name as customerName,
                c.phone as customerPhone
            FROM customer_payments cp
            LEFT JOIN customers c ON cp.customerId = c.id
            ORDER BY cp.paymentDate DESC, cp.created_at DESC
        `);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error in /api/customer-payments:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في جلب مدفوعات العملاء",
        error: error.message,
      });
  }
});

// POST - تسجيل دفعة عميل
app.post("/api/customer-payments", async (req, res) => {
  console.log("📝 ====== استقبال طلب تسجيل دفعة ======");
  console.log("📝 البيانات المستلمة:", JSON.stringify(req.body, null, 2));

  const { customerId, amount, paymentDate, notes } = req.body;

  let connection;
  try {
    connection = await db.getConnection();
    console.log("✅ تم الحصول على اتصال بقاعدة البيانات");

    await connection.beginTransaction();

    const [customers] = await connection.query(
      "SELECT id, name, balance FROM customers WHERE id = ?",
      [customerId],
    );

    if (customers.length === 0) {
      await connection.rollback();
      connection.release();
      return res
        .status(404)
        .json({ success: false, message: "العميل غير موجود" });
    }

    const customer = customers[0];
    console.log(
      `👤 العميل: ${customer.name}, الرصيد الحالي: ${customer.balance}`,
    );

    const paymentId = Date.now();
    const finalDate = paymentDate || new Date().toISOString().slice(0, 10);
    const finalNotes = notes || "دفعة جديدة";

    const [insertResult] = await connection.query(
      `INSERT INTO customer_payments 
             (id, customerId, debtId, amount, paymentDate, notes, created_at) 
             VALUES (?, ?, NULL, ?, ?, ?, NOW())`,
      [paymentId, customerId, amount, finalDate, finalNotes],
    );

    console.log(
      `✅ تم إدراج الدفعة، affectedRows: ${insertResult.affectedRows}`,
    );

    const [updateResult] = await connection.query(
      "UPDATE customers SET balance = balance - ? WHERE id = ?",
      [amount, customerId],
    );

    console.log(
      `✅ تم تحديث رصيد العميل، affectedRows: ${updateResult.affectedRows}`,
    );

    const [newBalanceResult] = await connection.query(
      "SELECT balance FROM customers WHERE id = ?",
      [customerId],
    );
    const newBalance = newBalanceResult[0]?.balance || 0;
    console.log(`💰 الرصيد الجديد للعميل: ${newBalance}`);

    await connection.commit();
    console.log("✅ تم تأكيد المعاملة");

    connection.release();

    res.json({
      success: true,
      message: "تم تسجيل الدفعة بنجاح",
      data: {
        paymentId: paymentId,
        customerId: customerId,
        customerName: customer.name,
        amount: amount,
        newBalance: newBalance,
        oldBalance: customer.balance,
      },
    });
  } catch (error) {
    console.error("❌ خطأ في تسجيل الدفعة:", error);
    console.error("❌ تفاصيل:", error.stack);

    if (connection) {
      try {
        await connection.rollback();
        console.log("↩️ تم التراجع عن المعاملة");
      } catch (rollbackError) {
        console.error("❌ خطأ في التراجع:", rollbackError);
      }
      connection.release();
    }

    res.status(500).json({
      success: false,
      message: "خطأ في تسجيل الدفعة: " + error.message,
    });
  }
});

// ============================================================
// ========== 🚚 API الموردين (SUPPLIERS) ==========
// ============================================================

// GET - Suppliers
app.get("/api/suppliers", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM suppliers ORDER BY id DESC");
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في جلب الموردين",
        error: error.message,
      });
  }
});

// POST - Add supplier
app.post("/api/suppliers", async (req, res) => {
  const { name, phone, address, balance } = req.body;

  if (!name) {
    return res
      .status(400)
      .json({ success: false, message: "اسم المورد مطلوب" });
  }

  try {
    const id = Date.now();
    await db.query(
      `INSERT INTO suppliers (id, name, phone, address, balance) VALUES (?, ?, ?, ?, ?)`,
      [id, name, phone || "", address || "", balance || 0],
    );

    res.json({ success: true, message: "تم إضافة المورد بنجاح", data: { id } });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في إضافة المورد",
        error: error.message,
      });
  }
});

// PUT - Edit supplier
app.put("/api/suppliers/:id", async (req, res) => {
  const { name, phone, address, balance } = req.body;

  if (!name) {
    return res
      .status(400)
      .json({ success: false, message: "اسم المورد مطلوب" });
  }

  try {
    await db.query(
      `UPDATE suppliers SET name = ?, phone = ?, address = ?, balance = ? WHERE id = ?`,
      [name, phone || "", address || "", balance || 0, req.params.id],
    );

    await addAuditLog("نظام", `تعديل مورد: ${name}`, req);

    res.json({ success: true, message: "تم تعديل المورد بنجاح" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في تعديل المورد",
        error: error.message,
      });
  }
});

// DELETE - Delete supplier
app.delete("/api/suppliers/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM suppliers WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "تم حذف المورد بنجاح" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في حذف المورد",
        error: error.message,
      });
  }
});

// POST - Import suppliers
app.post("/api/suppliers/import", async (req, res) => {
  const { suppliers } = req.body;

  if (!suppliers || !Array.isArray(suppliers) || suppliers.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "لا توجد بيانات للاستيراد" });
  }

  try {
    await db.query("START TRANSACTION");

    let imported = 0;
    let skipped = 0;

    for (const supplier of suppliers) {
      const { name, phone, address, balance } = supplier;

      if (!name) {
        skipped++;
        continue;
      }

      const id = Date.now() + imported;
      await db.query(
        `INSERT INTO suppliers (id, name, phone, address, balance) VALUES (?, ?, ?, ?, ?)`,
        [id, name, phone || "", address || "", balance || 0],
      );

      imported++;
    }

    await db.query("COMMIT");

    await addAuditLog("نظام", `استيراد ${imported} مورد من Excel`, req);

    res.json({
      success: true,
      message: `تم استيراد ${imported} مورد بنجاح${skipped > 0 ? ` (تم تخطي ${skipped})` : ""}`,
      data: { imported, skipped },
    });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("Error importing suppliers:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في استيراد الموردين",
        error: error.message,
      });
  }
});

// ============================================================
// ========== 🧾 API فواتير البيع (SALES) ==========
// ============================================================

// GET - Sales invoices
app.get("/api/sales", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM sale_invoices ORDER BY date DESC, id DESC",
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في جلب الفواتير",
        error: error.message,
      });
  }
});

// GET - Sale invoice by ID or Number
app.get("/api/sales/:id", async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const [invoice] = await db.query(
      "SELECT * FROM sale_invoices WHERE id = ? OR invoiceNumber = ?",
      [invoiceId, invoiceId],
    );

    if (invoice.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "الفاتورة غير موجودة" });
    }

    const [items] = await db.query(
      "SELECT * FROM sale_invoice_items WHERE invoiceId = ?",
      [invoice[0].id],
    );

    res.json({
      success: true,
      data: {
        ...invoice[0],
        items: items,
      },
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في جلب تفاصيل الفاتورة",
        error: error.message,
      });
  }
});

// POST - Add sale invoice
app.post("/api/sales", async (req, res) => {
  const {
    invoiceNumber,
    date,
    customer,
    seller,
    items,
    subtotal,
    wholesaleDiscount,
    extraDiscount,
    total,
    paid,
    paymentMethod,
    transactionNumber,
    deliveryMethod,
    deliveryAddress,
    isDeferred,
    downPayment,
    notes,
  } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: "الفاتورة فارغة" });
  }

  try {
    const invoiceId = Date.now();
    const finalInvoiceNumber =
      invoiceNumber || `INV-${invoiceId.toString().slice(-8)}`;

    await db.query("START TRANSACTION");

    await db.query(
      `INSERT INTO sale_invoices (
                id, invoiceNumber, date, time, customer, seller, 
                subtotal, wholesaleDiscount, extraDiscount, total, 
                paid, \`change\`, paymentMethod, transactionNumber, 
                deliveryMethod, deliveryAddress, createdBy,
                is_deferred, down_payment, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceId,
        finalInvoiceNumber,
        date || new Date().toISOString().slice(0, 10),
        new Date().toLocaleTimeString("ar-EG"),
        customer || "عميل نقدي",
        seller || "system",
        subtotal || 0,
        wholesaleDiscount || 0,
        extraDiscount || 0,
        total || 0,
        paid || 0,
        (paid || 0) - (total || 0),
        paymentMethod || "cash",
        transactionNumber || "",
        deliveryMethod || "pickup",
        deliveryAddress || "",
        "system",
        isDeferred || false,
        downPayment || 0,
        notes || "",
      ],
    );

    for (const item of items) {
      await db.query(
        `INSERT INTO sale_invoice_items (invoiceId, productId, productName, quantity, price, originalPrice) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
        [
          invoiceId,
          item.productId,
          item.productName,
          item.quantity,
          item.price,
          item.originalPrice || item.price,
        ],
      );

      await db.query(
        "UPDATE stock SET quantity = quantity - ? WHERE productId = ? ORDER BY locationId LIMIT 1",
        [item.quantity, item.productId],
      );
    }

    // معالجة المديونية في حالة الآجل
    if (isDeferred) {
      let [customerData] = await db.query(
        "SELECT id FROM customers WHERE name = ?",
        [customer],
      );
      let customerId;

      if (customerData.length === 0) {
        const newId = Date.now();
        await db.query(
          `INSERT INTO customers (id, name, balance, totalPurchases) VALUES (?, ?, ?, ?)`,
          [newId, customer, 0, 0],
        );
        customerId = newId;
      } else {
        customerId = customerData[0].id;
      }

      const remainingDebt = total - (paid || 0);

      if (remainingDebt > 0) {
        const debtId = Date.now();
        await db.query(
          `INSERT INTO customer_debts (id, customerId, amount, description, date, remaining) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
          [
            debtId,
            customerId,
            remainingDebt,
            `فاتورة ${finalInvoiceNumber}`,
            date || new Date().toISOString().slice(0, 10),
            remainingDebt,
          ],
        );

        await db.query(
          "UPDATE customers SET balance = balance + ? WHERE id = ?",
          [remainingDebt, customerId],
        );

        if (downPayment && downPayment > 0) {
          await db.query(
            `INSERT INTO customer_payments (id, customerId, debtId, amount, paymentDate, notes) 
                         VALUES (?, ?, ?, ?, ?, ?)`,
            [
              Date.now() + 1,
              customerId,
              debtId,
              downPayment,
              date || new Date().toISOString().slice(0, 10),
              "دفعة مقدمة - " + finalInvoiceNumber,
            ],
          );

          await db.query(
            "UPDATE customer_debts SET remaining = remaining - ? WHERE id = ?",
            [downPayment, debtId],
          );
        }
      }
    }

    await db.query("COMMIT");

    await addAuditLog(
      seller || "system",
      `إضافة فاتورة بيع رقم ${finalInvoiceNumber}`,
      req,
    );

    res.json({
      success: true,
      message: "تم إضافة الفاتورة بنجاح",
      data: { id: invoiceId, invoiceNumber: finalInvoiceNumber },
    });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في إضافة الفاتورة",
        error: error.message,
      });
  }
});

// DELETE - Delete sale invoice
app.delete("/api/sales/:id", async (req, res) => {
  try {
    const [invoice] = await db.query(
      "SELECT invoiceNumber FROM sale_invoices WHERE id = ?",
      [req.params.id],
    );

    if (invoice.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "الفاتورة غير موجودة" });
    }

    await db.query("DELETE FROM sale_invoice_items WHERE invoiceId = ?", [
      req.params.id,
    ]);
    await db.query("DELETE FROM sale_invoices WHERE id = ?", [req.params.id]);

    await addAuditLog(
      "نظام",
      `حذف فاتورة بيع رقم: ${invoice[0].invoiceNumber}`,
      req,
    );

    broadcastNotification(
      "🗑️ حذف فاتورة",
      `تم حذف فاتورة البيع رقم: ${invoice[0].invoiceNumber}`,
      "warning",
    );

    res.json({ success: true, message: "تم حذف الفاتورة بنجاح" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في حذف الفاتورة",
        error: error.message,
      });
  }
});

// ============================================================
// ========== 🧾 API فواتير الشراء (PURCHASES) ==========
// ============================================================

// GET - Purchase invoices
app.get("/api/purchases", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM purchase_invoices ORDER BY date DESC, id DESC",
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في جلب فواتير الشراء",
        error: error.message,
      });
  }
});

// GET - Purchase invoice by ID or Number
app.get("/api/purchases/:id", async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const [invoice] = await db.query(
      "SELECT * FROM purchase_invoices WHERE id = ? OR invoiceNumber = ?",
      [invoiceId, invoiceId],
    );

    if (invoice.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "الفاتورة غير موجودة" });
    }

    const [items] = await db.query(
      "SELECT * FROM purchase_invoice_items WHERE invoiceId = ?",
      [invoice[0].id],
    );

    res.json({
      success: true,
      data: {
        ...invoice[0],
        items: items,
      },
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في جلب تفاصيل الفاتورة",
        error: error.message,
      });
  }
});

// POST - Add purchase invoice
app.post("/api/purchases", async (req, res) => {
  const { invoiceNumber, date, supplier, items, total, createdBy } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: "الفاتورة فارغة" });
  }

  if (!supplier) {
    return res
      .status(400)
      .json({ success: false, message: "اسم المورد مطلوب" });
  }

  try {
    const invoiceId = Date.now();
    const finalInvoiceNumber =
      invoiceNumber || `PUR-${invoiceId.toString().slice(-8)}`;

    await db.query("START TRANSACTION");

    await db.query(
      `INSERT INTO purchase_invoices (id, invoiceNumber, date, supplier, total, createdBy) 
             VALUES (?, ?, ?, ?, ?, ?)`,
      [
        invoiceId,
        finalInvoiceNumber,
        date || new Date().toISOString().slice(0, 10),
        supplier,
        total || 0,
        createdBy || "system",
      ],
    );

    for (const item of items) {
      const locationId = item.locationId || 1;

      await db.query(
        `INSERT INTO purchase_invoice_items (invoiceId, productId, productName, quantity, price, locationId) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
        [
          invoiceId,
          item.productId,
          item.productName,
          item.quantity,
          item.price,
          locationId,
        ],
      );

      const [existing] = await db.query(
        "SELECT * FROM stock WHERE productId = ? AND locationId = ?",
        [item.productId, locationId],
      );
      if (existing.length === 0) {
        await db.query(
          "INSERT INTO stock (productId, quantity, locationId) VALUES (?, ?, ?)",
          [item.productId, item.quantity, locationId],
        );
      } else {
        await db.query(
          "UPDATE stock SET quantity = quantity + ? WHERE productId = ? AND locationId = ?",
          [item.quantity, item.productId, locationId],
        );
      }
    }

    await db.query("COMMIT");

    await addAuditLog(
      createdBy || "system",
      `إضافة فاتورة شراء رقم ${finalInvoiceNumber}`,
      req,
    );

    res.json({
      success: true,
      message: "تم إضافة فاتورة الشراء بنجاح",
      data: { id: invoiceId, invoiceNumber: finalInvoiceNumber },
    });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في إضافة فاتورة الشراء",
        error: error.message,
      });
  }
});

// DELETE - Delete purchase invoice
app.delete("/api/purchases/:id", async (req, res) => {
  try {
    const [invoice] = await db.query(
      "SELECT invoiceNumber FROM purchase_invoices WHERE id = ?",
      [req.params.id],
    );

    if (invoice.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "الفاتورة غير موجودة" });
    }

    await db.query("DELETE FROM purchase_invoice_items WHERE invoiceId = ?", [
      req.params.id,
    ]);
    await db.query("DELETE FROM purchase_invoices WHERE id = ?", [
      req.params.id,
    ]);

    await addAuditLog(
      "نظام",
      `حذف فاتورة شراء رقم: ${invoice[0].invoiceNumber}`,
      req,
    );

    broadcastNotification(
      "🗑️ حذف فاتورة شراء",
      `تم حذف فاتورة الشراء رقم: ${invoice[0].invoiceNumber}`,
      "warning",
    );

    res.json({ success: true, message: "تم حذف الفاتورة بنجاح" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في حذف الفاتورة",
        error: error.message,
      });
  }
});

// ============================================================
// ========== 🔄 API المرتجعات (RETURNS) ==========
// ============================================================

// GET - Returns
app.get("/api/returns", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM returns ORDER BY date DESC, id DESC",
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error in /api/returns:", error);
    res.json({ success: true, data: [] });
  }
});

// POST - Add return
app.post("/api/returns", async (req, res) => {
  const {
    returnNumber,
    date,
    type,
    invoiceNumber,
    party,
    items,
    total,
    reason,
    createdBy,
  } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: "المرتجع فارغ" });
  }

  try {
    const returnId = Date.now();

    await db.query(
      `INSERT INTO returns (id, returnNumber, date, type, invoiceNumber, party, total, reason, createdBy) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        returnId,
        returnNumber,
        date,
        type,
        invoiceNumber,
        party,
        total,
        reason,
        createdBy || "نظام",
      ],
    );

    for (const item of items) {
      await db.query(
        `INSERT INTO return_items (returnId, productId, productName, quantity, price, total) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
        [
          returnId,
          item.productId,
          item.productName,
          item.quantity,
          item.price,
          item.total || item.quantity * item.price,
        ],
      );
    }

    await addAuditLog(
      createdBy || "نظام",
      `تسجيل مرتجع ${type === "sale" ? "مبيعات" : "مشتريات"} رقم ${returnNumber}`,
      req,
    );

    res.json({
      success: true,
      message: "تم إضافة المرتجع بنجاح",
      data: { id: returnId, returnNumber },
    });
  } catch (error) {
    console.error("Error adding return:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في إضافة المرتجع",
        error: error.message,
      });
  }
});

// DELETE - Delete return
app.delete("/api/returns/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM returns WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "تم حذف المرتجع بنجاح" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في حذف المرتجع",
        error: error.message,
      });
  }
});

// ============================================================
// ========== 📋 API سجل الحركات (AUDIT) ==========
// ============================================================

// GET - Audit log
app.get("/api/audit", async (req, res) => {
  try {
    const [rows] = await db.query(`
            SELECT a.*, 
                   CASE 
                       WHEN a.user = 'نظام' THEN a.user
                       ELSE a.user 
                   END as user_name
            FROM audit_log a 
            ORDER BY a.date DESC, a.id DESC 
            LIMIT 500
        `);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error in /api/audit:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في جلب سجل الحركات",
        error: error.message,
      });
  }
});

// POST - Add audit log
app.post("/api/audit", async (req, res) => {
  const { action, user } = req.body;

  if (!action) {
    return res.status(400).json({ success: false, message: "الحركة مطلوبة" });
  }

  try {
    const id = Date.now();
    const userName = user || "نظام";
    const device = req.headers["user-agent"] || "غير معروف";
    await db.query(
      `INSERT INTO audit_log (id, date, user, action, device) VALUES (?, NOW(), ?, ?, ?)`,
      [id, userName, action, device],
    );
    res.json({ success: true, message: "تم تسجيل الحركة" });
  } catch (error) {
    console.error("Error adding audit log:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في تسجيل الحركة",
        error: error.message,
      });
  }
});

// ============================================================
// ========== 👤 API المستخدم الشخصي (PROFILE) ==========
// ============================================================

// GET - User info
app.get("/api/user/:id", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, name, email, phone, address, role, profile_picture, account_status, created_at 
             FROM users WHERE id = ?`,
      [req.params.id],
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "المستخدم غير موجود" });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في جلب معلومات المستخدم",
        error: error.message,
      });
  }
});

// PUT - Update user info
app.put("/api/user/:id", async (req, res) => {
  const { name, email, phone, address } = req.body;

  try {
    await db.query(
      `UPDATE users SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?`,
      [name, email, phone || null, address || null, req.params.id],
    );

    await db.query(
      `INSERT INTO user_activity_log (user_id, user_name, action, description) 
             VALUES (?, ?, 'PROFILE_UPDATED', 'تم تحديث معلومات الملف الشخصي')`,
      [req.params.id, name],
    );

    res.json({ success: true, message: "تم تحديث المعلومات بنجاح" });
  } catch (error) {
    console.error("Error updating profile:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في تحديث المعلومات",
        error: error.message,
      });
  }
});

// PUT - Change password
app.put("/api/user/:id/password", async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res
      .status(400)
      .json({
        success: false,
        message: "كلمة المرور القديمة والجديدة مطلوبتان",
      });
  }

  try {
    const [user] = await db.query(
      "SELECT password, name FROM users WHERE id = ?",
      [req.params.id],
    );
    if (user.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "المستخدم غير موجود" });
    }

    const isValid = await bcrypt.compare(oldPassword, user[0].password);
    if (!isValid) {
      return res
        .status(401)
        .json({ success: false, message: "كلمة المرور القديمة غير صحيحة" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.query("UPDATE users SET password = ? WHERE id = ?", [
      hashedPassword,
      req.params.id,
    ]);

    await db.query(
      `INSERT INTO user_activity_log (user_id, user_name, action, description) 
             VALUES (?, ?, 'PASSWORD_CHANGED', 'تم تغيير كلمة المرور')`,
      [req.params.id, user[0].name],
    );

    res.json({ success: true, message: "تم تغيير كلمة المرور بنجاح" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في تغيير كلمة المرور",
        error: error.message,
      });
  }
});

// GET - User activity log
app.get("/api/user-activity/:userId", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM user_activity_log 
             WHERE user_id = ? 
             ORDER BY timestamp DESC 
             LIMIT 200`,
      [req.params.userId],
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في جلب سجل الحركات",
        error: error.message,
      });
  }
});

// POST - Log user activity
app.post("/api/log-activity", async (req, res) => {
  const { userId, userName, action, description, page, ipAddress, userAgent } =
    req.body;

  if (!userId || !action) {
    return res
      .status(400)
      .json({ success: false, message: "بيانات غير مكتملة" });
  }

  try {
    await db.query(
      `INSERT INTO user_activity_log (user_id, user_name, action, description, page, ip_address, user_agent) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        userName,
        action,
        description || null,
        page || null,
        ipAddress || null,
        userAgent || null,
      ],
    );
    res.json({ success: true, message: "تم تسجيل النشاط" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في تسجيل النشاط",
        error: error.message,
      });
  }
});

// POST - Upload profile picture
app.post(
  "/api/upload-profile-picture/:userId",
  upload.single("profilePicture"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: "لم يتم اختيار صورة" });
      }

      const userId = req.params.userId;
      const fileName = req.file.filename;
      const filePath = `/uploads/${fileName}`;

      const [user] = await db.query(
        "SELECT profile_picture FROM users WHERE id = ?",
        [userId],
      );
      if (user.length > 0 && user[0].profile_picture) {
        const oldFilePath = path.join(
          __dirname,
          "../front end",
          user[0].profile_picture,
        );
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }

      await db.query("UPDATE users SET profile_picture = ? WHERE id = ?", [
        filePath,
        userId,
      ]);

      await db.query(
        `INSERT INTO user_activity_log (user_id, user_name, action, description) 
             VALUES (?, (SELECT name FROM users WHERE id = ?), 'PROFILE_PICTURE_UPDATED', 'تم تحديث الصورة الشخصية')`,
        [userId, userId],
      );

      res.json({
        success: true,
        message: "تم رفع الصورة بنجاح",
        data: { filePath },
      });
    } catch (error) {
      console.error(error);
      if (req.file && req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      res
        .status(500)
        .json({
          success: false,
          message: "خطأ في رفع الصورة",
          error: error.message,
        });
    }
  },
);

// DELETE - Delete profile picture
app.delete("/api/profile-picture/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    const [user] = await db.query(
      "SELECT profile_picture FROM users WHERE id = ?",
      [userId],
    );
    if (user.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "المستخدم غير موجود" });
    }

    if (user[0].profile_picture) {
      const oldFilePath = path.join(
        __dirname,
        "../front end",
        user[0].profile_picture,
      );
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    await db.query("UPDATE users SET profile_picture = NULL WHERE id = ?", [
      userId,
    ]);

    await db.query(
      `INSERT INTO user_activity_log (user_id, user_name, action, description) 
             VALUES (?, (SELECT name FROM users WHERE id = ?), 'PROFILE_PICTURE_DELETED', 'تم حذف الصورة الشخصية')`,
      [userId, userId],
    );

    res.json({ success: true, message: "تم حذف الصورة بنجاح" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في حذف الصورة",
        error: error.message,
      });
  }
});

// ============================================================
// ========== 🧪 API تجريبي (TEST & DEBUG) ==========
// ============================================================

// GET - Test server
app.get("/api/test", (req, res) => {
  res.json({
    message: "✅ السيرفر شغال تمام يا معلم!",
    time: new Date().toLocaleString("ar-EG"),
    status: "success",
    websocket: "ws://localhost:8080",
  });
});

// GET - Debug OTP
app.get("/api/debug/otp/:email", async (req, res) => {
  try {
    const [users] = await db.query(
      "SELECT otp_code, otp_expires FROM users WHERE email = ?",
      [req.params.email],
    );

    if (users.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "المستخدم غير موجود" });
    }

    res.json({
      success: true,
      otp: users[0].otp_code,
      expires: users[0].otp_expires,
      note: "⚠️ هذا endpoint للتجربة فقط - احذفه في الإنتاج!",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// ========== 🚀 تشغيل السيرفر ==========
// ============================================================

const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
  res.sendFile(path.join(frontEndPath, "login.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 السيرفر شغال على http://localhost:${PORT}`);
  console.log(`🔌 WebSocket شغال على ws://localhost:8080`);
  console.log(`📁 Frontend path: ${frontEndPath}`);
  console.log(`📡 اختبر الرابط: http://localhost:${PORT}/api/test`);
  console.log(`\n🔐 API المصادقة (مع OTP والموافقة):`);
  console.log(`   POST تسجيل: http://localhost:${PORT}/api/auth/register`);
  console.log(
    `   POST التحقق من OTP: http://localhost:${PORT}/api/auth/verify-otp`,
  );
  console.log(
    `   POST إعادة إرسال OTP: http://localhost:${PORT}/api/auth/resend-otp`,
  );
  console.log(`   POST تسجيل دخول: http://localhost:${PORT}/api/auth/login`);
  console.log(
    `   GET طلبات التسجيل: http://localhost:${PORT}/api/pending-accounts`,
  );
  console.log(
    `   POST موافقة/رفض: http://localhost:${PORT}/api/approve-account`,
  );
  console.log(`   GET المستخدمين: http://localhost:${PORT}/api/auth/users`);
  console.log(`\n🔄 API التحويلات الداخلية:`);
  console.log(
    `   GET كل التحويلات: http://localhost:${PORT}/api/stock/transfers`,
  );
  console.log(
    `   GET تحويل معين: http://localhost:${PORT}/api/stock/transfers/:id`,
  );
  console.log(
    `   POST تحويل جديد: http://localhost:${PORT}/api/stock/transfer`,
  );
  console.log(
    `   DELETE حذف تحويل: http://localhost:${PORT}/api/stock/transfers/:id`,
  );
  console.log(`\n👑 حساب المدير الافتراضي: admin@inventory.com / admin123`);
  console.log(`\n💳 API العملاء والدفعات:`);
  console.log(`   GET كل العملاء: http://localhost:${PORT}/api/customers`);
  console.log(`   GET عميل واحد: http://localhost:${PORT}/api/customers/:id`);
  console.log(
    `   GET مديونيات العميل: http://localhost:${PORT}/api/customers/:customerId/debts`,
  );
  console.log(
    `   GET كل المديونيات: http://localhost:${PORT}/api/customer-debts-all`,
  );
  console.log(
    `   GET دفعات العميل: http://localhost:${PORT}/api/customers/:customerId/payments`,
  );
  console.log(
    `   GET كل الدفعات: http://localhost:${PORT}/api/customer-payments`,
  );
  console.log(
    `   POST دفعة جديدة: http://localhost:${PORT}/api/customer-payments`,
  );
});
