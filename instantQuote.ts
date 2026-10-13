/**
 * Instant quote calculator (shared by the public website and the server).
 * All prices come from admin Settings. Empty / zero base price = "not set":
 * the website then shows "Qiimaha waxaa lagu soo xaqiijin doonaa" and still captures the lead.
 */
export interface InstantQuoteInput {
  moveType: 'home' | 'office';
  rooms: number;
  fromDistrict: string;
  toDistrict: string;
  floors: number; // floors of stairs to carry (0 = ground floor)
  hasLift: boolean;
  packing: boolean;
}

export interface InstantQuoteResult {
  priced: boolean;
  low: number;
  high: number;
  breakdown: Array<{ label: string; amount: number }>;
}

export const QUOTE_SETTING_KEYS = [
  'quote_base_home',
  'quote_base_office',
  'quote_per_room',
  'quote_per_floor',
  'quote_per_zone',
  'quote_diff_district',
  'quote_packing_fee',
  'quote_range_pct',
  'quote_district_zones',
] as const;

const num = (v: any) => {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function parseZones(raw: any): Record<string, number> {
  try {
    const obj = typeof raw === 'string' && raw.trim() ? JSON.parse(raw) : raw && typeof raw === 'object' ? raw : {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(obj || {})) {
      const n = Number(v);
      if (Number.isFinite(n)) out[k] = n;
    }
    return out;
  } catch {
    return {};
  }
}

export function computeInstantQuote(input: InstantQuoteInput, settings: Record<string, string>): InstantQuoteResult {
  const base = num(input.moveType === 'office' ? settings.quote_base_office : settings.quote_base_home);
  if (!base) return { priced: false, low: 0, high: 0, breakdown: [] };
  const rooms = Math.max(1, Math.min(30, Math.round(Number(input.rooms) || 1)));
  const floors = Math.max(0, Math.min(30, Math.round(Number(input.floors) || 0)));
  const zones = parseZones(settings.quote_district_zones);
  const zoneSteps =
    input.fromDistrict && input.toDistrict && zones[input.fromDistrict] !== undefined && zones[input.toDistrict] !== undefined
      ? Math.abs(zones[input.fromDistrict] - zones[input.toDistrict])
      : 0;
  const breakdown: Array<{ label: string; amount: number }> = [{ label: 'base', amount: base }];
  const perRoom = num(settings.quote_per_room) * rooms;
  if (perRoom) breakdown.push({ label: 'rooms', amount: perRoom });
  const floorFee = input.hasLift ? 0 : num(settings.quote_per_floor) * floors;
  if (floorFee) breakdown.push({ label: 'floors', amount: floorFee });
  const diff = input.fromDistrict && input.toDistrict && input.fromDistrict !== input.toDistrict ? num(settings.quote_diff_district) : 0;
  if (diff) breakdown.push({ label: 'district', amount: diff });
  const zoneFee = num(settings.quote_per_zone) * zoneSteps;
  if (zoneFee) breakdown.push({ label: 'zone', amount: zoneFee });
  const packing = input.packing ? num(settings.quote_packing_fee) : 0;
  if (packing) breakdown.push({ label: 'packing', amount: packing });
  const total = breakdown.reduce((s, b) => s + b.amount, 0);
  const pct = settings.quote_range_pct !== undefined && String(settings.quote_range_pct).trim() !== '' ? Math.max(0, Math.min(100, Number(settings.quote_range_pct) || 0)) : 15;
  const low = Math.round(total);
  const high = Math.round(total * (1 + pct / 100));
  return { priced: true, low, high, breakdown };
}
