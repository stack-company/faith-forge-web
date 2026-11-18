import React from 'react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import UserManagementView from './UserManagementView';
import CreateUserView from './CreateUserView';
import UpdateUserView from './UpdateUserView';
import { RegisterVolunteerModal } from '@/views/admin/volunteers/components/RegisterVolunteerModal';
import { AssignVolunteerDrawer } from '@/views/admin/ministries/components/AssignVolunteerDrawer';
import { UserRole } from '@/libs/utils/auth';
import { CapabilityContext, hasCapability } from '@/libs/utils/auth/capabilities';
import { UserGenderCode, UserIdType, UserState } from '@/libs/models/User';
import { toast } from 'sonner';

const mockNavigate = vi.fn();
const mockDispatch = vi.fn();
const mockUseAppSelector = vi.fn();
const mockUsePermissions = vi.fn();
const mockGetChurchMembersDirectory = vi.fn();
const mockLazyGetChurchMembers = vi.fn();
const mockGetGlobalUsers = vi.fn();
const mockCreateChurchMember = vi.fn();
const mockUpdateChurchMember = vi.fn();
const mockSearchUserByNationalId = vi.fn();
const mockRefetch = vi.fn();
const mockGetActiveTenantChurchId = vi.fn<() => string | undefined>(() => 'church-a');
const stableLazyGetChurchMembers = (args: unknown) => ({
  unwrap: () => mockLazyGetChurchMembers(args),
});
const stableCreateChurchMember = (args: unknown) => ({
  unwrap: () => mockCreateChurchMember(args),
});
const stableUpdateChurchMember = (args: unknown) => ({
  unwrap: () => mockUpdateChurchMember(args),
});
const stableSearchUserByNationalId = (args: unknown) => ({
  unwrap: () => mockSearchUserByNationalId(args),
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(() => 'toast-id'),
  },
}));

vi.mock('@/libs/state/redux/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: (state: unknown) => unknown) => mockUseAppSelector(selector),
}));

vi.mock('@/libs/hooks/usePermissions', () => ({
  usePermissions: () => mockUsePermissions(),
}));

vi.mock('@/libs/hooks/useTerm', () => ({
  useChurchTerm: (term: string) => term,
  getVolunteerRoleLabel: (role: string) => role,
}));

vi.mock('@/libs/context/SearchScrollContext', () => ({
  useSearchScroll: () => ({
    setSearchAvailable: vi.fn(),
    registerSearchFocusHandler: vi.fn(),
  }),
}));

vi.mock('@/libs/hooks/useInfiniteScroll', () => ({
  useInfiniteScroll: () => ({
    sentinelRef: { current: null },
    loadingMore: false,
    triggerLoadMore: vi.fn(),
  }),
}));

vi.mock('@/libs/hooks/useBackSwipeGuard', () => ({
  useBackSwipeGuard: () => ({
    allowNavigation: vi.fn(),
  }),
}));

vi.mock('@/libs/hooks/useModalBackClose', () => ({
  useModalBackClose: vi.fn(),
}));

vi.mock('@/libs/state/redux/api/churchApi', () => ({
  useGetChurchCampusesQuery: () => ({ data: [] }),
  useGetChurchMembersDirectoryQuery: (args: unknown, opts?: { skip?: boolean }) =>
    mockGetChurchMembersDirectory(args, opts),
  useLazyGetChurchMembersDirectoryQuery: () => [stableLazyGetChurchMembers],
  useCreateChurchMemberMutation: () => [stableCreateChurchMember],
  useUpdateChurchMemberMutation: () => [stableUpdateChurchMember],
}));

vi.mock('@/libs/state/redux/api/userApi', () => ({
  useLazySearchUserByNationalIdQuery: () => [stableSearchUserByNationalId],
  useGetGlobalUsersQuery: (args: unknown, opts?: { skip?: boolean }) =>
    mockGetGlobalUsers(args, opts),
}));

vi.mock('@/libs/utils/tenant', () => ({
  getActiveTenantChurchId: () => mockGetActiveTenantChurchId(),
}));

vi.mock('@/components/ui/PullToRefresh', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/PageHeader', () => ({
  default: ({ title, rightAction }: { title: string; rightAction?: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {rightAction}
    </div>
  ),
}));

