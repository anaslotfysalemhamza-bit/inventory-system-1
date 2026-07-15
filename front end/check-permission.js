// ========== check-permission.js - النسخة النهائية مع صورة المستخدم في الـ Top Bar ==========

// ========== الحصول على صلاحيات المستخدم من localStorage ==========
function getUserPermissions(role) {
    var saved = localStorage.getItem('permissions_' + role);
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            return {};
        }
    }
    return {};
}

// ========== التحقق من صلاحية معينة ==========
function hasPermission(role, permissionId) {
    // المدير عنده كل الصلاحيات
    if (role === 'admin') return true;
    
    var permissions = getUserPermissions(role);
    return permissions[permissionId] === true;
}

// ========== الحصول على قائمة الصلاحيات لدور معين ==========
function getPermissionsList(role) {
    var permissions = getUserPermissions(role);
    var list = [];
    for (var key in permissions) {
        if (permissions[key] === true) {
            list.push(key);
        }
    }
    return list;
}

// ========== التحقق من أن المستخدم مدير ==========
function checkAdminPermission() {
    var currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser || currentUser.role !== 'admin') {
        if (currentUser && currentUser.role === 'storekeeper') {
            window.location.href = 'storekeeper.html';
        } else if (currentUser && currentUser.role === 'cashier') {
            window.location.href = 'pos.html';
        } else {
            window.location.href = 'login.html';
        }
        return false;
    }
    return true;
}

// ========== التحقق من أن المستخدم كاشير ==========
function checkCashierPermission() {
    var currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'cashier')) {
        if (currentUser && currentUser.role === 'storekeeper') {
            window.location.href = 'storekeeper.html';
        } else {
            window.location.href = 'login.html';
        }
        return false;
    }
    return true;
}

// ========== التحقق من أن المستخدم أمين مخزن ==========
function checkStorekeeperPermission() {
    var currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'storekeeper')) {
        if (currentUser && currentUser.role === 'cashier') {
            window.location.href = 'pos.html';
        } else {
            window.location.href = 'login.html';
        }
        return false;
    }
    return true;
}

// ========== تسجيل نشاط المستخدم ==========
async function logUserActivity(action, description, page) {
    var user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user || !user.id) return;

    try {
        var apiUrl = window.API_URL || 'http://localhost:5000/api';
        var currentPage = page || window.location.pathname.split('/').pop() || 'index.html';
        
        await fetch(apiUrl + '/log-activity', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: user.id,
                userName: user.name,
                action: action,
                description: description,
                page: currentPage,
                ipAddress: null,
                userAgent: navigator.userAgent
            })
        });
    } catch (error) {
        console.error('Error logging activity:', error);
    }
}

// ================================================================
// ========== صورة المستخدم في الـ Top Bar ==========
// ================================================================

// ========== تحديث الصورة في الـ Top Bar ==========
function updateTopBarAvatar() {
    var user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) return;

    var avatarContainer = document.getElementById('topBarAvatar');
    if (!avatarContainer) {
        // لو العنصر مش موجود، حاول تبحث عنه تاني
        avatarContainer = document.querySelector('.user-avatar-top');
        if (!avatarContainer) {
            console.log('⚠️ عنصر الصورة مش موجود في الصفحة');
            return;
        }
    }

    var profilePicture = localStorage.getItem('user_profile_picture_' + user.id) || '';
    var userName = user.name || 'مستخدم';
    var userInitial = userName.charAt(0).toUpperCase();

    // تنظيف المحتوى القديم
    avatarContainer.innerHTML = '';

    if (profilePicture && profilePicture !== 'null' && profilePicture !== 'undefined' && profilePicture !== '') {
        var img = document.createElement('img');
        img.src = profilePicture;
        img.alt = userName;
        img.title = userName;
        // إضافة الكلاس عشان الـ CSS يشتغل
        img.className = 'avatar-img-top';
        avatarContainer.appendChild(img);
        console.log('✅ تم تحديث الصورة في الـ Top Bar');
    } else {
        var div = document.createElement('div');
        div.className = 'avatar-placeholder-top';
        div.textContent = userInitial;
        avatarContainer.appendChild(div);
        console.log('✅ تم تحديث placeholder في الـ Top Bar');
    }
}

