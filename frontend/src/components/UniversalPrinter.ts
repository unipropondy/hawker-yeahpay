// frontend/src/components/UniversalPrinter.ts - COMPLETE WITH DISCOUNT SUPPORT ✅

import { Alert, Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import SunmiPrinterService from './SunmiPrinterService';
import BillPDFGenerator from './BillPDFGenerator';

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

  static async detectAllPrinters(): Promise<PrinterInfo[]> {
    const printers: PrinterInfo[] = [];
    if (Platform.OS !== 'android') return printers;
    
    try {
      // Sunmi Thermal
     
      // Bluetooth
     

      // Network
    
      // USB
     
      // Android Print Service
      try {
        const hasPrintService = await this.checkAndroidPrintService();
        if (hasPrintService) {
          printers.push({ type: 'laser', name: 'Android Print Service', isDefault: false, paperSize: 'A4' });
        }
      } catch (e) {}

      this.detectedPrinters = printers;
      this.defaultPrinter = printers.find(p => p.type === 'thermal') || printers[0] || null;
      return printers;
    } catch (error) {
      return [];
    }
  }

  static async openCashDrawer(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        try {
          const SunmiPrinter = require('react-native-sunmi-inner-printer');
          if (SunmiPrinter?.hasPrinter?.()) {
            await SunmiPrinter.openCashDrawer();
            return true;
          }
        } catch (e) {}
        try {
          const ThermalPrinter = require('react-native-thermal-printer');
          await ThermalPrinter.printRaw([0x1B, 0x70, 0x00, 0x19, 0xFA]);
          return true;
        } catch (e) {}
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  private static guessPaperSize(printerName: string): '58mm' | '80mm' | 'A4' | 'label' {
    const name = printerName.toLowerCase();
    if (name.includes('58') || name.includes('2inch')) return '58mm';
    if (name.includes('80') || name.includes('3inch')) return '80mm';
    if (name.includes('label') || name.includes('zebra')) return 'label';
    if (name.includes('laser') || name.includes('inkjet')) return 'A4';
    return '80mm';
  }

  private static getPrintWidth(printer: PrinterInfo): number {
    switch (printer.paperSize) {
      case '58mm': return 164;
      case '80mm': return 226;
      case 'A4': return 612;
      case 'label': return 300;
      default: return 226;
    }
  }

  // ==================== SALES REPORT ====================
static async printSalesReport(reportData: any, userId?: string | number, t?: any): Promise<boolean> {
  try {
    const company = await BillPDFGenerator.loadSettings(userId);
    const html = this.generateSalesReportHTML(reportData, company);
    
    // ✅ Save as PDF (no preview)
    const { uri } = await Print.printToFileAsync({ html });
    console.log('📄 Sales report saved at:', uri);
    
    // ✅ Optionally share the PDF
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri);
    }
    
    return true;
  } catch (error) {
    console.log('Sales report error:', error);
    return false;
  }
}
  private static generateSalesReportHTML(data: any, company: any): string {
    const symbol = company.currencySymbol || '$';
    return `<!DOCTYPE html><html><head><style>
      body { font-family: monospace; padding: 20px; max-width: 800px; margin: 0 auto; }
      .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
      .company-name { font-size: 24px; font-weight: bold; }
      .report-title { font-size: 20px; font-weight: bold; margin: 15px 0; text-align: center; }
      .section-title { font-size: 16px; font-weight: bold; margin: 15px 0 10px; background: #f0f0f0; padding: 5px; }
      table { width: 100%; border-collapse: collapse; margin: 10px 0; }
      th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
      .amount { text-align: right; }
      .summary-box { display: inline-block; width: 30%; padding: 10px; margin: 5px; background: #f9f9f9; text-align: center; border-radius: 5px; }
      .footer { margin-top: 30px; text-align: center; font-size: 12px; border-top: 1px solid #ddd; padding-top: 10px; }
    </style></head><body>
      <div class="header"><div class="company-name">${company.name || 'POS SYSTEM'}</div><div>${company.address || ''}</div><div>GST: ${company.gstNo || 'N/A'}</div><div class="report-title">SALES REPORT</div><div>Period: ${data.period || 'Today'}</div></div>
      <div style="text-align:center"><div class="summary-box"><div>Total Sales</div><div style="font-size:24px">${data.summary?.totalSales || 0}</div></div>
      <div class="summary-box"><div>Total Items</div><div style="font-size:24px">${data.summary?.totalItems || 0}</div></div>
      <div class="summary-box"><div>Total Revenue</div><div style="font-size:24px">${symbol}${(data.summary?.totalRevenue || 0).toFixed(2)}</div></div></div>
      <div class="section-title">💳 PAYMENT BREAKDOWN</div>${this.generateTableFromObject(data.paymentBreakdown || {}, symbol)}</div>
      <div class="footer"><p>© ${new Date().getFullYear()} UNIPRO SOFTWARES SG PTE LTD</p></div>
    </body></html>`;
  }

  // ==================== CATEGORY REPORT ====================
  static async printCategoryReport(
  categories: any[], selectedCategory: string | null, categoryItems: any[], categoryTransactions: any[],
  userId?: string | number, t?: any, options?: any
): Promise<boolean> {
  try {
    const company = await BillPDFGenerator.loadSettings(userId);
    const html = selectedCategory 
      ? this.generateCategoryDetailHTML(selectedCategory, categoryItems, categoryTransactions, company, options)
      : this.generateAllCategoriesHTML(categories, company, options);
    
    // ✅ Save as PDF (no preview)
    const { uri } = await Print.printToFileAsync({ html });
    console.log('📄 Category report saved at:', uri);
    
    // ✅ Optionally share the PDF
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri);
    }
    
    return true;
  } catch (error) { 
    console.log('Category report error:', error);
    return false; 
  }
}

  private static generateCategoryDetailHTML(categoryName: string, items: any[], transactions: any[], company: any, options?: any): string {
    const symbol = company.currencySymbol || '$';
    const groupTransactions = (tx: any[]) => {
      const grouped: any = {};
      tx.forEach(t => { if (!grouped[t.saleId]) grouped[t.saleId] = { id: t.saleId, date: t.saleDate, items: [], total: 0 }; grouped[t.saleId].items.push({ name: t.name, quantity: t.quantity, price: t.price }); grouped[t.saleId].total += t.price * t.quantity; });
      return Object.values(grouped).sort((a: any,b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };
    return `<!DOCTYPE html><html><head><style>
      body { font-family: Arial; padding: 20px; max-width: 800px; margin: 0 auto; }
      .header { text-align: center; border-bottom: 2px solid #000; margin-bottom: 20px; }
      .category-title { font-size: 22px; font-weight: bold; text-align: center; margin: 20px 0; }
      .section-title { font-size: 18px; font-weight: bold; margin: 20px 0 10px; background: #f0f0f0; padding: 8px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      th, td { padding: 8px; border-bottom: 1px solid #eee; }
      .amount { text-align: right; }
      .transaction-card { border: 1px solid #ddd; border-radius: 5px; padding: 15px; margin-bottom: 15px; }
      .footer { margin-top: 30px; text-align: center; font-size: 12px; border-top: 1px solid #ddd; padding-top: 10px; }
    </style></head><body>
      <div class="header"><div class="company-name">${company.name || 'Store'}</div><div>${company.address || ''}</div><div>GST: ${company.gstNo || 'N/A'}</div></div>
      <div class="category-title">📦 ${categoryName}</div>
      <div style="display:flex;justify-content:space-around;margin:20px 0;padding:15px;background:#f9f9f9;border-radius:5px">
        <div><div>Total Items</div><div style="font-size:18px;font-weight:bold">${items.length}</div></div>
        <div><div>Quantity Sold</div><div style="font-size:18px;font-weight:bold">${items.reduce((s,i)=>s+(i.quantity||0),0)}</div></div>
        <div><div>Total Revenue</div><div style="font-size:18px;font-weight:bold">${symbol}${items.reduce((s,i)=>s+(i.revenue||0),0).toFixed(2)}</div></div>
      </div>
      <div class="section-title">📋 Items Sold</div>${this.generateItemsTable(items, symbol)}
      <div class="section-title">📄 Transaction History</div>${transactions.length ? groupTransactions(transactions).map((sale:any) => `<div class="transaction-card"><div><strong>#${sale.id}</strong> - ${symbol}${sale.total.toFixed(2)}</div><div>${new Date(sale.date).toLocaleString()}</div>${sale.items.map((item:any) => `<div>• ${item.name} x${item.quantity} - ${symbol}${(item.price*item.quantity).toFixed(2)}</div>`).join('')}</div>`).join('') : '<p>No transactions</p>'}
      <div class="footer"><p>End of Report</p></div>
    </body></html>`;
  }

  private static generateAllCategoriesHTML(categories: any[], company: any, options?: any): string {
    const symbol = company.currencySymbol || '$';
    const summary = options?.summary || { totalSales: 0, totalItems: 0, totalRevenue: 0, paymentBreakdown: {} };
    return `<!DOCTYPE html><html><head><style>
      body { font-family: Arial; padding: 20px; max-width: 800px; margin: 0 auto; }
      .header { text-align: center; border-bottom: 2px solid #000; margin-bottom: 20px; }
      .summary-section { display: flex; justify-content: space-between; margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 5px; }
      .category-card { margin-bottom: 20px; border: 1px solid #ddd; border-radius: 5px; padding: 15px; }
      .category-name { font-size: 18px; font-weight: bold; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { padding: 8px; border-bottom: 1px solid #eee; }
      .amount { text-align: right; }
      .footer { margin-top: 30px; text-align: center; font-size: 12px; border-top: 1px solid #ddd; padding-top: 10px; }
    </style></head><body>
      <div class="header"><div class="company-name">${company.name || 'Store'}</div><div>${company.address || ''}</div><div>GST: ${company.gstNo || 'N/A'}</div><div class="report-title">📊 CATEGORY WISE SALES</div></div>
      <div class="summary-section"><div><div>Total Sales</div><div>${summary.totalSales}</div></div><div><div>Total Items</div><div>${summary.totalItems}</div></div><div><div>Total Revenue</div><div>${symbol}${summary.totalRevenue.toFixed(2)}</div></div></div>
      <div><h3>💳 PAYMENT BREAKDOWN</h3>${Object.entries(summary.paymentBreakdown).map(([m,a]) => `<div>${m}: ${symbol}${(a as number).toFixed(2)}</div>`).join('')}</div>
      ${categories.map(cat => `<div class="category-card"><div class="category-name">${cat.name}</div><div>Revenue: ${symbol}${(cat.totalRevenue||0).toFixed(2)} | Items: ${cat.totalQuantity||0}</div>${this.generateItemsTable(cat.items || [], symbol)}</div>`).join('')}
      <div class="footer"><p>© ${new Date().getFullYear()} UNIPRO SOFTWARES SG PTE LTD</p></div>
    </body></html>`;
  }

  private static generateItemsTable(items: any[], symbol: string): string {
    if (!items.length) return '<p>No items</p>';
    return `<table><thead><tr><th>Item</th><th class="amount">Qty</th><th class="amount">Price</th><th class="amount">Total</th></tr></thead><tbody>${items.map(i => `<tr><td>${i.name}</td><td class="amount">${i.quantity||0}</td><td class="amount">${symbol}${(i.price||0).toFixed(2)}</td><td class="amount">${symbol}${(i.revenue||0).toFixed(2)}</td></tr>`).join('')}</tbody></table>`;
  }

  private static generateTableFromObject(obj: Record<string, any>, symbol: string): string {
    const entries = Object.entries(obj);
    if (!entries.length) return '<p>No data</p>';
    return `<table><tbody>${entries.map(([k,v]) => `<tr><td>${k}</td><td class="amount">${symbol}${(v as number).toFixed(2)}</td></tr>`).join('')}</tbody></table>`;
  }

  // ==================== MAIN SMART PRINT WITH DISCOUNT ====================
static async smartPrint(
  saleData: any, 
  outletId?: string | number,
  t?: any, 
  discountInfo?: DiscountInfo, 
  preferredType?: PrinterType,
  isReprint: boolean = false
): Promise<boolean> {
  try {
    const company = await BillPDFGenerator.loadSettings(outletId);
    
    // ✅ 1. If network printer toggle is ON, print directly to network printer
    if (company && company.networkPrinterEnabled && company.networkPrinterIP) {
      const printed = await this.printNetwork(saleData, outletId, discountInfo);
      if (printed) {
        return true;
      }
    }
    
    // ✅ 2. If network printer is OFF or fails, try Sunmi direct print
    const printerType = await PrinterDetector.detectPrinter();
    if (printerType === 'sunmi') {
      const printed = await this.printThermalReceipt(saleData, outletId, undefined, discountInfo);
      if (printed) {
        return true;
      }
    }
    
    // ✅ 3. Fallback to PDF
    return await this.offerPDFFallback(saleData, outletId, t, discountInfo);
    
  } catch (error) { 
    console.log('SmartPrint error:', error);
    return await this.offerPDFFallback(saleData, outletId, t, discountInfo); 
  }
}
  // ==================== THERMAL PRINTING WITH DISCOUNT ====================
private static async printThermalReceipt(
  saleData: any, 
  userId?: string | number, 
  printer?: PrinterInfo, 
  discountInfo?: DiscountInfo
): Promise<boolean> {
  try {
    // ✅ STEP 1: Try Sunmi direct print (NO preview)
    const sunmiReady = await SunmiPrinterService.init();
    if (sunmiReady) {
      const company = await BillPDFGenerator.loadSettings(userId);
      
      // ✅ Pass discount to saleData for Sunmi printer
      const enhancedSaleData = { ...saleData };
      if (discountInfo?.applied && discountInfo.amount > 0) {
        enhancedSaleData.discountAmount = discountInfo.amount;
        enhancedSaleData.discountType = discountInfo.type;
        enhancedSaleData.discountValue = discountInfo.value;
        enhancedSaleData.originalTotal = saleData.total + discountInfo.amount;
      }
      
      const printed = await SunmiPrinterService.printReceipt(enhancedSaleData, company);
      if (printed) {
        console.log('✅ Printed with Sunmi printer - NO PREVIEW');
        return true;
      }
    }
    
    // ✅ STEP 2: If Sunmi fails, create PDF (no preview)
    const company = await BillPDFGenerator.loadSettings(userId);
    const html = await BillPDFGenerator.generateHTML(saleData, userId, discountInfo);
    const { uri } = await Print.printToFileAsync({ 
      html, 
      width: this.getPrintWidth(printer || { paperSize: '58mm' } as PrinterInfo) 
    });
    
    console.log('📄 PDF saved at:', uri);
    return true;
    
  } catch (error) { 
    console.log('Thermal print error:', error);
    return false; 
  }
}

  private static formatThermalText58mm(saleData: any, company: any, discountInfo?: DiscountInfo): string {
    const symbol = company.currencySymbol || '$';
    const centerText = (text: string, width: number = 32) => {
      if (!text) return ' '.repeat(width);
      const padding = Math.max(0, width - text.length);
      return ' '.repeat(Math.floor(padding / 2)) + text + ' '.repeat(padding - Math.floor(padding / 2));
    };

    let p = '\n' + '='.repeat(32) + '\n';
    p += centerText(company.name || 'STORE') + '\n';
    
    if (company.address) {
      const addressLines = company.address.split('\n');
      for (const line of addressLines) {
        if (line.trim()) p += centerText(line.trim()) + '\n';
      }
    }
    if (company.phone) p += centerText(`📞 ${company.phone}`) + '\n';
    if (company.email) p += centerText(`📧 ${company.email}`) + '\n';
    if (company.gstNo) p += centerText(`GST: ${company.gstNo}`) + '\n';
    p += '='.repeat(32) + '\n';

    // Bill details
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const dateStr = `${day}/${month}/${year} ${hours}:${minutes}`;

    p += `INVOICE NO: ${saleData.invoiceNumber || saleData.id}\n`;
    p += `DATE: ${dateStr}\n`;
    p += `CASHIER: ${saleData.cashier || company.cashierName || 'Staff'}\n`;
    p += '-'.repeat(32) + '\n';

    // Item Header (ITEM 12 chars, QTY 3 chars, PRICE 6 chars, TOTAL 8 chars) + spaces = 32 chars
    p += 'ITEM'.padEnd(12, ' ') + 'QTY'.padStart(3, ' ') + ' ' + 'PRICE'.padStart(6, ' ') + 'TOTAL'.padStart(8, ' ') + '\n';
    p += '-'.repeat(32) + '\n';

    const items = saleData.items || [];
    for (const item of items) {
      const name = (item.name || '').substring(0, 12).padEnd(12, ' ');
      const qty = (item.quantity || 1).toString().padStart(3, ' ');
      const price = `${symbol}${item.price.toFixed(2)}`.padStart(6, ' ');
      const total = `${symbol}${(item.price * item.quantity).toFixed(2)}`.padStart(8, ' ');
      p += `${name}${qty} ${price}${total}\n`;
      if (item.quantity > 10) {
        p += `    @ ${symbol}${item.price.toFixed(2)} ea\n`;
      }
    }
    p += '-'.repeat(32) + '\n';

    // Subtotal & Totals
    let subtotal = saleData.total;
    const twoCols = (left: string, right: string) => {
      const pad = 32 - left.length - right.length;
      return left + ' '.repeat(Math.max(0, pad)) + right + '\n';
    };

    let discountAmount = 0;
    let discountType = 'percentage';
    let discountValue = 0;

    if (discountInfo?.applied && discountInfo.amount > 0) {
      discountAmount = discountInfo.amount;
      discountType = discountInfo.type;
      discountValue = discountInfo.value;
    } else if (saleData.discountAmount && saleData.discountAmount > 0) {
      discountAmount = saleData.discountAmount;
      discountType = saleData.discountType;
      discountValue = saleData.discountValue;
    }

    if (discountAmount > 0) {
      const originalTotal = subtotal + discountAmount;
      p += twoCols('Sub Total:', `${symbol}${originalTotal.toFixed(2)}`);
      p += twoCols('Discount:', `-${symbol}${discountAmount.toFixed(2)}`);
      if (discountType === 'percentage') {
        p += `    (${discountValue}% off)\n`;
      }
      p += '-'.repeat(32) + '\n';
    } else {
      p += twoCols('Sub Total:', `${symbol}${subtotal.toFixed(2)}`);
      p += '-'.repeat(32) + '\n';
    }

    if (company.gstPercentage > 0) {
      const gstAmount = subtotal * (company.gstPercentage / (100 + company.gstPercentage));
      const beforeGst = subtotal - gstAmount;
      p += twoCols('Sub Total (before GST):', `${symbol}${beforeGst.toFixed(2)}`);
      p += twoCols(`GST (${company.gstPercentage}%):`, `${symbol}${gstAmount.toFixed(2)}`);
      p += '-'.repeat(32) + '\n';
    }

    p += twoCols('GRAND TOTAL:', `${symbol}${subtotal.toFixed(2)}`);
    p += '='.repeat(32) + '\n';

    p += twoCols('PAYMENT:', saleData.paymentMethod || 'Cash');
    if (saleData.cashPaid && saleData.cashPaid > 0) {
      p += twoCols('PAID:', `${symbol}${saleData.cashPaid.toFixed(2)}`);
      if (saleData.change && saleData.change > 0) {
        p += twoCols('CHANGE:', `${symbol}${saleData.change.toFixed(2)}`);
      }
    }

    p += '\n';
    p += centerText('THANK YOU! COME AGAIN!') + '\n';
    p += centerText('SMARTHAWKER BY UNIPROSG') + '\n';
    if (company.gstPercentage > 0) {
      p += centerText(`* Prices include ${company.gstPercentage}% GST`) + '\n';
    }
    p += '\n\n\n';
    return p;
  }

  private static formatThermalText80mm(saleData: any, company: any, discountInfo?: DiscountInfo): string {
    const symbol = company.currencySymbol || '$';
    const centerText = (text: string, width: number = 48) => {
      if (!text) return ' '.repeat(width);
      const padding = Math.max(0, width - text.length);
      return ' '.repeat(Math.floor(padding / 2)) + text + ' '.repeat(padding - Math.floor(padding / 2));
    };

    let p = '\n' + '='.repeat(48) + '\n';
    p += centerText(company.name || 'STORE', 48) + '\n';
    
    if (company.address) {
      const addressLines = company.address.split('\n');
      for (const line of addressLines) {
        if (line.trim()) p += centerText(line.trim(), 48) + '\n';
      }
    }
    if (company.phone) p += centerText(`📞 ${company.phone}`, 48) + '\n';
    if (company.email) p += centerText(`📧 ${company.email}`, 48) + '\n';
    if (company.gstNo) p += centerText(`GST: ${company.gstNo}`, 48) + '\n';
    p += '='.repeat(48) + '\n';

    // Bill details
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const dateStr = `${day}/${month}/${year} ${hours}:${minutes}`;

    p += `INVOICE NO: ${saleData.invoiceNumber || saleData.id}\n`;
    p += `DATE: ${dateStr}\n`;
    p += `CASHIER: ${saleData.cashier || company.cashierName || 'Staff'}\n`;
    p += '-'.repeat(48) + '\n';

    // Item Header (ITEM 24 chars, QTY 4 chars, PRICE 9 chars, TOTAL 11 chars) = 48 chars
    p += 'ITEM'.padEnd(24, ' ') + 'QTY'.padStart(4, ' ') + 'PRICE'.padStart(9, ' ') + 'TOTAL'.padStart(11, ' ') + '\n';
    p += '-'.repeat(48) + '\n';

    const items = saleData.items || [];
    for (const item of items) {
      const name = (item.name || '').substring(0, 24).padEnd(24, ' ');
      const qty = (item.quantity || 1).toString().padStart(4, ' ');
      const price = `${symbol}${item.price.toFixed(2)}`.padStart(9, ' ');
      const total = `${symbol}${(item.price * item.quantity).toFixed(2)}`.padStart(11, ' ');
      p += `${name}${qty}${price}${total}\n`;
      if (item.quantity > 10) {
        p += `    @ ${symbol}${item.price.toFixed(2)} ea\n`;
      }
    }
    p += '-'.repeat(48) + '\n';

    // Subtotal & Totals
    let subtotal = saleData.total;
    const twoCols = (left: string, right: string) => {
      const pad = 48 - left.length - right.length;
      return left + ' '.repeat(Math.max(0, pad)) + right + '\n';
    };

    let discountAmount = 0;
    let discountType = 'percentage';
    let discountValue = 0;

    if (discountInfo?.applied && discountInfo.amount > 0) {
      discountAmount = discountInfo.amount;
      discountType = discountInfo.type;
      discountValue = discountInfo.value;
    } else if (saleData.discountAmount && saleData.discountAmount > 0) {
      discountAmount = saleData.discountAmount;
      discountType = saleData.discountType;
      discountValue = saleData.discountValue;
    }

    if (discountAmount > 0) {
      const originalTotal = subtotal + discountAmount;
      p += twoCols('Sub Total:', `${symbol}${originalTotal.toFixed(2)}`);
      p += twoCols('Discount:', `-${symbol}${discountAmount.toFixed(2)}`);
      if (discountType === 'percentage') {
        p += `    (${discountValue}% off)\n`;
      }
      p += '-'.repeat(48) + '\n';
    } else {
      p += twoCols('Sub Total:', `${symbol}${subtotal.toFixed(2)}`);
      p += '-'.repeat(48) + '\n';
    }

    if (company.gstPercentage > 0) {
      const gstAmount = subtotal * (company.gstPercentage / (100 + company.gstPercentage));
      const beforeGst = subtotal - gstAmount;
      p += twoCols('Sub Total (before GST):', `${symbol}${beforeGst.toFixed(2)}`);
      p += twoCols(`GST (${company.gstPercentage}%):`, `${symbol}${gstAmount.toFixed(2)}`);
      p += '-'.repeat(48) + '\n';
    }

    p += twoCols('GRAND TOTAL:', `${symbol}${subtotal.toFixed(2)}`);
    p += '='.repeat(48) + '\n';

    p += twoCols('PAYMENT:', saleData.paymentMethod || 'Cash');
    if (saleData.cashPaid && saleData.cashPaid > 0) {
      p += twoCols('PAID:', `${symbol}${saleData.cashPaid.toFixed(2)}`);
      if (saleData.change && saleData.change > 0) {
        p += twoCols('CHANGE:', `${symbol}${saleData.change.toFixed(2)}`);
      }
    }

    p += '\n';
    p += centerText('THANK YOU! COME AGAIN!', 48) + '\n';
    p += centerText('SMARTHAWKER BY UNIPROSG', 48) + '\n';
    if (company.gstPercentage > 0) {
      p += centerText(`* Prices include ${company.gstPercentage}% GST`, 48) + '\n';
    }
    p += '\n\n\n';
    return p;
  }

  // ==================== LASER PRINTING ====================
private static async printLaser(saleData: any, userId?: string | number, printer?: PrinterInfo, discountInfo?: DiscountInfo): Promise<boolean> {
  try { 
    const html = await BillPDFGenerator.generateHTML(saleData, userId, discountInfo); 
    // ✅ Save as PDF instead of print (no preview)
    const { uri } = await Print.printToFileAsync({ html });
    console.log('📄 PDF saved at:', uri);
    return true; 
  } catch (error) { 
    return false; 
  }
}
  // ==================== BLUETOOTH PRINTING ====================
  private static async printBluetooth(saleData: any, userId?: string | number, printer?: PrinterInfo, discountInfo?: DiscountInfo): Promise<boolean> {
    try {
      const BluetoothPrinter = require('react-native-bluetooth-printer');
      if (printer?.address) await BluetoothPrinter.connect(printer.address);
      const company = await BillPDFGenerator.loadSettings(userId);
      await BluetoothPrinter.print(this.formatThermalText58mm(saleData, company, discountInfo));
      return true;
    } catch (error) { return false; }
  }

  // ==================== NETWORK PRINTING ====================
  private static async printNetwork(
    saleData: any, 
    userId?: string | number, 
    discountInfo?: DiscountInfo
  ): Promise<boolean> {
    let company: any = null;
    try {
      company = await BillPDFGenerator.loadSettings(userId);
      if (!company || !company.networkPrinterEnabled || !company.networkPrinterIP) {
        console.log('📡 Network printer not configured or disabled');
        return false;
      }

      console.log('📡 Route print to Network Printer IP:', company.networkPrinterIP);
      const ThermalPrinter = require('react-native-thermal-printer');
      const ThermalPrinterModule = ThermalPrinter ? (ThermalPrinter.default || ThermalPrinter) : null;
      
      const { NativeModules } = require('react-native');
      const hasNativeModule = !!(NativeModules.ThermalPrinter || NativeModules.ThermalPrinterModule);

      if (!ThermalPrinterModule || !hasNativeModule) {
        throw new Error('react-native-thermal-printer native module not available (e.g. running in Expo Go)');
      }

      // Format receipt text
      const receiptText = this.formatThermalText80mm(saleData, company, discountInfo);

      // Support react-native-thermal-printer TCP API
      await ThermalPrinterModule.printTcp({
        ip: company.networkPrinterIP,
        port: 9100,
        payload: receiptText,
        autoCut: true,
        openCashDrawer: false,
      });

      console.log('✅ Network Print successful');
      return true;
    } catch (error: any) { 
      console.log('❌ Network Print error:', error);
      Alert.alert(
        'Network Printer Error', 
        'Could not print to network printer at ' + (company?.networkPrinterIP || 'unknown IP') + '. Please check connection and settings.'
      );
      return false; 
    }
  }

  // ==================== USB PRINTING ====================
  private static async printUSB(saleData: any, userId?: string | number, printer?: PrinterInfo, discountInfo?: DiscountInfo): Promise<boolean> {
    try {
      const UsbPrinter = require('react-native-usb-printer');
      if (printer?.address) await UsbPrinter.connect(printer.address);
      const company = await BillPDFGenerator.loadSettings(userId);
      await UsbPrinter.print(this.formatThermalText58mm(saleData, company, discountInfo));
      return true;
    } catch (error) { return false; }
  }

  // ==================== LABEL PRINTING ====================
  private static async printLabel(saleData: any, printer: PrinterInfo): Promise<boolean> {
    try {
      let labelText = '';
      saleData.items.forEach((item: any) => { labelText += `${item.name}\nQty: ${item.quantity}\nPrice: $${(item.price * item.quantity).toFixed(2)}\n---\n`; });
      const LabelPrinter = require('react-native-label-printer');
      await LabelPrinter.print(labelText);
      return true;
    } catch (error) { return false; }
  }

  // ==================== PDF FALLBACK WITH DISCOUNT ====================
  static async offerPDFFallback(saleData: any, userId?: string | number, t?: any, discountInfo?: DiscountInfo): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(t?.printerNotFound || '🖨️ No Printer Available', t?.wantPDF || 'Save as PDF?', [
        { text: t?.no || 'No', onPress: () => resolve(false), style: 'cancel' },
        { text: t?.yes || 'Yes', onPress: async () => {
            try {
              const html = await BillPDFGenerator.generateHTML(saleData, userId, discountInfo);
              const { uri } = await Print.printToFileAsync({ html, width: 226 });
              if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
              resolve(true);
            } catch { resolve(false); }
          }
        }
      ]);
    });
  }

  // ==================== UTILITIES ====================
  private static async checkAndroidPrintService(): Promise<boolean> { return Platform.OS === 'android'; }

  static async testAllPrinters(): Promise<void> {
    const printers = await this.detectAllPrinters();
    let message = `📋 Found ${printers.length} printer(s):\n\n`;
    printers.forEach((p, i) => { message += `${i+1}. ${p.name}\n   Type: ${p.type}\n   Paper: ${p.paperSize || 'Unknown'}\n   Default: ${p.isDefault ? '✅' : '❌'}\n\n`; });
    Alert.alert('Printer Detection', message);
  }
    // ==================== SALES REPORT THERMAL PRINT ====================
  // ==================== SALES REPORT THERMAL PRINT ====================
static async printSalesReportThermal(reportData: any, userId?: string | number, t?: any): Promise<boolean> {
    try {
        const sunmiReady = await SunmiPrinterService.init();
        if (!sunmiReady) {
            console.log('Sunmi printer not available, using PDF fallback');
            return false;
        }
        
        const company = await BillPDFGenerator.loadSettings(userId);
        const symbol = company.currencySymbol || '$';
        
        let text = '\n';
        text += '='.repeat(32) + '\n';
        text += this.centerText(company.name || 'SALES REPORT', 32) + '\n';
        text += '='.repeat(32) + '\n';
        text += `Period: ${reportData.period || 'Today'}\n`;
        text += `Date: ${new Date().toLocaleString()}\n`;
        text += '-'.repeat(32) + '\n\n';
        
        // ========== SUMMARY ==========
        text += this.centerText('SUMMARY', 32) + '\n';
        text += '-'.repeat(32) + '\n';
        text += this.twoColumns('Total Sales:', `${reportData.summary?.totalSales || 0}`, 32) + '\n';
        text += this.twoColumns('Total Items:', `${reportData.summary?.totalItems || 0}`, 32) + '\n';
        text += this.twoColumns('Total Revenue:', `${symbol}${(reportData.summary?.totalRevenue || 0).toFixed(2)}`, 32) + '\n';
        
        // ✅ DISCOUNT SECTION
        if (reportData.summary?.totalDiscount > 0) {
            text += this.twoColumns('Total Discount:', `-${symbol}${reportData.summary.totalDiscount.toFixed(2)}`, 32) + '\n';
            const discountPercent = reportData.summary?.totalSales > 0 
                ? ((reportData.summary.discountedSales / reportData.summary.totalSales) * 100).toFixed(1)
                : '0';
            text += this.twoColumns('Discounted Sales:', `${reportData.summary?.discountedSales || 0} / ${reportData.summary?.totalSales || 0} (${discountPercent}%)`, 32) + '\n';
        }
        
        // ✅ VALUE CARD SECTION
        if (reportData.summary?.totalValueCardAmount > 0) {
            text += '\n' + '-'.repeat(32) + '\n';
            text += this.centerText('💎 VALUE CARD USAGE', 32) + '\n';
            text += '-'.repeat(32) + '\n';
            text += this.twoColumns('Total Value Card:', `${symbol}${(reportData.summary?.totalValueCardAmount || 0).toFixed(2)}`, 32) + '\n';
            text += this.twoColumns('Card Transactions:', `${reportData.summary?.valueCardTransactions || 0}`, 32) + '\n';
        }
        
        text += '\n' + '-'.repeat(32) + '\n';
        
        // ========== PAYMENT BREAKDOWN ==========
        text += this.centerText('PAYMENT BREAKDOWN', 32) + '\n';
        text += '-'.repeat(32) + '\n';
        
        if (reportData.paymentBreakdown) {
            const sortedMethods = Object.entries(reportData.paymentBreakdown).sort((a, b) => (b[1] as number) - (a[1] as number));
            
            for (const [method, amount] of sortedMethods) {
                let methodIcon = '';
                const methodLower = method.toLowerCase();
                
                if (methodLower.includes('cash')) methodIcon = '💰';
                else if (methodLower.includes('upi')) methodIcon = '📱';
                else if (methodLower.includes('paynow')) methodIcon = '📱';
                else if (methodLower.includes('card')) methodIcon = '💳';
                else if (methodLower.includes('value')) methodIcon = '💎';
                else if (methodLower.includes('discount')) methodIcon = '🏷️';
                else methodIcon = '💵';
                
                const methodName = `${methodIcon} ${method}`;
                text += this.twoColumns(methodName, `${symbol}${(amount as number).toFixed(2)}`, 32) + '\n';
            }
        }
        
        text += '\n' + '='.repeat(32) + '\n';
        text += this.centerText('END OF REPORT', 32) + '\n';
        text += '='.repeat(32) + '\n\n';
        text += this.centerText('SMARTHAWKER BY UNIPROSG', 32) + '\n';
        text += '\n\n';
        
        await SunmiPrinterService.printRawText(text);
        await SunmiPrinterService.cutPaper();
        
        return true;
        
    } catch (error) {
        console.log('Thermal sales report error:', error);
        return false;
    }
}
  // ==================== CATEGORY REPORT THERMAL PRINT ====================
  // ==================== CATEGORY REPORT THERMAL PRINT ====================
static async printCategoryReportThermal(
    categories: any[], 
    selectedCategory: string | null, 
    categoryItems: any[], 
    categoryTransactions: any[],
    userId?: string | number, 
    t?: any, 
    options?: any
): Promise<boolean> {
    try {
        const sunmiReady = await SunmiPrinterService.init();
        if (!sunmiReady) {
            return false;
        }
        
        const company = await BillPDFGenerator.loadSettings(userId);
        const symbol = company.currencySymbol || '$';
        const summary = options?.summary || {};
        
        let text = '\n';
        text += '='.repeat(32) + '\n';
        text += this.centerText(company.name || 'CATEGORY REPORT', 32) + '\n';
        text += '='.repeat(32) + '\n';
        text += `Filter: ${options?.filter || 'Today'}\n`;
        text += `Date: ${new Date().toLocaleString()}\n`;
        text += '-'.repeat(32) + '\n\n';
        
        if (selectedCategory) {
            // Single category view
            text += this.centerText(`📦 ${selectedCategory}`, 32) + '\n';
            text += '-'.repeat(32) + '\n';
            text += this.twoColumns('Total Revenue:', `${symbol}${(summary.totalRevenue || 0).toFixed(2)}`, 32) + '\n';
            text += this.twoColumns('Total Items:', `${summary.totalItems || 0}`, 32) + '\n';
            text += this.twoColumns('Transactions:', `${summary.totalSales || 0}`, 32) + '\n';
            
            // ✅ Discount in category
            if (summary.totalDiscount > 0) {
                text += this.twoColumns('Total Discount:', `-${symbol}${summary.totalDiscount.toFixed(2)}`, 32) + '\n';
                text += this.twoColumns('Discounted Trans:', `${summary.discountedTransactions || 0} / ${summary.totalSales || 0}`, 32) + '\n';
            }
            
            // ✅ Value Card in category
            if (summary.totalValueCardAmount > 0) {
                text += this.twoColumns('Value Card Used:', `${symbol}${summary.totalValueCardAmount.toFixed(2)}`, 32) + '\n';
            }
            
            // Payment breakdown for this category
            if (summary.paymentBreakdown && Object.keys(summary.paymentBreakdown).length > 0) {
                text += '\n' + '-'.repeat(32) + '\n';
                text += this.centerText('PAYMENT BREAKDOWN', 32) + '\n';
                text += '-'.repeat(32) + '\n';
                
                const sortedMethods = Object.entries(summary.paymentBreakdown).sort((a, b) => (b[1] as number) - (a[1] as number));
                for (const [method, amount] of sortedMethods) {
                    let methodIcon = '';
                    const methodLower = method.toLowerCase();
                    if (methodLower.includes('cash')) methodIcon = '💰';
                    else if (methodLower.includes('upi')) methodIcon = '📱';
                    else if (methodLower.includes('paynow')) methodIcon = '📱';
                    else if (methodLower.includes('card')) methodIcon = '💳';
                    else if (methodLower.includes('value')) methodIcon = '💎';
                    else methodIcon = '💵';
                    
                    text += this.twoColumns(`${methodIcon} ${method}`, `${symbol}${(amount as number).toFixed(2)}`, 32) + '\n';
                }
            }
            
            // Items list
            if (categoryItems && categoryItems.length > 0) {
                text += '\n' + '-'.repeat(32) + '\n';
                text += this.centerText('TOP ITEMS', 32) + '\n';
                text += '-'.repeat(32) + '\n';
                
                const topItems = [...categoryItems].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
                for (const item of topItems) {
                    text += `\n${item.name}\n`;
                    text += `  Qty: ${item.quantity}  Revenue: ${symbol}${item.revenue.toFixed(2)}\n`;
                    if (item.discountAmount > 0) {
                        text += `  Discount: -${symbol}${item.discountAmount.toFixed(2)}\n`;
                    }
                }
            }
        } else {
            // All categories view
            text += this.centerText('CATEGORIES SUMMARY', 32) + '\n';
            text += '-'.repeat(32) + '\n';
            text += this.twoColumns('Categories:', `${categories.length}`, 32) + '\n';
            text += this.twoColumns('Total Revenue:', `${symbol}${(summary.totalRevenue || 0).toFixed(2)}`, 32) + '\n';
            text += this.twoColumns('Total Items:', `${summary.totalItems || 0}`, 32) + '\n';
            text += this.twoColumns('Transactions:', `${summary.totalSales || 0}`, 32) + '\n';
            
            // ✅ Discount summary
            if (summary.totalDiscount > 0) {
                text += this.twoColumns('Total Discount:', `-${symbol}${summary.totalDiscount.toFixed(2)}`, 32) + '\n';
            }
            
            // ✅ Value Card summary
            if (summary.totalValueCardAmount > 0) {
                text += this.twoColumns('Value Card Total:', `${symbol}${summary.totalValueCardAmount.toFixed(2)}`, 32) + '\n';
                text += this.twoColumns('Value Card Trans:', `${summary.valueCardTransactionCount || 0}`, 32) + '\n';
            }
            
            // Payment breakdown
            if (summary.paymentBreakdown && Object.keys(summary.paymentBreakdown).length > 0) {
                text += '\n' + '-'.repeat(32) + '\n';
                text += this.centerText('PAYMENT BREAKDOWN', 32) + '\n';
                text += '-'.repeat(32) + '\n';
                
                const sortedMethods = Object.entries(summary.paymentBreakdown).sort((a, b) => (b[1] as number) - (a[1] as number));
                for (const [method, amount] of sortedMethods) {
                    let methodIcon = '';
                    const methodLower = method.toLowerCase();
                    if (methodLower.includes('cash')) methodIcon = '💰';
                    else if (methodLower.includes('upi')) methodIcon = '📱';
                    else if (methodLower.includes('paynow')) methodIcon = '📱';
                    else if (methodLower.includes('card')) methodIcon = '💳';
                    else if (methodLower.includes('value')) methodIcon = '💎';
                    else methodIcon = '💵';
                    
                    text += this.twoColumns(`${methodIcon} ${method}`, `${symbol}${(amount as number).toFixed(2)}`, 32) + '\n';
                }
            }
            
            // Category breakdown
            text += '\n' + '-'.repeat(32) + '\n';
            text += this.centerText('CATEGORY BREAKDOWN', 32) + '\n';
            text += '-'.repeat(32) + '\n';
            
            for (const cat of categories) {
                text += `\n${cat.name}\n`;
                text += `  Revenue: ${symbol}${(cat.totalRevenue || 0).toFixed(2)}\n`;
                text += `  Items: ${cat.totalQuantity || 0}\n`;
                if (cat.discountAmount > 0) {
                    text += `  Discount: -${symbol}${cat.discountAmount.toFixed(2)}\n`;
                }
                if (cat.valueCardAmount > 0) {
                    text += `  Value Card: ${symbol}${cat.valueCardAmount.toFixed(2)}\n`;
                }
            }
        }
        
        text += '\n' + '='.repeat(32) + '\n';
        text += this.centerText('END OF REPORT', 32) + '\n';
        text += '='.repeat(32) + '\n\n';
        text += this.centerText('SMARTHAWKER BY UNIPROSG', 32) + '\n';
        
        await SunmiPrinterService.printRawText(text);
        await SunmiPrinterService.cutPaper();
        
        return true;
        
    } catch (error) {
        console.log('Thermal category report error:', error);
        return false;
    }
}
  // ==================== HELPER METHODS ====================
  private static centerText(text: string, width: number): string {
    if (!text) return ' '.repeat(width);
    const padding = Math.max(0, width - text.length);
    return ' '.repeat(Math.floor(padding / 2)) + text + ' '.repeat(padding - Math.floor(padding / 2));
  }

  private static twoColumns(left: string, right: string, width: number): string {
    const leftWidth = Math.floor(width * 0.55);
    const rightWidth = width - leftWidth;
    let leftText = left.substring(0, leftWidth);
    let rightText = right.substring(0, rightWidth);
    leftText = leftText.padEnd(leftWidth, ' ');
    return leftText + rightText;
  }
}

export default UniversalPrinter;