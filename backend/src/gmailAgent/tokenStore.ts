export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
}

export interface TokenStore {
  get(): TokenSet | null;
  set(tokens: TokenSet): Promise<void>;
}

/**
 * Minimal token store backed by environment variables.
 * This keeps the MVP small while allowing future storage (DB/secret manager).
 */
class EnvTokenStore implements TokenStore {
  get(): TokenSet | null {
    const accessToken = process.env.GMAIL_ACCESS_TOKEN;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
    const expiryDate = process.env.GMAIL_TOKEN_EXPIRY
      ? Number(process.env.GMAIL_TOKEN_EXPIRY)
      : undefined;

    if (!accessToken) {
      return null;
    }

    return {
      accessToken,
      refreshToken,
      expiryDate: Number.isNaN(expiryDate) ? undefined : expiryDate
    };
  }

  async set(tokens: TokenSet): Promise<void> {
    // In MVP we cannot persist to env at runtime.
    // We log guidance so operator can update secure storage manually.
    console.warn(
      '⚠️ [GmailAgent][TokenStore] set() called but Env store is read-only. Update GMAIL_ACCESS_TOKEN/GMAIL_REFRESH_TOKEN manually.'
    );
    if (tokens.expiryDate) {
      console.warn('⚠️ [GmailAgent][TokenStore] New expiryDate:', tokens.expiryDate);
    }
  }
}

export const tokenStore: TokenStore = new EnvTokenStore();