// ========== تحميل صورة المستخدم من السيرفر ==========
async function loadUserProfilePicture(userId) {
    try {
        var apiUrl = window.API_URL || 'http://localhost:5000/api';
        var response = await fetch(apiUrl + '/user/' + userId);
        var data = await response.json();
        
        if (data.success && data.data && data.data.profile_picture) {
            var imageUrl = data.data.profile_picture;
            if (!imageUrl.startsWith('http') && !imageUrl.startsWith('/uploads')) {
                imageUrl = apiUrl.replace('/api', '') + imageUrl;
            }
            localStorage.setItem('user_profile_picture_' + userId, imageUrl);
            console.log('✅ تم تحميل الصورة من السيرفر');
        } else {
            localStorage.removeItem('user_profile_picture_' + userId);
            console.log('ℹ️ مفيش صورة للمستخدم');
        }
        
        // تحديث الصورة في الـ Top Bar
        updateTopBarAvatar();
        
        // تحديث الـ Sidebar
        if (typeof renderSidebar === 'function') {
            renderSidebar();
        }
    } catch (error) {
        console.error('Error loading profile picture:', error);
    }
}

// ========== تحديث الصورة في كل مكان (Top Bar + Sidebar) ==========
function updateAllAvatars() {
    updateTopBarAvatar();
    if (typeof renderSidebar === 'function') {
        renderSidebar();
    }
    console.log('✅ تم تحديث جميع الصور');
}

// ========== التحقق من المستخدم وتحميل الصورة ==========
function checkUserAndLoadProfile() {
    var user = JSON.parse(localStorage.getItem('currentUser'));
    if (user && user.id) {
        loadUserProfilePicture(user.id);
    } else {
        console.log('ℹ️ مفيش مستخدم مسجل دخول');
    }
}

// ========== إصلاح الصورة في الـ Top Bar (استدعاء يدوي) ==========
function fixTopBarAvatar() {
    updateTopBarAvatar();
    console.log('🔧 تم إصلاح الصورة في الـ Top Bar');
}

// ================================================================
// ========== تسجيل نشاط تلقائي عند فتح الصفحة ==========
// ================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 check-permission.js loaded');
    
    // تحديث الصورة في الـ Top Bar
    updateTopBarAvatar();
    
    // تحميل الصورة من السيرفر إذا كانت موجودة
    checkUserAndLoadProfile();
    
    // تسجيل دخول الصفحة
    var currentPage = window.location.pathname.split('/').pop() || 'index.html';
    var pageNames = {
        'index.html': 'الصفحة الرئيسية',
        'dashboard.html': 'لوحة التحكم الشخصية',
        'products.html': 'المنتجات',
        'pos.html': 'نقاط البيع',
        'purchase.html': 'المشتريات',
        'sale.html': 'المبيعات',
        'customers.html': 'العملاء',
        'suppliers.html': 'الموردين',
        'stock.html': 'المخزون',
        'reports.html': 'التقارير',
        'profile.html': 'الملف الشخصي',
        'activity-log.html': 'سجل النشاطات',
        'locations.html': 'المواقع',
        'returns.html': 'المرتجعات',
        'audit.html': 'سجل الحركات',
        'price_update.html': 'تحديث الأسعار',
        'storekeeper.html': 'لوحة أمين المخزن',
        'approve-requests.html': 'طلبات الحسابات',
        'permissions-management.html': 'إدارة الصلاحيات',
        'invoices.html': 'إدارة الفواتير',
        'customer-payments.html': 'تسجيل دفعات العملاء',
        'customer-statement.html': 'كشف حساب العملاء',
        'manage-accounts.html': 'إدارة الحسابات',
        'attendance.html': 'حضور وانصراف'
    };

    var pageName = pageNames[currentPage] || currentPage;
    logUserActivity('PAGE_VIEW', 'دخول إلى صفحة: ' + pageName, currentPage);
});

// ================================================================
// ========== تصدير الدوال ==========
// ================================================================

window.checkAdminPermission = checkAdminPermission;
window.checkCashierPermission = checkCashierPermission;
window.checkStorekeeperPermission = checkStorekeeperPermission;
window.logUserActivity = logUserActivity;
window.hasPermission = hasPermission;
window.getUserPermissions = getUserPermissions;
window.getPermissionsList = getPermissionsList;

// دوال الصورة
window.updateTopBarAvatar = updateTopBarAvatar;
window.loadUserProfilePicture = loadUserProfilePicture;
window.updateAllAvatars = updateAllAvatars;
window.checkUserAndLoadProfile = checkUserAndLoadProfile;
window.fixTopBarAvatar = fixTopBarAvatar;