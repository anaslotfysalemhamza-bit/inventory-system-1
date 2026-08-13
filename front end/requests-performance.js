// ============================================================
// ⚡ Requests Performance Optimization
// ============================================================
// محسّن الأداء للطلبات - يدعم Caching, Debouncing, Retry Logic
// ============================================================

(function() {
    'use strict';
    
    const API_URL = window.API_URL || 'http://localhost:5000/api';
    
    // ============================================================
    // 💾 Simple Cache System
    // ============================================================
    const requestCache = new Map();
    const CACHE_DURATION = 60000; // 1 minute
    
    function getCachedData(key) {
        const cached = requestCache.get(key);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            console.log('📦 Cache hit:', key);
            return cached.data;
        }
        return null;
    }
    
    function setCachedData(key, data) {
        requestCache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }
    
    function clearCache(pattern) {
        if (pattern) {
            // Clear specific cache entries matching pattern
            for (const key of requestCache.keys()) {
                if (key.includes(pattern)) {
                    requestCache.delete(key);
                }
            }
        } else {
            // Clear all cache
            requestCache.clear();
        }
        console.log('🗑️ Cache cleared:', pattern || 'all');
    }
    
    // ============================================================
    // 🔄 Fetch with Retry Logic
    // ============================================================
    async function fetchWithRetry(url, options = {}, maxRetries = 3) {
        const cacheKey = `${url}_${JSON.stringify(options)}`;
        
        // Check cache for GET requests
        if (!options.method || options.method === 'GET') {
            const cached = getCachedData(cacheKey);
            if (cached) {
                return cached;
            }
        }
        
        let lastError;
        
        for (let i = 0; i < maxRetries; i++) {
            try {
                console.log(`🔄 Request attempt ${i + 1}/${maxRetries}:`, url);
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds
                
                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                
                // Cache successful GET requests
                if (!options.method || options.method === 'GET') {
                    setCachedData(cacheKey, data);
                }
                
                console.log('✅ Request successful:', url);
                return data;
                
            } catch (error) {
                lastError = error;
                console.warn(`⚠️ Attempt ${i + 1} failed:`, error.message);
                
                // Wait before retry (exponential backoff)
                if (i < maxRetries - 1) {
                    const waitTime = Math.min((i + 1) * 2000, 10000); // Max 10s
                    console.log(`⏳ Waiting ${waitTime/1000}s before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
        }
        
        // All retries failed
        console.error('❌ All retry attempts failed:', url);
        throw lastError;
    }
    
    // ============================================================
    // ⏱️ Debounce Function
    // ============================================================
    function debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // ============================================================
    // 📊 Request Queue Manager (for bulk operations)
    // ============================================================
    class RequestQueue {
        constructor(concurrency = 3) {
            this.concurrency = concurrency;
            this.running = 0;
            this.queue = [];
        }
        
        async add(fn) {
            return new Promise((resolve, reject) => {
                this.queue.push({ fn, resolve, reject });
                this.process();
            });
        }
        
        async process() {
            if (this.running >= this.concurrency || this.queue.length === 0) {
                return;
            }
            
            this.running++;
            const { fn, resolve, reject } = this.queue.shift();
            
            try {
                const result = await fn();
                resolve(result);
            } catch (error) {
                reject(error);
            } finally {
                this.running--;
                this.process();
            }
        }
    }
    
    // ============================================================
    // 🌐 Optimized API Methods
    // ============================================================
    const OptimizedAPI = {
        // GET with caching
        async get(endpoint, options = {}) {
            const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
            return fetchWithRetry(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            }, options.maxRetries);
        },
        
        // POST without caching
        async post(endpoint, data, options = {}) {
            const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
            
            // Clear related cache
            clearCache(endpoint);
            
            return fetchWithRetry(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                body: JSON.stringify(data)
            }, options.maxRetries || 1); // Less retries for POST
        },
        
        // PUT without caching
        async put(endpoint, data, options = {}) {
            const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
            
            // Clear related cache
            clearCache(endpoint);
            
            return fetchWithRetry(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                body: JSON.stringify(data)
            }, options.maxRetries || 1);
        },
        
        // DELETE without caching
        async delete(endpoint, options = {}) {
            const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
            
            // Clear related cache
            clearCache(endpoint);
            
            return fetchWithRetry(url, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            }, options.maxRetries || 1);
        },
        
        // Clear cache manually
        clearCache: clearCache,
        
        // Debounce helper
        debounce: debounce,
        
        // Queue manager
        createQueue: (concurrency) => new RequestQueue(concurrency)
    };
    
    // ============================================================
    // Export to window
    // ============================================================
    window.OptimizedAPI = OptimizedAPI;
    window.fetchWithRetry = fetchWithRetry;
    window.debounce = debounce;
    
    console.log('✅ Requests Performance module loaded');
    
})();
