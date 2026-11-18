import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ModalOverlay from '@/components/ui/ModalOverlay';
import { PhotoUploadZone } from '@/components/ui/PhotoUploadZone';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import {
  ChurchStaffRole,
  EntityState,
  IChurch,
  IChurchBranding,
  IChurchStaff,
  IUser,
} from '@/libs/models';
import {
  useCreateChurchMutation,
  useGetChurchMembersDirectoryQuery,
  useGetChurchStaffQuery,
  useUpdateChurchMutation,
  useUpdateChurchStaffRolesMutation,
  useUploadChurchBrandingLogoMutation,
} from '@/libs/state/redux/api/churchApi';
import { useGetGlobalUsersQuery } from '@/libs/state/redux/api/userApi';
import { capitalizeWords, parseEntitySearchParams } from '@/libs/utils/text';
import clsx from 'clsx';
import {
  Building2,
  Check,
  Globe,
  Palette,
  ShieldCheck,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export interface ChurchTenantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  church?: IChurch | null;
}

type ModalTab = 'general' | 'branding' | 'admins';

/**
 * Modal for creating and configuring a church tenant, including subdomain (`slug`),
 * custom domains, white-label PWA branding, and church-scoped administrators.
 *
 * @param {ChurchTenantModalProps} props - Modal state and optional church to edit.
 * @returns {JSX.Element | null} Rendered modal or null when closed.
 */
