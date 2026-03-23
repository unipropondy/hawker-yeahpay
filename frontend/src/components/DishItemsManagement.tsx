// src/components/DishItemsManagement.tsx
import React, { useState, useEffect } from 'react';
import API from '../api';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  Switch,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { uploadAPI } from '../api';
import { useCurrency } from '../context/CurrencyContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface MenuItem {
  id: number;
  name: string;
  price: number;
  imageUri: string | null;
  category: string;
  categoryId?: string; 
  categoryName?: string; 
  originalName?: string;
  originalCategory?: string;
  displayCategory?: string;
  isActive?: boolean;
  isOpenPrice?: boolean;
  isFavourite?: boolean;  // ✅ NEW
}

interface DishGroup {
  id: number;
  name: string;
  itemCount: number;
  active: boolean;
  DisplayOrder?: number;
}

interface DishItemsManagementProps {
  menuItems: MenuItem[];
  setMenuItems: (items: MenuItem[]) => void;
  categories: string[];
  dishGroups: DishGroup[];
  setDishGroups: (groups: DishGroup[]) => void;
  currentTheme: any;
  t: any;
  onItemUpdate: () => void;
  imageUploading: boolean;
  setImageUploading: (loading: boolean) => void;
  pickImage: (setter: (uri: string) => void) => Promise<void>;
  captureImage: (setter: (uri: string) => void) => Promise<void>;
}

