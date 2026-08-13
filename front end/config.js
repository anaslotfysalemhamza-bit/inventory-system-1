// ========== إعدادات الاتصال بالـ Backend ==========
// التحقق من عدم تعريف API_URL مسبقاً
if (typeof window.API_URL === 'undefined') {
    window.API_URL = 'http://localhost:5000/api';
}
if (typeof window.WS_URL === 'undefined') {
    window.WS_URL = 'ws://localhost:8080';
}
if (typeof window.BACKEND_URL === 'undefined') {
    window.BACKEND_URL = 'http://localhost:5000';
}

// ========== إعدادات التطبيق ==========
if (typeof window.APP_NAME === 'undefined') {
    window.APP_NAME = 'نظام إدارة المخازن';
}
if (typeof window.APP_VERSION === 'undefined') {
    window.APP_VERSION = '2.0.0';
}

// ========== معلومات الاتصال ==========
console.log('%c🏪 نظام إدارة المخازن', 'color: #4361ee; font-size: 20px; font-weight: bold;');
console.log('%cالإصدار: ' + window.APP_VERSION, 'color: #10b981; font-size: 14px;');
console.log('%cBackend API: ' + window.API_URL, 'color: #6b7280; font-size: 12px;');
console.log('%cWebSocket: ' + window.WS_URL, 'color: #6b7280; font-size: 12px;');
console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #e5e7eb;');

// ========== إدارة JWT Token ==========
function getAuthToken() {
    return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
}

function setAuthToken(token, remember = false) {
    if (remember) {
        localStorage.setItem('auth_token', token);
    } else {
        sessionStorage.setItem('auth_token', token);
    }
}

function clearAuthToken() {
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_token');
}

// ========== دالة Logout شاملة ==========
async function logout() {
    try {
        const token = getAuthToken();
        
        // إرسال طلب logout للسيرفر إذا كان هناك توكن
        if (token) {
            await fetch(window.API_URL + '/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }).catch(err => console.log('Logout request failed:', err));
        }
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        // تنظيف البيانات المحلية
        clearAuthToken();
        localStorage.removeItem('currentUser');
        
        // إظهار رسالة
        if (typeof showProfessionalToast === 'function') {
            showProfessionalToast('تم تسجيل الخروج بنجاح 👋', 'success');
        }
        
        // إعادة التوجيه لصفحة تسجيل الدخول
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 500);
    }
}

// جعل logout متاحة عالمياً
window.logout = logout;

// ========== Fetch مع JWT Authentication ==========
async function authenticatedFetch(url, options = {}) {
    const token = getAuthToken();
    
    if (token) {
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };
    }
    
    // إضافة Content-Type تلقائياً للـ JSON
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
        options.headers = {
            ...options.headers,
            'Content-Type': 'application/json'
        };
        options.body = JSON.stringify(options.body);
    }
    
    try {
        const response = await fetch(url, options);
        
        // معالجة حالات انتهاء صلاحية التوكن
        if (response.status === 401) {
            const data = await response.json();
            
            if (data.code === 'INVALID_TOKEN' || data.code === 'NO_TOKEN') {
                // إعادة توجيه لتسجيل الدخول
                clearAuthToken();
                localStorage.removeItem('currentUser');
                
                if (window.location.pathname !== '/login.html' && window.location.pathname !== '/') {
                    window.location.href = 'login.html';
                }
            }
        }
        
        return response;
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}

// جعلها متاحة عالمياً
window.authenticatedFetch = authenticatedFetch;
window.getAuthToken = getAuthToken;
window.setAuthToken = setAuthToken;
window.clearAuthToken = clearAuthToken;

// ========== اختبار الاتصال بالـ Backend ==========
async function testBackendConnection() {
    try {
        const response = await fetch(window.BACKEND_URL + '/api/test', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('%c✅ الاتصال بالـ Backend ناجح!', 'color: #10b981; font-size: 14px; font-weight: bold;');
            console.log('%c📡 الوقت: ' + data.time, 'color: #6b7280; font-size: 12px;');
            return true;
        } else {
            console.warn('%c⚠️ البيانات المُرجعة من Backend غير صحيحة', 'color: #f59e0b; font-size: 14px;');
            return false;
        }
    } catch (error) {
        console.error('%c❌ فشل الاتصال بالـ Backend', 'color: #ef4444; font-size: 14px; font-weight: bold;');
        console.error('%c💡 تأكد من تشغيل السيرفر على: ' + window.BACKEND_URL, 'color: #6b7280; font-size: 12px;');
        console.error('%c💡 يمكنك تشغيله باستخدام: npm start', 'color: #6b7280; font-size: 12px;');
        return false;
    }
}

