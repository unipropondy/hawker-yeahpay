// components/CompanySettingsForm.tsx - WITH LOGO SUPPORT ✅

import React, { useState, useEffect } from 'react';
import { Platform, StatusBar, Image } from 'react-native';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import BillPDFGenerator from './BillPDFGenerator';
import { useCurrency } from '../context/CurrencyContext';
import API, { uploadAPI } from '../api';
declare global {
  interface Window {
    __markImagePickerOpen?: () => void;
    __markImagePickerClose?: () => void;
  }
}
interface CompanySettings {
  name: string;
  address: string;
  gstNo: string;
  gstPercentage: number;
  phone: string;
  email: string;
  cashierName: string;
  currency: string;
  currencySymbol: string;
  companyLogo?: string;
  halalLogo?: string;
  showCompanyLogo?: boolean;
  showHalalLogo?: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (settings: CompanySettings) => void;
  theme: any;
  t: any;
  clientId?: string | number;
  userShopName?: string;
  defaultCashier?: string;
}

const CompanySettingsForm: React.FC<Props> = ({
  visible,
  onClose,
  onSave,
  theme,
  t,
  clientId,
  userShopName,
  defaultCashier
}) => {
  const { refreshCurrency } = useCurrency();
  
  const [settings, setSettings] = useState<CompanySettings>({
    name: userShopName || '',
    address: '',
    gstNo: '',
    gstPercentage: 9,
    phone: '',
    email: '',
    cashierName: defaultCashier || '',
    currency: 'SGD',
    currencySymbol: '$',
    companyLogo: '',
    halalLogo: '',
    showCompanyLogo: true,
    showHalalLogo: true,
  });
  
  const [enableGST, setEnableGST] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingCompanyLogo, setUploadingCompanyLogo] = useState(false);
  const [uploadingHalalLogo, setUploadingHalalLogo] = useState(false);

  useEffect(() => {
    if (visible) {
      loadClientSettings();
    }
  }, [visible, clientId]);

  useEffect(() => {
    if (defaultCashier) {
      setSettings(prev => ({ ...prev, cashierName: defaultCashier }));
    }
  }, [defaultCashier]);

  useEffect(() => {
    if (userShopName) {
      setSettings(prev => ({ ...prev, name: userShopName }));
    }
  }, [userShopName]);

  const loadClientSettings = async () => {
    try {
        if (clientId) {
            console.log('🔄 Loading client settings with clientId:', clientId);
            console.log('🔄 clientId type:', typeof clientId);
            console.log('🔄 userShopName from parent:', userShopName);
            
            const savedSettings = await BillPDFGenerator.loadSettings(clientId);
            
            console.log('📥 SAVED SETTINGS FROM BILLPDFGENERATOR:', {
                showCompanyLogo: savedSettings.showCompanyLogo,
                showHalalLogo: savedSettings.showHalalLogo,
                name: savedSettings.name,
                type: typeof savedSettings.showCompanyLogo
            });
            
            setSettings({
                name: userShopName || savedSettings.name || '',
                address: savedSettings.address || '',
                gstNo: savedSettings.gstNo || '',
                gstPercentage: savedSettings.gstPercentage || 0,
                phone: savedSettings.phone || '',
                email: savedSettings.email || '',
                cashierName: savedSettings.cashierName || defaultCashier || '',
                currency: savedSettings.currency || 'SGD',
                currencySymbol: savedSettings.currencySymbol || '$',
                companyLogo: savedSettings.companyLogo || '',
                halalLogo: savedSettings.halalLogo || '',
                showCompanyLogo: savedSettings.showCompanyLogo,
                showHalalLogo: savedSettings.showHalalLogo,
            });
            
            setEnableGST(savedSettings.gstPercentage > 0);
        } else {
            console.log('⚠️ No clientId provided!');
        }
    } catch (error) {
        console.log('Error loading settings:', error);
    }
};
  // ✅ Upload logo function
  const uploadLogo = async (imageUri: string, type: 'company' | 'halal') => {
    try {
      const formData = new FormData();
      formData.append('image', {
        uri: imageUri,
        name: `${type}-logo-${Date.now()}.jpg`,
        type: 'image/jpeg',
      } as any);

      const response = await uploadAPI.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const imageUrl = response.data.imageUrl || response.data.imageUri;
      const fullUrl = imageUrl.startsWith('http') ? imageUrl : `https://hawker-yeahpay-production.up.railway.app${imageUrl}`;
      
      if (type === 'company') {
        setSettings(prev => ({ ...prev, companyLogo: fullUrl }));
      } else {
        setSettings(prev => ({ ...prev, halalLogo: fullUrl }));
      }
      
      return fullUrl;
    } catch (error) {
      console.log('Upload error:', error);
      throw error;
    }
  };

  // ✅ Pick image function
 const pickImage = async (type: 'company' | 'halal') => {
    try {
        // ✅ Mark image picker as open
        // @ts-ignore
        if (window.__markImagePickerOpen) {
            console.log('📸 Marking image picker as open');
            window.__markImagePickerOpen();
        }
        
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets[0]) {
            if (type === 'company') {
                setUploadingCompanyLogo(true);
                await uploadLogo(result.assets[0].uri, 'company');
                setUploadingCompanyLogo(false);
            } else {
                setUploadingHalalLogo(true);
                await uploadLogo(result.assets[0].uri, 'halal');
                setUploadingHalalLogo(false);
            }
        }
    } catch (error) {
        Alert.alert('Error', 'Failed to upload image');
        if (type === 'company') setUploadingCompanyLogo(false);
        else setUploadingHalalLogo(false);
    } finally {
        // ✅ DELAY closing marker to let app fully return to foreground
        setTimeout(() => {
            // @ts-ignore
            if (window.__markImagePickerClose) {
                console.log('📸 Marking image picker as closed (after delay)');
                window.__markImagePickerClose();
            }
        }, 500); // 500ms delay
    }
};
  // ✅ Remove logo function
  const removeLogo = (type: 'company' | 'halal') => {
    if (type === 'company') {
      setSettings(prev => ({ ...prev, companyLogo: '' }));
    } else {
      setSettings(prev => ({ ...prev, halalLogo: '' }));
    }
  };

  const handleSave = async () => {
    // ✅ ADD DEBUG LOG with GST
    console.log('🔍 HANDLE SAVE - Current settings:', {
        showCompanyLogo: settings.showCompanyLogo,
        showHalalLogo: settings.showHalalLogo,
        gstPercentage: settings.gstPercentage,
        enableGST: enableGST,
        companyLogo: settings.companyLogo ? 'YES' : 'NO',
        halalLogo: settings.halalLogo ? 'YES' : 'NO'
    });

    if (!settings.name.trim()) {
        Alert.alert(t.error, 'Shop name is required for bill receipt');
        return;
    }

    const finalSettings = {
        ...settings,
        gstPercentage: enableGST ? settings.gstPercentage : 0,
        showCompanyLogo: settings.showCompanyLogo,
        showHalalLogo: settings.showHalalLogo,
        companyLogo: settings.companyLogo,
        halalLogo: settings.halalLogo
    };

    // ✅ ADD DEBUG LOG with GST
    console.log('🔍 FINAL SETTINGS TO SAVE:', {
        gstPercentage: finalSettings.gstPercentage,
        enableGST: enableGST,
        showCompanyLogo: finalSettings.showCompanyLogo,
        showHalalLogo: finalSettings.showHalalLogo
    });

    setSaving(true);
    
    try {
        // ✅ STEP 1: Save to database
        const success = await BillPDFGenerator.saveSettings(finalSettings, clientId);
        
        if (success) {
            console.log('✅ Save successful, waiting for DB commit...');
            
            // ✅ STEP 2: Wait for database to commit
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // ✅ STEP 3: Force reload from database with cache-buster
            console.log('🔄 Reloading settings from DB...');
            const freshSettings = await BillPDFGenerator.loadSettings(clientId);
            
            console.log('📥 FRESH SETTINGS FROM DB:', {
                gstPercentage: freshSettings.gstPercentage,
                showCompanyLogo: freshSettings.showCompanyLogo,
                showHalalLogo: freshSettings.showHalalLogo,
                companyLogo: freshSettings.companyLogo ? 'YES' : 'NO',
                halalLogo: freshSettings.halalLogo ? 'YES' : 'NO'
            });
            
            // ✅ STEP 4: Update local state with DB values
            setSettings({
                ...settings,
                gstPercentage: freshSettings.gstPercentage,
                showCompanyLogo: freshSettings.showCompanyLogo,
                showHalalLogo: freshSettings.showHalalLogo,
                companyLogo: freshSettings.companyLogo,
                halalLogo: freshSettings.halalLogo
            });
            
            // ✅ STEP 5: Update enableGST based on fresh value
            setEnableGST(freshSettings.gstPercentage > 0);
            
            // ✅ STEP 6: Refresh currency
            await refreshCurrency();
            
            // ✅ STEP 7: Small delay
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // ✅ STEP 8: Call onSave and close
            onSave(finalSettings);
            Alert.alert(t.success, 'Settings saved successfully');
            onClose();
        } else {
            Alert.alert(t.error, 'Failed to save settings');
        }
    } catch (error) {
        console.log('❌ Save error:', error);
        Alert.alert(t.error, 'Failed to save settings');
    } finally {
        setSaving(false);
    }
};
  const currencyOptions = [
    { code: 'SGD', symbol: '$', name: 'Singapore Dollar' },
    { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
    { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
          
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Bill Settings</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            
            {/* Shop Name - READONLY */}
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Shop Name (from Admin) *
            </Text>
            <View style={[styles.readonlyField, { 
              backgroundColor: theme.surface + '80',
              borderColor: theme.border
            }]}>
              <Text style={[styles.readonlyText, { color: theme.text }]}>
                {settings.name || 'Not set'}
              </Text>
            </View>

            {/* Address */}
            <Text style={[styles.label, { color: theme.textSecondary }]}>Address</Text>
            <TextInput
              style={[styles.input, styles.textArea, { 
                backgroundColor: theme.surface,
                color: theme.text,
                borderColor: theme.border
              }]}
              value={settings.address}
              onChangeText={(text) => setSettings({...settings, address: text})}
              placeholder="Enter address"
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={3}
              editable={!saving}
            />

            {/* ========== LOGO SECTION ========== */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                🖼️ Bill Logo Settings
              </Text>
              <Text style={[styles.sectionHint, { color: theme.textSecondary }]}>
                Logos will appear on bill receipts
              </Text>
            </View>

            {/* Company Logo Toggle */}
            <View style={[styles.card, { backgroundColor: theme.surface }]}>
              <View style={styles.switchRow}>
                <View style={styles.switchLeft}>
                  <Ionicons name="business" size={24} color={theme.primary} />
                  <Text style={[styles.switchLabel, { color: theme.text }]}>
                    Show Company Logo
                  </Text>
                </View>
              <Switch
    value={settings.showCompanyLogo}
    onValueChange={(val) => {
        console.log('🔄 Toggle Company Logo:', {
            old: settings.showCompanyLogo,
            new: val,
            type: typeof val
        });
        setSettings(prev => ({ ...prev, showCompanyLogo: val }));
    }}
    trackColor={{ false: theme.inactive, true: theme.success }}
    thumbColor="#fff"
    disabled={saving}
/>
              </View>
              
              {settings.showCompanyLogo && (
                <View style={styles.logoUploadContainer}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    Company Logo (Left Side)
                  </Text>
                  
                  {settings.companyLogo ? (
                    <View style={styles.logoPreviewContainer}>
                      <Image 
                        source={{ uri: settings.companyLogo }} 
                        style={styles.logoPreview}
                        resizeMode="contain"
                      />
                      <TouchableOpacity
                        style={styles.removeLogoButton}
                        onPress={() => removeLogo('company')}
                      >
                        <Ionicons name="close-circle" size={24} color={theme.danger} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.uploadButton, { backgroundColor: theme.primary }]}
                      onPress={() => pickImage('company')}
                      disabled={uploadingCompanyLogo || saving}
                    >
                      {uploadingCompanyLogo ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="cloud-upload" size={24} color="#fff" />
                          <Text style={styles.uploadButtonText}>Upload Company Logo</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                  <Text style={[styles.hint, { color: theme.textSecondary }]}>
                    Recommended: 150x150px PNG with transparent background
                  </Text>
                </View>
              )}
            </View>

            {/* Halal Logo Toggle */}
            <View style={[styles.card, { backgroundColor: theme.surface }]}>
              <View style={styles.switchRow}>
                <View style={styles.switchLeft}>
                  <Ionicons name="restaurant" size={24} color={theme.primary} />
                  <Text style={[styles.switchLabel, { color: theme.text }]}>
                    Show Halal Logo
                  </Text>
                </View>
                <Switch
                  value={settings.showHalalLogo}
                  onValueChange={(val) => setSettings(prev => ({ ...prev, showHalalLogo: val }))}
                  trackColor={{ false: theme.inactive, true: theme.success }}
                  thumbColor="#fff"
                  disabled={saving}
                />
              </View>
              
              {settings.showHalalLogo && (
                <View style={styles.logoUploadContainer}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    Halal Logo (Right Side)
                  </Text>
                  
                  {settings.halalLogo ? (
                    <View style={styles.logoPreviewContainer}>
                      <Image 
                        source={{ uri: settings.halalLogo }} 
                        style={styles.logoPreview}
                        resizeMode="contain"
                      />
                      <TouchableOpacity
                        style={styles.removeLogoButton}
                        onPress={() => removeLogo('halal')}
                      >
                        <Ionicons name="close-circle" size={24} color={theme.danger} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.uploadButton, { backgroundColor: theme.primary }]}
                      onPress={() => pickImage('halal')}
                      disabled={uploadingHalalLogo || saving}
                    >
                      {uploadingHalalLogo ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="cloud-upload" size={24} color="#fff" />
                          <Text style={styles.uploadButtonText}>Upload Halal Logo</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                  <Text style={[styles.hint, { color: theme.textSecondary }]}>
                    Recommended: 80x80px PNG with transparent background
                  </Text>
                </View>
              )}
            </View>

            {/* ========== END LOGO SECTION ========== */}

            {/* Currency Quick Selection */}
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Quick Currency Select
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.currencyScroll}>
              {currencyOptions.map((curr) => (
                <TouchableOpacity
                  key={curr.code}
                  style={[
                    styles.currencyChip,
                    { 
                      backgroundColor: settings.currency === curr.code ? theme.primary : theme.surface,
                      borderColor: settings.currency === curr.code ? theme.primary : theme.border
                    }
                  ]}
                  onPress={() => setSettings({
                    ...settings,
                    currency: curr.code,
                    currencySymbol: curr.symbol
                  })}
                >
                  <Text style={[
                    styles.currencyChipText,
                    { color: settings.currency === curr.code ? '#fff' : theme.text }
                  ]}>
                    {curr.code} ({curr.symbol})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Currency Code */}
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Currency Code *
            </Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.surface,
                color: theme.text,
                borderColor: theme.border
              }]}
              value={settings.currency}
              onChangeText={(text) => {
                const upperText = text.toUpperCase();
                let symbol = settings.currencySymbol;
                
                if (upperText === 'SGD') symbol = '$';
                else if (upperText === 'MYR') symbol = 'RM';
                else if (upperText === 'INR') symbol = '₹';
                else if (upperText === 'USD') symbol = '$';
                else if (upperText === 'EUR') symbol = '€';
                else if (upperText === 'GBP') symbol = '£';
                else if (upperText === 'JPY') symbol = '¥';
                else if (upperText === 'CNY') symbol = '¥';
                else if (upperText === 'KRW') symbol = '₩';
                else if (upperText === 'THB') symbol = '฿';
                else if (upperText === 'VND') symbol = '₫';
                else if (upperText === 'IDR') symbol = 'Rp';
                
                setSettings({
                  ...settings,
                  currency: upperText,
                  currencySymbol: symbol
                });
              }}
              placeholder="SGD, MYR, INR, USD"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="characters"
              maxLength={3}
              editable={!saving}
            />

            {/* Currency Symbol */}
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Currency Symbol
            </Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.surface,
                color: theme.text,
                borderColor: theme.border
              }]}
              value={settings.currencySymbol}
              onChangeText={(text) => setSettings({...settings, currencySymbol: text})}
              placeholder="$"
              placeholderTextColor={theme.textSecondary}
              maxLength={3}
              editable={!saving}
            />

            {/* GST Toggle */}
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: theme.text }]}>Enable GST</Text>
              <Switch
                value={enableGST}
                onValueChange={setEnableGST}
                trackColor={{ false: theme.inactive, true: theme.primary }}
                thumbColor="#fff"
                disabled={saving}
              />
            </View>

            {enableGST && (
              <>
                <Text style={[styles.label, { color: theme.textSecondary }]}>GST Number</Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: theme.surface,
                    color: theme.text,
                    borderColor: theme.border
                  }]}
                  value={settings.gstNo}
                  onChangeText={(text) => setSettings({...settings, gstNo: text})}
                  placeholder="Enter GST number"
                  placeholderTextColor={theme.textSecondary}
                  editable={!saving}
                />

                <Text style={[styles.label, { color: theme.textSecondary }]}>GST Percentage (%)</Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: theme.surface,
                    color: theme.text,
                    borderColor: theme.border
                  }]}
                   value={settings.gstPercentage === 0 ? '' : settings.gstPercentage.toString()}
    onChangeText={(text) => {
        if (text === '') {
            setSettings({...settings, gstPercentage: 0});
        } else {
            const num = parseFloat(text);
            if (!isNaN(num)) {
                setSettings({...settings, gstPercentage: num});
            }
        }
    }}
    placeholder="0"
    placeholderTextColor={theme.textSecondary}
    keyboardType="numeric"
    editable={!saving && enableGST}  // ✅ Only editable when GST enabled
