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
    ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import API from '../api';

interface VoidPasswordSettingsProps {
    visible: boolean;
    onClose: () => void;
    outletId: number;
    outletName: string;
    theme: any;
    t: any;
    userRole: string;
}

const VoidPasswordSettings: React.FC<VoidPasswordSettingsProps> = ({
    visible,
    onClose,
    outletId,
    outletName,
    theme,
    t,
    userRole
}) => {
    const [enabled, setEnabled] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [hasPassword, setHasPassword] = useState(false);

    useEffect(() => {
        if (visible && outletId) {
            loadStatus();
        }
    }, [visible, outletId]);

    const loadStatus = async () => {
        setLoading(true);
        try {
            const response = await API.get(`/admin/void-password-status/${outletId}`);
            setEnabled(response.data.enabled);
            setHasPassword(response.data.hasPassword);
        } catch (error) {
            console.log('Error loading void password status:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = async () => {
        if (enabled && !password) {
            Alert.alert('Error', 'Please enter void password');
            return;
        }

        if (enabled && password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        if (enabled && password.length < 4) {
            Alert.alert('Error', 'Password must be at least 4 characters');
            return;
        }

        setSaving(true);
        try {
            await API.post(`/admin/set-void-password/${outletId}`, {
                voidPassword: enabled ? password : null,
                enabled: enabled
            });

            Alert.alert('✅ Success', 'Void password settings saved');
            onClose();
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.error || 'Failed to save');
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
                            🔐 Void Password Settings
                        </Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={theme.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView>
                        <View style={[styles.outletCard, { backgroundColor: theme.surface }]}>
                            <Text style={[styles.outletName, { color: theme.text }]}>
                                🏪 {outletName}
                            </Text>
                            <Text style={[styles.outletInfo, { color: theme.textSecondary }]}>
                                Staff need this password to void transactions
                            </Text>
                        </View>

                        {loading ? (
                            <ActivityIndicator size="large" color={theme.primary} />
                        ) : (
                            <>
                                {/* Enable Switch */}
                                <View style={[styles.card, { backgroundColor: theme.surface }]}>
                                    <View style={styles.switchRow}>
                                        <View style={styles.switchLeft}>
                                            <Ionicons name="shield" size={24} color={theme.primary} />
                                            <Text style={[styles.switchLabel, { color: theme.text }]}>
                                                Enable Void Password
                                            </Text>
                                        </View>
                                        <Switch
                                            value={enabled}
                                            onValueChange={setEnabled}
                                            trackColor={{ false: theme.inactive, true: theme.success }}
                                            thumbColor="#fff"
                                        />
                                    </View>
                                </View>

                                {enabled && (
                                    <>
                                        {/* Password Input */}
                                        <View style={[styles.card, { backgroundColor: theme.surface }]}>
                                            <Text style={[styles.label, { color: theme.textSecondary }]}>
                                                Void Password *
                                            </Text>
                                            <TextInput
                                                style={[styles.input, { 
                                                    backgroundColor: theme.card,
                                                    color: theme.text,
                                                    borderColor: theme.border
                                                }]}
                                                placeholder="Enter void password"
                                                placeholderTextColor={theme.textSecondary}
                                                secureTextEntry
                                                value={password}
                                                onChangeText={setPassword}
                                            />

                                            <Text style={[styles.label, { color: theme.textSecondary, marginTop: 12 }]}>
                                                Confirm Password *
                                            </Text>
                                            <TextInput
                                                style={[styles.input, { 
                                                    backgroundColor: theme.card,
                                                    color: theme.text,
                                                    borderColor: theme.border
                                                }]}
                                                placeholder="Confirm password"
                                                placeholderTextColor={theme.textSecondary}
                                                secureTextEntry
                                                value={confirmPassword}
                                                onChangeText={setConfirmPassword}
                                            />

                                            <Text style={[styles.hint, { color: theme.textSecondary }]}>
                                                Staff will need this password to void transactions
                                            </Text>
                                        </View>

                                        {/* Info Box */}
                                        <View style={[styles.infoBox, { backgroundColor: theme.primary + '20' }]}>
                                            <Ionicons name="information-circle" size={20} color={theme.primary} />
                                            <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                                                When enabled, staff must enter this password to void any transaction.
                                                Only owners can change this setting.
                                            </Text>
                                        </View>
                                    </>
                                )}

                                {!enabled && hasPassword && (
                                    <View style={[styles.warningBox, { backgroundColor: theme.danger + '20' }]}>
                                        <Ionicons name="warning" size={20} color={theme.danger} />
                                        <Text style={[styles.warningText, { color: theme.danger }]}>
                                            Void password is currently disabled. Staff cannot void transactions.
                                        </Text>
                                    </View>
                                )}
                            </>
                        )}
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
                            onPress={saveSettings}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.saveButtonText}>Save Settings</Text>
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
        fontSize: 20,
        fontWeight: '700',
    },
    outletCard: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        alignItems: 'center',
    },
    outletName: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    outletInfo: {
        fontSize: 12,
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
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
    },
    hint: {
        fontSize: 12,
        marginTop: 8,
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
    warningBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    warningText: {
        flex: 1,
        fontSize: 12,
        fontWeight: '500',
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
        fontSize: 16,
        fontWeight: '600',
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default VoidPasswordSettings;