const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../config/db');
const { generateLicenseKey } = require('../utils/licenseGenerator');
const bcrypt = require('bcryptjs');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// 1️⃣ CREATE OWNER ONLY (No License)
// ============================================
router.post('/create-owner', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { shopName, username, password, fullName } = req.body;

        const pool = getPool();
                // Check if username exists
        const existing = await pool.request()
            .input('username', sql.NVarChar, username)
            .query('SELECT Id FROM Users WHERE Username = @username');

        if (existing.recordset.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // ✅ Store owner's shop name in Users.ShopName
        const result = await pool.request()
            .input('username', sql.NVarChar, username)
            .input('passwordHash', sql.NVarChar, hashedPassword)
            .input('role', sql.NVarChar, 'owner')
            .input('shopName', sql.NVarChar, shopName)  // Owner's main shop name
            .input('fullName', sql.NVarChar, fullName || '')
            .query(`
                INSERT INTO Users (Username, PasswordHash, Role, ShopName, FullName, IsActive)
                OUTPUT INSERTED.Id, INSERTED.Username, INSERTED.Role, INSERTED.ShopName
                VALUES (@username, @passwordHash, @role, @shopName, @fullName, 1)
            `);

        res.json({
            success: true,
            message: 'Owner created successfully',
            owner: result.recordset[0]
        });

    } catch (err) {
        console.error('❌ Error:', err);
        res.status(500).json({ error: err.message });
    }
});
// backend/routes/adminRoutes.js - UPDATE create-staff-direct

