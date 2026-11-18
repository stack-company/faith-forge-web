import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  LayoutDashboard,
  MapPin,
  CalendarClock,
  Printer,
  Layers,
  UserCheck,
  Users,
  UserPlus,
  Sparkles,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Star,
  X,
  ExternalLink,
  Globe,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { APP_ROUTES } from '@/config/routes';
import { useChurchTerm } from '@/libs/hooks/useTerm';
import { usePermissions } from '@/libs/hooks/usePermissions';
import { useSuperAdminChurchSwitcher } from '@/libs/hooks/useSuperAdminChurchSwitcher';
import { useAppSelector } from '@/libs/state/redux/hooks';
import Select from '@/components/ui/Select';
import { APP_VERSION } from '@/constants/version';

interface NavItem {
  id: string;
  label: string;
  to: string;
  icon: React.ElementType;
  badge?: string;
  badgeColor?: string;
  exact?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

interface AdminSidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onCloseMobile?: () => void;
  isMobileDrawer?: boolean;
  onOpenTerminology: () => void;
  onOpenClearCache: () => void;
  onOpenChangelog: () => void;
}

/**
 * Sidebar navigation component for church administration desktop layout.
 *
 * @param {AdminSidebarProps} props - Component properties.
 * @returns {JSX.Element} Rendered sidebar.
 */
