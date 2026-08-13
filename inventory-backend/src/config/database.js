// src/config/database.js
const mysql = require("mysql2/promise");
require("dotenv").config();

const DB_NAME = process.env.DB_NAME || "inventory_system";

// دالة لإنشاء قاعدة البيانات إذا لم تكن موجودة
async function createDatabaseIfNotExists() {
  const connectionWithoutDB = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    charset: "utf8mb4",
  });

  try {
    await connectionWithoutDB.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    console.log(`✅ قاعدة البيانات "${DB_NAME}" جاهزة`);
  } catch (error) {
    console.error("❌ خطأ في إنشاء قاعدة البيانات:", error.message);
    throw error;
  } finally {
    await connectionWithoutDB.end();
  }
}

// إعداد اتصال قاعدة البيانات المحلي (Localhost)
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
});

// دالة اختبار الاتصال
async function testConnection() {
  try {
    // أولاً: إنشاء قاعدة البيانات إذا لم تكن موجودة
    await createDatabaseIfNotExists();

    // ثانياً: اختبار الاتصال بقاعدة البيانات
    const connection = await pool.getConnection();
    console.log("✅ اتصال قاعدة البيانات ناجح!");
    console.log(`📊 قاعدة البيانات: ${DB_NAME}`);
    connection.release();
    return true;
  } catch (error) {
    console.error("❌ فشل اتصال قاعدة البيانات:", error.message);
    console.error("💡 تأكد من:");
    console.error("   1. MySQL Server يعمل على المنفذ 3306");
    console.error("   2. بيانات المستخدم صحيحة في ملف .env");
    console.error("   3. المستخدم لديه صلاحيات إنشاء قواعد البيانات");
    return false;
  }
}

// ============================================================
// 📦 دوال إضافية للتعامل مع قاعدة البيانات
// ============================================================

// دالة لتنفيذ استعلام مع параметры
async function query(sql, params = []) {
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (error) {
    console.error("❌ خطأ في تنفيذ الاستعلام:", error.message);
    console.error("📝 SQL:", sql);
    console.error("📦 Parameters:", params);
    throw error;
  }
}

// دالة لتنفيذ استعلام وإرجاع أول صف
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// دالة لتنفيذ استعلام وإرجاع عدد الصفوف المتأثرة
async function execute(sql, params = []) {
  try {
    const [result] = await pool.execute(sql, params);
    return result;
  } catch (error) {
    console.error("❌ خطأ في تنفيذ الاستعلام:", error.message);
    console.error("📝 SQL:", sql);
    console.error("📦 Parameters:", params);
    throw error;
  }
}

// دالة للحصول على اتصال من الـ Pool (للمعاملات)
async function getConnection() {
  return await pool.getConnection();
}

// دالة لبدء معاملة
async function beginTransaction(connection) {
  await connection.beginTransaction();
}

// دالة لتأكيد معاملة
async function commit(connection) {
  await connection.commit();
}

// دالة للتراجع عن معاملة
async function rollback(connection) {
  await connection.rollback();
}

// دالة لإغلاق الـ Pool
async function closePool() {
  await pool.end();
  console.log("🔒 تم إغلاق اتصال قاعدة البيانات");
}

// دالة لفحص صحة الاتصال
async function healthCheck() {
  try {
    const connection = await pool.getConnection();
    connection.release();
    return { status: "healthy", database: DB_NAME };
  } catch (error) {
    return { status: "unhealthy", error: error.message };
  }
}

// تصدير الدوال
module.exports = {
  pool,
  testConnection,
  query,
  queryOne,
  execute,
  getConnection,
  beginTransaction,
  commit,
  rollback,
  closePool,
  healthCheck,
  DB_NAME,
};
