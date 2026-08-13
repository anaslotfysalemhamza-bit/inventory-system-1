/**
 * ⚡ Pagination Middleware - تحسين الأداء
 * يقسم البيانات لصفحات صغيرة بدلاً من تحميل كل شيء
 */

/**
 * دالة Pagination عامة
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
function paginate(req, res, next) {
    // الحصول على رقم الصفحة والحد من query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50; // افتراضي 50 سجل
    const search = req.query.search || '';
    const sortBy = req.query.sortBy || 'id';
    const sortOrder = req.query.sortOrder === 'asc' ? 'ASC' : 'DESC';
    
    // حساب offset
    const offset = (page - 1) * limit;
    
    // إضافة معلومات pagination للـ request
    req.pagination = {
        page,
        limit,
        offset,
        search,
        sortBy,
        sortOrder
    };
    
    next();
}

/**
 * دالة لإنشاء response مع pagination info
 */
function createPaginatedResponse(data, total, page, limit) {
    const totalPages = Math.ceil(total / limit);
    
    return {
        success: true,
        data: data,
        pagination: {
            currentPage: page,
            totalPages: totalPages,
            totalItems: total,
            itemsPerPage: limit,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        }
    };
}

module.exports = {
    paginate,
    createPaginatedResponse
};
