// src/screens/PosScreen.tsx
import React, { useState, useMemo, useEffect, useCallback,useRef } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform,useWindowDimensions, StatusBar, View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, Dimensions } from 'react-native';
import { Entypo } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker'
import UPIQRPayment from '../components/UPIQRPayment';
import UPISettings from '../components/UPISettings';
import PayNowQRPayment from '../components/PayNowQRPayment';
import { Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Printer from 'react-native-printer';
import { useDataLoader } from '../hooks/useDataLoader';
import API, { uploadAPI } from '../api';
import { useLicenseCheck } from '../hooks/useLicenseCheck';
import DayEndModal from '../components/DayEndModal';
// At the top with other imports
import DiscountInput from '../components/DiscountInput';
 // ✅ Correct path
 import { handleApiError, showSuccess } from '../utils/errorHandler';
import { DishGroupManagement } from '../components/DishGroupManagement';
import { DishItemsManagement } from '../components/DishItemsManagement';
import { useLicenseTimer } from '../hooks/useLicenseTimer';
import BillPrompt from '../components/BillPrompt';
import UniversalPrinter from '../components/UniversalPrinter';
import CompanySettingsForm from '../components/CompanySettingsForm';
import POSSalesReport from '../components/POSSalesReport';
import PayModeSettings from '../components/PayModeSettings';
import BillPDFGenerator from '../components/BillPDFGenerator';  // ✅ ADD THIS
import { useCurrency } from '../context/CurrencyContext'; 
import CashDrawerLogs from '../components/CashDrawerLogs';
// Add these missing imports at the top with your other imports
import {
  TextInput,
  ActivityIndicator,
} from 'react-native';
// Import components
import { MenuGrid } from '../components/MenuGrid';
import { CartSection } from '../components/CartSection';
import { ProfileModal } from '../components/ProfileModal';
// At the top with other imports
import { OutletSelector } from '../components/OutletSelector';
// Import constants and utils
import { themes } from '../utils/themes';
import { translations, dishNameTranslations } from '../utils/translations';
import { processYeahPayCardPayment, processYeahPayPayNowPayment } from '../../services/yeahpayservice';
import { MenuItem } from '../types';
// Add this to track all API calls
interface PaymentMode {
  id: string;
  name: string;
  icon: string;
  description: string;
  isActive: boolean;
  order: number;
}
// SAFE PARSE HELPER - Use this EVERYWHERE
const safeJSONParse = (data: any): any => {
  if (!data) return null;
  if (typeof data !== 'string') return data;
  try {
    return JSON.parse(data);
  } catch (e) {
    console.log('Parse error, returning original:', data);
    return data;
  }
};
const { width } = Dimensions.get('window');

export default function PosScreen() {
  const { theme: savedTheme, language: savedLanguage, setTheme: setSettingsTheme, setLanguage: setSettingsLanguage, companySettings } = useSettings();
    const { formatPrice, loadCurrencyFromSettings, refreshCurrency  } = useCurrency();  
  
  const insets = useSafeAreaInsets();
    useLicenseCheck();
  const { user , outlets, 
  showOutletSelector, 
  setShowOutletSelector,login,
  selectOutlet , logout,  setAvailableOutlets } = useAuth();
  const isOwner = user?.role === 'owner';
const isStaff = user?.role === 'staff';

const [showUPISettings, setShowUPISettings] = useState(false); 
  const validLanguage = savedLanguage && translations[savedLanguage] ? savedLanguage : 'en';
  const [formActive, setFormActive] = useState(true);  // ✅ This is missing!
const [loading, setLoading] = useState(false);   
  const [menuRefreshKey, setMenuRefreshKey] = useState(0);
  const [theme, setTheme] = useState<string>(savedTheme || 'light');
  const [language, setLanguage] = useState<string>(validLanguage);
  const [prevLanguage, setPrevLanguage] = useState<string>('en');
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [profileTab, setProfileTab] = useState<string>('theme');
  const [profileMode, setProfileMode] = useState<string>('full');
const hasCheckedDrawer = useRef<boolean>(false);
const { width, height } = useWindowDimensions();
const [selectedOutlet, setSelectedOutlet] = useState<any>(null);
const [outletInfo, setOutletInfo] = useState<any>(null);
// Add these state variables
const [discountEnabled, setDiscountEnabled] = useState(false);
const [showDiscountModal, setShowDiscountModal] = useState(false);
const [discountAmount, setDiscountAmount] = useState(0);
const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
const [discountValue, setDiscountValue] = useState(0);
const [discountedTotal, setDiscountedTotal] = useState<number | undefined>(undefined);
  const [showHomeMenu, setShowHomeMenu] = useState<boolean>(false);
  const [showDayEndModal, setShowDayEndModal] = useState(false);
  const [priceModal, setPriceModal] = useState({
  visible: false,
  item: null as any,
  price: ''
});
const [discountInfo, setDiscountInfo] = useState({
    applied: false,
    type: 'percentage' as 'percentage' | 'fixed',
    value: 0,
    amount: 0,
    originalTotal: 0,
    finalTotal: 0
});
 const [state, setState] = useState<any[]>([]); 
const { currencySymbol } = useCurrency();
const dataLoadedRef = useRef({
  initial: false,
  dishGroups: false,
  dishItems: false,
  paymentModes: false,
  upiId: false,
  payNow: false,
  currency: false
});
const currencyRefreshedRef = useRef(false);
const apiCallInProgress = useRef({
  dishGroups: false,
  dishItems: false,
  paymentModes: false,
  upiId: false,
  payNow: false,
  currency: false
});
const loadingRef = useRef(false);

useEffect(() => {
  if (!user?.id) return;
  
  // Skip if already loaded
  if (dataLoadedRef.current.initial) {
    console.log('⏭️ Data already loaded, skipping...');
    return;
  }
  
  const loadAllDataOnce = async () => {
    console.log('📦 Loading ALL data ONCE for user:', user.id);
    
    const promises = [];
    
    // Dish Groups
    if (!dataLoadedRef.current.dishGroups && !apiCallInProgress.current.dishGroups) {
      apiCallInProgress.current.dishGroups = true;
      promises.push(
        loadDishGroups().then(() => {
          dataLoadedRef.current.dishGroups = true;
          apiCallInProgress.current.dishGroups = false;
        })
      );
    }
    
    // Dish Items
    if (!dataLoadedRef.current.dishItems && !apiCallInProgress.current.dishItems) {
      apiCallInProgress.current.dishItems = true;
      promises.push(
        loadDishItems().then(() => {
          dataLoadedRef.current.dishItems = true;
          apiCallInProgress.current.dishItems = false;
        })
      );
    }
    
    // Payment Modes
    if (!dataLoadedRef.current.paymentModes && !apiCallInProgress.current.paymentModes) {
      apiCallInProgress.current.paymentModes = true;
      promises.push(
        loadPaymentModes().then(() => {
          dataLoadedRef.current.paymentModes = true;
          apiCallInProgress.current.paymentModes = false;
        })
      );
    }
    
    // UPI ID
    if (!dataLoadedRef.current.upiId && !apiCallInProgress.current.upiId) {
      apiCallInProgress.current.upiId = true;
      promises.push(
        loadUPIId().then(() => {
          dataLoadedRef.current.upiId = true;
          apiCallInProgress.current.upiId = false;
        })
      );
    }
    
    // PayNow QR
    if (!dataLoadedRef.current.payNow && !apiCallInProgress.current.payNow) {
      apiCallInProgress.current.payNow = true;
      promises.push(
        loadPayNowQR().then(() => {
          dataLoadedRef.current.payNow = true;
          apiCallInProgress.current.payNow = false;
        })
      );
    }
    
    // Currency
    if (!dataLoadedRef.current.currency && !apiCallInProgress.current.currency) {
      apiCallInProgress.current.currency = true;
      promises.push(
        refreshCurrency().then(() => {
          dataLoadedRef.current.currency = true;
          apiCallInProgress.current.currency = false;
        })
      );
    }
    
    await Promise.all(promises);
    dataLoadedRef.current.initial = true;
    console.log('✅ All data loaded in parallel!');
  };
  
  loadAllDataOnce();
  
}, [user?.id]); // Only depends on user.id
// In PosScreen.tsx - Add with other useRef

const settingsChecked = useRef(false);

const settingsLoading = useRef(false);

// ✅ Replace your existing checkLicense with this
const getGridColumns = () => {
  if (width < 480) return 2;    // Phone
  if (width < 768) return 3;    // Phablet
  if (width < 1024) return 4;   // Tablet
  return 5;                      // Desktop/POS
};

// Add this useEffect
const deviceType = useMemo(() => {
  if (width < 480) return 'phone';
  if (width < 768) return 'phablet';
  if (width < 1024) return 'tablet';
  return 'desktop';
}, [width]);

const orientation = width > height ? 'landscape' : 'portrait';

// Layout calculations
const layout = useMemo(() => {
  // Menu section width based on device
  let menuWidth = '70%';
  let cartWidth = '30%';
  let columns = 4; // Default grid columns
  
  if (deviceType === 'phone') {
    menuWidth = orientation === 'portrait' ? '100%' : '60%';
    cartWidth = orientation === 'portrait' ? '100%' : '40%';
    columns = orientation === 'portrait' ? 2 : 3;
  } else if (deviceType === 'phablet') {
    menuWidth = '65%';
    cartWidth = '35%';
    columns = 3;
  } else if (deviceType === 'tablet') {
    menuWidth = '70%';
    cartWidth = '30%';
    columns = 4;
  } else { // desktop
    menuWidth = '75%';
    cartWidth = '25%';
    columns = 5;
  }
  
  return { menuWidth, cartWidth, columns };
}, [deviceType, orientation]);

// Font sizes based on device
const fontSizes = useMemo(() => {
  if (deviceType === 'phone') {
    return {
      small: 10,
      regular: 12,
      medium: 14,
      large: 16,
      xlarge: 18,
      header: 16,
      title: 18
    };
  } else if (deviceType === 'tablet') {
    return {
      small: 12,
      regular: 14,
      medium: 16,
      large: 18,
      xlarge: 20,
      header: 20,
      title: 24
    };
  } else {
    return {
      small: 13,
      regular: 15,
      medium: 17,
      large: 19,
      xlarge: 22,
      header: 22,
      title: 26
    };
  }
}, [deviceType]);

// ✅ Add this for company settings
useEffect(() => {
  if (!user?.id) return;
  
  const loadSettings = async () => {
    if (settingsChecked.current || settingsLoading.current) return;
    
    settingsLoading.current = true;
    try {
      await refreshCurrency();
      settingsChecked.current = true;
    } finally {
      settingsLoading.current = false;
    }
  };
  
  loadSettings();
}, [user?.id]);

  const [summary, setSummary] = useState({
  totalSales: 0,
  totalRevenue: 0,
  totalItems: 0,
  paymentBreakdown: {}
});
  const currentTheme = themes[theme] || themes.light;
  const t = translations[language] || translations.en;
  
 const [categories, setCategories] = useState<string[]>([]);
  const companyLogo = require('../../assets/images/smarthawker icon final.png');
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage] = useState<number>(8);
  const { licenseInfo, timeLeft, setIsVisible } = useLicenseTimer();
  const [isMobile, setIsMobile] = useState<boolean>(width < 768);
  const [menuVisible, setMenuVisible] = useState<boolean>(false);
  const [activeMenu, setActiveMenu] = useState<string>('main');
  const [loadingModes, setLoadingModes] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<boolean>(false);
  const [showCashModal, setShowCashModal] = useState<boolean>(false);
  const [cashAmount, setCashAmount] = useState<string>('');
  const [balanceAmount, setBalanceAmount] = useState<number>(0);
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [processingPayment, setProcessingPayment] = useState(false);
const [processingPaymentId, setProcessingPaymentId] = useState<string | null>(null);
  const [showSalesReport, setShowSalesReport] = useState<boolean>(false);
  const [selectedSalesFilter, setSelectedSalesFilter] = useState<string>('today');
  const [startDate, setStartDate] = useState<Date>(new Date());
const [endDate, setEndDate] = useState<Date>(new Date());
const [showLoadingScreen, setShowLoadingScreen] = useState(false);
const [showPicker, setShowPicker] = useState<boolean>(false);
const [pickerType, setPickerType] = useState<'start' | 'end'>('start');
const [tempDate, setTempDate] = useState<Date>(new Date());
const tempDateRef = useRef<Date>(new Date());
const [dayEndStatus, setDayEndStatus] = useState({
    isDayEnded: false,
    pendingSales: 0,
    currentDayStart: null as string | null,
    lastDayEnd: null as any
});
const [showUPIPayment, setShowUPIPayment] = useState(false);
const [upiId, setUpiId] = useState('');
const [showOutletDropdown, setShowOutletDropdown] = useState(false);
const timeLeftRef = useRef({ days: 0, hours: 0, minutes: 0, seconds: 0 });
const [showPayModeSettings, setShowPayModeSettings] = useState(false);
const [showBillPrompt, setShowBillPrompt] = useState(false);
const [isUserReady, setIsUserReady] = useState(false);
const [showCompanySettings, setShowCompanySettings] = useState(false);
const [pendingSaleData, setPendingSaleData] = useState<any>(null);
const [userPaymentModes, setUserPaymentModes] = useState<PaymentMode[]>([]);
const [selectedBillStyle, setSelectedBillStyle] = useState<string>('professional');
const [showStyleSelector, setShowStyleSelector] = useState<boolean>(false);
const [showPayNowPayment, setShowPayNowPayment] = useState(false);
const [showDrawerLogs, setShowDrawerLogs] = useState(false);
const lastCheckTime = useRef<number>(0);
const CHECK_INTERVAL = 10 * 60 * 1000; // 10 minutes
const STORAGE_KEY = 'last_drawer_check';
const [payNowQrUrl, setPayNowQrUrl] = useState('');
// ===== SIMPLE HANDLERS =====
const openStartPicker = () => {
  setPickerType('start');
  setTempDate(startDate);
  tempDateRef.current = startDate;
  setShowPicker(true);
};

// Add these refs at the top of your component
const loadingPayNow = useRef(false);
const payNowLoaded = useRef(false);

const loadPayNowQR = async (force?: boolean): Promise<string> => {
  // Reset loaded flag if force is true
  if (force) {
    console.log('🔄 Force reloading PayNow QR...');
    payNowLoaded.current = false;
  }
  
  if (payNowLoaded.current && !force) {
    console.log('⏭️ PayNow QR already loaded, skipping');
    return payNowQrUrl;
  }

  try {
    // ✅ STEP 1: GET OUTLET ID
    const outletId = await AsyncStorage.getItem('selectedOutletId');
    
    // ✅ STEP 2: CHECK IF OUTLET ID EXISTS
    if (!outletId) {
      console.log('⚠️ No outlet selected - cannot load PayNow QR');
      return '';
    }
    
    console.log(`📡 Loading PayNow QR for outlet: ${outletId}`);
    
    // ✅ STEP 3: USE outletId INSTEAD OF user?.id
    const response = await API.get(`/user/paynow/${outletId}?outletId=${outletId}`);
    
    const qrUrl = response.data.qrCodeUrl || '';
    
    // ✅ Set state
    setPayNowQrUrl(qrUrl);
    
    // ✅ Set flag
    payNowLoaded.current = true;
    
    console.log('✅ PayNow QR loaded for outlet:', outletId, qrUrl ? 'URL present' : 'No URL');
    
    return qrUrl;
    
  } catch (error: any) {
    console.log('❌ Error loading PayNow:', {
      message: error.message,
      response: error.response?.data
    });
    setPayNowQrUrl('');
    payNowLoaded.current = false;
    return '';
  }
};

const openEndPicker = () => {
  setPickerType('end');
  setTempDate(endDate);
  tempDateRef.current = endDate;
  setShowPicker(true);
};
const removeAllItems = () => {
    setCart([]);
    // ✅ Reset discount when cart empty
    setDiscountInfo(prev => ({
        ...prev,
        applied: false,
        amount: 0,
        originalTotal: 0,
        finalTotal: 0
    }));
};


// Add these refs at the top of your component
const loadingPaymentModes = useRef(false);
const paymentModesLoaded = useRef(false);

// In PosScreen.tsx - Update loadPaymentModes
const loadPaymentModes = async (force = false) => {
  if (paymentModesLoaded.current && !force) return;
  if (loadingPaymentModes.current) return;

  try {
    loadingPaymentModes.current = true;
    
    // ✅ Get target ID
    const outletId = await AsyncStorage.getItem('selectedOutletId');
    const targetId = outletId || user?.id;
    
    if (!targetId) {
      console.log('⚠️ No target ID found');
      return;
    }
    
    console.log(`📡 Loading payment modes for: ${targetId}`);
    
    // ✅ Use correct endpoint
    const response = await API.get(`/user/payment-modes/${targetId}`);
    console.log('📥 Payment modes response:', response.data);
    
    let modes = response.data.paymentModes || [];
    
    // ✅ Process modes
    const processedModes = modes.map((mode: any) => {
      if (typeof mode === 'string') {
        return {
          id: mode,
          name: getModeName(mode),
          icon: getModeIcon(mode),
          description: getModeDescription(mode),
          isActive: true,
          order: 0
        };
      }
      return mode;
    });
    
    console.log('✅ Processed modes:', processedModes);
    setUserPaymentModes(processedModes);
    paymentModesLoaded.current = true;
    
  } catch (error) {
    console.log('❌ Error loading payment modes:', error);
  } finally {
    loadingPaymentModes.current = false;
  }
};
useEffect(() => {
    const discountMode = userPaymentModes.find(m => m.id === 'discount');
    setDiscountEnabled(discountMode?.isActive || false);
    
    // Reset discount when disabled
    if (!discountMode?.isActive) {
        setDiscountInfo({
            applied: false,
            type: 'percentage',
            value: 0,
            amount: 0,
            originalTotal: 0,
            finalTotal: 0
        });
    }
}, [userPaymentModes]);


// ============ CALCULATE FINAL TOTAL (With Discount) ============
const calculateFinalTotal = (): number => {
    const original = calculateOriginalTotal();
    
    // If discount applied, use discountInfo
    if (discountInfo.applied) {
        return discountInfo.finalTotal;
    }
    
    return original;
};

// Add helper functions if missing
 
// Add this in PosScreen component
useEffect(() => {
  console.log('💰 userPaymentModes CHANGED:', 
    userPaymentModes.map(m => ({
      name: m.name,
      isActive: m.isActive,
      showInModal: m.isActive ? '✅ Will show' : '❌ Hidden'
    }))
  );
}, [userPaymentModes]);



useEffect(() => {
  if (user?.id && !currencyRefreshedRef.current) {
    currencyRefreshedRef.current = true;
    refreshCurrency();
  }
}, [user?.id]);
  

 
  useEffect(() => {
  console.log('💰 PayNow QR URL in PosScreen:', payNowQrUrl);
}, [payNowQrUrl]);

// Call this when component mounts and after save
// In your component, initialize outletInfo from storage on mount
useEffect(() => {
    const loadStoredOutlet = async () => {
        const name = await AsyncStorage.getItem('selectedOutletName');
        const license = await AsyncStorage.getItem('selectedOutletLicense');
        
        if (name) {
            setOutletInfo({
                name: name,
                license: license,
                // ... other fields
            });
        }
    };
    loadStoredOutlet();
}, []);
// Add this near other useEffects
useEffect(() => {
    const loadStoredOutlet = async () => {
        try {
            const outletId = await AsyncStorage.getItem('selectedOutletId');
            const outletName = await AsyncStorage.getItem('selectedOutletName');
            const outletLicense = await AsyncStorage.getItem('selectedOutletLicense');
            
            if (outletId && outletName) {
                console.log('📦 Loading stored outlet:', outletName);
                setOutletInfo({
                    name: outletName,
                    license: outletLicense,
                    id: parseInt(outletId)
                });
            }
        } catch (error) {
            console.log('❌ Error loading stored outlet:', error);
        }
    };
    
    loadStoredOutlet();
}, []); // Run once on mount
// Add this useEffect
useEffect(() => {
    console.log('🔍 outletInfo changed:', outletInfo);
}, [outletInfo]);

useEffect(() => {
    console.log('🔍 selectedOutlet changed:', selectedOutlet);
}, [selectedOutlet]);
const handlePaymentModesUpdate = (modes: PaymentMode[]) => {
  console.log('🔄 Received updated modes from PayModeSettings:', 
    modes.map(m => ({
      id: m.id,
      name: m.name,
      isActive: m.isActive,
      show: m.isActive ? '✅' : '❌'
    }))
  );
  
  // ✅ Immediately update UI
  setUserPaymentModes(modes);
  
  // ✅ Reset loaded flag to force reload
  paymentModesLoaded.current = false;
  
  // ✅ Force reload from server to confirm
  setTimeout(() => {
    console.log('🔄 Forcing reload from server after save...');
    loadPaymentModes(true);
  }, 500);
};
// Add these refs at the top of your component
const loadingUpi = useRef(false);
const upiLoaded = useRef(false);

const loadUPIId = async (force = false) => {
  // 🛑 If already loaded and not forcing, skip
  if (upiLoaded.current && !force) {
    console.log('⏭️ UPI ID already loaded, skipping');
    return;
  }
  
  // 🛑 If already loading, skip duplicate
  if (loadingUpi.current) {
    console.log('⏳ UPI ID already loading, skipping');
    return;
  }

  try {
    loadingUpi.current = true;
    
    // ✅ STEP 1: GET OUTLET ID
    const outletId = await AsyncStorage.getItem('selectedOutletId');
    
    // ✅ STEP 2: CHECK IF OUTLET ID EXISTS
    if (!outletId) {
      console.log('⚠️ No outlet selected - cannot load UPI ID');
      return;
    }
    
    console.log(`📡 Loading UPI ID for outlet: ${outletId}`);
    
    // ✅ STEP 3: USE outletId INSTEAD OF user.id
    const response = await API.get(`/user/upi/${outletId}?outletId=${outletId}`);
    
    // ✅ Mark as loaded
    upiLoaded.current = true;
    setUpiId(response.data.upiId || '');
    
    console.log('✅ UPI ID loaded for outlet:', outletId, response.data.upiId || 'not set');
    
  } catch (error: any) {
    console.log('❌ Error loading UPI:', {
      message: error.message,
      response: error.response?.data
    });
    upiLoaded.current = false;
  } finally {
    loadingUpi.current = false;
  }
};
const handleOutletSelect = async (outlet) => {
    try {
        console.log('🏪 Selected outlet:', outlet);
        
        // ✅ CLEAR OLD DATA FIRST
        await AsyncStorage.removeItem('selectedOutletId');
        await AsyncStorage.removeItem('selectedOutletName');
        await AsyncStorage.removeItem('selectedOutletLicense');
        await AsyncStorage.removeItem('selectedOutletExpiry');
        
        // ✅ Save new outlet details
        await AsyncStorage.setItem('selectedOutletId', outlet.Id.toString());
        await AsyncStorage.setItem('selectedOutletName', outlet.name);
        await AsyncStorage.setItem('selectedOutletLicense', outlet.LicenseKey || ''); 
        await AsyncStorage.setItem('selectedOutletExpiry', outlet.ExpiryDate || '');
        
        // ✅ CRITICAL: Update state immediately with ALL fields
        setSelectedOutlet(outlet);
        setOutletInfo({
            id: outlet.Id,
            name: outlet.name,
            license: outlet.LicenseKey,
            expiry: outlet.ExpiryDate,
            staff: outlet.staffUsername
        });
        
        console.log('✅ Outlet info set:', {
            id: outlet.Id,
            name: outlet.name,
            license: outlet.LicenseKey,
            expiry: outlet.ExpiryDate
        });
        
        setShowOutletSelector(false);
        await loadData();
        
    } catch (error) {
        console.log('❌ Error:', error);
    }
};
// When opening Company Settings
const openCompanySettings = () => {
    console.log('🔍 Opening Company Settings with outletInfo:', {
        id: outletInfo?.id,
        name: outletInfo?.name,
        license: outletInfo?.license
    });
    
    if (!outletInfo?.id) {
        Alert.alert('Error', 'Please select an outlet first');
        return;
    }
    
    setShowCompanySettings(true);
};
// Helper functions for string to object conversion
const getModeName = (modeId: string): string => {
  const names: Record<string, string> = {
    'cash': 'Cash',
    'paynow': 'PayNow',
    'visa': 'Visa/Master',
    'cdc': 'CDC Voucher',
    'paylah': 'PayLah!',
    'grabpay': 'GrabPay'
  };
  return names[modeId] || modeId;
};

const getModeIcon = (modeId: string): string => {
  const icons: Record<string, string> = {
    'cash': '💰',
    'paynow': '📱',
    'visa': '💳',
    'cdc': '🎫',
    'paylah': '📱',
    'grabpay': '🛵'
  };
  return icons[modeId] || '💳';
};

const getModeDescription = (modeId: string): string => {
  const desc: Record<string, string> = {
    'cash': 'Pay with cash',
    'paynow': 'PayNow QR transfer',
    'visa': 'Credit/Debit card',
    'cdc': 'CDC vouchers',
    'paylah': 'DBS PayLah',
    'grabpay': 'GrabPay wallet'
  };
  return desc[modeId] || `${modeId} payment`;
};
const onDateChange = (event: any, selectedDate?: Date) => {
  if (event.type === 'set' && selectedDate) {
    if (pickerType === 'start') {
      console.log('📅 Start date selected:', selectedDate);
      setStartDate(selectedDate);
      tempDateRef.current = selectedDate;
    } else {
      console.log('📅 End date selected:', selectedDate);
      setEndDate(selectedDate);
      tempDateRef.current = selectedDate;
    }
  }
  setShowPicker(false);
};
  
 const [dishGroups, setDishGroups] = useState<any[]>([]);
  
  const [showAddGroup, setShowAddGroup] = useState<boolean>(false);
  const [showEditGroup, setShowEditGroup] = useState<boolean>(false);
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [newGroupName, setNewGroupName] = useState<string>('');
  const [showAddDish, setShowAddDish] = useState<boolean>(false);
  const [showEditDish, setShowEditDish] = useState<boolean>(false);
  const [editingDish, setEditingDish] = useState<any>(null);
  const [menuCurrentPage, setMenuCurrentPage] = useState(1);
  const [menuKey, setMenuKey] = useState(0);
  const [newDish, setNewDish] = useState<any>({
    name: '',
    price: '',
    category: categories[0],
    imageUri: null,
  });
  const [imageUploading, setImageUploading] = useState<boolean>(false);
  const [cart, setCart] = useState<any[]>([]);

  // Helper functions
  // Helper function to translate category names (both ways)
const translateCategory = (categoryName: string, targetLang: string): string => {
  if (targetLang === 'en') return categoryName;
  
  // Map of English to Tamil translations
  const translationMap: Record<string, string> = {
    'Maja': translations[targetLang]?.maja || 'Maja',
    'Appetiser': translations[targetLang]?.appetiser || 'Appetiser',
    'Main Course': translations[targetLang]?.mainCourse || 'Main Course',
    'Hot Drinks': translations[targetLang]?.hotDrinks || 'Hot Drinks',
    'Desserts': translations[targetLang]?.desserts || 'Desserts',
  };
  
  return translationMap[categoryName] || categoryName;
};
  const translateDishName = (englishName: string, lang: string): string => {
    if (lang === 'en') return englishName;
    return dishNameTranslations[lang]?.[englishName] || englishName;
  };
  // Add this useEffect to monitor temp date changes




useEffect(() => {
  console.log('📅 startDate changed to:', startDate);
}, [startDate]);

useEffect(() => {
  console.log('📅 endDate changed to:', endDate);
}, [endDate]);
// Dynamic styles based on device
const getStyles = (deviceType: string, orientation: string) => {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: deviceType === 'phone' ? 8 : 16,
      paddingVertical: deviceType === 'phone' ? 8 : 12,
      minHeight: deviceType === 'phone' ? 50 : 60,
    },
    headerTitle: {
      fontSize: deviceType === 'phone' ? 14 : 18,
    },
    categoriesContainer: {
      height: deviceType === 'phone' ? 40 : 50,
    },
    categoryText: {
      fontSize: deviceType === 'phone' ? 12 : 14,
      paddingHorizontal: deviceType === 'phone' ? 12 : 16,
    },
    mainContent: {
      flex: 1,
      flexDirection: orientation === 'portrait' && deviceType === 'phone' 
        ? 'column' 
        : 'row',
    },
    menuSection: {
      flex: orientation === 'portrait' && deviceType === 'phone' ? 1 : 0.7,
      width: orientation === 'portrait' && deviceType === 'phone' ? '100%' : '70%',
    },
    cartSection: {
      flex: orientation === 'portrait' && deviceType === 'phone' ? 0.4 : 0.3,
      width: orientation === 'portrait' && deviceType === 'phone' ? '100%' : '30%',
      borderLeftWidth: deviceType === 'phone' ? 0 : 1,
      borderTopWidth: deviceType === 'phone' ? 1 : 0,
    },
  });
};
 const [menuItems, setMenuItems] = useState<any[]>([]); // Start empty
 const [menuUpdateTrigger, setMenuUpdateTrigger] = useState(0);
  // ============ LICENSE COUNTDOWN (Keep but optimize) ============
