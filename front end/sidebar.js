// ========== sidebar.js - النسخة النهائية مع دعم الصلاحيات المخصصة ==========

// ========== صلاحيات القائمة الجانبية لكل دور ==========
if (typeof roleMenus === 'undefined') {
    var roleMenus = {
        admin: [
            { icon: "fas fa-tachometer-alt", name: "لوحة التحكم", link: "dashboard.html", permission: "dashboard.view" },
            { icon: "fas fa-user-check", name: "طلبات الحسابات", link: "approve-requests.html", permission: "users.approve", badge: true, badgeId: "pendingAccountsBadge" },
            { icon: "fas fa-users-cog", name: "إدارة الحسابات", link: "manage-accounts.html", permission: "users.view" },
            { type: "separator" },
            { icon: "fas fa-boxes", name: "المنتجات", link: "products.html", permission: "products.view" },
            { icon: "fas fa-chart-line", name: "تحديث الأسعار", link: "price_update.html", permission: "prices.edit" },
            { icon: "fas fa-map-marker-alt", name: "أماكن التخزين", link: "locations.html", permission: "locations.view" },
            { icon: "fas fa-warehouse", name: "المخزون الحالي", link: "stock.html", permission: "stock.view" },
            { type: "separator" },
            { icon: "fas fa-file-invoice", name: "إدارة الفواتير", link: "invoices.html", permission: "invoices.view" },
            { type: "separator" },
            { icon: "fas fa-truck-loading", name: "فاتورة شراء", link: "purchase.html", permission: "purchases.create" },
            { icon: "fas fa-shopping-cart", name: "فاتورة بيع", link: "sale.html", permission: "sales.create" },
            { icon: "fas fa-undo-alt", name: "المرتجعات", link: "returns.html", permission: "returns.view" },
            { type: "separator" },
            { icon: "fas fa-users", name: "العملاء", link: "customers.html", permission: "customers.view" },
            { icon: "fas fa-file-invoice", name: "كشف حساب العملاء", link: "customer-statement.html", permission: "customers.view" },
            { icon: "fas fa-hand-holding-usd", name: "تسجيل دفعات", link: "customer-payments.html", permission: "customers.view" },
            { icon: "fas fa-truck", name: "الموردين", link: "suppliers.html", permission: "suppliers.view" },
            { type: "separator" },
            { icon: "fas fa-clipboard-list", name: "حضور وانصراف", link: "attendance.html", permission: "attendance.view" },
            { type: "separator" },
            { icon: "fas fa-chart-pie", name: "التقارير", link: "reports.html", permission: "reports.view" },
            { icon: "fas fa-history", name: "سجل الحركات", link: "audit.html", permission: "audit.view" },
            { icon: "fas fa-shield-alt", name: "الصلاحيات", link: "permissions-management.html", permission: "users.permissions" },
            { type: "separator" },
            { icon: "fas fa-user-cog", name: "الملف الشخصي", link: "profile.html", permission: "profile.view" },
        ],
        storekeeper: [
            { icon: "fas fa-tachometer-alt", name: "لوحة التحكم", link: "dashboard.html", permission: "dashboard.view" },
            { type: "separator" },
            { icon: "fas fa-boxes", name: "المنتجات", link: "products.html", permission: "products.view" },
            { icon: "fas fa-chart-line", name: "تحديث الأسعار", link: "price_update.html", permission: "prices.edit" },
            { icon: "fas fa-map-marker-alt", name: "أماكن التخزين", link: "locations.html", permission: "locations.view" },
            { icon: "fas fa-warehouse", name: "المخزون الحالي", link: "stock.html", permission: "stock.view" },
            { type: "separator" },
            { icon: "fas fa-file-invoice", name: "إدارة الفواتير", link: "invoices.html", permission: "invoices.view" },
            { type: "separator" },
            { icon: "fas fa-truck-loading", name: "فاتورة شراء", link: "purchase.html", permission: "purchases.create" },
            { icon: "fas fa-undo-alt", name: "المرتجعات", link: "returns.html", permission: "returns.view" },
            { type: "separator" },
            { icon: "fas fa-users", name: "العملاء", link: "customers.html", permission: "customers.view" },
            { icon: "fas fa-file-invoice", name: "كشف حساب العملاء", link: "customer-statement.html", permission: "customers.view" },
            { icon: "fas fa-hand-holding-usd", name: "تسجيل دفعات", link: "customer-payments.html", permission: "customers.view" },
            { icon: "fas fa-truck", name: "الموردين", link: "suppliers.html", permission: "suppliers.view" },
            { type: "separator" },
            { icon: "fas fa-clipboard-list", name: "حضور وانصراف", link: "attendance.html", permission: "attendance.view" },
            { type: "separator" },
            { icon: "fas fa-chart-pie", name: "التقارير", link: "reports.html", permission: "reports.view" },
            { icon: "fas fa-history", name: "سجل الحركات", link: "audit.html", permission: "audit.view" },
            { type: "separator" },
            { icon: "fas fa-user-cog", name: "الملف الشخصي", link: "profile.html", permission: "profile.view" },
        ],
        cashier: [
            { icon: "fas fa-tachometer-alt", name: "لوحة التحكم", link: "dashboard.html", permission: "dashboard.view" },
            { type: "separator" },
            { icon: "fas fa-shopping-cart", name: "فاتورة بيع", link: "sale.html", permission: "sales.create" },
            { type: "separator" },
            { icon: "fas fa-file-invoice", name: "إدارة الفواتير", link: "invoices.html", permission: "invoices.view" },
            { type: "separator" },
            { icon: "fas fa-users", name: "العملاء", link: "customers.html", permission: "customers.view" },
            { icon: "fas fa-file-invoice", name: "كشف حساب العملاء", link: "customer-statement.html", permission: "customers.view" },
            { icon: "fas fa-hand-holding-usd", name: "تسجيل دفعات", link: "customer-payments.html", permission: "customers.view" },
            { type: "separator" },
            { icon: "fas fa-clipboard-list", name: "حضور وانصراف", link: "attendance.html", permission: "attendance.view" },
            { type: "separator" },
            { icon: "fas fa-user-cog", name: "الملف الشخصي", link: "profile.html", permission: "profile.view" },
        ],
    };
}

