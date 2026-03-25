// frontend/src/components/PayNowQRPayment.tsx

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  Image,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCurrency } from '../context/CurrencyContext';
interface PayNowQRPaymentProps {
  visible: boolean;
  onClose: () => void;
  onBack: () => void;
  amount: number;
  onSuccess: () => void;
  onFailed?: () => void;
  theme: any;
  t: any;
  shopName: string;
  qrCodeUrl: string | null;
   formatPrice: (amount: number) => string;
}

const PayNowQRPayment: React.FC<PayNowQRPaymentProps> = ({
  visible,
  onClose,
  onBack,
  amount,
  onSuccess,
  onFailed,
  theme,
  t,
  shopName,
  qrCodeUrl,
  formatPrice
}) => {
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

  if (!visible || !qrCodeUrl) return null;
const getFullImageUrl = (url: string) => {
  if (url.startsWith('http')) {
    return url;
  }
  return `https://uniprohawker-production.up.railway.app${url}`;
};
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
          
          {/* Header with back button */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onBack}>
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: theme.text }]}>PayNow QR Payment</Text>
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

          {/* QR Code Image */}
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.qrContainer}>
  <Image 
  source={{ uri: getFullImageUrl(qrCodeUrl) }} 
  style={styles.qrImage}
  resizeMode="contain"
/>
              <Text style={[styles.qrSubtext, { color: theme.textSecondary }]}>
                Ask customer to scan this PayNow QR code
              </Text>
            </View>

            {/* Payment Received Button */}
            <TouchableOpacity
              style={[styles.successButton, { backgroundColor: theme.success }]}
              onPress={handleManualSuccess}
            >
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.successButtonText}>✅ Payment Received</Text>
            </TouchableOpacity>

            {/* Back Button */}
            <TouchableOpacity
              style={[styles.backButton, { borderColor: theme.border }]}
              onPress={onBack}
            >
              <Ionicons name="arrow-back" size={20} color={theme.text} />
              <Text style={[styles.backButtonText, { color: theme.text }]}>Back to Payment Methods</Text>
            </TouchableOpacity>
          </ScrollView>

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
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
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
  scrollContent: {
    alignItems: 'center',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  qrImage: {
    width: 250,
    height: 250,
    borderRadius: 12,
    marginBottom: 8,
  },
  qrSubtext: {
    fontSize: 12,
    textAlign: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    width: '100%',
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
    width: '100%',
    marginBottom: 10,
  },
  successButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    width: '100%',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default PayNowQRPayment;