useEffect(() => {
  console.log('📦 menuItems changed - count:', menuItems.length);
  setMenuUpdateTrigger(prev => prev + 1);
}, [menuItems]);
  // ============ API FUNCTIONS ============
  // Add ALL these functions HERE ⬇️
// Update the useEffect where loadData is called
useEffect(() => {
    const loadInitialData = async () => {
        if (outletInfo?.id) {
            console.log('📦 Loading initial data for outlet:', outletInfo.id);
            await loadDataWithDayEnd();
        }
    };
    
    loadInitialData();
}, [outletInfo?.id]);
  // Load dish groups from database
// In PosScreen.tsx, find where categories are set from dishGroups
const checkDayEndStatus = async () => {
    try {
        console.log('📅 Checking day end status...');
        const response = await API.get('/dayend/status');
        
        if (response.data.success) {
            setDayEndStatus({
                isDayEnded: response.data.isDayEnded || false,
                pendingSales: response.data.pendingSales || 0,
                currentDayStart: response.data.currentDayStart || null,
                lastDayEnd: response.data.lastDayEnd || null
            });
            
            console.log('✅ Day end status loaded:', {
                isDayEnded: response.data.isDayEnded,
                pendingSales: response.data.pendingSales
            });
        }
    } catch (error) {
        console.log('❌ Error checking day end status:', error);
    }
};
const loadDataWithDayEnd = async () => {
    try {
        // Load all data
        await loadData();
        
        // Check day end status
        await checkDayEndStatus();
        
        console.log('✅ Data and day end status loaded');
    } catch (error) {
        console.log('❌ Error loading data:', error);
    }
};

// When loading dish groups
// Add this at the top of your component with other useRef
const loadingGroups = useRef(false);
const groupsLoaded = useRef(false);

// In PosScreen.tsx - Update loadDishGroups

const loadDishGroups = async (force = false) => {
  // 🛑 Skip if already loaded
  if (groupsLoaded.current && !force) {
    console.log('⏭️ Dish groups already loaded, skipping');
    return;
  }
  
  // 🛑 Skip if loading
  if (loadingGroups.current) {
    console.log('⏳ Dish groups already loading, skipping');
    return;
  }

  try {
    loadingGroups.current = true;
    
    // ✅ STEP 1: GET OUTLET ID
    const outletId = await AsyncStorage.getItem('selectedOutletId');
    
    // ✅ STEP 2: CHECK IF OUTLET ID EXISTS
    if (!outletId && user?.role !== 'admin') {
      console.log('⚠️ No outlet selected - cannot load dish groups');
      return;
    }
    
    console.log(`📦 Loading dish groups for outlet: ${outletId}`);
    
    // ✅ STEP 3: ADD outletId TO API CALL
    const response = await API.get(`/dishgroups?outletId=${outletId}`);
    console.log('📦 Raw dishGroups response:', response.data);
    
    // ✅ Map groups with ALL fields including DisplayOrder
    let groups = response.data.map((group: any) => ({
      id: group.Id,
      name: group.Name,
      itemCount: group.ItemCount,
      active: group.active,
      DisplayOrder: group.DisplayOrder ?? group.order ?? 999
    }));
    
    // ✅ Sort by DisplayOrder (from backend)
    groups.sort((a, b) => {
      const orderA = a.DisplayOrder ?? 999;
      const orderB = b.DisplayOrder ?? 999;
      return orderA - orderB;
    });
    
    console.log('📋 Final order (by DisplayOrder):', groups.map(g => g.name));
    
    // ✅ Save to AsyncStorage for backup
    const orderArray = groups.map(g => g.id);
    await AsyncStorage.setItem('dishGroupOrder', JSON.stringify(orderArray));
    
    setDishGroups(groups);
    
    // ✅ Update categories with same order
    const activeGroups = groups.filter(g => g.active !== false);
    const activeGroupNames = activeGroups.map(g => g.name);
    setCategories(activeGroupNames);
    console.log('✅ Active categories (ordered):', activeGroupNames);
    
    if (activeGroupNames.length > 0 && !activeGroupNames.includes(activeCategory)) {
      setActiveCategory(activeGroupNames[0]);
    }
    
    groupsLoaded.current = true;
    
  } catch (error) {
    console.log('❌ Error loading dish groups:', error);
    groupsLoaded.current = false;
  } finally {
    loadingGroups.current = false;
  }
};
useEffect(() => {
  // Update categories based on active dish groups
  const activeGroups = dishGroups.filter(g => g.active !== false);
  const activeGroupNames = activeGroups.map(g => g.name);
  
  // Only update if different
  if (JSON.stringify(activeGroupNames) !== JSON.stringify(categories)) {
    setCategories(activeGroupNames);
    
    // Update active category if current one is inactive
    if (activeGroupNames.length > 0 && !activeGroupNames.includes(activeCategory)) {
      setActiveCategory(activeGroupNames[0]);
    }
  }
}, [dishGroups]);
const calculateOriginalTotal = useCallback((): number => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}, [cart]);
  // Load dish items from database
 // Load dish items from database
const loadingItems = useRef(false);
const itemsLoaded = useRef(false);

const loadDishItems = async (force = false) => {
  if (itemsLoaded.current && !force) {
    console.log('⏭️ Dish items already loaded, skipping');
    return;
  }
  
  if (loadingItems.current) {
    console.log('⏳ Dish items already loading');
    return;
  }

  try {
    loadingItems.current = true;
    
    const outletId = await AsyncStorage.getItem('selectedOutletId');
    
    if (!outletId && user?.role !== 'admin') {
      console.log('⚠️ No outlet selected');
      return;
    }
    
    console.log(`📦 Loading dish items for outlet: ${outletId}`);
    
    const response = await API.get(`/dishitems?outletId=${outletId}`);
    console.log('✅ Raw items response length:', response.data?.length);
    
    // ✅ DEBUG: Check first item for IsFavourite
    if (response.data && response.data.length > 0) {
      console.log('🔍 First item in response:', JSON.stringify(response.data[0], null, 2));
      console.log('🔍 IsFavourite in response:', response.data[0].IsFavourite);
    }
    
    const baseURL = 'https://hawker-yeahpay-production.up.railway.app';
    
    const items = (response.data || []).map((item: any) => {
      const newItem = {
        id: item.Id || item.id,
        name: item.Name || item.name,
        price: parseFloat(item.Price || item.price || 0),
        categoryId: item.CategoryId?.toString(),
        categoryName: item.DisplayCategory || item.OriginalCategory || 'Unknown',
        category: item.DisplayCategory || item.OriginalCategory || 'Unknown',
        imageUri: item.imageUri || item.ImageUrl 
          ? `${baseURL}${item.imageUri || item.ImageUrl}`
          : null,
        originalName: item.OriginalName || item.originalName || item.name,
        originalCategory: item.OriginalCategory || item.originalCategory,
        displayCategory: item.DisplayCategory || item.displayCategory,
        isActive: item.IsActive ?? true,
        isOpenPrice: item.IsOpenPrice === true || item.isOpenPrice === true,
        isFavourite: item.IsFavourite === true || item.isFavourite === true,
      };
      
      // ✅ DEBUG: Log if this item is favourite
      if (newItem.isFavourite) {
        console.log(`⭐ Favourite item found: ${newItem.name}`);
      }
      
      return newItem;
    });
    
    console.log(`📊 Items loaded: ${items.length}`);
    
    // ✅ Count favourites
    const favCount = items.filter(i => i.isFavourite === true).length;
    console.log(`⭐ Favourite items count: ${favCount}`);
    
    itemsLoaded.current = true;
    setMenuItems(items);
    
    // Update category counts...
    const newCounts: Record<string, number> = {};
    items.forEach((item: any) => {
      const categoryId = item.categoryId;
      if (categoryId) {
        newCounts[categoryId] = (newCounts[categoryId] || 0) + 1;
      }
    });
    
    setDishGroups(prev => {
      const needsUpdate = prev.some(group => 
        group.itemCount !== (newCounts[group.id?.toString()] || 0)
      );
      
      if (!needsUpdate) return prev;
      
      console.log('📊 Updating category counts:', newCounts);
      return prev.map(group => ({
        ...group,
        itemCount: newCounts[group.id?.toString()] || 0
      }));
    });
    
  } catch (error: any) {
    console.log('❌ Error loading items:', error);
    itemsLoaded.current = false;
    
    const errorMessage = error.response?.data?.error || 
                        error.message || 
                        'Failed to load menu items';
    Alert.alert('Error', errorMessage);
    
  } finally {
    loadingItems.current = false;
  }
};
// Add this in PosScreen.tsx - inside your component, before return

const onGroupUpdate = useCallback(async () => {
  console.log('🔄 Group updated, reloading with order...');
  
  // ✅ Force reload with true parameter
  await loadDishGroups(true);
  await loadDishItems(true);
  
  // ✅ Force MenuGrid to re-render
  setMenuRefreshKey(prev => prev + 1);
  
  // ✅ Log after state updates (use useEffect instead)
  console.log('✅ Update complete - UI should refresh');
  
}, [loadDishGroups, loadDishItems]);

// Add this useEffect to watch changes
useEffect(() => {
  if (dishGroups.length > 0) {
    console.log('✅ New dishGroups order:', dishGroups.map(g => g.name));
  }
}, [dishGroups]);

useEffect(() => {
  if (categories.length > 0) {
    console.log('✅ New categories order:', categories);
  }
}, [categories]);// Add dependencies
  // Helper function to get category ID
  // Helper function to get category ID
const getCategoryIdByName = (categoryName: string): number => {
  console.log('🔍 Finding category for name:', categoryName);
  console.log('🔍 Available dishGroups:', dishGroups);
  
  if (!dishGroups || dishGroups.length === 0) {
    console.log('⚠️ No dish groups available');
    return 1; // Default fallback
  }
  
  const category = dishGroups.find(g => g.name === categoryName);
  
  console.log('🔍 Found category:', category);
  
  if (!category) {
    console.log('⚠️ Category not found, using first available');
    return dishGroups[0]?.id || 1;
  }
  
  return category.id;
};

// Helper function to get English category name
const getEnglishCategory = (categoryName: string): string => {
  // Reverse mapping from Tamil to English
  if (!t) return categoryName;
  
  const reverseMap: Record<string, string> = {
    [t.maja || 'Maja']: 'Maja',
    [t.appetiser || 'Appetiser']: 'Appetiser',
    [t.mainCourse || 'Main Course']: 'Main Course',
    [t.hotDrinks || 'Hot Drinks']: 'Hot Drinks',
    [t.desserts || 'Desserts']: 'Desserts',
  };
  
  return reverseMap[categoryName] || categoryName;
};
  // Settings functions
  const loadSettings = async (): Promise<void> => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme');
      const savedLanguage = await AsyncStorage.getItem('language');
      
      if (savedTheme) setTheme(savedTheme);
      if (savedLanguage && translations[savedLanguage]) setLanguage(savedLanguage);
    } catch (error) {
      
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              Alert.alert('Error', 'Failed to logout');
            }
          }
        }
      ]
    );
  };

  const handleThemeChange = async (newTheme: string): Promise<void> => {
    setTheme(newTheme);
    await AsyncStorage.setItem('theme', newTheme);
    await setSettingsTheme(newTheme);
  };

  const handleLanguageChange = async (newLanguage: string): Promise<void> => {
    if (!translations[newLanguage]) {
      
      return;
    }
    setPrevLanguage(language);
    setLanguage(newLanguage);
    await AsyncStorage.setItem('language', newLanguage);
    await setSettingsLanguage(newLanguage);
  };
// Add this near your other useEffects
useEffect(() => {
  console.log('🔍 FINAL CHECK:');
  console.log('  - outlets:', outlets);
  console.log('  - outlets length:', outlets?.length);
  console.log('  - outlets type:', typeof outlets);
  console.log('  - isArray:', Array.isArray(outlets));
}, [outlets]);
  useEffect(() => {
    loadSettings();
    loadDishGroups();
  loadDishItems();
  }, []);

  useEffect(() => {
  if (!t) return;
  
  console.log('🔄 Language changed to:', language);
  console.log('📦 Current dishGroups:', dishGroups);
  
  // ✅ ONLY translate if we have existing dishGroups
  if (dishGroups.length > 0) {
    // Just translate the names, don't create new categories
    setDishGroups(prev => prev.map(group => ({
      ...group,
      name: translateCategory(group.name, language)  // Translate existing names
    })));
    
    // Update categories array from translated dishGroups
    const translatedCategories = dishGroups.map(g => translateCategory(g.name, language));
    setCategories(translatedCategories);
  }
  
  // ✅ Translate menu items
  setMenuItems(prev => prev.map(item => ({
    ...item,
    name: translateDishName(item.originalName, language),
    displayCategory: translateCategory(item.originalCategory, language),
  })));
  
  // ✅ Translate cart items
  setCart(prev => prev.map(item => {
    const menuItem = menuItems.find(m => m.id === item.id);
    if (menuItem) {
      return {
        ...item,
        name: translateDishName(menuItem.originalName, language),
      };
    }
    return item;
  }));
  
  // ✅ Update active category if needed
  if (activeCategory && categories.length > 0) {
    const oldIndex = categories.findIndex(c => c === activeCategory);
    if (oldIndex !== -1 && dishGroups[oldIndex]) {
      setActiveCategory(translateCategory(dishGroups[oldIndex].name, language));
    }
  }
  
  setPrevLanguage(language);
}, [language]);
  // UI Handlers
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setIsMobile(window.width < 768);
    });
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    if (!categories.includes(activeCategory) && categories.length > 0) {
      setActiveCategory(categories[0]);
    }
  }, [categories]);

