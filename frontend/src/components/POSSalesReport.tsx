// components/POSSalesReport.tsx - COMPLETE WITH DISCOUNT SUMMARY & VOID SUPPORT ✅

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Alert, TextInput,Switch  } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import API from '../api';
import UniversalPrinter from './UniversalPrinter';  
import { Ionicons } from '@expo/vector-icons';
import VoidPasswordSettings from './VoidPasswordSettings';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CashDrawerLogs from './CashDrawerLogs'; 
interface CategorySummary {
  totalRevenue: number;
  totalTransactions: number;
  totalCategories: number;
  totalItems: number;
  paymentBreakdown: Record<string, number>;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  selectedFilter: string;
  onFilterChange: (filter: string) => void;
  startDate: Date;
  endDate: Date;
  onStartDateChange: (date: Date) => void;
  onEndDateChange: (date: Date) => void;
  onApplyCustomFilter: () => void;
  theme: any;
  t: any;
  isMobile: boolean;
  formatPrice: (amount: number) => string;
  companySettings?: any;
  categories?: any[];
  userId: string | number; 
  outletInfo?: { name: string; id: number; license?: string };
  userRole?: string; 
}

const POSSalesReport: React.FC<Props> = ({
  visible,
  onClose,
  selectedFilter,
  onFilterChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onApplyCustomFilter,
  theme,
  t,
  isMobile,
  formatPrice,
  companySettings,
  userId,  
  outletInfo,
  userRole,
}) => {
  // ============ REFS ============
  const isMounted = useRef(true);
  const loadingRef = useRef(false);
  const initialLoadDone = useRef(false);
  const prevFilterRef = useRef(selectedFilter);
  const prevStartRef = useRef(startDate);
  const prevEndRef = useRef(endDate);
  const loadTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const filterMap = {
    'Today': 'today',
    'Week': 'week',
    'Month': 'month', 
    'Custom': 'custom'
  };
  
  // ============ STATE ============
  const [showPicker, setShowPicker] = useState(false);
  const [pickerType, setPickerType] = useState<'start' | 'end'>('start');
  const [tempDate, setTempDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'categories'>('overview');
  const prevTabRef = useRef(activeTab); 
  const [showVoidPasswordSettings, setShowVoidPasswordSettings] = useState(false);
  
  // Add this with other state declarations (around line 60)
const [showVoidedTab, setShowVoidedTab] = useState(false);
  // ✅ VOID TRANSACTION STATE
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [voidPassword, setVoidPassword] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [voidLoading, setVoidLoading] = useState(false);
  const [voidedSales, setVoidedSales] = useState<any[]>([]);
  const [showVoidedCategoriesTab, setShowVoidedCategoriesTab] = useState(false);
  // Add with other refs (around line 30)
const prevShowVoidedTabRef = useRef(showVoidedTab);
const prevShowVoidedCategoriesTabRef = useRef(showVoidedCategoriesTab);
const voidedCategoriesTabChanged = prevShowVoidedCategoriesTabRef.current !== showVoidedCategoriesTab;
const [showCashDrawerLogs, setShowCashDrawerLogs] = useState(false);
const [cashDrawerToggle, setCashDrawerToggle] = useState(false);
  // ✅ Summary with discount fields
  const [summary, setSummary] = useState({
    totalSales: 0,
    totalRevenue: 0,
    totalItems: 0,
    totalDiscount: 0,
    discountedSales: 0,
    paymentBreakdown: {}
  });
  
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryItems, setCategoryItems] = useState<any[]>([]);
  const [categoryTransactions, setCategoryTransactions] = useState<any[]>([]);
  const [showTransactions, setShowTransactions] = useState(false);
  
  const [categorySummary, setCategorySummary] = useState({
    totalRevenue: 0,
    totalTransactions: 0,
    totalCategories: 0,
    totalItems: 0,
    totalDiscount: 0,
    discountedTransactions: 0,
    paymentBreakdown: {}
  });

  // ============ CLEANUP ============
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (loadTimerRef.current) {
        clearTimeout(loadTimerRef.current);
      }
    };
  }, []);
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };
  useEffect(() => {
  const loadToggleState = async () => {
    try {
      const saved = await AsyncStorage.getItem('cashDrawerToggle');
      if (saved !== null) {
        setCashDrawerToggle(saved === 'true');
      }
    } catch (error) {
      console.log('Error loading toggle state:', error);
    }
  };
  loadToggleState();
}, []);

// Add function to save toggle state
const saveToggleState = async (value: boolean) => {
  try {
    await AsyncStorage.setItem('cashDrawerToggle', value.toString());
    setCashDrawerToggle(value);
  } catch (error) {
    console.log('Error saving toggle state:', error);
  }
};

  // ============ LOAD FUNCTIONS ============
  const loadOverviewData = useCallback(async () => {
  if (loadingRef.current) return;
  
  loadingRef.current = true;
  if (isMounted.current) setLoading(true);

  try {
    const filterValue = selectedFilter?.toLowerCase() || 'today';
    const statusParam = showVoidedTab ? 'voided' : 'completed';
    
    let summaryUrl = '/sales/summary';
    let salesUrl = '/sales';
    
    if (filterValue === 'custom') {
      const start = startDate.toISOString().split('T')[0];
      const end = endDate.toISOString().split('T')[0];
      summaryUrl += `?filter=custom&startDate=${start}&endDate=${end}&status=${statusParam}`;
      salesUrl += `?filter=custom&startDate=${start}&endDate=${end}&status=${statusParam}`;
    } else {
      summaryUrl += `?filter=${filterValue}&status=${statusParam}`;
      salesUrl += `?filter=${filterValue}&status=${statusParam}`;
    }
    
    console.log(`📊 Loading ${showVoidedTab ? 'VOIDED' : 'COMPLETED'} sales with filter: ${filterValue}`);
    
    const [summaryRes, salesRes] = await Promise.all([
      API.get(summaryUrl),
      API.get(salesUrl)
    ]);
    
    if (isMounted.current) {
      setSummary({
        totalSales: summaryRes.data.totalSales || 0,
        totalRevenue: summaryRes.data.totalRevenue || 0,
        totalItems: summaryRes.data.totalItems || 0,
        totalDiscount: summaryRes.data.totalDiscount || 0,
        discountedSales: summaryRes.data.discountedSales || 0,
        paymentBreakdown: summaryRes.data.paymentBreakdown || {}
      });
      
      // ✅ FORMAT SALES WITH INVOICE NUMBER
      const formattedSales = (salesRes.data || []).map((sale: any) => ({
        id: sale.id || sale.Id,
        total: sale.total || sale.Total || 0,
        paymentMethod: sale.paymentMethod || sale.PaymentMethod || '',
        date: sale.date || sale.SaleDate || new Date(),
        invoiceNumber: sale.invoiceNumber || sale.InvoiceNumber || '', // ✅ ADD THIS
        items: sale.items || sale.ItemsJson || [],
        status: sale.status || sale.Status,
        voidReason: sale.voidReason,
        voidedAt: sale.voidedAt,
        voidedBy: sale.voidedBy,
        discount: sale.discount || null
      }));
      
      // ✅ Store formatted data
      if (showVoidedTab) {
        setVoidedSales(formattedSales);
      } else {
        setSalesHistory(formattedSales);
      }
    }
    
  } catch (error) {
    console.log('❌ Error loading data:', error);
  } finally {
    loadingRef.current = false;
    if (isMounted.current) setLoading(false);
  }
}, [selectedFilter, startDate, endDate, showVoidedTab]);
const loadCategoryData = useCallback(async () => {
  if (loadingRef.current) return;
  
  loadingRef.current = true;
  if (isMounted.current) {
    setSelectedCategory(null);
    setCategoryItems([]);
    setCategoryTransactions([]);
    setLoading(true);
  }
  
  try {
    const filterValue = selectedFilter?.toLowerCase() || 'today';
    // ✅ Use Categories tab specific state
    const statusParam = showVoidedCategoriesTab ? 'voided' : 'completed';
    
    let categoryUrl = '/sales/by-category';
    const categoryParams = new URLSearchParams();
    categoryParams.append('filter', filterValue);
    categoryParams.append('status', statusParam);
    
    let paymentUrl = '/sales/summary';
    const paymentParams = new URLSearchParams();
    paymentParams.append('filter', filterValue);
    paymentParams.append('status', statusParam);
    
    if (filterValue === 'custom') {
      const start = startDate.toISOString().split('T')[0];
      const end = endDate.toISOString().split('T')[0];
      
      categoryParams.append('startDate', start);
      categoryParams.append('endDate', end);
      
      paymentParams.append('startDate', start);
      paymentParams.append('endDate', end);
    }
    
    console.log(`📊 Loading categories with filter: ${filterValue}, status: ${statusParam}`);
    
    const [categoryResponse, paymentResponse] = await Promise.all([
      API.get(`${categoryUrl}?${categoryParams.toString()}`),
      API.get(`${paymentUrl}?${paymentParams.toString()}`)
    ]);
    
    if (isMounted.current) {
      if (categoryResponse.data.success) {
        setCategories(categoryResponse.data.categories || []);
        
        setCategorySummary({
          totalRevenue: categoryResponse.data.summary?.totalRevenue || 0,
          totalTransactions: categoryResponse.data.summary?.totalTransactions || 0,
          totalCategories: categoryResponse.data.summary?.totalCategories || 0,
          totalItems: categoryResponse.data.summary?.totalItems || 0,
          totalDiscount: categoryResponse.data.summary?.totalDiscount || 0,
          discountedTransactions: categoryResponse.data.summary?.discountedTransactions || 0,
          paymentBreakdown: paymentResponse.data.paymentBreakdown || {}
        });
      }
    }
    
  } catch (error) {
    console.log('❌ Error loading categories:', error);
  } finally {
    loadingRef.current = false;
    if (isMounted.current) setLoading(false);
  }
}, [selectedFilter, startDate, endDate, showVoidedCategoriesTab]); // ✅ Use Categories tab state/ ✅ ADD showVoidedTab dependency
  