// ========== التحقق من المستخدم عند تحميل الصفحة ==========
async function verifyUserOnLoad() {
    // التحقق من وضع المعاينة
    const urlParams = new URLSearchParams(window.location.search);
    const isThemePreview = urlParams.get('themePreview') === 'true';
    
    if (isThemePreview) {
        console.log('🎨 Theme Preview Mode - skipping auth check');
        return; // تخطي التحقق في وضع المعاينة
    }
    
    // صفحات مستثناة من التحقق
    const currentPath = window.location.pathname;
    const exemptPages = ['/login.html', '/register-request.html', '/index.html', '/'];
    
    // إذا كانت الصفحة من الصفحات المستثناة، لا تفعل شيء
    if (exemptPages.some(page => currentPath.includes(page) || currentPath === page)) {
        return;
    }
    
    const token = getAuthToken();
    const currentUser = localStorage.getItem('currentUser');
    
    // إذا لم يكن هناك توكن، إعادة توجيه
    if (!token || !currentUser) {
        console.log('No token found, redirecting to login...');
        window.location.href = 'login.html';
        return;
    }
    
    // التحقق من صلاحية التوكن
    try {
        const response = await authenticatedFetch(window.API_URL + '/auth/verify');
        
        if (!response.ok) {
            console.log('Token invalid, clearing and redirecting...');
            clearAuthToken();
            localStorage.removeItem('currentUser');
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error('Token verification failed:', error);
    }
}

// تشغيل التحقق عند تحميل الصفحة (فقط إذا لم تكن صفحة login)
if (!window.location.pathname.includes('login.html') && 
    !window.location.pathname.includes('register-request.html')) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', verifyUserOnLoad);
    } else {
        verifyUserOnLoad();
    }
}

// ========== دالة التحويل حسب دور المستخدم ==========
function redirectToUserHomePage(user) {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    
    const role = user.role || '';
    
    switch(role) {
        case 'admin':
            window.location.href = 'index.html';
            break;
        case 'storekeeper':
            window.location.href = 'storekeeper.html';
            break;
        case 'cashier':
            window.location.href = 'pos.html';
            break;
        case 'accountant':
            window.location.href = 'reports.html';
            break;
        case 'reviewer':
            window.location.href = 'audit.html';
            break;
        default:
            window.location.href = 'index.html';
            break;
    }
}

// جعلها متاحة عالمياً
window.redirectToUserHomePage = redirectToUserHomePage;

// ========== قائمة الصفحات للثيمات ==========
// دالة تُرجع قائمة بأسماء الصفحات (اسم الملف ← الاسم العربي)
window.getPageNames = function() {
    return {
        'dashboard.html': 'لوحة التحكم',
        'products.html': 'المنتجات',
        'products-optimized.html': 'المنتجات (مُحسّنة)',
        'sell-invoice.html': 'فاتورة بيع',
        'purchase-invoice.html': 'فاتورة شراء',
        'stock.html': 'المخزون الحالي',
        'customers.html': 'العملاء',
        'suppliers.html': 'الموردين',
        'invoices.html': 'إدارة الفواتير',
        'invoices-optimized.html': 'إدارة الفواتير (مُحسّنة)',
        'reports.html': 'التقارير',
        'movements.html': 'سجل الحركات',
        'safe.html': 'الخزنة',
        'attendance.html': 'حضور وانصراف',
        'locations.html': 'أماكن التخزين',
        'returns.html': 'المرتجعات',
        'customer-statement.html': 'كشف حساب العملاء',
        'customer-payments.html': 'تسجيل دفعات',
        'price_update.html': 'تحديث الأسعار',
        'manage-accounts.html': 'إدارة الحسابات',
        'approve-requests.html': 'طلبات الحسابات',
        'permissions-management.html': 'الصلاحيات',
        'user-details.html': 'تفاصيل المستخدمين',
        'profile.html': 'الملف الشخصي',
        'theme-settings.html': 'تخصيص الثيم',
        'audit.html': 'سجل المراجعة'
    };
};

console.log('%c✅ Page Names Registry Loaded', 'color: #8b5cf6; font-size: 12px; font-weight: bold;');
