export function Header() {
  return (
    <header className="flex items-center gap-2.5 pt-4">
      <div className="w-9 h-9 rounded-[11px] bg-accent text-accent-ink flex items-center justify-center font-display font-bold text-[15px] flex-shrink-0">
        J
      </div>
      <div>
        <div className="font-display font-semibold text-[15px] leading-tight">Jam Bakery</div>
        <div className="text-[10.5px] text-fg-muted">Костанай · ссылка из Instagram</div>
      </div>
    </header>
  );
}
