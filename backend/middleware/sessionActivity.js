// backend/middleware/sessionActivity.js

const { getPool, sql } = require('../config/db');

const updateSessionActivity = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (token) {
            const pool = getPool();
            await pool.request()
                .input('sessionToken', sql.NVarChar, token)
                .query(`
                    UPDATE UserSessions 
                    SET LastActivity = GETDATE() 
                    WHERE SessionToken = @sessionToken
                `);
        }
    } catch (err) {
        // Don't block request if update fails
        console.log('⚠️ Session activity update failed:', err.message);
    }
    
    next();
};

module.exports = updateSessionActivity;