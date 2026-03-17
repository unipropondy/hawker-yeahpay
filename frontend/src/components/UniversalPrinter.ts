// frontend/src/components/UniversalPrinter.ts - MULTI-TYPE SUPPORT ✅

import { Alert, Platform, NativeModules } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import BillPDFGenerator from './BillPDFGenerator';

// Printer types
export type PrinterType = 
  | 'thermal'      // Thermal receipt printer (Sunmi, Epson TM, etc.)
  | 'receipt'      // Standard receipt printer
  | 'label'        // Label printer (Zebra, etc.)
  | 'laser'        // Laser/Inkjet printer (A4)
  | 'bluetooth'    // Bluetooth printer
  | 'network'      // Network printer (WiFi/Ethernet)
  | 'usb'          // USB connected printer
  | 'unknown';

interface PrinterInfo {
  type: PrinterType;
  name: string;
  address?: string;
  isDefault: boolean;
  paperSize?: '58mm' | '80mm' | 'A4' | 'label';
}

class UniversalPrinter {
  
  private static detectedPrinters: PrinterInfo[] = [];
  private static defaultPrinter: PrinterInfo | null = null;

  /**
   * 🔍 DETECT ALL PRINTER TYPES
   */
  static async detectAllPrinters(): Promise<PrinterInfo[]> {
    const printers: PrinterInfo[] = [];
    
    if (Platform.OS !== 'android') return printers;
    
    try {
      // 1️⃣ SUNMI THERMAL PRINTER (Built-in)
      try {
        const SunmiPrinter = require('react-native-sunmi-inner-printer');
        if (SunmiPrinter) {
          const hasPrinter = await SunmiPrinter.hasPrinter();
          if (hasPrinter) {
            printers.push({
              type: 'thermal',
              name: 'Sunmi Thermal Printer',
              isDefault: true,
              paperSize: '58mm'
            });
            console.log('✅ Sunmi Thermal Printer detected');
          }
        }
      } catch (e) {}

      // 2️⃣ BLUETOOTH PRINTERS
      try {
        const BluetoothPrinter = require('react-native-bluetooth-printer');
        const devices = await BluetoothPrinter.getDeviceList();
        devices.forEach((device: any) => {
          printers.push({
            type: 'bluetooth',
            name: device.name || 'Bluetooth Printer',
            address: device.address,
            isDefault: false,
            paperSize: this.guessPaperSize(device.name)
          });
        });
        console.log(`✅ ${devices.length} Bluetooth printers detected`);
      } catch (e) {}

      // 3️⃣ NETWORK PRINTERS (WiFi/Ethernet)
      try {
        const NetPrinter = require('react-native-thermal-printer');
        const printers_list = await NetPrinter.getPrinterList();
        printers_list.forEach((printer: any) => {
          printers.push({
            type: 'network',
            name: printer.name || 'Network Printer',
            address: printer.address,
            isDefault: false,
            paperSize: '80mm'
          });
        });
      } catch (e) {}

      // 4️⃣ USB PRINTERS
      try {
        const UsbPrinter = require('react-native-usb-printer');
        const devices = await UsbPrinter.getDeviceList();
        devices.forEach((device: any) => {
          printers.push({
            type: 'usb',
            name: device.name || 'USB Printer',
            address: device.address,
            isDefault: false
          });
        });
      } catch (e) {}

      // 5️⃣ CHECK ANDROID PRINT SERVICE (for Laser/Inkjet)
      try {
        const hasPrintService = await this.checkAndroidPrintService();
        if (hasPrintService) {
          printers.push({
            type: 'laser',
            name: 'Android Print Service',
            isDefault: false,
            paperSize: 'A4'
          });
        }
      } catch (e) {}

      // Store detected printers
      this.detectedPrinters = printers;
      
      // Set default printer (first thermal, then first of any)
      this.defaultPrinter = printers.find(p => p.type === 'thermal') || printers[0] || null;
      
      return printers;
      
    } catch (error) {
      console.log('❌ Printer detection error:', error);
      return [];
    }
  }
/**
 * 💰 TRY TO OPEN CASH DRAWER - SILENTLY
 */
static async openCashDrawer(): Promise<boolean> {
  try {
    console.log('💰 Trying to open cash drawer...');
    
    // Method 1: Sunmi
    if (Platform.OS === 'android') {
      try {
        const SunmiPrinter = require('react-native-sunmi-inner-printer');
        if (SunmiPrinter?.hasPrinter?.()) {
          await SunmiPrinter.openCashDrawer();
          console.log('✅ Sunmi drawer opened');
          return true;
        }
      } catch (e) {}
    }
    
    // Method 2: ESC/POS commands
    try {
      const ThermalPrinter = require('react-native-thermal-printer');
      const drawerCmd = [0x1B, 0x70, 0x00, 0x19, 0xFA];
      await ThermalPrinter.printRaw(drawerCmd);
      console.log('✅ ESC/POS drawer opened');
      return true;
    } catch (e) {}
    
    // Method 3: USB/Bluetooth
    try {
      const UsbPrinter = require('react-native-usb-printer');
      const devices = await UsbPrinter.getDeviceList();
      if (devices.length > 0) {
        const drawerCmd = [0x1B, 0x70, 0x00, 0x19, 0xFA];
        await UsbPrinter.printRaw(drawerCmd);
        console.log('✅ USB drawer opened');
        return true;
      }
    } catch (e) {}
    
    return false;
    
  } catch (error) {
    console.log('❌ Drawer error:', error);
    return false;
  }
}
  /**
   * 🔍 Guess paper size from printer name
   */
  private static guessPaperSize(printerName: string): '58mm' | '80mm' | 'A4' | 'label' {
    const name = printerName.toLowerCase();
    if (name.includes('58') || name.includes('2inch')) return '58mm';
    if (name.includes('80') || name.includes('3inch')) return '80mm';
    if (name.includes('label') || name.includes('zebra')) return 'label';
    if (name.includes('laser') || name.includes('inkjet')) return 'A4';
    return '80mm'; // default
  }