const categoryItems = useMemo(() => {
  if (!t || !activeCategory) return [];
  
  console.log(`🎯 Filtering items for category: ${activeCategory}`);
  console.log(`📦 Total menuItems: ${menuItems.length}`);
  console.log(`⭐ Favourite items in menu: ${menuItems.filter(i => i.isFavourite === true).length}`);
  
  // ✅ SPECIAL HANDLING FOR FAVOURITES CATEGORY
  if (activeCategory === 'Favourites') {
    const favouriteItems = menuItems.filter(item => item.isFavourite === true);
    console.log(`⭐ Found ${favouriteItems.length} favourite items`);
    return favouriteItems;
  }
  
  // Normal categories - filter by displayCategory
  const items = menuItems.filter(item => 
    item.displayCategory === activeCategory
  );
  
  console.log(`📦 Found ${items.length} items in ${activeCategory}`);
  return items;
}, [activeCategory, menuItems, language]);
useEffect(() => {
  console.log('🎯 Active category:', activeCategory);
  console.log('📦 Items order:', categoryItems.map(i => i.name));
}, [activeCategory, categoryItems]);
useEffect(() => {
    console.log('🛒 Cart changed, items:', cart.length);
    
    if (discountInfo.applied) {
        recalculateDiscount(cart);
    }
}, [cart, discountInfo.applied]);
  const totalPages = Math.ceil(categoryItems.length / itemsPerPage);
  
  const currentItems = useMemo(() => {
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  return categoryItems.slice(startIndex, endIndex);
}, [categoryItems, currentPage, itemsPerPage]);

  const handleCategoryChange = (category: string): void => {
    setActiveCategory(category);
    setCurrentPage(1);
  };

  const nextPage = (): void => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = (): void => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };
const handleApplyDiscount = (type: 'percentage' | 'fixed', value: number, calculatedAmount: number) => {
    const originalTotal = calculateOriginalTotal();
    
    let finalTotal = originalTotal - calculatedAmount;
    if (finalTotal < 0) finalTotal = 0;
    
    setDiscountInfo({
        applied: true,
        type: type,
        value: value,
        amount: calculatedAmount,
        originalTotal: originalTotal,
        finalTotal: finalTotal
    });
    
    console.log('✅ Discount applied:', { type, value, amount: calculatedAmount, original: originalTotal, final: finalTotal });
};

const handleRemoveDiscount = () => {
    setDiscountInfo({
        applied: false,
        type: 'percentage',
        value: 0,
        amount: 0,
        originalTotal: calculateOriginalTotal(),
        finalTotal: calculateOriginalTotal()
    });
    
    console.log('🗑️ Discount removed');
};
// Update calculateTotal to show discounted amount
const calculateTotal = (): string => {
    if (discountInfo.applied) {
        return discountInfo.finalTotal.toFixed(2);
    }
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2);
};

 // In PosScreen.tsx - Replace your addToCart function

// ============================================
// ADD TO CART - Updated for Open Price
// ============================================
const addToCart = (item: any, customPrice?: number): void => {
    console.log('🔍 STEP 1: Item received from MenuGrid:', {
        id: item.id,
        name: item.name,
        isOpenPrice: item.isOpenPrice,
        customPrice: customPrice,
        imageUri: item.imageUri
    });
    
    // Get the FULL item from menuItems
    const fullItem = menuItems.find(i => i.id === item.id);
    
    console.log('🔍 STEP 2: Full item from menuItems:', {
        id: fullItem?.id,
        name: fullItem?.name,
        price: fullItem?.price,
        isOpenPrice: fullItem?.isOpenPrice,
        imageUri: fullItem?.imageUri,
        found: !!fullItem
    });
    
    if (!fullItem) {
        console.error('❌ Item not found in menuItems!');
        return;
    }
    
    // ✅ Handle open price - use custom price if provided
    const isOpenPriceItem = fullItem.isOpenPrice || false;
    let finalPrice = fullItem.price;
    
    if (isOpenPriceItem) {
        // Validate custom price for open price items
        if (!customPrice || customPrice <= 0) {
            Alert.alert(
                'Invalid Price',
                'Please enter a valid amount'
            );
            return;
        }
        finalPrice = customPrice;
    }
    
    // Create cart item with ALL fields
    const cartItem = {
        id: fullItem.id,
        name: fullItem.name,
        price: finalPrice,
        originalPrice: fullItem.price,  // Store original for reference
        quantity: 1,
        imageUri: fullItem.imageUri,
        isOpenPrice: isOpenPriceItem,  // ✅ IMPORTANT: Store flag!
        category: fullItem.displayCategory || fullItem.categoryName || fullItem.category || 'Uncategorized',
        displayCategory: fullItem.displayCategory || fullItem.categoryName || fullItem.category,
        originalCategory: fullItem.originalCategory,
    };
    
    console.log('🔍 STEP 3: Cart item created:', {
        name: cartItem.name,
        price: cartItem.price,
        isOpenPrice: cartItem.isOpenPrice,
        imageUri: cartItem.imageUri ? 'Has value' : 'Null/undefined'
    });
    
    setCart(prevCart => {
        console.log('🔍 STEP 4: Current cart before update:', prevCart.map(i => ({
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            isOpenPrice: i.isOpenPrice
        })));
        
        // ✅ Find existing item - for open price, match by id AND price
        let existing = null;
        
        if (isOpenPriceItem) {
            // Open price items: match by id AND exact price
            existing = prevCart.find(i => 
                i.id === item.id && i.price === finalPrice
            );
        } else {
            // Normal items: match by id only
            existing = prevCart.find(i => i.id === item.id);
        }
        
        let newCart;
        
        if (existing) {
            // Increase quantity if same item exists
            newCart = prevCart.map(i => {
                if (isOpenPriceItem) {
                    // For open price, match by id AND price
                    if (i.id === item.id && i.price === finalPrice) {
                        return {...i, quantity: i.quantity + 1};
                    }
                } else {
                    // For normal items
                    if (i.id === item.id) {
                        return {...i, quantity: i.quantity + 1};
                    }
                }
                return i;
            });
        } else {
            // Add new item
            newCart = [...prevCart, cartItem];
        }
        
        console.log('🔍 STEP 5: New cart after update:', newCart.map(i => ({
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            isOpenPrice: i.isOpenPrice
        })));
        
        return newCart;
    });
};
const loadData = useCallback(async () => {
    try {
        console.log('📦 Loading data for outlet...');
        
        const outletId = await AsyncStorage.getItem('selectedOutletId');
        const outletName = await AsyncStorage.getItem('selectedOutletName');
        const outletLicense = await AsyncStorage.getItem('selectedOutletLicense');
        const outletExpiry = await AsyncStorage.getItem('selectedOutletExpiry');
        
        if (!outletId) {
            console.log('⚠️ No outlet selected');
            return;
        }
        
        // ✅ Set outletInfo if not already set or if changed
        if (!outletInfo || outletInfo.id !== parseInt(outletId)) {
            setOutletInfo({
                id: parseInt(outletId),
                name: outletName || '',
                license: outletLicense || '',
                expiry: outletExpiry || ''
            });
            console.log('✅ Outlet info loaded:', { outletId, outletName });
        }
        
        // ✅ ALL calls must use outletId, not user.id
        await Promise.all([
            loadDishGroups(true),
            loadDishItems(true),
            loadPaymentModes(true),
            loadUPIId(true),
            loadPayNowQR(true),
            refreshCurrency()
        ]);
        
        console.log('✅ All data loaded for outlet:', outletId);
        
    } catch (error) {
        console.log('❌ Error loading data:', error);
    }
}, [loadDishGroups, loadDishItems, loadPaymentModes, loadUPIId, loadPayNowQR, refreshCurrency, outletInfo]);

// In PosScreen.tsx - add this near other useEffects
useEffect(() => {
    const loadInitialOutletInfo = async () => {
        const outletId = await AsyncStorage.getItem('selectedOutletId');
        const outletName = await AsyncStorage.getItem('selectedOutletName');
        const outletLicense = await AsyncStorage.getItem('selectedOutletLicense');
        const outletExpiry = await AsyncStorage.getItem('selectedOutletExpiry');
        
        if (outletId && !outletInfo) {
            setOutletInfo({
                id: parseInt(outletId),
                name: outletName || '',
                license: outletLicense || '',
                expiry: outletExpiry || ''
            });
            console.log('📦 Initial outlet info loaded:', { outletId, outletName });
        }
    };
    
    loadInitialOutletInfo();
}, []);
// In your login handler (where you set user state)
const handleLoginResponse = (response) => {
  console.log('✅ Login response:', response.data);
  
  if (response.data.user.role === 'owner' && response.data.outlets) {
    console.log('🏪 Owner login - outlets:', response.data.outlets);
    console.log('🏪 Owner login - outlets count:', response.data.outlets.length);
    setAvailableOutlets(response.data.outlets);
    // ✅ Set availableOutlets
   
    
    // ✅ Save to AsyncStorage (important!)
    AsyncStorage.setItem('userOutlets', JSON.stringify(response.data.outlets))
      .then(() => console.log('✅ Outlets saved to storage'))
      .catch(err => console.log('❌ Error saving outlets:', err));
    
    setShowOutletSelector(true);
    
    // Clear any old outlet data
    setOutletInfo(null);
    setSelectedOutlet(null);
    AsyncStorage.removeItem('selectedOutletId');
    AsyncStorage.removeItem('selectedOutletName');
    AsyncStorage.removeItem('selectedOutletLicense');
    AsyncStorage.removeItem('selectedOutletExpiry');
    
  } else if (response.data.user.role === 'staff') {
    console.log('👤 Staff login - direct access');
    
    const staffOutletId = response.data.user.outletId;
    const staffOutletName = response.data.user.shopName;
    
    AsyncStorage.setItem('selectedOutletId', staffOutletId.toString());
    AsyncStorage.setItem('selectedOutletName', staffOutletName);
    
    setOutletInfo({
      name: staffOutletName,
      id: staffOutletId
    });
    
    loadData();
  }
};
// In PosScreen.tsx
useEffect(() => {
    const loadOutletInfo = async () => {
        const outletId = await AsyncStorage.getItem('selectedOutletId');
        const outletName = await AsyncStorage.getItem('selectedOutletName');
        const outletLicense = await AsyncStorage.getItem('selectedOutletLicense');
        const outletExpiry = await AsyncStorage.getItem('selectedOutletExpiry');
        
        if (outletId) {
            setOutletInfo({
                id: parseInt(outletId),
                name: outletName || '',
                license: outletLicense || '',
                expiry: outletExpiry || ''
            });
            console.log('📦 Loaded outlet info from storage:', { outletId, outletName });
        }
    };
    
    loadOutletInfo();
}, []);
useEffect(() => {
  console.log('🔍 OUTLETS from context:', outlets);
  console.log('🔍 OUTLETS length:', outlets?.length);
  if (outlets?.length > 0) {
    console.log('🔍 First outlet:', outlets[0]);
    console.log('🔍 All outlets:', outlets.map(o => ({ id: o.Id, name: o.name, staff: o.staffUsername })));
  }
}, [outlets]);


useEffect(() => {
  console.log('🔍 showOutletDropdown:', showOutletDropdown);
}, [showOutletDropdown]);
// ============================================
// INCREASE QUANTITY - Updated for Open Price
// ============================================
const increaseQuantity = (itemId: number, itemPrice?: number): void => {
    setCart(prevCart => {
        const newCart = prevCart.map(item => {
            let isMatch = false;
            
            if (item.isOpenPrice && itemPrice !== undefined) {
                isMatch = (item.id === itemId && item.price === itemPrice);
            } else if (!item.isOpenPrice) {
                isMatch = (item.id === itemId);
            }
            
            if (isMatch) {
                return {...item, quantity: item.quantity + 1};
            }
            return item;
        });
        
        // ✅ IMMEDIATELY recalculate discount
        setTimeout(() => recalculateDiscount(newCart), 0);
        
        return newCart;
    });
};
// ============================================
// DECREASE QUANTITY - Updated for Open Price
// ============================================
const decreaseQuantity = (itemId: number, itemPrice?: number): void => {
    setCart(prevCart => {
        const newCart = [];
        
        for (const item of prevCart) {
            let isMatch = false;
            
            if (item.isOpenPrice && itemPrice !== undefined) {
                isMatch = (item.id === itemId && item.price === itemPrice);
            } else if (!item.isOpenPrice) {
                isMatch = (item.id === itemId);
            }
            
            if (isMatch) {
                if (item.quantity === 1) {
                    continue; // Remove item
                } else {
                    newCart.push({...item, quantity: item.quantity - 1});
                }
            } else {
                newCart.push(item);
            }
        }
        
        // ✅ IMMEDIATELY recalculate discount
        setTimeout(() => recalculateDiscount(newCart), 0);
        
        return newCart;
    });
};
const recalculateDiscount = useCallback((newCart: any[]) => {
    if (!discountInfo.applied) return;
    
    const newOriginalTotal = newCart.reduce((sum, item) => 
        sum + (item.price * item.quantity), 0
    );
    
    let newDiscountAmount = 0;
    
    if (discountInfo.type === 'percentage') {
        newDiscountAmount = (newOriginalTotal * discountInfo.value) / 100;
        // Max 100% discount
        if (newDiscountAmount > newOriginalTotal) {
            newDiscountAmount = newOriginalTotal;
        }
    } else {
        newDiscountAmount = Math.min(discountInfo.value, newOriginalTotal);
    }
    
    const newFinalTotal = newOriginalTotal - newDiscountAmount;
    
    setDiscountInfo(prev => ({
        ...prev,
        amount: newDiscountAmount,
        originalTotal: newOriginalTotal,
        finalTotal: newFinalTotal
    }));
    
    console.log('🔄 Discount recalculated:', {
        newOriginal: newOriginalTotal,
        discountAmount: newDiscountAmount,
        newFinal: newFinalTotal
    });
}, [discountInfo.applied, discountInfo.type, discountInfo.value]);


// ============================================
// REMOVE ITEM - Updated for Open Price
// ============================================
const removeItem = (itemId: number, itemPrice?: number): void => {
    setCart(prevCart => {
        const newCart = prevCart.filter(item => {
            if (item.isOpenPrice && itemPrice !== undefined) {
                return !(item.id === itemId && item.price === itemPrice);
            } else if (!item.isOpenPrice) {
                return item.id !== itemId;
            }
            return true;
        });
        
        // ✅ IMMEDIATELY recalculate discount
        setTimeout(() => recalculateDiscount(newCart), 0);
        
        return newCart;
    });
};
const switchOutlet = async (outlet) => {
    try {
        console.log('🔄 Switching to outlet:', outlet.name);
        
        // Save new outlet
        await AsyncStorage.setItem('selectedOutletId', outlet.Id.toString());
        await AsyncStorage.setItem('selectedOutletName', outlet.name);
        await AsyncStorage.setItem('selectedOutletLicense', outlet.LicenseKey || '');
        await AsyncStorage.setItem('selectedOutletExpiry', outlet.ExpiryDate || '');
        
        // Update state
        setOutletInfo({
            name: outlet.name,
            license: outlet.LicenseKey,
            expiry: outlet.ExpiryDate,
            staff: outlet.staffUsername,
            id: outlet.Id
        });
        
        setSelectedOutlet(outlet);
        
        // Reload all data for new outlet
        await loadData();
        
        console.log('✅ Switched to outlet:', outlet.name);
        
    } catch (error) {
        console.log('❌ Error switching outlet:', error);
        Alert.alert('Error', 'Failed to switch outlet');
    }
};
const handleCheckout = (): void => {
  try {
    // Cart empty check
    if (cart.length === 0) {
      Alert.alert(
        t.cartEmpty || 'Cart Empty', 
        t.tapToAdd || 'Add items to cart'
      );
      return;
    }
    
    // Validate cart items
    const invalidItems = cart.filter(item => 
      !item.id || !item.name || !item.price || item.price <= 0
    );
    
    if (invalidItems.length > 0) {
      console.log('⚠️ Invalid cart items:', invalidItems);
      Alert.alert(
        'Invalid Items',
        'Some items in cart are invalid. Please remove and add again.'
      );
      return;
    }
    
    // Show payment modal
    setShowPaymentModal(true);
    
  } catch (error) {
    // Rare case - something went wrong
   
    Alert.alert(
      'Error',
      'Unable to proceed to checkout. Please try again.'
    );
  }
};
useEffect(() => {
    const loadYeahPaySettings = async () => {
        try {
            const outletId = await AsyncStorage.getItem('selectedOutletId');
            console.log('🏪 Loading YeahPay for outlet:', outletId);
            
            if (!outletId) {
                console.log('⚠️ No outlet selected');
                return;
            }
            
            const response = await API.get(`/outlet/yeahpay-settings/${outletId}`);
            console.log('📥 YeahPay API Response:', response.data);
            
            // ✅ Save to AsyncStorage properly
            if (response.data && response.data.enabled === true) {
                await AsyncStorage.setItem('yeahpay_enabled', 'true');
                await AsyncStorage.setItem('yeahpay_device_sn', response.data.deviceSn || '');
                await AsyncStorage.setItem('yeahpay_salt', response.data.salt || '');
                console.log('✅ YeahPay ENABLED - Saved to storage');
                console.log('  - Device SN:', response.data.deviceSn);
                console.log('  - Salt:', response.data.salt);
                
                // ✅ Verify save
                const verifyEnabled = await AsyncStorage.getItem('yeahpay_enabled');
                const verifySn = await AsyncStorage.getItem('yeahpay_device_sn');
                console.log('🔍 Verification - enabled:', verifyEnabled, 'sn:', verifySn);
            } else {
                await AsyncStorage.setItem('yeahpay_enabled', 'false');
                console.log('❌ YeahPay DISABLED for this outlet');
            }
        } catch (error) {
            console.log('❌ Error loading YeahPay:', error);
            await AsyncStorage.setItem('yeahpay_enabled', 'false');
        }
    };
    
    loadYeahPaySettings();
}, [outletInfo?.id]);
// Update handlePaymentSelect
// In PosScreen.tsx, update handlePaymentSelect function
// Add this function in PosScreen component
const loadYeahPaySettings = async () => {
    try {
        const outletId = await AsyncStorage.getItem('selectedOutletId');
        console.log('📡 Loading YeahPay settings for outlet:', outletId);
        
        if (!outletId) {
            console.log('⚠️ No outlet selected');
            return;
        }
        
        const response = await API.get(`/outlet/yeahpay-settings/${outletId}`);
        console.log('📥 YeahPay settings response:', response.data);
        
        if (response.data && response.data.enabled) {
            await AsyncStorage.setItem('yeahpay_device_sn', response.data.deviceSn || '');
            await AsyncStorage.setItem('yeahpay_salt', response.data.salt || '');
            await AsyncStorage.setItem('yeahpay_enabled', 'true');
            console.log('✅ YeahPay ENABLED for this outlet');
            console.log('📱 Device SN:', response.data.deviceSn);
        } else {
            await AsyncStorage.setItem('yeahpay_enabled', 'false');
            console.log('❌ YeahPay DISABLED for this outlet');
        }
    } catch (error) {
        console.log('❌ Error loading YeahPay settings:', error);
        await AsyncStorage.setItem('yeahpay_enabled', 'false');
    }
};

// Update handlePaymentSelect
// In PosScreen.tsx, update handlePaymentSelect function

