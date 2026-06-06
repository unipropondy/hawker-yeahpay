// components/PayModeSettings.tsx - COMPLETE WITH PERFECT ALIGNMENT ✅

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import API from '../api';
import PayNowSettings from './PayNowSettings';
// At the top of PosScreen.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import UPISettings from './UPISettings';

interface PayModeSettingsProps {
  visible: boolean;
  onClose: () => void;
  userId: number;
  theme: any;
  t: any;
  onUpdate: (modes: PaymentMode[]) => void;
}

interface PaymentMode {
  id: string;
  name: string;
  icon: string;
  description: string;
  isActive: boolean;
  order: number;
}

const PayModeSettings: React.FC<PayModeSettingsProps> = ({
  visible,
  onClose,
  userId,
  theme,
  t,
  onUpdate
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingMode, setEditingMode] = useState<PaymentMode | null>(null);
  const [showPayNowSettings, setShowPayNowSettings] = useState(false);
  const [payNowQrUrl, setPayNowQrUrl] = useState('');
  const [showUPISettings, setShowUPISettings] = useState(false);
  const [upiId, setUpiId] = useState('');
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formIcon, setFormIcon] = useState('💳');
  const [formDesc, setFormDesc] = useState('');
  const [formActive, setFormActive] = useState(true);

  // Available icons
  const iconOptions = ['💰', '📱', '💳', '🎫', '🏦', '🪙', '💵', '💎', '🔹', '⭐', '🛵', '🏧', '📲', '💸', '🪪'];

  // Refs for duplicate prevention
  const payNowLoaded = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (visible && userId) {
      loadPaymentModes();
      loadUPIId();
      loadPayNowQR();
      ensureDiscountMode();
    }
  }, [visible, userId]);
  // In the ensureDefaultModes function or useEffect