const loadCategoryItems = useCallback(async (category: string) => {
  if (loadingRef.current) return;
  
  loadingRef.current = true;
  if (isMounted.current) {
    setSelectedCategory(category);
    setShowTransactions(false);
    setLoading(true);
  }
  
  try {
    const filterValue = selectedFilter?.toLowerCase() || 'today';
    // ✅ CHANGE: Use Categories tab specific state
    const statusParam = showVoidedCategoriesTab ? 'voided' : 'completed';
    
    let url = `/sales/category/${encodeURIComponent(category)}`;
    const params = new URLSearchParams();
    params.append('filter', filterValue);
    params.append('status', statusParam);
    
    if (filterValue === 'custom') {
      params.append('startDate', startDate.toISOString().split('T')[0]);
      params.append('endDate', endDate.toISOString().split('T')[0]);
    }
    
    console.log(`📊 Loading category items for "${category}" with status: ${statusParam}`);
    
    const response = await API.get(`${url}?${params.toString()}`);
    
    if (isMounted.current && response.data.success) {
      setCategoryItems(response.data.items || []);
      setCategoryTransactions(response.data.transactions || []);
    }
  } catch (error) {
    console.log('❌ Error loading category items:', error);
  } finally {
    loadingRef.current = false;
    if (isMounted.current) setLoading(false);
  }
}, [selectedFilter, startDate, endDate, showVoidedCategoriesTab]); // ✅ CHANGE dependency
  // ============ VOID SALE FUNCTION ============
  const handleVoidSale = async () => {
    if (!selectedSale || !voidPassword) {
      Alert.alert('Error', 'Please enter owner password');
      return;
    }
    
    setVoidLoading(true);
    try {
      const response = await API.post('/sales/void', {
        saleId: selectedSale.id,
        password: voidPassword,
        reason: voidReason.trim() || 'Voided by user'
      });
      
      if (response.data.success) {
        Alert.alert('✅ Success', 'Sale voided successfully');
        setShowVoidModal(false);
        setSelectedSale(null);
        setVoidPassword('');
        setVoidReason('');
        
        // Reload current data
        if (activeTab === 'overview') {
          loadOverviewData();
        } else {
          loadCategoryData();
        }
      }
    } catch (error: any) {
      console.log('❌ Void error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to void sale');
    } finally {
      setVoidLoading(false);
    }
  };

  // ============ MAIN EFFECT ============
  useEffect(() => {
    if (!visible) {
      initialLoadDone.current = false;
      prevFilterRef.current = selectedFilter;
      prevStartRef.current = startDate;
      prevEndRef.current = endDate;
      prevTabRef.current = activeTab;
      return;
    }

    if (!initialLoadDone.current) {
      console.log('📊 First time load');
      initialLoadDone.current = true;
      
      if (activeTab === 'overview') {
        loadOverviewData();
      } else {
        loadCategoryData();
      }
      
      prevFilterRef.current = selectedFilter;
      prevStartRef.current = startDate;
      prevEndRef.current = endDate;
      prevTabRef.current = activeTab;
      return;
    }

    const tabChanged = prevTabRef.current !== activeTab;
    const filterChanged = prevFilterRef.current !== selectedFilter;
    const startChanged = prevStartRef.current.getTime() !== startDate.getTime();
    const endChanged = prevEndRef.current.getTime() !== endDate.getTime();
    
    if (tabChanged || filterChanged || startChanged || endChanged) {
      console.log('📊 Change detected:', { tabChanged, filterChanged, startChanged, endChanged });
      
      if (activeTab === 'overview') {
        loadOverviewData();
      } else {
        loadCategoryData();
      }
      
      prevFilterRef.current = selectedFilter;
      prevStartRef.current = startDate;
      prevEndRef.current = endDate;
      prevTabRef.current = activeTab;
    }
    
  }, [visible, selectedFilter, startDate, endDate, activeTab]);

  // ============ HANDLERS ============
  const handleFilterChange = (filter: string) => {
    const filterMapLocal: {[key: string]: string} = {
      'Today': 'today',
      'Week': 'week',
      'Month': 'month',
      'Custom': 'custom'
    };
    const backendFilter = filterMapLocal[filter] || filter.toLowerCase();
    onFilterChange(backendFilter);
  };
  
  const openStartPicker = useCallback(() => {
    setPickerType('start');
    setTempDate(startDate);
    setShowPicker(true);
  }, [startDate]);

  const openEndPicker = useCallback(() => {
    setPickerType('end');
    setTempDate(endDate);
    setShowPicker(true);
  }, [endDate]);

  const onDateChange = useCallback((event: any, selectedDate?: Date) => {
    if (event.type === 'set' && selectedDate) {
      if (pickerType === 'start') {
        onStartDateChange(selectedDate);
      } else {
        onEndDateChange(selectedDate);
      }
    }
    setShowPicker(false);
  }, [pickerType, onStartDateChange, onEndDateChange]);
  
  const [isFilterChanging, setIsFilterChanging] = useState(false);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const groupTransactionsBySale = (transactions: any[]) => {
    const grouped: { [key: string]: any } = {};
    
    transactions.forEach(trans => {
      if (!grouped[trans.saleId]) {
        grouped[trans.saleId] = {
          id: trans.saleId,
          invoiceNumber: trans.invoiceNumber || '', 
          date: trans.saleDate,
          items: [],
          total: 0
        };
      }
      
      grouped[trans.saleId].items.push({
        name: trans.name,
        quantity: trans.quantity,
        price: trans.price
      });
      
      grouped[trans.saleId].total += (trans.price * trans.quantity);
    });
    
    return Object.values(grouped).sort((a: any, b: any) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  };

  const printReport = async () => {
    try {
      if (activeTab === 'categories') {
        if (selectedCategory) {
          await UniversalPrinter.printCategoryReport(
            categories,
            selectedCategory,
            categoryItems,
            categoryTransactions,
            userId,
            t,
            {
              filter: selectedFilter,
              startDate: startDate,
              endDate: endDate,
              summary: {
                totalSales: categorySummary.totalTransactions,
                totalItems: categorySummary.totalItems,
                totalRevenue: categorySummary.totalRevenue,
                totalDiscount: categorySummary.totalDiscount,
                discountedTransactions: categorySummary.discountedTransactions,
                paymentBreakdown: categorySummary.paymentBreakdown
              }
            }
          );
        } else {
          let paymentBreakdown = categorySummary.paymentBreakdown;
          if (Object.keys(paymentBreakdown).length === 0) {
            paymentBreakdown = await fetchPaymentBreakdown(selectedFilter);
          }
          
          await UniversalPrinter.printCategoryReport(
            categories,
            null,
            [],
            [],
            userId,
            t,
            {
              filter: selectedFilter,
              startDate: startDate,
              endDate: endDate,
              summary: {
                totalSales: categorySummary.totalTransactions,
                totalItems: categorySummary.totalItems,
                totalRevenue: categorySummary.totalRevenue,
                totalDiscount: categorySummary.totalDiscount,
                discountedTransactions: categorySummary.discountedTransactions,
                paymentBreakdown: paymentBreakdown
              }
            }
          );
        }
        Alert.alert('✅ Success', 'Category report printed');
      } else {
        const reportData = {
          summary: {
            totalSales: summary.totalSales,
            totalItems: summary.totalItems,
            totalRevenue: summary.totalRevenue,
            totalDiscount: summary.totalDiscount,
            discountedSales: summary.discountedSales
          },
          paymentBreakdown: summary.paymentBreakdown,
          salesHistory: salesHistory,
          period: selectedFilter === 'custom' 
            ? `${formatDate(startDate)} to ${formatDate(endDate)}`
            : selectedFilter
        };
        await UniversalPrinter.printSalesReport(reportData, userId, t);
        Alert.alert('✅ Success', 'Sales report printed');
      }
    } catch (error) {
      console.log('❌ Print error:', error);
      Alert.alert('❌ Error', 'Failed to print report');
    }
  };
  
  const getPaymentBreakdownForFilter = async (filter: string) => {
    try {
      if (filter === 'week') {
        return await fetchPaymentBreakdown('week');
      }
      return summary.paymentBreakdown;
    } catch (error) {
      console.log('Error fetching payment breakdown:', error);
      return {};
    }
  };
  
  const fetchPaymentBreakdown = async (filter: string) => {
    try {
      const params = new URLSearchParams();
      params.append('filter', filter);
      
      if (filter === 'custom') {
        params.append('startDate', startDate.toISOString().split('T')[0]);
        params.append('endDate', endDate.toISOString().split('T')[0]);
      }
      
      const response = await API.get(`/sales/summary?${params.toString()}`);
      return response.data.paymentBreakdown || {};
    } catch (error) {
      console.log('Error fetching payment breakdown:', error);
      return {};
    }
  };
// ============ MAIN EFFECT ============
useEffect(() => {
  if (!visible) {
    initialLoadDone.current = false;
    prevFilterRef.current = selectedFilter;
    prevStartRef.current = startDate;
    prevEndRef.current = endDate;
    prevTabRef.current = activeTab;
    prevShowVoidedTabRef.current = showVoidedTab; // ✅ Add this
        prevShowVoidedCategoriesTabRef.current = showVoidedCategoriesTab; 
    return;
  }

  if (!initialLoadDone.current) {
    console.log('📊 First time load');
    initialLoadDone.current = true;
    
    if (activeTab === 'overview') {
      loadOverviewData();
    } else {
      loadCategoryData();
    }
    
    prevFilterRef.current = selectedFilter;
    prevStartRef.current = startDate;
    prevEndRef.current = endDate;
    prevTabRef.current = activeTab;
    prevShowVoidedTabRef.current = showVoidedTab; // ✅ Add this
    return;
  }

  const tabChanged = prevTabRef.current !== activeTab;
  const filterChanged = prevFilterRef.current !== selectedFilter;
  const startChanged = prevStartRef.current.getTime() !== startDate.getTime();
  const endChanged = prevEndRef.current.getTime() !== endDate.getTime();
  const voidedTabChanged = prevShowVoidedTabRef.current !== showVoidedTab; // ✅ Add this
   const voidedCategoriesTabChanged = prevShowVoidedCategoriesTabRef.current !== showVoidedCategoriesTab; // ✅ Add this
  if (tabChanged || filterChanged || startChanged || endChanged || voidedTabChanged || voidedCategoriesTabChanged) {
    console.log('📊 Change detected:', { 
      tabChanged, 
      filterChanged, 
      startChanged, 
      endChanged,
      voidedTabChanged 
    });
    
    if (activeTab === 'overview') {
      loadOverviewData();
    } else {
      loadCategoryData();
    }
    
    prevFilterRef.current = selectedFilter;
    prevStartRef.current = startDate;
    prevEndRef.current = endDate;
    prevTabRef.current = activeTab;
    prevShowVoidedTabRef.current = showVoidedTab; // ✅ Add this
     prevShowVoidedCategoriesTabRef.current = showVoidedCategoriesTab;
  }
  
}, [visible, selectedFilter, startDate, endDate, activeTab, showVoidedTab,  showVoidedCategoriesTab]); // ✅ Add showVoidedTab
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  // ✅ Helper to calculate discount percentage
  const discountPercentage = summary.totalSales > 0 
    ? ((summary.discountedSales / summary.totalSales) * 100).toFixed(1)
    : '0';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.container, isMobile && styles.containerMobile, { backgroundColor: theme.background }]}>
          
          {/* Header */}
          {/* Header */}
