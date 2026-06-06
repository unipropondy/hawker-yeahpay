// backend/config/db.js - PRODUCTION VERSION for 600 Users
require('dotenv').config(); 
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true,
    connectTimeout: 60000,      // ✅ Increased from 30s to 60s
    requestTimeout: 60000,       // ✅ Increased from 30s to 60s
    cancelTimeout: 10000,         // ✅ Increased from 5s to 10s
  },
  pool: {
    max: 100,                    // ✅ Increased from 50 to 100
    min: 20,                     // ✅ Increased from 10 to 20
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 60000
  }
};

let pool = null;
let connecting = false;
let connectionPromise = null;
let monitoringInterval = null; 
// Store config in a variable that monitoring can access
const poolConfig = config.pool;

let poolMetrics = {
  totalConnections: 0,
  activeConnections: 0,
  idleConnections: 0,
  connectionWaitTime: 0,
  lastChecked: null
};

const connectDB = async () => {
    if (pool) {
        // ✅ Check if pool is actually alive
        try {
            await pool.request().query('SELECT 1');
            console.log('✅ Reusing existing connection pool');
            updatePoolMetrics();
            return pool;
        } catch (err) {
            console.log('⚠️ Existing pool is dead, reconnecting...');
            resetPool();
        }
    }
    
    if (connecting && connectionPromise) {
        console.log('⏳ Connection in progress, waiting...');
        return connectionPromise;
    }

    try {
        connecting = true;
        console.log('🔄 Creating new connection pool...');
        console.log('📍 Server:', config.server);
        console.log('📍 Database:', config.database);
        console.log('📍 User:', config.user);
        
        connectionPromise = sql.connect(config);
        pool = await connectionPromise;
        
        console.log('✅ Connection pool created successfully');
        
        // Test connection
        const result = await pool.request().query('SELECT @@VERSION as version');
        console.log('📊 SQL Server Version:', result.recordset[0].version);
        
        startPoolMonitoring();
        
        // ✅ Better error handling with auto-reconnect
        pool.on('error', async (err) => {
            console.error('❌ Pool error:', err.message);
            console.log('🔄 Auto-reconnecting in 5 seconds...');
            resetPool();
            
            // Clear monitoring interval
            if (monitoringInterval) {
                clearInterval(monitoringInterval);
                monitoringInterval = null;
            }
            
            // Auto-reconnect after delay
            setTimeout(async () => {
                try {
                    await connectDB();
                    console.log('✅ Auto-reconnect successful');
                } catch (reconnectErr) {
                    console.error('❌ Auto-reconnect failed:', reconnectErr.message);
                    // Retry again after 30 seconds
                    setTimeout(async () => {
                        try {
                            await connectDB();
                        } catch (finalErr) {
                            console.error('❌ Final reconnect failed. Manual restart needed.');
                        }
                    }, 30000);
                }
            }, 5000);
        });
        
        return pool;
        
    } catch (err) {
        console.error('❌ Connection failed:', err.message);
        console.error('📝 Details:', err);
        resetPool();
        
        // ✅ Schedule retry after 10 seconds
        console.log('🔄 Will retry connection in 10 seconds...');
        setTimeout(async () => {
            try {
                await connectDB();
                console.log('✅ Retry connection successful');
            } catch (retryErr) {
                console.error('❌ Retry failed:', retryErr.message);
            }
        }, 10000);
        
        throw err;
    } finally {
        connecting = false;
    }
};

const resetPool = () => {
    stopPoolMonitoring(); 
    pool = null;
    connecting = false;
    connectionPromise = null;
    console.log('🔄 Pool reset');
};

const updatePoolMetrics = () => {
    if (pool) {
        try {
            poolMetrics = {
                totalConnections: pool.size || 0,
                activeConnections: pool.size ? pool.size - (pool.available || 0) : 0,
                idleConnections: pool.available || 0,
                connectionWaitTime: pool.pending || 0,
                lastChecked: new Date().toISOString()
            };
        } catch (err) {
            console.log('⚠️ Could not update pool metrics:', err.message);
        }
    }
};

 // Store interval reference

const startPoolMonitoring = () => {
    // Stop existing monitoring if any (safety)
    if (monitoringInterval) {
        console.log('🔄 Stopping existing monitoring');
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }
    
    // Start new monitoring
    console.log('📊 Starting pool monitoring (every 60s)');
    monitoringInterval = setInterval(() => {
        if (pool) {
            updatePoolMetrics();
            
            console.log('📊 Pool Status:', {
                total: poolMetrics.totalConnections,
                active: poolMetrics.activeConnections,
                idle: poolMetrics.idleConnections,
                waiting: poolMetrics.connectionWaitTime,
                time: poolMetrics.lastChecked
            });

            if (poolMetrics.connectionWaitTime > 5) {
                console.warn('⚠️ High connection wait time:', poolMetrics.connectionWaitTime);
            }
            
            if (poolMetrics.activeConnections > poolConfig.max * 0.8) {
                console.warn('⚠️ Pool nearly full:', poolMetrics.activeConnections, '/', poolConfig.max);
            }
        }
    }, 60000);
};

// ✅ ADD THIS FUNCTION
const stopPoolMonitoring = () => {
    if (monitoringInterval) {
        console.log('🛑 Stopping pool monitoring');
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }
};
const getPool = () => {
    if (!pool) {
        console.log('⚠️ Database not connected');
        return null;  // ✅ Return null instead of throwing error
    }
    updatePoolMetrics();
    return pool;
};

// ✅ Add helper function
const isDbConnected = () => {
    return pool !== null;
};

const getPoolMetrics = () => {
    if (!pool) return { total: 0, active: 0 };
    return {
        total: pool.size || 0,
        active: pool.size ? pool.size - (pool.available || 0) : 0,
        idle: pool.available || 0,
        waiting: pool.pending || 0
    };
};

const testConnection = async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            if (!pool) return false;
            await pool.request().query('SELECT 1');
            return true;
        } catch (err) {
            console.log(`⚠️ Connection test failed (attempt ${i + 1}/${retries})`);
            if (i === retries - 1) return false;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
    return false;
};

const closePool = async () => {
    if (pool) {
        try {
            await pool.close();
            console.log('✅ Connection pool closed');
            resetPool();
        } catch (err) {
            console.error('❌ Error closing pool:', err);
        }
    }
};

process.on('SIGINT', async () => {
    console.log('📦 Received SIGINT, cleaning up...');
    stopPoolMonitoring(); 
    await closePool();
    process.exit(0);
});

process.on('SIGTERM', async () => {
     console.log('📦 Received SIGTERM, cleaning up...');
    stopPoolMonitoring();
    await closePool();
    process.exit(0);
});

module.exports = { 
    connectDB, 
    getPool, 
    sql, 
    testConnection,
    getPoolMetrics,
    closePool,
    isDbConnected 
};