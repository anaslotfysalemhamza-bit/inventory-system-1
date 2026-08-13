// ================================================================
// check-permission.js - النسخة النهائية مع دعم الصلاحيات الديناميكية
// ================================================================

// ================================================================
// 🔑 دوال الصلاحيات الأساسية
// ================================================================

// ========== الحصول على صلاحيات المستخدم من localStorage ==========
function getUserPermissions(userId) {
    // لو مفيش userId، حاول تجيب المستخدم الحالي
    if (!userId) {
        var currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        userId = currentUser.id;
    }

    if (!userId) return {};

    var saved = localStorage.getItem('user_permissions_' + userId);
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            return {};
        }
    }
    return {};
}

// ========== ✅ التحقق من صلاحية معينة ==========
function checkPermission(userId, permissionId, role) {
    // لو مفيش userId، استخدم المستخدم الحالي
    if (!userId) {
        var currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        userId = currentUser.id;
        role = currentUser.role;
    }

    // المدير عنده كل الصلاحيات
    if (role === 'admin') return true;

    var permissions = getUserPermissions(userId);
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

// ================================================================
// 👤 دوال التحقق من الأدوار - بدون تحويل تلقائي
// ================================================================

// ========== التحقق من أن المستخدم مدير ==========
function checkAdminPermission() {
    var currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser || currentUser.role !== 'admin') {
        return false;
    }
    return true;
}

// ========== التحقق من أن المستخدم كاشير ==========
function checkCashierPermission() {
    var currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'cashier')) {
        return false;
    }
    return true;
}

// ========== التحقق من أن المستخدم أمين مخزن ==========
function checkStorekeeperPermission() {
    var currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'storekeeper')) {
        return false;
    }
    return true;
}

// ========== ✅ دالة التحويل حسب الدور (تُستخدم في storekeeper.html) ==========
function redirectBasedOnRole() {
    var currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    if (currentUser.role === 'admin' || currentUser.role === 'storekeeper') {
        window.location.href = 'index.html';
    } else if (currentUser.role === 'cashier') {
        window.location.href = 'pos.html';
    } else {
        window.location.href = 'login.html';
    }
}

// ================================================================
// 📋 دوال تسجيل النشاطات
// ================================================================

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
// 🖼️ دوال صورة المستخدم في الـ Top Bar
// ================================================================

// ========== تحديث الصورة في الـ Top Bar ==========
function updateTopBarAvatar() {
    var user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) return;

    var avatarContainer = document.getElementById('topBarAvatar');
    if (!avatarContainer) {
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
        img.className = 'avatar-img-top';
        img.onerror = function () {
            // لو الصورة مش موجودة، اعرض placeholder
            avatarContainer.innerHTML = '';
            var div = document.createElement('div');
            div.className = 'avatar-placeholder-top';
            div.textContent = userInitial;
            avatarContainer.appendChild(div);
        };
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
// 🔄 دوال لتحديث الصلاحيات في كل مكان
// ================================================================

// ========== ✅ تحديث الصلاحيات في الـ Sidebar و Dashboard ==========
function refreshUserPermissions(userId) {
    if (!userId) {
        var user = JSON.parse(localStorage.getItem('currentUser'));
        if (user) userId = user.id;
    }

    if (!userId) return;

    // تحديث الـ Sidebar
    if (typeof renderSidebar === 'function') {
        renderSidebar();
    }

    // تحديث الـ Dashboard لو موجود
    if (typeof refreshDashboard === 'function') {
        refreshDashboard();
    }

    console.log('✅ تم تحديث الصلاحيات في كل مكان');
}

// ========== ✅ حفظ صلاحيات المستخدم وتحديث كل شيء ==========
function saveUserPermissionsAndRefresh(userId, permissions) {
    if (!userId || !permissions) return;

    // حفظ في localStorage
    localStorage.setItem('user_permissions_' + userId, JSON.stringify(permissions));

    // تحديث كل شيء
    refreshUserPermissions(userId);

    console.log('✅ تم حفظ الصلاحيات وتحديث الواجهة');
}

// ========== ✅ دالة لتحديث كل شيء بعد تغيير الصلاحيات ==========
function refreshAllAfterPermissionChange(userId) {
    console.log('🔄 جاري تحديث الواجهة بعد تغيير الصلاحيات...');

    // 1. تحديث الـ Sidebar
    if (typeof refreshSidebar === 'function') {
        refreshSidebar();
        console.log('✅ تم تحديث الـ Sidebar');
    } else if (typeof renderSidebar === 'function') {
        renderSidebar();
        console.log('✅ تم تحديث الـ Sidebar');
    }

    // 2. تحديث الـ Dashboard
    if (typeof refreshDashboard === 'function') {
        refreshDashboard();
        console.log('✅ تم تحديث الـ Dashboard');
    }

    // 3. إعادة تحميل الصفحة الحالية لو كانت صفحة الصلاحيات
    var currentPage = window.location.pathname.split('/').pop();
    if (currentPage === 'permissions-management.html') {
        if (typeof loadUsers === 'function') {
            loadUsers();
        }
    }

    console.log('✅ تم تحديث كل شيء بنجاح');
}

// ================================================================
// 🚀 التهيئة التلقائية عند تحميل الصفحة
// ================================================================

document.addEventListener('DOMContentLoaded', function () {
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
        'attendance.html': 'حضور وانصراف',
        'treasury.html': 'الخزنة'
    };

    var pageName = pageNames[currentPage] || currentPage;
    logUserActivity('PAGE_VIEW', 'دخول إلى صفحة: ' + pageName, currentPage);
});

// ================================================================
// 📤 تصدير الدوال للاستخدام في باقي الملفات
// ================================================================

// دوال الصلاحيات
window.getUserPermissions = getUserPermissions;
window.checkPermission = checkPermission;
window.getPermissionsList = getPermissionsList;

// دوال التحقق من الأدوار
window.checkAdminPermission = checkAdminPermission;
window.checkCashierPermission = checkCashierPermission;
window.checkStorekeeperPermission = checkStorekeeperPermission;
window.redirectBasedOnRole = redirectBasedOnRole;

// دوال تسجيل النشاطات
window.logUserActivity = logUserActivity;

// دوال الصورة
window.updateTopBarAvatar = updateTopBarAvatar;
window.loadUserProfilePicture = loadUserProfilePicture;
window.updateAllAvatars = updateAllAvatars;
window.checkUserAndLoadProfile = checkUserAndLoadProfile;
window.fixTopBarAvatar = fixTopBarAvatar;

// دوال تحديث الصلاحيات
window.refreshUserPermissions = refreshUserPermissions;
window.saveUserPermissionsAndRefresh = saveUserPermissionsAndRefresh;
window.refreshAllAfterPermissionChange = refreshAllAfterPermissionChange;

console.log('✅ check-permission.js exported successfully');