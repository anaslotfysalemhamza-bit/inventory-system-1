// ==================== إدارة المستخدمين والصلاحيات ====================
let currentUser = null;

function getUsers() {
  let users = localStorage.getItem("users");
  if (users) return JSON.parse(users);
  let defaultUsers = [
    {
      id: 1,
      username: "admin",
      password: "admin123",
      name: "مدير النظام",
      role: "admin",
    },
    {
      id: 2,
      username: "storekeeper",
      password: "store123",
      name: "أمين المخزن",
      role: "storekeeper",
    },
    {
      id: 3,
      username: "cashier",
      password: "cash123",
      name: "الكاشير",
      role: "cashier",
    },
  ];
  localStorage.setItem("users", JSON.stringify(defaultUsers));
  return defaultUsers;
}

function login(username, password) {
  let users = getUsers();
  let user = users.find(
    (u) => u.username === username && u.password === password,
  );
  if (user) {
    currentUser = user;
    localStorage.setItem("currentUser", JSON.stringify(user));
    addAuditLog("تسجيل دخول: " + user.name);
    return true;
  }
  return false;
}

function logout() {
  if (currentUser) addAuditLog("تسجيل خروج: " + currentUser.name);
  currentUser = null;
  localStorage.removeItem("currentUser");
  window.location.href = "login.html";
}

// التحقق من الصلاحية (لحماية الصفحات)
function checkPermission(allowedRoles) {
  let user = JSON.parse(localStorage.getItem("currentUser"));
  if (!user) {
    window.location.href = "login.html";
    return false;
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === "storekeeper") {
      window.location.href = "storekeeper.html";
    } else if (user.role === "cashier") {
      window.location.href = "pos.html";
    } else {
      window.location.href = "login.html";
    }
    return false;
  }
  return true;
}

function checkStorekeeperPermission() {
  let user = JSON.parse(localStorage.getItem("currentUser"));
  if (!user) {
    window.location.href = "login.html";
    return false;
  }
  if (user.role !== "admin" && user.role !== "storekeeper") {
    if (user.role === "cashier") {
      window.location.href = "pos.html";
    } else {
      window.location.href = "login.html";
    }
    return false;
  }
  return true;
}

function checkCashierPermission() {
  let user = JSON.parse(localStorage.getItem("currentUser"));
  if (!user) {
    window.location.href = "login.html";
    return false;
  }
  if (user.role !== "admin" && user.role !== "cashier") {
    if (user.role === "storekeeper") {
      window.location.href = "storekeeper.html";
    } else {
      window.location.href = "login.html";
    }
    return false;
  }
  return true;
}

// ==================== سجل الحركات (Audit Log) ====================
function getAuditLog() {
  let data = localStorage.getItem("auditLog");
  if (data) return JSON.parse(data);
  let defaultLogs = [
    {
      id: Date.now(),
      date: new Date().toISOString(),
      user: "نظام",
      action: "تم إنشاء النظام بنجاح",
    },
  ];
  localStorage.setItem("auditLog", JSON.stringify(defaultLogs));
  return defaultLogs;
}

function addAuditLog(action) {
  let logs = getAuditLog();
  let user = JSON.parse(localStorage.getItem("currentUser"));
  let userName = user ? user.name : "نظام";
  logs.unshift({
    id: Date.now(),
    date: new Date().toISOString(),
    user: userName,
    action: action,
  });
  if (logs.length > 500) logs.pop();
  localStorage.setItem("auditLog", JSON.stringify(logs));
}

// ==================== ضريبة القيمة المضافة ====================
const VAT_RATE = 14;
const VAT_MULTIPLIER = 1 + VAT_RATE / 100;

function calculateVAT(price) {
  return (price * VAT_RATE) / 100;
}

function priceAfterVAT(price) {
  return price * VAT_MULTIPLIER;
}

// ==================== إدارة المنتجات (IndexedDB) ====================
const DB_NAME = "InventoryDB";
const DB_VERSION = 2;
const PRODUCTS_STORE = "products";

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(PRODUCTS_STORE)) {
        const productStore = db.createObjectStore(PRODUCTS_STORE, {
          keyPath: "id",
        });
        productStore.createIndex("code", "code", { unique: true });
        productStore.createIndex("name", "name");
      }
    };
  });
}

async function getAllProducts() {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("DB not initialized"));
      return;
    }
    const transaction = db.transaction([PRODUCTS_STORE], "readonly");
    const store = transaction.objectStore(PRODUCTS_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function addProduct(product) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PRODUCTS_STORE], "readwrite");
    const store = transaction.objectStore(PRODUCTS_STORE);
    const request = store.add(product);
    request.onsuccess = () => {
      addAuditLog("إضافة منتج جديد: " + product.name);
      resolve(product);
    };
    request.onerror = () => reject(request.error);
  });
}

