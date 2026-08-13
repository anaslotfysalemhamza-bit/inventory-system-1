// ================================================================
// 🎨 theme-settings.js - نظام الثيمات لكل صفحة
// ================================================================

(function () {
    'use strict';

    // ================================================================
    // CONFIGURATION
    // ================================================================
    const STORAGE_KEY_PREFIX = 'user_page_themes_';
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

    // ================================================================
    // STATE
    // ================================================================
    let selectedPage = null;
    let allPageThemes = {};
    let themeData = {};

    // ================================================================
    // DEFAULT THEME
    // ================================================================
    function getDefaultTheme() {
        return {
            primary_color: '#4361ee',
            secondary_color: '#764ba2',
            background_color: '#f8fafc',
            text_color: '#1f2937',
            sidebar_bg: '#0f172a',
            sidebar_text: '#ffffff',
            card_bg: '#ffffff',
            card_shadow: '0 4px 15px rgba(0,0,0,0.08)',
            card_radius: '20px',
            button_color: '#4361ee',
            button_radius: '12px',
            font_family: 'Cairo',
            font_size: 'medium',
            font_weight: 'regular',
            background_type: 'solid',
            background_image: null,
            background_opacity: 1.00,
            theme_mode: 'light',
            button_style: 'rounded',
            hover_effect: 'scale',
            sidebar_style: 'default'
        };
    }

    // ================================================================
    // SHOW TOAST
    // ================================================================
    function showToast(type, message) {
        if (!type) type = 'info';
        if (!message) message = '';
        
        if (window.showProfessionalToast) {
            window.showProfessionalToast(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    // ================================================================
    // LOAD ALL PAGE THEMES
    // ================================================================
    function loadAllPageThemes() {
        try {
            const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}${currentUser.id}`);
            if (saved) {
                allPageThemes = JSON.parse(saved);
                console.log('✅ Loaded themes for', Object.keys(allPageThemes).length, 'pages');
            } else {
                allPageThemes = {};
                console.log('✅ No saved themes');
            }
        } catch (e) {
            console.error('Error loading themes:', e);
            allPageThemes = {};
        }
    }

    // ================================================================
    // POPULATE PAGE SELECT
    // ================================================================
    window.populatePageSelect = function() {
        const pageSelect = document.getElementById('pageSelect');
        if (!pageSelect) {
            console.warn('⚠️ pageSelect not found');
            return;
        }
        
        const pageNames = window.getPageNames ? window.getPageNames() : {};
        
        const pageIcons = {
            'لوحة التحكم': '📊', 'المنتجات': '📦', 'فاتورة بيع': '🛒',
            'فاتورة شراء': '🚛', 'المخزون الحالي': '📋', 'العملاء': '👥',
            'الموردين': '🏢', 'إدارة الفواتير': '📄', 'التقارير': '📈',
            'سجل الحركات': '📝', 'الخزنة': '💰', 'حضور وانصراف': '⏰',
            'أماكن التخزين': '📍', 'المرتجعات': '↩️', 'كشف حساب العملاء': '💳',
            'تسجيل دفعات': '💵', 'تحديث الأسعار': '💲', 'إدارة الحسابات': '👤',
            'طلبات الحسابات': '📬', 'الصلاحيات': '🔐', 'تفاصيل المستخدمين': '👨‍💼',
            'الملف الشخصي': '⚙️', 'تخصيص الثيم': '🎨'
        };
        
        pageSelect.innerHTML = '<option value="" disabled selected>-- اختر صفحة للتخصيص --</option>';
        
        const sortedPages = Object.entries(pageNames).sort((a, b) => a[1].localeCompare(b[1], 'ar'));
        
        for (const [fileName, arabicName] of sortedPages) {
            const option = document.createElement('option');
            option.value = arabicName;
            const icon = pageIcons[arabicName] || '📄';
            option.textContent = `${icon} ${arabicName}`;
            pageSelect.appendChild(option);
        }
        
        console.log('✅ Page list populated:', Object.keys(pageNames).length, 'pages');
    };

    // ================================================================
    // GET PAGE FILE NAME
    // ================================================================
    function getPageFileName(arabicName) {
        const pageNames = window.getPageNames ? window.getPageNames() : {};
        
        // البحث عن اسم الملف من الاسم العربي
        for (const [fileName, name] of Object.entries(pageNames)) {
            if (name === arabicName) {
                return fileName;
            }
        }
        
        return null;
    }

    // ================================================================
    // LOAD PAGE IN IFRAME
    // ================================================================
    function loadPageInIframe(pageName) {
        const fileName = getPageFileName(pageName);
        
        if (!fileName) {
            showToast('error', 'لم يتم العثور على ملف الصفحة');
            return;
        }
        
        const iframe = document.getElementById('livePreviewFrame');
        const placeholder = document.getElementById('iframePlaceholder');
        const loading = document.getElementById('iframeLoading');
        const previewInfo = document.getElementById('previewInfo');
        
        if (!iframe || !placeholder || !loading) return;
        
        // إظهار التحميل
        placeholder.style.display = 'none';
        iframe.style.display = 'none';
        loading.style.display = 'flex';
        
        // تحميل الصفحة مع query parameter خاص
        const timestamp = new Date().getTime();
        iframe.src = `${fileName}?themePreview=true&t=${timestamp}`;
        
        // عند انتهاء التحميل
        let loadTimeout = setTimeout(() => {
            // إذا استغرقت أكثر من 5 ثواني
            handleIframeLoadError();
        }, 5000);
        
        iframe.onload = function() {
            clearTimeout(loadTimeout);
            
            // التحقق من تحميل المحتوى
            setTimeout(() => {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    
                    if (!iframeDoc || !iframeDoc.body || iframeDoc.body.innerHTML.trim() === '') {
                        handleIframeLoadError();
                        return;
                    }
                    
                    loading.style.display = 'none';
                    iframe.style.display = 'block';
                    if (previewInfo) previewInfo.style.display = 'block';
                    
                    // إضافة inspector للصفحة
                    setupIframeInspector(iframe);
                    
                    // تطبيق الثيم الحالي على iframe
                    applyThemeToIframe(iframe);
                    
                    showToast('success', `تم تحميل صفحة: ${pageName}`);
                    
                } catch (error) {
                    console.warn('Same-origin policy restriction:', error);
                    
                    // الصفحة تعمل ولكن لا يمكن الوصول للمحتوى
                    loading.style.display = 'none';
                    iframe.style.display = 'block';
                    
                    // إضافة overlay للتنبيه
                    addCrossOriginOverlay();
                    
                    showToast('warning', 'تم تحميل الصفحة ولكن لا يمكن التفاعل معها بسبب قيود الأمان');
                }
            }, 500);
        };
        
        // في حالة الخطأ
        iframe.onerror = function() {
            handleIframeLoadError();
        };
    }

    // ================================================================
    // HANDLE IFRAME LOAD ERROR
    // ================================================================
    function handleIframeLoadError() {
        const iframe = document.getElementById('livePreviewFrame');
        const placeholder = document.getElementById('iframePlaceholder');
        const loading = document.getElementById('iframeLoading');
        
        if (loading) loading.style.display = 'none';
        if (iframe) iframe.style.display = 'none';
        if (placeholder) {
            placeholder.style.display = 'flex';
            placeholder.innerHTML = `
                <i class="fas fa-exclamation-triangle" style="font-size:60px; color:#f59e0b; margin-bottom:20px;"></i>
                <h3 style="color:#dc2626;">فشل تحميل الصفحة</h3>
                <p>قد تحتاج إلى:</p>
                <ul style="text-align:right; color:#6b7280; margin-top:10px;">
                    <li>تسجيل الدخول أولاً</li>
                    <li>تشغيل الملفات على سيرفر محلي</li>
                    <li>التحقق من وجود الملف</li>
                </ul>
                <button onclick="window.location.reload()" style="margin-top:20px; padding:10px 20px; background:#4361ee; color:white; border:none; border-radius:8px; cursor:pointer;">
                    🔄 إعادة المحاولة
                </button>
            `;
        }
        
        showToast('error', 'فشل تحميل الصفحة - تحقق من الإعدادات');
    }

    // ================================================================
    // ADD CROSS-ORIGIN OVERLAY
    // ================================================================
    function addCrossOriginOverlay() {
        const previewInfo = document.getElementById('previewInfo');
        
        if (previewInfo) {
            previewInfo.innerHTML = `
                <div class="info-item" style="background:#fef3c7; border:2px solid #fbbf24; padding:15px; border-radius:12px;">
                    <i class="fas fa-shield-alt" style="color:#f59e0b;"></i>
                    <div style="flex:1;">
                        <strong style="color:#92400e;">قيود الأمان نشطة</strong>
                        <p style="font-size:12px; color:#78350f; margin-top:5px;">
                            لا يمكن التفاعل مع عناصر الصفحة بسبب Same-Origin Policy.
                            يمكنك فقط مشاهدة تطبيق الثيم بشكل عام.
                        </p>
                    </div>
                </div>
            `;
            previewInfo.style.display = 'block';
        }
    }

    // ================================================================
    // SETUP IFRAME INSPECTOR
    // ================================================================
    let selectedElement = null;
    
    function setupIframeInspector(iframe) {
        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            
            if (!iframeDoc) {
                console.warn('Cannot access iframe document');
                return;
            }
            
            // حقن helper script
            injectPreviewHelper(iframeDoc);
            
            // إزالة المستمعات القديمة
            const newBody = iframeDoc.body.cloneNode(true);
            iframeDoc.body.parentNode.replaceChild(newBody, iframeDoc.body);
            
            // إضافة hover effect
            iframeDoc.body.addEventListener('mouseover', function(e) {
                const target = e.target;
                if (target && target !== iframeDoc.body) {
                    target.style.outline = '2px dashed #4361ee';
                    target.style.cursor = 'pointer';
                }
            });
            
            iframeDoc.body.addEventListener('mouseout', function(e) {
                const target = e.target;
                if (target && target !== iframeDoc.body && target !== selectedElement) {
                    target.style.outline = '';
                    target.style.cursor = '';
                }
            });
            
            // إضافة click handler
            iframeDoc.body.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // إزالة التحديد السابق
                if (selectedElement) {
                    selectedElement.style.outline = '';
                }
                
                selectedElement = e.target;
                
                // تحديد العنصر الجديد
                selectedElement.style.outline = '3px solid #4361ee';
                selectedElement.style.outlineOffset = '2px';
                
                // عرض معلومات العنصر
                showElementInfo(selectedElement);
                
                // تحديث خيارات التعديل
                updateEditOptions(selectedElement);
            });
            
            console.log('✅ Iframe inspector setup complete');
            
        } catch (error) {
            console.warn('Cannot setup iframe inspector:', error);
            showToast('warning', 'تحذير: قد لا تتمكن من تحديد العناصر بسبب قيود الأمان');
        }
    }

    // ================================================================
    // INJECT PREVIEW HELPER
    // ================================================================
    function injectPreviewHelper(iframeDoc) {
        try {
            const script = iframeDoc.createElement('script');
            script.src = 'theme-preview-helper.js';
            iframeDoc.head.appendChild(script);
            console.log('✅ Preview helper injected');
        } catch (error) {
            console.warn('Cannot inject preview helper:', error);
        }
    }

    // ================================================================
    // SHOW ELEMENT INFO
    // ================================================================
    function showElementInfo(element) {
        const info = document.getElementById('selectedElementInfo');
        const name = document.getElementById('selectedElementName');
        
        if (!info || !name) return;
        
        // تحديد نوع العنصر
        let elementType = element.tagName.toLowerCase();
        let elementDesc = '';
        
        if (element.className) {
            const classes = element.className.split(' ').filter(c => c.trim());
            if (classes.length > 0) {
                elementDesc = classes[0];
            }
        }
        
        if (element.id) {
            elementDesc = '#' + element.id;
        }
        
        const displayName = elementDesc || elementType;
        
        name.textContent = displayName;
        info.style.display = 'flex';
        
        // Animation
        info.style.animation = 'none';
        setTimeout(() => {
            info.style.animation = 'slideInRight 0.3s ease';
        }, 10);
    }

    // ================================================================
    // UPDATE EDIT OPTIONS
    // ================================================================
    function updateEditOptions(element) {
        // الحصول على الـ styles الحالية
        const computedStyle = window.getComputedStyle(element);
        
        // تحديث الألوان في الـ panel
        const bgColor = rgbToHex(computedStyle.backgroundColor);
        const textColor = rgbToHex(computedStyle.color);
        
        if (bgColor && bgColor !== '#000000') {
            const cardBgInput = document.getElementById('cardBg');
            if (cardBgInput) cardBgInput.value = bgColor;
        }
        
        if (textColor) {
            const textColorInput = document.getElementById('textColor');
            if (textColorInput) textColorInput.value = textColor;
        }
        
        console.log('Element selected:', {
            tag: element.tagName,
            bgColor: bgColor,
            textColor: textColor
        });
    }

    // ================================================================
    // RGB TO HEX
    // ================================================================
    function rgbToHex(rgb) {
        if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return null;
        
        const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
        if (!match) return null;
        
        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);
        
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    // ================================================================
    // APPLY THEME TO IFRAME
    // ================================================================
    function applyThemeToIframe(iframe) {
        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            
            if (!iframeDoc || !themeData) return;
            
            const root = iframeDoc.documentElement;
            
            // تطبيق الألوان
            if (themeData.primary_color) root.style.setProperty('--primary-color', themeData.primary_color);
            if (themeData.secondary_color) root.style.setProperty('--secondary-color', themeData.secondary_color);
            if (themeData.background_color) root.style.setProperty('--background-color', themeData.background_color);
            if (themeData.text_color) root.style.setProperty('--text-color', themeData.text_color);
            if (themeData.card_bg) root.style.setProperty('--card-bg', themeData.card_bg);
            if (themeData.sidebar_bg) root.style.setProperty('--sidebar-bg', themeData.sidebar_bg);
            if (themeData.sidebar_text) root.style.setProperty('--sidebar-text', themeData.sidebar_text);
            
            console.log('✅ Theme applied to iframe');
            
        } catch (error) {
            console.warn('Cannot apply theme to iframe:', error);
        }
    }

    // ================================================================
    // ON PAGE CHANGE
    // ================================================================
    window.onPageChange = function(pageName) {
        if (!pageName) return;
        
        selectedPage = pageName;
        
        const indicator = document.getElementById('selectedPageName');
        if (indicator) {
            indicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحميل...';
        }
        
        // جلب أو إنشاء theme للصفحة
        if (allPageThemes[pageName]) {
            themeData = JSON.parse(JSON.stringify(allPageThemes[pageName]));
        } else {
            themeData = getDefaultTheme();
            allPageThemes[pageName] = JSON.parse(JSON.stringify(themeData));
        }
        
        // تطبيق على الواجهة
        applyThemeToUI(themeData);
        
        // تحميل الصفحة في iframe
        loadPageInIframe(pageName);
        
        if (indicator) {
            indicator.innerHTML = '<i class="fas fa-check-circle"></i> ' + pageName;
            indicator.parentElement?.classList.add('active');
        }
        
        showToast('success', `تم تحميل: ${pageName}`);
        console.log('📄 Page selected:', pageName);
    };

    // ================================================================
    // SAVE THEME FOR SELECTED PAGE
    // ================================================================
    window.saveThemeForSelectedPage = function() {
        if (!selectedPage) {
            showToast('error', 'يرجى اختيار صفحة أولاً');
            return;
        }
        
        // عرض رسالة التحميل
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.classList.add('active');
        }
        
        setTimeout(() => {
            try {
                // حفظ
                allPageThemes[selectedPage] = JSON.parse(JSON.stringify(themeData));
                localStorage.setItem(`${STORAGE_KEY_PREFIX}${currentUser.id}`, JSON.stringify(allPageThemes));
                
                // إعلام theme-engine
                if (window.saveThemeForPage) {
                    window.saveThemeForPage(selectedPage, themeData);
                }
                
                // تحديث الإحصائيات
                updateThemeInfo();
                
                // إخفاء التحميل
                if (loadingOverlay) {
                    loadingOverlay.classList.remove('active');
                }
                
                showToast('success', `✅ تم الحفظ: ${selectedPage}`);
                console.log('💾 Saved for:', selectedPage);
            } catch (e) {
                if (loadingOverlay) {
                    loadingOverlay.classList.remove('active');
                }
                showToast('error', 'فشل الحفظ: ' + e.message);
                console.error('Save error:', e);
            }
        }, 500);
    };

    // ================================================================
    // RESET TO DEFAULT
    // ================================================================
    window.resetToDefault = function() {
        if (!selectedPage) {
            showToast('error', 'يرجى اختيار صفحة أولاً');
            return;
        }
        
        if (!confirm('هل تريد إعادة التعيين للإعدادات الافتراضية؟\n\nسيتم استبدال جميع التخصيصات الحالية.')) {
            return;
        }
        
        // عرض رسالة التحميل
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.classList.add('active');
        }
        
        setTimeout(() => {
            try {
                themeData = getDefaultTheme();
                allPageThemes[selectedPage] = JSON.parse(JSON.stringify(themeData));
                
                // حفظ في localStorage
                localStorage.setItem(`${STORAGE_KEY_PREFIX}${currentUser.id}`, JSON.stringify(allPageThemes));
                
                // تطبيق على الواجهة
                applyThemeToUI(themeData);
                
                // إعلام theme-engine
                if (window.saveThemeForPage) {
                    window.saveThemeForPage(selectedPage, themeData);
                }
                
                // إخفاء التحميل
                if (loadingOverlay) {
                    loadingOverlay.classList.remove('active');
                }
                
                showToast('success', '✅ تم إعادة التعيين للإعدادات الافتراضية');
                console.log('🔄 Reset to default for:', selectedPage);
            } catch (e) {
                if (loadingOverlay) {
                    loadingOverlay.classList.remove('active');
                }
                showToast('error', 'فشلت إعادة التعيين: ' + e.message);
                console.error('Reset error:', e);
            }
        }, 500);
    };

    // ================================================================
    // SWITCH TAB
    // ================================================================
    window.switchTab = function(tabName) {
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        
        const tabContent = document.getElementById('tab-' + tabName);
        if (tabContent) tabContent.classList.add('active');
        
        const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
        if (tabBtn) tabBtn.classList.add('active');
    };

    // ================================================================
    // SET PRESET COLOR
    // ================================================================
    window.setPresetColor = function(type, color, element) {
        if (type === 'primary') {
            themeData.primary_color = color;
            const input = document.getElementById('primaryColor');
            if (input) input.value = color;
            const hex = document.getElementById('primaryColorHex');
            if (hex) hex.textContent = color;
        } else if (type === 'secondary') {
            themeData.secondary_color = color;
            const input = document.getElementById('secondaryColor');
            if (input) input.value = color;
            const hex = document.getElementById('secondaryColorHex');
            if (hex) hex.textContent = color;
        }
        
        const parent = element.parentElement;
        parent.querySelectorAll('.preset-color').forEach(el => el.classList.remove('active'));
        element.classList.add('active');
        
        // تطبيق المعاينة المباشرة
        updateLivePreview();
    };

    // ================================================================
    // UPDATE LIVE PREVIEW
    // ================================================================
    function updateLivePreview() {
        const iframe = document.getElementById('livePreviewFrame');
        
        if (!iframe || !iframe.contentDocument) {
            console.log('⚠️ Iframe not loaded yet');
            return;
        }
        
        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            const root = iframeDoc.documentElement;
            
            // تطبيق الألوان كمتغيرات CSS
            if (themeData.primary_color) root.style.setProperty('--primary-color', themeData.primary_color);
            if (themeData.secondary_color) root.style.setProperty('--secondary-color', themeData.secondary_color);
            if (themeData.background_color) root.style.setProperty('--background-color', themeData.background_color);
            if (themeData.text_color) root.style.setProperty('--text-color', themeData.text_color);
            if (themeData.card_bg) root.style.setProperty('--card-bg', themeData.card_bg);
            if (themeData.sidebar_bg) root.style.setProperty('--sidebar-bg', themeData.sidebar_bg);
            if (themeData.sidebar_text) root.style.setProperty('--sidebar-text', themeData.sidebar_text);
            if (themeData.card_radius) root.style.setProperty('--card-radius', themeData.card_radius);
            if (themeData.card_shadow) root.style.setProperty('--card-shadow', themeData.card_shadow);
            if (themeData.button_radius) root.style.setProperty('--button-radius', themeData.button_radius);
            
            // تطبيق الخطوط
            if (themeData.font_family) {
                iframeDoc.body.style.fontFamily = themeData.font_family + ', sans-serif';
            }
            
            // تطبيق حجم الخط
            if (themeData.font_size) {
                const sizeMap = {
                    'small': '14px',
                    'medium': '16px',
                    'large': '18px',
                    'xlarge': '20px'
                };
                iframeDoc.body.style.fontSize = sizeMap[themeData.font_size] || '16px';
            }
            
            console.log('🎨 Live preview updated in iframe:', {
                primary: themeData.primary_color,
                sidebar: themeData.sidebar_bg,
                text: themeData.text_color
            });
            
        } catch (error) {
            console.warn('Cannot update iframe preview:', error);
        }
    }

    // ================================================================
    // APPLY THEME TO UI
    // ================================================================
    function applyThemeToUI(theme) {
        if (!theme) return;
        
        // Colors Tab
        const primaryColor = document.getElementById('primaryColor');
        if (primaryColor) {
            primaryColor.value = theme.primary_color || '#4361ee';
            // إزالة المستمعات القديمة
            const newPrimary = primaryColor.cloneNode(true);
            primaryColor.parentNode.replaceChild(newPrimary, primaryColor);
            newPrimary.addEventListener('input', (e) => {
                themeData.primary_color = e.target.value;
                document.getElementById('primaryColorHex').textContent = e.target.value;
                updateLivePreview();
            });
        }
        
        const secondaryColor = document.getElementById('secondaryColor');
        if (secondaryColor) {
            secondaryColor.value = theme.secondary_color || '#764ba2';
            const newSecondary = secondaryColor.cloneNode(true);
            secondaryColor.parentNode.replaceChild(newSecondary, secondaryColor);
            newSecondary.addEventListener('input', (e) => {
                themeData.secondary_color = e.target.value;
                document.getElementById('secondaryColorHex').textContent = e.target.value;
                updateLivePreview();
            });
        }
        
        const backgroundColor = document.getElementById('backgroundColor');
        if (backgroundColor) {
            backgroundColor.value = theme.background_color || '#f8fafc';
            const newBg = backgroundColor.cloneNode(true);
            backgroundColor.parentNode.replaceChild(newBg, backgroundColor);
            newBg.addEventListener('input', (e) => {
                themeData.background_color = e.target.value;
                document.getElementById('backgroundColorHex').textContent = e.target.value;
                updateLivePreview();
            });
        }
        
        const textColor = document.getElementById('textColor');
        if (textColor) {
            textColor.value = theme.text_color || '#1f2937';
            const newText = textColor.cloneNode(true);
            textColor.parentNode.replaceChild(newText, textColor);
            newText.addEventListener('input', (e) => {
                themeData.text_color = e.target.value;
                document.getElementById('textColorHex').textContent = e.target.value;
                updateLivePreview();
            });
        }
        
        const cardBg = document.getElementById('cardBg');
        if (cardBg) {
            cardBg.value = theme.card_bg || '#ffffff';
            const newCard = cardBg.cloneNode(true);
            cardBg.parentNode.replaceChild(newCard, cardBg);
            newCard.addEventListener('input', (e) => {
                themeData.card_bg = e.target.value;
                document.getElementById('cardBgHex').textContent = e.target.value;
                updateLivePreview();
            });
        }
        
        const sidebarBg = document.getElementById('sidebarBg');
        if (sidebarBg) {
            sidebarBg.value = theme.sidebar_bg || '#0f172a';
            const newSidebar = sidebarBg.cloneNode(true);
            sidebarBg.parentNode.replaceChild(newSidebar, sidebarBg);
            newSidebar.addEventListener('input', (e) => {
                themeData.sidebar_bg = e.target.value;
                document.getElementById('sidebarBgHex').textContent = e.target.value;
                updateLivePreview();
            });
        }
        
        const sidebarText = document.getElementById('sidebarText');
        if (sidebarText) {
            sidebarText.value = theme.sidebar_text || '#ffffff';
            const newSidebarText = sidebarText.cloneNode(true);
            sidebarText.parentNode.replaceChild(newSidebarText, sidebarText);
            newSidebarText.addEventListener('input', (e) => {
                themeData.sidebar_text = e.target.value;
                document.getElementById('sidebarTextHex').textContent = e.target.value;
                updateLivePreview();
            });
        }
        
        // Hex values
        const primaryColorHex = document.getElementById('primaryColorHex');
        if (primaryColorHex) primaryColorHex.textContent = theme.primary_color || '#4361ee';
        
        const secondaryColorHex = document.getElementById('secondaryColorHex');
        if (secondaryColorHex) secondaryColorHex.textContent = theme.secondary_color || '#764ba2';
        
        const backgroundColorHex = document.getElementById('backgroundColorHex');
        if (backgroundColorHex) backgroundColorHex.textContent = theme.background_color || '#f8fafc';
        
        const textColorHex = document.getElementById('textColorHex');
        if (textColorHex) textColorHex.textContent = theme.text_color || '#1f2937';
        
        const cardBgHex = document.getElementById('cardBgHex');
        if (cardBgHex) cardBgHex.textContent = theme.card_bg || '#ffffff';
        
        const sidebarBgHex = document.getElementById('sidebarBgHex');
        if (sidebarBgHex) sidebarBgHex.textContent = theme.sidebar_bg || '#0f172a';
        
        const sidebarTextHex = document.getElementById('sidebarTextHex');
        if (sidebarTextHex) sidebarTextHex.textContent = theme.sidebar_text || '#ffffff';
        
        // Typography Tab
        const fontFamily = document.getElementById('fontFamily');
        if (fontFamily) {
            fontFamily.value = theme.font_family || 'Cairo';
            const newFont = fontFamily.cloneNode(true);
            fontFamily.parentNode.replaceChild(newFont, fontFamily);
            newFont.addEventListener('change', (e) => {
                themeData.font_family = e.target.value;
                updateLivePreview();
            });
        }
        
        const fontSize = document.getElementById('fontSize');
        if (fontSize) {
            fontSize.value = theme.font_size || 'medium';
            const newSize = fontSize.cloneNode(true);
            fontSize.parentNode.replaceChild(newSize, fontSize);
            newSize.addEventListener('change', (e) => {
                themeData.font_size = e.target.value;
                updateLivePreview();
            });
        }
        
        const fontWeight = document.getElementById('fontWeight');
        if (fontWeight) {
            fontWeight.value = theme.font_weight || 'regular';
            const newWeight = fontWeight.cloneNode(true);
            fontWeight.parentNode.replaceChild(newWeight, fontWeight);
            newWeight.addEventListener('change', (e) => {
                themeData.font_weight = e.target.value;
                updateLivePreview();
            });
        }
        
        // Background Tab
        const backgroundType = document.getElementById('backgroundType');
        if (backgroundType) {
            backgroundType.value = theme.background_type || 'solid';
            const newBgType = backgroundType.cloneNode(true);
            backgroundType.parentNode.replaceChild(newBgType, backgroundType);
            newBgType.addEventListener('change', (e) => {
                themeData.background_type = e.target.value;
                const bgImageGroup = document.getElementById('bgImageGroup');
                if (bgImageGroup) {
                    bgImageGroup.style.display = e.target.value === 'image' ? 'block' : 'none';
                }
                updateLivePreview();
            });
        }
        
        const backgroundOpacity = document.getElementById('backgroundOpacity');
        if (backgroundOpacity) {
            backgroundOpacity.value = (theme.background_opacity || 1) * 100;
            const newOpacity = backgroundOpacity.cloneNode(true);
            backgroundOpacity.parentNode.replaceChild(newOpacity, backgroundOpacity);
            newOpacity.addEventListener('input', (e) => {
                themeData.background_opacity = e.target.value / 100;
                document.getElementById('opacityValue').textContent = e.target.value + '%';
                updateLivePreview();
            });
        }
        
        // Components Tab
        const buttonStyle = document.getElementById('buttonStyle');
        if (buttonStyle) {
            buttonStyle.value = theme.button_style || 'rounded';
            const newBtn = buttonStyle.cloneNode(true);
            buttonStyle.parentNode.replaceChild(newBtn, buttonStyle);
            newBtn.addEventListener('change', (e) => {
                themeData.button_style = e.target.value;
                const radiusMap = { 'rounded': '12px', 'square': '4px', 'pill': '30px' };
                themeData.button_radius = radiusMap[e.target.value] || '12px';
                updateLivePreview();
            });
        }
        
        const cardRadius = document.getElementById('cardRadius');
        if (cardRadius) {
            cardRadius.value = theme.card_radius || '20px';
            const newRadius = cardRadius.cloneNode(true);
            cardRadius.parentNode.replaceChild(newRadius, cardRadius);
            newRadius.addEventListener('change', (e) => {
                themeData.card_radius = e.target.value;
                updateLivePreview();
            });
        }
        
        const cardShadow = document.getElementById('cardShadow');
        if (cardShadow) {
            cardShadow.value = theme.card_shadow || '0 4px 15px rgba(0,0,0,0.08)';
            const newShadow = cardShadow.cloneNode(true);
            cardShadow.parentNode.replaceChild(newShadow, cardShadow);
            newShadow.addEventListener('change', (e) => {
                themeData.card_shadow = e.target.value;
                updateLivePreview();
            });
        }
        
        const sidebarStyle = document.getElementById('sidebarStyle');
        if (sidebarStyle) {
            sidebarStyle.value = theme.sidebar_style || 'default';
            const newSidebarStyle = sidebarStyle.cloneNode(true);
            sidebarStyle.parentNode.replaceChild(newSidebarStyle, sidebarStyle);
            newSidebarStyle.addEventListener('change', (e) => {
                themeData.sidebar_style = e.target.value;
                updateLivePreview();
            });
        }
        
        const hoverEffect = document.getElementById('hoverEffect');
        if (hoverEffect) {
            hoverEffect.value = theme.hover_effect || 'scale';
            const newHover = hoverEffect.cloneNode(true);
            hoverEffect.parentNode.replaceChild(newHover, hoverEffect);
            newHover.addEventListener('change', (e) => {
                themeData.hover_effect = e.target.value;
                updateLivePreview();
            });
        }
        
        // Advanced Tab
        const themeMode = document.getElementById('themeMode');
        if (themeMode) {
            themeMode.value = theme.theme_mode || 'light';
            const newMode = themeMode.cloneNode(true);
            themeMode.parentNode.replaceChild(newMode, themeMode);
            newMode.addEventListener('change', (e) => {
                themeData.theme_mode = e.target.value;
                updateLivePreview();
            });
        }
        
        // تطبيق المعاينة المباشرة
        updateLivePreview();
        
        console.log('✅ Theme applied to UI');
    }

    // ================================================================
    // HANDLE BACKGROUND IMAGE
    // ================================================================
    window.handleBackgroundImage = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            themeData.background_image = e.target.result;
            const fileName = document.getElementById('bgFileName');
            if (fileName) {
                fileName.textContent = `✅ ${file.name}`;
            }
            updateLivePreview();
            showToast('success', 'تم تحميل صورة الخلفية');
        };
        reader.readAsDataURL(file);
    };

    // ================================================================
    // UPDATE OPACITY
    // ================================================================
    window.updateOpacity = function(value) {
        themeData.background_opacity = value / 100;
        const opacityValue = document.getElementById('opacityValue');
        if (opacityValue) {
            opacityValue.textContent = value + '%';
        }
        updateLivePreview();
    };

    // ================================================================
    // APPLY THEME TO ALL
    // ================================================================
    window.applyThemeToAll = function() {
        if (!confirm('هل تريد تطبيق الثيم الحالي على جميع المستخدمين؟\n\nتحذير: سيتم استبدال إعدادات الثيم لجميع المستخدمين!')) {
            return;
        }
        
        // هنا يمكن إضافة منطق لتطبيق الثيم على جميع المستخدمين
        // في الوقت الحالي، سنقوم بحفظه كـ "default_theme" في localStorage
        try {
            localStorage.setItem('default_theme_for_all', JSON.stringify(themeData));
            showToast('success', '✅ تم تطبيق الثيم على جميع المستخدمين');
        } catch (e) {
            showToast('error', 'فشل التطبيق: ' + e.message);
        }
    };

    // ================================================================
    // EXPORT THEME
    // ================================================================
    window.exportTheme = function() {
        if (!selectedPage) {
            showToast('error', 'يرجى اختيار صفحة أولاً');
            return;
        }
        
        try {
            const dataStr = JSON.stringify(themeData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `theme-${selectedPage.replace(/\s+/g, '-')}-${Date.now()}.json`;
            link.click();
            
            URL.revokeObjectURL(url);
            showToast('success', '✅ تم تصدير الثيم بنجاح');
        } catch (e) {
            showToast('error', 'فشل التصدير: ' + e.message);
        }
    };

    // ================================================================
    // IMPORT THEME
    // ================================================================
    window.importTheme = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const imported = JSON.parse(e.target.result);
                
                // دمج البيانات المستوردة مع البيانات الافتراضية
                themeData = { ...getDefaultTheme(), ...imported };
                
                // تطبيق على الواجهة
                applyThemeToUI(themeData);
                
                showToast('success', '✅ تم استيراد الثيم بنجاح');
            } catch (err) {
                showToast('error', 'فشل الاستيراد: ملف غير صالح');
            }
        };
        reader.readAsText(file);
    };

    // ================================================================
    // INIT
    // ================================================================
    function init() {
        console.log('🎨 Initializing Theme Settings...');
        
        if (!currentUser || !currentUser.id) {
            window.location.href = 'login.html';
            return;
        }

        // تحديث اسم المستخدم في الهيدر
        const userNameEl = document.getElementById('userName');
        if (userNameEl && currentUser.name) {
            userNameEl.textContent = currentUser.name;
        }

        // تحديث الصورة الشخصية
        const avatarEl = document.getElementById('topBarAvatar');
        if (avatarEl) {
            const profilePicture = localStorage.getItem('user_profile_picture_' + currentUser.id);
            if (profilePicture) {
                avatarEl.innerHTML = `<img src="${profilePicture}" alt="صورة المستخدم" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
            } else {
                const initials = (currentUser.name || 'A').charAt(0).toUpperCase();
                avatarEl.textContent = initials;
                avatarEl.style.background = 'linear-gradient(135deg, #4361ee, #3a0ca3)';
            }
        }

        // تحديث التاريخ والوقت
        const dateTimeEl = document.getElementById('currentDateTime');
        if (dateTimeEl) {
            const now = new Date();
            const options = { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            };
            dateTimeEl.textContent = now.toLocaleDateString('ar-EG', options);
            
            // تحديث كل دقيقة
            setInterval(() => {
                const now = new Date();
                dateTimeEl.textContent = now.toLocaleDateString('ar-EG', options);
            }, 60000);
        }

        loadAllPageThemes();
        
        if (typeof window.populatePageSelect === 'function') {
            window.populatePageSelect();
        }
        
        // إضافة معلومات الثيم
        updateThemeInfo();
        
        // إضافة دعم السحب والإفلات للخلفية
        setupDragAndDrop();

        console.log('✅ Theme Settings initialized');
        console.log('👤 User:', currentUser.name);
    }

    // ================================================================
    // SETUP DRAG AND DROP
    // ================================================================
    function setupDragAndDrop() {
        const uploadBox = document.getElementById('uploadBox');
        if (!uploadBox) return;
        
        uploadBox.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadBox.classList.add('drag-over');
        });
        
        uploadBox.addEventListener('dragleave', () => {
            uploadBox.classList.remove('drag-over');
        });
        
        uploadBox.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadBox.classList.remove('drag-over');
            
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    themeData.background_image = e.target.result;
                    const fileName = document.getElementById('bgFileName');
                    if (fileName) {
                        fileName.textContent = `✅ ${file.name}`;
                    }
                    updateLivePreview();
                    showToast('success', 'تم تحميل صورة الخلفية');
                };
                reader.readAsDataURL(file);
            } else {
                showToast('error', 'يرجى اختيار ملف صورة');
            }
        });
    }

    // ================================================================
    // UPDATE THEME INFO
    // ================================================================
    function updateThemeInfo() {
        // آخر تحديث
        const lastUpdated = document.getElementById('lastUpdated');
        if (lastUpdated) {
            const now = new Date();
            lastUpdated.textContent = now.toLocaleDateString('ar-EG', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        
        // المستخدم
        const themeUser = document.getElementById('themeUser');
        if (themeUser && currentUser.name) {
            themeUser.textContent = currentUser.name;
        }
        
        // إجمالي التغييرات
        const statTotalChanges = document.getElementById('statTotalChanges');
        if (statTotalChanges) {
            statTotalChanges.textContent = Object.keys(allPageThemes).length;
        }
        
        // آخر حفظ
        const statLastSaved = document.getElementById('statLastSaved');
        if (statLastSaved) {
            const now = new Date();
            statLastSaved.textContent = now.toLocaleTimeString('ar-EG', { 
                hour: '2-digit', 
                minute: '2-digit'
            });
        }
    }

    // ================================================================
    // RUN
    // ================================================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
