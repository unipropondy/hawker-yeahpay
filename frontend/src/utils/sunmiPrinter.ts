import { NativeModules, Platform, NativeEventEmitter } from 'react-native';

// Sunmi printer native module
const { SunmiPrinter } = NativeModules;

// Sunmi printer commands (ESC/POS)
const ESC = '\x1B';
const GS = '\x1D';

class SunmiPrinterHelper {
  
  // ✅ FIX: Add checkSunmiPrinter method
  static async checkSunmiPrinter(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    
    try {
      // Method 1: Check if SunmiPrinter module exists
      if (SunmiPrinter) {
        // Try to get printer status
        const status = await SunmiPrinter.getPrinterStatus?.() || 'OK';
        return true;
      }
      
      // Method 2: Check device manufacturer (Sunmi devices)
      const { NativeModules } = require('react-native');
      const DeviceInfo = NativeModules.DeviceInfo;
      
      if (DeviceInfo) {
        const manufacturer = await DeviceInfo.getManufacturer?.() || '';
        return manufacturer.toLowerCase().includes('sunmi');
      }
      
      return false;
    } catch (error) {
      console.log('Sunmi check error:', error);
      return false;
    }
  }

  // Check if Sunmi printer available
  static async isSunmiDevice(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    
    try {
      // ✅ Call the fixed method
      const isSunmi = await this.checkSunmiPrinter();
      return isSunmi;
    } catch (error) {
      console.log('Not Sunmi device:', error);
      return false;
    }
  }

  // Initialize printer
  static async initPrinter(): Promise<boolean> {
    try {
      if (SunmiPrinter) {
        // Check if initPrinter exists
        if (SunmiPrinter.initPrinter) {
          await SunmiPrinter.initPrinter();
        }
        console.log('✅ Sunmi printer initialized');
        return true;
      }
      return false;
    } catch (error) {
      console.log('❌ Printer init failed:', error);
      return false;
    }
  }

  // Get printer status
  static async getPrinterStatus(): Promise<string> {
    try {
      if (SunmiPrinter && SunmiPrinter.getPrinterStatus) {
        const status = await SunmiPrinter.getPrinterStatus();
        return status;
      }
      return 'UNAVAILABLE';
    } catch (error) {
      return 'ERROR';
    }
  }

  // Print text with formatting
  static async printText(text: string, options?: {
    bold?: boolean;
    fontSize?: number;
    align?: 'left' | 'center' | 'right';
  }): Promise<void> {
    if (!SunmiPrinter) return;

    const { bold = false, fontSize = 24, align = 'left' } = options || {};

    try {
      // Set alignment
      if (SunmiPrinter.setAlignment) {
        if (align === 'center') {
          await SunmiPrinter.setAlignment(1);
        } else if (align === 'right') {
          await SunmiPrinter.setAlignment(2);
        } else {
          await SunmiPrinter.setAlignment(0);
        }
      }

      // Set text size
      if (SunmiPrinter.setTextSize) {
        await SunmiPrinter.setTextSize(fontSize);
      }

      // Set bold
      if (bold && SunmiPrinter.sendRAWData) {
        await SunmiPrinter.sendRAWData(ESC + 'E' + '\x01');
      }

      // Print the text
      if (SunmiPrinter.printText) {
        await SunmiPrinter.printText(text + '\n');
      }

      // Reset bold
      if (bold && SunmiPrinter.sendRAWData) {
        await SunmiPrinter.sendRAWData(ESC + 'E' + '\x00');
      }

      // Reset alignment
      if (SunmiPrinter.setAlignment) {
        await SunmiPrinter.setAlignment(0);
      }
    } catch (error) {
      console.log('Print text error:', error);
    }
  }

  // Print barcode
  static async printBarcode(data: string): Promise<void> {
    if (!SunmiPrinter || !SunmiPrinter.printBarcode) return;

    try {
      await SunmiPrinter.printBarcode(
        data,
        8,  // height
        2,  // width
        1,  // text position
        0   // barcode type
      );
      await this.printText('\n');
    } catch (error) {
      console.log('Barcode print failed:', error);
    }
  }

  // Print QR code
  static async printQRCode(data: string, size: number = 8): Promise<void> {
    if (!SunmiPrinter || !SunmiPrinter.printQRCode) return;

    try {
      await SunmiPrinter.printQRCode(data, size);
      await this.printText('\n');
    } catch (error) {
      console.log('QR print failed:', error);
    }
  }

  // Cut paper
  static async cutPaper(): Promise<void> {
    if (!SunmiPrinter) return;

    try {
      if (SunmiPrinter.lineWrap) {
        await SunmiPrinter.lineWrap(5);
      }
      if (SunmiPrinter.cutPaper) {
        await SunmiPrinter.cutPaper();
      }
    } catch (error) {
      console.log('Cut paper failed:', error);
    }
  }

  // Open cash drawer
  static async openCashDrawer(): Promise<void> {
    if (!SunmiPrinter || !SunmiPrinter.openCashDrawer) return;

    try {
      await SunmiPrinter.openCashDrawer();
    } catch (error) {
      console.log('Open drawer failed:', error);
    }
  }

  // Print receipt complete
  static async printReceipt(html: string): Promise<boolean> {
    try {
      await this.initPrinter();
      
      // Convert HTML to plain text with formatting
      const lines = html
        .replace(/<[^>]*>/g, '\n')
        .split('\n')
        .filter(line => line.trim() !== '');

      for (const line of lines) {
        // Check for special formatting
        if (line.includes('TOTAL') || line.includes('Grand')) {
          await this.printText(line, { bold: true, fontSize: 28 });
        } else if (line.includes('Bill No') || line.includes('Date')) {
          await this.printText(line, { fontSize: 22 });
        } else {
          await this.printText(line, { fontSize: 24 });
        }
      }

      await this.printText('\n\n');
      await this.cutPaper();
      
      return true;
    } catch (error) {
      console.log('Print receipt failed:', error);
      return false;
    }
  }

  // Get printer paper status
  static async getPaperStatus(): Promise<boolean> {
    try {
      if (SunmiPrinter && SunmiPrinter.getPrinterStatus) {
        const status = await SunmiPrinter.getPrinterStatus();
        return status === 'PAPER_OK' || status === 'OK';
      }
      return false;
    } catch (error) {
      return false;
    }
  }
}

export default SunmiPrinterHelper;