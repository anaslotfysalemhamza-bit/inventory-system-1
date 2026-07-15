// src/config/database.js
const mysql = require("mysql2/promise");
require('dotenv').config();

const DB_NAME = process.env.DB_NAME || "inventory_system";

// دالة لإنشاء قاعدة البيانات إذا لم تكن موجودة
async function createDatabaseIfNotExists() {
  const connectionWithoutDB = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    charset: 'utf8mb4'
  });

  try {
    await connectionWithoutDB.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
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
  charset: 'utf8mb4'
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

module.exports = { pool, testConnection };