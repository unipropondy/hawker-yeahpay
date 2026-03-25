// components/BillPDFGenerator.ts - WITH DISCOUNT SUPPORT ✅

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform, Alert } from 'react-native';
import API from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
        
        // Get outlet ID for multi-outlet
        const outletId = await AsyncStorage.getItem('selectedOutletId');
        const targetId = outletId || userId;
        
        // Add timestamp to prevent caching
        const timestamp = Date.now();
        
        console.log(`📥 LOADING SETTINGS for target: ${targetId}`);
        
        const response = await API.get(`/company-settings/${targetId}?_t=${timestamp}`);
        
        console.log('📥 LOADED SETTINGS FROM BACKEND:', {
            userId,
            targetId,
            rawSettings: response.data?.settings,
            showCompanyLogo: response.data?.settings?.ShowCompanyLogo,
            showHalalLogo: response.data?.settings?.ShowHalalLogo,
            GSTPercentage: response.data?.settings?.GSTPercentage,
            companyLogo: response.data?.settings?.CompanyLogoUrl,
            halalLogo: response.data?.settings?.HalalLogoUrl
        });
        
        if (response.data && response.data.success) {
            const settings = response.data.settings;
            
            // Fix boolean conversion
            const showCompanyLogo = settings.ShowCompanyLogo === 1 || settings.ShowCompanyLogo === true;
            const showHalalLogo = settings.ShowHalalLogo === 1 || settings.ShowHalalLogo === true;
            
            // ✅ FIX: Handle GST percentage correctly (allow 0)
            const gstPercentage = settings.GSTPercentage !== undefined && settings.GSTPercentage !== null 
                ? settings.GSTPercentage 
                : 9;
            
            console.log('✅ CONVERTED VALUES:', {
                showCompanyLogo,
                showHalalLogo,
                gstPercentage,
                rawGST: settings.GSTPercentage
            });
            
            return {
                name: settings.CompanyName || '',
                address: settings.Address || '',
                gstNo: settings.GSTNo || '',
                gstPercentage: gstPercentage,  // ✅ Now 0 will stay 0
                phone: settings.Phone || '',
                email: settings.Email || '',
                cashierName: settings.CashierName || '',
                currency: settings.Currency || 'SGD',
                currencySymbol: settings.CurrencySymbol || '$',
                companyLogo: settings.CompanyLogoUrl || '',
                halalLogo: settings.HalalLogoUrl || '',
                showCompanyLogo: showCompanyLogo,
                showHalalLogo: showHalalLogo,
            };
        }
        return this.getDefaultSettings();
    } catch (error) {
        console.log('❌ Error loading settings:', error);
        return this.getDefaultSettings();
    }
}

  private static getDefaultSettings(): CompanySettings {
    return {
      name: '',
      address: '',
      gstNo: '',
      gstPercentage: 0,
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
        
        // ✅ CRITICAL FIX: Get outlet ID for multi-outlet support
        const outletId = await AsyncStorage.getItem('selectedOutletId');
        const targetId = outletId || userId;
        
        console.log(`💾 SAVING SETTINGS TO BACKEND for target: ${targetId} (outlet: ${outletId || 'none'})`, {
            showCompanyLogo: settings.showCompanyLogo ? 1 : 0,
            showHalalLogo: settings.showHalalLogo ? 1 : 0,
            companyLogo: settings.companyLogo ? 'YES' : 'NO',
            halalLogo: settings.halalLogo ? 'YES' : 'NO'
        });
        
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
            CompanyLogoUrl: settings.companyLogo || '',
            HalalLogoUrl: settings.halalLogo || '',
            ShowCompanyLogo: settings.showCompanyLogo ? 1 : 0,  // ✅ Simplified
            ShowHalalLogo: settings.showHalalLogo ? 1 : 0      // ✅ Simplified
        };
        
        // ✅ Add timestamp to prevent caching
        const timestamp = Date.now();
        
        // ✅ STEP 1: DELETE old settings first (to ensure clean slate)
        try {
            await API.delete(`/company-settings/${targetId}?_t=${timestamp}`);
            console.log('✅ Old settings deleted');
        } catch (deleteError: any) {
            // 404 is fine (no existing settings)
            if (deleteError.response?.status !== 404) {
                console.log('⚠️ Delete failed:', deleteError.message);
            } else {
                console.log('ℹ️ No existing settings to delete');
            }
        }
        
        // ✅ Small delay to ensure delete completes
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // ✅ STEP 2: POST new settings
        const response = await API.post(`/company-settings/${targetId}?_t=${timestamp}`, dbSettings);
        
        console.log('✅ SAVE RESPONSE:', response.data);
        
        // ✅ STEP 3: VERIFY immediately (to confirm save worked)
        const verifyResponse = await API.get(`/company-settings/${targetId}?_t=${timestamp + 1}`);
        
        console.log('🔍 VERIFY AFTER SAVE:', {
            ShowCompanyLogo: verifyResponse.data?.settings?.ShowCompanyLogo,
            ShowHalalLogo: verifyResponse.data?.settings?.ShowHalalLogo,
            expected: {
                ShowCompanyLogo: dbSettings.ShowCompanyLogo,
                ShowHalalLogo: dbSettings.ShowHalalLogo
            },
            match: verifyResponse.data?.settings?.ShowCompanyLogo === dbSettings.ShowCompanyLogo
        });
        
        // ✅ STEP 4: Check if save actually worked
        if (verifyResponse.data?.settings?.ShowCompanyLogo !== dbSettings.ShowCompanyLogo) {
            console.log('⚠️ WARNING: Save verification failed! Trying again...');
            // One more attempt
            await API.post(`/company-settings/${targetId}?_t=${timestamp + 2}`, dbSettings);
        }
        
        return response.data?.success || false;
        
    } catch (error: any) {
        console.log('❌ Error saving settings:', error);
        console.log('❌ Error details:', error.response?.data || error.message);
        return false;
    }
}
// Add this method to the BillPDFGenerator class
private static escapeHtml(str: string): string {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
  // ✅ GENERATE HTML WITH DISCOUNT SUPPORT
  static async generateHTML(saleData: any, userId?: string | number, discountInfo?: DiscountInfo): Promise<string> {
    const company = await this.loadSettings(userId);
    
    const date = new Date();
    
    // ✅ USE THE INVOICE NUMBER FROM DATABASE
    // If saleData has invoiceNumber, use it; otherwise generate fallback
    const billNo = saleData.invoiceNumber || `INV-${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2,'0')}${date.getDate().toString().padStart(2,'0')}-${Math.floor(1000 + Math.random()*9000)}`;
    
    const hasGST = company.gstPercentage > 0;
    const gstRate = company.gstPercentage || 9;
    const finalTotal = saleData.total;
    const gstAmount = hasGST ? finalTotal * (gstRate / (100 + gstRate)) : 0;
    const amountWithoutGST = hasGST ? finalTotal - gstAmount : finalTotal;
    const currencySymbol = company.currencySymbol || '$';
    
    const hasDiscount = discountInfo?.applied && discountInfo.amount > 0;
    const originalTotal = hasDiscount ? finalTotal + discountInfo.amount : finalTotal;
    
    const companyLogoUrl = company.companyLogo || '';
    const halalLogoUrl = company.halalLogo || '';
    const showCompanyLogo = company.showCompanyLogo !== false;
    const showHalalLogo = company.showHalalLogo !== false;
    
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
          
          /* Logo Header */
          .logo-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4mm;
            border-bottom: 2px solid #000;
            padding-bottom: 2mm;
          }
          
          .company-logo { width: 40px; height: 40px; object-fit: contain; }
          .halal-logo { width: 35px; height: 35px; object-fit: contain; }
          
          .shop-info { text-align: center; flex: 1; }
          .shop-name { font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
          .shop-address { font-size: 10px; font-weight: 700; line-height: 1.3;white-space: pre-line; }
          .gst-no { font-size: 10px; font-weight: 700; background: #f0f0f0; padding: 1mm; margin: 2mm 0; }
          .contact { font-size: 9px; font-weight: 700; }
          
          /* Bill Details */
          .bill-details {
            margin-bottom: 4mm;
            font-size: 11px;
            font-weight: 700;
          }
          
          .bill-box {
            border: 1px solid #000;
            padding: 2mm;
            margin-bottom: 2mm;
            background: #f9f9f9;
          }
          
          .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
            font-weight: 700;
          }
          
          .detail-label { font-weight: 800; }
          .detail-value { font-weight: 700; font-family: monospace; letter-spacing: 0.5px; }
          
          /* Items Table */
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 4mm;
            font-size: 11px;
            font-weight: 700;
          }
          
          .items-table th {
            font-weight: 800;
            text-align: center;
            padding: 2mm 1mm;
            border-bottom: 2px solid #000;
            border-top: 2px solid #000;
            text-transform: uppercase;
          }
          
          .items-table th:first-child { text-align: left; }
          .items-table th:last-child { text-align: right; }
          
          .items-table td {
            padding: 1.5mm 1mm;
            border-bottom: 1px dashed #ccc;
            font-weight: 700;
          }
          
          .item-name { text-align: left; font-weight: 700; max-width: 35mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .item-qty { text-align: center; font-weight: 800; }
          .item-price { text-align: right; font-weight: 700; }
          .item-total { text-align: right; font-weight: 800; }
          
          /* Discount Section */
          .discount-section {
            margin-bottom: 4mm;
            padding: 2mm;
            border: 1px solid #000;
            background: #f9f9f9;
          }
          
          .discount-title { font-size: 11px; font-weight: 800; text-align: center; margin-bottom: 2mm; }
          .discount-row, .original-row {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            font-weight: 700;
          }
          
          /* Totals */
          .totals {
            margin-bottom: 4mm;
            font-weight: 700;
          }
          
          .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
            font-size: 11px;
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
          
          /* Payment Info */
          .payment-info {
            margin-bottom: 4mm;
            font-weight: 700;
          }
          
          .payment-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
            font-size: 11px;
            font-weight: 700;
          }
          
          .payment-label { font-weight: 800; }
          .payment-value { font-weight: 700; }
          
          /* Footer */
          .footer {
            text-align: center;
            padding-top: 3mm;
            border-top: 2px solid #000;
          }
          
          .thankyou { font-size: 14px; font-weight: 800; margin-bottom: 2mm; }
          .copyright { font-size: 12px; font-weight: 900; color: #000; }
        </style>
      </head>
      <body>
        <div class="receipt">
          
          <!-- Logo Header -->
          <div class="logo-header">
            ${showCompanyLogo && companyLogoUrl ? 
              `<img src="${companyLogoUrl}" class="company-logo" />` : 
              '<div style="width:40px"></div>'
            }
            <div class="shop-info">
              <div class="shop-name">${company.name || 'POS SYSTEM'}</div>
              <div class="shop-address">${this.escapeHtml(company.address).replace(/\n/g, '<br/>')}</div>
              ${company.gstNo ? `<div class="gst-no">GST: ${company.gstNo}</div>` : ''}
              <div class="contact">${company.phone ? `📞 ${company.phone}` : ''} ${company.email ? `📧 ${company.email}` : ''}</div>
            </div>
            ${showHalalLogo && halalLogoUrl ? 
              `<img src="${halalLogoUrl}" class="halal-logo" />` : 
              '<div style="width:35px"></div>'
            }
          </div>
          
          <!-- Bill Details - WITH INVOICE NUMBER FROM DATABASE -->
          <div class="bill-details">
            <div class="bill-box">
              <div class="detail-row">
                <span class="detail-label">INVOICE NO:</span>
                <span class="detail-value">${billNo}</span>
              </div>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">DATE:</span>
              <span class="detail-value">${date.toLocaleDateString()} ${date.toLocaleTimeString()}</span>
            </div>
            
            ${company.cashierName ? `
            <div class="detail-row">
              <span class="detail-label">CASHIER:</span>
              <span class="detail-value">${company.cashierName}</span>
            </div>
            ` : ''}
          </div>
          
          <!-- Items Table -->
          <table class="items-table">
            <thead>
              <tr><th>ITEM</th><th>QTY</th><th>PRICE</th><th>TOTAL</th> </>
            </thead>
            <tbody>${itemsHTML}</tbody>
           </table>
          
          <!-- Discount Section -->
          ${hasDiscount ? `
          <div class="discount-section">
            <div class="discount-title">🏷️ DISCOUNT APPLIED</div>
            <div class="original-row">
              <span>Original Total:</span>
              <span>${currencySymbol}${originalTotal.toFixed(2)}</span>
            </div>
            <div class="discount-row">
              <span>Discount (${discountInfo?.type === 'percentage' ? `${discountInfo?.value}%` : 'Fixed'}):</span>
              <span>-${currencySymbol}${discountInfo?.amount.toFixed(2)}</span>
            </div>
          </div>
          ` : ''}
          
          <!-- Totals -->
          <div class="totals">
    <div class="total-row">
        <span>${hasGST ? 'Sub Total (without GST):' : 'Sub Total:'}</span>
        <span>${currencySymbol}${hasGST ? amountWithoutGST.toFixed(2) : finalTotal.toFixed(2)}</span>
    </div>
    ${hasGST ? `
    <div class="total-row">
        <span>GST (${gstRate}%):</span>
        <span>${currencySymbol}${gstAmount.toFixed(2)}</span>
    </div>
    ` : ''}
    <div class="grand-total">
        <span>${hasGST ? 'GRAND TOTAL (incl GST):' : 'GRAND TOTAL:'}</span>
        <span>${currencySymbol}${finalTotal.toFixed(2)}</span>
    </div>
</div>
          <!-- Payment Info -->
          <div class="payment-info">
            <div class="payment-row">
              <span>PAYMENT:</span>
              <span>${saleData.paymentMethod || 'Cash'}</span>
            </div>
            ${saleData.cashPaid ? `
            <div class="payment-row">
              <span>PAID:</span>
              <span>${currencySymbol}${saleData.cashPaid.toFixed(2)}</span>
            </div>
            <div class="payment-row">
              <span>CHANGE:</span>
              <span>${currencySymbol}${(saleData.change || 0).toFixed(2)}</span>
            </div>
            ` : ''}
          </div>
          
          <!-- Footer -->
          <div class="footer">
            <div class="thankyou">THANK YOU! COME AGAIN!</div>
            <div class="copyright">SMARTHAWKER BY UNIPROSG</div>
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