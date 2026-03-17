// backend/routes/dishItemRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { getPool, sql } = require('../config/db');
const {
    getAllItems,
    getItemsByCategory,
    createItem,
    updateItem,
    deleteItem
} = require('../controllers/dishItemController');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// MIDDLEWARE - Get effective OUTLET ID
// ============================================
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
                console.log(`👤 Staff ${userId} using outlet ${req.outletId} for dish items`);
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
            console.log(`👑 Owner ${userId} using outlet ${req.outletId} for dish items`);
        }
        
        // Admin - can access any outlet (must specify)
        else if (userRole === 'admin') {
            const outletId = req.query.outletId;
            if (outletId) {
                req.outletId = parseInt(outletId);
            } else {
                return res.status(400).json({ error: 'Outlet ID required for admin' });
            }
        }
        
        if (!req.outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        next();
        
    } catch (err) {
        console.error('❌ Error in getEffectiveOutletId:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================
// MULTER CONFIGURATION (unchanged)
// ============================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    }
});

// ============================================
// APPLY MIDDLEWARE TO ALL ROUTES
// ============================================
router.use(authenticateToken);  // First authenticate
router.use(getEffectiveOutletId); // Then get effective outlet ID

// ============================================
// ROUTES (unchanged - controllers handle the logic)
// ============================================

// GET all dish items
router.get('/', getAllItems);

// GET items by category
router.get('/category/:categoryId', getItemsByCategory);

// CREATE new dish item
router.post('/', upload.single('image'), createItem);

// UPDATE dish item
router.put('/:id', upload.single('image'), updateItem);

// DELETE dish item
router.delete('/:id', deleteItem);

module.exports = router;