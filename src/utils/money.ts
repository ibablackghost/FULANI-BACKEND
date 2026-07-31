/** Helpers XOF — prix entiers uniquement. */
export const CURRENCY = 'XOF' as const;

export const toXof = (value: unknown): number => {
  const n = Number.parseInt(String(value ?? '').replace(/\D/g, ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export const formatXof = (amount: number): string =>
  `${new Intl.NumberFormat('fr-FR').format(toXof(amount))} F CFA`;
