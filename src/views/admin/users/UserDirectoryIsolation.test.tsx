import React from 'react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UserManagementView from './UserManagementView';
import CreateUserView from './CreateUserView';
import { AssignUserRoleModal } from '@/components/modal/AssignUserRoleModal';
import { MINISTRY_ROLE_GROUPS, UserRole } from '@/libs/utils/auth';
import { CapabilityContext, hasCapability } from '@/libs/utils/auth/capabilities';
import { UserState, UserIdType, UserGenderCode } from '@/libs/models/User';
import { APP_ROUTES } from '@/config/routes';

const mockNavigate = vi.fn();
const mockDispatch = vi.fn();
const mockUseAppSelector = vi.fn();
const mockUsePermissions = vi.fn();
const mockGetChurchMembersDirectory = vi.fn();
const mockCreateChurchMember = vi.fn();
const mockSearchUserByNationalId = vi.fn();
const mockCheckChurchMember = vi.fn();
const mockRefetch = vi.fn();

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
  useGetChurchMembersDirectoryQuery: (args: unknown) => mockGetChurchMembersDirectory(args),
  useLazyGetChurchMembersDirectoryQuery: () => [
    (args: unknown) => ({ unwrap: () => mockCheckChurchMember(args) }),
  ],
  useCreateChurchMemberMutation: () => [
    (args: unknown) => ({ unwrap: () => mockCreateChurchMember(args) }),
  ],
}));

vi.mock('@/libs/state/redux/api/userApi', () => ({
  useLazySearchUserByNationalIdQuery: () => [
    (args: unknown) => ({ unwrap: () => mockSearchUserByNationalId(args) }),
  ],
}));

