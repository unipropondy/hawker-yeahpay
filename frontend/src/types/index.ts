// src/types/index.ts

export interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  imageUri: string | null;
  category?: string;
  originalName?: string;
  originalCategory?: string;
  displayCategory?: string;
}

export interface MenuItem {
  id: number;
  name: string;
  category: string;
  price: number;
  imageUri: string | null;
  originalName: string;
  originalCategory: string;
  displayCategory?: string;
  isActive?: boolean; 
  isOpenPrice?: boolean; 
}

interface DishGroup {
  id: number;
  name: string;
  itemCount: number;
  active: boolean;
}

export interface Sale {
  id: number;
  items: {
    name: string;
    quantity: number;
    price: number;
  }[];
  total: number;
  paymentMethod: string;
  date: Date;
}

export interface PaymentOption {
  id: number;
  name: string;
  icon: string;
  description: string;
}

export interface ThemeType {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  info: string; 
  textSecondary: string;
  border: string;
  card: string;
  header: string;
  headerText: string;
  success: string;
  warning: string;
  danger: string;
  inactive: string;
}

export interface User {
  id: number;  // Changed from string to number
  username: string;
  role: string;
  fullName?: string;
  email?: string;
   clientId?: string | number; 
}