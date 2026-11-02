"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { Branch } from "@prisma/client";
import type { MenuItemWithStock } from "@/lib/data";
import { createOrder } from "@/app/actions/order";
import { formatTenge } from "@/lib/money";
import {
  DELIVERY_FEE_CENTS,
  DELIVERY_MIN_ORDER_CENTS,
  PICKUP_LEAD_MIN,
  PICKUP_MAX_PER_SLOT,
  PICKUP_SLOT_STEP_MIN,
  minToTime,
  timeToMin,
} from "@/lib/config";

type Props = {
  branches: Branch[];
  menu: MenuItemWithStock[];
  pickupCounts: Record<string, Record<string, number>>;
  shopWhatsapp: string;
};

type Fulfillment = "PICKUP" | "DELIVERY";

function nowMin(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function OrderFlow({ branches, menu, pickupCounts, shopWhatsapp }: Props) {
  const [fulfillment, setFulfillment] = useState<Fulfillment>("PICKUP");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [slotMin, setSlotMin] = useState<number | null>(null);
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    { ok: true; code: string; totalCents: number; waText: string } | { ok: false; error: string } | null
  >(null);
  const contactRef = useRef<HTMLDivElement>(null);

  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const m of menu) if (!seen.includes(m.category)) seen.push(m.category);
    return seen;
  }, [menu]);

  const branch = branches.find((b) => b.id === branchId) ?? branches[0];

  const cartRows = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => ({ item: menu.find((m) => m.id === id)!, qty }))
        .filter((r) => r.item),
    [cart, menu]
  );
  const cartCount = cartRows.reduce((s, r) => s + r.qty, 0);
  const subtotalCents = cartRows.reduce((s, r) => s + r.item.priceCents * r.qty, 0);
  const totalCents = subtotalCents + (fulfillment === "DELIVERY" ? DELIVERY_FEE_CENTS : 0);
  const deliveryOk = subtotalCents >= DELIVERY_MIN_ORDER_CENTS;

  const slots = useMemo(() => {
    if (!branch) return [];
    const start = Math.max(
      timeToMin(branch.openTime),
      Math.ceil((nowMin() + PICKUP_LEAD_MIN) / PICKUP_SLOT_STEP_MIN) * PICKUP_SLOT_STEP_MIN
    );
    const end = timeToMin(branch.closeTime);
    const out: { min: number; used: number }[] = [];
    for (let t = start; t <= end - PICKUP_SLOT_STEP_MIN; t += PICKUP_SLOT_STEP_MIN) {
      out.push({ min: t, used: pickupCounts[branch.id]?.[minToTime(t)] ?? 0 });
    }
    return out;
  }, [branch, pickupCounts]);

  function setQty(id: string, qty: number) {
    setCart((c) => ({ ...c, [id]: Math.max(0, qty) }));
  }
  function stockLeft(item: MenuItemWithStock) {
    if (!item.trackStock) return Infinity;
    return item.remaining ?? 0;
  }

  const canSubmit =
    cartCount > 0 &&
    name.trim() &&
    phone.trim() &&
    (fulfillment === "PICKUP" ? slotMin !== null : address.trim() && deliveryOk);

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setResult(null);
    const res = await createOrder({
      fulfillment,
      branchId: fulfillment === "PICKUP" ? branchId : undefined,
      pickupSlotMin: fulfillment === "PICKUP" ? slotMin ?? undefined : undefined,
      address: fulfillment === "DELIVERY" ? address : undefined,
      name,
      phone,
      cart: cartRows.map((r) => ({ menuItemId: r.item.id, qty: r.qty })),
    });
    setResult(res);
    setSubmitting(false);
    if (res.ok) {
      setCart({});
      setSlotMin(null);
    }
  }

  const waUrl = result?.ok && `https://wa.me/${shopWhatsapp}?text=${encodeURIComponent(result.waText)}`;

  return (
    <>
      <section className="pt-[18px] pb-0.5">
        <div className="text-[10.5px] font-bold tracking-wider uppercase text-accent">
          Готово к вашему приходу — или привезём сами
        </div>
        <h1 className="font-display text-[22px] mt-1 max-w-[22ch] leading-tight">Соберите заказ за минуту</h1>
        <p className="text-fg-muted text-[13px] mt-1 max-w-[50ch]">
          Остатки на сегодня списываются автоматически — если позиции нет, кухня закончила именно её.
        </p>
      </section>

      <div className="flex mt-3.5 mb-0.5 border border-border rounded-2xl overflow-hidden bg-surface">
        {[
          ["1 · Instagram", "Ссылка в био/Stories"],
          ["2 · Здесь", "Корзина и время"],
          ["3 · WhatsApp", "Код и подтверждение"],
        ].map(([k, t], i) => (
          <div key={k} className={`flex-1 p-2.5 ${i > 0 ? "border-l border-dashed border-border" : ""}`}>
            <div className="text-[9px] font-bold tracking-wide uppercase text-accent-2">{k}</div>
            <div className="text-[11px] font-bold">{t}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5 mt-4 bg-surface-2 rounded-[11px] p-1">
        {(["PICKUP", "DELIVERY"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFulfillment(f)}
            className={`flex-1 py-2.5 text-[12.5px] font-bold rounded-lg ${
              fulfillment === f ? "bg-surface text-fg shadow-sm" : "text-fg-muted"
            }`}
          >
            {f === "PICKUP" ? "Самовывоз" : "Доставка"}
          </button>
        ))}
      </div>

      {fulfillment === "PICKUP" && (
        <div className="mt-5">
          <StepLabel n={1} title="Точка выдачи" />
          <div className="flex flex-wrap gap-2">
            {branches.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setBranchId(b.id);
                  setSlotMin(null);
                }}
                className={`border rounded-xl px-3.5 py-2.5 text-left text-[13px] font-semibold ${
                  b.id === branchId ? "border-accent bg-surface-2 shadow-[inset_0_0_0_1px_var(--color-accent)]" : "border-border bg-surface"
                }`}
              >
                <div>{b.name}</div>
                <div className="text-[10.5px] font-medium text-fg-muted">
                  {b.openTime}–{b.closeTime}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5">
        <StepLabel n={2} title="Что берём" />
        <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <CatPill active={catFilter === null} onClick={() => setCatFilter(null)}>
            Всё меню
          </CatPill>
          {categories.map((c) => (
            <CatPill key={c} active={catFilter === c} onClick={() => setCatFilter(c)}>
              {c}
            </CatPill>
          ))}
        </div>

        {categories
          .filter((c) => catFilter === null || catFilter === c)
          .map((cat) => (
            <div key={cat}>
              <div className="text-[10.5px] font-bold uppercase tracking-wide text-fg-muted mt-4 mb-2 first:mt-0">
                {cat}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {menu
                  .filter((m) => m.category === cat)
                  .map((item) => {
                    const left = stockLeft(item);
                    const qty = cart[item.id] ?? 0;
                    const soldOut = item.trackStock && left <= 0;
                    const canInc = !item.trackStock || qty < left;
                    return (
                      <div
                        key={item.id}
                        className={`bg-surface border border-border rounded-2xl p-2.5 grid gap-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] ${
                          soldOut ? "opacity-55" : ""
                        }`}
                      >
                        <div className="w-full aspect-[1.3] rounded-[10px] bg-surface-2 overflow-hidden relative">
                          <Image src={item.imagePath} alt={item.name} fill sizes="200px" className="object-cover" />
                        </div>
                        <div className="text-[12.5px] font-bold leading-tight">{item.name}</div>
                        <div className="text-[11.5px] text-fg-muted tabular-nums">{formatTenge(item.priceCents)}</div>
                        {item.trackStock && (soldOut || left <= 5) && (
                          <div className={`text-[10px] font-bold ${soldOut ? "text-bad" : "text-warn"}`}>
                            {soldOut ? "закончилось" : `осталось ${left}`}
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-0.5">
                          {qty === 0 ? (
                            <button
                              type="button"
                              disabled={soldOut}
                              onClick={() => setQty(item.id, 1)}
                              className="w-full border-none text-accent-ink bg-accent disabled:bg-surface-2 disabled:text-fg-muted rounded-[9px] py-2 text-xs font-bold"
                            >
                              Добавить
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <QtyBtn onClick={() => setQty(item.id, qty - 1)}>−</QtyBtn>
                              <span className="text-[13px] font-bold min-w-[14px] text-center tabular-nums">{qty}</span>
                              <QtyBtn disabled={!canInc} onClick={() => setQty(item.id, qty + 1)}>
                                +
                              </QtyBtn>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}

        <div className="flex justify-between items-center bg-surface-2 rounded-xl px-3.5 py-2.5 mt-3.5 text-[13px]">
          <span>
            Корзина: <span className="font-display font-bold">{formatTenge(subtotalCents)}</span> · {cartCount} поз.
          </span>
          <button type="button" onClick={() => setCart({})} className="text-fg-muted text-[11px] underline underline-offset-2">
            Очистить
          </button>
        </div>
      </div>

      {fulfillment === "PICKUP" ? (
        <div className="mt-5">
          <StepLabel n={3} title="Время выдачи" />
          <div className="flex flex-wrap gap-2">
            {slots.length === 0 && <div className="text-[10px] text-fg-muted">Точка уже закрывается — приходите завтра.</div>}
            {slots.map((s) => {
              const full = s.used >= PICKUP_MAX_PER_SLOT;
              return (
                <button
                  key={s.min}
                  type="button"
                  disabled={full}
                  onClick={() => setSlotMin(s.min)}
                  className={`border rounded-xl px-3.5 py-2.5 text-[13px] font-semibold ${
                    s.min === slotMin ? "border-accent bg-surface-2" : "border-border bg-surface"
                  } ${full ? "opacity-45" : ""}`}
                >
                  <div>{minToTime(s.min)}</div>
                  <div className="text-[10.5px] font-medium text-fg-muted">
                    {full ? "занято" : `${PICKUP_MAX_PER_SLOT - s.used} мест`}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <StepLabel n={3} title="Адрес доставки" />
          <Field label="Адрес">
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Улица, дом, подъезд, этаж"
              className="w-full px-3.5 py-2.5 rounded-[11px] border border-border bg-surface text-fg min-h-[54px] resize-y"
            />
          </Field>
          <div className={`text-[11.5px] rounded-[10px] px-3 py-2.5 mt-2 ${deliveryOk ? "bg-surface-2 text-fg-muted" : "bg-bad-bg text-bad"}`}>
            {deliveryOk
              ? `Доставка по Костанаю — ${formatTenge(DELIVERY_FEE_CENTS)}, ориентир 40–60 минут. Итого с доставкой: ${formatTenge(totalCents)}.`
              : `До минимальной суммы доставки не хватает ${formatTenge(DELIVERY_MIN_ORDER_CENTS - subtotalCents)} — минимум ${formatTenge(DELIVERY_MIN_ORDER_CENTS)}.`}
          </div>
        </div>
      )}

      <div ref={contactRef} className="mt-5">
        <StepLabel n={4} title="Контакты" />
        <Field label="Имя">
          <input value={name} onChange={(e) => setName(e.target.value)} type="text" className="w-full px-3.5 py-2.5 rounded-[11px] border border-border bg-surface text-fg" />
        </Field>
        <Field label="Телефон">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" className="w-full px-3.5 py-2.5 rounded-[11px] border border-border bg-surface text-fg" />
        </Field>
        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={handleSubmit}
          className="w-full mt-4 bg-accent text-accent-ink disabled:opacity-50 rounded-xl py-3.5 font-display font-bold text-[13.5px]"
        >
          {submitting ? "Оформляем…" : "Оформить заказ"}
        </button>

        {result && (
          <div className={`rounded-2xl p-4 mt-3.5 grid gap-2 border ${result.ok ? "bg-good-bg border-good" : "bg-bad-bg border-bad"}`}>
            {result.ok ? (
              <>
                <div className="font-bold text-[14.5px]">Заказ принят</div>
                <div className="font-display text-2xl text-accent tracking-wide">#{result.code}</div>
                <p className="text-[12.5px] text-fg-muted m-0">Итого {formatTenge(result.totalCents)}.</p>
                {waUrl && (
                  <a href={waUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 bg-wa text-white rounded-[11px] px-4 py-3 font-bold text-[13px] mt-0.5">
                    Подтвердить в WhatsApp
                  </a>
                )}
              </>
            ) : (
              <>
                <div className="font-bold text-[14.5px]">Не получилось</div>
                <p className="text-[12.5px] text-fg-muted m-0">{result.error}</p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="h-[72px]" />

      {cartCount > 0 && (
        <div
          className="fixed left-0 right-0 bottom-0 z-40 flex items-center justify-between gap-3 bg-surface border-t border-border shadow-[0_-6px_20px_rgba(0,0,0,0.1)]"
          style={{
            paddingTop: 12,
            paddingBottom: "max(12px, env(safe-area-inset-bottom))",
            paddingLeft: "max(18px, env(safe-area-inset-left))",
            paddingRight: "max(18px, env(safe-area-inset-right))",
          }}
        >
          <div>
            <div className="text-[11px] text-fg-muted">{cartCount} {cartCount === 1 ? "позиция" : "позиций"}</div>
            <div className="font-display font-bold text-base">{formatTenge(subtotalCents)}</div>
          </div>
          <button
            type="button"
            onClick={() => contactRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
            className="bg-accent text-accent-ink rounded-xl px-5 py-3 font-display font-bold text-[13px]"
          >
            К оформлению
          </button>
        </div>
      )}
    </>
  );
}

function StepLabel({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-2.5">
      <span className="w-[21px] h-[21px] rounded-full bg-surface-2 border border-border text-fg-muted text-[11px] font-bold flex items-center justify-center font-display">
        {n}
      </span>
      <span className="text-xs font-bold uppercase tracking-wide text-fg-muted">{title}</span>
    </div>
  );
}

function CatPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-shrink-0 border rounded-full px-3.5 py-2 text-xs font-bold whitespace-nowrap ${
        active ? "bg-accent text-accent-ink border-accent" : "border-border bg-surface text-fg-muted"
      }`}
    >
      {children}
    </button>
  );
}

function QtyBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-6 h-6 rounded-[7px] border border-border bg-surface-2 text-fg font-bold text-sm flex items-center justify-center disabled:opacity-35"
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 mt-3 first:mt-0">
      <label className="text-[10.5px] font-bold uppercase tracking-wide text-fg-muted">{label}</label>
      {children}
    </div>
  );
}
