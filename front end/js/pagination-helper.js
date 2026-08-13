/**
 * ⚡ Pagination Helper - مساعد تقسيم الصفحات
 * استخدمه في أي صفحة لإضافة pagination سريع
 */

class PaginationHelper {
    constructor(apiEndpoint, tableBodyId, options = {}) {
        this.apiEndpoint = apiEndpoint;
        this.tableBodyId = tableBodyId;
        this.currentPage = 1;
        this.limit = options.limit || 50;
        this.sortBy = options.sortBy || 'id';
        this.sortOrder = options.sortOrder || 'desc';
        this.searchValue = '';
        this.filters = {};
        this.onDataLoaded = options.onDataLoaded || null;
        this.renderRow = options.renderRow || null;
    }

    /**
     * تحميل البيانات من API
     */
    async loadData() {
        const params = new URLSearchParams({
            page: this.currentPage,
            limit: this.limit,
            sortBy: this.sortBy,
            sortOrder: this.sortOrder
        });

        if (this.searchValue) {
            params.append('search', this.searchValue);
        }

        // إضافة الفلاتر الإضافية
        Object.keys(this.filters).forEach(key => {
            if (this.filters[key]) {
                params.append(key, this.filters[key]);
            }
        });

        try {
            const response = await fetch(`${this.apiEndpoint}?${params}`);
            const result = await response.json();

            if (result.success) {
                this.renderTable(result.data);
                this.renderPagination(result.pagination);

                if (this.onDataLoaded) {
                    this.onDataLoaded(result);
                }

                return result;
            }
        } catch (error) {
            console.error('Error loading data:', error);
            alert('خطأ في تحميل البيانات');
        }
    }

    /**
     * عرض البيانات في الجدول
     */
    renderTable(data) {
        const tbody = document.getElementById(this.tableBodyId);
        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:40px;">لا توجد بيانات</td></tr>';
            return;
        }

        data.forEach(item => {
            const row = tbody.insertRow();
            if (this.renderRow) {
                row.innerHTML = this.renderRow(item);
            } else {
                row.innerHTML = `<td>${JSON.stringify(item)}</td>`;
            }
        });
    }

    /**
     * عرض أزرار التنقل
     */
    renderPagination(pagination) {
        const container = document.getElementById('paginationContainer');
        if (!container) return;

        container.innerHTML = '';

        // زر السابق
        const prevBtn = this.createButton('« السابق', () => this.goToPage(this.currentPage - 1), !pagination.hasPrevPage);
        container.appendChild(prevBtn);

        // معلومات الصفحة
        const info = document.createElement('span');
        info.className = 'pagination-info';
        info.innerHTML = `صفحة ${pagination.currentPage} من ${pagination.totalPages}<br><small>(${pagination.totalItems} سجل)</small>`;
        container.appendChild(info);

        // أزرار الصفحات
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(pagination.totalPages, this.currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = this.createButton(i, () => this.goToPage(i), false, i === this.currentPage);
            container.appendChild(pageBtn);
        }

        // زر التالي
        const nextBtn = this.createButton('التالي »', () => this.goToPage(this.currentPage + 1), !pagination.hasNextPage);
        container.appendChild(nextBtn);
    }

    /**
     * إنشاء زر
     */
    createButton(text, onClick, disabled = false, active = false) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.onclick = onClick;
        btn.disabled = disabled;
        if (active) btn.className = 'active';
        return btn;
    }

    /**
     * الانتقال لصفحة معينة
     */
    goToPage(page) {
        this.currentPage = page;
        this.loadData();
    }

    /**
     * تعيين البحث
     */
    setSearch(value) {
        this.searchValue = value;
        this.currentPage = 1;
        this.loadData();
    }

    /**
     * تعيين فلتر
     */
    setFilter(key, value) {
        this.filters[key] = value;
        this.currentPage = 1;
        this.loadData();
    }

    /**
     * تعيين الترتيب
     */
    setSorting(sortBy, sortOrder) {
        this.sortBy = sortBy;
        this.sortOrder = sortOrder;
        this.loadData();
    }

    /**
     * تعيين عدد الصفوف
     */
    setLimit(limit) {
        this.limit = limit;
        this.currentPage = 1;
        this.loadData();
    }
}

/**
 * دالة مساعدة لإنشاء شريط بحث وفلترة
 */
function createSearchBar(containerId, paginationHelper) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
        <div style="display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; align-items: center;">
            <input 
                type="text" 
                id="searchInput" 
                placeholder="🔍 بحث..."
                style="flex: 1; min-width: 200px; padding: 10px; border: 1px solid #ddd; border-radius: 8px;"
            >
            <select id="pageSizeSelect" style="padding: 10px; border: 1px solid #ddd; border-radius: 8px;">
                <option value="25">25 صف</option>
                <option value="50" selected>50 صف</option>
                <option value="100">100 صف</option>
                <option value="200">200 صف</option>
            </select>
            <button onclick="window.paginationHelper.loadData()" 
                    style="padding: 10px 20px; background: #4361ee; color: white; border: none; border-radius: 8px; cursor: pointer;">
                ⚡ تحديث
            </button>
        </div>
    `;

    // ربط البحث
    let searchTimeout;
    document.getElementById('searchInput').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            paginationHelper.setSearch(e.target.value);
        }, 500);
    });

    // ربط تغيير عدد الصفوف
    document.getElementById('pageSizeSelect').addEventListener('change', (e) => {
        paginationHelper.setLimit(parseInt(e.target.value));
    });
}

/**
 * إضافة أنماط Pagination
 */
function addPaginationStyles() {
    if (document.getElementById('pagination-styles')) return;

    const style = document.createElement('style');
    style.id = 'pagination-styles';
    style.textContent = `
        #paginationContainer {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 10px;
            margin: 20px 0;
            flex-wrap: wrap;
        }
        
        #paginationContainer button {
            padding: 8px 16px;
            border: 1px solid #ddd;
            background: white;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.3s;
            font-family: inherit;
        }
        
        #paginationContainer button:hover:not(:disabled) {
            background: #4361ee;
            color: white;
            border-color: #4361ee;
        }
        
        #paginationContainer button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        #paginationContainer button.active {
            background: #4361ee;
            color: white;
            border-color: #4361ee;
        }
        
        .pagination-info {
            color: #666;
            font-size: 14px;
            text-align: center;
        }
    `;
    document.head.appendChild(style);
}

// إضافة الأنماط تلقائياً
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addPaginationStyles);
} else {
    addPaginationStyles();
}