async function updateProduct(product) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PRODUCTS_STORE], "readwrite");
    const store = transaction.objectStore(PRODUCTS_STORE);
    const request = store.put(product);
    request.onsuccess = () => {
      addAuditLog("تعديل منتج: " + product.name);
      resolve(product);
    };
    request.onerror = () => reject(request.error);
  });
}

async function deleteProduct(id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PRODUCTS_STORE], "readwrite");
    const store = transaction.objectStore(PRODUCTS_STORE);
    const request = store.delete(id);
    request.onsuccess = () => {
      addAuditLog("حذف منتج");
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

async function deleteAllProducts() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PRODUCTS_STORE], "readwrite");
    const store = transaction.objectStore(PRODUCTS_STORE);
    const request = store.clear();
    request.onsuccess = () => {
      addAuditLog("حذف جميع المنتجات");
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

async function addProductsBulk(products) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PRODUCTS_STORE], "readwrite");
    const store = transaction.objectStore(PRODUCTS_STORE);
    let added = 0;
    let errors = [];
    for (const product of products) {
      const request = store.add(product);
      request.onsuccess = () => {
        added++;
        if (added === products.length) resolve({ added, errors });
      };
      request.onerror = (e) => {
        errors.push({ product: product.code, error: e.target.error });
        added++;
        if (added === products.length) resolve({ added, errors });
      };
    }
    transaction.oncomplete = () => {
      addAuditLog(`استيراد ${added} منتج من Excel`);
    };
  });
}

// ==================== إدارة المخزون (localStorage) ====================
function getStock() {
  let data = localStorage.getItem("stock");
  return data ? JSON.parse(data) : [];
}

function saveStock(stock) {
  localStorage.setItem("stock", JSON.stringify(stock));
}

function updateStockForPurchase(productId, locationId, quantity) {
  let stock = getStock();
  let existing = stock.find(
    (s) => s.productId == productId && s.locationId == locationId,
  );
  if (existing) {
    existing.quantity += quantity;
  } else {
    stock.push({
      productId: productId,
      locationId: locationId,
      quantity: quantity,
    });
  }
  saveStock(stock);
}

function updateStockForSale(productId, locationId, quantity) {
  let stock = getStock();
  let existing = stock.find(
    (s) => s.productId == productId && s.locationId == locationId,
  );
  if (existing && existing.quantity >= quantity) {
    existing.quantity -= quantity;
    saveStock(stock);
    return true;
  }
  return false;
}

function getCurrentStock(products, locations, stock) {
  let result = [];
  for (let s of stock) {
    let product = products.find((p) => p.id == s.productId);
    let location = locations.find((l) => l.id == s.locationId);
    if (product && location) {
      result.push({
        productName: product.name,
        productCode: product.code,
        locationName: location.name,
        quantity: s.quantity,
        purchasePrice:
          product.purchasePriceBefore || product.purchasePrice || 0,
        minStock: product.minStock,
        value:
          s.quantity *
          (product.purchasePriceBefore || product.purchasePrice || 0),
      });
    }
  }
  return result;
}

function getLowStockProducts(products, stock) {
  let low = [];
  for (let p of products) {
    let totalQty = 0;
    for (let s of stock) {
      if (s.productId == p.id) totalQty += s.quantity;
    }
    if (totalQty <= p.minStock) {
      low.push({
        productName: p.name,
        quantity: totalQty,
        minStock: p.minStock,
      });
    }
  }
  return low;
}

// ==================== إدارة الأماكن ====================
function getLocations() {
  let data = localStorage.getItem("locations");
  return data ? JSON.parse(data) : [];
}

function saveLocations(locations) {
  localStorage.setItem("locations", JSON.stringify(locations));
}

function addLocation(location) {
  let locations = getLocations();
  location.id = Date.now();
  locations.push(location);
  saveLocations(locations);
  addAuditLog("إضافة مكان جديد: " + location.name);
}

function deleteLocation(id) {
  let locations = getLocations();
  let location = locations.find((l) => l.id == id);
  if (location) {
    locations = locations.filter((l) => l.id != id);
    saveLocations(locations);
    addAuditLog("حذف مكان: " + location.name);
  }
}