// ========== الحصول على صلاحيات المستخدم المخصصة ==========
function getUserPermissions(userId) {
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

// ========== التحقق من صلاحية المستخدم ==========
function hasUserPermission(permissionId) {
    var currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) return false;
    
    // المدير عنده كل الصلاحيات
    if (currentUser.role === 'admin') return true;
    
    var userPerms = getUserPermissions(currentUser.id);
    return userPerms[permissionId] === true;
}

// ========== التحقق من صلاحية عنصر القائمة ==========
function hasMenuPermission(menu) {
    if (menu.type === 'separator') {
        return true;
    }
    
    var currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) return false;
    
    // المدير عنده كل الصلاحيات
    if (currentUser.role === 'admin') return true;
    
    // لو القائمة معندهاش صلاحية مطلوبة، تظهر للكل
    if (!menu.permission) return true;
    
    // التحقق من الصلاحية المخصصة للمستخدم
    return hasUserPermission(menu.permission);
}

// ========== الحصول على اسم الملف الحالي ==========
function getCurrentPage() {
    var path = window.location.pathname;
    var page = path.substring(path.lastIndexOf("/") + 1);
    return page || "index.html";
}

// ========== ترجمة الدور للعربية ==========
function getRoleNameAr(role) {
    var roles = {
        'admin': 'مدير النظام',
        'storekeeper': 'أمين مخزن',
        'cashier': 'كاشير'
    };
    return roles[role] || role;
}