const handlePaymentSelect = async (payment: any): Promise<void> => {
  const totalAmount = parseFloat(calculateTotal());
   // ✅ YEAHPAY CARD PAYMENT - Direct API call
// ✅ YEAHPAY CARD PAYMENT
if (payment.name === 'Yeahpay Card' || payment.id === 'mode_1780572442855_syh829us4') {
    console.log('💳 YeahPay Card selected');
    
    const totalAmount =  parseFloat(calculateTotal());
    const outletId = await AsyncStorage.getItem('selectedOutletId');
    
    if (!outletId) {
        Alert.alert('Error', 'No outlet selected');
        return;
    }
    
    setProcessingPayment(true);
    setSelectedPayment(payment);
    
    try {
        const settingsResponse = await API.get(`/outlet/yeahpay-settings/${outletId}`);
        console.log('📥 Full settings response:', JSON.stringify(settingsResponse.data, null, 2));
        console.log('📥 RAW response:', settingsResponse);
console.log('📥 DATA:', settingsResponse.data);
console.log('📥 enabled value:', settingsResponse.data.enabled);
console.log('📥 enabled type:', typeof settingsResponse.data.enabled);
        // ✅ Check both 'enabled' and 'YeahPayEnabled' fields
        const isEnabled = !!settingsResponse.data.deviceSn;
console.log('🔍 isEnabled (based on deviceSn):', isEnabled);
        
        console.log('🔍 isEnabled:', isEnabled);
        console.log('🔍 deviceSn:', settingsResponse.data.deviceSn);
        console.log('🔍 salt:', settingsResponse.data.salt);
        
        if (!isEnabled) {
            Alert.alert('YeahPay Not Configured', 'Terminal not configured for this outlet');
            setProcessingPayment(false);
            return;
        }
        
        const deviceSn = settingsResponse.data.deviceSn;
        const salt = settingsResponse.data.salt;
        
        if (!deviceSn || !salt) {
            Alert.alert('YeahPay Not Configured', 'Device SN or Salt missing');
            setProcessingPayment(false);
            return;
        }
        
        console.log('📡 Calling YeahPay API with:', { amount: totalAmount, deviceSn });
        
        const result = await processYeahPayCardPayment(totalAmount, deviceSn, salt);
        console.log('YeahPay result:', result);
        
        if (result.success) {
            const saleData = {
                total: totalAmount,
                paymentMethod: 'YeahPay Card',
                items: cart.map(item => ({
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price,
                    category: item.displayCategory || 'Uncategorized'
                })),
                cashier: user?.username || 'Admin',
                outletId: outletId,
                discountType: discountInfo.type,
                discountValue: discountInfo.value,
                discountAmount: discountInfo.amount
            };
            
            const saleResponse = await API.post('/sales', saleData);
            
            setPendingSaleData({
                ...saleData,
                id: saleResponse.data.id,
                invoiceNumber: saleResponse.data.invoiceNumber
            });
            
            setPaymentSuccess(true);
            setTimeout(() => {
                setPaymentSuccess(false);
                setShowPaymentModal(false);
                setProcessingPayment(false);
                setCart([]);
                setShowBillPrompt(true);
                setDiscountInfo({
                    applied: false, type: 'percentage', value: 0, amount: 0,
                    originalTotal: 0, finalTotal: 0
                });
                
            }, 1500);
        } else {
            Alert.alert('Payment Failed', result.msg || 'YeahPay transaction failed');
            setProcessingPayment(false);
        }
    } catch (error) {
        console.log('YeahPay error:', error);
        Alert.alert('Error', 'Payment failed: ' + error.message);
        setProcessingPayment(false);
    }
    return;
}

// ✅ YEAHPAY PAYNOW PAYMENT
// ✅ YEAHPAY PAYNOW PAYMENT
if (payment.name?.toLowerCase().includes('paynow') && 
    payment.name?.toLowerCase().includes('yeahpay')) {
    
    console.log('📱 YeahPay PayNow selected - Name:', payment.name);
    
    const totalAmount =parseFloat(calculateTotal());
    const outletId = await AsyncStorage.getItem('selectedOutletId');
    
    if (!outletId) {
        Alert.alert('Error', 'No outlet selected');
        return;
    }
    
    setProcessingPayment(true);
    setSelectedPayment(payment);
    
    try {
        const settingsResponse = await API.get(`/outlet/yeahpay-settings/${outletId}`);
        
        if (!settingsResponse.data || !settingsResponse.data.enabled) {
            Alert.alert('YeahPay Not Configured', 'Terminal not configured for this outlet');
            setProcessingPayment(false);
            return;
        }
        
        const deviceSn = settingsResponse.data.deviceSn;
        const salt = settingsResponse.data.salt;
        
        console.log('📡 Calling YeahPay PayNow API...');
        const result = await processYeahPayPayNowPayment(totalAmount, deviceSn, salt);
        console.log('PayNow result:', result);
        
        if (result.success) {
            const saleData = {
                total: totalAmount,
                paymentMethod: payment.name,
                items: cart.map(item => ({
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price,
                    category: item.displayCategory || 'Uncategorized'
                })),
                cashier: user?.username || 'Admin',
                outletId: outletId,
                discountType: discountInfo.type,
                discountValue: discountInfo.value,
                discountAmount: discountInfo.amount
            };
            
            const saleResponse = await API.post('/sales', saleData);
            
            setPendingSaleData({
                ...saleData,
                id: saleResponse.data.id,
                invoiceNumber: saleResponse.data.invoiceNumber
            });
            
            setPaymentSuccess(true);
            setTimeout(() => {
                setPaymentSuccess(false);
                setShowPaymentModal(false);
                setProcessingPayment(false);
                setCart([]);
                setShowBillPrompt(true);
                setDiscountInfo({
                    applied: false, type: 'percentage', value: 0, amount: 0,
                    originalTotal: 0, finalTotal: 0
                });
               
            }, 1500);
        } else {
            Alert.alert('Payment Failed', result.msg || 'YeahPay PayNow failed');
            setProcessingPayment(false);
        }
    } catch (error) {
        console.log('YeahPay error:', error);
        Alert.alert('Error', 'Payment failed');
        setProcessingPayment(false);
    }
    return;
}
  if (payment.name === t.cash) {
    setShowPaymentModal(false);
    setShowCashModal(true);
    setCashAmount('');
    setBalanceAmount(0);
    return;
  }
  
  // ✅ Handle UPI payment
  if (payment.id === 'upi' || payment.name === 'UPI') {
    console.log('💰 UPI selected, amount:', totalAmount);
    console.log('💰 UPI Discount info:', {
      applied: discountInfo.applied,
      type: discountInfo.type,
      value: discountInfo.value,
      amount: discountInfo.amount
    });
    setShowPaymentModal(false);
    setShowUPIPayment(true);
    return;
  }
  
  if (payment.id === 'paynow' || payment.name === 'PayNow') {
    console.log('💰 PayNow selected, amount:', totalAmount);
    console.log('💰 PayNow Discount info:', {
      applied: discountInfo.applied,
      type: discountInfo.type,
      value: discountInfo.value,
      amount: discountInfo.amount
    });
    
    try {
      setProcessingPayment(true);
      
      const response = await API.get(`/user/paynow/${user?.id}`);
      const freshQrUrl = response.data.qrCodeUrl || '';
      
      console.log('📡 Fresh PayNow QR from API:', freshQrUrl ? '✅ Found' : '❌ Empty');
      
      if (!freshQrUrl) {
        Alert.alert(
          'PayNow Not Configured', 
          'PayNow QR code not found. Please configure in Payment Settings.'
        );
        setProcessingPayment(false);
        return;
      }
      
      setPayNowQrUrl(freshQrUrl);
      setShowPaymentModal(false);
      setShowPayNowPayment(true);
      setProcessingPayment(false);
      
    } catch (error) {
      console.log('❌ Error loading PayNow QR:', error);
      Alert.alert('Error', 'Failed to load PayNow QR code');
      setProcessingPayment(false);
    }
    
    return;
  }
  
  // ✅ Other payment methods (Card, CDC, etc.) WITH DISCOUNT
  setProcessingPayment(true);
  setProcessingPaymentId(payment.id);
  setSelectedPayment(payment);
  
  try {
    const outletId = await AsyncStorage.getItem('selectedOutletId');
    
    const saleData = {
      total: totalAmount,
      paymentMethod: payment.name,
      items: cart.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        category: item.category || item.displayCategory || 'Uncategorized',
        displayCategory: item.displayCategory || item.category
      })),
      cashier: user?.username || 'Admin',
      outletId: outletId,
      
      // ✅✅✅ ADD DISCOUNT FIELDS ✅✅✅
      discountType: discountInfo.type,
      discountValue: discountInfo.value,
      discountAmount: discountInfo.amount
    };
    
    console.log('💰 Card/Other sale with discount:', {
      total: saleData.total,
      paymentMethod: saleData.paymentMethod,
      discountType: saleData.discountType,
      discountValue: saleData.discountValue,
      discountAmount: saleData.discountAmount
    });
    
    const response = await API.post('/sales', saleData);
    
    const newSale = {
      id: response.data.id || response.data.Id,
      total: response.data.total || response.data.Total,
      paymentMethod: response.data.paymentMethod || response.data.PaymentMethod,
      date: response.data.date || response.data.SaleDate,
      invoiceNumber: response.data.invoiceNumber,
      items: response.data.items || response.data.ItemsJson || [],
      discount: response.data.discount || null
    };
    
    setSalesHistory(prev => [newSale, ...prev]);
    setPaymentSuccess(true);
    
    setTimeout(() => {
      setPaymentSuccess(false);
      setShowPaymentModal(false);
      setProcessingPayment(false);
      setProcessingPaymentId(null);
      setSelectedPayment(null);
      
      setPendingSaleData({
        ...saleData,
        id: newSale.id,
        invoiceNumber: newSale.invoiceNumber,
        discount: {
          type: discountInfo.type,
          value: discountInfo.value,
          amount: discountInfo.amount
        }
      });
      setShowBillPrompt(true);
      
    }, 1500);
    
  } catch (error: any) {
    console.log('❌ Payment error:', error);
    Alert.alert('Error', 'Payment failed');
    setProcessingPayment(false);
    setProcessingPaymentId(null);
  }
};

const handlePayNowSuccess = async () => {
  try {
    // ✅ STEP 1: GET OUTLET ID
    const outletId = await AsyncStorage.getItem('selectedOutletId');
    console.log('📍 PayNow - Outlet ID:', outletId);
    
    const totalAmount = parseFloat(calculateTotal());
    console.log('💰 PayNow - Total amount:', totalAmount);
    console.log('💰 PayNow - Discount info:', {
      applied: discountInfo.applied,
      type: discountInfo.type,
      value: discountInfo.value,
      amount: discountInfo.amount
    });
    
    // ✅ STEP 2: ADD discount fields TO saleData
    const saleData = {
      total: totalAmount,
      paymentMethod: 'PayNow',
      items: cart.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        category: item.category || item.displayCategory || 'Uncategorized',
        displayCategory: item.displayCategory || item.category
      })),
      cashier: user?.username || 'Admin',
      outletId: outletId,
      
      // ✅✅✅ ADD DISCOUNT FIELDS ✅✅✅
      discountType: discountInfo.type,
      discountValue: discountInfo.value,
      discountAmount: discountInfo.amount
    };
    
    console.log('📦 PayNow - Sale data prepared:', {
      total: saleData.total,
      discountType: saleData.discountType,
      discountValue: saleData.discountValue,
      discountAmount: saleData.discountAmount
    });

    const response = await API.post('/sales', saleData);
    console.log('✅ PayNow - API Response:', response.data);
    
    // ✅ STEP 3: STORE outletId AND discount IN PENDING SALE
    setPendingSaleData({
      ...saleData,
      id: response.data.id,
      outletId: outletId,
      invoiceNumber: response.data.invoiceNumber,
      discount: {
        type: discountInfo.type,
        value: discountInfo.value,
        amount: discountInfo.amount
      }
    });
    
    setShowPayNowPayment(false);
    setCart([]);
    setShowBillPrompt(true);
    
    console.log('✅ PayNow - Success, bill prompt shown with discount');
    
  } catch (error: any) {
    console.log('❌ PayNow error:', {
      message: error.message,
      response: error.response?.data
    });
    Alert.alert('Error', 'Failed to save sale');
  }
};
const handleUPISuccess = async () => {
  try {
    // ✅ Log EVERYTHING at start
    console.log('🔍 DEBUG START ==========');
    console.log('1️⃣ Cart before any operation:', JSON.stringify(cart, null, 2));
    console.log('2️⃣ calculateTotal() result:', calculateTotal());
    console.log('3️⃣ Discount info:', {
      applied: discountInfo.applied,
      type: discountInfo.type,
      value: discountInfo.value,
      amount: discountInfo.amount
    });
    
    // ✅ STEP 1: GET OUTLET ID
    const outletId = await AsyncStorage.getItem('selectedOutletId');
    console.log('📍 Outlet ID:', outletId);
    
    const totalAmount = parseFloat(calculateTotal());
    console.log('4️⃣ Parsed totalAmount:', totalAmount);
    
    // ✅ STEP 2: ADD discount fields to saleData
    const saleData = {
      total: totalAmount,
      paymentMethod: 'UPI',
      items: cart.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        category: item.category || item.displayCategory || 'Uncategorized',
        displayCategory: item.displayCategory || item.category
      })),
      cashier: user?.username || 'Admin',
      outletId: outletId,
      
      // ✅✅✅ CRITICAL: ADD DISCOUNT FIELDS ✅✅✅
      discountType: discountInfo.type,
      discountValue: discountInfo.value,
      discountAmount: discountInfo.amount
    };
    
    console.log('5️⃣ Sale data prepared:', JSON.stringify(saleData, null, 2));
    console.log('6️⃣ Discount in sale data:', {
      discountType: saleData.discountType,
      discountValue: saleData.discountValue,
      discountAmount: saleData.discountAmount
    });
    console.log('7️⃣ Items count:', saleData.items.length);
    
    if (saleData.items.length === 0) {
      console.log('❌ No items in cart!');
      Alert.alert('Error', 'Cart is empty');
      return;
    }
    
    const response = await API.post('/sales', saleData);
    console.log('8️⃣ API Response:', response.data);
    
    setPendingSaleData({
      ...saleData,
      id: response.data.id,
      outletId: outletId,
      invoiceNumber: response.data.invoiceNumber,
      discount: {
        type: discountInfo.type,
        value: discountInfo.value,
        amount: discountInfo.amount
      }
    });
    
    console.log('9️⃣ Pending sale data set with ID:', response.data.id);
    console.log('🔟 Discount saved in pending sale:', {
      type: discountInfo.type,
      value: discountInfo.value,
      amount: discountInfo.amount
    });
    
    setShowUPIPayment(false);
    setCart([]);
    setShowBillPrompt(true);
    
    console.log('✅ All done, bill prompt should show total:', totalAmount);
    console.log('🔍 DEBUG END ==========');
    
  } catch (error: any) {
    console.log('❌ UPI success error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    Alert.alert('Error', 'Failed to save sale');
  }
};
// In PosScreen.tsx - Update handlePrintBill


// Keep skip handler same
const handleSkipBill = () => {
  setShowBillPrompt(false);
  setPendingSaleData(null);
  setCart([]);
  Alert.alert('✅ Success', 'Transaction completed!');
};
const handleCashPayment = async (): Promise<void> => {
  const totalAmount = parseFloat(calculateTotal());
  const cashPaid = parseFloat(cashAmount);
  
  if (!cashAmount || isNaN(cashPaid)) {
    Alert.alert(t.error, 'Please enter cash amount');
    return;
  }
  
  if (cashPaid < totalAmount) {
    Alert.alert(t.insufficientCash, `${t.insufficientCash} ${formatPrice(totalAmount)}`);
    return;
  }
  
  const balance = cashPaid - totalAmount;
  setBalanceAmount(balance);
  
  // ✅ STEP 1: Show loading screen IMMEDIATELY
  setShowLoadingScreen(true);
  
  // ✅ STEP 2: Close cash modal immediately
  setShowCashModal(false);
  setSelectedPayment(null);
  setCashAmount('');
  
  // ✅ STEP 3: Clear cart immediately
  setCart([]);
  
  // ✅ STEP 4: Run all background tasks
  try {
    // Get outlet ID
    const outletId = await AsyncStorage.getItem('selectedOutletId');
    
    // Check for open drawers (background)
    if (!hasCheckedDrawer.current) {
      try {
        console.log('🔍 Checking for open drawers...');
        const response = await API.get('/cash-drawer/check-open');
        const openDrawers = response.data.openDrawers || [];
        hasCheckedDrawer.current = true;
        
        openDrawers.forEach((drawer: any) => {
          if (drawer.CurrentDuration > 30) {
            Alert.alert(
              '⚠️ Cash Drawer Open',
              `Drawer opened ${Math.floor(drawer.CurrentDuration)} seconds ago!\nPlease close it.`,
              [
                { text: 'Close Now', onPress: async () => { await API.post('/cash-drawer/close'); } },
                { text: 'OK', style: 'cancel' }
              ]
            );
          }
        });
      } catch (error) {
        console.log('Drawer check error:', error);
        hasCheckedDrawer.current = true;
      }
    }
    
    // Open cash drawer
    const drawerOpened = await UniversalPrinter.openCashDrawer();
    
    let drawerLogId = null;
    if (drawerOpened) {
      try {
        const drawerResponse = await API.post('/cash-drawer/open', {
          totalAmount: totalAmount,
          paymentMethod: 'Cash',
          notes: 'Cash payment'
        });
        drawerLogId = drawerResponse.data.log?.Id;
        console.log('💰 Drawer opened and logged');
      } catch (drawerError) {
        console.log('Drawer log failed');
      }
    }
    
    // Create sale data
    const saleData = {
      total: totalAmount,
      cashPaid: cashPaid,
      paymentMethod: t.cash,
      items: cart.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        category: item.category || item.displayCategory || 'Uncategorized',
        displayCategory: item.displayCategory || item.category
      })),
      change: balance,
      cashier: user?.username || 'Admin',
      outletId: outletId,
      drawerLogId: drawerLogId,
      discountType: discountInfo.type,
      discountValue: discountInfo.value,
      discountAmount: discountInfo.amount
    };

    console.log('💰 Cash Sale with discount:', {
      total: saleData.total,
      discountType: saleData.discountType,
      discountValue: saleData.discountValue,
      discountAmount: saleData.discountAmount
    });

    const response = await API.post('/sales', saleData);
    console.log('✅ Sale saved:', response.data);
    
    const newSale = {
      id: response.data.id || response.data.Id,
      total: response.data.total || response.data.Total || 0,
      paymentMethod: response.data.paymentMethod || response.data.PaymentMethod || '',
      date: response.data.date || response.data.SaleDate || new Date(),
      invoiceNumber: response.data.invoiceNumber,
      items: response.data.items || response.data.ItemsJson || [],
      change: balance,
      cashPaid: cashPaid,
      outletId: outletId,
      discount: response.data.discount || null
    };
    
    setSalesHistory(prev => [newSale, ...prev]);
    
    // Update drawer log
    if (drawerLogId) {
      try {
        await API.put(`/cash-drawer/${drawerLogId}`, {
          saleId: newSale.id,
          totalAmount: totalAmount
        });
      } catch (updateError) {}
    }
    
    // ✅ STEP 5: Hide loading screen
    setShowLoadingScreen(false);
    
    // ✅ STEP 6: Show bill prompt
    setPendingSaleData({
      ...saleData,
      id: newSale.id,
      change: balance,
      cashPaid: cashPaid,
      userId: user?.id,
      outletId: outletId,
      invoiceNumber: newSale.invoiceNumber,
      discount: {
        type: discountInfo.type,
        value: discountInfo.value,
        amount: discountInfo.amount
      }
    });
    setShowBillPrompt(true);
    
    // Reset discount
    setDiscountInfo({
      applied: false,
      type: 'percentage',
      value: 0,
      amount: 0,
      originalTotal: 0,
      finalTotal: 0
    });
    
  } catch (error: any) {
    console.log('❌ Cash payment error:', error);
    setShowLoadingScreen(false);
    Alert.alert('Error', 'Payment failed. Please check sales report.');
  }
};
const loadSalesSummary = useCallback(async () => {
  try {
    let url = '/sales/summary';
    
    if (selectedSalesFilter === 'custom') {
      const start = startDate.toISOString().split('T')[0];
      const end = endDate.toISOString().split('T')[0];
      url += `?filter=custom&startDate=${start}&endDate=${end}`;
    } else {
      url += `?filter=${selectedSalesFilter}`;
    }
    
    console.log('📊 Loading summary:', url);
    const response = await API.get(url);
    setSummary(response.data);
  } catch (error) {
    
  }
}, [selectedSalesFilter, startDate, endDate]);
const setStartDateWrapper = useCallback((date: Date) => {
  setStartDate(date);
}, []);

const setEndDateWrapper = useCallback((date: Date) => {
  setEndDate(date);
}, []);
// Make sure this function is in your component
const loadSalesData = useCallback(async () => {
  try {
    let url = '/sales';
    
    // ✅ Check case-insensitive
    const isCustom = selectedSalesFilter?.toLowerCase() === 'custom';
    
    if (isCustom) {
      const start = startDate.toISOString().split('T')[0];
      const end = endDate.toISOString().split('T')[0];
      url += `?filter=custom&startDate=${start}&endDate=${end}`;
      console.log('📊 Loading custom sales:', start, 'to', end);
    } else {
      // ✅ Send lowercase to backend
      url += `?filter=${selectedSalesFilter?.toLowerCase()}`;
    }
    
    const response = await API.get(url);
    const salesData = Array.isArray(response.data) ? response.data : [];
    
    const formattedSales = salesData.map(sale => ({
      id: sale.id || sale.Id,
      total: sale.total || sale.Total || 0,
      paymentMethod: sale.paymentMethod || sale.PaymentMethod || '',
      date: sale.date || sale.SaleDate || new Date(),
      invoiceNumber: sale.invoiceNumber || sale.InvoiceNumber,
      items: sale.items || sale.ItemsJson || []
    }));
    
    setSalesHistory(formattedSales);
  } catch (error) {
    console.log('❌ Error loading sales:', error);
  }
}, [selectedSalesFilter, startDate, endDate]);// ✅ Proper deps

useEffect(() => {
  if (showSalesReport) {
    console.log('📊 Sales report opened - waiting for POSSalesReport to handle loading');
    // DON'T load data here - let POSSalesReport handle it!
  }
}, [showSalesReport]);

  // Sales Report Functions
  const getFilteredSales = () => {
  return salesHistory; // Now salesHistory comes from database
};


  const formatDate = (date: Date): string => {
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  };

  const formatDisplayDate = (date: Date): string => {
    return date.toLocaleDateString();
  };

 useEffect(() => {
    console.log('🔄 Menu visibility changed:', menuVisible, showSalesReport);
    setIsVisible(menuVisible || showSalesReport);
  }, [menuVisible, showSalesReport]);

// Keep everything else the same

const validateDates = (start: Date, end: Date): boolean => {
  if (start > end) {
    Alert.alert('Error', 'Start date cannot be after end date');
    return false;
  }
  return true;
};

