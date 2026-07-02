require('dotenv').config();   // MUST be at top
// backend/server.js
const multer = require('multer');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const path = require('path');
const slowDown = require('express-slow-down');  // ✅ ADDED
const rateLimit = require('express-rate-limit');
const { connectDB, getPool, sql } = require('./config/db'); // ✅ Add getPool
const { authenticateToken } = require('./middleware/auth');
const Queue = require('bull');
const salesQueue = new Queue('sales processing');
const startLicenseUpdater = require('./cron/licenseUpdater');
// Import routes
const startSessionCleanup = require('./cron/sessionCleanup');
const updateSessionActivity = require('./middleware/sessionActivity');
const authRoutes = require('./routes/authRoutes');
const dishGroupRoutes = require('./routes/dishGroupRoutes');
const dishItemRoutes = require('./routes/dishItemRoutes');
const salesRoutes = require('./routes/salesRoutes');
const adminRoutes = require('./routes/adminRoutes');
const companySettingsRoutes = require('./routes/companySettingsRoutes');  
const userRoutes = require('./routes/userRoutes');
const paynowRoutes = require('./routes/paynowRoutes');
const ownerRoutes = require('./routes/ownerRoutes');
const cashDrawerRoutes = require('./routes/cashDrawerRoutes');
const outletRoutes = require('./routes/outletRoutes');
const yeahpayRoutes = require('./routes/yeahpayRoutes');
const dayEndRoutes = require('./routes/dayEndRoutes');
const emailRoutes = require('./routes/emailRoutes');
const app = express();
const PORT = process.env.PORT || 5000;
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
app.set('trust proxy', 1);
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: { error: 'Too many requests, please try again later.' },
    skipSuccessfulRequests: true,
    validate: false  // ✅ Suppress the warning
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    skipSuccessfulRequests: true,
    message: { error: 'Too many login attempts' },
    validate: false  // ✅ Suppress the warning
});

// ✅ FIXED SLOW DOWN (YOUR MAIN CHANGE)
const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000,
    delayAfter: 50,
    delayMs: () => 500,  // ✅ FIXED - warning gone!
    validate: { delayMs: false }  // ✅ Silence warning
});
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only images are allowed'));
  }
});

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
// ============================================
// COMPLETE METRICS ENDPOINT
// ============================================

// Track requests
let activeRequests = 0;
const requestLog = [];
const statusCodes = {};

// Request tracking middleware
app.use((req, res, next) => {
    // Skip metrics endpoint to avoid loop
    if (req.url === '/metrics') {
        return next();
    }
    
    activeRequests++;
    const start = Date.now();
    
    res.on('finish', () => {
        activeRequests--;
        const duration = Date.now() - start;
        
        requestLog.push({
            time: new Date().toISOString(),
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration
        });
        
        statusCodes[res.statusCode] = (statusCodes[res.statusCode] || 0) + 1;
        
        // Keep last 100 requests
        if (requestLog.length > 100) requestLog.shift();
    });
    
    next();
});

// ✅ METRICS ENDPOINT
app.get('/metrics', (req, res) => {
    const memory = process.memoryUsage();
    
    // Calculate averages
    const avgResponse = requestLog.length > 0 
        ? Math.round(requestLog.reduce((sum, r) => sum + r.duration, 0) / requestLog.length)
        : 0;
    
    // Percentiles
    const times = requestLog.map(r => r.duration).sort((a,b) => a-b);
    const p95 = times.length > 0 ? times[Math.floor(times.length * 0.95)] : 0;
    const p99 = times.length > 0 ? times[Math.floor(times.length * 0.99)] : 0;
    
    // Get pool metrics
    let poolMetrics = { total: 0, active: 0 };
    try {
        const { getPoolMetrics } = require('./config/db');
        if (getPoolMetrics) {
            poolMetrics = getPoolMetrics() || poolMetrics;
        }
    } catch (e) {
        console.log('DB metrics not available');
    }
    
    res.json({
        server: {
            uptime: process.uptime(),
            memory: {
                rss: Math.round(memory.rss / 1024 / 1024) + 'MB',
                heapTotal: Math.round(memory.heapTotal / 1024 / 1024) + 'MB',
                heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + 'MB'
            },
            activeRequests,
            totalRequests: requestLog.length
        },
        database: {
            total: poolMetrics.total || 0,
            active: poolMetrics.active || 0,
            idle: (poolMetrics.total || 0) - (poolMetrics.active || 0)
        },
        performance: {
            averageResponseTime: avgResponse,
            p95: p95,
            p99: p99,
            requestsPerSecond: requestLog.length > 0 
                ? (requestLog.length / (process.uptime() / 60)).toFixed(2)
                : '0.00'
        },
        statusCodes,
        recentRequests: requestLog.slice(-10)
    });
});
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Log all requests
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});
const responseTime = require('response-time');
const os = require('os');


