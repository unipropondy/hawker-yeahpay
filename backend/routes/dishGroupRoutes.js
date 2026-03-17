// backend/routes/dishGroupRoutes.js
const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../config/db');
const {
    getAllGroups,
    getGroupById,
    createGroup,
    updateGroup,
    deleteGroup,
    updateGroupOrder
} = require('../controllers/dishGroupController');

// ✅ MIDDLEWARE: Get effective OUTLET ID
const getEffectiveOutletId = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        
        // For staff: get their outlet ID from Users table
        if (userRole === 'staff') {
            const pool = getPool();
            const result = await pool.request()
                .input('userId', sql.Int, userId)
                .query('SELECT OutletId FROM Users WHERE Id = @userId');
            
            if (result.recordset.length > 0 && result.recordset[0].OutletId) {
                req.outletId = result.recordset[0].OutletId;
                console.log(`👤 Staff ${userId} using outlet ${req.outletId}`);
            } else {
                return res.status(403).json({ error: 'Staff not assigned to any outlet' });
            }
        }
        
        // For owner: get outlet from header or query
        else if (userRole === 'owner') {
            const outletId = req.headers['x-outlet-id'] || req.query.outletId;
            
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
            
            req.outletId = parseInt(outletId);
            console.log(`👑 Owner ${userId} using outlet ${req.outletId}`);
        }
        
        // Admin - can access any outlet (must specify)
        else if (userRole === 'admin') {
            const outletId = req.query.outletId;
            if (outletId) {
                req.outletId = parseInt(outletId);
            }
        }
        
        // Attach outletId to request for controllers to use
        if (!req.outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        next();
        
    } catch (err) {
        console.error('❌ Error in getEffectiveOutletId:', err);
        res.status(500).json({ error: err.message });
    }
};

// Apply middleware to all routes
router.use(getEffectiveOutletId);

// GET all dish groups
router.get('/', getAllGroups);

// GET single dish group by ID
router.get('/:id', getGroupById);

// CREATE new dish group
router.post('/', createGroup);

// UPDATE dish group
router.put('/:id', updateGroup);

// DELETE dish group
router.delete('/:id', deleteGroup);

// Update group order (for drag & drop)
router.post('/update-order', updateGroupOrder);

module.exports = router;