vi.mock('@/components/ui/PullToRefresh', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/PageHeader', () => ({
  default: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

describe('SC-34: User Directory Isolation, Church Member Linking & Global Role Removal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAppSelector.mockImplementation((selector) =>
      selector({
        churchCampusSlice: { church: { id: 'church-a', name: 'Iglesia A' } },
        userSlice: { data: [], loading: false, currentPage: 1, totalPages: 1 },
      }),
    );
    mockUsePermissions.mockReturnValue({
      isAdmin: true,
      isSuperAdmin: false,
      can: (cap: Parameters<typeof hasCapability>[0]) =>
        hasCapability(cap, { isAdmin: true, isSuperAdmin: false } as CapabilityContext),
    });
  });

  it('HP-01 / AC-1: UserManagementView queries /church/members scoped to active churchId and refreshes on church switch', () => {
    const churchAMembers = [
      {
        id: 'user-a1',
        firstName: 'Ana',
        lastName: 'Gomez',
        nationalId: '101010',
        nationalIdType: UserIdType.CC,
        state: UserState.ACTIVE,
        roles: [UserRole.USER],
      },
    ];
    const churchBMembers = [
      {
        id: 'user-b1',
        firstName: 'Carlos',
        lastName: 'Ruiz',
        nationalId: '202020',
        nationalIdType: UserIdType.CC,
        state: UserState.ACTIVE,
        roles: [UserRole.USER],
      },
    ];

    mockGetChurchMembersDirectory.mockImplementation((args: { churchId?: string }) => ({
      data: {
        data: args?.churchId === 'church-b' ? churchBMembers : churchAMembers,
        currentPage: 1,
        totalPages: 1,
      },
      isLoading: false,
      isFetching: false,
      refetch: mockRefetch,
    }));

    const { rerender } = render(
      <MemoryRouter>
        <UserManagementView />
      </MemoryRouter>,
    );

    expect(mockGetChurchMembersDirectory).toHaveBeenCalledWith(
      expect.objectContaining({ churchId: 'church-a', page: 1 }),
    );
    expect(screen.getAllByText('Ana Gomez').length).toBeGreaterThan(0);
    expect(screen.queryByText('Carlos Ruiz')).not.toBeInTheDocument();

    // Switch active church to church-b
    mockUseAppSelector.mockImplementation((selector) =>
      selector({
        churchCampusSlice: { church: { id: 'church-b', name: 'Iglesia B' } },
        userSlice: { data: [], loading: false, currentPage: 1, totalPages: 1 },
      }),
    );

    rerender(
      <MemoryRouter>
        <UserManagementView />
      </MemoryRouter>,
    );

    expect(mockGetChurchMembersDirectory).toHaveBeenCalledWith(
      expect.objectContaining({ churchId: 'church-b', page: 1 }),
    );
    expect(screen.getAllByText('Carlos Ruiz').length).toBeGreaterThan(0);
  });

  it('HP-02 / AC-2: CreateUserView detects existing platform user from another church and links in one click', async () => {
    const existingPlatformUser = {
      id: 'user-ext-1',
      firstName: 'Laura',
      lastName: 'Mendoza',
      nationalId: '10203040',
      nationalIdType: UserIdType.CC,
      gender: UserGenderCode.FEMALE,
      state: UserState.ACTIVE,
      roles: [UserRole.USER],
    };

    mockSearchUserByNationalId.mockResolvedValue(existingPlatformUser);
    mockCheckChurchMember.mockResolvedValue({ data: [], currentPage: 1, totalPages: 1 });
    mockCreateChurchMember.mockResolvedValue(existingPlatformUser);

    render(
      <MemoryRouter>
        <CreateUserView />
      </MemoryRouter>,
    );

    const docInput = screen.getByPlaceholderText('Escribir número de documento...');
    await act(async () => {
      fireEvent.change(docInput, { target: { value: '10203040' } });
      await new Promise((r) => setTimeout(r, 550));
    });

    await waitFor(() => {
      expect(screen.getByText('users.existing_user_title')).toBeInTheDocument();
    });

    const linkBtn = screen.getByRole('button', { name: /users\.link_existing_button/i });
    await act(async () => {
      fireEvent.click(linkBtn);
    });

    await waitFor(() => {
      expect(mockCreateChurchMember).toHaveBeenCalledWith(
        expect.objectContaining({
          churchId: 'church-a',
          data: expect.objectContaining({
            nationalId: '10203040',
            firstName: 'Laura',
            lastName: 'Mendoza',
          }),
        }),
      );
      expect(mockNavigate).toHaveBeenCalledWith(APP_ROUTES.admin.userDetail('user-ext-1'));
    });
  });

  it('CB-01: CreateUserView shows already-member warning with profile link and disables submit', async () => {
    const existingMember = {
      id: 'user-mem-1',
      firstName: 'Pedro',
      lastName: 'Perez',
      nationalId: '99887766',
      nationalIdType: UserIdType.CC,
      gender: UserGenderCode.MALE,
      state: UserState.ACTIVE,
      roles: [UserRole.USER],
    };

    mockSearchUserByNationalId.mockResolvedValue(existingMember);
    mockCheckChurchMember.mockResolvedValue({
      data: [existingMember],
      currentPage: 1,
      totalPages: 1,
    });

    render(
      <MemoryRouter>
        <CreateUserView />
      </MemoryRouter>,
    );

    const docInput = screen.getByPlaceholderText('Escribir número de documento...');
    await act(async () => {
      fireEvent.change(docInput, { target: { value: '99887766' } });
      await new Promise((r) => setTimeout(r, 550));
    });

    await waitFor(() => {
      expect(screen.getByText('users.already_member_title')).toBeInTheDocument();
    });

    const profileBtn = screen.getByRole('button', { name: /users\.view_profile/i });
    fireEvent.click(profileBtn);
    expect(mockNavigate).toHaveBeenCalledWith(APP_ROUTES.admin.userDetail('user-mem-1'));

    const submitBtn = screen.getByRole('button', { name: /Guardar Usuario/i });
    expect(submitBtn).toBeDisabled();
  });

  it('AC-3: MINISTRY_ROLE_GROUPS excludes global ADMIN/STAFF and AssignUserRoleModal does not offer them', () => {
    const allGroupRoles = MINISTRY_ROLE_GROUPS.flatMap((g) => g.roles);
    expect(allGroupRoles).not.toContain(UserRole.ADMIN);
    expect(allGroupRoles).not.toContain(UserRole.STAFF);
    expect(MINISTRY_ROLE_GROUPS.find((g) => g.id === 'ADMINISTRATION')).toBeUndefined();

    expect(
      hasCapability('users:assign-global-roles', {
        isAdmin: true,
        isSuperAdmin: false,
      } as CapabilityContext),
    ).toBe(false);
    expect(
      hasCapability('users:assign-global-roles', {
        isAdmin: true,
        isSuperAdmin: true,
      } as CapabilityContext),
    ).toBe(true);

    render(
      <AssignUserRoleModal
        open={true}
        onClose={vi.fn()}
        user={{ id: 'u-1', firstName: 'Test', lastName: 'User', roles: [UserRole.USER] }}
      />,
    );

    expect(screen.queryByText(/Administración General/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Administrador General/i })).not.toBeInTheDocument();
  });
});