const applyCustomFilter = useCallback(() => {
  if (!validateDates(startDate, endDate)) {
    return;
  }
  
  console.log('📊 Applying custom filter:', {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0]
  });
  setSelectedSalesFilter('custom');
  loadSalesData();
  loadSalesSummary();
}, [loadSalesData, loadSalesSummary]);


 const pickImage = async (setter: (uri: string) => void): Promise<void> => {
    try {
        // ✅ Mark image picker as open
        if (typeof window !== 'undefined' && window.__markImagePickerOpen) {
            console.log('📸 Marking image picker as open');
            window.__markImagePickerOpen();
        }
        
        setImageUploading(true);
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
            base64: false,
        });

        if (!result.canceled && result.assets && result.assets[0]) {
            setter(result.assets[0].uri);
        }
    } catch (error) {
        Alert.alert(t.error, 'Failed to pick image');
    } finally {
        setImageUploading(false);
        
        // ✅ DELAY closing marker to let app fully return to foreground
        setTimeout(() => {
            if (typeof window !== 'undefined' && window.__markImagePickerClose) {
                console.log('📸 Marking image picker as closed (after delay)');
                window.__markImagePickerClose();
            }
        }, 500); // Wait 500ms before marking closed
    }
};
const loadImageWithFallback = async (url: string) => {
  try {
    // Try HTTPS first
    await Image.prefetch(url);
    return url;
  } catch {
    // If HTTPS fails, try HTTP
    const httpUrl = url.replace('https://', 'http://');
    return httpUrl;
  }
};
 const captureImage = async (setter: (uri: string) => void): Promise<void> => {
    try {
        // ✅ Mark camera as open
        if (typeof window !== 'undefined' && window.__markImagePickerOpen) {
            console.log('📸 Marking camera as open');
            window.__markImagePickerOpen();
        }
        
        setImageUploading(true);
        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
            base64: false,
        });

        if (!result.canceled && result.assets && result.assets[0]) {
            setter(result.assets[0].uri);
            Alert.alert(t.success, t.photoCaptured);
        }
    } catch (error) {
        Alert.alert(t.error, 'Failed to capture image');
    } finally {
        setImageUploading(false);
        
        // ✅ DELAY closing marker to let app fully return to foreground
        setTimeout(() => {
            if (typeof window !== 'undefined' && window.__markImagePickerClose) {
                console.log('📸 Marking camera as closed (after delay)');
                window.__markImagePickerClose();
            }
        }, 500); // 500ms delay
    }
};

  // Payment Options
// In PosScreen.tsx, move this to the top with other useMemo declarations
// In PosScreen.tsx - Update paymentOptions useMemo
const paymentOptions = useMemo(() => {
  console.log('💰 Computing paymentOptions from:', userPaymentModes);
  
  if (!userPaymentModes || userPaymentModes.length === 0) {
    console.log('⚠️ No payment modes available - using defaults');
    return [];
  }
  
  // Filter only active modes AND EXCLUDE DISCOUNT
  const activeModes = userPaymentModes.filter(mode => 
    mode.isActive === true && mode.id !== 'discount'
  );
  
  console.log('✅ Active payment modes (discount hidden):', activeModes.map(m => m.name));
  
  // Sort by order
  return activeModes.sort((a, b) => (a.order || 0) - (b.order || 0));
}, [userPaymentModes]);