// ============================================
// CREATE STANDALONE STAFF (No Owner)
// ============================================
router.post('/create-staff-direct', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { shopName, username, password, fullName, startDate, endDate } = req.body;

        console.log('📦 Creating standalone staff:', { shopName, username });

        const pool = getPool();

        // Check if username exists
        const existing = await pool.request()
            .input('username', sql.NVarChar, username)
            .query('SELECT Id FROM Users WHERE Username = @username');

        if (existing.recordset.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Parse dates
        const startLocal = new Date(startDate);
        const endLocal = new Date(endDate);
        
        const startUTC = new Date(startLocal.getTime() - (startLocal.getTimezoneOffset() * 60000));
        const endUTC = new Date(endLocal.getTime() - (endLocal.getTimezoneOffset() * 60000));

        // Calculate duration
        const diffTime = Math.abs(endUTC - startUTC);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const durationMonths = Math.ceil(diffDays / 30);

        const transaction = pool.transaction();
        await transaction.begin();

        try {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // Create staff (standalone - OwnerId = NULL)
            const staffResult = await transaction.request()
                .input('username', sql.NVarChar, username)
                .input('passwordHash', sql.NVarChar, hashedPassword)
                .input('role', sql.NVarChar, 'staff')
                .input('shopName', sql.NVarChar, shopName)
                .input('fullName', sql.NVarChar, fullName || '')
                .query(`
                    INSERT INTO Users (Username, PasswordHash, Role, ShopName, FullName, OwnerId, IsActive)
                    OUTPUT INSERTED.Id, INSERTED.ShopName
                    VALUES (@username, @passwordHash, @role, @shopName, @fullName, NULL, 1)
                `);

            const staffId = staffResult.recordset[0].Id;
            const outletName = staffResult.recordset[0].ShopName;

            // Create outlet (standalone - OwnerId = NULL)
            const outletResult = await transaction.request()
                .input('outletName', sql.NVarChar, outletName)
                .input('staffId', sql.Int, staffId)
                .query(`
                    INSERT INTO Outlets (OutletName, StaffId, OwnerId, IsActive)
                    OUTPUT INSERTED.Id, INSERTED.OutletName
                    VALUES (@outletName, @staffId, NULL, 1)
                `);

            const outletId = outletResult.recordset[0].Id;

            // Update staff with OutletId
            await transaction.request()
                .input('staffId', sql.Int, staffId)
                .input('outletId', sql.Int, outletId)
                .query('UPDATE Users SET OutletId = @outletId WHERE Id = @staffId');

            // Generate license
            const licenseKey = generateLicenseKey(outletName, durationMonths);

            await transaction.request()
                .input('outletId', sql.Int, outletId)
                .input('licenseKey', sql.NVarChar, licenseKey)
                .input('shopName', sql.NVarChar, outletName)
                .input('startDate', sql.DateTime, startUTC)
                .input('expiryDate', sql.DateTime, endUTC)
                .input('durationMonths', sql.Int, durationMonths)
                .query(`
                    INSERT INTO Licenses (OutletId, LicenseKey, ShopName, StartDate, ExpiryDate, DurationMonths, IsActive)
                    VALUES (@outletId, @licenseKey, @shopName, @startDate, @expiryDate, @durationMonths, 1)
                `);

            await transaction.commit();

            console.log(`✅ Standalone staff created: ${username} (Outlet: ${outletName})`);

            res.json({
                success: true,
                message: 'Staff created with license',
                staff: {
                    id: staffId,
                    username,
                    outletId,
                    outletName,
                    licenseKey
                }
            });

        } catch (error) {
            await transaction.rollback();
            console.error('❌ Transaction error:', error);
            throw error;
        }

    } catch (err) {
        console.error('❌ Error creating staff:', err);
        res.status(500).json({ error: err.message });
    }
});
router.get('/staff-standalone', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const pool = getPool();
        
        const result = await pool.request()
            .query(`
                SELECT 
                    u.Id,
                    u.Username,
                    u.ShopName,
                    u.IsActive,
                    o.Id as OutletId,
                    o.OutletName,
                    l.LicenseKey,
                    l.StartDate,
                    l.ExpiryDate,
                    l.IsActive as LicenseActive
                FROM Users u
                JOIN Outlets o ON u.OutletId = o.Id
                LEFT JOIN Licenses l ON o.Id = l.OutletId
                WHERE u.Role = 'staff' 
                  AND u.OwnerId IS NULL
                ORDER BY u.Id
            `);
        
        console.log(`✅ Found ${result.recordset.length} standalone staff`);
        res.json(result.recordset);
        
    } catch (err) {
        console.error('❌ Error:', err);
        res.status(500).json({ error: err.message });
    }
});
// ============================================
// 2️⃣ CREATE STAFF WITH LICENSE (For existing owner)
// ============================================
router.post('/create-staff', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { ownerId, shopName, username, password, fullName, startDate, endDate } = req.body;

        const pool = getPool();

        // Check if username exists
        const existing = await pool.request()
            .input('username', sql.NVarChar, username)
            .query('SELECT Id FROM Users WHERE Username = @username');

        if (existing.recordset.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Check owner exists
        const ownerCheck = await pool.request()
            .input('ownerId', sql.Int, ownerId)
            .query('SELECT Id, ShopName FROM Users WHERE Id = @ownerId AND Role = \'owner\'');

        if (ownerCheck.recordset.length === 0) {
            return res.status(404).json({ error: 'Owner not found' });
        }

        const ownerShopName = ownerCheck.recordset[0].ShopName;

        // Parse dates
        const startLocal = new Date(startDate);
        const endLocal = new Date(endDate);
        
        const startUTC = new Date(startLocal.getTime() - (startLocal.getTimezoneOffset() * 60000));
        const endUTC = new Date(endLocal.getTime() - (endLocal.getTimezoneOffset() * 60000));

        // Calculate duration
        const diffTime = Math.abs(endUTC - startUTC);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const durationMonths = Math.ceil(diffDays / 30);

        const transaction = pool.transaction();
        await transaction.begin();

        try {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // Create staff - Store outlet name in Users.ShopName
            const staffResult = await transaction.request()
                .input('username', sql.NVarChar, username)
                .input('passwordHash', sql.NVarChar, hashedPassword)
                .input('role', sql.NVarChar, 'staff')
                .input('ownerId', sql.Int, ownerId)
                .input('shopName', sql.NVarChar, shopName)  // ✅ OUTLET NAME stored here
                .input('fullName', sql.NVarChar, fullName || '')
                .query(`
                    INSERT INTO Users (Username, PasswordHash, Role, OwnerId, ShopName, FullName, IsActive)
                    OUTPUT INSERTED.Id, INSERTED.ShopName
                    VALUES (@username, @passwordHash, @role, @ownerId, @shopName, @fullName, 1)
                `);

            const staffId = staffResult.recordset[0].Id;
            const outletName = staffResult.recordset[0].ShopName;  // This is the outlet name

            // Create outlet - Use outlet name, NOT owner's shop name
            const outletResult = await transaction.request()
                .input('ownerId', sql.Int, ownerId)
                .input('outletName', sql.NVarChar, outletName)  // ✅ Use staff's shopName as outlet name
                .input('staffId', sql.Int, staffId)
                .query(`
                    INSERT INTO Outlets (OwnerId, OutletName, StaffId, IsActive)
                    OUTPUT INSERTED.Id, INSERTED.OutletName
                    VALUES (@ownerId, @outletName, @staffId, 1)
                `);

            const outletId = outletResult.recordset[0].Id;

            // Update staff with OutletId
            await transaction.request()
                .input('staffId', sql.Int, staffId)
                .input('outletId', sql.Int, outletId)
                .query('UPDATE Users SET OutletId = @outletId WHERE Id = @staffId');

            // Generate license
            const licenseKey = generateLicenseKey(outletName, durationMonths);

            await transaction.request()
                .input('outletId', sql.Int, outletId)
                .input('licenseKey', sql.NVarChar, licenseKey)
                .input('shopName', sql.NVarChar, outletName)  // ✅ License tied to outlet name
                .input('startDate', sql.DateTime, startUTC)
                .input('expiryDate', sql.DateTime, endUTC)
                .input('durationMonths', sql.Int, durationMonths)
                .query(`
                    INSERT INTO Licenses (OutletId, LicenseKey, ShopName, StartDate, ExpiryDate, DurationMonths, IsActive)
                    VALUES (@outletId, @licenseKey, @shopName, @startDate, @expiryDate, @durationMonths, 1)
                `);

            await transaction.commit();

            res.json({
                success: true,
                message: 'Staff created with license',
                staff: {
                    id: staffId,
                    username,
                    outletId,
                    outletName,  // ✅ Return outlet name
                    licenseKey
                }
            });

        } catch (error) {
            await transaction.rollback();
            throw error;
        }

    } catch (err) {
        console.error('❌ Error:', err);
        res.status(500).json({ error: err.message });
    }
});
// ============================================
// 3️⃣ CREATE SHOP WITH MULTIPLE OUTLETS
// ============================================
router.post('/create-shop', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { 
            ownerUsername,     
            ownerPassword,
            outlets  // Array of outlets [{ name, staffUsername, staffPassword, startDate, endDate }]
        } = req.body;
        
        console.log('📦 Creating shop with outlets:', outlets);
        
        const pool = getPool();
        
        // ✅ Check if owner username exists
        const existingOwner = await pool.request()
            .input('username', sql.NVarChar, ownerUsername)
            .query('SELECT Id FROM Users WHERE Username = @username');
            
        if (existingOwner.recordset.length > 0) {
            return res.status(400).json({ 
                error: `Owner username '${ownerUsername}' already exists!` 
            });
        }
        
        // ✅ Check all staff usernames are unique
        for (const outlet of outlets) {
            const existingStaff = await pool.request()
                .input('username', sql.NVarChar, outlet.staffUsername)
                .query('SELECT Id FROM Users WHERE Username = @username');
            
            if (existingStaff.recordset.length > 0) {
                return res.status(400).json({ 
                    error: `Staff username '${outlet.staffUsername}' already exists!` 
                });
            }
        }
        
        // Start transaction
        const transaction = pool.transaction();
        await transaction.begin();
        
        try {
            // ========== STEP 1: Create Owner (NO LICENSE) ==========
            const salt = await bcrypt.genSalt(10);
            const ownerHashedPassword = await bcrypt.hash(ownerPassword, salt);
            
            const ownerResult = await transaction.request()
                .input('username', sql.NVarChar, ownerUsername)
                .input('passwordHash', sql.NVarChar, ownerHashedPassword)
                .input('role', sql.NVarChar, 'owner')
                .query(`
                    INSERT INTO Users (Username, PasswordHash, Role, IsActive)
                    OUTPUT INSERTED.Id
                    VALUES (@username, @passwordHash, @role, 1)
                `);
            
            const ownerId = ownerResult.recordset[0].Id;
            console.log(`✅ Owner created with ID: ${ownerId}`);
            
            const createdOutlets = [];
            
            // ========== STEP 2: Create Each Outlet with Staff and License ==========
            for (let i = 0; i < outlets.length; i++) {
                const outlet = outlets[i];
                
                // Parse dates (local to UTC)
                const startLocal = new Date(outlet.startDate);
                const endLocal = new Date(outlet.endDate);
                
                const startUTC = new Date(startLocal.getTime() - (startLocal.getTimezoneOffset() * 60000));
                const endUTC = new Date(endLocal.getTime() - (endLocal.getTimezoneOffset() * 60000));
                
                // Calculate duration
                const diffTime = Math.abs(endUTC - startUTC);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const durationMonths = Math.ceil(diffDays / 30);
                
                // ---------- Create Staff ----------
                const staffHashedPassword = await bcrypt.hash(outlet.staffPassword, salt);
                
                const staffResult = await transaction.request()
                    .input('username', sql.NVarChar, outlet.staffUsername)
                    .input('passwordHash', sql.NVarChar, staffHashedPassword)
                    .input('role', sql.NVarChar, 'staff')
                    .input('ownerId', sql.Int, ownerId)
                    .input('shopName', sql.NVarChar, outlet.name)
                    .query(`
                        INSERT INTO Users (Username, PasswordHash, Role, OwnerId, ShopName, IsActive)
                        OUTPUT INSERTED.Id
                        VALUES (@username, @passwordHash, @role, @ownerId, @shopName, 1)
                    `);
                
                const staffId = staffResult.recordset[0].Id;
                console.log(`✅ Staff created for ${outlet.name} with ID: ${staffId}`);
                
                // ---------- Create Outlet ----------
                const outletResult = await transaction.request()
                    .input('ownerId', sql.Int, ownerId)
                    .input('outletName', sql.NVarChar, outlet.name)
                    .input('address', sql.NVarChar, outlet.address || '')
                    .input('phone', sql.NVarChar, outlet.phone || '')
                    .input('staffId', sql.Int, staffId)
                    .query(`
                        INSERT INTO Outlets (OwnerId, OutletName, Address, Phone, StaffId, IsActive)
                        OUTPUT INSERTED.Id
                        VALUES (@ownerId, @outletName, @address, @phone, @staffId, 1)
                    `);
                
                const outletId = outletResult.recordset[0].Id;
                console.log(`✅ Outlet created with ID: ${outletId}`);
                
                // ---------- Update Staff with OutletId ----------
                await transaction.request()
                    .input('staffId', sql.Int, staffId)
                    .input('outletId', sql.Int, outletId)
                    .query('UPDATE Users SET OutletId = @outletId WHERE Id = @staffId');
                
                // ---------- Generate License for OUTLET ----------
                const licenseKey = generateLicenseKey(outlet.name, durationMonths);
                
                await transaction.request()
                    .input('outletId', sql.Int, outletId)
                    .input('licenseKey', sql.NVarChar, licenseKey)
                    .input('shopName', sql.NVarChar, outlet.name)
                    .input('startDate', sql.DateTime, startUTC)
                    .input('expiryDate', sql.DateTime, endUTC)
                    .input('durationMonths', sql.Int, durationMonths)
                    .query(`
                        INSERT INTO Licenses (OutletId, LicenseKey, ShopName, StartDate, ExpiryDate, DurationMonths, IsActive)
                        VALUES (@outletId, @licenseKey, @shopName, @startDate, @expiryDate, @durationMonths, 1)
                    `);
                
                createdOutlets.push({
                    id: outletId,
                    name: outlet.name,
                    staff: {
                        id: staffId,
                        username: outlet.staffUsername
                    },
                    licenseKey,
                    startDate: startLocal,
                    expiryDate: endLocal,
                    durationMonths
                });
            }
            
            await transaction.commit();
            
            res.json({
                success: true,
                message: `Shop created with ${createdOutlets.length} outlets`,
                owner: {
                    id: ownerId,
                    username: ownerUsername,
                    role: 'owner'
                },
                outlets: createdOutlets
            });
            
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Transaction error:', error);
            throw error;
        }
        
    } catch (err) {
        console.error('❌ Error creating shop:', err);
        res.status(500).json({ error: err.message });
    }
});
// backend/routes/adminRoutes.js - ADD THIS ENDPOINT

