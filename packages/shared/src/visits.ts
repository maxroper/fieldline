/** "1042" for the first visit, "1042-2" for the second. Return visits share the number and get a higher trip. */
export function visitLabel(number: number, trip: number | null | undefined): string {
  const t = trip ?? 1;
  return t > 1 ? `${number}-${t}` : String(number);
}

export function woLabel(wo: { number: number; trip?: number | null }): string {
  return visitLabel(wo.number, wo.trip);
}