/>
              </>
            )}

            {/* Phone */}
            <Text style={[styles.label, { color: theme.textSecondary }]}>Phone Number</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.surface,
                color: theme.text,
                borderColor: theme.border
              }]}
              value={settings.phone}
              onChangeText={(text) => setSettings({...settings, phone: text})}
              placeholder="Enter phone number"
              placeholderTextColor={theme.textSecondary}
              keyboardType="phone-pad"
              editable={!saving}
            />

            {/* Email */}
            <Text style={[styles.label, { color: theme.textSecondary }]}>Email Address</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.surface,
                color: theme.text,
                borderColor: theme.border
              }]}
              value={settings.email}
              onChangeText={(text) => setSettings({...settings, email: text})}
              placeholder="Enter email"
              placeholderTextColor={theme.textSecondary}
              keyboardType="email-address"
              editable={!saving}
            />

            {/* Cashier Name */}
            <Text style={[styles.label, { color: theme.textSecondary }]}>Default Cashier Name</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.surface,
                color: theme.text,
                borderColor: theme.border
              }]}
              value={settings.cashierName}
              onChangeText={(text) => setSettings({...settings, cashierName: text})}
              placeholder="Cashier name"
              placeholderTextColor={theme.textSecondary}
              editable={!saving}
            />

          </ScrollView>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, { borderColor: theme.border }]}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={[styles.buttonText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.saveButton, { backgroundColor: theme.primary }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? <ActivityIndicator size="small" color="#fff" /> : 
                <Text style={[styles.buttonText, { color: '#fff' }]}>Save Settings</Text>}
            </TouchableOpacity>
          </View>

        </View>
      </View>
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
    width: '90%',
    maxWidth: 400,
    maxHeight: '85%',
    borderRadius: 20,
    padding: 20,
  },
  header: {
    minHeight: Platform.OS === 'android' ? 70 : 60,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  label: {
    fontSize: 13,
    marginBottom: 5,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 16,
  },
  readonlyField: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    minHeight: 50,
    justifyContent: 'center',
  },
  readonlyText: {
    fontSize: 14,
    fontWeight: '500',
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 15,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  hint: {
    fontSize: 11,
    marginTop: 2,
    marginBottom: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {
    elevation: 2,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  currencyScroll: {
    flexDirection: 'row',
    marginBottom: 16,
    maxHeight: 50,
  },
  currencyChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: 'center',
  },
  currencyChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  // ✅ New logo styles
  sectionHeader: {
    marginTop: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 12,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  switchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoUploadContainer: {
    marginTop: 12,
  },
  logoPreviewContainer: {
    position: 'relative',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoPreview: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  removeLogoButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 2,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default CompanySettingsForm;