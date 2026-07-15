// permissions.js - أضف هذا الملف الجديد في مجلد المشروع

// ========== تعريف كل الصلاحيات الممكنة ==========
const PERMISSIONS = {
  // صلاحيات المنتجات
  PRODUCT_VIEW: 'product.view',           // مشاهدة المنتجات
  PRODUCT_CREATE: 'product.create',       // إضافة منتج جديد
  PRODUCT_EDIT: 'product.edit',           // تعديل منتج
  PRODUCT_DELETE: 'product.delete',       // حذف منتج
  PRODUCT_PRICE_EDIT: 'product.price.edit', // تعديل سعر المنتج (منفصلة)
  
  // صلاحيات المخزون
  STOCK_VIEW: 'stock.view',               // مشاهدة المخزون
  STOCK_ADJUST: 'stock.adjust',           // تعديل المخزون يدوياً
  
  // صلاحيات الفواتير
  SALE_CREATE: 'sale.create',             // إنشاء فاتورة بيع
  SALE_CANCEL: 'sale.cancel',             // إلغاء فاتورة بيع
  SALE_PRINT: 'sale.print',               // طباعة الفاتورة
  PURCHASE_CREATE: 'purchase.create',     // إنشاء فاتورة شراء
  PURCHASE_CANCEL: 'purchase.cancel',     // إلغاء فاتورة شراء
  
  // صلاحيات العملاء والموردين
  CUSTOMER_VIEW: 'customer.view',         // مشاهدة العملاء
  CUSTOMER_CREATE: 'customer.create',     // إضافة عميل
  CUSTOMER_EDIT: 'customer.edit',         // تعديل عميل
  CUSTOMER_DELETE: 'customer.delete',     // حذف عميل
  SUPPLIER_VIEW: 'supplier.view',         // مشاهدة الموردين
  SUPPLIER_CREATE: 'supplier.create',     // إضافة مورد
  SUPPLIER_EDIT: 'supplier.edit',         // تعديل مورد
  SUPPLIER_DELETE: 'supplier.delete',     // حذف مورد
  
  // صلاحيات الأماكن
  LOCATION_VIEW: 'location.view',
  LOCATION_CREATE: 'location.create',
  LOCATION_EDIT: 'location.edit',
  LOCATION_DELETE: 'location.delete',
  
  // صلاحيات المستخدمين (للمدير فقط)
  USER_VIEW: 'user.view',
  USER_CREATE: 'user.create',
  USER_EDIT: 'user.edit', 
  USER_DELETE: 'user.delete',
  ROLE_MANAGE: 'role.manage',             // إدارة الصلاحيات
  
  // صلاحيات النظام
  BACKUP_CREATE: 'backup.create',
  BACKUP_RESTORE: 'backup.restore',
  SETTINGS_EDIT: 'settings.edit',
  AUDIT_VIEW: 'audit.view',
  REPORTS_VIEW: 'reports.view',
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
      PERMISSIONS.PRODUCT_VIEW, PERMISSIONS.PRODUCT_CREATE, PERMISSIONS.PRODUCT_EDIT,
      PERMISSIONS.STOCK_VIEW, PERMISSIONS.STOCK_ADJUST,
      PERMISSIONS.SALE_CREATE, PERMISSIONS.SALE_PRINT,
      PERMISSIONS.PURCHASE_CREATE,
      PERMISSIONS.CUSTOMER_VIEW, PERMISSIONS.CUSTOMER_CREATE, PERMISSIONS.CUSTOMER_EDIT,
      PERMISSIONS.SUPPLIER_VIEW, PERMISSIONS.SUPPLIER_CREATE, PERMISSIONS.SUPPLIER_EDIT,
      PERMISSIONS.LOCATION_VIEW, PERMISSIONS.LOCATION_CREATE,
      PERMISSIONS.REPORTS_VIEW, PERMISSIONS.AUDIT_VIEW,
      PERMISSIONS.BACKUP_CREATE,
    ]
  },
  
  storekeeper: {
    name: 'أمين مخزن',
    color: '#10b981',
    permissions: [
      PERMISSIONS.PRODUCT_VIEW, PERMISSIONS.PRODUCT_CREATE,  // من إضافة بس من حذف!
      PERMISSIONS.STOCK_VIEW, PERMISSIONS.STOCK_ADJUST,
      PERMISSIONS.PURCHASE_CREATE,
      PERMISSIONS.SUPPLIER_VIEW,
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.LOCATION_VIEW,
      PERMISSIONS.REPORTS_VIEW,
    ]
  },
  
  cashier: {
    name: 'كاشير',
    color: '#4361ee',
    permissions: [
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.STOCK_VIEW,
      PERMISSIONS.SALE_CREATE,
      PERMISSIONS.SALE_PRINT,
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.CUSTOMER_CREATE,  // الكاشير يقدر يضيف عميل جديد
    ]
  },
  
  junior_cashier: {
    name: 'كاشير مبتدئ',
    color: '#6b7280',
    permissions: [
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.STOCK_VIEW,
      PERMISSIONS.SALE_CREATE,   // فقط بيع، ممنوع طباعة فاتورة!
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
    Swal.fire({
      icon: 'error',
      title: '🚫 غير مصرح',
      text: 'ليس لديك صلاحية للوصول إلى هذه الصفحة',
      confirmButtonText: 'رجوع',
      confirmButtonColor: '#4361ee',
    }).then(() => {
      // الرجوع للصفحة الرئيسية حسب الدور
      if (this.currentUser.role === 'storekeeper') {
        window.location.href = 'storekeeper.html';
      } else if (this.currentUser.role === 'cashier') {
        window.location.href = 'pos.html';
      } else {
        window.location.href = 'index.html';
      }
    });
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
}

// إنشاء نسخة عالمية
const permissionManager = new PermissionManager();

// دالة مساعدة للاستخدام السريع في الكود
window.can = (permission) => permissionManager.can(permission);