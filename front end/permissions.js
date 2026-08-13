// ========== permissions.js - النسخة المحدثة مع المميزات الجديدة ==========

// ========== تعريف كل الصلاحيات الممكنة ==========
const PERMISSIONS = {
  // صلاحيات لوحة التحكم
  DASHBOARD_VIEW: 'dashboard.view',
  DASHBOARD_STATS: 'dashboard.stats',
  DASHBOARD_CHARTS: 'dashboard.charts',
  DASHBOARD_PREDICTIONS: 'dashboard.predictions',
  DASHBOARD_EXPORT: 'dashboard.export',
  
  // صلاحيات المنتجات
  PRODUCT_VIEW: 'products.view',
  PRODUCT_CREATE: 'products.add',
  PRODUCT_EDIT: 'products.edit',
  PRODUCT_DELETE: 'products.delete',
  PRODUCT_PRICE_EDIT: 'prices.edit',
  
  // صلاحيات المخزون
  STOCK_VIEW: 'stock.view',
  STOCK_ADJUST: 'stock.adjust',
  STOCK_EXPORT: 'stock.export',
  STOCK_PREDICTIONS: 'stock.predictions',
  
  // صلاحيات الفواتير
  INVOICES_VIEW: 'invoices.view',
  INVOICES_EXPORT: 'invoices.export',
  SALE_CREATE: 'sales.create',
  SALE_CANCEL: 'sales.cancel',
  SALE_PRINT: 'sales.print',
  PURCHASE_VIEW: 'purchases.view',
  PURCHASE_CREATE: 'purchases.create',
  PURCHASE_CANCEL: 'purchases.cancel',
  
  // صلاحيات العملاء والموردين
  CUSTOMER_VIEW: 'customers.view',
  CUSTOMER_CREATE: 'customers.add',
  CUSTOMER_EDIT: 'customers.edit',
  CUSTOMER_DELETE: 'customers.delete',
  CUSTOMER_PAYMENTS: 'customers.payments',
  CUSTOMER_STATEMENT: 'customers.statement',
  SUPPLIER_VIEW: 'suppliers.view',
  SUPPLIER_CREATE: 'suppliers.add',
  SUPPLIER_EDIT: 'suppliers.edit',
  SUPPLIER_DELETE: 'suppliers.delete',
  
  // صلاحيات الأماكن
  LOCATION_VIEW: 'locations.view',
  LOCATION_CREATE: 'locations.add',
  LOCATION_EDIT: 'locations.edit',
  LOCATION_DELETE: 'locations.delete',
  LOCATION_MANAGE: 'locations.manage',
  
  // صلاحيات المستخدمين (للمدير فقط)
  USER_VIEW: 'users.view',
  USER_CREATE: 'users.add',
  USER_EDIT: 'users.edit',
  USER_DELETE: 'users.delete',
  USER_APPROVE: 'users.approve',
  USER_DETAILS: 'users.details',
  USER_PERMISSIONS: 'users.permissions',
  ROLE_MANAGE: 'role.manage',
  
  // صلاحيات النظام والإدارة
  BACKUP_CREATE: 'backup.create',
  BACKUP_RESTORE: 'backup.restore',
  DATA_DELETE: 'data.delete',
  SETTINGS_EDIT: 'settings.edit',
  AUDIT_VIEW: 'audit.view',
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',
  ATTENDANCE_VIEW: 'attendance.view',
  ATTENDANCE_MANAGE: 'attendance.manage',
  
  // صلاحيات المرتجعات
  RETURNS_VIEW: 'returns.view',
  RETURNS_MANAGE: 'returns.manage',
  
  // صلاحيات الملف الشخصي
  PROFILE_VIEW: 'profile.view',
  PROFILE_EDIT: 'profile.edit',
  
  // صلاحيات الثيم
  THEME_SETTINGS: 'theme.settings',
  
  // صلاحيات الخزنة
  TREASURY_VIEW: 'treasury.view',
  TREASURY_MANAGE: 'treasury.manage',
};

