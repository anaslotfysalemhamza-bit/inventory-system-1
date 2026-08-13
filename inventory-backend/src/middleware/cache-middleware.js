// ═══════════════════════════════════════════════════════════════
// 🚀 Cache Middleware - للاستجابة السريعة
// ═══════════════════════════════════════════════════════════════

const { cacheManager } = require('../utils/cache-manager');

/**
 * Middleware للـ Caching
 * @param {number} ttl - مدة الصلاحية بالثواني (افتراضي: 5 دقائق)
 * @param {Function} keyGenerator - دالة لتوليد المفتاح
 */
function cacheMiddleware(ttl = 300, keyGenerator = null) {
  return (req, res, next) => {
    // تجاهل الـ Cache للطلبات غير GET
    if (req.method !== 'GET') {
      return next();
    }
    
    // توليد المفتاح
    const cacheKey = keyGenerator 
      ? keyGenerator(req)
      : `${req.originalUrl || req.url}`;
    
    // محاولة الحصول من الـ Cache
    const cachedData = cacheManager.get(cacheKey);
    
    if (cachedData !== null) {
      console.log(`💨 Cache HIT: ${cacheKey}`);
      
      // إضافة header للتوضيح
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Cache-Key', cacheKey);
      
      return res.json(cachedData);
    }
    
    console.log(`🔍 Cache MISS: ${cacheKey}`);
    
    // تعديل res.json لحفظ النتيجة في الـ Cache
    const originalJson = res.json.bind(res);
    
    res.json = function(data) {
      // حفظ في الـ Cache
      cacheManager.set(cacheKey, data, ttl);
      
      // إضافة headers
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Cache-Key', cacheKey);
      
      return originalJson(data);
    };
    
    next();
  };
}

/**
 * Middleware لحذف الـ Cache بعد التعديلات
 * @param {Function} invalidateFunction - دالة حذف الـ Cache
 */
function invalidateCacheMiddleware(invalidateFunction) {
  return (req, res, next) => {
    // حذف الـ Cache بعد انتهاء الطلب بنجاح
    const originalJson = res.json.bind(res);
    
    res.json = function(data) {
      // حذف الـ Cache إذا كان الطلب ناجحاً
      if (res.statusCode >= 200 && res.statusCode < 300) {
        invalidateFunction();
      }
      
      return originalJson(data);
    };
    
    next();
  };
}

/**
 * Cache Statistics Endpoint
 */
function getCacheStats(req, res) {
  const stats = cacheManager.getStats();
  
  res.json({
    success: true,
    stats,
    message: 'Cache statistics retrieved successfully'
  });
}

/**
 * Clear Cache Endpoint
 */
function clearCache(req, res) {
  const { pattern } = req.body;
  
  if (pattern) {
    const count = cacheManager.deletePattern(pattern);
    res.json({
      success: true,
      message: `Cleared ${count} cache entries matching pattern: ${pattern}`
    });
  } else {
    cacheManager.clear();
    res.json({
      success: true,
      message: 'All cache cleared'
    });
  }
}

module.exports = {
  cacheMiddleware,
  invalidateCacheMiddleware,
  getCacheStats,
  clearCache
};
