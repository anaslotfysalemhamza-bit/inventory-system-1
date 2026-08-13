// ========== Authentication & Authorization Middleware ==========
const jwt = require('jsonwebtoken');

// سر JWT (يجب نقله لـ .env في الإنتاج)
const JWT_SECRET = process.env.JWT_SECRET || 'inventory-system-secret-key-2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// ========== توليد JWT Token ==========
function generateToken(user) {
    const payload = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
    };
    
    return jwt.sign(payload, JWT_SECRET, { 
        expiresIn: JWT_EXPIRES_IN,
        issuer: 'inventory-system'
    });
}

// ========== التحقق من JWT Token ==========
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET, { issuer: 'inventory-system' });
    } catch (error) {
        return null;
    }
}

// ========== Middleware: التحقق من المصادقة ==========
async function authenticateUser(req, res, next) {
    try {
        // الحصول على التوكن من الـ Header
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                success: false, 
                message: 'غير مصرح - يرجى تسجيل الدخول',
                code: 'NO_TOKEN'
            });
        }

        const token = authHeader.substring(7); // إزالة "Bearer "
        
        // التحقق من التوكن
        const decoded = verifyToken(token);
        
        if (!decoded) {
            return res.status(401).json({ 
                success: false, 
                message: 'توكن غير صالح أو منتهي الصلاحية',
                code: 'INVALID_TOKEN'
            });
        }

        // التحقق من وجود المستخدم في قاعدة البيانات
        const { pool: db } = require('../config/database');
        const [users] = await db.query(
            'SELECT id, email, name, role, is_active, is_approved, account_status FROM users WHERE id = ?',
            [decoded.id]
        );

        if (users.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'المستخدم غير موجود',
                code: 'USER_NOT_FOUND'
            });
        }

        const user = users[0];

        // التحقق من حالة الحساب
        if (!user.is_active) {
            return res.status(403).json({ 
                success: false, 
                message: 'الحساب غير مفعل',
                code: 'ACCOUNT_INACTIVE'
            });
        }

        if (!user.is_approved) {
            return res.status(403).json({ 
                success: false, 
                message: 'الحساب في انتظار الموافقة',
                code: 'ACCOUNT_PENDING'
            });
        }

        if (user.account_status === 'suspended') {
            return res.status(403).json({ 
                success: false, 
                message: 'الحساب موقوف مؤقتاً',
                code: 'ACCOUNT_SUSPENDED'
            });
        }

        if (user.account_status === 'rejected') {
            return res.status(403).json({ 
                success: false, 
                message: 'تم رفض الحساب',
                code: 'ACCOUNT_REJECTED'
            });
        }

        // إرفاق بيانات المستخدم مع الطلب
        req.user = user;
        req.userId = user.id;
        req.userRole = user.role;
        
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'خطأ في التحقق من المصادقة',
            code: 'AUTH_ERROR'
        });
    }
}

// ========== Middleware: التحقق من دور المستخدم ==========
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                success: false, 
                message: 'يجب تسجيل الدخول أولاً',
                code: 'NOT_AUTHENTICATED'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ 
                success: false, 
                message: 'ليس لديك صلاحية للوصول إلى هذا المورد',
                code: 'INSUFFICIENT_PERMISSIONS',
                requiredRoles: allowedRoles,
                userRole: req.user.role
            });
        }

        next();
    };
}

// ========== Middleware: التحقق من صلاحية محددة ==========
function requirePermission(permissionId) {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                success: false, 
                message: 'يجب تسجيل الدخول أولاً',
                code: 'NOT_AUTHENTICATED'
            });
        }

        // المدير لديه كل الصلاحيات
        if (req.user.role === 'admin') {
            return next();
        }

        try {
            const { pool: db } = require('../config/database');
            const [permissions] = await db.query(
                'SELECT enabled FROM user_permissions WHERE user_id = ? AND permission_id = ?',
                [req.user.id, permissionId]
            );

            if (permissions.length === 0 || !permissions[0].enabled) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'ليس لديك صلاحية لتنفيذ هذا الإجراء',
                    code: 'PERMISSION_DENIED',
                    requiredPermission: permissionId
                });
            }

            next();
        } catch (error) {
            console.error('Permission check error:', error);
            return res.status(500).json({ 
                success: false, 
                message: 'خطأ في التحقق من الصلاحية',
                code: 'PERMISSION_CHECK_ERROR'
            });
        }
    };
}

// ========== Middleware: التحقق من صلاحية المدير ==========
const requireAdmin = requireRole('admin');

// ========== Middleware: التحقق من صلاحية أمين المخزن أو المدير ==========
const requireStorekeeperOrAdmin = requireRole('admin', 'storekeeper');

// ========== Middleware: التحقق من صلاحية الكاشير أو المدير ==========
const requireCashierOrAdmin = requireRole('admin', 'cashier');

// ========== Middleware اختياري: لا يوقف الطلب إذا لم يكن هناك توكن ==========
async function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const decoded = verifyToken(token);
            
            if (decoded) {
                const { pool: db } = require('../config/database');
                const [users] = await db.query(
                    'SELECT id, email, name, role, is_active, is_approved FROM users WHERE id = ?',
                    [decoded.id]
                );
                
                if (users.length > 0 && users[0].is_active && users[0].is_approved) {
                    req.user = users[0];
                    req.userId = users[0].id;
                    req.userRole = users[0].role;
                }
            }
        }
        
        next();
    } catch (error) {
        // في حالة الخطأ، نستمر بدون مستخدم
        next();
    }
}

// ========== تسجيل نشاط المستخدم تلقائياً ==========
async function logActivity(req, action, description) {
    if (!req.user) return;
    
    try {
        const { pool: db } = require('../config/database');
        await db.query(
            `INSERT INTO user_activity_log (user_id, user_name, action, description, page, ip_address, user_agent) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                req.user.id,
                req.user.name,
                action,
                description,
                req.path || req.originalUrl,
                req.ip || req.connection.remoteAddress,
                req.headers['user-agent'] || 'Unknown'
            ]
        );
    } catch (error) {
        console.error('Error logging activity:', error);
    }
}

module.exports = {
    generateToken,
    verifyToken,
    authenticateUser,
    requireRole,
    requirePermission,
    requireAdmin,
    requireStorekeeperOrAdmin,
    requireCashierOrAdmin,
    optionalAuth,
    logActivity,
    JWT_SECRET,
    JWT_EXPIRES_IN
};
