const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// GET YeahPay settings for an outlet
// GET YeahPay settings for an outlet
router.get('/yeahpay-settings/:outletId', authenticateToken, async (req, res) => {
    try {
        const { outletId } = req.params;
        const pool = getPool();
        
        const result = await pool.request()
            .input('outletId', sql.Int, outletId)
            .query(`
                SELECT 
                    DeviceSN as deviceSn,
                    DeviceSalt as salt,
                    CAST(CASE WHEN YeahPayEnabled = 1 THEN 1 ELSE 0 END AS BIT) as enabled
                FROM Outlets 
                WHERE Id = @outletId
            `);
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Outlet not found' });
        }
        
        const data = result.recordset[0];
        console.log('📤 Database data:', data);
        
        // ✅ Force boolean conversion
        const responseData = {
            deviceSn: data.deviceSn || '',
            salt: data.salt || '',
            enabled: data.enabled === true || data.enabled === 1 || data.enabled === '1'
        };
        
        console.log('📤 Sending response:', responseData);
        
        res.json(responseData);
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: err.message });
    }
});
router.get('/my-yeahpay-settings', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        
        const pool = getPool();
        let outletId = null;
        
        // Get outlet ID based on user role
        if (userRole === 'staff') {
            const result = await pool.request()
                .input('userId', sql.Int, userId)
                .query('SELECT OutletId FROM Users WHERE Id = @userId');
            
            if (result.recordset.length > 0) {
                outletId = result.recordset[0].OutletId;
            }
        } else if (userRole === 'owner') {
            // Owner must specify which outlet
            outletId = req.query.outletId || req.headers['x-outlet-id'];
            if (!outletId) {
                return res.status(400).json({ error: 'Outlet ID required for owner' });
            }
        }
        
        if (!outletId) {
            return res.status(404).json({ error: 'Outlet not found' });
        }
        
        // Get YeahPay settings
        const result = await pool.request()
            .input('outletId', sql.Int, outletId)
            .query(`
                SELECT 
                    DeviceSN as deviceSn,
                    DeviceSalt as salt,
                    YeahPayEnabled as enabled
                FROM Outlets 
                WHERE Id = @outletId
            `);
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Outlet not found' });
        }
        
        const settings = result.recordset[0];
        
        res.json({
            success: true,
            deviceSn: settings.deviceSn,
            salt: settings.salt,
            enabled: settings.enabled === 1
        });
        
    } catch (err) {
        console.error('Error getting YeahPay settings:', err);
        res.status(500).json({ error: err.message });
    }
});
module.exports = router;