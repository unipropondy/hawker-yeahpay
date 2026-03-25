// App.js
import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState, View, ActivityIndicator, Text, Platform } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SettingsProvider } from './src/context/SettingsContext';
import LoginScreen from './src/screens/LoginScreen';
import PosScreen from './src/screens/PosScreen';
import { setNavigationCallback } from './src/api';
import { CurrencyProvider } from './src/context/CurrencyContext';

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { user, isLoading, logout } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const appState = useRef(AppState.currentState);
  const logoutTimeout = useRef(null);
  const isImagePickerOpen = useRef(false);
  const isReturningFromPicker = useRef(false);
  const lastTransitionTime = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const markImagePickerOpen = () => {
    console.log('📸 Image picker opened - Setting 2 minute timeout');
    isImagePickerOpen.current = true;
    isReturningFromPicker.current = false;
    if (logoutTimeout.current) {
      clearTimeout(logoutTimeout.current);
      logoutTimeout.current = null;
    }
  };

  const markImagePickerClose = () => {
    console.log('📸 Image picker closed - marking return');
    isReturningFromPicker.current = true;
    isImagePickerOpen.current = false;
    if (logoutTimeout.current) {
      clearTimeout(logoutTimeout.current);
      logoutTimeout.current = null;
    }
    // Reset return flag after 1 second
    setTimeout(() => {
      isReturningFromPicker.current = false;
    }, 1000);
  };

  useEffect(() => {
    // @ts-ignore
    window.__markImagePickerOpen = markImagePickerOpen;
    // @ts-ignore
    window.__markImagePickerClose = markImagePickerClose;
    
    return () => {
      // @ts-ignore
      delete window.__markImagePickerOpen;
      // @ts-ignore
      delete window.__markImagePickerClose;
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [logout]);

  const handleAppStateChange = async (nextAppState) => {
    const now = Date.now();
    console.log(`📱 AppState: ${appState.current} -> ${nextAppState}`);
    
    // Clear any pending logout
    if (logoutTimeout.current) {
      clearTimeout(logoutTimeout.current);
      logoutTimeout.current = null;
    }
    
    // ✅ If we're returning from picker, ignore ALL state changes
    if (isReturningFromPicker.current) {
      console.log('🔄 Returning from image picker - ignoring state changes');
      lastTransitionTime.current = now;
      appState.current = nextAppState;
      return;
    }
    
    // ✅ Ignore rapid successive transitions (within 500ms)
    if (now - lastTransitionTime.current < 500) {
      console.log('⏱️ Ignoring rapid state change');
      lastTransitionTime.current = now;
      appState.current = nextAppState;
      return;
    }
    
    lastTransitionTime.current = now;
    
    // ✅ App is going to background (minimized)
    if (appState.current === 'active' && nextAppState === 'background') {
      
      if (isImagePickerOpen.current) {
        console.log('📸 Image picker - 2 minute timeout');
        logoutTimeout.current = setTimeout(async () => {
          const currentState = AppState.currentState;
          if (currentState !== 'active') {
            console.log('📸 Image picker timeout (2 min) - logging out');
            await logout();
          }
        }, 120000); // 2 minutes
      } else {
        // ✅ Normal background (minimize) - 5 minute timeout
        console.log('📱 App minimized - Will logout after 5 minutes if not resumed');
        logoutTimeout.current = setTimeout(async () => {
          const currentState = AppState.currentState;
          if (currentState !== 'active') {
            console.log('📱 App in background for 5 minutes - Auto logging out...');
            await logout();
          }
        }, 300000); // 5 minutes = 300,000 ms
      }
    }
    
    // ✅ App came back to foreground (resumed)
    if (appState.current === 'background' && nextAppState === 'active') {
      console.log('📱 App resumed from background - cancelling logout');
      if (logoutTimeout.current) {
        clearTimeout(logoutTimeout.current);
        logoutTimeout.current = null;
      }
      isImagePickerOpen.current = false;
    }
    
    appState.current = nextAppState;
  };

  console.log('🔄 AppNavigator - User:', user ? user.username : 'No user');
  console.log('🔄 AppNavigator - Loading:', isLoading);

  if (isLoading || !isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FF4444" />
        <Text style={{ marginTop: 10 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <Stack.Screen name="POS" component={PosScreen} />
      )}
    </Stack.Navigator>
  );
}

function CallbackSetter() {
  const { logout } = useAuth();

  useEffect(() => {
    setNavigationCallback(async () => {
      console.log('🚪 Force logout triggered');
      await logout();
    });
  }, [logout]);

  return null;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <AuthProvider>
          <CurrencyProvider>  
            <CallbackSetter />  
            <NavigationContainer>
              <AppNavigator />
            </NavigationContainer>
          </CurrencyProvider>
        </AuthProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}