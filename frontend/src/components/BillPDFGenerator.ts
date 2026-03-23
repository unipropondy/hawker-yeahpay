// components/BillPDFGenerator.ts - WITH DISCOUNT SUPPORT ✅

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform, Alert } from 'react-native';
import API from '../api';

interface CompanySettings {
  name: string;
  address: string;
  gstNo: string;
  gstPercentage: number;
  phone: string;
  email: string;
  cashierName: string;
  currency: string;
  currencySymbol: string;
   companyLogo?: string;        // ✅ ADD THIS
  halalLogo?: string;          // ✅ ADD THIS
  showCompanyLogo?: boolean;   // ✅ ADD THIS
  showHalalLogo?: boolean; 
}

// ✅ DISCOUNT INFO INTERFACE
interface DiscountInfo {
  applied: boolean;
  type: 'percentage' | 'fixed';
  value: number;
  amount: number;
}

class BillPDFGenerator {
  
  static async loadSettings(userId?: string | number): Promise<CompanySettings> {
    try {
      if (!userId) return this.getDefaultSettings();
      
      const response = await API.get(`/company-settings/${userId}`);
      
      if (response.data && response.data.success) {
        const settings = response.data.settings;
        return {
          name: settings.CompanyName || '',
          address: settings.Address || '',
          gstNo: settings.GSTNo || '',
          gstPercentage: settings.GSTPercentage || 9,
          phone: settings.Phone || '',
          email: settings.Email || '',
          cashierName: settings.CashierName || '',
          currency: settings.Currency || 'SGD',
          currencySymbol: settings.CurrencySymbol || '$',
          // ✅ ADD LOGO FIELDS
          companyLogo: settings.CompanyLogoUrl || '',
          halalLogo: settings.HalalLogoUrl || '',
          showCompanyLogo: settings.ShowCompanyLogo !== false,
          showHalalLogo: settings.ShowHalalLogo !== false,
        };
      }
      return this.getDefaultSettings();
    } catch (error) {
      return this.getDefaultSettings();
    }
}
  private static getDefaultSettings(): CompanySettings {
    return {
      name: '',
      address: '',
      gstNo: '',
      gstPercentage: 9,
      phone: '',
      email: '',
      cashierName: '',
      currency: 'SGD',
      currencySymbol: '$',
    };
  }
  
