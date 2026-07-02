const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const dayEndController = require('../controllers/dayEndController');

// ✅ Middleware to get outlet ID
const getEffectiveOutletId = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        
        if (userRole === 'staff') {
            const { getPool, sql } = require('../config/db');
            const pool = getPool();
            const result = await pool.request()
                .input('userId', sql.Int, userId)
                .query('SELECT OutletId FROM Users WHERE Id = @userId');
            
            if (result.recordset.length > 0 && result.recordset[0].OutletId) {
                req.outletId = result.recordset[0].OutletId;
            } else {
                return res.status(403).json({ error: 'Staff not assigned to any outlet' });
            }
        } else if (userRole === 'owner') {
            req.outletId = req.headers['x-outlet-id'] || req.query.outletId;
            if (!req.outletId) {
                return res.status(400).json({ error: 'Outlet ID required' });
            }
        } else if (userRole === 'admin') {
            req.outletId = req.query.outletId;
            if (!req.outletId) {
                return res.status(400).json({ error: 'Outlet ID required for admin' });
            }
        }
        
        next();
    } catch (err) {
        console.error('❌ Outlet middleware error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ✅ Apply middleware
router.use(authenticateToken);
router.use(getEffectiveOutletId);

// ✅ Routes
router.get('/status', dayEndController.getDayEndStatus);
router.post('/end', dayEndController.performDayEnd);
router.get('/history', dayEndController.getDayEndHistory);
router.post('/start-new-day', dayEndController.startNewDay);

module.exports = router;