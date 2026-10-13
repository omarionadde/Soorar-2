export const MOGADISHU_DISTRICTS = [
  'Hodan',
  'Wadajir',
  'Dharkenley',
  'Hawl-Wadaag',
  'Waberi',
  'Yaqshid',
  'Karaan',
  'Shibis',
  'Bondhere',
  'Abdiaziz',
  'Hamar Weyne',
  'Hamar Jajab',
  'Shangani',
  'Wardhigley',
  'Heliwaa',
  'Kaxda',
  'Garasbaley',
  'Daynile',
  'Other',
] as const;

export const SERVICE_OPTIONS = [
  { id: 'home', labelSo: 'Rarid Guri (Home Moving)', labelEn: 'Home Moving' },
  { id: 'office', labelSo: 'Rarid Xafiis (Office Moving)', labelEn: 'Office Moving' },
  { id: 'packing', labelSo: 'Xirxirid & Kartoonno (Packing)', labelEn: 'Packing & Boxes' },
  { id: 'assembly', labelSo: 'Furfurid & Xirid (Furniture Assembly)', labelEn: 'Furniture Assembly' },
  { id: 'heavy', labelSo: 'Alaab Culus (Heavy Items)', labelEn: 'Heavy Items' },
] as const;

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

export function trackWhatsAppClick(contextLabel: string) {
  try {
    if (typeof window !== 'undefined') {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: 'whatsapp_click',
        event_category: 'engagement',
        event_label: contextLabel,
        timestamp: new Date().toISOString(),
      });
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'whatsapp_click', {
          event_category: 'engagement',
          event_label: contextLabel,
        });
      }
    }
  } catch (e) {
    // Non-blocking analytics
  }
}

export function buildWhatsAppUrl(phoneDigits: string, message: string): string {
  const cleanDigits = phoneDigits.replace(/[^0-9]/g, '') || '252770505028';
  return `https://wa.me/${cleanDigits}?text=${encodeURIComponent(message)}`;
}
