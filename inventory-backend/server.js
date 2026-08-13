const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const WebSocket = require("ws");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const compression = require("compression");
require("dotenv").config();

// ⚡ Keep-Alive Service
const { KeepAliveService } = require('./keep-alive-service');
const keepAliveService = new KeepAliveService(process.env.PORT || 5000);

const app = express();

// ⚡ Response Compression (gzip) - يقلل حجم البيانات 70-80%
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6 // Balance between speed and compression
}));

// ========== CORS Configuration - يجب أن يكون أول شيء ==========
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Import middleware
const {
  generateToken,
  authenticateUser,
  requireAdmin,
  requireStorekeeperOrAdmin,
  requireCashierOrAdmin,
  requirePermission,
  optionalAuth,
  logActivity,
} = require("./src/middleware/auth");

const {
  rateLimit,
  sanitizeInput,
  validateFields,
  validateEmail,
  validatePhone,
  configureCORS,
  requestLogger,
  errorHandler,
  notFoundHandler,
} = require("./src/middleware/security");

// ⚡ Import Caching Middleware
const { cacheMiddleware, autoInvalidateMiddleware, cache: appCache } = require("./src/middleware/cache");
console.log('✅ Caching system loaded');

// Security Middleware
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(sanitizeInput);
app.use(requestLogger);

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

// تحسين معالجة Static Files مع CORS
app.use((req, res, next) => {
  // إضافة CORS headers لكل الطلبات
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

app.use(express.static(frontEndPath, {
  maxAge: 0,
  etag: false,
  lastModified: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (filePath.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    } else if (filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/' + path.extname(filePath).slice(1));
    }
  }
}));

// Create uploads folder
const uploadsDir = path.join(frontEndPath, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

// Create backups folder
const backupsDir = path.join(__dirname, "backups");
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}
app.use("/backups", express.static(backupsDir));

// ================================================================
// 🏥 HEALTH CHECK ENDPOINT - للـ Keep-Alive Service
// ================================================================
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Server is alive and running",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
    },
    keepAlive: keepAliveService.getStats()
  });
});

// ================================================================
// 📊 KEEP-ALIVE STATS ENDPOINT
// ================================================================
app.get("/api/keep-alive/stats", (req, res) => {
  res.json({
    success: true,
    data: keepAliveService.getStats()
  });
});

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
const { optimizeDatabase } = require("./src/config/optimize-database");