// ==================== إدارة العملاء ====================
function getCustomers() {
  let data = localStorage.getItem("customers");
  if (data) return JSON.parse(data);
  let defaultCustomers = [
    {
      id: 1,
      name: "عميل نقدي",
      phone: "",
      address: "",
      balance: 0,
      totalPurchases: 0,
    },
    {
      id: 2,
      name: "محمد أحمد",
      phone: "01012345678",
      address: "القاهرة",
      balance: 0,
      totalPurchases: 0,
    },
  ];
  localStorage.setItem("customers", JSON.stringify(defaultCustomers));
  return defaultCustomers;
}

function saveCustomers(customers) {
  localStorage.setItem("customers", JSON.stringify(customers));
}

function addCustomer(customer) {
  let customers = getCustomers();
  customer.id = Date.now();
  customers.push(customer);
  saveCustomers(customers);
  addAuditLog("إضافة عميل جديد: " + customer.name);
}

function updateCustomerBalance(customerId, amount, type) {
  let customers = getCustomers();
  let customer = customers.find((c) => c.id == customerId);
  if (customer) {
    if (type === "add") {
      customer.balance += amount;
      customer.totalPurchases += amount;
    } else {
      customer.balance -= amount;
    }
    saveCustomers(customers);
  }
}

// ==================== إدارة الموردين ====================
function getSuppliers() {
  let data = localStorage.getItem("suppliers");
  if (data) return JSON.parse(data);
  let defaultSuppliers = [
    { id: 1, name: "مورد عام", phone: "", address: "", balance: 0 },
    {
      id: 2,
      name: "شركة المواد الغذائية",
      phone: "01098765432",
      address: "القاهرة",
      balance: 0,
    },
  ];
  localStorage.setItem("suppliers", JSON.stringify(defaultSuppliers));
  return defaultSuppliers;
}

function saveSuppliers(suppliers) {
  localStorage.setItem("suppliers", JSON.stringify(suppliers));
}

function addSupplier(supplier) {
  let suppliers = getSuppliers();
  supplier.id = Date.now();
  suppliers.push(supplier);
  saveSuppliers(suppliers);
  addAuditLog("إضافة مورد جديد: " + supplier.name);
}

// ==================== فواتير الشراء ====================
function getPurchaseInvoices() {
  let data = localStorage.getItem("purchaseInvoices");
  return data ? JSON.parse(data) : [];
}

function savePurchaseInvoices(invoices) {
  localStorage.setItem("purchaseInvoices", JSON.stringify(invoices));
}

function addPurchaseInvoice(invoice) {
  let invoices = getPurchaseInvoices();
  invoice.id = Date.now();
  let user = JSON.parse(localStorage.getItem("currentUser"));
  invoice.createdBy = user ? user.name : "نظام";
  invoices.push(invoice);
  savePurchaseInvoices(invoices);

  for (let item of invoice.items) {
    updateStockForPurchase(item.productId, item.locationId, item.quantity);
  }
  addAuditLog(
    "إضافة فاتورة شراء رقم: " +
      invoice.invoiceNumber +
      " بقيمة " +
      invoice.total,
  );
}

// ==================== فواتير البيع ====================
function getSaleInvoices() {
  let data = localStorage.getItem("saleInvoices");
  return data ? JSON.parse(data) : [];
}

function saveSaleInvoices(invoices) {
  localStorage.setItem("saleInvoices", JSON.stringify(invoices));
}

function addSaleInvoice(invoice) {
  let invoices = getSaleInvoices();
  invoice.id = Date.now();
  let user = JSON.parse(localStorage.getItem("currentUser"));
  invoice.createdBy = user ? user.name : "نظام";
  invoices.push(invoice);
  saveSaleInvoices(invoices);

  for (let item of invoice.items) {
    updateStockForSale(item.productId, item.locationId, item.quantity);
  }

  if (
    invoice.paymentMethod !== "cash" &&
    invoice.customerId &&
    invoice.customerId !== 1
  ) {
    updateCustomerBalance(
      invoice.customerId,
      invoice.totalAfterDiscount,
      "add",
    );
  }
  addAuditLog(
    "إضافة فاتورة بيع رقم: " +
      invoice.invoiceNumber +
      " بقيمة " +
      (invoice.totalAfterDiscount || invoice.total),
  );
}

// ==================== المرتجعات ====================
function getReturns() {
  let data = localStorage.getItem("returns");
  return data ? JSON.parse(data) : [];
}

function saveReturns(returns) {
  localStorage.setItem("returns", JSON.stringify(returns));
}

