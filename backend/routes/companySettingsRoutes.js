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
        
        if (!outletId) {
            console.error(`❌ No outlet ID found for ${userRole} ${userId}`);
            return res.status(400).json({ 
                error: 'OUTLET_NOT_FOUND',
                message: 'Could not determine outlet for this user'
            });
        }
        
        req.outletId = outletId;
        req.query.outletId = outletId;
        if (req.body) req.body.outletId = outletId;
        
        console.log(`✅ Outlet ID set: ${req.outletId}`);
        next();
        
    } catch (err) {
        console.error('❌ Error in getEffectiveOutletId:', err);
        res.status(500).json({ error: err.message });
    }
};

// ✅ Apply middleware to ALL routes (ONCE)
router.use(authenticateToken);
router.use(getEffectiveOutletId);

// ============================================
// GET company settings
// ============================================
router.get('/:targetId', async (req, res) => {
    try {
        const outletId = req.outletId;
        
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        const pool = getPool();
        
        const result = await pool.request()
            .input('outletId', sql.Int, outletId)
            .query(`
                SELECT 
                    o.OutletName as ShopName,
                    c.CompanyName,
                    c.Address,
                    c.GSTNo,
                    c.GSTPercentage,
                    c.Phone,
                    c.Email,
                    c.CashierName,
                    c.Currency,
                    c.CurrencySymbol,
                    c.CompanyLogoUrl,
                    c.HalalLogoUrl,
                    ISNULL(c.ShowCompanyLogo, 0) as ShowCompanyLogo,
                    ISNULL(c.ShowHalalLogo, 0) as ShowHalalLogo
                FROM Outlets o
                LEFT JOIN CompanySettings c ON o.Id = c.OutletId
                WHERE o.Id = @outletId
            `);
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Outlet not found' });
        }
        
        const row = result.recordset[0];
        
        let showCompanyLogo = false;
        let showHalalLogo = false;
        
        if (row.ShowCompanyLogo === true || row.ShowCompanyLogo === 1 || row.ShowCompanyLogo === '1') {
            showCompanyLogo = true;
        }
        
        if (row.ShowHalalLogo === true || row.ShowHalalLogo === 1 || row.ShowHalalLogo === '1') {
            showHalalLogo = true;
        }
        
        const settings = {
            CompanyName: row.CompanyName || '',
            Address: row.Address || '',
            GSTNo: row.GSTNo || '',
            GSTPercentage: row.GSTPercentage !== undefined && row.GSTPercentage !== null ? row.GSTPercentage : 9,
            Phone: row.Phone || '',
            Email: row.Email || '',
            CashierName: row.CashierName || '',
            Currency: row.Currency || 'SGD',
            CurrencySymbol: row.CurrencySymbol || '$',
            CompanyLogoUrl: row.CompanyLogoUrl || '',
            HalalLogoUrl: row.HalalLogoUrl || '',
            ShowCompanyLogo: showCompanyLogo,
            ShowHalalLogo: showHalalLogo
        };
        
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
// POST company settings
// ============================================
router.post('/:targetId', async (req, res) => {
    try {
        const outletId = req.outletId;
        
        // ✅ CRITICAL CHECK
        if (!outletId) {
            console.error('❌ No outletId in request!');
            return res.status(400).json({ 
                error: 'OUTLET_REQUIRED',
                message: 'Please select an outlet first'
            });
        }
        
        const { 
            CompanyName, 
            Address, 
            GSTNo, 
            GSTPercentage, 
            Phone, 
            Email, 
            CashierName,
            Currency,
            CurrencySymbol,
            CompanyLogoUrl,
            HalalLogoUrl,
            ShowCompanyLogo,
            ShowHalalLogo
        } = req.body;
        
        let companyLogoValue = ShowCompanyLogo ? 1 : 0;
        let halalLogoValue = ShowHalalLogo ? 1 : 0;
        
        console.log('📥 SAVING TO DATABASE for outlet:', outletId);
        console.log('📥 Logo values:', { companyLogoValue, halalLogoValue });
        
        const pool = getPool();
        
        // ✅ Delete existing
        await pool.request()
            .input('outletId', sql.Int, outletId)
            .query('DELETE FROM CompanySettings WHERE OutletId = @outletId');
        
        // ✅ Insert new
        await pool.request()
            .input('outletId', sql.Int, outletId)
            .input('companyName', sql.NVarChar, CompanyName || '')
            .input('address', sql.NVarChar, Address || '')
            .input('gstNo', sql.NVarChar, GSTNo || '')
           .input('gstPercentage', sql.Decimal(5,2), GSTPercentage !== undefined ? GSTPercentage : 9)
            .input('phone', sql.NVarChar, Phone || '')
            .input('email', sql.NVarChar, Email || '')
            .input('cashierName', sql.NVarChar, CashierName || '')
            .input('currency', sql.NVarChar, Currency || 'SGD')
            .input('currencySymbol', sql.NVarChar, CurrencySymbol || '$')
            .input('companyLogoUrl', sql.NVarChar, CompanyLogoUrl || null)
            .input('halalLogoUrl', sql.NVarChar, HalalLogoUrl || null)
            .input('showCompanyLogo', sql.Bit, companyLogoValue)
            .input('showHalalLogo', sql.Bit, halalLogoValue)
            .query(`
                INSERT INTO CompanySettings (
                    OutletId, CompanyName, Address, GSTNo, GSTPercentage, 
                    Phone, Email, CashierName, Currency, CurrencySymbol,
                    CompanyLogoUrl, HalalLogoUrl, ShowCompanyLogo, ShowHalalLogo
                ) VALUES (
                    @outletId, @companyName, @address, @gstNo, @gstPercentage,
                    @phone, @email, @cashierName, @currency, @currencySymbol,
                    @companyLogoUrl, @halalLogoUrl, @showCompanyLogo, @showHalalLogo
                )
            `);
        
        console.log(`✅ Settings saved for outlet ${outletId}`);
        res.json({ success: true, message: 'Company settings saved successfully' });
        
    } catch (err) {
        console.error('❌ Error saving settings:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// DELETE company settings
// ============================================
router.delete('/:targetId', async (req, res) => {
    try {
        const outletId = req.outletId;
        
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        const pool = getPool();
        
        await pool.request()
            .input('outletId', sql.Int, outletId)
            .query('DELETE FROM CompanySettings WHERE OutletId = @outletId');
        
        res.json({ success: true, message: 'Settings cleared' });
        
    } catch (err) {
        console.error('❌ Error deleting settings:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;