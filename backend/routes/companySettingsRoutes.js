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
// GET company settings (WITH LOGOS)
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
                    c.ShowCompanyLogo,
                    c.ShowHalalLogo
                FROM Outlets o
                LEFT JOIN CompanySettings c ON o.Id = c.OutletId
                WHERE o.Id = @outletId
            `);
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Outlet not found' });
        }
        
        const row = result.recordset[0];
        
        const settings = {
            CompanyName: row.CompanyName || '',
            Address: row.Address || '',
            GSTNo: row.GSTNo || '',
            GSTPercentage: row.GSTPercentage || 9,
            Phone: row.Phone || '',
            Email: row.Email || '',
            CashierName: row.CashierName || '',
            Currency: row.Currency || 'SGD',
            CurrencySymbol: row.CurrencySymbol || '$',
            CompanyLogoUrl: row.CompanyLogoUrl || '',
            HalalLogoUrl: row.HalalLogoUrl || '',
            ShowCompanyLogo: row.ShowCompanyLogo !== undefined ? row.ShowCompanyLogo : 1,
            ShowHalalLogo: row.ShowHalalLogo !== undefined ? row.ShowHalalLogo : 1
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
// POST (create/update) company settings (WITH LOGOS)
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
            CurrencySymbol,
            CompanyLogoUrl,      // ✅ ADD
            HalalLogoUrl,        // ✅ ADD
            ShowCompanyLogo,     // ✅ ADD
            ShowHalalLogo        // ✅ ADD
        } = req.body;
        
        const outletId = req.outletId;
        
        const pool = getPool();
        
        // ✅ Save with logo fields
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
            .input('companyLogoUrl', sql.NVarChar, CompanyLogoUrl || null)
            .input('halalLogoUrl', sql.NVarChar, HalalLogoUrl || null)
            .input('showCompanyLogo', sql.Bit, ShowCompanyLogo !== false ? 1 : 0)
            .input('showHalalLogo', sql.Bit, ShowHalalLogo !== false ? 1 : 0)
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
                        CurrencySymbol = @currencySymbol,
                        CompanyLogoUrl = @companyLogoUrl,
                        HalalLogoUrl = @halalLogoUrl,
                        ShowCompanyLogo = @showCompanyLogo,
                        ShowHalalLogo = @showHalalLogo
                WHEN NOT MATCHED THEN
                    INSERT (OutletId, CompanyName, Address, GSTNo, GSTPercentage, Phone, Email, CashierName, Currency, CurrencySymbol, CompanyLogoUrl, HalalLogoUrl, ShowCompanyLogo, ShowHalalLogo)
                    VALUES (@outletId, @companyName, @address, @gstNo, @gstPercentage, @phone, @email, @cashierName, @currency, @currencySymbol, @companyLogoUrl, @halalLogoUrl, @showCompanyLogo, @showHalalLogo);
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