  /**
   * 📏 Get print width based on printer type and paper size
   */
  private static getPrintWidth(printer: PrinterInfo): number {
    switch (printer.paperSize) {
      case '58mm': return 164;  // 58mm thermal
      case '80mm': return 226;  // 80mm receipt
      case 'A4': return 612;    // A4 paper
      case 'label': return 300;  // Label printer
      default: return 226;
    }
  }
// src/components/UniversalPrinter.ts

/**
 * 📊 PRINT SALES REPORT (Separate from receipts)
 */
static async printSalesReport(reportData: any, userId?: string | number, t?: any): Promise<boolean> {
  try {
    // Load company settings
    const company = await BillPDFGenerator.loadSettings(userId);
    
    // Generate HTML for sales report
    const html = this.generateSalesReportHTML(reportData, company);
    
    // Print as A4/Laser (not thermal)
    await Print.printAsync({ 
      html,
      orientation: Print.Orientation.portrait
    });
    
    return true;
    
  } catch (error) {
    console.log('❌ Sales report print error:', error);
    return false;
  }
}

/**
 * 📝 Generate Sales Report HTML
 */
private static generateSalesReportHTML(data: any, company: any): string {
  const symbol = company.currencySymbol || '$';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { 
          font-family: 'Courier New', monospace; 
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
        }
        .header { 
          text-align: center; 
          margin-bottom: 20px;
          border-bottom: 2px solid #000;
          padding-bottom: 10px;
        }
        .company-name { 
          font-size: 24px; 
          font-weight: bold;
          margin-bottom: 5px;
        }
        .company-details {
          font-size: 12px;
          color: #555;
          margin-bottom: 5px;
        }
        .report-title {
          font-size: 20px;
          font-weight: bold;
          margin: 15px 0;
          text-align: center;
        }
        .section-title {
          font-size: 16px;
          font-weight: bold;
          margin: 15px 0 10px;
          background: #f0f0f0;
          padding: 5px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 10px 0;
        }
        th, td {
          padding: 8px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }
        th {
          background: #f0f0f0;
          font-weight: bold;
        }
        .amount {
          text-align: right;
        }
        .total-row {
          font-weight: bold;
          border-top: 2px solid #000;
        }
        .summary-box {
          display: inline-block;
          width: 30%;
          padding: 10px;
          margin: 5px;
          background: #f9f9f9;
          text-align: center;
          border-radius: 5px;
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 12px;
          border-top: 1px solid #ddd;
          padding-top: 10px;
        }
      </style>
    </head>
    <body>
      <!-- Header -->
      <div class="header">
        <div class="company-name">${company.name || 'UNIPRO SOFTWARES SG PTE LTD'}</div>
        <div class="company-details">${company.address || ''}</div>
        <div class="company-details">GST: ${company.gstNo || 'N/A'}</div>
        <div class="report-title">SALES REPORT</div>
        <div>Date: ${new Date().toLocaleString()}</div>
        <div>Period: ${data.period || 'Today'}</div>
      </div>

      <!-- Summary Cards -->
      <div style="text-align: center; margin: 20px 0;">
        <div class="summary-box">
          <div style="font-size: 12px;">Total Sales</div>
          <div style="font-size: 24px; font-weight: bold;">${data.summary?.totalSales || 0}</div>
        </div>
        <div class="summary-box">
          <div style="font-size: 12px;">Total Items</div>
          <div style="font-size: 24px; font-weight: bold;">${data.summary?.totalItems || 0}</div>
        </div>
        <div class="summary-box">
          <div style="font-size: 12px;">Total Revenue</div>
          <div style="font-size: 24px; font-weight: bold;">${symbol}${(data.summary?.totalRevenue || 0).toFixed(2)}</div>
        </div>
      </div>

      <!-- Payment Breakdown -->
      <div class="section-title">💳 PAYMENT BREAKDOWN</div>
      <table>
        ${Object.entries(data.paymentBreakdown || {}).map(([method, amount]) => `
          <tr>
            <td>${method}</td>
            <td class="amount">${symbol}${(amount as number).toFixed(2)}</td>
          </tr>
        `).join('')}
        <tr class="total-row">
          <td>Total</td>
          <td class="amount">${symbol}${(data.summary?.totalRevenue || 0).toFixed(2)}</td>
        </tr>
      </table>

      <!-- Category Wise Sales -->
      <div class="section-title">📦 CATEGORY WISE SALES</div>
      ${(data.categories || []).map((cat: any) => `
        <div style="margin-top: 15px;">
          <h3>${cat.name}</h3>
          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th class="amount">Qty</th>
                <th class="amount">Price</th>
                <th class="amount">Total</th>
              </tr>
            </thead>
            <tbody>
              ${(cat.items || []).map((item: any) => `
                <tr>
                  <td>${item.name}</td>
                  <td class="amount">${item.quantity || 0}</td>
                  <td class="amount">${symbol}${(item.price || 0).toFixed(2)}</td>
                  <td class="amount">${symbol}${(item.revenue || 0).toFixed(2)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="2">Category Total</td>
                <td class="amount">${cat.totalQuantity || 0}</td>
                <td class="amount">${symbol}${(cat.totalRevenue || 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `).join('')}

      <!-- Grand Total -->
      <div class="section-title">📊 GRAND TOTAL</div>
      <table>
        <tr>
          <td>Total Items Sold</td>
          <td class="amount">${data.grandTotal?.items || 0}</td>
        </tr>
        <tr>
          <td>Total Revenue</td>
          <td class="amount">${symbol}${(data.grandTotal?.revenue || 0).toFixed(2)}</td>
        </tr>
      </table>

      <!-- Footer -->
      <div class="footer">
        <p>Thank you for your business!</p>
        <p>Report generated by POS System</p>
        <p>© ${new Date().getFullYear()} UNIPRO SOFTWARES SG PTE LTD</p>
      </div>
    </body>
    </html>
  `;
}
private static generateCategoryDetailHTML(
  categoryName: string,
  items: any[],
  transactions: any[],
  company: any,
  options?: any
): string {
  const symbol = company.currencySymbol || '$';
  const filter = options?.filter || 'today';
   const formatDateMMDDYY = (date: Date): string => {
    if (!date) return '';
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yy = String(date.getFullYear()).slice(-2);
    return `${mm}/${dd}/${yy}`;
  };
  const startDate = options?.startDate ? new Date(options.startDate).toLocaleDateString() : '';
  const endDate = options?.endDate ? new Date(options.endDate).toLocaleDateString() : '';
  
  // Calculate period text
  let periodText = filter.toUpperCase();
  if (filter === 'custom' && startDate && endDate) {
    periodText = `${startDate} to ${endDate}`;
  }
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { 
          font-family: 'Arial', sans-serif;
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
        }
        .header { 
          text-align: center; 
          margin-bottom: 20px;
          border-bottom: 2px solid #000;
          padding-bottom: 10px;
        }
        .company-name { 
          font-size: 24px; 
          font-weight: bold;
        }
        .category-title {
          font-size: 22px;
          font-weight: bold;
          color: #333;
          margin: 20px 0;
          text-align: center;
        }
        .period-info {
          font-size: 14px;
          color: #666;
          margin-bottom: 10px;
          text-align: center;
        }
        .section-title {
          font-size: 18px;
          font-weight: bold;
          margin: 20px 0 10px;
          background: #f0f0f0;
          padding: 8px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th {
          background: #f5f5f5;
          padding: 10px;
          text-align: left;
          font-size: 14px;
        }
        td {
          padding: 8px 10px;
          border-bottom: 1px solid #eee;
          font-size: 13px;
        }
        .amount {
          text-align: right;
        }
        .transaction-card {
          border: 1px solid #ddd;
          border-radius: 5px;
          padding: 15px;
          margin-bottom: 15px;
        }
        .transaction-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
          padding-bottom: 5px;
          border-bottom: 1px solid #eee;
        }
        .transaction-id {
          font-weight: bold;
          color: #555;
        }
        .transaction-total {
          font-weight: bold;
          color: #2ecc71;
        }
        .transaction-item {
          display: flex;
          justify-content: space-between;
          padding: 5px 0;
          font-size: 13px;
        }
        .summary-box {
          display: flex;
          justify-content: space-around;
          margin: 20px 0;
          padding: 15px;
          background: #f9f9f9;
          border-radius: 5px;
        }
        .summary-item {
          text-align: center;
        }
        .summary-label {
          font-size: 12px;
          color: #666;
        }
        .summary-value {
          font-size: 18px;
          font-weight: bold;
          color: #333;
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 12px;
          color: #666;
          border-top: 1px solid #ddd;
          padding-top: 10px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-name">${company.name || 'Store Name'}</div>
        <div>${company.address || ''}</div>
        <div>GST: ${company.gstNo || 'N/A'}</div>
        <div class="period-info">Period: ${periodText}</div>
        <div>Date: ${new Date().toLocaleString()}</div>
      </div>

      <div class="category-title">📦 ${categoryName}</div>

      <!-- Summary Box -->
      <div class="summary-box">
        <div class="summary-item">
          <div class="summary-label">Total Items</div>
          <div class="summary-value">${items.length}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Quantity Sold</div>
          <div class="summary-value">${items.reduce((sum, i) => sum + (i.quantity || 0), 0)}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Total Revenue</div>
          <div class="summary-value">${symbol}${items.reduce((sum, i) => sum + (i.revenue || 0), 0).toFixed(2)}</div>
        </div>
      </div>

      <!-- Items Table -->
      <div class="section-title">📋 Items Sold</div>
      <table>
        <thead>
          <tr>
            <th>Item Name</th>
            <th class="amount">Quantity</th>
            <th class="amount">Unit Price</th>
            <th class="amount">Total</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td>${item.name}</td>
              <td class="amount">${item.quantity || 0}</td>
              <td class="amount">${symbol}${(item.price || 0).toFixed(2)}</td>
              <td class="amount">${symbol}${(item.revenue || 0).toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- Transactions -->
      <div class="section-title">📄 Transaction History</div>
      ${transactions.length > 0 ? 
        this.groupTransactionsBySale(transactions).map((sale: any) => `
          <div class="transaction-card">
            <div class="transaction-header">
              <span class="transaction-id">#${sale.id}</span>
              <span class="transaction-total">${symbol}${sale.total.toFixed(2)}</span>
            </div>
            <div>Date: ${new Date(sale.date).toLocaleString()}</div>
            ${sale.items.map((item: any) => `
              <div class="transaction-item">
                <span>• ${item.name} x${item.quantity}</span>
                <span>${symbol}${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            `).join('')}
          </div>
        `).join('')
        : '<p style="text-align: center; color: #999;">No transactions found</p>'
      }

      <div class="footer">
        <p>End of Category Report</p>
        <p>Total Revenue: ${symbol}${items.reduce((sum, i) => sum + (i.revenue || 0), 0).toFixed(2)}</p>
      </div>
    </body>
    </html>
  `;
}
/**
 * 📊 PRINT CATEGORY WISE SALES REPORT (With Items and Summary)
 */
static async printCategoryReport(
  categories: any[],
  selectedCategory: string | null,
  categoryItems: any[],
  categoryTransactions: any[],
  userId?: string | number,
  t?: any,
  options?: {
    filter?: string;
    startDate?: Date;
    endDate?: Date;
    summary?: {
      totalSales: number;
      totalItems: number;
      totalRevenue: number;
      paymentBreakdown: any;
    }
  }
): Promise<boolean> {
  try {
    const company = await BillPDFGenerator.loadSettings(userId);
    
    let html = '';
    
    if (selectedCategory) {
      // Specific category view
      html = this.generateCategoryDetailHTML(
        selectedCategory,
        categoryItems,
        categoryTransactions,
        company,
        options
      );
    } else {
      // All categories view
      html = this.generateAllCategoriesHTML(
        categories,
        company,
        options
      );
    }
    
    // Print as A4
    await Print.printAsync({ 
      html,
      orientation: Print.Orientation.portrait
    });
    
    return true;
    
  } catch (error) {
    console.log('❌ Category report print error:', error);
    return false;
  }
}


/**
 * 📝 Generate HTML for All Categories View (WITH CORRECT SUMMARY)
 */
private static generateAllCategoriesHTML(
  categories: any[], 
  company: any,
  options?: any
): string {
  const symbol = company.currencySymbol || '$';
  
  const summary = options?.summary || {
    totalSales: 0,
    totalItems: 0,
    totalRevenue: 0,
    paymentBreakdown: {}
  };
  
  const filter = options?.filter || 'today';
  
  // ✅ FIXED: MM/DD/YY format for dates
  const formatDateMMDDYY = (date: Date): string => {
    if (!date) return '';
    const mm = String(date.getMonth() + 1).padStart(2, '0'); // Month
    const dd = String(date.getDate()).padStart(2, '0');      // Day
    const yy = String(date.getFullYear()).slice(-2);         // Year (last 2 digits)
    return `${mm}/${dd}/${yy}`;
  };
  
  const startDate = options?.startDate ? formatDateMMDDYY(new Date(options.startDate)) : '';
  const endDate = options?.endDate ? formatDateMMDDYY(new Date(options.endDate)) : '';
  
  let periodText = filter.toUpperCase();
  if (filter === 'custom' && startDate && endDate) {
    periodText = `${startDate} to ${endDate}`;
  }
  
  // ✅ Current date in MM/DD/YY format
  const currentDate = formatDateMMDDYY(new Date());
  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { 
          font-family: 'Arial', sans-serif;
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
        }
        .header { 
          text-align: center; 
          margin-bottom: 20px;
          border-bottom: 2px solid #000;
          padding-bottom: 10px;
        }
        .company-name { 
          font-size: 24px; 
          font-weight: bold;
        }
        .report-title {
          font-size: 20px;
          font-weight: bold;
          margin: 15px 0;
        }
        .period-info {
          font-size: 14px;
          color: #666;
          margin-bottom: 10px;
        }
        .summary-section {
          display: flex;
          justify-content: space-between;
          margin: 20px 0;
          padding: 15px;
          background: #f5f5f5;
          border-radius: 5px;
        }
        .summary-box {
          text-align: center;
          flex: 1;
        }
        .summary-label {
          font-size: 12px;
          color: #666;
        }
        .summary-value {
          font-size: 18px;
          font-weight: bold;
          color: #333;
        }
        .payment-breakdown {
          margin: 20px 0;
          padding: 15px;
          background: #fff;
          border: 1px solid #ddd;
          border-radius: 5px;
        }
        .payment-row {
          display: flex;
          justify-content: space-between;
          padding: 5px 0;
          border-bottom: 1px solid #eee;
        }
        .payment-total {
          font-weight: bold;
          border-top: 2px solid #000;
          margin-top: 5px;
          padding-top: 5px;
        }
        .category-card {
          margin-bottom: 20px;
          border: 1px solid #ddd;
          border-radius: 5px;
          padding: 15px;
        }
        .category-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          padding-bottom: 5px;
          border-bottom: 1px solid #eee;
        }
        .category-name {
          font-size: 18px;
          font-weight: bold;
          color: #333;
        }
        .category-stats {
          color: #666;
          font-size: 14px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }
        th {
          background: #f5f5f5;
          padding: 8px;
          text-align: left;
          font-size: 13px;
        }
        td {
          padding: 6px 8px;
          border-bottom: 1px solid #eee;
          font-size: 13px;
        }
        .amount {
          text-align: right;
        }
        .total-row {
          font-weight: bold;
          background: #f9f9f9;
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 12px;
          color: #666;
          border-top: 1px solid #ddd;
          padding-top: 10px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-name">${company.name || 'Store Name'}</div>
        <div>${company.address || ''}</div>
        <div>GST: ${company.gstNo || 'N/A'}</div>
        <div class="report-title">📊 CATEGORY WISE SALES REPORT</div>
        <div class="period-info">Period: ${periodText}</div>
        <div>Date: ${currentDate} ${currentTime}</div>
      </div>

      <!-- Summary Section -->
      <div class="summary-section">
        <div class="summary-box">
          <div class="summary-label">Total Sales</div>
          <div class="summary-value">${summary.totalSales || 0}</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">Total Items</div>
          <div class="summary-value">${summary.totalItems || 0}</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">Total Revenue</div>
          <div class="summary-value">${symbol}${(summary.totalRevenue || 0).toFixed(2)}</div>
        </div>
      </div>

      <!-- Payment Breakdown -->
      <div class="payment-breakdown">
        <h3>💳 PAYMENT BREAKDOWN</h3>
        ${Object.entries(summary.paymentBreakdown || {}).map(([method, amount]) => `
          <div class="payment-row">
            <span>${method}</span>
            <span>${symbol}${(amount as number).toFixed(2)}</span>
          </div>
        `).join('')}
        <div class="payment-row payment-total">
          <span>Total</span>
          <span>${symbol}${(summary.totalRevenue || 0).toFixed(2)}</span>
        </div>
      </div>

      <!-- Categories -->
      ${categories.map(cat => `
        <div class="category-card">
          <div class="category-header">
            <span class="category-name">${cat.name}</span>
            <span class="category-stats">
              Revenue: ${symbol}${(cat.totalRevenue || 0).toFixed(2)} | 
              Items: ${cat.totalQuantity || 0}
            </span>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th class="amount">Qty</th>
                <th class="amount">Price</th>
                <th class="amount">Total</th>
              </tr>
            </thead>
            <tbody>
              ${(cat.items || []).map((item: any) => `
                <tr>
                  <td>${item.name}</td>
                  <td class="amount">${item.quantity || 0}</td>
                  <td class="amount">${symbol}${(item.price || 0).toFixed(2)}</td>
                  <td class="amount">${symbol}${(item.revenue || 0).toFixed(2)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="3">Category Total</td>
                <td class="amount">${symbol}${(cat.totalRevenue || 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `).join('')}

      <div class="footer">
        <p>Total Categories: ${categories.length}</p>
        <p>Grand Total: ${symbol}${categories.reduce((sum, cat) => sum + (cat.totalRevenue || 0), 0).toFixed(2)}</p>
        <p>@2026-UNIPRO SOFTWARE SG PTE LTD.ALL RIGHTS RESERVED</p>
      </div>
    </body>
    </html>
  `;
}
private static groupTransactionsBySale(transactions: any[]): any[] {
  const grouped: { [key: string]: any } = {};
  
  transactions.forEach(trans => {
    if (!grouped[trans.saleId]) {
      grouped[trans.saleId] = {
        id: trans.saleId,
        date: trans.saleDate,
        items: [],
        total: 0
      };
    }
    
    grouped[trans.saleId].items.push({
      name: trans.name,
      quantity: trans.quantity,
      price: trans.price
    });
    
    grouped[trans.saleId].total += (trans.price * trans.quantity);
  });
  
  return Object.values(grouped).sort((a: any, b: any) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}


  /**
   * 🖨️ PRINT WITH AUTO PRINTER DETECTION
   */
  static async smartPrint(
    saleData: any, 
    userId?: string | number, 
    t?: any,
    preferredType?: PrinterType
  ): Promise<boolean> {
    try {
      // Detect all printers
      const printers = await this.detectAllPrinters();
      console.log('📋 Available printers:', printers.map(p => `${p.name} (${p.type})`));

      if (printers.length === 0) {
        // No printers - fallback to PDF
        return await this.offerPDFFallback(saleData, userId, t);
      }

      // Select printer (preferred type or default)
      let selectedPrinter = preferredType 
        ? printers.find(p => p.type === preferredType)
        : this.defaultPrinter;

      if (!selectedPrinter) {
        selectedPrinter = printers[0]; // First available
      }

      console.log(`🎯 Selected printer: ${selectedPrinter.name} (${selectedPrinter.type})`);

      // Print based on printer type
      let printed = false;

      switch (selectedPrinter.type) {
        case 'thermal':
        case 'receipt':
          printed = await this.printThermalReceipt(saleData, userId, selectedPrinter);
          break;
        case 'label':
          printed = await this.printLabel(saleData, selectedPrinter);
          break;
        case 'laser':
          printed = await this.printLaser(saleData, userId, selectedPrinter);
          break;
        case 'bluetooth':
          printed = await this.printBluetooth(saleData, userId, selectedPrinter);
          break;
        case 'network':
          printed = await this.printNetwork(saleData, userId, selectedPrinter);
          break;
        case 'usb':
          printed = await this.printUSB(saleData, userId, selectedPrinter);
          break;
        default:
          printed = await this.printThermalReceipt(saleData, userId, selectedPrinter);
      }

      if (printed) {
        Alert.alert('✅ Success', `Printed on ${selectedPrinter.name}`);
        return true;
      }

      // If selected printer fails, try others
      for (const printer of printers) {
        if (printer === selectedPrinter) continue;
        console.log(`🔄 Trying fallback printer: ${printer.name}`);
        // Try printing with this printer...
      }

      // All printers failed - offer PDF
      return await this.offerPDFFallback(saleData, userId, t);

    } catch (error) {
      console.log('❌ Smart print error:', error);
      return await this.offerPDFFallback(saleData, userId, t);
    }
  }

  /**
   * 🔥 Print Thermal Receipt (58mm/80mm)
   */
  private static async printThermalReceipt(
  saleData: any, 
  userId?: string | number,
  printer?: PrinterInfo
): Promise<boolean> {
  try {
    const company = await BillPDFGenerator.loadSettings(userId);
    const width = this.getPrintWidth(printer || { paperSize: '58mm' } as PrinterInfo);
    
    // ✅ GST CALCULATION (Singapore 9% Inclusive)
    const total = saleData.total || 0;
    const gstRate = 9;
    // GST = Total × (9/109) - for inclusive
    const gstAmount = total * (gstRate / (100 + gstRate));
    const baseAmount = total - gstAmount;
    
    // ✅ Add GST info to saleData
    const enhancedData = {
      ...saleData,
      gstInfo: {
        rate: gstRate,
        type: 'Inclusive',
        baseAmount: Math.round(baseAmount * 100) / 100,
        gstAmount: Math.round(gstAmount * 100) / 100,
        totalAmount: total,
        regNo: company.gstNo || 'N/A'
      }
    };
    
    // Try Sunmi first
    try {
      const SunmiPrinter = require('react-native-sunmi-inner-printer');
      if (SunmiPrinter) {
        await SunmiPrinter.initPrinter();
        
        // ✅ Use GST format function
        const text = this.formatThermalTextWithGST(enhancedData, company);
        await SunmiPrinter.printText(text);
        await SunmiPrinter.cutPaper();
        return true;
      }
    } catch (e) {}

    // Try other thermal libraries
    try {
      const ThermalPrinter = require('react-native-thermal-printer');
      // ✅ Use GST format function
      await ThermalPrinter.printText(this.formatThermalTextWithGST(enhancedData, company));
      return true;
    } catch (e) {}

    // ✅ Fallback with GST HTML
    const html = this.generateReceiptHTMLWithGST(enhancedData, company);
    const { uri } = await Print.printToFileAsync({ html, width });
    await Print.printAsync({ uri });
    return true;

  } catch (error) {
    console.log('❌ Thermal print error:', error);
    return false;
  }
}
private static formatThermalTextWithGST(saleData: any, company: any): string {
  const symbol = company.currencySymbol || '$';
  const gstInfo = saleData.gstInfo || { 
    rate: 9, 
    baseAmount: 0, 
    gstAmount: 0, 
    totalAmount: 0,
    regNo: 'N/A'
  };
  
  // ✅ Helper function to center text (32 columns width)
  const centerText = (text: string, width: number = 32) => {
    if (!text) return ' '.repeat(width);
    const padding = Math.max(0, width - text.length);
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
  };
  
  let text = '\n';
  text += '='.repeat(32) + '\n';
  text += centerText(company.name || 'STORE NAME') + '\n';
  text += '='.repeat(32) + '\n';
  
  // Receipt Header
  text += `Bill No: ${saleData.billNumber || saleData.id || Date.now()}\n`;
  text += `Date: ${new Date().toLocaleString()}\n`;
  text += `GST Reg: ${gstInfo.regNo}\n`;
  text += '-'.repeat(32) + '\n';
  
  // Items
  saleData.items?.forEach((item: any) => {
    const name = (item.name || 'Item').substring(0, 15).padEnd(15);
    const qty = (item.quantity || 1).toString().padStart(3);
    const itemTotal = (item.price * item.quantity) || 0;
    
    text += `${name} ${qty}  ${symbol}${itemTotal.toFixed(2)}\n`;
    
    // Show unit price for clarity
    if (item.quantity > 1) {
      text += `  @ ${symbol}${(item.price || 0).toFixed(2)} each\n`;
    }
  });
  
  text += '-'.repeat(32) + '\n';
  
  // GST BREAKDOWN
  text += `Subtotal:      ${symbol}${gstInfo.baseAmount.toFixed(2)}\n`;
  text += `GST (${gstInfo.rate}%):    ${symbol}${gstInfo.gstAmount.toFixed(2)}\n`;
  text += '='.repeat(32) + '\n';
  text += `TOTAL:        ${symbol}${gstInfo.totalAmount.toFixed(2)}\n`;
  text += '='.repeat(32) + '\n';
  
  // GST Inclusive statement
  text += `* Prices include ${gstInfo.rate}% GST\n`;
  text += `GST Reg: ${gstInfo.regNo}\n`;
  text += '\n';
  text += 'THANK YOU!\n';
  text += 'Visit Again\n';
  text += '\n\n\n';
  
  return text;
}

private static generateReceiptHTMLWithGST(saleData: any, company: any): string {
  const symbol = company.currencySymbol || '$';
  const gstInfo = saleData.gstInfo || { 
    rate: 9, 
    baseAmount: 0, 
    gstAmount: 0, 
    totalAmount: 0,
    regNo: 'N/A'
  };
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { 
          font-family: 'Courier New', monospace;
          width: 80mm;
          margin: 0 auto;
          padding: 10px;
          font-size: 12px;
        }
        .header { text-align: center; margin-bottom: 10px; }
        .company-name { font-size: 18px; font-weight: bold; }
        .gst-reg { font-size: 10px; margin: 5px 0; }
        hr { border: 1px dashed #000; }
        table { width: 100%; border-collapse: collapse; }
        .item-row td { padding: 5px 0; }
        .amount { text-align: right; }
        .total-row { font-weight: bold; }
        .gst-row { font-size: 11px; }
        .footer { text-align: center; margin-top: 15px; font-size: 11px; }
        .line { border-top: 1px dashed #000; margin: 8px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-name">${company.name || 'Store Name'}</div>
        <div>${company.address || ''}</div>
        <div class="gst-reg">GST Reg: ${gstInfo.regNo}</div>
        <hr>
        <div>Bill No: ${saleData.billNumber || saleData.id || Date.now()}</div>
        <div>Date: ${new Date().toLocaleString()}</div>
        <hr>
      </div>

      <table>
        ${(saleData.items || []).map((item: any) => `
          <tr class="item-row">
            <td>${item.name || 'Item'}</td>
            <td class="amount">${item.quantity || 1}</td>
            <td class="amount">${symbol}${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</td>
          </tr>
          ${(item.quantity || 1) > 1 ? `
            <tr>
              <td colspan="3" style="font-size: 10px; padding-left: 10px;">
                @ ${symbol}${(item.price || 0).toFixed(2)} each
              </td>
            </tr>
          ` : ''}
        `).join('')}
      </table>

      <div class="line"></div>
      
      <!-- GST BREAKDOWN -->
      <table>
        <tr class="gst-row">
          <td>Subtotal (before GST)</td>
          <td class="amount">${symbol}${gstInfo.baseAmount.toFixed(2)}</td>
        </tr>
        <tr class="gst-row">
          <td>GST (${gstInfo.rate}%)</td>
          <td class="amount">${symbol}${gstInfo.gstAmount.toFixed(2)}</td>
        </tr>
        <tr class="total-row">
          <td>TOTAL (incl. GST)</td>
          <td class="amount">${symbol}${gstInfo.totalAmount.toFixed(2)}</td>
        </tr>
      </table>

      <div class="line"></div>
      
      <!-- Payment Info -->
      <div>Payment Method: ${saleData.paymentMethod || 'Cash'}</div>
      <div>Amount Paid: ${symbol}${gstInfo.totalAmount.toFixed(2)}</div>
      
      <div class="footer">
        <p>* Prices include ${gstInfo.rate}% GST</p>
        <p>GST Reg: ${gstInfo.regNo}</p>
        <p>Thank you! Please come again</p>
        <p>${new Date().toLocaleTimeString()}</p>
      </div>
    </body>
    </html>
  `;
}

  /**
   * 🏷️ Print Label (for barcode/label printers)
   */
  private static async printLabel(
    saleData: any,
    printer: PrinterInfo
  ): Promise<boolean> {
    try {
      // Format for label printer (simplified)
      let labelText = '';
      saleData.items.forEach((item: any) => {
        labelText += `${item.name}\n`;
        labelText += `Qty: ${item.quantity}\n`;
        labelText += `Price: $${(item.price * item.quantity).toFixed(2)}\n`;
        labelText += '---\n';
      });

      // Try label printer libraries
      try {
        const LabelPrinter = require('react-native-label-printer');
        await LabelPrinter.print(labelText);
        return true;
      } catch (e) {}

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * 📄 Print Laser/Inkjet (A4)
   */
  private static async printLaser(
    saleData: any,
    userId?: string | number,
    printer?: PrinterInfo
  ): Promise<boolean> {
    try {
       const outletId = saleData.outletId || userId;
      // Generate full HTML with A4 styling
      const html = await BillPDFGenerator.generateHTML(saleData, userId);
      
      // Use Android print service
      await Print.printAsync({ 
        html,
        orientation: Print.Orientation.portrait
      });
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 📱 Print Bluetooth
   */
  private static async printBluetooth(
    saleData: any,
    userId?: string | number,
    printer?: PrinterInfo
  ): Promise<boolean> {
    try {
      const BluetoothPrinter = require('react-native-bluetooth-printer');
      
      if (printer?.address) {
        await BluetoothPrinter.connect(printer.address);
      }
      
      const company = await BillPDFGenerator.loadSettings(userId);
      const text = this.formatThermalText(saleData, company);
      await BluetoothPrinter.print(text);
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 🌐 Print Network Printer
   */
  private static async printNetwork(
    saleData: any,
    userId?: string | number,
    printer?: PrinterInfo
  ): Promise<boolean> {
    try {
      const NetPrinter = require('react-native-thermal-printer');
      
      await NetPrinter.printIP(printer?.address || '', {
        text: this.formatThermalText(saleData, await BillPDFGenerator.loadSettings(userId))
      });
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 🔌 Print USB Printer
   */
  private static async printUSB(
    saleData: any,
    userId?: string | number,
    printer?: PrinterInfo
  ): Promise<boolean> {
    try {
      const UsbPrinter = require('react-native-usb-printer');
      
      if (printer?.address) {
        await UsbPrinter.connect(printer.address);
      }
      
      await UsbPrinter.print(this.formatThermalText(saleData, await BillPDFGenerator.loadSettings(userId)));
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 📝 Format text for thermal printers
   */
  private static formatThermalText(saleData: any, company: any): string {
    const symbol = company.currencySymbol || '$';
    let text = '\n';
    text += '='.repeat(32) + '\n';
    text += company.name?.padCenter(32) + '\n';
    text += '='.repeat(32) + '\n';
    text += `Bill: ${Date.now()}\n`;
    text += `Date: ${new Date().toLocaleString()}\n`;
    text += '-'.repeat(32) + '\n';
    
    saleData.items.forEach((item: any) => {
      const name = item.name.substring(0, 15).padEnd(15);
      const total = (item.price * item.quantity).toFixed(2);
      text += `${name} ${item.quantity}  ${symbol}${total}\n`;
    });
    
    text += '-'.repeat(32) + '\n';
    text += `Total: ${symbol}${saleData.total.toFixed(2)}\n`;
    text += '='.repeat(32) + '\n';
    text += 'THANK YOU!\n';
    text += '\n\n';
    
    return text;
  }

  /**
   * ✅ Check Android Print Service
   */
  private static async checkAndroidPrintService(): Promise<boolean> {
    return Platform.OS === 'android';
  }

  /**
   * 📄 PDF Fallback
   */
  static async offerPDFFallback(saleData: any, userId?: string | number, t?: any): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(
        t?.printerNotFound || '🖨️ No Printer Available',
        t?.wantPDF || 'Save as PDF?',
        [
          { text: t?.no || 'No', onPress: () => resolve(false), style: 'cancel' },
          { text: t?.yes || 'Yes', onPress: async () => {
              try {
                const html = await BillPDFGenerator.generateHTML(saleData, userId);
                const { uri } = await Print.printToFileAsync({ html, width: 226 });
                if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
                resolve(true);
              } catch { resolve(false); }
            }
          }
        ]
      );
    });
  }

  /**
   * 🧪 Test all printers
   */
  static async testAllPrinters(): Promise<void> {
    const printers = await this.detectAllPrinters();
    
    let message = `📋 Found ${printers.length} printer(s):\n\n`;
    printers.forEach((p, i) => {
      message += `${i+1}. ${p.name}\n`;
      message += `   Type: ${p.type}\n`;
      message += `   Paper: ${p.paperSize || 'Unknown'}\n`;
      message += `   Default: ${p.isDefault ? '✅' : '❌'}\n\n`;
    });
    
    Alert.alert('Printer Detection', message);
  }
}

export default UniversalPrinter;