  static async saveSettings(settings: CompanySettings, userId?: string | number): Promise<boolean> {
    try {
      if (!userId) return false;
      
      const dbSettings = {
        CompanyName: settings.name,
        Address: settings.address,
        GSTNo: settings.gstNo,
        GSTPercentage: settings.gstPercentage,
        Phone: settings.phone,
        Email: settings.email,
        CashierName: settings.cashierName,
        Currency: settings.currency,
        CurrencySymbol: settings.currencySymbol,
        // ✅ ADD LOGO FIELDS
        CompanyLogoUrl: settings.companyLogo || '',
        HalalLogoUrl: settings.halalLogo || '',
        ShowCompanyLogo: settings.showCompanyLogo !== false ? 1 : 0,
        ShowHalalLogo: settings.showHalalLogo !== false ? 1 : 0
      };
      
      const response = await API.post(`/company-settings/${userId}`, dbSettings);
      return response.data?.success || false;
      
    } catch (error) {
      console.log('❌ Error saving settings:', error);
      return false;
    }
}
  // ✅ GENERATE HTML WITH DISCOUNT SUPPORT
  static async generateHTML(saleData: any, userId?: string | number, discountInfo?: DiscountInfo): Promise<string> {
    const company = await this.loadSettings(userId);
    
    const date = new Date();
    const billNo = `INV-${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2,'0')}${date.getDate().toString().padStart(2,'0')}-${Math.floor(1000 + Math.random()*9000)}`;
    
    // ✅ SINGAPORE GST INCLUSIVE FORMULA
    const hasGST = company.gstPercentage > 0;
    const gstRate = company.gstPercentage || 9;
    
    // Total with GST included (this is the final total after discount)
    const finalTotal = saleData.total;
    
    // Calculate GST component (back calculation from final total)
    const gstAmount = hasGST ? finalTotal * (gstRate / (100 + gstRate)) : 0;
    const amountWithoutGST = hasGST ? finalTotal - gstAmount : finalTotal;
    
    const currencySymbol = company.currencySymbol || '$';
    
    // ✅ DISCOUNT INFO
    const hasDiscount = discountInfo?.applied && discountInfo.amount > 0;
    const originalTotal = hasDiscount ? finalTotal + discountInfo.amount : finalTotal;
    
    // ✅ LOGO URLs
    const companyLogoUrl = company.companyLogo || '';
    const halalLogoUrl = company.halalLogo || '';
    const showCompanyLogo = company.showCompanyLogo !== false;
    const showHalalLogo = company.showHalalLogo !== false;
    
    // Generate items HTML
    const itemsHTML = saleData.items.map((item: any) => `
       <tr>
        <td class="item-name">${item.name}</td>
        <td class="item-qty">${item.quantity}</td>
        <td class="item-price">${currencySymbol}${item.price.toFixed(2)}</td>
        <td class="item-total">${currencySymbol}${(item.price * item.quantity).toFixed(2)}</td>
       </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>Tax Invoice</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          
          body {
            font-family: 'Courier New', Courier, monospace;
            background: #fff;
            display: flex;
            justify-content: center;
            padding: 0;
            margin: 0;
          }
          
          .receipt {
            width: 72mm;
            max-width: 72mm;
            background: white;
            padding: 3mm 2mm;
            margin: 0 auto;
          }
          
          /* ✅ LOGO HEADER STYLES */
          .logo-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4mm;
            border-bottom: 2px solid #000;
            padding-bottom: 2mm;
          }
          
          .company-logo {
            width: 40px;
            height: 40px;
            object-fit: contain;
          }
          
          .halal-logo {
            width: 35px;
            height: 35px;
            object-fit: contain;
          }
          
          .shop-info {
            text-align: center;
            flex: 1;
          }
          
          .shop-name {
            font-size: 18px;
            font-weight: 800;
            text-transform: uppercase;
            margin-bottom: 2mm;
            letter-spacing: 1px;
          }
          
          .shop-address {
            font-size: 10px;
            font-weight: 400;
            line-height: 1.3;
            margin-bottom: 1mm;
          }
          
          .gst-no {
            font-size: 10px;
            font-weight: 700;
            background: #f0f0f0;
            padding: 1mm;
            margin: 2mm 0;
          }
          
          .contact {
            font-size: 9px;
            font-weight: 400;
            line-height: 1.3;
            margin-bottom: 1mm;
          }
          
          .bill-details {
            margin-bottom: 4mm;
            padding: 2mm;
            border: 1px solid #000;
            font-size: 11px;
          }
          
          .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
          }
          
          .detail-label {
            font-weight: 700;
          }
          
          .detail-value {
            font-weight: 400;
          }
          
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 4mm;
            font-size: 11px;
          }
          
          .items-table th {
            font-weight: 800;
            text-align: center;
            padding: 2mm 1mm;
            border-bottom: 2px solid #000;
            border-top: 2px solid #000;
            text-transform: uppercase;
            font-size: 11px;
          }
          
          .items-table th:first-child { text-align: left; }
          .items-table th:last-child { text-align: right; }
          
          .items-table td {
            padding: 1.5mm 1mm;
            border-bottom: 1px dashed #ccc;
            font-weight: 400;
          }
          
          .item-name {
            text-align: left;
            font-weight: 400;
            max-width: 35mm;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          
          .item-qty {
            text-align: center;
            font-weight: 700;
          }
          
          .item-price {
            text-align: right;
            font-weight: 400;
          }
          
          .item-total {
            text-align: right;
            font-weight: 700;
          }
          
          /* ✅ DISCOUNT SECTION STYLES */
          .discount-section {
            margin-bottom: 4mm;
            padding: 2mm;
            border: 1px solid #0b0a0a;
            background: #ffffff;
          }
          
          .discount-title {
            font-size: 11px;
            font-weight: 800;
            color: #0e0e0e;
            margin-bottom: 2mm;
            text-align: center;
          }
          
          .discount-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
            font-size: 11px;
          }
          
          .discount-label {
            font-weight: 700;
            color: #070707;
          }
          
          .discount-value {
            font-weight: 700;
            color: #0d0d0d;
          }
          
          .original-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
            font-size: 11px;
            text-decoration: line-through;
            color: #888;
          }
          
          .original-label {
            font-weight: 700;
          }
          
          .original-value {
            font-weight: 700;
          }
          
          .totals {
            margin-bottom: 4mm;
            padding: 2mm;
            border: 1px solid #000;
          }
          
          .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
            font-size: 11px;
          }
          
          .total-label {
            font-weight: 700;
          }
          
          .total-value {
            font-weight: 700;
          }
          
          .grand-total {
            display: flex;
            justify-content: space-between;
            margin-top: 2mm;
            padding-top: 2mm;
            border-top: 2px solid #000;
            font-weight: 800;
            font-size: 14px;
          }
          
          .grand-label {
            font-weight: 800;
          }
          
          .grand-value {
            font-weight: 800;
            color: #000;
          }
          
          .payment-info {
            margin-bottom: 4mm;
            padding: 2mm;
            border: 1px solid #000;
            background: #f9f9f9;
          }
          
          .payment-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
            font-size: 11px;
          }
          
          .payment-label {
            font-weight: 700;
          }
          
          .payment-value {
            font-weight: 700;
          }
          
          .footer {
            text-align: center;
            padding-top: 3mm;
            border-top: 2px solid #000;
          }
          
          .thankyou {
            font-size: 14px;
            font-weight: 800;
            margin-bottom: 2mm;
          }
          
          .copyright {
            font-size: 8px;
            font-weight: 800;      
            color: #000000;
            margin-top: 2mm;
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          
          <!-- ✅ HEADER WITH LOGOS (Left: Company Logo, Right: Halal Logo) -->
          <div class="logo-header">
            ${showCompanyLogo && companyLogoUrl ? 
              `<img src="${companyLogoUrl}" class="company-logo" alt="Company Logo" />` : 
              '<div style="width:40px"></div>'
            }
            
            <div class="shop-info">
              <div class="shop-name">${company.name || 'POS SYSTEM'}</div>
              <div class="shop-address">${company.address}</div>
              ${company.gstNo ? `<div class="gst-no">GST: ${company.gstNo}</div>` : ''}
              <div class="contact">${company.phone ? `📞 ${company.phone}` : ''} ${company.email ? `📧 ${company.email}` : ''}</div>
            </div>
            
            ${showHalalLogo && halalLogoUrl ? 
              `<img src="${halalLogoUrl}" class="halal-logo" alt="Halal Logo" />` : 
              '<div style="width:35px"></div>'
            }
          </div>
          
          <!-- Bill Details -->
          <div class="bill-details">
            <div class="detail-row">
              <span class="detail-label">Bill No:</span>
              <span class="detail-value">${billNo}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Date:</span>
              <span class="detail-value">${date.toLocaleDateString()} ${date.toLocaleTimeString()}</span>
            </div>
            ${company.cashierName ? `
            <div class="detail-row" style="margin-top: 2mm; border-top: 1px dashed #000; padding-top: 2mm;">
              <span class="detail-label">Cashier:</span>
              <span class="detail-value">${company.cashierName}</span>
            </div>
            ` : ''}
          </div>
          
          <!-- Items Table -->
          <table class="items-table">
            <thead>
              <tr>
                <th>ITEM</th>
                <th>QTY</th>
                <th>PRICE</th>
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
            </tbody>
          </table>
          
          <!-- ✅ DISCOUNT SECTION (if discount applied) -->
          ${hasDiscount ? `
          <div class="discount-section">
            <div class="discount-title">🏷️ DISCOUNT APPLIED</div>
            <div class="original-row">
              <span class="original-label">Original Total:</span>
              <span class="original-value">${currencySymbol}${originalTotal.toFixed(2)}</span>
            </div>
            <div class="discount-row">
              <span class="discount-label">
                Discount (${discountInfo?.type === 'percentage' ? `${discountInfo?.value}%` : 'Fixed'}):
              </span>
              <span class="discount-value">-${currencySymbol}${discountInfo?.amount.toFixed(2)}</span>
            </div>
          </div>
          ` : ''}
          
          <!-- Totals -->
          <div class="totals">
            <div class="total-row">
              <span class="total-label">Sub Total (without GST):</span>
              <span class="total-value">${currencySymbol}${amountWithoutGST.toFixed(2)}</span>
            </div>
            ${hasGST ? `
            <div class="total-row">
              <span class="total-label">GST (${gstRate}%):</span>
              <span class="total-value">${currencySymbol}${gstAmount.toFixed(2)}</span>
            </div>
            ` : ''}
            <div class="grand-total">
              <span class="grand-label">GRAND TOTAL (incl GST):</span>
              <span class="grand-value">${currencySymbol}${finalTotal.toFixed(2)}</span>
            </div>
          </div>
          
          <!-- Payment Info -->
          <div class="payment-info">
            <div class="payment-row">
              <span class="payment-label">Payment:</span>
              <span class="payment-value">${saleData.paymentMethod || 'Cash'}</span>
            </div>
            ${saleData.cashPaid ? `
            <div class="payment-row">
              <span class="payment-label">Paid:</span>
              <span class="payment-value">${currencySymbol}${saleData.cashPaid.toFixed(2)}</span>
            </div>
            <div class="payment-row">
              <span class="payment-label">Change:</span>
              <span class="payment-value">${currencySymbol}${(saleData.change || 0).toFixed(2)}</span>
            </div>
            ` : ''}
          </div>
          
          <!-- Footer -->
          <div class="footer">
            <div class="thankyou">THANK YOU! COME AGAIN!</div>
            <div class="copyright">UNIPRO SOFTWARES SG PTE LTD</div>
          </div>
          
        </div>
      </body>
      </html>
    `;
  }

  // ✅ Updated generatePDF with discount support
  static async generatePDF(saleData: any, userId?: string | number, discountInfo?: DiscountInfo): Promise<string> {
    try {
      const html = await this.generateHTML(saleData, userId, discountInfo);
      
      const { uri } = await Print.printToFileAsync({
        html: html,
        base64: false,
        width: 226
      });
      
      return uri;
    } catch (error) {
      throw error;
    }
  }

  // ✅ Updated downloadPDF with discount support
  static async downloadPDF(saleData: any, userId?: string | number, discountInfo?: DiscountInfo): Promise<void> {
    try {
      const pdfUri = await this.generatePDF(saleData, userId, discountInfo);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save Receipt',
        });
      } else {
        Alert.alert('✅ Receipt Ready', `Saved at:\n${pdfUri}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to generate receipt');
    }
  }
}

export default BillPDFGenerator;