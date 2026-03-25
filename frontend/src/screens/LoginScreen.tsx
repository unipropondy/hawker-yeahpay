// src/screens/LoginScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Image,
  Switch  
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage'; // ✅ ADD THIS
import { useAuth } from '../context/AuthContext';

const companyLogo = require('../../assets/images/smarthawker icon final.png');

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false); // ✅ NEW
  const [checkingStorage, setCheckingStorage] = useState(true); // ✅ NEW

  const { login } = useAuth();

  // ✅ Load saved credentials when screen opens
  useEffect(() => {
    loadSavedCredentials();
  }, []);

  // ✅ Function to load saved credentials
  const loadSavedCredentials = async () => {
    try {
      const savedUsername = await AsyncStorage.getItem('remember_username');
      const savedPassword = await AsyncStorage.getItem('remember_password');
      const savedRemember = await AsyncStorage.getItem('remember_me');
      
      if (savedUsername && savedPassword && savedRemember === 'true') {
        setUsername(savedUsername);
        setPassword(savedPassword);
        setRememberMe(true);
        console.log('✅ Loaded saved credentials for:', savedUsername);
      }
    } catch (error) {
      console.log('❌ Error loading saved credentials:', error);
    } finally {
      setCheckingStorage(false);
    }
  };

  // ✅ Save credentials if remember me is checked
  const saveCredentials = async (username: string, password: string) => {
    try {
      if (rememberMe) {
        await AsyncStorage.setItem('remember_username', username);
        await AsyncStorage.setItem('remember_password', password);
        await AsyncStorage.setItem('remember_me', 'true');
        console.log('✅ Credentials saved for:', username);
      } else {
        await AsyncStorage.removeItem('remember_username');
        await AsyncStorage.removeItem('remember_password');
        await AsyncStorage.setItem('remember_me', 'false');
        console.log('🧹 Cleared saved credentials');
      }
    } catch (error) {
      console.log('❌ Error saving credentials:', error);
    }
  };

  // ✅ Clear saved credentials (optional - for testing)
  

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
        Alert.alert('Warning', 'Please enter username and password');
        return;
    }

    setLoading(true);
    try {
        console.log('📝 Attempting login with:', username);
        
        const success = await login(username, password);
        
        if (success) {
            // ✅ Save credentials after successful login
            await saveCredentials(username, password);
            console.log('✅ Login successful');
        } else {
            // ✅ Login failed - clear fields to prevent auto-retry
            console.log('❌ Login failed - clearing fields');
            setUsername('');
            setPassword('');
            // Don't clear rememberMe state, but clear saved credentials
            await clearSavedCredentials();
        }
    } catch (error: any) {
        console.log('❌ Login error:', error);
        // Also clear on error
        setUsername('');
        setPassword('');
    } finally {
        setLoading(false);
    }
};

// Add this helper function
const clearSavedCredentials = async () => {
    try {
        await AsyncStorage.removeItem('remember_username');
        await AsyncStorage.removeItem('remember_password');
        await AsyncStorage.setItem('remember_me', 'false');
        setRememberMe(false);
        console.log('🧹 Cleared saved credentials');
    } catch (error) {
        console.log('❌ Error clearing credentials:', error);
    }
};
  // Show loading while checking storage
  if (checkingStorage) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FF4444" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.loginCard}>
            {/* Company Logo */}
            <View style={styles.logoContainer}>
              <Image 
                source={companyLogo}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            <Text style={styles.welcomeText}>
              Welcome Back!
            </Text>
            
            <Text style={styles.subText}>
              Login to Smart Hawker POS
            </Text>

            {/* Login Form */}
            <View style={styles.formContainer}>
              {/* Username Input */}
              <View style={styles.inputContainer}>
                <MaterialIcons name="person" size={20} color="#666" />
                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  placeholderTextColor="#999"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  editable={!loading}
                />
                {username !== '' && (
                  <TouchableOpacity onPress={() => setUsername('')}>
                    <MaterialIcons name="close" size={20} color="#999" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <MaterialIcons name="lock" size={20} color="#666" />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                  autoCapitalize="none"  
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <MaterialIcons 
                    name={showPassword ? 'visibility' : 'visibility-off'} 
                    size={20} 
                    color="#666" 
                  />
                </TouchableOpacity>
              </View>

              {/* ✅ REMEMBER ME SECTION */}
              <View style={styles.rememberMeContainer}>
                <View style={styles.rememberMeLeft}>
                  <Switch
                    value={rememberMe}
                    onValueChange={setRememberMe}
                    trackColor={{ false: '#ddd', true: '#FF4444' }}
                    thumbColor={rememberMe ? '#fff' : '#f4f3f4'}
                  />
                  <Text style={styles.rememberMeText}>Remember Me</Text>
                </View>

              
              </View>

              {/* Login Button */}
              <TouchableOpacity
                style={[styles.loginButton, loading && styles.disabledButton]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.loginButtonText}>Login</Text>
                )}
              </TouchableOpacity>

              {/* Hint text */}
             
            </View>

            {/* Company Name and Copyright */}
            <View style={styles.companyFooter}>
              <Text style={styles.companyName}>
                SMART HAWKER BY UNIPROSG
              </Text>
              <Text style={styles.copyright}>
                © 2026-2027 UNIPRO SOFTWARES SG PTE LTD. All rights reserved.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ✅ STYLES - Add these new styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  loginCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,  // ✅ Makes it round (half of width/height)
    backgroundColor: '#fafafa',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
},
  logoImage: {
    width: 100,
    height: 100,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
  },
  subText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
  },
  formContainer: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    height: 50,
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
  },
  // ✅ NEW STYLES
  rememberMeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  rememberMeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rememberMeText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  clearText: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'underline',
    padding: 4,
  },
  hintText: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  loginButton: {
    height: 50,
    backgroundColor: '#FF4444',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.7,
  },
  companyFooter: {
    marginTop: 30,
    alignItems: 'center',
  },
  companyName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  copyright: {
    fontSize: 10,
    color: '#999',
  },
  // Keep existing styles
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    marginHorizontal: 10,
    fontSize: 12,
    color: '#666',
  },
  quickLoginContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  quickLoginBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  quickLoginBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});