// In your Admin Panel component - Add this to create shop form

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  ScrollView,
  Modal,
  Platform
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import API from '../api';

export const CreateShopForm = ({ onSuccess, theme, t }) => {
  const [shopName, setShopName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  
  // ✅ NEW: Shop Owner toggle
  const [isShopOwner, setIsShopOwner] = useState(true); // Default to shop owner
  
  const handleCreate = async () => {
    if (!shopName || !username || !password) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    
    try {
      const response = await API.post('/admin/create-shop', {
        shopName,
        username,
        password,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        isShopOwner  // ✅ Send this to backend
      });
      
      Alert.alert('Success', `Shop created! Role: ${isShopOwner ? 'Shop Owner' : 'Admin'}`);
      onSuccess(response.data.shop);
      
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to create shop');
    }
  };
  
  return (
    <ScrollView style={styles.container}>
      <Text style={[styles.title, { color: theme.text }]}>Create New Shop</Text>
      
      {/* Shop Name */}
      <Text style={[styles.label, { color: theme.textSecondary }]}>Shop Name *</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.surface, color: theme.text }]}
        value={shopName}
        onChangeText={setShopName}
        placeholder="Enter shop name"
        placeholderTextColor={theme.textSecondary}
      />
      
      {/* Username */}
      <Text style={[styles.label, { color: theme.textSecondary }]}>Username *</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.surface, color: theme.text }]}
        value={username}
        onChangeText={setUsername}
        placeholder="Enter username"
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
      />
      
      {/* Password */}
      <Text style={[styles.label, { color: theme.textSecondary }]}>Password *</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.surface, color: theme.text }]}
        value={password}
        onChangeText={setPassword}
        placeholder="Enter password"
        placeholderTextColor={theme.textSecondary}
        secureTextEntry
      />
      
      {/* ✅ NEW: Shop Owner Toggle */}
      <View style={[styles.toggleContainer, { backgroundColor: theme.surface }]}>
        <View style={styles.toggleRow}>
          <View>
            <Text style={[styles.toggleLabel, { color: theme.text }]}>Shop Owner Access</Text>
            <Text style={[styles.toggleDescription, { color: theme.textSecondary }]}>
              {isShopOwner 
                ? 'Can ONLY view sales reports' 
                : 'Full admin access - can manage everything'}
            </Text>
          </View>
          <Switch
            value={isShopOwner}
            onValueChange={setIsShopOwner}
            trackColor={{ false: theme.inactive, true: theme.primary }}
            thumbColor="#fff"
          />
        </View>
      </View>
      
      {/* Start Date */}
      <Text style={[styles.label, { color: theme.textSecondary }]}>Start Date</Text>
      <TouchableOpacity
        style={[styles.dateButton, { backgroundColor: theme.surface }]}
        onPress={() => setShowStartPicker(true)}
      >
        <Text style={[styles.dateText, { color: theme.text }]}>
          {startDate.toLocaleDateString()}
        </Text>
      </TouchableOpacity>
      
      {showStartPicker && (
        Platform.OS === 'web' ? (
          <Modal
            transparent={true}
            animationType="slide"
            visible={showStartPicker}
            onRequestClose={() => setShowStartPicker(false)}
          >
            <View style={styles.webModalOverlay}>
              <View style={[styles.webModalContent, { backgroundColor: theme.card }]}>
                <View style={styles.webModalHeader}>
                  <TouchableOpacity onPress={() => setShowStartPicker(false)}>
                    <Text style={[styles.webModalButton, { color: theme.text }]}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={[styles.webModalTitle, { color: theme.text }]}>Select Start Date</Text>
                  <TouchableOpacity onPress={() => setShowStartPicker(false)}>
                    <Text style={[styles.webModalButton, { color: theme.primary, fontWeight: '700' }]}>Done</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  // @ts-ignore
                  type="date"
                  value={`${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`}
                  onChangeText={(text) => {
                    if (text) {
                      const [y, m, d] = text.split('-').map(Number);
                      const newD = new Date(startDate);
                      newD.setFullYear(y);
                      newD.setMonth(m - 1);
                      newD.setDate(d);
                      setStartDate(newD);
                    }
                  }}
                  style={[styles.webPickerInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
                />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={startDate}
            mode="date"
            onChange={(event, date) => {
              setShowStartPicker(false);
              if (date) setStartDate(date);
            }}
          />
        )
      )}
      
      {/* End Date */}
      <Text style={[styles.label, { color: theme.textSecondary }]}>End Date</Text>
      <TouchableOpacity
        style={[styles.dateButton, { backgroundColor: theme.surface }]}
        onPress={() => setShowEndPicker(true)}
      >
        <Text style={[styles.dateText, { color: theme.text }]}>
          {endDate.toLocaleDateString()}
        </Text>
      </TouchableOpacity>
      
      {showEndPicker && (
        Platform.OS === 'web' ? (
          <Modal
            transparent={true}
            animationType="slide"
            visible={showEndPicker}
            onRequestClose={() => setShowEndPicker(false)}
          >
            <View style={styles.webModalOverlay}>
              <View style={[styles.webModalContent, { backgroundColor: theme.card }]}>
                <View style={styles.webModalHeader}>
                  <TouchableOpacity onPress={() => setShowEndPicker(false)}>
                    <Text style={[styles.webModalButton, { color: theme.text }]}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={[styles.webModalTitle, { color: theme.text }]}>Select End Date</Text>
                  <TouchableOpacity onPress={() => setShowEndPicker(false)}>
                    <Text style={[styles.webModalButton, { color: theme.primary, fontWeight: '700' }]}>Done</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  // @ts-ignore
                  type="date"
                  value={`${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`}
                  onChangeText={(text) => {
                    if (text) {
                      const [y, m, d] = text.split('-').map(Number);
                      const newD = new Date(endDate);
                      newD.setFullYear(y);
                      newD.setMonth(m - 1);
                      newD.setDate(d);
                      setEndDate(newD);
                    }
                  }}
                  style={[styles.webPickerInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
                />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={endDate}
            mode="date"
            onChange={(event, date) => {
              setShowEndPicker(false);
              if (date) setEndDate(date);
            }}
          />
        )
      )}
      
      {/* Create Button */}
      <TouchableOpacity
        style={[styles.createButton, { backgroundColor: theme.primary }]}
        onPress={handleCreate}
      >
        <Text style={styles.createButtonText}>Create Shop</Text>
      </TouchableOpacity>
      
      {/* Info Box */}
      <View style={[styles.infoBox, { backgroundColor: theme.info + '20' }]}>
        <Text style={[styles.infoText, { color: theme.textSecondary }]}>
          ℹ️ Shop Owners can ONLY view sales reports. They cannot edit menu, payment settings, or company settings.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  toggleContainer: {
    padding: 16,
    borderRadius: 12,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 12,
  },
  dateButton: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 14,
  },
  createButton: {
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 24,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
    marginBottom: 30,
  },
  infoText: {
    fontSize: 12,
    lineHeight: 18,
  },
  webModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  webModalContent: {
    borderRadius: 16,
    padding: 20,
    width: 320,
    alignItems: 'center',
  },
  webModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
    alignItems: 'center',
  },
  webModalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  webModalButton: {
    fontSize: 16,
    fontWeight: '500',
    padding: 8,
  },
  webPickerInput: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    width: '100%',
    textAlign: 'center',
  },
});