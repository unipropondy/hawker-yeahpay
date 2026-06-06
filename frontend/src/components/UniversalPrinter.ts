import { Alert, Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import BillPDFGenerator from './BillPDFGenerator';
import SunmiPrinterService from './SunmiPrinterService';
import { PrinterDetector } from './PrinterDetector';

// Printer types
export type PrinterType = 
  | 'thermal'
  | 'receipt'
  | 'label'
  | 'laser'
  | 'bluetooth'
  | 'network'
  | 'usb'
  | 'unknown';

interface PrinterInfo {
  type: PrinterType;
  name: string;
  address?: string;
  isDefault: boolean;
  paperSize?: '58mm' | '80mm' | 'A4' | 'label';
}

interface DiscountInfo {
  applied: boolean;
  type: 'percentage' | 'fixed';
  value: number;
  amount: number;
}

class UniversalPrinter {
  
  private static detectedPrinters: PrinterInfo[] = [];
  private static defaultPrinter: PrinterInfo | null = null;

  // ==================== MAIN SMART PRINT ====================
  static async smartPrint(
    saleData: any, 
    outletId?: string | number,
    t?: any, 
    discountInfo?: DiscountInfo, 
    preferredType?: PrinterType,
    isReprint: boolean = false
  ): Promise<boolean> {
    try {
      // ✅ Always use PDF mode for Expo Go testing
      console.log('📱 Using PDF mode for Expo Go');
      return await this.offerPDFFallback(saleData, outletId, t, discountInfo);
    } catch (error) { 
      console.log('SmartPrint error:', error);
      return await this.offerPDFFallback(saleData, outletId, t, discountInfo); 
    }
  }

  // ==================== PDF FALLBACK ====================
  static async offerPDFFallback(saleData: any, userId?: string | number, t?: any, discountInfo?: DiscountInfo): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(
        t?.printerNotFound || '🖨️ Print Bill',
        t?.wantPDF || 'Save receipt as PDF?',
        [
          { text: t?.no || 'No', onPress: () => resolve(false), style: 'cancel' },
          { text: t?.yes || 'Yes', onPress: async () => {
              try {
                const html = await BillPDFGenerator.generateHTML(saleData, userId, discountInfo);
                const { uri } = await Print.printToFileAsync({ html, width: 226 });
                if (await Sharing.isAvailableAsync()) {
                  await Sharing.shareAsync(uri);
                }
                resolve(true);
              } catch (error) {
                console.log('PDF generation error:', error);
                resolve(false);
              }
            }
          }
        ]
      );
    });
  }

  // ==================== UTILITIES ====================
  static async openCashDrawer(): Promise<boolean> {
    // Mock for Expo Go
    console.log('Mock: Open cash drawer');
    return false;
  }

  static async detectAllPrinters(): Promise<PrinterInfo[]> {
    return [];
  }
}

export default UniversalPrinter;