// ========== تعريف الأدوار بالصلاحيات ==========
const ROLES = {
  admin: {
    name: 'مدير النظام',
    color: '#ef4444',
    permissions: Object.values(PERMISSIONS)  // كل الصلاحيات
  },
  
  senior_admin: {
    name: 'مدير عام',
    color: '#f59e0b',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.DASHBOARD_STATS, PERMISSIONS.DASHBOARD_CHARTS,
      PERMISSIONS.DASHBOARD_PREDICTIONS, PERMISSIONS.DASHBOARD_EXPORT,
      PERMISSIONS.PRODUCT_VIEW, PERMISSIONS.PRODUCT_CREATE, PERMISSIONS.PRODUCT_EDIT,
      PERMISSIONS.STOCK_VIEW, PERMISSIONS.STOCK_ADJUST, PERMISSIONS.STOCK_EXPORT,
      PERMISSIONS.SALE_CREATE, PERMISSIONS.SALE_PRINT,
      PERMISSIONS.PURCHASE_CREATE, PERMISSIONS.PURCHASE_VIEW,
      PERMISSIONS.CUSTOMER_VIEW, PERMISSIONS.CUSTOMER_CREATE, PERMISSIONS.CUSTOMER_EDIT,
      PERMISSIONS.SUPPLIER_VIEW, PERMISSIONS.SUPPLIER_CREATE, PERMISSIONS.SUPPLIER_EDIT,
      PERMISSIONS.LOCATION_VIEW, PERMISSIONS.LOCATION_CREATE,
      PERMISSIONS.REPORTS_VIEW, PERMISSIONS.AUDIT_VIEW,
      PERMISSIONS.BACKUP_CREATE,
      PERMISSIONS.INVOICES_VIEW, PERMISSIONS.RETURNS_VIEW,
      PERMISSIONS.ATTENDANCE_VIEW, PERMISSIONS.PROFILE_VIEW, PERMISSIONS.PROFILE_EDIT
    ]
  },
  
  storekeeper: {
    name: 'أمين مخزن',
    color: '#10b981',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.DASHBOARD_STATS,
      PERMISSIONS.PRODUCT_VIEW, PERMISSIONS.PRODUCT_CREATE, PERMISSIONS.PRODUCT_EDIT,
      PERMISSIONS.STOCK_VIEW, PERMISSIONS.STOCK_ADJUST, PERMISSIONS.STOCK_EXPORT,
      PERMISSIONS.PURCHASE_VIEW, PERMISSIONS.PURCHASE_CREATE,
      PERMISSIONS.SUPPLIER_VIEW, PERMISSIONS.SUPPLIER_CREATE,
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.LOCATION_VIEW, PERMISSIONS.LOCATION_MANAGE,
      PERMISSIONS.REPORTS_VIEW, PERMISSIONS.AUDIT_VIEW,
      PERMISSIONS.INVOICES_VIEW, PERMISSIONS.RETURNS_VIEW, PERMISSIONS.RETURNS_MANAGE,
      PERMISSIONS.ATTENDANCE_VIEW, PERMISSIONS.ATTENDANCE_MANAGE,
      PERMISSIONS.CUSTOMER_PAYMENTS, PERMISSIONS.CUSTOMER_STATEMENT,
      PERMISSIONS.TREASURY_VIEW,
      PERMISSIONS.THEME_SETTINGS,
      PERMISSIONS.PROFILE_VIEW, PERMISSIONS.PROFILE_EDIT
    ]
  },
  
  cashier: {
    name: 'كاشير',
    color: '#4361ee',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.STOCK_VIEW,
      PERMISSIONS.SALE_CREATE, PERMISSIONS.SALE_PRINT,
      PERMISSIONS.CUSTOMER_VIEW, PERMISSIONS.CUSTOMER_CREATE,
      PERMISSIONS.INVOICES_VIEW,
      PERMISSIONS.CUSTOMER_PAYMENTS, PERMISSIONS.CUSTOMER_STATEMENT,
      PERMISSIONS.ATTENDANCE_VIEW,
      PERMISSIONS.TREASURY_VIEW,
      PERMISSIONS.THEME_SETTINGS,
      PERMISSIONS.PROFILE_VIEW, PERMISSIONS.PROFILE_EDIT
    ]
  },
  
  junior_cashier: {
    name: 'كاشير مبتدئ',
    color: '#6b7280',
    permissions: [
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.STOCK_VIEW,
      PERMISSIONS.SALE_CREATE,
      PERMISSIONS.PROFILE_VIEW
    ]
  }
};

