// ========== محرك الثيمات المتقدم - Theme Engine V2 ==========
// يدعم ثيمات منفصلة لكل صفحة + الوضع الفاتح/الداكن

(function() {
    'use strict';

    // ================================================================
    // CONFIGURATION
    // ================================================================
    const THEME_STORAGE_KEY = 'user_page_themes_';
    const GLOBAL_THEME_KEY = 'app_theme'; // light / dark
    
    let currentUser = null;
    let currentPage = null;
    let allPageThemes = {};
    
    // ================================================================
    // GET CURRENT USER
    // ================================================================
    function getCurrentUser() {
        try {
            const userData = localStorage.getItem('currentUser');
            if (userData) {
                return JSON.parse(userData);
            }
        } catch (e) {
            console.warn('Failed to get user:', e);
        }
        return { id: 'default' };
    }
    
    // ================================================================
    // GET CURRENT PAGE
    // ================================================================
    function getCurrentPage() {
        const path = window.location.pathname;
        const fileName = path.substring(path.lastIndexOf('/') + 1) || 'index.html';
        
        // استخدام دالة getPageNames إذا كانت موجودة
        if (window.getPageNames) {
            const pageNames = window.getPageNames();
            return pageNames[fileName] || fileName;
        }
        
        return fileName;
    }
    
    // ================================================================
    // LOAD ALL THEMES
    // ================================================================
    function loadAllThemes() {
        try {
            const storageKey = THEME_STORAGE_KEY + currentUser.id;
            const saved = localStorage.getItem(storageKey);
            
            if (saved) {
                allPageThemes = JSON.parse(saved);
                console.log('✅ Loaded themes for', Object.keys(allPageThemes).length, 'pages');
            } else {
                allPageThemes = {};
                console.log('✅ No saved themes, using defaults');
            }
        } catch (e) {
            console.error('Failed to load themes:', e);
            allPageThemes = {};
        }
    }
    
    // ================================================================
    // GET THEME FOR CURRENT PAGE
    // ================================================================
    function getThemeForCurrentPage() {
        if (!currentPage) return null;
        return allPageThemes[currentPage] || null;
    }
    
    // ================================================================
    // APPLY THEME TO PAGE
    // ================================================================
    function applyThemeToPage(theme) {
        if (!theme) {
            console.log('No custom theme for', currentPage, '- using default colors');
            return;
        }
        
        try {
            const root = document.documentElement;
            
            // تطبيق الألوان
            if (theme.primary_color) root.style.setProperty('--primary-color', theme.primary_color);
            if (theme.secondary_color) root.style.setProperty('--secondary-color', theme.secondary_color);
            if (theme.background_color) root.style.setProperty('--background-color', theme.background_color);
            if (theme.text_color) root.style.setProperty('--text-color', theme.text_color);
            if (theme.card_bg) root.style.setProperty('--card-bg', theme.card_bg);
            if (theme.sidebar_bg) root.style.setProperty('--sidebar-bg', theme.sidebar_bg);
            if (theme.sidebar_text) root.style.setProperty('--sidebar-text', theme.sidebar_text);
            
            // تطبيق الخطوط
            if (theme.font_family) root.style.setProperty('--font-family', theme.font_family);
            if (theme.font_size) {
                const sizeMap = {
                    'small': '14px',
                    'medium': '16px',
                    'large': '18px',
                    'xlarge': '20px'
                };
                root.style.setProperty('--font-size', sizeMap[theme.font_size] || '16px');
            }
            
            // تطبيق إعدادات المكونات
            if (theme.card_radius) root.style.setProperty('--card-radius', theme.card_radius);
            if (theme.card_shadow) root.style.setProperty('--card-shadow', theme.card_shadow);
            if (theme.button_radius) root.style.setProperty('--button-radius', theme.button_radius);
            
            console.log('✅ Applied custom theme for:', currentPage);
        } catch (e) {
            console.error('Failed to apply theme:', e);
        }
    }
    
    // ================================================================
    // SAVE THEME FOR PAGE (يُستدعى من theme-settings.js)
    // ================================================================
    window.saveThemeForPage = function(pageName, themeData) {
        try {
            allPageThemes[pageName] = themeData;
            
            const storageKey = THEME_STORAGE_KEY + currentUser.id;
            localStorage.setItem(storageKey, JSON.stringify(allPageThemes));
            
            console.log('💾 Saved theme for:', pageName);
            
            // إذا كانت الصفحة الحالية، طبّق التغيير فوراً
            if (pageName === currentPage) {
                applyThemeToPage(themeData);
            }
            
            return true;
        } catch (e) {
            console.error('Failed to save theme:', e);
            return false;
        }
    };
    
    // ================================================================
    // GLOBAL THEME (LIGHT / DARK)
    // ================================================================
    const savedGlobalTheme = localStorage.getItem(GLOBAL_THEME_KEY) || 'light';
    
    if (savedGlobalTheme === 'dark') {
        document.documentElement.classList.add('dark-theme');
    }
    
    // دالة تبديل الثيم العام
    window.toggleTheme = function() {
        try {
            const isDark = document.documentElement.classList.toggle('dark-theme');
            localStorage.setItem(GLOBAL_THEME_KEY, isDark ? 'dark' : 'light');
            
            if (typeof showProfessionalToast === 'function') {
                showProfessionalToast(
                    isDark ? '🌙 الوضع الداكن' : '☀️ الوضع الفاتح',
                    'info'
                );
            }
            
            return isDark;
        } catch (e) {
            console.warn('Theme toggle error:', e);
            return false;
        }
    };
    
    // دالة الحصول على الثيم العام
    window.getCurrentTheme = function() {
        return document.documentElement.classList.contains('dark-theme') ? 'dark' : 'light';
    };
    
    // دالة إعادة تعيين الثيم
    window.resetTheme = function() {
        try {
            // إزالة الوضع الداكن
            document.documentElement.classList.remove('dark-theme');
            localStorage.removeItem(GLOBAL_THEME_KEY);
            
            // إزالة جميع الألوان المخصصة
            const root = document.documentElement;
            root.style.removeProperty('--primary-color');
            root.style.removeProperty('--secondary-color');
            root.style.removeProperty('--background-color');
            root.style.removeProperty('--text-color');
            root.style.removeProperty('--card-bg');
            root.style.removeProperty('--sidebar-bg');
            root.style.removeProperty('--sidebar-text');
            root.style.removeProperty('--font-family');
            root.style.removeProperty('--font-size');
            root.style.removeProperty('--card-radius');
            root.style.removeProperty('--card-shadow');
            root.style.removeProperty('--button-radius');
            
            console.log('✅ Theme reset successfully');
            return true;
        } catch (e) {
            console.warn('Theme reset error:', e);
            return false;
        }
    };
    
    // دالة حذف ثيم صفحة معينة
    window.deletePageTheme = function(pageName) {
        try {
            if (allPageThemes[pageName]) {
                delete allPageThemes[pageName];
                
                const storageKey = THEME_STORAGE_KEY + currentUser.id;
                localStorage.setItem(storageKey, JSON.stringify(allPageThemes));
                
                console.log('🗑️ Deleted theme for:', pageName);
                
                // إذا كانت الصفحة الحالية، أعد تحميل الصفحة
                if (pageName === currentPage) {
                    window.location.reload();
                }
                
                return true;
            }
            return false;
        } catch (e) {
            console.error('Failed to delete theme:', e);
            return false;
        }
    };
    
    // ================================================================
    // EXPORT FUNCTIONS FOR EXTERNAL USE
    // ================================================================
    
    // تصدير دالة تطبيق الثيم للاستخدام الخارجي
    window.applyTheme = function(theme) {
        if (!theme) return false;
        applyThemeToPage(theme);
        return true;
    };
    
    // تصدير دالة إعادة تحميل الثيم
    window.reloadTheme = function() {
        const theme = getThemeForCurrentPage();
        if (theme) {
            applyThemeToPage(theme);
            return true;
        }
        return false;
    };
    
    // تصدير دالة الحصول على الثيم الحالي
    window.getCurrentPageTheme = function() {
        return getThemeForCurrentPage();
    };
    
    // ================================================================
    // INITIALIZATION
    // ================================================================
    function init() {
        try {
            currentUser = getCurrentUser();
            currentPage = getCurrentPage();
            
            loadAllThemes();
            
            const theme = getThemeForCurrentPage();
            if (theme) {
                applyThemeToPage(theme);
            }
            
            console.log('%c🎨 Theme Engine V2 Loaded', 'color: #8b5cf6; font-size: 12px; font-weight: bold;');
            console.log('%cGlobal Theme:', getCurrentTheme(), '| Page:', currentPage);
            
        } catch (error) {
            console.error('Theme Engine initialization error:', error);
            
            // Fallback - إذا فشل، وفّر دوال بسيطة
            window.toggleTheme = function() { return false; };
            window.getCurrentTheme = function() { return 'light'; };
            window.resetTheme = function() { return true; };
            window.saveThemeForPage = function() { return false; };
            window.deletePageTheme = function() { return false; };
            window.applyTheme = function() { return false; };
            window.reloadTheme = function() { return false; };
            window.getCurrentPageTheme = function() { return null; };
        }
    }
    
    // تشغيل عند التحميل
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();
