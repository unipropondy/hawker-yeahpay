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
        const { total, paymentMethod, items, cashPaid, change } = req.body;
        
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
        
        const result = await pool.request()
            .input('total', sql.Decimal(10,2), total)
            .input('paymentMethod', sql.NVarChar, paymentMethod)
            .input('itemsJson', sql.NVarChar, itemsJson)
            .input('cashPaid', sql.Decimal(10,2), cashPaid || null)
            .input('changeAmount', sql.Decimal(10,2), change || null)
            .input('outletId', sql.Int, outletId)
            .query(`
                INSERT INTO Sales (
                    Total, PaymentMethod, ItemsJson, 
                    CashPaid, ChangeAmount, OutletId
                )
                OUTPUT INSERTED.Id, INSERTED.Total, INSERTED.PaymentMethod, INSERTED.SaleDate
                VALUES (
                    @total, @paymentMethod, @itemsJson,
                    @cashPaid, @changeAmount, @outletId
                )
            `);

        const newSale = {
            id: result.recordset[0].Id,
            total: result.recordset[0].Total,
            paymentMethod: result.recordset[0].PaymentMethod,
            date: result.recordset[0].SaleDate,
            items: itemsWithCategory
        };
        
        console.log(`✅ ${req.user.role} ${req.user.id} created sale for outlet ${outletId}`);
        res.status(201).json(newSale);
        
    } catch (err) {
        console.error('❌ Error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================
// GET sales (UPDATED)
// ============================================
const getSales = async (req, res) => {
    try {
        const { filter, startDate, endDate } = req.query;
        
        const outletId = req.outletId;
        
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        const pool = getPool();

        let query = `
            SELECT Id, Total, PaymentMethod, SaleDate, 
                   CAST(ItemsJson AS NVARCHAR(MAX)) as ItemsJson,
                   CashPaid, ChangeAmount
            FROM Sales WITH (NOLOCK) 
            WHERE OutletId = @outletId
        `;
        
        const request = pool.request();
        request.input('outletId', sql.Int, outletId);

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
        
        // Parse JSON
        const formattedSales = result.recordset.map(sale => {
            let items = [];
            try {
                items = JSON.parse(sale.ItemsJson || '[]');
            } catch (e) {
                items = [];
            }
            
            return {
                id: sale.Id,
                total: sale.Total,
                paymentMethod: sale.PaymentMethod,
                date: sale.SaleDate,
                items: items,
                cashPaid: sale.CashPaid,
                change: sale.ChangeAmount
            };
        });

        console.log(`✅ ${req.user.role} ${req.user.id} fetched ${formattedSales.length} sales for outlet ${outletId}`);
        res.json(formattedSales);
        
    } catch (err) {
        console.error('Error getting sales:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================
// GET sales summary (UPDATED)
// ============================================
const getSalesSummary = async (req, res) => {
    try {
        const { filter, startDate, endDate } = req.query;
        
        const outletId = req.outletId;
        
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        const pool = getPool();
        
        // Build query with CTE
        let query = `
            WITH SalesWithItems AS (
                SELECT 
                    Id,
                    Total,
                    PaymentMethod,
                    (
                        SELECT ISNULL(SUM(TRY_CAST(JSON_VALUE(value, '$.quantity') AS INT)), 0)
                        FROM OPENJSON(ItemsJson)
                    ) as ItemCount
                FROM Sales WITH (NOLOCK)
                WHERE OutletId = @outletId
        `;
        
        const request = pool.request();
        request.input('outletId', sql.Int, outletId);

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
            FROM SalesWithItems
            GROUP BY PaymentMethod
        `;
        
        const result = await request.query(query);
        
        // Calculate totals
        let totalRevenue = 0;
        let totalItems = 0;
        let totalSales = 0;
        const paymentBreakdown = {};
        
        result.recordset.forEach(row => {
            totalRevenue += row.totalRevenue;
            totalItems += parseInt(row.totalItems || 0);
            totalSales += row.totalSales;
            paymentBreakdown[row.PaymentMethod] = row.totalRevenue;
        });

        console.log(`✅ Summary for outlet ${outletId}:`, { totalSales, totalRevenue, totalItems });

        res.json({
            totalSales,
            totalRevenue,
            totalItems,
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
const getSalesByCategory = async (req, res) => {
    try {
        const { filter, startDate, endDate } = req.query;
        
         const outletId = req.outletId;
        
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        const pool = getPool();
        
        let query = `
            SELECT Id, CAST(ItemsJson AS NVARCHAR(MAX)) as ItemsJson 
            FROM Sales WITH (NOLOCK) 
            WHERE OutletId = @outletId
        `;
        
        const request = pool.request();
        request.input('outletId', sql.Int, outletId);

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
        
        // Process data (same logic, just filtered by outlet)
        const categoryMap = new Map();
        const transactionSet = new Set();
        
        result.recordset.forEach(sale => {
            transactionSet.add(sale.Id);
            try {
                const itemsList = JSON.parse(sale.ItemsJson || '[]');
                
                itemsList.forEach(item => {
                    const categoryName = item.displayCategory || item.category || item.originalCategory || 'Uncategorized';
                    
                    if (!categoryMap.has(categoryName)) {
                        categoryMap.set(categoryName, {
                            name: categoryName,
                            totalRevenue: 0,
                            totalQuantity: 0,
                            items: new Map(),
                            transactions: new Set()
                        });
                    }
                    
                    const category = categoryMap.get(categoryName);
                    const revenue = (item.price || 0) * (item.quantity || 1);
                    
                    category.totalRevenue += revenue;
                    category.totalQuantity += (item.quantity || 1);
                    category.transactions.add(sale.Id);
                    
                    const itemName = item.name;
                    if (!category.items.has(itemName)) {
                        category.items.set(itemName, {
                            name: itemName,
                            quantity: 0,
                            revenue: 0,
                            price: item.price || 0,
                            transactions: new Set()
                        });
                    }
                    
                    const catItem = category.items.get(itemName);
                    catItem.quantity += (item.quantity || 1);
                    catItem.revenue += revenue;
                    catItem.transactions.add(sale.Id);
                });
                
            } catch (e) {
                // Skip invalid JSON
            }
        });
        
        // Format response (same as before)
        const formattedCategories = [];
        let totalRevenue = 0;
        let totalItems = 0;
        
        for (const [catName, catData] of categoryMap) {
            const itemsList = Array.from(catData.items.values()).map(item => ({
                name: item.name,
                quantity: item.quantity,
                revenue: item.revenue,
                price: item.price,
                transactionCount: item.transactions.size
            })).sort((a, b) => b.revenue - a.revenue);
            
            formattedCategories.push({
                name: catName,
                totalRevenue: catData.totalRevenue,
                totalQuantity: catData.totalQuantity,
                totalTransactions: catData.transactions.size,
                items: itemsList,
                itemCount: itemsList.length
            });
            
            totalRevenue += catData.totalRevenue;
            totalItems += catData.totalQuantity;
        }
        
        formattedCategories.sort((a, b) => b.totalRevenue - a.totalRevenue);
        
        res.json({
            success: true,
            summary: {
                totalRevenue,
                totalTransactions: transactionSet.size,
                totalCategories: formattedCategories.length,
                totalItems
            },
            categories: formattedCategories,
            dateRange: {
                filter,
                startDate: startDate || null,
                endDate: endDate || null
            }
        });
        
    } catch (err) {
        console.error('❌ Error in category sales:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================
// GET category items (UPDATED)
// ============================================
const getCategoryItems = async (req, res) => {
    try {
        const { category } = req.params;
        const { filter, startDate, endDate } = req.query;
        
        const outletId = req.outletId;
        
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        const pool = getPool();
        
        let query = `
            SELECT Id, SaleDate, CAST(ItemsJson AS NVARCHAR(MAX)) as ItemsJson 
            FROM Sales WITH (NOLOCK) 
            WHERE OutletId = @outletId
        `;
        
        const request = pool.request();
        request.input('outletId', sql.Int, outletId);

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
        
        // Process items (same logic, filtered by outlet)
        const itemMap = new Map();
        const transactions = [];
        
        result.recordset.forEach(sale => {
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
                                transactions: new Set()
                            });
                        }
                        
                        const catItem = itemMap.get(itemName);
                        catItem.quantity += quantity;
                        catItem.revenue += revenue;
                        catItem.transactions.add(sale.Id);
                        
                        transactions.push({
                            saleId: sale.Id,
                            saleDate: sale.SaleDate,
                            name: itemName,
                            quantity: quantity,
                            price: price,
                            total: revenue
                        });
                    }
                });
            } catch (e) {
                // Skip invalid JSON
            }
        });
        
        const itemsList = Array.from(itemMap.values())
            .map(item => ({
                ...item,
                transactionCount: item.transactions.size
            }))
            .sort((a, b) => b.revenue - a.revenue);
        
        const totalRevenue = itemsList.reduce((sum, item) => sum + item.revenue, 0);
        const totalQuantity = itemsList.reduce((sum, item) => sum + item.quantity, 0);
        
        res.json({
            success: true,
            category,
            totalRevenue,
            totalQuantity,
            totalItems: itemsList.length,
            items: itemsList,
            transactions: transactions
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
    getCategoryItems
};