// ✅ Separate discountEnabled state for cart button
useEffect(() => {
  // Check if discount mode is active
  const discountMode = userPaymentModes.find(m => m.id === 'discount');
  setDiscountEnabled(discountMode?.isActive || false);
}, [userPaymentModes]);
// In PosScreen.tsx - Add this useEffect
useEffect(() => {
  if (user?.id) {
    // Force load payment modes after outlet selected
    const loadModes = async () => {
      const outletId = await AsyncStorage.getItem('selectedOutletId');
      if (outletId) {
        await loadPaymentModes(true);
      }
    };
    loadModes();
  }
}, [user?.id, showOutletSelector]); // Re-run when outlet selector closes
useEffect(() => {
  console.log('💳 paymentOptions computed:', 
    paymentOptions.map(o => ({ name: o.name, icon: o.icon }))
  );
}, [paymentOptions]);
  // Dish Group Functions
 const handleAddGroup = async (): Promise<void> => {
  if (!newGroupName.trim()) {
    Alert.alert(t.error, 'Please enter group name');
    return;
  }

  setLoading(true);
  try {
    const response = await API.post('/dishgroups', {
      name: newGroupName.trim(),
      active: formActive
    });
    
    console.log('✅ Add group response:', response.data);
    
    // ✅ Get the new group with DisplayOrder from backend
    const newGroup = {
      id: response.data.Id,
      name: response.data.Name,
      itemCount: 0,
      active: response.data.active ?? formActive,
      DisplayOrder: response.data.DisplayOrder ?? dishGroups.length // Use backend order or append
    };
    
    // ✅ Add new group to the END of list
    const updatedGroups = [...dishGroups, newGroup];
    
    // ✅ Sort by DisplayOrder (though new group should be at end)
    updatedGroups.sort((a, b) => {
      const orderA = a.DisplayOrder ?? 999;
      const orderB = b.DisplayOrder ?? 999;
      return orderA - orderB;
    });
    
    setDishGroups(updatedGroups);
    
    // ✅ Update categories in same order
    const updatedCategories = updatedGroups
      .filter(g => g.active !== false)
      .map(g => g.name);
    setCategories(updatedCategories);
    
    setNewGroupName('');
    setFormActive(true);
    setShowAddGroup(false);
    
    // ✅ Save new order to backend (optional - backend already has order)
    const orderData = updatedGroups.map((group, index) => ({
      id: group.id,
      order: index
    }));
    
    try {
      await API.post('/dishgroups/update-order', { groups: orderData });
      console.log('✅ Order synced after add');
    } catch (orderError) {
      console.log('⚠️ Order sync failed:', orderError);
    }
    
    onGroupUpdate();
    Alert.alert('✅ Success', `${newGroupName} added successfully`);
    
  } catch (error) {
    console.log('❌ Add group error:', error);
    Alert.alert(t.error, 'Failed to add dish group');
  } finally {
    setLoading(false);
  }
};

  const handleEditGroup = async (): Promise<void> => {
    if (!editingGroup || !newGroupName.trim()) return;

    setLoading(true);
    try {
      const response = await API.put(`/dishgroups/${editingGroup.id}`, {
        name: newGroupName.trim(),
        active: formActive
      });

      const oldName = editingGroup.name;
      
      // Update groups
      const updatedGroups = dishGroups.map(group =>
        group.id === editingGroup.id
          ? { ...group, name: newGroupName.trim(), active: formActive }
          : group
      );
      setDishGroups(updatedGroups);

      // Update categories (preserve order)
      const updatedCategories = categories.map(cat =>
        cat === oldName ? newGroupName.trim() : cat
      );
      setCategories(updatedCategories);

      // ✅ FIX: Update ALL dish items that belong to this category
      const updatedMenuItems = menuItems.map(item => {
        // Check if item belongs to this category
        if (item.displayCategory === oldName || 
            item.category === oldName || 
            item.originalCategory === oldName) {
          return {
            ...item,
            displayCategory: newGroupName.trim(),
            category: newGroupName.trim(),
            originalCategory: newGroupName.trim(),
            categoryName: newGroupName.trim()
          };
        }
        return item;
      });
      
      setMenuItems(updatedMenuItems);
      console.log(`✅ Updated ${updatedMenuItems.length} items from "${oldName}" to "${newGroupName}"`);

      // Update active category if needed
      if (oldName === activeCategory) {
        setActiveCategory(newGroupName.trim());
      }

      setEditingGroup(null);
      setNewGroupName('');
      setFormActive(true);
      setShowEditGroup(false);
      
      onGroupUpdate();
      
    } catch (error: any) {
      console.log('❌ Edit group error:', error);
      Alert.alert(t.error || '❌ Error', 'Failed to edit dish group');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = (group: any): void => {
    Alert.alert(
      t.delete,
      `${t.confirmDelete} "${group.name}"? ${t.thisWillDelete}`,
      [
        { text: t.no, style: 'cancel' },
        {
          text: t.yes,
          style: 'destructive',
          onPress: () => {
            const updatedGroups = dishGroups.filter(g => g.id !== group.id);
            const updatedCategories = categories.filter(cat => cat !== group.name);
            const updatedMenuItems = menuItems.filter(item => item.category !== group.name);
            
            setDishGroups(updatedGroups);
            setCategories(updatedCategories);
            setMenuItems(updatedMenuItems);
            
            if (activeCategory === group.name && updatedCategories.length > 0) {
              setActiveCategory(updatedCategories[0]);
            }
            
            Alert.alert(t.success, `${group.name} ${t.deleteSuccess}`);
          }
        }
      ]
    );
  };

 // Modify handleAddDish to save to database with image
// Modify handleAddDish to save to database with image

// Add this test function in your PosScreen.tsx
const testSunmiNow = async () => {
  try {
    Alert.alert('Testing', 'Checking Sunmi printer...');
    
    // Try to load Sunmi printer
    const SunmiPrinter = require('react-native-sunmi-inner-printer');
    
    // Check if printer exists
    const hasPrinter = await SunmiPrinter.hasPrinter();
    console.log('🖨️ Has printer:', hasPrinter);
    
    if (hasPrinter) {
      // Initialize printer
      await SunmiPrinter.initPrinter();
      
      // Test print
      await SunmiPrinter.printText('=== SUNMI V3 TEST ===\n');
      await SunmiPrinter.printText(`Shop: ${user?.shopName || 'POS'}\n`);
      await SunmiPrinter.printText(`Date: ${new Date().toLocaleString()}\n`);
      await SunmiPrinter.printText('✅ Printer working!\n\n');
      
      // Cut paper
      await SunmiPrinter.cutPaper();
      
      Alert.alert('✅ Success', 'Printer test completed!');
    } else {
      Alert.alert('❌ Error', 'No printer found');
    }
  } catch (error: any) {
    console.log('❌ Test error:', error);
    Alert.alert('❌ Error', error.message);
  }
};
useEffect(() => {
  console.log('📢 priceModal state changed:', priceModal);
}, [priceModal]);

const handleOpenPriceItem = (item: any) => {
  console.log('🔥🔥🔥 handleOpenPriceItem CALLED with:', item.name);
  
  // Force modal to open
  setPriceModal({
    visible: true,
    item: item,
    price: ''
  });
  
  // Add this to verify state change
  console.log('📢 priceModal after set:', {
    visible: true,
    item: item.name,
    price: ''
  });
};

 const modalContent = useMemo(() => {
    if (!priceModal.visible) return null;
    
    return (
      <Modal
        visible={true}  // Force visible when priceModal.visible is true
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPriceModal({ visible: false, item: null, price: '' })}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.priceModalContent, { backgroundColor: currentTheme.card }]}>
            
            <View style={styles.priceModalHeader}>
              <Text style={[styles.priceModalTitle, { color: currentTheme.text }]}>
                Enter Price
              </Text>
              <TouchableOpacity 
                onPress={() => setPriceModal({ visible: false, item: null, price: '' })}
              >
                <Ionicons name="close" size={24} color={currentTheme.text} />
              </TouchableOpacity>
            </View>

            {priceModal.item && (
              <View style={styles.itemInfoContainer}>
                {priceModal.item.imageUri && (
                  <Image 
                    source={{ uri: priceModal.item.imageUri }} 
                    style={styles.modalItemImage} 
                  />
                )}
                <Text style={[styles.modalItemName, { color: currentTheme.text }]}>
                  {priceModal.item.name}
                </Text>
              </View>
            )}

            <View style={styles.priceInputContainer}>
              <Text style={[styles.currencySymbol, { color: currentTheme.primary }]}>
                {currencySymbol}
              </Text>
              <TextInput
                style={[styles.priceInput, { 
                  backgroundColor: currentTheme.surface,
                  color: currentTheme.text,
                  borderColor: currentTheme.border
                }]}
                placeholder="0.00"
                placeholderTextColor={currentTheme.textSecondary}
                keyboardType="numeric"
                value={priceModal.price}
                onChangeText={(text) => setPriceModal({ ...priceModal, price: text })}
                autoFocus={true}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickAmountScroll}>
              {[10, 20, 50, 100, 200].map(amount => (
                <TouchableOpacity
                  key={amount}
                  style={[styles.quickAmountBtn, { 
                    backgroundColor: currentTheme.surface,
                    borderColor: currentTheme.border 
                  }]}
                  onPress={() => setPriceModal({ ...priceModal, price: amount.toString() })}
                >
                  <Text style={[styles.quickAmountText, { color: currentTheme.text }]}>
                    {formatPrice(amount)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.priceModalButtons}>
              <TouchableOpacity
                style={[styles.priceModalBtn, styles.cancelBtn, { 
                  borderColor: currentTheme.border,
                  backgroundColor: currentTheme.surface
                }]}
                onPress={() => setPriceModal({ visible: false, item: null, price: '' })}
              >
                <Text style={[styles.cancelBtnText, { color: currentTheme.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.priceModalBtn, styles.addBtn, { 
                  backgroundColor: currentTheme.primary 
                }]}
                onPress={handlePriceSubmit}
              >
                <Text style={styles.addBtnText}>
                  Add to Cart
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }, [priceModal.visible, priceModal.item, priceModal.price, currentTheme]);
// Also add this useEffect
useEffect(() => {
  console.log('📢 MenuGrid - onOpenPriceItem prop:', !!handleOpenPriceItem);
}, []);


// ✅ ADD THIS FUNCTION
// In PosScreen.tsx - Update this function
const handlePriceSubmit = () => {
  if (!priceModal.item) return;
  
  const price = parseFloat(priceModal.price);
  if (isNaN(price) || price <= 0) {
    Alert.alert('Error', 'Please enter valid price');
    return;
  }
  
  addToCart(priceModal.item, price);
  setPriceModal({ visible: false, item: null, price: '' });  // ✅ Using priceModal
};
const calculateTotalWithoutDiscount = (): string => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2);
};
const checkPrinterStatus = async () => {
  try {
    const SunmiPrinter = require('react-native-sunmi-inner-printer');
    
    const hasPrinter = await SunmiPrinter.hasPrinter();
    console.log('🔍 Printer hardware:', hasPrinter);
    
    if (hasPrinter) {
      const status = await SunmiPrinter.getPrinterStatus();
      console.log('📊 Printer status:', status);
  
      
      Alert.alert('Printer Status', `Status: ${status}`);
    }
  } catch (error) {
    console.log('❌ Status check failed:', error);
  }
};
const handlePrintBill = async () => {
  console.log('🔴 STEP 1: START');
  
  if (!pendingSaleData || !user?.id) {
    console.log('❌ No pending sale data or user id');
    Alert.alert('Error', 'No sale data found');
    return;
  }
  
  console.log('🔴 STEP 2: pendingSaleData =', pendingSaleData);
  console.log('🔴 STEP 3: user.id =', user?.id);
  
  const outletId = await AsyncStorage.getItem('selectedOutletId');
  console.log('🔴 STEP 4: outletId =', outletId);
  
  if (!outletId) {
    console.log('❌ No outlet ID found');
    Alert.alert('Error', 'No outlet selected');
    return;
  }
  
  const discountData = discountInfo.applied ? {
    applied: discountInfo.applied,
    type: discountInfo.type,
    value: discountInfo.value,
    amount: discountInfo.amount
  } : undefined;
  
  console.log('🔴 STEP 5: discountData =', discountData);
  
  try {
    console.log('🔴 STEP 6: Calling UniversalPrinter.smartPrint...');
    const printed = await UniversalPrinter.smartPrint(
      pendingSaleData,
      outletId,
      t,
      discountData
    );
    
    console.log('🔴 STEP 7: smartPrint result =', printed);
    
    if (printed) {
      console.log('✅ Print completed');
      setShowBillPrompt(false);
      setPendingSaleData(null);
      setCart([]);
      setDiscountInfo({
        applied: false,
        type: 'percentage',
        value: 0,
        amount: 0,
        originalTotal: 0,
        finalTotal: 0
      });
      Alert.alert('✅ Success', 'Bill printed successfully!');
    } else {
      console.log('❌ Print returned false');
      Alert.alert('⚠️ Warning', 'Print failed, but sale is saved');
    }
    
  } catch (error) {
    console.log('❌ Print error:', error);
    Alert.alert('Error', 'Failed to print bill: ' + (error?.message || 'Unknown error'));
  }
};
const testSunmiConnection = async () => {
  try {
    console.log('🔍 Testing Sunmi printer...');
    
    // Step 1: Check if library loaded
    const SunmiPrinter = require('react-native-sunmi-inner-printer');
    console.log('📚 Library loaded:', !!SunmiPrinter);
    
    // Step 2: Check printer hardware
    const hasPrinter = await SunmiPrinter.hasPrinter?.();
    console.log('🖨️ Has printer hardware:', hasPrinter);
    
    if (hasPrinter) {
      // Step 3: Initialize
      await SunmiPrinter.initPrinter?.();
      console.log('✅ Printer initialized');
      
      // Step 4: Get status
      const status = await SunmiPrinter.getPrinterStatus?.();
      console.log('📊 Printer status:', status);
      
      // Step 5: Test print
      await SunmiPrinter.printText?.('=== SUNMI V3 TEST ===\n');
      await SunmiPrinter.printText?.(`Date: ${new Date().toLocaleString()}\n`);
      await SunmiPrinter.printText?.('Test print successful!\n\n');
      
      Alert.alert('✅ Success', 'Sunmi printer working!');
    } else {
      Alert.alert('❌ Error', 'No printer hardware found');
    }
  } catch (error) {
    console.log('❌ Sunmi test error:', error);
    Alert.alert('❌ Error', 'Printer not responding');
  }
};
  

  const total = calculateTotal();

  // Render Functions
  const renderDishGroupManagement = () => (
<DishGroupManagement
    dishGroups={dishGroups}
    setDishGroups={setDishGroups}
    categories={categories}
    setCategories={setCategories}
    setActiveCategory={setActiveCategory}
    currentTheme={currentTheme}
    t={t}
    onGroupUpdate={onGroupUpdate}  // ✅ Use the function reference
/>
);


 const renderDishItemsManagement = () => (
  <DishItemsManagement
    menuItems={menuItems}
    setMenuItems={setMenuItems}
    categories={categories}
    dishGroups={dishGroups}
    setDishGroups={setDishGroups}
    currentTheme={currentTheme}
    t={t}
    onItemUpdate={async () => {  // ✅ Make it async
      console.log('🔄 Item updated - forcing reload...');
      
      // ✅ Force reload with true parameter
      await loadDishGroups(true);
      await loadDishItems(true);
      
      // ✅ Force UI refresh
      setMenuRefreshKey(prev => prev + 1);
      
      console.log('✅ Data reloaded, images should appear!');
    }}
    imageUploading={imageUploading}
    setImageUploading={setImageUploading}
    pickImage={pickImage}
    captureImage={captureImage}
  />
);

 const renderMainMenu = () => (
  <ScrollView 
    style={{ flex: 1 }}
    contentContainerStyle={[styles.menuContent, { backgroundColor: currentTheme.background }]}
    showsVerticalScrollIndicator={true}
  >
    <TouchableOpacity 
      style={[styles.backToMainBtn, { backgroundColor: currentTheme.primary }]}
      onPress={() => {
        setMenuVisible(false);
        setActiveMenu('main');
      }}
    >
      <Text style={styles.backToMainBtnText}>{t.backToMain}</Text>
    </TouchableOpacity>

    <TouchableOpacity 
      style={[styles.menuItemBtn, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}
      onPress={() => setActiveMenu('dishgroup')}
    >
      <Text style={[styles.menuItemBtnText, { color: currentTheme.text }]}>{t.dishGroup}</Text>
    </TouchableOpacity>
    
    <TouchableOpacity 
      style={[styles.menuItemBtn, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}
      onPress={() => setActiveMenu('dishitems')}
    >
      <Text style={[styles.menuItemBtnText, { color: currentTheme.text }]}>{t.dishItems}</Text>
    </TouchableOpacity>

    <TouchableOpacity 
      style={[styles.menuItemBtn, styles.salesReportBtn, { backgroundColor: currentTheme.secondary }]}
      onPress={() => {
        setMenuVisible(false);
        setShowSalesReport(true);
      }}
    >
      <Text style={styles.menuItemBtnText}>{t.salesReport}</Text>
    </TouchableOpacity>
    
    {/* Day End Button */}
    <TouchableOpacity 
    style={[styles.menuItemBtn, styles.dayEndBtn, { 
        backgroundColor: '#FF4444',
        borderColor: currentTheme.border,
        marginTop: 10
    }]}
    onPress={() => {
        setMenuVisible(false);
        setShowDayEndModal(true);
    }}
>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="calendar-outline" size={20} color="#fff" />
        <Text style={[styles.menuItemBtnText, { color: '#fff', marginLeft: 8 }]}>
            Day End
        </Text>
    </View>
</TouchableOpacity>

    <TouchableOpacity 
      style={[styles.menuItemBtn, { 
        backgroundColor: currentTheme.secondary,
        borderColor: currentTheme.border,
        marginTop: 10
      }]}
      onPress={() => {
        setMenuVisible(false);
        setShowCompanySettings(true);
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="business-outline" size={20} color="#fff" />
        <Text style={[styles.menuItemBtnText, { color: '#fff', marginLeft: 8 }]}>
          {t.companySettings}
        </Text>
      </View>
    </TouchableOpacity>
 
    {/* Payment Settings Button */}
    <TouchableOpacity 
      style={[styles.menuItemBtn, { 
        backgroundColor: currentTheme.secondary,
        borderColor: currentTheme.border,
        marginTop: 10
      }]}
      onPress={() => {
        setMenuVisible(false);
        setShowPayModeSettings(true);
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="settings-outline" size={20} color="#fff" />
        <Text style={[styles.menuItemBtnText, { color: '#fff', marginLeft: 8 }]}>
          {t.paymentModes}
        </Text>
      </View>
    </TouchableOpacity>

    {/* BOTTOM COMPANY INFO */}
    <View style={[styles.bottomInfo, { borderTopColor: currentTheme.border, marginTop: 10 }]}>
      
      {/* Shop Name */}
      <View style={styles.bottomRow}>
        <Text style={[styles.bottomShopName, { color: currentTheme.text }]}>
          {user?.shopName || ''}
        </Text>
      </View>

      {/* License Key */}
      <View style={styles.bottomRow}>
        <Text style={[styles.bottomLabel, { color: currentTheme.textSecondary }]}>
          {t.licenseKey || 'License'}:
        </Text>
        <Text style={[styles.bottomValue, { color: currentTheme.primary }]}>
          {licenseInfo?.LicenseKey || 'N/A'}
        </Text>
      </View>

      {/* Expiry Date */}
      <View style={styles.bottomRow}>
        <Text style={[styles.bottomLabel, { color: currentTheme.textSecondary }]}>
          {t.expiresOn || 'Expires'}:
        </Text>
        <Text style={[styles.bottomValue, { color: currentTheme.text }]}>
          {licenseInfo?.ExpiryDate 
            ? licenseInfo.ExpiryDate.substring(0, 10).split('-').reverse().join('/') 
            : 'N/A'}
        </Text>
      </View>

      {/* Countdown Timer */}
      <View style={[styles.countdownBox, { backgroundColor: currentTheme.surface }]}>
        <Text style={[styles.countdownLabel, { color: currentTheme.textSecondary }]}>
          ⏱️ {t.timeLeft || 'Time Left'}:
        </Text>
        <Text style={[styles.countdownTimer, { color: currentTheme.primary }]}>
          {String(timeLeft.days).padStart(2, '0')}d : {String(timeLeft.hours).padStart(2, '0')}h : 
          {String(timeLeft.minutes).padStart(2, '0')}m : {String(timeLeft.seconds).padStart(2, '0')}s
        </Text>
      </View>

      {/* Divider */}
      <View style={[styles.companyDivider, { backgroundColor: currentTheme.border }]} />

      {/* Company Logo and Name */}
      <View style={styles.companyHeader}>
        <View style={[styles.companyLogoContainer, { backgroundColor: currentTheme.surface }]}>
          <Image 
            source={companyLogo}
            style={styles.companyLogoImage}
            resizeMode="contain"
            onError={(error) => console.log('Logo load error:', error)}
          />
        </View>
        <Text style={[styles.companyName, { color: currentTheme.text }]}>
          SMART HAWKER BY UNIPROSG
        </Text>
      </View>

      {/* Copyright */}
      <Text style={[styles.copyright, { color: currentTheme.textSecondary }]}>
        Copyright © 2026 - 2027 UNIPRO SOFTWARES SG PTE LTD. All rights Reserved.
      </Text>
    </View>
    
    {/* Bottom padding for scroll */}
    <View style={{ height: 20 }} />
  </ScrollView>
);

// In PosScreen.tsx - Replace your renderPaymentModal with this

const renderPaymentModal = () => (
  <Modal
    visible={showPaymentModal}
    transparent={true}
    animationType="slide"
    onRequestClose={() => {
      if (!processingPayment) {
        setShowPaymentModal(false);
      }
    }}
  >
    <View style={styles.paymentModalOverlay}>
      <View style={[styles.paymentModalContent, isMobile && styles.paymentModalContentMobile, { backgroundColor: currentTheme.card }]}>
        
        {/* Header */}
        <View style={styles.paymentModalHeader}>
          <Text style={[styles.paymentModalTitle, { color: currentTheme.text }]}>
            {processingPayment ? 'Processing Payment' : t.selectPaymentMethod}
          </Text>
          <TouchableOpacity 
            style={styles.paymentModalClose}
            onPress={() => {
              if (!processingPayment) {
                setShowPaymentModal(false);
              }
            }}
          >
            <Text style={[styles.paymentModalCloseText, { color: currentTheme.textSecondary }]}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Amount */}
        <View style={[styles.paymentAmountContainer, { backgroundColor: currentTheme.surface }]}>
          <Text style={[styles.paymentAmountLabel, { color: currentTheme.textSecondary }]}>
            {t.totalAmount}
          </Text>
          <Text style={[styles.paymentAmountValue, { color: currentTheme.primary }]}>
            {formatPrice(parseFloat(total))}
          </Text>
        </View>

        {/* Loading or Payment Options */}
        {processingPayment ? (
          <View style={styles.paymentSuccessContainer}>
            <ActivityIndicator size="large" color={currentTheme.primary} />
            <Text style={[styles.processingText, { color: currentTheme.text }]}>
              Processing {selectedPayment?.name} payment...
            </Text>
            <Text style={[styles.processingSubText, { color: currentTheme.textSecondary }]}>
              Please wait
            </Text>
          </View>
        ) : (
          <>
            {/* Payment Options */}
            {paymentOptions.length > 0 ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                {paymentOptions.map((option) => (
                  <TouchableOpacity
                    key={`payment-${option.id}`}
                    style={[styles.paymentOptionCard, { 
                      backgroundColor: currentTheme.surface, 
                      borderColor: currentTheme.border,
                      opacity: processingPayment && processingPaymentId === option.id ? 0.5 : 1
                    }]}
                    onPress={() => handlePaymentSelect(option)}
                    disabled={processingPayment}
                  >
                    <View style={styles.paymentOptionLeft}>
                      <Text style={styles.paymentOptionIcon}>{option.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.paymentOptionName, { color: currentTheme.text }]}>
                          {option.name}
                        </Text>
                        <Text style={[styles.paymentOptionDescription, { color: currentTheme.textSecondary }]}>
                          {option.description}
                        </Text>
                      </View>
                    </View>
                    {processingPayment && processingPaymentId === option.id ? (
                      <ActivityIndicator size="small" color={currentTheme.primary} />
                    ) : (
                      <Text style={[styles.paymentOptionArrow, { color: currentTheme.textSecondary }]}>→</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.noPaymentModes}>
                <Text style={[styles.noPaymentText, { color: currentTheme.textSecondary }]}>
                  No payment modes configured. Please add in Payment Settings.
                </Text>
              </View>
            )}
          </>
        )}

        {/* Cancel Button - Hide during processing */}
        {!processingPayment && (
          <TouchableOpacity 
            style={[styles.paymentCancelBtn, { backgroundColor: currentTheme.surface }]}
            onPress={() => setShowPaymentModal(false)}
          >
            <Text style={[styles.paymentCancelText, { color: currentTheme.text }]}>
              {t.cancel}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  </Modal>
);

const renderCashModal = () => (
  <Modal
    visible={showCashModal}
    transparent={true}
    animationType="slide"
    onRequestClose={() => setShowCashModal(false)}
  >
    <View style={styles.paymentModalOverlay}>
      <ScrollView 
        style={styles.cashModalScrollView}
        contentContainerStyle={styles.cashModalScrollContent}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.paymentModalContent, isMobile && styles.paymentModalContentMobile, { backgroundColor: currentTheme.card }]}>
          
          <View style={styles.paymentModalHeader}>
            <Text style={[styles.paymentModalTitle, { color: currentTheme.text }]}>{t.cash}</Text>
            <TouchableOpacity 
              style={styles.paymentModalClose}
              onPress={() => {
                setShowCashModal(false);
                setCashAmount('');
              }}
            >
              <Text style={[styles.paymentModalCloseText, { color: currentTheme.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Amount Display */}
          <View style={[styles.paymentAmountContainer, { backgroundColor: currentTheme.surface }]}>
            <Text style={[styles.paymentAmountLabel, { color: currentTheme.textSecondary }]}>{t.totalAmount}</Text>
            <Text style={[styles.paymentAmountValue, { color: currentTheme.primary }]}>
              {formatPrice(parseFloat(total))}
            </Text>
          </View>

          {/* Cash Input */}
          <View style={styles.cashInputContainer}>
            <Text style={[styles.cashInputLabel, { color: currentTheme.text }]}>{t.cashReceived}</Text>
            <View style={[styles.cashInputWrapper, { borderColor: currentTheme.primary }]}>
              <Text style={[styles.cashInputCurrency, { color: currentTheme.primary }]}>
                {currencySymbol || '$'}
              </Text>
              <TextInput
                style={[styles.cashInput, { color: currentTheme.text }]}
                placeholder="0.00"
                placeholderTextColor={currentTheme.textSecondary}
                keyboardType="numeric"
                value={cashAmount}
                onChangeText={setCashAmount}
                autoFocus={true}
              />
            </View>
          </View>

          {/* Balance Display */}
          {cashAmount !== '' && !isNaN(parseFloat(cashAmount)) && (
            <View style={[styles.balanceContainer, { backgroundColor: currentTheme.surface }]}>
              <Text style={[styles.balanceLabel, { color: currentTheme.textSecondary }]}>
                {parseFloat(cashAmount) >= parseFloat(total) ? t.balanceToReturn : t.additionalNeeded}
              </Text>
              <Text style={[
                styles.balanceValue,
                parseFloat(cashAmount) >= parseFloat(total) ? { color: currentTheme.success } : { color: currentTheme.danger }
              ]}>
                {formatPrice(Math.abs(parseFloat(cashAmount) - parseFloat(total)))}
              </Text>
              {parseFloat(cashAmount) < parseFloat(total) && (
                <Text style={[styles.balanceWarning, { color: currentTheme.danger }]}>
                  {t.insufficientCash} {formatPrice(parseFloat(total) - parseFloat(cashAmount))} {t.more}
                </Text>
              )}
            </View>
          )}

          {/* Quick Amount Buttons */}
          <View style={styles.quickAmountContainer}>
            <Text style={[styles.quickAmountLabel, { color: currentTheme.text }]}>
              {t.quickCash || 'Quick Cash'}
            </Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={true}
              style={styles.quickAmountScroll}
              contentContainerStyle={styles.quickAmountContent}
            >
              {[10, 20, 50, 100, 200, 500].map(amount => (
                <TouchableOpacity
                  key={amount}
                  style={[styles.quickAmountBtn, { 
                    backgroundColor: currentTheme.surface,
                    borderColor: currentTheme.border,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 20,
                    borderWidth: 1,
                    minWidth: 70,
                    alignItems: 'center',
                    marginRight: 8,
                  }]}
                  onPress={() => setCashAmount(amount.toString())}
                >
                  <Text style={[styles.quickAmountBtnText, { color: currentTheme.text, fontSize: 14, fontWeight: '600' }]}>
                    {formatPrice(amount)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Buttons - Only Cancel and Confirm */}
          <View style={styles.cashModalButtons}>
            <TouchableOpacity 
              style={[styles.cashModalBtn, styles.cashModalCancel, { backgroundColor: currentTheme.surface, borderColor: currentTheme.border, flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' }]}
              onPress={() => {
                setShowCashModal(false);
                setCashAmount('');
              }}
            >
              <Text style={[styles.cashModalCancelText, { color: currentTheme.text, fontSize: 16, fontWeight: '600' }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.cashModalBtn, 
                styles.cashModalConfirm,
                { backgroundColor: currentTheme.success, flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
                (!cashAmount || parseFloat(cashAmount) < parseFloat(total)) && { backgroundColor: currentTheme.inactive, opacity: 0.5 }
              ]}
              onPress={handleCashPayment}
              disabled={!cashAmount || parseFloat(cashAmount) < parseFloat(total)}
            >
              <Text style={[styles.cashModalConfirmText, { color: '#fff', fontSize: 16, fontWeight: '700' }]}>Confirm Payment</Text>
            </TouchableOpacity>
          </View>
          
        </View>
      </ScrollView>
    </View>
  </Modal>
);

  const renderMenuContent = () => {
    switch(activeMenu) {
      case 'dishgroup':
        return renderDishGroupManagement();
      case 'dishitems':
        return renderDishItemsManagement();
      default:
        return renderMainMenu();
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <StatusBar 
        barStyle={theme === 'night' ? 'light-content' : 'dark-content'} 
        backgroundColor={currentTheme.header}
      />
      
      {/* Header */}
      <View style={[
        styles.header,
        { backgroundColor: currentTheme.header, borderBottomColor: currentTheme.border }
      ]}>
        <View style={styles.headerLeft}>
          {/* Home Button with Dropdown */}
          <TouchableOpacity 
            style={styles.homeButton}
            onPress={() => setShowHomeMenu(!showHomeMenu)}
          >
            <Entypo name="home" size={24} color={currentTheme.headerText} />
          </TouchableOpacity>

          {/* Home Dropdown Menu */}
          {showHomeMenu && (
            <View style={[styles.homeDropdown, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
              <TouchableOpacity 
                style={styles.dropdownItem}
                onPress={() => {
                  setShowHomeMenu(false);
                  setProfileMode('full');
                  setShowProfileModal(true);
                  setProfileTab('theme');
                }}
              >
                <Text style={styles.dropdownIcon}>🎨</Text>
                <Text style={[styles.dropdownText, { color: currentTheme.text }]}>{t.selectTheme}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.dropdownItem}
                onPress={() => {
                  setShowHomeMenu(false);
                  setProfileMode('full');
                  setShowProfileModal(true);
                  setProfileTab('language');
                }}
              >
                <Text style={styles.dropdownIcon}>🌐</Text>
                <Text style={[styles.dropdownText, { color: currentTheme.text }]}>{t.selectLanguage}</Text>
              </TouchableOpacity>
              
              <View style={[styles.dropdownDivider, { backgroundColor: currentTheme.border }]} />
                 
    
    <View style={[styles.dropdownDivider, { backgroundColor: currentTheme.border }]} />

              <TouchableOpacity 
                style={styles.dropdownItem}
                onPress={() => {
                  setShowHomeMenu(false);
                  setProfileMode('logout');
                  setShowProfileModal(true);
                }}
              >
                <Text style={styles.dropdownIcon}>👤</Text>
                <Text style={[styles.dropdownText, { color: currentTheme.text }]}>{t.profile}</Text>
              </TouchableOpacity>
             
            </View>
          )}
        </View>
        
      <View style={styles.headerCenter}>
    {/* Make outlet name clickable for owners */}
    <TouchableOpacity 
        onPress={() => {
            if (user?.role === 'owner') {
                setShowOutletDropdown(!showOutletDropdown);
            }
        }}
        style={styles.outletNameContainer}
        activeOpacity={user?.role === 'owner' ? 0.7 : 1}
    >
        <Text style={[styles.registerText, { color: currentTheme.headerText }]}>
            {/* Show dropdown arrow for owners */}
            {user?.role === 'owner' ? '▼ ' : ''}
            {user?.role === 'staff' 
                ? user?.shopName 
                : (outletInfo?.name || user?.shopName || 'POS System')
            }
        </Text>
        
        {/* Only show license for owners with outlet */}
        {user?.role === 'owner' && outletInfo?.license && (
            <Text style={[styles.licenseText, { color: currentTheme.headerText + 'CC' }]}>
                {outletInfo.license}
            </Text>
        )}
        
        {user?.role === 'owner' && outletInfo?.expiry && (
            <Text style={[styles.expiryText, { color: currentTheme.headerText + 'AA' }]}>
                Expires: {new Date(outletInfo.expiry).toLocaleDateString()}
            </Text>
        )}
    </TouchableOpacity>
    
    {/* Outlet Dropdown for owners */}
{showOutletDropdown && user?.role === 'owner' && (
  <View style={[styles.outletDropdown, { 
    backgroundColor: currentTheme.card,
    borderColor: currentTheme.border,
    top: 60
  }]}>
    <Text style={[styles.dropdownTitle, { color: currentTheme.textSecondary }]}>
      Select Outlet
    </Text>
    
    {outlets?.length > 0 ? (  // ← Use outlets from context!
      outlets.map(outlet => (
        <TouchableOpacity
          key={outlet.Id}
          style={[
            styles.outletOption,
            outlet.Id === outletInfo?.id && { 
              backgroundColor: currentTheme.primary + '20' 
            }
          ]}
          onPress={async () => {
            setShowOutletDropdown(false);
            await switchOutlet(outlet);
          }}
        >
          <View style={styles.outletOptionLeft}>
            <Text style={[styles.outletOptionName, { color: currentTheme.text }]}>
              {outlet.name}
            </Text>
            <Text style={[styles.outletOptionStaff, { color: currentTheme.textSecondary }]}>
              Staff: {outlet.staffUsername || '—'}
            </Text>
          </View>
          {outlet.LicenseActive ? (
            <Text style={[styles.outletBadge, { color: currentTheme.success }]}>✅</Text>
          ) : (
            <Text style={[styles.outletBadge, { color: currentTheme.danger }]}>❌</Text>
          )}
        </TouchableOpacity>
      ))
    ) : (
      <Text style={[styles.noOutletsText, { color: currentTheme.textSecondary, padding: 16 }]}>
        No outlets available
      </Text>
    )}
  </View>
)}
</View>
        
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.menuButton}
            onPress={() => setMenuVisible(true)}
          >
            <Entypo name="menu" size={24} color={currentTheme.headerText} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Categories */}
      <View style={[styles.categoriesContainer, { backgroundColor: currentTheme.surface, borderBottomColor: currentTheme.border }]}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScrollContent}
        >
           {categories.map(cat => ( 
            <TouchableOpacity 
              key={cat} 
              onPress={() => handleCategoryChange(cat)}
              style={[
                styles.categoryWrapper,
                { backgroundColor: currentTheme.surface },
                activeCategory === cat && { backgroundColor: currentTheme.primary }
              ]}
            >
              <Text style={[
                styles.categoryText,
                { color: currentTheme.textSecondary },
                activeCategory === cat && { color: '#ffffff' }
              ]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Main Content */}
      <View style={styles.mainContent}>
  {/* Menu Section - Takes full width for owner, 70% for staff */}
  <View style={[
    styles.menuSection, 
    isMobile && styles.menuSectionMobile,
    isOwner && { flex: 1, width: '100%' } // ✅ Owner takes full width
  ]}>
    <MenuGrid 
      key={menuRefreshKey}
      currentItems={currentItems}
      addToCart={addToCart}
      totalPages={totalPages}
      currentPage={currentPage}
      prevPage={prevPage}
      nextPage={nextPage}
      setCurrentPage={setCurrentPage}
      categoryItems={categoryItems}
      allMenuItems={menuItems}
      menuUpdateTrigger={menuUpdateTrigger}  
      t={t}
      theme={currentTheme}
      formatPrice={formatPrice} 
      activeCategory={activeCategory}
      categories={categories}
     onOpenPriceItem={handleOpenPriceItem} 
     columns={getGridColumns()}
    />
  </View>
         {!isOwner && (
        <View style={[styles.cartSection, isMobile && styles.cartSectionMobile, { backgroundColor: currentTheme.surface, borderLeftColor: currentTheme.border }]}>
          <CartSection 
            cart={cart}
            increaseQuantity={increaseQuantity}
            decreaseQuantity={decreaseQuantity}
            removeItem={removeItem}
             removeAllItems={removeAllItems} 
            total={total}
            handleCheckout={handleCheckout}
            isMobile={isMobile}
            t={t}
            theme={currentTheme}
            formatPrice={formatPrice} 
             discountEnabled={discountEnabled}
    onDiscountPress={() => setShowDiscountModal(true)}
    discountApplied={discountInfo.applied}
    discountAmount={discountInfo.amount}
    discountedTotal={discountInfo.finalTotal}
    discountType={discountInfo.type}
    discountValue={discountInfo.value}
    originalTotal={discountInfo.originalTotal}
    
    // ✅ NEW: Remove discount function
    onRemoveDiscount={handleRemoveDiscount}
          />
          <DiscountInput
    visible={showDiscountModal}
    onClose={() => setShowDiscountModal(false)}
    onApplyDiscount={handleApplyDiscount}
    currentTotal={parseFloat(calculateTotalWithoutDiscount())}  // Original total
    theme={currentTheme}
    t={t}
    formatPrice={formatPrice}
/>

        </View>
        )}
      </View>
{showOutletSelector && (
  <OutletSelector
    visible={showOutletSelector}
    outlets={outlets}
    onSelect={async (outlet) => {
      console.log('🎯 Outlet selected:', outlet);
      
      // ✅ Save to AsyncStorage
      await AsyncStorage.setItem('selectedOutletId', outlet.Id.toString());
      await AsyncStorage.setItem('selectedOutletName', outlet.name);
       await AsyncStorage.setItem('selectedOutletLicense', outlet.LicenseKey || '');
       await AsyncStorage.setItem('selectedOutletExpiry', outlet.ExpiryDate || '');
      
      // ✅ Update state IMMEDIATELY
      setOutletInfo({
        name: outlet.name,
        license: outlet.LicenseKey,
        expiry: outlet.ExpiryDate,
        staff: outlet.staff?.username,
        id: outlet.Id
      });
      
      // ✅ Also update selectedOutlet if you have that state
      setSelectedOutlet(outlet);
      
      // ✅ Call selectOutlet from context
      await selectOutlet(outlet.Id);
      
      // ✅ Load data
      await loadData();
      
       console.log('✅ Outlet info set:', outlet.name, 'License:', outlet.LicenseKey, 'Expiry:', outlet.ExpiryDate);
}}
    theme={currentTheme}
    t={t}
  />
)}
      {/* Side Menu Modal */}
<Modal
  visible={menuVisible}
  animationType="slide"
  transparent={true}
  onRequestClose={() => setMenuVisible(false)}
>
  <View style={styles.modalOverlay}>
    <View 
      style={[styles.sideMenu, isMobile && styles.sideMenuMobile, { 
        backgroundColor: currentTheme.background, 
        flex: 1 
      }]}
    >
      <View style={[styles.sideMenuHeader, { backgroundColor: currentTheme.primary }]}>
        <Text style={styles.sideMenuTitle}>{t.posMenu}</Text>
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={() => {
            setMenuVisible(false);
            setActiveMenu('main');
          }}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
      
      {activeMenu !== 'main' && (
        <TouchableOpacity 
          style={[styles.backButton, { backgroundColor: currentTheme.surface, borderBottomColor: currentTheme.border }]}
          onPress={() => setActiveMenu('main')}
        >
          <Text style={[styles.backButtonText, { color: currentTheme.primary }]}>{t.backToMain}</Text>
        </TouchableOpacity>
      )}
      
      {/* ✅ ADD SCROLLVIEW HERE */}
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={true}
      >
        {renderMenuContent()}
      </ScrollView>
      
    </View>
  </View>
</Modal>

      {/* Payment Modal */}
      {renderPaymentModal()}
      
      {/* Cash Payment Modal */}
      {renderCashModal()}

      {/* Sales Report Modal */}
    {/* Sales Report Modal - NEW VERSION */}
<POSSalesReport
  visible={showSalesReport}
  onClose={() => setShowSalesReport(false)}
  selectedFilter={selectedSalesFilter}
  onFilterChange={setSelectedSalesFilter}
  startDate={startDate}
  endDate={endDate}
  onStartDateChange={setStartDate}
  onEndDateChange={setEndDate}
  onApplyCustomFilter={applyCustomFilter}
  theme={currentTheme}
  t={t}
  isMobile={isMobile}
  formatPrice={formatPrice}
  userId={user?.id} 
   outletInfo={outletInfo} 
   userRole={user?.role}  
/>
<PayModeSettings
  visible={showPayModeSettings}
  onClose={() => setShowPayModeSettings(false)}
  userId={user?.id}
  theme={currentTheme}
  t={t}
  onUpdate={handlePaymentModesUpdate}
/>

{pendingSaleData && (
  <BillPrompt
    visible={showBillPrompt}
    onClose={() => setShowBillPrompt(false)}
    onPrintBill={handlePrintBill}
    onSkip={handleSkipBill}
    theme={currentTheme}
    t={t}
    total={pendingSaleData.total.toString()}
    formatPrice={formatPrice}
  />
)}
<CompanySettingsForm
    visible={showCompanySettings}
    onClose={() => setShowCompanySettings(false)}
    onSave={async (settings) => {
        // ✅ ONLY use outlet ID - no fallbacks
        const outletId = outletInfo?.id?.toString();
        
        if (!outletId) {
            Alert.alert('Error', 'No outlet selected. Please select an outlet first.');
            return;
        }
        
        console.log('💾 Saving company settings for outlet:', outletId);
        await BillPDFGenerator.saveSettings(settings, outletId);
       
        setShowCompanySettings(false);
    }}
    theme={currentTheme}
    t={t}
    clientId={outletInfo?.id?.toString() || ''}  // ✅ ONLY outlet ID
    userShopName={outletInfo?.name || ''}  // ✅ ONLY outlet name
    defaultCashier={user?.username}
/>
{/* UPI Payment Modal */}
<UPIQRPayment
  visible={showUPIPayment}
  onClose={() => {
    setShowUPIPayment(false);
     // ✅ Go back to payment methods
  }}
  amount={parseFloat(total)}
  onSuccess={handleUPISuccess}
  onFailed={() => {
    
    setShowUPIPayment(false);
    setShowPaymentModal(true); // ✅ Go back to payment methods
  }}
  theme={currentTheme}
  t={t}
  shopName={user?.shopName || ''}
  upiId={upiId}
/>
<UPISettings
  visible={showUPISettings}
  onClose={() => {
    setShowUPISettings(false);
    // ✅ Force reload when modal closes
    loadPaymentModes(true); // Add true for force reload
  }}
  userId={user?.id}
  theme={currentTheme}
  t={t}
  onUpdate={(newUpiId) => {
    setUpiId(newUpiId);
    // ✅ Force reload with true parameter
    loadPaymentModes(true); // Add true for force reload
  }}
/>
{/* PayNow Payment Modal */}
<PayNowQRPayment
  visible={showPayNowPayment}
  onClose={() => setShowPayNowPayment(false)}
  onBack={() => {
    setShowPayNowPayment(false);
    setShowPaymentModal(true);
  }}
  amount={parseFloat(total)}
  onSuccess={handlePayNowSuccess}
  onFailed={() => {
    Alert.alert('Payment Failed', 'Please try again');
    setShowPayNowPayment(false);
    setShowPaymentModal(true);
  }}
  theme={currentTheme}
  t={t}
  shopName={user?.shopName || ''}
  qrCodeUrl={payNowQrUrl}
   formatPrice={formatPrice} 
/>

<DayEndModal
    visible={showDayEndModal}
    onClose={() => setShowDayEndModal(false)}
    outletId={outletInfo?.id || 0}
    theme={currentTheme}
    t={t}
    formatPrice={formatPrice}
    onDayEndComplete={async () => {
        console.log('🔄 Day end complete - refreshing...');
        
        // ✅ Refresh day end status only
        await checkDayEndStatus();
        
        // ✅ Sales report will still show all sales (no change)
        // ✅ Day end modal will show reset state
        
        console.log('✅ Day end refresh complete');
    }}
/>

{/* Loading Screen Modal */}
<Modal
  visible={showLoadingScreen}
  transparent={true}
  animationType="fade"
  onRequestClose={() => {}}
>
  <View style={styles.loadingOverlay}>
    <View style={[styles.loadingContainer, { backgroundColor: currentTheme.card }]}>
      <ActivityIndicator size="large" color={currentTheme.primary} />
      <Text style={[styles.loadingText, { color: currentTheme.text, marginTop: 15 }]}>
        Processing Payment...
      </Text>
      <Text style={[styles.loadingSubText, { color: currentTheme.textSecondary, marginTop: 5 }]}>
        Please wait
      </Text>
    </View>
  </View>
</Modal>
      {/* Profile Modal */}
      <ProfileModal
        visible={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        isMobile={isMobile}
        currentTheme={currentTheme}
        t={t}
        profileMode={profileMode}
        profileTab={profileTab}
        setProfileTab={setProfileTab}
        theme={theme}
        language={language}
        handleThemeChange={handleThemeChange}
        handleLanguageChange={handleLanguageChange}
        handleLogout={handleLogout}
        user={user}
      />
      
      <CashDrawerLogs
  visible={showDrawerLogs}
  onClose={() => setShowDrawerLogs(false)}
  theme={currentTheme}
  t={t}
  userRole={user?.role || 'staff'}
  outletId={outletInfo?.id}
/>
        {/* Open Price Modal */}
 {/* Open Price Modal - Using priceModal state */}
<Modal
  key={`price-modal-${priceModal.visible ? 'open' : 'closed'}`}
  visible={priceModal.visible}
  transparent={true}
  animationType="fade"
  onRequestClose={() => {
    console.log('📱 Modal close requested');
    setPriceModal({ visible: false, item: null, price: '' });
  }}
>
  <View style={styles.modalOverlay}>
    <View style={[styles.priceModalContent, { backgroundColor: currentTheme.card }]}>
      
      <View style={styles.priceModalHeader}>
        <Text style={[styles.priceModalTitle, { color: currentTheme.text }]}>
          Enter Price
        </Text>
        <TouchableOpacity 
          onPress={() => setPriceModal({ visible: false, item: null, price: '' })}
        >
          <Ionicons name="close" size={24} color={currentTheme.text} />
        </TouchableOpacity>
      </View>

      {priceModal.item && (
        <View style={styles.itemInfoContainer}>
          {priceModal.item.imageUri && (
            <Image 
              source={{ uri: priceModal.item.imageUri }} 
              style={styles.modalItemImage} 
            />
          )}
          <Text style={[styles.modalItemName, { color: currentTheme.text }]}>
            {priceModal.item.name}
          </Text>
        </View>
      )}

      <View style={styles.priceInputContainer}>
        <Text style={[styles.currencySymbol, { color: currentTheme.primary }]}>
          {currencySymbol}
        </Text>
        <TextInput
          style={[styles.priceInput, { 
            backgroundColor: currentTheme.surface,
            color: currentTheme.text,
            borderColor: currentTheme.border
          }]}
          placeholder="0.00"
          placeholderTextColor={currentTheme.textSecondary}
          keyboardType="numeric"
          value={priceModal.price}
          onChangeText={(text) => setPriceModal({ ...priceModal, price: text })}
          autoFocus={true}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickAmountScroll}>
        {[10, 20, 50, 100, 200].map(amount => (
          <TouchableOpacity
            key={amount}
            style={[styles.quickAmountBtn, { 
              backgroundColor: currentTheme.surface,
              borderColor: currentTheme.border 
            }]}
            onPress={() => setPriceModal({ ...priceModal, price: amount.toString() })}
          >
            <Text style={[styles.quickAmountText, { color: currentTheme.text }]}>
              {formatPrice(amount)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.priceModalButtons}>
        <TouchableOpacity
          style={[styles.priceModalBtn, styles.cancelBtn, { 
            borderColor: currentTheme.border,
            backgroundColor: currentTheme.surface
          }]}
          onPress={() => setPriceModal({ visible: false, item: null, price: '' })}
        >
          <Text style={[styles.cancelBtnText, { color: currentTheme.text }]}>
            Cancel
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.priceModalBtn, styles.addBtn, { 
            backgroundColor: currentTheme.primary 
          }]}
          onPress={handlePriceSubmit}
        >
          <Text style={styles.addBtnText}>
            Add to Cart
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    
    alignItems: 'center',
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    minHeight: 60,
  },
  headerAndroid: { 
    paddingTop: (StatusBar.currentHeight || 0) + 10,
  },
headerLeft: { 
  width: 80,  // Fixed width for left side
  alignItems: 'flex-start',
},
  homeButton: { 
    marginRight: 16, 
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  homeButtonText: { 
    fontSize: 22,
    includeFontPadding: false,
  },
  profileButton: { 
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileButtonText: { 
    fontSize: 22,
    includeFontPadding: false,
  },
headerCenter: { 
  flex: 1,  // Takes remaining space
  alignItems: 'center',     // ✅ Centers horizontally
  justifyContent: 'center', // ✅ Centers vertically
},
 headerRight: { 
  width: 75,  // Fixed width for right side
  alignItems: 'flex-end',
},
registerText: { 
  fontSize: 18, 
  fontWeight: '800',
  includeFontPadding: false,
  textAlign: 'center',      // ✅ Centers text inside
  width: '100%',            // Takes full width of parent
},
  menuButton: { 
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuButtonText: { 
    fontSize: 22,
    includeFontPadding: false,
  },
  categoriesContainer: { 
    height: 50, 
    borderBottomWidth: 1,
    justifyContent: 'center',
  },
  categoriesScrollContent: { 
    paddingHorizontal: 12, 
    alignItems: 'center',
    paddingVertical: 6,
  },
  categoryWrapper: { 
    marginRight: 10, 
    paddingVertical: 8, 
    paddingHorizontal: 16, 
    borderRadius: 20,
    minHeight: 40,
    justifyContent: 'center',
  },
  categoryText: { 
    fontSize: 14, 
    fontWeight: '500',
    includeFontPadding: false,
  },
  mainContent: { 
    flex: 1, 
    flexDirection: 'row',
  },
  menuSection: { 
    flex: 0.7,
  },
  menuSectionMobile: { 
    flex: 0.6,
  },
   noPaymentModes: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPaymentText: {
    fontSize: 14,
    textAlign: 'center',
  },
  cartSection: { 
    flex: 0.3, 
    borderLeftWidth: 1,
  },
  cartSectionMobile: { 
    flex: 0.4,
  },
  menuGridContainer: { 
    flex: 1,
  },
  menuGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap',
    padding: 4,
  },
  menuItem: { 
    width: '50%', 
    padding: 8, 
    borderBottomWidth: 1, 
    borderRightWidth: 1, 
    alignItems: 'center',
    minHeight: 150,
  },
  closeButtonTextRed: { 
    fontSize: 18, 
    fontWeight: '600',
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  menuItemImageContainer: { 
    width: 80, 
    height: 80, 
    borderRadius: 12, 
    overflow: 'hidden', 
    marginBottom: 8,
  },
  menuItemImage: { 
    width: '100%', 
    height: '100%', 
    resizeMode: 'cover' 
  },
  menuItemImagePlaceholder: { 
    width: '100%', 
    height: '100%', 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
  },
  menuItemImagePlaceholderText: { 
    fontSize: 32,
  },
  menuItemName: { 
    fontSize: 13, 
    marginBottom: 4, 
    textAlign: 'center',
    paddingHorizontal: 4,
    includeFontPadding: false,
  },
  menuItemPrice: { 
    fontSize: 14, 
    fontWeight: '600',
    includeFontPadding: false,
  },
  paginationWrapper: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    borderTopWidth: 1, 
    borderBottomWidth: 1,
  },
  paginationButton: { 
    paddingHorizontal: 14, 
    paddingVertical: 8, 
    borderRadius: 20, 
    minWidth: 44, 
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  paginationButtonText: { 
    fontSize: 16, 
    fontWeight: '600',
    includeFontPadding: false,
  },
  pageNumbersContainer: { 
    flex: 1, 
    marginHorizontal: 8,
    height: 44,
  },
  pageNumberButton: { 
    width: 38, 
    height: 38, 
    borderRadius: 19, 
    marginHorizontal: 3, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 1,
  },
  pageNumberText: { 
    fontSize: 13, 
    fontWeight: '500',
    includeFontPadding: false,
  },
  itemCountText: { 
    textAlign: 'center', 
    fontSize: 11, 
    paddingVertical: 8,
    includeFontPadding: false,
  },
  cartContainer: { 
    flex: 1,
  },
  cartHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 12, 
    paddingVertical: 12, 
    borderBottomWidth: 1,
    minHeight: 50,
  },
  cartTitle: { 
    fontSize: 14, 
    fontWeight: '700',
    includeFontPadding: false,
  },
  cartItemCount: { 
    fontSize: 13, 
    fontWeight: '500',
    includeFontPadding: false,
  },
  cartItems: { 
    flex: 1, 
    paddingHorizontal: 10,
  },
  cartItem: { 
    paddingVertical: 12, 
    borderBottomWidth: 1,
  },
  cartItemRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 8,
  },
  cartItemImageContainer: { 
    width: 40, 
    height: 40, 
    borderRadius: 8, 
    overflow: 'hidden', 
    marginRight: 12,
  },
  cartItemImage: { 
    width: '100%', 
    height: '100%', 
    resizeMode: 'cover' 
  },
  cartItemImagePlaceholder: { 
    width: '100%', 
    height: '100%', 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
  },
  cartItemImagePlaceholderText: { 
    fontSize: 20,
  },
  cartItemDetails: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    flex: 1,
  },
  cartItemQuantity: { 
    fontSize: 13, 
    fontWeight: '600', 
    marginRight: 6,
    includeFontPadding: false,
  },
  cartItemName: { 
    fontSize: 13, 
    flex: 1,
    includeFontPadding: false,
  },
  cartItemPrice: { 
    fontSize: 13, 
    fontWeight: '500', 
    marginLeft: 8,
    includeFontPadding: false,
  },
  cartItemPriceMobile: { 
    fontSize: 14, 
    fontWeight: '600', 
    marginLeft: 8,
    includeFontPadding: false,
  },
  cartItemControls: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginLeft: 52,
  },
  cartItemControlsMobile: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginLeft: 52, 
    marginTop: 8,
  },
  cartQuantityControls: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderRadius: 6,
    height: 38,
  },
  cartQuantityBtn: { 
    paddingHorizontal: 12, 
    paddingVertical: 4, 
    minWidth: 38, 
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
  },
  cartQuantityBtnText: { 
    fontSize: 14, 
    fontWeight: '700',
    includeFontPadding: false,
  },
  cartQuantityText: { 
    paddingHorizontal: 8, 
    fontSize: 13, 
    fontWeight: '600', 
    minWidth: 28, 
    textAlign: 'center',
    includeFontPadding: false,
  },
  cartRemoveBtn: { 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 6,
    minWidth: 40,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartRemoveText: { 
    fontSize: 12,
    fontWeight: '600',
  },
  emptyCart: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 30,
  },
  emptyCartText: { 
    fontSize: 14, 
    fontWeight: '600', 
    marginBottom: 4,
    includeFontPadding: false,
  },
  emptyCartSubText: { 
    fontSize: 12,
    includeFontPadding: false,
  },
  cartFooter: { 
    padding: 12, 
    borderTopWidth: 2,
  },
  totalRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12,
  },
  chargeText: { 
    fontSize: 14, 
    fontWeight: '600',
    includeFontPadding: false,
  },
  totalAmount: { 
    fontSize: 20, 
    fontWeight: '800',
    includeFontPadding: false,
  },
  checkoutBtn: { 
    paddingVertical: 14, 
    borderRadius: 8, 
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  checkoutBtnText: { 
    color: '#ffffff', 
    fontSize: 14, 
    fontWeight: '700',
    includeFontPadding: false,
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0, 0, 0, 0.5)', 
    justifyContent: 'flex-start',
    paddingTop: Platform.OS === 'ios' ? 50 : 0,
  },
  sideMenu: { 
    width: '85%', 
    maxWidth: 400,
    height: '100%', 
    borderTopRightRadius: 20, 
    borderBottomRightRadius: 20,
  },
  sideMenuMobile: { 
    width: '90%',
  },
  salesReportMenu: { 
    width: '90%', 
    maxWidth: 800,
    alignSelf: 'center',
    borderRadius: 20,
  },
  sideMenuHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    borderBottomWidth: 1, 
    borderTopRightRadius: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    minHeight: Platform.OS === 'ios' ? 90 : 70,
  },
  sideMenuTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#ffffff',
    includeFontPadding: false,
  },
  closeButton: { 
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: { 
    fontSize: 20, 
    color: '#ffffff', 
    fontWeight: '600',
  },
  backButton: { 
    padding: 14, 
    borderBottomWidth: 1,
    minHeight: 50,
    justifyContent: 'center',
  },
  backButtonText: { 
    fontSize: 14, 
    fontWeight: '600',
    includeFontPadding: false,
  },
  menuContent: { 
    flex: 1, 
    padding: 16,
  },
  menuTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    marginBottom: 16,
    includeFontPadding: false,
  },
  menuItemBtn: { 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 12, 
    borderWidth: 1,
    minHeight: 55,
    justifyContent: 'center',
  },
  menuItemBtnText: { 
    fontSize: 15, 
    fontWeight: '500',
    includeFontPadding: false,
  },
  salesReportBtn: { 
    borderColor: '#45a049',
  },
  addButton: { 
    padding: 14, 
    borderRadius: 10, 
    alignItems: 'center', 
    marginBottom: 16,
    minHeight: 50,
    justifyContent: 'center',
  },
  addButtonText: { 
    color: '#ffffff', 
    fontSize: 15, 
    fontWeight: '600',
    includeFontPadding: false,
  },
  groupList: { 
    flex: 1,
  },
  groupCard: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 14, 
    borderRadius: 10, 
    marginBottom: 8, 
    borderWidth: 1,
    minHeight: 70,
  },
  groupInfo: { 
    flex: 1,
  },
  groupName: { 
    fontSize: 15, 
    fontWeight: '600', 
    marginBottom: 4,
    includeFontPadding: false,
  },
  groupCount: { 
    fontSize: 12,
    includeFontPadding: false,
  },
  groupActions: { 
    flexDirection: 'row', 
    alignItems: 'center',
  },
  groupStatus: { 
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    borderRadius: 15, 
    marginRight: 10,
    minWidth: 60,
    alignItems: 'center',
  },
  groupStatusText: { 
    color: '#ffffff', 
    fontSize: 11, 
    fontWeight: '600',
    includeFontPadding: false,
  },
  groupEditBtn: { 
    padding: 8, 
    marginRight: 6,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupEditText: { 
    fontSize: 18,
  },
  groupDeleteBtn: { 
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupDeleteText: { 
    fontSize: 18,
  },
  dishList: { 
    flex: 1,
  },
  dishCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12, 
    borderRadius: 10, 
    marginBottom: 8, 
    borderWidth: 1,
    minHeight: 80,
    width: '100%',  // Ensure full width
  },
  dishImageContainer: { 
    width: 50, 
    height: 50, 
    borderRadius: 8, 
    overflow: 'hidden', 
    marginRight: 12,
  },
  dishThumbnail: { 
    width: '100%', 
    height: '100%', 
    resizeMode: 'cover' 
  },
  dishThumbnailPlaceholder: { 
    width: '100%', 
    height: '100%', 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
  },
  dishThumbnailText: { 
    fontSize: 22,
  },
    dishInfo: { 
    flex: 1,
    marginRight: 8,  // Add spacing
  },
  dishName: { 
    fontSize: 15, 
    fontWeight: '600', 
    marginBottom: 4,
    includeFontPadding: false,
    textAlign: 'left',  // Force left alignment
    flexShrink: 1,      // Allow text to wrap
  },
  dishCategory: { 
    fontSize: 12,
    includeFontPadding: false,
    textAlign: 'left',
    color: '#666',
  },
  dishPrice: { 
    fontSize: 16, 
    fontWeight: '700', 
    marginRight: 12,
    includeFontPadding: false,
  },
  dishActions: { 
    flexDirection: 'row',
  },
  dishEditBtn: { 
    padding: 8, 
    marginRight: 6,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dishEditText: { 
    fontSize: 18,
  },
  dishDeleteBtn: { 
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dishDeleteText: { 
    fontSize: 18,
  },
  summaryCardHighlight: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 12,
  },
  galleryButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cameraButton: {
    backgroundColor: '#FF4444',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  saveBtn: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  profileModal: { 
    width: '90%', 
    maxWidth: 400, 
    borderRadius: 20, 
    alignSelf: 'center',
    maxHeight: '80%',
  },
  profileModalMobile: { 
    width: '95%',
  },
  profileModalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    borderTopLeftRadius: 20, 
    borderTopRightRadius: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    minHeight: Platform.OS === 'ios' ? 90 : 70,
  },
  profileModalTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#ffffff',
    includeFontPadding: false,
  },
  profileTabs: { 
    flexDirection: 'row', 
    borderBottomWidth: 1,
  },
  profileTab: { 
    flex: 1, 
    paddingVertical: 14, 
    alignItems: 'center',
  },
  profileTabActive: { 
    borderBottomWidth: 2,
  },
  profileTabText: { 
    fontSize: 15,
    includeFontPadding: false,
  },
  profileContent: { 
    maxHeight: 400, 
    padding: 16,
  },
  themeOption: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 14, 
    borderRadius: 10, 
    marginBottom: 10, 
    borderWidth: 1,
    minHeight: 60,
  },
  themeColorPreview: { 
    width: 28, 
    height: 28, 
    borderRadius: 14, 
    marginRight: 14,
  },
  themeOptionText: { 
    flex: 1, 
    fontSize: 16,
    includeFontPadding: false,
  },
  themeCheck: { 
    fontSize: 20, 
    color: '#ffffff', 
    fontWeight: '600',
  },
  languageOption: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 10, 
    borderWidth: 1,
    minHeight: 60,
  },
  languageOptionText: { 
    fontSize: 16,
    includeFontPadding: false,
  },
  languageCheck: { 
    fontSize: 20, 
    color: '#ffffff', 
    fontWeight: '600',
  },
  profileCancelBtn: { 
    margin: 16, 
    marginTop: 0, 
    padding: 14, 
    borderRadius: 10, 
    borderWidth: 1, 
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
    loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    minWidth: 200,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 15,
  },
  loadingSubText: {
    fontSize: 12,
    marginTop: 5,
  },
  profileCancelText: { 
    fontSize: 16, 
    fontWeight: '600',
    includeFontPadding: false,
  },
  paymentModalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0, 0, 0, 0.7)', 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 0,
    padding: 16,
  },
  paymentModalContent: { 
    width: '100%', 
    maxWidth: 600, 
    borderRadius: 10, 
    padding: 20, 
    maxHeight: '100%',
  },
  paymentModalContentMobile: { 
    width: '100%',
  },
  paymentModalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 20,
  },
  paymentModalTitle: { 
    fontSize: 22, 
    fontWeight: '700',
    includeFontPadding: false,
  },
  paymentModalClose: { 
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentModalCloseText: { 
    fontSize: 22, 
    fontWeight: '600',
  },
  paymentAmountContainer: { 
    padding: 20, 
    borderRadius: 15, 
    marginBottom: 20, 
    alignItems: 'center',
  },
  paymentAmountLabel: { 
    fontSize: 16, 
    marginBottom: 8,
    includeFontPadding: false,
  },
  paymentAmountValue: { 
    fontSize: 36, 
    fontWeight: '800',
    includeFontPadding: false,
  },
  paymentOptionCard: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    borderRadius: 15, 
    marginBottom: 12, 
    borderWidth: 1,
    minHeight: 80,
  },
  paymentOptionLeft: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    flex: 1,
  },
  paymentOptionIcon: { 
    fontSize: 32, 
    marginRight: 16,
  },
  paymentOptionName: { 
    fontSize: 18, 
    fontWeight: '600', 
    marginBottom: 4,
    includeFontPadding: false,
  },
  paymentOptionDescription: { 
    fontSize: 14,
    includeFontPadding: false,
  },
  paymentOptionArrow: { 
    fontSize: 22,
  },
  paymentSuccessContainer: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 40,
  },
  paymentSuccessText: { 
    fontSize: 18, 
    marginTop: 20, 
    textAlign: 'center',
    includeFontPadding: false,
  },
  paymentCancelBtn: { 
    marginTop: 20, 
    padding: 14, 
    borderRadius: 10, 
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  paymentCancelText: { 
    fontSize: 16, 
    fontWeight: '600',
    includeFontPadding: false,
  },
  cashInputContainer: { 
    marginBottom: 20,
  },
  cashInputLabel: { 
    fontSize: 16, 
    marginBottom: 10,
    includeFontPadding: false,
  },
  cashInputWrapper: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderWidth: 2, 
    borderRadius: 15, 
    paddingHorizontal: 16,
    height: 60,
  },
  cashInputCurrency: { 
    fontSize: 28, 
    fontWeight: '600', 
    marginRight: 12,
    includeFontPadding: false,
  },
  cashInput: { 
    flex: 1, 
    fontSize: 28, 
    padding: 0,
    includeFontPadding: false,
  },
  balanceContainer: { 
    padding: 20, 
    borderRadius: 15, 
    marginBottom: 20, 
    alignItems: 'center',
  },
  balanceLabel: { 
    fontSize: 16, 
    marginBottom: 8,
    includeFontPadding: false,
  },
  balanceValue: { 
    fontSize: 40, 
    fontWeight: '800',
    includeFontPadding: false,
  },
  balanceWarning: { 
    fontSize: 14, 
    marginTop: 8, 
    textAlign: 'center',
    includeFontPadding: false,
  },
 quickAmountContainer: {
  marginBottom: 20,
  width: '100%',
},

quickAmountLabel: {
  fontSize: 14,
  fontWeight: '600',
  marginBottom: 12,
  color: '#333',
},
quickAmountBtn: {
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderRadius: 20,
  marginRight: 8,
  borderWidth: 1,
  minWidth: 70,
  alignItems: 'center',         // ✅ Centers text inside button
},
 quickAmountBtnText: {
  fontSize: 16,
  fontWeight: '600',
  color: '#333',
},

  cashModalButtons: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  marginTop: 0,
  paddingHorizontal: 2,
},
 cashModalBtn: {
  flex: 1,
  paddingVertical: 1,
  paddingHorizontal: 1,
  borderRadius: 12,
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 47,
  elevation: 1,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
},

cashModalCancel: {
  borderWidth: 1,
  backgroundColor: 'transparent',
},
 cashModalCancelText: {
  fontSize: 16,
  fontWeight: '600',
  textAlign: 'center',
},

cashModalConfirm: {
  backgroundColor: '#4CAF50',
},

 cashModalConfirmText: {
  fontSize: 16,
  color: '#ffffff',
  fontWeight: '700',
  textAlign: 'center',
},
  salesHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 0,
  },
  filterContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-around', 
    marginBottom: 20,
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
  },
  // Add to your StyleSheet
outletNameContainer: {
    alignItems: 'center',
    padding: 4,
},
outletDropdown: {
    position: 'absolute',
    width: 280,
    maxHeight: 300,
    borderRadius: 12,
    borderWidth: 1,
    padding: 8,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
},
dropdownTitle: {
    fontSize: 12,
    fontWeight: '600',
    padding: 8,
    paddingBottom: 4,
},
outletOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    marginVertical: 2,
},
outletOptionLeft: {
    flex: 1,
},
outletOptionName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
},
outletOptionStaff: {
    fontSize: 11,
},
outletBadge: {
    fontSize: 16,
    marginLeft: 8,
},
  filterBtnText: { 
    fontSize: 13, 
    fontWeight: '500',
    includeFontPadding: false,
  },
  customDateContainer: { 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 20,
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
    includeFontPadding: false,
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
    includeFontPadding: false,
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
    includeFontPadding: false,
  },
  dateRangeDisplay: { 
    padding: 10, 
    borderRadius: 8, 
    marginBottom: 20, 
    alignItems: 'center',
  },
  dateRangeText: { 
    fontSize: 14, 
    fontWeight: '500',
    includeFontPadding: false,
  },
  summaryContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 20,
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
   noOutletsText: {
        fontSize: 14,
        textAlign: 'center',
        padding: 20,
        includeFontPadding: false,
    }, 
  summaryLabel: { 
    fontSize: 13, 
    marginBottom: 6,
    includeFontPadding: false,
  },
  summaryValue: { 
    fontSize: 20, 
    fontWeight: '700',
    includeFontPadding: false,
  },
  summaryValueHighlight: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#ffffff',
    includeFontPadding: false,
  },
  paymentBreakdownContainer: { 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 20,
  },
  breakdownTitle: { 
    fontSize: 16, 
    fontWeight: '600', 
    marginBottom: 12,
    includeFontPadding: false,
  },
  breakdownRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingVertical: 8, 
    borderBottomWidth: 1,
  },
  breakdownMethod: { 
    fontSize: 14,
    includeFontPadding: false,
  },
  breakdownAmount: { 
    fontSize: 14, 
    fontWeight: '600',
    includeFontPadding: false,
  },
  salesListTitle: { 
    fontSize: 16, 
    fontWeight: '600', 
    marginBottom: 12,
    includeFontPadding: false,
  },
