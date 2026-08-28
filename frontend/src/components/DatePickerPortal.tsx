// components/DatePickerPortal.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Modal, View, TouchableOpacity, Text, StyleSheet, Platform, TextInput } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

// ✅ Date picker in its own modal - completely isolated!
const DatePickerPortal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onConfirm: (date: Date) => void;
  currentDate: Date;
  theme: any;
  title: string;
}> = ({ visible, onClose, onConfirm, currentDate, theme, title }) => {
  const [selectedDate, setSelectedDate] = useState(currentDate);

  useEffect(() => {
    if (visible) {
      setSelectedDate(currentDate);
    }
  }, [visible]);

  if (!visible) return null;

  if (Platform.OS === 'web') {
    return (
      <Modal
        transparent={true}
        animationType="slide"
        visible={visible}
        onRequestClose={onClose}
      >
        <View style={styles.webModalOverlay}>
          <View style={[styles.webModalContent, { backgroundColor: theme.card }]}>
            <View style={styles.webModalHeader}>
              <TouchableOpacity onPress={onClose}>
                <Text style={[styles.webModalButton, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.webModalTitle, { color: theme.text }]}>{title}</Text>
              <TouchableOpacity onPress={() => onConfirm(selectedDate)}>
                <Text style={[styles.webModalButton, { color: theme.primary }]}>Done</Text>
              </TouchableOpacity>
            </View>
            {React.createElement('input', {
              type: 'date',
              value: `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`,
              onChange: (e: any) => {
                const val = e.target.value;
                if (val) {
                  const [y, m, d] = val.split('-').map(Number);
                  const newD = new Date(selectedDate);
                  newD.setFullYear(y);
                  newD.setMonth(m - 1);
                  newD.setDate(d);
                  setSelectedDate(newD);
                }
              },
              style: {
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                borderRadius: '8px',
                border: '1px solid ' + (theme.border || '#ccc'),
                backgroundColor: theme.surface || '#fff',
                color: theme.text || '#000',
                marginTop: '15px',
                boxSizing: 'border-box'
              }
            })}
          </View>
        </View>
      </Modal>
    );
  }

  if (Platform.OS === 'android') {
    return (
      <DateTimePicker
        value={selectedDate}
        mode="date"
        display="default"
        onChange={(event, date) => {
          if (event.type === 'set' && date) {
            onConfirm(date);
          }
          onClose();
        }}
      />
    );
  }

  // iOS - custom modal with picker
  return (
    <Modal
      transparent={true}
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.iosModalOverlay}>
        <View style={[styles.iosModalContent, { backgroundColor: theme.card }]}>
          <View style={styles.iosModalHeader}>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.iosModalButton, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.iosModalTitle, { color: theme.text }]}>{title}</Text>
            <TouchableOpacity onPress={() => onConfirm(selectedDate)}>
              <Text style={[styles.iosModalButton, { color: theme.primary }]}>Done</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="spinner"
            onChange={(event, date) => date && setSelectedDate(date)}
            style={styles.iosPicker}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  iosModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  iosModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  iosModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  iosModalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  iosModalButton: {
    fontSize: 16,
    padding: 8,
  },
  iosPicker: {
    height: 200,
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

export default React.memo(DatePickerPortal);