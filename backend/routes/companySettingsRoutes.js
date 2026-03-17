// backend/routes/companySettingsRoutes.js
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
        
        else if (userRole === 'owner') {
            outletId = req.headers['x-outlet-id'] || req.query.outletId;
            
            if (!outletId) {
                return res.status(400).json({ 
                    error: 'OUTLET_REQUIRED',
                    message: 'Please select an outlet'
                });
            }
            
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
        
        else if (userRole === 'admin') {
            outletId = req.query.outletId;
            if (!outletId) {
                return res.status(400).json({ error: 'Outlet ID required for admin' });
            }
            outletId = parseInt(outletId);
        }
        
        req.outletId = outletId;
        req.query.outletId = outletId;
        if (req.body) req.body.outletId = outletId;
        
        next();
        
    } catch (err) {
        console.error('❌ Error in getEffectiveOutletId:', err);
        res.status(500).json({ error: err.message });
    }
};

// Apply middleware
router.use(authenticateToken);
router.use(getEffectiveOutletId);

// ============================================
// GET company settings (UPDATED)
// ============================================
router.get('/:targetId', authenticateToken, async (req, res) => {
    try {
        const outletId = req.outletId;
        
        const pool = getPool();
        
        const result = await pool.request()
            .input('outletId', sql.Int, outletId)
            .query(`
                SELECT 
                    o.OutletName as ShopName,
                    ISNULL(c.CompanyName, '') as CompanyName,
                    ISNULL(c.Address, '') as Address,
                    ISNULL(c.GSTNo, '') as GSTNo,
                    ISNULL(c.GSTPercentage, 9) as GSTPercentage,
                    ISNULL(c.Phone, '') as Phone,
                    ISNULL(c.Email, '') as Email,
                    ISNULL(c.CashierName, '') as CashierName,
                    ISNULL(c.Currency, 'SGD') as Currency,
                    ISNULL(c.CurrencySymbol, '$') as CurrencySymbol
                FROM Outlets o
                LEFT JOIN CompanySettings c ON o.Id = c.OutletId
                WHERE o.Id = @outletId
            `);
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Outlet not found' });
        }
        
        const row = result.recordset[0];
        
        const settings = {
            CompanyName: row.CompanyName,
            Address: row.Address,
            GSTNo: row.GSTNo,
            GSTPercentage: row.GSTPercentage,
            Phone: row.Phone,
            Email: row.Email,
            CashierName: row.CashierName,
            Currency: row.Currency,
            CurrencySymbol: row.CurrencySymbol
        };
        
        console.log(`✅ ${req.user.role} ${req.user.id} fetched settings for outlet ${outletId}`);
        res.json({
            success: true,
            settings,
            shopName: row.ShopName
        });
        
    } catch (err) {
        console.error('❌ Error getting settings:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// POST (create/update) company settings (UPDATED)
// ============================================
router.post('/:targetId', authenticateToken, async (req, res) => {
    try {
        const { 
            CompanyName, 
            Address, 
            GSTNo, 
            GSTPercentage, 
            Phone, 
            Email, 
            CashierName,
            Currency,
            CurrencySymbol
        } = req.body;
        
        const outletId = req.outletId;
        
        const pool = getPool();
        
        // ✅ Save using OutletId only (UserId can be NULL)
        await pool.request()
            .input('outletId', sql.Int, outletId)
            .input('companyName', sql.NVarChar, CompanyName || '')
            .input('address', sql.NVarChar, Address || '')
            .input('gstNo', sql.NVarChar, GSTNo || '')
            .input('gstPercentage', sql.Decimal(5,2), GSTPercentage || 9)
            .input('phone', sql.NVarChar, Phone || '')
            .input('email', sql.NVarChar, Email || '')
            .input('cashierName', sql.NVarChar, CashierName || '')
            .input('currency', sql.NVarChar, Currency || 'SGD')
            .input('currencySymbol', sql.NVarChar, CurrencySymbol || '$')
            .query(`
                MERGE INTO CompanySettings AS target
                USING (SELECT @outletId AS OutletId) AS source
                ON target.OutletId = source.OutletId
                WHEN MATCHED THEN
                    UPDATE SET 
                        CompanyName = @companyName,
                        Address = @address,
                        GSTNo = @gstNo,
                        GSTPercentage = @gstPercentage,
                        Phone = @phone,
                        Email = @email,
                        CashierName = @cashierName,
                        Currency = @currency,
                        CurrencySymbol = @currencySymbol
                WHEN NOT MATCHED THEN
                    INSERT (OutletId, CompanyName, Address, GSTNo, GSTPercentage, Phone, Email, CashierName, Currency, CurrencySymbol)
                    VALUES (@outletId, @companyName, @address, @gstNo, @gstPercentage, @phone, @email, @cashierName, @currency, @currencySymbol);
            `);
        
        console.log(`✅ ${req.user.role} ${req.user.id} saved settings for outlet ${outletId}`);
        res.json({ 
            success: true, 
            message: 'Company settings saved successfully' 
        });
        
    } catch (err) {
        console.error('❌ Error saving settings:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;