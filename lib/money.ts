export function formatTenge(cents: number): string {
  const whole = Math.round(cents / 100);
  return whole.toLocaleString("ru-RU") + " ₸";
}