salesList: {
  flex: 1,
  marginTop: 8,
},
 saleItem: {
  padding: 12,
  borderRadius: 10,
  marginBottom: 10,
  borderWidth: 1,
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
  includeFontPadding: false,
  marginBottom: 2,
},
saleTime: {
  fontSize: 11,
  includeFontPadding: false,
},
  saleDateTime: { 
    fontSize: 13,
    includeFontPadding: false,
  },
  salePayment: { 
    fontSize: 13, 
    fontWeight: '600',
    includeFontPadding: false,
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
  includeFontPadding: false,
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
  includeFontPadding: false,
  marginRight: 8,
},
  saleItemQty: { 
    fontSize: 12,
  includeFontPadding: false,
  marginRight: 8,
  minWidth: 35,
  },
  saleItemQuantity: {
  fontSize: 12,
  includeFontPadding: false,
  marginRight: 8,
  minWidth: 35,
},
saleItemPrice: {
  fontSize: 13,
  fontWeight: '600',
  includeFontPadding: false,
  minWidth: 60,
  textAlign: 'right',
},
saleTotalContainer: {  // ✅ THIS IS THE MISSING STYLE
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: 8,
  paddingTop: 10,
  borderTopWidth: 1,
  paddingHorizontal: 4,
},
  saleTotal: { 
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
  includeFontPadding: false,
},
  saleTotalValue: {
  fontSize: 16,
  fontWeight: '700',
  includeFontPadding: false,
},

  noSalesContainer: { 
    padding: 40, 
    alignItems: 'center',
  },
  noSalesText: { 
    fontSize: 15,
    includeFontPadding: false,
  },
  // Add these to your styles object
