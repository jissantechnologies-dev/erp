/**
 * The application shell: floating sidebar card, banner header and page area.
 * Structure and class names come straight from the prototype's static markup,
 * with the nav driven by @erp/shared's NAV and filtered by the signed-in user's
 * permissions.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { NAV, can, type NavGroup } from '@erp/shared';
import { Ms } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

export function AppShell() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();

  const [mini, setMini] = useState(() => localStorage.getItem('erp:sidebar') === 'mini');
  const [mobileOpen, setMobileOpen] = useState(false);

  // Only show groups the user can actually open, so the sidebar never offers a
  // route that will 403.
  const groups = useMemo<NavGroup[]>(
    () => NAV.filter((g) => can(user?.permissions ?? [], g.permission)),
    [user?.permissions],
  );

  const currentPath = location.pathname.replace(/^\/app\//, '');
  const activeGroup = groups.find((g) =>
    g.items.some((it) => currentPath.startsWith(it.path)) ||
    (g.items.length === 0 && currentPath === g.key),
  );

  // Expanded groups: start with whichever group owns the current route.
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(activeGroup ? [activeGroup.key] : ['masters']),
  );

  // Keep the active group expanded when navigating from elsewhere (e.g. a
  // breadcrumb or a cross-module link), without collapsing what the user opened.
  useEffect(() => {
    if (activeGroup) setOpen((s) => (s.has(activeGroup.key) ? s : new Set(s).add(activeGroup.key)));
  }, [activeGroup?.key]);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  useEffect(() => {
    localStorage.setItem('erp:sidebar', mini ? 'mini' : 'full');
  }, [mini]);

  const toggleGroup = (key: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  return (
    <div className="app">
      <aside id="side" className={`side ${mini ? 'mini' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="side-brand">
          <div className="logo">IF</div>
          {!mini ? (
            <div>
              <div className="brand-t">{user?.tenant.name ?? 'INDUS'}</div>
              <div className="brand-s">Foundry ERP</div>
            </div>
          ) : null}
        </div>

        <button
          className="side-collapse"
          onClick={() => setMini((m) => !m)}
          aria-label={mini ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Ms name={mini ? 'chevron_right' : 'chevron_left'} />
        </button>

        <nav className="nav" id="nav">
          {groups.map((g) => {
            const isOpen = open.has(g.key);
            const isCurrent = activeGroup?.key === g.key;

            // Groups with no children (Dashboard) link directly.
            if (g.items.length === 0) {
              return (
                <div key={g.key} className={`nav-group ${isCurrent ? 'current' : ''}`}>
                  <NavLink to={`/app/${g.key}`} className="nav-head" title={g.label}>
                    <Ms name={g.icon} />
                    {!mini ? <span className="lbl">{g.label}</span> : null}
                  </NavLink>
                </div>
              );
            }

            return (
              <div
                key={g.key}
                className={`nav-group ${isOpen ? 'open' : ''} ${isCurrent ? 'current' : ''}`}
              >
                <button
                  className="nav-head"
                  title={g.label}
                  onClick={() => toggleGroup(g.key)}
                  aria-expanded={isOpen}
                >
                  <Ms name={g.icon} />
                  {!mini ? (
                    <>
                      <span className="lbl">{g.label}</span>
                      <Ms name="chevron_right" className="chev" />
                    </>
                  ) : null}
                </button>
                <div className="nav-items">
                  {g.items.map((it) => (
                    <NavLink
                      key={it.path}
                      to={`/app/${it.path}`}
                      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                      {it.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="main">
        {/* Hero banner, reproducing the design's markup: menu button, plant
            silhouette, company name, and the user pill (uname then avatar). */}
        <header className="banner">
          <button
            className="icon-btn menu-btn"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Open menu"
          >
            <Ms name="menu" />
          </button>

          <svg className="plant" viewBox="0 0 600 120" preserveAspectRatio="xMaxYMax slice" aria-hidden="true">
            <g fill="#1b1d20">
              <rect x="60" y="40" width="14" height="80" /><rect x="92" y="22" width="16" height="98" />
              <path d="M130 120V64l40-20v20l40-20v20l40-20v20l40-20v76z" />
              <rect x="330" y="50" width="120" height="70" /><rect x="350" y="14" width="12" height="40" /><rect x="380" y="28" width="12" height="26" />
              <path d="M460 120V78h60l20-22h40v64z" />
            </g>
            <g fill="#ffb460" opacity=".9">
              <rect x="345" y="78" width="10" height="8" /><rect x="365" y="78" width="10" height="8" />
              <rect x="385" y="78" width="10" height="8" /><rect x="405" y="78" width="10" height="8" />
              <rect x="150" y="90" width="12" height="8" /><rect x="190" y="90" width="12" height="8" />
              <rect x="230" y="90" width="12" height="8" />
            </g>
          </svg>

          <div style={{ position: 'relative', minWidth: 0 }}>
            <h1>{(user?.tenant.name ?? 'INDUS FOUNDRIES').toUpperCase()}</h1>
            <div className="loc">Ferrous Castings &amp; Machining</div>
          </div>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
            <button className="icon-btn" onClick={toggle} aria-label="Toggle dark mode">
              <Ms name={theme === 'dark' ? 'light_mode' : 'dark_mode'} />
            </button>
            <button className="userpill" onClick={logout} title="Sign out">
              <span className="uname">{user?.displayName ?? user?.email}</span>
              <span className="avatar">{initials(user?.fullName ?? '?')}</span>
              <Ms name="logout" />
            </button>
          </div>
        </header>

        <main className="page" id="page">
          <Outlet />
        </main>
      </div>

      {/* Scrim for the mobile drawer. */}
      {mobileOpen ? (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 2 }}
        />
      ) : null}
    </div>
  );
}

const initials = (name: string): string =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');

/** Shared placeholder for the nav items the design marks as not yet built. */
export function ComingSoon({ title, group }: { title: string; group?: string }) {
  return (
    <>
      <div className="crumbs">
        {group ? <><a>{group}</a><span>/</span></> : null}
        <span>{title}</span>
      </div>
      <div className="ptitle-row">
        <h1 className="ptitle">
          {title}
          <small>This module is designed but not yet built</small>
        </h1>
      </div>
      <div className="card">
        <div className="empty">
          <Ms name="construction" />
          <h3>{title} is on the way</h3>
          <p>
            The screen is specified in the design. It will follow the same
            pattern as the Masters module: register, detail tabs and forms.
          </p>
          <Link className="btn btn-primary" to="/app/masters/parts">Go to Part Master</Link>
        </div>
      </div>
    </>
  );
}
