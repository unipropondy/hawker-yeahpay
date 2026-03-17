// hooks/useLicenseTimer.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import API from '../api';
import { Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  text: string;
  class?: string;
}

export const useLicenseTimer = () => {
  const [licenseInfo, setLicenseInfo] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ 
    days: 0, 
    hours: 0, 
    minutes: 0, 
    seconds: 0,
    text: 'Loading...'
  });
  const [isVisible, setIsVisible] = useState(true);
  
  const expiryRef = useRef<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { logout } = useAuth();
  const loggedOutRef = useRef(false);

  const calculateTimeLeft = useCallback(() => {
    if (!expiryRef.current) {
      setTimeLeft(prev => ({ ...prev, text: 'No License' }));
      return;
    }

    try {
      const expiryStr = expiryRef.current;
      
      // Parse date
      const year = parseInt(expiryStr.substring(0, 4));
      const month = parseInt(expiryStr.substring(5, 7)) - 1;
      const day = parseInt(expiryStr.substring(8, 10));
      const hours = parseInt(expiryStr.substring(11, 13));
      const minutes = parseInt(expiryStr.substring(14, 16));
      
      const expiryDate = new Date(year, month, day, hours, minutes, 0);
      const now = new Date();
      
      const diffMs = expiryDate.getTime() - now.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffSecs = Math.floor(diffMs / 1000);

      console.log('⏱️ License:', {
        expiry: expiryDate.toString(),
        now: now.toString(),
        diffMins,
        diffSecs,
        expired: diffMins <= 0
      });

      // 🚨 EXACT 0 MINUTE LOGOUT
      if (diffMins <= 0 && !loggedOutRef.current) {
        console.log('🚨 LICENSE EXPIRED! Logging out now...');
        loggedOutRef.current = true;
        
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        
        Alert.alert(
          'License Expired',
          'Your license has expired. Please contact your administrator.',
          [
            {
              text: 'OK',
              onPress: async () => {
                await logout();
              }
            }
          ],
          { cancelable: false }
        );
        
        setTimeLeft({ 
          days: 0, 
          hours: 0, 
          minutes: 0, 
          seconds: 0, 
          text: 'Expired',
          class: 'status-expired'
        });
        return;
      }
      
      // Calculate time left only if not expired
      let text = '';
      let statusClass = '';
      
      if (diffMins < 60) {
        text = `${diffMins} minutes`;
        statusClass = 'status-warning';
      } else if (diffMins < 1440) {
        const h = Math.floor(diffMins / 60);
        const m = diffMins % 60;
        text = `${h}h ${m}m`;
        statusClass = 'status-warning';
      } else {
        const d = Math.floor(diffMins / 1440);
        const h = Math.floor((diffMins % 1440) / 60);
        text = `${d}d ${h}h`;
        statusClass = d < 7 ? 'status-warning' : 'status-active';
      }

      const days = Math.floor(diffMins / 1440);
      const hoursLeft = Math.floor((diffMins % 1440) / 60);
      const minsLeft = diffMins % 60;
      const secsLeft = Math.floor((diffMs % (1000 * 60)) / 1000);

      setTimeLeft({ 
        days, 
        hours: hoursLeft, 
        minutes: minsLeft, 
        seconds: secsLeft,
        text,
        class: statusClass
      });
      
    } catch (error) {
      console.log('❌ Timer error:', error);
    }
  }, [logout]);

  const loadLicense = useCallback(async () => {
    try {
      const response = await API.get('/license/status');
      
      const expiryDate = response.data?.ExpiryDate;
      
      if (expiryDate) {
        console.log('📦 License expiry:', expiryDate);
        expiryRef.current = expiryDate;
        setLicenseInfo(response.data);
        
        // Check if already expired on load
        const year = parseInt(expiryDate.substring(0, 4));
        const month = parseInt(expiryDate.substring(5, 7)) - 1;
        const day = parseInt(expiryDate.substring(8, 10));
        const hours = parseInt(expiryDate.substring(11, 13));
        const minutes = parseInt(expiryDate.substring(14, 16));
        
        const expiry = new Date(year, month, day, hours, minutes, 0);
        const now = new Date();
        
        if (expiry <= now && !loggedOutRef.current) {
          console.log('🚨 License already expired!');
          loggedOutRef.current = true;
          
          Alert.alert(
            'License Expired',
            'Your license has expired. Please contact your administrator.',
            [
              {
                text: 'OK',
                onPress: async () => {
                  await logout();
                }
              }
            ],
            { cancelable: false }
          );
          return;
        }
        
        calculateTimeLeft();
      }
    } catch (error) {
      console.log('❌ License load error:', error);
    }
  }, [calculateTimeLeft, logout]);

  useEffect(() => {
    loadLicense();
    timerRef.current = setInterval(calculateTimeLeft, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return {
    licenseInfo,
    timeLeft,
    setIsVisible,
    refreshLicense: loadLicense
  };
};