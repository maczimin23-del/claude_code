// Business rules live here, in one place, so the storefront UI and the
// server actions that enforce them never drift apart.

export const PICKUP_SLOT_STEP_MIN = 15;
export const PICKUP_LEAD_MIN = 20;
export const PICKUP_MAX_PER_SLOT = 6;

export const DELIVERY_FEE_CENTS = 70000; // 700 ₸
export const DELIVERY_MIN_ORDER_CENTS = 300000; // 3 000 ₸

export const CAKE_DEFAULT_CAPACITY = 10; // weight-units/day
export const CAKE_LEAD_DAYS = 2;
export const CAKE_SEARCH_WINDOW_DAYS = 21;
export const CAKE_HOLD_HOURS = 24;
export const CAKE_PRE_PICKUP_BUFFER_HOURS = 12;

export const DECOR_LEVELS = [
  { id: "SIMPLE", name: "Простой", ratePerKgCents: 600000, mult: 1.0, sub: "ровный крем, без фигур" },
  { id: "STANDARD", name: "Стандартный", ratePerKgCents: 800000, mult: 1.3, sub: "надписи, ягоды, цветы из крема" },
  { id: "PREMIUM", name: "Премиум", ratePerKgCents: 1100000, mult: 1.8, sub: "мастика, фигурки, многоярусный" },
] as const;

export type DecorId = (typeof DECOR_LEVELS)[number]["id"];

export function decorById(id: string) {
  return DECOR_LEVELS.find((d) => d.id === id) ?? DECOR_LEVELS[1];
}

export function todayStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function minToTime(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