export const DishItemsManagement: React.FC<DishItemsManagementProps> = ({
  menuItems,
  setMenuItems,
  categories,
  dishGroups,
  setDishGroups,
  currentTheme,
  t,
  onItemUpdate,
  imageUploading,
  setImageUploading,
  pickImage,
  captureImage,
}) => {
  const { formatPrice } = useCurrency();
  const [refreshKey, setRefreshKey] = useState(0);
  
  // ============================================
  // STATE MANAGEMENT
  // ============================================
  const [selectedGroup, setSelectedGroup] = useState<DishGroup | null>(null);
  const [showAddDish, setShowAddDish] = useState(false);
  const [showEditDish, setShowEditDish] = useState(false);
  const [editingDish, setEditingDish] = useState<MenuItem | null>(null);
  const [isOpenPrice, setIsOpenPrice] = useState(false);
  const [isFavourite, setIsFavourite] = useState(false);  // ✅ NEW
  const [newDish, setNewDish] = useState<any>({
    name: '',
    price: '',
    category: '',
    imageUri: null,
    isActive: true,
    isOpenPrice: false,
    isFavourite: false  // ✅ NEW
  });
  
  const [loading, setLoading] = useState(false);
  const [categoryError, setCategoryError] = useState(false);

  // ============================================
  // DERIVED DATA
  // ============================================
  
  const sortedGroups = React.useMemo(() => {
    return [...dishGroups]
      .filter(g => g.active !== false)
      .sort((a, b) => (a.DisplayOrder ?? 999) - (b.DisplayOrder ?? 999));
  }, [dishGroups]);

  // Get items for selected group ONLY
const groupItems = React.useMemo(() => {
    if (!selectedGroup) {
        console.log('⚠️ groupItems: No selected group');
        return [];
    }
    
    console.log(`🎯 groupItems: selectedGroup.name = "${selectedGroup.name}"`);
    console.log(`🎯 groupItems: selectedGroup.id = ${selectedGroup.id}`);
    console.log(`🎯 groupItems: menuItems length = ${menuItems.length}`);
    console.log(`⭐ groupItems: favourite items in menu = ${menuItems.filter(i => i.isFavourite === true).length}`);
    
    // ✅ If selected group is Favourites, show all favourite items
    if (selectedGroup.name === 'Favourites') {
        const favouriteItems = menuItems.filter(item => item.isFavourite === true);
        console.log(`⭐ Favourites group: Found ${favouriteItems.length} favourite items`);
        return favouriteItems.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    // ✅ Normal category - filter by category name/id
    const filtered = menuItems.filter(item => 
        item.categoryId === selectedGroup.id.toString() || 
        item.displayCategory === selectedGroup.name ||
        item.category === selectedGroup.name
    );
    
    console.log(`📦 ${selectedGroup.name}: Found ${filtered.length} items`);
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
}, [menuItems, selectedGroup]);

  // ============================================
  // EFFECTS
  // ============================================
  useEffect(() => {
    console.log('📋 All groups in sortedGroups:', sortedGroups.map(g => ({ id: g.id, name: g.name })));
    
    // Find Favourites in groups
    const favouritesGroup = sortedGroups.find(g => g.name === 'Favourites');
    if (favouritesGroup) {
        console.log(`⭐ Found Favourites group: ID ${favouritesGroup.id}, Name: ${favouritesGroup.name}, ItemCount: ${favouritesGroup.itemCount}`);
    } else {
        console.log('❌ Favourites group NOT found in sortedGroups');
    }
}, [sortedGroups]);
  useEffect(() => {
    if (sortedGroups.length > 0 && !selectedGroup) {
      setSelectedGroup(sortedGroups[0]);
    }
  }, [sortedGroups]);

  useEffect(() => {
    if (selectedGroup && showAddDish) {
      setNewDish(prev => ({
        ...prev,
        category: selectedGroup.name
      }));
    }
  }, [selectedGroup, showAddDish]);

  useEffect(() => {
    const checkOutlet = async () => {
      const outletId = await AsyncStorage.getItem('selectedOutletId');
      if (!outletId) {
        Alert.alert(
          'No Outlet Selected',
          'Please select an outlet first',
          [
            {
              text: 'OK',
              onPress: () => {
                setShowAddDish(false);
              }
            }
          ]
        );
      }
    };
    
    if (showAddDish) {
      checkOutlet();
    }
  }, [showAddDish]);
  
  useEffect(() => {
    if (!showAddDish && !showEditDish) {
      setIsOpenPrice(false);
      setIsFavourite(false);  // ✅ NEW
    }
  }, [showAddDish, showEditDish]);

  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  
  const getCategoryIdByName = (categoryName: string): number => {
    const category = dishGroups.find(g => g.name === categoryName);
    return category?.id || 0;
  };

  const getEnglishCategory = (categoryName: string): string => {
    if (categoryName === t.appetiser) return 'Appetiser';
    if (categoryName === t.mainCourse) return 'Main Course';
    if (categoryName === t.hotDrinks) return 'Hot Drinks';
    if (categoryName === t.desserts) return 'Desserts';
    return categoryName;
  };

  const validateDishForm = (): boolean => {
    if (!newDish.name?.trim()) {
      Alert.alert(t.error || 'Error', 'Please enter dish name');
      return false;
    }

    if (!isOpenPrice) {
      const price = parseFloat(newDish.price);
      if (isNaN(price) || price <= 0) {
        Alert.alert(t.error || 'Error', 'Please enter valid price');
        return false;
      }
    }

    if (!selectedGroup) {
      Alert.alert(t.error || 'Error', 'Please select a group first');
      return false;
    }

    return true;
  };

  // ============================================
  // HANDLER FUNCTIONS
  // ============================================
  
  const handleOpenAdd = () => {
    if (!selectedGroup) {
      Alert.alert('Error', 'Please select a group first');
      return;
    }
    
    setNewDish({
      name: '',
      price: '',
      category: selectedGroup.name,
      imageUri: null,
      isActive: true,
      isOpenPrice: false,
      isFavourite: false  // ✅ NEW
    });
    setIsOpenPrice(false);
    setIsFavourite(false);  // ✅ NEW
    setCategoryError(false);
    setShowAddDish(true);
  };

  useEffect(() => {
    console.log('🔄 isOpenPrice changed to:', isOpenPrice);
    console.log('🔄 isFavourite changed to:', isFavourite);
    console.log('📦 newDish price:', newDish.price);
  }, [isOpenPrice, isFavourite, newDish.price]);

  const handleAddDish = async (): Promise<void> => {
    if (!validateDishForm() || !selectedGroup) return;

    setLoading(true);
    setCategoryError(false);
    
    try {
      const outletId = await AsyncStorage.getItem('selectedOutletId');
      
      if (!outletId) {
        Alert.alert(
          'Outlet Required',
          'Please select an outlet before adding items.',
          [
            {
              text: 'OK',
              onPress: () => setShowAddDish(false)
            }
          ]
        );
        setLoading(false);
        return;
      }
      
      console.log('📍 Adding dish for outlet:', outletId);
      console.log('⭐ Is favourite:', isFavourite);
      
      const formData = new FormData();
      formData.append('name', newDish.name.trim());
      
      const priceValue = isOpenPrice ? '0' : newDish.price;
      formData.append('price', priceValue);
      formData.append('isOpenPrice', isOpenPrice ? 'true' : 'false');
      formData.append('isActive', newDish.isActive ? 'true' : 'false');
      formData.append('isFavourite', isFavourite ? 'true' : 'false');  // ✅ NEW
      formData.append('category', selectedGroup.id.toString());
      formData.append('originalName', newDish.name.trim());
      formData.append('originalCategory', selectedGroup.name);
      formData.append('displayCategory', selectedGroup.name);
      formData.append('outletId', outletId);

      if (newDish.imageUri) {
        const filename = newDish.imageUri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename || '');
        const type = match ? `image/${match[1]}` : 'image';

        formData.append('image', {
          uri: newDish.imageUri,
          name: filename || 'image.jpg',
          type,
        } as any);
      }

      const response = await uploadAPI.post('/dishitems', formData, {
        headers: { 'Content-Type': 'multipart/form-data', 'X-Outlet-Id': outletId },
      });

      const baseURL = __DEV__ 
        ? 'http://192.168.0.169:5000'
        : 'https://hawkerfinalv-production.up.railway.app';
      
      const imagePath = response.data.imageUri || response.data.ImageUrl;
      
      let imageUrl = null;
      if (imagePath) {
        if (imagePath.startsWith('http')) {
          imageUrl = imagePath;
        } else if (imagePath.startsWith('/')) {
          imageUrl = `${baseURL}${imagePath}`;
        } else {
          imageUrl = `${baseURL}/uploads/${imagePath}`;
        }
      }

      const newItem = {
        id: response.data.Id || response.data.id,
        name: response.data.Name || response.data.name,
        price: isOpenPrice ? 0 : parseFloat(newDish.price),
        category: selectedGroup.id.toString(),
        categoryId: selectedGroup.id.toString(),
        displayCategory: selectedGroup.name,
        imageUri: imageUrl,
        originalName: newDish.name.trim(),
        originalCategory: selectedGroup.name,
        isActive: newDish.isActive,
        isOpenPrice: isOpenPrice,
        isFavourite: isFavourite,  // ✅ NEW
        outletId: parseInt(outletId)
      };
  
      setMenuItems([...menuItems, newItem]);

      const updatedGroups = dishGroups.map(group =>
        group.id === selectedGroup.id
          ? { ...group, itemCount: (group.itemCount || 0) + 1 }
          : group
      );
      setDishGroups(updatedGroups);

      setShowAddDish(false);
      onItemUpdate();
      setRefreshKey(prev => prev + 1);  

      Alert.alert('✅ Success', 
        isOpenPrice ? 'Open price item added' : 
        isFavourite ? '⭐ Added to Favourites!' : 'Item added successfully'
      );
      
    } catch (error: any) {
      console.log('❌ Error:', {
        message: error.message,
        response: error.response?.data
      });
      Alert.alert('❌ Error', error.response?.data?.error || 'Failed to add item');
    } finally {
      setLoading(false);
    }
  };

  const handleEditDish = async (): Promise<void> => {
    if (!editingDish || !selectedGroup) return;
    
    setLoading(true);
    
    try {
      const outletId = await AsyncStorage.getItem('selectedOutletId');
      
      if (!outletId) {
        Alert.alert('Error', 'No outlet selected');
        setLoading(false);
        return;
      }
      
      console.log('✏️ Editing dish, isFavourite:', isFavourite);
      
      const formData = new FormData();
      formData.append('name', newDish.name.trim());
      
      const priceValue = isOpenPrice ? '0' : newDish.price;
      formData.append('price', priceValue);
      formData.append('isOpenPrice', isOpenPrice ? 'true' : 'false'); 
      formData.append('isActive', newDish.isActive ? 'true' : 'false');
      formData.append('isFavourite', isFavourite ? 'true' : 'false');  // ✅ NEW
      formData.append('category', selectedGroup.id.toString());
      formData.append('originalName', newDish.name.trim());
      formData.append('originalCategory', selectedGroup.name);
      formData.append('displayCategory', selectedGroup.name);
      formData.append('outletId', outletId);

      if (newDish.imageUri && newDish.imageUri !== editingDish.imageUri) {
        const filename = newDish.imageUri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename || '');
        const type = match ? `image/${match[1]}` : 'image';

        formData.append('image', {
          uri: newDish.imageUri,
          name: filename || 'image.jpg',
          type,
        } as any);
      }

      const response = await uploadAPI.put(`/dishitems/${editingDish.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data', 'X-Outlet-Id': outletId },
      });

      const baseURL = __DEV__ 
        ? 'http://192.168.0.169:5000'
        : 'https://hawkerfinalv-production.up.railway.app';
      
      const imagePath = response.data.imageUri || response.data.ImageUrl;
      
      let imageUrl = newDish.imageUri;
      
      if (imagePath) {
        if (imagePath.startsWith('http')) {
          imageUrl = imagePath;
        } else if (imagePath.startsWith('/')) {
          imageUrl = `${baseURL}${imagePath}`;
        } else {
          imageUrl = `${baseURL}/uploads/${imagePath}`;
        }
      }

      const updatedItem = {
        ...editingDish,
        name: newDish.name.trim(),
        price: isOpenPrice ? 0 : parseFloat(newDish.price),
        category: selectedGroup.id.toString(),
        categoryId: selectedGroup.id.toString(),
        displayCategory: selectedGroup.name,
        imageUri: imageUrl,
        originalName: newDish.name.trim(),
        originalCategory: selectedGroup.name,
        isActive: newDish.isActive,
        isOpenPrice: isOpenPrice,
        isFavourite: isFavourite,  // ✅ NEW
        outletId: parseInt(outletId)
      };

      const updatedItems = menuItems.map(item =>
        item.id === editingDish.id ? updatedItem : item
      );
      setMenuItems(updatedItems);

      setShowEditDish(false);
      onItemUpdate();
      
      Alert.alert('✅ Success', 
        isFavourite ? '⭐ Updated to Favourites!' : 'Item updated successfully'
      );
      
    } catch (error: any) {
      console.log('❌ Edit error:', {
        message: error.message,
        response: error.response?.data
      });
      Alert.alert('❌ Error', error.response?.data?.error || 'Failed to update item');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (item: MenuItem) => {
    setLoading(true);
    try {
      const newActiveState = !(item.isActive ?? true);
      
      const categoryName = item.displayCategory || item.category;
      const category = dishGroups.find(g => g.name === categoryName);
      
      if (!category) {
        Alert.alert('Error', 'Category not found');
        setLoading(false);
        return;
      }
      
      await API.put(`/dishitems/${item.id}`, {
        name: item.name,
        price: item.price,
        category: category.id,
        originalName: item.originalName || item.name,
        originalCategory: item.originalCategory || categoryName,
        displayCategory: item.displayCategory || categoryName,
        isActive: newActiveState,
        isOpenPrice: item.isOpenPrice || false,
        isFavourite: item.isFavourite || false,  // ✅ NEW
      });

      const updatedItems = menuItems.map(i => 
        i.id === item.id ? { ...i, isActive: newActiveState } : i
      );
      setMenuItems(updatedItems);
      onItemUpdate();
      
    } catch (error) {
      Alert.alert('❌ Error', 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };
useEffect(() => {
    if (selectedGroup) {
        console.log(`🔄🔄🔄 selectedGroup CHANGED to: ${selectedGroup.name}, ID: ${selectedGroup.id}`);
        console.log(`🔄🔄🔄 menuItems length: ${menuItems.length}`);
        console.log(`🔄🔄🔄 Favourite items count: ${menuItems.filter(i => i.isFavourite).length}`);
    }
}, [selectedGroup]);
useEffect(() => {
    console.log('📋 All groups in sortedGroups:', sortedGroups.map(g => ({ id: g.id, name: g.name, itemCount: g.itemCount })));
    
    // ✅ Auto-select Favourites if it has items
    const favouritesGroup = sortedGroups.find(g => g.name === 'Favourites');
    if (favouritesGroup && favouritesGroup.itemCount > 0) {
        console.log(`⭐ Auto-selecting Favourites group: ${favouritesGroup.name} (${favouritesGroup.itemCount} items)`);
        setSelectedGroup(favouritesGroup);
    } else if (sortedGroups.length > 0 && !selectedGroup) {
        // Otherwise select first group
        setSelectedGroup(sortedGroups[0]);
    }
}, [sortedGroups]);
  const handleDeleteDish = (dish: MenuItem): void => {
    Alert.alert(
      t.delete,
      `${t.confirmDelete} "${dish.name}"?`,
      [
        { text: t.no, style: 'cancel' },
        {
          text: t.yes,
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await API.delete(`/dishitems/${dish.id}`);

              const updatedItems = menuItems.filter(item => item.id !== dish.id);
              setMenuItems(updatedItems);

              const updatedGroups = dishGroups.map(group =>
                (group.name === dish.displayCategory || group.name === dish.category)
                  ? { ...group, itemCount: Math.max(0, group.itemCount - 1) }
                  : group
              );
              setDishGroups(updatedGroups);

              onItemUpdate();
              Alert.alert('✅ Success', 'Item deleted');
              
            } catch (error) {
              Alert.alert(t.error || '❌ Error', 'Failed to delete dish item');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const renderOpenPriceBadge = (item: MenuItem) => {
    if (item.isOpenPrice) {
      return (
        <View style={[styles.openPriceBadge, { backgroundColor: currentTheme.warning + '20' }]}>
          <Text style={[styles.openPriceBadgeText, { color: currentTheme.warning }]}>
            Open Price
          </Text>
        </View>
      );
    }
    return null;
  };

  // ✅ NEW: Render favourite badge
  const renderFavouriteBadge = (item: MenuItem) => {
    if (item.isFavourite) {
      return (
        <View style={[styles.favouriteBadge, { backgroundColor: currentTheme.warning + '20' }]}>
          <Ionicons name="star" size={12} color={currentTheme.warning} />
          <Text style={[styles.favouriteBadgeText, { color: currentTheme.warning }]}>
            Favourite
          </Text>
        </View>
      );
    }
    return null;
  };

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <Text style={[styles.title, { color: currentTheme.text }]}>{t.dishItems}</Text>

      {/* GROUP CHIPS */}
      {/* GROUP CHIPS */}
<ScrollView 
    horizontal 
    showsHorizontalScrollIndicator={false}
    style={styles.groupsScroll}
    contentContainerStyle={styles.groupsContainer}
>
    {sortedGroups.map((group) => (
        <TouchableOpacity
            key={`group-${group.id}`}
            style={[
                styles.groupChip,
                {
                    backgroundColor: selectedGroup?.id === group.id 
                        ? currentTheme.primary 
                        : currentTheme.surface,
                    borderColor: currentTheme.border
                }
            ]}
            onPress={() => {
                console.log(`🖱️ CLICKED on group: "${group.name}", ID: ${group.id}`);
                console.log(`🖱️ Current selectedGroup before: ${selectedGroup?.name}`);
                setSelectedGroup(group);
                console.log(`🖱️ Set selectedGroup to: ${group.name}`);
            }}
        >
            <Text style={[
                styles.groupChipText,
                { 
                    color: selectedGroup?.id === group.id 
                        ? '#ffffff' 
                        : currentTheme.text 
                }
            ]}>
                {group.name} ({group.itemCount || 0})
            </Text>
        </TouchableOpacity>
    ))}
</ScrollView>

      {selectedGroup && (
        <View style={[styles.groupInfo, { backgroundColor: currentTheme.surface }]}>
          <Text style={[styles.groupInfoTitle, { color: currentTheme.text }]}>
            {selectedGroup.name} - {groupItems.length} items
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: currentTheme.secondary }]}
        onPress={handleOpenAdd}
        disabled={loading || !selectedGroup}
      >
        <Text style={styles.addButtonText}>
          + {t.addNewItem || 'Add New Item'} {selectedGroup ? `to ${selectedGroup.name}` : ''}
        </Text>
      </TouchableOpacity>

      {loading && <ActivityIndicator size="large" color={currentTheme.primary} />}

      <ScrollView style={styles.dishList} showsVerticalScrollIndicator={false}>
        {groupItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: currentTheme.textSecondary }]}>
              No items in this group
            </Text>
          </View>
        ) : (
          groupItems.map((item, index) => (
            <View
              key={`dish-${item.id}-${index}`}
              style={[
                styles.dishCard,
                {
                  backgroundColor: currentTheme.card,
                  borderColor: currentTheme.border,
                  opacity: (item.isActive ?? true) ? 1 : 0.5
                }
              ]}
            >
              <View style={styles.dishImageContainer}>
                {item.imageUri ? (
                  <Image source={{ uri: item.imageUri }} style={styles.dishThumbnail} />
                ) : (
                  <View style={[styles.dishThumbnailPlaceholder, { backgroundColor: currentTheme.surface }]}>
                    <Text style={styles.dishThumbnailText}>🍽️</Text>
                  </View>
                )}
              </View>

              <View style={styles.dishInfo}>
                <View style={styles.dishNameRow}>
                  <Text style={[styles.dishName, { color: currentTheme.text }]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  {renderOpenPriceBadge(item)}
                  {renderFavouriteBadge(item)}
                </View>
                <Text style={[styles.dishCategory, { color: currentTheme.textSecondary }]} numberOfLines={1}>
                  {item.displayCategory || item.category}
                </Text>
              </View>
              
              <Text style={[styles.dishPrice, { color: currentTheme.primary }]}>
                {item.isOpenPrice ? '—' : formatPrice(item.price)}
              </Text>
              
              <View style={styles.dishActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { 
                    backgroundColor: (item.isActive ?? true) ? currentTheme.success : currentTheme.inactive 
                  }]}
                  onPress={() => toggleActive(item)}
                  disabled={loading}
                >
                  <Ionicons 
                    name={(item.isActive ?? true) ? "eye" : "eye-off"} 
                    size={18} 
                    color="#fff" 
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: currentTheme.primary }]}
                  onPress={() => {
                    setEditingDish(item);
                    setNewDish({
                      name: item.originalName || item.name,
                      price: item.price.toString(),
                      category: selectedGroup?.name || item.displayCategory || item.category,
                      imageUri: item.imageUri,
                      isActive: item.isActive ?? true,
                      isOpenPrice: item.isOpenPrice || false,
                      isFavourite: item.isFavourite || false,  // ✅ NEW
                    });
                    setIsOpenPrice(item.isOpenPrice || false);
                    setIsFavourite(item.isFavourite || false);  // ✅ NEW
                    setCategoryError(false);
                    setShowEditDish(true);
                  }}
                  disabled={loading}
                >
                  <Ionicons name="pencil" size={18} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: currentTheme.danger }]}
                  onPress={() => handleDeleteDish(item)}
                  disabled={loading}
                >
                  <Ionicons name="trash" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* ADD DISH MODAL */}
      {/* ADD DISH MODAL */}
<Modal visible={showAddDish} transparent animationType="slide">
  <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
    <View style={styles.modalOverlay}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
          <View style={[styles.modalContent, { backgroundColor: currentTheme.card }]}>
            <Text style={[styles.modalTitle, { color: currentTheme.text }]}>
              Add Item to {selectedGroup?.name}
            </Text>

            {/* READONLY CATEGORY FIELD */}
            <View style={[styles.readonlyField, { backgroundColor: currentTheme.surface }]}>
              <Text style={[styles.readonlyLabel, { color: currentTheme.textSecondary }]}>
                Category:
              </Text>
              <Text style={[styles.readonlyValue, { color: currentTheme.primary }]}>
                {selectedGroup?.name}
              </Text>
            </View>

            {/* OPEN PRICE CHECKBOX */}
            <View style={styles.checkboxRow}>
              <TouchableOpacity
                style={[
                  styles.checkbox,
                  { 
                    backgroundColor: isOpenPrice ? currentTheme.primary : 'transparent',
                    borderColor: currentTheme.border
                  }
                ]}
                onPress={() => {
                  setIsOpenPrice(prev => !prev);
                  if (!isOpenPrice) {
                    setNewDish(current => ({ ...current, price: '' }));
                  }
                }}
              >
                {isOpenPrice && <Ionicons name="checkmark" size={18} color="#fff" />}
              </TouchableOpacity>
              <Text style={[styles.checkboxLabel, { color: currentTheme.text }]}>
                Open Price 
              </Text>
            </View>

            {/* FAVOURITE CHECKBOX */}
            <View style={styles.checkboxRow}>
              <TouchableOpacity
                style={[
                  styles.checkbox,
                  { 
                    backgroundColor: isFavourite ? currentTheme.primary : 'transparent',
                    borderColor: currentTheme.border
                  }
                ]}
                onPress={() => {
                  const newValue = !isFavourite;
                  setIsFavourite(newValue);
                  setNewDish({ ...newDish, isFavourite: newValue });
                }}
              >
                {isFavourite && <Ionicons name="star" size={16} color="#fff" />}
              </TouchableOpacity>
              <Text style={[styles.checkboxLabel, { color: currentTheme.text }]}>
                ⭐ Add to Favourites
              </Text>
            </View>
            <Text style={[styles.favouriteHint, { color: currentTheme.textSecondary }]}>
              Item will appear in Favourites category automatically
            </Text>

            {/* Image upload section */}
            <Text style={[styles.modalLabel, { color: currentTheme.text }]}>{t.dishImage}</Text>
            <View style={styles.imageUploadContainer}>
              {newDish.imageUri ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: newDish.imageUri }} style={styles.imagePreview} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => setNewDish({ ...newDish, imageUri: null })}
                  >
                    <Text style={styles.removeImageText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={[styles.imagePlaceholder, { backgroundColor: currentTheme.surface, borderColor: currentTheme.border }]}>
                  <Text style={styles.imagePlaceholderText}>📸</Text>
                  <Text style={[styles.imagePlaceholderSubText, { color: currentTheme.textSecondary }]}>{t.noImage}</Text>
                </View>
              )}

              <View style={styles.imageButtonsContainer}>
                <TouchableOpacity
                  style={[styles.imageButton, styles.galleryButton, { backgroundColor: currentTheme.secondary }]}
                  onPress={() => pickImage((uri) => setNewDish({ ...newDish, imageUri: uri }))}
                  disabled={imageUploading || loading}
                >
                  {imageUploading ? <ActivityIndicator size="small" color="#fff" /> : (
                    <>
                      <Text style={styles.imageButtonIcon}>🖼️</Text>
                      <Text style={styles.imageButtonText}>{t.gallery}</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.imageButton, styles.cameraButton, { backgroundColor: currentTheme.primary }]}
                  onPress={() => captureImage((uri) => setNewDish({ ...newDish, imageUri: uri }))}
                  disabled={imageUploading || loading}
                >
                  {imageUploading ? <ActivityIndicator size="small" color="#fff" /> : (
                    <>
                      <Text style={styles.imageButtonIcon}>📷</Text>
                      <Text style={styles.imageButtonText}>{t.camera}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <Text style={[styles.modalLabel, { color: currentTheme.text }]}>{t.dishName} *</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: currentTheme.surface, borderColor: currentTheme.border, color: currentTheme.text }]}
              placeholder={t.dishName}
              placeholderTextColor={currentTheme.textSecondary}
              value={newDish.name}
              onChangeText={(text) => setNewDish({ ...newDish, name: text })}
              editable={!loading}
            />

            {/* PRICE FIELD - Hidden when open price checked */}
            {!isOpenPrice && (
              <>
                <Text style={[styles.modalLabel, { color: currentTheme.text }]}>{t.price} *</Text>
                <TextInput
                  style={[styles.modalInput, { 
                    backgroundColor: currentTheme.surface, 
                    borderColor: currentTheme.border, 
                    color: currentTheme.text 
                  }]}
                  placeholder="0.00"
                  placeholderTextColor={currentTheme.textSecondary}
                  keyboardType="numeric"
                  value={newDish.price}
                  onChangeText={(text) => setNewDish({ ...newDish, price: text })}
                  editable={!loading}
                />
              </>
            )}

            {/* Active Switch */}
            <View style={styles.activeRow}>
              <Text style={[styles.activeLabel, { color: currentTheme.text }]}>Active</Text>
              <Switch
                value={newDish.isActive}
                onValueChange={(value) => setNewDish({ ...newDish, isActive: value })}
                trackColor={{ false: currentTheme.inactive, true: currentTheme.success }}
                thumbColor="#fff"
              />
            </View>

            {/* Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn, { backgroundColor: currentTheme.surface }]}
                onPress={() => {
                  setShowAddDish(false);
                  setNewDish({ 
                    name: '', 
                    price: '', 
                    category: '',
                    imageUri: null, 
                    isActive: true,
                    isOpenPrice: false,
                    isFavourite: false
                  });
                  setIsOpenPrice(false);
                  setIsFavourite(false);
                }}
                disabled={loading}
              >
                <Text style={[styles.cancelBtnText, { color: currentTheme.text }]}>{t.cancel}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalBtn, styles.saveBtn, { backgroundColor: currentTheme.primary }]}
                onPress={handleAddDish}
                disabled={loading}
              >
                {loading ? <ActivityIndicator size="small" color="#fff" /> : 
                  <Text style={styles.saveBtnText}>{t.save}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  </TouchableWithoutFeedback>
</Modal>
      {/* EDIT DISH MODAL */}
      {/* EDIT DISH MODAL */}
<Modal visible={showEditDish} transparent animationType="slide">
  <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
    <View style={styles.modalOverlay}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
          <View style={[styles.modalContent, { backgroundColor: currentTheme.card }]}>
            <Text style={[styles.modalTitle, { color: currentTheme.text }]}>{t.edit}</Text>

            <View style={[styles.readonlyField, { backgroundColor: currentTheme.surface }]}>
              <Text style={[styles.readonlyLabel, { color: currentTheme.textSecondary }]}>
                Category:
              </Text>
              <Text style={[styles.readonlyValue, { color: currentTheme.primary }]}>
                {selectedGroup?.name}
              </Text>
            </View>

            {/* OPEN PRICE CHECKBOX in Edit */}
            <View style={styles.checkboxRow}>
              <TouchableOpacity
                style={[
                  styles.checkbox,
                  { 
                    backgroundColor: isOpenPrice ? currentTheme.primary : 'transparent',
                    borderColor: currentTheme.border
                  }
                ]}
                onPress={() => {
                  setIsOpenPrice(!isOpenPrice);
                  if (!isOpenPrice) {
                    setNewDish({ ...newDish, price: '' });
                  }
                }}
              >
                {isOpenPrice && <Ionicons name="checkmark" size={18} color="#fff" />}
              </TouchableOpacity>
              <Text style={[styles.checkboxLabel, { color: currentTheme.text }]}>
                Open Price 
              </Text>
            </View>

            {/* FAVOURITE CHECKBOX in Edit */}
            <View style={styles.checkboxRow}>
              <TouchableOpacity
                style={[
                  styles.checkbox,
                  { 
                    backgroundColor: isFavourite ? currentTheme.primary : 'transparent',
                    borderColor: currentTheme.border
                  }
                ]}
                onPress={() => {
                  const newValue = !isFavourite;
                  setIsFavourite(newValue);
                  setNewDish({ ...newDish, isFavourite: newValue });
                }}
              >
                {isFavourite && <Ionicons name="star" size={16} color="#fff" />}
              </TouchableOpacity>
              <Text style={[styles.checkboxLabel, { color: currentTheme.text }]}>
                ⭐ Add to Favourites
              </Text>
            </View>
            <Text style={[styles.favouriteHint, { color: currentTheme.textSecondary }]}>
              Item will appear in Favourites category automatically
            </Text>

            {/* Image upload section */}
            <Text style={[styles.modalLabel, { color: currentTheme.text }]}>{t.dishImage}</Text>
            <View style={styles.imageUploadContainer}>
              {newDish.imageUri ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: newDish.imageUri }} style={styles.imagePreview} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => setNewDish({ ...newDish, imageUri: null })}
                  >
                    <Text style={styles.removeImageText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={[styles.imagePlaceholder, { backgroundColor: currentTheme.surface, borderColor: currentTheme.border }]}>
                  <Text style={styles.imagePlaceholderText}>📸</Text>
                  <Text style={[styles.imagePlaceholderSubText, { color: currentTheme.textSecondary }]}>{t.noImage}</Text>
                </View>
              )}

              <View style={styles.imageButtonsContainer}>
                <TouchableOpacity
                  style={[styles.imageButton, styles.galleryButton, { backgroundColor: currentTheme.secondary }]}
                  onPress={() => pickImage((uri) => setNewDish({ ...newDish, imageUri: uri }))}
                  disabled={imageUploading || loading}
                >
                  {imageUploading ? <ActivityIndicator size="small" color="#fff" /> : (
                    <>
                      <Text style={styles.imageButtonIcon}>🖼️</Text>
                      <Text style={styles.imageButtonText}>{t.gallery}</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.imageButton, styles.cameraButton, { backgroundColor: currentTheme.primary }]}
                  onPress={() => captureImage((uri) => setNewDish({ ...newDish, imageUri: uri }))}
                  disabled={imageUploading || loading}
                >
                  {imageUploading ? <ActivityIndicator size="small" color="#fff" /> : (
                    <>
                      <Text style={styles.imageButtonIcon}>📷</Text>
                      <Text style={styles.imageButtonText}>{t.camera}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <Text style={[styles.modalLabel, { color: currentTheme.text }]}>{t.dishName} *</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: currentTheme.surface, borderColor: currentTheme.border, color: currentTheme.text }]}
              placeholder={t.dishName}
              placeholderTextColor={currentTheme.textSecondary}
              value={newDish.name}
              onChangeText={(text) => setNewDish({ ...newDish, name: text })}
              editable={!loading}
            />

            {/* PRICE FIELD - Hidden for open price */}
            {!isOpenPrice && (
              <>
                <Text style={[styles.modalLabel, { color: currentTheme.text }]}>{t.price} *</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: currentTheme.surface, borderColor: currentTheme.border, color: currentTheme.text }]}
                  placeholder="0.00"
                  placeholderTextColor={currentTheme.textSecondary}
                  keyboardType="numeric"
                  value={newDish.price}
                  onChangeText={(text) => setNewDish({ ...newDish, price: text })}
                  editable={!loading}
                />
              </>
            )}

            <View style={styles.activeRow}>
              <Text style={[styles.activeLabel, { color: currentTheme.text }]}>Active</Text>
              <Switch
                value={newDish.isActive}
                onValueChange={(value) => setNewDish({ ...newDish, isActive: value })}
                trackColor={{ false: currentTheme.inactive, true: currentTheme.success }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn, { backgroundColor: currentTheme.surface }]}
                onPress={() => {
                  setShowEditDish(false);
                  setEditingDish(null);
                  setNewDish({ 
                    name: '', 
                    price: '', 
                    category: '', 
                    imageUri: null, 
                    isActive: true,
                    isOpenPrice: false,
                    isFavourite: false
                  });
                  setIsOpenPrice(false);
                  setIsFavourite(false);
                }}
                disabled={loading}
              >
                <Text style={[styles.cancelBtnText, { color: currentTheme.text }]}>{t.cancel}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalBtn, styles.saveBtn, { backgroundColor: currentTheme.primary }]}
                onPress={handleEditDish}
                disabled={loading}
              >
                {loading ? <ActivityIndicator size="small" color="#fff" /> : 
                  <Text style={styles.saveBtnText}>{t.update}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  </TouchableWithoutFeedback>
</Modal>
    </View>
  );
};

// Styles
const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  groupsScroll: { maxHeight: 60, marginBottom: 16 },
  groupsContainer: { paddingHorizontal: 4, gap: 8 },
  groupChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: 'center'
  },
  groupChipText: { fontSize: 14, fontWeight: '500' },
  groupInfo: { padding: 12, borderRadius: 8, marginBottom: 16 },
  groupInfoTitle: { fontSize: 16, fontWeight: '600' },
  addButton: { 
    padding: 14, 
    borderRadius: 10, 
    alignItems: 'center', 
    marginBottom: 16, 
    minHeight: 50, 
    justifyContent: 'center' 
  },
  addButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  dishList: { flex: 1 },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14 },
  dishCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12, 
    borderRadius: 10, 
    marginBottom: 8, 
    borderWidth: 1,
    minHeight: 80,
  },
  dishImageContainer: { width: 50, height: 50, borderRadius: 8, overflow: 'hidden', marginRight: 12 },
  dishThumbnail: { width: '100%', height: '100%', resizeMode: 'cover' },
  dishThumbnailPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  dishThumbnailText: { fontSize: 22 },
  dishInfo: { flex: 1, marginRight: 8 },
  dishNameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 4, gap: 4 },
  dishName: { fontSize: 13, fontWeight: '400', flex: 1 },
  dishCategory: { fontSize: 13, color: '#666' },
  dishPrice: { fontSize: 16, fontWeight: '700', marginRight: 12 },
  dishActions: { flexDirection: 'row', gap: 4, width: 86, justifyContent: 'flex-end' },
  actionBtn: { width: 27, height: 32, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  
  // Checkbox styles
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  favouriteHint: {
    fontSize: 11,
    marginBottom: 16,
    marginLeft: 34,
    fontStyle: 'italic',
  },
  openPriceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  openPriceBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  favouriteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  favouriteBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', padding: 16 },
  modalContent: { borderRadius: 16, padding: 20, width: '100%' },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  modalLabel: { fontSize: 14, fontWeight: '600', marginBottom: 4, marginTop: 8 },
  modalInput: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 14, marginBottom: 16, minHeight: 50 },
  readonlyField: { flexDirection: 'row', padding: 12, borderRadius: 8, marginBottom: 16, alignItems: 'center' },
  readonlyLabel: { fontSize: 14, marginRight: 8 },
  readonlyValue: { fontSize: 14, fontWeight: '600', flex: 1 },
  activeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  activeLabel: { fontSize: 16, fontWeight: '500' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginHorizontal: 4, minHeight: 48 },
  cancelBtn: { borderWidth: 1 },
  cancelBtnText: { fontSize: 14, fontWeight: '600' },
  saveBtn: { backgroundColor: '#4CAF50' },
  saveBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  imageUploadContainer: { marginBottom: 16 },
  imagePreviewContainer: { width: '100%', height: 150, borderRadius: 8, overflow: 'hidden', marginBottom: 8, borderWidth: 1 },
  imagePreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  removeImageButton: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  removeImageText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  imagePlaceholder: { width: '100%', height: 150, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 1, borderStyle: 'dashed' },
  imagePlaceholderText: { fontSize: 40 },
  imagePlaceholderSubText: { fontSize: 12, marginTop: 4 },
  imageButtonsContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  imageButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, marginHorizontal: 4, minHeight: 48 },
  imageButtonIcon: { fontSize: 16, color: '#ffffff', marginRight: 4 },
  imageButtonText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  galleryButton: { backgroundColor: '#2196F3' },
  cameraButton: { backgroundColor: '#FF4444' },
  keyboardView: { flex: 1, width: '100%' },
  scrollContainer: { flexGrow: 1, paddingVertical: 20, paddingHorizontal: 16 },
});

export default DishItemsManagement;