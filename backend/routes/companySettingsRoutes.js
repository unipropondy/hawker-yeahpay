const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// ✅ DB SCHEMA VALIDATION: Auto-add printer columns if missing
const ensurePrinterColumnsExist = async () => {
    try {
        const pool = getPool();
        if (!pool) {
            // Retry in 3 seconds if pool not initialized yet
            setTimeout(ensurePrinterColumnsExist, 3000);
            return;
        }
        await pool.request().query(`
            IF NOT EXISTS (
                SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'CompanySettings' AND COLUMN_NAME = 'NetworkPrinterIP'
            )
            BEGIN
                ALTER TABLE CompanySettings ADD NetworkPrinterIP NVARCHAR(255) NULL;
                ALTER TABLE CompanySettings ADD NetworkPrinterEnabled BIT NULL DEFAULT 0;
            END

            IF NOT EXISTS (
                SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'CompanySettings' AND COLUMN_NAME = 'BluetoothPrinterAddress'
            )
            BEGIN
                ALTER TABLE CompanySettings ADD BluetoothPrinterName NVARCHAR(255) NULL;
                ALTER TABLE CompanySettings ADD BluetoothPrinterAddress NVARCHAR(255) NULL;
                ALTER TABLE CompanySettings ADD BluetoothPrinterEnabled BIT NULL DEFAULT 0;
            END
            IF NOT EXISTS (
                SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'CompanySettings' AND COLUMN_NAME = 'GSTType'
            )
            BEGIN
                ALTER TABLE CompanySettings ADD GSTType NVARCHAR(20) NULL DEFAULT 'inclusive';
            END
        `);
        console.log('✅ Verified Printer and GSTType columns in database table CompanySettings');
    } catch (err) {
        console.log('⚠️ Printer/GSTType columns validation skipped/failed:', err.message);
    }
};
// Check/Alter table 3 seconds after routes load
setTimeout(ensurePrinterColumnsExist, 3000);

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
                    c.GSTType,
                    c.Phone,
                    c.Email,
                    c.CashierName,
                    c.Currency,
                    c.CurrencySymbol,
                    c.CompanyLogoUrl,
                    c.HalalLogoUrl,
                    ISNULL(c.ShowCompanyLogo, 0) as ShowCompanyLogo,
                    ISNULL(c.ShowHalalLogo, 0) as ShowHalalLogo,
                    c.NetworkPrinterIP,
                    ISNULL(c.NetworkPrinterEnabled, 0) as NetworkPrinterEnabled,
                    c.BluetoothPrinterName,
                    c.BluetoothPrinterAddress,
                    ISNULL(c.BluetoothPrinterEnabled, 0) as BluetoothPrinterEnabled
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
            GSTType: row.GSTType || 'inclusive',
            Phone: row.Phone || '',
            Email: row.Email || '',
            CashierName: row.CashierName || '',
            Currency: row.Currency || 'SGD',
            CurrencySymbol: row.CurrencySymbol || '$',
            CompanyLogoUrl: row.CompanyLogoUrl || '',
            HalalLogoUrl: row.HalalLogoUrl || '',
            ShowCompanyLogo: showCompanyLogo,
            ShowHalalLogo: showHalalLogo,
            NetworkPrinterIP: row.NetworkPrinterIP || '',
            NetworkPrinterEnabled: row.NetworkPrinterEnabled === true || row.NetworkPrinterEnabled === 1 || row.NetworkPrinterEnabled === '1',
            BluetoothPrinterName: row.BluetoothPrinterName || '',
            BluetoothPrinterAddress: row.BluetoothPrinterAddress || '',
            BluetoothPrinterEnabled: row.BluetoothPrinterEnabled === true || row.BluetoothPrinterEnabled === 1 || row.BluetoothPrinterEnabled === '1'
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
            GSTType,
            Phone, 
            Email, 
            CashierName,
            Currency,
            CurrencySymbol,
            CompanyLogoUrl,
            HalalLogoUrl,
            ShowCompanyLogo,
            ShowHalalLogo,
            NetworkPrinterIP,
            NetworkPrinterEnabled,
            BluetoothPrinterName,
            BluetoothPrinterAddress,
            BluetoothPrinterEnabled
        } = req.body;
        
        let companyLogoValue = ShowCompanyLogo ? 1 : 0;
        let halalLogoValue = ShowHalalLogo ? 1 : 0;
        let networkPrinterEnabledValue = NetworkPrinterEnabled ? 1 : 0;
        let bluetoothPrinterEnabledValue = BluetoothPrinterEnabled ? 1 : 0;
        
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
            .input('gstType', sql.NVarChar, GSTType || 'inclusive')
            .input('phone', sql.NVarChar, Phone || '')
            .input('email', sql.NVarChar, Email || '')
            .input('cashierName', sql.NVarChar, CashierName || '')
            .input('currency', sql.NVarChar, Currency || 'SGD')
            .input('currencySymbol', sql.NVarChar, CurrencySymbol || '$')
            .input('companyLogoUrl', sql.NVarChar, CompanyLogoUrl || null)
            .input('halalLogoUrl', sql.NVarChar, HalalLogoUrl || null)
            .input('showCompanyLogo', sql.Bit, companyLogoValue)
            .input('showHalalLogo', sql.Bit, halalLogoValue)
            .input('networkPrinterIP', sql.NVarChar, NetworkPrinterIP || null)
            .input('networkPrinterEnabled', sql.Bit, networkPrinterEnabledValue)
            .input('bluetoothPrinterName', sql.NVarChar, BluetoothPrinterName || null)
            .input('bluetoothPrinterAddress', sql.NVarChar, BluetoothPrinterAddress || null)
            .input('bluetoothPrinterEnabled', sql.Bit, bluetoothPrinterEnabledValue)
            .query(`
                INSERT INTO CompanySettings (
                    OutletId, CompanyName, Address, GSTNo, GSTPercentage, GSTType,
                    Phone, Email, CashierName, Currency, CurrencySymbol,
                    CompanyLogoUrl, HalalLogoUrl, ShowCompanyLogo, ShowHalalLogo,
                    NetworkPrinterIP, NetworkPrinterEnabled,
                    BluetoothPrinterName, BluetoothPrinterAddress, BluetoothPrinterEnabled
                ) VALUES (
                    @outletId, @companyName, @address, @gstNo, @gstPercentage, @gstType,
                    @phone, @email, @cashierName, @currency, @currencySymbol,
                    @companyLogoUrl, @halalLogoUrl, @showCompanyLogo, @showHalalLogo,
                    @networkPrinterIP, @networkPrinterEnabled,
                    @bluetoothPrinterName, @bluetoothPrinterAddress, @bluetoothPrinterEnabled
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