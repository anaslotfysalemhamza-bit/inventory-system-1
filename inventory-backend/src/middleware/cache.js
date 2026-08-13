/**
 * 🚀 Simple In-Memory Caching Middleware
 * بديل بسيط وسريع لـ Redis - بدون تنصيب خارجي
 * 
 * الميزات:
 * - تخزين في الذاكرة (RAM) - سرعة فائقة
 * - Auto-invalidation عند التعديل
 * - TTL (Time To Live) للبيانات
 * - حجم محدود لمنع استهلاك الذاكرة
 */

class SimpleCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize || 500; // Max 500 entries
    this.defaultTTL = options.defaultTTL || 5 * 60 * 1000; // 5 minutes default
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      invalidations: 0
    };
  }

  /**
   * توليد مفتاح Cache فريد من URL + Query Params
   */
  generateKey(req) {
    const url = req.originalUrl || req.url;
    const method = req.method;
    return `${method}:${url}`;
  }

  /**
   * حفظ البيانات في Cache
   */
  set(key, value, ttl = this.defaultTTL) {
    // حذف أقدم entry إذا وصلنا للحد الأقصى
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    const expiresAt = Date.now() + ttl;
    this.cache.set(key, { value, expiresAt });
    this.stats.sets++;
  }

  /**
   * جلب البيانات من Cache
   */
  get(key) {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // تحقق من انتهاء الصلاحية
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.value;
  }

  /**
   * حذف مفتاح محدد
   */
  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.invalidations++;
    }
    return deleted;
  }

  /**
   * حذف كل المفاتيح التي تحتوي على pattern
   */
  invalidatePattern(pattern) {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    this.stats.invalidations += count;
    return count;
  }

  /**
   * مسح كل الـ Cache
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.stats.invalidations += size;
    return size;
  }

  /**
   * الحصول على حجم الـ Cache
   */
  size() {
    return this.cache.size;
  }

  /**
   * إحصائيات الأداء
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) : 0;
    
    return {
      ...this.stats,
      total,
      hitRate: `${hitRate}%`,
      size: this.cache.size,
      maxSize: this.maxSize
    };
  }

  /**
   * تنظيف المفاتيح المنتهية الصلاحية (Garbage Collection)
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }
}

// ✅ إنشاء instance واحد مشترك
const cache = new SimpleCache({
  maxSize: 500,        // 500 مدخل كحد أقصى
  defaultTTL: 5 * 60 * 1000  // 5 دقائق
});

// ✅ تنظيف تلقائي كل دقيقة
setInterval(() => {
  const cleaned = cache.cleanup();
  if (cleaned > 0) {
    console.log(`🧹 Cleaned ${cleaned} expired cache entries`);
  }
}, 60 * 1000);

/**
 * Middleware للتخزين المؤقت التلقائي
 * استخدام: app.get('/api/products', cacheMiddleware(60), handler)
 */
function cacheMiddleware(ttlSeconds = 300) {
  return (req, res, next) => {
    // ✅ فقط GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const key = cache.generateKey(req);
    const cachedData = cache.get(key);

    if (cachedData) {
      console.log(`✅ Cache HIT: ${key}`);
      return res.json(cachedData);
    }

    console.log(`❌ Cache MISS: ${key}`);

    // ✅ حفظ النتيجة في الـ Cache
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      cache.set(key, data, ttlSeconds * 1000);
      return originalJson(data);
    };

    next();
  };
}

/**
 * Invalidation تلقائي بعد العمليات (POST, PUT, DELETE)
 */
function autoInvalidateMiddleware(patterns) {
  return (req, res, next) => {
    // فقط للعمليات التي تعدل البيانات
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      return next();
    }

    // ✅ حذف الـ Cache بعد نجاح العملية
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      if (data.success === true) {
        patterns.forEach(pattern => {
          const count = cache.invalidatePattern(pattern);
          if (count > 0) {
            console.log(`🗑️ Invalidated ${count} cache entries matching: ${pattern}`);
          }
        });
      }
      return originalJson(data);
    };

    next();
  };
}

/**
 * دالة مساعدة لحذف Cache يدوياً
 */
function invalidateCache(patterns) {
  if (typeof patterns === 'string') {
    return cache.invalidatePattern(patterns);
  }
  
  if (Array.isArray(patterns)) {
    let total = 0;
    patterns.forEach(pattern => {
      total += cache.invalidatePattern(pattern);
    });
    return total;
  }

  return 0;
}

module.exports = {
  cache,
  cacheMiddleware,
  autoInvalidateMiddleware,
  invalidateCache
};
