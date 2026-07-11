// frontend/src/api.ts

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';  // ✅ Add Alert yjn
export const API_BASE_URL = 'https://hawker-yeahpay-production.up.railway.app';
export const IMAGE_BASE_URL = API_BASE_URL;
// We'll use this to navigate
let navigateToLogin = null;
let lastLoggedUrl = '';
let lastLoggedTime = 0;
export const setNavigationCallback = (callback) => {
  navigateToLogin = callback;
};

const getBaseURL = () => {
  if (__DEV__) {
    return 'https://hawker-yeahpay-production.up.railway.app/api';
  } else {
    // Production URL
    return 'https://hawker-yeahpay-production.up.railway.app/api';
  }
};
// Before login, test connection
const testAPI = async () => {
  try {
    const url = process.env.EXPO_PUBLIC_API_URL || 'https://hawker-yeahpay-production.up.railway.app/api';
    console.log('🔍 Testing API URL:', url);
    
    const response = await fetch(`${url}/test`);
    const data = await response.json();
    console.log('✅ API Test Success:', data);
    return true;
  } catch (error) {
    console.log('❌ API Test Failed:', error.message);
    return false;
  }
};
const BASE_URL = getBaseURL();
console.log('📱 Platform:', Platform.OS);
console.log('🌐 API Base URL:', BASE_URL);
console.log('🚀 Environment:', __DEV__ ? 'Development' : 'Production');

const API = axios.create({
  baseURL: BASE_URL,
  timeout: 180000, // Increase to 60 seconds
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    
  }
});

API.interceptors.response.use(
  response => response,
  async error => {
    // If timeout, retry once
    if (error.code === 'ECONNABORTED' && !error.config._retry) {
      error.config._retry = true;
      console.log('🔄 Retrying...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      return API(error.config);
    }
    return Promise.reject(error);
  }
);
export const setSelectedOutlet = (outletId) => {
    AsyncStorage.setItem('selectedOutletId', outletId.toString());
};

// In API interceptor
// In API interceptor - UPDATE THIS SECTION
API.interceptors.request.use(async (config) => {
    const token = await AsyncStorage.getItem('token');
    const user = await AsyncStorage.getItem('user');
    const userData = user ? JSON.parse(user) : null;
    const selectedOutletId = await AsyncStorage.getItem('selectedOutletId');
    
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    
    // ✅ Add outlet header for ALL requests (GET, POST, PUT, DELETE)
    if (selectedOutletId) {
        config.headers['X-Outlet-Id'] = selectedOutletId;
        
        // ✅ For GET requests, add to query params
        if (config.method?.toLowerCase() === 'get') {
            config.params = { ...config.params, outletId: selectedOutletId };
        }
        
        console.log(`📍 Outlet ID: ${selectedOutletId} added to ${config.method?.toUpperCase()} ${config.url}`);
    }
    
    // Fallback for staff (if selectedOutletId not available)
    if (userData?.role === 'staff' && userData.outletId && !selectedOutletId) {
        config.headers['X-Outlet-Id'] = userData.outletId;
        if (config.method?.toLowerCase() === 'get') {
            config.params = { ...config.params, outletId: userData.outletId };
        }
    }
    
    return config;
});
// Add token to every request
API.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    console.log('🔑 Token found:', token ? 'Yes' : 'No');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add timestamp to track duration
    config.metadata = { startTime: Date.now() };
    
    console.log('➡️ Request:', config.method.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);


// Handle response errors
API.interceptors.response.use(
   (response) => {
    const duration = Date.now() - (response.config?.metadata?.startTime || 0);
    console.log(`✅ Response: ${response.config.url} (${duration}ms)`);
    return response;
  },
   async (error) => {
    const duration = Date.now() - (error.config?.metadata?.startTime || 0);
    console.log(`❌ Error after ${duration}ms:`, error.message);
    // Technical log (only you see)
    console.log('🔴 API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });

    // ✅ Check for forceLogout (account blocked)
    if (error.response?.data?.forceLogout) {
      // Show alert and force logout
      Alert.alert(
        'Account Blocked',
        error.response.data.message || 'Your account has been blocked by administrator.',
        [
          {
            text: 'OK',
            onPress: async () => {
              console.log('🚪 Logging out due to account block');
              await AsyncStorage.removeItem('token');
              await AsyncStorage.removeItem('user');
              if (navigateToLogin) {
                navigateToLogin();
              }
            }
          }
        ],
        { cancelable: false }  // ✅ Add this - prevents tapping outside
      );
      
      error.userMessage = error.response.data.message || 'Account blocked';
      return Promise.reject(error);
    }

    // Create user-friendly error message for other errors
    let userMessage = 'Something went wrong. Please try again.';
    
    if (!error.response) {
      // Network error
      userMessage = 'Network error. Please check your internet connection.';
    } else {
      // Server responded with error
      switch (error.response.status) {
        case 400:
          userMessage = 'Invalid request. Please check your input.';
          break;
        case 401:
          userMessage = 'Session expired. Please login again.';
          // Clear storage and redirect to login
          await AsyncStorage.removeItem('token');
          await AsyncStorage.removeItem('user');
          if (navigateToLogin) {
            navigateToLogin();
          }
          break;
        case 403:
          // Check if it's license expired
          if (error.response.data?.code === 'LICENSE_EXPIRED') {
            userMessage = error.response.data.message || 'License expired';
          } else {
            userMessage = 'You don\'t have permission to do this.';
          }
          break;
        case 404:
          userMessage = 'Service not available.';
          break;
        case 500:
          userMessage = 'Server error. Please try later.';
          break;
        default:
          userMessage = 'Something went wrong. Please try again.';
      }
    }

    // Attach user-friendly message to error
    error.userMessage = userMessage;
    
    return Promise.reject(error);
  }
);

// For file uploads
export const uploadAPI = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'multipart/form-data',
  },
});