export const ChurchTenantModal: React.FC<ChurchTenantModalProps> = ({
  open,
  onOpenChange,
  church,
}) => {
  const { t } = useTranslation(['admin', 'common']);
  const isEditing = Boolean(church?.id);

  const [activeTab, setActiveTab] = useState<ModalTab>('general');

  // General form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [customDomainsText, setCustomDomainsText] = useState('');
  const [description, setDescription] = useState('');
  const [state, setState] = useState<EntityState>(EntityState.ACTIVE);
  const [nameError, setNameError] = useState('');

  // Branding form state
  const [appName, setAppName] = useState('');
  const [shortName, setShortName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#2563EB');
  const [themeColor, setThemeColor] = useState('#FFFFFF');
  const [backgroundColor, setBackgroundColor] = useState('#FFFFFF');
  const [logoPhotos, setLogoPhotos] = useState<string[]>([]);
  const [logoFiles, setLogoFiles] = useState<File[]>([]);

  // Admins tab search state
  const [memberSearch, setMemberSearch] = useState('');
  const [debouncedMemberSearch, setDebouncedMemberSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedMemberSearch(memberSearch.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [memberSearch]);

  const searchFilters = useMemo(
    () => parseEntitySearchParams(debouncedMemberSearch),
    [debouncedMemberSearch],
  );

  const [createChurch, { isLoading: isCreating }] = useCreateChurchMutation();
  const [updateChurch, { isLoading: isUpdating }] = useUpdateChurchMutation();
  const [uploadBrandingLogo, { isLoading: isUploadingLogo }] =
    useUploadChurchBrandingLogoMutation();
  const [updateStaffRoles, { isLoading: isUpdatingRoles }] =
    useUpdateChurchStaffRolesMutation();

  const shouldLoadAdminsTab = Boolean(
    open && church?.id && activeTab === 'admins',
  );

  const { data: staffData = [], isFetching: isFetchingStaff } =
    useGetChurchStaffQuery(
      { churchId: church?.id || '' },
      { skip: !shouldLoadAdminsTab },
    );

  const { data: churchMembersData, isFetching: isFetchingMembers } =
    useGetChurchMembersDirectoryQuery(
      {
        churchId: church?.id || '',
        page: 1,
        limit: 25,
        filterByFirstName: searchFilters.filterByFirstName,
        filterByLastName: searchFilters.filterByLastName,
        filterByNationalId: searchFilters.numericId,
      },
      { skip: !shouldLoadAdminsTab },
    );

  const { data: globalUsersData, isFetching: isFetchingGlobalUsers } =
    useGetGlobalUsersQuery(
      {
        page: 1,
        limit: 25,
        filterByFirstName: searchFilters.filterByFirstName,
        filterByLastName: searchFilters.filterByLastName,
        filterByNationalId: searchFilters.numericId,
      },
      { skip: !shouldLoadAdminsTab || !debouncedMemberSearch },
    );

  useEffect(() => {
    if (!open) return;
    setActiveTab('general');
    setNameError('');
    setLogoFiles([]);
    setMemberSearch('');
    setDebouncedMemberSearch('');

    if (church) {
      setName(church.name || '');
      setSlug(church.slug || '');
      setCustomDomainsText((church.customDomains || []).join(', '));
      setDescription(church.description || '');
      setState(church.state || EntityState.ACTIVE);

      const branding: IChurchBranding = church.branding || {};
      setAppName(branding.appName || church.name || '');
      setShortName(branding.shortName || church.name?.slice(0, 15) || '');
      setPrimaryColor(branding.primaryColor || '#2563EB');
      setThemeColor(branding.themeColor || '#FFFFFF');
      setBackgroundColor(branding.backgroundColor || '#FFFFFF');
      setLogoPhotos(
        branding.icon192Url
          ? [branding.icon192Url]
          : branding.logoUrl
            ? [branding.logoUrl]
            : [],
      );
    } else {
      setName('');
      setSlug('');
      setCustomDomainsText('');
      setDescription('');
      setState(EntityState.ACTIVE);
      setAppName('');
      setShortName('');
      setPrimaryColor('#2563EB');
      setThemeColor('#FFFFFF');
      setBackgroundColor('#FFFFFF');
      setLogoPhotos([]);
    }
  }, [open, church]);

  const isSaving = isCreating || isUpdating || isUploadingLogo;

  /**
   * Normalizes a church name or slug into a valid subdomain slug.
   *
   * @param {string} rawValue - Input text to normalize.
   * @returns {string} Clean lowercase alphanumeric hyphenated slug.
   */
  const normalizeSlugInput = (rawValue: string): string => {
    return rawValue
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  /**
   * Handles saving church general details and branding configuration.
   *
   * @param {React.FormEvent} e - Form submission event.
   * @returns {Promise<void>}
   */
  const handleSave = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError(t('admin:super_admin.modal.field_name_required'));
      setActiveTab('general');
      return;
    }

    const customDomains = customDomainsText
      .split(',')
      .map((domain) => domain.trim().toLowerCase())
      .filter(Boolean);

    const brandingPayload: IChurchBranding = {
      ...(church?.branding || {}),
      appName: appName.trim() || name.trim(),
      shortName: (shortName.trim() || name.trim()).slice(0, 15),
      primaryColor: primaryColor.trim() || '#2563EB',
      themeColor: themeColor.trim() || '#FFFFFF',
      backgroundColor: backgroundColor.trim() || '#FFFFFF',
    };

    try {
      let savedChurch: IChurch;
      if (isEditing && church) {
        savedChurch = await updateChurch({
          id: church.id,
          name: name.trim(),
          slug: slug.trim() ? normalizeSlugInput(slug) : undefined,
          customDomains,
          description: description.trim() || undefined,
          state,
          branding: brandingPayload,
        }).unwrap();
      } else {
        savedChurch = await createChurch({
          name: name.trim(),
          slug: slug.trim()
            ? normalizeSlugInput(slug)
            : normalizeSlugInput(name),
          customDomains,
          description: description.trim() || undefined,
          state,
          branding: brandingPayload,
        }).unwrap();
      }

      if (logoFiles.length > 0 && savedChurch?.id) {
        await uploadBrandingLogo({
          churchId: savedChurch.id,
          file: logoFiles[0],
        }).unwrap();
      }

      toast.success(
        isEditing
          ? t('admin:super_admin.modal.updated_success')
          : t('admin:super_admin.modal.created_success'),
      );
      onOpenChange(false);
    } catch {
      toast.error(t('admin:super_admin.modal.save_error'));
    }
  };

  /**
   * Toggles the local `ChurchStaffRole.CHURCH_ADMIN` role for a specific user in this church.
   *
   * @param {string} userId - Target user UUID.
   * @param {ChurchStaffRole[]} currentRoles - Existing church staff roles for the user.
   * @returns {Promise<void>}
   */
  const handleToggleAdminRole = async (
    userId: string,
    currentRoles: ChurchStaffRole[],
  ): Promise<void> => {
    if (!church?.id) return;
    const hasAdmin = currentRoles.includes(ChurchStaffRole.CHURCH_ADMIN);
    const nextRoles = hasAdmin
      ? currentRoles.filter((r) => r !== ChurchStaffRole.CHURCH_ADMIN)
      : [...currentRoles, ChurchStaffRole.CHURCH_ADMIN];

    try {
      await updateStaffRoles({
        userId,
        churchId: church.id,
        roles: nextRoles,
      }).unwrap();
      toast.success(t('admin:super_admin.modal.roles_updated_success'));
    } catch {
      toast.error(t('admin:super_admin.modal.roles_updated_error'));
    }
  };

  const adminCandidates = useMemo(() => {
    const staffByUserId = new Map<string, IChurchStaff>(
      staffData.map((staff) => [staff.userId, staff]),
    );
    const seenUserIds = new Set<string>();
    const results: Array<{
      userId: string;
      user?: Partial<IUser>;
      roles: ChurchStaffRole[];
      isStaff: boolean;
    }> = [];

    const trimmedSearch = memberSearch.trim().toLowerCase();
    const matchesLocalSearch = (user?: Partial<IUser>): boolean => {
      if (!trimmedSearch) return true;
      const fullName =
        `${user?.firstName || ''} ${user?.lastName || ''}`.toLowerCase();
      const doc = (user?.nationalId || '').toLowerCase();
      const email = (user?.email || '').toLowerCase();
      return (
        fullName.includes(trimmedSearch) ||
        doc.includes(trimmedSearch) ||
        email.includes(trimmedSearch)
      );
    };

    for (const staff of staffData) {
      if (!matchesLocalSearch(staff.user)) continue;
      seenUserIds.add(staff.userId);
      results.push({
        userId: staff.userId,
        user: staff.user,
        roles: Array.isArray(staff.roles) ? staff.roles : [],
        isStaff: true,
      });
    }

    const appendUsers = (usersList?: IUser[]) => {
      if (!usersList) return;
      for (const user of usersList) {
        if (seenUserIds.has(user.id)) continue;
        seenUserIds.add(user.id);
        const existingStaff = staffByUserId.get(user.id);
        results.push({
          userId: user.id,
          user,
          roles: Array.isArray(existingStaff?.roles) ? existingStaff.roles : [],
          isStaff: Boolean(existingStaff),
        });
      }
    };

    appendUsers(churchMembersData?.data);
    if (debouncedMemberSearch) appendUsers(globalUsersData?.data);

    return results;
  }, [
    staffData,
    churchMembersData?.data,
    globalUsersData?.data,
    memberSearch,
    debouncedMemberSearch,
  ]);

  if (!open) return null;

  const isSearchingAdmins =
    isFetchingStaff ||
    isFetchingMembers ||
    (Boolean(debouncedMemberSearch) && isFetchingGlobalUsers);

  const previewIconUrl =
    logoPhotos[0] ||
    church?.branding?.icon192Url ||
    church?.branding?.logoUrl ||
    '/icons/icon-192x192.png';

  const previewShortName = (
    shortName.trim() ||
    appName.trim() ||
    name.trim() ||
    'Iglesia'
  ).slice(0, 15);

  return (
    <ModalOverlay
      open={open}
      onClose={() => onOpenChange(false)}
      panelClassName="max-w-3xl"
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 mx-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-900 text-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shrink-0">
              <Building2 size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-extrabold tracking-tight truncate">
                {isEditing
                  ? t('admin:super_admin.modal.edit_title', {
                      name: church?.name,
                    })
                  : t('admin:super_admin.modal.create_title')}
              </h2>
              <p className="text-xs text-slate-300 truncate">
                {t('admin:super_admin.modal.subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-200 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-3 border-b border-slate-200 flex items-center gap-2 bg-slate-50/70 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-all cursor-pointer',
              activeTab === 'general'
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800',
            )}
          >
            <Globe size={15} />
            <span>{t('admin:super_admin.modal.tab_general')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('branding')}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-all cursor-pointer',
              activeTab === 'branding'
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800',
            )}
          >
            <Palette size={15} />
            <span>{t('admin:super_admin.modal.tab_branding')}</span>
          </button>

          {isEditing && (
            <button
              type="button"
              onClick={() => setActiveTab('admins')}
              className={clsx(
                'flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-all cursor-pointer',
                activeTab === 'admins'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800',
              )}
            >
              <ShieldCheck size={15} />
              <span>{t('admin:super_admin.modal.tab_admins')}</span>
            </button>
          )}
        </div>

        {/* Body */}
        <form
          onSubmit={handleSave}
          className="flex-1 overflow-y-auto p-6 space-y-5"
        >
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label={t('admin:super_admin.modal.field_name_label')}
                  placeholder={t(
                    'admin:super_admin.modal.field_name_placeholder',
                  )}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError) setNameError('');
                    if (!isEditing && !slug)
                      setSlug(normalizeSlugInput(e.target.value));
                  }}
                  error={nameError}
                  required
                />

                <Input
                  label={t('admin:super_admin.modal.field_slug_label')}
                  placeholder={t(
                    'admin:super_admin.modal.field_slug_placeholder',
                  )}
                  value={slug}
                  onChange={(e) => setSlug(normalizeSlugInput(e.target.value))}
                  helperText={t('admin:super_admin.modal.field_slug_hint', {
                    slug: slug || 'iglesia',
                  })}
                />
              </div>

              <Input
                label={t('admin:super_admin.modal.field_custom_domains_label')}
                placeholder={t(
                  'admin:super_admin.modal.field_custom_domains_placeholder',
                )}
                value={customDomainsText}
                onChange={(e) => setCustomDomainsText(e.target.value)}
                helperText={t(
                  'admin:super_admin.modal.field_custom_domains_hint',
                )}
              />

              <Textarea
                label={t('admin:super_admin.modal.field_description_label')}
                placeholder={t(
                  'admin:super_admin.modal.field_description_placeholder',
                )}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                showQualityBadge={false}
              />

              <Select
                label={t('admin:super_admin.modal.field_status_label')}
                value={state}
                onChange={(e) => setState(e.target.value as EntityState)}
              >
                <option value={EntityState.ACTIVE}>
                  {t('admin:super_admin.status_active')}
                </option>
                <option value={EntityState.INACTIVE}>
                  {t('admin:super_admin.status_inactive')}
                </option>
              </Select>
            </div>
          )}

          {activeTab === 'branding' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label={t('admin:super_admin.modal.field_app_name_label')}
                    placeholder={t(
                      'admin:super_admin.modal.field_app_name_placeholder',
                    )}
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                  />

                  <Input
                    label={t('admin:super_admin.modal.field_short_name_label')}
                    placeholder={t(
                      'admin:super_admin.modal.field_short_name_placeholder',
                    )}
                    value={shortName}
                    maxLength={15}
                    onChange={(e) => setShortName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input
                    label={t(
                      'admin:super_admin.modal.field_primary_color_label',
                    )}
                    placeholder={t(
                      'admin:super_admin.modal.field_primary_color_placeholder',
                    )}
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    leftIcon={
                      <span
                        className="w-4 h-4 rounded-full border border-slate-300 shrink-0"
                        style={{ backgroundColor: primaryColor || '#2563EB' }}
                      />
                    }
                  />

                  <Input
                    label={t('admin:super_admin.modal.field_theme_color_label')}
                    placeholder={t(
                      'admin:super_admin.modal.field_theme_color_placeholder',
                    )}
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    leftIcon={
                      <span
                        className="w-4 h-4 rounded-full border border-slate-300 shrink-0"
                        style={{ backgroundColor: themeColor || '#FFFFFF' }}
                      />
                    }
                  />

                  <Input
                    label={t('admin:super_admin.modal.field_bg_color_label')}
                    placeholder={t(
                      'admin:super_admin.modal.field_bg_color_placeholder',
                    )}
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    leftIcon={
                      <span
                        className="w-4 h-4 rounded-full border border-slate-300 shrink-0"
                        style={{
                          backgroundColor: backgroundColor || '#FFFFFF',
                        }}
                      />
                    }
                  />
                </div>

                <PhotoUploadZone
                  title={t('admin:super_admin.modal.logo_section_title')}
                  subtitle={t('admin:super_admin.modal.logo_section_desc')}
                  value={logoPhotos}
                  onChange={setLogoPhotos}
                  files={logoFiles}
                  onFilesChange={setLogoFiles}
                  multiple={false}
                  maxPhotos={1}
                />
              </div>

              {/* Live Mobile PWA Preview Card */}
              <div className="bg-slate-900 rounded-2xl p-5 text-white flex flex-col items-center justify-between border border-slate-800">
                <div className="w-full text-center space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 text-[11px] font-bold">
                    <Smartphone size={13} />
                    <span>
                      {t('admin:super_admin.modal.pwa_preview_title')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {t('admin:super_admin.modal.pwa_preview_subtitle')}
                  </p>
                </div>

                {/* Simulated Phone Home Screen Icon & Splash */}
                <div className="my-6 flex flex-col items-center gap-3">
                  <div
                    className="w-20 h-20 rounded-2xl shadow-lg flex items-center justify-center overflow-hidden border border-white/15"
                    style={{ backgroundColor: backgroundColor || '#FFFFFF' }}
                  >
                    <img
                      src={previewIconUrl}
                      alt={previewShortName}
                      className="w-full h-full object-contain p-1.5"
                    />
                  </div>
                  <span className="text-xs font-semibold text-white tracking-tight truncate max-w-[130px]">
                    {previewShortName}
                  </span>
                </div>

                <div className="w-full pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span>
                    {slug ? `${slug}.lumbrela.app` : 'subdominio.lumbrela.app'}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: primaryColor || '#2563EB' }}
                  >
                    PWA
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'admins' && isEditing && (
            <div className="space-y-4">
              <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4">
                <h3 className="text-xs font-extrabold uppercase tracking-wide text-blue-900">
                  {t('admin:super_admin.modal.admins_section_title')}
                </h3>
                <p className="text-xs text-blue-700 mt-1">
                  {t('admin:super_admin.modal.admins_section_desc')}
                </p>
              </div>

              <Input
                icon="search"
                placeholder={t(
                  'admin:super_admin.modal.admins_search_placeholder',
                )}
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                onClear={() => setMemberSearch('')}
              />

              <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {isSearchingAdmins ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    {t('common:states.loading')}
                  </div>
                ) : adminCandidates.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    {debouncedMemberSearch
                      ? t('admin:super_admin.modal.admins_no_results')
                      : t('admin:super_admin.modal.admins_empty')}
                  </div>
                ) : (
                  adminCandidates.map((candidate) => {
                    const isChurchAdmin = candidate.roles.includes(
                      ChurchStaffRole.CHURCH_ADMIN,
                    );
                    const fullName = candidate.user
                      ? `${capitalizeWords(candidate.user.firstName || '')} ${capitalizeWords(candidate.user.lastName || '')}`.trim()
                      : candidate.userId;
                    const badgeLabel = isChurchAdmin
                      ? t('admin:super_admin.modal.role_admin_badge')
                      : candidate.isStaff
                        ? t('admin:super_admin.modal.role_staff_badge')
                        : t('admin:super_admin.modal.role_member_badge');

                    return (
                      <div
                        key={candidate.userId}
                        className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-900 truncate">
                              {fullName}
                            </p>
                            <span
                              className={clsx(
                                'px-2 py-0.5 rounded-full text-[10px] font-bold',
                                isChurchAdmin
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : candidate.isStaff
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-slate-100 text-slate-700',
                              )}
                            >
                              {badgeLabel}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 truncate">
                            {candidate.user?.nationalId
                              ? `${candidate.user.nationalIdType || 'CC'} ${candidate.user.nationalId}`
                              : ''}{' '}
                            {candidate.user?.email
                              ? `• ${candidate.user.email}`
                              : ''}
                          </p>
                        </div>

                        <Button
                          type="button"
                          variant={isChurchAdmin ? 'default' : 'primary'}
                          className="text-xs px-3 py-1.5 h-auto shrink-0"
                          disabled={isUpdatingRoles}
                          onClick={() =>
                            handleToggleAdminRole(
                              candidate.userId,
                              candidate.roles,
                            )
                          }
                        >
                          {isChurchAdmin ? (
                            <span>
                              {t('admin:super_admin.modal.revoke_admin_btn')}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Sparkles size={13} />
                              {t('admin:super_admin.modal.grant_admin_btn')}
                            </span>
                          )}
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="default"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              {t('admin:super_admin.modal.cancel_btn')}
            </Button>
            <Button type="submit" variant="primary" disabled={isSaving}>
              <span className="flex items-center gap-2">
                <Check size={16} />
                {isSaving
                  ? t('common:states.saving')
                  : isEditing
                    ? t('admin:super_admin.modal.save_btn')
                    : t('admin:super_admin.modal.create_btn')}
              </span>
            </Button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
};

export default ChurchTenantModal;
