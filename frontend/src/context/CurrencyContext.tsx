// frontend/src/context/CurrencyContext.tsx

import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../api';
import { useAuth } from './AuthContext';

interface CurrencySettings {
  currencyCode: string;
  currencySymbol: string;
}

interface CurrencyContextType {
  currencyCode: string;
  currencySymbol: string;
  formatPrice: (amount: number) => string;
  setCurrency: (code: string, symbol: string) => Promise<void>;
  loadCurrencyFromSettings: () => Promise<void>;
  refreshCurrency: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error('useCurrency must be used within CurrencyProvider');
  return context;
};

export const CurrencyProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [currencyCode, setCurrencyCode] = useState('SGD');
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [isLoading, setIsLoading] = useState(true);
  
  // ✅ NEW: Track loaded state to prevent duplicates
  const loadedRef = useRef(false);
  const loadingRef = useRef(false);
  const currentUserIdRef = useRef<string | number | null>(null);
const currencyLoadingRef = useRef(false);
const currencyLoadedRef = useRef(false);
const pendingRefreshRef = useRef<NodeJS.Timeout | null>(null);
const loadedOutletsRef = useRef<Set<string>>(new Set());
  // Load from AsyncStorage on mount
  useEffect(() => {
    loadSavedCurrency();
  }, []);

  // Load from API when user changes
  useEffect(() => {
    const loadUserCurrency = async () => {
      if (user?.id) {
        // Check if user actually changed
        if (currentUserIdRef.current !== user.id) {
          console.log(`👤 User changed from ${currentUserIdRef.current} to ${user.id}, loading currency...`);
          currentUserIdRef.current = user.id;
          loadedRef.current = false; // Reset for new user
          setIsLoading(true);
          await loadCurrencyFromSettings();
          setIsLoading(false);
        } else {
          // Same user - skip if already loaded
          if (loadedRef.current) {
            console.log('⏭️ Currency already loaded for this user, skipping...');
          }
        }
      } else {
        // No user - reset to defaults
        setCurrencyCode('SGD');
        setCurrencySymbol('$');
        currentUserIdRef.current = null;
        loadedRef.current = false;
      }
    };

    loadUserCurrency();
  }, [user?.id]);

  const loadSavedCurrency = async () => {
    try {
      const savedCode = await AsyncStorage.getItem('currencyCode');
      const savedSymbol = await AsyncStorage.getItem('currencySymbol');
      
      if (savedCode && savedSymbol) {
        // Only set if no user or as fallback
        if (!user?.id) {
          setCurrencyCode(savedCode);
          setCurrencySymbol(savedSymbol);
        }
      }
    } catch (error) {
      console.log('Error loading saved currency:', error);
    }
  };

 const loadCurrencyFromSettings = async (retryCount = 0, outletId?: string) => {
  const targetId = outletId || await AsyncStorage.getItem('selectedOutletId');
  
  if (!targetId) {
    console.log('⚠️ No outlet ID available, using defaults');
    return;
  }

  // ✅ Check if THIS SPECIFIC outlet is already loaded
  if (loadedOutletsRef.current.has(targetId) && !retryCount) {
    console.log(`⏭️ Currency already loaded for outlet ${targetId}, skipping`);
    return;
  }

  if (loadingRef.current) {
    console.log('⏳ Currency already loading, skipping...');
    return;
  }

  loadingRef.current = true;
  console.log(`🔄 Loading settings for outlet ${targetId}...`);
  
  try {
    // ✅ Add timestamp to prevent caching
    const timestamp = Date.now();
    const response = await API.get(`/company-settings/${targetId}?outletId=${targetId}&_t=${timestamp}`, {
      timeout: 10000
    });
    
    if (response.data.success) {
      const settings = response.data.settings;
      const newCode = settings.Currency || settings.currency || 'SGD';
      const newSymbol = settings.CurrencySymbol || settings.currencySymbol || '$';
      
      // ✅ Load logo settings as well
      const showCompanyLogo = settings.ShowCompanyLogo === 1 || settings.ShowCompanyLogo === true;
      const showHalalLogo = settings.ShowHalalLogo === 1 || settings.ShowHalalLogo === true;
      
      console.log(`✅ Loaded settings for outlet ${targetId}:`, {
        currency: `${newCode} (${newSymbol})`,
        showCompanyLogo,
        showHalalLogo,
        companyLogo: settings.CompanyLogoUrl ? 'YES' : 'NO',
        halalLogo: settings.HalalLogoUrl ? 'YES' : 'NO'
      });
      
      setCurrencyCode(newCode);
      setCurrencySymbol(newSymbol);
      
      // ✅ Store all settings in AsyncStorage
      await AsyncStorage.setItem(`currencyCode_${targetId}`, newCode);
      await AsyncStorage.setItem(`currencySymbol_${targetId}`, newSymbol);
      await AsyncStorage.setItem(`showCompanyLogo_${targetId}`, showCompanyLogo ? '1' : '0');
      await AsyncStorage.setItem(`showHalalLogo_${targetId}`, showHalalLogo ? '1' : '0');
      
      // ❌ REMOVE these lines - they're causing the error
      // if (window.updateCompanySettings) {
      //   window.updateCompanySettings({
      //     showCompanyLogo,
      //     showHalalLogo,
      //     companyLogo: settings.CompanyLogoUrl,
      //     halalLogo: settings.HalalLogoUrl
      //   });
      // }
      
      // ✅ Mark THIS outlet as loaded
      loadedOutletsRef.current.add(targetId);
    }
  } catch (error: any) {
    console.log(`❌ Settings load error for outlet ${targetId}:`, error.message);
    
    if (error.code === 'ECONNABORTED' || error.message === 'Network Error') {
      if (retryCount < 3) {
        console.log(`🔄 Retrying... attempt ${retryCount + 1}/3`);
        setTimeout(() => {
          loadingRef.current = false;
          loadCurrencyFromSettings(retryCount + 1, targetId);
        }, 2000 * (retryCount + 1));
        return;
      }
    }
    
    try {
      const savedCode = await AsyncStorage.getItem(`currencyCode_${targetId}`);
      const savedSymbol = await AsyncStorage.getItem(`currencySymbol_${targetId}`);
      
      if (savedCode && savedSymbol) {
        setCurrencyCode(savedCode);
        setCurrencySymbol(savedSymbol);
        console.log(`✅ Using saved currency for outlet ${targetId} from storage`);
        
        // Also load saved logo settings
        const savedCompanyLogo = await AsyncStorage.getItem(`showCompanyLogo_${targetId}`);
        const savedHalalLogo = await AsyncStorage.getItem(`showHalalLogo_${targetId}`);
        
        if (savedCompanyLogo !== null) {
          console.log(`✅ Loaded saved logo settings: company=${savedCompanyLogo}, halal=${savedHalalLogo}`);
        }
        
        loadedOutletsRef.current.add(targetId);
      } else {
        console.log('⚠️ Using default currency');
      }
    } catch (e) {
      // Keep defaults
    }
  } finally {
    loadingRef.current = false;
  }
};
  const formatPrice = useCallback((amount: number): string => {
    if (amount === undefined || amount === null) return `${currencySymbol}0.00`;
    return `${currencySymbol}${amount.toFixed(2)}`;
  }, [currencySymbol]);

  const setCurrency = async (code: string, symbol: string) => {
    console.log(`💰 Setting currency to ${code} (${symbol})`);
    
    setCurrencyCode(code);
    setCurrencySymbol(symbol);
    
    // Save with user prefix if logged in
    if (user?.id) {
      await AsyncStorage.setItem(`currencyCode_${user.id}`, code);
      await AsyncStorage.setItem(`currencySymbol_${user.id}`, symbol);
    } else {
      await AsyncStorage.setItem('currencyCode', code);
      await AsyncStorage.setItem('currencySymbol', symbol);
    }
  };

 const refreshCurrency = async () => {
  try {
    console.log('🔄 Refreshing currency...');
    
    const outletId = await AsyncStorage.getItem('selectedOutletId');
    
    if (!outletId) {
      console.log('⚠️ No outlet selected');
      return;
    }
    
    // ✅ Remove from loaded set to force reload
    loadedOutletsRef.current.delete(outletId);
    
    await loadCurrencyFromSettings(0, outletId);
    
  } catch (error) {
    console.log('❌ Error:', error);
  }
};
  return (
    <CurrencyContext.Provider value={{ 
      currencyCode, 
      currencySymbol, 
      formatPrice, 
      setCurrency,
      loadCurrencyFromSettings,
      refreshCurrency
    }}>
      {children}
    </CurrencyContext.Provider>
  );
};