<View style={[styles.header, { borderBottomColor: theme.border }]}>
  <Text style={[styles.title, { color: theme.text }]}>{t.salesReport}</Text>
  
  {/* ✅ ADD VOID PASSWORD BUTTON - Only for owners */}
  {userRole === 'owner' && outletInfo?.id && (
    <TouchableOpacity 
      style={[styles.voidPasswordBtn, { backgroundColor: theme.primary }]}
      onPress={() => setShowVoidPasswordSettings(true)}
    >
      <Ionicons name="key-outline" size={18} color="#fff" />
      <Text style={styles.voidPasswordBtnText}>Void Password</Text>
    </TouchableOpacity>
    
  )}
    
  <TouchableOpacity onPress={onClose} style={styles.closeButton}>
    <Text style={[styles.closeText, { color: theme.text }]}>✕</Text>
  </TouchableOpacity>
</View>
{userRole === 'owner' && (
    <TouchableOpacity 
      style={[
        styles.cashDrawerBtn, 
        { backgroundColor: cashDrawerToggle ? theme.success : theme.surface }
      ]}
      onPress={() => {
        if (cashDrawerToggle) {
          setShowCashDrawerLogs(true);
        }
      }}
    >
      <View style={styles.cashDrawerToggleContainer}>
        <Ionicons name="cash-outline" size={18} color={cashDrawerToggle ? '#fff' : theme.text} />
        <Switch
          value={cashDrawerToggle}
          onValueChange={saveToggleState}
          trackColor={{ false: theme.inactive, true: theme.success }}
          thumbColor="#fff"
          style={styles.cashDrawerSwitch}
        />
        <Text style={[styles.cashDrawerText, { color: cashDrawerToggle ? '#fff' : theme.text }]}>
          Cash Drawer Logs
        </Text>
      </View>
    </TouchableOpacity>
  )}

          {/* Tab Switcher */}
{/* Tab Switcher */}
{/* Tab Switcher */}
<View style={[styles.tabContainer, { borderBottomColor: theme.border }]}>
  <TouchableOpacity
    style={[styles.tab, activeTab === 'overview' && styles.activeTab, activeTab === 'overview' && { borderBottomColor: theme.primary }]}
    onPress={() => setActiveTab('overview')}
  >
    <Text style={[styles.tabText, { color: activeTab === 'overview' ? theme.primary : theme.textSecondary }]}>
      📊 Overview
    </Text>
  </TouchableOpacity>
  <TouchableOpacity
    style={[styles.tab, activeTab === 'categories' && styles.activeTab, activeTab === 'categories' && { borderBottomColor: theme.primary }]}
    onPress={() => setActiveTab('categories')}
  >
    <Text style={[styles.tabText, { color: activeTab === 'categories' ? theme.primary : theme.textSecondary }]}>
      🏷️ Categories
    </Text>
  </TouchableOpacity>
