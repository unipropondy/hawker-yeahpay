// frontend/src/components/BluetoothPrinterService.ts - Driverless Bluetooth Thermal Printer Service

import { Platform, Alert, PermissionsAndroid } from 'react-native';

export interface BluetoothPrinterConfig {
  address?: string; // MAC address or Bluetooth device ID
  name?: string;
  charactersPerLine?: number;
}

export class BluetoothPrinterService {
  private static connectedWebDevice: any = null;
  private static connectedWebCharacteristic: any = null;

  /**
   * Request Android Bluetooth Permissions at runtime
   */
  static async requestAndroidPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    try {
      if (Platform.Version >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        const connectGranted = granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED;
        console.log('🔐 Android BLUETOOTH_CONNECT permission status:', connectGranted);
        return connectGranted;
      } else {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ]);
        return granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (e) {
      console.log('⚠️ Permission request error:', e);
      return true;
    }
  }

  /**
   * Driverless Web Bluetooth connection helper
   */
  static async requestWebBluetoothDevice(): Promise<{ name: string; id: string } | null> {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !(navigator as any).bluetooth) {
      Alert.alert('Web Bluetooth', 'Web Bluetooth API is not supported in this browser. Please use Chrome, Edge, or Opera.');
      return null;
    }

    try {
      console.log('📡 Requesting Web Bluetooth Thermal Printer...');
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', // Standard ESC/POS printer service
          '00001101-0000-1000-8000-00805f9b34fb', // Serial Port Profile (SPP)
          '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC transparent service
          '0000e0ff-0000-1000-8000-00805f9b34fb'  // Custom thermal printer service
        ]
      });

      if (device) {
        this.connectedWebDevice = device;
        console.log('✅ Connected Web Bluetooth device:', device.name, device.id);
        return { name: device.name || 'Bluetooth Printer', id: device.id };
      }
      return null;
    } catch (err: any) {
      console.log('⚠️ Web Bluetooth device request cancelled/failed:', err?.message || err);
      return null;
    }
  }

  /**
   * Connect to GATT characteristic on Web
   */
  private static async connectWebGatt(): Promise<any> {
    if (!this.connectedWebDevice) return null;
    try {
      if (this.connectedWebCharacteristic) return this.connectedWebCharacteristic;
      const server = await this.connectedWebDevice.gatt.connect();
      const services = await server.getPrimaryServices();
      for (const service of services) {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            this.connectedWebCharacteristic = char;
            return char;
          }
        }
      }
      return null;
    } catch (e) {
      console.log('❌ Web GATT connection error:', e);
      return null;
    }
  }

  /**
   * Get paired Bluetooth devices on Native Android/iOS
   */
  static async getPairedDevices(): Promise<{ deviceName: string; macAddress: string }[]> {
    if (Platform.OS === 'web') return [];
    try {
      await this.requestAndroidPermissions();
      const ThermalPrinter = require('react-native-thermal-printer');
      const printerApi = ThermalPrinter ? (ThermalPrinter.default || ThermalPrinter) : null;
      if (printerApi && typeof printerApi.getBluetoothDeviceList === 'function') {
        const devices = await printerApi.getBluetoothDeviceList();
        console.log('📋 Found paired Bluetooth devices:', devices);
        return devices || [];
      }
      return [];
    } catch (err) {
      console.log('⚠️ Error getting paired Bluetooth devices:', err);
      return [];
    }
  }

  /**
   * Print ESC/POS payload via Bluetooth driverlessly
   */
  static async printReceipt(
    payload: string,
    config: BluetoothPrinterConfig
  ): Promise<boolean> {
    try {
      // 1. WEB PLATFORM: Web Bluetooth GATT
      if (Platform.OS === 'web') {
        if (!(navigator as any).bluetooth) {
          throw new Error('Web Bluetooth not supported in this browser.');
        }

        if (!this.connectedWebDevice) {
          const selected = await this.requestWebBluetoothDevice();
          if (!selected) return false;
        }

        const characteristic = await this.connectWebGatt();
        if (!characteristic) {
          throw new Error('Could not find writable GATT characteristic on Bluetooth printer.');
        }

        // Convert string formatted text into raw Uint8Array ESC/POS buffer
        const encoder = new TextEncoder();
        const data = encoder.encode(payload);

        // Send data in chunks of 512 bytes
        const chunkSize = 512;
        for (let i = 0; i < data.length; i += chunkSize) {
          const chunk = data.slice(i, i + chunkSize);
          if (characteristic.properties.writeWithoutResponse) {
            await characteristic.writeValueWithoutResponse(chunk);
          } else {
            await characteristic.writeValue(chunk);
          }
        }
        console.log('✅ Web Bluetooth receipt printed successfully');
        return true;
      }

      // 2. NATIVE MOBILE PLATFORM: Direct Bluetooth thermal socket via react-native-thermal-printer
      await this.requestAndroidPermissions();
      const ThermalPrinter = require('react-native-thermal-printer');
      const printerApi = ThermalPrinter ? (ThermalPrinter.default || ThermalPrinter) : null;

      if (!printerApi || typeof printerApi.printBluetooth !== 'function') {
        throw new Error('Native Bluetooth thermal printer module not available');
      }

      // ✅ STEP 1: Always populate btDevicesList in native Java module first
      let pairedDevices: { deviceName: string; macAddress: string }[] = [];
      try {
        if (typeof printerApi.getBluetoothDeviceList === 'function') {
          pairedDevices = (await printerApi.getBluetoothDeviceList()) || [];
          console.log('📋 Paired Bluetooth devices list:', pairedDevices);
        }
      } catch (listErr) {
        console.log('⚠️ Error fetching paired device list:', listErr);
      }

      // ✅ STEP 2: Find exact MAC address from paired devices if available
      const targetQuery = (config.address || config.name || '').trim().toLowerCase();
      let matchedMac = '';

      if (targetQuery && pairedDevices.length > 0) {
        const found = pairedDevices.find(d => {
          const dMac = (d.macAddress || '').toLowerCase();
          const dName = (d.deviceName || '').toLowerCase();
          const cleanTarget = targetQuery.replace(/[:-]/g, '');
          const cleanMac = dMac.replace(/[:-]/g, '');
          return dMac === targetQuery || dName === targetQuery || cleanMac === cleanTarget;
        });
        if (found) {
          matchedMac = found.macAddress;
          console.log('✅ Matched paired Bluetooth MAC:', matchedMac, 'for device:', found.deviceName);
        }
      }

      // ✅ STEP 3: Format ESC/POS payload for Dantsu EscPosPrinter parser (requires [L], [C], [R] line tags)
      let formattedPayload = payload
        .split('\n')
        .map(l => (!l ? '[L] ' : (l.startsWith('[L]') || l.startsWith('[C]') || l.startsWith('[R]')) ? l : `[L]${l}`))
        .join('\n') + '\n[L] \n[L] \n[L] \n';

      // Clean payload: escape any lone < or > XML tags that could crash Dantsu parser
      formattedPayload = formattedPayload.replace(/<(?!\/?(b|u|i|c|font|img|a|code|strong|em)\b)[^>]*>/gi, '');

      // ✅ STEP 4: Attempt printing with multi-strategy fallback (Uppercase MAC or empty string for selectFirstPaired)
      const attempts: string[] = [];
      if (matchedMac) attempts.push(matchedMac.toUpperCase());
      if (config.address && config.address.includes(':')) attempts.push(config.address.toUpperCase());
      attempts.push(''); // Final fallback: selectFirstPaired() -> picks first paired Bluetooth printer automatically

      let lastError: any = null;

      for (const macAttempt of attempts) {
        try {
          console.log(`📡 Attempting Bluetooth print to MAC: "${macAttempt}"...`);
          await printerApi.printBluetooth({
            macAddress: macAttempt,
            payload: formattedPayload,
            autoCut: true,
            openCashbox: false,
            mmFeedPaper: 25,
            printerDpi: 203,
            printerWidthMM: 58,
            printerNbrCharactersPerLine: config.charactersPerLine || 32
          });
          console.log(`✅ Native Bluetooth print successful with MAC: "${macAttempt}"`);
          return true;
        } catch (err: any) {
          lastError = err;
          console.log(`⚠️ Bluetooth print attempt failed for "${macAttempt}":`, err?.message || err);
        }
      }

      throw lastError || new Error('Failed to connect to any paired Bluetooth thermal printer.');
    } catch (error: any) {
      const errMsg = error?.message || String(error);
      console.log('❌ Bluetooth Printer error:', errMsg);
      Alert.alert(
        'Bluetooth Printer Error',
        `Could not print to Bluetooth printer (${config.name || config.address || 'PSF588'}).\n\nDetail: ${errMsg}\n\nPlease check:\n1. Close any other printer apps (RawBT, PrinterShare, etc.).\n2. Ensure Bluetooth is ON and printer is paired in Android settings.\n3. Turn printer OFF and ON again.`
      );
      return false;
    }
  }

  /**
   * Driverless Open Cash Drawer over Bluetooth
   */
  static async openCashDrawer(config: BluetoothPrinterConfig): Promise<boolean> {
    try {
      // ESC/POS Cash drawer kick bytes: ESC p 0 25 250
      const kickCommand = '\x1B\x70\x00\x19\xFA';

      if (Platform.OS === 'web') {
        const characteristic = await this.connectWebGatt();
        if (characteristic) {
          const encoder = new TextEncoder();
          await characteristic.writeValue(encoder.encode(kickCommand));
          return true;
        }
        return false;
      }

      const ThermalPrinter = require('react-native-thermal-printer');
      const printerApi = ThermalPrinter ? (ThermalPrinter.default || ThermalPrinter) : null;

      if (printerApi && typeof printerApi.printBluetooth === 'function') {
        await printerApi.printBluetooth({
          macAddress: config.address || '',
          payload: kickCommand,
          autoCut: false,
          openCashbox: true,
          mmFeedPaper: 0,
          printerNbrCharactersPerLine: 32
        });
        return true;
      }
      return false;
    } catch (err) {
      console.log('❌ Bluetooth Cash Drawer error:', err);
      return false;
    }
  }
}

export default BluetoothPrinterService;