vi.mock('@/components/ui/AppModal', () => ({
  default: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
}));

describe('SC-44: Church Members RTK Query Migration', () => {
  const defaultState = {
    authSlice: { token: 'token-123', user: { id: 'admin-1', roles: [UserRole.ADMIN] } },
    churchCampusSlice: {
      church: { id: 'church-a', name: 'Iglesia A' },
      churchTerminologyOverrides: {},
      ministryTerminologyOverrides: {},
    },
    userSlice: { current: null, data: [], loading: false, currentPage: 1, totalPages: 1 },
    volunteerSlice: { volunteers: { data: [] } },
    ministrySlice: { ministries: [] },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveTenantChurchId.mockReturnValue('church-a');
    mockUseAppSelector.mockImplementation((selector) => selector(defaultState));
    mockUsePermissions.mockReturnValue({
      isAdmin: true,
      isSuperAdmin: false,
      can: (cap: Parameters<typeof hasCapability>[0]) =>
        hasCapability(cap, { isAdmin: true, isSuperAdmin: false } as CapabilityContext),
    });
    mockGetChurchMembersDirectory.mockReturnValue({
      data: { data: [], currentPage: 1, totalPages: 1 },
      isLoading: false,
      isFetching: false,
      refetch: mockRefetch,
    });
    mockGetGlobalUsers.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      refetch: mockRefetch,
    });
  });

  it('HP-01: RegisterVolunteerModal searches via GET /church/members with active churchId', async () => {
    mockLazyGetChurchMembers.mockResolvedValue({
      data: [
        {
          id: 'member-1',
          firstName: 'Marta',
          lastName: 'Diaz',
          nationalId: '555666',
          state: UserState.ACTIVE,
        },
      ],
    });

    render(
      <RegisterVolunteerModal
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    const searchInput = screen.getByPlaceholderText(/nombre|cédula|buscar/i);
    fireEvent.change(searchInput, { target: { value: 'Marta' } });

    await waitFor(
      () => {
        expect(mockLazyGetChurchMembers).toHaveBeenCalledWith(
          expect.objectContaining({
            churchId: 'church-a',
            filterByFirstName: 'Marta',
          }),
        );
      },
      { timeout: 1500 },
    );

    expect(await screen.findByText('Marta Diaz')).toBeInTheDocument();
  });

  it('HP-01: AssignVolunteerDrawer searches via GET /church/members with active churchId', async () => {
    mockLazyGetChurchMembers.mockResolvedValue({
      data: [
        {
          id: 'member-2',
          firstName: 'Pedro',
          lastName: 'Lopez',
          nationalId: '777888',
          state: UserState.ACTIVE,
        },
      ],
    });

    render(
      <AssignVolunteerDrawer
        open={true}
        onOpenChange={vi.fn()}
        ministryId="min-1"
        areas={[]}
        groups={[]}
        campuses={[]}
        serviceAreaGroups={[]}
      />,
    );

    const searchInput = screen.getByPlaceholderText(/nombre|cédula|buscar/i);
    fireEvent.change(searchInput, { target: { value: 'Pedro' } });

    await waitFor(
      () => {
        expect(mockLazyGetChurchMembers).toHaveBeenCalledWith(
          expect.objectContaining({
            filterByFirstName: 'Pedro',
          }),
        );
      },
      { timeout: 1500 },
    );

    expect(await screen.findByText('Pedro Lopez')).toBeInTheDocument();
  });

  it('HP-02: UpdateUserView submits updates via PUT /church/members/:id in church context', async () => {
    const member = {
      id: 'member-edit-1',
      firstName: 'Sofia',
      lastName: 'Castro Perez',
      nationalIdType: UserIdType.CC,
      nationalId: '998877',
      gender: UserGenderCode.FEMALE,
      birthday: '1995-05-10',
      phone: '3001234567',
      email: 'sofia@example.com',
      state: UserState.ACTIVE,
      roles: [UserRole.USER],
    };

    const editState = {
      authSlice: { token: 'token-123', user: { id: 'admin-1', roles: [UserRole.ADMIN] } },
      churchCampusSlice: { church: { id: 'church-a', name: 'Iglesia A' } },
      userSlice: { current: member, data: [member], loading: false },
    };
    mockUseAppSelector.mockImplementation((selector) => selector(editState));
    mockUpdateChurchMember.mockResolvedValue(member);

    const { container } = render(
      <MemoryRouter initialEntries={['/admin/users/edit/member-edit-1']}>
        <Routes>
          <Route path="/admin/users/edit/:id" element={<UpdateUserView />} />
        </Routes>
      </MemoryRouter>,
    );

    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(mockUpdateChurchMember).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'member-edit-1',
          churchId: 'church-a',
          data: expect.objectContaining({
            firstName: 'Sofia',
            lastName: 'Castro Perez',
          }),
        }),
      );
    });
  });

  it('HP-03: SUPER_ADMIN in global view (no activeChurchId) queries GET /users', () => {
    mockGetActiveTenantChurchId.mockReturnValue(undefined);
    const globalState = {
      authSlice: { token: 'token-sa', user: { id: 'sa-1', roles: [UserRole.SUPER_ADMIN] } },
      churchCampusSlice: { church: null },
      userSlice: { data: [], loading: false, currentPage: 1, totalPages: 1 },
    };
    mockUseAppSelector.mockImplementation((selector) => selector(globalState));
    mockUsePermissions.mockReturnValue({
      isAdmin: false,
      isSuperAdmin: true,
      can: (cap: Parameters<typeof hasCapability>[0]) =>
        hasCapability(cap, { isAdmin: false, isSuperAdmin: true } as CapabilityContext),
    });
    mockGetGlobalUsers.mockReturnValue({
      data: {
        data: [
          {
            id: 'global-u1',
            firstName: 'Global',
            lastName: 'Admin',
            nationalId: '112233',
            state: UserState.ACTIVE,
            roles: [UserRole.SUPER_ADMIN],
          },
        ],
        currentPage: 1,
        totalPages: 1,
      },
      isLoading: false,
      isFetching: false,
      refetch: mockRefetch,
    });

    render(
      <MemoryRouter>
        <UserManagementView />
      </MemoryRouter>,
    );

    expect(mockGetChurchMembersDirectory).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ skip: true }),
    );
    expect(mockGetGlobalUsers).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1 }),
      expect.objectContaining({ skip: false }),
    );
    expect(screen.getAllByText('Global Admin').length).toBeGreaterThan(0);
  });

  it('CB-01: CreateUserView shows translated 409 Conflict feedback without breaking the form', async () => {
    mockSearchUserByNationalId.mockResolvedValue({
      id: 'existing-u1',
      firstName: 'Luis',
      lastName: 'Gomez',
      nationalId: '445566',
      nationalIdType: UserIdType.CC,
      gender: UserGenderCode.MALE,
      state: UserState.ACTIVE,
    });
    mockLazyGetChurchMembers.mockResolvedValue({ data: [] });
    mockCreateChurchMember.mockRejectedValue({
      status: 409,
      data: { message: 'Conflict' },
    });

    render(
      <MemoryRouter>
        <CreateUserView />
      </MemoryRouter>,
    );

    const nationalIdInput = screen.getByPlaceholderText('Escribir número de documento...');
    fireEvent.change(nationalIdInput, { target: { value: '445566' } });

    const linkBtn = await screen.findByRole('button', { name: /users\.link_existing_button/i });
    fireEvent.click(linkBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('users.already_member_conflict');
    });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(nationalIdInput).toHaveValue('445566');
  });

  it('CB-02: UserManagementView hides restricted create and edit actions when can("church:manage-settings") is false', () => {
    mockUsePermissions.mockReturnValue({
      isAdmin: false,
      isSuperAdmin: false,
      can: () => false,
    });
    mockGetChurchMembersDirectory.mockReturnValue({
      data: {
        data: [
          {
            id: 'member-ro',
            firstName: 'Read',
            lastName: 'Only',
            nationalId: '334455',
            state: UserState.ACTIVE,
            roles: [UserRole.USER],
          },
        ],
        currentPage: 1,
        totalPages: 1,
      },
      isLoading: false,
      isFetching: false,
      refetch: mockRefetch,
    });

    render(
      <MemoryRouter>
        <UserManagementView />
      </MemoryRouter>,
    );

    expect(screen.queryByText('directory.new_user')).not.toBeInTheDocument();
    expect(screen.queryByTitle('directory.edit_user')).not.toBeInTheDocument();
  });
});
