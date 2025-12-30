import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { BACKEND_URL } from '@/utils/config';

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId?: string;
  businessName?: string;
  phone?: string;
};

type LoginPayload = {
  email: string;
  password: string;
};

type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  businessName?: string;
  phone?: string;
};

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const extractError = async (response: Response) => {
  try {
    const data = await response.json();
    return data.error || response.statusText;
  } catch (_error) {
    return response.statusText;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem('accessToken'));
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    localStorage.removeItem('accessToken');
    setAccessToken(null);
    setUser(null);
  }, []);

  const storeTokens = useCallback((tokens: { accessToken: string; refreshToken?: string }) => {
    localStorage.setItem('accessToken', tokens.accessToken);
    setAccessToken(tokens.accessToken);

    if (tokens.refreshToken) {
      localStorage.setItem('refreshToken', tokens.refreshToken);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!accessToken) {
      setUser(null);
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(await extractError(response));
      }

      const data = await response.json();
      setUser(data.data);
    } catch (error) {
      console.error('❌ Failed to refresh user session', error);
      clearSession();
    }
  }, [accessToken, clearSession]);

  useEffect(() => {
    const initialize = async () => {
      if (!accessToken) {
        setLoading(false);
        return;
      }

      if (user) {
        setLoading(false);
        return;
      }

      await refreshUser();
      setLoading(false);
    };

    initialize();
  }, [accessToken, user, refreshUser]);

  // Sync accessToken from localStorage when it changes (login outside AuthContext)
  useEffect(() => {
    const syncToken = () => {
      const token = localStorage.getItem('accessToken');
      if (token && token !== accessToken) {
        setAccessToken(token);
      }
    };

    window.addEventListener('storage', syncToken);
    window.addEventListener('focus', syncToken);
    window.addEventListener('moca-auth-updated', syncToken as EventListener);

    syncToken();

    return () => {
      window.removeEventListener('storage', syncToken);
      window.removeEventListener('focus', syncToken);
      window.removeEventListener('moca-auth-updated', syncToken as EventListener);
    };
  }, [accessToken]);

  const login = useCallback(
    async ({ email, password }: LoginPayload) => {
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      storeTokens(data.data.tokens);
      setUser(data.data.user);
      setLoading(false);

      localStorage.removeItem('businessInfo');
      localStorage.removeItem('agentBehavior');
    },
    [storeTokens]
  );

  const register = useCallback(
    async ({ name, email, password, businessName, phone }: RegisterPayload) => {
      const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          email,
          password,
          businessName,
          phone,
          agentSettings: {
            systemPrompt:
              'You are a helpful customer service assistant for a business. Respond to customer inquiries professionally and helpfully.',
            toneOfVoice: 'professional',
            keyInformation: ''
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      storeTokens(data.data.tokens);
      setUser(data.data.user);
      setLoading(false);

      localStorage.removeItem('businessInfo');
      localStorage.removeItem('agentBehavior');
    },
    [storeTokens]
  );

  const logout = useCallback(async () => {
    try {
      if (accessToken) {
        await fetch(`${BACKEND_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });
      }
    } catch (error) {
      console.warn('⚠️ Logout request failed, clearing session locally', error);
    } finally {
      clearSession();
      setLoading(false);
    }
  }, [accessToken, clearSession]);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        loading,
        login,
        register,
        logout,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};

