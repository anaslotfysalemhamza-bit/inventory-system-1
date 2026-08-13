// ============================================================
// sidebar.js - النسخة النهائية مع دعم الصلاحيات الديناميكية
// ============================================================

// ========== صلاحيات القائمة الجانبية لكل دور ==========
if (typeof roleMenus === 'undefined') {
    var roleMenus = {
        admin: [
            { icon: "fas fa-tachometer-alt", name: "لوحة التحكم", link: "index.html", permission: "dashboard.view" },
            { icon: "fas fa-user-check", name: "طلبات الحسابات", link: "approve-requests.html", permission: "users.approve", badge: true, badgeId: "pendingAccountsBadge" },
            { icon: "fas fa-users-cog", name: "إدارة الحسابات", link: "manage-accounts.html", permission: "users.view" },
            { icon: "fas fa-user-circle", name: "تفاصيل المستخدمين", link: "user-details.html", permission: "users.details" },
            { type: "separator" },
            { icon: "fas fa-boxes", name: "المنتجات", link: "products.html", permission: "products.view" },
            { icon: "fas fa-chart-line", name: "تحديث الأسعار", link: "price_update.html", permission: "prices.edit" },
            { icon: "fas fa-map-marker-alt", name: "أماكن التخزين", link: "locations.html", permission: "locations.view" },
            { icon: "fas fa-warehouse", name: "المخزون الحالي", link: "stock.html", permission: "stock.view" },
            { type: "separator" },
            { icon: "fas fa-file-invoice", name: "إدارة الفواتير", link: "invoices.html", permission: "invoices.view" },
            { type: "separator" },
            { icon: "fas fa-truck-loading", name: "فاتورة شراء", link: "purchase.html", permission: "purchases.create" },
            { icon: "fas fa-cash-register", name: "نقطة البيع", link: "cashier.html", permission: "sales.create" },
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
            { icon: "fas fa-money-bill-wave", name: "💰 الخزنة", link: "treasury.html", permission: "treasury.view" },
            { type: "separator" },
            { icon: "fas fa-palette", name: "🎨 تخصيص الثيم", link: "theme-settings.html", permission: "theme.settings" },
            { type: "separator" },
            { icon: "fas fa-database", name: "النسخ الاحتياطي", link: "#", permission: "backup.create", action: "createBackup" },
            { icon: "fas fa-trash-alt", name: "حذف البيانات", link: "#", permission: "data.delete", action: "showDeleteAllDataDialog" },
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
            { icon: "fas fa-cash-register", name: "نقطة البيع", link: "cashier.html", permission: "sales.create" },
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
            { type: "separator" },
            { icon: "fas fa-money-bill-wave", name: "💰 الخزنة", link: "treasury.html", permission: "treasury.view" },
            { type: "separator" },
            { icon: "fas fa-palette", name: "🎨 تخصيص الثيم", link: "theme-settings.html", permission: "theme.settings" },
            { type: "separator" },
            { icon: "fas fa-user-cog", name: "الملف الشخصي", link: "profile.html", permission: "profile.view" },
        ],
        cashier: [
            { icon: "fas fa-tachometer-alt", name: "لوحة التحكم", link: "dashboard.html", permission: "dashboard.view" },
            { type: "separator" },
            { icon: "fas fa-cash-register", name: "نقطة البيع", link: "cashier.html", permission: "sales.create" },
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
            { icon: "fas fa-money-bill-wave", name: "💰 الخزنة", link: "treasury.html", permission: "treasury.view" },
            { type: "separator" },
            { icon: "fas fa-palette", name: "🎨 تخصيص الثيم", link: "theme-settings.html", permission: "theme.settings" },
            { type: "separator" },
            { icon: "fas fa-user-cog", name: "الملف الشخصي", link: "profile.html", permission: "profile.view" },
        ],
    };
}

// ============================================================
// 🔑 دوال الصلاحيات - متوافقة مع check-permission.js
// ============================================================

