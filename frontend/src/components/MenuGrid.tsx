// src/components/MenuGrid.tsx - FINAL WORKING VERSION

import React, { useMemo, useEffect, useState, useRef } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, 
  TouchableOpacity, Image, AppState, AppStateStatus,
  Modal, TextInput, Alert
} from 'react-native';
import { MenuItem } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { getFullImageUrl } from '../api';
interface PlaceholderItem {
  id: string;
  isPlaceholder: boolean;
  name: string;
  price: number;
  category?: string;
  imageUri?: string | null;
  originalName?: string;
  originalCategory?: string;
}

interface MenuGridProps {
  currentItems: MenuItem[];
  addToCart: (item: MenuItem, customPrice?: number) => void;
  totalPages: number;
  currentPage: number;
  prevPage: () => void;
  nextPage: () => void;
  setCurrentPage: (page: number) => void;
  categoryItems: MenuItem[];
  allMenuItems: MenuItem[];
  menuUpdateTrigger: number;
  t: any;
  theme: any;
  formatPrice: (amount: number) => string;
  activeCategory: string;
  categories: string[];
  onOpenPriceItem?: (item: MenuItem) => void;
  columns?: number; 
}

const isPlaceholder = (item: MenuItem | PlaceholderItem): item is PlaceholderItem => {
  return (item as PlaceholderItem).isPlaceholder === true;
};

export const MenuGrid: React.FC<MenuGridProps> = ({ 
  currentItems, 
  addToCart, 
  totalPages, 
  currentPage, 
  prevPage, 
  nextPage, 
  setCurrentPage, 
  categoryItems, 
  allMenuItems,  
  menuUpdateTrigger, 
  t, 
  theme,
  formatPrice,
  categories,        
  activeCategory,
  onOpenPriceItem,
  columns = 4     
}) => {
  
  const itemsPerPage = 8;
   const getImageUrl = (imageUri) => {
    return getFullImageUrl(imageUri);
  };
  const [refreshKey, setRefreshKey] = useState(0);
  const [appState, setAppState] = useState(AppState.currentState);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [modalForceKey, setModalForceKey] = useState(0);
  // ✅ Modal state - managed locally
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [customPrice, setCustomPrice] = useState('');
  
  const loadingQueue = useRef<string[]>([]);
  const isProcessing = useRef(false);
  const failedImages = useRef<Set<string>>(new Set());

  // ============================================
  // OPEN PRICE HANDLERS
  // ============================================
  
  const handleItemPress = (item: MenuItem) => {
  console.log('🖱️ Item clicked:', item.name, 'isOpenPrice:', item.isOpenPrice);
  
  if (item.isOpenPrice) {
    console.log('💰 This is open price item - calling onOpenPriceItem');
    if (onOpenPriceItem) {
      onOpenPriceItem(item);  // ✅ Idu call aagutha?
    } else {
      console.log('⚠️ onOpenPriceItem is UNDEFINED!');
    }
  } else {
    console.log('🛒 Normal item - adding to cart');
    addToCart(item);
  }
};

  const handleAddToCartWithPrice = () => {
    if (!selectedItem) return;
    
    const price = parseFloat(customPrice);
    if (isNaN(price) || price <= 0) {
      Alert.alert(
        t.error || 'Error',
        t.enterValidPrice || 'Please enter a valid price'
      );
      return;
    }
    
    addToCart(selectedItem, price);
    setShowPriceModal(false);
    setSelectedItem(null);
    setCustomPrice('');
  };

  // ============================================
  // IMAGE LOADING LOGIC
  // ============================================
  
  const processImageQueue = async () => {
    if (isProcessing.current || loadingQueue.current.length === 0) return;
    
    isProcessing.current = true;
    const batch = loadingQueue.current.splice(0, 2);
    
    await Promise.all(
      batch.map(async (uri) => {
        try {
          if (loadedImages.has(uri)) return;
          await Image.prefetch(uri);
          setLoadedImages(prev => new Set(prev).add(uri));
        } catch (error) {}
      })
    );
    
    isProcessing.current = false;
    if (loadingQueue.current.length > 0) {
      setTimeout(processImageQueue, 100);
    }
  };

  // AppState listener
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        setLoadedImages(new Set());
        failedImages.current.clear();
        setRefreshKey(prev => prev + 1);
      }
      setAppState(nextAppState);
    });
    return () => subscription.remove();
  }, [appState]);

  // Watch for updates
  useEffect(() => {
    setLoadedImages(new Set());
    failedImages.current.clear();
    setRefreshKey(prev => prev + 1);
  }, [menuUpdateTrigger, currentPage]);

  // Active items
  const activeItems = useMemo(() => {
    return categoryItems.filter(item => item.isActive === true);
  }, [categoryItems]);

  const realTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil(activeItems.length / itemsPerPage));
  }, [activeItems.length, itemsPerPage]);

  useEffect(() => {
    if (currentPage > realTotalPages && realTotalPages > 0) {
      setCurrentPage(realTotalPages);
    }
  }, [activeItems.length, currentPage, realTotalPages]);

  const displayItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return activeItems.slice(startIndex, endIndex);
  }, [activeItems, currentPage, itemsPerPage]);
