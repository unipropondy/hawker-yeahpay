const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const yeahpayService = require('../services/yeahpay.service');

const FIXED_APP_ID = process.env.YEAHPAY_APP_ID;

// YeahPay Card Payment
router.post('/card-payment', authenticateToken, async (req, res) => {
    try {
        const { amount, deviceSn, salt } = req.body;
        
        console.log('💳 YeahPay Card:', { amount, deviceSn });
        
        const result = await yeahpayService.processCardPayment({
            amount, deviceSn, salt, appId: FIXED_APP_ID
        });
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, code: -1, msg: error.message });
    }
});

// YeahPay PayNow Payment
router.post('/paynow-payment', authenticateToken, async (req, res) => {
    try {
        const { amount, deviceSn, salt } = req.body;
        
        console.log('📱 YeahPay PayNow:', { amount, deviceSn });
        
        const result = await yeahpayService.processPayNowPayment({
            amount, deviceSn, salt, appId: FIXED_APP_ID
        });
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, code: -1, msg: error.message });
    }
});

module.exports = router;