// ================================================================
// 🔄 KEEP-ALIVE SERVICE - يمنع السيرفر من الدخول في Sleep Mode
// ================================================================
// هذا الملف يضمن أن السيرفر يظل نشطاً طوال الوقت

const http = require('http');
const https = require('https');

class KeepAliveService {
  constructor(port = 5000) {
    this.port = port;
    this.interval = null;
    this.isRunning = false;
    this.stats = {
      pingsCount: 0,
      lastPing: null,
      errors: 0,
      startTime: new Date()
    };
  }

  // بدء خدمة Keep-Alive
  start() {
    if (this.isRunning) {
      console.log('⚠️ Keep-Alive Service is already running');
      return;
    }

    console.log('🔄 Starting Keep-Alive Service...');
    this.isRunning = true;

    // إرسال Ping كل 30 ثانية للسيرفر نفسه
    this.interval = setInterval(() => {
      this.ping();
    }, 30000); // 30 seconds

    // Ping فوري عند البدء
    this.ping();

    console.log('✅ Keep-Alive Service started - Ping every 30 seconds');
    console.log(`📍 Monitoring: http://localhost:${this.port}/api/health`);
  }

  // إيقاف الخدمة
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ Keep-Alive Service is not running');
      return;
    }

    clearInterval(this.interval);
    this.isRunning = false;
    console.log('🛑 Keep-Alive Service stopped');
    this.printStats();
  }

  // إرسال Ping للسيرفر
  ping() {
    const startTime = Date.now();
    
    const options = {
      hostname: 'localhost',
      port: this.port,
      path: '/api/health',
      method: 'GET',
      timeout: 5000 // 5 seconds timeout
    };

    const req = http.request(options, (res) => {
      const duration = Date.now() - startTime;
      
      if (res.statusCode === 200) {
        this.stats.pingsCount++;
        this.stats.lastPing = new Date();
        console.log(`✅ Keep-Alive Ping #${this.stats.pingsCount} - ${duration}ms - Server is alive`);
      } else {
        this.stats.errors++;
        console.warn(`⚠️ Keep-Alive Ping failed - Status: ${res.statusCode}`);
      }
    });

    req.on('error', (err) => {
      this.stats.errors++;
      console.error(`❌ Keep-Alive Ping error: ${err.message}`);
    });

    req.on('timeout', () => {
      this.stats.errors++;
      req.destroy();
      console.error('❌ Keep-Alive Ping timeout');
    });

    req.end();
  }

  // طباعة الإحصائيات
  printStats() {
    const uptime = Math.floor((Date.now() - this.stats.startTime.getTime()) / 1000);
    const uptimeMinutes = Math.floor(uptime / 60);
    const uptimeHours = Math.floor(uptimeMinutes / 60);
    
    console.log('\n📊 Keep-Alive Service Statistics:');
    console.log(`  ⏱️  Uptime: ${uptimeHours}h ${uptimeMinutes % 60}m ${uptime % 60}s`);
    console.log(`  ✅ Successful Pings: ${this.stats.pingsCount}`);
    console.log(`  ❌ Failed Pings: ${this.stats.errors}`);
    console.log(`  🕐 Last Ping: ${this.stats.lastPing ? this.stats.lastPing.toLocaleString('ar-EG') : 'N/A'}`);
    console.log('');
  }

  // الحصول على الإحصائيات
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      uptime: Date.now() - this.stats.startTime.getTime()
    };
  }
}

// ================================================================
// 🌐 EXTERNAL KEEP-ALIVE (للاستخدام من السيرفرات الأخرى)
// ================================================================
class ExternalKeepAlive {
  constructor(urls = []) {
    this.urls = urls; // قائمة URLs للـ Ping
    this.interval = null;
    this.isRunning = false;
  }

  start() {
    if (this.isRunning || this.urls.length === 0) return;

    this.isRunning = true;
    this.interval = setInterval(() => {
      this.pingAll();
    }, 60000); // كل دقيقة

    console.log('🌐 External Keep-Alive started');
  }

  stop() {
    if (!this.isRunning) return;
    clearInterval(this.interval);
    this.isRunning = false;
    console.log('🌐 External Keep-Alive stopped');
  }

  pingAll() {
    this.urls.forEach(url => {
      this.pingUrl(url);
    });
  }

  pingUrl(url) {
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, (res) => {
      console.log(`✅ External Ping: ${url} - Status: ${res.statusCode}`);
    }).on('error', (err) => {
      console.error(`❌ External Ping failed: ${url} - ${err.message}`);
    });
  }
}

module.exports = {
  KeepAliveService,
  ExternalKeepAlive
};
