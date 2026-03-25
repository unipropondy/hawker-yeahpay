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
                // ✅ Staff - save BOTH outlet ID and name
                const outletId = response.data.user.outletId;
                const outletName = response.data.user.shopName;
                const licenseKey = response.data.user.licenseKey || '';
    const expiryDate = response.data.user.expiryDate || '';
                await AsyncStorage.setItem('selectedOutletId', outletId.toString());
                await AsyncStorage.setItem('selectedOutletName', outletName);
                 await AsyncStorage.setItem('selectedOutletLicense', licenseKey);
    await AsyncStorage.setItem('selectedOutletExpiry', expiryDate);
                // Also set outletInfo immediately
               
                
                 console.log('📦 Staff login - saved outlet:', { outletId, outletName, licenseKey });
            }
            
            return true;
        }
        return false;
        
    } catch (error: any) {
        console.log('❌ Login error:', error.response?.data || error.message);
        
        const errorData = error.response?.data;
        
        if (errorData?.code === 'SESSION_ACTIVE' || errorData?.error === 'ALREADY_LOGGED_IN') {
            Alert.alert(
                '⚠️ Already Logged In',
                errorData.message || 'You are already logged in on another device!\n\nPlease logout from that device first.',
                [
                    { 
                        text: 'OK',
                        onPress: async () => {
                            await AsyncStorage.removeItem('remember_username');
                            await AsyncStorage.removeItem('remember_password');
                            await AsyncStorage.removeItem('token');
                            await AsyncStorage.removeItem('user');
                            await AsyncStorage.removeItem('selectedOutletId');
                            await AsyncStorage.removeItem('selectedOutletName');
                            console.log('🧹 Cleared all saved credentials and session');
                        }
                    }
                ]
            );
            return false;
        }
        
        // Handle other errors
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

 // frontend/src/context/AuthContext.tsx

const logout = async () => {
    try {
        // ✅ CRITICAL: Get token before clearing
        const token = await AsyncStorage.getItem('token');
        
        // ✅ Call backend to deactivate session
        if (token) {
            try {
                await API.post('/auth/logout', {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                console.log('✅ Session deactivated on server');
            } catch (apiError) {
                console.log('⚠️ Logout API error:', apiError.message);
                // Continue with local logout even if API fails
            }
        }
        
        // Clear local storage
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('user');
        await AsyncStorage.removeItem('selectedOutletId');
        
        setUser(null);
        setOutlets([]);
        setShowOutletSelector(false);
        
        console.log('✅ Logged out successfully');
        
    } catch (error) {
        console.log('❌ Logout error:', error);
        // Still try to clear local storage
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('user');
        await AsyncStorage.removeItem('selectedOutletId');
        setUser(null);
        setOutlets([]);
        setShowOutletSelector(false);
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