</View>

{/* ✅ STATUS TABS - For Overview tab */}
{activeTab === 'overview' && (
  <View style={[styles.statusTabContainer, { borderBottomColor: theme.border }]}>
    <TouchableOpacity
      style={[styles.statusTab, !showVoidedTab && styles.activeStatusTab, !showVoidedTab && { borderBottomColor: theme.success }]}
      onPress={() => setShowVoidedTab(false)}
    >
      <Text style={[styles.statusTabText, { color: !showVoidedTab ? theme.success : theme.textSecondary }]}>
        ✅ Completed ({salesHistory.length})
      </Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.statusTab, showVoidedTab && styles.activeStatusTab, showVoidedTab && { borderBottomColor: theme.danger }]}
      onPress={() => setShowVoidedTab(true)}
    >
      <Text style={[styles.statusTabText, { color: showVoidedTab ? theme.danger : theme.textSecondary }]}>
        🚫 Voided ({voidedSales.length})
      </Text>
    </TouchableOpacity>
  </View>
)}

{/* ✅ STATUS TABS - For Categories tab - ADD THIS */}
{activeTab === 'categories' && (
  <View style={[styles.statusTabContainer, { borderBottomColor: theme.border }]}>
    <TouchableOpacity
      style={[styles.statusTab, !showVoidedCategoriesTab && styles.activeStatusTab, !showVoidedCategoriesTab && { borderBottomColor: theme.success }]}
      onPress={() => setShowVoidedCategoriesTab(false)}
    >
      <Text style={[styles.statusTabText, { color: !showVoidedCategoriesTab ? theme.success : theme.textSecondary }]}>
        ✅ Completed ({categorySummary.totalTransactions})
      </Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.statusTab, showVoidedCategoriesTab && styles.activeStatusTab, showVoidedCategoriesTab && { borderBottomColor: theme.danger }]}
      onPress={() => setShowVoidedCategoriesTab(true)}
    >
      <Text style={[styles.statusTabText, { color: showVoidedCategoriesTab ? theme.danger : theme.textSecondary }]}>
        🚫 Voided (0)
      </Text>
    </TouchableOpacity>
  </View>
)}

{activeTab === 'categories' && (
  <TouchableOpacity
    style={[styles.printButton, { backgroundColor: theme.primary }]}
    onPress={printReport}
  >
    <Ionicons name="print" size={20} color="#fff" />
    <Text style={styles.printButtonText}>Print Report</Text>
  </TouchableOpacity>
)}
{/* Filter Section */}
<View style={styles.filterContainer}>
  {['Today', 'Week', 'Month', 'Custom'].map(filter => (
    <TouchableOpacity
      key={filter}
      style={[
        styles.filterBtn,
        { 
          backgroundColor: selectedFilter === filterMap[filter] ? theme.primary : theme.surface,
          borderColor: theme.border 
        }
      ]}
      onPress={() => handleFilterChange(filter)}
    >
      <Text style={[
        styles.filterBtnText,
        { color: selectedFilter === filterMap[filter] ? '#fff' : theme.text }
      ]}>
        {filter}  
      </Text>
    </TouchableOpacity>
  ))}
