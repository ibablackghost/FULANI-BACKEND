/** GA4 — Measurement Protocol / config helpers. */

export type Ga4PublicConfig = {
  measurementId: string;
  propertyId: string;
  enabled: boolean;
  debug: boolean;
};

export type Ga4Secrets = {
  apiSecret?: string;
};

export const emptyGa4Config = (): Ga4PublicConfig => ({
  measurementId: '',
  propertyId: '',
  enabled: false,
  debug: false,
});

export const normalizeGa4Config = (
  config: Record<string, any> | null | undefined
): Ga4PublicConfig => {
  const base = emptyGa4Config();
  if (!config || typeof config !== 'object') return base;

  return {
    measurementId: String(config.measurementId ?? config.ga4MeasurementId ?? '').trim(),
    propertyId: String(config.propertyId ?? '').trim(),
    enabled: Boolean(config.enabled),
    debug: Boolean(config.debug),
  };
};

/** Retire tout secret éventuellement collé par erreur dans config (admin). */
export const stripGa4SecretsFromConfig = (config: Record<string, any> | null | undefined) => {
  const normalized = normalizeGa4Config(config);
  const leaked = String(config?.apiSecret ?? '').trim();
  return { config: normalized, leakedApiSecret: leaked || null };
};

export const getGa4MeasurementId = (config: Record<string, any> | null | undefined) => {
  const id = normalizeGa4Config(config).measurementId;
  return id || null;
};

export const parseGa4Secrets = (raw: string | null | undefined): Ga4Secrets => {
  if (!raw) return {};
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') {
      return { apiSecret: String(parsed.apiSecret ?? '').trim() || undefined };
    }
  } catch {
    // Plain apiSecret string (legacy / env hydrate)
  }
  return { apiSecret: trimmed };
};
