/**
 * Session state. The access token lives in memory inside api.ts; this provider
 * owns the user record and the bootstrap that restores a session on reload by
 * exchanging the httpOnly refresh cookie.
 */
import {
  createContext, useCallback, useContext, useEffect, useState, type ReactNode,
} from 'react';
import { api, setAccessToken, setTenantSlug, getTenantSlug, onSessionLost } from './api';

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  displayName?: string;
  tenant: { slug: string; name: string };
  roles: string[];
  permissions: string[];
  plantIds?: string[];
};

type LoginResult = { accessToken: string; expiresIn: number; user: AuthUser };

type AuthState = {
  user: AuthUser | null;
  /** True until the initial refresh attempt settles, so routes do not flash. */
  loading: boolean;
  login: (email: string, password: string, tenantSlug?: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<AuthState>({
  user: null, loading: true,
  login: async () => {}, logout: async () => {},
});

export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((result: LoginResult) => {
    setAccessToken(result.accessToken);
    setTenantSlug(result.user.tenant.slug);
    setUser(result.user);
  }, []);

  const login = useCallback(
    async (email: string, password: string, tenantSlug?: string) => {
      // The slug must be on the request before it is sent, because the API reads
      // X-Tenant to disambiguate users who exist in several workspaces.
      if (tenantSlug) setTenantSlug(tenantSlug);
      const result = await api.post<LoginResult>(
        '/auth/login',
        { email, password, tenantSlug: tenantSlug ?? getTenantSlug() ?? undefined },
        { retryOnUnauthorised: false },
      );
      applySession(result);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', undefined, { retryOnUnauthorised: false });
    } finally {
      setAccessToken(null);
      setUser(null);
      // The slug is kept so the login form can prefill the workspace.
    }
  }, []);

  // Restore the session on first load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (await api.refresh()) {
          const me = await api.get<AuthUser>('/auth/me');
          if (!cancelled) {
            setTenantSlug(me.tenant.slug);
            setUser(me);
          }
        }
      } catch {
        // No valid refresh cookie — the user simply needs to sign in.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // A failed mid-session refresh clears the user, so ProtectedRoute redirects.
  useEffect(() => onSessionLost(() => setUser(null)), []);

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}
