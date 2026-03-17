import { Dimensions, Platform, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base width (standard phone)
const BASE_WIDTH = 375;

// Scale function
export const scale = (size: number): number => {
  return (SCREEN_WIDTH / BASE_WIDTH) * size;
};

// Vertical scale
export const verticalScale = (size: number): number => {
  return (SCREEN_HEIGHT / 812) * size; // iPhone X height as base
};

// Moderate scale (for fonts)
export const moderateScale = (size: number, factor = 0.5): number => {
  return size + (scale(size) - size) * factor;
};

// Device type detection - FIXED return type
export const deviceType = (): 'phone' | 'phablet' | 'tablet' | 'desktop' => {
  if (SCREEN_WIDTH < 480) return 'phone';
  if (SCREEN_WIDTH < 768) return 'phablet';    // ← Now included
  if (SCREEN_WIDTH < 1024) return 'tablet';
  return 'desktop';
};

// Orientation
export const isPortrait = (): boolean => {
  return SCREEN_HEIGHT > SCREEN_WIDTH;
};

// Grid columns based on width
export const getGridColumns = (): number => {
  if (SCREEN_WIDTH < 480) return 2;
  if (SCREEN_WIDTH < 768) return 3;
  if (SCREEN_WIDTH < 1024) return 4;
  return 5;
};

// Font sizes
export const fontSizes = {
  xs: moderateScale(10),
  sm: moderateScale(12),
  md: moderateScale(14),
  lg: moderateScale(16),
  xl: moderateScale(18),
  xxl: moderateScale(20),
  xxxl: moderateScale(24),
};

// Spacing
export const spacing = {
  xs: scale(4),
  sm: scale(8),
  md: scale(12),
  lg: scale(16),
  xl: scale(20),
  xxl: scale(24),
};

// Touch targets (minimum 44x44 for accessibility)
export const touchTarget = {
  minWidth: Math.max(44, scale(44)),
  minHeight: Math.max(44, scale(44)),
};