export type Api = (url: string, options?: RequestInit) => Promise<any>;
export type Lang = 'so' | 'en';
export const tr = (lang: Lang, so: string, en: string) => (lang === 'so' ? so : en);
export const usd = (n: any) => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const todayMogadishu = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
