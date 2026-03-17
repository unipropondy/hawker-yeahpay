// components/POSSalesReport.tsx - FINAL OPTIMIZED VERSION
import React, { useState, useEffect, useCallback, useRef, } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Alert,  } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import API from '../api';
import UniversalPrinter from './UniversalPrinter';  
import { Ionicons } from '@expo/vector-icons';
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
  companySettings,  // ✅ Add this
  userId,  
}) => {
  // ============ REFS ============
  const isMounted = useRef(true);
  const loadingRef = useRef(false);
  const initialLoadDone = useRef(false);
  const prevFilterRef = useRef(selectedFilter);
  const prevStartRef = useRef(startDate);
  const prevEndRef = useRef(endDate);
  
  const loadTimerRef = useRef<NodeJS.Timeout | null>(null);
  // ✅ Define filterMap HERE (inside component)
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
  const [summary, setSummary] = useState({
    totalSales: 0,
    totalRevenue: 0,
    totalItems: 0,
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
  // ============ LOAD FUNCTIONS ============
  const loadOverviewData = useCallback(async () => {
    if (loadingRef.current) return;
    
    loadingRef.current = true;
    if (isMounted.current) setLoading(true);

    try {
      const filterValue = selectedFilter?.toLowerCase() || 'today';
      
      let summaryUrl = '/sales/summary';
      let salesUrl = '/sales';
      
      if (filterValue === 'custom') {
        const start = startDate.toISOString().split('T')[0];
        const end = endDate.toISOString().split('T')[0];
        summaryUrl += `?filter=custom&startDate=${start}&endDate=${end}`;
        salesUrl += `?filter=custom&startDate=${start}&endDate=${end}`;
      } else {
        summaryUrl += `?filter=${filterValue}`;
        salesUrl += `?filter=${filterValue}`;
      }
      
      console.log(`📊 Loading data with filter: ${filterValue}`);
      
      const [summaryRes, salesRes] = await Promise.all([
        API.get(summaryUrl),
        API.get(salesUrl)
      ]);
      
      if (isMounted.current) {
        setSummary(summaryRes.data);
        setSalesHistory(salesRes.data);
      }
      
    } catch (error) {
      console.log('❌ Error loading data:', error);
    } finally {
      loadingRef.current = false;
      if (isMounted.current) setLoading(false);
    }
  }, [selectedFilter, startDate, endDate]);

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
    
    // 🔥 PARALLEL API CALLS - Get categories AND payment breakdown
    let categoryUrl = '/sales/by-category';
    const categoryParams = new URLSearchParams();
    categoryParams.append('filter', filterValue);
    
    let paymentUrl = '/sales/summary';
    const paymentParams = new URLSearchParams();
    paymentParams.append('filter', filterValue);
    
    if (filterValue === 'custom') {
      const start = startDate.toISOString().split('T')[0];
      const end = endDate.toISOString().split('T')[0];
      
      categoryParams.append('startDate', start);
      categoryParams.append('endDate', end);
      
      paymentParams.append('startDate', start);
      paymentParams.append('endDate', end);
    }
    
    console.log(`📊 Loading categories with filter: ${filterValue}`);
    console.log(`📊 Loading payment breakdown with filter: ${filterValue}`);
    
    // 🔥 Call both APIs simultaneously
    const [categoryResponse, paymentResponse] = await Promise.all([
      API.get(`${categoryUrl}?${categoryParams.toString()}`),
      API.get(`${paymentUrl}?${paymentParams.toString()}`)
    ]);
    
    if (isMounted.current) {
      // Set categories
      if (categoryResponse.data.success) {
        setCategories(categoryResponse.data.categories || []);
        
        // ✅ Set category summary WITH payment breakdown
        setCategorySummary({
          totalRevenue: categoryResponse.data.summary?.totalRevenue || 0,
          totalTransactions: categoryResponse.data.summary?.totalTransactions || 0,
          totalCategories: categoryResponse.data.summary?.totalCategories || 0,
          totalItems: categoryResponse.data.summary?.totalItems || 0,
          paymentBreakdown: paymentResponse.data.paymentBreakdown || {} // ✅ ADD THIS
        });
        
        console.log('✅ Category Summary with Payment:', {
          totalRevenue: categoryResponse.data.summary?.totalRevenue,
          totalItems: categoryResponse.data.summary?.totalItems,
          paymentBreakdown: paymentResponse.data.paymentBreakdown
        });
      }
    }
    
  } catch (error) {
    console.log('❌ Error loading categories:', error);
  } finally {
    loadingRef.current = false;
    if (isMounted.current) setLoading(false);
  }
}, [selectedFilter, startDate, endDate]);
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
      
      let url = `/sales/category/${encodeURIComponent(category)}`;
      const params = new URLSearchParams();
      params.append('filter', filterValue);
      
      if (filterValue === 'custom') {
        params.append('startDate', startDate.toISOString().split('T')[0]);
        params.append('endDate', endDate.toISOString().split('T')[0]);
      }
      
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
  }, [selectedFilter, startDate, endDate]);

  // ============ MAIN EFFECT ============
