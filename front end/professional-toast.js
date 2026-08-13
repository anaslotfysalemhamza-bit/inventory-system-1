/**
 * Professional Toast Notifications
 * نظام إشعارات احترافي متقدم للغاية
 * يمكن استخدامه في جميع صفحات المشروع
 * 
 * الاستخدام:
 * showProfessionalToast('رسالتك هنا', 'success'); // أخضر - نجاح
 * showProfessionalToast('رسالتك هنا', 'error');   // أحمر - خطأ
 * showProfessionalToast('رسالتك هنا', 'warning'); // برتقالي - تحذير
 * showProfessionalToast('رسالتك هنا', 'info');    // أزرق - معلومات
 */

function showProfessionalToast(message, type = 'success', duration = 3500) {
    // التأكد من أن الـ type صحيح
    const validTypes = ['success', 'error', 'warning', 'info'];
    if (!validTypes.includes(type)) {
        type = 'info';
    }

    // اختيار الأيقونة المناسبة
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };

    const toast = document.createElement('div');
    toast.className = `notification-toast ${type}`;
    
    // إنشاء الجزيئات المتحركة
    const particlesHTML = Array.from({length: 8}, (_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.5;
        return `<div class="toast-particle" style="left: ${left}%; animation-delay: ${delay}s;"></div>`;
    }).join('');
    
    toast.innerHTML = `
        <div class="toast-particles">
            ${particlesHTML}
        </div>
        <div class="toast-content">
            <div class="toast-icon-container">
                <i class="fas ${icons[type]}"></i>
            </div>
            <div class="toast-text-container">
                <span>${message}</span>
            </div>
            <button class="toast-close" onclick="this.parentElement.parentElement.classList.add('exit'); setTimeout(() => this.parentElement.parentElement.remove(), 500)">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="toast-progress">
            <div class="toast-progress-bar" style="animation-duration: ${duration}ms;"></div>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // إزالة تلقائية مع animation الخروج
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('exit');
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove();
                }
            }, 500);
        }
    }, duration);

    return toast;
}

// دوال مساعدة لكل نوع
function showSuccessToast(message, duration) {
    return showProfessionalToast(message, 'success', duration);
}

function showErrorToast(message, duration) {
    return showProfessionalToast(message, 'error', duration);
}

function showWarningToast(message, duration) {
    return showProfessionalToast(message, 'warning', duration);
}

function showInfoToast(message, duration) {
    return showProfessionalToast(message, 'info', duration);
}

// للتوافق مع الكود القديم
function showNotification(message, type, duration) {
    return showProfessionalToast(message, type, duration);
}
