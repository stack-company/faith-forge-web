import React from 'react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { AdminDashboardView } from '@/views/admin/AdminDashboardView';
import { APP_ROUTES } from '@/config/routes';
import { AppCapability, CapabilityContext, hasCapability } from '@/libs/utils/auth/capabilities';
import { EntityState, IChurch } from '@/libs/models';

const mockUseAppSelector = vi.fn();
const mockDispatch = vi.fn();
const mockUsePermissions = vi.fn();
const mockUseGetChurchesQuery = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue || key,
  }),
}));

vi.mock('@/libs/state/redux/hooks', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) => mockUseAppSelector(selector),
  useAppDispatch: () => mockDispatch,
}));

vi.mock('@/libs/hooks/usePermissions', () => ({
  usePermissions: () => mockUsePermissions(),
}));

vi.mock('@/libs/hooks/useTerm', () => ({
  useChurchTerm: (term: string) => term,
}));

vi.mock('@/libs/state/redux/api/churchApi', () => ({
  useGetChurchesQuery: (...args: unknown[]) => mockUseGetChurchesQuery(...args),
}));

vi.mock('./admin/AdminNotificationsPopover', () => ({
  AdminNotificationsPopover: () => <div data-testid="admin-notifications" />,
}));

const buildCapabilityContext = (
  isAdmin: boolean,
  isSuperAdmin: boolean,
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

describe('AdminLayout and AdminDashboardView active church guard for SUPER_ADMIN', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGetChurchesQuery.mockReturnValue({
      data: { data: [churchA], total: 1 },
      isLoading: false,
    });
  });

  it('shows guided church selection screen when SUPER_ADMIN enters /admin without activeChurch', () => {
    const superAdminCtx = buildCapabilityContext(true, true);
    mockUsePermissions.mockReturnValue({
      ...superAdminCtx,
      isStaff: false,
      can: (cap: AppCapability) => hasCapability(cap, superAdminCtx),
    });

    mockUseAppSelector.mockImplementation((selector) =>
      selector({
        authSlice: {
          user: { firstName: 'Super', lastName: 'Admin', email: 'sa@test.com' },
          experiences: ['ADMIN'],
        },
        churchCampusSlice: {
          church: undefined,
          data: [],
        },
        volunteerApplicationSlice: {
          pendingCount: 0,
        },
      }),
    );

    render(
      <MemoryRouter initialEntries={[APP_ROUTES.admin.root]}>
        <Routes>
          <Route element={<AdminLayout />}>
            <Route
              path={APP_ROUTES.admin.root}
              element={<div data-testid="admin-child-view">Child View</div>}
            />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('admin:layout.no_active_church.title')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'admin:layout.no_active_church.back_to_platform' })).toBeInTheDocument();
    expect(screen.queryByTestId('admin-child-view')).not.toBeInTheDocument();
  });

  it('renders AdminDashboardView guided state directly when SUPER_ADMIN has no activeChurch', () => {
    const superAdminCtx = buildCapabilityContext(true, true);
    mockUsePermissions.mockReturnValue({
      ...superAdminCtx,
      isStaff: false,
      can: (cap: AppCapability) => hasCapability(cap, superAdminCtx),
    });

    mockUseAppSelector.mockImplementation((selector) =>
      selector({
        authSlice: {
          experiences: ['ADMIN'],
        },
        churchCampusSlice: {
          church: undefined,
          data: [],
        },
      }),
    );

    render(
      <MemoryRouter initialEntries={[APP_ROUTES.admin.root]}>
        <AdminDashboardView />
      </MemoryRouter>,
    );

    expect(screen.getByText('admin:layout.no_active_church.title')).toBeInTheDocument();
  });

  it('renders child route when SUPER_ADMIN has activeChurch resolved', () => {
    const superAdminCtx = buildCapabilityContext(true, true);
    mockUsePermissions.mockReturnValue({
      ...superAdminCtx,
      isStaff: false,
      can: (cap: AppCapability) => hasCapability(cap, superAdminCtx),
    });

    mockUseAppSelector.mockImplementation((selector) =>
      selector({
        authSlice: {
          user: { firstName: 'Super', lastName: 'Admin', email: 'sa@test.com' },
          experiences: ['ADMIN'],
        },
        churchCampusSlice: {
          church: churchA,
          data: [],
        },
        volunteerApplicationSlice: {
          pendingCount: 0,
        },
      }),
    );

    render(
      <MemoryRouter initialEntries={[APP_ROUTES.admin.root]}>
        <Routes>
          <Route element={<AdminLayout />}>
            <Route
              path={APP_ROUTES.admin.root}
              element={<div data-testid="admin-child-view">Child View</div>}
            />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('admin-child-view')).toBeInTheDocument();
    expect(screen.queryByText('admin:layout.no_active_church.title')).not.toBeInTheDocument();
  });
});
