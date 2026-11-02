"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createAdminSession, destroyAdminSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { todayStr } from "@/lib/config";

export async function adminLogin(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return { ok: false, error: "ADMIN_PASSWORD не задан на сервере." };
  }
  if (password !== expected) {
    return { ok: false, error: "Неверный код." };
  }
  await createAdminSession();
  redirect("/admin/dashboard");
}

export async function adminLogout() {
  await destroyAdminSession();
  redirect("/admin");
}

const StockUpdateSchema = z.record(z.string(), z.number().int().min(0));

export async function updateStock(values: Record<string, number>) {
  const parsed = StockUpdateSchema.parse(values);
  const date = todayStr();
  await prisma.$transaction(
    Object.entries(parsed).map(([menuItemId, remaining]) =>
      prisma.dailyStock.upsert({
        where: { date_menuItemId: { date, menuItemId } },
        update: { remaining },
        create: { date, menuItemId, remaining },
      })
    )
  );
  revalidatePath("/");
  revalidatePath("/admin/dashboard");
}

export async function updateCapacityOverride(date: string, value: number) {
  await prisma.capacityOverride.upsert({
    where: { date },
    update: { value },
    create: { date, value },
  });
  revalidatePath("/cake");
  revalidatePath("/admin/dashboard");
}

const ORDER_STATUS_NEXT: Record<string, string> = {
  NEW: "READY",
  READY: "COMPLETED",
  COMPLETED: "NEW",
};

export async function advanceOrderStatus(id: string) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id } });
  await prisma.order.update({ where: { id }, data: { status: (ORDER_STATUS_NEXT[order.status] ?? "NEW") as "NEW" | "READY" | "COMPLETED" } });
  revalidatePath("/admin/dashboard");
}

export async function cancelOrder(id: string) {
  await prisma.order.update({ where: { id }, data: { status: "CANCELLED" } });
  revalidatePath("/");
  revalidatePath("/admin/dashboard");
}

const CAKE_STATUS_NEXT: Record<string, string> = {
  NEW: "DEPOSIT_PENDING",
  DEPOSIT_PENDING: "CONFIRMED",
  CONFIRMED: "READY",
  READY: "NEW",
};

export async function advanceCakeStatus(id: string) {
  const order = await prisma.cakeOrder.findUniqueOrThrow({ where: { id } });
  await prisma.cakeOrder.update({
    where: { id },
    data: { status: (CAKE_STATUS_NEXT[order.status] ?? "NEW") as "NEW" | "DEPOSIT_PENDING" | "CONFIRMED" | "READY" },
  });
  revalidatePath("/cake");
  revalidatePath("/admin/dashboard");
}

export async function cancelCakeOrderAdmin(id: string) {
  await prisma.cakeOrder.update({ where: { id }, data: { status: "CANCELLED" } });
  revalidatePath("/cake");
  revalidatePath("/admin/dashboard");
}
