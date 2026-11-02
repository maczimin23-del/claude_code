"use client";

import type { getTodayOrders } from "@/lib/data";
import { advanceOrderStatus, cancelOrder } from "@/app/actions/admin";
import { formatTenge } from "@/lib/money";

type Order = Awaited<ReturnType<typeof getTodayOrders>>[number];

const STATUS_LABEL: Record<string, string> = {
  NEW: "Новый",
  READY: "Готов",
  COMPLETED: "Выдан",
  CANCELLED: "Отменён",
};

function notifyUrl(phone: string, code: string, shopWhatsapp: string, suffix: string) {
  const text = `Ваш заказ #${code} ${suffix}! Ждём вас в Jam Bakery.`;
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

export function OrdersQueue({ orders, shopWhatsapp }: { orders: Order[]; shopWhatsapp: string }) {
  const pickup = orders.filter((o) => o.fulfillment === "PICKUP" && o.status !== "CANCELLED");
  const delivery = orders.filter((o) => o.fulfillment === "DELIVERY" && o.status !== "CANCELLED");

  return (
    <div className="grid gap-4">
      <div>
        <h3 className="text-[13px] font-bold mb-2">Самовывоз — {pickup.length}</h3>
        <div className="bg-surface border border-border rounded-2xl p-4 grid gap-2">
          {pickup.length === 0 && <div className="text-[12px] text-fg-muted">Заказов нет</div>}
          {pickup
            .sort((a, b) => (a.pickupSlot ?? "").localeCompare(b.pickupSlot ?? ""))
            .map((o) => (
              <Row key={o.id} order={o} shopWhatsapp={shopWhatsapp} subtitle={`${o.pickupSlot} · ${o.branch?.name ?? ""}`} />
            ))}
        </div>
      </div>
      <div>
        <h3 className="text-[13px] font-bold mb-2">Доставка — {delivery.length}</h3>
        <div className="bg-surface border border-border rounded-2xl p-4 grid gap-2">
          {delivery.length === 0 && <div className="text-[12px] text-fg-muted">Заказов нет</div>}
          {delivery.map((o) => (
            <Row key={o.id} order={o} shopWhatsapp={shopWhatsapp} subtitle={o.address ?? ""} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ order, shopWhatsapp, subtitle }: { order: Order; shopWhatsapp: string; subtitle: string }) {
  const lines = order.items.map((it) => `${it.qty}x ${it.name}`).join(", ");
  return (
    <div className="grid grid-cols-[auto_auto] gap-2 items-start justify-between border-t border-dashed border-border pt-2 first:border-t-0 first:pt-0 text-[12.5px]">
      <div>
        <div>
          #{order.code} · {lines}
        </div>
        <div className="text-fg-muted text-[11px]">
          {subtitle} · {order.customerName} · {order.customerPhone} · {formatTenge(order.totalCents)}
        </div>
      </div>
      <div className="flex gap-1.5 items-center flex-wrap justify-end">
        <a
          href={notifyUrl(order.customerPhone, order.code, shopWhatsapp, order.fulfillment === "PICKUP" ? "готов" : "в пути")}
          target="_blank"
          rel="noopener noreferrer"
          className="border border-wa text-wa rounded-full px-2.5 py-1 text-[10.5px] font-bold"
        >
          Уведомить
        </a>
        <button
          type="button"
          onClick={() => advanceOrderStatus(order.id)}
          className="border border-border bg-surface-2 text-fg rounded-full px-2.5 py-1 text-[10.5px] font-bold"
        >
          {STATUS_LABEL[order.status]} →
        </button>
        <button
          type="button"
          onClick={() => cancelOrder(order.id)}
          className="border border-border bg-surface-2 text-fg rounded-full px-2 py-1 text-[10.5px] font-bold"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
