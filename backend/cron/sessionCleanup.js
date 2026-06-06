const { getPool, sql, isDbConnected } = require('../config/db');

const startSessionCleanup = () => {
    setInterval(async () => {
        try {
            // ✅ Check if DB is connected first
            if (!isDbConnected()) {
                return; // Silent skip
            }
            
            const pool = getPool();
            if (!pool) {
                return;
            }
            
            // ✅ Change to 30 minutes (not 10 seconds!)
            const result = await pool.request().query(`
                UPDATE UserSessions 
                SET IsActive = 0 
                WHERE IsActive = 1 
                AND LastActivity < DATEADD(minute, -30, GETDATE())
            `);
            
            if (result.rowsAffected && result.rowsAffected[0] > 0) {
                console.log(`🧹 Cleared ${result.rowsAffected[0]} inactive sessions`);
            }
            
        } catch (err) {
            // Silent fail for connection issues - don't spam logs
            if (!err.message?.includes('not connected') && !err.message?.includes('timeout')) {
                console.log('⚠️ Session cleanup error:', err.message);
            }
        }
    }, 60000); // ✅ Every 60 seconds, not 10 seconds!
};

module.exports = startSessionCleanup;