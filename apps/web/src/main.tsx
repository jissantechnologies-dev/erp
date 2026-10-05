import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NAV_INDEX } from '@erp/shared';

import './styles/design-system.css';
import './styles/app.css';

import { ThemeProvider } from '@/lib/theme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ToastProvider } from '@/components/ui';
import { AppShell, ComingSoon } from '@/layout/AppShell';

import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { PartsList } from '@/pages/masters/PartsList';
import { PartDetail } from '@/pages/masters/PartDetail';
import { PartForm } from '@/pages/masters/PartForm';
import { AlloysList } from '@/pages/masters/AlloysList';
import { AlloyDetail } from '@/pages/masters/AlloyDetail';
import { AlloyForm } from '@/pages/masters/AlloyForm';
import { ToolingList } from '@/pages/masters/ToolingList';
import { ToolDetail } from '@/pages/masters/ToolDetail';
import { ToolForm } from '@/pages/masters/ToolForm';
import { DrawingsList } from '@/pages/masters/DrawingsList';
import { DrawingDetail } from '@/pages/masters/DrawingDetail';
import { DrawingForm } from '@/pages/masters/DrawingForm';
import { MappingList } from '@/pages/masters/MappingList';
import { MappingForm } from '@/pages/masters/MappingForm';
import { CustomersList } from '@/pages/sales/CustomersList';
import { CustomerDetail } from '@/pages/sales/CustomerDetail';
import { CustomerForm } from '@/pages/sales/CustomerForm';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // A 401 is handled by the api layer's refresh; retrying here would only
      // duplicate requests that are going to fail for a different reason.
      retry: (failureCount, error) =>
        failureCount < 2 && !(error as { status?: number }).status,
    },
  },
});

/** Gates the app shell behind a session. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="skel" style={{ height: 18, width: '55%', marginBottom: 12 }} />
          <div className="skel" style={{ height: 14, width: '80%' }} />
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

/**
 * Catch-all for the nav entries marked `soon` in @erp/shared. Resolves the
 * path back to its label and group so the placeholder is titled correctly
 * rather than showing a bare 404.
 */
function SoonRoute() {
  const location = useLocation();
  const path = location.pathname.replace(/^\/app\//, '');
  const entry = NAV_INDEX.get(path);
  if (!entry) return <NotFound />;
  return <ComingSoon title={entry.item.label} group={entry.group.label} />;
}

function NotFound() {
  return (
    <>
      <div className="crumbs"><span>Not found</span></div>
      <div className="ptitle-row">
        <h1 className="ptitle">Page not found<small>That link does not point anywhere</small></h1>
      </div>
      <div className="card">
        <div className="empty">
          <span className="ms">explore_off</span>
          <h3>We could not find that page</h3>
          <p>Check the link, or pick a module from the sidebar.</p>
        </div>
      </div>
    </>
  );
}

/** Redirects /app/masters/parts/:id/edit through the shared PartForm. */
const PartEdit = () => {
  const { id } = useParams();
  return <PartForm key={id} />;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<Navigate to="/app/dashboard" replace />} />

                <Route path="/app" element={<RequireAuth><AppShell /></RequireAuth>}>
                  <Route index element={<Navigate to="/app/dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />

                  {/* Masters — built. `/new` is declared before `/:id` so it is
                      not captured as a record id. */}
                  <Route path="masters/parts" element={<PartsList />} />
                  <Route path="masters/parts/new" element={<PartForm />} />
                  <Route path="masters/parts/:id" element={<PartDetail />} />
                  <Route path="masters/parts/:id/edit" element={<PartEdit />} />

                  <Route path="masters/alloys" element={<AlloysList />} />
                  <Route path="masters/alloys/new" element={<AlloyForm />} />
                  <Route path="masters/alloys/:id" element={<AlloyDetail />} />
                  <Route path="masters/alloys/:id/edit" element={<AlloyForm />} />

                  <Route path="masters/drawings" element={<DrawingsList />} />
                  <Route path="masters/drawings/new" element={<DrawingForm />} />
                  <Route path="masters/drawings/:id" element={<DrawingDetail />} />

                  <Route path="masters/tooling" element={<ToolingList />} />
                  <Route path="masters/tooling/new" element={<ToolForm />} />
                  <Route path="masters/tooling/:id" element={<ToolDetail />} />
                  <Route path="masters/tooling/:id/edit" element={<ToolForm />} />

                  <Route path="masters/mapping" element={<MappingList />} />
                  <Route path="masters/mapping/new" element={<MappingForm />} />
                  <Route path="masters/mapping/:id/edit" element={<MappingForm />} />

                  {/* Sales — customers built, the rest placeholder */}
                  <Route path="sales/customers" element={<CustomersList />} />
                  <Route path="sales/customers/new" element={<CustomerForm />} />
                  <Route path="sales/customers/:id" element={<CustomerDetail />} />
                  <Route path="sales/customers/:id/edit" element={<CustomerForm />} />

                  {/* Everything the design marks as not-yet-built */}
                  <Route path="*" element={<SoonRoute />} />
                </Route>

                <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
