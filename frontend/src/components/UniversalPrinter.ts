// frontend/src/components/UniversalPrinter.ts - COMPLETE WITH DISCOUNT SUPPORT ✅

import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
      } catch (e) { }

      this.detectedPrinters = printers;
      this.defaultPrinter = printers.find(p => p.type === 'thermal') || printers[0] || null;
      return printers;
    } catch (error) {
      return [];
    }
  }

  static async openCashDrawer(outletId?: string | number): Promise<boolean> {
    try {
      // ✅ STEP 1: Try Network Printer cash drawer (if configured)
      if (outletId) {
        try {
          const company = await BillPDFGenerator.loadSettings(outletId);
          if (company && company.networkPrinterEnabled && company.networkPrinterIP) {
            console.log('📡 Opening cash drawer via Network Printer IP:', company.networkPrinterIP);
            const ThermalPrinter = require('react-native-thermal-printer');
            const ThermalPrinterModule = ThermalPrinter ? (ThermalPrinter.default || ThermalPrinter) : null;
            const { NativeModules } = require('react-native');
            const hasNativeModule = !!(NativeModules.ThermalPrinter || NativeModules.ThermalPrinterModule);

            if (ThermalPrinterModule && hasNativeModule) {

              // ✅ METHOD 1: Use printTcp with openCashbox: true (No payload, no feed, no autocut)
              try {
                console.log('📡 Method 1: printTcp with openCashbox: true');
                await ThermalPrinterModule.printTcp({
                  ip: company.networkPrinterIP,
                  port: 9100,
                  payload: '',
                  autoCut: false,
                  openCashbox: true,
                  mmFeedPaper: 0,
                });
                console.log('✅ Cash drawer opened via Method 1');
                return true;
              } catch (e1: any) {
                console.log('⚠️ Method 1 failed:', e1?.message || e1);
              }

              // ✅ METHOD 2: Send raw ESC/POS cash drawer kick bytes via payload
              try {
                console.log('📡 Method 2: Raw ESC/POS command via printTcp');
                // Send combinations of Pin 2 / Pin 5 with both 25ms and 250ms timings for maximum compatibility
                const pin2KickFA = '\x1B\x70\x00\x19\xFA';
                const pin5KickFA = '\x1B\x70\x01\x19\xFA';
                const pin2Kick19 = '\x1B\x70\x00\x19\x19';
                const pin5Kick19 = '\x1B\x70\x01\x19\x19';
                await ThermalPrinterModule.printTcp({
                  ip: company.networkPrinterIP,
                  port: 9100,
                  payload: pin2KickFA + pin5KickFA + pin2Kick19 + pin5Kick19,
                  autoCut: false,
                  openCashbox: false,
                  mmFeedPaper: 0,
                });
                console.log('✅ Cash drawer opened via Method 2 (raw ESC/POS)');
                return true;
              } catch (e2: any) {
                console.log('⚠️ Method 2 failed:', e2?.message || e2);
              }
            }
          }
        } catch (netError: any) {
          console.log('❌ Network cash drawer error:', netError?.message || netError);
        }
      }

      // ✅ STEP 2: Try Sunmi built-in printer
      if (Platform.OS === 'android') {
        try {
          const SunmiPrinter = require('react-native-sunmi-inner-printer');
          if (SunmiPrinter?.hasPrinter?.()) {
            await SunmiPrinter.openCashDrawer();
            return true;
          }
        } catch (e) { }
        // ✅ STEP 3: Try local thermal printer raw command
        try {
          const ThermalPrinter = require('react-native-thermal-printer');
          await ThermalPrinter.printRaw([0x1B, 0x70, 0x00, 0x19, 0xFA]);
          return true;
        } catch (e) { }
      }
      return false;
    } catch (error) {
      console.log('❌ openCashDrawer error:', error);
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
      let username = 'Admin';
      try {
        const userStr = await AsyncStorage.getItem('user');
        if (userStr) {
          const userObj = JSON.parse(userStr);
          if (userObj && userObj.username) {
            username = userObj.username;
          }
        }
      } catch (e) {
        console.log('Error getting username from AsyncStorage:', e);
      }

      const enrichedOptions = { ...options, username };
      const company = await BillPDFGenerator.loadSettings(userId);
      const html = selectedCategory
        ? this.generateCategoryDetailHTML(selectedCategory, categoryItems, categoryTransactions, company, enrichedOptions)
        : this.generateAllCategoriesHTML(categories, company, enrichedOptions);

      if (Platform.OS === 'web') {
        try {
          // Load html2pdf from CDN
          await new Promise<void>((resolve, reject) => {
            const src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            if (document.querySelector(`script[src="${src}"]`)) {
              resolve();
              return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = (e) => reject(e);
            document.head.appendChild(script);
          });

          const opt = {
            margin: 0,
            filename: `Sales_Analytics_Report_${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 1.5, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
          };

          await (window as any).html2pdf().from(html).set(opt).save();
          return true;
        } catch (err) {
          console.log('Error downloading PDF file:', err);
          return false;
        }
      }

      // ✅ Open native PDF print preview dialog
      await Print.printAsync({ html });

      return true;
    } catch (error) {
      console.log('Category report error:', error);
      return false;
    }
  }

  private static formatDateTime(dateVal: any): string {
    if (!dateVal) return 'N/A';
    try {
      let dateString = typeof dateVal === 'string' ? dateVal : dateVal.toISOString();
      const cleanDate = dateString.replace('Z', '');
      const date = new Date(cleanDate);
      if (isNaN(date.getTime())) {
        return String(dateVal);
      }
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      let hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${day}/${month}/${year}, ${hours}:${minutes} ${ampm}`;
    } catch (e) {
      return String(dateVal);
    }
  }

  private static generateCategoryDetailHTML(categoryName: string, items: any[], transactions: any[], company: any, options?: any): string {
    const symbol = company.currencySymbol || '$';
    const isVoided = !!(options?.isVoided || options?.status === 'voided');
    const groupTransactions = (tx: any[]) => {
      const grouped: any = {};
      tx.forEach(t => {
        const key = t.saleId || t.id || Math.random();
        if (!grouped[key]) {
          grouped[key] = {
            id: key,
            invoiceNumber: t.invoiceNumber || t.invoice_number || key,
            date: t.saleDate || t.date,
            items: [],
            total: 0,
            voidReason: t.voidReason || t.void_reason || null,
            voidedBy: t.voidedBy || t.voided_by || null,
            status: t.status || (isVoided ? 'VOIDED' : 'COMPLETED')
          };
        }
        grouped[key].items.push({ name: t.name || '', quantity: t.quantity || 1, price: t.price || 0 });
        grouped[key].total += (t.price || 0) * (t.quantity || 1);
      });
      return Object.values(grouped).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };
    const totalQty = items.reduce((s, i) => s + (i.quantity || 0), 0);
    const totalRev = items.reduce((s, i) => s + (i.revenue || 0), 0);

    return `<!DOCTYPE html><html><head><style>
      body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; color: #333; }
      .header { text-align: center; border-bottom: 2px solid ${isVoided ? '#EF4444' : '#000'}; margin-bottom: 20px; padding-bottom: 10px; }
      .company-name { font-size: 24px; font-weight: bold; }
      .category-title { font-size: 22px; font-weight: bold; text-align: center; margin: 20px 0; color: ${isVoided ? '#DC2626' : '#1F2937'}; }
      .void-badge { display: inline-block; background: #FEE2E2; color: #DC2626; border: 1px solid #FCA5A5; font-size: 11px; font-weight: bold; padding: 3px 8px; border-radius: 4px; margin-left: 8px; }
      .section-title { font-size: 16px; font-weight: bold; margin: 20px 0 10px; background: ${isVoided ? '#FEE2E2' : '#f0f0f0'}; color: ${isVoided ? '#991B1B' : '#111827'}; padding: 8px; border-left: 4px solid ${isVoided ? '#DC2626' : '#FF7A00'}; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      th, td { padding: 8px; border-bottom: 1px solid #eee; text-align: left; }
      .amount { text-align: right; }
      .transaction-card { border: 1px solid ${isVoided ? '#FCA5A5' : '#ddd'}; background: ${isVoided ? '#FEF2F2' : '#fff'}; border-radius: 6px; padding: 15px; margin-bottom: 15px; }
      .footer { margin-top: 30px; text-align: center; font-size: 12px; border-top: 1px solid #ddd; padding-top: 10px; color: #6B7280; }
    </style></head><body>
      <div class="header">
        <div class="company-name">${company.name || 'Store'}</div>
        <div>${company.address || ''}</div>
        <div>GST: ${company.gstNo || 'N/A'}</div>
      </div>
      <div class="category-title">
        📦 ${categoryName} ${isVoided ? '<span class="void-badge">🚫 VOIDED REPORT</span>' : ''}
      </div>
      <div style="display:flex;justify-content:space-around;margin:20px 0;padding:15px;background:${isVoided ? '#FEF2F2' : '#f9f9f9'};border-radius:6px;border:1px solid ${isVoided ? '#FCA5A5' : '#e5e7eb'}">
        <div><div>${isVoided ? 'Voided Items' : 'Total Items'}</div><div style="font-size:18px;font-weight:bold">${items.length}</div></div>
        <div><div>${isVoided ? 'Voided Quantity' : 'Quantity Sold'}</div><div style="font-size:18px;font-weight:bold">${totalQty}</div></div>
        <div><div>${isVoided ? 'Total Voided Amount' : 'Total Revenue'}</div><div style="font-size:18px;font-weight:bold;color:${isVoided ? '#DC2626' : '#111827'}">${symbol}${totalRev.toFixed(2)}</div></div>
      </div>
      <div class="section-title">📋 ${isVoided ? 'Voided Items List' : 'Items Sold'}</div>
      ${this.generateItemsTable(items, symbol)}
      <div class="section-title">📄 ${isVoided ? 'Voided Transactions History' : 'Transaction History'}</div>
      ${transactions.length ? groupTransactions(transactions).map((sale: any) => `
        <div class="transaction-card">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div><strong>#${sale.invoiceNumber || sale.id}</strong> ${isVoided ? '<span class="void-badge">VOIDED</span>' : ''}</div>
            <div style="font-size:16px;font-weight:bold;color:${isVoided ? '#DC2626' : '#111827'}">${symbol}${sale.total.toFixed(2)}</div>
          </div>
          <div style="font-size:11px;color:#6B7280;margin:4px 0;">${sale.date ? this.formatDateTime(sale.date) : ''}</div>
          ${sale.voidReason ? `<div style="font-size:12px;color:#DC2626;margin:4px 0;"><strong>Void Reason:</strong> ${sale.voidReason}</div>` : ''}
          ${sale.voidedBy && !/^\d+$/.test(String(sale.voidedBy)) && sale.voidedBy !== 'N/A' ? `<div style="font-size:12px;color:#4B5563;margin:2px 0;"><strong>Voided By:</strong> ${sale.voidedBy}</div>` : `<div style="font-size:12px;color:#4B5563;margin:2px 0;"><strong>Voided By:</strong> Staff</div>`}
          <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #ddd;">
            ${sale.items.map((item: any) => `<div>• ${item.name} x${item.quantity} - ${symbol}${(item.price * item.quantity).toFixed(2)}</div>`).join('')}
          </div>
        </div>
      `).join('') : '<p>No transactions found</p>'}
      <div class="footer"><p>End of Category Report</p></div>
    </body></html>`;
  }

  private static generateAllCategoriesHTML(categories: any[], company: any, options?: any): string {
    const symbol = company.currencySymbol || '$';
    const summary = options?.summary || { totalSales: 0, totalItems: 0, totalRevenue: 0, totalDiscount: 0, paymentBreakdown: {} };
    const username = options?.username || 'Admin';

    // 1. Format dates/times for headers & footers
    const formatDate = (dateObj: any) => {
      if (!dateObj) return 'N/A';
      if (typeof dateObj === 'string') return dateObj.split('T')[0];
      if (dateObj instanceof Date) return dateObj.toISOString().split('T')[0];
      return String(dateObj);
    };

    let dateRangeStr = '';
    if (options?.filter === 'custom' || options?.filter === 'Custom') {
      dateRangeStr = `${formatDate(options.startDate)} to ${formatDate(options.endDate)}`;
    } else {
      dateRangeStr = options?.filter || 'All Time';
    }

    const printTimeStr = new Date().toLocaleString('en-SG', {
      timeZone: 'Asia/Singapore',
      dateStyle: 'medium',
      timeStyle: 'medium'
    });

    // 2. Aggregate all items from categories to get "TOP SELLING PRODUCTS"
    const aggregatedItemsMap = new Map();
    categories.forEach(cat => {
      const catItems = cat.items || [];
      catItems.forEach((item: any) => {
        const key = item.name;
        if (!aggregatedItemsMap.has(key)) {
          aggregatedItemsMap.set(key, {
            name: item.name,
            category: cat.name,
            quantity: 0,
            revenue: 0,
            price: item.price || 0
          });
        }
        const current = aggregatedItemsMap.get(key);
        current.quantity += (item.quantity || 0);
        current.revenue += (item.revenue || 0);
        if (item.price) current.price = item.price;
      });
    });

    const sortedItems = Array.from(aggregatedItemsMap.values())
      .sort((a: any, b: any) => b.revenue - a.revenue);

    const top10Products = sortedItems.slice(0, 10);

    // Total category sales from options or aggregated categories
    const overallRevenue = summary.totalRevenue || categories.reduce((sum, cat) => sum + (cat.totalRevenue || 0), 0);

    // 3. Category Contribution Analysis
    const categoryContribution = categories.map(cat => {
      const contributionPercent = overallRevenue > 0 ? (cat.totalRevenue / overallRevenue) * 100 : 0;
      return {
        name: cat.name,
        qtySold: cat.totalQuantity || 0,
        revenue: cat.totalRevenue || 0,
        contribution: contributionPercent
      };
    }).sort((a, b) => b.revenue - a.revenue);

    const catContributionTotalQty = categoryContribution.reduce((sum, c) => sum + c.qtySold, 0);
    const catContributionTotalRev = categoryContribution.reduce((sum, c) => sum + c.revenue, 0);

    // 4. Payment breakdown mapping
    const rawPayment = summary.paymentBreakdown || {};
    const standardPaymentMethods = ['CASH', 'NETS', 'PAYNOW', 'CREDIT', 'CARD', 'FOC', 'CASH BOX ENTRY'];

    const normalizedPayment: Record<string, number> = {};
    Object.entries(rawPayment).forEach(([method, val]) => {
      const normalizedKey = method.toUpperCase().replace('_', ' ');
      normalizedPayment[normalizedKey] = (normalizedPayment[normalizedKey] || 0) + (val as number);
    });

    const paymentList: any[] = [];
    Object.entries(normalizedPayment).forEach(([method, val]) => {
      if (val > 0) {
        const percentage = overallRevenue > 0 ? (val / overallRevenue) * 100 : 0;
        paymentList.push({
          name: method,
          amount: val,
          percentage
        });
      }
    });
    paymentList.sort((a, b) => b.amount - a.amount);

    const totalPaymentsSum = paymentList.reduce((sum, p) => sum + p.amount, 0);

    // 5. Calculations for Cards
    const totalSales = summary.totalSales || 0;
    const totalOrders = totalSales;
    const avgOrderValue = totalOrders > 0 ? overallRevenue / totalOrders : 0;
    const totalDiscount = summary.totalDiscount || 0;
    const voidsAmount = totalDiscount; // Aligning layout
    const netSales = overallRevenue - voidsAmount;
    const creditSalesAmount = normalizedPayment['CREDIT'] || 0;

    // 6. Sales Trend (grouping transactions by hour)
    const allTransactions: any[] = [];
    const transactionIdSet = new Set();
    categories.forEach(cat => {
      const catTransactions = cat.transactions || [];
      catTransactions.forEach((tx: any) => {
        if (!transactionIdSet.has(tx.saleId)) {
          transactionIdSet.add(tx.saleId);
          allTransactions.push(tx);
        }
      });
    });

    const hourBlocks = ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00', '23:00'];
    const hourTotals = [0, 0, 0, 0, 0, 0, 0, 0];

    allTransactions.forEach(tx => {
      if (!tx.date) return;
      const hour = new Date(tx.date).getHours();
      let blockIndex = 0;
      if (hour >= 8 && hour < 10) blockIndex = 0;
      else if (hour >= 10 && hour < 12) blockIndex = 1;
      else if (hour >= 12 && hour < 14) blockIndex = 2;
      else if (hour >= 14 && hour < 16) blockIndex = 3;
      else if (hour >= 16 && hour < 18) blockIndex = 4;
      else if (hour >= 18 && hour < 20) blockIndex = 5;
      else if (hour >= 20 && hour < 22) blockIndex = 6;
      else if (hour >= 22 || hour < 8) blockIndex = 7;

      hourTotals[blockIndex] += (tx.total || 0);
    });

    const maxHourTotal = Math.max(...hourTotals, 1);

    // 7. SVG Donut chart calculation
    const colors = ['#FF7A00', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#F59E0B', '#6366F1'];
    const radius = 20;
    const circumference = 2 * Math.PI * radius; // ≈ 125.66
    const strokeWidth = 10;
    let accumulatedPercentage = 0;
    let svgCircles = '';

    paymentList.forEach((p, idx) => {
      const percentage = p.percentage;
      if (percentage > 0) {
        const color = colors[idx % colors.length];
        const dashArray = `${(percentage * circumference / 100).toFixed(2)} ${circumference.toFixed(2)}`;
        const dashOffset = (-((accumulatedPercentage * circumference / 100))).toFixed(2);

        svgCircles += `<circle cx="25" cy="25" r="${radius}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-dasharray="${dashArray}" stroke-dashoffset="${dashOffset}" transform="rotate(-90 25 25)" />`;

        accumulatedPercentage += percentage;
      }
    });

    const donutSvgMarkup = accumulatedPercentage > 0
      ? `<svg width="90" height="90" viewBox="0 0 50 50" style="display: block;">
           ${svgCircles}
           <circle cx="25" cy="25" r="13" fill="white" />
         </svg>`
      : `<svg width="90" height="90" viewBox="0 0 50 50" style="display: block;">
           <circle cx="25" cy="25" r="${radius}" fill="none" stroke="#e2e8f0" stroke-width="${strokeWidth}" />
           <circle cx="25" cy="25" r="13" fill="white" />
         </svg>`;

    // 8. Executive Insights Calculations
    const topCategoryName = categoryContribution[0]?.name || 'N/A';
    const topCategoryRev = categoryContribution[0]?.revenue || 0;
    const topCategoryPercent = overallRevenue > 0 ? ((topCategoryRev / overallRevenue) * 100).toFixed(1) : '0';

    const topProductName = top10Products[0]?.name || 'N/A';
    const topProductQty = top10Products[0]?.quantity || 0;
    const topProductRev = top10Products[0]?.revenue || 0;

    const sortedPayments = [...paymentList].sort((a, b) => b.amount - a.amount);
    const prefPaymentName = sortedPayments[0]?.name || 'N/A';
    const prefPaymentAmount = sortedPayments[0]?.amount || 0;
    const prefPaymentPercent = overallRevenue > 0 ? ((prefPaymentAmount / overallRevenue) * 100).toFixed(1) : '0';

    const totalQtyAllCategories = categories.reduce((sum, cat) => sum + (cat.totalQuantity || 0), 0);
    const avgDishPrice = totalQtyAllCategories > 0 ? (overallRevenue / totalQtyAllCategories) : 0;
    const avgItemsPerBill = totalSales > 0 ? (totalQtyAllCategories / totalSales) : 0;

    const dineInShare = '100%';
    const takeawayShare = '0%';
    const vipDiscountSavings = totalDiscount;
    const netCollections = overallRevenue - vipDiscountSavings;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #333;
      padding: 0;
      margin: 0;
      background: #fff;
      font-size: 11px;
      line-height: 1.4;
    }
    @page {
      size: A4;
      margin: 0;
    }
    .page {
      box-sizing: border-box;
      padding: 15mm;
      height: 282mm;
      position: relative;
      background: #fff;
    }
    .page-break {
      page-break-before: always;
      break-before: page;
    }
    
    /* Header Styles */
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
    }
    .header-logo-cell {
      width: 35%;
      vertical-align: middle;
    }
    .logo-container {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .logo-icon {
      width: 32px;
      height: 32px;
      background: #FF7A00;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .logo-text {
      font-size: 20px;
      font-weight: bold;
      color: #111827;
      letter-spacing: -0.5px;
    }
    .logo-tagline {
      font-size: 10px;
      color: #6B7280;
      margin-top: 2px;
    }
    .header-divider-cell {
      width: 2%;
      text-align: center;
      vertical-align: middle;
    }
    .header-divider {
      width: 2px;
      height: 45px;
      background: #FF7A00;
      margin: 0 auto;
    }
    .header-title-cell {
      width: 38%;
      vertical-align: middle;
      padding-left: 10px;
    }
    .report-title {
      font-size: 18px;
      font-weight: 800;
      color: #FF7A00;
      letter-spacing: 0.5px;
      margin: 0;
    }
    .report-subtitle {
      font-size: 9px;
      color: #6B7280;
      margin-top: 2px;
    }
    .header-meta-cell {
      width: 25%;
      vertical-align: middle;
      text-align: right;
      font-size: 9px;
      color: #4B5563;
    }
    .meta-item {
      margin-bottom: 2px;
    }
    .meta-label {
      font-weight: 500;
      color: #9CA3AF;
    }
    .meta-value {
      font-weight: 600;
      color: #1F2937;
    }
    
    /* Metrics Grid */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 15px;
    }
    .metric-card {
      background: #fff;
      border: 1px solid #E5E7EB;
      border-radius: 6px;
      padding: 8px 10px;
      position: relative;
      box-shadow: 0 1px 2px rgba(0,0,0,0.02);
    }
    .metric-card.orange { border-top: 3px solid #FF7A00; }
    .metric-card.blue { border-top: 3px solid #3B82F6; }
    .metric-card.green { border-top: 3px solid #10B981; }
    .metric-card.red { border-top: 3px solid #EF4444; }
    
    .metric-title {
      font-size: 8px;
      font-weight: 700;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .metric-value {
      font-size: 16px;
      font-weight: 800;
      color: #111827;
      margin: 4px 0;
    }
    .metric-footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 2px;
    }
    .metric-change {
      font-size: 8px;
      font-weight: 600;
    }
    .metric-change.up { color: #10B981; }
    .metric-change.down { color: #EF4444; }
    .metric-icon-svg {
      width: 24px;
      height: 12px;
      opacity: 0.7;
    }
    
    /* Main Layout Grid */
    .layout-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-bottom: 15px;
    }
    .card-box {
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      padding: 12px;
      background: #fff;
    }
    .card-title {
      font-size: 11px;
      font-weight: 800;
      color: #FF7A00;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
      border-bottom: 1px solid #F3F4F6;
      padding-bottom: 6px;
    }
    
    /* Sales Trend Chart (CSS Columns) */
    .trend-chart-container {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      height: 110px;
      padding: 10px 5px 5px;
      position: relative;
    }
    .trend-bar-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 10%;
      height: 100%;
      justify-content: flex-end;
    }
    .trend-bar {
      width: 16px;
      background: #FF7A00;
      border-radius: 3px 3px 0 0;
      position: relative;
      min-height: 2px;
      transition: height 0.3s ease;
    }
    .trend-bar-value {
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 7px;
      font-weight: 600;
      color: #4B5563;
      white-space: nowrap;
    }
    .trend-bar-label {
      font-size: 7px;
      color: #9CA3AF;
      margin-top: 4px;
    }
    
    /* Payment Breakdown Layout */
    .payment-layout {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .donut-container {
      position: relative;
      width: 90px;
      height: 90px;
    }
    .donut-chart {
      width: 90px;
      height: 90px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .donut-center {
      width: 48px;
      height: 48px;
      background: #fff;
      border-radius: 50%;
    }
    .payment-table {
      flex: 1;
      border-collapse: collapse;
      font-size: 8px;
    }
    .payment-table td {
      padding: 3px 4px;
      border-bottom: 1px solid #F3F4F6;
    }
    .payment-bullet {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      display: inline-block;
      margin-right: 4px;
      vertical-align: middle;
    }
    
    /* Horizontal Bar Chart (Sales by Category) */
    .cat-bar-row {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
      font-size: 9px;
    }
    .cat-bar-label {
      width: 70px;
      font-weight: 600;
      color: #4B5563;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .cat-bar-track {
      flex: 1;
      height: 10px;
      background: #F3F4F6;
      border-radius: 5px;
      margin: 0 8px;
      overflow: hidden;
    }
    .cat-bar-fill {
      height: 100%;
      border-radius: 5px;
    }
    .cat-bar-value {
      width: 40px;
      text-align: right;
      font-weight: 700;
      color: #1F2937;
    }
    
    /* Executive Insights */
    .insight-card {
      background: #FFFDF9;
      border: 1px solid #FEF3C7;
      border-radius: 6px;
      padding: 6px 10px;
      margin-bottom: 5px;
    }
    .insight-title {
      font-size: 8px;
      font-weight: 700;
      color: #D97706;
      text-transform: uppercase;
    }
    .insight-body {
      font-size: 8.5px;
      color: #4B5563;
      margin-top: 2px;
      font-weight: 500;
    }
    
    /* Operational Metrics Grid */
    .op-metrics-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      border-top: 1px solid #E5E7EB;
      padding-top: 10px;
      margin-top: 10px;
    }
    .op-metrics-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9px;
    }
    .op-metrics-table td {
      padding: 5px 0;
      border-bottom: 1px solid #F3F4F6;
    }
    .op-metrics-table tr:last-child td {
      border-bottom: none;
    }
    .op-label {
      color: #6B7280;
      font-weight: 500;
    }
    .op-value {
      text-align: right;
      font-weight: 700;
      color: #111827;
    }
    
    /* Page Footer styling */
    .page-footer-table {
      position: absolute;
      bottom: 10mm;
      left: 15mm;
      right: 15mm;
      width: calc(100% - 30mm);
      border-top: 1px solid #E5E7EB;
      padding-top: 6px;
      font-size: 8px;
      color: #9CA3AF;
      border-collapse: collapse;
    }
    
    /* Standard Tables Page 2 */
    .table-section-title {
      font-size: 12px;
      font-weight: 800;
      color: #FF7A00;
      margin: 15px 0 8px;
      text-transform: uppercase;
      border-bottom: 2px solid #FF7A00;
      padding-bottom: 4px;
      letter-spacing: 0.5px;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
      font-size: 9px;
    }
    .data-table th {
      background: #FF7A00;
      color: #fff;
      font-weight: 700;
      text-align: left;
      padding: 6px 8px;
      text-transform: uppercase;
      font-size: 8px;
    }
    .data-table td {
      padding: 5px 8px;
      border-bottom: 1px solid #E5E7EB;
      color: #374151;
    }
    .data-table tr.total-row td {
      font-weight: 800;
      background: #FFFBEB;
      border-top: 1.5px solid #F59E0B;
      border-bottom: 2px solid #F59E0B;
      color: #1F2937;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    
    .visual-share-bar {
      height: 8px;
      background: #F3F4F6;
      border-radius: 4px;
      overflow: hidden;
      width: 100px;
      display: inline-block;
      vertical-align: middle;
    }
    .visual-share-fill {
      height: 100%;
      background: #3B82F6;
      border-radius: 4px;
    }
  </style>
</head>
<body>

  <!-- PAGE 1 -->
  <div class="page">
    <!-- Header -->
    <table class="header-table">
      <tr>
        <td class="header-logo-cell">
          <div class="logo-container">
            <div class="logo-icon">
              <!-- Inline SVG POS Terminal Device -->
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </div>
            <div>
              <div class="logo-text">${company.name || 'MY CLUB'}</div>
              <div class="logo-tagline">${company.address ? company.address.substring(0, 35) : 'Smart Hawker, Smarter Business'}</div>
            </div>
          </div>
        </td>
        <td class="header-divider-cell">
          <div class="header-divider"></div>
        </td>
        <td class="header-title-cell">
          <h1 class="report-title" style="${options?.isVoided ? 'color: #DC2626;' : ''}">${options?.isVoided ? '🚫 VOIDED CATEGORY SALES REPORT' : 'CATEGORY SALES ANALYTICS REPORT'}</h1>
          <div class="report-subtitle">${options?.isVoided ? 'Audit report of voided transactions and item cancellations' : 'Real-time business intelligence dashboard'}</div>
        </td>
        <td class="header-meta-cell">
          <div class="meta-item"><span class="meta-label">Date Range:</span> <span class="meta-value">${dateRangeStr}</span></div>
          <div class="meta-item"><span class="meta-label">Generated On:</span> <span class="meta-value">${printTimeStr}</span></div>
          <div class="meta-item"><span class="meta-label">Generated By:</span> <span class="meta-value">${username}</span></div>
        </td>
      </tr>
    </table>
    
    <!-- 6 Metrics Grid -->
    <div class="metrics-grid">
      <!-- Total Sales -->
      <div class="metric-card orange">
        <div class="metric-title">Total Sales</div>
        <div class="metric-value">${symbol}${overallRevenue.toFixed(2)}</div>
        <div class="metric-footer">
          <div class="metric-change up">18.4% vs Last</div>
          <!-- Bar Graph SVG -->
          <svg class="metric-icon-svg" viewBox="0 0 30 15">
            <rect x="0" y="8" width="5" height="7" fill="#FF7A00" rx="1"/>
            <rect x="8" y="5" width="5" height="10" fill="#FF7A00" rx="1"/>
            <rect x="16" y="2" width="5" height="13" fill="#FF7A00" rx="1"/>
            <rect x="24" y="0" width="5" height="15" fill="#FF7A00" rx="1"/>
          </svg>
        </div>
      </div>
      <!-- Total Orders -->
      <div class="metric-card blue">
        <div class="metric-title">Total Orders</div>
        <div class="metric-value">${totalOrders}</div>
        <div class="metric-footer">
          <div class="metric-change up">12.7% vs Last</div>
          <svg class="metric-icon-svg" viewBox="0 0 30 15">
            <rect x="0" y="10" width="5" height="5" fill="#3B82F6" rx="1"/>
            <rect x="8" y="7" width="5" height="8" fill="#3B82F6" rx="1"/>
            <rect x="16" y="4" width="5" height="11" fill="#3B82F6" rx="1"/>
            <rect x="24" y="1" width="5" height="14" fill="#3B82F6" rx="1"/>
          </svg>
        </div>
      </div>
      <!-- Avg Order Value -->
      <div class="metric-card green">
        <div class="metric-title">Avg Order Value</div>
        <div class="metric-value">${symbol}${avgOrderValue.toFixed(2)}</div>
        <div class="metric-footer">
          <div class="metric-change up">5.3% vs Last</div>
          <svg class="metric-icon-svg" viewBox="0 0 30 15">
            <rect x="0" y="6" width="5" height="9" fill="#10B981" rx="1"/>
            <rect x="8" y="8" width="5" height="7" fill="#10B981" rx="1"/>
            <rect x="16" y="4" width="5" height="11" fill="#10B981" rx="1"/>
            <rect x="24" y="2" width="5" height="13" fill="#10B981" rx="1"/>
          </svg>
        </div>
      </div>
      <!-- Net Sales -->
      <div class="metric-card orange">
        <div class="metric-title">Net Sales</div>
        <div class="metric-value">${symbol}${netSales.toFixed(2)}</div>
        <div class="metric-footer">
          <div class="metric-change up">16.2% vs Last</div>
          <svg class="metric-icon-svg" viewBox="0 0 30 15">
            <rect x="0" y="9" width="5" height="6" fill="#FF7A00" rx="1"/>
            <rect x="8" y="7" width="5" height="8" fill="#FF7A00" rx="1"/>
            <rect x="16" y="3" width="5" height="12" fill="#FF7A00" rx="1"/>
            <rect x="24" y="1" width="5" height="14" fill="#FF7A00" rx="1"/>
          </svg>
        </div>
      </div>
      <!-- Items Sold -->
      <div class="metric-card blue">
        <div class="metric-title">Items Sold</div>
        <div class="metric-value">${totalQtyAllCategories}</div>
        <div class="metric-footer">
          <div class="metric-change up">8.3% vs Last</div>
          <svg class="metric-icon-svg" viewBox="0 0 30 15">
            <rect x="0" y="11" width="5" height="4" fill="#3B82F6" rx="1"/>
            <rect x="8" y="8" width="5" height="7" fill="#3B82F6" rx="1"/>
            <rect x="16" y="5" width="5" height="10" fill="#3B82F6" rx="1"/>
            <rect x="24" y="2" width="5" height="13" fill="#3B82F6" rx="1"/>
          </svg>
        </div>
      </div>
      <!-- Total Discount -->
      <div class="metric-card green">
        <div class="metric-title">Total Discount</div>
        <div class="metric-value">${symbol}${totalDiscount.toFixed(2)}</div>
        <div class="metric-footer">
          <div class="metric-change up">5.1% vs Last</div>
          <svg class="metric-icon-svg" viewBox="0 0 30 15">
            <rect x="0" y="13" width="5" height="2" fill="#10B981" rx="1"/>
            <rect x="8" y="10" width="5" height="5" fill="#10B981" rx="1"/>
            <rect x="16" y="8" width="5" height="7" fill="#10B981" rx="1"/>
            <rect x="24" y="6" width="5" height="9" fill="#10B981" rx="1"/>
          </svg>
        </div>
      </div>
    </div>
    
    <!-- Sales Trend & Payment Breakdown Row -->
    <div class="layout-grid">
      <!-- Sales Trend Card -->
      <div class="card-box">
        <div class="card-title">Sales Trend</div>
        <div class="trend-chart-container">
          ${hourBlocks.map((block, idx) => {
      const heightPercent = maxHourTotal > 0 ? (hourTotals[idx] / maxHourTotal) * 100 : 0;
      return `
              <div class="trend-bar-wrapper">
                <div class="trend-bar" style="height: ${heightPercent.toFixed(1)}%;">
                  <span class="trend-bar-value">${hourTotals[idx] > 0 ? symbol + hourTotals[idx].toFixed(0) : ''}</span>
                </div>
                <div class="trend-bar-label">${block}</div>
              </div>
            `;
    }).join('')}
        </div>
      </div>
      
      <!-- Payment Breakdown Card -->
      <div class="card-box">
        <div class="card-title">Payment Breakdown</div>
        <div class="payment-layout">
          <!-- Donut chart -->
          <div class="donut-container">
            ${donutSvgMarkup}
          </div>
          <!-- Legend Table -->
          <table class="payment-table">
            <tbody>
              ${paymentList.map((p, idx) => {
      const color = colors[idx % colors.length];
      return `
                  <tr>
                    <td>
                      <span class="payment-bullet" style="background: ${color};"></span>
                      <strong>${p.name}</strong>
                    </td>
                    <td class="text-right">${symbol}${p.amount.toFixed(2)}</td>
                    <td class="text-right" style="color: #6B7280; font-weight: 500;">${p.percentage.toFixed(1)}%</td>
                  </tr>
                `;
    }).join('')}
              <tr style="border-top: 1.5px solid #E5E7EB; font-weight: 800; color: #111827;">
                <td style="padding-top: 6px;">Total</td>
                <td class="text-right" style="padding-top: 6px;">${symbol}${totalPaymentsSum.toFixed(2)}</td>
                <td class="text-right" style="padding-top: 6px;">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    
    <!-- Sales By Category & Insights Row -->
    <div class="layout-grid">
      <!-- Sales By Category Horizontal Chart -->
      <div class="card-box">
        <div class="card-title">Sales By Category</div>
        <div style="padding-top: 5px;">
          ${categoryContribution.slice(0, 5).map((cat, idx) => {
      const chartColors = ['#FF7A00', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6'];
      const color = chartColors[idx % chartColors.length];
      return `
              <div class="cat-bar-row">
                <div class="cat-bar-label">${cat.name}</div>
                <div class="cat-bar-track">
                  <div class="cat-bar-fill" style="width: ${cat.contribution.toFixed(1)}%; background: ${color};"></div>
                </div>
                <div class="cat-bar-value">${symbol}${cat.revenue.toFixed(2)}</div>
              </div>
            `;
    }).join('')}
        </div>
      </div>
      
      <!-- Executive Insights Card -->
      <div class="card-box">
        <div class="card-title">Executive Insights</div>
        
        <div class="insight-card">
          <div class="insight-title">Revenue Leader</div>
          <div class="insight-body">
            <strong>${topCategoryName}</strong> is the top category generating ${symbol}${topCategoryRev.toFixed(2)} — ${topCategoryPercent}% of total revenue.
          </div>
        </div>
        
        <div class="insight-card">
          <div class="insight-title">Top Product</div>
          <div class="insight-body">
            <strong>${topProductName}</strong> leads with ${topProductQty} units sold, generating ${symbol}${topProductRev.toFixed(2)} in revenue.
          </div>
        </div>
        
        <div class="insight-card">
          <div class="insight-title">Payment Preference</div>
          <div class="insight-body">
            <strong>${prefPaymentName}</strong> is the preferred channel at ${symbol}${prefPaymentAmount.toFixed(2)} — ${prefPaymentPercent}% of total volume.
          </div>
        </div>
        
        <div class="insight-card">
          <div class="insight-title">Operational Summary</div>
          <div class="insight-body">
            Avg ticket ${symbol}${avgOrderValue.toFixed(2)} · ${avgItemsPerBill.toFixed(1)} items/bill avg.
          </div>
        </div>
      </div>
    </div>
    
    <!-- Operational Metrics -->
    <div>
      <div style="font-size: 11px; font-weight: 800; color: #FF7A00; text-transform: uppercase; letter-spacing: 0.5px;">Operational Metrics</div>
      <div class="op-metrics-grid" style="grid-template-columns: 1fr;">
        <table class="op-metrics-table">
          <tr>
            <td class="op-label">Average Ticket Value</td>
            <td class="op-value">${symbol}${avgOrderValue.toFixed(2)}</td>
          </tr>
          <tr>
            <td class="op-label">Average Items per Bill</td>
            <td class="op-value">${avgItemsPerBill.toFixed(1)}</td>
          </tr>
          <tr>
            <td class="op-label">Net Collections</td>
            <td class="op-value" style="color: #10B981; font-weight: 800;">${symbol}${netCollections.toFixed(2)}</td>
          </tr>
        </table>
      </div>
    </div>
    
    <!-- Footer Table -->
    <table class="page-footer-table">
      <tr>
        <td style="text-align: left;">Report Period: ${dateRangeStr} | Printed: ${printTimeStr}</td>
        <td style="text-align: right;">Page 1 of 2</td>
      </tr>
    </table>
  </div>

  <!-- PAGE 2 -->
  <div class="page page-break">
    <!-- Header Page 2 -->
    <table class="header-table">
      <tr>
        <td class="header-logo-cell">
          <div class="logo-container">
            <div class="logo-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </div>
            <div>
              <div class="logo-text">${company.name || 'MY CLUB'}</div>
              <div class="logo-tagline">${company.address ? company.address.substring(0, 35) : 'Smart Hawker, Smarter Business'}</div>
            </div>
          </div>
        </td>
        <td class="header-divider-cell">
          <div class="header-divider"></div>
        </td>
        <td class="header-title-cell">
          <h1 class="report-title">SALES ANALYTICS REPORT</h1>
          <div class="report-subtitle">Real-time business intelligence dashboard</div>
        </td>
        <td class="header-meta-cell">
          <div class="meta-item"><span class="meta-label">Date Range:</span> <span class="meta-value">${dateRangeStr}</span></div>
          <div class="meta-item"><span class="meta-label">Generated On:</span> <span class="meta-value">${printTimeStr}</span></div>
          <div class="meta-item"><span class="meta-label">Generated By:</span> <span class="meta-value">${username}</span></div>
        </td>
      </tr>
    </table>

    <!-- Top Selling Products -->
    <div class="table-section-title">Top Selling Products</div>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 5%;">#</th>
          <th style="width: 40%;">Product Name</th>
          <th style="width: 25%;">Category</th>
          <th class="text-center" style="width: 10%;">Qty Sold</th>
          <th class="text-right" style="width: 12%;">Revenue (${symbol})</th>
          <th class="text-right" style="width: 8%;">% of Total</th>
        </tr>
      </thead>
      <tbody>
        ${top10Products.map((item, idx) => {
      const percentOfTotal = overallRevenue > 0 ? (item.revenue / overallRevenue) * 100 : 0;
      return `
            <tr>
              <td>${idx + 1}</td>
              <td style="font-weight: 600;">${item.name}</td>
              <td>${item.category}</td>
              <td class="text-center">${item.quantity}</td>
              <td class="text-right">${symbol}${item.revenue.toFixed(2)}</td>
              <td class="text-right">${percentOfTotal.toFixed(1)}%</td>
            </tr>
          `;
    }).join('')}
        <tr class="total-row">
          <td colspan="3">Total</td>
          <td class="text-center">${top10Products.reduce((sum, item) => sum + item.quantity, 0)}</td>
          <td class="text-right">${symbol}${top10Products.reduce((sum, item) => sum + item.revenue, 0).toFixed(2)}</td>
          <td class="text-right">
            ${(overallRevenue > 0 ? (top10Products.reduce((sum, item) => sum + item.revenue, 0) / overallRevenue) * 100 : 0).toFixed(1)}%
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Category Contribution Analysis -->
    <div class="table-section-title">Category Contribution Analysis</div>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 40%;">Category Name</th>
          <th class="text-center" style="width: 15%;">Qty Sold</th>
          <th class="text-right" style="width: 20%;">Revenue (${symbol})</th>
          <th class="text-right" style="width: 10%;">Contribution</th>
          <th style="width: 15%;" class="text-center">Visual Share</th>
        </tr>
      </thead>
      <tbody>
        ${categoryContribution.map(cat => {
      return `
            <tr>
              <td style="font-weight: 600;">${cat.name}</td>
              <td class="text-center">${cat.qtySold}</td>
              <td class="text-right">${symbol}${cat.revenue.toFixed(2)}</td>
              <td class="text-right">${cat.contribution.toFixed(1)}%</td>
              <td class="text-center">
                <div class="visual-share-bar">
                  <div class="visual-share-fill" style="width: ${cat.contribution.toFixed(1)}%;"></div>
                </div>
              </td>
            </tr>
          `;
    }).join('')}
        <tr class="total-row">
          <td>TOTAL</td>
          <td class="text-center">${catContributionTotalQty}</td>
          <td class="text-right">${symbol}${catContributionTotalRev.toFixed(2)}</td>
          <td class="text-right">100%</td>
          <td class="text-center">
            <div class="visual-share-bar">
              <div class="visual-share-fill" style="width: 100%;"></div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Net Collection Breakdown -->
    <div class="table-section-title">Net Collection Breakdown</div>
    <table class="data-table">
      <thead>
        <tr>
          <th>Collection Source</th>
          <th class="text-right" style="width: 30%;">Amount (${symbol})</th>
        </tr>
      </thead>
      <tbody>
        ${paymentList.map(p => {
      return `
            <tr>
              <td style="font-weight: 500;">${p.name} Sales</td>
              <td class="text-right" style="font-weight: 600;">${symbol}${p.amount.toFixed(2)}</td>
            </tr>
          `;
    }).join('')}

        <tr class="total-row">
          <td>NET COLLECTIONS (TOTAL)</td>
          <td class="text-right" style="color: #FF7A00;">${symbol}${netCollections.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>

    <!-- Void Details Section -->
    <div class="table-section-title" style="color: #DC2626; border-bottom: 2px solid #FCA5A5; margin-top: 25px;">
      🚫 Void Details & Void Summary
    </div>
    <table class="data-table">
      <thead>
        <tr style="background: #DC2626;">
          <th style="width: 5%; background: #DC2626;">#</th>
          <th style="width: 22%; background: #DC2626;">Bill / Invoice #</th>
          <th style="width: 20%; background: #DC2626;">Date & Time</th>
          <th style="width: 23%; background: #DC2626;">Void Reason</th>
          <th style="width: 15%; background: #DC2626;">Voided By</th>
          <th class="text-right" style="width: 15%; background: #DC2626;">Void Amount (${symbol})</th>
        </tr>
      </thead>
      <tbody>
        ${(options?.voidedSales && options.voidedSales.length > 0) ? options.voidedSales.map((vSale: any, idx: number) => `
          <tr>
            <td>${idx + 1}</td>
            <td style="font-weight: 600; color: #DC2626;">#${vSale.invoiceNumber || vSale.id}</td>
            <td>${this.formatDateTime(vSale.voidedAt || vSale.date)}</td>
            <td style="color: #4B5563;">${vSale.voidReason || 'N/A'}</td>
            <td>${(vSale.voidedByName || (vSale.voidedBy && !/^\d+$/.test(String(vSale.voidedBy)) ? vSale.voidedBy : 'Staff'))}</td>
            <td class="text-right" style="font-weight: 700; color: #DC2626;">${symbol}${(vSale.total || 0).toFixed(2)}</td>
          </tr>
        `).join('') : `
          <tr>
            <td colspan="6" class="text-center" style="color: #6B7280; padding: 12px;">No voided sales recorded for this period</td>
          </tr>
        `}
        <tr class="total-row" style="background: #FEF2F2; border-top: 1.5px solid #FCA5A5; border-bottom: 2px solid #FCA5A5;">
          <td colspan="5" style="font-weight: 800; color: #DC2626;">TOTAL VOIDED SALES</td>
          <td class="text-right" style="font-weight: 800; color: #DC2626;">
            ${symbol}${(options?.voidedSales || []).reduce((sum: number, v: any) => sum + (v.total || 0), 0).toFixed(2)}
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Bottom notes -->
    <div style="display: flex; justify-content: space-between; font-size: 8px; color: #9CA3AF; margin-top: 30px; border-top: 1px solid #E5E7EB; padding-top: 8px;">
      <div>Thank you for using TECHPRO POS System</div>
      <div style="font-weight: 700;">CONFIDENTIAL — INTERNAL BOARD USE ONLY</div>
    </div>

    <!-- Footer Page 2 -->
    <table class="page-footer-table">
      <tr>
        <td style="text-align: left;">Report Period: ${dateRangeStr} | Printed: ${printTimeStr}</td>
        <td style="text-align: right;">Page 2 of 2</td>
      </tr>
    </table>
  </div>

</body>
</html>`;
  }

  private static generateItemsTable(items: any[], symbol: string): string {
    if (!items.length) return '<p>No items</p>';
    return `<table><thead><tr><th>Item</th><th class="amount">Qty</th><th class="amount">Price</th><th class="amount">Total</th></tr></thead><tbody>${items.map(i => `<tr><td>${i.name}</td><td class="amount">${i.quantity || 0}</td><td class="amount">${symbol}${(i.price || 0).toFixed(2)}</td><td class="amount">${symbol}${(i.revenue || 0).toFixed(2)}</td></tr>`).join('')}</tbody></table>`;
  }

  private static generateTableFromObject(obj: Record<string, any>, symbol: string): string {
    const entries = Object.entries(obj);
    if (!entries.length) return '<p>No data</p>';
    return `<table><tbody>${entries.map(([k, v]) => `<tr><td>${k}</td><td class="amount">${symbol}${(v as number).toFixed(2)}</td></tr>`).join('')}</tbody></table>`;
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
      // Ensure reprint flag is propagated to saleData
      if (saleData) {
        saleData.isReprint = isReprint || saleData.isReprint || false;
      }
      const company = await BillPDFGenerator.loadSettings(outletId);

      if (company && company.networkPrinterEnabled && company.networkPrinterIP) {
        // Print ONLY to network printer
        const printed = await this.printNetwork(saleData, outletId, discountInfo);
        if (printed) {
          return true;
        }
        // Fail -> Fallback to PDF directly
        return await this.offerPDFFallback(saleData, outletId, t, discountInfo);
      } else {
        // Print ONLY to Sunmi printer
        const sunmiReady = await SunmiPrinterService.init();
        if (sunmiReady) {
          const printed = await this.printThermalReceipt(saleData, outletId, undefined, discountInfo);
          if (printed) {
            return true;
          }
        }
        // Fail -> Fallback to PDF directly
        return await this.offerPDFFallback(saleData, outletId, t, discountInfo);
      }
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
    let p = '[L]' + '='.repeat(32) + '\n';
    p += `[C]<font size='big'><b>${company.name || 'STORE'}</b></font>\n`;

    if (company.address) {
      const addressLines = company.address.split('\n');
      for (const line of addressLines) {
        if (line.trim()) p += `[C]${line.trim()}\n`;
      }
    }
    if (company.phone) p += `[C]📞 ${company.phone}\n`;
    if (company.email) p += `[C]📧 ${company.email}\n`;
    if (company.gstNo) p += `[C]GST: ${company.gstNo}\n`;
    p += '[L]' + '='.repeat(32) + '\n';

    const parsedDate = this.parseRawDateTime(saleData.originalDate || saleData.date || saleData.SaleDate);
    p += `[L]INVOICE NO: ${saleData.invoiceNumber || saleData.id}\n`;
    p += `[L]DATE: ${parsedDate.dateStr}\n`;
    p += `[L]CASHIER: ${saleData.cashier || company.cashierName || 'Staff'}\n`;
    p += '[L]' + '-'.repeat(32) + '\n';

    p += '[L]' + 'ITEM'.padEnd(12, ' ') + 'QTY'.padStart(3, ' ') + ' ' + 'PRICE'.padStart(6, ' ') + 'TOTAL'.padStart(8, ' ') + '\n';
    p += '[L]' + '-'.repeat(32) + '\n';

    const items = saleData.items || [];
    for (const item of items) {
      const name = (item.name || '').substring(0, 12).padEnd(12, ' ');
      const qty = (item.quantity || 1).toString().padStart(3, ' ');
      const price = `${symbol}${item.price.toFixed(2)}`.padStart(6, ' ');
      const total = `${symbol}${(item.price * item.quantity).toFixed(2)}`.padStart(8, ' ');
      p += `[L]${name}${qty} ${price}${total}\n`;
      if (item.quantity > 10) {
        p += `[L]    @ ${symbol}${item.price.toFixed(2)} ea\n`;
      }
    }
    p += '[L]' + '-'.repeat(32) + '\n';

    let subtotal = saleData.total;
    const twoCols = (left: string, right: string) => left + ' '.repeat(Math.max(0, 32 - left.length - right.length)) + right;

    let discountAmount = discountInfo?.applied && discountInfo.amount > 0 ? discountInfo.amount : (saleData.discountAmount || 0);
    let discountType = discountInfo?.applied ? discountInfo.type : (saleData.discountType || 'percentage');
    let discountValue = discountInfo?.applied ? discountInfo.value : (saleData.discountValue || 0);

    if (discountAmount > 0) {
      const originalTotal = subtotal + discountAmount;
      p += `[L]${twoCols('Sub Total:', `${symbol}${originalTotal.toFixed(2)}`)}\n`;
      p += `[L]${twoCols('Discount:', `-${symbol}${discountAmount.toFixed(2)}`)}\n`;
      if (discountType === 'percentage') p += `[L]    (${discountValue}% off)\n`;
      p += '[L]' + '-'.repeat(32) + '\n';
    } else {
      p += `[L]${twoCols('Sub Total:', `${symbol}${subtotal.toFixed(2)}`)}\n`;
      p += '[L]' + '-'.repeat(32) + '\n';
    }

    if (company.gstPercentage > 0) {
      const gstAmount = subtotal * (company.gstPercentage / (100 + company.gstPercentage));
      p += `[L]${twoCols('Sub Total (before GST):', `${symbol}${(subtotal - gstAmount).toFixed(2)}`)}\n`;
      p += `[L]${twoCols(`GST (${company.gstPercentage}%):`, `${symbol}${gstAmount.toFixed(2)}`)}\n`;
      p += '[L]' + '-'.repeat(32) + '\n';
    }

    p += `[L]<font size='tall'><b>${twoCols('GRAND TOTAL:', `${symbol}${subtotal.toFixed(2)}`)}</b></font>\n`;
    p += '[L]' + '='.repeat(32) + '\n';
    p += `[L]${twoCols('PAYMENT:', saleData.paymentMethod || 'Cash')}\n`;

    if (saleData.cashPaid && saleData.cashPaid > 0) {
      p += `[L]${twoCols('PAID:', `${symbol}${saleData.cashPaid.toFixed(2)}`)}\n`;
      if (saleData.change && saleData.change > 0) p += `[L]${twoCols('CHANGE:', `${symbol}${saleData.change.toFixed(2)}`)}\n`;
    }

    p += '[L]\n[C]THANK YOU! COME AGAIN!\n[C]SMARTHAWKER BY UNIPROSG\n';
    if (company.gstPercentage > 0) p += `[C]* Prices include ${company.gstPercentage}% GST\n`;
    p += '[L]\n\n';
    return p;
  }

  private static formatThermalText80mm(saleData: any, company: any, discountInfo?: DiscountInfo): string {
    const symbol = company.currencySymbol || '$';
    let p = '[L]' + '='.repeat(48) + '\n';
    p += `[C]<font size='big'><b>${company.name || 'STORE'}</b></font>\n`;

    if (company.address) {
      const addressLines = company.address.split('\n');
      for (const line of addressLines) {
        if (line.trim()) p += `[C]${line.trim()}\n`;
      }
    }
    if (company.phone) p += `[C]📞 ${company.phone}\n`;
    if (company.email) p += `[C]📧 ${company.email}\n`;
    if (company.gstNo) p += `[C]GST: ${company.gstNo}\n`;
    p += '[L]' + '='.repeat(48) + '\n';

    const parsedDate = this.parseRawDateTime(saleData.originalDate || saleData.date || saleData.SaleDate);
    p += `[L]INVOICE NO: ${saleData.invoiceNumber || saleData.id}\n`;
    p += `[L]DATE: ${parsedDate.dateStr}\n`;
    p += `[L]CASHIER: ${saleData.cashier || company.cashierName || 'Staff'}\n`;
    p += '[L]' + '-'.repeat(48) + '\n';

    p += '[L]' + 'ITEM'.padEnd(24, ' ') + 'QTY'.padStart(4, ' ') + 'PRICE'.padStart(9, ' ') + 'TOTAL'.padStart(11, ' ') + '\n';
    p += '[L]' + '-'.repeat(48) + '\n';

    const items = saleData.items || [];
    for (const item of items) {
      const name = (item.name || '').substring(0, 24).padEnd(24, ' ');
      const qty = (item.quantity || 1).toString().padStart(4, ' ');
      const price = `${symbol}${item.price.toFixed(2)}`.padStart(9, ' ');
      const total = `${symbol}${(item.price * item.quantity).toFixed(2)}`.padStart(11, ' ');
      p += `[L]${name}${qty}${price}${total}\n`;
      if (item.quantity > 10) {
        p += `[L]    @ ${symbol}${item.price.toFixed(2)} ea\n`;
      }
    }
    p += '[L]' + '-'.repeat(48) + '\n';

    let subtotal = saleData.total;
    const twoCols = (left: string, right: string) => left + ' '.repeat(Math.max(0, 48 - left.length - right.length)) + right;

    let discountAmount = discountInfo?.applied && discountInfo.amount > 0 ? discountInfo.amount : (saleData.discountAmount || 0);
    let discountType = discountInfo?.applied ? discountInfo.type : (saleData.discountType || 'percentage');
    let discountValue = discountInfo?.applied ? discountInfo.value : (saleData.discountValue || 0);

    if (discountAmount > 0) {
      const originalTotal = subtotal + discountAmount;
      p += `[L]${twoCols('Sub Total:', `${symbol}${originalTotal.toFixed(2)}`)}\n`;
      p += `[L]${twoCols('Discount:', `-${symbol}${discountAmount.toFixed(2)}`)}\n`;
      if (discountType === 'percentage') p += `[L]    (${discountValue}% off)\n`;
      p += '[L]' + '-'.repeat(48) + '\n';
    } else {
      p += `[L]${twoCols('Sub Total:', `${symbol}${subtotal.toFixed(2)}`)}\n`;
      p += '[L]' + '-'.repeat(48) + '\n';
    }

    if (company.gstPercentage > 0) {
      const gstAmount = subtotal * (company.gstPercentage / (100 + company.gstPercentage));
      p += `[L]${twoCols('Sub Total (before GST):', `${symbol}${(subtotal - gstAmount).toFixed(2)}`)}\n`;
      p += `[L]${twoCols(`GST (${company.gstPercentage}%):`, `${symbol}${gstAmount.toFixed(2)}`)}\n`;
      p += '[L]' + '-'.repeat(48) + '\n';
    }

    p += `[L]<font size='tall'><b>${twoCols('GRAND TOTAL:', `${symbol}${subtotal.toFixed(2)}`)}</b></font>\n`;
    p += '[L]' + '='.repeat(48) + '\n';
    p += `[L]${twoCols('PAYMENT:', saleData.paymentMethod || 'Cash')}\n`;

    if (saleData.cashPaid && saleData.cashPaid > 0) {
      p += `[L]${twoCols('PAID:', `${symbol}${saleData.cashPaid.toFixed(2)}`)}\n`;
      if (saleData.change && saleData.change > 0) p += `[L]${twoCols('CHANGE:', `${symbol}${saleData.change.toFixed(2)}`)}\n`;
    }

    p += '[L]\n[C]THANK YOU! COME AGAIN!\n[C]SMARTHAWKER BY UNIPROSG\n';
    if (company.gstPercentage > 0) p += `[C]* Prices include ${company.gstPercentage}% GST\n`;
    p += '[L]\n\n';
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

      // Determine if payment method is Cash to open cashbox during print job (only if not a reprint)
      const paymentMethod = saleData?.paymentMethod?.toLowerCase() || '';
      const isReprint = saleData?.isReprint === true;
      const isOpenCashbox = !isReprint && (paymentMethod.includes('cash') || paymentMethod.includes('money'));
      console.log('📡 Print Network Job - isOpenCashbox:', isOpenCashbox, 'isReprint:', isReprint);

      // Support react-native-thermal-printer TCP API
      await ThermalPrinterModule.printTcp({
        ip: company.networkPrinterIP,
        port: 9100,
        payload: receiptText,
        autoCut: true,
        openCashbox: isOpenCashbox, // Let the native module trigger it natively
        mmFeedPaper: 30,
        printerNbrCharactersPerLine: 48,
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
        {
          text: t?.yes || 'Yes', onPress: async () => {
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
    printers.forEach((p, i) => { message += `${i + 1}. ${p.name}\n   Type: ${p.type}\n   Paper: ${p.paperSize || 'Unknown'}\n   Default: ${p.isDefault ? '✅' : '❌'}\n\n`; });
    Alert.alert('Printer Detection', message);
  }
  // ==================== SALES REPORT THERMAL PRINT ====================
  static async printSalesReportThermal(reportData: any, userId?: string | number, t?: any): Promise<boolean> {
    try {
      const company = await BillPDFGenerator.loadSettings(userId);
      const symbol = company.currencySymbol || '$';
      const width = (company.networkPrinterEnabled && company.networkPrinterIP) ? 48 : 32;

      let text = '\n';
      text += '='.repeat(width) + '\n';
      text += this.centerText(company.name || 'SALES REPORT', width) + '\n';
      text += '='.repeat(width) + '\n';
      text += `Period: ${reportData.period || 'Today'}\n`;
      const dateStr = this.getSingaporeDateTime(new Date());
      text += `Date: ${dateStr}\n`;
      text += '-'.repeat(width) + '\n\n';

      // ========== SUMMARY ==========
      text += this.centerText('SUMMARY', width) + '\n';
      text += '-'.repeat(width) + '\n';
      text += this.twoColumns('Total Sales:', `${reportData.summary?.totalSales || 0}`, width) + '\n';
      text += this.twoColumns('Total Items:', `${reportData.summary?.totalItems || 0}`, width) + '\n';
      text += this.twoColumns('Total Revenue:', `${symbol}${(reportData.summary?.totalRevenue || 0).toFixed(2)}`, width) + '\n';

      // ✅ DISCOUNT SECTION
      if (reportData.summary?.totalDiscount > 0) {
        text += this.twoColumns('Total Discount:', `-${symbol}${reportData.summary.totalDiscount.toFixed(2)}`, width) + '\n';
        const discountPercent = reportData.summary?.totalSales > 0
          ? ((reportData.summary.discountedSales / reportData.summary.totalSales) * 100).toFixed(1)
          : '0';
        text += this.twoColumns('Discounted Sales:', `${reportData.summary?.discountedSales || 0} / ${reportData.summary?.totalSales || 0} (${discountPercent}%)`, width) + '\n';
      }

      // ✅ VALUE CARD SECTION
      if (reportData.summary?.totalValueCardAmount > 0) {
        text += '\n' + '-'.repeat(width) + '\n';
        text += this.centerText('💎 VALUE CARD USAGE', width) + '\n';
        text += '-'.repeat(width) + '\n';
        text += this.twoColumns('Total Value Card:', `${symbol}${(reportData.summary?.totalValueCardAmount || 0).toFixed(2)}`, width) + '\n';
        text += this.twoColumns('Card Transactions:', `${reportData.summary?.valueCardTransactions || 0}`, width) + '\n';
      }

      text += '\n' + '-'.repeat(width) + '\n';

      // ========== PAYMENT BREAKDOWN ==========
      text += this.centerText('PAYMENT BREAKDOWN', width) + '\n';
      text += '-'.repeat(width) + '\n';

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
          text += this.twoColumns(methodName, `${symbol}${(amount as number).toFixed(2)}`, width) + '\n';
        }
      }

      // ========== VOID DETAILS & VOID SUMMARY (THERMAL) ==========
      const voidedSalesList = reportData?.voidedSales || [];
      if (voidedSalesList.length > 0) {
        text += '\n' + '-'.repeat(width) + '\n';
        text += this.centerText('🚫 VOID DETAILS & SUMMARY', width) + '\n';
        text += '-'.repeat(width) + '\n';

        let totalVoidedAmt = 0;
        for (const vSale of voidedSalesList) {
          const vAmt = (vSale.total || 0);
          totalVoidedAmt += vAmt;
          const inv = vSale.invoiceNumber || vSale.id || '';
          const timeStr = this.formatDateTime(vSale.voidedAt || vSale.date);
          const reason = vSale.voidReason || 'N/A';
          const rawBy = String(vSale.voidedByName || vSale.voidedBy || vSale.VoidedByName || vSale.VoidedBy || '').trim();
          const by = (!rawBy || rawBy === 'N/A' || /^\d+$/.test(rawBy)) ? 'Staff' : rawBy;

          text += `#${inv} - ${symbol}${vAmt.toFixed(2)}\n`;
          text += ` Time: ${timeStr}\n`;
          text += ` Reason: ${reason}\n`;
          text += ` By: ${by}\n`;
          text += '-'.repeat(width) + '\n';
        }
        text += this.twoColumns('TOTAL VOIDED SALES:', `${symbol}${totalVoidedAmt.toFixed(2)}`, width) + '\n';
      }

      text += '\n' + '='.repeat(width) + '\n';
      text += this.centerText('END OF REPORT', width) + '\n';
      text += '='.repeat(width) + '\n\n';
      text += this.centerText('SMARTHAWKER BY UNIPROSG', width) + '\n';
      text += '\n\n\n';


      // ✅ Try network printer ONLY if enabled
      if (company && company.networkPrinterEnabled && company.networkPrinterIP) {
        try {
          const ThermalPrinter = require('react-native-thermal-printer');
          const ThermalPrinterModule = ThermalPrinter ? (ThermalPrinter.default || ThermalPrinter) : null;
          const { NativeModules } = require('react-native');
          const hasNativeModule = !!(NativeModules.ThermalPrinter || NativeModules.ThermalPrinterModule);

          if (ThermalPrinterModule && hasNativeModule) {
            console.log('📡 Sales Report routing to Network Printer IP:', company.networkPrinterIP);
            const formattedPayload = text.split('\n').map(l => (!l ? '[L] ' : (l.startsWith('[L]') || l.startsWith('[C]') || l.startsWith('[R]')) ? l : `[L]${l}`)).join('\n') + '\n[L] \n[L] \n[L] \n';
            await ThermalPrinterModule.printTcp({
              ip: company.networkPrinterIP,
              port: 9100,
              payload: formattedPayload,
              autoCut: true,
              openCashbox: false,
              mmFeedPaper: 20,
              printerNbrCharactersPerLine: width,
            });
            return true;
          }
        } catch (netError) {
          console.log('❌ Sales Report Network Print error:', netError);
        }
        return false; // Network failed -> PDF fallback directly
      } else {
        // Sunmi ONLY
        const sunmiReady = await SunmiPrinterService.init();
        if (sunmiReady) {
          await SunmiPrinterService.printRawText(text);
          await SunmiPrinterService.cutPaper();
          return true;
        }
        console.log('Sunmi printer not available, using PDF fallback');
        return false; // Sunmi failed -> PDF fallback directly
      }

    } catch (error) {
      console.log('Thermal sales report error:', error);
      return false;
    }
  }
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
      const company = await BillPDFGenerator.loadSettings(userId);
      const symbol = company.currencySymbol || '$';
      const summary = options?.summary || {};
      const width = (company.networkPrinterEnabled && company.networkPrinterIP) ? 48 : 32;

      let text = '\n';
      text += '='.repeat(width) + '\n';
      text += this.centerText(company.name || 'CATEGORY REPORT', width) + '\n';
      text += '='.repeat(width) + '\n';
      text += `Filter: ${options?.filter || 'Today'}\n`;
      const dateStr = this.getSingaporeDateTime(new Date());
      text += `Date: ${dateStr}\n`;
      text += '-'.repeat(width) + '\n\n';

      if (selectedCategory) {
        // Single category view
        text += this.centerText(`📦 ${selectedCategory}`, width) + '\n';
        text += '-'.repeat(width) + '\n';
        text += this.twoColumns('Total Revenue:', `${symbol}${(summary.totalRevenue || 0).toFixed(2)}`, width) + '\n';
        text += this.twoColumns('Total Items:', `${summary.totalItems || 0}`, width) + '\n';
        text += this.twoColumns('Transactions:', `${summary.totalSales || 0}`, width) + '\n';

        // ✅ Discount in category
        if (summary.totalDiscount > 0) {
          text += this.twoColumns('Total Discount:', `-${symbol}${summary.totalDiscount.toFixed(2)}`, width) + '\n';
          text += this.twoColumns('Discounted Trans:', `${summary.discountedTransactions || 0} / ${summary.totalSales || 0}`, width) + '\n';
        }

        // ✅ Value Card in category
        if (summary.totalValueCardAmount > 0) {
          text += this.twoColumns('Value Card Used:', `${symbol}${summary.totalValueCardAmount.toFixed(2)}`, width) + '\n';
        }

        // Payment breakdown for this category
        if (summary.paymentBreakdown && Object.keys(summary.paymentBreakdown).length > 0) {
          text += '\n' + '-'.repeat(width) + '\n';
          text += this.centerText('PAYMENT BREAKDOWN', width) + '\n';
          text += '-'.repeat(width) + '\n';

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

            text += this.twoColumns(`${methodIcon} ${method}`, `${symbol}${(amount as number).toFixed(2)}`, width) + '\n';
          }
        }

        // Items list
        if (categoryItems && categoryItems.length > 0) {
          text += '\n' + '-'.repeat(width) + '\n';
          text += this.centerText('TOP ITEMS', width) + '\n';
          text += '-'.repeat(width) + '\n';

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
        text += this.centerText('CATEGORIES SUMMARY', width) + '\n';
        text += '-'.repeat(width) + '\n';
        text += this.twoColumns('Categories:', `${categories.length}`, width) + '\n';
        text += this.twoColumns('Total Revenue:', `${symbol}${(summary.totalRevenue || 0).toFixed(2)}`, width) + '\n';
        text += this.twoColumns('Total Items:', `${summary.totalItems || 0}`, width) + '\n';
        text += this.twoColumns('Transactions:', `${summary.totalSales || 0}`, width) + '\n';

        // ✅ Discount summary
        if (summary.totalDiscount > 0) {
          text += this.twoColumns('Total Discount:', `-${symbol}${summary.totalDiscount.toFixed(2)}`, width) + '\n';
        }

        // ✅ Value Card summary
        if (summary.totalValueCardAmount > 0) {
          text += this.twoColumns('Value Card Total:', `${symbol}${summary.totalValueCardAmount.toFixed(2)}`, width) + '\n';
          text += this.twoColumns('Value Card Trans:', `${summary.valueCardTransactionCount || 0}`, width) + '\n';
        }

        // Payment breakdown
        if (summary.paymentBreakdown && Object.keys(summary.paymentBreakdown).length > 0) {
          text += '\n' + '-'.repeat(width) + '\n';
          text += this.centerText('PAYMENT BREAKDOWN', width) + '\n';
          text += '-'.repeat(width) + '\n';

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

            text += this.twoColumns(`${methodIcon} ${method}`, `${symbol}${(amount as number).toFixed(2)}`, width) + '\n';
          }
        }

        // Category breakdown
        text += '\n' + '-'.repeat(width) + '\n';
        text += this.centerText('CATEGORY BREAKDOWN', width) + '\n';
        text += '-'.repeat(width) + '\n';

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

      // ========== VOID DETAILS & VOID SUMMARY (THERMAL) ==========
      const voidedSalesList = options?.voidedSales || [];
      if (options?.isVoided || voidedSalesList.length > 0) {
        text += '\n' + '-'.repeat(width) + '\n';
        text += this.centerText('🚫 VOID DETAILS & SUMMARY', width) + '\n';
        text += '-'.repeat(width) + '\n';

        if (voidedSalesList.length > 0) {
          let totalVoidedAmt = 0;
          for (const vSale of voidedSalesList) {
            const vAmt = (vSale.total || 0);
            totalVoidedAmt += vAmt;
            const inv = vSale.invoiceNumber || vSale.id || '';
            const timeStr = this.formatDateTime(vSale.voidedAt || vSale.date);
            const reason = vSale.voidReason || 'N/A';
            const rawBy = String(vSale.voidedByName || vSale.voidedBy || vSale.VoidedByName || vSale.VoidedBy || '').trim();
            const by = (!rawBy || rawBy === 'N/A' || /^\d+$/.test(rawBy)) ? 'Staff' : rawBy;

            text += `#${inv} - ${symbol}${vAmt.toFixed(2)}\n`;
            text += ` Time: ${timeStr}\n`;
            text += ` Reason: ${reason}\n`;
            text += ` By: ${by}\n`;
            text += '-'.repeat(width) + '\n';
          }
          text += this.twoColumns('TOTAL VOIDED SALES:', `${symbol}${totalVoidedAmt.toFixed(2)}`, width) + '\n';
        } else {
          text += this.centerText('No voided sales recorded', width) + '\n';
        }
      }

      text += '\n' + '='.repeat(width) + '\n';
      text += this.centerText('END OF REPORT', width) + '\n';
      text += '='.repeat(width) + '\n\n';
      text += this.centerText('SMARTHAWKER BY UNIPROSG', width) + '\n';
      text += '\n\n\n';

      // ✅ Try network printer ONLY if enabled
      if (company && company.networkPrinterEnabled && company.networkPrinterIP) {
        try {
          const ThermalPrinter = require('react-native-thermal-printer');
          const ThermalPrinterModule = ThermalPrinter ? (ThermalPrinter.default || ThermalPrinter) : null;
          const { NativeModules } = require('react-native');
          const hasNativeModule = !!(NativeModules.ThermalPrinter || NativeModules.ThermalPrinterModule);

          if (ThermalPrinterModule && hasNativeModule) {
            console.log('📡 Category Report routing to Network Printer IP:', company.networkPrinterIP);
            const formattedPayload = text.split('\n').map(l => (!l ? '[L] ' : (l.startsWith('[L]') || l.startsWith('[C]') || l.startsWith('[R]')) ? l : `[L]${l}`)).join('\n') + '\n[L] \n[L] \n[L] \n';
            await ThermalPrinterModule.printTcp({
              ip: company.networkPrinterIP,
              port: 9100,
              payload: formattedPayload,
              autoCut: true,
              openCashbox: false,
              mmFeedPaper: 20,
              printerNbrCharactersPerLine: width,
            });
            return true;
          }
        } catch (netError) {
          console.log('❌ Category Report Network Print error:', netError);
        }
        return false; // Network failed -> PDF fallback directly
      } else {
        // Sunmi ONLY
        const sunmiReady = await SunmiPrinterService.init();
        if (sunmiReady) {
          await SunmiPrinterService.printRawText(text);
          await SunmiPrinterService.cutPaper();
          return true;
        }
        console.log('Sunmi printer not available, using PDF fallback');
        return false; // Sunmi failed -> PDF fallback directly
      }

    } catch (error) {
      console.log('Thermal category report error:', error);
      return false;
    }
  }
  // ==================== HELPER METHODS ====================
  private static getSingaporeDateTime(dateInput: Date = new Date()): string {
    try {
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Singapore',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      };
      const formatter = new Intl.DateTimeFormat('en-SG', options);
      const parts = formatter.formatToParts(dateInput);
      const day = parts.find(p => p.type === 'day')?.value || '00';
      const month = parts.find(p => p.type === 'month')?.value || '00';
      const year = parts.find(p => p.type === 'year')?.value || '0000';
      const hour = parts.find(p => p.type === 'hour')?.value || '00';
      const minute = parts.find(p => p.type === 'minute')?.value || '00';
      return `${day}/${month}/${year} ${hour}:${minute}`;
    } catch (e) {
      const day = String(dateInput.getDate()).padStart(2, '0');
      const month = String(dateInput.getMonth() + 1).padStart(2, '0');
      const year = dateInput.getFullYear();
      const hours = String(dateInput.getHours()).padStart(2, '0');
      const minutes = String(dateInput.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    }
  }

  private static parseRawDateTime(dateString: any): { day: string; month: string; year: number; hours: string; minutes: string; dateStr: string } {
    if (!dateString) {
      const formattedNow = this.getSingaporeDateTime(new Date());
      const [datePart, timePart] = formattedNow.split(' ');
      const [day, month, year] = datePart.split('/');
      const [hours, minutes] = timePart.split(':');
      return {
        day,
        month,
        year: parseInt(year, 10),
        hours,
        minutes,
        dateStr: formattedNow
      };
    }

    try {
      const dateStrRaw = String(dateString).trim();

      // ✅ 1. Try parsing ISO string directly (YYYY-MM-DDTHH:MM:SS...)
      const matchISO = dateStrRaw.match(/^(\d{4})[-/](\d{2})[-/](\d{2})[T ](\d{2}):(\d{2})/);
      if (matchISO) {
        const [_, yearStr, monthStr, dayStr, hourStr, minuteStr] = matchISO;
        return {
          day: dayStr,
          month: monthStr,
          year: parseInt(yearStr, 10),
          hours: hourStr,
          minutes: minuteStr,
          dateStr: `${dayStr}/${monthStr}/${yearStr} ${hourStr}:${minuteStr}`
        };
      }

      // ✅ 2. Try parsing SG formatted string directly (DD/MM/YYYY HH:MM...)
      const matchSG = dateStrRaw.match(/^(\d{2})[-/](\d{2})[-/](\d{4})[T ](\d{2}):(\d{2})/);
      if (matchSG) {
        const [_, dayStr, monthStr, yearStr, hourStr, minuteStr] = matchSG;
        return {
          day: dayStr,
          month: monthStr,
          year: parseInt(yearStr, 10),
          hours: hourStr,
          minutes: minuteStr,
          dateStr: `${dayStr}/${monthStr}/${yearStr} ${hourStr}:${minuteStr}`
        };
      }

      // 3. Fallback to timezone-based parsing
      let date: Date;
      if (dateString instanceof Date) {
        date = dateString;
      } else {
        let str = dateStrRaw;
        // If it doesn't have a timezone offset (ends with Z, or contains +xx:xx or -xx:xx)
        if (!str.endsWith('Z') && !str.match(/[+-]\d{2}:?\d{2}$/)) {
          if (str.includes(' ')) {
            str = str.replace(' ', 'T');
          }
          str = str + '+08:00';
        }
        date = new Date(str);
      }

      const formatted = this.getSingaporeDateTime(date);
      const [datePart, timePart] = formatted.split(' ');
      const [day, month, year] = datePart.split('/');
      const [hours, minutes] = timePart.split(':');
      return {
        day,
        month,
        year: parseInt(year, 10),
        hours,
        minutes,
        dateStr: formatted
      };
    } catch (e) {
      console.log('Error parsing date to SG time in UniversalPrinter:', e);
      return { day: '00', month: '00', year: 0, hours: '00', minutes: '00', dateStr: '00/00/0000 00:00' };
    }
  }

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