// frontend/src/context/AuthContext.tsx

import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import API from '../api';

interface User {
  id: number;
  username: string;
  role: string;
  fullName?: string;
  email?: string;
  shopName?: string;
  outletId?: number;
  ownerId?: number;
  clientId?: string | number; 
}

interface Outlet {
  Id: number;
  name: string;
  staffUsername?: string;
  LicenseActive?: boolean;
  ExpiryDate?: string;
}

interface AuthContextType {
  user: User | null;
  outlets: Outlet[];
  showOutletSelector: boolean;
  setShowOutletSelector: (show: boolean) => void;
  setAvailableOutlets: (outlets: Outlet[]) => void;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  selectOutlet: (outletId: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [showOutletSelector, setShowOutletSelector] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const userStr = await AsyncStorage.getItem('user');
      
      if (token && userStr) {
        
      }
    } catch (error) {
      console.log('❌ Error checking user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ LOGIN FUNCTION - PUT HERE
  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await API.post('/auth/login', { username, password });
      
      if (response.data) {
        // Save token and user
        await AsyncStorage.setItem('token', response.data.token);
        await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
        
        setUser(response.data.user);
        
        // ✅ Check if owner with outlets
        if (response.data.user.role === 'owner' && response.data.outlets) {
          console.log('🏪 Owner has outlets:', response.data.outlets.length);
          setOutlets(response.data.outlets);
          setShowOutletSelector(true);
        } 
        else if (response.data.user.role === 'staff') {
          // Staff - save outlet
          await AsyncStorage.setItem('selectedOutletId', response.data.user.outletId.toString());
        }
        
        return true;
      }
      return false;
      
    } catch (error: any) {
      console.log('❌ Login error:', error.response?.data || error.message);
      
      // ✅ Handle different error types with proper messages
      const errorData = error.response?.data;
      
      if (errorData?.code === 'ACCOUNT_BLOCKED') {
  Alert.alert('⛔ Account Blocked', errorData.message);
} 
else if (errorData?.code === 'OUTLET_BLOCKED') {
  Alert.alert('🚫 Outlet Deactivated', errorData.message);
}
else if (errorData?.code === 'LICENSE_EXPIRED') {
  Alert.alert('📅 License Expired', errorData.message);
}
else if (error.response?.status === 401) {
  Alert.alert('❌ Login Failed', 'Invalid username or password');
}
      
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ SELECT OUTLET FUNCTION
  const selectOutlet = async (outletId: number) => {
    try {
      await AsyncStorage.setItem('selectedOutletId', outletId.toString());
      setShowOutletSelector(false);
      
      // You can emit an event or callback here
      console.log('✅ Outlet selected:', outletId);
      
    } catch (error) {
      console.log('❌ Error selecting outlet:', error);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('selectedOutletId');
      setUser(null);
      setOutlets([]);
      setShowOutletSelector(false);
      console.log('✅ Logged out');
    } catch (error) {
      console.log('❌ Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      outlets,
      showOutletSelector,
      setShowOutletSelector,
      setAvailableOutlets: setOutlets,
      isLoading, 
      login, 
      logout,
      selectOutlet
    }}>
      {children}
    </AuthContext.Provider>
  );
};