const ensureYeahPayModes = async () => {
    try {
        const outletId = await AsyncStorage.getItem('selectedOutletId');
        const response = await API.get(`/user/payment-modes/${outletId}?type=outlet`);
        let modes = response.data.paymentModes || [];
        
        // Check if YeahPay modes exist
        const hasYeahPayCard = modes.some(m => m.id === 'yeahpay_card');
        const hasYeahPayPayNow = modes.some(m => m.id === 'yeahpay_paynow');
        
        let needsUpdate = false;
        
        if (!hasYeahPayCard) {
            modes.push({
                id: 'yeahpay_card',
                name: 'YeahPay Card',
                icon: '💳',
                description: 'Pay using YeahPay terminal card',
                isActive: false,  // Admin can enable
                order: modes.length
            });
            needsUpdate = true;
        }
        
        if (!hasYeahPayPayNow) {
            modes.push({
                id: 'yeahpay_paynow',
                name: 'YeahPay PayNow',
                icon: '📱',
                description: 'Pay using YeahPay terminal QR',
                isActive: false,
                order: modes.length
            });
            needsUpdate = true;
        }
        
        if (needsUpdate) {
            await API.put('/user/payment-modes', {
                userId: outletId,
                paymentModes: modes
            });
            console.log('✅ YeahPay modes added');
        }
    } catch (error) {
        console.log('Error ensuring YeahPay modes:', error);
    }
};
const ensureDiscountMode = async () => {
    try {
        const outletId = await AsyncStorage.getItem('selectedOutletId');
        const targetId = outletId || userId;
        
        const response = await API.get(`/user/payment-modes/${targetId}`);
        let modes = response.data.paymentModes || [];
        
        // Check if discount mode exists
        const discountExists = modes.some((m: any) => 
            m.id === 'discount' || (typeof m === 'string' && m === 'discount')
        );
        
        if (!discountExists) {
            console.log('➕ Adding discount mode');
            
            // Add discount mode
            const discountMode = {
                id: 'discount',
                name: 'Discount',
                icon: '🏷️',
                description: 'Apply discount to total',
                isActive: false,
                order: modes.length
            };
            
            if (typeof modes[0] === 'string') {
                // If modes are strings, convert all to objects first
                const convertedModes = modes.map((m: string, idx: number) => ({
                    id: m,
                    name: getModeName(m),
                    icon: getModeIcon(m),
                    description: getModeDescription(m),
                    isActive: true,
                    order: idx
                }));
                convertedModes.push(discountMode);
                setPaymentModes(convertedModes);
            } else {
                // Already objects
                setPaymentModes([...modes, discountMode]);
            }
        }
    } catch (error) {
        console.log('❌ Error ensuring discount mode:', error);
    }
};
  const loadPayNowQR = async (force?: boolean) => {
    if (force) {
      console.log('🔄 Force reloading PayNow QR...');
      payNowLoaded.current = false;
    }
    
    if (payNowLoaded.current && !force) {
      console.log('⏭️ PayNow QR already loaded, skipping');
      return;
    }

    try {
      console.log('📡 Loading PayNow QR...');
      const response = await API.get(`/user/paynow/${userId}`);
      payNowLoaded.current = true;
      setPayNowQrUrl(response.data.qrCodeUrl || '');
    } catch (error) {
      console.log('❌ Error loading PayNow:', error);
      payNowLoaded.current = false;
    }
  };

  const loadUPIId = async (force?: boolean) => {
    try {
      const response = await API.get(`/user/upi/${userId}`);
      setUpiId(response.data.upiId || '');
    } catch (error) {
      console.log('Error loading UPI:', error);
    }
  };

  const loadPaymentModes = async (force = false) => {
  // 🛑 Skip if already loaded
  if (hasLoaded && !force) {
    console.log('⏭️ Payment modes already loaded, skipping');
    return;
  }
  
  // 🛑 Skip if loading
  if (isLoading) {
    console.log('⏳ Payment modes already loading, skipping');
    return;
  }

  setIsLoading(true);
  try {
    // ✅ STEP 1: GET OUTLET ID
    const outletId = await AsyncStorage.getItem('selectedOutletId');
    
    // ✅ STEP 2: CHECK IF OUTLET ID EXISTS
    if (!outletId) {
      console.log('⚠️ No outlet selected - cannot load payment modes');
      setIsLoading(false);
      return;
    }
    
    console.log(`📡 Loading payment modes for outlet: ${outletId}`);
    
    // ✅ STEP 3: USE outletId WITH type='outlet'
    const response = await API.get(`/user/payment-modes/${outletId}?type=outlet`);
    const modes = response.data.paymentModes || [];
    
    console.log(`📥 Payment modes for outlet ${outletId}:`, modes);
    
    // Process modes
    if (modes.length > 0 && typeof modes[0] === 'string') {
      const convertedModes = modes.map((mode: string, index: number) => ({
        id: mode,
        name: getModeName(mode),
        icon: getModeIcon(mode),
        description: getModeDescription(mode),
        isActive: true,
        order: index
      }));
      setPaymentModes(convertedModes);
    } else {
      setPaymentModes(modes);
    }
    
    setHasLoaded(true);
    
  } catch (error: any) {
    console.log('❌ Error loading payment modes:', error);
    
    const errorMessage = error.response?.data?.error || 
                        error.message || 
                        'Failed to load payment modes';
    Alert.alert('Error', errorMessage);
    
    setHasLoaded(false);
  } finally {
    setIsLoading(false);
  }
};
const getModeName = (modeId: string): string => {
  const names: Record<string, string> = {
    'cash': 'Cash',
    'upi': 'UPI',
    'paynow': 'PayNow',
    'card': 'Card',
    'cdc': 'CDC Voucher'
  };
  return names[modeId] || modeId;
};

const getModeIcon = (modeId: string): string => {
  const icons: Record<string, string> = {
    'cash': '💰',
    'upi': '📱',
    'paynow': '📱',
    'card': '💳',
    'cdc': '🎫'
  };
  return icons[modeId] || '💳';
};

