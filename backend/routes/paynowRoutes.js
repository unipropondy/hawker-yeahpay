// backend/routes/paynowRoutes.js - COMPLETE VERSION with Outlet Middleware
const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../config/db');
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
        
        // ✅ CRITICAL FIX: Set outletId in request object
        req.outletId = outletId;
        
        // Also set in query params for routes that need it
        req.query.outletId = outletId;
        
        console.log(`✅ Outlet ID set: ${req.outletId}`);
        next();
        
    } catch (err) {
        console.error('❌ Error in getEffectiveOutletId:', err);
        res.status(500).json({ error: err.message });
    }
};
// Apply middleware to all routes
router.use(authenticateToken);
router.use(getEffectiveOutletId);

// ============================================
// GET PayNow QR code (UPDATED)
// ============================================
router.get('/paynow/:targetId', authenticateToken, getEffectiveOutletId, async (req, res) => {
  try {
    const outletId = req.outletId; // From middleware
    
    console.log(`📡 Fetching PayNow QR for outlet: ${outletId}`);
    
    const pool = getPool();
    
    const result = await pool.request()
      .input('outletId', sql.Int, outletId)
      .query('SELECT paynow_qr_url FROM users WHERE OutletId = @outletId');
    
    res.json({ qrCodeUrl: result.recordset[0]?.paynow_qr_url || null });
    
  } catch (error) {
    console.error('Error fetching PayNow QR:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// UPDATE PayNow QR code (UPDATED)
// ============================================
router.put('/update-paynow', authenticateToken, getEffectiveOutletId, async (req, res) => {
  try {
    const { qrCodeUrl } = req.body;
    const outletId = req.outletId; // From middleware
    
    console.log(`📡 Updating PayNow QR for outlet: ${outletId}`);
    
    const pool = getPool();
    
    await pool.request()
      .input('outletId', sql.Int, outletId)
      .input('qrCodeUrl', sql.NVarChar, qrCodeUrl)
      .query('UPDATE users SET paynow_qr_url = @qrCodeUrl WHERE OutletId = @outletId');
    
    res.json({ success: true, message: 'PayNow QR updated successfully', qrCodeUrl });
    
  } catch (error) {
    console.error('Error updating PayNow QR:', error);
    res.status(500).json({ error: error.message });
  }
});


// ============================================
// GET UPI ID (UPDATED)
// ============================================
router.get('/upi/:targetId', authenticateToken, getEffectiveOutletId, async (req, res) => {
  try {
    const outletId = req.outletId; // From middleware
    
    console.log(`📡 Fetching UPI ID for outlet: ${outletId}`);
    
    const pool = getPool();
    
    const result = await pool.request()
      .input('outletId', sql.Int, outletId)
      .query('SELECT upi_id FROM users WHERE OutletId = @outletId');
    
    res.json({ upiId: result.recordset[0]?.upi_id || null });
    
  } catch (error) {
    console.error('Error fetching UPI ID:', error);
    res.status(500).json({ error: error.message });
  }
});


// ============================================
// UPDATE UPI ID (UPDATED)
// ============================================
router.put('/update-upi', authenticateToken, getEffectiveOutletId, async (req, res) => {
  try {
    const { upiId } = req.body;
    const outletId = req.outletId; // From middleware
    
    console.log(`📡 Updating UPI ID for outlet: ${outletId}`);
    
    const pool = getPool();
    
    await pool.request()
      .input('outletId', sql.Int, outletId)
      .input('upiId', sql.NVarChar, upiId)
      .query('UPDATE users SET upi_id = @upiId WHERE OutletId = @outletId');
    
    res.json({ success: true, message: 'UPI ID updated successfully', upiId });
    
  } catch (error) {
    console.error('Error updating UPI ID:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GET PAYMENT MODES (UPDATED)
// ============================================

router.get('/payment-modes/:targetId', authenticateToken, getEffectiveOutletId, async (req, res) => {
  try {
    const { targetId } = req.params;
    const { type } = req.query;  // ← Get type from query
    const outletId = req.outletId; // From middleware
    
    console.log(`📡 Fetching payment modes for ${type || 'outlet'}:`, outletId);
    
    const pool = getPool();
    let result;
    
    if (type === 'outlet') {
      // Query by outlet_id
      result = await pool.request()
        .input('outletId', sql.Int, outletId)
        .query('SELECT payment_modes FROM user_preferences WHERE outlet_id = @outletId');
    } else {
      // Default to outlet (since we're using outlet middleware)
      result = await pool.request()
        .input('outletId', sql.Int, outletId)
        .query('SELECT payment_modes FROM user_preferences WHERE outlet_id = @outletId');
    }
    
    const modes = result.recordset[0]?.payment_modes 
      ? JSON.parse(result.recordset[0].payment_modes) 
      : [];
    
    console.log(`✅ Payment modes for outlet ${outletId}:`, modes);
    res.json({ paymentModes: modes });
    
  } catch (error) {
    console.error('Error fetching payment modes:', error);
    res.status(500).json({ error: error.message });
  }
});
// ============================================
// UPDATE PAYMENT MODES (UPDATED)
// ============================================
router.put('/payment-modes', authenticateToken, async (req, res) => {
  try {
    const { paymentModes } = req.body;
    const outletId = req.outletId; // From middleware
    
    console.log(`💾 Saving payment modes for outlet: ${outletId}`);
    
    if (!outletId) {
      return res.status(400).json({ error: 'Outlet ID required' });
    }
    
    const pool = getPool();
    const modesJson = JSON.stringify(paymentModes);
    
    // Check if record exists
    const exists = await pool.request()
      .input('outletId', sql.Int, outletId)
      .query('SELECT id FROM user_preferences WHERE outlet_id = @outletId');
    
    if (exists.recordset.length > 0) {
      // Update existing
      await pool.request()
        .input('outletId', sql.Int, outletId)
        .input('paymentModes', sql.NVarChar, modesJson)
        .input('updatedAt', new Date())
        .query('UPDATE user_preferences SET payment_modes = @paymentModes, updated_at = @updatedAt WHERE outlet_id = @outletId');
    } else {
      // Insert new
      await pool.request()
        .input('outletId', sql.Int, outletId)
        .input('paymentModes', sql.NVarChar, modesJson)
        .query('INSERT INTO user_preferences (outlet_id, payment_modes) VALUES (@outletId, @paymentModes)');
    }
    
    console.log(`✅ Payment modes saved for outlet ${outletId}`);
    res.json({ success: true, paymentModes });
    
  } catch (error) {
    console.error('Error updating payment modes:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;