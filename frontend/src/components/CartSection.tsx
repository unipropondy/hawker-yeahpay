// src/components/CartSection.tsx
import React from 'react';
import { Platform, StatusBar, Alert } from 'react-native';  // ✅ Add Alert
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';  // ✅ Remove Image
import { CartItem } from '../types';

interface CartSectionProps {
  cart: CartItem[];
   increaseQuantity: (id: number, price?: number) => void;  // ✅ Add price param
  decreaseQuantity: (id: number, price?: number) => void;  // ✅ Add price param
  removeItem: (id: number, price?: number) => void;  
  removeAllItems: () => void;  // ✅ New prop
  total: string;
  handleCheckout: () => void;
  isMobile: boolean;
  t: any;
  theme: any;
  formatPrice: (amount: number) => string;
}

export const CartSection: React.FC<CartSectionProps> = ({ 
  cart, 
  increaseQuantity, 
  decreaseQuantity, 
  removeItem, 
  removeAllItems,  // ✅ New prop
  total, 
  handleCheckout, 
  isMobile, 
  t, 
  theme,
  formatPrice 
}) => {
  
   const handleRemoveAll = () => {
    if (cart.length > 0) {
      removeAllItems();  // Direct call - no confirmation
    }
  };

  if (isMobile) {
    return (
      <View style={[styles.cartContainer, { backgroundColor: theme.surface }]}>
        <View style={[styles.cartHeader, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <Text style={[styles.cartTitle, { color: theme.text }]}>{t.cart}</Text>
          <View style={styles.headerRight}>
            <Text style={[styles.cartItemCount, { color: theme.textSecondary }]}>
              {cart.length} {t.items}
            </Text>
            {cart.length > 0 && (
              <TouchableOpacity 
                style={[styles.removeAllBtn, { backgroundColor: theme.danger + '20' }]}
                onPress={handleRemoveAll}
              >
                <Text style={[styles.removeAllText, { color: theme.danger }]}>X</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        <ScrollView showsVerticalScrollIndicator={false} style={styles.cartItems}>
          {cart.map(item => {
            // ✅ Create unique key for open price items
            const itemKey = item.isOpenPrice ? `${item.id}-${item.price}` : `${item.id}`;
            
            return (
              <View key={itemKey} style={[styles.cartItem, { borderBottomColor: theme.border }]}>
                <View style={styles.cartItemRow}>
                  <View style={styles.cartItemDetails}>
                    <Text style={[styles.cartItemQuantity, { color: theme.text }]}>{item.quantity}x</Text>
                    <View style={styles.cartItemNameContainer}>
                      <Text style={[styles.cartItemName, { color: theme.text }]} numberOfLines={2}>
                        {item.name}
                      </Text>
                      {item.isOpenPrice && (
                        <Text style={[styles.openPriceBadge, { color: theme.warning }]}>
                          (Open)
                        </Text>
                      )}
                    </View>
                  </View>
                  <Text style={[styles.cartItemPriceMobile, { color: theme.primary }]}>
                    {formatPrice(item.price * item.quantity)}
                  </Text>
                </View>
                
                <View style={styles.cartItemControlsMobile}>
                  <View style={[styles.cartQuantityControls, { borderColor: theme.border }]}>
                    <TouchableOpacity 
                      style={[styles.cartQuantityBtn, { backgroundColor: theme.surface }]}
                      onPress={() => {
                        if (item.isOpenPrice) {
                          // ✅ Pass price for open price items
                          decreaseQuantity(item.id, item.price);
                        } else {
                          decreaseQuantity(item.id);
                        }
                      }}
                    >
                      <Text style={[styles.cartQuantityBtnText, { color: theme.text }]}>−</Text>
                    </TouchableOpacity>
                    
                    <Text style={[styles.cartQuantityText, { color: theme.text }]}>{item.quantity}</Text>
                    
                    <TouchableOpacity 
                      style={[styles.cartQuantityBtn, { backgroundColor: theme.surface }]}
                      onPress={() => {
                        if (item.isOpenPrice) {
                          // ✅ Pass price for open price items
                          increaseQuantity(item.id, item.price);
                        } else {
                          increaseQuantity(item.id);
                        }
                      }}
                    >
                      <Text style={[styles.cartQuantityBtnText, { color: theme.text }]}>+</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <TouchableOpacity 
                    style={[styles.cartRemoveBtn, { backgroundColor: theme.danger + '20' }]}
                    onPress={() => {
                      if (item.isOpenPrice) {
                        // ✅ Pass price for open price items
                        removeItem(item.id, item.price);
                      } else {
                        removeItem(item.id);
                      }
                    }}
                  >
                    <Text style={[styles.cartRemoveText, { color: theme.danger }]}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
          
          {cart.length === 0 && (
            <View style={styles.emptyCart}>
              <Text style={[styles.emptyCartText, { color: theme.textSecondary }]}>{t.cartEmpty}</Text>
              <Text style={[styles.emptyCartSubText, { color: theme.textSecondary }]}>{t.tapToAdd}</Text>
            </View>
          )}
        </ScrollView>

        <View style={[styles.cartFooter, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
          <View style={styles.totalRow}>
            <Text style={[styles.chargeText, { color: theme.text }]}>{t.total}</Text>
            <Text style={[styles.totalAmount, { color: theme.primary }]}>{formatPrice(parseFloat(total))}</Text>
          </View>
          
          <TouchableOpacity 
            style={[styles.checkoutBtn, { backgroundColor: theme.primary }, cart.length === 0 && { backgroundColor: theme.inactive }]}
            onPress={handleCheckout} disabled={cart.length === 0}
          >
            <Text style={styles.checkoutBtnText}>
              {cart.length === 0 ? t.cartEmpty : t.checkout}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
}

  // Desktop/Tablet View
// Desktop/Tablet View
return (
  <View style={[styles.cartContainer, { backgroundColor: theme.surface }]}>
    <View style={[styles.cartHeader, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
      <Text style={[styles.cartTitle, { color: theme.text }]}>{t.cart}</Text>
      <View style={styles.headerRight}>
        <Text style={[styles.cartItemCount, { color: theme.textSecondary }]}>
          {cart.length} {t.items}
        </Text>
        {cart.length > 0 && (
          <TouchableOpacity 
            style={[styles.removeAllBtn, { backgroundColor: theme.danger + '20' }]}
            onPress={handleRemoveAll}
          >
            <Text style={[styles.removeAllText, { color: theme.danger }]}>🗑️</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
    
    <ScrollView showsVerticalScrollIndicator={false} style={styles.cartItems}>
      {cart.map(item => {
        // ✅ Create unique key for open price items
        const itemKey = item.isOpenPrice ? `${item.id}-${item.price}` : `cart-${item.id}`;
        
        return (
          <View key={itemKey} style={[styles.cartItem, { borderBottomColor: theme.border }]}>
            <View style={styles.cartItemRow}>
              <View style={styles.cartItemDetails}>
                <Text style={[styles.cartItemQuantity, { color: theme.text }]}>{item.quantity}x</Text>
                <View style={styles.cartItemNameContainer}>
                  <Text style={[styles.cartItemName, { color: theme.text }]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  {item.isOpenPrice && (
                    <Text style={[styles.openPriceBadge, { color: theme.warning }]}>
                      (Open)
                    </Text>
                  )}
                </View>
              </View>
              <Text style={[styles.cartItemPrice, { color: theme.primary }]}>
                {formatPrice(item.price * item.quantity)}
              </Text>
            </View>
            
            <View style={styles.cartItemControls}>
              <View style={[styles.cartQuantityControls, { borderColor: theme.border }]}>
                <TouchableOpacity 
                  style={[styles.cartQuantityBtn, { backgroundColor: theme.surface }]}
                  onPress={() => {
                    if (item.isOpenPrice) {
                      // ✅ Pass price for open price items
                      decreaseQuantity(item.id, item.price);
                    } else {
                      decreaseQuantity(item.id);
                    }
                  }}
                >
                  <Text style={[styles.cartQuantityBtnText, { color: theme.text }]}>−</Text>
                </TouchableOpacity>
                
                <Text style={[styles.cartQuantityText, { color: theme.text }]}>{item.quantity}</Text>
                
                <TouchableOpacity 
                  style={[styles.cartQuantityBtn, { backgroundColor: theme.surface }]}
                  onPress={() => {
                    if (item.isOpenPrice) {
                      // ✅ Pass price for open price items
                      increaseQuantity(item.id, item.price);
                    } else {
                      increaseQuantity(item.id);
                    }
                  }}
                >
                  <Text style={[styles.cartQuantityBtnText, { color: theme.text }]}>+</Text>
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity 
                style={[styles.cartRemoveBtn, { backgroundColor: theme.danger + '20' }]}
                onPress={() => {
                  if (item.isOpenPrice) {
                    // ✅ Pass price for open price items
                    removeItem(item.id, item.price);
                  } else {
                    removeItem(item.id);
                  }
                }}
              >
                <Text style={[styles.cartRemoveText, { color: theme.danger }]}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
      
      {cart.length === 0 && (
        <View style={styles.emptyCart}>
          <Text style={[styles.emptyCartText, { color: theme.textSecondary }]}>{t.cartEmpty}</Text>
          <Text style={[styles.emptyCartSubText, { color: theme.textSecondary }]}>{t.tapToAdd}</Text>
        </View>
      )}
    </ScrollView>

    <View style={[styles.cartFooter, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
      <View style={styles.totalRow}>
        <Text style={[styles.chargeText, { color: theme.text }]}>{t.charge}</Text>
        <Text style={[styles.totalAmount, { color: theme.primary }]}>{formatPrice(parseFloat(total))}</Text>
      </View>
      
      <TouchableOpacity 
        style={[styles.checkoutBtn, { backgroundColor: theme.primary }, cart.length === 0 && { backgroundColor: theme.inactive }]}
        onPress={handleCheckout} disabled={cart.length === 0}
      >
        <Text style={styles.checkoutBtnText}>
          {cart.length === 0 ? t.cartEmpty : t.checkout}
        </Text>
      </TouchableOpacity>
    </View>
  </View>
);
};

// ✅ Updated styles
const styles = StyleSheet.create({
  cartContainer: { 
    flex: 1,
  },
  cartHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingVertical: 3,
    borderBottomWidth: 1, 
    minHeight: 40,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cartTitle: { 
    fontSize: 13, 
    fontWeight: '700', 
    includeFontPadding: false,
  },
  cartItemCount: { 
    fontSize: 11, 
    fontWeight: '500', 
    includeFontPadding: false,
  },
  removeAllBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeAllText: {
    fontSize: 16,
  },
  cartItems: { 
    flex: 1, 
    paddingHorizontal: 6,
  },
  cartItem: { 
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  cartItemRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 6,
  },
  cartItemDetails: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    flex: 1,
    gap: 4,
  },
  cartItemQuantity: { 
    fontSize: 12, 
    fontWeight: '600', 
    includeFontPadding: false,
    minWidth: 25,
  },
  cartItemName: { 
    fontSize: 12, 
    flex: 1,
    includeFontPadding: false,
  },
  cartItemPrice: { 
    fontSize: 12, 
    fontWeight: '600', 
    marginLeft: 8,
    includeFontPadding: false,
    minWidth: 70,
    textAlign: 'right',
  },
  cartItemPriceMobile: { 
    fontSize: 12, 
    fontWeight: '600', 
    marginLeft: 8,
    includeFontPadding: false,
  },
  cartItemControls: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginLeft: 0,  // No image offset
  },
  cartItemControlsMobile: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginLeft: 0,
    marginTop: 6,
  },
  cartQuantityControls: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderRadius: 5,
    height: 36,
  },
  cartQuantityBtn: { 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    minWidth: 38, 
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
  },
  cartQuantityBtnText: { 
    fontSize: 18, 
    fontWeight: '600',
    includeFontPadding: false,
  },
  cartQuantityText: { 
    paddingHorizontal: 6, 
    fontSize: 13, 
    fontWeight: '600', 
    minWidth: 25, 
    textAlign: 'center',
    includeFontPadding: false,
  },
  cartRemoveBtn: { 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 6,
    minWidth: 40,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartRemoveText: { 
    fontSize: 14,
    fontWeight: '600',
  },
  emptyCart: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 30,
  },
  emptyCartText: { 
    fontSize: 13, 
    fontWeight: '600', 
    marginBottom: 4,
    includeFontPadding: false,
  },
  emptyCartSubText: { 
    fontSize: 11,
    includeFontPadding: false,
  },
  cartFooter: { 
    padding: 10, 
    borderTopWidth: 1,
  },
  totalRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 10,
  },
  chargeText: { 
    fontSize: 13, 
    fontWeight: '600',
    includeFontPadding: false,
  },
  totalAmount: { 
    fontSize: 18, 
    fontWeight: '800',
    includeFontPadding: false,
  },
  checkoutBtn: { 
    paddingVertical: 12, 
    borderRadius: 8, 
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  cartItemNameContainer: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 4,
},
openPriceBadge: {
  fontSize: 10,
  fontStyle: 'italic',
},
  checkoutBtnText: { 
    color: '#ffffff', 
    fontSize: 13, 
    fontWeight: '600',
    includeFontPadding: false,
  },
});