useEffect(() => {
  if (showPriceModal) {
    console.log('✅ Modal is OPEN');
  } else {
    console.log('❌ Modal is CLOSED');
  }
}, [showPriceModal]);
  // Queue images
  useEffect(() => {
  displayItems.forEach(item => {
    const fullUrl = getImageUrl(item.imageUri);
    if (fullUrl && 
        !loadedImages.has(fullUrl) && 
        !failedImages.current.has(fullUrl)) {
      loadingQueue.current.push(fullUrl);
    }
  });
  processImageQueue();
}, [displayItems, refreshKey]);
useEffect(() => {
  if (showPriceModal) {
    console.log('✅ Modal is OPEN - forcing stay open');
    // Make sure modal stays open
  }
}, [showPriceModal]);


  // Grid items with placeholders
  const gridItems = useMemo<(MenuItem | PlaceholderItem)[]>(() => {
    const items: (MenuItem | PlaceholderItem)[] = [...displayItems];
    const remainingSlots = itemsPerPage - items.length;
    
    for (let i = 0; i < remainingSlots; i++) {
      items.push({ 
        id: `placeholder-${currentPage}-${i}-${refreshKey}`,
        isPlaceholder: true,
        name: '',
        price: 0,
        category: '',
        imageUri: null,
        originalName: '',
        originalCategory: ''
      });
    }
    return items;
  }, [displayItems, currentPage, itemsPerPage, refreshKey]);

  if (activeItems.length === 0) {
    return (
      <View style={[styles.noItemsContainer, { backgroundColor: theme.background }]}>
        <Text style={[styles.noItemsText, { color: theme.textSecondary }]}>
          {t.noActiveItems || 'No active items in this category'}
        </Text>
      </View>
    );
  }
  const getItemWidth = () => {
    return `${100 / columns}%`;
  };
  
  const getImageSize = () => {
    if (columns <= 2) return 100;
    if (columns === 3) return 80;
    if (columns === 4) return 70;
    return 60;
  };
  return (
    <View style={styles.menuGridContainer}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.menuGrid}>
          {gridItems.map((item) => {
            if (isPlaceholder(item)) {
              return (
                <View 
                  key={item.id}
                  style={[styles.menuItem, 
                    styles.placeholderItem,
                  ]} 
                />
              );
            }
            
            // ✅ Define isOpenPrice HERE (inside map)
            const isOpenPrice = (item as any).isOpenPrice === true;
            
            return (
              <TouchableOpacity 
                key={`menu-${item.id}-${currentPage}-${refreshKey}`}
                style={[styles.menuItem, { 
                  backgroundColor: theme.card, 
                  borderColor: theme.border 
                }]} 
// In MenuGrid.tsx - Update the onPress to use props
onPress={() => {
  const menuItem = item as MenuItem;
  const isOpenPrice = menuItem.isOpenPrice === true;
  
  console.log('🖱️ Clicked:', menuItem.name, 'isOpenPrice:', isOpenPrice);
  
  if (isOpenPrice) {
    // ✅ Call parent function
    if (onOpenPriceItem) {
      onOpenPriceItem(menuItem);
    } else {
      // Fallback - use local modal
      setSelectedItem(menuItem);
      setCustomPrice('');
      setShowPriceModal(true);
      setModalForceKey(prev => prev + 1);
    }
  } else {
    addToCart(menuItem);
  }
}}
  >
                <View style={[styles.menuItemImageContainer, { backgroundColor: theme.surface }]}>
                  {item.imageUri && loadedImages.has(item.imageUri) ? (
                    <Image 
                      source={{ uri: getImageUrl(item.imageUri) }}
                      style={styles.menuItemImage}
                      onLoad={() => console.log(`✅ Loaded: ${item.name}`)}
                      onError={(e) => {
                        failedImages.current.add(item.imageUri);
                        setTimeout(() => setRefreshKey(prev => prev + 1), 2000);
                      }}
                    />
                  ) : item.imageUri ? (
                    <View style={[styles.menuItemImagePlaceholder, { backgroundColor: theme.surface }]}>
                      <Text style={styles.menuItemImagePlaceholderText}>⏳</Text>
                    </View>
                  ) : (
                    <View style={styles.menuItemImagePlaceholder}>
                      <Text style={styles.menuItemImagePlaceholderText}>🍽️</Text>
                    </View>
                  )}
                </View>
                
                <Text style={[styles.menuItemName, { color: theme.text }]} numberOfLines={2}>
                  {item.name}
                </Text>
                
                {/* ✅ Use isOpenPrice variable defined above */}
             

{/* ✅ FIXED VERSION - Never show 0.00 for open price */}
{isOpenPrice ? (
  <View style={styles.openPriceContainer}>
    <Text style={[styles.openPriceTag, { color: theme.warning || '#FF9800' }]}>
      {t?.enterPrice || 'Enter price'}
    </Text>
  </View>
) : (
  // Normal items - show price only if > 0
  item.price > 0 ? (
    <Text style={[styles.menuItemPrice, { color: theme.primary }]}>
      {formatPrice(item.price)} 
    </Text>
  ) : (
    // Fallback for any 0 price items that aren't open price
    <View style={styles.openPriceContainer}>
      <Text style={[styles.openPriceTag, { color: theme.warning }]}>
        {t?.enterPrice || 'Enter price'}
      </Text>
    </View>
  )
)}
              </TouchableOpacity>
            );
          })}
        </View>
        
        {/* Pagination */}
        {realTotalPages > 1 && (
          <View style={[styles.paginationWrapper, { 
            backgroundColor: theme.surface, 
            borderTopColor: theme.border, 
            borderBottomColor: theme.border 
          }]}>
            <TouchableOpacity 
              style={[styles.paginationButton, { 
                backgroundColor: currentPage === 1 ? theme.surface : theme.primary 
              }]}
              onPress={() => {
                prevPage();
                if (currentPage > 1) setCurrentPage(currentPage - 1);
              }} 
              disabled={currentPage === 1}
            >
              <Text style={[styles.paginationButtonText, { 
                color: currentPage === 1 ? theme.textSecondary : '#ffffff' 
              }]}>←</Text>
            </TouchableOpacity>
            
            <View style={styles.pageNumbersContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {[...Array(realTotalPages)].map((_, index) => {
                  const pageNum = index + 1;
                  return (
                    <TouchableOpacity
                      key={pageNum}
                      style={[
                        styles.pageNumberButton, 
                        { 
                          backgroundColor: currentPage === pageNum ? theme.primary : theme.surface, 
                          borderColor: theme.border 
                        }
                      ]}
                      onPress={() => setCurrentPage(pageNum)}
                    >
                      <Text style={[
                        styles.pageNumberText, 
                        { color: currentPage === pageNum ? '#ffffff' : theme.textSecondary }
                      ]}>
                        {pageNum}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
            
            <TouchableOpacity 
              style={[styles.paginationButton, { 
                backgroundColor: currentPage === realTotalPages ? theme.surface : theme.primary 
              }]}
              onPress={() => {
                nextPage();
                if (currentPage < realTotalPages) setCurrentPage(currentPage + 1);
              }} 
              disabled={currentPage === realTotalPages}
            >
              <Text style={[styles.paginationButtonText, { 
                color: currentPage === realTotalPages ? theme.textSecondary : '#ffffff' 
              }]}>→</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <Text style={[styles.itemCountText, { color: theme.textSecondary }]}>
          {t.showing} {displayItems.length} {t.of} {activeItems.length} {t.items_lower} • {t.page} {currentPage}/{realTotalPages}
        </Text>
      </ScrollView>

      {/* ✅ OPEN PRICE MODAL - Local fallback */}
      <Modal
        visible={showPriceModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowPriceModal(false);
          setSelectedItem(null);
          setCustomPrice('');
        }}
      >
        
        <View style={styles.modalOverlay}>
          <View style={[styles.priceModalContent, { backgroundColor: theme.card }]}>
            
            <View style={styles.priceModalHeader}>
              <Text style={[styles.priceModalTitle, { color: theme.text }]}>
                {t.enterPrice || 'Enter Price'}
              </Text>
              <TouchableOpacity 
                onPress={() => {
                  setShowPriceModal(false);
                  setSelectedItem(null);
                  setCustomPrice('');
                }}
              >
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            {selectedItem && (
              <View style={styles.itemInfoContainer}>
                {selectedItem.imageUri && (
                  <Image 
                    source={{ uri: getImageUrl(selectedItem.imageUri) }}
                    style={styles.modalItemImage} 
                  />
                )}
                <Text style={[styles.modalItemName, { color: theme.text }]}>
                  {selectedItem.name}
                </Text>
              </View>
            )}

            <View style={styles.priceInputContainer}>
              <Text style={[styles.currencySymbol, { color: theme.primary }]}>
                {t.currencySymbol || '$'}
              </Text>
              <TextInput
                style={[styles.priceInput, { 
                  backgroundColor: theme.surface,
                  color: theme.text,
                  borderColor: theme.border
                }]}
                placeholder="0.00"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
                value={customPrice}
                onChangeText={setCustomPrice}
                autoFocus={true}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickAmountScroll}>
              {[10, 20, 50, 100, 200].map(amount => (
                <TouchableOpacity
                  key={amount}
                  style={[styles.quickAmountBtn, { 
                    backgroundColor: theme.surface,
                    borderColor: theme.border 
                  }]}
                  onPress={() => setCustomPrice(amount.toString())}
                >
                  <Text style={[styles.quickAmountText, { color: theme.text }]}>
                    {formatPrice(amount)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.priceModalButtons}>
              <TouchableOpacity
                style={[styles.priceModalBtn, styles.cancelBtn, { 
                  borderColor: theme.border,
                  backgroundColor: theme.surface
                }]}
                onPress={() => {
                  setShowPriceModal(false);
                  setSelectedItem(null);
                  setCustomPrice('');
                }}
              >
                <Text style={[styles.cancelBtnText, { color: theme.text }]}>
                  {t.cancel || 'Cancel'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.priceModalBtn, styles.addBtn, { 
                  backgroundColor: theme.primary 
                }]}
                onPress={handleAddToCartWithPrice}
              >
                <Text style={styles.addBtnText}>
                  {t.addToCart || 'Add to Cart'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  menuGridContainer: { flex: 1 },
  menuGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    padding: 4 
  },
  menuItem: { 
    width: '50%', 
    padding: 8, 
    borderBottomWidth: 1, 
    borderRightWidth: 1, 
    alignItems: 'center', 
    minHeight: 150 
  },
  placeholderItem: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    borderRightWidth: 0,
  },
  menuItemImageContainer: { 
    width: 80, 
    height: 80, 
    borderRadius: 12, 
    overflow: 'hidden', 
    marginBottom: 8 
  },
  menuItemImage: { 
    width: '100%', 
    height: '100%', 
    resizeMode: 'cover' 
  },
  menuItemImagePlaceholder: { 
    width: '100%', 
    height: '100%', 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: '#f0f0f0' 
  },
  menuItemImagePlaceholderText: { 
    fontSize: 32 
  },
  menuItemName: { 
    fontSize: 13, 
    marginBottom: 4, 
    textAlign: 'center', 
    paddingHorizontal: 4, 
    includeFontPadding: false 
  },
  menuItemPrice: { 
    fontSize: 14, 
    fontWeight: '600', 
    includeFontPadding: false 
  },
  openPriceContainer: {
    marginTop: 4,
  },
  openPriceTag: {
    fontSize: 12,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
priceModalContent: {
  width: '90%',
  maxWidth: 350,
  borderRadius: 20,
  padding: 20,
  // ✅ Already has backgroundColor from theme
},
priceModalHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 20,
  width: '100%',                // ✅ Takes full width
},
  priceModalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  itemInfoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalItemImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginBottom: 10,
  },
  modalItemName: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '700',
    marginRight: 10,
  },
  priceInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    padding: 15,
    fontSize: 20,
    textAlign: 'center',
  },
  quickAmountScroll: {
    flexDirection: 'row',
    maxHeight: 50,
    marginBottom: 20,
  },
  quickAmountBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    minWidth: 70,
    alignItems: 'center',
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: '600',
  },
  priceModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  priceModalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelBtn: {
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  addBtn: {
    elevation: 2,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  paginationWrapper: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    borderTopWidth: 1, 
    borderBottomWidth: 1 
  },
  paginationButton: { 
    paddingHorizontal: 14, 
    paddingVertical: 8, 
    borderRadius: 20, 
    minWidth: 44, 
    alignItems: 'center', 
    minHeight: 44, 
    justifyContent: 'center' 
  },
  paginationButtonText: { 
    fontSize: 16, 
    fontWeight: '600', 
    includeFontPadding: false 
  },
  pageNumbersContainer: { 
    flex: 1, 
    marginHorizontal: 8, 
    height: 44 
  },
  pageNumberButton: { 
    width: 38, 
    height: 38, 
    borderRadius: 19, 
    marginHorizontal: 3, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 1 
  },
  pageNumberText: { 
    fontSize: 13, 
    fontWeight: '500', 
    includeFontPadding: false 
  },
  itemCountText: { 
    textAlign: 'center', 
    fontSize: 11, 
    paddingVertical: 8, 
    includeFontPadding: false 
  },
  noItemsContainer: {
    width: '100%',
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noItemsText: {
    fontSize: 16,
    textAlign: 'center',
  },
});

export default React.memo(MenuGrid, (prevProps, nextProps) => {
  return (
    prevProps.currentItems === nextProps.currentItems &&
    prevProps.currentPage === nextProps.currentPage &&
    prevProps.menuUpdateTrigger === nextProps.menuUpdateTrigger &&
    prevProps.activeCategory === nextProps.activeCategory
  );
});