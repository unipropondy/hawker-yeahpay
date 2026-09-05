const { getPool, sql } = require('../config/db');
const moment = require('moment-timezone');
// ============================================
// GET DAY END STATUS
// ============================================
const getDayEndStatus = async (req, res) => {
    try {
        const outletId = req.outletId;
        const pool = getPool();
        
        console.log(`📅 Getting day end status for outlet ${outletId}`);
        
        const result = await pool.request()
            .input('outletId', sql.Int, outletId)
            .query(`
                SELECT 
                    IsDayEnded,
                    CONVERT(varchar, CurrentDayStart, 126) as CurrentDayStart,
                    LastDayEndId,
                    (SELECT COUNT(*) FROM Sales 
                     WHERE OutletId = @outletId 
                       AND (DayEndId IS NULL OR DayEndId = 0)
                       AND (Status IS NULL OR Status = 'COMPLETED')) as PendingSales,
                    (SELECT COUNT(*) FROM Sales 
                     WHERE OutletId = @outletId 
                       AND (DayEndId IS NULL OR DayEndId = 0)
                       AND Status = 'VOIDED') as PendingVoidedSales,
                    (SELECT ISNULL(SUM(Total), 0) FROM Sales 
                     WHERE OutletId = @outletId 
                       AND (DayEndId IS NULL OR DayEndId = 0)
                       AND Status = 'VOIDED') as PendingVoidedAmount
                FROM Outlets 
                WHERE Id = @outletId
            `);
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Outlet not found' });
        }
        
        const status = result.recordset[0];
        
        // ✅ Convert SQL BIT to proper boolean
        const isDayEnded = status.IsDayEnded === 1 || status.IsDayEnded === true;
        
        console.log('📊 Day End Status:', {
            rawIsDayEnded: status.IsDayEnded,
            convertedIsDayEnded: isDayEnded,
            pendingSales: status.PendingSales,
            pendingVoidedSales: status.PendingVoidedSales,
            lastDayEndId: status.LastDayEndId
        });
        
        res.json({
            success: true,
            isDayEnded: isDayEnded,  // ✅ Returns true or false
            currentDayStart: status.CurrentDayStart,
            pendingSales: status.PendingSales || 0,
            pendingVoidedSales: status.PendingVoidedSales || 0,
            pendingVoidedAmount: parseFloat(status.PendingVoidedAmount) || 0,
            lastDayEnd: status.LastDayEndId || null
        });
        
    } catch (err) {
        console.error('❌ Day end status error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================
// PERFORM DAY END
// ============================================
const performDayEnd = async (req, res) => {
    try {
        const outletId = req.outletId;
        const userId = req.user.id;
        
        console.log(`📅 Performing Day End for outlet ${outletId}`);
        
        const pool = await getPool();
        
        // ✅ Get ALL pending sales
        const salesResult = await pool.request()
            .input('outletId', sql.Int, outletId)
            .query(`
                SELECT 
                    Id,
                    Total,
                    PaymentMethod,
                    DiscountAmount,
                    ItemsJson,
                    CONVERT(varchar, SaleDate, 126) as SaleDateStr,
                    SaleDate
                FROM Sales 
                WHERE OutletId = @outletId 
                  AND (DayEndId IS NULL OR DayEndId = 0)
                  AND (Status IS NULL OR Status = 'COMPLETED')
                ORDER BY SaleDate ASC
            `);
        
        const sales = salesResult.recordset;

        // ✅ Get pending voided sales
        const voidedSalesResult = await pool.request()
            .input('outletId', sql.Int, outletId)
            .query(`
                SELECT 
                    Id, Total, InvoiceNumber, VoidReason, VoidedBy,
                    CONVERT(varchar, SaleDate, 126) as SaleDateStr
                FROM Sales 
                WHERE OutletId = @outletId 
                  AND (DayEndId IS NULL OR DayEndId = 0)
                  AND Status = 'VOIDED'
                ORDER BY SaleDate ASC
            `);

        const pendingVoidedSales = (voidedSalesResult.recordset || []).map(v => ({
            id: v.Id,
            total: parseFloat(v.Total) || 0,
            invoiceNumber: v.InvoiceNumber || '',
            date: v.SaleDateStr,
            voidReason: v.VoidReason || 'N/A',
            voidedBy: v.VoidedBy || 'Staff'
        }));
        const totalVoidedAmount = pendingVoidedSales.reduce((s, v) => s + (v.total || 0), 0);
        
        console.log(`📊 Found ${sales.length} pending completed sales, ${pendingVoidedSales.length} voided sales`);
        
        if (sales.length === 0 && pendingVoidedSales.length === 0) {
            return res.status(400).json({ 
                error: 'No pending sales',
                message: 'No sales found to end day' 
            });
        }
        
        // ✅ Calculate totals
        let totalSales = 0;
        let totalDiscount = 0;
        let totalItems = 0;
        const paymentBreakdown = {};
        const categoryMap = {};
        
        sales.forEach(sale => {
            totalSales += parseFloat(sale.Total) || 0;
            totalDiscount += parseFloat(sale.DiscountAmount) || 0;
            
            const method = sale.PaymentMethod || 'Unknown';
            paymentBreakdown[method] = (paymentBreakdown[method] || 0) + parseFloat(sale.Total) || 0;
            
            try {
                let itemsArray = [];
                const parsed = JSON.parse(sale.ItemsJson || '{}');
                
                if (parsed.items && Array.isArray(parsed.items)) {
                    itemsArray = parsed.items;
                } else if (Array.isArray(parsed)) {
                    itemsArray = parsed;
                }
                
                itemsArray.forEach(item => {
                    const quantity = item.quantity || 1;
                    totalItems += quantity;
                });
                
                itemsArray.forEach(item => {
                    const category = item.displayCategory || item.category || 'Uncategorized';
                    const itemName = item.name || 'Unknown';
                    const quantity = item.quantity || 1;
                    const price = item.price || 0;
                    const revenue = price * quantity;
                    
                    if (!categoryMap[category]) {
                        categoryMap[category] = {
                            totalRevenue: 0,
                            totalQuantity: 0,
                            items: {}
                        };
                    }
                    
                    if (!categoryMap[category].items[itemName]) {
                        categoryMap[category].items[itemName] = {
                            quantity: 0,
                            revenue: 0
                        };
                    }
                    
                    categoryMap[category].items[itemName].quantity += quantity;
                    categoryMap[category].items[itemName].revenue += revenue;
                    categoryMap[category].totalRevenue += revenue;
                    categoryMap[category].totalQuantity += quantity;
                });
                
            } catch (e) {
                console.log('Error parsing items for sale:', sale.Id);
            }
        });
        
        const netSales = totalSales - totalDiscount;
        
        const categoriesArray = Object.keys(categoryMap).map(catName => ({
            name: catName,
            totalRevenue: categoryMap[catName].totalRevenue,
            totalQuantity: categoryMap[catName].totalQuantity,
            items: Object.keys(categoryMap[catName].items).map(itemName => ({
                name: itemName,
                quantity: categoryMap[catName].items[itemName].quantity,
                revenue: categoryMap[catName].items[itemName].revenue
            }))
        })).sort((a, b) => b.totalRevenue - a.totalRevenue);
        
        // ✅✅✅ GET SINGAPORE TIME ✅✅✅
        const transaction = pool.transaction();
        await transaction.begin();
        
        try {
            // 1️⃣ Create Day End Log - Use GETDATE() for ClosingDate and CreatedAt
            const dayEndResult = await transaction.request()
                .input('outletId', sql.Int, outletId)
                .input('closedBy', sql.Int, userId)
                .input('openingDate', sql.DateTime, sales[0]?.SaleDate || new Date())
                .input('totalSales', sql.Decimal(10,2), totalSales)
                .input('totalDiscount', sql.Decimal(10,2), totalDiscount)
                .input('totalItems', sql.Int, totalItems)
                .input('netSales', sql.Decimal(10,2), netSales)
                .input('paymentBreakdown', sql.NVarChar, JSON.stringify(paymentBreakdown))
                .input('categories', sql.NVarChar, JSON.stringify(categoriesArray))
                .query(`
                    INSERT INTO DayEndLogs (
                        OutletId, ClosedBy, OpeningDate, ClosingDate,
                        TotalSales, TotalDiscount, TotalItems, NetSales, 
                        PaymentBreakdown, Categories, CreatedAt
                    )
                    OUTPUT INSERTED.Id
                    VALUES (
                        @outletId, @closedBy, @openingDate, 
                        GETDATE(),  -- ✅ ClosingDate = Current Server Time
                        @totalSales, @totalDiscount, @totalItems, @netSales,
                        @paymentBreakdown, @categories, 
                        GETDATE()   -- ✅ CreatedAt = Current Server Time
                    )
                `);
            
            const dayEndId = dayEndResult.recordset[0].Id;
            
            // 2️⃣ Update ALL pending sales (both completed and voided) with DayEndId
            await transaction.request()
                .input('outletId', sql.Int, outletId)
                .input('dayEndId', sql.Int, dayEndId)
                .query(`
                    UPDATE Sales 
                    SET DayEndId = @dayEndId 
                    WHERE OutletId = @outletId 
                      AND (DayEndId IS NULL OR DayEndId = 0)
                `);
            
            // 3️⃣ Update Outlet
            await transaction.request()
                .input('outletId', sql.Int, outletId)
                .input('dayEndId', sql.Int, dayEndId)
                .query(`
                    UPDATE Outlets 
                    SET LastDayEndId = @dayEndId,
                        IsDayEnded = 1,
                        CurrentDayStart = GETDATE()  -- ✅ Current Server Time
                    WHERE Id = @outletId
                `);
            
            await transaction.commit();
            
            console.log(`✅ Day End completed for outlet ${outletId}`);
            
            res.json({
                success: true,
                message: 'Day end completed successfully',
                dayEnd: {
                    id: dayEndId,
                    totalSales,
                    totalDiscount,
                    totalItems,
                    netSales,
                    paymentBreakdown,
                    categories: categoriesArray,
                    salesCount: sales.length,
                    voidedSales: pendingVoidedSales,
                    voidedCount: pendingVoidedSales.length,
                    totalVoidedAmount: totalVoidedAmount,
                    startDate: sales[0]?.SaleDateStr || sales[0]?.SaleDate,
                    endDate: moment().tz('Asia/Singapore').format('YYYY-MM-DDTHH:mm:ss'),
                    closingDate: moment().tz('Asia/Singapore').format('YYYY-MM-DDTHH:mm:ss')
                }
            });
            
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Day end transaction failed:', error);
            throw error;
        }
        
    } catch (err) {
        console.error('❌ Day end error:', err);
        res.status(500).json({ error: err.message });
    }
};


// ============================================
// START NEW DAY
// ============================================
const startNewDay = async (req, res) => {
    try {
        const outletId = req.outletId;
        const pool = getPool();
        
        await pool.request()
            .input('outletId', sql.Int, outletId)
            .query(`
                UPDATE Outlets 
                SET IsDayEnded = 0,
                    CurrentDayStart = GETUTCDATE()
                WHERE Id = @outletId
            `);
        
        res.json({
            success: true,
            message: 'New day started successfully',
            startTime: new Date().toISOString()
        });
        
    } catch (err) {
        console.error('❌ Start new day error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================
// GET DAY END HISTORY
// ============================================
const getDayEndHistory = async (req, res) => {
    try {
        const outletId = req.outletId;
        const { limit = 30 } = req.query;
        
        const pool = getPool();
        
        const result = await pool.request()
            .input('outletId', sql.Int, outletId)
            .input('limit', sql.Int, parseInt(limit))
            .query(`
                SELECT TOP (@limit)
                    d.Id as DayEndId,
                    CONVERT(varchar, d.OpeningDate, 126) as OpeningDateStr,
                    CONVERT(varchar, d.ClosingDate, 126) as ClosingDateStr,
                    d.TotalSales,
                    d.TotalDiscount,
                    d.TotalItems,
                    d.NetSales,
                    d.PaymentBreakdown,
                    d.Categories,
                    CONVERT(varchar, d.CreatedAt, 126) as CreatedAtStr,
                    u.Username as ClosedByName,
                    (SELECT COUNT(*) FROM Sales WHERE DayEndId = d.Id AND (Status IS NULL OR Status = 'COMPLETED')) as SalesCount
                FROM DayEndLogs d
                LEFT JOIN Users u ON d.ClosedBy = u.Id
                WHERE d.OutletId = @outletId
                ORDER BY d.Id DESC
            `);
        
        const historyList = [];
        for (const row of result.recordset) {
            const voidedRes = await pool.request()
                .input('dayEndId', sql.Int, row.DayEndId)
                .query(`
                    SELECT s.Id, s.Total, s.InvoiceNumber, 
                           CONVERT(varchar, s.SaleDate, 126) as SaleDateStr, 
                           CONVERT(varchar, s.VoidedAt, 126) as VoidedAtStr,
                           s.VoidReason, s.VoidedBy, u.Username as VoidedByName
                    FROM Sales s
                    LEFT JOIN Users u ON (TRY_CAST(s.VoidedBy as INT) IS NOT NULL AND u.Id = TRY_CAST(s.VoidedBy as INT)) OR s.VoidedBy = u.Username
                    WHERE s.DayEndId = @dayEndId AND s.Status = 'VOIDED'
                    ORDER BY s.SaleDate ASC
                `);
            
            const voidedSales = (voidedRes.recordset || []).map(v => ({
                id: v.Id,
                total: parseFloat(v.Total) || 0,
                invoiceNumber: v.InvoiceNumber || '',
                date: v.SaleDateStr,
                voidedAt: v.VoidedAtStr || v.SaleDateStr,
                voidReason: v.VoidReason || 'N/A',
                voidedBy: v.VoidedByName || v.VoidedBy || 'Staff'
            }));

            const totalVoidedAmount = voidedSales.reduce((s, v) => s + (v.total || 0), 0);

            historyList.push({
                id: row.DayEndId,
                openingDate: row.OpeningDateStr,
                closingDate: row.ClosingDateStr,
                totalSales: row.TotalSales,
                totalDiscount: row.TotalDiscount,
                totalItems: row.TotalItems,
                netSales: row.NetSales,
                salesCount: row.SalesCount || 0,
                paymentBreakdown: JSON.parse(row.PaymentBreakdown || '{}'),
                categories: JSON.parse(row.Categories || '[]'),
                closedBy: row.ClosedByName,
                createdAt: row.CreatedAtStr,
                voidedSales: voidedSales,
                voidedCount: voidedSales.length,
                totalVoidedAmount: totalVoidedAmount
            });
        }

        res.json({
            success: true,
            history: historyList
        });
    } catch (err) {
        console.error('❌ Day end history error:', err);
        res.status(500).json({ error: err.message });
    }
};
module.exports = {
    getDayEndStatus,
    performDayEnd,
    getDayEndHistory,
    startNewDay
};