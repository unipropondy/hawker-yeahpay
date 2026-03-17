// frontend/src/components/PayNowSettings.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Switch,
  ActivityIndicator,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import API, { uploadAPI } from '../api';
import axios from 'axios';  // ✅ ADD THIS
import AsyncStorage from '@react-native-async-storage/async-storage';
interface PayNowSettingsProps {
  visible: boolean;
  onClose: () => void;
  userId: number;
  theme: any;
  t: any;
  onUpdate: (qrCodeUrl: string) => void;
}

const PayNowSettings: React.FC<PayNowSettingsProps> = ({
  visible,
  onClose,
  userId,
  theme,
  t,
  onUpdate
}) => {
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [enablePayNow, setEnablePayNow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadPayNowSettings();
    }
  }, [visible]);

  const loadPayNowSettings = async () => {
    setLoading(true);
    try {
      const response = await API.get(`/user/paynow/${userId}`);
      const savedQrUrl = response.data.qrCodeUrl || '';
      setQrCodeUrl(savedQrUrl);
      setEnablePayNow(!!savedQrUrl);
    } catch (error) {
      console.log('Error loading PayNow:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      setImageUploading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        await uploadImage(imageUri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    } finally {
      setImageUploading(false);
    }
  };

 // Update the uploadImage function with better error handling:

// In PayNowSettings.tsx, update uploadImage function:

const uploadImage = async (uri: string) => {
  try {
    console.log('📤 Starting upload for:', uri);
    
    const filename = uri.split('/').pop();
    const match = /\.(\w+)$/.exec(filename || '');
    const type = match ? `image/${match[1]}` : 'image/jpeg';
    
    console.log('📁 File details:', { filename, type });

    const formData = new FormData();
    formData.append('image', {
      uri,
      name: filename || 'paynow-qr.jpg',
      type,
    } as any);

    // ✅ ONLY RAILWAY URL - No development!
    const baseURL = 'https://hawkerfinalv-production.up.railway.app/api';
      
    console.log('📡 Environment: Production');
    console.log('📡 Sending to:', `${baseURL}/upload`);

    // Create a fresh axios instance for this upload
    const response = await axios.post(`${baseURL}/upload`, formData, {
      headers: { 
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${await AsyncStorage.getItem('token')}`
      },
      timeout: 30000,
    });

    console.log('✅ Upload response:', response.data);

    const imageUrl = response.data.imageUrl || response.data.imageUri;
    
    // ✅ Ensure full URL for production
    const fullImageUrl = imageUrl.startsWith('http') 
      ? imageUrl 
      : `https://hawkerfinalv-production.up.railway.app${imageUrl}`;
    
    console.log('✅ Image URL set:', fullImageUrl);
    setQrCodeUrl(fullImageUrl);
    
    Alert.alert('✅ Success', 'QR code uploaded successfully');

  } catch (error: any) {
    console.log('❌ Upload error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        baseURL: error.config?.baseURL
      }
    });

    let errorMsg = 'Failed to upload image';
    if (error.code === 'ECONNABORTED') {
      errorMsg = 'Upload timeout - please try again';
    } else if (error.message === 'Network Error') {
      errorMsg = 'Network error - check your connection';
    } else if (error.response?.status === 404) {
      errorMsg = 'Upload endpoint not found - check URL';
    } else if (error.response?.data?.error) {
      errorMsg = error.response.data.error;
    }
    
    Alert.alert('❌ Error', errorMsg);
  }
};
const savePayNowSettings = async () => {
  if (enablePayNow && !qrCodeUrl) {
    Alert.alert('Error', 'Please upload PayNow QR code first');
    return;
  }

  setSaving(true);
  try {
    // 1️⃣ Save PayNow QR
    await API.put('/user/update-paynow', {
      userId,
      qrCodeUrl: enablePayNow ? qrCodeUrl : null
    });

    // 2️⃣ Get current payment modes
    const modesResponse = await API.get(`/user/payment-modes/${userId}`);
    let paymentModes = modesResponse.data.paymentModes || [];
    
    console.log('📋 Current payment modes:', paymentModes);

    // 3️⃣ Find or create PayNow mode
    let payNowMode = paymentModes.find((m: any) => m.id === 'paynow');
    
    if (!payNowMode) {
      // Create new PayNow mode
      payNowMode = {
        id: 'paynow',
        name: 'PayNow',
        icon: '📱',
        description: 'PayNow QR payment',
        isActive: enablePayNow,
        order: paymentModes.length
      };
      paymentModes.push(payNowMode);
      console.log('✅ Created new PayNow mode');
    } else {
      // Update existing mode
      payNowMode.isActive = enablePayNow;
      console.log('✅ Updated PayNow mode active status:', enablePayNow);
    }

    // 4️⃣ Save updated payment modes
    const saveResponse = await API.put('/user/payment-modes', {
      userId,
      paymentModes
    });

    console.log('✅ Payment modes saved:', saveResponse.data);

    // ✅ IMPORTANT: Call onUpdate with QR URL
    onUpdate(qrCodeUrl);
    
    // ✅ Small delay to ensure parent state updates
    setTimeout(() => {
      Alert.alert('✅ Success', 'PayNow settings saved');
      onClose();
    }, 100);

  } catch (error: any) {
    console.log('❌ Save error:', error.response?.data || error.message);
    Alert.alert('Error', error.response?.data?.error || 'Failed to save settings');
  } finally {
    setSaving(false);
  }
};
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
          
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>
              💳 PayNow Settings
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView>
            {loading ? (
              <ActivityIndicator size="large" color={theme.primary} />
            ) : (
              <>
                {/* Enable PayNow Switch */}
                <View style={[styles.card, { backgroundColor: theme.surface }]}>
                  <View style={styles.switchRow}>
                    <View style={styles.switchLeft}>
                      <Ionicons name="qr-code-outline" size={24} color={theme.primary} />
                      <Text style={[styles.switchLabel, { color: theme.text }]}>
                        Enable PayNow
                      </Text>
                    </View>
                    <Switch
                      value={enablePayNow}
                      onValueChange={setEnablePayNow}
                      trackColor={{ false: theme.inactive, true: theme.success }}
                      thumbColor="#fff"
                    />
                  </View>
                </View>

                {enablePayNow && (
                  <>
                    {/* QR Code Upload */}
                    <View style={[styles.card, { backgroundColor: theme.surface }]}>
                      <Text style={[styles.label, { color: theme.textSecondary }]}>
                        PayNow QR Code *
                      </Text>

                     
{qrCodeUrl ? (
  <View style={styles.qrPreviewContainer}>
    {(() => {
      const imageUrl = qrCodeUrl.startsWith('http') 
        ? qrCodeUrl 
        : `https://hawkerfinalv-production.up.railway.app${qrCodeUrl}`;
      
      console.log('🎯 Final image URL:', imageUrl);
      
      return (
        <Image 
          source={{ uri: imageUrl }}
          style={styles.qrPreview}
          onLoad={() => console.log('✅ Loaded:', imageUrl)}
          onError={(e) => {
            console.log('❌ Failed:', imageUrl, e.nativeEvent.error);
            // Try without baseURL as fallback
            if (!qrCodeUrl.startsWith('http')) {
              setTimeout(() => {
                setQrCodeUrl(qrCodeUrl); // This will retry
              }, 1000);
            }
          }}
        />
      );
    })()}
    
    <TouchableOpacity
      style={styles.removeImageButton}
      onPress={() => setQrCodeUrl('')}
    >
      <Ionicons name="close-circle" size={24} color={theme.danger} />
    </TouchableOpacity>
  </View>
) : (
  <TouchableOpacity
    style={[styles.uploadButton, { backgroundColor: theme.primary }]}
    onPress={pickImage}
    disabled={imageUploading}
  >
    {imageUploading ? (
      <ActivityIndicator size="small" color="#fff" />
    ) : (
      <>
        <Ionicons name="cloud-upload" size={24} color="#fff" />
        <Text style={styles.uploadButtonText}>Upload QR Code</Text>
      </>
    )}
  </TouchableOpacity>
)}

                      <Text style={[styles.helper, { color: theme.textSecondary }]}>
                        Upload your PayNow QR code image
                      </Text>
                    </View>

                    {/* Preview Card */}
                    <View style={[styles.previewCard, { backgroundColor: theme.primary + '20' }]}>
                      <Text style={[styles.previewTitle, { color: theme.primary }]}>
                        PayNow Preview
                      </Text>
                      <View style={styles.previewRow}>
                        <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>
                          Status:
                        </Text>
                        <Text style={[styles.previewValue, { color: qrCodeUrl ? theme.success : theme.danger }]}>
                          {qrCodeUrl ? '✅ QR Code Ready' : '❌ No QR Code'}
                        </Text>
                      </View>
                    </View>
                  </>
                )}

                {/* Info Box */}
                <View style={[styles.infoBox, { backgroundColor: theme.info + '20' }]}>
                  <Ionicons name="information-circle" size={20} color={theme.info} />
                  <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                    When enabled, PayNow will appear as a payment option. 
                    Customers can scan the QR code to pay.
                  </Text>
                </View>
              </>
            )}
          </ScrollView>

          {/* Buttons */}
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
              onPress={savePayNowSettings}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Save Settings</Text>
              )}
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
    padding: 20,
  },
 modalContent: {
  width: '100%',
  maxWidth: 400,
  borderRadius: 20,
  padding: 20,
  maxHeight: '80%',
  backgroundColor: '#fff', // Will be overridden by theme
  elevation: 5, // Add shadow for Android
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 3.84,
},
  header: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 20,
  paddingBottom: 10,
  borderBottomWidth: 1,
  borderBottomColor: '#eee',
  zIndex: 10, // Ensure header stays on top
},
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 10,
    marginBottom: 8,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  qrPreviewContainer: {
    position: 'relative',
    alignItems: 'center',
    marginBottom: 8,
  },
  qrPreview: {
    width: 200,
    height: 200,
    borderRadius: 10,
  },
  removeImageButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  helper: {
    fontSize: 12,
    marginTop: 4,
  },
  previewCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  previewLabel: {
    fontSize: 13,
  },
  previewValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  button: {
    flex: 1,
    padding: 16,
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
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PayNowSettings;