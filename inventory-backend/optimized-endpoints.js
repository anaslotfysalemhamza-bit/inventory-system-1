// ============================================================
// ⚡ Optimized Endpoints - النسخة الاحترافية المحسّنة
// ============================================================
// الميزات:
// ✅ معالجة أخطاء شاملة
// ✅ Pagination محسّنة
// ✅ SQL Injection Protection
// ✅ Performance Optimization
// ✅ توافق كامل مع جميع الصفحات
// ✅ تعليقات واضحة ومفصلة
// ============================================================

const express = require('express');
const router = express.Router();
const { pool: db } = require('./src/config/database');

// ============================================================
// 🛠️ Helper Functions - دوال مساعدة
// ============================================================

/**
 * بناء WHERE clause آمن مع parameters
 * @param {Object} filters - المرشحات المطلوبة
 * @returns {Object} - { whereClause, params }
 */
function buildWhereClause(filters) {
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (filters.search) {
        whereClause += ` AND (${filters.searchFields.map(() => '?').join(' LIKE ? OR ')} LIKE ?)`;
        filters.searchFields.forEach(() => {
            params.push(`%${filters.search}%`);
        });
    }

    if (filters.category) {
        whereClause += ' AND category = ?';
        params.push(filters.category);
    }

    if (filters.locationId) {
        whereClause += ' AND locationId = ?';
        params.push(filters.locationId);
    }

    if (filters.startDate) {
        whereClause += ' AND date >= ?';
        params.push(filters.startDate);
    }

    if (filters.endDate) {
        whereClause += ' AND date <= ?';
        params.push(filters.endDate);
    }

    if (filters.status) {
        whereClause += ' AND status = ?';
        params.push(filters.status);
    }

    return { whereClause, params };
}

/**
 * معالجة الـ Pagination
 * @param {Object} query - req.query
 * @returns {Object} - { page, limit, offset }
 */
function getPagination(query) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.max(1, Math.min(1000, parseInt(query.limit) || 50));
    const offset = (page - 1) * limit;
    
    return { page, limit, offset };
}

/**
 * بناء استجابة Pagination
 * @param {number} page - رقم الصفحة
 * @param {number} limit - عدد العناصر
 * @param {number} total - إجمالي العناصر
 * @returns {Object}
 */
function buildPaginationResponse(page, limit, total) {
    return {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
    };
}

/**
 * معالجة الأخطاء بشكل موحد
 * @param {Error} error 
 * @param {Response} res 
 * @param {string} message 
 */
function handleError(error, res, message) {
    console.error(`❌ Error: ${message}`, error);
    res.status(500).json({
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? error.message : 'حدث خطأ في الخادم'
    });
}

