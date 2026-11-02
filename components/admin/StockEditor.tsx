"use client";

import { useState } from "react";
import type { MenuItemWithStock } from "@/lib/data";
import { updateStock } from "@/app/actions/admin";

export function StockEditor({ menu }: { menu: MenuItemWithStock[] }) {
  const trackable = menu.filter((m) => m.trackStock);
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(trackable.map((m) => [m.id, m.remaining ?? m.defaultStock]))
  );
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function save() {
    setSaving(true);
    await updateStock(values);
    setSaving(false);
    setSavedAt(Date.now());
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-4 grid gap-1">
      {trackable.map((m) => (
        <div key={m.id} className="flex items-center justify-between gap-2 py-1.5 border-t border-dashed border-border first:border-t-0 text-[12.5px]">
          <span>{m.name}</span>
          <input
            type="number"
            min={0}
            value={values[m.id]}
            onChange={(e) => setValues((v) => ({ ...v, [m.id]: Math.max(0, Number(e.target.value) || 0) }))}
            className="w-14 px-1.5 py-1.5 rounded-[7px] border border-border bg-surface-2 text-fg text-center"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="mt-2.5 bg-accent text-accent-ink rounded-lg px-3.5 py-2.5 text-xs font-bold disabled:opacity-60 justify-self-start"
      >
        {saving ? "Сохраняю…" : "Сохранить остатки"}
      </button>
      {savedAt && <span className="text-[10.5px] text-fg-muted">Сохранено</span>}
    </div>
  );
}
