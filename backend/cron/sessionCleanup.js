// backend/cron/sessionCleanup.js

const { getPool, sql } = require('../config/db');

// Run every 10 seconds to clean inactive sessions
const startSessionCleanup = () => {
    setInterval(async () => {
        try {
            const pool = getPool();
            
            // Deactivate sessions with no activity for 10 seconds
            const result = await pool.request().query(`
                UPDATE UserSessions 
                SET IsActive = 0 
                WHERE IsActive = 1 
                AND LastActivity < DATEADD(second, -10, GETDATE())
            `);
            
            if (result.rowsAffected[0] > 0) {
                console.log(`🧹 Cleared ${result.rowsAffected[0]} inactive sessions (10 sec timeout)`);
            }
            
        } catch (err) {
            console.log('⚠️ Session cleanup error:', err.message);
        }
    }, 10000); // Run every 10 seconds
};

module.exports = startSessionCleanup;