// ═══════════════════════════════════════════════════════════════
// 🚀 Smart Cache Manager - إدارة الذاكرة المؤقتة الذكية
// ═══════════════════════════════════════════════════════════════
// نظام caching متقدم بدون الحاجة لـ Redis
// يحسّن الأداء 10-100X للبيانات المتكررة
// ═══════════════════════════════════════════════════════════════

class CacheManager {
  constructor() {
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      clears: 0
    };
    
    // تنظيف تلقائي كل 5 دقائق
    this.startCleanupInterval();
    
    console.log('✅ Cache Manager initialized');
  }

  /**
   * حفظ قيمة في الـ Cache
   * @param {string} key - المفتاح
   * @param {*} value - القيمة
   * @param {number} ttl - مدة الصلاحية بالثواني (افتراضي: 5 دقائق)
   */
  set(key, value, ttl = 300) {
    const expiresAt = Date.now() + (ttl * 1000);
    
    this.cache.set(key, {
      value,
      expiresAt,
      createdAt: Date.now()
    });
    
    this.stats.sets++;
    
    return true;
  }

  /**
   * الحصول على قيمة من الـ Cache
   * @param {string} key - المفتاح
   * @returns {*} القيمة أو null
   */
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      this.stats.misses++;
      return null;
    }
    
    // التحقق من انتهاء الصلاحية
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }
    
    this.stats.hits++;
    return item.value;
  }

  /**
   * حذف قيمة من الـ Cache
   * @param {string} key - المفتاح
   */
  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.deletes++;
    }
    return deleted;
  }

  /**
   * حذف جميع القيم التي تبدأ بـ pattern
   * @param {string} pattern - النمط
   */
  deletePattern(pattern) {
    let count = 0;
    
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    
    this.stats.deletes += count;
    return count;
  }

  /**
   * مسح الـ Cache بالكامل
   */
  clear() {
    this.cache.clear();
    this.stats.clears++;
    console.log('🗑️  Cache cleared');
  }

  /**
   * التحقق من وجود مفتاح
   * @param {string} key - المفتاح
   */
  has(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return false;
    }
    
    // التحقق من انتهاء الصلاحية
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * الحصول على جميع المفاتيح
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * حجم الـ Cache
   */
  size() {
    return this.cache.size;
  }

  /**
   * إحصائيات الـ Cache
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? ((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(2)
      : 0;
    
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      size: this.cache.size,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * تقدير استهلاك الذاكرة
   */
  estimateMemoryUsage() {
    let totalSize = 0;
    
    for (const [key, item] of this.cache.entries()) {
      // تقدير حجم المفتاح والقيمة
      totalSize += key.length * 2; // chars = 2 bytes
      totalSize += JSON.stringify(item.value).length * 2;
    }
    
    // تحويل إلى MB
    const mb = (totalSize / (1024 * 1024)).toFixed(2);
    return `${mb} MB`;
  }

  /**
   * تنظيف العناصر المنتهية الصلاحية
   */
  cleanup() {
    let cleaned = 0;
    const now = Date.now();
    
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} expired cache entries`);
    }
    
    return cleaned;
  }

  /**
   * بدء التنظيف التلقائي
   */
  startCleanupInterval() {
    // تنظيف كل 5 دقائق
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * إيقاف التنظيف التلقائي
   */
  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Cache Wrapper - دالة مساعدة للاستخدام السهل
   * @param {string} key - المفتاح
   * @param {Function} fetchFunction - دالة جلب البيانات
   * @param {number} ttl - مدة الصلاحية
   */
  async wrap(key, fetchFunction, ttl = 300) {
    // محاولة الحصول من الـ Cache
    const cached = this.get(key);
    
    if (cached !== null) {
      console.log(`💨 Cache HIT: ${key}`);
      return cached;
    }
    
    console.log(`🔍 Cache MISS: ${key}`);
    
    // جلب البيانات
    const data = await fetchFunction();
    
    // حفظ في الـ Cache
    this.set(key, data, ttl);
    
    return data;
  }
}

// إنشاء instance واحد (Singleton)
const cacheManager = new CacheManager();

// ═══════════════════════════════════════════════════════════════
// Cache Keys Patterns - أنماط المفاتيح
// ═══════════════════════════════════════════════════════════════

const CACHE_KEYS = {
  // إحصائيات Dashboard
  DASHBOARD_STATS: 'dashboard:stats',
  DASHBOARD_CHARTS: 'dashboard:charts',
  
  // المنتجات
  PRODUCTS_ALL: 'products:all',
  PRODUCTS_PAGE: (page, limit) => `products:page:${page}:${limit}`,
  PRODUCTS_COUNT: 'products:count',
  PRODUCT_BY_ID: (id) => `product:${id}`,
  PRODUCTS_LOW_STOCK: 'products:low_stock',
  
  // الفواتير
  INVOICES_PAGE: (page, limit, type) => `invoices:page:${page}:${limit}:${type}`,
  INVOICES_COUNT: (type) => `invoices:count:${type}`,
  INVOICE_BY_ID: (id) => `invoice:${id}`,
  
  // العملاء
  CUSTOMERS_ALL: 'customers:all',
  CUSTOMERS_PAGE: (page, limit) => `customers:page:${page}:${limit}`,
  CUSTOMERS_COUNT: 'customers:count',
  CUSTOMER_BY_ID: (id) => `customer:${id}`,
  
  // الموردين
  SUPPLIERS_ALL: 'suppliers:all',
  SUPPLIERS_COUNT: 'suppliers:count',
  
  // التقارير
  SALES_REPORT: (from, to) => `report:sales:${from}:${to}`,
  PURCHASES_REPORT: (from, to) => `report:purchases:${from}:${to}`,
  PROFIT_REPORT: (from, to) => `report:profit:${from}:${to}`,
  
  // الفئات والمواقع
  CATEGORIES_ALL: 'categories:all',
  LOCATIONS_ALL: 'locations:all'
};

// ═══════════════════════════════════════════════════════════════
// Cache Invalidation Helpers - مساعدات حذف الـ Cache
// ═══════════════════════════════════════════════════════════════

const invalidateCache = {
  // حذف cache المنتجات
  products: () => {
    cacheManager.deletePattern('products:');
    cacheManager.deletePattern('product:');
    cacheManager.delete(CACHE_KEYS.DASHBOARD_STATS);
    console.log('🗑️  Products cache invalidated');
  },
  
  // حذف cache الفواتير
  invoices: () => {
    cacheManager.deletePattern('invoices:');
    cacheManager.deletePattern('invoice:');
    cacheManager.delete(CACHE_KEYS.DASHBOARD_STATS);
    cacheManager.delete(CACHE_KEYS.DASHBOARD_CHARTS);
    console.log('🗑️  Invoices cache invalidated');
  },
  
  // حذف cache العملاء
  customers: () => {
    cacheManager.deletePattern('customers:');
    cacheManager.deletePattern('customer:');
    cacheManager.delete(CACHE_KEYS.DASHBOARD_STATS);
    console.log('🗑️  Customers cache invalidated');
  },
  
  // حذف cache الموردين
  suppliers: () => {
    cacheManager.deletePattern('suppliers:');
    cacheManager.delete(CACHE_KEYS.DASHBOARD_STATS);
    console.log('🗑️  Suppliers cache invalidated');
  },
  
  // حذف cache Dashboard
  dashboard: () => {
    cacheManager.delete(CACHE_KEYS.DASHBOARD_STATS);
    cacheManager.delete(CACHE_KEYS.DASHBOARD_CHARTS);
    console.log('🗑️  Dashboard cache invalidated');
  },
  
  // حذف cache التقارير
  reports: () => {
    cacheManager.deletePattern('report:');
    console.log('🗑️  Reports cache invalidated');
  },
  
  // حذف كل شيء
  all: () => {
    cacheManager.clear();
    console.log('🗑️  All cache invalidated');
  }
};

// ═══════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════

module.exports = {
  cacheManager,
  CACHE_KEYS,
  invalidateCache
};