priceModalContent: {
  width: '100%',
  maxWidth: 450,
  borderRadius: 20,
  padding: 20,
  // ✅ Already has backgroundColor from theme
},
priceModalHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 20,
  width: '100%',                // ✅ Takes full width
},
priceModalTitle: {
  fontSize: 18,
  fontWeight: '700',
},
itemInfoContainer: {
  alignItems: 'center',         // ✅ Centers image and name
  marginBottom: 50,
  width: '100%',
},
modalItemImage: {
  width: 80,
  height: 80,
  borderRadius: 12,
  marginBottom: 10,
},
modalItemName: {
  fontSize: 16,
  fontWeight: '600',
  textAlign: 'center',
},
priceInputContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',     // ✅ Centers the input row
  marginBottom: 60,
  width: '100%',
},

currencySymbol: {
  fontSize: 24,
  fontWeight: '700',
  marginRight: 10,
},
priceInput: {
  flex: 1,
  borderWidth: 1,
  borderRadius: 10,
  padding: 15,
  fontSize: 20,
  textAlign: 'center',
},


quickAmountText: {
  fontSize: 14,
  fontWeight: '600',
},
priceModalButtons: {
  flexDirection: 'row',
  gap: 12,
  justifyContent: 'space-between',  // ✅ Buttons side by side
  width: '100%',
},
priceModalBtn: {
  flex: 1,
  paddingVertical: 14,
  borderRadius: 10,
  alignItems: 'center',         // ✅ Centers button text
},
addBtn: {
  backgroundColor: '#4CAF50',
},
addBtnText: {
  color: '#fff',
  fontSize: 15,
  fontWeight: '600',
},
  modalContainer: { 
    flex: 1, 
    backgroundColor: 'rgba(0, 0, 0, 0.5)', 
    justifyContent: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 0,
  },
  scrollModalContent: { 
    flexGrow: 1, 
    justifyContent: 'center', 
    padding: 16,
  },
  modalContent: { 
    borderRadius: 20, 
    padding: 20, 
    margin: 16,
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
  },
  modalTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    marginBottom: 20, 
    textAlign: 'center',
    includeFontPadding: false,
  },
  modalLabel: { 
    fontSize: 15, 
    fontWeight: '600', 
    marginBottom: 6, 
    marginTop: 12,
    includeFontPadding: false,
  },
  modalInput: { 
    borderWidth: 1, 
    borderRadius: 10, 
    padding: 14, 
    fontSize: 15, 
    marginBottom: 16,
    minHeight: 50,
    includeFontPadding: false,
  },
  modalButtons: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 20,
  },
  modalBtn: { 
    flex: 1, 
    paddingVertical: 14, 
    borderRadius: 10, 
    alignItems: 'center', 
    marginHorizontal: 6,
    minHeight: 50,
    justifyContent: 'center',
  },
  cancelBtn: { 
    borderWidth: 1,
  },
  cancelBtnText: { 
    fontSize: 15, 
    fontWeight: '600',
    includeFontPadding: false,
  },
  saveBtnText: { 
    color: '#ffffff', 
    fontSize: 15, 
    fontWeight: '600',
    includeFontPadding: false,
  },
  imageUploadContainer: { 
    marginBottom: 20,
  },
  imagePreviewContainer: { 
    width: '100%', 
    height: 180, 
    borderRadius: 12, 
    overflow: 'hidden', 
    marginBottom: 12, 
    position: 'relative', 
    borderWidth: 1,
  },
  pdfButton: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 10,
    marginVertical: 5,
  },
  pdfButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  styleModal: {
    width: '80%',
    maxWidth: 300,
    borderRadius: 15,
    padding: 20,
  },
 
  styleOption: {
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  styleOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  closeBtn: {
    marginTop: 15,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  imagePreview: { 
    width: '100%', 
    height: '100%', 
    resizeMode: 'cover' 
  },
  removeImageButton: { 
    position: 'absolute', 
    top: 10, 
    right: 10, 
    backgroundColor: 'rgba(0, 0, 0, 0.5)', 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  removeImageText: { 
    color: '#ffffff', 
    fontSize: 18, 
    fontWeight: '600',
  },
  imagePlaceholder: { 
    width: '100%', 
    height: 180, 
    borderRadius: 12, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 12, 
    borderWidth: 1, 
    borderStyle: 'dashed',
  },
  imagePlaceholderText: { 
    fontSize: 48,
  },
  imagePlaceholderSubText: { 
    fontSize: 14, 
    marginTop: 8,
    includeFontPadding: false,
  },
  imageButtonsContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between',
  },
  imageButton: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 12, 
    borderRadius: 10, 
    marginHorizontal: 6,
    minHeight: 50,
  },
  imageButtonIcon: { 
    fontSize: 18, 
    color: '#ffffff', 
    marginRight: 8,
  },
  imageButtonText: { 
    color: '#ffffff', 
    fontSize: 14, 
    fontWeight: '600',
    includeFontPadding: false,
  },
  categorySelector: { 
    flexDirection: 'row', 
    marginBottom: 20,
    maxHeight: 50,
  },
  categoryChip: { 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 20, 
    marginRight: 8, 
    borderWidth: 1,
    minHeight: 40,
    justifyContent: 'center',
  },
  categoryChipText: { 
    fontSize: 13,
    includeFontPadding: false,
  },
  selectedCategoryChipText: { 
    color: '#ffffff',
  },
  backToMainBtn: { 
    padding: 14, 
    borderRadius: 12, 
    marginBottom: 20, 
    alignItems: 'center', 
    borderWidth: 1,
    minHeight: 50,
    justifyContent: 'center',
  },
  backToMainBtnText: { 
    fontSize: 15, 
    color: '#ffffff', 
    fontWeight: '600',
    includeFontPadding: false,
  },
  userInfoContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  userAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  userAvatarText: {
    fontSize: 40,
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
    includeFontPadding: false,
  },
  userRole: {
    fontSize: 14,
    marginBottom: 20,
    includeFontPadding: false,
  },
  // Add to your StyleSheet
processingText: {
  fontSize: 18,
  marginTop: 20,
  textAlign: 'center',
  fontWeight: '600',
},
processingSubText: {
  fontSize: 14,
  marginTop: 8,
  textAlign: 'center',
},
  logoutButton: {
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
    marginBottom: 10,
  },
    quickAmountScroll: {
    maxHeight: 60,
    marginBottom: 20,
    width: '100%',
  },
    quickAmountContent: {
    paddingHorizontal: 10,
    gap: 8,
    flexDirection: 'row',
  },
   
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    includeFontPadding: false,
  },
  homeDropdown: {
  position: 'absolute',
  top: 50,
  left: 10,
  borderRadius: 12,
  borderWidth: 1,
  padding: 8,
  width: 200,
  zIndex: 1000,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 3.84,
  elevation: 5,
},
dropdownItem: {
  flexDirection: 'row',
  alignItems: 'center',
  padding: 12,
  borderRadius: 8,
},
dropdownIcon: {
  fontSize: 20,
  marginRight: 12,
  width: 30,
},
dropdownText: {
  fontSize: 16,
  flex: 1,
  includeFontPadding: false,
},
// Add to your styles object
filterScrollView: {
  flexGrow: 0,
  marginBottom: 15,
},
filterScrollContent: {
  paddingHorizontal: 10,
  gap: 8,
},
dayEndBtn: {
    backgroundColor: '#FF4444',
    borderWidth: 0,
},
customDateScrollView: {
  flexGrow: 0,
  marginBottom: 15,
},
salesMainScrollView: {
  flex: 1,
},
salesMainContent: {
  paddingBottom: 20,
},

// Add to your styles object
bottomInfo: {
  marginTop: 'auto',  // Pushes to bottom
  paddingTop: 16,
  borderTopWidth: 1,
},
bottomRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 8,
},
bottomLogo: {
  width: 30,
  height: 30,
  borderRadius: 15,
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 10,
},
expiryText: {
    fontSize: 9,
    fontWeight: '300',
    includeFontPadding: false,
    textAlign: 'center',
    marginTop: 1,
    opacity: 0.7,
},
bottomLogoText: {
  fontSize: 16,
},
bottomShopName: {
  fontSize: 16,
  fontWeight: '600',
  flex: 1,
},
cashModalScrollView: {
    width: '100%',
    maxHeight: '200%',
    
  },
  cashModalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 30,
  },

bottomLabel: {
  fontSize: 12,
  width: 70,
},
bottomValue: {
  fontSize: 13,
  fontWeight: '500',
  flex: 1,
},
countdownBox: {
  marginTop: 8,
  padding: 10,
  borderRadius: 8,
},
countdownLabel: {
  fontSize: 11,
  marginBottom: 4,
},
countdownTimer: {
  fontSize: 16,
  fontWeight: '700',
  textAlign: 'center',
},
// Add to your styles object
bottomCompanyContainer: {
  marginTop: 'auto',
  paddingTop: 16,
  borderTopWidth: 1,
},
licenseRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 6,
},
licenseLabel: {
  fontSize: 12,
  width: 70,
},
licenseValue: {
  fontSize: 13,
  fontWeight: '600',
  flex: 1,
},
expiryRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 10,
},
expiryLabel: {
  fontSize: 12,
  width: 70,
},
expiryValue: {
  fontSize: 13,
  fontWeight: '500',
  flex: 1,
},
countdownContainer: {
  padding: 10,
  borderRadius: 8,
  marginBottom: 12,
},

companyDivider: {
  height: 1,
  marginVertical: 12,
},
companyHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 8,
},
companyLogo: {
  width: 40,
  height: 40,
  borderRadius: 8,
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 12,
},
companyLogoText: {
  color: '#ffffff',
  fontSize: 14,
  fontWeight: '700',
},
companyName: {
  fontSize: 14,
  fontWeight: '600',
  flex: 1,
  flexWrap: 'wrap',
},
copyright: {
  fontSize: 10,
  textAlign: 'center',
  marginTop: 4,
  marginBottom: 8,
},

companyLogoContainer: {
  width: 50,
  height: 50,
  borderRadius: 10,
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 12,
  borderWidth: 1,
  borderColor: '#ddd',
  overflow: 'hidden',
},
companyLogoImage: {
  width: 55,
  height: 85,
},
companyTextContainer: {
  flex: 1,
},

companyTagline: {
  fontSize: 11,
},
// Add to your StyleSheet
quickAmountRow: {
  flexDirection: 'row',
  marginBottom: 8,
},
quickAmountSubText: {
  fontSize: 8,
  marginTop: 2,
  textAlign: 'center',
},
  licenseText: {
    fontSize: 10,
    fontWeight: '400',
    includeFontPadding: false,
    textAlign: 'center',
    marginTop: 2,
    opacity: 0.8,
  },

staffText: {
    fontSize: 9,
    fontWeight: '300',
    includeFontPadding: false,
    textAlign: 'center',
    marginTop: 1,
    opacity: 0.7,
},
dropdownDivider: {
  height: 1,
  marginVertical: 8,
},
});