function addReturn(returnItem) {
  let returns = getReturns();
  returnItem.id = Date.now();
  returns.push(returnItem);
  saveReturns(returns);

  let stock = getStock();
  for (let item of returnItem.items) {
    let stockItem = stock.find((s) => s.productId == item.productId);
    if (returnItem.type === "sale") {
      if (stockItem) {
        stockItem.quantity += item.quantity;
      } else {
        stock.push({
          productId: item.productId,
          locationId: 1,
          quantity: item.quantity,
        });
      }
    } else {
      if (stockItem) {
        stockItem.quantity -= item.quantity;
      }
    }
  }
  saveStock(stock);
  addAuditLog(
    "تسجيل مرتجع " +
      (returnItem.type === "sale" ? "مبيعات" : "مشتريات") +
      " رقم: " +
      returnItem.returnNumber,
  );
}

// ==================== نسخ احتياطي ====================
async function exportBackup() {
  const products = await getAllProducts();
  let backup = {
    products: products,
    locations: getLocations(),
    stock: getStock(),
    customers: getCustomers(),
    suppliers: getSuppliers(),
    purchaseInvoices: getPurchaseInvoices(),
    saleInvoices: getSaleInvoices(),
    returns: getReturns(),
    auditLog: getAuditLog(),
    exportDate: new Date().toISOString(),
  };
  let blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  let url = URL.createObjectURL(blob);
  let a = document.createElement("a");
  a.href = url;
  a.download = "backup_" + new Date().toISOString().slice(0, 19) + ".json";
  a.click();
  URL.revokeObjectURL(url);
  showNotification("تم إنشاء النسخة الاحتياطية بنجاح", "success");
  addAuditLog("تصدير نسخة احتياطية للبيانات");
}

function importBackup(file) {
  let reader = new FileReader();
  reader.onload = async function (e) {
    let data = JSON.parse(e.target.result);
    if (data.products) {
      for (let p of data.products) {
        await addProduct(p);
      }
    }
    if (data.locations)
      localStorage.setItem("locations", JSON.stringify(data.locations));
    if (data.stock) localStorage.setItem("stock", JSON.stringify(data.stock));
    if (data.customers)
      localStorage.setItem("customers", JSON.stringify(data.customers));
    if (data.suppliers)
      localStorage.setItem("suppliers", JSON.stringify(data.suppliers));
    if (data.purchaseInvoices)
      localStorage.setItem(
        "purchaseInvoices",
        JSON.stringify(data.purchaseInvoices),
      );
    if (data.saleInvoices)
      localStorage.setItem("saleInvoices", JSON.stringify(data.saleInvoices));
    if (data.returns)
      localStorage.setItem("returns", JSON.stringify(data.returns));
    if (data.auditLog)
      localStorage.setItem("auditLog", JSON.stringify(data.auditLog));
    showNotification("تم استيراد البيانات بنجاح", "success");
    addAuditLog("استيراد نسخة احتياطية");
    setTimeout(() => location.reload(), 1500);
  };
  reader.readAsText(file);
}

// ==================== إشعارات ====================
function showNotification(message, type) {
  let notification = document.createElement("div");
  notification.className = "notification " + type;
  notification.innerHTML =
    '<i class="fas ' +
    (type === "success" ? "fa-check-circle" : "fa-exclamation-circle") +
    '"></i> ' +
    message;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
}

async function updateNotificationBadge() {
  const products = await getAllProducts();
  let stock = getStock();
  let lowCount = 0;
  for (let p of products) {
    let qty = 0;
    for (let s of stock) {
      if (s.productId == p.id) qty += s.quantity;
    }
    if (qty <= p.minStock) lowCount++;
  }
  let badges = document.querySelectorAll("#notificationBadge");
  for (let badge of badges) {
    badge.textContent = lowCount;
    badge.style.display = lowCount > 0 ? "inline-block" : "none";
  }
}

// ==================== الباركود ====================
function generateBarcode(productCode) {
  return "BAR-" + productCode + "-" + Date.now().toString().slice(-6);
}

function searchByBarcode(barcode) {
  return getAllProducts().then((products) =>
    products.find((p) => p.barcode === barcode || p.code === barcode),
  );
}

// ==================== البحث الصوتي ====================
function startVoiceSearch(inputElement) {
  if (!("webkitSpeechRecognition" in window)) {
    showNotification("المتصفح لا يدعم البحث الصوتي", "error");
    return;
  }
  let recognition = new webkitSpeechRecognition();
  recognition.lang = "ar-EG";
  recognition.onresult = function (event) {
    let text = event.results[0][0].transcript;
    inputElement.value = text;
    inputElement.dispatchEvent(new Event("input"));
  };
  recognition.start();
}

