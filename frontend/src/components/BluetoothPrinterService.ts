// frontend/src/components/BluetoothPrinterService.ts - Driverless Bluetooth Thermal Printer Service

import { Platform, Alert } from 'react-native';

export interface BluetoothPrinterConfig {
  address?: string; // MAC address or Bluetooth device ID
  name?: string;
  charactersPerLine?: number;
}

export class BluetoothPrinterService {
  private static connectedWebDevice: any = null;
  private static connectedWebCharacteristic: any = null;

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
      const ThermalPrinter = require('react-native-thermal-printer');
      const ThermalPrinterModule = ThermalPrinter ? (ThermalPrinter.default || ThermalPrinter) : null;
      const { NativeModules } = require('react-native');
      const hasNativeModule = !!(NativeModules.ThermalPrinter || NativeModules.ThermalPrinterModule);

      if (!ThermalPrinterModule || !hasNativeModule) {
        throw new Error('Native Bluetooth thermal printer module not available');
      }

      console.log('📡 Printing to Bluetooth Printer via socket:', config.address || 'paired device');
      await ThermalPrinterModule.printBluetooth({
        macAddress: config.address || '',
        payload: payload,
        autoCut: true,
        openCashbox: false,
        mmFeedPaper: 25,
        printerNbrCharactersPerLine: config.charactersPerLine || 32
      });

      console.log('✅ Native Bluetooth print successful');
      return true;
    } catch (error: any) {
      console.log('❌ Bluetooth Printer error:', error);
      Alert.alert(
        'Bluetooth Printer Error',
        'Could not send print job to Bluetooth printer (' + (config.name || config.address || 'Unknown') + '). Please ensure Bluetooth is enabled and paired.'
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
      const ThermalPrinterModule = ThermalPrinter ? (ThermalPrinter.default || ThermalPrinter) : null;

      if (ThermalPrinterModule) {
        await ThermalPrinterModule.printBluetooth({
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
