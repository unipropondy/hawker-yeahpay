import React, { memo } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform, View, Modal, TouchableOpacity, Text, TextInput } from 'react-native';

interface Props {
  show: boolean;
  value: Date;
  onChange: (event: any, date?: Date) => void;
  onClose: () => void;
}

const MemoizedDatePicker: React.FC<Props> = ({ show, value, onChange, onClose }) => {
  if (!show) return null;

  if (Platform.OS === 'web') {
    return (
      <Modal
        transparent={true}
        animationType="slide"
        visible={show}
        onRequestClose={onClose}
      >
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.5)',
        }}>
          <View style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            padding: 20,
            width: 320,
            alignItems: 'center',
          }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              width: '100%',
              marginBottom: 20,
              alignItems: 'center',
            }}>
              <TouchableOpacity onPress={onClose}>
                <Text style={{ fontSize: 16, padding: 8, color: '#666' }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 16, fontWeight: '600' }}>Select Date</Text>
              <TouchableOpacity onPress={() => {
                onChange({ type: 'set' }, value);
                onClose();
              }}>
                <Text style={{ fontSize: 16, padding: 8, color: '#FF4444', fontWeight: '700' }}>Done</Text>
              </TouchableOpacity>
            </View>
            {React.createElement('input', {
              type: 'date',
              value: `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`,
              onChange: (e: any) => {
                const val = e.target.value;
                if (val) {
                  const [y, m, d] = val.split('-').map(Number);
                  const newD = new Date(value);
                  newD.setFullYear(y);
                  newD.setMonth(m - 1);
                  newD.setDate(d);
                  onChange({ type: 'set' }, newD);
                }
              },
              style: {
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #ccc',
                fontSize: '16px',
                width: '100%',
                textAlign: 'center',
                boxSizing: 'border-box'
              }
            })}
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <DateTimePicker
      value={value}
      mode="date"
      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
      onChange={(event, date) => {
        onChange(event, date);
        // Don't close immediately on Android
        if (Platform.OS === 'android' && event.type === 'set') {
          // Keep open
        } else if (Platform.OS === 'ios') {
          // Close after selection on iOS
          setTimeout(onClose, 500);
        }
      }}
    />
  );
};

// ✅ Important: This prevents re-renders when parent updates
export default memo(MemoizedDatePicker);