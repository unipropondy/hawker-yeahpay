const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// LOG DRAWER OPEN
// ============================================
router.post('/open', authenticateToken, async (req, res) => {
    try {
        const { saleId, totalAmount, paymentMethod, notes } = req.body;
        const outletId = req.outletId;
        
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }

        const pool = getPool();
        
        // Close any existing open drawer
        await pool.request()
            .input('outletId', sql.Int, outletId)
            .query(`
                UPDATE CashDrawerLogs 
                SET CloseTime = GETDATE(),
                    Status = 'AUTO_CLOSED',
                    DurationSeconds = DATEDIFF(second, OpenTime, GETDATE())
                WHERE OutletId = @outletId AND Status = 'OPEN'
            `);

        // Log new open
        const result = await pool.request()
            .input('outletId', sql.Int, outletId)
            .input('userId', sql.Int, req.user.id)
            .input('userName', sql.NVarChar, req.user.username)
            .input('actionType', sql.NVarChar, 'OPEN')
            .input('openTime', sql.DateTime, new Date())
            .input('saleId', sql.Int, saleId || null)
            .input('totalAmount', sql.Decimal(10,2), totalAmount || null)
            .input('paymentMethod', sql.NVarChar, paymentMethod || null)
            .input('notes', sql.NVarChar, notes || null)
            .query(`
                INSERT INTO CashDrawerLogs (
                    OutletId, UserId, UserName, ActionType, 
                    OpenTime, SaleId, TotalAmount, PaymentMethod, 
                    Status, Notes
                )
                OUTPUT INSERTED.*
                VALUES (
                    @outletId, @userId, @userName, @actionType,
                    @openTime, @saleId, @totalAmount, @paymentMethod,
                    'OPEN', @notes
                )
            `);

        res.json({
            success: true,
            log: result.recordset[0]
        });

    } catch (err) {
        console.error('❌ Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// LOG DRAWER CLOSE
// ============================================
router.post('/close', authenticateToken, async (req, res) => {
    try {
        const { logId, notes } = req.body;
        const outletId = req.outletId;

        const pool = getPool();

        const result = await pool.request()
            .input('outletId', sql.Int, outletId)
            .input('logId', sql.Int, logId || null)
            .input('closeTime', sql.DateTime, new Date())
            .input('notes', sql.NVarChar, notes || null)
            .query(`
                UPDATE CashDrawerLogs 
                SET CloseTime = @closeTime,
                    Status = 'CLOSED',
                    DurationSeconds = DATEDIFF(second, OpenTime, @closeTime)
                WHERE OutletId = @outletId AND Status = 'OPEN'
                
                SELECT * FROM CashDrawerLogs 
                WHERE Id = SCOPE_IDENTITY()
            `);

        res.json({
            success: true,
            log: result.recordset[0]
        });

    } catch (err) {
        console.error('❌ Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// CHECK OPEN DRAWERS
// ============================================
router.get('/check-open', authenticateToken, async (req, res) => {
    try {
        const outletId = req.outletId;
        const pool = getPool();

        const result = await pool.request()
            .input('outletId', sql.Int, outletId)
            .query(`
                SELECT 
                    Id, UserName, OpenTime,
                    DATEDIFF(second, OpenTime, GETDATE()) as CurrentDuration,
                    SaleId, TotalAmount, PaymentMethod
                FROM CashDrawerLogs
                WHERE OutletId = @outletId AND Status = 'OPEN'
            `);

        res.json({
            success: true,
            openDrawers: result.recordset
        });

    } catch (err) {
        console.error('❌ Error:', err);
        res.status(500).json({ error: err.message });
    }
});
// GET /history endpoint
router.get('/history', authenticateToken, async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        const outletId = req.outletId;

        const pool = getPool();
        const result = await pool.request()
            .input('outletId', sql.Int, outletId)
            .input('limit', sql.Int, parseInt(limit))
            .query(`
                SELECT TOP (@limit) *
                FROM CashDrawerLogs
                WHERE OutletId = @outletId
                ORDER BY Id DESC
            `);

        res.json({
            success: true,
            logs: result.recordset
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
module.exports = router;