// ============================================================
// 📦 GET /api/optimized/products - المنتجات مع Pagination
// ============================================================
router.get('/products', async (req, res) => {
    try {
        const { page, limit, offset } = getPagination(req.query);
        const search = req.query.search?.trim() || '';
        const category = req.query.category?.trim() || '';

        // بناء WHERE clause
        const { whereClause, params } = buildWhereClause({
            search,
            searchFields: ['p.name', 'p.code', 'p.barcode'],
            category
        });

        // جلب العدد الإجمالي
        const [countResult] = await db.query(
            `SELECT COUNT(DISTINCT p.id) as total FROM products p ${whereClause}`,
            params
        );
        const total = countResult[0]?.total || 0;

        // جلب المنتجات مع المخزون
        const [products] = await db.query(
            `SELECT 
                p.*,
                COALESCE(SUM(s.quantity), 0) as totalStock,
                GROUP_CONCAT(DISTINCT CONCAT(l.id, ':', l.name, ':', COALESCE(s.quantity, 0)) SEPARATOR '|') as stockByLocation
            FROM products p
            LEFT JOIN stock s ON p.id = s.productId
            LEFT JOIN locations l ON s.locationId = l.id
            ${whereClause}
            GROUP BY p.id
            ORDER BY p.id DESC
            LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        // جلب الـ Packs لكل منتج
        const productIds = products.map(p => p.id);
        let packs = [];
        
        if (productIds.length > 0) {
            const placeholders = productIds.map(() => '?').join(',');
            const [packsResult] = await db.query(
                `SELECT * FROM product_packs WHERE productId IN (${placeholders}) ORDER BY productId, id ASC`,
                productIds
            );
            packs = packsResult;
        }

        // ربط الـ Packs بالمنتجات
        products.forEach(product => {
            product.packs = packs.filter(pack => pack.productId === product.id);
            
            // تحويل stockByLocation لـ Array
            if (product.stockByLocation) {
                product.stockLocations = product.stockByLocation.split('|').map(item => {
                    const [id, name, qty] = item.split(':');
                    return { locationId: parseInt(id), locationName: name, quantity: parseInt(qty) };
                });
            } else {
                product.stockLocations = [];
            }
            delete product.stockByLocation;
        });

        res.json({
            success: true,
            data: products,
            pagination: buildPaginationResponse(page, limit, total)
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب المنتجات');
    }
});

// ============================================================
// 📊 GET /api/optimized/sales - المبيعات مع Pagination
// ============================================================
router.get('/sales', async (req, res) => {
    try {
        const { page, limit, offset } = getPagination(req.query);
        const search = req.query.search?.trim() || '';
        const startDate = req.query.startDate?.trim() || '';
        const endDate = req.query.endDate?.trim() || '';
        const customerId = req.query.customerId || '';

        // بناء WHERE clause
        let whereClause = 'WHERE 1=1';
        const params = [];

        if (search) {
            whereClause += ' AND (invoiceNumber LIKE ? OR customer LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        if (startDate) {
            whereClause += ' AND date >= ?';
            params.push(startDate);
        }

        if (endDate) {
            whereClause += ' AND date <= ?';
            params.push(endDate);
        }

        if (customerId) {
            whereClause += ' AND customerId = ?';
            params.push(customerId);
        }

        // جلب العدد الإجمالي
        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM sale_invoices ${whereClause}`,
            params
        );
        const total = countResult[0]?.total || 0;

        // جلب الفواتير
        const [invoices] = await db.query(
            `SELECT * FROM sale_invoices ${whereClause} 
            ORDER BY id DESC, date DESC 
            LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        // جلب items لكل فاتورة
        const invoiceIds = invoices.map(inv => inv.id);
        let items = [];

        if (invoiceIds.length > 0) {
            const placeholders = invoiceIds.map(() => '?').join(',');
            const [itemsResult] = await db.query(
                `SELECT 
                    sii.*,
                    p.name as productName,
                    p.code as productCode
                FROM sale_invoice_items sii
                LEFT JOIN products p ON sii.productId = p.id
                WHERE sii.invoiceId IN (${placeholders})
                ORDER BY sii.id ASC`,
                invoiceIds
            );
            items = itemsResult;
        }

        // ربط items بالفواتير
        invoices.forEach(invoice => {
            invoice.items = items.filter(item => item.invoiceId === invoice.id);
            
            // تحويل القيم النصية لأرقام
            invoice.total = parseFloat(invoice.total || 0);
            invoice.paid = parseFloat(invoice.paid || 0);
            invoice.discount = parseFloat(invoice.discount || 0);
            invoice.remaining = invoice.total - invoice.paid;
        });

        res.json({
            success: true,
            data: invoices,
            pagination: buildPaginationResponse(page, limit, total)
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب المبيعات');
    }
});

// ============================================================
// 🛒 GET /api/optimized/purchases - المشتريات مع Pagination
// ============================================================
router.get('/purchases', async (req, res) => {
    try {
        const { page, limit, offset } = getPagination(req.query);
        const search = req.query.search?.trim() || '';
        const startDate = req.query.startDate?.trim() || '';
        const endDate = req.query.endDate?.trim() || '';

        // بناء WHERE clause
        let whereClause = 'WHERE 1=1';
        const params = [];

        if (search) {
            whereClause += ' AND (invoiceNumber LIKE ? OR supplier LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        if (startDate) {
            whereClause += ' AND date >= ?';
            params.push(startDate);
        }

        if (endDate) {
            whereClause += ' AND date <= ?';
            params.push(endDate);
        }

        // جلب العدد الإجمالي
        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM purchase_invoices ${whereClause}`,
            params
        );
        const total = countResult[0]?.total || 0;

        // جلب فواتير المشتريات
        const [purchases] = await db.query(
            `SELECT * FROM purchase_invoices ${whereClause} 
            ORDER BY id DESC, date DESC 
            LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        // جلب items لكل فاتورة
        const purchaseIds = purchases.map(p => p.id);
        let items = [];

        if (purchaseIds.length > 0) {
            const placeholders = purchaseIds.map(() => '?').join(',');
            const [itemsResult] = await db.query(
                `SELECT 
                    pii.*,
                    p.name as productName,
                    p.code as productCode
                FROM purchase_invoice_items pii
                LEFT JOIN products p ON pii.productId = p.id
                WHERE pii.invoiceId IN (${placeholders})
                ORDER BY pii.id ASC`,
                purchaseIds
            );
            items = itemsResult;
        }

        // ربط items بالفواتير
        purchases.forEach(purchase => {
            purchase.items = items.filter(item => item.invoiceId === purchase.id);
            purchase.total = parseFloat(purchase.total || 0);
        });

        res.json({
            success: true,
            data: purchases,
            pagination: buildPaginationResponse(page, limit, total)
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب المشتريات');
    }
});

// ============================================================
// 🏪 GET /api/optimized/stock - المخزون مع Pagination
// ============================================================
router.get('/stock', async (req, res) => {
    try {
        const { page, limit, offset } = getPagination(req.query);
        const search = req.query.search?.trim() || '';
        const locationId = req.query.locationId || '';
        const lowStockOnly = req.query.lowStockOnly === 'true';

        // بناء WHERE clause
        let whereClause = 'WHERE 1=1';
        const params = [];

        if (search) {
            whereClause += ' AND (p.name LIKE ? OR p.code LIKE ? OR p.barcode LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (locationId) {
            whereClause += ' AND s.locationId = ?';
            params.push(locationId);
        }

        // استعلام المخزون
        const baseQuery = `
            SELECT 
                p.id,
                p.code,
                p.name,
                p.category,
                p.sellingPrice,
                p.costPrice,
                COALESCE(SUM(s.quantity), 0) as totalStock,
                GROUP_CONCAT(DISTINCT CONCAT(l.id, ':', l.name, ':', COALESCE(s.quantity, 0)) SEPARATOR '|') as stockByLocation
            FROM products p
            LEFT JOIN stock s ON p.id = s.productId
            LEFT JOIN locations l ON s.locationId = l.id
            ${whereClause}
            GROUP BY p.id
        `;

        // إضافة شرط المخزون المنخفض إذا لزم الأمر
        const havingClause = lowStockOnly ? ' HAVING totalStock <= 5' : '';

        // جلب العدد الإجمالي
        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM (${baseQuery} ${havingClause}) as stock_count`,
            params
        );
        const total = countResult[0]?.total || 0;

        // جلب بيانات المخزون
        const [stockData] = await db.query(
            `${baseQuery} ${havingClause}
            ORDER BY p.name ASC
            LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        // معالجة البيانات
        stockData.forEach(item => {
            item.totalStock = parseFloat(item.totalStock || 0);
            item.sellingPrice = parseFloat(item.sellingPrice || 0);
            item.costPrice = parseFloat(item.costPrice || 0);
            item.stockValue = item.totalStock * item.costPrice;
            item.isLowStock = item.totalStock <= 5;
            
            // تحويل stockByLocation لـ Array
            if (item.stockByLocation) {
                item.stockLocations = item.stockByLocation.split('|').map(loc => {
                    const [id, name, qty] = loc.split(':');
                    return { 
                        locationId: parseInt(id), 
                        locationName: name, 
                        quantity: parseInt(qty) || 0 
                    };
                });
            } else {
                item.stockLocations = [];
            }
            delete item.stockByLocation;
        });

        res.json({
            success: true,
            data: stockData,
            pagination: buildPaginationResponse(page, limit, total)
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب المخزون');
    }
});

// ============================================================
// 👥 GET /api/optimized/customers - العملاء مع Pagination
// ============================================================
router.get('/customers', async (req, res) => {
    try {
        const { page, limit, offset } = getPagination(req.query);
        const search = req.query.search?.trim() || '';

        // بناء WHERE clause
        let whereClause = 'WHERE 1=1';
        const params = [];

        if (search) {
            whereClause += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        // جلب العدد الإجمالي
        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM customers ${whereClause}`,
            params
        );
        const total = countResult[0]?.total || 0;

        // جلب العملاء مع البيانات المالية
        const [customers] = await db.query(
            `SELECT 
                c.*,
                COALESCE(SUM(si.total), 0) as totalPurchases,
                COALESCE(SUM(si.paid), 0) as totalPaid,
                COALESCE(SUM(si.total - si.paid), 0) as balance
            FROM customers c
            LEFT JOIN sale_invoices si ON c.id = si.customerId
            ${whereClause}
            GROUP BY c.id
            ORDER BY c.name ASC
            LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        // معالجة البيانات
        customers.forEach(customer => {
            customer.totalPurchases = parseFloat(customer.totalPurchases || 0);
            customer.totalPaid = parseFloat(customer.totalPaid || 0);
            customer.balance = parseFloat(customer.balance || 0);
        });

        res.json({
            success: true,
            data: customers,
            pagination: buildPaginationResponse(page, limit, total)
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب العملاء');
    }
});

// ============================================================
// 🏢 GET /api/optimized/suppliers - الموردين مع Pagination
// ============================================================
router.get('/suppliers', async (req, res) => {
    try {
        const { page, limit, offset } = getPagination(req.query);
        const search = req.query.search?.trim() || '';

        // بناء WHERE clause
        let whereClause = 'WHERE 1=1';
        const params = [];

        if (search) {
            whereClause += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        // جلب العدد الإجمالي
        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM suppliers ${whereClause}`,
            params
        );
        const total = countResult[0]?.total || 0;

        // جلب الموردين
        const [suppliers] = await db.query(
            `SELECT * FROM suppliers ${whereClause} 
            ORDER BY name ASC 
            LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        res.json({
            success: true,
            data: suppliers,
            pagination: buildPaginationResponse(page, limit, total)
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب الموردين');
    }
});

// ============================================================
// 📍 GET /api/optimized/locations - المواقع/الفروع
// ============================================================
router.get('/locations', async (req, res) => {
    try {
        const [locations] = await db.query(
            `SELECT 
                l.*,
                COUNT(DISTINCT s.productId) as productCount,
                COALESCE(SUM(s.quantity), 0) as totalStock
            FROM locations l
            LEFT JOIN stock s ON l.id = s.locationId
            GROUP BY l.id
            ORDER BY l.name ASC`
        );

        locations.forEach(loc => {
            loc.productCount = parseInt(loc.productCount || 0);
            loc.totalStock = parseFloat(loc.totalStock || 0);
        });

        res.json({
            success: true,
            data: locations,
            count: locations.length
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب المواقع');
    }
});

// ============================================================
// 📈 GET /api/optimized/dashboard/stats - إحصائيات Dashboard
// ============================================================
router.get('/dashboard/stats', async (req, res) => {
    try {
        const today = new Date().toISOString().slice(0, 10);
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            .toISOString().slice(0, 10);

        // تنفيذ جميع الاستعلامات بالتوازي لسرعة أكبر
        const [
            todaySalesResult,
            monthSalesResult,
            lowStockResult,
            customersResult,
            pendingOrdersResult,
            revenueResult
        ] = await Promise.all([
            // مبيعات اليوم
            db.query(
                `SELECT 
                    COUNT(*) as count,
                    COALESCE(SUM(total), 0) as total,
                    COALESCE(SUM(paid), 0) as paid,
                    COALESCE(SUM(total - paid), 0) as remaining
                FROM sale_invoices 
                WHERE date = ?`,
                [today]
            ),
            // مبيعات الشهر
            db.query(
                `SELECT 
                    COUNT(*) as count,
                    COALESCE(SUM(total), 0) as total
                FROM sale_invoices 
                WHERE date >= ?`,
                [startOfMonth]
            ),
            // منتجات منخفضة المخزون
            db.query(
                `SELECT COUNT(*) as count
                FROM (
                    SELECT p.id, COALESCE(SUM(s.quantity), 0) as totalStock
                    FROM products p
                    LEFT JOIN stock s ON p.id = s.productId
                    GROUP BY p.id
                    HAVING totalStock <= 5
                ) as low_stock_products`
            ),
            // إجمالي العملاء
            db.query('SELECT COUNT(*) as count FROM customers'),
            // الطلبات المؤجلة
            db.query(
                `SELECT 
                    COUNT(*) as count,
                    COALESCE(SUM(total - paid), 0) as totalDue
                FROM sale_invoices 
                WHERE (is_deferred = 1 OR paid < total) AND paid < total`
            ),
            // إيرادات الأسبوع
            db.query(
                `SELECT 
                    COALESCE(SUM(paid), 0) as weekRevenue
                FROM sale_invoices 
                WHERE date >= DATE_SUB(?, INTERVAL 7 DAY)`,
                [today]
            )
        ]);

        const todaySales = todaySalesResult[0][0];
        const monthSales = monthSalesResult[0][0];
        const lowStock = lowStockResult[0][0];
        const customers = customersResult[0][0];
        const pendingOrders = pendingOrdersResult[0][0];
        const revenue = revenueResult[0][0];

        res.json({
            success: true,
            data: {
                todaySales: {
                    count: todaySales.count || 0,
                    total: parseFloat(todaySales.total || 0),
                    paid: parseFloat(todaySales.paid || 0),
                    remaining: parseFloat(todaySales.remaining || 0)
                },
                monthSales: {
                    count: monthSales.count || 0,
                    total: parseFloat(monthSales.total || 0)
                },
                lowStockCount: lowStock.count || 0,
                totalCustomers: customers.count || 0,
                pendingOrders: {
                    count: pendingOrders.count || 0,
                    totalDue: parseFloat(pendingOrders.totalDue || 0)
                },
                weekRevenue: parseFloat(revenue.weekRevenue || 0)
            }
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب إحصائيات Dashboard');
    }
});

// ============================================================
// 📊 GET /api/optimized/dashboard/charts - بيانات الرسوم البيانية
// ============================================================
router.get('/dashboard/charts', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const today = new Date().toISOString().slice(0, 10);

        // تنفيذ الاستعلامات بالتوازي
        const [
            salesChartResult,
            paymentMethodsResult,
            topProductsResult,
            categoryDistributionResult
        ] = await Promise.all([
            // مبيعات آخر X أيام
            db.query(
                `SELECT 
                    DATE(date) as date,
                    COUNT(*) as count,
                    COALESCE(SUM(total), 0) as total,
                    COALESCE(SUM(paid), 0) as paid
                FROM sale_invoices 
                WHERE date >= DATE_SUB(?, INTERVAL ? DAY)
                GROUP BY DATE(date)
                ORDER BY date ASC`,
                [today, days]
            ),
            // توزيع طرق الدفع
            db.query(
                `SELECT 
                    COALESCE(paymentMethod, 'نقدي') as method,
                    COUNT(*) as count,
                    COALESCE(SUM(total), 0) as total
                FROM sale_invoices 
                WHERE date >= DATE_SUB(?, INTERVAL 30 DAY)
                GROUP BY paymentMethod`,
                [today]
            ),
            // أفضل المنتجات مبيعاً
            db.query(
                `SELECT 
                    p.id,
                    p.name,
                    p.code,
                    SUM(sii.quantity) as totalSold,
                    SUM(sii.quantity * sii.price) as revenue,
                    COUNT(DISTINCT sii.invoiceId) as invoiceCount
                FROM sale_invoice_items sii
                JOIN products p ON sii.productId = p.id
                JOIN sale_invoices si ON sii.invoiceId = si.id
                WHERE si.date >= DATE_SUB(?, INTERVAL 30 DAY)
                GROUP BY p.id, p.name, p.code
                ORDER BY totalSold DESC
                LIMIT 10`,
                [today]
            ),
            // توزيع المبيعات حسب الفئات
            db.query(
                `SELECT 
                    p.category,
                    COUNT(DISTINCT sii.invoiceId) as invoiceCount,
                    SUM(sii.quantity) as totalSold,
                    SUM(sii.quantity * sii.price) as revenue
                FROM sale_invoice_items sii
                JOIN products p ON sii.productId = p.id
                JOIN sale_invoices si ON sii.invoiceId = si.id
                WHERE si.date >= DATE_SUB(?, INTERVAL 30 DAY)
                GROUP BY p.category
                ORDER BY revenue DESC`,
                [today]
            )
        ]);

        const salesChart = salesChartResult[0];
        const paymentMethods = paymentMethodsResult[0];
        const topProducts = topProductsResult[0];
        const categoryDistribution = categoryDistributionResult[0];

        res.json({
            success: true,
            data: {
                salesChart: {
                    labels: salesChart.map(d => d.date),
                    datasets: [
                        {
                            label: 'إجمالي المبيعات',
                            data: salesChart.map(d => parseFloat(d.total || 0))
                        },
                        {
                            label: 'المدفوع',
                            data: salesChart.map(d => parseFloat(d.paid || 0))
                        },
                        {
                            label: 'عدد الفواتير',
                            data: salesChart.map(d => parseInt(d.count || 0))
                        }
                    ]
                },
                paymentMethodsChart: {
                    labels: paymentMethods.map(pm => pm.method || 'نقدي'),
                    datasets: [
                        {
                            label: 'المبالغ',
                            data: paymentMethods.map(pm => parseFloat(pm.total || 0))
                        },
                        {
                            label: 'عدد الفواتير',
                            data: paymentMethods.map(pm => parseInt(pm.count || 0))
                        }
                    ]
                },
                topProducts: topProducts.map(p => ({
                    id: p.id,
                    name: p.name,
                    code: p.code,
                    totalSold: parseFloat(p.totalSold || 0),
                    revenue: parseFloat(p.revenue || 0),
                    invoiceCount: parseInt(p.invoiceCount || 0)
                })),
                categoryDistribution: {
                    labels: categoryDistribution.map(c => c.category || 'غير مصنف'),
                    datasets: [
                        {
                            label: 'الإيرادات',
                            data: categoryDistribution.map(c => parseFloat(c.revenue || 0))
                        },
                        {
                            label: 'الكمية المباعة',
                            data: categoryDistribution.map(c => parseFloat(c.totalSold || 0))
                        }
                    ]
                }
            }
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب بيانات الرسوم البيانية');
    }
});

// ============================================================
// 📝 GET /api/optimized/registration-requests - طلبات التسجيل
// ============================================================
router.get('/registration-requests', async (req, res) => {
    try {
        const status = req.query.status?.trim() || 'pending';
        const { page, limit, offset } = getPagination(req.query);

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (status && status !== 'all') {
            whereClause += ' AND status = ?';
            params.push(status);
        }

        // جلب العدد الإجمالي
        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM registration_requests ${whereClause}`,
            params
        );
        const total = countResult[0]?.total || 0;

        // جلب الطلبات
        const [requests] = await db.query(
            `SELECT * FROM registration_requests ${whereClause}
            ORDER BY createdAt DESC
            LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        res.json({
            success: true,
            data: requests,
            pagination: buildPaginationResponse(page, limit, total)
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب طلبات التسجيل');
    }
});

// ============================================================
// ✅ POST /api/optimized/registration-requests/:id/approve
// ============================================================
router.post('/registration-requests/:id/approve', async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();

        const requestId = parseInt(req.params.id);
        const { role, permissions } = req.body;

        if (!requestId || isNaN(requestId)) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({
                success: false,
                message: 'معرف الطلب غير صحيح'
            });
        }

        // جلب الطلب
        const [requests] = await connection.query(
            'SELECT * FROM registration_requests WHERE id = ?',
            [requestId]
        );

        if (requests.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({
                success: false,
                message: 'طلب التسجيل غير موجود'
            });
        }

        const request = requests[0];

        if (request.status !== 'pending') {
            await connection.rollback();
            connection.release();
            return res.status(400).json({
                success: false,
                message: 'هذا الطلب تمت معالجته بالفعل'
            });
        }

        // إنشاء حساب المستخدم
        const [result] = await connection.query(
            `INSERT INTO users (name, email, phone, password, role, status, createdAt) 
             VALUES (?, ?, ?, ?, ?, 'active', NOW())`,
            [
                request.name, 
                request.email, 
                request.phone, 
                request.password, 
                role || 'cashier'
            ]
        );

        const userId = result.insertId;

        // تحديث حالة الطلب
        await connection.query(
            'UPDATE registration_requests SET status = ?, processedAt = NOW() WHERE id = ?',
            ['approved', requestId]
        );

        // إضافة الصلاحيات إذا تم تحديدها
        if (permissions && typeof permissions === 'object') {
            for (const [permKey, permValue] of Object.entries(permissions)) {
                if (permValue === true || permValue === 1) {
                    await connection.query(
                        `INSERT INTO user_permissions (userId, permission, granted) 
                         VALUES (?, ?, 1)
                         ON DUPLICATE KEY UPDATE granted = 1`,
                        [userId, permKey]
                    );
                }
            }
        }

        await connection.commit();
        connection.release();

        res.json({
            success: true,
            message: 'تم الموافقة على الطلب وإنشاء الحساب بنجاح',
            data: { userId, userName: request.name }
        });

    } catch (error) {
        await connection.rollback();
        connection.release();
        handleError(error, res, 'خطأ في الموافقة على طلب التسجيل');
    }
});

// ============================================================
// ❌ POST /api/optimized/registration-requests/:id/reject
// ============================================================
router.post('/registration-requests/:id/reject', async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);
        const { reason } = req.body;

        if (!requestId || isNaN(requestId)) {
            return res.status(400).json({
                success: false,
                message: 'معرف الطلب غير صحيح'
            });
        }

        const [result] = await db.query(
            `UPDATE registration_requests 
             SET status = 'rejected', 
                 rejectionReason = ?, 
                 processedAt = NOW() 
             WHERE id = ? AND status = 'pending'`,
            [reason || 'لم يتم تحديد سبب', requestId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'طلب التسجيل غير موجود أو تمت معالجته بالفعل'
            });
        }

        res.json({
            success: true,
            message: 'تم رفض الطلب بنجاح'
        });

    } catch (error) {
        handleError(error, res, 'خطأ في رفض طلب التسجيل');
    }
});

// ============================================================
// 👤 GET /api/optimized/users - المستخدمين مع Pagination
// ============================================================
router.get('/users', async (req, res) => {
    try {
        const { page, limit, offset } = getPagination(req.query);
        const search = req.query.search?.trim() || '';
        const role = req.query.role?.trim() || '';
        const status = req.query.status?.trim() || '';

        // بناء WHERE clause
        let whereClause = 'WHERE 1=1';
        const params = [];

        if (search) {
            whereClause += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (role && role !== 'all') {
            whereClause += ' AND role = ?';
            params.push(role);
        }

        if (status && status !== 'all') {
            whereClause += ' AND status = ?';
            params.push(status);
        }

        // جلب العدد الإجمالي
        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM users ${whereClause}`,
            params
        );
        const total = countResult[0]?.total || 0;

        // جلب المستخدمين
        const [users] = await db.query(
            `SELECT 
                id, name, email, phone, role, status, 
                profile_picture, createdAt, lastLogin
            FROM users 
            ${whereClause}
            ORDER BY id DESC
            LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        res.json({
            success: true,
            data: users,
            pagination: buildPaginationResponse(page, limit, total)
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب المستخدمين');
    }
});

// ============================================================
// 👤 GET /api/optimized/user/:userId - بيانات مستخدم واحد
// ============================================================
router.get('/user/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);

        if (!userId || isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: 'معرف المستخدم غير صحيح'
            });
        }

        const [users] = await db.query(
            `SELECT 
                id, name, email, phone, role, status, 
                profile_picture, createdAt, lastLogin
            FROM users 
            WHERE id = ?`,
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'المستخدم غير موجود'
            });
        }

        // جلب صلاحيات المستخدم
        const [permissions] = await db.query(
            'SELECT permission, granted FROM user_permissions WHERE userId = ?',
            [userId]
        );

        const user = users[0];
        user.permissions = {};
        permissions.forEach(perm => {
            user.permissions[perm.permission] = perm.granted === 1;
        });

        res.json({
            success: true,
            data: user
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب بيانات المستخدم');
    }
});

// ============================================================
// 🖼️ GET /api/optimized/user-avatar/:userId - صورة المستخدم
// ============================================================
router.get('/user-avatar/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);

        if (!userId || isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: 'معرف المستخدم غير صحيح'
            });
        }

        const [users] = await db.query(
            'SELECT id, name, profile_picture FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'المستخدم غير موجود'
            });
        }

        const user = users[0];
        
        res.json({
            success: true,
            data: {
                id: user.id,
                name: user.name,
                profilePicture: user.profile_picture || null,
                initials: user.name ? user.name.charAt(0).toUpperCase() : 'U'
            }
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب صورة المستخدم');
    }
});

// ============================================================
// 📊 GET /api/optimized/reports/sales-summary - تقرير ملخص المبيعات
// ============================================================
router.get('/reports/sales-summary', async (req, res) => {
    try {
        const startDate = req.query.startDate || new Date().toISOString().slice(0, 10);
        const endDate = req.query.endDate || new Date().toISOString().slice(0, 10);

        const [summary] = await db.query(
            `SELECT 
                COUNT(*) as totalInvoices,
                COALESCE(SUM(total), 0) as totalSales,
                COALESCE(SUM(paid), 0) as totalPaid,
                COALESCE(SUM(total - paid), 0) as totalRemaining,
                COALESCE(SUM(discount), 0) as totalDiscount,
                COALESCE(AVG(total), 0) as averageInvoice
            FROM sale_invoices 
            WHERE date BETWEEN ? AND ?`,
            [startDate, endDate]
        );

        res.json({
            success: true,
            data: {
                period: { startDate, endDate },
                totalInvoices: summary[0].totalInvoices || 0,
                totalSales: parseFloat(summary[0].totalSales || 0),
                totalPaid: parseFloat(summary[0].totalPaid || 0),
                totalRemaining: parseFloat(summary[0].totalRemaining || 0),
                totalDiscount: parseFloat(summary[0].totalDiscount || 0),
                averageInvoice: parseFloat(summary[0].averageInvoice || 0)
            }
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب تقرير ملخص المبيعات');
    }
});

// ============================================================
// 📊 GET /api/optimized/reports/inventory-value - قيمة المخزون
// ============================================================
router.get('/reports/inventory-value', async (req, res) => {
    try {
        const [inventoryValue] = await db.query(
            `SELECT 
                p.category,
                COUNT(DISTINCT p.id) as productCount,
                COALESCE(SUM(s.quantity), 0) as totalQuantity,
                COALESCE(SUM(s.quantity * p.costPrice), 0) as costValue,
                COALESCE(SUM(s.quantity * p.sellingPrice), 0) as sellingValue
            FROM products p
            LEFT JOIN stock s ON p.id = s.productId
            GROUP BY p.category
            ORDER BY costValue DESC`
        );

        const categories = inventoryValue.map(cat => ({
            category: cat.category || 'غير مصنف',
            productCount: parseInt(cat.productCount || 0),
            totalQuantity: parseFloat(cat.totalQuantity || 0),
            costValue: parseFloat(cat.costValue || 0),
            sellingValue: parseFloat(cat.sellingValue || 0),
            potentialProfit: parseFloat(cat.sellingValue || 0) - parseFloat(cat.costValue || 0)
        }));

        const totals = categories.reduce((acc, cat) => ({
            totalProducts: acc.totalProducts + cat.productCount,
            totalQuantity: acc.totalQuantity + cat.totalQuantity,
            totalCostValue: acc.totalCostValue + cat.costValue,
            totalSellingValue: acc.totalSellingValue + cat.sellingValue,
            totalPotentialProfit: acc.totalPotentialProfit + cat.potentialProfit
        }), {
            totalProducts: 0,
            totalQuantity: 0,
            totalCostValue: 0,
            totalSellingValue: 0,
            totalPotentialProfit: 0
        });

        res.json({
            success: true,
            data: {
                categories,
                totals
            }
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب تقرير قيمة المخزون');
    }
});

// ============================================================
// 🔍 GET /api/optimized/search - بحث شامل
// ============================================================
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q?.trim() || '';
        const type = req.query.type || 'all'; // all, products, customers, invoices
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);

        if (!query) {
            return res.status(400).json({
                success: false,
                message: 'يرجى إدخال كلمة بحث'
            });
        }

        const searchTerm = `%${query}%`;
        const results = {};

        // البحث في المنتجات
        if (type === 'all' || type === 'products') {
            const [products] = await db.query(
                `SELECT 
                    p.id, p.code, p.name, p.barcode, p.category, 
                    p.sellingPrice, COALESCE(SUM(s.quantity), 0) as stock
                FROM products p
                LEFT JOIN stock s ON p.id = s.productId
                WHERE p.name LIKE ? OR p.code LIKE ? OR p.barcode LIKE ?
                GROUP BY p.id
                LIMIT ?`,
                [searchTerm, searchTerm, searchTerm, limit]
            );
            results.products = products;
        }

        // البحث في العملاء
        if (type === 'all' || type === 'customers') {
            const [customers] = await db.query(
                `SELECT id, name, phone, email, address
                FROM customers
                WHERE name LIKE ? OR phone LIKE ? OR email LIKE ?
                LIMIT ?`,
                [searchTerm, searchTerm, searchTerm, limit]
            );
            results.customers = customers;
        }

        // البحث في الفواتير
        if (type === 'all' || type === 'invoices') {
            const [invoices] = await db.query(
                `SELECT id, invoiceNumber, date, customer, total, paid, paymentMethod
                FROM sale_invoices
                WHERE invoiceNumber LIKE ? OR customer LIKE ?
                ORDER BY date DESC
                LIMIT ?`,
                [searchTerm, searchTerm, limit]
            );
            results.invoices = invoices;
        }

        // البحث في الموردين
        if (type === 'all' || type === 'suppliers') {
            const [suppliers] = await db.query(
                `SELECT id, name, phone, email, address
                FROM suppliers
                WHERE name LIKE ? OR phone LIKE ? OR email LIKE ?
                LIMIT ?`,
                [searchTerm, searchTerm, searchTerm, limit]
            );
            results.suppliers = suppliers;
        }

        res.json({
            success: true,
            query,
            data: results
        });

    } catch (error) {
        handleError(error, res, 'خطأ في البحث');
    }
});

// ============================================================
// 📋 GET /api/optimized/invoices - الفواتير العامة (مبيعات ومشتريات)
// ============================================================
router.get('/invoices', async (req, res) => {
    try {
        const { page, limit, offset } = getPagination(req.query);
        const type = req.query.type || 'sale'; // sale or purchase
        const search = req.query.search?.trim() || '';
        const startDate = req.query.startDate || '';
        const endDate = req.query.endDate || '';

        const tableName = type === 'purchase' ? 'purchase_invoices' : 'sale_invoices';
        const itemsTable = type === 'purchase' ? 'purchase_invoice_items' : 'sale_invoice_items';

        // بناء WHERE clause
        let whereClause = 'WHERE 1=1';
        const params = [];

        if (search) {
            const searchField = type === 'purchase' ? 'supplier' : 'customer';
            whereClause += ` AND (invoiceNumber LIKE ? OR ${searchField} LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        if (startDate) {
            whereClause += ' AND date >= ?';
            params.push(startDate);
        }

        if (endDate) {
            whereClause += ' AND date <= ?';
            params.push(endDate);
        }

        // جلب العدد الإجمالي
        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM ${tableName} ${whereClause}`,
            params
        );
        const total = countResult[0]?.total || 0;

        // جلب الفواتير
        const [invoices] = await db.query(
            `SELECT * FROM ${tableName} ${whereClause}
            ORDER BY date DESC, id DESC
            LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        // جلب العناصر لكل فاتورة
        const invoiceIds = invoices.map(inv => inv.id);
        let items = [];

        if (invoiceIds.length > 0) {
            const placeholders = invoiceIds.map(() => '?').join(',');
            const [itemsResult] = await db.query(
                `SELECT 
                    ii.*,
                    p.name as productName,
                    p.code as productCode
                FROM ${itemsTable} ii
                LEFT JOIN products p ON ii.productId = p.id
                WHERE ii.invoiceId IN (${placeholders})
                ORDER BY ii.id ASC`,
                invoiceIds
            );
            items = itemsResult;
        }

        // ربط العناصر بالفواتير
        invoices.forEach(invoice => {
            invoice.items = items.filter(item => item.invoiceId === invoice.id);
            invoice.total = parseFloat(invoice.total || 0);
            invoice.paid = parseFloat(invoice.paid || 0);
            invoice.discount = parseFloat(invoice.discount || 0);
        });

        res.json({
            success: true,
            type,
            data: invoices,
            pagination: buildPaginationResponse(page, limit, total)
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب الفواتير');
    }
});

// ============================================================
// 📈 GET /api/optimized/analytics/profit - تحليل الأرباح
// ============================================================
router.get('/analytics/profit', async (req, res) => {
    try {
        const startDate = req.query.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const endDate = req.query.endDate || new Date().toISOString().slice(0, 10);

        // حساب الأرباح من المبيعات
        const [profitData] = await db.query(
            `SELECT 
                DATE(si.date) as date,
                COUNT(DISTINCT si.id) as invoiceCount,
                COALESCE(SUM(sii.quantity * sii.price), 0) as revenue,
                COALESCE(SUM(sii.quantity * p.costPrice), 0) as cost,
                COALESCE(SUM(sii.quantity * sii.price) - SUM(sii.quantity * p.costPrice), 0) as profit
            FROM sale_invoices si
            JOIN sale_invoice_items sii ON si.id = sii.invoiceId
            JOIN products p ON sii.productId = p.id
            WHERE si.date BETWEEN ? AND ?
            GROUP BY DATE(si.date)
            ORDER BY date ASC`,
            [startDate, endDate]
        );

        const formattedData = profitData.map(row => ({
            date: row.date,
            invoiceCount: parseInt(row.invoiceCount || 0),
            revenue: parseFloat(row.revenue || 0),
            cost: parseFloat(row.cost || 0),
            profit: parseFloat(row.profit || 0),
            profitMargin: row.revenue > 0 ? ((row.profit / row.revenue) * 100).toFixed(2) : 0
        }));

        // حساب الإجماليات
        const totals = formattedData.reduce((acc, row) => ({
            totalInvoices: acc.totalInvoices + row.invoiceCount,
            totalRevenue: acc.totalRevenue + row.revenue,
            totalCost: acc.totalCost + row.cost,
            totalProfit: acc.totalProfit + row.profit
        }), {
            totalInvoices: 0,
            totalRevenue: 0,
            totalCost: 0,
            totalProfit: 0
        });

        totals.avgProfitMargin = totals.totalRevenue > 0 
            ? ((totals.totalProfit / totals.totalRevenue) * 100).toFixed(2) 
            : 0;

        res.json({
            success: true,
            period: { startDate, endDate },
            data: formattedData,
            totals
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب تحليل الأرباح');
    }
});

// ============================================================
// 📊 GET /api/optimized/analytics/best-selling - الأكثر مبيعاً
// ============================================================
router.get('/analytics/best-selling', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const today = new Date().toISOString().slice(0, 10);

        const [bestSelling] = await db.query(
            `SELECT 
                p.id,
                p.code,
                p.name,
                p.category,
                p.sellingPrice,
                p.costPrice,
                SUM(sii.quantity) as totalSold,
                COUNT(DISTINCT sii.invoiceId) as invoiceCount,
                SUM(sii.quantity * sii.price) as revenue,
                SUM(sii.quantity * p.costPrice) as cost,
                SUM(sii.quantity * sii.price) - SUM(sii.quantity * p.costPrice) as profit,
                COALESCE(SUM(s.quantity), 0) as currentStock
            FROM sale_invoice_items sii
            JOIN products p ON sii.productId = p.id
            JOIN sale_invoices si ON sii.invoiceId = si.id
            LEFT JOIN stock s ON p.id = s.productId
            WHERE si.date >= DATE_SUB(?, INTERVAL ? DAY)
            GROUP BY p.id, p.code, p.name, p.category, p.sellingPrice, p.costPrice
            ORDER BY totalSold DESC
            LIMIT ?`,
            [today, days, limit]
        );

        const products = bestSelling.map(product => ({
            id: product.id,
            code: product.code,
            name: product.name,
            category: product.category || 'غير مصنف',
            sellingPrice: parseFloat(product.sellingPrice || 0),
            costPrice: parseFloat(product.costPrice || 0),
            totalSold: parseFloat(product.totalSold || 0),
            invoiceCount: parseInt(product.invoiceCount || 0),
            revenue: parseFloat(product.revenue || 0),
            cost: parseFloat(product.cost || 0),
            profit: parseFloat(product.profit || 0),
            currentStock: parseFloat(product.currentStock || 0),
            profitMargin: product.revenue > 0 ? ((product.profit / product.revenue) * 100).toFixed(2) : 0
        }));

        res.json({
            success: true,
            period: `آخر ${days} يوم`,
            data: products
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب الأكثر مبيعاً');
    }
});

// ============================================================
// ⚠️ GET /api/optimized/alerts/low-stock - تنبيهات المخزون المنخفض
// ============================================================
router.get('/alerts/low-stock', async (req, res) => {
    try {
        const threshold = parseInt(req.query.threshold) || 5;

        const [lowStockProducts] = await db.query(
            `SELECT 
                p.id,
                p.code,
                p.name,
                p.category,
                COALESCE(SUM(s.quantity), 0) as currentStock,
                GROUP_CONCAT(CONCAT(l.name, ':', COALESCE(s.quantity, 0)) SEPARATOR '|') as stockByLocation
            FROM products p
            LEFT JOIN stock s ON p.id = s.productId
            LEFT JOIN locations l ON s.locationId = l.id
            GROUP BY p.id, p.code, p.name, p.category
            HAVING currentStock <= ?
            ORDER BY currentStock ASC`,
            [threshold]
        );

        const products = lowStockProducts.map(product => {
            const stockLocations = product.stockByLocation 
                ? product.stockByLocation.split('|').map(item => {
                    const [name, qty] = item.split(':');
                    return { locationName: name, quantity: parseInt(qty) };
                })
                : [];

            return {
                id: product.id,
                code: product.code,
                name: product.name,
                category: product.category || 'غير مصنف',
                minStockLevel: threshold,
                currentStock: parseFloat(product.currentStock || 0),
                stockLocations,
                alertLevel: product.currentStock === 0 ? 'critical' : 
                           product.currentStock <= threshold / 2 ? 'high' : 'medium'
            };
        });

        res.json({
            success: true,
            count: products.length,
            data: products
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب تنبيهات المخزون المنخفض');
    }
});

// ============================================================
// 💰 GET /api/optimized/financial/summary - الملخص المالي
// ============================================================
router.get('/financial/summary', async (req, res) => {
    try {
        const startDate = req.query.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const endDate = req.query.endDate || new Date().toISOString().slice(0, 10);

        const [
            salesSummary,
            purchasesSummary,
            customerBalances,
            supplierBalances
        ] = await Promise.all([
            // ملخص المبيعات
            db.query(
                `SELECT 
                    COUNT(*) as count,
                    COALESCE(SUM(total), 0) as total,
                    COALESCE(SUM(paid), 0) as paid,
                    COALESCE(SUM(total - paid), 0) as remaining,
                    COALESCE(SUM(discount), 0) as discount
                FROM sale_invoices 
                WHERE date BETWEEN ? AND ?`,
                [startDate, endDate]
            ),
            // ملخص المشتريات
            db.query(
                `SELECT 
                    COUNT(*) as count,
                    COALESCE(SUM(total), 0) as total
                FROM purchase_invoices 
                WHERE date BETWEEN ? AND ?`,
                [startDate, endDate]
            ),
            // أرصدة العملاء
            db.query(
                `SELECT 
                    COUNT(DISTINCT customerId) as customerCount,
                    COALESCE(SUM(total - paid), 0) as totalDue
                FROM sale_invoices 
                WHERE paid < total`
            ),
            // أرصدة الموردين (إذا كان النظام يدعمها)
            db.query(
                `SELECT 
                    COUNT(*) as supplierCount
                FROM suppliers`
            )
        ]);

        const sales = salesSummary[0][0];
        const purchases = purchasesSummary[0][0];
        const customers = customerBalances[0][0];
        const suppliers = supplierBalances[0][0];

        const netProfit = parseFloat(sales.paid || 0) - parseFloat(purchases.total || 0);

        res.json({
            success: true,
            period: { startDate, endDate },
            data: {
                sales: {
                    count: sales.count || 0,
                    total: parseFloat(sales.total || 0),
                    paid: parseFloat(sales.paid || 0),
                    remaining: parseFloat(sales.remaining || 0),
                    discount: parseFloat(sales.discount || 0)
                },
                purchases: {
                    count: purchases.count || 0,
                    total: parseFloat(purchases.total || 0)
                },
                customers: {
                    count: customers.customerCount || 0,
                    totalDue: parseFloat(customers.totalDue || 0)
                },
                suppliers: {
                    count: suppliers.supplierCount || 0
                },
                netProfit,
                profitMargin: sales.paid > 0 ? ((netProfit / sales.paid) * 100).toFixed(2) : 0
            }
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب الملخص المالي');
    }
});

// ============================================================
// 📦 GET /api/optimized/product/:id/history - تاريخ حركة منتج
// ============================================================
router.get('/product/:id/history', async (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        const { page, limit, offset } = getPagination(req.query);
        const days = parseInt(req.query.days) || 30;
        const today = new Date().toISOString().slice(0, 10);

        if (!productId || isNaN(productId)) {
            return res.status(400).json({
                success: false,
                message: 'معرف المنتج غير صحيح'
            });
        }

        // معلومات المنتج
        const [products] = await db.query(
            `SELECT 
                p.*,
                COALESCE(SUM(s.quantity), 0) as currentStock
            FROM products p
            LEFT JOIN stock s ON p.id = s.productId
            WHERE p.id = ?
            GROUP BY p.id`,
            [productId]
        );

        if (products.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'المنتج غير موجود'
            });
        }

        const product = products[0];

        // تاريخ المبيعات
        const [salesHistory] = await db.query(
            `SELECT 
                si.id as invoiceId,
                si.invoiceNumber,
                si.date,
                si.customer,
                sii.quantity,
                sii.price,
                sii.total,
                'sale' as type
            FROM sale_invoice_items sii
            JOIN sale_invoices si ON sii.invoiceId = si.id
            WHERE sii.productId = ? AND si.date >= DATE_SUB(?, INTERVAL ? DAY)
            ORDER BY si.date DESC, si.id DESC
            LIMIT ? OFFSET ?`,
            [productId, today, days, limit, offset]
        );

        // تاريخ المشتريات
        const [purchasesHistory] = await db.query(
            `SELECT 
                pi.id as invoiceId,
                pi.invoiceNumber,
                pi.date,
                pi.supplier,
                pii.quantity,
                pii.price,
                pii.total,
                'purchase' as type
            FROM purchase_invoice_items pii
            JOIN purchase_invoices pi ON pii.invoiceId = pi.id
            WHERE pii.productId = ? AND pi.date >= DATE_SUB(?, INTERVAL ? DAY)
            ORDER BY pi.date DESC, pi.id DESC
            LIMIT ?`,
            [productId, today, days, 10]
        );

        // دمج السجلات وترتيبها
        const history = [...salesHistory, ...purchasesHistory]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map(record => ({
                ...record,
                quantity: parseFloat(record.quantity || 0),
                price: parseFloat(record.price || 0),
                total: parseFloat(record.total || 0)
            }));

        res.json({
            success: true,
            product: {
                id: product.id,
                code: product.code,
                name: product.name,
                currentStock: parseFloat(product.currentStock || 0),
                sellingPrice: parseFloat(product.sellingPrice || 0),
                costPrice: parseFloat(product.costPrice || 0)
            },
            history,
            period: `آخر ${days} يوم`
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب تاريخ المنتج');
    }
});

// ============================================================
// 📊 GET /api/optimized/activity-log - سجل النشاطات
// ============================================================
router.get('/activity-log', async (req, res) => {
    try {
        const { page, limit, offset } = getPagination(req.query);
        const userId = req.query.userId || '';
        const action = req.query.action?.trim() || '';
        const startDate = req.query.startDate || '';
        const endDate = req.query.endDate || '';

        // بناء WHERE clause
        let whereClause = 'WHERE 1=1';
        const params = [];

        if (userId) {
            whereClause += ' AND userId = ?';
            params.push(userId);
        }

        if (action) {
            whereClause += ' AND action LIKE ?';
            params.push(`%${action}%`);
        }

        if (startDate) {
            whereClause += ' AND DATE(timestamp) >= ?';
            params.push(startDate);
        }

        if (endDate) {
            whereClause += ' AND DATE(timestamp) <= ?';
            params.push(endDate);
        }

        // جلب العدد الإجمالي
        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM activity_log ${whereClause}`,
            params
        );
        const total = countResult[0]?.total || 0;

        // جلب السجلات
        const [logs] = await db.query(
            `SELECT 
                al.*,
                u.name as userName,
                u.role as userRole
            FROM activity_log al
            LEFT JOIN users u ON al.userId = u.id
            ${whereClause}
            ORDER BY al.timestamp DESC
            LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        res.json({
            success: true,
            data: logs,
            pagination: buildPaginationResponse(page, limit, total)
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب سجل النشاطات');
    }
});

// ============================================================
// 🔒 GET /api/optimized/permissions/:userId - صلاحيات مستخدم
// ============================================================
router.get('/permissions/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);

        if (!userId || isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: 'معرف المستخدم غير صحيح'
            });
        }

        // جلب معلومات المستخدم
        const [users] = await db.query(
            'SELECT id, name, email, role FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'المستخدم غير موجود'
            });
        }

        const user = users[0];

        // جلب الصلاحيات
        const [permissions] = await db.query(
            'SELECT permission, granted FROM user_permissions WHERE userId = ?',
            [userId]
        );

        const permissionsObj = {};
        permissions.forEach(perm => {
            permissionsObj[perm.permission] = perm.granted === 1;
        });

        res.json({
            success: true,
            data: {
                user,
                permissions: permissionsObj
            }
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب صلاحيات المستخدم');
    }
});

// ============================================================
// 📍 GET /api/optimized/stock-by-location/:locationId - مخزون حسب الموقع
// ============================================================
router.get('/stock-by-location/:locationId', async (req, res) => {
    try {
        const locationId = parseInt(req.params.locationId);
        const { page, limit, offset } = getPagination(req.query);
        const search = req.query.search?.trim() || '';

        if (!locationId || isNaN(locationId)) {
            return res.status(400).json({
                success: false,
                message: 'معرف الموقع غير صحيح'
            });
        }

        // جلب معلومات الموقع
        const [locations] = await db.query(
            'SELECT * FROM locations WHERE id = ?',
            [locationId]
        );

        if (locations.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'الموقع غير موجود'
            });
        }

        const location = locations[0];

        // بناء WHERE clause
        let whereClause = 'WHERE s.locationId = ?';
        const params = [locationId];

        if (search) {
            whereClause += ' AND (p.name LIKE ? OR p.code LIKE ? OR p.barcode LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        // جلب العدد الإجمالي
        const [countResult] = await db.query(
            `SELECT COUNT(*) as total 
            FROM stock s
            JOIN products p ON s.productId = p.id
            ${whereClause}`,
            params
        );
        const total = countResult[0]?.total || 0;

        // جلب المخزون
        const [stockData] = await db.query(
            `SELECT 
                p.id,
                p.code,
                p.name,
                p.category,
                p.sellingPrice,
                p.costPrice,
                s.quantity,
                s.quantity * p.costPrice as stockValue
            FROM stock s
            JOIN products p ON s.productId = p.id
            ${whereClause}
            ORDER BY p.name ASC
            LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        stockData.forEach(item => {
            item.quantity = parseFloat(item.quantity || 0);
            item.sellingPrice = parseFloat(item.sellingPrice || 0);
            item.costPrice = parseFloat(item.costPrice || 0);
            item.stockValue = parseFloat(item.stockValue || 0);
        });

        res.json({
            success: true,
            location,
            data: stockData,
            pagination: buildPaginationResponse(page, limit, total)
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب مخزون الموقع');
    }
});

// ============================================================
// 💳 GET /api/optimized/customer/:id/statement - كشف حساب عميل
// ============================================================
router.get('/customer/:id/statement', async (req, res) => {
    try {
        const customerId = parseInt(req.params.id);
        const startDate = req.query.startDate || '';
        const endDate = req.query.endDate || new Date().toISOString().slice(0, 10);

        if (!customerId || isNaN(customerId)) {
            return res.status(400).json({
                success: false,
                message: 'معرف العميل غير صحيح'
            });
        }

        // جلب معلومات العميل
        const [customers] = await db.query(
            'SELECT * FROM customers WHERE id = ?',
            [customerId]
        );

        if (customers.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'العميل غير موجود'
            });
        }

        const customer = customers[0];

        // بناء WHERE clause
        let whereClause = 'WHERE customerId = ?';
        const params = [customerId];

        if (startDate) {
            whereClause += ' AND date >= ?';
            params.push(startDate);
        }

        if (endDate) {
            whereClause += ' AND date <= ?';
            params.push(endDate);
        }

        // جلب الفواتير والدفعات
        const [invoices] = await db.query(
            `SELECT 
                id,
                invoiceNumber,
                date,
                total,
                paid,
                discount,
                paymentMethod,
                notes
            FROM sale_invoices
            ${whereClause}
            ORDER BY date ASC, id ASC`,
            params
        );

        // جلب الدفعات إذا كان هناك جدول خاص بها
        const [payments] = await db.query(
            `SELECT 
                id,
                invoiceId,
                amount,
                paymentDate,
                paymentMethod,
                notes
            FROM customer_payments
            WHERE customerId = ? AND paymentDate BETWEEN ? AND ?
            ORDER BY paymentDate ASC`,
            [customerId, startDate || '1900-01-01', endDate]
        ).catch(() => [[]]);

        // حساب الرصيد الافتتاحي
        const [openingBalance] = await db.query(
            `SELECT COALESCE(SUM(total - paid), 0) as balance
            FROM sale_invoices
            WHERE customerId = ? ${startDate ? 'AND date < ?' : ''}`,
            startDate ? [customerId, startDate] : [customerId]
        );

        // بناء كشف الحساب
        let runningBalance = parseFloat(openingBalance[0]?.balance || 0);
        const transactions = [];

        invoices.forEach(invoice => {
            const invoiceTotal = parseFloat(invoice.total || 0);
            const invoicePaid = parseFloat(invoice.paid || 0);
            const invoiceRemaining = invoiceTotal - invoicePaid;

            runningBalance += invoiceRemaining;

            transactions.push({
                type: 'invoice',
                date: invoice.date,
                reference: invoice.invoiceNumber,
                description: `فاتورة مبيعات رقم ${invoice.invoiceNumber}`,
                debit: invoiceTotal,
                credit: invoicePaid,
                balance: runningBalance,
                details: invoice
            });
        });

        // إضافة الدفعات
        payments[0].forEach(payment => {
            runningBalance -= parseFloat(payment.amount || 0);

            transactions.push({
                type: 'payment',
                date: payment.paymentDate,
                reference: `PAY-${payment.id}`,
                description: `دفعة ${payment.paymentMethod || 'نقدية'}`,
                debit: 0,
                credit: parseFloat(payment.amount || 0),
                balance: runningBalance,
                details: payment
            });
        });

        // ترتيب المعاملات حسب التاريخ
        transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

        // حساب الإجماليات
        const totals = {
            totalInvoices: invoices.length,
            totalDebit: invoices.reduce((sum, inv) => sum + parseFloat(inv.total || 0), 0),
            totalCredit: invoices.reduce((sum, inv) => sum + parseFloat(inv.paid || 0), 0) + 
                        payments[0].reduce((sum, pay) => sum + parseFloat(pay.amount || 0), 0),
            openingBalance: parseFloat(openingBalance[0]?.balance || 0),
            closingBalance: runningBalance
        };

        res.json({
            success: true,
            customer,
            period: { 
                startDate: startDate || 'البداية', 
                endDate 
            },
            transactions,
            totals
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب كشف حساب العميل');
    }
});

// ============================================================
// 📈 GET /api/optimized/dashboard/quick-stats - إحصائيات سريعة
// ============================================================
router.get('/dashboard/quick-stats', async (req, res) => {
    try {
        const today = new Date().toISOString().slice(0, 10);

        const [quickStats] = await db.query(
            `SELECT 
                (SELECT COUNT(*) FROM products) as totalProducts,
                (SELECT COUNT(*) FROM customers) as totalCustomers,
                (SELECT COUNT(*) FROM suppliers) as totalSuppliers,
                (SELECT COUNT(*) FROM locations) as totalLocations,
                (SELECT COUNT(*) FROM users WHERE status = 'active') as activeUsers,
                (SELECT COUNT(*) FROM sale_invoices WHERE date = ?) as todayInvoices,
                (SELECT COALESCE(SUM(total), 0) FROM sale_invoices WHERE date = ?) as todaySales,
                (SELECT COUNT(*) FROM registration_requests WHERE status = 'pending') as pendingRequests`,
            [today, today]
        );

        const stats = quickStats[0];

        res.json({
            success: true,
            data: {
                totalProducts: stats.totalProducts || 0,
                totalCustomers: stats.totalCustomers || 0,
                totalSuppliers: stats.totalSuppliers || 0,
                totalLocations: stats.totalLocations || 0,
                activeUsers: stats.activeUsers || 0,
                todayInvoices: stats.todayInvoices || 0,
                todaySales: parseFloat(stats.todaySales || 0),
                pendingRequests: stats.pendingRequests || 0
            }
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب الإحصائيات السريعة');
    }
});

// ============================================================
// 🔄 GET /api/optimized/recent-activities - النشاطات الأخيرة
// ============================================================
router.get('/recent-activities', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);

        const [activities] = await db.query(
            `SELECT 
                al.*,
                u.name as userName,
                u.role as userRole,
                u.profile_picture
            FROM activity_log al
            LEFT JOIN users u ON al.userId = u.id
            ORDER BY al.timestamp DESC
            LIMIT ?`,
            [limit]
        );

        res.json({
            success: true,
            data: activities
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب النشاطات الأخيرة');
    }
});

// ============================================================
// 📊 GET /api/optimized/categories - الفئات مع الإحصائيات
// ============================================================
router.get('/categories', async (req, res) => {
    try {
        const [categories] = await db.query(
            `SELECT 
                p.category,
                COUNT(DISTINCT p.id) as productCount,
                COALESCE(SUM(s.quantity), 0) as totalStock,
                COALESCE(SUM(s.quantity * p.costPrice), 0) as stockValue,
                COALESCE(AVG(p.sellingPrice), 0) as avgPrice
            FROM products p
            LEFT JOIN stock s ON p.id = s.productId
            GROUP BY p.category
            ORDER BY productCount DESC`
        );

        const formattedCategories = categories.map(cat => ({
            category: cat.category || 'غير مصنف',
            productCount: parseInt(cat.productCount || 0),
            totalStock: parseFloat(cat.totalStock || 0),
            stockValue: parseFloat(cat.stockValue || 0),
            avgPrice: parseFloat(cat.avgPrice || 0)
        }));

        res.json({
            success: true,
            data: formattedCategories,
            count: formattedCategories.length
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب الفئات');
    }
});

// ============================================================
// 💡 GET /api/optimized/suggestions/reorder - اقتراحات إعادة الطلب
// ============================================================
router.get('/suggestions/reorder', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const today = new Date().toISOString().slice(0, 10);

        const [suggestions] = await db.query(
            `SELECT 
                p.id,
                p.code,
                p.name,
                p.category,
                COALESCE(SUM(s.quantity), 0) as currentStock,
                COALESCE(AVG(daily_sales.daily_qty), 0) as avgDailySales,
                GREATEST(5 - COALESCE(SUM(s.quantity), 0), 0) as suggestedOrderQty
            FROM products p
            LEFT JOIN stock s ON p.id = s.productId
            LEFT JOIN (
                SELECT 
                    sii.productId,
                    AVG(daily_total.total_qty) as daily_qty
                FROM sale_invoice_items sii
                JOIN sale_invoices si ON sii.invoiceId = si.id
                JOIN (
                    SELECT 
                        sii2.productId,
                        DATE(si2.date) as sale_date,
                        SUM(sii2.quantity) as total_qty
                    FROM sale_invoice_items sii2
                    JOIN sale_invoices si2 ON sii2.invoiceId = si2.id
                    WHERE si2.date >= DATE_SUB(?, INTERVAL ? DAY)
                    GROUP BY sii2.productId, DATE(si2.date)
                ) daily_total ON sii.productId = daily_total.productId
                GROUP BY sii.productId
            ) daily_sales ON p.id = daily_sales.productId
            GROUP BY p.id, p.code, p.name, p.category
            HAVING currentStock <= 5
            ORDER BY suggestedOrderQty DESC
            LIMIT 50`,
            [today, days]
        );

        const reorderSuggestions = suggestions.map(item => ({
            id: item.id,
            code: item.code,
            name: item.name,
            category: item.category || 'غير مصنف',
            currentStock: parseFloat(item.currentStock || 0),
            minStockLevel: 5,
            avgDailySales: parseFloat(item.avgDailySales || 0),
            suggestedOrderQty: Math.max(0, parseFloat(item.suggestedOrderQty || 0)),
            estimatedDaysToStockout: item.avgDailySales > 0 
                ? Math.floor(item.currentStock / item.avgDailySales) 
                : 999,
            priority: item.currentStock === 0 ? 'urgent' : 
                     item.currentStock <= 2 ? 'high' : 'medium'
        }));

        res.json({
            success: true,
            data: reorderSuggestions,
            count: reorderSuggestions.length
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب اقتراحات إعادة الطلب');
    }
});

// ============================================================
// 🎯 GET /api/optimized/performance/user/:userId - أداء مستخدم
// ============================================================
router.get('/performance/user/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const days = parseInt(req.query.days) || 30;
        const today = new Date().toISOString().slice(0, 10);

        if (!userId || isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: 'معرف المستخدم غير صحيح'
            });
        }

        // جلب معلومات المستخدم
        const [users] = await db.query(
            'SELECT id, name, email, role FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'المستخدم غير موجود'
            });
        }

        const user = users[0];

        // إحصائيات المبيعات (إذا كان كاشير)
        const [salesStats] = await db.query(
            `SELECT 
                COUNT(*) as totalInvoices,
                COALESCE(SUM(total), 0) as totalSales,
                COALESCE(AVG(total), 0) as avgInvoiceValue
            FROM sale_invoices
            WHERE cashierId = ? AND date >= DATE_SUB(?, INTERVAL ? DAY)`,
            [userId, today, days]
        );

        // إحصائيات النشاطات
        const [activityStats] = await db.query(
            `SELECT 
                COUNT(*) as totalActivities,
                COUNT(DISTINCT DATE(timestamp)) as activeDays
            FROM activity_log
            WHERE userId = ? AND timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
            [userId, days]
        );

        res.json({
            success: true,
            user,
            period: `آخر ${days} يوم`,
            performance: {
                sales: {
                    totalInvoices: salesStats[0]?.totalInvoices || 0,
                    totalSales: parseFloat(salesStats[0]?.totalSales || 0),
                    avgInvoiceValue: parseFloat(salesStats[0]?.avgInvoiceValue || 0)
                },
                activity: {
                    totalActivities: activityStats[0]?.totalActivities || 0,
                    activeDays: activityStats[0]?.activeDays || 0
                }
            }
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب أداء المستخدم');
    }
});

// ============================================================
// 🔔 GET /api/optimized/notifications - الإشعارات
// ============================================================
router.get('/notifications', async (req, res) => {
    try {
        const userId = parseInt(req.query.userId) || null;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const unreadOnly = req.query.unreadOnly === 'true';

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (userId) {
            whereClause += ' AND (userId = ? OR userId IS NULL)';
            params.push(userId);
        }

        if (unreadOnly) {
            whereClause += ' AND isRead = 0';
        }

        const [notifications] = await db.query(
            `SELECT * FROM notifications 
            ${whereClause}
            ORDER BY createdAt DESC
            LIMIT ?`,
            [...params, limit]
        ).catch(() => [[]]);

        res.json({
            success: true,
            data: notifications || [],
            count: notifications?.length || 0
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب الإشعارات');
    }
});

// ============================================================
// 🎨 GET /api/optimized/system/info - معلومات النظام
// ============================================================
router.get('/system/info', async (req, res) => {
    try {
        const [dbInfo] = await db.query('SELECT VERSION() as version, DATABASE() as dbName');
        const [tableStats] = await db.query(
            `SELECT 
                COUNT(CASE WHEN table_name = 'products' THEN 1 END) as products_table_exists,
                COUNT(CASE WHEN table_name = 'users' THEN 1 END) as users_table_exists,
                COUNT(CASE WHEN table_name = 'sale_invoices' THEN 1 END) as sales_table_exists
            FROM information_schema.tables 
            WHERE table_schema = DATABASE()`
        );

        res.json({
            success: true,
            data: {
                database: {
                    version: dbInfo[0]?.version || 'Unknown',
                    name: dbInfo[0]?.dbName || 'Unknown'
                },
                tables: {
                    products: tableStats[0]?.products_table_exists === 1,
                    users: tableStats[0]?.users_table_exists === 1,
                    sales: tableStats[0]?.sales_table_exists === 1
                },
                nodeVersion: process.version,
                uptime: process.uptime(),
                memory: process.memoryUsage()
            }
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب معلومات النظام');
    }
});

// ============================================================
// 📊 GET /api/optimized/reports/product-movement - تقرير حركة المنتجات
// ============================================================
router.get('/reports/product-movement', async (req, res) => {
    try {
        const startDate = req.query.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const endDate = req.query.endDate || new Date().toISOString().slice(0, 10);
        const productId = req.query.productId || null;

        let productFilter = '';
        const params = [startDate, endDate, startDate, endDate];

        if (productId) {
            productFilter = ' AND p.id = ?';
            params.push(productId, productId);
        }

        const [movements] = await db.query(
            `SELECT 
                p.id,
                p.code,
                p.name,
                p.category,
                COALESCE(SUM(sales.qty_sold), 0) as totalSold,
                COALESCE(SUM(purchases.qty_purchased), 0) as totalPurchased,
                COALESCE(SUM(s.quantity), 0) as currentStock
            FROM products p
            LEFT JOIN (
                SELECT sii.productId, SUM(sii.quantity) as qty_sold
                FROM sale_invoice_items sii
                JOIN sale_invoices si ON sii.invoiceId = si.id
                WHERE si.date BETWEEN ? AND ?
                GROUP BY sii.productId
            ) sales ON p.id = sales.productId
            LEFT JOIN (
                SELECT pii.productId, SUM(pii.quantity) as qty_purchased
                FROM purchase_invoice_items pii
                JOIN purchase_invoices pi ON pii.invoiceId = pi.id
                WHERE pi.date BETWEEN ? AND ?
                GROUP BY pii.productId
            ) purchases ON p.id = purchases.productId
            LEFT JOIN stock s ON p.id = s.productId
            WHERE 1=1 ${productFilter}
            GROUP BY p.id, p.code, p.name, p.category
            HAVING totalSold > 0 OR totalPurchased > 0
            ORDER BY totalSold DESC`,
            params
        );

        const formattedMovements = movements.map(item => ({
            id: item.id,
            code: item.code,
            name: item.name,
            category: item.category || 'غير مصنف',
            totalSold: parseFloat(item.totalSold || 0),
            totalPurchased: parseFloat(item.totalPurchased || 0),
            currentStock: parseFloat(item.currentStock || 0),
            netMovement: parseFloat(item.totalPurchased || 0) - parseFloat(item.totalSold || 0)
        }));

        res.json({
            success: true,
            period: { startDate, endDate },
            data: formattedMovements
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب تقرير حركة المنتجات');
    }
});

// ============================================================
// 💼 GET /api/optimized/backup/preview - معاينة البيانات للنسخ الاحتياطي
// ============================================================
router.get('/backup/preview', async (req, res) => {
    try {
        const [
            productsCount,
            customersCount,
            suppliersCount,
            salesCount,
            purchasesCount,
            usersCount
        ] = await Promise.all([
            db.query('SELECT COUNT(*) as count FROM products'),
            db.query('SELECT COUNT(*) as count FROM customers'),
            db.query('SELECT COUNT(*) as count FROM suppliers'),
            db.query('SELECT COUNT(*) as count FROM sale_invoices'),
            db.query('SELECT COUNT(*) as count FROM purchase_invoices'),
            db.query('SELECT COUNT(*) as count FROM users')
        ]);

        res.json({
            success: true,
            data: {
                products: productsCount[0][0].count || 0,
                customers: customersCount[0][0].count || 0,
                suppliers: suppliersCount[0][0].count || 0,
                sales: salesCount[0][0].count || 0,
                purchases: purchasesCount[0][0].count || 0,
                users: usersCount[0][0].count || 0
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        handleError(error, res, 'خطأ في معاينة البيانات');
    }
});

// ============================================================
// 🏆 GET /api/optimized/leaderboard/sales - لوحة المتصدرين (المبيعات)
// ============================================================
router.get('/leaderboard/sales', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const today = new Date().toISOString().slice(0, 10);

        const [leaderboard] = await db.query(
            `SELECT 
                u.id,
                u.name,
                u.email,
                u.profile_picture,
                COUNT(si.id) as totalInvoices,
                COALESCE(SUM(si.total), 0) as totalSales,
                COALESCE(AVG(si.total), 0) as avgInvoiceValue
            FROM users u
            LEFT JOIN sale_invoices si ON u.id = si.cashierId 
                AND si.date >= DATE_SUB(?, INTERVAL ? DAY)
            WHERE u.role IN ('admin', 'cashier')
            GROUP BY u.id, u.name, u.email, u.profile_picture
            HAVING totalInvoices > 0
            ORDER BY totalSales DESC
            LIMIT 10`,
            [today, days]
        );

        const formattedLeaderboard = leaderboard.map((user, index) => ({
            rank: index + 1,
            id: user.id,
            name: user.name,
            email: user.email,
            profilePicture: user.profile_picture,
            totalInvoices: parseInt(user.totalInvoices || 0),
            totalSales: parseFloat(user.totalSales || 0),
            avgInvoiceValue: parseFloat(user.avgInvoiceValue || 0)
        }));

        res.json({
            success: true,
            period: `آخر ${days} يوم`,
            data: formattedLeaderboard
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب لوحة المتصدرين');
    }
});

// ============================================================
// 🎯 GET /api/optimized/targets/sales - الأهداف والإنجازات
// ============================================================
router.get('/targets/sales', async (req, res) => {
    try {
        const month = req.query.month || new Date().toISOString().slice(0, 7); // YYYY-MM
        const target = parseFloat(req.query.target) || 100000; // الهدف الشهري

        const [salesData] = await db.query(
            `SELECT 
                COUNT(*) as totalInvoices,
                COALESCE(SUM(total), 0) as totalSales,
                COALESCE(SUM(paid), 0) as totalPaid
            FROM sale_invoices
            WHERE DATE_FORMAT(date, '%Y-%m') = ?`,
            [month]
        );

        const achieved = parseFloat(salesData[0]?.totalSales || 0);
        const percentage = target > 0 ? ((achieved / target) * 100).toFixed(2) : 0;
        const remaining = Math.max(0, target - achieved);

        res.json({
            success: true,
            month,
            data: {
                target: target,
                achieved: achieved,
                percentage: parseFloat(percentage),
                remaining: remaining,
                totalInvoices: salesData[0]?.totalInvoices || 0,
                status: achieved >= target ? 'achieved' : 
                       achieved >= target * 0.7 ? 'on-track' : 'behind'
            }
        });

    } catch (error) {
        handleError(error, res, 'خطأ في جلب الأهداف');
    }
});

// ============================================================
// 🔍 GET /api/optimized/validate/product/:id - التحقق من وجود منتج
// ============================================================
router.get('/validate/product/:id', async (req, res) => {
    try {
        const productId = parseInt(req.params.id);

        if (!productId || isNaN(productId)) {
            return res.status(400).json({
                success: false,
                message: 'معرف المنتج غير صحيح'
            });
        }

        const [products] = await db.query(
            'SELECT id, code, name, sellingPrice FROM products WHERE id = ?',
            [productId]
        );

        if (products.length === 0) {
            return res.status(404).json({
                success: false,
                exists: false,
                message: 'المنتج غير موجود'
            });
        }

        res.json({
            success: true,
            exists: true,
            data: products[0]
        });

    } catch (error) {
        handleError(error, res, 'خطأ في التحقق من المنتج');
    }
});

// ============================================================
// 📋 GET /api/optimized/export/data - تصدير البيانات (JSON)
// ============================================================
router.get('/export/data', async (req, res) => {
    try {
        const type = req.query.type || 'all'; // all, products, customers, sales
        const startDate = req.query.startDate || '';
        const endDate = req.query.endDate || '';

        const exportData = {};

        if (type === 'all' || type === 'products') {
            const [products] = await db.query('SELECT * FROM products');
            exportData.products = products;
        }

        if (type === 'all' || type === 'customers') {
            const [customers] = await db.query('SELECT * FROM customers');
            exportData.customers = customers;
        }

        if (type === 'all' || type === 'sales') {
            let query = 'SELECT * FROM sale_invoices';
            const params = [];

            if (startDate && endDate) {
                query += ' WHERE date BETWEEN ? AND ?';
                params.push(startDate, endDate);
            }

            const [sales] = await db.query(query, params);
            exportData.sales = sales;
        }

        res.json({
            success: true,
            exportDate: new Date().toISOString(),
            type,
            data: exportData
        });

    } catch (error) {
        handleError(error, res, 'خطأ في تصدير البيانات');
    }
});

// ============================================================
// ✅ GET /api/optimized/health - فحص صحة النظام
// ============================================================
router.get('/health', async (req, res) => {
    try {
        const [dbCheck] = await db.query('SELECT 1 as result');
        
        res.json({
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: dbCheck[0]?.result === 1 ? 'connected' : 'disconnected',
            uptime: process.uptime(),
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            status: 'unhealthy',
            message: 'Database connection failed',
            error: error.message
        });
    }
});

// ============================================================
// 🎉 GET /api/optimized/test - اختبار Endpoint
// ============================================================
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: '✅ Optimized Endpoints are working perfectly!',
        version: '3.0.0',
        timestamp: new Date().toISOString(),
        features: [
            'Pagination',
            'Search & Filters',
            'SQL Injection Protection',
            'Error Handling',
            'Performance Optimization',
            'Dashboard Analytics',
            'Reports & Insights',
            'User Management',
            'Stock Management',
            'Financial Reports'
        ]
    });
});

// ============================================================
// 📤 Export Router
// ============================================================
module.exports = router;

// ============================================================
// 🎊 END OF FILE - Optimized Endpoints v3.0.0
// ============================================================
// 
// ملخص الـ Endpoints المتاحة:
// 
// المنتجات والمخزون:
// - GET /api/optimized/products
// - GET /api/optimized/stock
// - GET /api/optimized/stock-by-location/:locationId
// - GET /api/optimized/product/:id/history
// - GET /api/optimized/alerts/low-stock
// - GET /api/optimized/categories
// 
// المبيعات والمشتريات:
// - GET /api/optimized/sales
// - GET /api/optimized/purchases
// - GET /api/optimized/invoices
// 
// العملاء والموردين:
// - GET /api/optimized/customers
// - GET /api/optimized/suppliers
// - GET /api/optimized/customer/:id/statement
// 
// Dashboard والإحصائيات:
// - GET /api/optimized/dashboard/stats
// - GET /api/optimized/dashboard/charts
// - GET /api/optimized/dashboard/quick-stats
// 
// التقارير والتحليلات:
// - GET /api/optimized/analytics/profit
// - GET /api/optimized/analytics/best-selling
// - GET /api/optimized/reports/sales-summary
// - GET /api/optimized/reports/inventory-value
// - GET /api/optimized/reports/product-movement
// - GET /api/optimized/financial/summary
// 
// إدارة المستخدمين:
// - GET /api/optimized/users
// - GET /api/optimized/user/:userId
// - GET /api/optimized/user-avatar/:userId
// - GET /api/optimized/permissions/:userId
// - GET /api/optimized/performance/user/:userId
// 
// طلبات التسجيل:
// - GET /api/optimized/registration-requests
// - POST /api/optimized/registration-requests/:id/approve
// - POST /api/optimized/registration-requests/:id/reject
// 
// النشاطات والإشعارات:
// - GET /api/optimized/activity-log
// - GET /api/optimized/recent-activities
// - GET /api/optimized/notifications
// 
// المواقع:
// - GET /api/optimized/locations
// 
// البحث والاقتراحات:
// - GET /api/optimized/search
// - GET /api/optimized/suggestions/reorder
// 
// الأداء والأهداف:
// - GET /api/optimized/leaderboard/sales
// - GET /api/optimized/targets/sales
// 
// أدوات إضافية:
// - GET /api/optimized/validate/product/:id
// - GET /api/optimized/export/data
// - GET /api/optimized/system/info
// - GET /api/optimized/backup/preview
// - GET /api/optimized/health
// - GET /api/optimized/test
// 
// ============================================================
