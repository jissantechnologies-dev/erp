/**
 * Sign-in. Sits outside the app shell, so it uses the auth-card styles from
 * app.css rather than the shell layout.
 */
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { getTenantSlug } from '@/lib/api';
import { useDocumentTitle } from '@/lib/hooks';
import { Button, Ms } from '@/components/ui';

export function Login() {
  const { user, loading, login } = useAuth();
  const location = useLocation();

  const [email, setEmail] = useState('admin@indusfoundries.in');
  const [password, setPassword] = useState('');
  const [workspace, setWorkspace] = useState(getTenantSlug() ?? 'indus-foundries');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useDocumentTitle('Sign in');

  if (loading) {
    return (
      <div className="auth-wrap">
        <div className="auth-card"><div className="skel" style={{ height: 20, width: '60%' }} /></div>
      </div>
    );
  }

  if (user) {
    const from = (location.state as { from?: string } | null)?.from ?? '/app/masters/parts';
    return <Navigate to={from} replace />;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password, workspace.trim() || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit} noValidate>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div className="logo">IF</div>
          <div>
            <div className="brand-t">INDUS FOUNDRIES</div>
            <div className="brand-s">Foundry ERP</div>
          </div>
        </div>

        <h1>Sign in</h1>
        <p className="sub">Use your workspace account to continue.</p>

        {error ? (
          <div className="alert alert-bad" style={{ marginBottom: 14 }}>
            <Ms name="error" />
            <div>{error}</div>
          </div>
        ) : null}

        <div className="f">
          <label htmlFor="workspace">Workspace</label>
          <input
            id="workspace" value={workspace} autoComplete="organization"
            onChange={(e) => setWorkspace(e.target.value)}
            placeholder="your-company"
          />
        </div>

        <div className="f">
          <label htmlFor="email">Email</label>
          <input
            id="email" type="email" value={email} required autoComplete="username"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="f">
          <label htmlFor="password">Password</label>
          <input
            id="password" type="password" value={password} required autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <Button variant="primary" type="submit" loading={busy} icon="login">Sign in</Button>

        <div className="kbd-note" style={{ marginTop: 16, textAlign: 'center' }}>
          Demo: admin@indusfoundries.in · IndusDemo2026!
        </div>
      </form>
    </div>
  );
}
