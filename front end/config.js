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
    window.APP_VERSION = '1.0.0';
}

// ========== معلومات الاتصال ==========
console.log('%c🏪 نظام إدارة المخازن', 'color: #4361ee; font-size: 20px; font-weight: bold;');
console.log('%cالإصدار: ' + window.APP_VERSION, 'color: #10b981; font-size: 14px;');
console.log('%cBackend API: ' + window.API_URL, 'color: #6b7280; font-size: 12px;');
console.log('%cWebSocket: ' + window.WS_URL, 'color: #6b7280; font-size: 12px;');
console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #e5e7eb;');

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

// اختبار الاتصال عند تحميل الصفحة (مرة واحدة فقط)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', testBackendConnection);
} else {
    // استخدام setTimeout لتجنب التداخل
    setTimeout(testBackendConnection, 100);
}