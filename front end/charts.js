let salesChart = null;
let paymentChart = null;
let topProductsChart = null;
let monthlyChart = null;

async function renderSalesChart() {
  const canvas = document.getElementById("salesChart");
  if (!canvas) return;

  try {
    const response = await fetch("http://localhost:5000/api/sales");
    const data = await response.json();
    const sales = data.data || [];

    const days = [];
    const salesData = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().slice(0, 10);
      const dayLabel = `${date.getDate()}/${date.getMonth() + 1}`;
      days.push(dayLabel);


      const dailyTotal = sales
        .filter((sale) => sale.date === dateStr)
        .reduce((sum, sale) => sum + (parseFloat(sale.total) || 0), 0);
      salesData.push(dailyTotal);
    }

    if (salesChart) salesChart.destroy();

    const ctx = canvas.getContext("2d");
    salesChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: days,
        datasets: [
          {
            label: "المبيعات (ج.م)",
            data: salesData,
            borderColor: "#4361ee",
            backgroundColor: "rgba(67, 97, 238, 0.1)",
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: "#4361ee",
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: "top",
            rtl: true,
            labels: { font: { family: "Cairo" } },
          },
        },
      },
    });
    console.log("✅ تم رسم مخطط المبيعات بنجاح");
  } catch (error) {
    console.error("❌ خطأ في مخطط المبيعات:", error);
  }
}

/**
 * تحديث وعرض مخطط طرق الدفع (دائرية)
 */
async function renderPaymentChart() {
  const canvas = document.getElementById("paymentChart");
  if (!canvas) return;

  try {
    const response = await fetch("http://localhost:5000/api/sales");
    const data = await response.json();
    const sales = data.data || [];

    let cash = 0,
      visa = 0,
      bank = 0;

    for (const sale of sales) {
      const total = parseFloat(sale.total) || 0;
      const method = (sale.paymentMethod || "").toLowerCase();

      if (method.includes("cash") || method.includes("كاش")) {
        cash += total;
      } else if (method.includes("visa") || method.includes("فيزا")) {
        visa += total;
      } else {
        bank += total;
      }
    }

    if (paymentChart) paymentChart.destroy();

    const ctx = canvas.getContext("2d");
    paymentChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["كاش", "فيزا", "تحويل بنكي"],
        datasets: [
          {
            data: [cash, visa, bank],
            backgroundColor: ["#10b981", "#4361ee", "#f59e0b"],
            borderWidth: 0,
            hoverOffset: 10,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: "top",
            rtl: true,
            labels: { font: { family: "Cairo" } },
          },
        },
      },
    });
    console.log("✅ تم رسم مخطط الدفع بنجاح");
  } catch (error) {
    console.error("❌ خطأ في مخطط الدفع:", error);
  }
}

/**
 * تحديث وعرض مخطط أفضل 10 منتجات مبيعاً
 */
async function renderTopProductsChart() {
  const canvas = document.getElementById("topProductsChart");
  if (!canvas) return;

  try {
    // جلب المنتجات والمبيعات
    const [productsRes, salesRes] = await Promise.all([
      fetch("http://localhost:5000/api/products"),
      fetch("http://localhost:5000/api/sales"),
    ]);

    const productsData = await productsRes.json();
    const salesData = await salesRes.json();

    const products = productsData.data || [];
    const sales = salesData.data || [];

    // حساب الكميات المباعة لكل منتج
    const productSales = {};

    for (const sale of sales) {
      for (const item of sale.items || []) {
        const productId = item.productId;
        const quantity = item.quantity || 0;
        productSales[productId] = (productSales[productId] || 0) + quantity;
      }
    }

    // تحويل إلى مصفوفة وترتيب تنازلي
    const topProducts = Object.entries(productSales)
      .map(([id, qty]) => {
        const product = products.find((p) => p.id == id);
        return { name: product?.name || "غير معروف", quantity: qty };
      })
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    const labels = topProducts.map((p) =>
      p.name.length > 12 ? p.name.slice(0, 12) + ".." : p.name,
    );
    const data = topProducts.map((p) => p.quantity);

    if (topProductsChart) topProductsChart.destroy();

    const ctx = canvas.getContext("2d");
    topProductsChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "الكمية المباعة",
            data: data,
            backgroundColor: "#4361ee",
            borderRadius: 8,
            barPercentage: 0.7,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: "top",
            rtl: true,
            labels: { font: { family: "Cairo" } },
          },
        },
      },
    });
    console.log("✅ تم رسم مخطط أفضل المنتجات بنجاح");
  } catch (error) {
    console.error("❌ خطأ في مخطط أفضل المنتجات:", error);
  }
}

/**
 * تحديث وعرض مخطط المبيعات الشهرية (آخر 6 أشهر)
 */
async function renderMonthlyChart() {
  const canvas = document.getElementById("monthlyChart");
  if (!canvas) return;

  try {
    const response = await fetch("http://localhost:5000/api/sales");
    const data = await response.json();
    const sales = data.data || [];

    // تجميع المبيعات حسب الشهر
    const monthlyData = {};
    const monthNames = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthKey = `${year}-${month.toString().padStart(2, "0")}`;
      const monthName = `${month}/${year}`;
      monthNames.push(monthName);
      monthlyData[monthKey] = 0;
    }

    for (const sale of sales) {
      const saleMonth = sale.date?.slice(0, 7);
      if (monthlyData.hasOwnProperty(saleMonth)) {
        monthlyData[saleMonth] += parseFloat(sale.total) || 0;
      }
    }

    const monthlyValues = monthNames.map((_, index) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - index));
      const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;
      return monthlyData[key] || 0;
    });

    if (monthlyChart) monthlyChart.destroy();

    const ctx = canvas.getContext("2d");
    monthlyChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: monthNames,
        datasets: [
          {
            label: "المبيعات (ج.م)",
            data: monthlyValues,
            backgroundColor: "#10b981",
            borderRadius: 8,
            barPercentage: 0.7,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: "top",
            rtl: true,
            labels: { font: { family: "Cairo" } },
          },
        },
      },
    });
    console.log("✅ تم رسم مخطط المبيعات الشهرية بنجاح");
  } catch (error) {
    console.error("❌ خطأ في مخطط المبيعات الشهرية:", error);
  }
}

/**
 * تحديث جميع المخططات دفعة واحدة
 */
async function renderAllCharts() {
  console.log("🟢 جاري تحديث جميع المخططات...");
  await renderSalesChart();
  await renderPaymentChart();
  await renderTopProductsChart();
  await renderMonthlyChart();
  console.log("✅ تم تحديث جميع المخططات بنجاح");
}

// تصدير الدوال للاستخدام في الصفحات الأخرى
window.renderAllCharts = renderAllCharts;
window.renderSalesChart = renderSalesChart;
window.renderPaymentChart = renderPaymentChart;
window.renderTopProductsChart = renderTopProductsChart;
window.renderMonthlyChart = renderMonthlyChart;

// إذا تم تحميل الصفحة، قم بتشغيل المخططات تلقائياً
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", renderAllCharts);
} else {
  renderAllCharts();
}
