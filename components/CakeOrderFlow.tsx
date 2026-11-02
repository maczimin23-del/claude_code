"use client";

import { useMemo, useState } from "react";
import type { Branch } from "@prisma/client";
import type { CakeDay } from "@/lib/cake";
import { capacityUnits } from "@/lib/cake";
import { DECOR_LEVELS, type DecorId } from "@/lib/config";
import { formatTenge } from "@/lib/money";
import { createCakeOrder, lookupCakeOrdersByPhone, cancelCakeOrder } from "@/app/actions/cake";

type Props = {
  branches: Branch[];
  window: CakeDay[];
  shopWhatsapp: string;
};

const VISIBLE_DAYS = 7;
const STATUS_LABELS: Record<string, string> = {
  NEW: "Новая заявка",
  DEPOSIT_PENDING: "Ждём предоплату",
  CONFIRMED: "Подтверждено",
  READY: "Готово к выдаче",
  CANCELLED: "Отменено",
};

function dateLabel(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" });
}

export function CakeOrderFlow({ branches, window: capWindow, shopWhatsapp }: Props) {
  const [weightKg, setWeightKg] = useState(2);
  const [decor, setDecor] = useState<DecorId>(DECOR_LEVELS[1].id);
  const [dateOffset, setDateOffset] = useState<number | null>(null);
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cakeText, setCakeText] = useState("");
  const [refImage, setRefImage] = useState<string | undefined>(undefined);
  const [refImageError, setRefImageError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    { ok: true; priceCents: number; waText: string } | { ok: false; error: string; suggestedOffset?: number } | null
  >(null);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupResults, setLookupResults] = useState<
    Awaited<ReturnType<typeof lookupCakeOrdersByPhone>> | null
  >(null);

  const requiredUnits = useMemo(() => capacityUnits(weightKg, decor), [weightKg, decor]);
  const visible = capWindow.slice(0, VISIBLE_DAYS);
  const selectedFits =
    dateOffset !== null && (() => {
      const d = capWindow.find((x) => x.offset === dateOffset);
      return d ? d.capacity - d.usedUnits >= requiredUnits - 0.001 : false;
    })();
  const nearest = useMemo(() => capWindow.find((d) => d.capacity - d.usedUnits >= requiredUnits - 0.001), [capWindow, requiredUnits]);

  const canSubmit = dateOffset !== null && selectedFits && name.trim() && phone.trim();

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_100_000) {
      setRefImageError("Файл слишком большой — до 1 МБ.");
      return;
    }
    setRefImageError(null);
    const reader = new FileReader();
    reader.onload = () => setRefImage(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setResult(null);
    const res = await createCakeOrder({
      weightKg,
      decor,
      dateOffset: dateOffset!,
      branchId,
      name,
      phone,
      cakeText: cakeText || undefined,
      refImageDataUrl: refImage,
    });
    setResult(res);
    setSubmitting(false);
    if (res.ok) {
      setName("");
      setPhone("");
      setCakeText("");
      setRefImage(undefined);
    }
  }

  async function runLookup() {
    const res = await lookupCakeOrdersByPhone(lookupPhone);
    setLookupResults(res);
  }

  const waUrl = result?.ok && `https://wa.me/${shopWhatsapp}?text=${encodeURIComponent(result.waText)}`;

  return (
    <>
      <section className="pt-[18px] pb-0.5">
        <div className="text-[10.5px] font-bold tracking-wider uppercase text-accent">Отдельный поток — под заказ, не с полки</div>
        <h1 className="font-display text-[22px] mt-1 max-w-[20ch] leading-tight">Торт считается отдельно от дневной кухни</h1>
        <p className="text-fg-muted text-[13px] mt-1 max-w-[50ch]">
          У кондитерского цеха своя дневная мощность в весовых единицах — большой тортовый заказ не блокирует обычный самовывоз.
        </p>
        <button type="button" onClick={() => setLookupOpen((v) => !v)} className="text-[11.5px] font-bold text-accent underline underline-offset-2 mt-2">
          Уже оформляли заказ? Проверить статус
        </button>
        {lookupOpen && (
          <div className="bg-surface border border-border rounded-xl p-3.5 mt-2 grid gap-2.5">
            <div className="flex gap-2">
              <input value={lookupPhone} onChange={(e) => setLookupPhone(e.target.value)} type="tel" placeholder="Ваш телефон" className="flex-1 px-3 py-2.5 rounded-[9px] border border-border bg-surface-2 text-fg" />
              <button type="button" onClick={runLookup} className="border-none bg-accent text-accent-ink rounded-[9px] px-4 font-bold text-[12.5px]">
                Найти
              </button>
            </div>
            {lookupResults && (
              <div className="grid gap-2 text-[12.5px]">
                {lookupResults.length === 0 && <div className="text-fg-muted">Заявок с этим номером не найдено.</div>}
                {lookupResults.map((o) => (
                  <div key={o.id} className="flex justify-between items-center border-t border-dashed border-border pt-2">
                    <div>
                      <strong>{o.date}</strong> · {o.weightKg} кг, {DECOR_LEVELS.find((d) => d.id === o.decor)?.name}
                      <div className="text-fg-muted text-[11px]">{STATUS_LABELS[o.status]}</div>
                    </div>
                    {o.status !== "CANCELLED" && o.status !== "READY" && (
                      <button
                        type="button"
                        onClick={async () => {
                          await cancelCakeOrder(o.id);
                          runLookup();
                        }}
                        className="border border-bad text-bad rounded-lg px-2.5 py-1 text-[11px] font-bold"
                      >
                        Отменить
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <div className="mt-5">
        <StepLabel n={1} title="Вес торта" />
        <div className="flex items-center gap-2.5 bg-surface border border-border rounded-xl px-3.5 py-2.5 w-fit">
          <input
            type="number"
            min={0.5}
            step={0.5}
            value={weightKg}
            onChange={(e) => setWeightKg(Math.max(0.5, Number(e.target.value) || 0.5))}
            className="w-16 border-none bg-transparent text-fg text-lg font-bold font-display text-center"
          />
          <span className="text-fg-muted text-[13px]">кг</span>
        </div>
      </div>

      <div className="mt-5">
        <StepLabel n={2} title="Декор" />
        <div className="flex flex-wrap gap-2">
          {DECOR_LEVELS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDecor(d.id)}
              className={`border rounded-xl px-3.5 py-2.5 text-left text-[13.5px] font-semibold ${
                d.id === decor ? "border-accent bg-surface-2" : "border-border bg-surface"
              }`}
            >
              <div>{d.name} · {formatTenge(d.ratePerKgCents)}/кг</div>
              <div className="text-[11px] font-medium text-fg-muted">{d.sub}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <StepLabel n={3} title="Дата готовности" />
        <div className="grid gap-2">
          {visible.map((d) => {
            const remaining = Math.round((d.capacity - d.usedUnits) * 10) / 10;
            const ok = d.capacity > 0 && d.capacity - d.usedUnits >= requiredUnits - 0.001;
            const pct = d.capacity > 0 ? Math.min(100, Math.round((d.usedUnits / d.capacity) * 100)) : 100;
            const barColor = pct >= 85 ? "bg-bad" : pct >= 55 ? "bg-warn" : "bg-good";
            return (
              <div
                key={d.date}
                className={`grid grid-cols-[1fr_auto] gap-2.5 items-center bg-surface border rounded-xl px-3.5 py-2.5 ${
                  dateOffset === d.offset ? "border-accent" : "border-border"
                } ${!ok ? "opacity-70" : ""}`}
              >
                <div className="grid gap-1">
                  <span className="text-[12.5px] font-bold">{dateLabel(d.date)}</span>
                  <span className="h-1.5 rounded-full bg-surface-2 overflow-hidden w-[140px] max-w-[34vw]">
                    <span className={`block h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                  </span>
                  <span className="text-[10px] text-fg-muted">
                    {d.capacity === 0 ? "выходной цеха" : ok ? `свободно ${remaining} из ${d.capacity} ед.` : "мощности не хватит под ваш торт"}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={!ok}
                  onClick={() => setDateOffset(d.offset)}
                  className={`border rounded-lg px-3 py-1.5 text-[11.5px] font-bold disabled:opacity-40 ${
                    dateOffset === d.offset ? "bg-accent text-accent-ink border-accent" : "border-border bg-surface-2 text-fg"
                  }`}
                >
                  {dateOffset === d.offset ? "Выбрано" : "Выбрать"}
                </button>
              </div>
            );
          })}
        </div>

        {dateOffset !== null && !selectedFits && (
          <div className="bg-warn-bg border border-warn rounded-xl p-3.5 mt-2.5 grid gap-2">
            {nearest ? (
              <>
                <p className="m-0 text-[12.5px]">
                  На выбранной дате места не хватает. Ближайшая, где цех точно успеет — <strong>{dateLabel(nearest.date)}</strong>.
                </p>
                <button type="button" onClick={() => setDateOffset(nearest.offset)} className="justify-self-start bg-warn text-[#241505] rounded-lg px-3.5 py-2 text-xs font-bold">
                  Выбрать эту дату
                </button>
              </>
            ) : (
              <p className="m-0 text-[12.5px]">На ближайшие недели у цеха нет места под торт такого веса и декора.</p>
            )}
          </div>
        )}
      </div>

      <div className="mt-5">
        <StepLabel n={4} title="Точка самовывоза" />
        <div className="flex flex-wrap gap-2">
          {branches.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBranchId(b.id)}
              className={`border rounded-xl px-3.5 py-2.5 text-[13px] font-semibold ${
                b.id === branchId ? "border-accent bg-surface-2" : "border-border bg-surface"
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <StepLabel n={5} title="Контакты" />
        <Field label="Имя">
          <input value={name} onChange={(e) => setName(e.target.value)} type="text" className="w-full px-3.5 py-2.5 rounded-[11px] border border-border bg-surface text-fg" />
        </Field>
        <Field label="Телефон">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" className="w-full px-3.5 py-2.5 rounded-[11px] border border-border bg-surface text-fg" />
        </Field>
        <Field label="Надпись на торте (необязательно)">
          <input value={cakeText} onChange={(e) => setCakeText(e.target.value)} className="w-full px-3.5 py-2.5 rounded-[11px] border border-border bg-surface text-fg" />
        </Field>
        <div className="flex items-center gap-2.5 mt-2.5">
          <label className="text-[11.5px] font-semibold border border-dashed border-border rounded-[10px] px-3.5 py-2.5 text-fg-muted cursor-pointer">
            + Фото-референс дизайна
            <input type="file" accept="image/*" onChange={onPhotoChange} className="hidden" />
          </label>
          {refImage && (
            // eslint-disable-next-line @next/next/no-img-element -- data: URL preview, next/image doesn't optimize these
            <img src={refImage} alt="Референс" className="w-10 h-10 rounded-[9px] object-cover border border-border" />
          )}
        </div>
        {refImageError && <div className="text-[10.5px] text-bad mt-1">{refImageError}</div>}

        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={handleSubmit}
          className="w-full mt-4 bg-accent text-accent-ink disabled:opacity-50 rounded-xl py-3.5 font-display font-bold text-[13.5px]"
        >
          {submitting ? "Отправляем…" : "Отправить заявку"}
        </button>

        {result && (
          <div className={`rounded-2xl p-4 mt-3.5 grid gap-2 border ${result.ok ? "bg-good-bg border-good" : "bg-bad-bg border-bad"}`}>
            {result.ok ? (
              <>
                <div className="font-bold text-[14.5px]">Заявка принята!</div>
                <p className="text-[12.5px] text-fg-muted m-0">
                  Бронь держится до предоплаты. Ориентировочно {formatTenge(result.priceCents)}.
                </p>
                {waUrl && (
                  <a href={waUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 bg-wa text-white rounded-[11px] px-4 py-3 font-bold text-[13px]">
                    Написать в WhatsApp
                  </a>
                )}
              </>
            ) : (
              <>
                <div className="font-bold text-[14.5px]">Не получилось</div>
                <p className="text-[12.5px] text-fg-muted m-0">{result.error}</p>
                {result.suggestedOffset !== undefined && (
                  <button type="button" onClick={() => setDateOffset(result.suggestedOffset!)} className="justify-self-start bg-accent text-accent-ink rounded-lg px-3.5 py-2 text-xs font-bold">
                    Выбрать подходящую дату
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function StepLabel({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-2.5">
      <span className="w-[21px] h-[21px] rounded-full bg-surface-2 border border-border text-fg-muted text-[11px] font-bold flex items-center justify-center font-display">{n}</span>
      <span className="text-xs font-bold uppercase tracking-wide text-fg-muted">{title}</span>
    </div>
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