app.get('/monitor', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'monitor.html'));
});
// ✅ Add status endpoint for uptime monitoring
app.get('/status', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV
    });
});
// ✅ PUBLIC ROUTES - NO AUTH REQUIRED
app.use('/api/auth', loginLimiter, authRoutes);

// ✅ PROTECTED ROUTES - AUTH REQUIRED
app.use('/api/admin', authenticateToken, apiLimiter, adminRoutes);
app.use('/api/license', authenticateToken, apiLimiter, adminRoutes);
app.use('/api/dishgroups', authenticateToken, apiLimiter, dishGroupRoutes);
app.use('/api/dishitems', authenticateToken, apiLimiter, dishItemRoutes);
app.use('/api/sales', authenticateToken, speedLimiter, salesRoutes);
app.use('/api/company-settings', authenticateToken, apiLimiter, companySettingsRoutes); 
app.use('/api/user', authenticateToken, apiLimiter, paynowRoutes);
app.use('/api/owner', authenticateToken, ownerRoutes);
app.use('/api/cash-drawer', cashDrawerRoutes);
app.use('/api', authenticateToken, updateSessionActivity);
app.use('/api/outlet', authenticateToken, outletRoutes);
app.use('/api/yeahpay', authenticateToken, yeahpayRoutes);
app.use('/api/dayend', authenticateToken, dayEndRoutes);
app.use('/api/email', authenticateToken, emailRoutes);
// Add near the top after middleware
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        time: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// Also add root route for testing
app.get('/', (req, res) => {
    res.json({ 
        message: 'POS Backend API',
        version: '1.0.0',
        status: 'running'
    });
});
// Get current Singapore time
app.get('/api/singapore-time', (req, res) => {
    const { formatSingaporeTime, getCurrentSingaporeTime } = require('./utils/timezone');
    const now = getCurrentSingaporeTime();
    res.json({
        success: true,
        utc: new Date().toISOString(),
        singapore: now.format('YYYY-MM-DD HH:mm:ss'),
        singaporeDate: now.format('YYYY-MM-DD'),
        singaporeTime: now.format('HH:mm:ss'),
        timezone: 'Asia/Singapore',
        offset: '+08:00'
    });
});
const getOwnerId = async (userId) => {
    const pool = getPool();
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
            SELECT 
                CASE 
                    WHEN Role = 'staff' THEN OwnerId
                    ELSE Id
                END as OwnerId
            FROM Users 
            WHERE Id = @userId
        `);
    
    return result.recordset[0]?.OwnerId || userId;
};
// ✅ FIXED: Use getPool() instead of connectDB()
app.get('/api/user/upi/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        
        // ✅ ALWAYS get owner ID
        const ownerId = await getOwnerId(userId);
        console.log(`📱 UPI for user ${userId} (owner: ${ownerId})`);
        
        const pool = getPool();
        const result = await pool.request()
            .input('userId', sql.Int, ownerId)
            .query('SELECT upi_id FROM users WHERE id = @userId');
        
        const upiId = result.recordset[0]?.upi_id || null;
        console.log(`✅ UPI ID: ${upiId ? 'Has value' : 'No UPI'}`);
        
        res.json({ upiId });
    } catch (error) {
        console.error('Error fetching UPI ID:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get user payment modes
app.get('/api/user/payment-modes/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        
        // ✅ ADD THIS: Get owner ID for staff
        const ownerId = await getOwnerId(userId);
        console.log(`📡 Fetching payment modes for user ${userId} (owner: ${ownerId})`);
        
        const pool = getPool();
        const result = await pool.request()
            .input('userId', ownerId)  // ✅ Use ownerId, not userId!
            .query('SELECT payment_modes FROM user_preferences WHERE user_id = @userId');
        
        const modes = result.recordset[0]?.payment_modes 
            ? JSON.parse(result.recordset[0].payment_modes) 
            : [];
        
        console.log(`✅ Payment modes for owner ${ownerId}:`, modes);
        res.json({ paymentModes: modes });
    } catch (error) {
        console.error('Error fetching payment modes:', error);
        res.status(500).json({ error: error.message });
    }
});

// UPDATE user payment modes
app.put('/api/user/payment-modes', authenticateToken, async (req, res) => {
    try {
        const { userId, paymentModes } = req.body;
        
        // ✅ ADD THIS: Get owner ID for staff
        const ownerId = await getOwnerId(userId);
        console.log(`💾 Saving payment modes for user ${userId} (owner: ${ownerId}):`, paymentModes);
        
        const pool = getPool();
        
        // ✅ Check if OWNER already has payment modes
        const exists = await pool.request()
            .input('userId', ownerId)  // ✅ Use ownerId!
            .query('SELECT id FROM user_preferences WHERE user_id = @userId');
        
        const modesJson = JSON.stringify(paymentModes);
        
        if (exists.recordset.length > 0) {
            // Update owner's record
            await pool.request()
                .input('userId', ownerId)  // ✅ Use ownerId!
                .input('paymentModes', modesJson)
                .input('updatedAt', new Date())
                .query('UPDATE user_preferences SET payment_modes = @paymentModes, updated_at = @updatedAt WHERE user_id = @userId');
        } else {
            // Create record for owner
            await pool.request()
                .input('userId', ownerId)  // ✅ Use ownerId!
                .input('paymentModes', modesJson)
                .query('INSERT INTO user_preferences (user_id, payment_modes) VALUES (@userId, @paymentModes)');
        }
        
        console.log(`✅ Payment modes saved for owner ${ownerId}`);
        res.json({ success: true, paymentModes });
    } catch (error) {
        console.error('Error updating payment modes:', error);
        res.status(500).json({ error: error.message });
    }
});
// Update UPI ID
app.put('/api/user/update-upi', authenticateToken, async (req, res) => {
    try {
        const { userId, upiId } = req.body;
        
        // ✅ ALWAYS update owner's UPI
        const ownerId = await getOwnerId(userId);
        console.log(`💾 Saving UPI for user ${userId} (owner: ${ownerId}):`, upiId);
        
        const pool = getPool();
        await pool.request()
            .input('userId', sql.Int, ownerId)
            .input('upiId', upiId)
            .query('UPDATE users SET upi_id = @upiId WHERE id = @userId');
        
        console.log(`✅ UPI updated for owner ${ownerId}`);
        res.json({ success: true, message: 'UPI ID updated successfully', upiId });
    } catch (error) {
        console.error('Error updating UPI ID:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET PayNow QR code
app.get('/api/user/paynow/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const pool = getPool();  // ✅ CORRECT
        
        const result = await pool.request()
            .input('userId', userId)
            .query('SELECT paynow_qr_url FROM users WHERE id = @userId');
        
        res.json({ qrCodeUrl: result.recordset[0]?.paynow_qr_url || null });
    } catch (error) {
        console.error('Error fetching PayNow QR:', error);
        res.status(500).json({ error: error.message });
    }
});

// UPDATE PayNow QR code
app.put('/api/user/update-paynow', authenticateToken, async (req, res) => {
    try {
        const { userId, qrCodeUrl } = req.body;
        const pool = getPool();  // ✅ CORRECT
        
        await pool.request()
            .input('userId', userId)
            .input('qrCodeUrl', qrCodeUrl)
            .query('UPDATE users SET paynow_qr_url = @qrCodeUrl WHERE id = @userId');
        
        res.json({ success: true, message: 'PayNow QR updated successfully', qrCodeUrl });
    } catch (error) {
        console.error('Error updating PayNow QR:', error);
        res.status(500).json({ error: error.message });
    }
});

// File upload endpoint
app.post('/api/upload', authenticateToken, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // ✅ Get base URL from request
    const protocol = req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;
    
    const imageUrl = `/uploads/${req.file.filename}`;
    const fullImageUrl = `${baseUrl}${imageUrl}`;
    
    console.log('✅ File uploaded:', req.file.filename);
    console.log('📍 Image URL:', fullImageUrl);
    console.log('📍 Environment:', process.env.NODE_ENV || 'development');
    
    res.json({ 
      success: true, 
      imageUrl,           // Relative path
      fullImageUrl,       // Full URL for immediate use
      message: 'File uploaded successfully' 
    });
  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});
app.post('/api/sales', authenticateToken, async (req, res) => {
    // Queue instead of process immediately
    const job = await salesQueue.add({
        userId: req.user.id,
        data: req.body
    });
    res.json({ queued: true, jobId: job.id });
});

// Process 10 at a time
salesQueue.process(10, async (job) => {
    // Process sale here
    await saveSaleToDB(job.data);
});
// Test route
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'Server is working!',
        time: new Date().toISOString(),
        routes: {
            auth: '/api/auth/login',
            dishgroups: '/api/dishgroups',
            dishitems: '/api/dishitems',
            sales: '/api/sales'
        }
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err);
    res.status(500).json({ error: err.message });
});

// ✅ Start server - connectDB() called ONLY ONCE
connectDB().then(() => {
    startLicenseUpdater(); 
    startSessionCleanup(); 
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Server running on port ${PORT}`);
        console.log(`📍 Local: http://localhost:${PORT}`);
        console.log(`📍 Network: http://192.168.0.243:${PORT}`);
    });
}).catch(err => {
    console.error('❌ Failed to start server:', err);
});