// ========== الحصول على صلاحيات المستخدم من localStorage ==========
function getUserPermissions(userId) {
    if (!userId) {
        var user = JSON.parse(localStorage.getItem('currentUser'));
        if (user) userId = user.id;
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

// ========== ✅ التحقق من صلاحية معينة للمستخدم ==========
function userHasPermission(userId, permissionId, role) {
    // المدير عنده كل الصلاحيات
    if (role === 'admin') return true;

    // جلب الصلاحيات من localStorage
    var permissions = getUserPermissions(userId);
    return permissions[permissionId] === true;
}

// ========== التحقق من صلاحية عنصر القائمة ==========
function hasMenuPermission(menu, userId, role) {
    // لو عنصر فاصل (separator) → يظهر دايمًا
    if (menu.type === 'separator') return true;

    // لو مفيش صلاحية مطلوبة للعنصر → يظهر دايمًا
    if (!menu.permission) return true;

    // التحقق من الصلاحية
    return userHasPermission(userId, menu.permission, role);
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

// ============================================================
// 🎨 توليد القائمة الجانبية
// ============================================================
function generateSidebarHTML() {
    var currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser) return '';

    var userId = currentUser.id;
    var role = currentUser.role;
    var menus = roleMenus[role] || roleMenus.cashier;
    var currentPage = getCurrentPage();

    var profilePicture = localStorage.getItem('user_profile_picture_' + userId) || '';
    var userName = currentUser.name || 'مستخدم';
    var userInitial = userName.charAt(0).toUpperCase();

    var sidebarHTML = `
        <div class="sidebar-header">
            <div class="theme-toggle" onclick="toggleTheme()" title="تبديل الوضع">
                <i class="fas fa-moon" id="themeIcon"></i>
            </div>
            <div class="logo">
                <i class="fas fa-store-alt"></i>
                <span>مخزني</span>
            </div>
            <button class="close-sidebar" id="closeSidebar">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <nav class="sidebar-nav">
            <div class="sidebar-search">
                <input type="text" id="sidebarSearch" placeholder="🔍 بحث في القائمة..." autocomplete="off">
                <i class="fas fa-search"></i>
            </div>
    `;

    var hasAnyPermission = false;

    for (var i = 0; i < menus.length; i++) {
        var menu = menus[i];

        // لو عنصر فاصل
        if (menu.type === 'separator') {
            if (hasAnyPermission) {
                sidebarHTML += '<div class="nav-separator"></div>';
            }
            continue;
        }

        // ✅ التحقق من الصلاحية
        if (!hasMenuPermission(menu, userId, role)) {
            continue;
        }

        hasAnyPermission = true;

        var isActive = currentPage === menu.link;
        var activeClass = isActive ? "active" : "";
        var badgeHTML = menu.badge ? '<span class="nav-badge" id="' + menu.badgeId + '" style="display: none;">0</span>' : '';

        var link = menu.link;

        if (menu.action) {
            sidebarHTML += `
                <a href="javascript:void(0)" onclick="${menu.action}()" class="nav-item ${activeClass}">
                    <i class="${menu.icon}"></i>
                    <span>${menu.name}</span>
                    ${badgeHTML}
                </a>
            `;
        } else {
            sidebarHTML += `
                <a href="${link}" class="nav-item ${activeClass}">
                    <i class="${menu.icon}"></i>
                    <span>${menu.name}</span>
                    ${badgeHTML}
                </a>
            `;
        }
    }

    // لو مفيش أي صلاحية → رسالة
    if (!hasAnyPermission) {
        sidebarHTML += `
            <div style="text-align: center; padding: 30px 10px; color: rgba(255,255,255,0.5);">
                <i class="fas fa-lock" style="font-size: 32px; margin-bottom: 10px; display: block;"></i>
                <span style="font-size: 13px;">ليس لديك صلاحيات</span>
                <span style="font-size: 11px; display: block; margin-top: 4px;">تواصل مع المدير</span>
            </div>
        `;
    }

    // ===== الـ Footer مع معلومات المستخدم =====
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
                <div class="user-details">
                    <div class="user-name">${currentUser.name || 'مستخدم'}</div>
                    <div class="user-role">${getRoleNameAr(currentUser.role)}</div>
                </div>
                <div class="user-avatar" style="flex-shrink: 0;">
                    ${avatarHTML}
                </div>
            </div>
            <button class="logout-btn" onclick="logout()">
                <i class="fas fa-sign-out-alt"></i> تسجيل خروج
            </button>
        </div>
    `;

    return sidebarHTML;
}

// ============================================================
// 📌 عرض القائمة الجانبية
// ============================================================
function renderSidebar() {
    var sidebar = document.getElementById("sidebar");
    if (!sidebar) return;

    var sidebarHTML = generateSidebarHTML();
    if (sidebarHTML) {
        sidebar.innerHTML = sidebarHTML;
        reattachSidebarEvents();
        initSidebarSearch();
        loadThemePreference();
        monitorSidebarState();

        // تحديث عدد الطلبات المعلقة للمدير
        var user = JSON.parse(localStorage.getItem('currentUser'));
        if (user && user.role === 'admin') {
            updatePendingAccountsBadge();
        }
    }
}

// ============================================================
// 🔍 Search في الـ Sidebar
// ============================================================
function initSidebarSearch() {
    var searchInput = document.getElementById('sidebarSearch');
    if (!searchInput) return;

    searchInput.addEventListener('input', function (e) {
        var searchTerm = e.target.value.toLowerCase().trim();
        var navItems = document.querySelectorAll('.sidebar .nav-item');

        navItems.forEach(function (item) {
            var text = item.textContent.toLowerCase();
            var shouldShow = text.includes(searchTerm);

            if (shouldShow) {
                item.style.display = 'flex';
                item.style.animation = 'navItemSlideIn 0.3s ease forwards';
            } else {
                item.style.display = 'none';
            }
        });

        var separators = document.querySelectorAll('.sidebar .nav-separator');
        separators.forEach(function (sep) {
            sep.style.display = searchTerm ? 'none' : 'block';
        });
    });
}

// ============================================================
// 🌓 Theme Toggle
// ============================================================
function toggleTheme() {
    var currentTheme = localStorage.getItem('theme') || 'dark';
    var newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);

    if (typeof showProfessionalToast === 'function') {
        showProfessionalToast(
            newTheme === 'dark' ? '🌙 تم التبديل للوضع الداكن' : '☀️ تم التبديل للوضع الفاتح',
            'success'
        );
    }
}

function applyTheme(theme) {
    var icon = document.getElementById('themeIcon');
    if (!icon) return;

    if (theme === 'light') {
        document.body.classList.add('light-theme');
        icon.className = 'fas fa-sun';
    } else {
        document.body.classList.remove('light-theme');
        icon.className = 'fas fa-moon';
    }
}

function loadThemePreference() {
    var savedTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(savedTheme);
}

// ============================================================
// 👁️ مراقبة حالة الـ Sidebar
// ============================================================
function monitorSidebarState() {
    var sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    if (sidebar.classList.contains('open')) {
        document.body.classList.add('sidebar-open');
    }

    var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            if (mutation.attributeName === 'class') {
                var isOpen = sidebar.classList.contains('open');
                if (isOpen) {
                    document.body.classList.add('sidebar-open');
                } else {
                    document.body.classList.remove('sidebar-open');
                }
                var event = new CustomEvent('sidebarStateChange', {
                    detail: { isOpen: isOpen }
                });
                document.dispatchEvent(event);
            }
        });
    });

    observer.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
}

// ============================================================
// 🔗 ربط الأحداث
// ============================================================
function reattachSidebarEvents() {
    var closeSidebar = document.getElementById("closeSidebar");
    var sidebar = document.getElementById("sidebar");
    var fab = document.getElementById("sidebarFab");
    var menuToggle = document.getElementById("menuToggle");

    if (closeSidebar) {
        closeSidebar.onclick = function (e) {
            e.preventDefault();
            closeSidebarPanel();
        };
    }

    if (fab) {
        fab.onclick = function (e) {
            e.preventDefault();
            toggleSidebarPanel();
        };
    }

    if (menuToggle) {
        var newToggle = menuToggle.cloneNode(true);
        menuToggle.parentNode.replaceChild(newToggle, menuToggle);

        newToggle.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            toggleSidebarPanel();
        });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
            e.preventDefault();
            toggleSidebarPanel();
        }
        if (e.key === 'Escape' && sidebar && sidebar.classList.contains('open')) {
            closeSidebarPanel();
        }
    });
}

// ============================================================
// 🔄 المزامنة بين التبويبات المتعددة
// ============================================================
window.addEventListener('storage', function(e) {
    // عند تغيير صلاحيات مستخدم في تبويب آخر
    if (e.key && e.key.startsWith('user_permissions_')) {
        console.log('🔄 تم اكتشاف تغيير في الصلاحيات من تبويب آخر');
        
        var currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (currentUser && e.key === 'user_permissions_' + currentUser.id) {
            // إعادة تحميل الـSidebar
            if (typeof refreshSidebar === 'function') {
                refreshSidebar();
            }
            
            // إظهار إشعار للمستخدم
            if (typeof showProfessionalToast === 'function') {
                showProfessionalToast('🔄 تم تحديث صلاحياتك', 'info');
            }
        }
    }
});

// ============================================================
// 🖱️ Overlay للهواتف
// ============================================================
function createSidebarOverlay() {
    if (document.getElementById('sidebarOverlay')) return;
    var overlay = document.createElement('div');
    overlay.id = 'sidebarOverlay';
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
    overlay.onclick = function () {
        closeSidebarPanel();
    };
}

// ============================================================
// 📂 فتح/إغلاق الـ Sidebar
// ============================================================
function toggleSidebarPanel() {
    var sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    sidebar.classList.toggle('open');
}

function openSidebarPanel() {
    var sidebar = document.getElementById("sidebar");
    if (sidebar) sidebar.classList.add('open');
}

function closeSidebarPanel() {
    var sidebar = document.getElementById("sidebar");
    if (sidebar) sidebar.classList.remove('open');
}

// ============================================================
// 🚪 تسجيل الخروج
// ============================================================
function logout() {
    if (confirm('هل تريد تسجيل الخروج؟')) {
        localStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    }
}

// ============================================================
// 🔔 تحديث عدد الطلبات المعلقة
// ============================================================
async function updatePendingAccountsBadge() {
    var user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user || user.role !== 'admin') return;

    try {
        var API_URL = window.API_URL || 'http://localhost:5000/api';
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

            updateFabBadge(pendingCount);
        }
    } catch (error) {
        console.error('Error loading pending accounts:', error);
    }
}

// ============================================================
// ✨ إنشاء الـ FAB
// ============================================================
function createSidebarFAB() {
    if (document.getElementById('sidebarFab')) return;

    var fab = document.createElement('div');
    fab.id = 'sidebarFab';
    fab.className = 'sidebar-fab';
    fab.title = 'فتح القائمة (Ctrl+B)';

    var user = JSON.parse(localStorage.getItem('currentUser'));
    var badgeHTML = '';
    if (user && user.role === 'admin') {
        badgeHTML = '<span class="fab-badge" id="fabBadge" style="display: none;">0</span>';
    }

    fab.innerHTML = `
        <i class="fas fa-bars"></i>
        ${badgeHTML}
    `;

    document.body.appendChild(fab);

    fab.onclick = function () {
        toggleSidebarPanel();
    };
}

// ============================================================
// 🔄 دالة إعادة تحميل الـSidebar (للاستخدام من ملفات أخرى)
// ============================================================
function refreshSidebar() {
    console.log('🔄 إعادة تحميل الـSidebar بعد تغيير الصلاحيات...');
    renderSidebar();
    
    // إعادة تحميل عدد الطلبات المعلقة إذا كان المستخدم admin
    var user = JSON.parse(localStorage.getItem('currentUser'));
    if (user && user.role === 'admin') {
        setTimeout(function() {
            updatePendingAccountsBadge();
        }, 500);
    }
}

// تصدير الدالة للاستخدام العام
window.refreshSidebar = refreshSidebar;

// ============================================================
// 🔔 تحديث badge الـ FAB
// ============================================================
function updateFabBadge(count) {
    var fabBadge = document.getElementById('fabBadge');
    if (fabBadge) {
        if (count > 0) {
            fabBadge.textContent = count;
            fabBadge.style.display = 'flex';
        } else {
            fabBadge.style.display = 'none';
        }
    }
}

// ============================================================
// 🔄 دالة لتحديث الـ Sidebar من الخارج
// ============================================================
function refreshSidebar() {
    renderSidebar();
    console.log('✅ تم تحديث الـ Sidebar');
}

// ============================================================
// 🚀 التهيئة
// ============================================================
document.addEventListener("DOMContentLoaded", function () {
    createSidebarFAB();
    createSidebarOverlay();
    renderSidebar();

    setTimeout(function () {
        monitorSidebarState();
        var sidebarState = localStorage.getItem('sidebar_state');
        if (sidebarState === 'open') {
            setTimeout(function () {
                openSidebarPanel();
            }, 100);
        }
    }, 200);

    // تحديث الطلبات المعلقة كل 30 ثانية
    var user = JSON.parse(localStorage.getItem('currentUser'));
    if (user && user.role === 'admin') {
        updatePendingAccountsBadge();
        setInterval(updatePendingAccountsBadge, 30000);
    }
});

// ============================================================
// 📤 تصدير الدوال
// ============================================================
window.renderSidebar = renderSidebar;
window.refreshSidebar = refreshSidebar;
window.logout = logout;
window.generateSidebarHTML = generateSidebarHTML;
window.hasMenuPermission = hasMenuPermission;
window.userHasPermission = userHasPermission;
window.getUserPermissions = getUserPermissions;
window.toggleSidebarPanel = toggleSidebarPanel;
window.openSidebarPanel = openSidebarPanel;
window.closeSidebarPanel = closeSidebarPanel;   
window.toggleTheme = toggleTheme;
window.updateFabBadge = updateFabBadge;
window.monitorSidebarState = monitorSidebarState;
window.updatePendingAccountsBadge = updatePendingAccountsBadge;

console.log('✅ sidebar.js loaded successfully (with dynamic permissions support)');