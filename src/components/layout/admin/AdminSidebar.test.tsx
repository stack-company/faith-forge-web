import React from 'react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { AdminSystemOperationsView } from '@/views/admin/system/AdminSystemOperationsView';
import { APP_ROUTES } from '@/config/routes';
import { AppCapability, CapabilityContext, hasCapability } from '@/libs/utils/auth/capabilities';

const mockUseAppSelector = vi.fn();
const mockUsePermissions = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue || key,
  }),
}));

vi.mock('@/libs/state/redux/hooks', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) => mockUseAppSelector(selector),
}));

vi.mock('@/libs/hooks/usePermissions', () => ({
  usePermissions: () => mockUsePermissions(),
}));

vi.mock('@/libs/hooks/useTerm', () => ({
  useChurchTerm: (term: string) => term,
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
    experiences: ['ADMIN'],
  },
  churchCampusSlice: {
    church: { id: 'church-1', name: 'Iglesia Central' },
    data: [{ id: 'campus-1', name: 'Sede Norte' }],
  },
  volunteerApplicationSlice: {
    pendingCount: 0,
  },
};

describe('SC-33: Platform (SUPER_ADMIN) vs Church (CHURCH_ADMIN) capability isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAppSelector.mockImplementation((selector) => selector(defaultState));
  });

  it('HP-01: CHURCH_ADMIN sees active church name and church sections, but NOT system operations in AdminSidebar', () => {
    const churchAdminCtx = buildCapabilityContext(true, false);
    mockUsePermissions.mockReturnValue({
      ...churchAdminCtx,
      can: (cap: AppCapability) => hasCapability(cap, churchAdminCtx),
    });

    render(
      <MemoryRouter initialEntries={[APP_ROUTES.admin.root]}>
        <AdminSidebar
          onOpenTerminology={vi.fn()}
          onOpenClearCache={vi.fn()}
          onOpenChangelog={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Iglesia Central')).toBeInTheDocument();
    expect(screen.getByText('admin:layout.role_church_admin')).toBeInTheDocument();
    expect(screen.getByText('admin:layout.sidebar.users_directory')).toBeInTheDocument();
    expect(screen.queryByText('admin:layout.sidebar.system_operations')).not.toBeInTheDocument();
  });

  it('HP-02: SUPER_ADMIN does NOT see system operations in AdminSidebar (moved to SuperAdminLayout)', () => {
    const superAdminCtx = buildCapabilityContext(true, true);
    mockUsePermissions.mockReturnValue({
      ...superAdminCtx,
      can: (cap: AppCapability) => hasCapability(cap, superAdminCtx),
    });

    render(
      <MemoryRouter initialEntries={[APP_ROUTES.admin.root]}>
        <AdminSidebar
          onOpenTerminology={vi.fn()}
          onOpenClearCache={vi.fn()}
          onOpenChangelog={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('admin:layout.role_super_admin')).toBeInTheDocument();
    expect(screen.queryByText('admin:layout.sidebar.system_operations')).not.toBeInTheDocument();
  });

  it('CB-01: User without admin:manage-system-operations navigating to /system is redirected to /', () => {
    const churchAdminCtx = buildCapabilityContext(true, false);
    mockUsePermissions.mockReturnValue({
      ...churchAdminCtx,
      can: (cap: AppCapability) => hasCapability(cap, churchAdminCtx),
    });

    render(
      <MemoryRouter initialEntries={[APP_ROUTES.superAdmin.systemOperations]}>
        <Routes>
          <Route path={APP_ROUTES.superAdmin.systemOperations} element={<AdminSystemOperationsView />} />
          <Route path={APP_ROUTES.superAdmin.root} element={<div data-testid="super-admin-home">Super Admin Home</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('super-admin-home')).toBeInTheDocument();
    expect(screen.queryByTestId('code-migrations-section')).not.toBeInTheDocument();
  });

  it('HP-01: SUPER_ADMIN accessing /system renders AdminSystemOperationsView', () => {
    const superAdminCtx = buildCapabilityContext(true, true);
    mockUsePermissions.mockReturnValue({
      ...superAdminCtx,
      can: (cap: AppCapability) => hasCapability(cap, superAdminCtx),
    });

    render(
      <MemoryRouter initialEntries={[APP_ROUTES.superAdmin.systemOperations]}>
        <Routes>
          <Route path={APP_ROUTES.superAdmin.systemOperations} element={<AdminSystemOperationsView />} />
          <Route path={APP_ROUTES.superAdmin.root} element={<div data-testid="super-admin-home">Super Admin Home</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('code-migrations-section')).toBeInTheDocument();
  });
});
