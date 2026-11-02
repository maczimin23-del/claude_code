"use client";

import { useState } from "react";
import type { CakeDay, CakeOrderWithBranch } from "@/lib/cake";
import { DECOR_LEVELS } from "@/lib/config";
import { formatTenge } from "@/lib/money";
import { advanceCakeStatus, cancelCakeOrderAdmin, updateCapacityOverride } from "@/app/actions/admin";

type CakeOrder = CakeOrderWithBranch;

const STATUS_LABEL: Record<string, string> = {
  NEW: "Новая заявка",
  DEPOSIT_PENDING: "Ждём предоплату",
  CONFIRMED: "Подтверждено",
  READY: "Готово",
};

function dateLabel(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" });
}

export function CakeQueue({ window: capWindow, ordersByDate }: { window: CakeDay[]; ordersByDate: Record<string, CakeOrder[]> }) {
  return (
    <div className="grid gap-3">
      {capWindow.slice(0, 10).map((d) => {
        const orders = (ordersByDate[d.date] ?? []).filter((o) => o.status !== "CANCELLED");
        return <DayCard key={d.date} day={d} orders={orders} />;
      })}
    </div>
  );
}

function DayCard({ day, orders }: { day: CakeDay; orders: CakeOrder[] }) {
  const [cap, setCap] = useState(day.capacity);
  const [saving, setSaving] = useState(false);
  const pct = day.capacity > 0 ? Math.min(100, Math.round((day.usedUnits / day.capacity) * 100)) : 100;

  async function save() {
    setSaving(true);
    await updateCapacityOverride(day.date, cap);
    setSaving(false);
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-4 grid gap-2.5">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <strong className="text-[13px]">{dateLabel(day.date)}</strong>
        <span className="text-[10.5px] text-fg-muted flex items-center gap-1.5">
          {day.usedUnits} из {day.capacity} ед.
          <span className="inline-block h-1.5 w-16 rounded-full bg-surface-2 overflow-hidden">
            <span className={`block h-full ${pct >= 85 ? "bg-bad" : pct >= 55 ? "bg-warn" : "bg-good"}`} style={{ width: `${pct}%` }} />
          </span>
        </span>
        <span className="flex items-center gap-1.5 text-[10.5px] text-fg-muted">
          Мощность:
          <input
            type="number"
            min={0}
            value={cap}
            onChange={(e) => setCap(Math.max(0, Number(e.target.value) || 0))}
            className="w-11 px-1.5 py-1 rounded-[7px] border border-border bg-surface-2 text-fg text-center"
          />
          <button type="button" onClick={save} disabled={saving} className="border border-border bg-surface-2 text-fg rounded-[7px] px-2 py-1 text-[10px] font-bold">
            {saving ? "…" : "Сохранить"}
          </button>
        </span>
      </div>
      {orders.length === 0 ? (
        <div className="text-[12px] text-fg-muted">Заказов нет</div>
      ) : (
        orders.map((o) => {
          const decor = DECOR_LEVELS.find((d) => d.id === o.decor);
          return (
            <div key={o.id} className="grid grid-cols-[auto_1fr_auto] gap-2.5 items-center border-t border-dashed border-border pt-2 text-[12.5px]">
              {o.refImagePath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={o.refImagePath} alt="" className="w-9 h-9 rounded-lg object-cover border border-border" />
              ) : (
                <span className="w-9 h-9" />
              )}
              <div>
                <strong>{o.weightKg} кг</strong>, {decor?.name}
                {o.cakeText ? `, «${o.cakeText}»` : ""}
                <div className="text-fg-muted text-[11px]">
                  {o.customerName} · {o.customerPhone} · выдача: {o.branch.name} · {formatTenge(o.priceCents)}
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => advanceCakeStatus(o.id)}
                  className="border border-border bg-surface-2 text-fg rounded-full px-2.5 py-1 text-[10.5px] font-bold whitespace-nowrap"
                >
                  {STATUS_LABEL[o.status]} →
                </button>
                <button
                  type="button"
                  onClick={() => cancelCakeOrderAdmin(o.id)}
                  className="border border-border bg-surface-2 text-fg rounded-full px-2 py-1 text-[10.5px] font-bold"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