const getModeDescription = (modeId: string): string => {
  const desc: Record<string, string> = {
    'cash': 'Pay with cash',
    'upi': 'UPI QR payment',
    'paynow': 'PayNow QR transfer',
    'card': 'Credit/Debit card',
    'cdc': 'CDC vouchers'
  };
  return desc[modeId] || `${modeId} payment`;
};
const saveModes = async () => {
  if (!userId) {
    Alert.alert(t.error, t.error);
    return;
  }

  setSaving(true);
  try {
    const outletId = await AsyncStorage.getItem('selectedOutletId');
    
    const payload: any = {
      paymentModes
    };
    
    if (outletId) {
      payload.outletId = parseInt(outletId);
      console.log('💾 Saving for outlet:', outletId);
    } else {
      payload.userId = userId;
    }
    
    const response = await API.put('/user/payment-modes', payload);
    
    if (response.data.success) {
      Alert.alert(t.success, 'Payment modes saved');
      
      // ✅ Reload with correct type
      if (outletId) {
        await loadPaymentModes(true);  // Force reload with ?type=outlet
      }
      
      onUpdate(paymentModes);
      onClose();
    }
  } catch (error) {
    console.log('❌ Error:', error);
    Alert.alert(t.error, error.response?.data?.error || 'Failed to save');
  } finally {
    setSaving(false);
  }
};
  const openAddForm = () => {
    setEditingMode(null);
    setFormName('');
    setFormIcon('💳');
    setFormDesc('');
    setFormActive(true);
    setShowForm(true);
  };

  const openEditForm = (mode: PaymentMode) => {
    setEditingMode(mode);
    setFormName(mode.name || '');
    setFormIcon(mode.icon || '💰');
    setFormDesc(mode.description || '');
    setFormActive(mode.isActive ?? true);
    setShowForm(true);
  };

  const handleSubmitForm = () => {
    if (!formName.trim()) {
      Alert.alert(t.error, 'Please enter payment mode name');
      return;
    }

    if (editingMode) {
      const updatedModes = paymentModes.map(m => 
        m.id === editingMode.id 
          ? { 
              ...m, 
              name: formName.trim(), 
              icon: formIcon, 
              description: formDesc.trim() || `${formName.trim()} payment`,
              isActive: formActive 
            }
          : m
      );
      setPaymentModes(updatedModes);
    } else {
      const newMode: PaymentMode = {
        id: `mode_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: formName.trim(),
        icon: formIcon,
        description: formDesc.trim() || `${formName.trim()} payment`,
        isActive: formActive,
        order: paymentModes.length
      };
      setPaymentModes([...paymentModes, newMode]);
    }
    setShowForm(false);
  };

  const toggleActive = (modeId: string) => {
    setPaymentModes(prev => 
      prev.map(mode => 
        mode.id === modeId ? { ...mode, isActive: !mode.isActive } : mode
      )
    );
  };

  const deleteMode = (modeId: string) => {
    Alert.alert(
      t.delete,
      t.confirmDelete + ' ' + t.paymentModeName + '?',
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: () => {
            setPaymentModes(prev => prev.filter(mode => mode.id !== modeId));
          }
        }
      ]
    );
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newModes = [...paymentModes];
    [newModes[index - 1], newModes[index]] = [newModes[index], newModes[index - 1]];
    newModes.forEach((mode, i) => { mode.order = i; });
    setPaymentModes(newModes);
  };

  const moveDown = (index: number) => {
    if (index === paymentModes.length - 1) return;
    const newModes = [...paymentModes];
    [newModes[index], newModes[index + 1]] = [newModes[index + 1], newModes[index]];
    newModes.forEach((mode, i) => { mode.order = i; });
    setPaymentModes(newModes);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
          
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>
              {t.paymentModes}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : (
            <>
              {/* Add Payment Mode Button */}
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: theme.primary }]}
                onPress={openAddForm}
              >
                <Ionicons name="add" size={24} color="#fff" />
                <Text style={styles.addButtonText}>{t.addPaymentMode}</Text>
              </TouchableOpacity>

              {/* UPI Settings Button */}
              <TouchableOpacity
                style={[styles.upiButton, { backgroundColor: theme.secondary, marginBottom: 16 }]}
                onPress={() => setShowUPISettings(true)}
              >
                <Ionicons name="qr-code-outline" size={24} color="#fff" />
                <Text style={styles.upiButtonText}>
                  📱 UPI Settings {upiId ? '✅ Active' : ''}
                </Text>
              </TouchableOpacity>

              {/* PayNow Settings Button */}
              <TouchableOpacity
                style={[styles.paynowButton, { backgroundColor: theme.secondary, marginBottom: 16 }]}
                onPress={() => setShowPayNowSettings(true)}
              >
                <Ionicons name="qr-code-outline" size={24} color="#fff" />
                <Text style={styles.paynowButtonText}>
                  💳 PayNow Settings {payNowQrUrl ? '✅ Active' : ''}
                </Text>
              </TouchableOpacity>

              {/* Add/Edit Form */}
              {showForm && (
                <View style={[styles.formContainer, { backgroundColor: theme.surface }]}>
                  <Text style={[styles.formTitle, { color: theme.text }]}>
                    {editingMode ? 'Edit Payment Mode' : t.addPaymentMode}
                  </Text>

                  {/* Payment Mode Name */}
                  <View style={styles.formField}>
                    <Text style={[styles.formLabel, { color: theme.textSecondary }]}>
                      {t.paymentModeName || 'Payment Mode Name'} *
                    </Text>
                    <TextInput
                      style={[styles.input, { 
                        backgroundColor: theme.card,
                        color: theme.text,
                        borderColor: theme.border
                      }]}
                      placeholder={t.enterPaymentModeName || 'Enter payment mode name'}
                      placeholderTextColor={theme.textSecondary}
                      value={formName}
                      onChangeText={setFormName}
                    />
                  </View>

                  {/* Description */}
                  <View style={styles.formField}>
                    <Text style={[styles.formLabel, { color: theme.textSecondary }]}>
                      {t.description || 'Description'}
                    </Text>
                    <TextInput
                      style={[styles.input, { 
                        backgroundColor: theme.card,
                        color: theme.text,
                        borderColor: theme.border
                      }]}
                      placeholder={t.enterDescription || 'Enter description'}
                      placeholderTextColor={theme.textSecondary}
                      value={formDesc}
                      onChangeText={setFormDesc}
                    />
                  </View>

                  {/* Select Icon */}
                  <View style={styles.formField}>
                    <Text style={[styles.formLabel, { color: theme.textSecondary }]}>
                      {t.selectIcon || 'Select Icon'}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconList}>
                      {iconOptions.map((icon, index) => (
                        <TouchableOpacity
                          key={`icon-${index}`}
                          style={[
                            styles.iconOption,
                            { 
                              backgroundColor: formIcon === icon ? theme.primary : theme.card,
                              borderColor: theme.border
                            }
                          ]}
                          onPress={() => setFormIcon(icon)}
                        >
                          <Text style={[
                            styles.iconText,
                            { color: formIcon === icon ? '#fff' : theme.text }
                          ]}>{icon}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Active Switch */}
                  <View style={styles.formField}>
                    <View style={styles.activeRow}>
                      <Text style={[styles.activeLabel, { color: theme.text }]}>
                        {t.active || 'Active'}
                      </Text>
                      <Switch
                        value={formActive}
                        onValueChange={setFormActive}
                        trackColor={{ false: theme.inactive, true: theme.success }}
                        thumbColor="#fff"
                      />
                    </View>
                  </View>

                  {/* Buttons */}
                  <View style={styles.formButtons}>
                    <TouchableOpacity
                      style={[styles.formCancel, { 
                        borderColor: theme.border,
                        backgroundColor: theme.surface
                      }]}
                      onPress={() => setShowForm(false)}
                    >
                      <Text style={[styles.formCancelText, { color: theme.text }]}>
                        {t.cancel || 'Cancel'}
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.formSave, { backgroundColor: theme.success }]}
                      onPress={handleSubmitForm}
                    >
                      <Text style={styles.formSaveText}>
                        {editingMode ? (t.update || 'Update') : (t.save || 'Save')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Payment Modes List */}
              <ScrollView style={styles.modeList} showsVerticalScrollIndicator={false}>
                {paymentModes.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="card-outline" size={48} color={theme.textSecondary} />
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                      {t.noPaymentModes || 'No payment modes added'}
                    </Text>
                  </View>
                ) : (
                  paymentModes.map((mode, index) => (
                    <View 
                      key={`mode-${mode.id}-${index}`}
                      style={[styles.modeItem, { 
                        backgroundColor: theme.surface,
                        opacity: mode.isActive ? 1 : 0.6
                      }]}
                    >
                      <View style={styles.modeContent}>
                        <View style={styles.modeInfo}>
                          <Text style={styles.modeIcon}>{mode.icon}</Text>
                          <View style={styles.modeTextContainer}>
                            <Text style={[styles.modeName, { color: theme.text }]} numberOfLines={1}>
                              {mode.name}
                            </Text>
                            <Text style={[styles.modeDesc, { color: theme.textSecondary }]} numberOfLines={1}>
                              {mode.description}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.modeStatus}>
                          <Text style={[styles.statusText, { 
                            color: mode.isActive ? theme.success : theme.danger 
                          }]}>
                            {mode.isActive ? t.active : t.inactive}
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.modeActions}>
                        {/* Move Up/Down buttons */}
                        <View style={styles.moveButtons}>
                          <TouchableOpacity
                            style={[styles.moveBtn, { opacity: index === 0 ? 0.3 : 1 }]}
                            onPress={() => moveUp(index)}
                            disabled={index === 0}
                          >
                            <Ionicons name="arrow-up" size={18} color={theme.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.moveBtn, { opacity: index === paymentModes.length - 1 ? 0.3 : 1 }]}
                            onPress={() => moveDown(index)}
                            disabled={index === paymentModes.length - 1}
                          >
                            <Ionicons name="arrow-down" size={18} color={theme.primary} />
                          </TouchableOpacity>
                        </View>

                        {/* Active Toggle */}
                        <TouchableOpacity
                          style={[styles.actionBtn, { 
                            backgroundColor: mode.isActive ? theme.success : theme.inactive 
                          }]}
                          onPress={() => toggleActive(mode.id)}
                        >
                          <Ionicons 
                            name={mode.isActive ? "eye" : "eye-off"} 
                            size={18} 
                            color="#fff" 
                          />
                        </TouchableOpacity>

                        {/* Edit Button */}
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: theme.primary }]}
                          onPress={() => openEditForm(mode)}
                        >
                          <Ionicons name="pencil" size={18} color="#fff" />
                        </TouchableOpacity>

                        {/* Delete Button */}
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: theme.danger }]}
                          onPress={() => deleteMode(mode.id)}
                        >
                          <Ionicons name="trash" size={18} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>

              {/* Save Button */}
              {paymentModes.length > 0 && (
                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: theme.primary }]}
                  onPress={saveModes}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveButtonText}>{t.save}</Text>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>

      {/* UPI Settings Modal */}
      <UPISettings
        visible={showUPISettings}
        onClose={() => {
          setShowUPISettings(false);
          loadUPIId();
          loadPaymentModes(true);
        }}
        userId={userId}
        theme={theme}
        t={t}
        onUpdate={(newUpiId) => {
          setUpiId(newUpiId);
          loadPaymentModes(true);
        }}
      />

      {/* PayNow Settings Modal */}
      <PayNowSettings
  visible={showPayNowSettings}
  onClose={() => {
    setShowPayNowSettings(false);
    // ✅ Small delay to ensure modal closes first
    setTimeout(() => {
      loadPayNowQR(true);
      loadPaymentModes(true);
    }, 300);
  }}
  userId={userId}
  theme={theme}
  t={t}
  onUpdate={async (qrUrl) => {
    console.log('📢 PayNow updated with URL:', qrUrl);
    
    // ✅ Immediate state update
    setPayNowQrUrl(qrUrl);
    
    // ✅ Force reload both
    await loadPayNowQR(true);
    await loadPaymentModes(true);
    
    console.log('✅ PayNow refresh complete');
  }}
/>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 20,
    maxHeight: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  upiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 10,
  },
  upiButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  paynowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 10,
  },
  paynowButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  formContainer: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    width: '100%',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  formField: {
    marginBottom: 20,
    width: '100%',
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    width: '100%',
  },
  iconList: {
    flexDirection: 'row',
    maxHeight: 60,
  },
  iconOption: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
  },
  iconText: {
    fontSize: 24,
  },
  activeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 4,
  },
  activeLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  formButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    width: '100%',
  },
  formCancel: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  formCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  formSave: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  formSaveText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  modeList: {
    maxHeight: 400,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
  },
  modeItem: {
    padding: 16,
    borderRadius: 10,
    marginBottom: 10,
  },
  modeContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  modeTextContainer: {
    flex: 1,
  },
  modeIcon: {
    fontSize: 24,
    width: 30,
    textAlign: 'center',
  },
  modeName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  modeDesc: {
    fontSize: 12,
  },
  modeStatus: {
    marginLeft: 10,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  modeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
  },
  moveButtons: {
    flexDirection: 'row',
    gap: 4,
    marginRight: 8,
  },
  moveBtn: {
    padding: 6,
    borderRadius: 4,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PayModeSettings;