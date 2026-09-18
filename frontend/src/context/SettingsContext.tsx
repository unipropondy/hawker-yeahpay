// src/context/SettingsContext.tsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CompanySettings {
  currencyCode: string;
  currencySymbol: string;
  shopName: string;
  gstType?: string;
}

interface SettingsContextType {
  theme: string;
  language: string;
  companySettings: CompanySettings;           // ✅ Added
  setTheme: (theme: string) => Promise<void>;
  setLanguage: (language: string) => Promise<void>;
  setCompanySettings: (settings: CompanySettings) => Promise<void>;  // ✅ Added
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
};

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setThemeState] = useState('light');
  const [language, setLanguageState] = useState('en');
  
  // ✅ ADD THIS - Company settings state
  const [companySettings, setCompanySettingsState] = useState<CompanySettings>({
    currencyCode: 'SGD',
    currencySymbol: '$',
    shopName: ''
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme');
      const savedLanguage = await AsyncStorage.getItem('language');
      const savedCompany = await AsyncStorage.getItem('companySettings');  // ✅ Load company settings
      
      if (savedTheme) setThemeState(savedTheme);
      if (savedLanguage) setLanguageState(savedLanguage);
      if (savedCompany) setCompanySettingsState(JSON.parse(savedCompany));  // ✅ Parse and set
      
    } catch (error) {
      console.log('Error loading settings:', error);
    }
  };

  const setTheme = async (newTheme: string) => {
    setThemeState(newTheme);
    await AsyncStorage.setItem('theme', newTheme);
  };

  const setLanguage = async (newLanguage: string) => {
    setLanguageState(newLanguage);
    await AsyncStorage.setItem('language', newLanguage);
  };

  // ✅ ADD THIS - Set company settings
  const setCompanySettings = async (settings: CompanySettings) => {
    setCompanySettingsState(settings);
    await AsyncStorage.setItem('companySettings', JSON.stringify(settings));
  };

  return (
    <SettingsContext.Provider value={{ 
      theme, 
      language, 
      companySettings,           // ✅ Added
      setTheme, 
      setLanguage,
      setCompanySettings         // ✅ Added
    }}>
      {children}
    </SettingsContext.Provider>
  );
};