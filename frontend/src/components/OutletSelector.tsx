// frontend/src/components/OutletSelector.tsx
import React from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Modal, 
  ScrollView,
  Dimensions 
} from 'react-native';
import { setSelectedOutlet } from '../api';

const { width } = Dimensions.get('window');

export const OutletSelector = ({ visible, outlets, onSelect, theme, t }) => {
    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
                    
                    {/* Header with Icon */}
                    <View style={styles.headerContainer}>
                        <View style={[styles.iconCircle, { backgroundColor: theme.primary }]}>
                            <Text style={styles.iconText}>🏪</Text>
                        </View>
                        <Text style={[styles.title, { color: theme.text }]}>
                            Select Your Outlet
                        </Text>
                        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                            Choose a location to continue
                        </Text>
                    </View>

                    {/* Outlets List */}
                    <ScrollView 
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                    >
                        {outlets.map((outlet, index) => (
                            <TouchableOpacity
                                key={outlet.Id}
                                style={[
                                    styles.outletCard,
                                    { 
                                        backgroundColor: theme.surface,
                                        borderColor: theme.border,
                                        shadowColor: theme.text,
                                    }
                                ]}
                                onPress={() => {
                                    setSelectedOutlet(outlet.Id);
                                    onSelect(outlet);
                                }}
                                activeOpacity={0.7}
                            >
                                {/* Card Header with Status */}
                                <View style={styles.cardHeader}>
                                    <View style={styles.outletInfo}>
                                        <Text style={[styles.outletName, { color: theme.text }]}>
                                            {outlet.name}
                                        </Text>
                                        <View style={styles.staffBadge}>
                                            <Text style={[styles.staffIcon, { color: theme.primary }]}>👤</Text>
                                            <Text style={[styles.staffText, { color: theme.textSecondary }]}>
                                                {outlet.staffUsername || 'No staff'}
                                            </Text>
                                        </View>
                                    </View>
                                    
                                    {/* Status Badge */}
                                    <View style={[
                                        styles.statusBadge,
                                        { 
                                            backgroundColor: outlet.LicenseActive 
                                                ? theme.success + '20' 
                                                : theme.danger + '20',
                                            borderColor: outlet.LicenseActive 
                                                ? theme.success 
                                                : theme.danger,
                                        }
                                    ]}>
                                        <Text style={[
                                            styles.statusText,
                                            { 
                                                color: outlet.LicenseActive 
                                                    ? theme.success 
                                                    : theme.danger 
                                            }
                                        ]}>
                                            {outlet.LicenseActive ? '● ACTIVE' : '○ EXPIRED'}
                                        </Text>
                                    </View>
                                </View>

                                {/* License Key (if active) */}
                                {outlet.LicenseActive && outlet.LicenseKey && (
                                    <View style={[styles.licenseContainer, { backgroundColor: theme.primary + '10' }]}>
                                        <Text style={[styles.licenseLabel, { color: theme.textSecondary }]}>
                                            License:
                                        </Text>
                                        <Text style={[styles.licenseKey, { color: theme.primary }]}>
                                            {outlet.LicenseKey}
                                        </Text>
                                    </View>
                                )}

                                {/* Expiry Date */}
                                {outlet.ExpiryDate && (
                                    <View style={styles.expiryContainer}>
                                        <Text style={[styles.expiryLabel, { color: theme.textSecondary }]}>
                                            Expires:
                                        </Text>
                                        <Text style={[styles.expiryValue, { color: theme.text }]}>
                                            {new Date(outlet.ExpiryDate).toLocaleDateString('en-GB', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric'
                                            })}
                                        </Text>
                                    </View>
                                )}

                                {/* Select Button */}
                                <View style={[styles.selectButton, { backgroundColor: theme.primary }]}>
                                    <Text style={styles.selectButtonText}>Select Outlet →</Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        borderRadius: 24,
        padding: 20,
        maxHeight: '85%',
        width: '100%',
        maxWidth: 400,
        alignSelf: 'center',
    },
    headerContainer: {
        alignItems: 'center',
        marginBottom: 25,
    },
    iconCircle: {
        width: 70,
        height: 70,
        borderRadius: 35,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    iconText: {
        fontSize: 32,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 5,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        textAlign: 'center',
    },
    scrollContent: {
        paddingBottom: 10,
    },
    outletCard: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    outletInfo: {
        flex: 1,
        marginRight: 10,
    },
    outletName: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 4,
    },
    staffBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    staffIcon: {
        fontSize: 14,
    },
    staffText: {
        fontSize: 13,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        borderWidth: 1,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '700',
    },
    licenseContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 10,
        marginBottom: 10,
        gap: 6,
    },
    licenseLabel: {
        fontSize: 12,
    },
    licenseKey: {
        fontSize: 11,
        fontFamily: 'monospace',
        fontWeight: '600',
        flex: 1,
    },
    expiryContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
        gap: 6,
    },
    expiryLabel: {
        fontSize: 13,
    },
    expiryValue: {
        fontSize: 13,
        fontWeight: '600',
    },
    selectButton: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    selectButtonText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '600',
    },
});

export default OutletSelector;