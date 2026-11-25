import React from 'react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { AdminSystemOperationsView } from '@/views/admin/system/AdminSystemOperationsView';
import { APP_ROUTES } from '@/config/routes';
import { AppCapability, CapabilityContext, hasCapability } from '@/libs/utils/auth/capabilities';
import { EntityState, IChurch } from '@/libs/models';
import { DEV_TENANT_OVERRIDE_KEY, TENANT_BRANDING_CACHE_KEY } from '@/libs/utils/tenant';

const mockUseAppSelector = vi.fn();
const mockDispatch = vi.fn();
const mockUsePermissions = vi.fn();
const mockUseGetChurchesQuery = vi.fn();
const mockResetApiState = vi.fn(() => ({ type: 'api/resetApiState' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue || key,
  }),
}));

vi.mock('@/libs/state/redux/hooks', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) => mockUseAppSelector(selector),
  useAppDispatch: () => mockDispatch,
}));

vi.mock('@/libs/state/redux/api/churchApi', () => ({
  useGetChurchesQuery: (...args: unknown[]) => mockUseGetChurchesQuery(...args),
}));

vi.mock('@/libs/state/redux/api/baseApi', () => ({
  baseApi: {
    util: {
      resetApiState: () => mockResetApiState(),
    },
  },
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

const churchA = {
  id: 'church-1',
  name: 'Iglesia A',
  slug: 'iglesia-a',
  state: EntityState.ACTIVE,
} as IChurch;

const churchB = {
  id: 'church-2',
  name: 'Iglesia B',
  slug: 'iglesia-b',
  state: EntityState.ACTIVE,
} as IChurch;

const defaultState = {
  authSlice: {
    experiences: ['ADMIN'],
  },
  churchCampusSlice: {
    church: churchA,
    data: [{ id: 'campus-1', name: 'Sede Norte' }],
  },
  volunteerApplicationSlice: {
    pendingCount: 0,
  },
};

describe('Platform (SUPER_ADMIN) vs Church (CHURCH_ADMIN) capability isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    mockUseAppSelector.mockImplementation((selector) => selector(defaultState));
    mockUseGetChurchesQuery.mockReturnValue({
      data: { data: [churchA, churchB], total: 2 },
      isLoading: false,
    });
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        href: 'http://localhost:3000/admin?tenant=iglesia-a',
        protocol: 'http:',
        hostname: 'localhost',
        port: '3000',
        pathname: '/admin',
        search: '?tenant=iglesia-a',
        assign: vi.fn(),
      },
    });
  });

  it('CHURCH_ADMIN sees active church name and church sections, but NOT system operations in AdminSidebar', () => {
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

    expect(screen.getByText('Iglesia A')).toBeInTheDocument();
    expect(screen.getByText('admin:layout.role_church_admin')).toBeInTheDocument();
    expect(screen.getByText('admin:layout.sidebar.users_directory')).toBeInTheDocument();
    expect(screen.queryByText('admin:layout.sidebar.system_operations')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('admin:layout.sidebar.active_church_label')).not.toBeInTheDocument();
    expect(screen.queryByText('admin:layout.sidebar.back_to_platform')).not.toBeInTheDocument();
    expect(mockUseGetChurchesQuery).toHaveBeenCalledWith(
      { page: 1, limit: 100, order: 'ASC' },
      { skip: true },
    );
  });

  it('SUPER_ADMIN does NOT see system operations in AdminSidebar (moved to SuperAdminLayout)', () => {
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

  it('User without admin:manage-system-operations navigating to /system is redirected to /', () => {
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

  it('SUPER_ADMIN accessing /system renders AdminSystemOperationsView', () => {
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

  it('SUPER_ADMIN switches active church from switcher and resets RTK Query API state', () => {
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

    const switcher = screen.getByLabelText('admin:layout.sidebar.active_church_label') as HTMLSelectElement;
    expect(switcher.value).toBe('church-1');

    fireEvent.change(switcher, { target: { value: 'church-2' } });

    expect(sessionStorage.getItem(DEV_TENANT_OVERRIDE_KEY)).toBe('iglesia-b');
    const brandingCache = JSON.parse(localStorage.getItem(TENANT_BRANDING_CACHE_KEY) || '{}');
    expect(brandingCache.churchId).toBe('church-2');
    expect(brandingCache.slug).toBe('iglesia-b');
    expect(mockResetApiState).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'api/resetApiState' });
  });

  it('SUPER_ADMIN clicks back to platform console button and navigates to SuperAdmin console URL', () => {
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

    const backButton = screen.getByRole('button', {
      name: 'admin:layout.sidebar.back_to_platform',
    });
    fireEvent.click(backButton);

    expect(window.location.assign).toHaveBeenCalledWith('/?tenant=admin');
  });
});
