/**
 * 🚀 Database Permanent Optimization
 * تحسين دائم لقاعدة البيانات - يعمل مع كل تشغيل
 */

const { pool: db } = require('./database');

async function optimizeDatabase() {
    console.log('\n🔧 ========== بدء تحسين قاعدة البيانات ========== 🔧');
    
    try {
        // ========== 1. إنشاء Indexes الأساسية ==========
        console.log('📊 إنشاء Indexes...');
        
        const indexes = [
            // Products indexes
            'CREATE INDEX IF NOT EXISTS idx_products_code ON products(code)',
            'CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)',
            'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)',
            'CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active)',
            
            // Stock indexes
            'CREATE INDEX IF NOT EXISTS idx_stock_productId ON stock(productId)',
            'CREATE INDEX IF NOT EXISTS idx_stock_locationId ON stock(locationId)',
            'CREATE INDEX IF NOT EXISTS idx_stock_product_location ON stock(productId, locationId)',
            
            // Sale invoices indexes
            'CREATE INDEX IF NOT EXISTS idx_sale_invoices_date ON sale_invoices(date)',
            'CREATE INDEX IF NOT EXISTS idx_sale_invoices_customer ON sale_invoices(customer)',
            'CREATE INDEX IF NOT EXISTS idx_sale_invoices_number ON sale_invoices(invoiceNumber)',
            'CREATE INDEX IF NOT EXISTS idx_sale_invoices_date_desc ON sale_invoices(date DESC)',
            
            // Sale invoice items indexes
            'CREATE INDEX IF NOT EXISTS idx_sale_items_invoiceId ON sale_invoice_items(invoiceId)',
            'CREATE INDEX IF NOT EXISTS idx_sale_items_productId ON sale_invoice_items(productId)',
            
            // Purchase invoices indexes
            'CREATE INDEX IF NOT EXISTS idx_purchase_invoices_date ON purchase_invoices(date)',
            'CREATE INDEX IF NOT EXISTS idx_purchase_invoices_supplier ON purchase_invoices(supplier)',
            'CREATE INDEX IF NOT EXISTS idx_purchase_invoices_number ON purchase_invoices(invoiceNumber)',
            
            // Purchase invoice items indexes
            'CREATE INDEX IF NOT EXISTS idx_purchase_items_invoiceId ON purchase_invoice_items(invoiceId)',
            'CREATE INDEX IF NOT EXISTS idx_purchase_items_productId ON purchase_invoice_items(productId)',
            
            // Customers indexes
            'CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name)',
            'CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone)',
            'CREATE INDEX IF NOT EXISTS idx_customers_balance ON customers(balance)',
            
            // Suppliers indexes
            'CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name)',
            'CREATE INDEX IF NOT EXISTS idx_suppliers_phone ON suppliers(phone)',
            
            // Audit log indexes
            'CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_log(date DESC)',
            'CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user)',
            
            // User activity log indexes
            'CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity_log(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_user_activity_timestamp ON user_activity_log(timestamp DESC)',
            
            // Customer debts indexes
            'CREATE INDEX IF NOT EXISTS idx_customer_debts_customerId ON customer_debts(customerId)',
            'CREATE INDEX IF NOT EXISTS idx_customer_debts_date ON customer_debts(date)',
            
            // Customer payments indexes
            'CREATE INDEX IF NOT EXISTS idx_customer_payments_customerId ON customer_payments(customerId)',
            // 'CREATE INDEX IF NOT EXISTS idx_customer_payments_date ON customer_payments(paymentDate)', // Column doesn't exist
            
            // Users indexes
            'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
            'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
            'CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status)',
            
            // Treasury indexes
            'CREATE INDEX IF NOT EXISTS idx_treasury_date ON treasury(date)',
            'CREATE INDEX IF NOT EXISTS idx_treasury_type ON treasury(type)',
            'CREATE INDEX IF NOT EXISTS idx_treasury_category ON treasury(category)',
            
            // Attendance indexes
            'CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date)',
            
            // Stock transfers indexes
            'CREATE INDEX IF NOT EXISTS idx_stock_transfers_date ON stock_transfers(date)',
            'CREATE INDEX IF NOT EXISTS idx_stock_transfers_from ON stock_transfers(fromLocationId)',
            'CREATE INDEX IF NOT EXISTS idx_stock_transfers_to ON stock_transfers(toLocationId)',
        ];
        
        let createdCount = 0;
        let existingCount = 0;
        
        for (const indexQuery of indexes) {
            try {
                await db.query(indexQuery);
                createdCount++;
            } catch (error) {
                // Index already exists
                if (error.code === 'ER_DUP_KEYNAME') {
                    existingCount++;
                } else {
                    console.error(`خطأ في إنشاء index: ${error.message}`);
                }
            }
        }
        
        console.log(`✅ تم إنشاء ${createdCount} index جديد`);
        console.log(`ℹ️  ${existingCount} index موجود مسبقاً`);
        
        // ========== 2. تحسين جداول MySQL ==========
        console.log('\n🔧 تحسين الجداول...');
        
        const tables = [
            'products', 'stock', 'sale_invoices', 'sale_invoice_items',
            'purchase_invoices', 'purchase_invoice_items', 'customers',
            'suppliers', 'audit_log', 'users', 'customer_debts',
            'customer_payments', 'treasury', 'attendance', 'stock_transfers'
        ];
        
        for (const table of tables) {
            try {
                await db.query(`OPTIMIZE TABLE ${table}`);
                console.log(`  ✓ ${table}`);
            } catch (error) {
                // Ignore errors for non-existent tables
            }
        }
        
        // ========== 3. تحليل الجداول لتحديث الإحصائيات ==========
        console.log('\n📈 تحليل الجداول...');
        
        for (const table of tables) {
            try {
                await db.query(`ANALYZE TABLE ${table}`);
            } catch (error) {
                // Ignore errors
            }
        }
        
        console.log('✅ اكتمل التحليل');
        
        // ========== 4. تحديد ROW_FORMAT لتحسين الأداء ==========
        console.log('\n⚙️  تحديث ROW_FORMAT...');
        
        for (const table of tables) {
            try {
                await db.query(`ALTER TABLE ${table} ROW_FORMAT=DYNAMIC`);
            } catch (error) {
                // Ignore errors
            }
        }
        
        console.log('✅ تم تحديث ROW_FORMAT');
        
        // ========== 5. عرض إحصائيات الأداء ==========
        console.log('\n📊 إحصائيات قاعدة البيانات:');
        
        try {
            const [dbSize] = await db.query(`
                SELECT 
                    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
                FROM information_schema.tables 
                WHERE table_schema = DATABASE()
            `);
            
            const [tableCount] = await db.query(`
                SELECT COUNT(*) as count 
                FROM information_schema.tables 
                WHERE table_schema = DATABASE()
            `);
            
            const [indexCount] = await db.query(`
                SELECT COUNT(*) as count 
                FROM information_schema.statistics 
                WHERE table_schema = DATABASE()
            `);
            
            console.log(`  📦 حجم قاعدة البيانات: ${dbSize[0].size_mb} MB`);
            console.log(`  📋 عدد الجداول: ${tableCount[0].count}`);
            console.log(`  🔍 عدد Indexes: ${indexCount[0].count}`);
            
        } catch (error) {
            console.log('  ℹ️  لم يتم الحصول على الإحصائيات');
        }
        
        console.log('\n✅ ========== اكتمل تحسين قاعدة البيانات ========== ✅\n');
        
        return true;
        
    } catch (error) {
        console.error('❌ خطأ في تحسين قاعدة البيانات:', error.message);
        return false;
    }
}

module.exports = { optimizeDatabase };
