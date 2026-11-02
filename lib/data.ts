import { prisma } from "@/lib/prisma";
import { todayStr } from "@/lib/config";

export async function getBranches() {
  return prisma.branch.findMany({ orderBy: { name: "asc" } });
}

export type MenuItemWithStock = Awaited<ReturnType<typeof getMenuWithStock>>[number];

export async function getMenuWithStock(date: string = todayStr()) {
  const items = await prisma.menuItem.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
  const stockRows = await prisma.dailyStock.findMany({ where: { date } });
  const stockByItem = new Map(stockRows.map((s) => [s.menuItemId, s.remaining]));

  return items.map((item) => ({
    ...item,
    remaining: item.trackStock ? stockByItem.get(item.id) ?? item.defaultStock : null,
  }));
}

export async function getTodayOrders(date: string = todayStr()) {
  return prisma.order.findMany({
    where: { date },
    include: { items: true, branch: true },
    orderBy: { createdAt: "asc" },
  });
}

/** branchId -> slot ("14:30") -> count, for today's non-cancelled pickup orders across all branches. */
export async function getTodayPickupCounts(date: string = todayStr()) {
  const orders = await prisma.order.findMany({
    where: { date, fulfillment: "PICKUP", status: { not: "CANCELLED" } },
    select: { branchId: true, pickupSlot: true },
  });
  const counts: Record<string, Record<string, number>> = {};
  for (const o of orders) {
    if (!o.branchId || !o.pickupSlot) continue;
    counts[o.branchId] ??= {};
    counts[o.branchId][o.pickupSlot] = (counts[o.branchId][o.pickupSlot] ?? 0) + 1;
  }
  return counts;
}
