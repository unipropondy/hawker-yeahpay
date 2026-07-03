import React, { useState, useEffect } from 'react';
import {
    View, Text, Modal, ScrollView, TouchableOpacity,
    StyleSheet, ActivityIndicator, Alert, FlatList,
    StatusBar, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import API from '../api';
import SunmiPrinterService from './SunmiPrinterService';

interface DayEndModalProps {
    visible: boolean;
    onClose: () => void;
    outletId: number;
    theme: any;
    t: any;
    formatPrice: (amount: number) => string;
    onDayEndComplete: () => void;
}

const DayEndModal: React.FC<DayEndModalProps> = ({
    visible,
    onClose,
    outletId,
    theme,
    t,
    formatPrice,
    onDayEndComplete
}) => {
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
    const [dayEndData, setDayEndData] = useState<any>({
        totalSales: 0,
        totalDiscount: 0,
        totalItems: 0,
        netSales: 0,
        paymentBreakdown: {},
        salesCount: 0,
        categories: []
    });
    const [dayEndStatus, setDayEndStatus] = useState<any>(null);
    const [isDayEnded, setIsDayEnded] = useState(false);
    const [dayEndHistory, setDayEndHistory] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [selectedHistory, setSelectedHistory] = useState<any>(null);
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [expandedHistoryCategory, setExpandedHistoryCategory] = useState<string | null>(null);
    
    // ✅ Email State
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailAddress, setEmailAddress] = useState('');
    const [emailLoading, setEmailLoading] = useState(false);
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null);
const [savedEmail, setSavedEmail] = useState('');
    useEffect(() => {
        if (visible) {
            console.log('📅 DayEndModal opened');
            loadDayEndData();
            loadSavedEmail();
        }
    }, [visible]);
