// frontend/src/components/UPIQRPayment.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';  // ✅ ADD THIS!
import { useCurrency } from '../context/CurrencyContext';

interface UPIQRPaymentProps {
  visible: boolean;
  onClose: () => void;
  amount: number;
  onSuccess: () => void;
  onFailed?: () => void;
  theme: any;
  t: any;
  shopName: string;
  upiId: string | null;
}

const UPIQRPayment: React.FC<UPIQRPaymentProps> = ({
  visible,
  onClose,
  amount,
  onSuccess,
  onFailed,
  theme,
  t,
  shopName,
  upiId
}) => {
  const { formatPrice } = useCurrency();
  const [showQR, setShowQR] = useState(true);
  
  useEffect(() => {
    if (visible) {
      setShowQR(true);
    }
  }, [visible]);

  const handleManualSuccess = () => {
    Alert.alert(
      'Confirm Payment',
      'Has the customer paid successfully?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          onPress: () => {
            onSuccess();
            onClose();
          }
        }
      ]
    );
  };

  // Generate UPI URL
  const generateUPIUrl = () => {
    if (!upiId) return '';
    const cleanUpiId = upiId.trim();
    const cleanShopName = shopName.replace(/[&?=]/g, '').trim();
    return `upi://pay?pa=${cleanUpiId}&pn=${cleanShopName}&am=${amount}&cu=INR`;
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
          
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>UPI QR Payment</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Amount */}
          <View style={[styles.amountContainer, { backgroundColor: theme.surface }]}>
            <Text style={[styles.amountLabel, { color: theme.textSecondary }]}>Amount to Pay</Text>
            <Text style={[styles.amountValue, { color: theme.primary }]}>
              {formatPrice(amount)}
            </Text>
          </View>

          {/* QR Code - Now visible! */}
          {showQR && upiId && (
            <>
              <View style={styles.qrContainer}>
                <View style={[styles.qrBox, { backgroundColor: '#fff' }]}>
                  <QRCode
                    value={generateUPIUrl()}
                    size={200}
                    color="#000"
                    backgroundColor="#fff"
                  />
                </View>
                <Text style={[styles.qrSubtext, { color: theme.textSecondary }]}>
                  Ask customer to scan this QR code
                </Text>
              </View>

              <View style={[styles.infoBox, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name="phone-portrait-outline" size={20} color={theme.primary} />
                <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                  1. Customer scans QR with any UPI app{'\n'}
                  2. They pay on their phone{'\n'}
                  3. You click "Payment Received" below
                </Text>
              </View>
            </>
          )}

          {/* Buttons */}
          <TouchableOpacity
            style={[styles.successButton, { backgroundColor: theme.success }]}
            onPress={handleManualSuccess}
          >
            <Ionicons name="checkmark-circle" size={24} color="#fff" />
            <Text style={styles.successButtonText}>✅ Payment Received</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.failedButton, { borderColor: theme.danger }]}
            onPress={() => {
              Alert.alert('Cancel Payment', 'Cancel this transaction?', [
                { text: 'No', style: 'cancel' },
                {
                  text: 'Yes',
                  onPress: () => {
                    if (onFailed) onFailed();
                    onClose();
                  }
                }
              ]);
            }}
          >
            <Ionicons name="close-circle" size={20} color={theme.danger} />
            <Text style={[styles.failedButtonText, { color: theme.danger }]}>Cancel Transaction</Text>
          </TouchableOpacity>

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
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  amountContainer: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  amountLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: '700',
  },
// In your styles, update/add these:

qrContainer: {
  alignItems: 'center',
  justifyContent: 'center',
  marginVertical: 20,
  minHeight: 220,  // Force height
  width: '100%',
},

qrBox: {
  width: 200,
  height: 200,
  borderRadius: 12,
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: '#fff',
  elevation: 5,  // Add shadow for Android
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 3.84,
},
  qrSubtext: {
    fontSize: 12,
    marginTop: 4,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
  },
  successButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 10,
    marginBottom: 10,
  },
  failedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  successButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  
  failedButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default UPIQRPayment;