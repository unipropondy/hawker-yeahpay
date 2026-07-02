const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// SEND SETTLEMENT EMAIL
// ============================================
// ✅ In emailRoutes.js - POST /send-settlement-email
router.post('/send-settlement-email', authenticateToken, async (req, res) => {
    try {
        const { to, subject, pdfBase64, csvData, outletName, cashierName, date } = req.body;
        
        // ✅ Validate email
        if (!to || !to.includes('@')) {
            return res.status(400).json({ error: 'Invalid email address' });
        }
        
        const transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE || 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            tls: {
                rejectUnauthorized: false
            }
        });
        
        const attachments = [];
        
        if (pdfBase64) {
            attachments.push({
                filename: `Settlement_Report_${date}.pdf`,
                content: pdfBase64,
                encoding: 'base64'
            });
        }
        
        // ✅ Handle CSV as string
        if (csvData) {
            attachments.push({
                filename: `Settlement_Report_${date}.csv`,
                content: csvData,
                contentType: 'text/csv'
            });
        }
        
        const mailOptions = {
            from: `"${outletName} POS" <${process.env.EMAIL_USER}>`,
            to: to,
            subject: subject || `Settlement Report - ${outletName}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                    <h2 style="color: #333; text-align: center; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">
                        📊 Settlement Report - ${outletName}
                    </h2>
                    
                    <div style="padding: 10px 0;">
                        <p><strong>👤 Cashier:</strong> ${cashierName || 'System'}</p>
                        <p><strong>📅 Date:</strong> ${date || new Date().toLocaleDateString()}</p>
                        <p><strong>🕐 Time:</strong> ${new Date().toLocaleTimeString()}</p>
                    </div>
                    
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
                        <p style="margin: 0;">Please find attached the settlement report for your review.</p>
                    </div>
                    
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                    
                    <div style="text-align: center; color: #666; font-size: 12px;">
                        <p>This is an auto-generated email from Smart Hawker POS System.</p>
                        <p>© ${new Date().getFullYear()} UNIPRO SOFTWARES SG PTE LTD</p>
                    </div>
                </div>
            `,
            attachments: attachments
        };
        
        const info = await transporter.sendMail(mailOptions);
        
        console.log(`✅ Email sent to ${to} - Message ID: ${info.messageId}`);
        res.json({ 
            success: true, 
            message: 'Email sent successfully',
            messageId: info.messageId 
        });
        
    } catch (err) {
        console.error('❌ Email error:', err);
        res.status(500).json({ 
            error: err.message,
            details: 'Failed to send email. Please check email configuration.'
        });
    }
});
// ============================================
// TEST EMAIL CONFIGURATION
// ============================================
router.get('/test-email-config', authenticateToken, async (req, res) => {
    try {
        // ✅ Check if email config is set
        const hasUser = !!process.env.EMAIL_USER;
        const hasPass = !!process.env.EMAIL_PASS;
        const hasService = !!process.env.EMAIL_SERVICE;
        
        res.json({
            success: true,
            config: {
                service: hasService ? process.env.EMAIL_SERVICE : 'Not set',
                user: hasUser ? '✅ Set' : '❌ Missing',
                pass: hasPass ? '✅ Set' : '❌ Missing',
                status: (hasUser && hasPass && hasService) ? '✅ Ready' : '❌ Incomplete'
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;