import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import API from '../api';
import { useAuth } from '../context/AuthContext';

interface DrawerLog {
  Id: number;
  UserName: string;
  OutletName: string;
  OpenTime: string;
  CloseTime: string | null;
  DurationSeconds: number | null;
  CurrentDuration: number;
  TotalAmount: number | null;
  PaymentMethod: string | null;
  Status: string;
  SaleId: number | null;
  ActionType: string;
  Notes: string | null;
  OpenTimeFormatted?: string;
  CloseTimeFormatted?: string;
}

interface CashDrawerLogsProps {
  visible: boolean;
  onClose: () => void;
  theme: any;
  t: any;
  userRole: string;
  outletId?: number;
}

const CashDrawerLogs: React.FC<CashDrawerLogsProps> = ({
  visible,
  onClose,
  theme,
  t,
  userRole,
  outletId
}) => {
  const [logs, setLogs] = useState<DrawerLog[]>([]);
  const [openDrawers, setOpenDrawers] = useState<DrawerLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'open' | 'history'>('open');
  const [stats, setStats] = useState({
    totalOpens: 0,
    avgDuration: 0,
    totalCash: 0
  });

  useEffect(() => {
    if (visible) {
      loadAllData();
    }
  }, [visible]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Load based on user role
      if (userRole === 'admin') {
        // Admin sees all outlets
        const [openRes, historyRes] = await Promise.all([
          API.get('/cash-drawer/admin/all-open'),
          API.get('/cash-drawer/admin/all-history?limit=100')
        ]);
        setOpenDrawers(openRes.data.openDrawers || []);
        setLogs(historyRes.data.logs || []);
      } else {
        // Owner/Staff see their outlet only
        const [openRes, historyRes] = await Promise.all([
          API.get('/cash-drawer/check-open'),
          API.get('/cash-drawer/history?limit=100')
        ]);
        setOpenDrawers(openRes.data.openDrawers || []);
        setLogs(historyRes.data.logs || []);
      }

      // Calculate stats
      calculateStats(logs);
      
    } catch (error) {
      console.log('❌ Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  const calculateStats = (logsData: DrawerLog[]) => {
    const closedLogs = logsData.filter(l => l.Status === 'CLOSED');
    const totalOpens = closedLogs.length;
    const avgDuration = closedLogs.length > 0
      ? closedLogs.reduce((sum, l) => sum + (l.DurationSeconds || 0), 0) / closedLogs.length
      : 0;
    const totalCash = logsData.reduce((sum, l) => sum + (l.TotalAmount || 0), 0);

    setStats({
      totalOpens,
      avgDuration: Math.round(avgDuration),
      totalCash
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds} sec`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getStatusColor = (status: string, duration?: number) => {
    if (status === 'OPEN') {
      if (duration && duration > 60) return theme.danger;
      if (duration && duration > 30) return theme.warning;
      return theme.success;
    }
    return theme.textSecondary;
  };

  const handleCloseDrawer = async (logId: number) => {
    try {
      await API.post('/cash-drawer/close', { logId });
      await loadAllData();
    } catch (error) {
      console.log('❌ Error closing drawer:', error);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.primary }]}>
          <View style={styles.headerLeft}>
            <Ionicons name="cash-outline" size={24} color="#fff" />
            <Text style={styles.headerTitle}>Cash Drawer Logs</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.statValue, { color: theme.primary }]}>{stats.totalOpens}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Opens</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.statValue, { color: theme.warning }]}>{formatDuration(stats.avgDuration)}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Avg Duration</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.statValue, { color: theme.success }]}>
              ${stats.totalCash.toFixed(2)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Cash</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={[styles.tabContainer, { borderBottomColor: theme.border }]}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'open' && { borderBottomColor: theme.primary }]}
            onPress={() => setActiveTab('open')}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === 'open' ? theme.primary : theme.textSecondary }
            ]}>
              🔴 Open ({openDrawers.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'history' && { borderBottomColor: theme.primary }]}
            onPress={() => setActiveTab('history')}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === 'history' ? theme.primary : theme.textSecondary }
            ]}>
              📋 History
            </Text>
          </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <ScrollView
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {activeTab === 'open' ? (
              // OPEN DRAWERS
              openDrawers.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="checkmark-circle" size={50} color={theme.success} />
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    No open drawers
                  </Text>
                </View>
              ) : (
                openDrawers.map(drawer => {
                  const { date, time } = formatDateTime(drawer.OpenTime);
                  const statusColor = getStatusColor('OPEN', drawer.CurrentDuration);
                  
                  return (
                    <View key={drawer.Id} style={[styles.logCard, { backgroundColor: theme.card }]}>
                      
                      {/* Header with Outlet (for admin) */}
                      {userRole === 'admin' && drawer.OutletName && (
                        <Text style={[styles.outletName, { color: theme.primary }]}>
                          🏪 {drawer.OutletName}
                        </Text>
                      )}
                      
                      {/* User and Duration */}
                      <View style={styles.logHeader}>
                        <View style={styles.userInfo}>
                          <Ionicons name="person" size={16} color={theme.textSecondary} />
                          <Text style={[styles.userName, { color: theme.text }]}>
                            {drawer.UserName}
                          </Text>
                        </View>
                        <View style={[styles.durationBadge, { backgroundColor: statusColor + '20' }]}>
                          <Text style={[styles.durationText, { color: statusColor }]}>
                            ⏱️ {formatDuration(drawer.CurrentDuration)}
                          </Text>
                        </View>
                      </View>

                      {/* Time Info */}
                      <View style={styles.timeInfo}>
                        <Text style={[styles.timeText, { color: theme.textSecondary }]}>
                          {date} {time}
                        </Text>
                      </View>

                      {/* Amount if any */}
                      {drawer.TotalAmount > 0 && (
                        <Text style={[styles.amountText, { color: theme.success }]}>
                          💰 ${drawer.TotalAmount.toFixed(2)} {drawer.PaymentMethod && `(${drawer.PaymentMethod})`}
                        </Text>
                      )}

                      {/* Close Button */}
                      <TouchableOpacity
                        style={[styles.closeDrawerBtn, { backgroundColor: theme.success }]}
                        onPress={() => handleCloseDrawer(drawer.Id)}
                      >
                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        <Text style={styles.closeDrawerBtnText}>Close Drawer</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )
            ) : (
              // HISTORY
              logs.map(log => {
                const openDateTime = formatDateTime(log.OpenTime);
                const closeDateTime = log.CloseTime ? formatDateTime(log.CloseTime) : null;
                const statusColor = getStatusColor(log.Status, log.DurationSeconds || 0);
                
                return (
                  <View key={log.Id} style={[styles.logCard, { backgroundColor: theme.card }]}>
                    
                    {/* Header with Outlet (for admin) */}
                    {userRole === 'admin' && log.OutletName && (
                      <Text style={[styles.outletName, { color: theme.primary }]}>
                        🏪 {log.OutletName}
                      </Text>
                    )}
                    
                    {/* User and Status */}
                    <View style={styles.logHeader}>
                      <View style={styles.userInfo}>
                        <Ionicons name="person" size={16} color={theme.textSecondary} />
                        <Text style={[styles.userName, { color: theme.text }]}>
                          {log.UserName}
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { 
                        backgroundColor: statusColor + '20',
                        borderColor: statusColor
                      }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>
                          {log.Status}
                        </Text>
                      </View>
                    </View>

                    {/* Open Time */}
                    <View style={styles.timeRow}>
                      <Ionicons name="log-in" size={14} color={theme.success} />
                      <Text style={[styles.timeDetail, { color: theme.textSecondary }]}>
                        Open: {openDateTime.date} {openDateTime.time}
                      </Text>
                    </View>

                    {/* Close Time */}
                    {closeDateTime && (
                      <View style={styles.timeRow}>
                        <Ionicons name="log-out" size={14} color={theme.danger} />
                        <Text style={[styles.timeDetail, { color: theme.textSecondary }]}>
                          Close: {closeDateTime.date} {closeDateTime.time}
                        </Text>
                      </View>
                    )}

                    {/* Duration */}
                    <View style={styles.timeRow}>
                      <Ionicons name="time" size={14} color={theme.primary} />
                      <Text style={[styles.timeDetail, { color: theme.text }]}>
                        Duration: {formatDuration(log.DurationSeconds || log.CurrentDuration || 0)}
                      </Text>
                    </View>

                    {/* Amount */}
                    {log.TotalAmount > 0 && (
                      <View style={[styles.amountRow, { 
                        backgroundColor: theme.success + '10',
                        borderColor: theme.success + '30'
                      }]}>
                        <Ionicons name="cash" size={16} color={theme.success} />
                        <Text style={[styles.amountDetail, { color: theme.success }]}>
                          ${log.TotalAmount.toFixed(2)} {log.PaymentMethod && `- ${log.PaymentMethod}`}
                        </Text>
                      </View>
                    )}

                    {/* Notes */}
                    {log.Notes && (
                      <Text style={[styles.notes, { color: theme.textSecondary }]}>
                        📝 {log.Notes}
                      </Text>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 5,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
  },
  statCard: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginHorizontal: 15,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyState: {
    padding: 50,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    marginTop: 10,
  },
  logCard: {
    margin: 10,
    marginBottom: 5,
    padding: 15,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  outletName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
  },
  durationBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  durationText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  timeInfo: {
    marginBottom: 8,
  },
  timeText: {
    fontSize: 12,
  },
  amountText: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  closeDrawerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  closeDrawerBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  timeDetail: {
    fontSize: 12,
    flex: 1,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 8,
  },
  amountDetail: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  notes: {
    fontSize: 11,
    marginTop: 8,
    fontStyle: 'italic',
  },
});

export default CashDrawerLogs;