// ============================================
// SET VOID PASSWORD FOR OUTLET
// ============================================
// POST set void password
router.post('/set-void-password/:outletId', authenticateToken, async (req, res) => {
    try {
        // Only owner or admin can set void password
        if (req.user.role !== 'admin' && req.user.role !== 'owner') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { outletId } = req.params;
        const { voidPassword, enabled } = req.body;
        
        // ✅ Get pool here
        const pool = getPool();

        // If owner, verify they own this outlet
        if (req.user.role === 'owner') {
            const checkOutlet = await pool.request()
                .input('outletId', sql.Int, outletId)
                .input('ownerId', sql.Int, req.user.id)
                .query('SELECT Id FROM Outlets WHERE Id = @outletId AND OwnerId = @ownerId');
            
            if (checkOutlet.recordset.length === 0) {
                return res.status(403).json({ error: 'Access denied to this outlet' });
            }
        }

        const bcrypt = require('bcryptjs');
        let hashedPassword = null;
        
        if (voidPassword) {
            const salt = await bcrypt.genSalt(10);
            hashedPassword = await bcrypt.hash(voidPassword, salt);
        }

        // Update or insert void password
        await pool.request()
            .input('outletId', sql.Int, outletId)
            .input('voidPassword', sql.NVarChar, hashedPassword)
            .input('enabled', sql.Bit, enabled !== undefined ? enabled : (voidPassword ? 1 : 0))
            .query(`
                UPDATE Outlets 
                SET VoidPassword = @voidPassword,
                    VoidPasswordEnabled = @enabled
                WHERE Id = @outletId
            `);

        res.json({ 
            success: true, 
            message: 'Void password updated successfully' 
        });

    } catch (err) {
        console.error('❌ Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// GET VOID PASSWORD STATUS
// ============================================
// GET void password status
router.get('/void-password-status/:outletId', authenticateToken, async (req, res) => {
    try {
        const { outletId } = req.params;
        
        // ✅ Get pool here, not at top level
        const pool = getPool();
        
        // Verify access
        if (req.user.role === 'owner') {
            const checkOutlet = await pool.request()
                .input('outletId', sql.Int, outletId)
                .input('ownerId', sql.Int, req.user.id)
                .query('SELECT Id FROM Outlets WHERE Id = @outletId AND OwnerId = @ownerId');
            
            if (checkOutlet.recordset.length === 0 && req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        const result = await pool.request()
            .input('outletId', sql.Int, outletId)
            .query(`
                SELECT 
                    CASE WHEN VoidPassword IS NOT NULL THEN 1 ELSE 0 END as HasPassword,
                    ISNULL(VoidPasswordEnabled, 0) as Enabled
                FROM Outlets 
                WHERE Id = @outletId
            `);

        res.json({ 
            success: true, 
            hasPassword: result.recordset[0]?.HasPassword === 1,
            enabled: result.recordset[0]?.Enabled === 1
        });

    } catch (err) {
        console.error('❌ Error:', err);
        res.status(500).json({ error: err.message });
    }
});
// ============================================
// 4️⃣ TOGGLE USER ACTIVE STATUS
// ============================================
router.put('/toggle-status/:userId', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { userId } = req.params;
        const { isActive } = req.body;

        console.log(`🔄 Toggle request - User: ${userId}, New Status: ${isActive}`);

        const pool = getPool();

        // First check if user exists
        const checkResult = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT Id, Username, IsActive FROM Users WHERE Id = @userId');

        if (checkResult.recordset.length === 0) {
            console.log('❌ User not found:', userId);
            return res.status(404).json({ error: 'User not found' });
        }

        console.log('📋 Before update:', checkResult.recordset[0]);

        // Update user status
        const updateResult = await pool.request()
            .input('userId', sql.Int, userId)
            .input('isActive', sql.Bit, isActive)
            .query('UPDATE Users SET IsActive = @isActive WHERE Id = @userId');

        console.log('✅ Rows affected:', updateResult.rowsAffected[0]);

        // Verify update
        const verifyResult = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT Id, Username, IsActive FROM Users WHERE Id = @userId');

        console.log('📋 After update:', verifyResult.recordset[0]);

        if (updateResult.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ 
            success: true, 
            message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
            user: verifyResult.recordset[0]
        });

    } catch (err) {
        console.error('❌ Toggle error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// 5️⃣ DELETE USER (Owner or Staff)
// ============================================
router.delete('/delete-user/:userId', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { userId } = req.params;
        const pool = getPool();

        // Check if user is owner
        const userCheck = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT Role FROM Users WHERE Id = @userId');
        
        if (userCheck.recordset.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isOwner = userCheck.recordset[0].Role === 'owner';

        // Start transaction
        const transaction = pool.transaction();
        await transaction.begin();

        try {
            if (isOwner) {
                // Get all outlets for this owner
                const outlets = await transaction.request()
                    .input('ownerId', sql.Int, userId)
                    .query('SELECT Id FROM Outlets WHERE OwnerId = @ownerId');
                
                // Delete data for each outlet
                for (const outlet of outlets.recordset) {
                    // Delete outlet's staff
                    await transaction.request()
                        .input('outletId', sql.Int, outlet.Id)
                        .query('DELETE FROM Users WHERE OutletId = @outletId');
                    
                    // Delete outlet's license
                    await transaction.request()
                        .input('outletId', sql.Int, outlet.Id)
                        .query('DELETE FROM Licenses WHERE OutletId = @outletId');
                    
                    // Delete outlet's sales
                    await transaction.request()
                        .input('outletId', sql.Int, outlet.Id)
                        .query('DELETE FROM Sales WHERE OutletId = @outletId');
                    
                    // Delete outlet's dish items
                    await transaction.request()
                        .input('outletId', sql.Int, outlet.Id)
                        .query('DELETE FROM DishItem WHERE OutletId = @outletId');
                    
                    // Delete outlet's dish groups
                    await transaction.request()
                        .input('outletId', sql.Int, outlet.Id)
                        .query('DELETE FROM DishGroup WHERE OutletId = @outletId');
                    
                    // Delete outlet's company settings
                    await transaction.request()
                        .input('outletId', sql.Int, outlet.Id)
                        .query('DELETE FROM CompanySettings WHERE OutletId = @outletId');
                }
                
                // Delete outlets
                await transaction.request()
                    .input('ownerId', sql.Int, userId)
                    .query('DELETE FROM Outlets WHERE OwnerId = @ownerId');
            } else {
                // Staff: Get their outlet first
                const staff = await transaction.request()
                    .input('userId', sql.Int, userId)
                    .query('SELECT OutletId FROM Users WHERE Id = @userId');
                
                if (staff.recordset[0]?.OutletId) {
                    // Delete staff's data
                    await transaction.request()
                        .input('outletId', sql.Int, staff.recordset[0].OutletId)
                        .query('DELETE FROM Sales WHERE OutletId = @outletId');
                    
                    await transaction.request()
                        .input('outletId', sql.Int, staff.recordset[0].OutletId)
                        .query('DELETE FROM DishItem WHERE OutletId = @outletId');
                    
                    await transaction.request()
                        .input('outletId', sql.Int, staff.recordset[0].OutletId)
                        .query('DELETE FROM DishGroup WHERE OutletId = @outletId');
                    
                    await transaction.request()
                        .input('outletId', sql.Int, staff.recordset[0].OutletId)
                        .query('DELETE FROM CompanySettings WHERE OutletId = @outletId');
                    
                    // Delete outlet itself
                    await transaction.request()
                        .input('outletId', sql.Int, staff.recordset[0].OutletId)
                        .query('DELETE FROM Outlets WHERE Id = @outletId');
                    
                    // Delete license
                    await transaction.request()
                        .input('outletId', sql.Int, staff.recordset[0].OutletId)
                        .query('DELETE FROM Licenses WHERE OutletId = @outletId');
                }
                
                // Delete user_preferences
                await transaction.request()
                    .input('userId', sql.Int, userId)
                    .query('DELETE FROM user_preferences WHERE user_id = @userId');
            }
            
            // Finally delete the user
            await transaction.request()
                .input('userId', sql.Int, userId)
                .query('DELETE FROM Users WHERE Id = @userId');

            await transaction.commit();
            res.json({ success: true, message: 'User and all associated data deleted successfully' });
            
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Transaction error:', error);
            throw error;
        }
    } catch (err) {
        console.error('❌ Delete error:', err);
        res.status(500).json({ error: err.message });
    }
});
// ============================================
// DELETE STANDALONE STAFF (No owner)
// ============================================
// ============================================
// DELETE STANDALONE STAFF (No owner)
// ============================================
router.delete('/delete-standalone-staff/:staffId', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { staffId } = req.params;
        const pool = getPool();

        // Check if staff exists and is standalone
        const staffCheck = await pool.request()
            .input('staffId', sql.Int, staffId)
            .query(`
                SELECT Id, Username, OutletId, OwnerId 
                FROM Users 
                WHERE Id = @staffId AND Role = 'staff' AND OwnerId IS NULL
            `);
        
        if (staffCheck.recordset.length === 0) {
            return res.status(404).json({ error: 'Standalone staff not found' });
        }

        const staff = staffCheck.recordset[0];
        const outletId = staff.OutletId;

        // Start transaction
        const transaction = pool.transaction();
        await transaction.begin();

        try {
            console.log(`🗑️ Deleting standalone staff: ${staff.Username} (ID: ${staffId}) with outlet ${outletId}`);

            // ✅ STEP 1: First, REMOVE the staff reference from outlet
            if (outletId) {
                await transaction.request()
                    .input('outletId', sql.Int, outletId)
                    .query('UPDATE Outlets SET StaffId = NULL WHERE Id = @outletId');
                console.log('✅ Removed staff reference from outlet');
            }

            // ✅ STEP 2: Remove outlet reference from staff
            await transaction.request()
                .input('staffId', sql.Int, staffId)
                .query('UPDATE Users SET OutletId = NULL WHERE Id = @staffId');
            console.log('✅ Removed outlet reference from staff');

            // 3. Delete user_preferences
            await transaction.request()
                .input('userId', sql.Int, staffId)
                .query('DELETE FROM user_preferences WHERE user_id = @userId');

            // 4. Delete sales
            if (outletId) {
                await transaction.request()
                    .input('outletId', sql.Int, outletId)
                    .query('DELETE FROM Sales WHERE OutletId = @outletId');

                // 5. Delete dish items
                await transaction.request()
                    .input('outletId', sql.Int, outletId)
                    .query('DELETE FROM DishItem WHERE OutletId = @outletId');

                // 6. Delete dish groups
                await transaction.request()
                    .input('outletId', sql.Int, outletId)
                    .query('DELETE FROM DishGroup WHERE OutletId = @outletId');

                // 7. Delete company settings
                await transaction.request()
                    .input('outletId', sql.Int, outletId)
                    .query('DELETE FROM CompanySettings WHERE OutletId = @outletId');

                // 8. Delete license
                await transaction.request()
                    .input('outletId', sql.Int, outletId)
                    .query('DELETE FROM Licenses WHERE OutletId = @outletId');

                // 9. Delete outlet
                await transaction.request()
                    .input('outletId', sql.Int, outletId)
                    .query('DELETE FROM Outlets WHERE Id = @outletId');
                console.log('✅ Deleted outlet');
            }

            // 10. Finally delete the staff user
            await transaction.request()
                .input('staffId', sql.Int, staffId)
                .query('DELETE FROM Users WHERE Id = @staffId');
            console.log('✅ Deleted staff user');

            await transaction.commit();
            console.log(`✅ Standalone staff ${staff.Username} deleted successfully`);
            res.json({ success: true, message: 'Standalone staff deleted successfully' });
            
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Transaction error:', error);
            throw error;
        }
    } catch (err) {
        console.error('❌ Delete error:', err);
        res.status(500).json({ error: err.message });
    }
});
// ============================================
// 6️⃣ GET ALL SHOPS WITH OUTLETS
// ============================================
router.get('/shops', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const pool = getPool();
        
        const result = await pool.request()
            .query(`
                -- Get all owners with their main shop name
                SELECT 
                    u.Id, 
                    u.Username,
                    u.Role,
                    u.ShopName as OwnerShopName,  -- ✅ Owner's main shop name
                    u.IsActive as UserActive,
                    
                    -- Outlet details
                    o.Id as OutletId,
                    o.OutletName, 
                     o.IsActive as OutletActive,               
                    o.Address,
                    o.Phone,
                    
                    -- License details
                    l.LicenseKey,
                    l.StartDate,
                    l.ExpiryDate,
                    l.IsActive as LicenseActive,
                    DATEDIFF(day, GETDATE(), l.ExpiryDate) as DaysLeft,
                    
                    -- Staff details
                    s.Id as StaffId,
                    s.Username as StaffUsername,
                    s.IsActive as StaffActive 
                    
                FROM Users u
                LEFT JOIN Outlets o ON u.Id = o.OwnerId
                LEFT JOIN Licenses l ON o.Id = l.OutletId
                LEFT JOIN Users s ON o.StaffId = s.Id
                WHERE u.Role = 'owner'
                ORDER BY u.Id, o.OutletName
            `);
        
        // Group by owner
        const owners = {};
        result.recordset.forEach(row => {
            if (!owners[row.Id]) {
                owners[row.Id] = {
                    id: row.Id,
                    username: row.Username,
                    shopName: row.OwnerShopName,  // ✅ Owner's main shop name
                    isActive: row.UserActive,
                    outlets: []
                };
            }
            
            // Add outlet if exists
            if (row.OutletId && !owners[row.Id].outlets.some(o => o.id === row.OutletId)) {
                owners[row.Id].outlets.push({
                    id: row.OutletId,
                    name: row.OutletName,          // ✅ Outlet's unique name
                    address: row.Address,
                    phone: row.Phone,
                    isActive: row.OutletActive,
                    license: {
                        key: row.LicenseKey,
                        startDate: row.StartDate,
                        expiryDate: row.ExpiryDate,
                        isActive: row.LicenseActive,
                        daysLeft: row.DaysLeft
                    },
                    staff: row.StaffId ? {
                        id: row.StaffId,
                        username: row.StaffUsername,
                        isActive: row.StaffActive
                    } : null
                });
            }
        });
        
        console.log(`✅ Found ${Object.keys(owners).length} owners`);
        res.json(Object.values(owners));
        
    } catch (err) {
        console.error('❌ Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// 7️⃣ RENEW LICENSE FOR OUTLET
// ============================================
router.post('/renew-license/:outletId', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { outletId } = req.params;
        const { startDate, endDate } = req.body;
        const pool = getPool();
        
        // Parse dates
        const startLocal = new Date(startDate);
        const endLocal = new Date(endDate);
        
        const startUTC = new Date(startLocal.getTime() - (startLocal.getTimezoneOffset() * 60000));
        const endUTC = new Date(endLocal.getTime() - (endLocal.getTimezoneOffset() * 60000));
        
        // Calculate duration
        const diffTime = Math.abs(endUTC - startUTC);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const durationMonths = Math.ceil(diffDays / 30);
        
        // Generate new license key
        const newLicenseKey = generateLicenseKey('RENEW', durationMonths);
        
        // Get outlet name
        const outletResult = await pool.request()
            .input('outletId', sql.Int, outletId)
            .query('SELECT OutletName FROM Outlets WHERE Id = @outletId');
        
        const outletName = outletResult.recordset[0]?.OutletName || 'Outlet';
        
        // Update license
        await pool.request()
            .input('outletId', sql.Int, outletId)
            .input('licenseKey', sql.NVarChar, newLicenseKey)
            .input('shopName', sql.NVarChar, outletName)
            .input('startDate', sql.DateTime, startUTC)
            .input('expiryDate', sql.DateTime, endUTC)
            .input('durationMonths', sql.Int, durationMonths)
            .query(`
                UPDATE Licenses 
                SET StartDate = @startDate,
                    ExpiryDate = @expiryDate,
                    LicenseKey = @licenseKey,
                    ShopName = @shopName,
                    DurationMonths = @durationMonths,
                    IsActive = 1
                WHERE OutletId = @outletId
            `);
        
        res.json({ 
            success: true, 
            message: 'License renewed for outlet',
            license: {
                key: newLicenseKey,
                startDate: startLocal,
                expiryDate: endLocal,
                durationMonths
            }
        });
        
    } catch (err) {
        console.error('Renew error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// 8️⃣ ADD NEW OUTLET TO EXISTING OWNER
// ============================================
router.post('/add-outlet', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { 
            ownerId,
            outletName,      // ✅ Outlet name (separate)
            staffUsername,
            staffPassword,
            startDate,
            endDate
        } = req.body;

        console.log('📦 Adding outlet:', { ownerId, outletName, staffUsername });

        const pool = getPool();

        // Check if owner exists
        const ownerCheck = await pool.request()
            .input('ownerId', sql.Int, ownerId)
            .query('SELECT Id, ShopName FROM Users WHERE Id = @ownerId AND Role = \'owner\'');

        if (ownerCheck.recordset.length === 0) {
            return res.status(404).json({ error: 'Owner not found' });
        }

        // Check if staff username already exists
        const staffCheck = await pool.request()
            .input('username', sql.NVarChar, staffUsername)
            .query('SELECT Id FROM Users WHERE Username = @username');

        if (staffCheck.recordset.length > 0) {
            return res.status(400).json({ 
                error: `Staff username '${staffUsername}' already exists!` 
            });
        }

        // Start transaction
        const transaction = pool.transaction();
        await transaction.begin();

        try {
            // Parse dates
            const startLocal = new Date(startDate);
            const endLocal = new Date(endDate);
            
            const startUTC = new Date(startLocal.getTime() - (startLocal.getTimezoneOffset() * 60000));
            const endUTC = new Date(endLocal.getTime() - (endLocal.getTimezoneOffset() * 60000));

            // Calculate duration
            const diffTime = Math.abs(endUTC - startUTC);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const durationMonths = Math.ceil(diffDays / 30);

            // Create staff - Store outlet name in Users.ShopName
            const salt = await bcrypt.genSalt(10);
            const staffHashedPassword = await bcrypt.hash(staffPassword, salt);

            const staffResult = await transaction.request()
                .input('username', sql.NVarChar, staffUsername)
                .input('passwordHash', sql.NVarChar, staffHashedPassword)
                .input('role', sql.NVarChar, 'staff')
                .input('ownerId', sql.Int, ownerId)
                .input('shopName', sql.NVarChar, outletName)  // ✅ Store outlet name here
                .query(`
                    INSERT INTO Users (Username, PasswordHash, Role, OwnerId, ShopName, IsActive)
                    OUTPUT INSERTED.Id, INSERTED.ShopName
                    VALUES (@username, @passwordHash, @role, @ownerId, @shopName, 1)
                `);

            const staffId = staffResult.recordset[0].Id;
            const savedOutletName = staffResult.recordset[0].ShopName;

            // Create outlet
            const outletResult = await transaction.request()
                .input('ownerId', sql.Int, ownerId)
                .input('outletName', sql.NVarChar, savedOutletName)  // ✅ Use same name
                .input('staffId', sql.Int, staffId)
                .query(`
                    INSERT INTO Outlets (OwnerId, OutletName, StaffId, IsActive)
                    OUTPUT INSERTED.Id, INSERTED.OutletName
                    VALUES (@ownerId, @outletName, @staffId, 1)
                `);

            const outletId = outletResult.recordset[0].Id;

            // Update staff with OutletId
            await transaction.request()
                .input('staffId', sql.Int, staffId)
                .input('outletId', sql.Int, outletId)
                .query('UPDATE Users SET OutletId = @outletId WHERE Id = @staffId');

            // Generate license
            const licenseKey = generateLicenseKey(savedOutletName, durationMonths);

            await transaction.request()
                .input('outletId', sql.Int, outletId)
                .input('licenseKey', sql.NVarChar, licenseKey)
                .input('shopName', sql.NVarChar, savedOutletName)  // ✅ License tied to outlet
                .input('startDate', sql.DateTime, startUTC)
                .input('expiryDate', sql.DateTime, endUTC)
                .input('durationMonths', sql.Int, durationMonths)
                .query(`
                    INSERT INTO Licenses (OutletId, LicenseKey, ShopName, StartDate, ExpiryDate, DurationMonths, IsActive)
                    VALUES (@outletId, @licenseKey, @shopName, @startDate, @expiryDate, @durationMonths, 1)
                `);

            await transaction.commit();

            res.json({
                success: true,
                message: 'Outlet added successfully',
                outlet: {
                    id: outletId,
                    name: savedOutletName,  // ✅ Return outlet name
                    staff: {
                        id: staffId,
                        username: staffUsername
                    },
                    licenseKey,
                    startDate: startLocal,
                    expiryDate: endLocal
                }
            });

        } catch (error) {
            await transaction.rollback();
            console.error('❌ Transaction error:', error);
            throw error;
        }

    } catch (err) {
        console.error('❌ Error adding outlet:', err);
        res.status(500).json({ error: err.message });
    }
});
// In adminRoutes.js - toggle-outlet route
// backend/routes/adminRoutes.js - UPDATE toggle-outlet

router.put('/toggle-outlet/:outletId', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { outletId } = req.params;
        const { isActive } = req.body;

        console.log(`🔄 Toggling outlet ${outletId} to ${isActive}`);

        const pool = getPool();
        
        // 1️⃣ Update outlet status
        await pool.request()
            .input('outletId', sql.Int, outletId)
            .input('isActive', sql.Bit, isActive)
            .query('UPDATE Outlets SET IsActive = @isActive WHERE Id = @outletId');

        // 2️⃣ Update ALL staff under this outlet to MATCH
        const staffResult = await pool.request()
            .input('outletId', sql.Int, outletId)
            .input('isActive', sql.Bit, isActive)
            .query('UPDATE Users SET IsActive = @isActive WHERE OutletId = @outletId AND Role = \'staff\'');

        console.log(`✅ Updated ${staffResult.rowsAffected[0]} staff members`);

        res.json({ 
            success: true, 
            message: `Outlet and staff ${isActive ? 'activated' : 'deactivated'} successfully`
        });

    } catch (err) {
        console.error('❌ Error:', err);
        res.status(500).json({ error: err.message });
    }
});
// ============================================
// 9️⃣ DELETE OUTLET
// ============================================
router.delete('/delete-outlet/:outletId', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { outletId } = req.params;
        const pool = getPool();

        const transaction = pool.transaction();
        await transaction.begin();

        try {
            // Get staff ID from outlet
            const outletResult = await transaction.request()
                .input('outletId', sql.Int, outletId)
                .query('SELECT StaffId FROM Outlets WHERE Id = @outletId');

            if (outletResult.recordset.length === 0) {
                await transaction.rollback();
                return res.status(404).json({ error: 'Outlet not found' });
            }

            const staffId = outletResult.recordset[0].StaffId;

            console.log(`🗑️ Deleting outlet ${outletId} with staff ${staffId}`);

            // ✅ STEP 1: Delete staff's user_preferences
            if (staffId) {
                await transaction.request()
                    .input('staffId', sql.Int, staffId)
                    .query('DELETE FROM user_preferences WHERE user_id = @staffId');
                console.log(`✅ Deleted user_preferences for staff ${staffId}`);
            }

            // ✅ STEP 2: Delete sales for this outlet
            await transaction.request()
                .input('outletId', sql.Int, outletId)
                .query('DELETE FROM Sales WHERE OutletId = @outletId');
            console.log(`✅ Deleted sales for outlet ${outletId}`);

            // ✅ STEP 3: Delete dish items
            await transaction.request()
                .input('outletId', sql.Int, outletId)
                .query('DELETE FROM DishItem WHERE OutletId = @outletId');
            console.log(`✅ Deleted dish items for outlet ${outletId}`);

            // ✅ STEP 4: Delete dish groups
            await transaction.request()
                .input('outletId', sql.Int, outletId)
                .query('DELETE FROM DishGroup WHERE OutletId = @outletId');
            console.log(`✅ Deleted dish groups for outlet ${outletId}`);

            // ✅ STEP 5: Delete company settings
            await transaction.request()
                .input('outletId', sql.Int, outletId)
                .query('DELETE FROM CompanySettings WHERE OutletId = @outletId');
            console.log(`✅ Deleted company settings for outlet ${outletId}`);

            // ✅ STEP 6: Delete license
            await transaction.request()
                .input('outletId', sql.Int, outletId)
                .query('DELETE FROM Licenses WHERE OutletId = @outletId');
            console.log(`✅ Deleted license for outlet ${outletId}`);

            // ✅ STEP 7: Update outlet to remove staff reference BEFORE deleting staff
            await transaction.request()
                .input('outletId', sql.Int, outletId)
                .query('UPDATE Outlets SET StaffId = NULL WHERE Id = @outletId');
            console.log(`✅ Updated outlet ${outletId} to remove staff reference`);

            // ✅ STEP 8: Delete the staff user
            if (staffId) {
                await transaction.request()
                    .input('staffId', sql.Int, staffId)
                    .query('DELETE FROM Users WHERE Id = @staffId');
                console.log(`✅ Deleted staff user ${staffId}`);
            }

            // ✅ STEP 9: Finally delete the outlet
            await transaction.request()
                .input('outletId', sql.Int, outletId)
                .query('DELETE FROM Outlets WHERE Id = @outletId');
            console.log(`✅ Deleted outlet ${outletId}`);

            await transaction.commit();
            
            console.log(`✅ Outlet ${outletId} and all associated data deleted successfully`);
            res.json({ success: true, message: 'Outlet deleted successfully' });

        } catch (error) {
            await transaction.rollback();
            console.error('❌ Transaction error:', error);
            throw error;
        }

    } catch (err) {
        console.error('❌ Error deleting outlet:', err);
        res.status(500).json({ error: err.message });
    }
});
// backend/routes/adminRoutes.js

// ============================================
// EDIT USER (Owner or Staff)
// ============================================
router.put('/edit-user', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { userId, username, shopName, fullName, password } = req.body;
        
        if (!userId || !username || !shopName) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const pool = getPool();
        
        // Check if user exists
        const userCheck = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT Id, Role FROM Users WHERE Id = @userId');
        
        if (userCheck.recordset.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const userRole = userCheck.recordset[0].Role;
        
        // Start transaction
        const transaction = pool.transaction();
        await transaction.begin();
        
        try {
            // Build update query
            let updateQuery = 'UPDATE Users SET Username = @username, ShopName = @shopName, FullName = @fullName';
            const request = transaction.request();
            
            request.input('userId', sql.Int, userId);
            request.input('username', sql.NVarChar, username);
            request.input('shopName', sql.NVarChar, shopName);
            request.input('fullName', sql.NVarChar, fullName || '');
            
            // If password provided, hash it
            if (password && password.trim() !== '') {
                const bcrypt = require('bcryptjs');
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(password, salt);
                updateQuery += ', PasswordHash = @passwordHash';
                request.input('passwordHash', sql.NVarChar, hashedPassword);
            }
            
            updateQuery += ' WHERE Id = @userId';
            
            await request.query(updateQuery);
            
            // If staff, also update outlet name
            if (userRole === 'staff') {
                // Get outlet ID
                const outletResult = await transaction.request()
                    .input('userId', sql.Int, userId)
                    .query('SELECT OutletId FROM Users WHERE Id = @userId');
                
                if (outletResult.recordset[0]?.OutletId) {
                    const outletId = outletResult.recordset[0].OutletId;
                    
                    await transaction.request()
                        .input('outletId', sql.Int, outletId)
                        .input('outletName', sql.NVarChar, shopName)
                        .query('UPDATE Outlets SET OutletName = @outletName WHERE Id = @outletId');
                    
                    // Also update license shop name
                    await transaction.request()
                        .input('outletId', sql.Int, outletId)
                        .input('shopName', sql.NVarChar, shopName)
                        .query('UPDATE Licenses SET ShopName = @shopName WHERE OutletId = @outletId');
                }
            }
            
            await transaction.commit();
            
            console.log(`✅ User ${userId} updated by admin`);
            res.json({ success: true, message: 'User updated successfully' });
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
        
    } catch (err) {
        console.error('❌ Error updating user:', err);
        res.status(500).json({ error: err.message });
    }
});
// ============================================
// 🔟 GET LICENSE STATUS
// ============================================
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const pool = getPool();
        const userId = req.user.id;
        const userRole = req.user.role;
        
        if (userRole === 'admin') {
            return res.json({
                LicenseKey: 'ADMIN-ACCOUNT',
                ExpiryDate: null,
                MinutesRemaining: 999999,
                IsActive: true,
                ShopName: 'Admin',
                message: 'Admin account - no license required'
            });
        }
        
        if (userRole === 'staff') {
            // Staff: Get license from their outlet
            const result = await pool.request()
                .input('userId', sql.Int, userId)
                .query(`
                    SELECT 
                        l.LicenseKey,
                        l.ExpiryDate,
                        DATEDIFF(minute, GETUTCDATE(), 
                            DATEADD(hour, -5, DATEADD(minute, -30, l.ExpiryDate))
                        ) as MinutesRemaining,
                        l.IsActive,
                        o.OutletName as ShopName
                    FROM Users u
                    JOIN Outlets o ON u.OutletId = o.Id
                    JOIN Licenses l ON o.Id = l.OutletId
                    WHERE u.Id = @userId
                `);
            
            if (result.recordset.length === 0) {
                return res.status(404).json({ error: 'License not found' });
            }
            
            console.log(`✅ License status for staff ${userId}:`, {
                minutesLeft: result.recordset[0].MinutesRemaining
            });
            
            return res.json(result.recordset[0]);
        }
        
        // Owner
        return res.json({
            LicenseKey: 'OWNER-ACCOUNT',
            ExpiryDate: null,
            MinutesRemaining: 999999,
            IsActive: true,
            ShopName: req.user.username,
            message: 'Owner account - no license required'
        });
        
    } catch (err) {
        console.error('❌ Error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;