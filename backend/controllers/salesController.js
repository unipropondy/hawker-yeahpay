// backend/controllers/salesController.js
const { getPool, sql } = require('../config/db');

// ============================================
// HELPER FUNCTION - Get effective OUTLET ID
// ============================================
const getEffectiveOutletId = async (req) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // For staff: get their outlet ID
    if (userRole === 'staff') {
        const pool = getPool();
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT OutletId FROM Users WHERE Id = @userId');
        
        if (result.recordset.length > 0 && result.recordset[0].OutletId) {
            return result.recordset[0].OutletId;
        }
    }
    
    // For owner: get from body or query
    if (userRole === 'owner') {
        return req.body.outletId || req.query.outletId;
    }
    
    return null;
};
// ============================================
// CREATE sale (UPDATED)
// ============================================
const createSale = async (req, res) => {
    try {
        const { 
            total, 
            paymentMethod, 
            items, 
            cashPaid, 
            change,
            
            // ✅ NEW DISCOUNT FIELDS
            discountType,
            discountValue,
            discountAmount,
            originalTotal
        } = req.body;
        
        // ✅ Get outlet ID
        const outletId = req.outletId;
        
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        // Process items
        const itemsWithCategory = items.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            category: item.category || item.displayCategory || 'Uncategorized',
            displayCategory: item.displayCategory || item.category || 'Uncategorized',
            originalCategory: item.originalCategory || item.category
        }));
        
        const itemsJson = JSON.stringify(itemsWithCategory);
        
        const pool = getPool();
        
        // ✅ Check if discount columns exist (for backward compatibility)
        const tableCheck = await pool.request().query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Sales' 
            AND COLUMN_NAME IN ('DiscountType', 'DiscountValue', 'DiscountAmount')
        `);
        
        const hasDiscountColumns = tableCheck.recordset.length >= 3;
        
        let query = '';
        let request = pool.request()
            .input('total', sql.Decimal(10,2), total)
            .input('paymentMethod', sql.NVarChar, paymentMethod)
            .input('itemsJson', sql.NVarChar, itemsJson)
            .input('cashPaid', sql.Decimal(10,2), cashPaid || null)
            .input('changeAmount', sql.Decimal(10,2), change || null)
            .input('outletId', sql.Int, outletId);
        
        if (hasDiscountColumns) {
            // ✅ With discount columns
            request = request
                .input('discountType', sql.NVarChar, discountType || null)
                .input('discountValue', sql.Decimal(10,2), discountValue || null)
                .input('discountAmount', sql.Decimal(10,2), discountAmount || null);
            
            query = `
                INSERT INTO Sales (
                    Total, PaymentMethod, ItemsJson, 
                    CashPaid, ChangeAmount, OutletId,
                    DiscountType, DiscountValue, DiscountAmount,
            Status
                )
                OUTPUT INSERTED.Id, INSERTED.Total, INSERTED.PaymentMethod, 
                       INSERTED.SaleDate, INSERTED.DiscountType, 
                       INSERTED.DiscountValue, INSERTED.DiscountAmount
                VALUES (
                    @total, @paymentMethod, @itemsJson,
                    @cashPaid, @changeAmount, @outletId,
                    @discountType, @discountValue, @discountAmount,
            'COMPLETED'
                )
            `;
        } else {
            // ✅ Without discount columns (fallback)
            query = `
                INSERT INTO Sales (
                    Total, PaymentMethod, ItemsJson, 
                    CashPaid, ChangeAmount, OutletId,
            Status
                )
                OUTPUT INSERTED.Id, INSERTED.Total, INSERTED.PaymentMethod, INSERTED.SaleDate
                VALUES (
                    @total, @paymentMethod, @itemsJson,
                    @cashPaid, @changeAmount, @outletId,
            'COMPLETED'
                )
            `;
        }
        
        const result = await request.query(query);

        // ✅ Build response with discount info
        const newSale = {
            id: result.recordset[0].Id,
            total: result.recordset[0].Total,
            paymentMethod: result.recordset[0].PaymentMethod,
            date: result.recordset[0].SaleDate,
            items: itemsWithCategory
        };
        
        // ✅ Add discount info if present
        if (hasDiscountColumns && discountAmount) {
            newSale.discount = {
                type: discountType,
                value: discountValue,
                amount: discountAmount
            };
            
            console.log(`💰 Discount applied: ${discountType === 'percentage' ? discountValue + '%' : '$' + discountValue} = $${discountAmount}`);
        }
        
        console.log(`✅ ${req.user.role} ${req.user.id} created sale for outlet ${outletId}${discountAmount ? ' with discount' : ''}`);
        res.status(201).json(newSale);
        
    } catch (err) {
        console.error('❌ Error:', err);
        res.status(500).json({ error: err.message });
    }
};
const voidSale = async (req, res) => {
    try {
        const { saleId, password, reason } = req.body;
        const outletId = req.outletId;
        const userId = req.user.id;
        const userRole = req.user.role;
        
        if (!saleId || !password) {
            return res.status(400).json({ error: 'Sale ID and password required' });
        }
        
        const pool = getPool();

        // 1️⃣ Get the sale
        const saleResult = await pool.request()
            .input('saleId', sql.Int, saleId)
            .input('outletId', sql.Int, outletId)
            .query(`
                SELECT s.*
                FROM Sales s
                WHERE s.Id = @saleId AND s.OutletId = @outletId
            `);
        
        if (saleResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Sale not found' });
        }
        
        const sale = saleResult.recordset[0];
        
        // 2️⃣ Check if already voided
        if (sale.Status === 'VOIDED') {
            return res.status(400).json({ error: 'Sale already voided' });
        }
        
        // 3️⃣ Get outlet's void password
        const outletResult = await pool.request()
            .input('outletId', sql.Int, outletId)
            .query(`
                SELECT 
                    o.VoidPassword,
                    o.VoidPasswordEnabled,
                    o.OutletName,
                    u.Username as OwnerName
                FROM Outlets o
                LEFT JOIN Users u ON o.OwnerId = u.Id
                WHERE o.Id = @outletId
            `);
        
        if (outletResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Outlet not found' });
        }
        
        const outlet = outletResult.recordset[0];
        
        // 4️⃣ Check if void password is enabled
        if (!outlet.VoidPasswordEnabled) {
            return res.status(403).json({ error: 'Void password not enabled for this outlet' });
        }
        
        if (!outlet.VoidPassword) {
            return res.status(403).json({ error: 'Void password not set. Please contact owner.' });
        }
        
        // 5️⃣ Verify password against outlet's void password
        const bcrypt = require('bcryptjs');
        const isMatch = await bcrypt.compare(password, outlet.VoidPassword);
        
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid void password' });
        }
        
        // 6️⃣ Add void columns if they don't exist
        const checkVoidColumns = await pool.request().query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Sales' 
            AND COLUMN_NAME = 'Status'
        `);
        
        if (checkVoidColumns.recordset.length === 0) {
            await pool.request().query(`
                ALTER TABLE Sales ADD 
                    Status VARCHAR(20) DEFAULT 'COMPLETED',
                    VoidedBy INT NULL,
                    VoidedAt DATETIME NULL,
                    VoidReason VARCHAR(255) NULL
            `);
        }
        
        // 7️⃣ Void the sale
        await pool.request()
            .input('saleId', sql.Int, saleId)
            .input('voidedBy', sql.Int, userId)
            .input('voidReason', sql.NVarChar, reason || 'Voided by user')
            .query(`
                UPDATE Sales 
                SET Status = 'VOIDED',
                    VoidedBy = @voidedBy,
                    VoidedAt = GETDATE(),
                    VoidReason = @voidReason
                WHERE Id = @saleId
            `);
        
        console.log(`✅ Sale ${saleId} voided for outlet ${outletId} (${outlet.OutletName})`);
        res.json({ 
            success: true, 
            message: 'Sale voided successfully',
            voidedSale: {
                id: saleId,
                status: 'VOIDED',
                voidedAt: new Date(),
                outletName: outlet.OutletName
            }
        });
        
    } catch (err) {
        console.error('❌ Void error:', err);
        res.status(500).json({ error: err.message });
    }
};
// ============================================
// GET sales (UPDATED)
// ============================================
const getSales = async (req, res) => {
    try {
        const { filter, startDate, endDate, status } = req.query; // ✅ ADD status param
        
        const outletId = req.outletId;
        
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        const pool = getPool();

        // ✅ Check if discount columns exist
        const checkColumns = await pool.request().query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Sales' 
            AND COLUMN_NAME IN ('DiscountType', 'DiscountValue', 'DiscountAmount')
        `);
        
        const hasDiscountColumns = checkColumns.recordset.length >= 3;
        
        // ✅ Check if void columns exist (for backward compatibility)
        const checkVoidColumns = await pool.request().query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Sales' 
            AND COLUMN_NAME IN ('Status', 'VoidedBy', 'VoidedAt', 'VoidReason')
        `);
        
        const hasVoidColumns = checkVoidColumns.recordset.length >= 2;
        
        // ✅ Build query with all columns
        let query = `
            SELECT Id, Total, PaymentMethod, SaleDate, 
                   CAST(ItemsJson AS NVARCHAR(MAX)) as ItemsJson,
                   CashPaid, ChangeAmount
        `;
        
        // Add discount columns if they exist
        if (hasDiscountColumns) {
            query += `, DiscountType, DiscountValue, DiscountAmount`;
        }
        
        // Add void columns if they exist
        if (hasVoidColumns) {
            query += `, Status, VoidedBy, VoidedAt, VoidReason`;
        } else {
            // If columns don't exist, use default
            query += `, 'COMPLETED' as Status, NULL as VoidedBy, NULL as VoidedAt, NULL as VoidReason`;
        }
        
        query += `
            FROM Sales WITH (NOLOCK) 
            WHERE OutletId = @outletId
        `;
        
        const request = pool.request();
        request.input('outletId', sql.Int, outletId);

        // ✅ Filter by status (COMPLETED or VOIDED)
        if (status === 'voided') {
            query += ' AND Status = \'VOIDED\'';
        } else if (status === 'completed') {
            query += ' AND (Status IS NULL OR Status = \'COMPLETED\' OR Status != \'VOIDED\')';
        } else {
            // Default: exclude voided transactions
            if (hasVoidColumns) {
                query += ' AND (Status IS NULL OR Status != \'VOIDED\')';
            }
        }

        // Date filters
        if (filter === 'today') {
            query += ' AND CAST(SaleDate AS DATE) = CAST(GETDATE() AS DATE)';
        } 
        else if (filter === 'week') {
            query += ' AND SaleDate >= DATEADD(day, -7, GETDATE())';
        } 
        else if (filter === 'month') {
            query += ' AND SaleDate >= DATEADD(month, -1, GETDATE())';
        } 
        else if (filter === 'custom' && startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            
            query += ' AND SaleDate >= @startDate AND SaleDate <= @endDate';
            request.input('startDate', sql.DateTime, start);
            request.input('endDate', sql.DateTime, end);
        }

        query += ' ORDER BY SaleDate DESC';
        
        const result = await request.query(query);
        
        // Parse JSON and add discount & void info
        const formattedSales = result.recordset.map(sale => {
            let items = [];
            try {
                items = JSON.parse(sale.ItemsJson || '[]');
            } catch (e) {
                items = [];
            }
            
            // ✅ Add discount info if present
            const discount = (hasDiscountColumns && sale.DiscountAmount) ? {
                type: sale.DiscountType,
                value: sale.DiscountValue,
                amount: sale.DiscountAmount
            } : null;
            
            // ✅ Add void info
            const isVoided = sale.Status === 'VOIDED';
            
            return {
                id: sale.Id,
                total: sale.Total,
                paymentMethod: sale.PaymentMethod,
                date: sale.SaleDate,
                items: items,
                cashPaid: sale.CashPaid,
                change: sale.ChangeAmount,
                discount: discount,
                status: sale.Status || 'COMPLETED',      // ✅ ADD STATUS
                voidReason: sale.VoidReason,             // ✅ ADD VOID REASON
                voidedAt: sale.VoidedAt,                 // ✅ ADD VOID DATE
                voidedBy: sale.VoidedBy                  // ✅ ADD WHO VOIDED
            };
        });

        console.log(`✅ ${req.user.role} ${req.user.id} fetched ${formattedSales.length} sales (${status || 'completed'}) for outlet ${outletId}`);
        res.json(formattedSales);
        
    } catch (err) {
        console.error('Error getting sales:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================
// GET sales summary with DISCOUNT (UPDATED)
// ============================================
const getSalesSummary = async (req, res) => {
    try {
        const { filter, startDate, endDate, status } = req.query;
        
        const outletId = req.outletId;
        
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        const pool = getPool();
        
        // ✅ Check if discount columns exist
        const checkColumns = await pool.request().query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Sales' 
            AND COLUMN_NAME IN ('DiscountType', 'DiscountValue', 'DiscountAmount')
        `);
        
        const hasDiscountColumns = checkColumns.recordset.length >= 3;
        
        // ✅ Check if Status column exists (for void support)
        const checkStatusColumn = await pool.request().query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Sales' 
            AND COLUMN_NAME = 'Status'
        `);
        
        const hasStatusColumn = checkStatusColumn.recordset.length > 0;
        
        // ✅ Build query with discount calculations
        let query = `
            WITH SalesWithDetails AS (
                SELECT 
                    Id,
                    Total,
                    PaymentMethod,
                    (
                        SELECT ISNULL(SUM(TRY_CAST(JSON_VALUE(value, '$.quantity') AS INT)), 0)
                        FROM OPENJSON(ItemsJson)
                    ) as ItemCount
        `;
        
        // Add discount fields if they exist
        if (hasDiscountColumns) {
            query += `,
                    DiscountAmount,
                    DiscountType,
                    DiscountValue,
                    CASE WHEN DiscountAmount > 0 THEN 1 ELSE 0 END as HasDiscount
            `;
        }
        
        // Add Status if exists
        if (hasStatusColumn) {
            query += `,
                    Status
            `;
        }
        
        query += `
                FROM Sales WITH (NOLOCK)
                WHERE OutletId = @outletId
        `;
        
        const request = pool.request();
        request.input('outletId', sql.Int, outletId);

        // ✅ FILTER BY STATUS (VOIDED or COMPLETED)
        if (hasStatusColumn) {
            if (status === 'voided') {
                query += ' AND Status = \'VOIDED\'';
            } else if (status === 'completed') {
                query += ' AND (Status IS NULL OR Status = \'COMPLETED\' OR Status != \'VOIDED\')';
            } else {
                // Default: exclude voided transactions
                query += ' AND (Status IS NULL OR Status != \'VOIDED\')';
            }
        }

        // Date filters
        if (filter === 'today') {
            query += ' AND CAST(SaleDate AS DATE) = CAST(GETDATE() AS DATE)';
        } 
        else if (filter === 'week') {
            query += ' AND SaleDate >= DATEADD(day, -7, GETDATE())';
        } 
        else if (filter === 'month') {
            query += ' AND SaleDate >= DATEADD(month, -1, GETDATE())';
        } 
        else if (filter === 'custom' && startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            
            query += ' AND SaleDate >= @startDate AND SaleDate <= @endDate';
            request.input('startDate', sql.DateTime, start);
            request.input('endDate', sql.DateTime, end);
        }

        query += `
            )
            SELECT 
                COUNT(*) as totalSales,
                ISNULL(SUM(Total), 0) as totalRevenue,
                ISNULL(SUM(ItemCount), 0) as totalItems,
                PaymentMethod
        `;
        
        // Add discount aggregates if columns exist
        if (hasDiscountColumns) {
            query += `,
                ISNULL(SUM(DiscountAmount), 0) as totalDiscount,
                SUM(CASE WHEN DiscountAmount > 0 THEN 1 ELSE 0 END) as discountedSales
            `;
        } else {
            query += `,
                0 as totalDiscount,
                0 as discountedSales
            `;
        }
        
        query += `
            FROM SalesWithDetails
            GROUP BY PaymentMethod
        `;
        
        const result = await request.query(query);
        
        // Calculate totals
        let totalRevenue = 0;
        let totalItems = 0;
        let totalSales = 0;
        let totalDiscount = 0;
        let discountedSales = 0;
        const paymentBreakdown = {};
        
        result.recordset.forEach(row => {
            totalRevenue += row.totalRevenue;
            totalItems += parseInt(row.totalItems || 0);
            totalSales += row.totalSales;
            totalDiscount += row.totalDiscount || 0;
            discountedSales += row.discountedSales || 0;
            paymentBreakdown[row.PaymentMethod] = row.totalRevenue;
        });

        console.log(`✅ Summary for outlet ${outletId} (${status || 'completed'}):`, { 
            totalSales, 
            totalRevenue, 
            totalItems, 
            totalDiscount,
            discountedSales,
            discountPercent: totalSales > 0 ? ((discountedSales / totalSales) * 100).toFixed(1) : 0
        });

        res.json({
            totalSales,
            totalRevenue,
            totalItems,
            totalDiscount,
            discountedSales,
            paymentBreakdown
        });
        
    } catch (err) {
        console.error('❌ Error getting sales summary:', err);
        res.status(500).json({ error: err.message });
    }
};
// ============================================
// GET sales by category (UPDATED)
// ============================================
// ============================================
// GET sales by category with DISCOUNT (UPDATED)
// ============================================
const getSalesByCategory = async (req, res) => {
    try {
        const { filter, startDate, endDate, status } = req.query;
        
        const outletId = req.outletId;
        
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        const pool = getPool();
        
        // ✅ Check if discount columns exist
        const checkColumns = await pool.request().query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Sales' 
            AND COLUMN_NAME IN ('DiscountType', 'DiscountValue', 'DiscountAmount')
        `);
        
        const hasDiscountColumns = checkColumns.recordset.length >= 3;
        
        // ✅ Check if Status column exists
        const checkStatusColumn = await pool.request().query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Sales' 
            AND COLUMN_NAME = 'Status'
        `);
        
        const hasStatusColumn = checkStatusColumn.recordset.length > 0;
        
        // ✅ Build query - include Total
        let query = `
            SELECT Id, Total, CAST(ItemsJson AS NVARCHAR(MAX)) as ItemsJson 
        `;
        
        if (hasDiscountColumns) {
            query += `, DiscountType, DiscountValue, DiscountAmount, SaleDate`;
        } else {
            query += `, SaleDate`;
        }
        
        if (hasStatusColumn) {
            query += `, Status`;
        }
        
        query += `
            FROM Sales WITH (NOLOCK) 
            WHERE OutletId = @outletId
        `;
        
        const request = pool.request();
        request.input('outletId', sql.Int, outletId);

        // ✅ FILTER BY STATUS
        if (hasStatusColumn) {
            if (status === 'voided') {
                query += ' AND Status = \'VOIDED\'';
            } else {
                query += ' AND Status = \'COMPLETED\'';
            }
        }

        // Date filters
        if (filter === 'today') {
            query += ' AND CAST(SaleDate AS DATE) = CAST(GETDATE() AS DATE)';
        } 
        else if (filter === 'week') {
            query += ' AND SaleDate >= DATEADD(day, -7, GETDATE())';
        } 
        else if (filter === 'month') {
            query += ' AND SaleDate >= DATEADD(month, -1, GETDATE())';
        } 
        else if (filter === 'custom' && startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            
            query += ' AND SaleDate >= @startDate AND SaleDate <= @endDate';
            request.input('startDate', sql.DateTime, start);
            request.input('endDate', sql.DateTime, end);
        }

        const result = await request.query(query);
        
        // Process data
        const categoryMap = new Map();
        const transactionSet = new Set();
        let totalDiscountAmount = 0;
        let discountedTransactionCount = 0;
        
        result.recordset.forEach(sale => {
            transactionSet.add(sale.Id);
            
            // ✅ Track discount per transaction
            if (hasDiscountColumns && sale.DiscountAmount && sale.DiscountAmount > 0) {
                totalDiscountAmount += sale.DiscountAmount;
                discountedTransactionCount++;
            }
            
            try {
                const itemsList = JSON.parse(sale.ItemsJson || '[]');
                
                // ✅ Calculate total from items (before discount)
                let totalFromItems = 0;
                itemsList.forEach(item => {
                    totalFromItems += (item.price || 0) * (item.quantity || 1);
                });
                
                // ✅ Calculate discount factor to apply to each item
                const discountFactor = totalFromItems > 0 ? sale.Total / totalFromItems : 1;
                
                itemsList.forEach(item => {
                    const categoryName = item.displayCategory || item.category || item.originalCategory || 'Uncategorized';
                    const originalRevenue = (item.price || 0) * (item.quantity || 1);
                    // ✅ Apply discount proportionally to each item
                    const discountedRevenue = originalRevenue * discountFactor;
                    
                    if (!categoryMap.has(categoryName)) {
                        categoryMap.set(categoryName, {
                            name: categoryName,
                            totalRevenue: 0,
                            totalQuantity: 0,
                            items: new Map(),
                            transactions: new Set(),
                            discountAmount: 0,
                            discountedCount: 0
                        });
                    }
                    
                    const category = categoryMap.get(categoryName);
                    
                    // ✅ Use discounted revenue
                    category.totalRevenue += discountedRevenue;
                    category.totalQuantity += (item.quantity || 1);
                    category.transactions.add(sale.Id);
                    
                    // ✅ Add discount to category if this sale had discount
                    if (hasDiscountColumns && sale.DiscountAmount > 0) {
                        category.discountAmount += sale.DiscountAmount;
                        category.discountedCount++;
                    }
                    
                    const itemName = item.name;
                    if (!category.items.has(itemName)) {
                        category.items.set(itemName, {
                            name: itemName,
                            quantity: 0,
                            revenue: 0,
                            price: item.price || 0,
                            transactions: new Set(),
                            discountAmount: 0,
                            discountedCount: 0
                        });
                    }
                    
                    const catItem = category.items.get(itemName);
                    // ✅ Use discounted revenue for item
                    catItem.revenue += discountedRevenue;
                    catItem.quantity += (item.quantity || 1);
                    catItem.transactions.add(sale.Id);
                    
                    // ✅ Add discount to item
                    if (hasDiscountColumns && sale.DiscountAmount > 0) {
                        catItem.discountAmount += sale.DiscountAmount;
                        catItem.discountedCount++;
                    }
                });
                
            } catch (e) {
                console.log('Error parsing items for sale:', sale.Id);
            }
        });
        
        // Format response
        const formattedCategories = [];
        let totalRevenue = 0;
        let totalItems = 0;
        
        for (const [catName, catData] of categoryMap) {
            const itemsList = Array.from(catData.items.values()).map(item => ({
                name: item.name,
                quantity: item.quantity,
                revenue: Math.round(item.revenue * 100) / 100, // Round to 2 decimals
                price: item.price,
                transactionCount: item.transactions.size,
                discountAmount: item.discountAmount || 0,
                discountedCount: item.discountedCount || 0
            })).sort((a, b) => b.revenue - a.revenue);
            
            formattedCategories.push({
                name: catName,
                totalRevenue: Math.round(catData.totalRevenue * 100) / 100,
                totalQuantity: catData.totalQuantity,
                totalTransactions: catData.transactions.size,
                discountAmount: catData.discountAmount || 0,
                discountedCount: catData.discountedCount || 0,
                items: itemsList,
                itemCount: itemsList.length
            });
            
            totalRevenue += catData.totalRevenue;
            totalItems += catData.totalQuantity;
        }
        
        formattedCategories.sort((a, b) => b.totalRevenue - a.totalRevenue);
        
        console.log(`✅ Category summary for outlet ${outletId} (${status || 'completed'}):`, {
            totalCategories: formattedCategories.length,
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            totalTransactions: transactionSet.size,
            totalItems,
            totalDiscount: totalDiscountAmount,
            discountedTransactions: discountedTransactionCount
        });
        
        res.json({
            success: true,
            summary: {
                totalRevenue: Math.round(totalRevenue * 100) / 100,
                totalTransactions: transactionSet.size,
                totalCategories: formattedCategories.length,
                totalItems,
                totalDiscount: totalDiscountAmount,
                discountedTransactions: discountedTransactionCount
            },
            categories: formattedCategories,
            dateRange: {
                filter,
                startDate: startDate || null,
                endDate: endDate || null,
                status: status || 'completed'
            }
        });
        
    } catch (err) {
        console.error('❌ Error in category sales:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================
// GET category items with DISCOUNT (UPDATED)
// ============================================
const getCategoryItems = async (req, res) => {
    try {
        const { category } = req.params;
        const { filter, startDate, endDate, status } = req.query; // ✅ ADD status param
        
        const outletId = req.outletId;
        
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        const pool = getPool();
        
        // ✅ Check if discount columns exist
        const checkColumns = await pool.request().query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Sales' 
            AND COLUMN_NAME IN ('DiscountType', 'DiscountValue', 'DiscountAmount')
        `);
        
        const hasDiscountColumns = checkColumns.recordset.length >= 3;
        
        // ✅ Check if Status column exists
        const checkStatusColumn = await pool.request().query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Sales' 
            AND COLUMN_NAME = 'Status'
        `);
        
        const hasStatusColumn = checkStatusColumn.recordset.length > 0;
        
        let query = `
            SELECT Id, SaleDate, CAST(ItemsJson AS NVARCHAR(MAX)) as ItemsJson 
        `;
        
        if (hasDiscountColumns) {
            query += `, DiscountType, DiscountValue, DiscountAmount`;
        }
        
        if (hasStatusColumn) {
            query += `, Status`;
        }
        
        query += `
            FROM Sales WITH (NOLOCK) 
            WHERE OutletId = @outletId
        `;
        
        const request = pool.request();
        request.input('outletId', sql.Int, outletId);

        // ✅ FILTER BY STATUS (VOIDED or COMPLETED)
        if (hasStatusColumn) {
            if (status === 'voided') {
                query += ' AND Status = \'VOIDED\'';
            } else if (status === 'completed') {
                query += ' AND (Status IS NULL OR Status = \'COMPLETED\' OR Status != \'VOIDED\')';
            } else {
                // Default: exclude voided transactions
                query += ' AND (Status IS NULL OR Status != \'VOIDED\')';
            }
        }

        // Date filters
        if (filter === 'today') {
            query += ' AND CAST(SaleDate AS DATE) = CAST(GETDATE() AS DATE)';
        } 
        else if (filter === 'week') {
            query += ' AND SaleDate >= DATEADD(day, -7, GETDATE())';
        } 
        else if (filter === 'month') {
            query += ' AND SaleDate >= DATEADD(month, -1, GETDATE())';
        } 
        else if (filter === 'custom' && startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            
            query += ' AND SaleDate >= @startDate AND SaleDate <= @endDate';
            request.input('startDate', sql.DateTime, start);
            request.input('endDate', sql.DateTime, end);
        }

        const result = await request.query(query);
        
        // Process items
        const itemMap = new Map();
        const transactions = [];
        let totalDiscountForCategory = 0;
        let discountedTransactionCount = 0;
        
        result.recordset.forEach(sale => {
            // ✅ Track discount per sale
            const hasDiscount = hasDiscountColumns && sale.DiscountAmount && sale.DiscountAmount > 0;
            
            try {
                const itemsList = JSON.parse(sale.ItemsJson || '[]');
                itemsList.forEach(item => {
                    const itemCategory = item.displayCategory || item.category || item.originalCategory || 'Uncategorized';
                    
                    if (itemCategory === category) {
                        const itemName = item.name;
                        const quantity = item.quantity || 1;
                        const price = item.price || 0;
                        const revenue = price * quantity;
                        
                        if (!itemMap.has(itemName)) {
                            itemMap.set(itemName, {
                                name: itemName,
                                quantity: 0,
                                revenue: 0,
                                price: price,
                                transactions: new Set(),
                                discountAmount: 0,
                                discountedCount: 0,
                                status: sale.Status || 'COMPLETED'  // ✅ ADD status to item
                            });
                        }
                        
                        const catItem = itemMap.get(itemName);
                        catItem.quantity += quantity;
                        catItem.revenue += revenue;
                        catItem.transactions.add(sale.Id);
                        
                        // ✅ Track discount for this item
                        if (hasDiscount) {
                            const discountPerItem = (sale.DiscountAmount * revenue) / sale.Total;
                            catItem.discountAmount += discountPerItem;
                            catItem.discountedCount++;
                            totalDiscountForCategory += discountPerItem;
                        }
                        
                        // ✅ Add discount info to transaction
                        transactions.push({
                            saleId: sale.Id,
                            saleDate: sale.SaleDate,
                            name: itemName,
                            quantity: quantity,
                            price: price,
                            total: revenue,
                            status: sale.Status || 'COMPLETED',  // ✅ ADD status to transaction
                            discount: hasDiscount ? {
                                type: sale.DiscountType,
                                value: sale.DiscountValue,
                                amount: (sale.DiscountAmount * revenue) / sale.Total
                            } : null
                        });
                    }
                });
                
                if (hasDiscount) {
                    discountedTransactionCount++;
                }
                
            } catch (e) {
                // Skip invalid JSON
            }
        });
        
        const itemsList = Array.from(itemMap.values())
            .map(item => ({
                ...item,
                transactionCount: item.transactions.size,
                discountAmount: item.discountAmount || 0,
                discountedCount: item.discountedCount || 0
            }))
            .sort((a, b) => b.revenue - a.revenue);
        
        const totalRevenue = itemsList.reduce((sum, item) => sum + item.revenue, 0);
        const totalQuantity = itemsList.reduce((sum, item) => sum + item.quantity, 0);
        
        console.log(`✅ Category items for "${category}" (${status || 'completed'}):`, {
            totalRevenue,
            totalItems: itemsList.length,
            totalDiscount: totalDiscountForCategory,
            discountedTransactions: discountedTransactionCount
        });
        
        res.json({
            success: true,
            category,
            totalRevenue,
            totalQuantity,
            totalItems: itemsList.length,
            totalDiscount: totalDiscountForCategory,
            discountedTransactions: discountedTransactionCount,
            items: itemsList,
            transactions: transactions.sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime())
        });
        
    } catch (err) {
        console.error('❌ Error in category items:', err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    createSale,
    getSales,
    getSalesSummary,
    getSalesByCategory,
    getCategoryItems,
    voidSale
};