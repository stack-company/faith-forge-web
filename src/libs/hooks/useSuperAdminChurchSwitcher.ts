import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { EntityState, IChurch } from '@/libs/models';
import { baseApi } from '@/libs/state/redux/api/baseApi';
import { useGetChurchesQuery } from '@/libs/state/redux/api/churchApi';
import { useAppDispatch, useAppSelector } from '@/libs/state/redux/hooks';
import {
  resetChurchCampusState,
  setChurch,
} from '@/libs/state/redux/slices/church/churchCampus.slice';
import { resetChurchMeetingState } from '@/libs/state/redux/slices/church/churchMeeting.slice';
import { resetChurchPrinterState } from '@/libs/state/redux/slices/church/churchPrinter.slice';
import {
  GetChurchById,
  GetChurchCampuses,
} from '@/libs/state/redux/thunks/church/church.thunk';
import { GetMinistries } from '@/libs/state/redux/thunks/church/ministry.thunk';
import { FetchMyVolunteerPermissions } from '@/libs/state/redux/thunks/user/auth.thunk';
import { clearHttpCache } from '@/libs/utils/http';
import {
  DEV_TENANT_OVERRIDE_KEY,
  applyChurchBrandingToDom,
  buildSuperAdminConsoleUrl,
  buildTenantAdminUrl,
  isLocalTenantHost,
} from '@/libs/utils/tenant';

/**
 * Provides church tenant switching and Superadmin console navigation for users
 * with the `platform:manage-churches` capability inside `/admin`.
 *
 * @param {boolean} enabled - Whether the current user has `platform:manage-churches` capability.
 * @returns {{
 *   churches: IChurch[];
 *   isLoading: boolean;
 *   activeChurch: IChurch | undefined;
 *   switchChurch: (churchId: string) => void;
 *   goToSuperAdminConsole: () => void;
 * }} Church list, loading state, active church, and navigation/switch handlers.
 */
export const useSuperAdminChurchSwitcher = (enabled: boolean) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const activeChurch = useAppSelector((state) => state.churchCampusSlice.church);

  const { data: churchesResponse, isLoading } = useGetChurchesQuery(
    { page: 1, limit: 100, order: 'ASC' },
    { skip: !enabled },
  );

  const churches = useMemo(
    () =>
      (churchesResponse?.data || []).filter(
        (c) => c.state !== EntityState.DELETED,
      ),
    [churchesResponse],
  );

  /**
   * Switches the active church tenant in local/preview environments (updating
   * sessionStorage, branding cache, Redux slices, and resetting RTK Query state)
   * or navigates to the target church subdomain in production.
   *
   * @param {string} churchId - UUID of the target church tenant.
   * @returns {void}
   */
  const switchChurch = (churchId: string): void => {
    if (!churchId || churchId === activeChurch?.id) return;
    const targetChurch = churches.find((c) => c.id === churchId);
    if (!targetChurch) return;

    const hostname =
      typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
    const slug = targetChurch.slug?.trim().toLowerCase();

    if (hostname && !isLocalTenantHost(hostname) && slug) {
      window.location.assign(buildTenantAdminUrl(targetChurch));
      return;
    }

    if (typeof window !== 'undefined' && slug) {
      try {
        sessionStorage.setItem(DEV_TENANT_OVERRIDE_KEY, slug);
      } catch {
        // Ignore sessionStorage access errors
      }
    }

    applyChurchBrandingToDom(targetChurch);
    clearHttpCache();
    dispatch(resetChurchCampusState());
    dispatch(resetChurchMeetingState());
    dispatch(resetChurchPrinterState());
    dispatch(setChurch(targetChurch));
    dispatch(baseApi.util.resetApiState());

    if (slug) {
      const searchParams = new URLSearchParams(location.search);
      searchParams.set('tenant', slug);
      navigate(
        { pathname: location.pathname, search: `?${searchParams.toString()}` },
        { replace: true },
      );
    }

    dispatch(GetChurchCampuses());
    dispatch(GetMinistries());
    dispatch(FetchMyVolunteerPermissions());
    dispatch(GetChurchById(targetChurch.id));
  };

  /**
   * Navigates back to the Platform Superadmin Console (`admin.lumbrela.app` or `/?tenant=admin`).
   *
   * @returns {void}
   */
  const goToSuperAdminConsole = (): void => {
    window.location.assign(buildSuperAdminConsoleUrl());
  };

  return {
    churches,
    isLoading,
    activeChurch,
    switchChurch,
    goToSuperAdminConsole,
  };
};