uploadAPI.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    const selectedOutletId = await AsyncStorage.getItem('selectedOutletId');
    const user = await AsyncStorage.getItem('user');
    const userData = user ? JSON.parse(user) : null;
    
    console.log('📤 UPLOAD Request:', {
      url: config.url,
      method: config.method,
      hasToken: !!token,
      outletId: selectedOutletId || userData?.outletId
    });
    
    // Add token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // ✅ CRITICAL: Add outlet header for uploads!
    if (selectedOutletId) {
      config.headers['X-Outlet-Id'] = selectedOutletId;
      console.log(`📍 UPLOAD with Outlet ID from storage: ${selectedOutletId}`);
    } 
    // Fallback for staff
    else if (userData?.role === 'staff' && userData.outletId) {
      config.headers['X-Outlet-Id'] = userData.outletId;
      console.log(`📍 UPLOAD with Staff Outlet ID: ${userData.outletId}`);
    }
    
    // Add timestamp for tracking
    config.metadata = { startTime: Date.now() };
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
export const getFullImageUrl = (imageUri) => {
  if (!imageUri) return null;
  if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
    return imageUri;
  }
  if (imageUri.startsWith('/')) {
    return `${IMAGE_BASE_URL}${imageUri}`;
  }
  return `${IMAGE_BASE_URL}/${imageUri}`;
};

// Update response interceptor
uploadAPI.interceptors.response.use(
  (response) => {
    const duration = Date.now() - (response.config?.metadata?.startTime || 0);
    console.log(`✅ UPLOAD Response: ${response.config.url} (${duration}ms)`);
    return response;
  },
  async (error) => {
    const duration = Date.now() - (error.config?.metadata?.startTime || 0);
    console.log(`❌ UPLOAD Error after ${duration}ms:`, error.message);
    console.log('🔴 UPLOAD Error Details:', {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data,
      headers: error.config?.headers
    });

    // ✅ Handle force logout
    if (error.response?.data?.forceLogout) {
      Alert.alert(
        'Account Blocked',
        error.response.data.message || 'Your account has been blocked by administrator.',
        [
          {
            text: 'OK',
            onPress: async () => {
              await AsyncStorage.removeItem('token');
              await AsyncStorage.removeItem('user');
              await AsyncStorage.removeItem('selectedOutletId');
              if (navigateToLogin) navigateToLogin();
            }
          }
        ]
      );
      error.userMessage = error.response.data.message || 'Account blocked';
      return Promise.reject(error);
    }

    // ✅ Handle 400 - OUTLET_REQUIRED specifically
    if (error.response?.status === 400 && error.response?.data?.error === 'OUTLET_REQUIRED') {
      console.log('⚠️ Outlet required for upload - checking storage...');
      
      // Try to get outlet again
      const outletId = await AsyncStorage.getItem('selectedOutletId');
      if (outletId) {
        console.log('📍 Found outlet in storage:', outletId);
        // You could retry here if needed
      }
    }

    // Handle other errors
    let userMessage = 'Upload failed. Please try again.';
    
    if (!error.response) {
      userMessage = 'Network error. Check your connection.';
    } else {
      switch (error.response.status) {
        case 400:
          userMessage = error.response.data?.message || 'Invalid request. Please check your input.';
          break;
        case 401:
          userMessage = 'Session expired. Please login again.';
          await AsyncStorage.removeItem('token');
          await AsyncStorage.removeItem('user');
          await AsyncStorage.removeItem('selectedOutletId');
          if (navigateToLogin) navigateToLogin();
          break;
        case 403:
          userMessage = error.response.data?.message || 'Permission denied.';
          break;
        case 413:
          userMessage = 'File too large. Max 5MB allowed.';
          break;
        default:
          userMessage = 'Upload failed. Please try again.';
      }
    }
    
    error.userMessage = userMessage;
    return Promise.reject(error);
  }
);

export default API;