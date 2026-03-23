// src/components/DiscountInput.tsx
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Modal,
    ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DiscountInputProps {
    visible: boolean;
    onClose: () => void;
    onApplyDiscount: (type: 'percentage' | 'fixed', value: number, calculatedAmount: number) => void;
    currentTotal: number;
    theme: any;
    t: any;
    formatPrice: (amount: number) => string;
}

const DiscountInput: React.FC<DiscountInputProps> = ({
    visible,
    onClose,
    onApplyDiscount,
    currentTotal,
    theme,
    t,
    formatPrice
}) => {
    const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
    const [inputValue, setInputValue] = useState('');
    const [calculatedDiscount, setCalculatedDiscount] = useState(0);
    const [finalTotal, setFinalTotal] = useState(currentTotal);

    // Calculate discount whenever input or type changes
    useEffect(() => {
        if (!inputValue || isNaN(parseFloat(inputValue))) {
            setCalculatedDiscount(0);
            setFinalTotal(currentTotal);
            return;
        }

        const value = parseFloat(inputValue);
        let discountAmount = 0;

        if (discountType === 'percentage') {
            discountAmount = (currentTotal * value) / 100;
            // Max 100% discount
            if (value > 100) {
                discountAmount = currentTotal;
            }
        } else {
            discountAmount = value;
            // Can't discount more than total
            if (value > currentTotal) {
                discountAmount = currentTotal;
            }
        }

        setCalculatedDiscount(discountAmount);
        setFinalTotal(currentTotal - discountAmount);
    }, [inputValue, discountType, currentTotal]);

    const handleApply = () => {
        if (!inputValue || isNaN(parseFloat(inputValue)) || parseFloat(inputValue) <= 0) {
            alert('Please enter valid discount amount');
            return;
        }

        onApplyDiscount(discountType, parseFloat(inputValue), calculatedDiscount);
        onClose();
        setInputValue('');
    };

    const handleCancel = () => {
        setInputValue('');
        setDiscountType('percentage');
        onClose();
    };

    const quickPercentages = [5, 10, 15, 20, 25, 50];
    const quickFixed = [5, 10, 20, 50, 100];

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={handleCancel}
        >
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
                    
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: theme.text }]}>
                            🏷️ {t.applyDiscount || 'Apply Discount'}
                        </Text>
                        <TouchableOpacity onPress={handleCancel}>
                            <Ionicons name="close" size={24} color={theme.text} />
                        </TouchableOpacity>
                    </View>

                    {/* Current Total */}
                    <View style={[styles.totalContainer, { backgroundColor: theme.surface }]}>
                        <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>
                            {t.currentTotal || 'Current Total'}
                        </Text>
                        <Text style={[styles.totalValue, { color: theme.primary }]}>
                            {formatPrice(currentTotal)}
                        </Text>
                    </View>

                    {/* Discount Type Selector */}
                    <View style={styles.typeSelector}>
                        <TouchableOpacity
                            style={[
                                styles.typeButton,
                                { 
                                    backgroundColor: discountType === 'percentage' 
                                        ? theme.primary 
                                        : theme.surface,
                                    borderColor: theme.border
                                }
                            ]}
                            onPress={() => setDiscountType('percentage')}
                        >
                            <Text style={[
                                styles.typeButtonText,
                                { color: discountType === 'percentage' ? '#fff' : theme.text }
                            ]}>
                                {t.percentage || 'Percentage'} (%)
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.typeButton,
                                { 
                                    backgroundColor: discountType === 'fixed' 
                                        ? theme.primary 
                                        : theme.surface,
                                    borderColor: theme.border
                                }
                            ]}
                            onPress={() => setDiscountType('fixed')}
                        >
                            <Text style={[
                                styles.typeButtonText,
                                { color: discountType === 'fixed' ? '#fff' : theme.text }
                            ]}>
                                {t.fixedAmount || 'Fixed Amount'} ($)
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Input Field */}
                    <View style={styles.inputContainer}>
                        <Text style={[styles.inputLabel, { color: theme.text }]}>
                            {discountType === 'percentage' 
                                ? (t.discountPercentage || 'Discount %') 
                                : (t.discountAmount || 'Discount Amount')}
                        </Text>
                        <View style={[styles.inputWrapper, { borderColor: theme.primary }]}>
                            <Text style={[styles.inputSymbol, { color: theme.primary }]}>
                                {discountType === 'percentage' ? '%' : '$'}
                            </Text>
                            <TextInput
                                style={[styles.input, { color: theme.text }]}
                                placeholder="0"
                                placeholderTextColor={theme.textSecondary}
                                keyboardType="numeric"
                                value={inputValue}
                                onChangeText={setInputValue}
                                autoFocus={true}
                            />
                        </View>
                    </View>

                    {/* Quick Amounts */}
                    <View style={styles.quickContainer}>
                        <Text style={[styles.quickLabel, { color: theme.textSecondary }]}>
                            {t.quickSelect || 'Quick Select'}
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={styles.quickButtons}>
                                {(discountType === 'percentage' ? quickPercentages : quickFixed).map(value => (
                                    <TouchableOpacity
                                        key={value}
                                        style={[styles.quickBtn, { 
                                            backgroundColor: theme.surface,
                                            borderColor: theme.border
                                        }]}
                                        onPress={() => setInputValue(value.toString())}
                                    >
                                        <Text style={[styles.quickBtnText, { color: theme.text }]}>
                                            {discountType === 'percentage' ? `${value}%` : formatPrice(value)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                    </View>

                    {/* Discount Preview */}
                    {inputValue && !isNaN(parseFloat(inputValue)) && parseFloat(inputValue) > 0 && (
                        <View style={[styles.previewContainer, { backgroundColor: theme.success + '20' }]}>
                            <View style={styles.previewRow}>
                                <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>
                                    {t.discountAmount || 'Discount Amount'}:
                                </Text>
                                <Text style={[styles.previewValue, { color: theme.danger }]}>
                                    -{formatPrice(calculatedDiscount)}
                                </Text>
                            </View>
                            <View style={styles.previewRow}>
                                <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>
                                    {t.finalTotal || 'Final Total'}:
                                </Text>
                                <Text style={[styles.previewValue, { color: theme.success, fontWeight: '700' }]}>
                                    {formatPrice(finalTotal)}
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* Buttons */}
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[styles.button, styles.cancelButton, { 
                                borderColor: theme.border,
                                backgroundColor: theme.surface
                            }]}
                            onPress={handleCancel}
                        >
                            <Text style={[styles.cancelButtonText, { color: theme.text }]}>
                                {t.cancel || 'Cancel'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.button, 
                                styles.applyButton, 
                                { backgroundColor: theme.primary },
                                (!inputValue || parseFloat(inputValue) <= 0) && { opacity: 0.5 }
                            ]}
                            onPress={handleApply}
                            disabled={!inputValue || parseFloat(inputValue) <= 0}
                        >
                            <Text style={styles.applyButtonText}>
                                {t.apply || 'Apply'}
                            </Text>
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
        fontWeight: '700',
    },
    totalContainer: {
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 20,
    },
    totalLabel: {
        fontSize: 14,
        marginBottom: 4,
    },
    totalValue: {
        fontSize: 24,
        fontWeight: '800',
    },
    typeSelector: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 20,
    },
    typeButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
    },
    typeButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
    inputContainer: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 14,
        marginBottom: 8,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 2,
        borderRadius: 10,
        paddingHorizontal: 16,
        height: 60,
    },
    inputSymbol: {
        fontSize: 20,
        fontWeight: '600',
        marginRight: 8,
    },
    input: {
        flex: 1,
        fontSize: 20,
        padding: 0,
    },
    quickContainer: {
        marginBottom: 20,
    },
    quickLabel: {
        fontSize: 12,
        marginBottom: 8,
    },
    quickButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    quickBtn: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        minWidth: 60,
        alignItems: 'center',
    },
    quickBtnText: {
        fontSize: 14,
        fontWeight: '600',
    },
    previewContainer: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
    },
    previewRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    previewLabel: {
        fontSize: 14,
    },
    previewValue: {
        fontSize: 16,
        fontWeight: '600',
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    button: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 10,
        alignItems: 'center',
    },
    cancelButton: {
        borderWidth: 1,
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    applyButton: {
        elevation: 2,
    },
    applyButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});

export default DiscountInput;