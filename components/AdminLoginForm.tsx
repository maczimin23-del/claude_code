"use client";

import { useActionState } from "react";
import { adminLogin } from "@/app/actions/admin";

type State = { ok: boolean; error?: string };

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) => adminLogin(formData),
    { ok: true }
  );

  return (
    <form action={formAction} className="grid gap-3">
      <input
        name="password"
        type="password"
        placeholder="Код доступа"
        className="text-center tracking-[0.2em] text-lg px-3.5 py-3.5 rounded-xl border border-border bg-surface text-fg"
      />
      {state?.error && <div className="text-bad text-[12.5px]">{state.error}</div>}
      <button type="submit" disabled={pending} className="bg-accent text-accent-ink disabled:opacity-60 rounded-xl py-3.5 font-display font-bold">
        {pending ? "Входим…" : "Войти"}
      </button>
    </form>
  );
}