// ========== الحصول على الصلاحيات الافتراضية حسب الدور ==========
function getDefaultPermissions(role) {
    var defaults = {
        'storekeeper': {
            'dashboard.view': true,
            'dashboard.stats': true,
            'products.view': true,
            'products.add': true,
            'products.edit': true,
            'stock.view': true,
            'stock.export': true,
            'purchases.view': true,
            'purchases.create': true,
            'locations.view': true,
            'locations.manage': true,
            'suppliers.view': true,
            'suppliers.manage': true,
            'returns.view': true,
            'returns.manage': true,
            'reports.view': true,
            'reports.export': true,
            'audit.view': true,
            'attendance.view': true,
            'attendance.manage': true,
            'profile.view': true,
            'profile.edit': true,
            'invoices.view': true,
            'customers.view': true,
            'customers.payments': true,
            'customers.statement': true
        },
        'cashier': {
            'dashboard.view': true,
            'sales.view': true,
            'sales.create': true,
            'pos.access': true,
            'pos.discount': true,
            'customers.view': true,
            'customers.add': true,
            'profile.view': true,
            'profile.edit': true,
            'invoices.view': true
        }
    };
    return defaults[role] || {};
}

// ========== توليد القائمة الجانبية ==========
function generateSidebarHTML() {
    var currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser) return '';

    var role = currentUser.role;
    var menus = roleMenus[role] || roleMenus.cashier;
    var currentPage = getCurrentPage();

    // ====== جلب الصلاحيات المخصصة للمستخدم ======
    var userPerms = getUserPermissions(currentUser.id);
    
    // ====== لو أمين مخزن ومعندوش صلاحيات، استخدم الافتراضية ======
    if (role === 'storekeeper' && Object.keys(userPerms).length === 0) {
        var defaultPerms = getDefaultPermissions('storekeeper');
        localStorage.setItem('user_permissions_' + currentUser.id, JSON.stringify(defaultPerms));
        userPerms = defaultPerms;
        console.log('✅ تم تعيين صلاحيات أمين مخزن افتراضية');
    }
    
    // ====== لو كاشير ومعندوش صلاحيات، استخدم الافتراضية ======
    if (role === 'cashier' && Object.keys(userPerms).length === 0) {
        var defaultPerms = getDefaultPermissions('cashier');
        localStorage.setItem('user_permissions_' + currentUser.id, JSON.stringify(defaultPerms));
        userPerms = defaultPerms;
        console.log('✅ تم تعيين صلاحيات كاشير افتراضية');
    }

    // ====== جلب الصورة الشخصية ======
    var profilePicture = localStorage.getItem('user_profile_picture_' + currentUser.id) || '';
    var userName = currentUser.name || 'مستخدم';
    var userInitial = userName.charAt(0).toUpperCase();

    var sidebarHTML = `
        <div class="sidebar-header">
            <div class="logo">
                <i class="fas fa-store-alt"></i>
                <span>مخزني</span>
            </div>
            <button class="close-sidebar" id="closeSidebar">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <nav class="sidebar-nav">
    `;

    var hasAnyPermission = false;

    for (var i = 0; i < menus.length; i++) {
        var menu = menus[i];
        if (menu.type === 'separator') {
            if (hasAnyPermission) {
                sidebarHTML += '<div class="nav-separator"></div>';
            }
            continue;
        }

        if (!hasMenuPermission(menu)) {
            continue;
        }

        hasAnyPermission = true;

        var isActive = currentPage === menu.link;
        var activeClass = isActive ? "active" : "";
        var badgeHTML = menu.badge ? '<span class="nav-badge" id="' + menu.badgeId + '" style="display: none;">0</span>' : '';

        sidebarHTML += `
            <a href="${menu.link}" class="nav-item ${activeClass}">
                <i class="${menu.icon}"></i>
                <span>${menu.name}</span>
                ${badgeHTML}
            </a>
        `;
    }

    if (!hasAnyPermission && currentUser.role !== 'admin') {
        sidebarHTML += `
            <div style="text-align: center; padding: 30px 10px; color: rgba(255,255,255,0.5);">
                <i class="fas fa-lock" style="font-size: 32px; margin-bottom: 10px; display: block;"></i>
                <span style="font-size: 13px;">ليس لديك صلاحيات</span>
                <span style="font-size: 11px; display: block; margin-top: 4px;">تواصل مع المدير</span>
            </div>
        `;
    }

    // ====== عرض الصورة الشخصية في الـ Sidebar ======
    var avatarHTML = '';
    if (profilePicture && profilePicture !== 'null' && profilePicture !== 'undefined' && profilePicture !== '') {
        avatarHTML = `<img src="${profilePicture}" alt="${userName}" style="width: 45px; height: 45px; border-radius: 50%; object-fit: cover; border: 2px solid #4cc9f0;">`;
    } else {
        avatarHTML = `<div style="width: 45px; height: 45px; border-radius: 50%; background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; font-weight: 700;">${userInitial}</div>`;
    }

    sidebarHTML += `
        </nav>
        <div class="sidebar-footer">
            <div class="user-info" onclick="window.location.href='profile.html'" style="cursor: pointer;">
                <div class="user-avatar" style="flex-shrink: 0;">
                    ${avatarHTML}
                </div>
                <div class="user-details">
                    <div class="user-name">${currentUser.name || 'مستخدم'}</div>
                    <div class="user-role">${getRoleNameAr(currentUser.role)}</div>
                </div>
            </div>
            <button class="logout-btn" onclick="logout()">
                <i class="fas fa-sign-out-alt"></i> تسجيل خروج
            </button>
        </div>
    `;

    return sidebarHTML;
}