useEffect(() => {
  if (!visible) {
    // Reset on close
    initialLoadDone.current = false;
    prevFilterRef.current = selectedFilter;
    prevStartRef.current = startDate;
    prevEndRef.current = endDate;
    prevTabRef.current = activeTab;  // ✅ Add tab ref
    return;
  }

  // Initial load - ONCE
  if (!initialLoadDone.current) {
    console.log('📊 First time load');
    initialLoadDone.current = true;
    
    if (activeTab === 'overview') {
      loadOverviewData();
    } else {
      loadCategoryData();
    }
    
    // Update refs
    prevFilterRef.current = selectedFilter;
    prevStartRef.current = startDate;
    prevEndRef.current = endDate;
    prevTabRef.current = activeTab;  // ✅ Add tab ref
    return;
  }

  // ✅ Check for tab change
  const tabChanged = prevTabRef.current !== activeTab;
  
  // Check if values actually changed
  const filterChanged = prevFilterRef.current !== selectedFilter;
  const startChanged = prevStartRef.current.getTime() !== startDate.getTime();
  const endChanged = prevEndRef.current.getTime() !== endDate.getTime();
  
  // ✅ Include tabChanged in condition
  if (tabChanged || filterChanged || startChanged || endChanged) {
    console.log('📊 Change detected:', { tabChanged, filterChanged, startChanged, endChanged });
    
    if (activeTab === 'overview') {
      loadOverviewData();
    } else {
      loadCategoryData();
    }
    
    // Update refs
    prevFilterRef.current = selectedFilter;
    prevStartRef.current = startDate;
    prevEndRef.current = endDate;
    prevTabRef.current = activeTab;  // ✅ Update tab ref
  }
  
}, [visible, selectedFilter, startDate, endDate, activeTab]);

  // ============ HANDLERS ============
 const handleFilterChange = (filter: string) => {
  const filterMap: {[key: string]: string} = {
    'Today': 'today',
    'Week': 'week',
    'Month': 'month',
    'Custom': 'custom'
  };
  
  const backendFilter = filterMap[filter] || filter.toLowerCase();
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
// In POSSalesReport.tsx - Update print function

// In POSSalesReport.tsx - Replace the printReport function with this

const printReport = async () => {
  try {
    if (activeTab === 'categories') {
      console.log('📊 Printing Category Report with:', {
        filter: selectedFilter,
        categorySummary,
        categoriesCount: categories.length,
        selectedCategory
      });

      if (selectedCategory) {
        // 📦 Specific category with items
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
              paymentBreakdown: categorySummary.paymentBreakdown
            }
          }
        );
      } else {
        // 📁 All categories overview
        // Get payment breakdown for current filter
        let paymentBreakdown = categorySummary.paymentBreakdown;
        
        // If payment breakdown is empty, fetch it
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
              paymentBreakdown: paymentBreakdown
            }
          }
        );
      }
      
      Alert.alert('✅ Success', 'Category report printed');
      
    } else {
      // 📊 Overview tab print
      const reportData = {
        summary: {
          totalSales: summary.totalSales,
          totalItems: summary.totalItems,
          totalRevenue: summary.totalRevenue
        },
        paymentBreakdown: summary.paymentBreakdown,
        salesHistory: salesHistory,
        period: selectedFilter === 'custom' 
          ? `${formatDate(startDate)} to ${formatDate(endDate)}`
          : selectedFilter
      };

      await UniversalPrinter.printSalesReport(
        reportData,
        userId,
        t
      );
      
      Alert.alert('✅ Success', 'Sales report printed');
    }
  } catch (error) {
    console.log('❌ Print error:', error);
    Alert.alert('❌ Error', 'Failed to print report');
  }
};
const getPaymentBreakdownForFilter = async (filter: string) => {
  try {
    // You need to fetch payment breakdown for the current filter
    // This could be stored in state or fetched from API
    if (filter === 'week') {
      // Return week's payment breakdown
      return await fetchPaymentBreakdown('week');
    }
    return summary.paymentBreakdown; // Default
  } catch (error) {
    console.log('Error fetching payment breakdown:', error);
    return {};
  }
};
// Helper to fetch payment breakdown
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

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

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
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.title, { color: theme.text }]}>{t.salesReport}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={[styles.closeText, { color: theme.text }]}>✕</Text>
            </TouchableOpacity>
          </View>

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

                    <Text style={[styles.salesListTitle, { color: theme.text }]}>{t.transactionHistory}</Text>
                    {salesHistory.map((sale, index) => (
                      <View key={`sale-${sale.id}-${index}`} style={[styles.saleItem, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <View style={styles.saleHeader}>
                          <View style={styles.saleHeaderLeft}>
                            <Text style={[styles.saleDate, { color: theme.textSecondary }]}>
                              {new Date(sale.date).toLocaleDateString()}
                            </Text>
                            <Text style={[styles.saleTime, { color: theme.textSecondary }]}>
                              {new Date(sale.date).toLocaleTimeString()}
                            </Text>
                          </View>
                          <View style={[styles.paymentBadge, { backgroundColor: theme.success + '20' }]}>
                            <Text style={[styles.paymentBadgeText, { color: theme.success }]}>
                              {sale.paymentMethod}
                            </Text>
                          </View>
                        </View>
                        
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
                              <Text style={[styles.saleItemPrice, { color: theme.primary }]}>
                                {formatPrice(item.price * item.quantity)}
                              </Text>
                            </View>
                          ))}
                        </View>

                        <View style={[styles.saleTotalContainer, { borderTopColor: theme.border }]}>
                          <Text style={[styles.saleTotalLabel, { color: theme.text }]}>{t.total}:</Text>
                          <Text style={[styles.saleTotalValue, { color: theme.primary }]}>
                            {formatPrice(sale.total)}
                          </Text>
                        </View>
                      </View>
                    ))}

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

                    {/* ✅ LOADING INDICATOR */}
                    {loading && (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={theme.primary} />
                        <Text style={{ color: theme.textSecondary, marginTop: 10 }}>
                          Loading categories...
                        </Text>
                      </View>
                    )}

                    {!loading && !selectedCategory ? (
                      /* 📁 CATEGORIES LIST */
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
                            </View>

                            {/* Preview of top items */}
                            {cat.items && cat.items.length > 0 && (
                              <View style={styles.itemPreview}>
                                {cat.items.slice(0, 2).map((item: any, idx: number) => (
                                  <Text key={`preview-${idx}`} style={[styles.previewText, { color: theme.textSecondary }]}>
                                    • {item.name} ({item.quantity}x)
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
                      /* 📦 SELECTED CATEGORY VIEW */
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

                        {/* View Toggle */}
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
                          /* === ITEMS VIEW === */
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
                              </View>
                            )}

                            {categoryItems.length > 0 ? (
                              categoryItems.map((item, index) => (
                                <View key={`cat-item-${index}`} style={[styles.categoryItemCard, { backgroundColor: theme.card }]}>
                                  <View style={styles.categoryItemHeader}>
                                    <Text style={[styles.categoryItemName, { color: theme.text }]}>
                                      {index + 1}. {item.name}
                                    </Text>
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
                          /* === TRANSACTIONS VIEW === */
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
  
  // Category styles
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
  
  // Transaction styles
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
});

export default React.memo(POSSalesReport);