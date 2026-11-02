import { prisma } from "@/lib/prisma";
import {
  CAKE_DEFAULT_CAPACITY,
  CAKE_LEAD_DAYS,
  CAKE_SEARCH_WINDOW_DAYS,
  decorById,
  todayStr,
} from "@/lib/config";
import type { CakeOrder } from "@prisma/client";

export function capacityUnits(weightKg: number, decorId: string): number {
  return Math.round(weightKg * decorById(decorId).mult * 10) / 10;
}

export function isActiveForCapacity(order: Pick<CakeOrder, "status" | "holdExpiresAt">): boolean {
  if (order.status === "CANCELLED") return false;
  if (order.status === "NEW" && order.holdExpiresAt) return order.holdExpiresAt.getTime() > Date.now();
  return true;
}

export type CakeDay = { date: string; offset: number; capacity: number; usedUnits: number };

/** Capacity + used units for every date in [LEAD, LEAD + SEARCH_WINDOW], for the picker and the nearest-date search. */
export async function getCakeCapacityWindow(): Promise<CakeDay[]> {
  const dates: string[] = [];
  for (let o = CAKE_LEAD_DAYS; o <= CAKE_LEAD_DAYS + CAKE_SEARCH_WINDOW_DAYS; o++) dates.push(todayStr(o));

  const [overrides, orders] = await Promise.all([
    prisma.capacityOverride.findMany({ where: { date: { in: dates } } }),
    prisma.cakeOrder.findMany({ where: { date: { in: dates } } }),
  ]);
  const overrideByDate = new Map(overrides.map((o) => [o.date, o.value]));
  const usedByDate = new Map<string, number>();
  for (const o of orders) {
    if (!isActiveForCapacity(o)) continue;
    usedByDate.set(o.date, (usedByDate.get(o.date) ?? 0) + capacityUnits(o.weightKg, o.decor));
  }

  return dates.map((date, i) => ({
    date,
    offset: CAKE_LEAD_DAYS + i,
    capacity: overrideByDate.get(date) ?? CAKE_DEFAULT_CAPACITY,
    usedUnits: Math.round((usedByDate.get(date) ?? 0) * 10) / 10,
  }));
}

export type CakeOrderWithBranch = Awaited<ReturnType<typeof prisma.cakeOrder.findMany<{ include: { branch: true } }>>>[number];

export async function getCakeOrdersForWindow(): Promise<Map<string, CakeOrderWithBranch[]>> {
  const dates: string[] = [];
  for (let o = 0; o <= CAKE_LEAD_DAYS + CAKE_SEARCH_WINDOW_DAYS; o++) dates.push(todayStr(o));
  const orders = await prisma.cakeOrder.findMany({
    where: { date: { in: dates } },
    include: { branch: true },
    orderBy: { date: "asc" },
  });
  const byDate = new Map<string, CakeOrderWithBranch[]>();
  for (const o of orders) {
    const list = byDate.get(o.date) ?? [];
    list.push(o);
    byDate.set(o.date, list);
  }
  return byDate;
}

export function findNearestAvailable(window: CakeDay[], requiredUnits: number): CakeDay | null {
  for (const day of window) {
    if (day.capacity - day.usedUnits >= requiredUnits - 0.001) return day;
  }
  return null;
}