// ========== عرض القائمة ==========
function renderSidebar() {
    var sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    
    var sidebarHTML = generateSidebarHTML();
    if (sidebarHTML) {
        sidebar.innerHTML = sidebarHTML;
        reattachSidebarEvents();
    }
}

// ========== ربط الأحداث ==========
function reattachSidebarEvents() {
    var closeSidebar = document.getElementById("closeSidebar");
    var menuToggle = document.getElementById("menuToggle");
    var sidebar = document.getElementById("sidebar");

    if (closeSidebar) {
        closeSidebar.onclick = function(e) {
            e.preventDefault();
            if (sidebar) sidebar.classList.remove("open");
        };
    }

    if (menuToggle) {
        menuToggle.onclick = function(e) {
            e.preventDefault();
            if (sidebar) sidebar.classList.add("open");
        };
    }

    document.addEventListener("click", function(e) {
        if (window.innerWidth <= 992) {
            if (sidebar && !sidebar.contains(e.target) && 
                menuToggle && !menuToggle.contains(e.target)) {
                sidebar.classList.remove("open");
            }
        }
    });
}

// ========== تسجيل الخروج ==========
function logout() {
    if (confirm('هل تريد تسجيل الخروج؟')) {
        localStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    }
}

// ========== تحديث عدد الطلبات المعلقة ==========
async function updatePendingAccountsBadge() {
    var user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user || user.role !== 'admin') return;

    try {
        var API_URL = window.location.hostname === 'localhost' 
            ? 'http://localhost:5000/api' 
            : window.location.origin + '/api';
            
        var response = await fetch(API_URL + '/pending-accounts');
        var data = await response.json();
        
        if (data.success && data.data) {
            var pendingCount = 0;
            for (var i = 0; i < data.data.length; i++) {
                if (data.data[i].account_status === 'pending' || !data.data[i].is_approved) {
                    pendingCount++;
                }
            }
            var badge = document.getElementById('pendingAccountsBadge');
            if (badge) {
                if (pendingCount > 0) {
                    badge.textContent = pendingCount;
                    badge.style.display = 'inline-block';
                } else {
                    badge.style.display = 'none';
                }
            }
        }
    } catch (error) {
        console.error('Error loading pending accounts:', error);
    }
}

// ========== تشغيل القائمة ==========
document.addEventListener("DOMContentLoaded", function() {
    renderSidebar();
    
    var user = JSON.parse(localStorage.getItem('currentUser'));
    if (user && user.role === 'admin') {
        updatePendingAccountsBadge();
        setInterval(updatePendingAccountsBadge, 30000);
    }
});

// ========== تصدير الدوال ==========
window.renderSidebar = renderSidebar;
window.logout = logout;
window.generateSidebarHTML = generateSidebarHTML;
window.hasMenuPermission = hasMenuPermission;
window.hasUserPermission = hasUserPermission;
window.getUserPermissions = getUserPermissions;
window.getDefaultPermissions = getDefaultPermissions;