export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  collapsed = false,
  onToggleCollapse,
  onCloseMobile,
  isMobileDrawer = false,
  onOpenTerminology,
  onOpenClearCache,
  onOpenChangelog,
}) => {
  const { t } = useTranslation(['admin', 'common']);
  const location = useLocation();
  const navigate = useNavigate();
  const { can } = usePermissions();

  const experiences = useAppSelector((state) => state.authSlice.experiences) || [];
  const activeChurch = useAppSelector((state) => state.churchCampusSlice.church);
  const campuses = useAppSelector((state) => state.churchCampusSlice.data);
  const pendingApplicationsCount = useAppSelector((state) => state.volunteerApplicationSlice?.pendingCount ?? 0);

  const campusesTerm = useChurchTerm('campuses');
  const meetingsTerm = useChurchTerm('meetings');

  const canManagePlatform = can('platform:manage-churches');
  const canManageChurch = can('church:manage-settings');
  const hasMultipleSpaces = experiences.length > 1;
  const {
    churches,
    isLoading: isLoadingChurches,
    switchChurch,
    goToSuperAdminConsole,
  } = useSuperAdminChurchSwitcher(canManagePlatform);

  const roleLabel = canManagePlatform
    ? t('admin:layout.role_super_admin')
    : canManageChurch
    ? t('admin:layout.role_church_admin')
    : t('admin:layout.role_staff');

  const sections: NavSection[] = [
    {
      title: t('admin:layout.sidebar.section_dashboard'),
      items: [
        {
          id: 'dashboard',
          label: t('common:navigation.dashboard', { defaultValue: 'Dashboard' }),
          to: APP_ROUTES.admin.root,
          icon: LayoutDashboard,
          exact: true,
        },
      ],
    },
    {
      title: t('admin:layout.sidebar.section_facilities'),
      items: [
        {
          id: 'campuses',
          label: campusesTerm,
          to: APP_ROUTES.admin.campuses,
          icon: MapPin,
          badge: campuses && campuses.length > 0 ? String(campuses.length) : undefined,
          badgeColor: 'bg-slate-100 text-slate-600',
        },
        {
          id: 'church-meetings',
          label: meetingsTerm,
          to: APP_ROUTES.admin.churchMeetings,
          icon: CalendarClock,
        },
        {
          id: 'printers',
          label: t('admin:printers.header_title', { defaultValue: 'Gestión de Impresoras' }),
          to: APP_ROUTES.admin.printers,
          icon: Printer,
        },
      ],
    },
    {
      title: t('admin:layout.sidebar.section_ministries'),
      items: [
        {
          id: 'ministries',
          label: t('admin:layout.sidebar.ministries_management'),
          to: APP_ROUTES.admin.ministries,
          icon: Layers,
        },
        {
          id: 'volunteer-applications',
          label: t('admin:layout.sidebar.volunteer_applications'),
          to: APP_ROUTES.admin.volunteerApplications,
          icon: UserCheck,
          badge: pendingApplicationsCount > 0 ? t('admin:layout.sidebar.pending_badge', { count: pendingApplicationsCount }) : undefined,
          badgeColor: 'bg-amber-100 text-amber-800',
        },
      ],
    },
    {
      title: t('admin:layout.sidebar.section_users'),
      items: [
        {
          id: 'users',
          label: t('admin:layout.sidebar.users_directory'),
          to: APP_ROUTES.admin.users,
          icon: Users,
        },
        {
          id: 'create-user',
          label: t('admin:layout.sidebar.create_user'),
          to: APP_ROUTES.admin.createUser,
          icon: UserPlus,
        },
      ],
    },
  ];

  const handleNavClick = () => {
    if (isMobileDrawer && onCloseMobile) {
      onCloseMobile();
    }
  };

  const isItemActive = (item: NavItem) => {
    if (item.exact) return location.pathname === item.to;
    if (item.id === 'users' && location.pathname.startsWith(APP_ROUTES.admin.createUser)) return false;
    return location.pathname.startsWith(item.to);
  };

  return (
    <aside
      className={clsx(
        'h-full flex flex-col bg-white border-r border-slate-200/80 transition-all duration-300 select-none z-30 shrink-0',
        collapsed && !isMobileDrawer ? 'w-20' : 'w-72'
      )}
    >
      {/* Sidebar Header: Brand & Church Name */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Star className="w-5 h-5 text-amber-300 fill-amber-300" />
          </div>
          {(!collapsed || isMobileDrawer) && (
            <div className="min-w-0 flex flex-col">
              <span className="font-extrabold text-sm text-slate-900 truncate leading-tight tracking-tight">
                {activeChurch?.name || t('admin:layout.default_church_name')}
              </span>
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full w-fit mt-0.5">
                {roleLabel}
              </span>
            </div>
          )}
        </div>

        {isMobileDrawer ? (
          <button
            type="button"
            onClick={onCloseMobile}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title={t('common:actions.close', { defaultValue: 'Cerrar' })}
          >
            <X size={18} />
          </button>
        ) : (
          onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className={clsx(
                'w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors',
                collapsed && 'mx-auto'
              )}
              title={collapsed ? t('admin:layout.sidebar.expand_sidebar') : t('admin:layout.sidebar.collapse_sidebar')}
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          )
        )}
      </div>

      {/* Superadmin Church Switcher */}
      {canManagePlatform && (!collapsed || isMobileDrawer) && (
        <div className="px-3 py-3 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <Select
            aria-label={t('admin:layout.sidebar.active_church_label')}
            label={t('admin:layout.sidebar.active_church_label')}
            value={activeChurch?.id || ''}
            disabled={isLoadingChurches || churches.length === 0}
            onChange={(e) => {
              switchChurch(e.target.value);
              handleNavClick();
            }}
            className="text-xs py-2"
          >
            <option value="" disabled>
              {isLoadingChurches
                ? t('common:states.loading', { defaultValue: 'Cargando...' })
                : t('admin:layout.sidebar.select_church_placeholder')}
            </option>
            {churches.map((church) => (
              <option key={church.id} value={church.id}>
                {church.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {sections.map((section) => (
          <div key={section.title} className="space-y-1">
            {(!collapsed || isMobileDrawer) && (
              <h2 className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                {section.title}
              </h2>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const ItemIcon = item.icon;
                const active = isItemActive(item);

                return (
                  <NavLink
                    key={item.id}
                    to={item.to}
                    onClick={handleNavClick}
                    title={collapsed && !isMobileDrawer ? item.label : undefined}
                    className={clsx(
                      'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                      active
                        ? 'bg-indigo-50/70 text-indigo-700 font-bold shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900',
                      collapsed && !isMobileDrawer && 'justify-center px-0'
                    )}
                  >
                    <div
                      className={clsx(
                        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                        active
                          ? 'text-indigo-600'
                          : 'text-slate-400 group-hover:text-slate-700'
                      )}
                    >
                      <ItemIcon size={18} />
                    </div>

                    {(!collapsed || isMobileDrawer) && (
                      <span className="truncate flex-1">{item.label}</span>
                    )}

                    {(!collapsed || isMobileDrawer) && item.badge && (
                      <span className={clsx('px-2 py-0.5 text-[10px] font-bold rounded-full', item.badgeColor || 'bg-slate-100 text-slate-600')}>
                        {item.badge}
                      </span>
                    )}

                    {(!collapsed || isMobileDrawer) && active && !item.badge && (
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0 ml-auto" />
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}

        {/* Configuration Actions Section (SISTEMA) */}
        <div className="space-y-1">
          {(!collapsed || isMobileDrawer) && (
            <h2 className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              {t('admin:layout.sidebar.section_system')}
            </h2>
          )}
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => {
                handleNavClick();
                onOpenTerminology();
              }}
              title={collapsed && !isMobileDrawer ? t('admin:layout.sidebar.terminology') : undefined}
              className={clsx(
                'w-full group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 transition-colors cursor-pointer',
                collapsed && !isMobileDrawer && 'justify-center px-0'
              )}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-slate-400 group-hover:text-slate-700">
                <Sparkles size={18} />
              </div>
              {(!collapsed || isMobileDrawer) && (
                <span className="truncate flex-1 text-left">{t('admin:layout.sidebar.terminology')}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar Footer: App Switcher & Version */}
      <div className="p-3 border-t border-slate-100 bg-white space-y-2 shrink-0">
        {canManagePlatform && (
          <button
            type="button"
            onClick={goToSuperAdminConsole}
            title={collapsed && !isMobileDrawer ? t('admin:layout.sidebar.back_to_platform') : undefined}
            className={clsx(
              'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-indigo-700 bg-indigo-50/70 border border-indigo-200/80 shadow-2xs hover:bg-indigo-100/70 transition-all cursor-pointer',
              collapsed && !isMobileDrawer && 'justify-center px-0'
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Globe size={16} className="text-indigo-600 shrink-0" />
              {(!collapsed || isMobileDrawer) && (
                <span className="truncate">{t('admin:layout.sidebar.back_to_platform')}</span>
              )}
            </div>
            {(!collapsed || isMobileDrawer) && <ExternalLink size={13} className="text-indigo-400 shrink-0" />}
          </button>
        )}

        {hasMultipleSpaces && (
          <button
            type="button"
            onClick={() => navigate(APP_ROUTES.hub)}
            title={collapsed && !isMobileDrawer ? t('admin:layout.switch_space_mobile') : undefined}
            className={clsx(
              'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200/80 shadow-2xs hover:bg-slate-50 transition-all cursor-pointer',
              collapsed && !isMobileDrawer && 'justify-center px-0'
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <LayoutGrid size={16} className="text-slate-500 shrink-0" />
              {(!collapsed || isMobileDrawer) && (
                <span className="truncate">{t('admin:layout.switch_space')}</span>
              )}
            </div>
            {(!collapsed || isMobileDrawer) && <ExternalLink size={13} className="text-slate-400 shrink-0" />}
          </button>
        )}

        {(!collapsed || isMobileDrawer) ? (
          <button
            type="button"
            onClick={onOpenChangelog}
            className="w-full text-center text-[11px] text-slate-400 hover:text-slate-600 transition-colors py-1 cursor-pointer"
          >
            v{APP_VERSION} · <span className="underline decoration-dotted">{t('admin:layout.sidebar.changelog_link')}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenChangelog}
            title={t('admin:layout.sidebar.changelog_tooltip', { version: APP_VERSION })}
            className="w-full text-center text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors py-1 cursor-pointer"
          >
            v{APP_VERSION}
          </button>
        )}
      </div>
    </aside>
  );
};
