// src/utils/imageHelper.ts
const BASE_URL = 'https://uniprohawker-production.up.railway.app';

export const getFullImageUrl = (imagePath: string | null): string | null => {
  if (!imagePath) return null;
  
  // If already full URL, return as is
  if (imagePath.startsWith('http')) {
    return imagePath;
  }
  
  // CRITICAL FIX: Ensure path starts with /
  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  
  // Build FULL URL without any truncation
  const fullUrl = `${BASE_URL}${cleanPath}`;
  
  // Log for debugging
  console.log('🖼️ Image URL built:', {
    original: imagePath,
    full: fullUrl,
    length: fullUrl.length
  });
  
  return fullUrl;
};