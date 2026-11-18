import React from 'react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ChurchesManagementView from './ChurchesManagementView';
import { EntityState, IChurch } from '@/libs/models';

const mockUseGetChurchesQuery = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/libs/state/redux/api/churchApi', () => ({
  useGetChurchesQuery: (...args: unknown[]) => mockUseGetChurchesQuery(...args),
}));

vi.mock('@/components/modal/ChurchTenantModal', () => ({
  ChurchTenantModal: () => null,
}));

const activeChurch: IChurch = {
  id: 'church-1',
  name: 'Iglesia Norte',
  slug: 'iglesia-norte',
  state: EntityState.ACTIVE,
} as IChurch;

const inactiveChurch: IChurch = {
  id: 'church-2',
  name: 'Iglesia Sur',
  slug: 'iglesia-sur',
  state: EntityState.INACTIVE,
} as IChurch;

const noSlugChurch: IChurch = {
  id: 'church-3',
  name: 'Iglesia Sin Slug',
  slug: '',
  state: EntityState.ACTIVE,
} as IChurch;

describe('ChurchesManagementView', () => {
  const assignMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        href: 'http://localhost:3000/?tenant=admin',
        protocol: 'http:',
        hostname: 'localhost',
        port: '3000',
        pathname: '/',
        search: '?tenant=admin',
        assign: assignMock,
      },
    });
  });

  it('navigates to /admin?tenant=<slug> when clicking the manage button on an active church', () => {
    mockUseGetChurchesQuery.mockReturnValue({
      data: { data: [activeChurch] },
      isLoading: false,
    });

    render(<ChurchesManagementView />);

    const manageBtn = screen.getByRole('button', {
      name: /admin:super_admin\.manage_church_btn/i,
    });
    expect(manageBtn).toBeEnabled();

    fireEvent.click(manageBtn);
    expect(assignMock).toHaveBeenCalledWith('/admin?tenant=iglesia-norte');
  });

  it('disables the manage button for inactive churches or churches without a slug', () => {
    mockUseGetChurchesQuery.mockReturnValue({
      data: { data: [inactiveChurch, noSlugChurch] },
      isLoading: false,
    });

    render(<ChurchesManagementView />);

    const manageButtons = screen.getAllByRole('button', {
      name: /admin:super_admin\.manage_church_btn/i,
    });

    expect(manageButtons).toHaveLength(2);
    expect(manageButtons[0]).toBeDisabled();
    expect(manageButtons[1]).toBeDisabled();
  });
});
