// backend/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { 
    login, 
    register, 
    getProfile, 
    changePassword,
    getLicenseStatus 
} = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// Public routes
router.post('/login', login);

// Protected routes
router.get('/profile', authenticateToken, getProfile);
router.post('/change-password', authenticateToken, changePassword);
router.get('/license/status', authenticateToken, getLicenseStatus);

// Disabled register
router.post('/register', (req, res) => {
    res.status(403).json({ error: 'Registration disabled. Use admin panel.' });
});

module.exports = router;