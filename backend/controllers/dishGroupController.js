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
// ✅ NEW: Ensure Favourites group exists with correct count
// ============================================
const ensureFavouritesGroupExists = async (outletId) => {
    try {
        const pool = getPool();
        
        // Get actual count of favourite items from DishItem table
        const countResult = await pool.request()
            .input('outletId', sql.Int, outletId)
            .query(`
                SELECT COUNT(*) as FavouriteCount 
                FROM DishItem 
                WHERE OutletId = @outletId AND IsFavourite = 1
            `);
        
        const favouriteCount = countResult.recordset[0].FavouriteCount;
        
        // Check if Favourites group exists
        const groupResult = await pool.request()
            .input('outletId', sql.Int, outletId)
            .query("SELECT Id, ItemCount FROM DishGroup WHERE Name = 'Favourites' AND OutletId = @outletId");
        
        if (groupResult.recordset.length === 0) {
            // Create Favourites group if it doesn't exist and there are favourite items
            if (favouriteCount > 0) {
                const maxOrderResult = await pool.request()
                    .input('outletId', sql.Int, outletId)
                    .query('SELECT ISNULL(MAX(DisplayOrder), -1) + 1 as NextOrder FROM DishGroup WHERE OutletId = @outletId');
                
                await pool.request()
                    .input('name', sql.NVarChar, 'Favourites')
                    .input('active', sql.Bit, true)
                    .input('outletId', sql.Int, outletId)
                    .input('order', sql.Int, maxOrderResult.recordset[0].NextOrder)
                    .input('itemCount', sql.Int, favouriteCount)
                    .query(`
                        INSERT INTO DishGroup (Name, IsActive, OutletId, DisplayOrder, ItemCount) 
                        VALUES (@name, @active, @outletId, @order, @itemCount)
                    `);
                
                console.log(`✅ Created Favourites group with ${favouriteCount} items for outlet ${outletId}`);
            }
        } else {
            // Update existing group count
            const currentCount = groupResult.recordset[0].ItemCount || 0;
            if (currentCount !== favouriteCount) {
                await pool.request()
                    .input('outletId', sql.Int, outletId)
                    .input('count', sql.Int, favouriteCount)
                    .query(`
                        UPDATE DishGroup 
                        SET ItemCount = @count 
                        WHERE Name = 'Favourites' AND OutletId = @outletId
                    `);
                console.log(`✅ Updated Favourites count from ${currentCount} to ${favouriteCount} for outlet ${outletId}`);
            }
        }
        
        return favouriteCount;
    } catch (err) {
        console.error('❌ Error ensuring Favourites group:', err);
        return 0;
    }
};
// ============================================
// GET all dish groups (UPDATED - Hide empty Favourites)
// ============================================
const getAllGroups = async (req, res) => {
    try {
        const outletId = await getEffectiveOutletId(req);
        
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        const pool = getPool();
        
        // ✅ Ensure Favourites group has correct count
        await ensureFavouritesGroupExists(outletId);
        
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
                ORDER BY 
                    CASE WHEN Name = 'Favourites' THEN 999999 ELSE DisplayOrder END,
                    Name
            `);
        
        // ✅ Filter: Hide Favourites only if it has 0 items AND is not the only group
        // (But we already updated count, so ItemCount should be accurate)
        const filteredGroups = result.recordset.filter(group => {
            if (group.Name === 'Favourites' && group.ItemCount === 0) {
                return false; // Hide empty Favourites
            }
            return true;
        });
        
        console.log(`✅ ${req.user.role} ${req.user.id} fetched ${filteredGroups.length} groups for outlet ${outletId}`);
        console.log(`⭐ Favourites group has ${result.recordset.find(g => g.Name === 'Favourites')?.ItemCount || 0} items`);
        res.json(filteredGroups);
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
// CREATE new dish group (UPDATED - Prevent manual Favourites)
// ============================================
const createGroup = async (req, res) => {
    try {
        const { name, active } = req.body;
        const outletId = await getEffectiveOutletId(req);
        
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        // ✅ Prevent manual creation of Favourites group
        if (name && name.toLowerCase() === 'favourites') {
            return res.status(403).json({ error: 'Favourites group is automatically managed' });
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
// UPDATE dish group (UPDATED - Prevent editing Favourites)
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
        
        // ✅ Check if this is Favourites group
        const checkGroup = await pool.request()
            .input('id', sql.Int, id)
            .input('outletId', sql.Int, outletId)
            .query('SELECT Name FROM DishGroup WHERE Id = @id AND OutletId = @outletId');
        
        if (checkGroup.recordset.length > 0 && checkGroup.recordset[0].Name === 'Favourites') {
            return res.status(403).json({ error: 'Favourites group cannot be edited' });
        }
        
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
// DELETE dish group (UPDATED - Prevent deleting Favourites)
// ============================================
const deleteGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const outletId = await getEffectiveOutletId(req);
        
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        const pool = getPool();
        
        // ✅ Check if this is Favourites group
        const checkGroup = await pool.request()
            .input('id', sql.Int, id)
            .input('outletId', sql.Int, outletId)
            .query('SELECT Name FROM DishGroup WHERE Id = @id AND OutletId = @outletId');
        
        if (checkGroup.recordset.length > 0 && checkGroup.recordset[0].Name === 'Favourites') {
            return res.status(403).json({ error: 'Favourites group cannot be deleted' });
        }
        
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
// UPDATE group order (UPDATED - Favourites always at bottom)
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
        
        // ✅ Get Favourites group ID if exists
        const favouritesResult = await pool.request()
            .input('outletId', sql.Int, outletId)
            .query("SELECT Id FROM DishGroup WHERE Name = 'Favourites' AND OutletId = @outletId");
        
        const favouritesId = favouritesResult.recordset[0]?.Id;
        
        const transaction = pool.transaction();
        await transaction.begin();
        
        try {
            for (const group of groups) {
                // ✅ Skip Favourites from order update (keep at bottom)
                if (favouritesId && group.id === favouritesId) {
                    continue;
                }
                
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
            
            // ✅ Ensure Favourites has highest order (at bottom)
            if (favouritesId) {
                const maxOrderResult = await transaction.request()
                    .input('outletId', sql.Int, outletId)
                    .query('SELECT ISNULL(MAX(DisplayOrder), -1) + 1 as MaxOrder FROM DishGroup WHERE OutletId = @outletId AND Name != \'Favourites\'');
                
                await transaction.request()
                    .input('id', sql.Int, favouritesId)
                    .input('order', sql.Int, maxOrderResult.recordset[0].MaxOrder)
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

// ============================================
// ✅ NEW: Auto-create Favourites group (called from dishItem)
// ============================================
const ensureFavouritesGroup = async (outletId) => {
    try {
        const pool = getPool();
        
        // Check if Favourites group exists
        const result = await pool.request()
            .input('outletId', sql.Int, outletId)
            .query("SELECT Id FROM DishGroup WHERE Name = 'Favourites' AND OutletId = @outletId");
        
        if (result.recordset.length === 0) {
            // Create Favourites group
            const maxOrderResult = await pool.request()
                .input('outletId', sql.Int, outletId)
                .query('SELECT ISNULL(MAX(DisplayOrder), -1) + 1 as NextOrder FROM DishGroup WHERE OutletId = @outletId');
            
            const insertResult = await pool.request()
                .input('name', sql.NVarChar, 'Favourites')
                .input('active', sql.Bit, true)
                .input('outletId', sql.Int, outletId)
                .input('order', sql.Int, maxOrderResult.recordset[0].NextOrder)
                .query(`
                    INSERT INTO DishGroup (Name, IsActive, OutletId, DisplayOrder) 
                    OUTPUT INSERTED.Id
                    VALUES (@name, @active, @outletId, @order)
                `);
            
            console.log(`✅ Auto-created Favourites group for outlet ${outletId}`);
            return insertResult.recordset[0].Id;
        }
        
        return result.recordset[0].Id;
    } catch (err) {
        console.error('❌ Error creating Favourites group:', err);
        return null;
    }
};

// ============================================
// ✅ NEW: Update Favourites item count
// ============================================
const updateFavouritesCount = async (outletId, delta) => {
    try {
        const pool = getPool();
        
        // Get actual count from DishItem table (more reliable)
        const countResult = await pool.request()
            .input('outletId', sql.Int, outletId)
            .query(`
                SELECT COUNT(*) as FavouriteCount 
                FROM DishItem 
                WHERE OutletId = @outletId AND IsFavourite = 1
            `);
        
        const actualCount = countResult.recordset[0].FavouriteCount;
        
        // Update DishGroup with actual count
        await pool.request()
            .input('outletId', sql.Int, outletId)
            .input('count', sql.Int, actualCount)
            .query(`
                UPDATE DishGroup 
                SET ItemCount = @count 
                WHERE Name = 'Favourites' AND OutletId = @outletId
            `);
        
        console.log(`✅ Updated Favourites count for outlet ${outletId}: ${actualCount} items (delta: ${delta})`);
        
        // If count became 0, we can optionally delete the group
        // But we keep it for now (will be hidden in getAllGroups)
        
        return actualCount;
    } catch (err) {
        console.error('❌ Error updating Favourites count:', err);
        return 0;
    }
};

module.exports = {
    getAllGroups,
    getGroupById,
    createGroup,
    updateGroup,
    deleteGroup,
    updateGroupOrder,
    ensureFavouritesGroup,    // ✅ NEW
    ensureFavouritesGroupExists, 
    updateFavouritesCount     // ✅ NEW
};