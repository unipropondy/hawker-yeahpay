// backend/routes/salesRoutes.js
const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../config/db');
const {
    createSale,
    getSales,
    getSalesSummary,
    getSalesByCategory,
    getCategoryItems,
    voidSale 
} = require('../controllers/salesController');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// MIDDLEWARE - Get effective OUTLET ID
// ============================================
const getEffectiveOutletId = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        let outletId = null;
        
        console.log(`🔍 Getting outlet for ${userRole} ${userId}`);
        
        // For staff: get their outlet ID from Users table
        if (userRole === 'staff') {
            const pool = getPool();
            const result = await pool.request()
                .input('userId', sql.Int, userId)
                .query('SELECT OutletId FROM Users WHERE Id = @userId');
            
            if (result.recordset.length > 0 && result.recordset[0].OutletId) {
                outletId = result.recordset[0].OutletId;
                console.log(`👤 Staff ${userId} using outlet ${outletId}`);
            } else {
                return res.status(403).json({ error: 'Staff not assigned to any outlet' });
            }
        }
        
        // For owner: get outlet from header or query
        else if (userRole === 'owner') {
            outletId = req.headers['x-outlet-id'] || req.query.outletId;
            
            if (!outletId) {
                return res.status(400).json({ 
                    error: 'OUTLET_REQUIRED',
                    message: 'Please select an outlet'
                });
            }
            
            // Verify outlet belongs to this owner
            const pool = getPool();
            const result = await pool.request()
                .input('outletId', sql.Int, outletId)
                .input('ownerId', sql.Int, userId)
                .query('SELECT Id FROM Outlets WHERE Id = @outletId AND OwnerId = @ownerId');
            
            if (result.recordset.length === 0) {
                return res.status(403).json({ error: 'Access denied to this outlet' });
            }
            
            outletId = parseInt(outletId);
            console.log(`👑 Owner ${userId} using outlet ${outletId}`);
        }
        
        // Admin - can access any outlet (must specify)
        else if (userRole === 'admin') {
            outletId = req.query.outletId;
            if (!outletId) {
                return res.status(400).json({ error: 'Outlet ID required for admin' });
            }
            outletId = parseInt(outletId);
        }
        
        // ✅ Set outletId in request
        req.outletId = outletId;
        
        // Also set in query and body for controllers
        req.query.outletId = outletId;
        if (req.body) {
            req.body.outletId = outletId;
        }
        
        console.log(`✅ Outlet ID set: ${req.outletId}`);
        next();
        
    } catch (err) {
        console.error('❌ Error in getEffectiveOutletId:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================
// APPLY MIDDLEWARE TO ALL ROUTES
// ============================================
router.use(authenticateToken);      // First authenticate
router.use(getEffectiveOutletId);   // Then get effective outlet ID

// ============================================
// SALES ROUTES (unchanged - controllers handle logic)
// ============================================

// POST /api/sales - Create new sale
router.post('/', createSale);

// GET /api/sales?filter=today - Get sales
router.get('/', getSales);

// GET /api/sales/summary?filter=today - Get sales summary
router.get('/summary', getSalesSummary);

// GET /api/sales/summarys - Optional duplicate
router.get('/summarys', getSalesSummary);

// GET /api/sales/by-category?filter=today - Category analysis
router.get('/by-category', getSalesByCategory);

// GET /api/sales/category/:category?filter=today - Items in category
router.get('/category/:category', getCategoryItems);
router.post('/void', voidSale);
module.exports = router;