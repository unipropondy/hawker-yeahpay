// backend/controllers/dishGroupController.js
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
            console.log(`👤 Staff ${userId} using outlet ${result.recordset[0].OutletId}`);
            return result.recordset[0].OutletId;
        }
    }
    
    // For owner: get from header or query
    if (userRole === 'owner') {
        const outletId = req.headers['x-outlet-id'] || req.query.outletId;
        if (outletId) {
            return parseInt(outletId);
        }
    }
    
    // Admin or fallback
    return null;
};

// ============================================
// GET all dish groups (UPDATED with OutletId)
// ============================================
const getAllGroups = async (req, res) => {
    try {
        const outletId = await getEffectiveOutletId(req);
        
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        const pool = getPool();
        
        const result = await pool.request()
            .input('outletId', sql.Int, outletId)
            .query(`
                SELECT 
                    Id, 
                    Name, 
                    ItemCount, 
                    IsActive as active, 
                    DisplayOrder,
                    OutletId
                FROM DishGroup 
                WHERE OutletId = @outletId 
                ORDER BY DisplayOrder, Name
            `);
        
        console.log(`✅ ${req.user.role} ${req.user.id} fetched ${result.recordset.length} groups for outlet ${outletId}`);
        res.json(result.recordset);
    } catch (err) {
        console.error('Error getting groups:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================
// GET single dish group (UPDATED)
// ============================================
const getGroupById = async (req, res) => {
    try {
        const { id } = req.params;
        const outletId = await getEffectiveOutletId(req);
        
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        const pool = getPool();
        
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('outletId', sql.Int, outletId)
            .query('SELECT Id, Name, ItemCount, IsActive as active FROM DishGroup WHERE Id = @id AND OutletId = @outletId');
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        res.json(result.recordset[0]);
    } catch (err) {
        console.error('Error getting group:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================
// CREATE new dish group (UPDATED)
// ============================================
const createGroup = async (req, res) => {
    try {
        const { name, active } = req.body;
        const outletId = await getEffectiveOutletId(req);
        
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        const pool = getPool();
        
        // Get max order for this outlet
        const maxOrderResult = await pool.request()
            .input('outletId', sql.Int, outletId)
            .query('SELECT ISNULL(MAX(DisplayOrder), -1) + 1 as NextOrder FROM DishGroup WHERE OutletId = @outletId');
        
        const nextOrder = maxOrderResult.recordset[0].NextOrder;
        
        const result = await pool.request()
            .input('name', sql.NVarChar, name)
            .input('active', sql.Bit, active !== undefined ? active : true)
            .input('outletId', sql.Int, outletId)
            .input('order', sql.Int, nextOrder)
            .query(`
                INSERT INTO DishGroup (Name, IsActive, OutletId, DisplayOrder) 
                OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.ItemCount, 
                       INSERTED.IsActive as active, INSERTED.DisplayOrder
                VALUES (@name, @active, @outletId, @order)
            `);
        
        console.log(`✅ ${req.user.role} ${req.user.id} created group for outlet ${outletId}`);
        res.status(201).json(result.recordset[0]);
    } catch (err) {
        console.error('Error creating group:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================
// UPDATE dish group (UPDATED)
// ============================================
const updateGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, active } = req.body;
        const outletId = await getEffectiveOutletId(req);
        
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        console.log('🔄 Updating group:', { id, name, active, outletId });
        
        const pool = getPool();
        
        const transaction = pool.transaction();
        await transaction.begin();
        
        try {
            // Get old group name
            const oldGroupResult = await transaction.request()
                .input('id', sql.Int, id)
                .input('outletId', sql.Int, outletId)
                .query('SELECT Name FROM DishGroup WHERE Id = @id AND OutletId = @outletId');
            
            if (oldGroupResult.recordset.length === 0) {
                await transaction.rollback();
                return res.status(404).json({ error: 'Group not found' });
            }
            
            const oldName = oldGroupResult.recordset[0].Name;
            
            // Update group
            const groupResult = await transaction.request()
                .input('id', sql.Int, id)
                .input('name', sql.NVarChar, name)
                .input('active', sql.Bit, active)
                .input('outletId', sql.Int, outletId)
                .query(`
                    UPDATE DishGroup 
                    SET Name = @name, IsActive = @active 
                    OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.ItemCount, 
                           INSERTED.IsActive as active, INSERTED.DisplayOrder
                    WHERE Id = @id AND OutletId = @outletId
                `);
            
            // Update items with new category name
            await transaction.request()
                .input('oldCategory', sql.NVarChar, oldName)
                .input('newCategory', sql.NVarChar, name)
                .input('outletId', sql.Int, outletId)
                .input('categoryId', sql.Int, id)
                .query(`
                    UPDATE DishItem 
                    SET 
                        DisplayCategory = @newCategory,
                        OriginalCategory = @newCategory,
                        CategoryId = @categoryId
                    WHERE 
                        (DisplayCategory = @oldCategory OR OriginalCategory = @oldCategory)
                        AND OutletId = @outletId
                `);
            
            await transaction.commit();
            res.json(groupResult.recordset[0]);
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
        
    } catch (err) {
        console.error('❌ Error updating group:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================
// DELETE dish group (UPDATED)
// ============================================
const deleteGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const outletId = await getEffectiveOutletId(req);
        
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        const pool = getPool();
        
        const transaction = pool.transaction();
        await transaction.begin();
        
        try {
            // Check if group belongs to outlet
            const checkResult = await transaction.request()
                .input('id', sql.Int, id)
                .input('outletId', sql.Int, outletId)
                .query('SELECT Id, DisplayOrder FROM DishGroup WHERE Id = @id AND OutletId = @outletId');
            
            if (checkResult.recordset.length === 0) {
                await transaction.rollback();
                return res.status(404).json({ error: 'Group not found' });
            }
            
            const deletedOrder = checkResult.recordset[0].DisplayOrder || 0;
            
            // Delete items in this group
            await transaction.request()
                .input('categoryId', sql.Int, id)
                .input('outletId', sql.Int, outletId)
                .query('DELETE FROM DishItem WHERE CategoryId = @categoryId AND OutletId = @outletId');
            
            // Delete the group
            await transaction.request()
                .input('id', sql.Int, id)
                .query('DELETE FROM DishGroup WHERE Id = @id');
            
            // Reorder remaining groups
            await transaction.request()
                .input('outletId', sql.Int, outletId)
                .input('deletedOrder', sql.Int, deletedOrder)
                .query(`
                    UPDATE DishGroup 
                    SET DisplayOrder = DisplayOrder - 1 
                    WHERE OutletId = @outletId AND DisplayOrder > @deletedOrder
                `);
            
            await transaction.commit();
            res.json({ message: 'Group deleted successfully' });
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    } catch (err) {
        console.error('Error deleting group:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================
// UPDATE group order (UPDATED)
// ============================================
const updateGroupOrder = async (req, res) => {
    try {
        const { groups } = req.body;
        const outletId = await getEffectiveOutletId(req);
        
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        if (!Array.isArray(groups)) {
            return res.status(400).json({ error: 'Invalid data format' });
        }
        
        const pool = getPool();
        
        const transaction = pool.transaction();
        await transaction.begin();
        
        try {
            for (const group of groups) {
                // Verify group belongs to outlet
                const checkResult = await transaction.request()
                    .input('id', sql.Int, group.id)
                    .input('outletId', sql.Int, outletId)
                    .query('SELECT Id FROM DishGroup WHERE Id = @id AND OutletId = @outletId');
                
                if (checkResult.recordset.length === 0) {
                    throw new Error(`Group ${group.id} not found`);
                }
                
                await transaction.request()
                    .input('id', sql.Int, group.id)
                    .input('order', sql.Int, group.order)
                    .query('UPDATE DishGroup SET DisplayOrder = @order WHERE Id = @id');
            }
            
            await transaction.commit();
            res.json({ success: true, message: 'Order updated successfully' });
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
        
    } catch (err) {
        console.error('Error updating group order:', err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getAllGroups,
    getGroupById,
    createGroup,
    updateGroup,
    deleteGroup,
    updateGroupOrder
};