// ========== كلاس إدارة الصلاحيات ==========
class PermissionManager {
  constructor() {
    this.currentUser = null;
    this.userPermissions = [];
  }
  
  async init() {
    this.currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (this.currentUser) {
      await this.loadUserPermissions();
    }
  }
  
  async loadUserPermissions() {
    // جلب الصلاحيات من localStorage مؤقتاً
    // في التطوير القادم هتتجاب من الـ API
    const savedPermissions = localStorage.getItem(`user_permissions_${this.currentUser.id}`);
    
    if (savedPermissions) {
      this.userPermissions = JSON.parse(savedPermissions);
    } else {
      // استخدم الصلاحيات الافتراضية حسب الدور
      const role = ROLES[this.currentUser.role];
      this.userPermissions = role?.permissions || [];
      this.savePermissions();
    }
  }
  
  savePermissions() {
    localStorage.setItem(`user_permissions_${this.currentUser.id}`, JSON.stringify(this.userPermissions));
  }
  
  can(permission) {
    if (!this.currentUser) return false;
    return this.userPermissions.includes(permission);
  }
  
  // دالة لحماية الصفحات
  async protectPage(requiredPermissions = []) {
    await this.init();
    
    if (!this.currentUser) {
      window.location.href = 'login.html';
      return false;
    }
    
    for (const perm of requiredPermissions) {
      if (!this.can(perm)) {
        this.showAccessDenied();
        return false;
      }
    }
    return true;
  }
  
  showAccessDenied() {
    // نافذة منبثقة للمستخدم
    if (typeof showProfessionalToast === 'function') {
      showProfessionalToast('🚫 ليس لديك صلاحية للوصول إلى هذه الصفحة', 'error');
    } else if (typeof showNotification === 'function') {
      showNotification('🚫 ليس لديك صلاحية للوصول إلى هذه الصفحة', 'error');
    } else {
      alert('🚫 ليس لديك صلاحية للوصول إلى هذه الصفحة');
    }
    
    setTimeout(() => {
      // الرجوع للصفحة الرئيسية حسب الدور
      if (this.currentUser.role === 'storekeeper') {
        window.location.href = 'storekeeper.html';
      } else if (this.currentUser.role === 'cashier') {
        window.location.href = 'pos.html';
      } else {
        window.location.href = 'index.html';
      }
    }, 2000);
  }
  
  // دالة لإخفاء العناصر حسب الصلاحية
  hideElementsByPermission() {
    // إخفاء الأزرار
    document.querySelectorAll('[data-permission]').forEach(el => {
      const requiredPerm = el.getAttribute('data-permission');
      if (!this.can(requiredPerm)) {
        el.style.display = 'none';
      }
    });
    
    // تعطيل الإدخالات
    document.querySelectorAll('[data-permission-input]').forEach(el => {
      const requiredPerm = el.getAttribute('data-permission-input');
      if (!this.can(requiredPerm)) {
        el.disabled = true;
        el.style.opacity = '0.5';
        el.style.cursor = 'not-allowed';
      }
    });
  }
  
  // دالة للتحقق من صلاحية متعددة
  canAny(permissions = []) {
    if (!this.currentUser) return false;
    for (const perm of permissions) {
      if (this.can(perm)) return true;
    }
    return false;
  }
  
  // دالة للتحقق من كل الصلاحيات
  canAll(permissions = []) {
    if (!this.currentUser) return false;
    for (const perm of permissions) {
      if (!this.can(perm)) return false;
    }
    return true;
  }
}

// إنشاء نسخة عالمية
const permissionManager = new PermissionManager();

// دوال مساعدة للاستخدام السريع في الكود
window.can = (permission) => permissionManager.can(permission);
window.canAny = (permissions) => permissionManager.canAny(permissions);
window.canAll = (permissions) => permissionManager.canAll(permissions);

// تصدير PERMISSIONS للاستخدام في باقي الملفات
if (typeof window !== 'undefined') {
  window.PERMISSIONS = PERMISSIONS;
  window.ROLES = ROLES;
  window.permissionManager = permissionManager;
}