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
import BillPDFGenerator from './BillPDFGenerator';

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
    const parseRawDateTime = (dateInput: any) => {
        if (!dateInput) return { day: '00', month: '00', year: '0000', hours: '00', minutes: '00', dateStr: '00/00/0000 00:00', monthName: 'Jan' };
        
        try {
            let date: Date;
            if (dateInput instanceof Date) {
                date = dateInput;
            } else {
                let str = String(dateInput).trim();
                // If it doesn't have a timezone offset (ends with Z, or contains +xx:xx or -xx:xx)
                if (!str.endsWith('Z') && !str.match(/[+-]\d{2}:?\d{2}$/)) {
                    if (str.includes(' ')) {
                        str = str.replace(' ', 'T');
                    }
                    str = str + '+08:00';
                }
                date = new Date(str);
            }
            
            // Format to Singapore timezone
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
            const parts = formatter.formatToParts(date);
            const day = parts.find(p => p.type === 'day')?.value || '00';
            const month = parts.find(p => p.type === 'month')?.value || '00';
            const yearStr = parts.find(p => p.type === 'year')?.value || '0000';
            const hour = parts.find(p => p.type === 'hour')?.value || '00';
            const minute = parts.find(p => p.type === 'minute')?.value || '00';
            
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const mIdx = parseInt(month, 10) - 1;
            const monthName = monthNames[mIdx] || 'Jan';
            
            return {
                day,
                month,
                year: parseInt(yearStr, 10),
                hours: hour,
                minutes: minute,
                dateStr: `${day}/${month}/${yearStr} ${hour}:${minute}`,
                monthName
            };
        } catch (e) {
            console.log('Error parsing date to SG time in DayEndModal:', e);
            return { day: '00', month: '00', year: '0000', hours: '00', minutes: '00', dateStr: '00/00/0000 00:00', monthName: 'Jan' };
        }
    };

    const formatUTCTime = (dateString: string) => {
        const parsed = parseRawDateTime(dateString);
        return {
            date: `${parsed.day} ${parsed.monthName} ${parsed.year}`,
            time: `${parsed.hours}:${parsed.minutes}`
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
    const parsedOriginal = parseRawDateTime(data.closingDate);
    const origDateStr = parsedOriginal.dateStr;
    
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

const buildDayEndReportText80mm = (data: any, outletName: string) => {
    const symbol = '$';
    const line = '='.repeat(48);
    const dash = '-'.repeat(48);
    
    // ✅ ORIGINAL Day End Date - USE data.closingDate
    const parsedOriginal = parseRawDateTime(data.closingDate);
    const origDateStr = parsedOriginal.dateStr;
    
    // ✅ CURRENT Date (Generated on)
    const now = new Date();
    const nowDay = String(now.getDate()).padStart(2, '0');
    const nowMonth = String(now.getMonth() + 1).padStart(2, '0');
    const nowYear = now.getFullYear();
    const nowHours = String(now.getHours()).padStart(2, '0');
    const nowMinutes = String(now.getMinutes()).padStart(2, '0');
    const nowDateStr = `${nowDay}/${nowMonth}/${nowYear} ${nowHours}:${nowMinutes}`;
    
    let text = '\n\n';
    text += line + '\n';
    text += centerText('DAY END REPORT', 48) + '\n';
    text += line + '\n';
    
    text += `Outlet: ${outletName}\n`;
    text += `Date: ${origDateStr}\n`;  // ✅ Original Day End
    text += dash + '\n\n';
    
    text += centerText('SUMMARY', 48) + '\n';
    text += dash + '\n';
    text += twoColumns('Total Sales:', `${symbol}${(data.totalSales || 0).toFixed(2)}`, 48) + '\n';
    text += twoColumns('Total Discount:', `-${symbol}${(data.totalDiscount || 0).toFixed(2)}`, 48) + '\n';
    text += twoColumns('Net Sales:', `${symbol}${(data.netSales || 0).toFixed(2)}`, 48) + '\n';
    text += twoColumns('Total Items:', `${data.totalItems || 0}`, 48) + '\n';
    text += twoColumns('Transactions:', `${data.salesCount || 0}`, 48) + '\n';
    text += dash + '\n\n';
    
    text += centerText('PAYMENT BREAKDOWN', 48) + '\n';
    text += dash + '\n';
    if (data.paymentBreakdown) {
        Object.entries(data.paymentBreakdown).forEach(([method, amount]) => {
            text += twoColumns(method, `${symbol}${(amount as number).toFixed(2)}`, 48) + '\n';
        });
    }
    text += dash + '\n\n';
    
    if (data.categories && data.categories.length > 0) {
        text += centerText('CATEGORY BREAKDOWN', 48) + '\n';
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
    
    text += centerText('END OF REPORT', 48) + '\n';
    text += line + '\n';
    text += centerText('SMARTHAWKER BY UNIPROSG', 48) + '\n';
    text += centerText(`Generated: ${nowDateStr}`, 48) + '\n';  // ✅ Current Time
    text += '\n\n\n';
    
    return text;
};

const generateDayEndHTML = (data: any, outletName: string) => {
    const symbol = '$';
    const parsedOriginal = parseRawDateTime(data.closingDate);
    const origDateStr = parsedOriginal.dateStr;
    
    const printTimeStr = new Date().toLocaleString('en-SG', { 
      timeZone: 'Asia/Singapore',
      dateStyle: 'medium',
      timeStyle: 'medium'
    });
    
    // 2. Aggregate all items from categories to get "TOP SELLING PRODUCTS"
    const aggregatedItemsMap = new Map();
    const categories = data.categories || [];
    categories.forEach((cat: any) => {
      const catItems = cat.items || [];
      catItems.forEach((item: any) => {
        const key = item.name;
        if (!aggregatedItemsMap.has(key)) {
          aggregatedItemsMap.set(key, {
            name: item.name,
            category: cat.name || 'Uncategorized',
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
    const overallRevenue = data.totalSales || categories.reduce((sum: number, cat: any) => sum + (cat.totalRevenue || 0), 0);
    
    // 3. Category Contribution Analysis
    const categoryContribution = categories.map((cat: any) => {
      const contributionPercent = overallRevenue > 0 ? (cat.totalRevenue / overallRevenue) * 100 : 0;
      return {
        name: cat.name || 'Uncategorized',
        qtySold: cat.totalQuantity || 0,
        revenue: cat.totalRevenue || 0,
        contribution: contributionPercent
      };
    }).sort((a: any, b: any) => b.revenue - a.revenue);
    
    const catContributionTotalQty = categoryContribution.reduce((sum: number, c: any) => sum + c.qtySold, 0);
    const catContributionTotalRev = categoryContribution.reduce((sum: number, c: any) => sum + c.revenue, 0);
    
    // 4. Payment breakdown mapping
    const rawPayment = data.paymentBreakdown || {};
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
    const totalSales = data.salesCount || data.transactions || 0;
    const totalOrders = totalSales;
    const avgOrderValue = totalOrders > 0 ? overallRevenue / totalOrders : 0;
    const totalDiscount = data.totalDiscount || 0;
    const netSales = data.netSales || (overallRevenue - totalDiscount);
    
    // 6. Conic gradient styling for donut chart
    let gradientParts = [];
    let currentAngle = 0;
    const colors = ['#FF7A00', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#F59E0B', '#6366F1'];
    paymentList.forEach((p, idx) => {
      const percentage = p.percentage;
      if (percentage > 0) {
        const nextAngle = currentAngle + (percentage * 3.6);
        const color = colors[idx % colors.length];
        gradientParts.push(`${color} ${currentAngle.toFixed(1)}deg ${nextAngle.toFixed(1)}deg`);
        currentAngle = nextAngle;
      }
    });
    const conicGradientStyle = gradientParts.length > 0 
      ? `background: conic-gradient(${gradientParts.join(', ')});`
      : 'background: #e2e8f0;';
      
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
    
    const avgDishPrice = catContributionTotalQty > 0 ? (overallRevenue / catContributionTotalQty) : 0;
    const avgItemsPerBill = totalSales > 0 ? (catContributionTotalQty / totalSales) : 0;
    const generatedBy = data.closedBy || 'Admin';
    
    const maxCatRevenue = Math.max(...categoryContribution.map((c: any) => c.revenue), 1);
    
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
      color: #10B981;
    }
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
      justify-content: space-around;
      align-items: flex-end;
      height: 110px;
      padding: 10px 5px 5px;
      position: relative;
    }
    .trend-bar-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 15%;
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
      max-width: 40px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
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
      grid-template-columns: 1fr;
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
              <div class="logo-text">${outletName || 'MY CLUB'}</div>
              <div class="logo-tagline">Smart Hawker, Smarter Business</div>
            </div>
          </div>
        </td>
        <td class="header-divider-cell">
          <div class="header-divider"></div>
        </td>
        <td class="header-title-cell">
          <h1 class="report-title">DAY END REPORT</h1>
          <div class="report-subtitle">Real-time business intelligence dashboard</div>
        </td>
        <td class="header-meta-cell">
          <div class="meta-item"><span class="meta-label">Report Date:</span> <span class="meta-value">${origDateStr}</span></div>
          <div class="meta-item"><span class="meta-label">Generated On:</span> <span class="meta-value">${printTimeStr}</span></div>
          <div class="meta-item"><span class="meta-label">Generated By:</span> <span class="meta-value">${generatedBy}</span></div>
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
          <div class="metric-change">100% Volume</div>
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
          <div class="metric-change">Transactions Count</div>
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
          <div class="metric-change">AOV Metric</div>
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
          <div class="metric-change">After Discount</div>
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
        <div class="metric-value">${data.totalItems || 0}</div>
        <div class="metric-footer">
          <div class="metric-change">Quantity Sold</div>
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
          <div class="metric-change">Discounts Given</div>
          <svg class="metric-icon-svg" viewBox="0 0 30 15">
            <rect x="0" y="13" width="5" height="2" fill="#10B981" rx="1"/>
            <rect x="8" y="10" width="5" height="5" fill="#10B981" rx="1"/>
            <rect x="16" y="8" width="5" height="7" fill="#10B981" rx="1"/>
            <rect x="24" y="6" width="5" height="9" fill="#10B981" rx="1"/>
          </svg>
        </div>
      </div>
    </div>
    
    <!-- Sales by Category Vertical & Payment Breakdown Row -->
    <div class="layout-grid">
      <!-- Category Vertical Bars Card -->
      <div class="card-box">
        <div class="card-title">Category Revenue</div>
        <div class="trend-chart-container">
          ${categoryContribution.slice(0, 5).map((cat: any, idx: number) => {
            const heightPercent = maxCatRevenue > 0 ? (cat.revenue / maxCatRevenue) * 100 : 0;
            return `
              <div class="trend-bar-wrapper">
                <div class="trend-bar" style="height: ${heightPercent.toFixed(1)}%;">
                  <span class="trend-bar-value">${symbol}${cat.revenue.toFixed(0)}</span>
                </div>
                <div class="trend-bar-label" title="${cat.name}">${cat.name}</div>
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
            <div class="donut-chart" style="${conicGradientStyle}">
              <div class="donut-center"></div>
            </div>
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
            <td class="op-value" style="color: #10B981; font-weight: 800;">${symbol}${netSales.toFixed(2)}</td>
          </tr>
        </table>
      </div>
    </div>
    
    <!-- Footer Table -->
    <table class="page-footer-table">
      <tr>
        <td style="text-align: left;">Report Period: ${origDateStr} | Printed: ${printTimeStr}</td>
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
              <div class="logo-text">${outletName || 'MY CLUB'}</div>
              <div class="logo-tagline">Smart Hawker, Smarter Business</div>
            </div>
          </div>
        </td>
        <td class="header-divider-cell">
          <div class="header-divider"></div>
        </td>
        <td class="header-title-cell">
          <h1 class="report-title">DAY END REPORT</h1>
          <div class="report-subtitle">Real-time business intelligence dashboard</div>
        </td>
        <td class="header-meta-cell">
          <div class="meta-item"><span class="meta-label">Report Date:</span> <span class="meta-value">${origDateStr}</span></div>
          <div class="meta-item"><span class="meta-label">Generated On:</span> <span class="meta-value">${printTimeStr}</span></div>
          <div class="meta-item"><span class="meta-label">Generated By:</span> <span class="meta-value">${generatedBy}</span></div>
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
          <td class="text-right" style="color: #FF7A00;">${symbol}${netSales.toFixed(2)}</td>
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
        <td style="text-align: left;">Report Period: ${origDateStr} | Printed: ${printTimeStr}</td>
        <td style="text-align: right;">Page 2 of 2</td>
      </tr>
    </table>
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
        
        // 1. Try Network Printer first if enabled
        try {
            const company = await BillPDFGenerator.loadSettings(outletId);
            if (company && company.networkPrinterEnabled && company.networkPrinterIP) {
                console.log('📡 Route DayEnd report to Network Printer IP:', company.networkPrinterIP);
                try {
                    const ThermalPrinter = require('react-native-thermal-printer');
                    const ThermalPrinterModule = ThermalPrinter ? (ThermalPrinter.default || ThermalPrinter) : null;
                    const { NativeModules } = require('react-native');
                    const hasNativeModule = !!(NativeModules.ThermalPrinter || NativeModules.ThermalPrinterModule);

                    if (!ThermalPrinterModule || !hasNativeModule) {
                        throw new Error('react-native-thermal-printer native module not available (e.g. running in Expo Go)');
                    }
                    const reportText80mm = buildDayEndReportText80mm(reportData, outletName);
                    await ThermalPrinterModule.printTcp({
                        ip: company.networkPrinterIP,
                        port: 9100,
                        payload: reportText80mm,
                        autoCut: true,
                        openCashbox: false,
                    });
                    console.log('✅ Day End Report printed on Network Printer');
                    return;
                } catch (netErr) {
                    console.log('⚠️ Network Printer printing failed:', netErr);
                }
                
                // Fallback to PDF directly if network printer fails
                console.log('⚠️ Network printer failed, saving as PDF');
                const html = generateDayEndHTML(reportData, outletName);
                const { uri } = await Print.printToFileAsync({ html });
                await Sharing.shareAsync(uri);
                return;
            }
        } catch (loadErr) {
            console.log('⚠️ Error loading settings for network printer check:', loadErr);
        }

        // 2. Try Sunmi printer if network is disabled
        const sunmiReady = await SunmiPrinterService.init();
        if (sunmiReady) {
            await SunmiPrinterService.printRawText(reportText);
            await SunmiPrinterService.cutPaper();
            console.log('✅ Day End Report printed on Sunmi');
            return;
        }
        
        console.log('⚠️ No physical printer available, saving as PDF');
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
        
        // 1. Try Network Printer first if enabled
        try {
            const company = await BillPDFGenerator.loadSettings(outletId);
            if (company && company.networkPrinterEnabled && company.networkPrinterIP) {
                console.log('📡 Route DayEnd reprint to Network Printer IP:', company.networkPrinterIP);
                try {
                    const ThermalPrinter = require('react-native-thermal-printer');
                    const ThermalPrinterModule = ThermalPrinter ? (ThermalPrinter.default || ThermalPrinter) : null;
                    
                    const { NativeModules } = require('react-native');
                    const hasNativeModule = !!(NativeModules.ThermalPrinter || NativeModules.ThermalPrinterModule);

                    if (!ThermalPrinterModule || !hasNativeModule) {
                        throw new Error('react-native-thermal-printer native module not available (e.g. running in Expo Go)');
                    }
                    const reprintText80mm = '='.repeat(48) + '\n' +
                                       centerText('REPRINT', 48) + '\n' +
                                       '='.repeat(48) + '\n\n' +
                                       buildDayEndReportText80mm(reportData, outletName);
                    await ThermalPrinterModule.printTcp({
                        ip: company.networkPrinterIP,
                        port: 9100,
                        payload: reprintText80mm,
                        autoCut: true,
                        openCashbox: false,
                    });
                    console.log('✅ Day End Report reprinted on Network Printer');
                    Alert.alert('🖨️ Success', 'Report reprinted successfully!');
                    return;
                } catch (netErr) {
                    console.log('⚠️ Network Printer reprinting failed:', netErr);
                }
                
                // Fallback to PDF directly if network printer fails
                console.log('⚠️ Network printer failed, saving as PDF');
                const html = generateDayEndHTML(reportData, outletName);
                const { uri } = await Print.printToFileAsync({ html });
                await Sharing.shareAsync(uri);
                Alert.alert('📄 PDF Saved', 'Report saved as PDF');
                return;
            }
        } catch (loadErr) {
            console.log('⚠️ Error loading settings for network printer reprint check:', loadErr);
        }

        // 2. Try Sunmi printer if network is disabled
        const sunmiReady = await SunmiPrinterService.init();
        if (sunmiReady) {
            await SunmiPrinterService.printRawText(reprintText);
            await SunmiPrinterService.cutPaper();
            console.log('✅ Day End Report reprinted on Sunmi');
            Alert.alert('🖨️ Success', 'Report reprinted successfully!');
            return;
        }
        
        console.log('⚠️ No physical printer available, saving as PDF');
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
    // ✅ ORIGINAL Day End Date
    const parsedOriginal = parseRawDateTime(item.closingDate);
    const origDateStr = parsedOriginal.dateStr;
    
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
                            <Text style={styles.endButtonText}>{t.endDay}</Text>
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
                    <Text style={styles.fullScreenTitle}>{t.dayEnd}</Text>
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