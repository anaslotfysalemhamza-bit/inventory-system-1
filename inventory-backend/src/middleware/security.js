// ========== Security Middleware ==========

// ========== Rate Limiting: حماية من الطلبات الكثيرة ==========
const rateLimitStore = new Map();

function rateLimit(options = {}) {
    const {
        windowMs = 15 * 60 * 1000, // 15 دقيقة
        maxRequests = 100, // 100 طلب
        message = 'تم تجاوز عدد الطلبات المسموح. حاول مجدداً لاحقاً',
        skipSuccessfulRequests = false
    } = options;

    return (req, res, next) => {
        const key = req.ip || req.connection.remoteAddress || 'unknown';
        const now = Date.now();
        
        // الحصول على سجل الطلبات
        let record = rateLimitStore.get(key);
        
        if (!record) {
            record = { count: 0, resetTime: now + windowMs };
            rateLimitStore.set(key, record);
        }
        
        // إعادة تعيين العداد إذا انتهت الفترة
        if (now > record.resetTime) {
            record.count = 0;
            record.resetTime = now + windowMs;
        }
        
        // التحقق من تجاوز الحد
        if (record.count >= maxRequests) {
            const retryAfter = Math.ceil((record.resetTime - now) / 1000);
            res.set('Retry-After', retryAfter);
            return res.status(429).json({
                success: false,
                message: message,
                retryAfter: retryAfter
            });
        }
        
        // زيادة العداد
        record.count++;
        
        // إرسال معلومات Rate Limit في الـ Headers
        res.set({
            'X-RateLimit-Limit': maxRequests,
            'X-RateLimit-Remaining': maxRequests - record.count,
            'X-RateLimit-Reset': new Date(record.resetTime).toISOString()
        });
        
        next();
    };
}

// تنظيف السجلات القديمة كل ساعة
setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
        if (now > record.resetTime + 3600000) { // ساعة إضافية
            rateLimitStore.delete(key);
        }
    }
}, 3600000);

// ========== Sanitize Input: تنظيف المدخلات من XSS ==========
function sanitizeInput(req, res, next) {
    const sanitize = (obj) => {
        if (typeof obj !== 'object' || obj === null) {
            if (typeof obj === 'string') {
                // إزالة HTML tags و JavaScript
                return obj
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/<[^>]*>/g, '')
                    .trim();
            }
            return obj;
        }
        
        // Array handling
        if (Array.isArray(obj)) {
            return obj.map(item => sanitize(item));
        }
        
        // Object handling - استخدام Object.prototype.hasOwnProperty بدل obj.hasOwnProperty
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                obj[key] = sanitize(obj[key]);
            }
        }
        return obj;
    };
    
    if (req.body) {
        req.body = sanitize(req.body);
    }
    if (req.query) {
        req.query = sanitize(req.query);
    }
    if (req.params) {
        req.params = sanitize(req.params);
    }
    
    next();
}

// ========== Validate Required Fields ==========
function validateFields(requiredFields) {
    return (req, res, next) => {
        const missingFields = [];
        
        for (const field of requiredFields) {
            if (!req.body[field] || req.body[field] === '') {
                missingFields.push(field);
            }
        }
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'حقول مطلوبة مفقودة',
                missingFields: missingFields
            });
        }
        
        next();
    };
}

// ========== Validate Email Format ==========
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// ========== Validate Phone Format ==========
function validatePhone(phone) {
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    return phoneRegex.test(phone);
}

// ========== CORS Configuration ==========
function configureCORS() {
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
        ? process.env.ALLOWED_ORIGINS.split(',')
        : ['http://localhost:3000', 'http://localhost:5000', 'http://127.0.0.1:3000'];
    
    return {
        origin: function (origin, callback) {
            // السماح بالطلبات بدون origin (مثل Postman أو mobile apps)
            if (!origin) return callback(null, true);
            
            if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
                callback(null, true);
            } else {
                callback(new Error('غير مسموح بهذا المصدر من قبل CORS'));
            }
        },
        credentials: true,
        optionsSuccessStatus: 200
    };
}

// ========== Request Logger ==========
function requestLogger(req, res, next) {
    const start = Date.now();
    const { method, url, ip } = req;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        const { statusCode } = res;
        const user = req.user ? req.user.email : 'Anonymous';
        
        console.log(`[${new Date().toISOString()}] ${method} ${url} ${statusCode} ${duration}ms - ${user} - ${ip}`);
    });
    
    next();
}

// ========== Error Handler Middleware ==========
function errorHandler(err, req, res, next) {
    console.error('Error:', err);
    
    // خطأ Multer (رفع الملفات)
    if (err.name === 'MulterError') {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'حجم الملف كبير جداً. الحد الأقصى 5 ميجا'
            });
        }
        return res.status(400).json({
            success: false,
            message: 'خطأ في رفع الملف'
        });
    }
    
    // خطأ قاعدة البيانات
    if (err.code && err.code.startsWith('ER_')) {
        return res.status(500).json({
            success: false,
            message: 'خطأ في قاعدة البيانات',
            code: err.code
        });
    }
    
    // خطأ عام
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'حدث خطأ في الخادم',
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
}

// ========== Not Found Handler ==========
function notFoundHandler(req, res) {
    res.status(404).json({
        success: false,
        message: 'المورد المطلوب غير موجود',
        path: req.path
    });
}

module.exports = {
    rateLimit,
    sanitizeInput,
    validateFields,
    validateEmail,
    validatePhone,
    configureCORS,
    requestLogger,
    errorHandler,
    notFoundHandler
};
