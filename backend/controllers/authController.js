// backend/controllers/authController.js
const { getPool, sql } = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';

// Register new user
const register = async (req, res) => {
    try {
        const { username, password, role, fullName, email } = req.body;

        // Check if user exists
        const pool = getPool();
        const existingUser = await pool.request()
            .input('username', sql.NVarChar, username)
            .query('SELECT Id FROM Users WHERE Username = @username');

        if (existingUser.recordset.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert new user
        const result = await pool.request()
            .input('username', sql.NVarChar, username)
            .input('passwordHash', sql.NVarChar, hashedPassword)
            .input('role', sql.NVarChar, role || 'staff')
            .input('fullName', sql.NVarChar, fullName || username)
            .input('email', sql.NVarChar, email || '')
            .query(`
                INSERT INTO Users (Username, PasswordHash, Role, FullName, Email)
                OUTPUT INSERTED.Id, INSERTED.Username, INSERTED.Role, INSERTED.FullName, INSERTED.Email
                VALUES (@username, @passwordHash, @role, @fullName, @email)
            `);

        const newUser = result.recordset[0];
        
        // Create token
        const token = jwt.sign(
            { id: newUser.Id, username: newUser.Username, role: newUser.Role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            token,
            user: {
                id: newUser.Id,
                username: newUser.Username,
                role: newUser.Role,
                fullName: newUser.FullName,
                email: newUser.Email
            }
        });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Registration failed' });
    }
};

// Login user
const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const pool = getPool();
        
        // ✅ First, update expired licenses
        await pool.request()
            .query('UPDATE Licenses SET IsActive = 0 WHERE ExpiryDate < GETDATE()');
        
        // ✅ Get user with license info
        const result = await pool.request()
            .input('username', sql.NVarChar, username)
            .query(`
                SELECT 
                    u.Id, 
                    u.Username, 
                    u.PasswordHash, 
                    u.Role, 
                    u.FullName, 
                    u.Email, 
                    u.IsActive,
                    u.OwnerId,
                    u.OutletId,
                    u.ShopName,
                    
                    CASE 
                        WHEN u.Role = 'owner' THEN NULL
                        ELSE l.ExpiryDate
                    END as ExpiryDate,
                    
                    CASE 
                        WHEN u.Role = 'owner' THEN NULL
                        ELSE l.LicenseKey
                    END as LicenseKey,
                    
                    CASE 
                        WHEN u.Role = 'owner' THEN 1
                        ELSE l.IsActive
                    END as LicenseActive
                    
                FROM Users u
                LEFT JOIN Outlets o ON u.OutletId = o.Id
                LEFT JOIN Licenses l ON o.Id = l.OutletId
                WHERE u.Username = @username
            `);

        if (result.recordset.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const user = result.recordset[0];

        // Compare password
        const isMatch = await bcrypt.compare(password, user.PasswordHash);
        
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // ✅ Check if user is active
        if (!user.IsActive) {
            return res.status(401).json({ error: 'Account deactivated' });
        }

        // ✅ Check license for staff only
        if (user.Role === 'staff') {
            if (user.ExpiryDate && new Date(user.ExpiryDate) < new Date()) {
                return res.status(403).json({ 
                    error: 'License expired',
                    code: 'LICENSE_EXPIRED',
                    message: 'Your license has expired. Please contact admin.'
                });
            }
        }

        // ✅✅✅ SESSION MANAGEMENT - BLOCK MULTIPLE LOGINS ✅✅✅
        const existingSession = await pool.request()
            .input('userId', sql.Int, user.Id)
            .input('isActive', sql.Bit, 1)
            .query(`
                SELECT Id, DeviceInfo, LoginTime, SessionToken
                FROM UserSessions 
                WHERE UserId = @userId AND IsActive = @isActive
            `);

        // ✅ If active session exists, BLOCK login
        if (existingSession.recordset.length > 0) {
            const session = existingSession.recordset[0];
            const loginTime = new Date(session.LoginTime).toLocaleString();
            const deviceInfo = session.DeviceInfo || 'Unknown Device';
            
            console.log(`⚠️ Login BLOCKED - User ${user.Username} already logged in on: ${deviceInfo} at ${loginTime}`);
            
            return res.status(403).json({ 
                error: 'ALREADY_LOGGED_IN',
                message: `⚠️ Already Logged In!\n\nYou are already logged in on another device:\n📱 Device: ${deviceInfo}\n⏰ Time: ${loginTime}\n\nPlease logout from that device first.`,
                code: 'SESSION_ACTIVE'
            });
        }

        // ✅ Update last login
        await pool.request()
            .input('userId', sql.Int, user.Id)
            .query('UPDATE Users SET LastLoginDate = GETDATE() WHERE Id = @userId');

        // Generate token
        const token = jwt.sign(
            { id: user.Id, username: user.Username, role: user.Role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // ✅ Get device info (from request headers)
        const deviceInfo = req.headers['user-agent'] || 'Unknown Device';
        
        // ✅ Create new session
        await pool.request()
            .input('userId', sql.Int, user.Id)
            .input('sessionToken', sql.NVarChar, token)
            .input('deviceInfo', sql.NVarChar, deviceInfo)
            .input('isActive', sql.Bit, 1)
            .input('lastActivity', sql.DateTime, new Date())
            .query(`
                INSERT INTO UserSessions (UserId, SessionToken, DeviceInfo, IsActive, LoginTime, LastActivity)
                VALUES (@userId, @sessionToken, @deviceInfo, @isActive, GETDATE(), @lastActivity)
            `);

        console.log(`✅ New session created for ${user.Username} on device: ${deviceInfo}`);

        // ========== OWNER LOGIN - Return outlets ==========
        if (user.Role === 'owner') {
            const outlets = await pool.request()
                .input('ownerId', sql.Int, user.Id)
                .query(`
                    SELECT 
                        o.Id,
                        o.OutletName as name,
                        o.Address,
                        o.Phone,
                        s.Username as staffUsername,
                        l.LicenseKey,
                        l.ExpiryDate,
                        CASE WHEN l.ExpiryDate < GETDATE() THEN 0 ELSE 1 END as LicenseActive
                    FROM Outlets o
                    LEFT JOIN Users s ON o.StaffId = s.Id
                    LEFT JOIN Licenses l ON o.Id = l.OutletId
                    WHERE o.OwnerId = @ownerId AND o.IsActive = 1
                    ORDER BY o.OutletName
                `);

            console.log(`✅ Owner login: ${user.Username} with ${outlets.recordset.length} outlets`);

            return res.json({
                token,
                user: {
                    id: user.Id,
                    username: user.Username,
                    role: user.Role,
                    fullName: user.FullName,
                    email: user.Email,
                    shopName: user.ShopName
                },
                outlets: outlets.recordset,
                requiresOutlet: true
            });
        }

        // ========== STAFF LOGIN ==========
        if (user.Role === 'staff') {
            console.log(`✅ Staff login: ${user.Username} for outlet ${user.OutletId}`);

            return res.json({
                token,
                user: {
                    id: user.Id,
                    username: user.Username,
                    role: user.Role,
                    fullName: user.FullName,
                    email: user.Email,
                    shopName: user.ShopName,
                    outletId: user.OutletId,
                    ownerId: user.OwnerId,
                      licenseKey: user.LicenseKey,     // ← ADD THIS
            expiryDate: user.ExpiryDate 
                },
                requiresOutlet: false
            });
        }

        // ========== ADMIN LOGIN ==========
        console.log(`✅ Admin login: ${user.Username}`);

        res.json({
            token,
            user: {
                id: user.Id,
                username: user.Username,
                role: user.Role,
                fullName: user.FullName,
                email: user.Email
            }
        });

    } catch (err) {
        console.error('❌ Login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
};
const logout = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (token) {
            const pool = getPool();
            
            // Deactivate session
            await pool.request()
                .input('sessionToken', sql.NVarChar, token)
                .query(`
                    UPDATE UserSessions 
                    SET IsActive = 0 
                    WHERE SessionToken = @sessionToken
                `);
            
            console.log(`✅ Session deactivated for token: ${token.substring(0, 20)}...`);
        }
        
        res.json({ success: true, message: 'Logged out successfully' });
        
    } catch (err) {
        console.error('Logout error:', err);
        res.status(500).json({ error: 'Logout failed' });
    }
};

// Get current user profile
const getProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const pool = getPool();

        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT 
                    u.Id, 
                    u.Username, 
                    u.Role, 
                    u.FullName, 
                    u.Email, 
                    u.CreatedDate, 
                    u.LastLoginDate,
                    u.OwnerId,
                    u.OutletId,
                    u.ShopName,
                    o.OutletName
                FROM Users u
                LEFT JOIN Outlets o ON u.OutletId = o.Id
                WHERE u.Id = @userId
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(result.recordset[0]);
    } catch (err) {
        console.error('Profile error:', err);
        res.status(500).json({ error: 'Failed to get profile' });
    }
};
const getLicenseStatus = async (req, res) => {
    try {
        const pool = getPool();
        const userId = req.user.id;
        const userRole = req.user.role;
        
        if (userRole === 'admin') {
            return res.json({
                LicenseKey: 'ADMIN',
                ExpiryDate: null,
                MinutesRemaining: 999999,
                IsActive: true,
                ShopName: 'Admin',
                message: 'Admin account - no license'
            });
        }
        
        if (userRole === 'owner') {
            return res.json({
                LicenseKey: 'OWNER',
                ExpiryDate: null,
                MinutesRemaining: 999999,
                IsActive: true,
                ShopName: req.user.username,
                message: 'Owner account - no license'
            });
        }
        
        // Staff: Get license from outlet
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT 
                    l.LicenseKey,
                    l.ExpiryDate,
                    DATEDIFF(minute, GETDATE(), l.ExpiryDate) as MinutesRemaining,
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
        
        res.json(result.recordset[0]);
        
    } catch (err) {
        console.error('❌ License status error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================
// REGISTER (DISABLED for multi-outlet)
// ============================================

// Change password
const changePassword = async (req, res) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        const pool = getPool();

        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT PasswordHash FROM Users WHERE Id = @userId');

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.recordset[0];

        const isMatch = await bcrypt.compare(currentPassword, user.PasswordHash);
        
        if (!isMatch) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await pool.request()
            .input('userId', sql.Int, userId)
            .input('passwordHash', sql.NVarChar, hashedPassword)
            .query('UPDATE Users SET PasswordHash = @passwordHash WHERE Id = @userId');

        res.json({ message: 'Password changed successfully' });
    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({ error: 'Failed to change password' });
    }
};

module.exports = {
    register,
    login,
     getProfile,
    changePassword,
    getLicenseStatus,
     logout
};