// ==================== تصدير CSV ====================
async function exportToCSV(type) {
  if (type === "products") {
    const products = await getAllProducts();
    let csv = "الكود,اسم المنتج,الفئة,سعر الشراء,سعر البيع,الحد الأدنى\n";
    for (let p of products) {
      let price = p.purchasePriceBefore || p.purchasePrice || 0;
      let sellingPrice = p.sellingPriceBefore || p.sellingPrice || 0;
      csv += `"${p.code}","${p.name}","${p.category}",${price},${sellingPrice},${p.minStock}\n`;
    }
    let blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    let url = URL.createObjectURL(blob);
    let a = document.createElement("a");
    a.href = url;
    a.download = "products_" + new Date().toISOString().slice(0, 19) + ".csv";
    a.click();
    URL.revokeObjectURL(url);
    showNotification("تم تصدير المنتجات بنجاح", "success");
  }
}

// ========== دوال مساعدة عامة ==========
function formatDate(date) {
  return new Date(date).toLocaleString("ar-EG");
}

function formatNumber(num) {
  return num.toLocaleString("ar-EG");
}

function showLoading(show, elementId = "loadingOverlay") {
  const overlay = document.getElementById(elementId);
  if (overlay) overlay.style.display = show ? "flex" : "none";
}

function updateDateTime(elementId = "currentDateTime") {
  let now = new Date();
  let element = document.getElementById(elementId);
  if (element) {
    element.innerHTML =
      '<i class="far fa-calendar-alt"></i> ' + now.toLocaleString("ar-EG");
  }
}

// ========== ربط الدوال العامة ==========
window.getUsers = getUsers;
window.login = login;
window.logout = logout;
window.checkPermission = checkPermission;
window.checkStorekeeperPermission = checkStorekeeperPermission;
window.checkCashierPermission = checkCashierPermission;
window.getAuditLog = getAuditLog;
window.addAuditLog = addAuditLog;
window.VAT_RATE = VAT_RATE;
window.calculateVAT = calculateVAT;
window.priceAfterVAT = priceAfterVAT;
window.openDB = openDB;
window.getAllProducts = getAllProducts;
window.addProduct = addProduct;
window.updateProduct = updateProduct;
window.deleteProduct = deleteProduct;
window.deleteAllProducts = deleteAllProducts;
window.addProductsBulk = addProductsBulk;
window.getStock = getStock;
window.saveStock = saveStock;
window.updateStockForPurchase = updateStockForPurchase;
window.updateStockForSale = updateStockForSale;
window.getCurrentStock = getCurrentStock;
window.getLowStockProducts = getLowStockProducts;
window.getLocations = getLocations;
window.saveLocations = saveLocations;
window.addLocation = addLocation;
window.deleteLocation = deleteLocation;
window.getCustomers = getCustomers;
window.saveCustomers = saveCustomers;
window.addCustomer = addCustomer;
window.updateCustomerBalance = updateCustomerBalance;
window.getSuppliers = getSuppliers;
window.saveSuppliers = saveSuppliers;
window.addSupplier = addSupplier;
window.getPurchaseInvoices = getPurchaseInvoices;
window.savePurchaseInvoices = savePurchaseInvoices;
window.addPurchaseInvoice = addPurchaseInvoice;
window.getSaleInvoices = getSaleInvoices;
window.saveSaleInvoices = saveSaleInvoices;
window.addSaleInvoice = addSaleInvoice;
window.getReturns = getReturns;
window.saveReturns = saveReturns;
window.addReturn = addReturn;
window.exportBackup = exportBackup;
window.importBackup = importBackup;
window.showNotification = showNotification;
window.updateNotificationBadge = updateNotificationBadge;
window.generateBarcode = generateBarcode;
window.searchByBarcode = searchByBarcode;
window.startVoiceSearch = startVoiceSearch;
window.exportToCSV = exportToCSV;
window.formatDate = formatDate;
window.formatNumber = formatNumber;
window.showLoading = showLoading;
window.updateDateTime = updateDateTime;

// ========== تهيئة المستخدم الحالي ==========
let savedUser = localStorage.getItem("currentUser");
if (savedUser) {
  currentUser = JSON.parse(savedUser);
}

// ========== تحديث الوقت كل ثانية ==========
setInterval(() => updateDateTime(), 1000);

// ========== تحديث إشعارات المخزون المنخفض كل 10 ثواني ==========
setInterval(() => {
  if (document.getElementById("notificationBadge")) {
    updateNotificationBadge();
  }
}, 10000);

// ========== فتح قاعدة البيانات تلقائياً ==========
openDB().catch(console.error);
