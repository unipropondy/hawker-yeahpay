// backend/controllers/dishItemController.js
const { getPool, sql } = require('../config/db');
const { ensureFavouritesGroup, updateFavouritesCount } = require('./dishGroupController');

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
// GET all dish items (UPDATED with isFavourite)
// ============================================
const getAllItems = async (req, res) => {
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
                    d.Id, 
                    d.Name, 
                    d.Price, 
                    d.ImageUrl as imageUri, 
                    d.CategoryId, 
                    d.OriginalName, 
                    d.OriginalCategory,
                    d.DisplayCategory, 
                    d.IsActive,
                    d.IsOpenPrice,
                    d.IsFavourite,
                    g.Name as categoryName
                FROM DishItem d
                LEFT JOIN DishGroup g ON d.CategoryId = g.Id AND g.OutletId = @outletId
                WHERE d.OutletId = @outletId
                ORDER BY d.Id
            `);
        
        console.log(`✅ ${req.user.role} ${req.user.id} fetched ${result.recordset.length} items for outlet ${outletId}`);
        
        const openPriceCount = result.recordset.filter(item => item.IsOpenPrice).length;
        const favouriteCount = result.recordset.filter(item => item.IsFavourite).length;
        if (openPriceCount > 0) {
            console.log(`📊 Found ${openPriceCount} open price items`);
        }
        if (favouriteCount > 0) {
            console.log(`⭐ Found ${favouriteCount} favourite items`);
        }
        
        res.json(result.recordset);
    } catch (err) {
        console.error('Error getting items:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================
// GET items by category (UPDATED)
// ============================================
const getItemsByCategory = async (req, res) => {
    try {
        const { categoryId } = req.params;
        const outletId = await getEffectiveOutletId(req);
        
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        const pool = getPool();
        
        // ✅ Get category name to check if it's Favourites
        const categoryCheck = await pool.request()
            .input('categoryId', sql.Int, categoryId)
            .input('outletId', sql.Int, outletId)
            .query('SELECT Id, Name FROM DishGroup WHERE Id = @categoryId AND OutletId = @outletId');
        
        if (categoryCheck.recordset.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }
        
        const categoryName = categoryCheck.recordset[0].Name;
        
        let result;
        
        // ✅ If category is Favourites, query by IsFavourite flag (not by CategoryId)
        if (categoryName === 'Favourites') {
            console.log(`⭐ Fetching Favourites items for outlet ${outletId}`);
            
            result = await pool.request()
                .input('outletId', sql.Int, outletId)
                .query(`
                    SELECT 
                        d.Id, 
                        d.Name, 
                        d.Price, 
                        d.ImageUrl as imageUri,
                        d.OriginalName, 
                        d.OriginalCategory, 
                        d.DisplayCategory,
                        d.IsFavourite,
                        d.CategoryId as originalCategoryId
                    FROM DishItem d
                    WHERE d.OutletId = @outletId 
                      AND d.IsFavourite = 1 
                      AND d.IsActive = 1
                    ORDER BY d.Name
                `);
            
            console.log(`⭐ Found ${result.recordset.length} favourite items`);
        } else {
            // ✅ Normal category - query by CategoryId
            result = await pool.request()
                .input('categoryId', sql.Int, categoryId)
                .input('outletId', sql.Int, outletId)
                .query(`
                    SELECT 
                        d.Id, 
                        d.Name, 
                        d.Price, 
                        d.ImageUrl as imageUri,
                        d.OriginalName, 
                        d.OriginalCategory, 
                        d.DisplayCategory,
                        d.IsFavourite
                    FROM DishItem d
                    WHERE d.CategoryId = @categoryId 
                      AND d.OutletId = @outletId 
                      AND d.IsActive = 1
                    ORDER BY d.Name
                `);
        }
        
        res.json(result.recordset);
        
    } catch (err) {
        console.error('Error getting items by category:', err);
        res.status(500).json({ error: err.message });
    }
};
// ============================================
// CREATE new dish item (UPDATED with isFavourite)
// ============================================
const createItem = async (req, res) => {
    try {
        const { 
            name, price, category, 
            originalName, originalCategory, displayCategory,
            isOpenPrice,
            isFavourite   // ✅ NEW
        } = req.body;
        
        const outletId = req.outletId;
        
        console.log('📝 Creating item:', {
            name,
            price,
            category,
            outletId,
            isOpenPrice,
            isFavourite
        });
        
        if (!outletId) {
            return res.status(400).json({ 
                error: 'OUTLET_REQUIRED', 
                message: 'Please select an outlet' 
            });
        }
        
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
        
        const pool = getPool();
        
        // Verify category belongs to outlet
        const categoryCheck = await pool.request()
            .input('categoryId', sql.Int, category)
            .input('outletId', sql.Int, outletId)
            .query('SELECT Id FROM DishGroup WHERE Id = @categoryId AND OutletId = @outletId');
        
        if (categoryCheck.recordset.length === 0) {
            return res.status(403).json({ error: 'Category not found in this outlet' });
        }
        
        const finalPrice = isOpenPrice === 'true' ? 0 : parseFloat(price);
        const finalIsFavourite = isFavourite === 'true' || isFavourite === true;
        
        const result = await pool.request()
            .input('name', sql.NVarChar, name)
            .input('price', sql.Decimal(10,2), finalPrice)
            .input('isOpenPrice', sql.Bit, isOpenPrice === 'true')
            .input('isFavourite', sql.Bit, finalIsFavourite)  // ✅ NEW
            .input('categoryId', sql.Int, category)
            .input('imageUrl', sql.NVarChar, imageUrl)
            .input('originalName', sql.NVarChar, originalName || name)
            .input('originalCategory', sql.NVarChar, originalCategory || category)
            .input('displayCategory', sql.NVarChar, displayCategory || '')
            .input('outletId', sql.Int, outletId)
            .query(`
                INSERT INTO DishItem (
                    Name, Price, IsOpenPrice, CategoryId, ImageUrl, 
                    OriginalName, OriginalCategory, DisplayCategory, OutletId,
                    IsFavourite
                )
                OUTPUT INSERTED.*
                VALUES (
                    @name, @price, @isOpenPrice, @categoryId, @imageUrl,
                    @originalName, @originalCategory, @displayCategory, @outletId,
                    @isFavourite
                )
            `);
        
        // Update item count in original category
        await pool.request()
            .input('categoryId', sql.Int, category)
            .query('UPDATE DishGroup SET ItemCount = ItemCount + 1 WHERE Id = @categoryId');
        
        // ✅ If favourite, create/update Favourites group
        if (finalIsFavourite) {
            await ensureFavouritesGroup(outletId);
            await updateFavouritesCount(outletId, 1);
        }
        
        console.log(`✅ Item created for outlet ${outletId}${finalIsFavourite ? ' (⭐ Favourite)' : ''}`);
        res.status(201).json(result.recordset[0]);
        
    } catch (err) {
        console.error('❌ Error creating item:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================
// UPDATE dish item (UPDATED with isFavourite)
// ============================================
const updateItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            name, price, category, 
            originalName, originalCategory, displayCategory, 
            isActive,
            isOpenPrice,
            isFavourite   // ✅ NEW
        } = req.body;
        
        const outletId = req.outletId;
        
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        console.log('📝 Updating item:', { 
            id, 
            name, 
            price, 
            category, 
            isOpenPrice,
            isFavourite,
            outletId 
        });
        
        const pool = getPool();
        
        // Get current item details (including favourite status)
        const currentItem = await pool.request()
            .input('id', sql.Int, id)
            .input('outletId', sql.Int, outletId)
            .query('SELECT CategoryId, IsFavourite FROM DishItem WHERE Id = @id AND OutletId = @outletId');
        
        if (currentItem.recordset.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        
        const oldCategoryId = currentItem.recordset[0].CategoryId;
        const oldIsFavourite = currentItem.recordset[0].IsFavourite === 1;
        const newIsFavourite = isFavourite === true || isFavourite === 'true';
        
        // Verify new category belongs to outlet (if changed)
        if (category && oldCategoryId !== parseInt(category)) {
            const categoryCheck = await pool.request()
                .input('categoryId', sql.Int, category)
                .input('outletId', sql.Int, outletId)
                .query('SELECT Id FROM DishGroup WHERE Id = @categoryId AND OutletId = @outletId');
            
            if (categoryCheck.recordset.length === 0) {
                return res.status(403).json({ error: 'New category not found' });
            }
        }
        
        let imageUrl = null;
        if (req.file) {
            imageUrl = `/uploads/${req.file.filename}`;
        }
        
        const finalIsOpenPrice = isOpenPrice === true || isOpenPrice === 'true';
        const finalPrice = finalIsOpenPrice ? 0 : parseFloat(price);
        
        // Build dynamic update query
        let updateQuery = 'UPDATE DishItem SET ';
        const updates = [];
        const request = pool.request();
        
        request.input('id', sql.Int, id);
        request.input('outletId', sql.Int, outletId);
        
        if (name !== undefined) {
            updates.push('Name = @name');
            request.input('name', sql.NVarChar, name);
        }
        
        updates.push('Price = @price');
        request.input('price', sql.Decimal(10,2), finalPrice);
        
        updates.push('IsOpenPrice = @isOpenPrice');
        request.input('isOpenPrice', sql.Bit, finalIsOpenPrice ? 1 : 0);
        
        // ✅ Add isFavourite update
        updates.push('IsFavourite = @isFavourite');
        request.input('isFavourite', sql.Bit, newIsFavourite ? 1 : 0);
        
        if (category !== undefined) {
            updates.push('CategoryId = @categoryId');
            request.input('categoryId', sql.Int, category);
        }
        
        if (originalName !== undefined) {
            updates.push('OriginalName = @originalName');
            request.input('originalName', sql.NVarChar, originalName);
        }
        
        if (originalCategory !== undefined) {
            updates.push('OriginalCategory = @originalCategory');
            request.input('originalCategory', sql.NVarChar, originalCategory);
        }
        
        if (displayCategory !== undefined) {
            updates.push('DisplayCategory = @displayCategory');
            request.input('displayCategory', sql.NVarChar, displayCategory);
        }
        
        if (isActive !== undefined) {
            updates.push('IsActive = @isActive');
            request.input('isActive', sql.Bit, isActive ? 1 : 0);
        }
        
        if (imageUrl) {
            updates.push('ImageUrl = @imageUrl');
            request.input('imageUrl', sql.NVarChar, imageUrl);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        
        updateQuery += updates.join(', ') + ' OUTPUT INSERTED.* WHERE Id = @id AND OutletId = @outletId';
        
        const result = await request.query(updateQuery);
        
        // ✅ Handle favourite status change
        if (oldIsFavourite !== newIsFavourite) {
            if (newIsFavourite) {
                // Added to favourites
                await ensureFavouritesGroup(outletId);
                await updateFavouritesCount(outletId, 1);
            } else {
                // Removed from favourites
                await updateFavouritesCount(outletId, -1);
            }
        }
        
        // Update category counts if category changed
        if (category && oldCategoryId !== parseInt(category)) {
            await pool.request()
                .input('categoryId', sql.Int, oldCategoryId)
                .query('UPDATE DishGroup SET ItemCount = ItemCount - 1 WHERE Id = @categoryId');
            
            await pool.request()
                .input('categoryId', sql.Int, category)
                .query('UPDATE DishGroup SET ItemCount = ItemCount + 1 WHERE Id = @categoryId');
        }
        
        console.log(`✅ Item updated for outlet ${outletId}${newIsFavourite ? ' (⭐ Favourite)' : oldIsFavourite ? ' (⭐ Removed from Favourites)' : ''}`);
        res.json(result.recordset[0]);
        
    } catch (err) {
        console.error('❌ Error updating item:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================
// DELETE dish item (UPDATED with favourite handling)
// ============================================
const deleteItem = async (req, res) => {
    try {
        const { id } = req.params;
        const outletId = req.outletId;
        
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        const pool = getPool();
        
        // Get category and favourite status before deleting
        const item = await pool.request()
            .input('id', sql.Int, id)
            .input('outletId', sql.Int, outletId)
            .query('SELECT CategoryId, IsFavourite FROM DishItem WHERE Id = @id AND OutletId = @outletId');
        
        if (item.recordset.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        
        const categoryId = item.recordset[0].CategoryId;
        const wasFavourite = item.recordset[0].IsFavourite === 1;
        
        // Delete the item
        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM DishItem WHERE Id = @id');
        
        // Decrease item count in original category
        await pool.request()
            .input('categoryId', sql.Int, categoryId)
            .query('UPDATE DishGroup SET ItemCount = ItemCount - 1 WHERE Id = @categoryId');
        
        // ✅ If item was favourite, decrease Favourites count
        if (wasFavourite) {
            await updateFavouritesCount(outletId, -1);
        }
        
        console.log(`✅ Item deleted from outlet ${outletId}${wasFavourite ? ' (⭐ Removed from Favourites)' : ''}`);
        res.json({ message: 'Item deleted successfully' });
    } catch (err) {
        console.error('Error deleting item:', err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getAllItems,
    getItemsByCategory,
    createItem,
    updateItem,
    deleteItem
};