// ✅ Load saved email from AsyncStorage
const loadSavedEmail = async () => {
    try {
        const email = await AsyncStorage.getItem('lastEmailAddress');
        console.log('📧 Loading saved email from storage:', email);
        if (email) {
            setSavedEmail(email);
            setEmailAddress(email);  // ✅ Auto-fill the input
            console.log('✅ Email auto-filled:', email);
        } else {
            console.log('⚠️ No saved email found');
        }
    } catch (error) {
        console.log('❌ Error loading saved email:', error);
    }
};
    const formatUTCTime = (dateString: string) => {
        if (!dateString) return { date: '', time: '' };
        const date = new Date(dateString);
        const day = String(date.getUTCDate()).padStart(2, '0');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = monthNames[date.getUTCMonth()];
        const year = date.getUTCFullYear();
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        return {
            date: `${day} ${month} ${year}`,
            time: `${hours}:${minutes}`
        };
    };

    const loadDayEndData = async () => {
        setLoading(true);
        try {
            const statusRes = await API.get('/dayend/status');
            console.log('📊 Status response:', statusRes.data);
            
            setDayEndStatus(statusRes.data);
            
            const pendingSales = statusRes.data.pendingSales || 0;
            const isDayEnded = statusRes.data.isDayEnded === true || statusRes.data.isDayEnded === 1;
            
            console.log(`🔍 isDayEnded: ${isDayEnded}, pendingSales: ${pendingSales}`);
            
            if (pendingSales > 0) {
                console.log(`📊 Found ${pendingSales} pending sales - LOADING SUMMARY`);
                setIsDayEnded(false);
                
                const salesRes = await API.get('/sales?status=completed');
                const sales = salesRes.data || [];
                
                let totalSales = 0;
                let totalDiscount = 0;
                let totalItems = 0;
                const paymentBreakdown: Record<string, number> = {};
                const categoryMap: Record<string, { items: Record<string, { quantity: number, revenue: number }>, totalRevenue: number, totalQuantity: number }> = {};
                
                sales.forEach((sale: any) => {
                    totalSales += sale.total || 0;
                    totalDiscount += sale.discountAmount || 0;
                    
                    const method = sale.paymentMethod || 'Unknown';
                    paymentBreakdown[method] = (paymentBreakdown[method] || 0) + (sale.total || 0);
                    
                    if (sale.items) {
                        sale.items.forEach((item: any) => {
                            const category = item.displayCategory || item.category || 'Uncategorized';
                            const itemName = item.name || 'Unknown';
                            const quantity = item.quantity || 1;
                            const price = item.price || 0;
                            const revenue = price * quantity;
                            
                            totalItems += quantity;
                            
                            if (!categoryMap[category]) {
                                categoryMap[category] = {
                                    items: {},
                                    totalRevenue: 0,
                                    totalQuantity: 0
                                };
                            }
                            
                            if (!categoryMap[category].items[itemName]) {
                                categoryMap[category].items[itemName] = {
                                    quantity: 0,
                                    revenue: 0
                                };
                            }
                            
                            categoryMap[category].items[itemName].quantity += quantity;
                            categoryMap[category].items[itemName].revenue += revenue;
                            categoryMap[category].totalRevenue += revenue;
                            categoryMap[category].totalQuantity += quantity;
                        });
                    }
                });
                
                const categories = Object.keys(categoryMap).map(catName => ({
                    name: catName,
                    totalRevenue: categoryMap[catName].totalRevenue,
                    totalQuantity: categoryMap[catName].totalQuantity,
                    items: Object.keys(categoryMap[catName].items).map(itemName => ({
                        name: itemName,
                        quantity: categoryMap[catName].items[itemName].quantity,
                        revenue: categoryMap[catName].items[itemName].revenue
                    })).sort((a, b) => b.revenue - a.revenue)
                })).sort((a, b) => b.totalRevenue - a.totalRevenue);
                
                setDayEndData({
                    totalSales,
                    totalDiscount,
                    totalItems,
                    netSales: totalSales - totalDiscount,
                    paymentBreakdown,
                    salesCount: sales.length,
                    categories: categories
                });
                
                setLoading(false);
                return;
            }
            
            if (isDayEnded && pendingSales === 0) {
                console.log('✅ No pending sales - SHOWING RESET STATE');
                setIsDayEnded(true);
                setDayEndData({
                    totalSales: 0,
                    totalDiscount: 0,
                    totalItems: 0,
                    netSales: 0,
                    paymentBreakdown: {},
                    salesCount: 0,
                    categories: []
                });
                setLoading(false);
                return;
            }
            
            setIsDayEnded(false);
            
            const salesRes = await API.get('/sales?status=completed');
            const sales = salesRes.data || [];
            
            let totalSales = 0;
            let totalDiscount = 0;
            let totalItems = 0;
            const paymentBreakdown: Record<string, number> = {};
            const categoryMap: Record<string, { items: Record<string, { quantity: number, revenue: number }>, totalRevenue: number, totalQuantity: number }> = {};
            
            sales.forEach((sale: any) => {
                totalSales += sale.total || 0;
                totalDiscount += sale.discountAmount || 0;
                
                const method = sale.paymentMethod || 'Unknown';
                paymentBreakdown[method] = (paymentBreakdown[method] || 0) + (sale.total || 0);
                
                if (sale.items) {
                    sale.items.forEach((item: any) => {
                        const category = item.displayCategory || item.category || 'Uncategorized';
                        const itemName = item.name || 'Unknown';
                        const quantity = item.quantity || 1;
                        const price = item.price || 0;
                        const revenue = price * quantity;
                        
                        totalItems += quantity;
                        
                        if (!categoryMap[category]) {
                            categoryMap[category] = {
                                items: {},
                                totalRevenue: 0,
                                totalQuantity: 0
                            };
                        }
                        
                        if (!categoryMap[category].items[itemName]) {
                            categoryMap[category].items[itemName] = {
                                quantity: 0,
                                revenue: 0
                            };
                        }
                        
                        categoryMap[category].items[itemName].quantity += quantity;
                        categoryMap[category].items[itemName].revenue += revenue;
                        categoryMap[category].totalRevenue += revenue;
                        categoryMap[category].totalQuantity += quantity;
                    });
                }
            });
            
            const categories = Object.keys(categoryMap).map(catName => ({
                name: catName,
                totalRevenue: categoryMap[catName].totalRevenue,
                totalQuantity: categoryMap[catName].totalQuantity,
                items: Object.keys(categoryMap[catName].items).map(itemName => ({
                    name: itemName,
                    quantity: categoryMap[catName].items[itemName].quantity,
                    revenue: categoryMap[catName].items[itemName].revenue
                })).sort((a, b) => b.revenue - a.revenue)
            })).sort((a, b) => b.totalRevenue - a.totalRevenue);
            
            setDayEndData({
                totalSales,
                totalDiscount,
                totalItems,
                netSales: totalSales - totalDiscount,
                paymentBreakdown,
                salesCount: sales.length,
                categories: categories
            });
            
        } catch (error) {
            console.log('❌ Error loading day end data:', error);
            Alert.alert('Error', 'Failed to load day end data');
        } finally {
            setLoading(false);
        }
    };

    const loadDayEndHistory = async () => {
        setHistoryLoading(true);
        try {
            const response = await API.get('/dayend/history?limit=50');
            console.log('📊 History response:', response.data);
            
            if (response.data.success) {
                setDayEndHistory(response.data.history || []);
            }
        } catch (error) {
            console.log('❌ Error loading history:', error);
            Alert.alert('Error', 'Failed to load history');
        } finally {
            setHistoryLoading(false);
        }
    };

    // ==================== PRINT FUNCTIONS ====================

    const centerText = (text: string, width: number) => {
        if (!text) return ' '.repeat(width);
        const padding = Math.max(0, width - text.length);
        return ' '.repeat(Math.floor(padding / 2)) + text + ' '.repeat(padding - Math.floor(padding / 2));
    };

    const twoColumns = (left: string, right: string, width: number) => {
        const leftWidth = Math.floor(width * 0.55);
        const rightWidth = width - leftWidth;
        let leftText = left.substring(0, leftWidth);
        let rightText = right.substring(0, rightWidth);
        leftText = leftText.padEnd(leftWidth, ' ');
        return leftText + rightText;
    };

  const buildDayEndReportText = (data: any, outletName: string) => {
    const symbol = '$';
    const line = '='.repeat(32);
    const dash = '-'.repeat(32);
    
    // ✅ ORIGINAL Day End Date - USE data.closingDate
    const originalDate = data.closingDate ? new Date(data.closingDate) : new Date();
    const origDay = String(originalDate.getUTCDate()).padStart(2, '0');
    const origMonth = String(originalDate.getUTCMonth() + 1).padStart(2, '0');
    const origYear = originalDate.getUTCFullYear();
    const origHours = String(originalDate.getUTCHours()).padStart(2, '0');
    const origMinutes = String(originalDate.getUTCMinutes()).padStart(2, '0');
    const origDateStr = `${origDay}/${origMonth}/${origYear} ${origHours}:${origMinutes}`;
    
    // ✅ CURRENT Date (Generated on)
    const now = new Date();
    const nowDay = String(now.getDate()).padStart(2, '0');
    const nowMonth = String(now.getMonth() + 1).padStart(2, '0');
    const nowYear = now.getFullYear();
    const nowHours = String(now.getHours()).padStart(2, '0');
    const nowMinutes = String(now.getMinutes()).padStart(2, '0');
    const nowDateStr = `${nowDay}/${nowMonth}/${nowYear} ${nowHours}:${nowMinutes}`;
    
    console.log('📅 buildDayEndReportText - Original:', origDateStr);
    console.log('📅 buildDayEndReportText - Generated:', nowDateStr);
    
    let text = '\n\n';
    text += line + '\n';
    text += centerText('DAY END REPORT', 32) + '\n';
    text += line + '\n';
    
    text += `Outlet: ${outletName}\n`;
    text += `Date: ${origDateStr}\n`;  // ✅ Original Day End
    text += dash + '\n\n';
    
    text += centerText('SUMMARY', 32) + '\n';
    text += dash + '\n';
    text += twoColumns('Total Sales:', `${symbol}${(data.totalSales || 0).toFixed(2)}`, 32) + '\n';
    text += twoColumns('Total Discount:', `-${symbol}${(data.totalDiscount || 0).toFixed(2)}`, 32) + '\n';
    text += twoColumns('Net Sales:', `${symbol}${(data.netSales || 0).toFixed(2)}`, 32) + '\n';
    text += twoColumns('Total Items:', `${data.totalItems || 0}`, 32) + '\n';
    text += twoColumns('Transactions:', `${data.salesCount || 0}`, 32) + '\n';
    text += dash + '\n\n';
    
    text += centerText('PAYMENT BREAKDOWN', 32) + '\n';
    text += dash + '\n';
    if (data.paymentBreakdown) {
        Object.entries(data.paymentBreakdown).forEach(([method, amount]) => {
            text += twoColumns(method, `${symbol}${(amount as number).toFixed(2)}`, 32) + '\n';
        });
    }
    text += dash + '\n\n';
    
    if (data.categories && data.categories.length > 0) {
        text += centerText('CATEGORY BREAKDOWN', 32) + '\n';
        text += dash + '\n';
        data.categories.forEach((cat: any) => {
            text += `${cat.name}: ${symbol}${(cat.totalRevenue || 0).toFixed(2)} (${cat.totalQuantity || 0} items)\n`;
            if (cat.items && cat.items.length > 0) {
                cat.items.forEach((item: any) => {
                    text += `  ${item.name || 'Unknown'} x${item.quantity || 0} = ${symbol}${(item.revenue || 0).toFixed(2)}\n`;
                });
            }
            text += '\n';
        });
        text += dash + '\n\n';
    }
    
    text += centerText('END OF REPORT', 32) + '\n';
    text += line + '\n';
    text += centerText('SMARTHAWKER BY UNIPROSG', 32) + '\n';
    text += centerText(`Generated: ${nowDateStr}`, 32) + '\n';  // ✅ Current Time
    text += '\n\n\n';
    
    return text;
};
const generateDayEndHTML = (data: any, outletName: string) => {
    const symbol = '$';
    
    // ✅ ORIGINAL Day End Date - USE UTC (store panni irukkara time)
    const originalDate = data.closingDate ? new Date(data.closingDate) : new Date();
    const origDay = String(originalDate.getUTCDate()).padStart(2, '0');
    const origMonth = String(originalDate.getUTCMonth() + 1).padStart(2, '0');
    const origYear = originalDate.getUTCFullYear();
    const origHours = String(originalDate.getUTCHours()).padStart(2, '0');
    const origMinutes = String(originalDate.getUTCMinutes()).padStart(2, '0');
    const origDateStr = `${origDay}/${origMonth}/${origYear} ${origHours}:${origMinutes}`;
    
    // ✅ CURRENT Date - USE LOCAL TIME (for "Generated on")
    const now = new Date();
    const nowDay = String(now.getDate()).padStart(2, '0');
    const nowMonth = String(now.getMonth() + 1).padStart(2, '0');
    const nowYear = now.getFullYear();
    const nowHours = String(now.getHours()).padStart(2, '0');
    const nowMinutes = String(now.getMinutes()).padStart(2, '0');
    const nowDateStr = `${nowDay}/${nowMonth}/${nowYear} ${nowHours}:${nowMinutes}`;
    
    console.log('📅 Original (UTC):', origDateStr);
    console.log('📅 Current (Local):', nowDateStr);
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Day End Report</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
        .title { font-size: 24px; font-weight: bold; color: #333; }
        .subtitle { font-size: 14px; color: #666; }
        .section { margin-bottom: 20px; }
        .section-title { font-size: 18px; font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px; background: #f5f5f5; padding: 8px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #eee; }
        .amount { text-align: right; }
        .total-row { font-weight: bold; border-top: 2px solid #000; background: #f9f9f9; }
        .category-item { padding-left: 20px; }
        .category-name { font-weight: bold; font-size: 14px; }
        .item-name { padding-left: 30px; }
        .footer { margin-top: 30px; text-align: center; font-size: 12px; border-top: 1px solid #ddd; padding-top: 10px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">📊 DAY END REPORT</div>
        <div class="subtitle">${outletName || 'Outlet'}</div>
        <div class="subtitle">${origDateStr}</div>  <!-- ✅ Original Day End Time -->
    </div>
    
    <div class="section">
        <div class="section-title">📊 SUMMARY</div>
        <table>
            <tr><td><strong>Total Sales</strong></td><td class="amount"><strong>${symbol}${(data.totalSales || 0).toFixed(2)}</strong></td></tr>
            <tr><td>Total Discount</td><td class="amount" style="color: #d32f2f;">-${symbol}${(data.totalDiscount || 0).toFixed(2)}</td></tr>
            <tr class="total-row"><td><strong>Net Sales</strong></td><td class="amount"><strong>${symbol}${(data.netSales || 0).toFixed(2)}</strong></td></tr>
            <tr><td>Total Items</td><td class="amount">${data.totalItems || 0}</td></tr>
            <tr><td>Transactions</td><td class="amount">${data.salesCount || data.transactions || 0}</td></tr>
        </table>
    </div>
    
    <div class="section">
        <div class="section-title">💳 PAYMENT BREAKDOWN</div>
        <table>
            ${data.paymentBreakdown && Object.keys(data.paymentBreakdown).length > 0 ? 
                Object.entries(data.paymentBreakdown).map(([method, amount]) => `
                    <tr><td>${method}</td><td class="amount">${symbol}${(amount as number).toFixed(2)}</td></tr>
                `).join('') : 
                '<tr><td>No payment data</td><td class="amount">$0.00</td></tr>'
            }
        </table>
    </div>
    
    ${data.categories && data.categories.length > 0 ? `
    <div class="section">
        <div class="section-title">🏷️ CATEGORY BREAKDOWN</div>
        ${data.categories.map((cat: any) => `
            <div style="margin-bottom: 15px;">
                <div class="category-name">${cat.name || 'Uncategorized'} - ${symbol}${(cat.totalRevenue || 0).toFixed(2)} (${cat.totalQuantity || 0} items)</div>
                ${cat.items && cat.items.length > 0 ? `
                <table>
                    ${cat.items.map((item: any) => `
                        <tr>
                            <td class="item-name">${item.name || 'Unknown Item'}</td>
                            <td class="amount">x${item.quantity || 0}</td>
                            <td class="amount">${symbol}${(item.revenue || 0).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </table>
                ` : '<div style="padding-left: 20px; color: #999;">No items in this category</div>'}
            </div>
        `).join('')}
    </div>
    ` : ''}
    
    <div class="footer">
        <p><strong>SMARTHAWKER BY UNIPROSG</strong></p>
        <p>© ${new Date().getFullYear()} UNIPRO SOFTWARES SG PTE LTD</p>
        <p>Generated on: ${nowDateStr}</p>  <!-- ✅ Current Local Time -->
    </div>
</body>
</html>
    `;
};
const printDayEndReport = async (dayEndData: any) => {
    try {
        console.log('🖨️ Printing Day End Report...');
        console.log('📅 dayEndData received:', JSON.stringify(dayEndData, null, 2));
        
        const outletName = await AsyncStorage.getItem('selectedOutletName') || 'Outlet';
        
        // ✅ Build report data with ALL fields
        const reportData = {
            totalSales: dayEndData.totalSales || 0,
            totalDiscount: dayEndData.totalDiscount || 0,
            totalItems: dayEndData.totalItems || 0,
            netSales: dayEndData.netSales || 0,
            salesCount: dayEndData.salesCount || 0,
            paymentBreakdown: dayEndData.paymentBreakdown || {},
            categories: dayEndData.categories || [],
            closingDate: dayEndData.closingDate || dayEndData.endDate || new Date()
        };
        
        console.log('📅 Report closingDate:', reportData.closingDate);
        
        const reportText = buildDayEndReportText(reportData, outletName);
        
        const sunmiReady = await SunmiPrinterService.init();
        if (sunmiReady) {
            await SunmiPrinterService.printRawText(reportText);
            await SunmiPrinterService.cutPaper();
            console.log('✅ Day End Report printed on Sunmi');
            // ✅ Toast instead of Alert
            
            return;
        }
        
        console.log('⚠️ Sunmi not available, saving as PDF');
        const html = generateDayEndHTML(reportData, outletName);
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri);
        
        
    } catch (error) {
        console.log('❌ Print error:', error);
       
    }
};
    // ==================== REPRINT FUNCTION ====================

    const reprintDayEndReport = async (item: any) => {
    try {
        console.log('🖨️ Reprinting Day End Report...');
        
        const outletName = await AsyncStorage.getItem('selectedOutletName') || 'Outlet';
        
        // ✅ Pass ALL data including salesCount and closingDate
        const reportData = {
            totalSales: item.totalSales || 0,
            totalDiscount: item.totalDiscount || 0,
            totalItems: item.totalItems || 0,
            netSales: item.netSales || 0,
            salesCount: item.salesCount || 0,  // ✅ FIX: Transactions
            paymentBreakdown: item.paymentBreakdown || {},
            categories: item.categories || [],
            closingDate: item.closingDate  // ✅ FIX: Original day end date
        };
        
        const reportText = buildDayEndReportText(reportData, outletName);
        
        const reprintText = '='.repeat(32) + '\n' +
                           centerText('REPRINT', 32) + '\n' +
                           '='.repeat(32) + '\n\n' +
                           reportText;
        
        const sunmiReady = await SunmiPrinterService.init();
        if (sunmiReady) {
            await SunmiPrinterService.printRawText(reprintText);
            await SunmiPrinterService.cutPaper();
            console.log('✅ Day End Report reprinted on Sunmi');
            Alert.alert('🖨️ Success', 'Report reprinted successfully!');
            return;
        }
        
        console.log('⚠️ Sunmi not available, saving as PDF');
        const html = generateDayEndHTML(reportData, outletName);
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri);
        Alert.alert('📄 PDF Saved', 'Report saved as PDF');
        
    } catch (error) {
        console.log('❌ Reprint error:', error);
        Alert.alert('Error', 'Failed to reprint');
    }
};

    // ==================== EMAIL FUNCTIONS ====================

  const generateCSVData = (item: any, outletName?: string) => {
    // ✅ ORIGINAL Day End Date (UTC)
    const originalDate = item.closingDate ? new Date(item.closingDate) : new Date();
    const origDay = String(originalDate.getUTCDate()).padStart(2, '0');
    const origMonth = String(originalDate.getUTCMonth() + 1).padStart(2, '0');
    const origYear = originalDate.getUTCFullYear();
    const origHours = String(originalDate.getUTCHours()).padStart(2, '0');
    const origMinutes = String(originalDate.getUTCMinutes()).padStart(2, '0');
    const origDateStr = `${origDay}/${origMonth}/${origYear} ${origHours}:${origMinutes}`;
    
    // ✅ CURRENT Date (Generated on)
    const now = new Date();
    const nowDay = String(now.getDate()).padStart(2, '0');
    const nowMonth = String(now.getMonth() + 1).padStart(2, '0');
    const nowYear = now.getFullYear();
    const nowHours = String(now.getHours()).padStart(2, '0');
    const nowMinutes = String(now.getMinutes()).padStart(2, '0');
    const nowDateStr = `${nowDay}/${nowMonth}/${nowYear} ${nowHours}:${nowMinutes}`;
    
    // ✅ Use passed outletName or fallback
    const name = outletName || item.outletName || 'Outlet';
    const symbol = '$';
    
    let csv = '';
    
    // ============ HEADER ============
    csv += 'DAY END REPORT\n';
    csv += `Outlet,${name}\n`;  // ✅ Now shows "GOA"
    csv += `Date,${origDateStr}\n`;
    csv += '\n';
    
    // ============ SUMMARY ============
    csv += 'SUMMARY\n';
    csv += `Total Sales,${symbol}${(item.totalSales || 0).toFixed(2)}\n`;
    csv += `Total Discount,-${symbol}${(item.totalDiscount || 0).toFixed(2)}\n`;
    csv += `Net Sales,${symbol}${(item.netSales || 0).toFixed(2)}\n`;
    csv += `Total Items,${item.totalItems || 0}\n`;
    csv += `Transactions,${item.salesCount || 0}\n`;
    csv += '\n';
    
    // ============ PAYMENT BREAKDOWN ============
    csv += 'PAYMENT BREAKDOWN\n';
    if (item.paymentBreakdown && Object.keys(item.paymentBreakdown).length > 0) {
        Object.entries(item.paymentBreakdown).forEach(([method, amount]) => {
            csv += `${method},${symbol}${(amount as number).toFixed(2)}\n`;
        });
    } else {
        csv += 'No payment data,$0.00\n';
    }
    csv += '\n';
    
    // ============ CATEGORY BREAKDOWN ============
    csv += 'CATEGORY BREAKDOWN\n';
    if (item.categories && item.categories.length > 0) {
        item.categories.forEach((cat: any) => {
            // Category header
            csv += `${cat.name || 'Uncategorized'},${symbol}${(cat.totalRevenue || 0).toFixed(2)},${cat.totalQuantity || 0} items\n`;
            
            // Category items
            if (cat.items && cat.items.length > 0) {
                cat.items.forEach((item: any) => {
                    csv += `  ${item.name || 'Unknown Item'},x${item.quantity || 0},${symbol}${(item.revenue || 0).toFixed(2)}\n`;
                });
            } else {
                csv += `  No items in this category\n`;
            }
        });
    } else {
        csv += 'No category data\n';
    }
    csv += '\n';
    
    // ============ FOOTER ============
    csv += `SMARTHAWKER BY UNIPROSG\n`;
    csv += `Generated on,${nowDateStr}\n`;
    
    return csv;
};

    // ✅ Send Email via Backend API
const sendEmailReport = async (item: any, email: string) => {
    try {
        setEmailLoading(true);
          await AsyncStorage.setItem('lastEmailAddress', email);
        setSavedEmail(email);
        console.log('💾 Email saved to storage:', email);
        const outletName = await AsyncStorage.getItem('selectedOutletName') || 'Outlet';
        const dateStr = new Date(item.closingDate).toLocaleDateString();
        const cashierName = item.closedBy || 'Admin';
        
       
        const reportData = {
            totalSales: item.totalSales || 0,
            totalDiscount: item.totalDiscount || 0,
            totalItems: item.totalItems || 0,
            netSales: item.netSales || 0,
            salesCount: item.salesCount || 0,
            paymentBreakdown: item.paymentBreakdown || {},
            categories: item.categories || [],
            closingDate: item.closingDate,
            outletName: outletName
        };
        
        // ✅ Generate PDF
        const html = generateDayEndHTML(reportData, outletName);
        const pdfUri = await Print.printToFileAsync({ html });
        
        // ✅ Read PDF as base64
        const response = await fetch(pdfUri.uri);
        const blob = await response.blob();
        const pdfBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.readAsDataURL(blob);
        });
        
        // ✅ Generate CSV
        const csvData = generateCSVData(reportData, outletName);
        
        // ✅ Send via Backend API
        const apiResponse = await API.post('/email/send-settlement-email', {
            to: email,
            subject: `Day End Report - ${outletName} - ${dateStr}`,
            pdfBase64: pdfBase64,
            csvData: csvData,
            outletName: outletName,
            cashierName: cashierName,
            date: dateStr
        });
        
        if (apiResponse.data.success) {
            Alert.alert('✅ Success', 'Email sent successfully!');
        }
        
    } catch (error: any) {
        console.log('❌ Email error:', error);
        Alert.alert('❌ Error', error.response?.data?.error || 'Failed to send email');
    } finally {
        setEmailLoading(false);
        setShowEmailModal(false);
        setEmailAddress('');
        setSelectedHistoryItem(null);
    }
};
    // ==================== RENDER EMAIL MODAL ====================

    const renderEmailModal = () => {
    return (
        <Modal
            visible={showEmailModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => {
                setShowEmailModal(false);
                // ✅ Don't clear emailAddress - keep it for next time
                setSelectedHistoryItem(null);
            }}
        >
            <View style={styles.emailModalOverlay}>
                <View style={[styles.emailModalContent, { backgroundColor: theme.card }]}>
                    
                    <View style={styles.emailModalHeader}>
                        <Ionicons name="mail-outline" size={28} color={theme.primary} />
                        <Text style={[styles.emailModalTitle, { color: theme.text }]}>
                            Send Report via Email
                        </Text>
                    </View>
                    
                    <View style={[styles.emailModalInfo, { backgroundColor: theme.surface }]}>
                        <Text style={[styles.emailModalInfoText, { color: theme.textSecondary }]}>
                            📁 {selectedHistoryItem?.totalSales || 0} sales
                        </Text>
                        <Text style={[styles.emailModalInfoText, { color: theme.textSecondary }]}>
                            📅 {selectedHistoryItem?.closingDate ? new Date(selectedHistoryItem.closingDate).toLocaleDateString() : ''}
                        </Text>
                    </View>
                    
                    <Text style={[styles.emailModalLabel, { color: theme.textSecondary }]}>
                        Recipient Email Address *
                    </Text>
                    <TextInput
                        style={[styles.emailModalInput, { 
                            backgroundColor: theme.surface,
                            color: theme.text,
                            borderColor: theme.border
                        }]}
                        placeholder="Enter email address"
                        placeholderTextColor={theme.textSecondary}
                        value={emailAddress}  // ✅ Auto-filled from savedEmail
                        onChangeText={setEmailAddress}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    
                    {/* ✅ Show saved email hint */}
                    {savedEmail && emailAddress === savedEmail && (
                        <Text style={[styles.emailModalHint, { color: theme.primary }]}>
                            📌 Using previously used email: {savedEmail}
                        </Text>
                    )}
                    
                    <Text style={[styles.emailModalHint, { color: theme.textSecondary }]}>
                        📎 PDF and Excel files will be attached
                    </Text>
                    
                    <View style={styles.emailModalButtons}>
                        <TouchableOpacity
                            style={[styles.emailModalBtn, styles.emailModalCancel, { borderColor: theme.border }]}
                            onPress={() => {
                                setShowEmailModal(false);
                                // ✅ Don't clear email
                                setSelectedHistoryItem(null);
                            }}
                            disabled={emailLoading}
                        >
                            <Text style={[styles.emailModalBtnText, { color: theme.text }]}>Cancel</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                            style={[
                                styles.emailModalBtn, 
                                styles.emailModalSend, 
                                { 
                                    backgroundColor: theme.primary,
                                    opacity: (!emailAddress.trim() || !emailAddress.includes('@')) ? 0.5 : 1
                                }
                            ]}
                            onPress={() => {
                                if (!emailAddress.trim()) {
                                    Alert.alert('Error', 'Please enter email address');
                                    return;
                                }
                                if (!emailAddress.includes('@')) {
                                    Alert.alert('Error', 'Please enter a valid email address');
                                    return;
                                }
                                sendEmailReport(selectedHistoryItem, emailAddress);
                            }}
                            disabled={emailLoading || !emailAddress.trim() || !emailAddress.includes('@')}
                        >
                            {emailLoading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="send-outline" size={18} color="#fff" />
                                    <Text style={styles.emailModalSendText}>Send</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};
    // ==================== PERFORM DAY END ====================

    const performDayEnd = async () => {
        setProcessing(true);
        try {
            const response = await API.post('/dayend/end', {});
            
            if (response.data.success) {
                const dayEndData = response.data.dayEnd;
                
                Alert.alert(
                    '✅ Day End Complete',
                    `Total: ${formatPrice(dayEndData.totalSales)}\n` +
                    `Net: ${formatPrice(dayEndData.netSales)}`
                );
                
                await printDayEndReport(dayEndData);
                
                setIsDayEnded(true);
                setDayEndData({
                    totalSales: 0,
                    totalDiscount: 0,
                    totalItems: 0,
                    netSales: 0,
                    paymentBreakdown: {},
                    salesCount: 0,
                    categories: []
                });
                
                await loadDayEndHistory();
                onDayEndComplete();
            }
            
        } catch (error: any) {
            Alert.alert('Error', 'Failed to end day');
        } finally {
            setProcessing(false);
        }
    };

    // ==================== RENDER FUNCTIONS ====================

    // ... (renderCategories, renderPendingTab, renderHistoryTab remain the same)
    // But update renderHistoryTab to add reprint and email buttons

    const renderHistoryTab = () => {
        if (historyLoading) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                        Loading history...
                    </Text>
                </View>
            );
        }

        if (dayEndHistory.length === 0) {
            return (
                <View style={[styles.noSalesCard, { backgroundColor: theme.surface }]}>
                    <Ionicons name="document-text-outline" size={50} color={theme.textSecondary} />
                    <Text style={[styles.noSalesText, { color: theme.textSecondary, marginTop: 10 }]}>
                        No day end history found
                    </Text>
                </View>
            );
        }

        return (
            <FlatList
                data={dayEndHistory}
                keyExtractor={(item) => item.id.toString()}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={styles.historyList}
                renderItem={({ item }) => {
                    const closing = formatUTCTime(item.closingDate);
                    const opening = formatUTCTime(item.openingDate);
                    const createdAt = formatUTCTime(item.createdAt);
                    const hasCategories = item.categories && item.categories.length > 0;
                    
                    return (
                        <TouchableOpacity
                            style={[styles.historyCard, { backgroundColor: theme.surface }]}
                            onPress={() => setSelectedHistory(selectedHistory?.id === item.id ? null : item)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.historyHeader}>
                                <View style={styles.historyDateContainer}>
                                    <Ionicons name="calendar" size={16} color={theme.primary} />
                                    <Text style={[styles.historyDate, { color: theme.text }]}>
                                        {closing.date}
                                    </Text>
                                </View>
                                <View style={styles.historyTimeContainer}>
                                    <Ionicons name="time" size={14} color={theme.textSecondary} />
                                    <Text style={[styles.historyTime, { color: theme.textSecondary }]}>
                                        {closing.time}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.historySummary}>
                                <View style={styles.historyStat}>
                                    <Text style={[styles.historyStatLabel, { color: theme.textSecondary }]}>
                                        Sales
                                    </Text>
                                    <Text style={[styles.historyStatValue, { color: theme.primary }]}>
                                        {item.totalSales || 0}
                                    </Text>
                                </View>
                                <View style={styles.historyStat}>
                                    <Text style={[styles.historyStatLabel, { color: theme.textSecondary }]}>
                                        Net
                                    </Text>
                                    <Text style={[styles.historyStatValue, { color: theme.success }]}>
                                        {formatPrice(item.netSales || 0)}
                                    </Text>
                                </View>
                                <View style={styles.historyStat}>
                                    <Text style={[styles.historyStatLabel, { color: theme.textSecondary }]}>
                                        Items
                                    </Text>
                                    <Text style={[styles.historyStatValue, { color: theme.text }]}>
                                        {item.totalItems || 0}
                                    </Text>
                                </View>
                            </View>

                            <Text style={[styles.historyClosedBy, { color: theme.textSecondary }]}>
                                Closed at: {createdAt.date} 
                            </Text>

                            {selectedHistory?.id === item.id && (
                                <View style={[styles.historyDetails, { borderTopColor: theme.border }]}>
                                    <View style={styles.historyDetailRow}>
                                        <Text style={[styles.historyDetailLabel, { color: theme.textSecondary }]}>
                                            Opening:
                                        </Text>
                                        <Text style={[styles.historyDetailValue, { color: theme.text }]}>
                                            {opening.date} {opening.time}
                                        </Text>
                                    </View>
                                    <View style={styles.historyDetailRow}>
                                        <Text style={[styles.historyDetailLabel, { color: theme.textSecondary }]}>
                                            Closing:
                                        </Text>
                                        <Text style={[styles.historyDetailValue, { color: theme.text }]}>
                                            {closing.date} {closing.time}
                                        </Text>
                                    </View>
                                    <View style={styles.historyDetailRow}>
                                        <Text style={[styles.historyDetailLabel, { color: theme.textSecondary }]}>
                                            Total Discount:
                                        </Text>
                                        <Text style={[styles.historyDetailValue, { color: theme.danger }]}>
                                            -{formatPrice(item.totalDiscount || 0)}
                                        </Text>
                                    </View>

                                    {hasCategories && (
                                        <View style={styles.historyCategoriesCard}>
                                            <Text style={[styles.historyCategoriesTitle, { color: theme.text }]}>
                                                🏷️ Category Breakdown
                                            </Text>
                                            
                                            {item.categories.map((category: any, catIndex: number) => (
                                                <View key={`history-cat-${catIndex}`} style={styles.historyCategoryItem}>
                                                    <TouchableOpacity
                                                        style={styles.historyCategoryHeader}
                                                        onPress={() => setExpandedHistoryCategory(
                                                            expandedHistoryCategory === `${item.id}-${category.name}` 
                                                                ? null 
                                                                : `${item.id}-${category.name}`
                                                        )}
                                                        activeOpacity={0.7}
                                                    >
                                                        <View style={styles.historyCategoryHeaderLeft}>
                                                            <Text style={[styles.historyCategoryName, { color: theme.text }]}>
                                                                {category.name}
                                                            </Text>
                                                            <View style={[styles.historyCategoryBadge, { backgroundColor: theme.primary + '20' }]}>
                                                                <Text style={[styles.historyCategoryBadgeText, { color: theme.primary }]}>
                                                                    {category.totalQuantity} items
                                                                </Text>
                                                            </View>
                                                        </View>
                                                        <View style={styles.historyCategoryHeaderRight}>
                                                            <Text style={[styles.historyCategoryTotal, { color: theme.primary }]}>
                                                                {formatPrice(category.totalRevenue)}
                                                            </Text>
                                                            <Ionicons 
                                                                name={expandedHistoryCategory === `${item.id}-${category.name}` ? "chevron-up" : "chevron-down"} 
                                                                size={18} 
                                                                color={theme.textSecondary} 
                                                            />
                                                        </View>
                                                    </TouchableOpacity>
                                                    
                                                    {expandedHistoryCategory === `${item.id}-${category.name}` && (
                                                        <View style={styles.historyCategoryItemsList}>
                                                            {category.items.map((catItem: any, idx: number) => (
                                                                <View key={`history-cat-item-${idx}`} style={styles.historyCategoryItemRow}>
                                                                    <View style={styles.historyCategoryItemLeft}>
                                                                        <Text style={[styles.historyCategoryItemName, { color: theme.text }]}>
                                                                            {catItem.name}
                                                                        </Text>
                                                                        <Text style={[styles.historyCategoryItemQty, { color: theme.textSecondary }]}>
                                                                            x{catItem.quantity}
                                                                        </Text>
                                                                    </View>
                                                                    <Text style={[styles.historyCategoryItemRevenue, { color: theme.primary }]}>
                                                                        {formatPrice(catItem.revenue)}
                                                                    </Text>
                                                                </View>
                                                            ))}
                                                        </View>
                                                    )}
                                                </View>
                                            ))}
                                        </View>
                                    )}

                                    {item.paymentBreakdown && Object.keys(item.paymentBreakdown).length > 0 && (
                                        <View style={styles.historyPaymentBreakdown}>
                                            <Text style={[styles.historyBreakdownTitle, { color: theme.textSecondary }]}>
                                                💳 Payment Methods:
                                            </Text>
                                            {Object.entries(item.paymentBreakdown).map(([method, amount]) => {
                                                if (typeof amount === 'object') return null;
                                                return (
                                                    <View key={method} style={styles.historyBreakdownRow}>
                                                        <Text style={[styles.historyBreakdownMethod, { color: theme.text }]}>
                                                            {method}
                                                        </Text>
                                                        <Text style={[styles.historyBreakdownAmount, { color: theme.primary }]}>
                                                            {formatPrice(amount as number)}
                                                        </Text>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    )}

                                    {/* ✅ Reprint & Email Buttons */}
                                    <View style={styles.historyActionButtons}>
                                        <TouchableOpacity
                                            style={[styles.historyActionBtn, styles.reprintBtn]}
                                            onPress={() => reprintDayEndReport(item)}
                                        >
                                            <Ionicons name="print-outline" size={18} color="#fff" />
                                            <Text style={styles.historyActionBtnText}>Reprint</Text>
                                        </TouchableOpacity>
                                        
                                        <TouchableOpacity
                                            style={[styles.historyActionBtn, styles.emailBtn]}
                                            onPress={() => {
                                                setSelectedHistoryItem(item);
                                                setShowEmailModal(true);
                                            }}
                                        >
                                            <Ionicons name="mail-outline" size={18} color="#fff" />
                                            <Text style={styles.historyActionBtnText}>Email</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                }}
            />
        );
    };

    // ... (renderCategories, renderPendingTab remain the same)

    const renderCategories = () => {
        if (!dayEndData.categories || dayEndData.categories.length === 0) {
            return null;
        }

        return (
            <View style={[styles.categoriesCard, { backgroundColor: theme.surface }]}>
                <Text style={[styles.categoriesTitle, { color: theme.text }]}>
                    🏷️ Category Breakdown
                </Text>
                
                {dayEndData.categories.map((category: any, index: number) => (
                    <View key={`cat-${index}`} style={styles.categoryItem}>
                        <TouchableOpacity
                            style={styles.categoryHeader}
                            onPress={() => setExpandedCategory(expandedCategory === category.name ? null : category.name)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.categoryHeaderLeft}>
                                <Text style={[styles.categoryName, { color: theme.text }]}>
                                    {category.name}
                                </Text>
                                <View style={[styles.categoryBadge, { backgroundColor: theme.primary + '20' }]}>
                                    <Text style={[styles.categoryBadgeText, { color: theme.primary }]}>
                                        {category.totalQuantity} items
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.categoryHeaderRight}>
                                <Text style={[styles.categoryTotal, { color: theme.primary }]}>
                                    {formatPrice(category.totalRevenue)}
                                </Text>
                                <Ionicons 
                                    name={expandedCategory === category.name ? "chevron-up" : "chevron-down"} 
                                    size={20} 
                                    color={theme.textSecondary} 
                                />
                            </View>
                        </TouchableOpacity>
                        
                        {expandedCategory === category.name && (
                            <View style={styles.categoryItemsList}>
                                {category.items.map((item: any, idx: number) => (
                                    <View key={`item-${idx}`} style={styles.categoryItemRow}>
                                        <View style={styles.categoryItemLeft}>
                                            <Text style={[styles.categoryItemName, { color: theme.text }]}>
                                                {item.name}
                                            </Text>
                                            <Text style={[styles.categoryItemQty, { color: theme.textSecondary }]}>
                                                x{item.quantity}
                                            </Text>
                                        </View>
                                        <Text style={[styles.categoryItemRevenue, { color: theme.primary }]}>
                                            {formatPrice(item.revenue)}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                ))}
            </View>
        );
    };

    const renderPendingTab = () => {
        if (isDayEnded && dayEndData.salesCount === 0) {
            return (
                <View style={[styles.emptyState, { backgroundColor: theme.surface }]}>
                    <Ionicons name="checkmark-circle" size={60} color={theme.success} />
                    <Text style={[styles.emptyStateText, { color: theme.text }]}>
                        ✅ Day End Completed!
                    </Text>
                    <Text style={[styles.emptyStateSubText, { color: theme.textSecondary }]}>
                        All sales have been settled.
                    </Text>
                    <Text style={[styles.emptyStateHint, { color: theme.textSecondary }]}>
                        Make new sales to see them here
                    </Text>
                </View>
            );
        }

        if (dayEndData.salesCount === 0) {
            return (
                <View style={[styles.noSalesCard, { backgroundColor: theme.surface }]}>
                    <Text style={[styles.noSalesText, { color: theme.textSecondary }]}>
                        No sales to end day
                    </Text>
                </View>
            );
        }

        return (
            <>
                <View style={[styles.summaryCard, { backgroundColor: theme.surface }]}>
                    <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Total Sales</Text>
                        <Text style={[styles.summaryValue, { color: theme.primary }]}>{formatPrice(dayEndData.totalSales)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Total Discount</Text>
                        <Text style={[styles.summaryValue, { color: theme.danger }]}>-{formatPrice(dayEndData.totalDiscount)}</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={[styles.summaryRow, styles.netRow]}>
                        <Text style={[styles.netLabel, { color: theme.text }]}>Net Sales</Text>
                        <Text style={[styles.netValue, { color: theme.success }]}>{formatPrice(dayEndData.netSales)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Items</Text>
                        <Text style={[styles.summaryValue, { color: theme.text }]}>{dayEndData.totalItems}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Transactions</Text>
                        <Text style={[styles.summaryValue, { color: theme.text }]}>{dayEndData.salesCount}</Text>
                    </View>
                </View>

                {Object.keys(dayEndData.paymentBreakdown).length > 0 && (
                    <View style={[styles.breakdownCard, { backgroundColor: theme.surface }]}>
                        <Text style={[styles.breakdownTitle, { color: theme.text }]}>💳 Payment Breakdown</Text>
                        {Object.entries(dayEndData.paymentBreakdown).map(([method, amount], index) => (
                            <View key={index} style={styles.breakdownRow}>
                                <Text style={[styles.breakdownMethod, { color: theme.text }]}>{method}</Text>
                                <Text style={[styles.breakdownAmount, { color: theme.primary }]}>{formatPrice(amount as number)}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {renderCategories()}

                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        style={[styles.button, styles.endButton, { backgroundColor: theme.primary }]}
                        onPress={performDayEnd}
                        disabled={processing}
                    >
                        {processing ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.endButtonText}>✅ End Day</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </>
        );
    };

    // ==================== MAIN RETURN ====================

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            onRequestClose={onClose}
        >
            <SafeAreaView style={[styles.fullScreenContainer, { backgroundColor: theme.background }]}>
                <StatusBar barStyle={theme === 'night' ? 'light-content' : 'dark-content'} />
                
                <View style={[styles.fullScreenHeader, { backgroundColor: theme.primary }]}>
                    <Text style={styles.fullScreenTitle}>Day End</Text>
                    <TouchableOpacity onPress={onClose} style={styles.fullScreenClose}>
                        <Ionicons name="close" size={28} color="#fff" />
                    </TouchableOpacity>
                </View>

                <View style={[styles.tabContainer, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
                        onPress={() => {
                            setActiveTab('pending');
                            loadDayEndData();
                        }}
                    >
                        <Text style={[styles.tabText, { 
                            color: activeTab === 'pending' ? theme.primary : theme.textSecondary 
                        }]}>
                            📊 Pending
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'history' && styles.activeTab]}
                        onPress={() => {
                            setActiveTab('history');
                            loadDayEndHistory();
                        }}
                    >
                        <Text style={[styles.tabText, { 
                            color: activeTab === 'history' ? theme.primary : theme.textSecondary 
                        }]}>
                            📋 History ({dayEndHistory.length})
                        </Text>
                    </TouchableOpacity>
                </View>

                {loading && activeTab === 'pending' ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={theme.primary} />
                    </View>
                ) : activeTab === 'pending' ? (
                    <ScrollView 
                        showsVerticalScrollIndicator={true}
                        contentContainerStyle={styles.scrollContent}
                        style={{ flex: 1 }}
                    >
                        {renderPendingTab()}
                    </ScrollView>
                ) : (
                    <View style={{ flex: 1 }}>
                        {renderHistoryTab()}
                    </View>
                )}
                
                {renderEmailModal()}
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    // ... all existing styles ...
    fullScreenContainer: {
        flex: 1,
    },
    fullScreenHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        paddingTop: 16,
    },
    fullScreenTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    fullScreenClose: {
        padding: 8,
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabContainer: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        paddingHorizontal: 16,
    },
    tab: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: '#4CAF50',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 30,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    loadingText: {
        marginTop: 10,
        fontSize: 14,
    },
    summaryCard: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    summaryLabel: {
        fontSize: 14,
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '600',
    },
    summaryDivider: {
        height: 1,
        backgroundColor: 'rgba(0,0,0,0.1)',
        marginVertical: 8,
    },
    netRow: {
        paddingVertical: 10,
    },
    netLabel: {
        fontSize: 16,
        fontWeight: '700',
    },
    netValue: {
        fontSize: 20,
        fontWeight: '800',
    },
    breakdownCard: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    breakdownTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
    },
    breakdownRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    breakdownMethod: {
        fontSize: 14,
        fontWeight: '500',
    },
    breakdownAmount: {
        fontSize: 14,
        fontWeight: '600',
    },
    buttonContainer: {
        marginTop: 10,
        marginBottom: 20,
    },
    button: {
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    endButton: {
        elevation: 2,
    },
    endButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    noSalesCard: {
        padding: 30,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 16,
    },
    noSalesText: {
        fontSize: 14,
    },
    emptyState: {
        padding: 30,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyStateText: {
        fontSize: 20,
        fontWeight: '700',
        marginTop: 12,
    },
    emptyStateSubText: {
        fontSize: 14,
        marginTop: 8,
        textAlign: 'center',
    },
    emptyStateHint: {
        fontSize: 13,
        marginTop: 12,
        textAlign: 'center',
        fontStyle: 'italic',
    },
    categoriesCard: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    categoriesTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
    },
    categoryItem: {
        marginBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
        paddingBottom: 8,
    },
    categoryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    categoryHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    categoryName: {
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
    },
    categoryBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
    },
    categoryBadgeText: {
        fontSize: 10,
        fontWeight: '600',
    },
    categoryHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    categoryTotal: {
        fontSize: 14,
        fontWeight: '600',
    },
    categoryItemsList: {
        paddingLeft: 16,
        paddingTop: 8,
    },
    categoryItemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
    },
    categoryItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    categoryItemName: {
        fontSize: 13,
        flex: 1,
    },
    categoryItemQty: {
        fontSize: 12,
    },
    categoryItemRevenue: {
        fontSize: 13,
        fontWeight: '500',
    },
    historyList: {
        padding: 16,
        paddingBottom: 20,
    },
    historyCard: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 10,
    },
    historyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    historyDateContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    historyDate: {
        fontSize: 14,
        fontWeight: '600',
    },
    historyTimeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    historyTime: {
        fontSize: 12,
    },
    historySummary: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 10,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
        marginBottom: 8,
    },
    historyStat: {
        alignItems: 'center',
    },
    historyStatLabel: {
        fontSize: 11,
    },
    historyStatValue: {
        fontSize: 16,
        fontWeight: '700',
    },
    historyClosedBy: {
        fontSize: 11,
        textAlign: 'center',
    },
    historyDetails: {
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
    },
    historyDetailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    historyDetailLabel: {
        fontSize: 12,
    },
    historyDetailValue: {
        fontSize: 12,
        fontWeight: '500',
    },
    historyCategoriesCard: {
        marginTop: 8,
        padding: 12,
        borderRadius: 8,
        backgroundColor: 'rgba(0,0,0,0.03)',
    },
    historyCategoriesTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    historyCategoryItem: {
        marginBottom: 6,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
        paddingBottom: 6,
    },
    historyCategoryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
    },
    historyCategoryHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
    },
    historyCategoryName: {
        fontSize: 13,
        fontWeight: '600',
        flex: 1,
    },
    historyCategoryBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    historyCategoryBadgeText: {
        fontSize: 9,
        fontWeight: '600',
    },
    historyCategoryHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    historyCategoryTotal: {
        fontSize: 13,
        fontWeight: '600',
    },
    historyCategoryItemsList: {
        paddingLeft: 12,
        paddingTop: 4,
    },
    historyCategoryItemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 3,
    },
    historyCategoryItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
    },
    historyCategoryItemName: {
        fontSize: 12,
        flex: 1,
    },
    historyCategoryItemQty: {
        fontSize: 11,
    },
    historyCategoryItemRevenue: {
        fontSize: 12,
        fontWeight: '500',
    },
    historyPaymentBreakdown: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
    },
    historyBreakdownTitle: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4,
    },
    historyBreakdownRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 3,
    },
    historyBreakdownMethod: {
        fontSize: 12,
    },
    historyBreakdownAmount: {
        fontSize: 12,
        fontWeight: '500',
    },
    // ✅ Action Buttons
    historyActionButtons: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
    },
    historyActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 8,
    },
    reprintBtn: {
        backgroundColor: '#4CAF50',
    },
    emailBtn: {
        backgroundColor: '#2196F3',
    },
    historyActionBtnText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    // ✅ Email Modal Styles
    emailModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    emailModalContent: {
        width: '100%',
        maxWidth: 400,
        borderRadius: 20,
        padding: 24,
    },
    emailModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 16,
    },
    emailModalTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    emailModalInfo: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        padding: 12,
        borderRadius: 10,
        marginBottom: 16,
    },
    emailModalInfoText: {
        fontSize: 13,
        fontWeight: '500',
    },
    emailModalLabel: {
        fontSize: 14,
        marginBottom: 6,
    },
    emailModalInput: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 14,
        fontSize: 15,
        marginBottom: 8,
    },
    emailModalHint: {
        fontSize: 12,
        marginBottom: 20,
        textAlign: 'center',
    },
    emailModalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    emailModalBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    emailModalCancel: {
        borderWidth: 1,
    },
    emailModalSend: {
        elevation: 2,
    },
    emailModalBtnText: {
        fontSize: 16,
        fontWeight: '600',
    },
    emailModalSendText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default DayEndModal;