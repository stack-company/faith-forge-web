import React from 'react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SuperAdminLayout from './SuperAdminLayout';
import { AdminSystemOperationsView } from '@/views/admin/system/AdminSystemOperationsView';
import { APP_ROUTES } from '@/config/routes';
import { AppCapability, CapabilityContext, hasCapability } from '@/libs/utils/auth/capabilities';

const mockUseAppSelector = vi.fn();
const mockUseAppDispatch = vi.fn();
const mockUsePermissions = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue || key,
  }),
}));

vi.mock('@/libs/state/redux/hooks', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) => mockUseAppSelector(selector),
  useAppDispatch: () => mockUseAppDispatch,
}));

vi.mock('@/libs/hooks/usePermissions', () => ({
  usePermissions: () => mockUsePermissions(),
}));

vi.mock('@/views/admin/system/components/CodeMigrationsSection', () => ({
  default: () => <div data-testid="code-migrations-section">Migrations</div>,
}));

vi.mock('@/views/admin/system/components/CacheManagementSection', () => ({
  default: () => <div data-testid="cache-management-section">Cache</div>,
}));

const buildCapabilityContext = (
  isAdmin: boolean,
  isSuperAdmin: boolean
): CapabilityContext =>
  ({
    isAdmin,
    isSuperAdmin,
  }) as CapabilityContext;

const defaultState = {
  authSlice: {
    user: {
      firstName: 'Super',
      lastName: 'Admin',
      email: 'super@example.com',
    },
  },
};

describe('SC-46: SuperAdminLayout hosts /system exclusively', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAppSelector.mockImplementation((selector) => selector(defaultState));
  });

  it('HP-01: SUPER_ADMIN sees Churches and System Operations in SuperAdminLayout and can operate migrations & cache on /system', () => {
    const superAdminCtx = buildCapabilityContext(true, true);
    mockUsePermissions.mockReturnValue({
      ...superAdminCtx,
      can: (cap: AppCapability) => hasCapability(cap, superAdminCtx),
    });

    render(
      <MemoryRouter initialEntries={[APP_ROUTES.superAdmin.root]}>
        <Routes>
          <Route element={<SuperAdminLayout />}>
            <Route path={APP_ROUTES.superAdmin.root} element={<div data-testid="churches-view">Churches</div>} />
            <Route path={APP_ROUTES.superAdmin.systemOperations} element={<AdminSystemOperationsView />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getAllByText('admin:super_admin.nav_churches').length).toBeGreaterThan(0);
    const systemOpsBtn = screen.getByRole('button', { name: 'admin:super_admin.nav_system_operations' });
    expect(systemOpsBtn).toBeInTheDocument();

    fireEvent.click(systemOpsBtn);

    expect(screen.getByTestId('code-migrations-section')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'admin:system_operations.tabs.cache' }));
    expect(screen.getByTestId('cache-management-section')).toBeInTheDocument();
  });

  it('CB-01: User without platform/system capabilities is redirected to login from SuperAdminLayout', () => {
    const churchAdminCtx = buildCapabilityContext(true, false);
    mockUsePermissions.mockReturnValue({
      ...churchAdminCtx,
      can: (cap: AppCapability) => hasCapability(cap, churchAdminCtx),
    });

    render(
      <MemoryRouter initialEntries={[APP_ROUTES.superAdmin.systemOperations]}>
        <Routes>
          <Route element={<SuperAdminLayout />}>
            <Route path={APP_ROUTES.superAdmin.systemOperations} element={<AdminSystemOperationsView />} />
          </Route>
          <Route path={APP_ROUTES.auth.login} element={<div data-testid="login-view">Login</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('login-view')).toBeInTheDocument();
    expect(screen.queryByTestId('code-migrations-section')).not.toBeInTheDocument();
  });
});
