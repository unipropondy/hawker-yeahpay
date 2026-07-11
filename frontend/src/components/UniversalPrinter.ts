// components/UniversalPrinter.ts
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import BillPDFGenerator from './BillPDFGenerator';
import SunmiPrinterService from './SunmiPrinterService';
import API from '../api';

class UniversalPrinter {
  
  // Load printer settings from storage/API
  static async loadPrinterSettings(outletId: string): Promise<any> {
    try {
      // First try AsyncStorage (quick access)
      const cachedSettings = await AsyncStorage.getItem(`printer_settings_${outletId}`);
      if (cachedSettings) {
        return JSON.parse(cachedSettings);
      }
      
      // If not in cache, load from API
      const response = await API.get(`/printer/${outletId}`);
      const settings = {
        printerType: response.data.printerType || 'network',
        printerIP: response.data.printerIP || '192.168.0.241',
        printerPort: response.data.printerPort || 9100,
        printerEnabled: response.data.printerEnabled || false
      };
      
      // Cache for next time
      await AsyncStorage.setItem(`printer_settings_${outletId}`, JSON.stringify(settings));
      
      return settings;
    } catch (error) {
      console.log('⚠️ Could not load printer settings, using defaults:', error);
      return {
        printerType: 'network',
        printerIP: '192.168.0.241',
        printerPort: 9100,
        printerEnabled: false
      };
    }
  }
  
  // Save printer settings to cache and API
  static async savePrinterSettings(outletId: string, settings: any): Promise<boolean> {
    try {
      // Save to API
      await API.post(`/printer/${outletId}`, settings);
      
      // Save to cache
      await AsyncStorage.setItem(`printer_settings_${outletId}`, JSON.stringify(settings));
      
      console.log('✅ Printer settings saved');
      return true;
    } catch (error) {
      console.log('❌ Failed to save printer settings:', error);
      return false;
    }
  }
  
  // Smart print - Loads settings dynamically
  static async smartPrint(
    saleData: any, 
    outletId?: string, 
    t?: any, 
    discountInfo?: any,
    preferredType?: string,
    isReprint?: boolean
  ): Promise<boolean> {
    
    try {
      // ✅ Load printer settings from database/cache
      const printerSettings = await this.loadPrinterSettings(outletId || '');
      
      // Check if printer is enabled
      if (!printerSettings.printerEnabled) {
        console.log('⚠️ Printer disabled in settings, using PDF');
        await BillPDFGenerator.downloadPDF(saleData, outletId, discountInfo);
        return true;
      }
      
      let printed = false;
      
      // Try based on printer type
      if (printerSettings.printerType === 'sunmi') {
        // Sunmi built-in printer
        printed = await this.printSunmi(saleData, discountInfo);
      } else if (printerSettings.printerType === 'network') {
        // Network printer with IP
        printed = await NetworkPrinterService.print(
          printerSettings.printerIP,
          printerSettings.printerPort,
          {
            shopName: saleData.shopName || saleData.outletName || 'YOUR SHOP',
            invoiceNumber: saleData.invoiceNumber,
            items: saleData.items || [],
            total: saleData.total || 0,
            discount: discountInfo
          }
        );
      }
      
      if (printed) {
        console.log('✅ Printed via', printerSettings.printerType, 'printer');
        return true;
      } else {
        console.log('❌ Printer failed, using PDF fallback');
        await BillPDFGenerator.downloadPDF(saleData, outletId, discountInfo);
        return true;
      }
      
    } catch (error) {
      console.log('❌ Print error:', error);
      // Fallback to PDF
      try {
        await BillPDFGenerator.downloadPDF(saleData, outletId, discountInfo);
        return true;
      } catch (pdfError) {
        console.log('PDF also failed:', pdfError);
        return false;
      }
    }
  }
  
  // Sunmi printer printing
  static async printSunmi(saleData: any, discountInfo?: any): Promise<boolean> {
    try {
      // Check if Sunmi printer is available
      const SunmiPrinter = require('sunmi-printer-expo');
      
      const hasPrinter = await SunmiPrinter.hasPrinter();
      if (!hasPrinter) {
        console.log('❌ No Sunmi printer found');
        return false;
      }
      
      // Initialize printer
      await SunmiPrinter.initPrinter();
      
      // Build receipt
      let text = '';
      text += '\x1B\x40';  // Initialize
      text += '\x1B\x61\x01';  // Center align
      text += `${saleData.shopName || 'YOUR SHOP'}\n`;
      text += '='.repeat(32) + '\n';
      text += `INVOICE: ${saleData.invoiceNumber}\n`;
      text += `DATE: ${new Date().toLocaleString()}\n`;
      text += '-'.repeat(32) + '\n';
      
      for (const item of saleData.items || []) {
        text += `${item.name} x${item.quantity}\n`;
        text += `   $${(item.price * item.quantity).toFixed(2)}\n`;
      }
      
      text += '-'.repeat(32) + '\n';
      text += `TOTAL: $${saleData.total.toFixed(2)}\n`;
      text += '='.repeat(32) + '\n';
      text += 'THANK YOU!\n';
      text += '\x1D\x56\x42\x00';  // Cut paper
      
      await SunmiPrinter.printText(text);
      await SunmiPrinter.cutPaper();
      
      return true;
    } catch (error) {
      console.log('Sunmi print error:', error);
      return false;
    }
  }
  
  static async printSalesReport(reportData: any, userId?: string, t?: any): Promise<boolean> {
    console.log('Printing sales report...');
    return true;
  }
  
  static async printCategoryReport(
    categories: any[],
    selectedCategory: string | null,
    categoryItems: any[],
    categoryTransactions: any[],
    userId?: string,
    t?: any,
    reportParams?: any
  ): Promise<boolean> {
    console.log('Printing category report...');
    return true;
  }
  
  static async openCashDrawer(): Promise<boolean> {
    try {
      const printerSettings = await this.loadPrinterSettings('');
      
      if (!printerSettings.printerEnabled) {
        return false;
      }
      
      if (printerSettings.printerType === 'sunmi') {
        // Sunmi cash drawer
        const SunmiPrinter = require('sunmi-printer-expo');
        await SunmiPrinter.initPrinter();
        await SunmiPrinter.openDrawer();
        return true;
      } else if (printerSettings.printerType === 'network') {
        // ESC/POS command for cash drawer kick
        const drawerCommand = '\x1B\x70\x00\x19\xFA';
        await NetworkPrinterService.print(
          printerSettings.printerIP, 
          printerSettings.printerPort, 
          { shopName: '', invoiceNumber: '', items: [], total: 0, rawCommand: drawerCommand }
        );
        return true;
      }
      
      return false;
    } catch (error) {
      console.log('Cash drawer error:', error);
      return false;
    }
  }
}

export default UniversalPrinter;