</View>
          {/* Custom Date Picker */}
          {(selectedFilter === 'custom' || selectedFilter === 'Custom') && (
            <View style={[styles.customDateContainer, { backgroundColor: theme.surface }]}>
              <View style={styles.datePickerRow}>
                <Text style={[styles.dateLabel, { color: theme.text }]}>{t.startDate}</Text>
                <TouchableOpacity 
                  style={[styles.dateButton, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={openStartPicker}
                >
                  <Text style={[styles.dateButtonText, { color: theme.text }]}>
                    {startDate.toLocaleDateString()}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.datePickerRow}>
                <Text style={[styles.dateLabel, { color: theme.text }]}>{t.endDate}</Text>
                <TouchableOpacity 
                  style={[styles.dateButton, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={openEndPicker}
                >
                  <Text style={[styles.dateButtonText, { color: theme.text }]}>
                    {endDate.toLocaleDateString()}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={[styles.applyButton, { backgroundColor: theme.secondary }]}
                onPress={onApplyCustomFilter}
              >
                <Text style={styles.applyButtonText}>{t.applyFilter}</Text>
              </TouchableOpacity>
            </View>
          )}

          {showPicker && (
            <DateTimePicker
              value={tempDate}
              mode="date"
              display="default"
              onChange={onDateChange}
            />
          )}

          <ScrollView 
            style={styles.contentScrollView}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={true}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
              </View>
            ) : (
              <>
                {activeTab === 'overview' ? (
                  /* ===== OVERVIEW TAB ===== */
                  <>
                    {/* Main Summary Cards */}
                    <View style={styles.summaryContainer}>
                      <View style={[styles.summaryCard, { backgroundColor: theme.surface }]}>
                        <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{t.totalSales}</Text>
                        <Text style={[styles.summaryValue, { color: theme.text }]}>{summary.totalSales}</Text>
                      </View>
                      <View style={[styles.summaryCard, { backgroundColor: theme.surface }]}>
                        <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{t.totalItems_report}</Text>
                        <Text style={[styles.summaryValue, { color: theme.text }]}>{summary.totalItems}</Text>
                      </View>
                      <View style={[styles.summaryCard, styles.summaryCardHighlight, { backgroundColor: theme.primary }]}>
                        <Text style={styles.summaryLabel}>Revenue</Text>   
                        <Text style={styles.summaryValueHighlight}>
                          {formatPrice(summary.totalRevenue)}
                        </Text>
                      </View>
                    </View>

                    {/* ✅ DISCOUNT SUMMARY CARDS */}
                    {summary.totalDiscount > 0 && (
                      <View style={styles.discountSummaryContainer}>
                        <View style={[styles.discountCard, { backgroundColor: theme.surface }]}>
                          <Text style={[styles.discountLabel, { color: theme.textSecondary }]}>Total Discount</Text>
                          <Text style={[styles.discountValue, { color: theme.danger }]}>
                            -{formatPrice(summary.totalDiscount)}
                          </Text>
                        </View>
                        <View style={[styles.discountCard, { backgroundColor: theme.surface }]}>
                          <Text style={[styles.discountLabel, { color: theme.textSecondary }]}>Discounted Sales</Text>
                          <Text style={[styles.discountValue, { color: theme.warning }]}>
                            {summary.discountedSales} / {summary.totalSales}
                          </Text>
                          <Text style={[styles.discountPercent, { color: theme.textSecondary }]}>
                            ({discountPercentage}%)
                          </Text>
                        </View>
                      </View>
                    )}

                    <View style={[styles.paymentBreakdownContainer, { backgroundColor: theme.surface }]}>
                      <Text style={[styles.breakdownTitle, { color: theme.text }]}>{t.paymentMethods}</Text>
                      {Object.entries(summary.paymentBreakdown).map(([method, amount], index) => (
                        <View key={`breakdown-${method}-${index}`} style={[styles.breakdownRow, { borderBottomColor: theme.border }]}>
                          <Text style={[styles.breakdownMethod, { color: theme.textSecondary }]}>{method}</Text>
                          <Text style={[styles.breakdownAmount, { color: theme.primary }]}>
                            {formatPrice(amount as number)}
                          </Text>
                        </View>
                      ))}
                    </View>

<Text style={[styles.salesListTitle, { color: theme.text }]}>
  {showVoidedTab ? '🚫 Voided Transactions' : t.transactionHistory}
</Text>

{/* ✅ Show appropriate list based on tab */}
{(showVoidedTab ? voidedSales : salesHistory).map((sale, index) => (
  <TouchableOpacity
    key={`sale-${sale.id}-${index}`}
    onLongPress={() => {
      // Only allow void for completed sales (not voided ones)
      if (!showVoidedTab && sale.status !== 'VOIDED') {
        setSelectedSale(sale);
        setShowVoidModal(true);
      }
    }}
    delayLongPress={500}
    activeOpacity={0.7}
  >
    <View style={[
      styles.saleItem, 
      { 
        backgroundColor: theme.card, 
        borderColor: theme.border,
        opacity: showVoidedTab ? 0.7 : 1,
        borderLeftWidth: 4,
        borderLeftColor: showVoidedTab ? theme.danger : theme.success
      }
    ]}>
      <View style={styles.saleHeader}>
        <View style={styles.saleHeaderLeft}>
           <Text style={[styles.invoiceNumber, { color: theme.primary, fontWeight: '700' }]}>
                        📄 {sale.invoiceNumber || 'No Invoice'}
                    </Text>
          <Text style={[styles.saleDate, { color: theme.textSecondary }]}>
            {new Date(sale.date).toLocaleDateString()}
          </Text>
          <Text style={[styles.saleTime, { color: theme.textSecondary }]}>
            {new Date(sale.date).toLocaleTimeString()}
          </Text>
        </View>
        
        {/* ✅ Show different badges for completed vs voided */}
        {showVoidedTab ? (
          <View style={[styles.voidBadge, { backgroundColor: theme.danger + '20' }]}>
            <Text style={[styles.voidBadgeText, { color: theme.danger }]}>
              VOIDED
            </Text>
          </View>
        ) : (
          <View style={[styles.paymentBadge, { backgroundColor: theme.success + '20' }]}>
            <Text style={[styles.paymentBadgeText, { color: theme.success }]}>
              {sale.paymentMethod}
            </Text>
          </View>
        )}
      </View>
      
      {/* ✅ Show void reason if voided */}
      {showVoidedTab && sale.voidReason && (
        <Text style={[styles.voidReasonText, { color: theme.danger }]}>
          Reason: {sale.voidReason}
        </Text>
      )}
      
      {/* ✅ Display discount badge (only for completed transactions) */}
      {!showVoidedTab && sale.discount && sale.discount.amount > 0 && (
        <View style={[styles.transactionDiscountBadge, { backgroundColor: theme.danger + '20' }]}>
          <Text style={[styles.transactionDiscountText, { color: theme.danger }]}>
            🏷️ {sale.discount.type === 'percentage' ? `${sale.discount.value}% OFF` : `$${sale.discount.value} OFF`}
            (-{formatPrice(sale.discount.amount)})
          </Text>
        </View>
      )}
      
      <View style={styles.saleItemsContainer}>
        {sale.items?.map((item: any, idx: number) => (
          <View key={`item-${sale.id}-${idx}`} style={styles.saleItemRow}>
            <View style={styles.saleItemLeft}>
              <Text style={[styles.saleItemName, { color: theme.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.saleItemQuantity, { color: theme.textSecondary }]}>
                x{item.quantity}
              </Text>
            </View>
            <Text style={[styles.saleItemPrice, { color: showVoidedTab ? theme.textSecondary : theme.primary }]}>
              {formatPrice(item.price * item.quantity)}
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.saleTotalContainer, { borderTopColor: theme.border }]}>
        <Text style={[styles.saleTotalLabel, { color: theme.text }]}>Total:</Text>
        <Text style={[
          styles.saleTotalValue, 
          { color: showVoidedTab ? theme.textSecondary : theme.primary }
        ]}>
          {formatPrice(sale.total)}
        </Text>
      </View>
      
      {/* ✅ Show who voided and when */}
      {showVoidedTab && sale.voidedAt && (
        <Text style={[styles.voidedByText, { color: theme.textSecondary }]}>
          Voided: {new Date(sale.voidedAt).toLocaleString()}
        </Text>
      )}
    </View>
  </TouchableOpacity>
))}

{/* ✅ Show empty state */}
{(showVoidedTab ? voidedSales : salesHistory).length === 0 && (
  <View style={styles.noSalesContainer}>
    <Text style={[styles.noSalesText, { color: theme.textSecondary }]}>
      {showVoidedTab ? 'No voided transactions' : t.noSales}
    </Text>
  </View>
)}
                    {salesHistory.length === 0 && (
                      <View style={styles.noSalesContainer}>
                        <Text style={[styles.noSalesText, { color: theme.textSecondary }]}>{t.noSales}</Text>
                      </View>
                    )}
                  </>
                ) : (
                  /* ===== CATEGORIES TAB ===== */
                  <>
                    {/* Category Summary Cards */}
                    <View style={styles.summaryContainer}>
                      <View style={[styles.summaryCard, { backgroundColor: theme.surface }]}>
                        <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Categories</Text>
                        <Text style={[styles.summaryValue, { color: theme.text }]}>{categorySummary.totalCategories}</Text>
                      </View>
                      <View style={[styles.summaryCard, { backgroundColor: theme.surface }]}>
                        <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Total Items</Text>
                        <Text style={[styles.summaryValue, { color: theme.text }]}>{categorySummary.totalItems}</Text>
                      </View>
                      <View style={[styles.summaryCard, styles.summaryCardHighlight, { backgroundColor: theme.primary }]}>
                        <Text style={styles.summaryLabel}>Revenue</Text>   
                        <Text style={styles.summaryValueHighlight}>
                          {formatPrice(categorySummary.totalRevenue)}
                        </Text>
                      </View>
                    </View>

                    {/* ✅ Category Discount Summary */}
                    {categorySummary.totalDiscount > 0 && (
                      <View style={styles.discountSummaryContainer}>
                        <View style={[styles.discountCard, { backgroundColor: theme.surface }]}>
                          <Text style={[styles.discountLabel, { color: theme.textSecondary }]}>Category Discount</Text>
                          <Text style={[styles.discountValue, { color: theme.danger }]}>
                            -{formatPrice(categorySummary.totalDiscount)}
                          </Text>
                        </View>
                        <View style={[styles.discountCard, { backgroundColor: theme.surface }]}>
                          <Text style={[styles.discountLabel, { color: theme.textSecondary }]}>Discounted Trans.</Text>
                          <Text style={[styles.discountValue, { color: theme.warning }]}>
                            {categorySummary.discountedTransactions} / {categorySummary.totalTransactions}
                          </Text>
                        </View>
                      </View>
                    )}

                    {loading && (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={theme.primary} />
                        <Text style={{ color: theme.textSecondary, marginTop: 10 }}>Loading categories...</Text>
                      </View>
                    )}

                    {!loading && !selectedCategory ? (
                      categories.length > 0 ? (
                        categories.map((cat, index) => (
                          <TouchableOpacity
                            key={`cat-${index}`}
                            style={[styles.categoryCard, { backgroundColor: theme.card }]}
                            onPress={() => loadCategoryItems(cat.name)}
                          >
                            <View style={styles.categoryHeader}>
                              <Text style={[styles.categoryName, { color: theme.text }]}>
                                {cat.name}
                              </Text>
                              <View style={[styles.categoryBadge, { backgroundColor: theme.primary }]}>
                                <Text style={styles.categoryBadgeText}>{cat.itemCount || cat.items || 0} items</Text>
                              </View>
                            </View>
                            
                            <View style={styles.categoryStats}>
                              <View style={styles.statItem}>
                                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Revenue</Text>
                                <Text style={[styles.statValue, { color: theme.primary }]}>
                                  {formatPrice(cat.totalRevenue || cat.revenue || 0)}
                                </Text>
                              </View>
                              <View style={styles.statItem}>
                                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Sold</Text>
                                <Text style={[styles.statValue, { color: theme.text }]}>
                                  {cat.totalQuantity || cat.quantity || 0} pcs
                                </Text>
                              </View>
                              {cat.discountAmount > 0 && (
                                <View style={styles.statItem}>
                                  <Text style={[styles.statLabel, { color: theme.danger }]}>Discount</Text>
                                  <Text style={[styles.statValue, { color: theme.danger }]}>
                                    -{formatPrice(cat.discountAmount)}
                                  </Text>
                                </View>
                              )}
                            </View>

                            {cat.items && cat.items.length > 0 && (
                              <View style={styles.itemPreview}>
                                {cat.items.slice(0, 2).map((item: any, idx: number) => (
                                  <Text key={`preview-${idx}`} style={[styles.previewText, { color: theme.textSecondary }]}>
                                    • {item.name} ({item.quantity}x) {item.discountAmount > 0 ? `(-${formatPrice(item.discountAmount)})` : ''}
                                  </Text>
                                ))}
                                {cat.items.length > 2 && (
                                  <Text style={[styles.previewText, { color: theme.textSecondary }]}>
                                    • +{cat.items.length - 2} more...
                                  </Text>
                                )}
                              </View>
                            )}
                          </TouchableOpacity>
                        ))
                      ) : (
                        <View style={styles.noSalesContainer}>
                          <Text style={[styles.noSalesText, { color: theme.textSecondary }]}>
                            No categories found for selected period
                          </Text>
                        </View>
                      )
                    ) : !loading && selectedCategory ? (
                      <View>
                        <TouchableOpacity
                          style={styles.backBtn}
                          onPress={() => {
                            setSelectedCategory(null);
                            setCategoryItems([]);
                            setCategoryTransactions([]);
                            setShowTransactions(false);
                          }}
                        >
                          <Text style={[styles.backBtnText, { color: theme.primary }]}>← Back to Categories</Text>
                        </TouchableOpacity>

                        <Text style={[styles.categoryTitle, { color: theme.text }]}>
                          {selectedCategory}
                        </Text>

                        <View style={styles.viewToggle}>
                          <TouchableOpacity
                            style={[
                              styles.toggleBtn,
                              !showTransactions && styles.toggleBtnActive,
                              !showTransactions && { backgroundColor: theme.primary }
                            ]}
                            onPress={() => setShowTransactions(false)}
                          >
                            <Text style={[
                              styles.toggleBtnText,
                              { color: !showTransactions ? '#fff' : theme.text }
                            ]}>
                              📦 Items ({categoryItems.length})
                            </Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity
                            style={[
                              styles.toggleBtn,
                              showTransactions && styles.toggleBtnActive,
                              showTransactions && { backgroundColor: theme.primary }
                            ]}
                            onPress={() => setShowTransactions(true)}
                          >
                            <Text style={[
                              styles.toggleBtnText,
                              { color: showTransactions ? '#fff' : theme.text }
                            ]}>
                              📋 Transactions ({categoryTransactions.length})
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {!showTransactions ? (
                          <>
                            {categoryItems.length > 0 && (
                              <View style={[styles.categorySummary, { backgroundColor: theme.surface }]}>
                                <View style={styles.categorySummaryRow}>
                                  <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Total Revenue:</Text>
                                  <Text style={[styles.summaryValue, { color: theme.primary }]}>
                                    {formatPrice(categoryItems.reduce((sum, item) => sum + (item.revenue || 0), 0))}
                                  </Text>
                                </View>
                                <View style={styles.categorySummaryRow}>
                                  <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Total Items:</Text>
                                  <Text style={[styles.summaryValue, { color: theme.text }]}>
                                    {categoryItems.reduce((sum, item) => sum + (item.quantity || 0), 0)} pcs
                                  </Text>
                                </View>
                                {categoryItems.reduce((sum, item) => sum + (item.discountAmount || 0), 0) > 0 && (
                                  <View style={styles.categorySummaryRow}>
                                    <Text style={[styles.summaryLabel, { color: theme.danger }]}>Total Discount:</Text>
                                    <Text style={[styles.summaryValue, { color: theme.danger }]}>
                                      -{formatPrice(categoryItems.reduce((sum, item) => sum + (item.discountAmount || 0), 0))}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            )}

                            {categoryItems.length > 0 ? (
                              categoryItems.map((item, index) => (
                                <View key={`cat-item-${index}`} style={[styles.categoryItemCard, { backgroundColor: theme.card }]}>
                                  <View style={styles.categoryItemHeader}>
                                    <Text style={[styles.categoryItemName, { color: theme.text }]}>
                                      {index + 1}. {item.name}
                                    </Text>
                                    {item.discountAmount > 0 && (
                                      <Text style={[styles.itemDiscountBadge, { color: theme.danger }]}>
                                        -{formatPrice(item.discountAmount)}
                                      </Text>
                                    )}
                                  </View>
                                  
                                  <View style={styles.categoryItemStats}>
                                    <View style={styles.categoryItemStat}>
                                      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Quantity</Text>
                                      <Text style={[styles.statValue, { color: theme.text }]}>{item.quantity || 0}</Text>
                                    </View>
                                    <View style={styles.categoryItemStat}>
                                      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Revenue</Text>
                                      <Text style={[styles.statValue, { color: theme.primary }]}>
                                        {formatPrice(item.revenue || 0)}
                                      </Text>
                                    </View>
                                  </View>
                                </View>
                              ))
                            ) : (
                              <View style={styles.noItemsContainer}>
                                <Text style={[styles.noItemsText, { color: theme.textSecondary }]}>
                                  No items sold in this category
                                </Text>
                              </View>
                            )}
                          </>
                        ) : (
                          <>
                            {categoryTransactions.length > 0 ? (
                              <>
                                <View style={[styles.categorySummary, { backgroundColor: theme.surface }]}>
                                  <View style={styles.categorySummaryRow}>
                                    <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Total Transactions:</Text>
                                    <Text style={[styles.summaryValue, { color: theme.primary }]}>
                                      {categoryTransactions.length}
                                    </Text>
                                  </View>
                                </View>

                                {Object.values(groupTransactionsBySale(categoryTransactions)).map((sale: any, index: number) => (
                                  <View key={`sale-${index}`} style={[styles.transactionCard, { backgroundColor: theme.card }]}>
                                    <View style={styles.transactionHeader}>
                                      <View>
                                         <Text style={[styles.transactionInvoice, { color: theme.primary, fontWeight: '600' }]}>
                    📄 {sale.invoiceNumber || 'No Invoice'}
                </Text>
                                        <Text style={[styles.transactionId, { color: theme.textSecondary }]}>
                                          #{sale.id}
                                        </Text>
                                        <Text style={[styles.transactionTime, { color: theme.textSecondary }]}>
                                          {formatDateTime(sale.date).date}
                                        </Text>
                                      </View>
                                      <Text style={[styles.transactionTotal, { color: theme.primary }]}>
                                        {formatPrice(sale.total)}
                                      </Text>
                                    </View>
                                    
                                    {sale.items.map((item: any, idx: number) => (
                                      <View key={`trans-item-${idx}`} style={styles.transactionItem}>
                                        <Text style={[styles.transactionItemName, { color: theme.text }]}>
                                          {item.name} x{item.quantity}
                                        </Text>
                                        <Text style={[styles.transactionItemPrice, { color: theme.primary }]}>
                                          {formatPrice(item.price * item.quantity)}
                                        </Text>
                                      </View>
                                    ))}
                                  </View>
                                ))}
                              </>
                            ) : (
                              <View style={styles.noItemsContainer}>
                                <Text style={[styles.noItemsText, { color: theme.textSecondary }]}>
                                  No transactions for this category
                                </Text>
                              </View>
                            )}
                          </>
                        )}
                      </View>
                    ) : null}
                  </>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
      
      {/* VOID MODAL */}
     {/* VOID MODAL */}
<Modal
  visible={showVoidModal}
  transparent={true}
  animationType="fade"
  onRequestClose={() => {
    setShowVoidModal(false);
    setVoidPassword('');
    setVoidReason('');
  }}
>
  <View style={styles.modalOverlay}>
    <View style={[styles.voidModalContent, { backgroundColor: theme.card }]}>
      <View style={styles.voidModalHeader}>
        <Text style={[styles.voidModalTitle, { color: theme.text }]}>
          ⚠️ Void Transaction
        </Text>
        <TouchableOpacity onPress={() => setShowVoidModal(false)}>
          <Ionicons name="close" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>
      
      {selectedSale && (
        <>
          <View style={[styles.voidSaleInfo, { backgroundColor: theme.surface }]}>
            {/* ✅ Show Outlet Name */}
            <Text style={[styles.voidInfoLabel, { color: theme.textSecondary }]}>
              Outlet:
            </Text>
            <Text style={[styles.voidInfoValue, { color: theme.text }]}>
              {outletInfo?.name || 'Current Outlet'}
            </Text>
            
            <Text style={[styles.voidInfoLabel, { color: theme.textSecondary, marginTop: 8 }]}>
              Transaction ID:
            </Text>
            <Text style={[styles.voidInfoValue, { color: theme.text }]}>
              #{selectedSale.id}
            </Text>
            
            <Text style={[styles.voidInfoLabel, { color: theme.textSecondary, marginTop: 8 }]}>
              Amount:
            </Text>
            <Text style={[styles.voidInfoValue, { color: theme.primary, fontWeight: '700' }]}>
              {formatPrice(selectedSale.total)}
            </Text>
            
            <Text style={[styles.voidInfoLabel, { color: theme.textSecondary, marginTop: 8 }]}>
              Date:
            </Text>
            <Text style={[styles.voidInfoValue, { color: theme.text }]}>
              {new Date(selectedSale.date).toLocaleString()}
            </Text>
          </View>
          
          {/* ✅ Password hint */}
          <Text style={[styles.passwordHint, { color: theme.textSecondary }]}>
            Enter the void password set by the outlet owner
          </Text>
          
          <Text style={[styles.voidWarning, { color: theme.danger }]}>
            ⚠️ This action cannot be undone!
          </Text>
          
          <Text style={[styles.modalLabel, { color: theme.text }]}>
            Reason (Optional):
          </Text>
          <TextInput
            style={[styles.modalInput, { 
              backgroundColor: theme.surface,
              color: theme.text,
              borderColor: theme.border
            }]}
            placeholder="Enter reason for void"
            placeholderTextColor={theme.textSecondary}
            value={voidReason}
            onChangeText={setVoidReason}
            multiline
            numberOfLines={2}
          />
          
          <Text style={[styles.modalLabel, { color: theme.text }]}>
            Void Password *
          </Text>
          <TextInput
            style={[styles.modalInput, { 
              backgroundColor: theme.surface,
              color: theme.text,
              borderColor: theme.border
            }]}
            placeholder="Enter void password"
            placeholderTextColor={theme.textSecondary}
            secureTextEntry
            value={voidPassword}
            onChangeText={setVoidPassword}
          />
          
          <View style={styles.voidModalButtons}>
            <TouchableOpacity
              style={[styles.voidModalBtn, styles.cancelBtn, { 
                borderColor: theme.border,
                backgroundColor: theme.surface
              }]}
              onPress={() => {
                setShowVoidModal(false);
                setVoidPassword('');
                setVoidReason('');
              }}
            >
              <Text style={[styles.cancelBtnText, { color: theme.text }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.voidModalBtn, styles.voidBtn, { 
                backgroundColor: theme.danger
              }]}
              onPress={handleVoidSale}
              disabled={voidLoading}
            >
              {voidLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.voidBtnText}>
                  Void Transaction
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  </View>
</Modal>
{/* Void Password Settings Modal */}
<VoidPasswordSettings
  visible={showVoidPasswordSettings}
  onClose={() => setShowVoidPasswordSettings(false)}
  outletId={outletInfo?.id || 0}
  outletName={outletInfo?.name || ''}
  theme={theme}
  t={t}
  userRole={userRole || ''}
/>
<CashDrawerLogs
  visible={showCashDrawerLogs}
  onClose={() => setShowCashDrawerLogs(false)}
  theme={theme}
  t={t}
  userRole={userRole || ''}
  outletId={outletInfo?.id}
/>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  container: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  containerMobile: {
    marginTop: 6,
  },
  printButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 12,
    marginVertical: 10,
  },
  printButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    minHeight: 60,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: 'auto',
  },
  closeButton: {
    padding: 8,
    minWidth: 44,
    alignItems: 'center',
  },
  closeText: {
    fontSize: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginHorizontal: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  filterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  filterBtn: {
    flex: 1,
    minWidth: 70,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 25,
    marginHorizontal: 3,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
  },
  filterBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
  customDateContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    marginHorizontal: 12,
  },
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dateLabel: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  dateButton: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    flex: 2,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  dateButtonText: {
    fontSize: 14,
  },
  applyButton: {
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 50,
    justifyContent: 'center',
  },
  applyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  contentScrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  summaryCard: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    minHeight: 80,
    justifyContent: 'center',
  },
  summaryCardHighlight: {
    backgroundColor: '#4CAF50',
  },
  summaryLabel: {
    fontSize: 13,
    marginBottom: 6,
    color: '#fff',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  summaryValueHighlight: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  // ✅ DISCOUNT SUMMARY STYLES
  discountSummaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  discountCard: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    minHeight: 80,
    justifyContent: 'center',
  },
  discountLabel: {
    fontSize: 13,
    marginBottom: 6,
  },
  discountValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  discountPercent: {
    fontSize: 11,
    marginTop: 2,
  },
  transactionDiscountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  transactionDiscountText: {
    fontSize: 11,
    fontWeight: '600',
  },
  itemDiscountBadge: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
  },
  paymentBreakdownContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    marginHorizontal: 12,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  breakdownMethod: {
    fontSize: 14,
  },
  breakdownAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  salesListTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginHorizontal: 12,
  },
  saleItem: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    marginHorizontal: 12,
  },
  saleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  saleHeaderLeft: {
    flex: 1,
  },
  saleDate: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  saleTime: {
    fontSize: 11,
  },
  paymentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  paymentBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  saleItemsContainer: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  saleItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  saleItemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  saleItemName: {
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  saleItemQuantity: {
    fontSize: 12,
    marginRight: 8,
    minWidth: 35,
  },
  saleItemPrice: {
    fontSize: 13,
    fontWeight: '600',
    minWidth: 60,
    textAlign: 'right',
  },
  saleTotalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    paddingHorizontal: 4,
  },
  saleTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  saleTotalValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  noSalesContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noSalesText: {
    fontSize: 15,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    marginHorizontal: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  categoryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemPreview: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  previewText: {
    fontSize: 11,
    marginBottom: 2,
  },
  backBtn: {
    padding: 12,
    marginBottom: 10,
    marginHorizontal: 12,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    marginHorizontal: 12,
  },
  categorySummary: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    marginHorizontal: 12,
  },
  categorySummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryItemCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    marginHorizontal: 12,
  },
  categoryItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryItemName: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  categoryItemStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  categoryItemStat: {
    alignItems: 'center',
  },
  noItemsContainer: {
    padding: 30,
    alignItems: 'center',
  },
  noItemsText: {
    fontSize: 14,
  },
  viewToggle: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginBottom: 16,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  toggleBtnActive: {
    backgroundColor: '#4A90E2',
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  transactionCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    marginHorizontal: 12,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  transactionId: {
    fontSize: 13,
    fontWeight: '600',
  },
  transactionTime: {
    fontSize: 11,
    marginTop: 2,
  },
  transactionTotal: {
    fontSize: 16,
    fontWeight: '700',
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  transactionItemName: {
    fontSize: 13,
    flex: 1,
  },
  transactionItemPrice: {
    fontSize: 13,
    fontWeight: '500',
  },
  // ✅ VOID MODAL STYLES
  voidModalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 20,
  },
  voidModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  voidModalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  voidSaleInfo: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  voidInfoLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  voidInfoValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  voidWarning: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,0,0,0.1)',
  },
  voidModalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  voidModalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  voidBtn: {
    elevation: 2,
  },
  voidBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    marginBottom: 16,
    minHeight: 48,
  },
  cancelBtn: {
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  passwordHint: {
  fontSize: 12,
  textAlign: 'center',
  marginBottom: 12,
  paddingHorizontal: 8,
  fontStyle: 'italic',
},transactionInvoice: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
    fontFamily: 'monospace',
},
// Add to styles object
invoiceNumber: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
    fontFamily: 'monospace',
},
// Add to styles object
statusTabContainer: {
  flexDirection: 'row',
  borderBottomWidth: 1,
  marginHorizontal: 12,
  marginTop: 8,
  marginBottom: 8,
},
statusTab: {
  flex: 1,
  paddingVertical: 10,
  alignItems: 'center',
},
activeStatusTab: {
  borderBottomWidth: 2,
},
statusTabText: {
  fontSize: 13,
  fontWeight: '600',
},
// Add to styles object
voidPasswordBtn: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderRadius: 8,
  marginRight: 8,
},
voidPasswordBtnText: {
  color: '#fff',
  fontSize: 11,
  fontWeight: '600',
},
// Add to styles object
voidBadge: {
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: 12,
},
voidBadgeText: {
  fontSize: 11,
  fontWeight: '700',
},
voidReasonText: {
  fontSize: 11,
  marginBottom: 8,
  fontStyle: 'italic',
  paddingHorizontal: 4,
},
// Add to styles object
cashDrawerBtn: {
  paddingHorizontal: 1,
  paddingVertical: 1,
  borderRadius: 10,
},
cashDrawerToggleContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 1,
},
cashDrawerSwitch: {
  transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }],
},
cashDrawerText: {
  fontSize: 11,
  fontWeight: '600',
},
voidedByText: {
  fontSize: 10,
  marginTop: 6,
  paddingTop: 4,
  borderTopWidth: 1,
  borderTopColor: 'rgba(0,0,0,0.05)',
  fontStyle: 'italic',
},
});

export default React.memo(POSSalesReport);