async function initDatabase() {
  try {
    const connected = await testConnection();
    if (!connected) {
      console.error(
        "⚠️ فشل الاتصال بقاعدة البيانات. السيرفر سيستمر لكن قد تحدث مشاكل.",
      );
      return;
    }

    // ========== 🚀 تحسين دائم لقاعدة البيانات ==========
    await optimizeDatabase();
    console.log('⚡ قاعدة البيانات محسّنة ومجهّزة للأداء العالي!');

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

    // ========== Locations ==========
    await db.query(`
            CREATE TABLE IF NOT EXISTS locations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                address TEXT,
                manager VARCHAR(255),
                phone VARCHAR(50),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
    console.log("✅ Table locations ready");

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
                unit VARCHAR(50) DEFAULT 'قطعة',
                barcode VARCHAR(100),
                description TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_code (code),
                INDEX idx_name (name),
                INDEX idx_category (category)
            )
        `);
    console.log("✅ Table products ready");

    // ========== Product Packs (وحدات التعبئة) ==========
    await db.query(`
            CREATE TABLE IF NOT EXISTS product_packs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                productId BIGINT NOT NULL,
                unit_name VARCHAR(100) NOT NULL,
                quantity_per_unit INT NOT NULL DEFAULT 1,
                unit_price DECIMAL(10,2) DEFAULT 0,
                is_base_unit BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
                INDEX idx_productId (productId)
            )
        `);
    console.log("✅ Table product_packs ready");

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

    // Treasury
    await db.query(`
            CREATE TABLE IF NOT EXISTS treasury (
                id INT AUTO_INCREMENT PRIMARY KEY,
                date DATE NOT NULL,
                time TIME NOT NULL,
                type ENUM('income', 'expense', 'deposit', 'withdrawal') NOT NULL,
                category VARCHAR(100),
                amount DECIMAL(10,2) NOT NULL,
                description TEXT,
                reference_type VARCHAR(50),
                reference_id BIGINT,
                payment_method VARCHAR(50),
                created_by VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_date (date),
                INDEX idx_type (type),
                INDEX idx_category (category)
            )
        `);
    console.log("✅ Table treasury ready");

    // Attendance
    await db.query(`
            CREATE TABLE IF NOT EXISTS attendance (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                user_name VARCHAR(255),
                date DATE NOT NULL,
                check_in TIME,
                check_out TIME,
                status ENUM('present', 'absent', 'late', 'half_day') DEFAULT 'present',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY unique_user_date (user_id, date),
                INDEX idx_date (date),
                INDEX idx_user_id (user_id)
            )
        `);
    console.log("✅ Table attendance ready");

    // Audit log
    await db.query(`
            CREATE TABLE IF NOT EXISTS audit_log (
                id BIGINT PRIMARY KEY,
                date DATETIME NOT NULL,
                user VARCHAR(255),
                action TEXT,
                device VARCHAR(255),
                ip_address VARCHAR(50),
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

    // User sessions
    await db.query(`
            CREATE TABLE IF NOT EXISTS user_sessions (
                id VARCHAR(255) PRIMARY KEY,
                user_id INT NOT NULL,
                token VARCHAR(500) NOT NULL,
                ip_address VARCHAR(50),
                user_agent TEXT,
                expires_at DATETIME NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_id (user_id),
                INDEX idx_expires_at (expires_at)
            )
        `);
    console.log("✅ Table user_sessions ready");

    // Notifications
    await db.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                type ENUM('info', 'success', 'warning', 'error') DEFAULT 'info',
                is_read BOOLEAN DEFAULT FALSE,
                reference_type VARCHAR(50),
                reference_id BIGINT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_id (user_id),
                INDEX idx_is_read (is_read),
                INDEX idx_created_at (created_at)
            )
        `);
    console.log("✅ Table notifications ready");

    // Price history
    await db.query(`
            CREATE TABLE IF NOT EXISTS price_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                product_id BIGINT NOT NULL,
                old_purchase_price DECIMAL(10,2),
                new_purchase_price DECIMAL(10,2),
                old_selling_price DECIMAL(10,2),
                new_selling_price DECIMAL(10,2),
                changed_by VARCHAR(255),
                reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                INDEX idx_product_id (product_id),
                INDEX idx_created_at (created_at)
            )
        `);
    console.log("✅ Table price_history ready");

    // User theme settings
    await db.query(`
            CREATE TABLE IF NOT EXISTS user_theme_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL UNIQUE,
                primary_color VARCHAR(7) DEFAULT '#4361ee',
                secondary_color VARCHAR(7) DEFAULT '#764ba2',
                background_color VARCHAR(7) DEFAULT '#f8fafc',
                text_color VARCHAR(7) DEFAULT '#1f2937',
                sidebar_bg VARCHAR(7) DEFAULT '#0f172a',
                sidebar_text VARCHAR(7) DEFAULT '#ffffff',
                card_bg VARCHAR(7) DEFAULT '#ffffff',
                card_shadow VARCHAR(50) DEFAULT '0 4px 15px rgba(0,0,0,0.08)',
                card_radius VARCHAR(20) DEFAULT '20px',
                button_color VARCHAR(7) DEFAULT '#4361ee',
                button_radius VARCHAR(20) DEFAULT '12px',
                font_family VARCHAR(50) DEFAULT 'Cairo',
                font_size VARCHAR(20) DEFAULT 'medium',
                font_weight VARCHAR(20) DEFAULT 'regular',
                background_type ENUM('solid', 'gradient', 'image') DEFAULT 'solid',
                background_image VARCHAR(500) DEFAULT NULL,
                background_opacity DECIMAL(3,2) DEFAULT 1.00,
                theme_mode ENUM('light', 'dark', 'auto') DEFAULT 'light',
                button_style ENUM('rounded', 'square', 'pill') DEFAULT 'rounded',
                hover_effect ENUM('none', 'scale', 'color', 'shadow') DEFAULT 'scale',
                sidebar_style ENUM('default', 'compact', 'expanded') DEFAULT 'default',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
    console.log("✅ Table user_theme_settings ready");

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
  // تم تعطيل إرسال البريد الإلكتروني مؤقتًا
  console.log(`📧 [تم تخطي] إرسال إشعار ${status} إلى ${email}`);
  return true;
  
  /* الكود الأصلي - يمكن تفعيله لاحقًا بعد إعداد Gmail App Password
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
  */
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
    return res.status(400).json({
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
      return res.status(400).json({
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
    res.status(500).json({
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
    return res.status(400).json({
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
      return res.status(404).json({
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
    res.status(500).json({
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
      return res.status(404).json({
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
    res.status(500).json({
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
    res.status(500).json({
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
    res.status(500).json({
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
    res.status(500).json({
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
    res.status(500).json({
      success: false,
      message: "خطأ في إيقاف الحساب",
      error: error.message,
    });
  }
});

// POST - Login
app.post(
  "/api/auth/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    message: "تم تجاوز عدد محاولات تسجيل الدخول. حاول بعد 15 دقيقة",
  }),
  async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "البريد الإلكتروني وكلمة المرور مطلوبين",
      });
    }

    try {
      const [users] = await db.query("SELECT * FROM users WHERE email = ?", [
        email,
      ]);

      if (users.length === 0) {
        return res.status(401).json({
          success: false,
          message: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
        });
      }

      const user = users[0];

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({
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
        // التحقق من حالة الحساب - هل مرفوض أم في الانتظار
        if (user.account_status === 'rejected') {
          // جلب معلومات الرفض
          const [rejectionInfo] = await db.query(
            `SELECT 
              rr.rejected_by, 
              rr.rejection_reason, 
              rr.processed_at,
              u.name as admin_name 
             FROM registration_requests rr
             LEFT JOIN users u ON u.name = rr.processed_by
             WHERE rr.email = ? AND rr.status = 'rejected'
             ORDER BY rr.processed_at DESC
             LIMIT 1`,
            [email]
          );
          
          const rejectionDetails = rejectionInfo.length > 0 ? rejectionInfo[0] : null;
          
          return res.status(401).json({
            success: false,
            message: "تم رفض طلب التسجيل الخاص بك",
            code: 'ACCOUNT_REJECTED',
            rejectedBy: rejectionDetails?.admin_name || rejectionDetails?.rejected_by || 'المدير',
            rejectionReason: rejectionDetails?.rejection_reason || 'لم يتم تحديد سبب',
            rejectedAt: rejectionDetails?.processed_at || null,
            needsApproval: false
          });
        }
        
        // الحساب في انتظار الموافقة
        return res.status(401).json({
          success: false,
          message: "حسابك في انتظار موافقة المدير. سيتم إشعارك عند الموافقة",
          needsApproval: true,
        });
      }

      if (user.account_status === "suspended") {
        return res.status(403).json({
          success: false,
          message: "حسابك موقوف مؤقتاً. يرجى التواصل مع الإدارة",
        });
      }

      const token = generateToken(user);

      const sessionId = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await db.query(
        "INSERT INTO user_sessions (id, user_id, token, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
        [
          sessionId,
          user.id,
          token,
          req.ip,
          req.headers["user-agent"],
          expiresAt,
        ],
      );

      // ========== 🆕 جلب صلاحيات المستخدم ==========
      const [permissionRows] = await db.query(
        "SELECT permission_id, enabled FROM user_permissions WHERE user_id = ? AND enabled = true",
        [user.id],
      );
      const userPermissions = {};
      for (const row of permissionRows) {
        userPermissions[row.permission_id] = row.enabled === 1;
      }

      await addAuditLog(user.name, `تسجيل دخول`, req);

      res.json({
        success: true,
        message: "تم تسجيل الدخول بنجاح",
        token: token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          profile_picture: user.profile_picture,
          permissions: userPermissions, // ✅ إضافة الصلاحيات
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        message: "خطأ في تسجيل الدخول",
        error: error.message,
      });
    }
  },
);

// POST - Logout
app.post("/api/auth/logout", authenticateUser, async (req, res) => {
  try {
    await db.query("DELETE FROM user_sessions WHERE user_id = ?", [
      req.user.id,
    ]);
    await addAuditLog(req.user.name, "تسجيل خروج", req);
    res.json({
      success: true,
      message: "تم تسجيل الخروج بنجاح",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "خطأ في تسجيل الخروج",
    });
  }
});

// GET - Verify Token
app.get("/api/auth/verify", authenticateUser, async (req, res) => {
  // ========== 🆕 جلب الصلاحيات مع الـ Verify ==========
  const [permissionRows] = await db.query(
    "SELECT permission_id, enabled FROM user_permissions WHERE user_id = ? AND enabled = true",
    [req.user.id],
  );
  const userPermissions = {};
  for (const row of permissionRows) {
    userPermissions[row.permission_id] = row.enabled === 1;
  }

  res.json({
    success: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      permissions: userPermissions, // ✅ إضافة الصلاحيات
    },
  });
});

// GET - Current User Profile
app.get("/api/auth/me", authenticateUser, async (req, res) => {
  try {
    const [users] = await db.query(
      "SELECT id, email, name, role, phone, address, profile_picture, created_at FROM users WHERE id = ?",
      [req.user.id],
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "المستخدم غير موجود",
      });
    }

    res.json({
      success: true,
      data: users[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "خطأ في جلب بيانات المستخدم",
    });
  }
});

// ============================================================
// ========== 🔐 API الصلاحيات (PERMISSIONS) - 🆕 مُضافة ==========
// ============================================================

// GET - جلب صلاحيات مستخدم معين
app.get("/api/user-permissions/:userId", authenticateUser, async (req, res) => {
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
    res.status(500).json({
      success: false,
      message: "خطأ في جلب صلاحيات المستخدم",
      error: error.message,
    });
  }
});

// POST - حفظ صلاحيات المستخدم (النسخة المحسّنة)
app.post("/api/save-user-permissions", async (req, res) => {
  const { userId, userName, permissions, updatedBy } = req.body;

  if (!userId || !permissions) {
    return res.status(400).json({
      success: false,
      message: "البيانات غير مكتملة",
    });
  }

  try {
    // ✅ حذف جميع الصلاحيات القديمة للمستخدم
    await db.query("DELETE FROM user_permissions WHERE user_id = ?", [userId]);

    let enabledCount = 0;

    // ✅ إدخال الصلاحيات الجديدة
    for (const [permId, enabled] of Object.entries(permissions)) {
      if (enabled === true) {
        await db.query(
          "INSERT INTO user_permissions (user_id, permission_id, enabled) VALUES (?, ?, ?)",
          [userId, permId, true],
        );
        enabledCount++;
      }
    }

    // ✅ تسجيل في Audit Log
    await addAuditLog(
      updatedBy || "نظام",
      `تحديث صلاحيات المستخدم: ${userName || userId} - ${enabledCount} صلاحية مفعلة`,
      req,
    );

    // ✅ إرجاع النتيجة
    res.json({
      success: true,
      message: `تم حفظ ${enabledCount} صلاحية للمستخدم بنجاح`,
      data: { userId, enabledCount },
    });
  } catch (error) {
    console.error("❌ Error saving user permissions:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في حفظ الصلاحيات",
      error: error.message,
    });
  }
});

// GET - جلب جميع الصلاحيات المتاحة (للواجهة)
app.get("/api/permissions/list", authenticateUser, async (req, res) => {
  const allPermissions = [
    // Dashboard
    { id: "dashboard.view", name: "عرض لوحة التحكم", category: "لوحة التحكم" },
    { id: "dashboard.stats", name: "عرض الإحصائيات", category: "لوحة التحكم" },
    { id: "dashboard.charts", name: "الرسوم البيانية", category: "لوحة التحكم" },
    {
      id: "dashboard.predictions",
      name: "توقعات المخزون",
      category: "لوحة التحكم",
    },
    {
      id: "dashboard.export",
      name: "تصدير التقارير",
      category: "لوحة التحكم",
    },

    // Products
    { id: "products.view", name: "عرض المنتجات", category: "المنتجات" },
    { id: "products.add", name: "إضافة منتج", category: "المنتجات" },
    { id: "products.edit", name: "تعديل المنتج", category: "المنتجات" },
    { id: "products.delete", name: "حذف منتج", category: "المنتجات" },
    {
      id: "products.delete_all",
      name: "حذف الكل",
      category: "المنتجات",
    },
    {
      id: "products.import",
      name: "استيراد Excel",
      category: "المنتجات",
    },
    {
      id: "products.export",
      name: "تصدير Excel",
      category: "المنتجات",
    },

    // Prices
    { id: "prices.view", name: "عرض الأسعار", category: "الأسعار" },
    { id: "prices.edit", name: "تعديل الأسعار", category: "الأسعار" },
    {
      id: "prices.bulk_edit",
      name: "تحديث جماعي",
      category: "الأسعار",
    },
    {
      id: "prices.import",
      name: "استيراد أسعار",
      category: "الأسعار",
    },
    {
      id: "prices.export",
      name: "تصدير الأسعار",
      category: "الأسعار",
    },
    {
      id: "prices.history",
      name: "سجل التغييرات",
      category: "الأسعار",
    },

    // Stock
    { id: "stock.view", name: "عرض المخزون", category: "المخزون" },
    { id: "stock.adjust", name: "تعديل المخزون", category: "المخزون" },
    { id: "stock.export", name: "تصدير المخزون", category: "المخزون" },
    { id: "stock.import", name: "استيراد المخزون", category: "المخزون" },
    { id: "stock.transfer", name: "تحويلات المخزون", category: "المخزون" },

    // Locations
    { id: "locations.view", name: "عرض الأماكن", category: "الأماكن" },
    { id: "locations.add", name: "إضافة مكان", category: "الأماكن" },
    { id: "locations.edit", name: "تعديل مكان", category: "الأماكن" },
    { id: "locations.delete", name: "حذف مكان", category: "الأماكن" },
    { id: "locations.manage", name: "إدارة الأماكن", category: "الأماكن" },

    // Sales
    { id: "sales.view", name: "عرض فواتير البيع", category: "المبيعات" },
    { id: "sales.create", name: "إنشاء فاتورة بيع", category: "المبيعات" },
    { id: "sales.delete", name: "حذف فاتورة بيع", category: "المبيعات" },
    { id: "sales.print", name: "طباعة فاتورة", category: "المبيعات" },
    { id: "sales.export", name: "تصدير فواتير", category: "المبيعات" },

    // Purchases
    {
      id: "purchases.view",
      name: "عرض فواتير الشراء",
      category: "المشتريات",
    },
    {
      id: "purchases.create",
      name: "إنشاء فاتورة شراء",
      category: "المشتريات",
    },
    {
      id: "purchases.delete",
      name: "حذف فاتورة شراء",
      category: "المشتريات",
    },
    {
      id: "purchases.print",
      name: "طباعة فاتورة شراء",
      category: "المشتريات",
    },
    {
      id: "purchases.export",
      name: "تصدير فواتير شراء",
      category: "المشتريات",
    },

    // Returns
    { id: "returns.view", name: "عرض المرتجعات", category: "المرتجعات" },
    { id: "returns.create", name: "إنشاء مرتجع", category: "المرتجعات" },
    { id: "returns.delete", name: "حذف مرتجع", category: "المرتجعات" },
    { id: "returns.manage", name: "إدارة المرتجعات", category: "المرتجعات" },

    // Customers
    { id: "customers.view", name: "عرض العملاء", category: "العملاء" },
    { id: "customers.add", name: "إضافة عميل", category: "العملاء" },
    { id: "customers.edit", name: "تعديل عميل", category: "العملاء" },
    { id: "customers.delete", name: "حذف عميل", category: "العملاء" },
    { id: "customers.import", name: "استيراد عملاء", category: "العملاء" },
    { id: "customers.export", name: "تصدير عملاء", category: "العملاء" },
    {
      id: "customers.payments",
      name: "دفعات العملاء",
      category: "العملاء",
    },
    {
      id: "customers.statement",
      name: "كشف حساب",
      category: "العملاء",
    },
    { id: "customers.debts", name: "المديونيات", category: "العملاء" },

    // Suppliers
    { id: "suppliers.view", name: "عرض الموردين", category: "الموردين" },
    { id: "suppliers.add", name: "إضافة مورد", category: "الموردين" },
    { id: "suppliers.edit", name: "تعديل مورد", category: "الموردين" },
    { id: "suppliers.delete", name: "حذف مورد", category: "الموردين" },
    { id: "suppliers.import", name: "استيراد موردين", category: "الموردين" },
    { id: "suppliers.export", name: "تصدير موردين", category: "الموردين" },

    // Attendance
    { id: "attendance.view", name: "عرض الحضور", category: "الحضور" },
    {
      id: "attendance.checkin",
      name: "تسجيل حضور",
      category: "الحضور",
    },
    {
      id: "attendance.checkout",
      name: "تسجيل انصراف",
      category: "الحضور",
    },
    {
      id: "attendance.manage",
      name: "إدارة الحضور",
      category: "الحضور",
    },
    {
      id: "attendance.export",
      name: "تصدير الحضور",
      category: "الحضور",
    },

    // Treasury
    { id: "treasury.view", name: "عرض الخزنة", category: "الخزنة" },
    { id: "treasury.deposit", name: "إيداع", category: "الخزنة" },
    { id: "treasury.withdraw", name: "صرف", category: "الخزنة" },
    {
      id: "treasury.sales",
      name: "مبيعات قطاعي",
      category: "الخزنة",
    },
    {
      id: "treasury.export",
      name: "تصدير الخزنة",
      category: "الخزنة",
    },

    // Users
    { id: "users.view", name: "عرض المستخدمين", category: "الحسابات" },
    { id: "users.add", name: "إضافة مستخدم", category: "الحسابات" },
    { id: "users.edit", name: "تعديل مستخدم", category: "الحسابات" },
    { id: "users.delete", name: "حذف مستخدم", category: "الحسابات" },
    {
      id: "users.approve",
      name: "موافقة على طلبات",
      category: "الحسابات",
    },
    {
      id: "users.details",
      name: "تفاصيل المستخدم",
      category: "الحسابات",
    },
    {
      id: "users.permissions",
      name: "إدارة الصلاحيات",
      category: "الحسابات",
    },

    // Reports
    { id: "reports.view", name: "عرض التقارير", category: "التقارير" },
    { id: "reports.export", name: "تصدير التقارير", category: "التقارير" },
    { id: "reports.sales", name: "تقرير المبيعات", category: "التقارير" },
    {
      id: "reports.purchases",
      name: "تقرير المشتريات",
      category: "التقارير",
    },
    { id: "reports.profits", name: "تقرير الأرباح", category: "التقارير" },
    {
      id: "reports.products",
      name: "تقرير المنتجات",
      category: "التقارير",
    },
    {
      id: "reports.movements",
      name: "تقرير الحركات",
      category: "التقارير",
    },
    { id: "reports.manual", name: "تقرير يدوي", category: "التقارير" },
    { id: "reports.saved", name: "تقارير محفوظة", category: "التقارير" },

    // Audit
    { id: "audit.view", name: "عرض سجل الحركات", category: "سجل الحركات" },
    {
      id: "audit.export",
      name: "تصدير سجل الحركات",
      category: "سجل الحركات",
    },

    // Profile
    { id: "profile.view", name: "عرض الملف الشخصي", category: "الملف الشخصي" },
    {
      id: "profile.edit",
      name: "تعديل الملف الشخصي",
      category: "الملف الشخصي",
    },
    {
      id: "profile.picture",
      name: "تغيير الصورة",
      category: "الملف الشخصي",
    },
    {
      id: "profile.password",
      name: "تغيير كلمة المرور",
      category: "الملف الشخصي",
    },

    // System
    { id: "backup.create", name: "نسخ احتياطي", category: "النظام" },
    { id: "data.delete", name: "حذف البيانات", category: "النظام" },
    { id: "settings.edit", name: "إعدادات النظام", category: "النظام" },
  ];

  res.json({ success: true, data: allPermissions });
});

// ============================================================
// ========== 📸 API الصور الشخصية ==========
// ============================================================

// POST - Upload profile picture
app.post(
  "/api/users/upload-profile-picture",
  upload.single("profilePicture"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "لم يتم رفع أي ملف",
        });
      }

      const userId = req.body.userId;
      if (!userId) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: "معرف المستخدم مطلوب",
        });
      }

      const [users] = await db.query(
        "SELECT profile_picture FROM users WHERE id = ?",
        [userId],
      );
      if (users.length > 0 && users[0].profile_picture) {
        const oldPicturePath = path.join(
          uploadsDir,
          path.basename(users[0].profile_picture),
        );
        if (fs.existsSync(oldPicturePath)) {
          fs.unlinkSync(oldPicturePath);
        }
      }

      const pictureUrl = `/uploads/${req.file.filename}`;
      await db.query("UPDATE users SET profile_picture = ? WHERE id = ?", [
        pictureUrl,
        userId,
      ]);

      res.json({
        success: true,
        message: "تم رفع الصورة بنجاح",
        data: {
          profilePicture: pictureUrl,
        },
      });
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error("Error deleting file:", unlinkError);
        }
      }
      res.status(500).json({
        success: false,
        message: "خطأ في رفع الصورة",
        error: error.message,
      });
    }
  },
);

// POST - Delete profile picture
app.post("/api/users/delete-profile-picture", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "معرف المستخدم مطلوب",
      });
    }

    const [users] = await db.query(
      "SELECT profile_picture FROM users WHERE id = ?",
      [userId],
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "المستخدم غير موجود",
      });
    }

    const user = users[0];

    if (user.profile_picture) {
      const picturePath = path.join(
        uploadsDir,
        path.basename(user.profile_picture),
      );
      if (fs.existsSync(picturePath)) {
        fs.unlinkSync(picturePath);
      }
    }

    await db.query("UPDATE users SET profile_picture = NULL WHERE id = ?", [
      userId,
    ]);

    res.json({
      success: true,
      message: "تم حذف الصورة بنجاح",
    });
  } catch (error) {
    console.error("Error deleting profile picture:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في حذف الصورة",
      error: error.message,
    });
  }
});

// GET - Get user by ID
app.get("/api/users/:id", async (req, res) => {
  try {
    const userId = req.params.id;

    const [users] = await db.query(
      "SELECT id, name, email, phone, address, role, profile_picture, created_at FROM users WHERE id = ?",
      [userId],
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "المستخدم غير موجود",
      });
    }

    const user = users[0];
    if (user.profile_picture) {
      user.profilePicture = user.profile_picture;
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في جلب بيانات المستخدم",
      error: error.message,
    });
  }
});

// PUT - Update user profile
app.put("/api/users/:id", async (req, res) => {
  try {
    const { name, email, phone, address } = req.body;
    const userId = req.params.id;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: "الاسم والبريد الإلكتروني مطلوبان",
      });
    }

    const [existingUsers] = await db.query(
      "SELECT id FROM users WHERE email = ? AND id != ?",
      [email, userId],
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: "البريد الإلكتروني مستخدم بالفعل",
      });
    }

    await db.query(
      "UPDATE users SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?",
      [name, email, phone, address, userId],
    );

    const [users] = await db.query(
      "SELECT id, name, email, phone, address, role, profile_picture FROM users WHERE id = ?",
      [userId],
    );

    res.json({
      success: true,
      message: "تم تحديث البيانات بنجاح",
      data: users[0],
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في تحديث البيانات",
      error: error.message,
    });
  }
});

// POST - Change password
app.post("/api/users/change-password", async (req, res) => {
  try {
    const { userId, oldPassword, newPassword } = req.body;

    if (!userId || !oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "جميع الحقول مطلوبة",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
      });
    }

    const [users] = await db.query("SELECT * FROM users WHERE id = ?", [
      userId,
    ]);

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "المستخدم غير موجود",
      });
    }

    const user = users[0];

    const isValidOldPassword = await bcrypt.compare(oldPassword, user.password);

    if (!isValidOldPassword) {
      return res.status(401).json({
        success: false,
        message: "كلمة المرور الحالية غير صحيحة",
      });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await db.query("UPDATE users SET password = ? WHERE id = ?", [
      hashedNewPassword,
      userId,
    ]);

    await addAuditLog(user.name, "تغيير كلمة المرور", req);

    res.json({
      success: true,
      message: "تم تغيير كلمة المرور بنجاح",
    });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في تغيير كلمة المرور",
      error: error.message,
    });
  }
});

// ============================================================
// ========== 👤 API الصلاحيات (PERMISSIONS) - مُضافة ==========
// ============================================================

// ============================================================
// 🔐 AUTH API - Login & Authentication
// ============================================================

// POST - Login endpoint
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "البريد الإلكتروني وكلمة المرور مطلوبان",
    });
  }

  try {
    // جلب المستخدم من قاعدة البيانات
    const [users] = await db.query(
      "SELECT * FROM users WHERE email = ? LIMIT 1",
      [email],
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
      });
    }

    const user = users[0];

    // التحقق من حالة الحساب
    if (user.account_status !== "active") {
      const statusMessages = {
        pending: "حسابك قيد المراجعة ولم يتم تفعيله بعد",
        rejected: "تم رفض طلب التسجيل الخاص بك",
        suspended: "تم تعليق حسابك، يرجى التواصل مع المدير",
      };
      return res.status(403).json({
        success: false,
        message: statusMessages[user.account_status] || "الحساب غير نشط",
      });
    }

    // التحقق من كلمة المرور
    const bcrypt = require("bcryptjs");
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
      });
    }

    // ✅ جلب صلاحيات المستخدم
    const [permissionRows] = await db.query(
      "SELECT permission_id, enabled FROM user_permissions WHERE user_id = ?",
      [user.id],
    );

    const permissions = {};
    for (const row of permissionRows) {
      permissions[row.permission_id] = row.enabled === 1;
    }

    // تحضير بيانات المستخدم للإرجاع (بدون كلمة المرور)
    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone || "",
      location: user.location || "",
      account_status: user.account_status,
      profile_picture: user.profile_picture || "",
      permissions: permissions, // ✅ إضافة الصلاحيات
    };

    // تسجيل في Audit Log
    await addAuditLog(user.name, "تسجيل دخول للنظام", req);

    res.json({
      success: true,
      message: "تم تسجيل الدخول بنجاح",
      user: userData,
      token: "dummy-token-" + user.id, // يمكن استبداله بـ JWT حقيقي لاحقاً
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في تسجيل الدخول",
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
    res.status(500).json({
      success: false,
      message: "خطأ في جلب صلاحيات المستخدم",
      error: error.message,
    });
  }
});

// ============================================================
// ========== 📦 API المنتجات (PRODUCTS) ==========
// ============================================================

// GET - Products (مع وحدات التعبئة) + Caching (short TTL)
app.get("/api/products", cacheMiddleware(30), async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM products ORDER BY id DESC");
    console.log(`✅ تم جلب ${rows.length} منتج من قاعدة البيانات`);

    // جلب وحدات التعبئة لكل منتج
    for (let product of rows) {
      const [packs] = await db.query(
        "SELECT * FROM product_packs WHERE productId = ? ORDER BY id ASC",
        [product.id],
      );
      console.log(`📦 المنتج ${product.name} (ID: ${product.id}) - عدد وحدات التعبئة: ${packs.length}`);
      if (packs.length > 0) {
        console.log(`   وحدات التعبئة:`, packs.map(p => `${p.unit_name} (${p.quantity_per_unit})`).join(', '));
      }
      product.packs = packs || [];
    }

    console.log(`✅ إرسال البيانات للمتصفح - أول منتج له ${rows[0]?.packs?.length || 0} وحدة تعبئة`);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error in /api/products:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في جلب المنتجات",
      error: error.message,
    });
  }
});

// GET - Product packs (وحدات التعبئة)
app.get("/api/product-packs", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM product_packs");
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error in /api/product-packs:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في جلب وحدات التعبئة",
      error: error.message,
    });
  }
});

// POST - Add product (مع وحدات التعبئة) + Auto-invalidate cache
app.post("/api/products", autoInvalidateMiddleware(['/api/products', '/api/stock']), async (req, res) => {
  const {
    code,
    name,
    category,
    sellingPrice,
    purchasePrice,
    minStock,
    locationId,
    packs,
  } = req.body;

  console.log(`\n📥 إضافة منتج جديد: ${name}`);
  console.log(`📦 عدد وحدات التعبئة المرسلة: ${packs?.length || 0}`);
  if (packs && packs.length > 0) {
    console.log(`📦 وحدات التعبئة:`, JSON.stringify(packs, null, 2));
  }

  if (!name) {
    return res
      .status(400)
      .json({ success: false, message: "اسم المنتج مطلوب" });
  }

  try {
    let finalCode = code;
    if (!finalCode) {
      finalCode = `P${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    }

    const [existing] = await db.query(
      "SELECT id FROM products WHERE code = ?",
      [finalCode],
    );
    if (existing.length > 0) {
      finalCode = `${finalCode}-${Math.random().toString(36).substr(2, 4)}`;
    }

    // توليد ID عشوائي أصغر من 2147483647 (حد INT في MySQL)
    const productId = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 10000);

    await db.query(
      `INSERT INTO products (id, code, name, category, sellingPrice, purchasePrice, minStock) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        productId,
        finalCode,
        name,
        category,
        sellingPrice,
        purchasePrice,
        minStock,
      ],
    );

    // إضافة وحدات التعبئة
    if (packs && Array.isArray(packs) && packs.length > 0) {
      console.log(`💾 حفظ ${packs.length} وحدة تعبئة للمنتج ${productId}`);
      for (let pack of packs) {
        await db.query(
          `INSERT INTO product_packs (productId, unit_name, quantity_per_unit, unit_price, is_base_unit)
                     VALUES (?, ?, ?, ?, ?)`,
          [
            productId,
            pack.unit_name,
            pack.quantity_per_unit,
            pack.unit_price,
            pack.is_base_unit || false,
          ],
        );
        console.log(`  ✅ تم حفظ: ${pack.unit_name} - كمية: ${pack.quantity_per_unit} - سعر: ${pack.unit_price}`);
      }
    } else {
      console.log(`⚠️ لا توجد وحدات تعبئة - إنشاء وحدة افتراضية`);
      // إنشاء وحدة أساسية افتراضية
      await db.query(
        `INSERT INTO product_packs (productId, unit_name, quantity_per_unit, unit_price, is_base_unit)
                 VALUES (?, 'قطعة', 1, ?, TRUE)`,
        [productId, sellingPrice || 0],
      );
      console.log(`  ✅ تم إنشاء وحدة افتراضية: قطعة`);
    }

    const [existingStock] = await db.query(
      "SELECT * FROM stock WHERE productId = ? AND locationId = ?",
      [productId, locationId || 1],
    );

    if (existingStock.length === 0) {
      await db.query(
        "INSERT INTO stock (productId, quantity, locationId) VALUES (?, 0, ?)",
        [productId, locationId || 1],
      );
    }

    broadcastNotification(
      "📦 منتج جديد",
      `تم إضافة منتج جديد: ${name} (${finalCode})`,
      "info",
      { productId, code: finalCode, name },
    );

    res.json({
      success: true,
      message: "تم إضافة المنتج بنجاح",
      data: { id: productId, code: finalCode },
    });
  } catch (error) {
    console.error("Error adding product:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في إضافة المنتج: " + error.message,
      error: error.message,
    });
  }
});

// PUT - Edit product (مع وحدات التعبئة) + Auto-invalidate
app.put("/api/products/:id", autoInvalidateMiddleware(['/api/products', '/api/stock']), async (req, res) => {
  const { code, name, category, purchasePrice, sellingPrice, minStock, packs } =
    req.body;

  console.log(`\n✏️ تعديل منتج: ${name} (ID: ${req.params.id})`);
  console.log(`📦 عدد وحدات التعبئة المرسلة: ${packs?.length || 0}`);
  if (packs && packs.length > 0) {
    console.log(`📦 وحدات التعبئة:`, JSON.stringify(packs, null, 2));
  }

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

    // حذف وحدات التعبئة القديمة وإضافة الجديدة
    await db.query("DELETE FROM product_packs WHERE productId = ?", [
      req.params.id,
    ]);
    console.log(`🗑️ تم حذف وحدات التعبئة القديمة للمنتج ${req.params.id}`);

    if (packs && Array.isArray(packs) && packs.length > 0) {
      console.log(`💾 حفظ ${packs.length} وحدة تعبئة جديدة`);
      for (let pack of packs) {
        await db.query(
          `INSERT INTO product_packs (productId, unit_name, quantity_per_unit, unit_price, is_base_unit)
                     VALUES (?, ?, ?, ?, ?)`,
          [
            req.params.id,
            pack.unit_name,
            pack.quantity_per_unit,
            pack.unit_price,
            pack.is_base_unit || false,
          ],
        );
        console.log(`  ✅ تم حفظ: ${pack.unit_name} - كمية: ${pack.quantity_per_unit} - سعر: ${pack.unit_price}`);
      }
    } else {
      console.log(`⚠️ لا توجد وحدات تعبئة - إنشاء وحدة افتراضية`);
      // إنشاء وحدة أساسية افتراضية
      await db.query(
        `INSERT INTO product_packs (productId, unit_name, quantity_per_unit, unit_price, is_base_unit)
                 VALUES (?, 'قطعة', 1, ?, TRUE)`,
        [req.params.id, sellingPrice || 0],
      );
      console.log(`  ✅ تم إنشاء وحدة افتراضية: قطعة`);
    }

    await addAuditLog("نظام", `تعديل منتج: ${name} (${code})`, req);

    res.json({ success: true, message: "تم تعديل المنتج بنجاح" });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "خطأ في تعديل المنتج",
      error: error.message,
    });
  }
});

// DELETE - Delete product + Auto-invalidate
app.delete("/api/products/:id", autoInvalidateMiddleware(['/api/products', '/api/stock']), async (req, res) => {
  try {
    const [product] = await db.query(
      "SELECT name, code FROM products WHERE id = ?",
      [req.params.id],
    );

    // حذف وحدات التعبئة المرتبطة
    await db.query("DELETE FROM product_packs WHERE productId = ?", [
      req.params.id,
    ]);
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
    res.status(500).json({
      success: false,
      message: "خطأ في حذف المنتج",
      error: error.message,
    });
  }
});

// POST/DELETE - Delete all products
app.post("/api/products/delete-all", async (req, res) => {
  try {
    await db.query("DELETE FROM product_packs");
    await db.query("DELETE FROM stock");
    await db.query("DELETE FROM products");
    await addAuditLog("نظام", "حذف جميع المنتجات والمخزون", req);
    broadcastNotification(
      "⚠️ مسح المنتجات",
      "تم حذف جميع المنتجات والمخزون بنجاح",
      "warning",
    );
    res.json({ success: true, message: "تم حذف جميع المنتجات بنجاح" });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "خطأ في حذف المنتجات",
      error: error.message,
    });
  }
});

// ============================================================
// ========== 📦 API المخزون (STOCK) ==========
// ============================================================

// GET - Stock + Caching
app.get("/api/stock", cacheMiddleware(30), async (req, res) => {
  try {
    const [rows] = await db.query(`
            SELECT s.*, p.name as productName, p.code, p.sellingPrice 
            FROM stock s 
            JOIN products p ON s.productId = p.id
        `);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error in /api/stock:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في جلب المخزون",
      error: error.message,
    });
  }
});

// POST - Update stock
app.post("/api/stock/update", async (req, res) => {
  const { productId, quantity, operation, locationId } = req.body;

  if (!productId || quantity === undefined) {
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

    const op = operation || "set";

    if (op === "add") {
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
    } else if (op === "subtract") {
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
    } else if (op === "set") {
      if (existing.length === 0) {
        await db.query(
          "INSERT INTO stock (productId, quantity, locationId) VALUES (?, ?, ?)",
          [productId, quantity, locId],
        );
      } else {
        await db.query(
          "UPDATE stock SET quantity = ? WHERE productId = ? AND locationId = ?",
          [quantity, productId, locId],
        );
      }
    } else {
      return res
        .status(400)
        .json({ success: false, message: "عملية غير معروفة" });
    }

    await addAuditLog(
      "نظام",
      `تحديث مخزون المنتج ${productId} - ${op} ${quantity}`,
      req,
    );

    res.json({ success: true, message: "تم تحديث المخزون بنجاح" });
  } catch (error) {
    console.error(error);
    res.status(500).json({
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
    res.status(500).json({
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
    res.status(500).json({
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

    let totalValue = 0;
    for (const item of items) {
      totalValue += (item.quantity || 0) * (item.price || 0);
    }

    const transferId = Date.now();
    const transferNumber = "TRF-" + String(transferId).slice(-8);
    const date = new Date().toISOString().slice(0, 10);

    console.log("📝 إنشاء تحويل:", { transferId, transferNumber, totalValue });

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

    for (const item of items) {
      const productId = item.productId;
      const quantity = item.quantity || 0;
      const price = item.price || 0;
      const productName = item.productName || "غير معروف";
      const itemTotal = quantity * price;

      console.log(
        `📦 منتج: ${productName}, الكمية: ${quantity}, السعر: ${price}`,
      );

      await connection.query(
        `
                INSERT INTO stock_transfer_items 
                (transferId, productId, productName, quantity, price, total) 
                VALUES (?, ?, ?, ?, ?, ?)
            `,
        [transferId, productId, productName, quantity, price, itemTotal],
      );

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

    await addAuditLog(
      createdBy || "نظام",
      `تحويل مخزون: ${transferNumber}`,
      req,
    );

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
    res.status(500).json({
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
    res.status(500).json({
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
    res.status(500).json({
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
    res.status(500).json({
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
    res.status(500).json({
      success: false,
      message: "خطأ في حذف المكان",
      error: error.message,
    });
  }
});

// ============================================================
// ========== 👥 API العملاء (CUSTOMERS) ==========
// ============================================================

// GET - Customers + Caching
app.get("/api/customers", cacheMiddleware(60), async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM customers ORDER BY id DESC");
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error in /api/customers:", error);
    res.status(500).json({
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
    res.status(500).json({
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
    res.status(500).json({
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
    res.status(500).json({
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
    res.status(500).json({
      success: false,
      message: "خطأ في حذف العميل",
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
    res.status(500).json({
      success: false,
      message: "خطأ في جلب المديونيات",
      error: error.message,
    });
  }
});

// GET - All customer debts
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
    res.status(500).json({
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
    return res.status(400).json({
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
    res.status(500).json({
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
    res.status(500).json({
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
    res.status(500).json({
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

// GET - Suppliers + Caching
app.get("/api/suppliers", cacheMiddleware(60), async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM suppliers ORDER BY id DESC");
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({
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
    res.status(500).json({
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
    res.status(500).json({
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
    res.status(500).json({
      success: false,
      message: "خطأ في حذف المورد",
      error: error.message,
    });
  }
});

// ============================================================
// ========== 🧾 API فواتير البيع (SALES) ==========
// ============================================================

// GET - Sales invoices + Caching
// ⚠️ DEPRECATED: Use /api/v2/sales instead (with pagination)
app.get("/api/sales", cacheMiddleware(30), async (req, res) => {
  try {
    // ⚠️ هذا الـ endpoint قديم ويجب استخدام /api/v2/sales
    // نعيد توجيه للـ V2 API مع pagination افتراضي
    return res.status(410).json({
      success: false,
      message: "هذا الـ endpoint قديم. استخدم /api/v2/sales بدلاً منه",
      redirect: "/api/v2/sales?page=1&limit=20",
      error: "DEPRECATED_ENDPOINT"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
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
    res.status(500).json({
      success: false,
      message: "خطأ في جلب تفاصيل الفاتورة",
      error: error.message,
    });
  }
});

// GET - Sale invoice details (alias for /api/sales/:id)
app.get("/api/sales/:id/details", async (req, res) => {
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
    res.status(500).json({
      success: false,
      message: "خطأ في جلب تفاصيل الفاتورة",
      error: error.message,
    });
  }
});

// GET - Sales list search
app.get("/api/saleslist-search", async (req, res) => {
  try {
    const search = req.query.search || '';
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    let query = "SELECT * FROM sale_invoices WHERE 1=1";
    const params = [];

    if (search) {
      query += " AND (invoiceNumber LIKE ? OR customer LIKE ? OR seller LIKE ?)";
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += " ORDER BY date DESC, id DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [invoices] = await db.query(query, params);

    res.json({
      success: true,
      data: invoices,
      count: invoices.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "خطأ في البحث عن الفواتير",
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
    balanceBefore,
  } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: "الفاتورة فارغة" });
  }

  try {
    const invoiceId = Date.now();
    const finalInvoiceNumber =
      invoiceNumber || `INV-${invoiceId.toString().slice(-8)}`;

    await db.query("START TRANSACTION");

    try {
      await db.query(
        "ALTER TABLE sale_invoices ADD COLUMN balanceBefore DECIMAL(10,2) DEFAULT 0",
      );
    } catch (e) {}

    await db.query(
      `INSERT INTO sale_invoices (
                id, invoiceNumber, date, time, customer, seller, 
                subtotal, wholesaleDiscount, extraDiscount, total, 
                paid, \`change\`, paymentMethod, transactionNumber, 
                deliveryMethod, deliveryAddress, createdBy,
                is_deferred, down_payment, notes, balanceBefore
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        balanceBefore || 0,
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

    // ========== ✅ إضافة حركة في الخزنة عند البيع ==========
    const treasuryAmount = paid || 0; // المبلغ المدفوع فعلياً
    
    if (treasuryAmount > 0) {
      await db.query(
        `INSERT INTO treasury (date, time, type, category, amount, description, reference_type, reference_id, payment_method, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          date || new Date().toISOString().slice(0, 10),
          new Date().toLocaleTimeString("en-GB", { hour12: false }),
          "income", // إيراد
          "sales", // مبيعات
          treasuryAmount,
          `فاتورة بيع رقم ${finalInvoiceNumber} - ${customer || 'عميل نقدي'}`,
          "sale_invoice",
          invoiceId,
          paymentMethod || "cash",
          seller || "system"
        ]
      );
    }
    // ========================================================

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
    res.status(500).json({
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
    res.status(500).json({
      success: false,
      message: "خطأ في حذف الفاتورة",
      error: error.message,
    });
  }
});

// ============================================================
// ========== 🧾 API فواتير الشراء (PURCHASES) ==========
// ============================================================

// GET - Purchase invoices + Caching
app.get("/api/purchases", cacheMiddleware(30), async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM purchase_invoices ORDER BY date DESC, id DESC",
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({
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
    res.status(500).json({
      success: false,
      message: "خطأ في جلب تفاصيل الفاتورة",
      error: error.message,
    });
  }
});

// POST - Add purchase invoice
app.post("/api/purchases", async (req, res) => {
  const {
    invoiceNumber,
    date,
    supplier,
    items,
    total,
    createdBy,
    paid,
    paymentMethod,
    isDeferred,
    downPayment,
    balanceBefore,
  } = req.body;

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

    try {
      await db.query(
        "ALTER TABLE purchase_invoices ADD COLUMN paid DECIMAL(10,2) DEFAULT 0",
      );
    } catch (e) {}
    try {
      await db.query(
        "ALTER TABLE purchase_invoices ADD COLUMN paymentMethod VARCHAR(50) DEFAULT 'cash'",
      );
    } catch (e) {}
    try {
      await db.query(
        "ALTER TABLE purchase_invoices ADD COLUMN isDeferred BOOLEAN DEFAULT FALSE",
      );
    } catch (e) {}
    try {
      await db.query(
        "ALTER TABLE purchase_invoices ADD COLUMN downPayment DECIMAL(10,2) DEFAULT 0",
      );
    } catch (e) {}
    try {
      await db.query(
        "ALTER TABLE purchase_invoices ADD COLUMN balanceBefore DECIMAL(10,2) DEFAULT 0",
      );
    } catch (e) {}

    await db.query(
      `INSERT INTO purchase_invoices (id, invoiceNumber, date, supplier, total, createdBy, paid, paymentMethod, isDeferred, downPayment, balanceBefore) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceId,
        finalInvoiceNumber,
        date || new Date().toISOString().slice(0, 10),
        supplier,
        total || 0,
        createdBy || "system",
        paid || 0,
        paymentMethod || "cash",
        isDeferred || false,
        downPayment || 0,
        balanceBefore || 0,
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

    if (isDeferred === true || isDeferred === "true" || isDeferred == 1) {
      let [supplierData] = await db.query(
        "SELECT id FROM suppliers WHERE name = ?",
        [supplier],
      );
      let supplierId;

      if (supplierData.length === 0) {
        const newId = Date.now();
        await db.query(
          `INSERT INTO suppliers (id, name, balance) VALUES (?, ?, ?)`,
          [newId, supplier, 0],
        );
        supplierId = newId;
      } else {
        supplierId = supplierData[0].id;
      }

      const remainingDebt = total - (paid || 0);

      if (remainingDebt > 0) {
        await db.query(
          "UPDATE suppliers SET balance = balance + ? WHERE id = ?",
          [remainingDebt, supplierId],
        );
      }
    }

    // ========== ✅ خصم من الخزنة عند الشراء ==========
    const treasuryAmount = paid || 0; // المبلغ المدفوع فعلياً
    
    if (treasuryAmount > 0) {
      await db.query(
        `INSERT INTO treasury (date, time, type, category, amount, description, reference_type, reference_id, payment_method, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          date || new Date().toISOString().slice(0, 10),
          new Date().toLocaleTimeString("en-GB", { hour12: false }),
          "expense", // مصروف
          "purchases", // مشتريات
          treasuryAmount,
          `فاتورة شراء رقم ${finalInvoiceNumber} - ${supplier}`,
          "purchase_invoice",
          invoiceId,
          paymentMethod || "cash",
          createdBy || "system"
        ]
      );
    }
    // ========================================================

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
    console.error("❌ Purchase Invoice Error:", error);
    console.error("❌ Error Stack:", error.stack);
    console.error("❌ Request Body:", req.body);
    res.status(500).json({
      success: false,
      message: "خطأ في إضافة فاتورة الشراء",
      error: error.message,
      details: error.stack
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
    res.status(500).json({
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
    res.status(500).json({
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
    res.status(500).json({
      success: false,
      message: "خطأ في حذف المرتجع",
      error: error.message,
    });
  }
});

// ============================================================
// ========== 📋 API سجل الحركات (AUDIT) ==========
// ============================================================

// GET - Audit log + Caching (short TTL)
app.get("/api/audit", cacheMiddleware(10), async (req, res) => {
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
    res.status(500).json({
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
    res.status(500).json({
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
    res.status(500).json({
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
    res.status(500).json({
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
    return res.status(400).json({
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
    res.status(500).json({
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
    res.status(500).json({
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
    const [users] = await db.query("SELECT id FROM users WHERE id = ?", [
      userId,
    ]);

    if (users.length === 0) {
      console.warn(`⚠️ محاولة تسجيل نشاط لمستخدم غير موجود: userId=${userId}`);
      return res.json({
        success: false,
        message: "المستخدم غير موجود - تم تجاهل التسجيل",
        silent: true,
      });
    }

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
    res.status(500).json({
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
      res.status(500).json({
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
    res.status(500).json({
      success: false,
      message: "خطأ في حذف الصورة",
      error: error.message,
    });
  }
});

// ============================================================
// ========== 🎨 API الثيمات (THEME SETTINGS) ==========
// ============================================================

// GET - جلب إعدادات الثيم لمستخدم معين
app.get("/api/user-theme/:userId", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM user_theme_settings WHERE user_id = ?",
      [req.params.userId],
    );

    if (rows.length === 0) {
      return res.json({
        success: true,
        data: {
          primary_color: "#4361ee",
          secondary_color: "#764ba2",
          background_color: "#f8fafc",
          text_color: "#1f2937",
          sidebar_bg: "#0f172a",
          sidebar_text: "#ffffff",
          card_bg: "#ffffff",
          card_shadow: "0 4px 15px rgba(0,0,0,0.08)",
          card_radius: "20px",
          button_color: "#4361ee",
          button_radius: "12px",
          font_family: "Cairo",
          font_size: "medium",
          font_weight: "regular",
          background_type: "solid",
          background_image: null,
          background_opacity: 1.0,
          theme_mode: "light",
          button_style: "rounded",
          hover_effect: "scale",
          sidebar_style: "default",
        },
      });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("Error fetching user theme:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في جلب إعدادات الثيم",
      error: error.message,
    });
  }
});

// POST - حفظ أو تحديث إعدادات الثيم
app.post("/api/user-theme", async (req, res) => {
  const {
    user_id,
    primary_color,
    secondary_color,
    background_color,
    text_color,
    sidebar_bg,
    sidebar_text,
    card_bg,
    card_shadow,
    card_radius,
    button_color,
    button_radius,
    font_family,
    font_size,
    font_weight,
    background_type,
    background_image,
    background_opacity,
    theme_mode,
    button_style,
    hover_effect,
    sidebar_style,
  } = req.body;

  if (!user_id) {
    return res.status(400).json({
      success: false,
      message: "معرف المستخدم مطلوب",
    });
  }

  try {
    const [existing] = await db.query(
      "SELECT id FROM user_theme_settings WHERE user_id = ?",
      [user_id],
    );

    if (existing.length === 0) {
      await db.query(
        `INSERT INTO user_theme_settings (
          user_id, primary_color, secondary_color, background_color,
          text_color, sidebar_bg, sidebar_text, card_bg, card_shadow,
          card_radius, button_color, button_radius, font_family,
          font_size, font_weight, background_type, background_image,
          background_opacity, theme_mode, button_style, hover_effect,
          sidebar_style
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user_id,
          primary_color,
          secondary_color,
          background_color,
          text_color,
          sidebar_bg,
          sidebar_text,
          card_bg,
          card_shadow,
          card_radius,
          button_color,
          button_radius,
          font_family,
          font_size,
          font_weight,
          background_type,
          background_image,
          background_opacity,
          theme_mode,
          button_style,
          hover_effect,
          sidebar_style,
        ],
      );
    } else {
      await db.query(
        `UPDATE user_theme_settings SET
          primary_color = ?, secondary_color = ?, background_color = ?,
          text_color = ?, sidebar_bg = ?, sidebar_text = ?, card_bg = ?,
          card_shadow = ?, card_radius = ?, button_color = ?,
          button_radius = ?, font_family = ?, font_size = ?,
          font_weight = ?, background_type = ?, background_image = ?,
          background_opacity = ?, theme_mode = ?, button_style = ?,
          hover_effect = ?, sidebar_style = ?
        WHERE user_id = ?`,
        [
          primary_color,
          secondary_color,
          background_color,
          text_color,
          sidebar_bg,
          sidebar_text,
          card_bg,
          card_shadow,
          card_radius,
          button_color,
          button_radius,
          font_family,
          font_size,
          font_weight,
          background_type,
          background_image,
          background_opacity,
          theme_mode,
          button_style,
          hover_effect,
          sidebar_style,
          user_id,
        ],
      );
    }

    await addAuditLog(
      req.body.updatedBy || "نظام",
      `تحديث إعدادات الثيم للمستخدم ${user_id}`,
      req,
    );

    res.json({
      success: true,
      message: "تم حفظ إعدادات الثيم بنجاح",
    });
  } catch (error) {
    console.error("Error saving user theme:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في حفظ إعدادات الثيم",
      error: error.message,
    });
  }
});

// POST - إعادة تعيين الثيم للافتراضي
app.post("/api/user-theme/reset/:userId", async (req, res) => {
  try {
    await db.query("DELETE FROM user_theme_settings WHERE user_id = ?", [
      req.params.userId,
    ]);

    res.json({
      success: true,
      message: "تم إعادة تعيين الثيم للإعدادات الافتراضية",
    });
  } catch (error) {
    console.error("Error resetting theme:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في إعادة تعيين الثيم",
      error: error.message,
    });
  }
});

// POST - تطبيق ثيم على جميع المستخدمين (للمدير فقط)
app.post("/api/user-theme/apply-all", async (req, res) => {
  const { themeData, adminId } = req.body;

  if (!adminId) {
    return res.status(401).json({
      success: false,
      message: "غير مصرح بهذا الإجراء",
    });
  }

  try {
    const [admin] = await db.query("SELECT role FROM users WHERE id = ?", [
      adminId,
    ]);

    if (admin.length === 0 || admin[0].role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "ليس لديك صلاحية لتطبيق الثيم على جميع المستخدمين",
      });
    }

    await db.query("DELETE FROM user_theme_settings");

    const [users] = await db.query("SELECT id FROM users");

    for (const user of users) {
      await db.query(
        `INSERT INTO user_theme_settings (user_id, primary_color, secondary_color, 
          background_color, text_color, sidebar_bg, sidebar_text, card_bg, 
          card_shadow, card_radius, button_color, button_radius, font_family, 
          font_size, font_weight, background_type, background_image, 
          background_opacity, theme_mode, button_style, hover_effect, sidebar_style)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user.id,
          themeData.primary_color,
          themeData.secondary_color,
          themeData.background_color,
          themeData.text_color,
          themeData.sidebar_bg,
          themeData.sidebar_text,
          themeData.card_bg,
          themeData.card_shadow,
          themeData.card_radius,
          themeData.button_color,
          themeData.button_radius,
          themeData.font_family,
          themeData.font_size,
          themeData.font_weight,
          themeData.background_type,
          themeData.background_image,
          themeData.background_opacity,
          themeData.theme_mode,
          themeData.button_style,
          themeData.hover_effect,
          themeData.sidebar_style,
        ],
      );
    }

    await addAuditLog(
      "مدير النظام",
      `تطبيق ثيم جديد على جميع المستخدمين (${users.length} مستخدم)`,
      req,
    );

    res.json({
      success: true,
      message: `تم تطبيق الثيم على ${users.length} مستخدم بنجاح`,
    });
  } catch (error) {
    console.error("Error applying theme to all:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في تطبيق الثيم على جميع المستخدمين",
      error: error.message,
    });
  }
});

// ========== 🧪 API تجريبي (TEST & DEBUG) ==========
// ============================================================

// GET - Test server
app.get("/api/test", (req, res) => {
  res.json({
    message: "✅ السيرفر شغال تمام يا معلم!",
    time: new Date().toLocaleString("ar-EG"),
    status: "success",
    websocket: "ws://localhost:8080",
    cors: "enabled",
    headers: req.headers
  });
});

// GET - Cache Statistics (للمراقبة)
app.get("/api/cache/stats", (req, res) => {
  const stats = appCache.getStats();
  res.json({
    success: true,
    message: "إحصائيات الذاكرة المؤقتة",
    data: stats,
    performance: {
      message: stats.hitRate > 50 
        ? "🚀 أداء ممتاز! معدل الإصابة أكثر من 50%" 
        : "⚠️ يمكن تحسين الأداء بزيادة TTL",
      recommendation: stats.size >= stats.maxSize * 0.9
        ? "⚠️ الذاكرة ممتلئة تقريباً - فكر في زيادة maxSize"
        : "✅ الذاكرة المتاحة كافية"
    }
  });
});

// POST - Clear Cache (Admin only)
app.post("/api/cache/clear", (req, res) => {
  const cleared = appCache.clear();
  res.json({
    success: true,
    message: `تم مسح ${cleared} مدخل من الذاكرة المؤقتة`,
    data: { cleared }
  });
});

// GET - Test CORS
app.get("/api/test-cors", (req, res) => {
  res.json({
    success: true,
    message: "CORS is working!",
    origin: req.headers.origin || 'no origin',
    method: req.method
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
// ========== 👤 User Details API ==========
// ============================================================

// GET - جلب تفاصيل مستخدم واحد
app.get("/api/users/:id", async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT id, email, name, role, phone, address, 
              account_status, is_active, is_approved, created_at,
              profile_picture
       FROM users 
       WHERE id = ?`,
      [req.params.id],
    );

    if (users.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "المستخدم غير موجود" });
    }

    const userData = users[0];
    userData.profile_image = userData.profile_picture;
    userData.last_login = null;
    userData.last_ip = null;
    userData.last_device = null;

    res.json({ success: true, data: userData });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "خطأ في جلب بيانات المستخدم",
      error: error.message,
    });
  }
});

// GET - جلب إحصائيات مستخدم
app.get("/api/users/:id/stats", async (req, res) => {
  try {
    const userId = req.params.id;

    let sales = 0;
    try {
      const [salesResult] = await db.query(
        "SELECT COUNT(*) as count FROM sales WHERE user_id = ?",
        [userId],
      );
      sales = salesResult[0]?.count || 0;
    } catch (e) {}

    let purchases = 0;
    try {
      const [purchasesResult] = await db.query(
        "SELECT COUNT(*) as count FROM purchases WHERE user_id = ?",
        [userId],
      );
      purchases = purchasesResult[0]?.count || 0;
    } catch (e) {}

    let activities = 0;
    try {
      const [activitiesResult] = await db.query(
        "SELECT COUNT(*) as count FROM audit_log WHERE user = (SELECT name FROM users WHERE id = ?)",
        [userId],
      );
      activities = activitiesResult[0]?.count || 0;
    } catch (e) {}

    res.json({
      success: true,
      data: {
        sales,
        purchases,
        activities,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "خطأ في جلب الإحصائيات",
      error: error.message,
    });
  }
});

// GET - جلب سجل نشاط مستخدم
app.get("/api/users/:id/activity", async (req, res) => {
  try {
    const userId = req.params.id;

    const [users] = await db.query("SELECT name FROM users WHERE id = ?", [
      userId,
    ]);

    if (users.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "المستخدم غير موجود" });
    }

    const userName = users[0].name;

    try {
      const [activities] = await db.query(
        "SELECT * FROM audit_log WHERE user = ? ORDER BY date DESC LIMIT 20",
        [userName],
      );

      res.json({ success: true, data: activities });
    } catch (e) {
      res.json({ success: true, data: [] });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "خطأ في جلب سجل النشاط",
      error: error.message,
    });
  }
});

// DELETE - حذف حساب مستخدم
app.delete("/api/auth/users/:id", async (req, res) => {
  const { adminEmail, adminPassword } = req.body;
  const userId = req.params.id;

  if (!adminEmail || !adminPassword) {
    return res.status(400).json({
      success: false,
      message: "البريد الإلكتروني وكلمة المرور مطلوبين للتأكيد",
    });
  }

  try {
    // التحقق من بيانات الأدمن
    const [adminUsers] = await db.query(
      "SELECT * FROM users WHERE email = ? AND role = 'admin'",
      [adminEmail]
    );

    if (adminUsers.length === 0) {
      return res.status(401).json({
        success: false,
        message: "بريد المدير غير صحيح",
      });
    }

    const admin = adminUsers[0];
    const passwordMatch = await bcrypt.compare(adminPassword, admin.password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "كلمة المرور غير صحيحة",
      });
    }

    // التحقق من أن المستخدم المراد حذفه موجود
    const [targetUsers] = await db.query(
      "SELECT id, name, email FROM users WHERE id = ?",
      [userId]
    );

    if (targetUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: "المستخدم غير موجود",
      });
    }

    const targetUser = targetUsers[0];

    // منع حذف حساب الأدمن نفسه
    if (admin.id === targetUser.id) {
      return res.status(403).json({
        success: false,
        message: "لا يمكنك حذف حسابك الخاص",
      });
    }

    // حذف بيانات المستخدم من الجداول المرتبطة
    await db.query("DELETE FROM user_sessions WHERE user_id = ?", [userId]);
    await db.query("DELETE FROM user_permissions WHERE user_id = ?", [userId]);
    await db.query("DELETE FROM user_activity_log WHERE user_id = ?", [userId]);
    await db.query("DELETE FROM user_theme_settings WHERE user_id = ?", [userId]);
    
    // حذف المستخدم نفسه
    await db.query("DELETE FROM users WHERE id = ?", [userId]);

    await addAuditLog(
      admin.name,
      `حذف حساب المستخدم: ${targetUser.name} (${targetUser.email})`,
      req
    );

    broadcastNotification(
      "🗑️ حذف حساب",
      `تم حذف حساب المستخدم ${targetUser.name} بواسطة ${admin.name}`,
      "warning",
      { userId: targetUser.id, deletedBy: admin.id }
    );

    res.json({
      success: true,
      message: "تم حذف الحساب بنجاح",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في حذف الحساب",
      error: error.message,
    });
  }
});

// POST - تفعيل حساب مستخدم
app.post("/api/activate-account", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: "البريد الإلكتروني مطلوب" });
  }

  try {
    await db.query(
      "UPDATE users SET account_status = 'active', is_active = true, is_approved = true WHERE email = ?",
      [email],
    );

    res.json({ success: true, message: "تم تفعيل الحساب بنجاح" });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "خطأ في تفعيل الحساب",
      error: error.message,
    });
  }
});

// ============================================================
// ========== 🗑️ حذف البيانات (Admin Only) ==========
// ============================================================

// POST - حذف بيانات محددة أو كل البيانات
app.post("/api/admin/delete-data", async (req, res) => {
  const { email, password, dataTypes } = req.body;

  if (!email || !password || !dataTypes || !Array.isArray(dataTypes)) {
    return res
      .status(400)
      .json({ success: false, message: "بيانات غير مكتملة" });
  }

  try {
    const [users] = await db.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (users.length === 0) {
      return res
        .status(401)
        .json({ success: false, message: "البريد الإلكتروني غير صحيح" });
    }

    const user = users[0];

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ success: false, message: "كلمة المرور غير صحيحة" });
    }

    if (user.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "غير مصرح لك بحذف البيانات" });
    }

    if (dataTypes.includes("all")) {
      // ✅ حذف كل شيء باستخدام TRUNCATE (أسرع وأنظف)
      console.log("🗑️ بدء حذف جميع البيانات...");
      
      // ⚡ تعطيل الـ foreign key checks مؤقتاً
      await db.query("SET FOREIGN_KEY_CHECKS = 0");
      
      const tablesToTruncate = [
        'return_items',
        'sale_invoice_items',
        'purchase_invoice_items',
        'sale_items',
        'purchase_items',
        'returns',
        'sale_invoices',
        'sales',
        'purchase_invoices',
        'purchases',
        'stock_transfers',
        'customer_payments',
        'customer_debts',
        'supplier_payments',
        'treasury',
        'stock',
        'product_packs',
        'products',
        'suppliers',
        'locations',
        'attendance',
        'notifications',
        'audit_log',
        'user_activity_log'
      ];
      
      for (const table of tablesToTruncate) {
        try {
          await db.query(`TRUNCATE TABLE ${table}`);
          console.log(`✅ تم مسح ${table}`);
        } catch (e) {
          console.log(`⚠️ ${table}:`, e.message);
        }
      }
      
      // مسح البيانات من جداول معينة بدون TRUNCATE (عشان نحتفظ بـ admin)
      try {
        await db.query("DELETE FROM customers WHERE id != 1");
        console.log("✅ تم حذف customers (ماعدا العميل الافتراضي)");
      } catch (e) { console.log("⚠️ customers:", e.message); }
      
      try {
        await db.query("DELETE FROM user_permissions WHERE user_id != 1");
        console.log("✅ تم حذف user_permissions (ماعدا المدير)");
      } catch (e) { console.log("⚠️ user_permissions:", e.message); }
      
      try {
        await db.query("DELETE FROM user_sessions WHERE user_id != 1");
        console.log("✅ تم حذف user_sessions (ماعدا المدير)");
      } catch (e) { console.log("⚠️ user_sessions:", e.message); }
      
      try {
        await db.query("DELETE FROM users WHERE id != 1");
        console.log("✅ تم حذف users (ماعدا المدير)");
      } catch (e) { console.log("⚠️ users:", e.message); }
      
      // ⚡ إعادة تفعيل الـ foreign key checks
      await db.query("SET FOREIGN_KEY_CHECKS = 1");
      
      // ⚡ التأكد من وجود بيانات Admin الأساسية
      try {
        // إعادة إنشاء صلاحيات المدير
        const [adminUser] = await db.query("SELECT id FROM users WHERE id = 1 LIMIT 1");
        if (adminUser.length > 0) {
          // إعادة إنشاء كل الصلاحيات للمدير
          const permissions = [
            'dashboard.view', 'products.view', 'products.create', 'products.edit', 'products.delete',
            'sales.view', 'sales.create', 'purchases.view', 'purchases.create',
            'customers.view', 'customers.create', 'customers.edit', 'customers.delete',
            'suppliers.view', 'suppliers.create', 'suppliers.edit', 'suppliers.delete',
            'stock.view', 'stock.transfer', 'reports.view', 'settings.view', 'settings.edit',
            'users.view', 'users.create', 'users.edit', 'users.delete'
          ];
          
          for (const permission of permissions) {
            try {
              await db.query(
                "INSERT IGNORE INTO user_permissions (user_id, permission) VALUES (?, ?)",
                [1, permission]
              );
            } catch (e) {
              console.log(`⚠️ Permission ${permission}:`, e.message);
            }
          }
          console.log("✅ تم إعادة إنشاء صلاحيات المدير");
        }
        
        // إعادة إنشاء العميل الافتراضي إذا تم حذفه
        const [defaultCustomer] = await db.query("SELECT id FROM customers WHERE id = 1 LIMIT 1");
        if (defaultCustomer.length === 0) {
          await db.query(
            "INSERT INTO customers (id, name, phone, balance, totalPurchases) VALUES (1, 'عميل نقدي', '', 0, 0)"
          );
          console.log("✅ تم إعادة إنشاء العميل الافتراضي");
        }
      } catch (e) {
        console.error("⚠️ Error restoring admin data:", e.message);
      }

      console.log("✅ انتهى حذف جميع البيانات!");
      
      await addAuditLog(user.name, "حذف جميع البيانات من النظام", req);

      return res.json({ success: true, message: "تم حذف جميع البيانات بنجاح!" });
    }

    for (let type of dataTypes) {
      switch (type) {
        case "sales":
          await db.query("DELETE FROM sale_invoices");
          await addAuditLog(user.name, "حذف جميع المبيعات", req);
          break;
        case "purchases":
          await db.query("DELETE FROM purchase_invoices");
          await addAuditLog(user.name, "حذف جميع المشتريات", req);
          break;
        case "products":
          await db.query("DELETE FROM products");
          await addAuditLog(user.name, "حذف جميع المنتجات", req);
          break;
        case "customers":
          await db.query("DELETE FROM customers WHERE id != 1");
          await addAuditLog(user.name, "حذف جميع العملاء", req);
          break;
        case "stock":
          await db.query("DELETE FROM stock");
          await addAuditLog(user.name, "حذف جميع بيانات المخزون", req);
          break;
      }
    }

    res.json({ success: true, message: "تم حذف البيانات المحددة بنجاح" });
  } catch (error) {
    console.error("Error in delete-data:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في حذف البيانات",
        error: error.message,
      });
  }
});

// POST - إنشاء نسخة احتياطية
app.post("/api/admin/backup", async (req, res) => {
  const { userId, email } = req.body;

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `backup_${timestamp}.json`;

    const [products] = await db.query("SELECT * FROM products");
    const [sales] = await db.query("SELECT * FROM sale_invoices");
    const [saleItems] = await db.query("SELECT * FROM sale_invoice_items");
    const [purchases] = await db.query("SELECT * FROM purchase_invoices");
    const [purchaseItems] = await db.query(
      "SELECT * FROM purchase_invoice_items",
    );
    const [customers] = await db.query("SELECT * FROM customers");
    const [suppliers] = await db.query("SELECT * FROM suppliers");
    const [stock] = await db.query("SELECT * FROM stock");
    const [locations] = await db.query("SELECT * FROM locations");
    const [users] = await db.query("SELECT id, name, email, role FROM users");
    const [returns] = await db.query("SELECT * FROM returns");
    const [returnItems] = await db.query("SELECT * FROM return_items");

    const backup = {
      timestamp: new Date().toISOString(),
      createdBy: email,
      data: {
        products,
        sales,
        saleItems,
        purchases,
        purchaseItems,
        customers,
        suppliers,
        stock,
        locations,
        users,
        returns,
        returnItems,
      },
    };

    const backupPath = path.join(__dirname, "backups");
    if (!fs.existsSync(backupPath)) {
      fs.mkdirSync(backupPath, { recursive: true });
    }

    fs.writeFileSync(
      path.join(backupPath, filename),
      JSON.stringify(backup, null, 2),
    );

    await addAuditLog(email, `إنشاء نسخة احتياطية: ${filename}`, req);

    res.json({
      success: true,
      message: "تم إنشاء النسخة الاحتياطية بنجاح",
      data: { filename },
    });
  } catch (error) {
    console.error("Error in backup:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في إنشاء النسخة الاحتياطية",
        error: error.message,
      });
  }
});

// ============================================================
// ========== 💰 API الخزنة (TREASURY) ==========
// ============================================================

// GET - Treasury transactions
app.get("/api/treasury", authenticateUser, async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;

    let query = "SELECT * FROM treasury WHERE 1=1";
    const params = [];

    if (startDate) {
      query += " AND date >= ?";
      params.push(startDate);
    }

    if (endDate) {
      query += " AND date <= ?";
      params.push(endDate);
    }

    if (type) {
      if (type === "deposit" || type === "sales") {
        query += " AND category = ?";
        params.push(type);
      } else if (type === "withdraw") {
        query += " AND category = ?";
        params.push(type);
      } else if (type === "initial") {
        query += " AND category = ?";
        params.push(type);
      } else {
        query += " AND type = ?";
        params.push(type);
      }
    }

    query += " ORDER BY date DESC, time DESC LIMIT 500";

    const [rows] = await db.query(query, params);

    const transformedRows = rows.map((row) => ({
      ...row,
      type: row.category || row.type,
      payment_method: row.payment_method,
      paymentMethod: row.payment_method,
      created_at: row.date + " " + (row.time || "00:00:00"),
    }));

    res.json({ success: true, data: transformedRows });
  } catch (error) {
    console.error("Error in /api/treasury:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في جلب حركات الخزنة",
      error: error.message,
    });
  }
});

// POST - Add treasury transaction
app.post("/api/treasury", authenticateUser, async (req, res) => {
  const {
    date,
    time,
    type,
    category,
    amount,
    description,
    paymentMethod,
    createdBy,
  } = req.body;

  if (!type || !amount) {
    return res.status(400).json({
      success: false,
      message: "النوع والمبلغ مطلوبان",
    });
  }

  try {
    let treasuryType = type;
    if (type === "deposit" || type === "sales") {
      treasuryType = "income";
    } else if (type === "withdraw") {
      treasuryType = "expense";
    }

    const [result] = await db.query(
      `INSERT INTO treasury (date, time, type, category, amount, description, payment_method, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        date || new Date().toISOString().slice(0, 10),
        time || new Date().toLocaleTimeString("en-GB", { hour12: false }),
        treasuryType,
        type,
        amount,
        description || "",
        paymentMethod || "cash",
        createdBy || req.user.name,
      ],
    );

    await addAuditLog(
      req.user.name,
      `إضافة حركة خزنة: ${type} - ${amount} جنيه`,
      req,
    );

    res.json({
      success: true,
      message: "تم إضافة الحركة بنجاح",
      data: { id: result.insertId },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "خطأ في إضافة الحركة",
      error: error.message,
    });
  }
});

// DELETE - Delete treasury transaction
app.delete("/api/treasury/:id", authenticateUser, async (req, res) => {
  try {
    const [transaction] = await db.query(
      "SELECT * FROM treasury WHERE id = ?",
      [req.params.id],
    );

    if (transaction.length === 0) {
      return res.status(404).json({
        success: false,
        message: "الحركة غير موجودة",
      });
    }

    await db.query("DELETE FROM treasury WHERE id = ?", [req.params.id]);

    await addAuditLog(
      req.user.name,
      `حذف حركة خزنة: ${transaction[0].type} - ${transaction[0].amount} جنيه`,
      req,
    );

    res.json({
      success: true,
      message: "تم حذف الحركة بنجاح",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "خطأ في حذف الحركة",
      error: error.message,
    });
  }
});

// GET - Treasury balance
app.get("/api/treasury/balance", authenticateUser, async (req, res) => {
  try {
    const [income] = await db.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM treasury WHERE type IN ('income', 'deposit')",
    );

    const [expense] = await db.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM treasury WHERE type IN ('expense', 'withdrawal')",
    );

    const balance = income[0].total - expense[0].total;

    res.json({
      success: true,
      data: {
        income: income[0].total,
        expense: expense[0].total,
        balance: balance,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "خطأ في حساب رصيد الخزنة",
      error: error.message,
    });
  }
});

// ============================================================
// ========== 📅 API الحضور والانصراف (ATTENDANCE) ==========
// ============================================================

// GET - Attendance records
app.get("/api/attendance", authenticateUser, async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;

    let query = "SELECT * FROM attendance WHERE 1=1";
    const params = [];

    if (startDate) {
      query += " AND date >= ?";
      params.push(startDate);
    }

    if (endDate) {
      query += " AND date <= ?";
      params.push(endDate);
    }

    if (userId) {
      query += " AND user_id = ?";
      params.push(userId);
    }

    query += " ORDER BY date DESC, check_in DESC";

    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error in /api/attendance:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في جلب سجلات الحضور",
      error: error.message,
    });
  }
});

// POST - Check in
app.post("/api/attendance/check-in", authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toLocaleTimeString("en-GB", { hour12: false });

    const [existing] = await db.query(
      "SELECT * FROM attendance WHERE user_id = ? AND date = ?",
      [userId, today],
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: "لقد سجلت حضورك اليوم بالفعل",
      });
    }

    await db.query(
      `INSERT INTO attendance (user_id, user_name, date, check_in, status)
       VALUES (?, ?, ?, ?, 'present')`,
      [userId, req.user.name, today, now],
    );

    res.json({
      success: true,
      message: "تم تسجيل الحضور بنجاح",
      data: { time: now },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "خطأ في تسجيل الحضور",
      error: error.message,
    });
  }
});

// POST - Check out
app.post("/api/attendance/check-out", authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toLocaleTimeString("en-GB", { hour12: false });

    const [existing] = await db.query(
      "SELECT * FROM attendance WHERE user_id = ? AND date = ?",
      [userId, today],
    );

    if (existing.length === 0) {
      return res.status(400).json({
        success: false,
        message: "يجب تسجيل الحضور أولاً",
      });
    }

    if (existing[0].check_out) {
      return res.status(400).json({
        success: false,
        message: "لقد سجلت الانصراف بالفعل",
      });
    }

    await db.query(
      "UPDATE attendance SET check_out = ? WHERE user_id = ? AND date = ?",
      [now, userId, today],
    );

    res.json({
      success: true,
      message: "تم تسجيل الانصراف بنجاح",
      data: { time: now },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "خطأ في تسجيل الانصراف",
      error: error.message,
    });
  }
});

// ============================================================
// ========== 📊 API التقارير (REPORTS) ==========
// ============================================================

// GET - Dashboard statistics
app.get("/api/reports/dashboard", authenticateUser, async (req, res) => {
  try {
    const [productsCount] = await db.query(
      "SELECT COUNT(*) as count FROM products",
    );

    const today = new Date().toISOString().slice(0, 10);
    const [todaySales] = await db.query(
      "SELECT COALESCE(SUM(total), 0) as total FROM sale_invoices WHERE date = ?",
      [today],
    );

    const [customersCount] = await db.query(
      "SELECT COUNT(*) as count FROM customers",
    );

    const [lowStock] = await db.query(`
      SELECT COUNT(DISTINCT p.id) as count 
      FROM products p 
      LEFT JOIN stock s ON p.id = s.productId 
      WHERE COALESCE(s.quantity, 0) < p.minStock
    `);

    const [topProducts] = await db.query(`
      SELECT 
        p.name,
        SUM(sii.quantity) as totalSold,
        SUM(sii.quantity * sii.price) as totalRevenue
      FROM sale_invoice_items sii
      JOIN products p ON sii.productId = p.id
      JOIN sale_invoices si ON sii.invoiceId = si.id
      WHERE MONTH(si.date) = MONTH(CURRENT_DATE) 
        AND YEAR(si.date) = YEAR(CURRENT_DATE)
      GROUP BY p.id, p.name
      ORDER BY totalSold DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        productsCount: productsCount[0].count,
        todaySales: todaySales[0].total,
        customersCount: customersCount[0].count,
        lowStockCount: lowStock[0].count,
        topProducts: topProducts,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "خطأ في جلب الإحصائيات",
      error: error.message,
    });
  }
});

// ============================================================
// ========== ❌ Error Handlers ==========
// ============================================================

// ============================================================
// ========== ⚡ Optimized APIs (v2) - محسّنة للأداء ==========
// ============================================================

const optimizedRoutes = require('./optimized-endpoints');

// ============================================================
// ========== 🔗 Mount v2 APIs on both /api/v2 and /api routes ==========
// ============================================================
// Mount on /api/v2 (preferred, with v2 prefix)
app.use('/api/v2', optimizedRoutes);

// Mount on /api (backward compatibility, without v2 prefix)
app.use('/api', optimizedRoutes);

console.log('✅ Optimized APIs (v2) loaded successfully');
console.log('✅ API routes available on both /api and /api/v2');

// ========== 🔧 Fix Missing Columns Endpoint ==========
app.get('/api/admin/fix-columns', requireAdmin, async (req, res) => {
  try {
    console.log('🔧 بدء إصلاح الأعمدة الناقصة...');
    
    const columnsToAdd = [
      { name: 'seller', sql: 'ALTER TABLE sale_invoices ADD COLUMN seller VARCHAR(255) AFTER createdBy' },
      { name: 'time', sql: 'ALTER TABLE sale_invoices ADD COLUMN time VARCHAR(20) AFTER date' },
      { name: 'subtotal', sql: 'ALTER TABLE sale_invoices ADD COLUMN subtotal DECIMAL(10,2) DEFAULT 0 AFTER seller' },
      { name: 'wholesaleDiscount', sql: 'ALTER TABLE sale_invoices ADD COLUMN wholesaleDiscount DECIMAL(10,2) DEFAULT 0 AFTER subtotal' },
      { name: 'extraDiscount', sql: 'ALTER TABLE sale_invoices ADD COLUMN extraDiscount DECIMAL(10,2) DEFAULT 0 AFTER wholesaleDiscount' },
      { name: 'paid', sql: 'ALTER TABLE sale_invoices ADD COLUMN paid DECIMAL(10,2) DEFAULT 0 AFTER total' },
      { name: 'change', sql: 'ALTER TABLE sale_invoices ADD COLUMN `change` DECIMAL(10,2) DEFAULT 0 AFTER paid' },
      { name: 'paymentMethod', sql: 'ALTER TABLE sale_invoices ADD COLUMN paymentMethod VARCHAR(50) AFTER `change`' },
      { name: 'transactionNumber', sql: 'ALTER TABLE sale_invoices ADD COLUMN transactionNumber VARCHAR(100) AFTER paymentMethod' },
      { name: 'deliveryMethod', sql: 'ALTER TABLE sale_invoices ADD COLUMN deliveryMethod VARCHAR(50) AFTER transactionNumber' },
      { name: 'deliveryAddress', sql: 'ALTER TABLE sale_invoices ADD COLUMN deliveryAddress TEXT AFTER deliveryMethod' }
    ];

    let added = 0;
    let skipped = 0;
    let errors = [];

    for (const col of columnsToAdd) {
      try {
        await db.pool.query(col.sql);
        console.log(`✅ ${col.name} - تمت الإضافة`);
        added++;
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`⏭️ ${col.name} - موجود بالفعل`);
          skipped++;
        } else {
          console.error(`❌ ${col.name} - خطأ: ${error.message}`);
          errors.push({ column: col.name, error: error.message });
        }
      }
    }

    // Update default values
    const [updateResult] = await db.pool.query(`
      UPDATE sale_invoices 
      SET 
        paid = IFNULL(paid, total),
        subtotal = IFNULL(subtotal, total),
        wholesaleDiscount = IFNULL(wholesaleDiscount, 0),
        extraDiscount = IFNULL(extraDiscount, 0),
        seller = IFNULL(seller, createdBy),
        \`change\` = IFNULL(\`change\`, 0),
        paymentMethod = IFNULL(paymentMethod, 'cash'),
        time = IFNULL(time, '00:00:00')
      WHERE paid IS NULL OR seller IS NULL OR subtotal IS NULL
    `);

    console.log(`✅ تم تحديث ${updateResult.affectedRows} سجل`);

    res.json({
      success: true,
      message: 'تم إصلاح الأعمدة بنجاح',
      details: {
        added,
        skipped,
        updated: updateResult.affectedRows,
        errors: errors.length > 0 ? errors : null
      }
    });
  } catch (error) {
    console.error('❌ خطأ في إصلاح الأعمدة:', error);
    res.status(500).json({ error: error.message });
  }
});

// 404 Handler
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

// ============================================================
// ========== 🚀 تشغيل السيرفر ==========
// ============================================================

const PORT = process.env.PORT || 5000;

// ⚠️ ملحوظة مهمة: لا تضع route "/" هنا قبل تشغيل السيرفر
// اترك express.static يتعامل مع الملفات أولاً

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 السيرفر شغال على http://localhost:${PORT}`);
  console.log(`🔌 WebSocket شغال على ws://localhost:8080`);
  console.log(`📁 Frontend path: ${frontEndPath}`);
  console.log(`\n⚡ ========== تحسينات الأداء مُفعّلة ========== ⚡`);
  console.log(`✅ Database Indexing: مُفعّل (30+ indexes)`);
  console.log(`✅ Response Compression: مُفعّل (gzip - يوفر 70% من حجم البيانات)`);
  console.log(`✅ In-Memory Caching: مُفعّل (500 مدخل، TTL: 5 دقائق)`);
  console.log(`✅ Pagination APIs (v2): مُفعّل (/api/v2/*)`);
  console.log(`📊 Cache Stats: http://localhost:${PORT}/api/cache/stats`);
  console.log(`🗑️ Clear Cache: POST http://localhost:${PORT}/api/cache/clear`);
  console.log(`\n💡 التحسين المتوقع: 50-100X أسرع من قبل! 🔥\n`);
  console.log(`📡 اختبر الرابط: http://localhost:${PORT}/api/test`);
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
  console.log(`\n🎨 API الثيمات:`);
  console.log(
    `   GET إعدادات الثيم: http://localhost:${PORT}/api/user-theme/:userId`,
  );
  console.log(`   POST حفظ الثيم: http://localhost:${PORT}/api/user-theme`);
  console.log(
    `   POST إعادة تعيين الثيم: http://localhost:${PORT}/api/user-theme/reset/:userId`,
  );
  console.log(
    `   POST تطبيق الثيم للجميع: http://localhost:${PORT}/api/user-theme/apply-all`,
  );
  console.log(`\n📦 API المنتجات مع وحدات التعبئة:`);
  console.log(
    `   GET المنتجات مع الوحدات: http://localhost:${PORT}/api/products`,
  );
  console.log(
    `   GET وحدات التعبئة: http://localhost:${PORT}/api/product-packs`,
  );
  console.log(`   POST إضافة منتج: http://localhost:${PORT}/api/products`);
  console.log(`   PUT تعديل منتج: http://localhost:${PORT}/api/products/:id`);
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
  console.log(`\n💰 API الخزنة:`);
  console.log(`   GET الحركات: http://localhost:${PORT}/api/treasury`);
  console.log(`   POST إضافة حركة: http://localhost:${PORT}/api/treasury`);
  console.log(`   DELETE حذف حركة: http://localhost:${PORT}/api/treasury/:id`);
  console.log(`   GET الرصيد: http://localhost:${PORT}/api/treasury/balance`);
  console.log(`\n🔐 API الصلاحيات (مضافة حديثاً):`);
  console.log(
    `   GET صلاحيات مستخدم: http://localhost:${PORT}/api/user-permissions/:userId`,
  );
  console.log(
    `   POST حفظ صلاحيات: http://localhost:${PORT}/api/save-user-permissions`,
  );
  console.log(
    `   GET قائمة الصلاحيات: http://localhost:${PORT}/api/permissions/list`,
  );
  console.log(`\n📅 API الحضور والانصراف:`);
  console.log(`   GET السجلات: http://localhost:${PORT}/api/attendance`);
  console.log(
    `   POST تسجيل حضور: http://localhost:${PORT}/api/attendance/check-in`,
  );
  console.log(
    `   POST تسجيل انصراف: http://localhost:${PORT}/api/attendance/check-out`,
  );

  // ================================================================
  // 🔄 START KEEP-ALIVE SERVICE
  // ================================================================
  console.log(`\n🔄 ========== KEEP-ALIVE SERVICE ========== 🔄`);
  keepAliveService.start();
  console.log(`✅ السيرفر الآن محمي ضد Sleep Mode!`);
  console.log(`🔍 راقب الحالة: http://localhost:${PORT}/api/health`);
  console.log(`📊 إحصائيات Keep-Alive: http://localhost:${PORT}/api/keep-alive/stats`);
});