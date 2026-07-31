import { encryptSecret, isEncryptedPayload, decryptSecret } from '../../../../utils/crypto';
import { stripGa4SecretsFromConfig, parseGa4Secrets } from '../../../../integrations/google/ga4';

const moveLeakedGa4Secret = (data: any) => {
  if (!data || typeof data !== 'object') return;
  if (!data.config || typeof data.config !== 'object') return;

  // Only sanitize when provider is ga4 (create always has provider; update may not)
  const { config, leakedApiSecret } = stripGa4SecretsFromConfig(data.config);
  data.config = config;

  if (!leakedApiSecret) return;

  // Merge into secretsEncrypted JSON { apiSecret }
  let existing: Record<string, string> = {};
  if (data.secretsEncrypted && isEncryptedPayload(data.secretsEncrypted)) {
    try {
      existing = parseGa4Secrets(decryptSecret(data.secretsEncrypted)) as Record<string, string>;
    } catch {
      existing = {};
    }
  } else if (data.secretsEncrypted && !isEncryptedPayload(data.secretsEncrypted)) {
    existing = parseGa4Secrets(String(data.secretsEncrypted)) as Record<string, string>;
  }

  const merged = JSON.stringify({ ...existing, apiSecret: leakedApiSecret });
  data.secretsEncrypted = encryptSecret(merged);
};

export default {
  async beforeCreate(event: any) {
    const data = event.params.data;
    if (data?.provider === 'ga4' || data?.config?.measurementId !== undefined) {
      moveLeakedGa4Secret(data);
    }
    if (data?.secretsEncrypted && !isEncryptedPayload(data.secretsEncrypted)) {
      data.secretsEncrypted = encryptSecret(String(data.secretsEncrypted));
    }
  },
  async beforeUpdate(event: any) {
    const data = event.params.data;
    if (data?.config) {
      moveLeakedGa4Secret(data);
    }
    if (data?.secretsEncrypted && !isEncryptedPayload(data.secretsEncrypted)) {
      data.secretsEncrypted = encryptSecret(String(data.secretsEncrypted));
    }
  },
};
