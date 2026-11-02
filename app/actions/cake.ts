"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  CAKE_HOLD_HOURS,
  CAKE_PRE_PICKUP_BUFFER_HOURS,
  DECOR_LEVELS,
  decorById,
  todayStr,
} from "@/lib/config";
import { capacityUnits, getCakeCapacityWindow } from "@/lib/cake";

const MAX_REF_IMAGE_BYTES = 1_500_000; // ~1.1 MB decoded; stored inline as a data URL (see note below)

const CreateCakeOrderSchema = z.object({
  weightKg: z.number().min(0.5).max(30),
  decor: z.enum(DECOR_LEVELS.map((d) => d.id) as [string, ...string[]]),
  dateOffset: z.number().int().min(0),
  branchId: z.string(),
  name: z.string().min(1, "Укажите имя"),
  phone: z.string().min(5, "Укажите телефон"),
  cakeText: z.string().max(200).optional(),
  refImageDataUrl: z.string().max(MAX_REF_IMAGE_BYTES).optional(),
});

export type CreateCakeOrderInput = z.infer<typeof CreateCakeOrderSchema>;

export type CreateCakeOrderResult =
  | { ok: true; priceCents: number; waText: string }
  | { ok: false; error: string; suggestedOffset?: number };

export async function createCakeOrder(input: CreateCakeOrderInput): Promise<CreateCakeOrderResult> {
  const parsed = CreateCakeOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Проверьте форму." };
  const data = parsed.data;

  const decor = decorById(data.decor);
  const branch = await prisma.branch.findUnique({ where: { id: data.branchId } });
  if (!branch) return { ok: false, error: "Точка выдачи не найдена." };

  const date = todayStr(data.dateOffset);
  const needUnits = capacityUnits(data.weightKg, data.decor);

  try {
    const order = await prisma.$transaction(async (tx) => {
      const override = await tx.capacityOverride.findUnique({ where: { date } });
      const existing = await tx.cakeOrder.findMany({ where: { date } });
      const used = existing
        .filter((o) => o.status !== "CANCELLED" && !(o.status === "NEW" && o.holdExpiresAt && o.holdExpiresAt.getTime() < Date.now()))
        .reduce((sum, o) => sum + capacityUnits(o.weightKg, o.decor), 0);
      const capacity = override?.value ?? 10;

      if (capacity - used < needUnits - 0.001) {
        throw new Error("CAPACITY_FULL");
      }

      const now = Date.now();
      const pickupStart = new Date(date + "T00:00:00").getTime();
      const holdByHours = now + CAKE_HOLD_HOURS * 3600_000;
      const holdByPickup = pickupStart - CAKE_PRE_PICKUP_BUFFER_HOURS * 3600_000;
      const holdExpiresAt = new Date(Math.min(holdByHours, Math.max(holdByPickup, now + 3600_000)));

      return tx.cakeOrder.create({
        data: {
          date,
          weightKg: data.weightKg,
          decor: data.decor as "SIMPLE" | "STANDARD" | "PREMIUM",
          branchId: data.branchId,
          customerName: data.name.trim(),
          customerPhone: data.phone.trim(),
          cakeText: data.cakeText?.trim() || null,
          refImagePath: data.refImageDataUrl ?? null,
          priceCents: Math.round(data.weightKg * decor.ratePerKgCents),
          status: "NEW",
          holdExpiresAt,
        },
      });
    });

    revalidatePath("/cake");
    revalidatePath("/admin/dashboard");

    const waText =
      `Заявка на торт: ${data.weightKg} кг, ${decor.name.toLowerCase()} декор` +
      (data.cakeText ? `, надпись: "${data.cakeText}"` : "") +
      `\nГотовность: ${date}\nВыдача: ${branch.name}\nИмя: ${data.name}, тел: ${data.phone}` +
      `\nОриентировочная цена: ${(order.priceCents / 100).toLocaleString("ru-RU")} ₸`;

    return { ok: true, priceCents: order.priceCents, waText };
  } catch (e) {
    if (e instanceof Error && e.message === "CAPACITY_FULL") {
      const window = await getCakeCapacityWindow();
      const nearest = window.find((d) => d.capacity - d.usedUnits >= needUnits - 0.001);
      return {
        ok: false,
        error: nearest
          ? `На эту дату места не хватает. Ближайшая свободная — ${nearest.date}.`
          : "На ближайшие недели у цеха нет места под торт такого веса и декора.",
        suggestedOffset: nearest?.offset,
      };
    }
    return { ok: false, error: "Не удалось сохранить заявку. Попробуйте ещё раз." };
  }
}

export async function lookupCakeOrdersByPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return [];
  const all = await prisma.cakeOrder.findMany({ orderBy: { date: "asc" } });
  return all.filter((o) => o.customerPhone.replace(/\D/g, "") === digits);
}

export async function cancelCakeOrder(id: string) {
  await prisma.cakeOrder.update({ where: { id }, data: { status: "CANCELLED" } });
  revalidatePath("/cake");
  revalidatePath("/admin/dashboard");
}
