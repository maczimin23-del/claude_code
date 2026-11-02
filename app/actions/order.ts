"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  DELIVERY_FEE_CENTS,
  DELIVERY_MIN_ORDER_CENTS,
  PICKUP_MAX_PER_SLOT,
  minToTime,
  todayStr,
} from "@/lib/config";

const CartItemSchema = z.object({
  menuItemId: z.string(),
  qty: z.number().int().positive().max(20),
});

const CreateOrderSchema = z.object({
  fulfillment: z.enum(["PICKUP", "DELIVERY"]),
  branchId: z.string().optional(),
  pickupSlotMin: z.number().int().optional(),
  address: z.string().optional(),
  name: z.string().min(1, "Укажите имя"),
  phone: z.string().min(5, "Укажите телефон"),
  cart: z.array(CartItemSchema).min(1, "Корзина пуста"),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

export type CreateOrderResult =
  | { ok: true; code: string; totalCents: number; waText: string }
  | { ok: false; error: string };

function randomCode(): string {
  return String(100 + Math.floor(Math.random() * 900));
}

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const parsed = CreateOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Проверьте форму." };
  }
  const data = parsed.data;

  if (data.fulfillment === "PICKUP" && (!data.branchId || data.pickupSlotMin === undefined)) {
    return { ok: false, error: "Выберите точку и время выдачи." };
  }
  if (data.fulfillment === "DELIVERY" && !data.address?.trim()) {
    return { ok: false, error: "Укажите адрес доставки." };
  }

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: data.cart.map((c) => c.menuItemId) }, active: true },
  });
  if (menuItems.length !== data.cart.length) {
    return { ok: false, error: "Некоторые позиции в корзине больше недоступны. Обновите страницу." };
  }

  const rows = data.cart.map((c) => ({
    item: menuItems.find((m) => m.id === c.menuItemId)!,
    qty: c.qty,
  }));
  const subtotalCents = rows.reduce((sum, r) => sum + r.item.priceCents * r.qty, 0);

  if (data.fulfillment === "DELIVERY" && subtotalCents < DELIVERY_MIN_ORDER_CENTS) {
    return {
      ok: false,
      error: `Минимальная сумма для доставки — ${(DELIVERY_MIN_ORDER_CENTS / 100).toLocaleString("ru-RU")} ₸.`,
    };
  }

  const date = todayStr();
  const totalCents = subtotalCents + (data.fulfillment === "DELIVERY" ? DELIVERY_FEE_CENTS : 0);
  const code = randomCode();

  try {
    const order = await prisma.$transaction(async (tx) => {
      // Stock: lazily create today's row from defaultStock, then decrement —
      // checked and written inside the same transaction as the order, so a
      // sellout mid-checkout can never leave stock negative.
      for (const { item, qty } of rows) {
        if (!item.trackStock) continue;
        const existing = await tx.dailyStock.findUnique({
          where: { date_menuItemId: { date, menuItemId: item.id } },
        });
        const remaining = existing ? existing.remaining : item.defaultStock;
        if (remaining < qty) {
          throw new Error(`STOCK:${item.name}`);
        }
        if (existing) {
          await tx.dailyStock.update({ where: { id: existing.id }, data: { remaining: remaining - qty } });
        } else {
          await tx.dailyStock.create({
            data: { date, menuItemId: item.id, remaining: item.defaultStock - qty },
          });
        }
      }

      if (data.fulfillment === "PICKUP") {
        const slotTime = minToTime(data.pickupSlotMin!);
        const countInSlot = await tx.order.count({
          where: {
            date,
            fulfillment: "PICKUP",
            branchId: data.branchId,
            pickupSlot: slotTime,
            status: { not: "CANCELLED" },
          },
        });
        if (countInSlot >= PICKUP_MAX_PER_SLOT) {
          throw new Error("SLOT_FULL");
        }
      }

      return tx.order.create({
        data: {
          code,
          date,
          fulfillment: data.fulfillment,
          branchId: data.fulfillment === "PICKUP" ? data.branchId : null,
          pickupSlot: data.fulfillment === "PICKUP" ? minToTime(data.pickupSlotMin!) : null,
          address: data.fulfillment === "DELIVERY" ? data.address!.trim() : null,
          customerName: data.name.trim(),
          customerPhone: data.phone.trim(),
          totalCents,
          items: {
            create: rows.map((r) => ({
              menuItemId: r.item.id,
              name: r.item.name,
              priceCents: r.item.priceCents,
              qty: r.qty,
            })),
          },
        },
      });
    });

    revalidatePath("/");
    revalidatePath("/admin/dashboard");

    const lines = rows.map((r) => `${r.qty}x ${r.item.name}`).join(", ");
    const waText =
      data.fulfillment === "PICKUP"
        ? `Самовывоз #${order.code}: ${lines}\nВремя: ${order.pickupSlot}\nИтого: ${(totalCents / 100).toLocaleString("ru-RU")} ₸\nИмя: ${data.name}, тел: ${data.phone}`
        : `Доставка #${order.code}: ${lines}\nАдрес: ${order.address}\nИтого с доставкой: ${(totalCents / 100).toLocaleString("ru-RU")} ₸\nИмя: ${data.name}, тел: ${data.phone}`;

    return { ok: true, code: order.code, totalCents, waText };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.startsWith("STOCK:")) {
      return { ok: false, error: `«${msg.slice(6)}» уже закончилось — уменьшите количество или уберите позицию.` };
    }
    if (msg === "SLOT_FULL") {
      return { ok: false, error: "Это окно выдачи только что заполнили — выберите другое время." };
    }
    return { ok: false, error: "Не удалось сохранить заказ. Попробуйте ещё раз." };
  }
}
