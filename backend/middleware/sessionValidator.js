// backend/middleware/sessionValidator.js

const { getPool, sql } = require('../config/db');

const validateSession = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return next();
    }

    const pool = getPool();
    
    // Check if this session is still active in database
    const result = await pool.request()
      .input('token', sql.NVarChar, token)
      .query(`
        SELECT * FROM UserSessions 
        WHERE SessionToken = @token AND IsActive = 1
      `);

    if (result.recordset.length === 0) {
      // Session was terminated (logged in elsewhere)
      return res.status(401).json({ 
        error: 'Session expired',
        code: 'SESSION_TERMINATED',
        message: 'You have been logged out because another device logged into your account.',
        forceLogout: true
      });
    }

    // Update last activity
    await pool.request()
      .input('token', sql.NVarChar, token)
      .query(`
        UPDATE UserSessions 
        SET LastActivity = GETDATE() 
        WHERE SessionToken = @token
      `);

    next();
    
  } catch (err) {
    console.error('❌ Session validation error:', err);
    next();
  }
};

module.exports = { validateSession };