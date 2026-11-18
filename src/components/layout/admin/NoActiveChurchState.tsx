import React from 'react';
import { Building2, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import { useSuperAdminChurchSwitcher } from '@/libs/hooks/useSuperAdminChurchSwitcher';

/**
 * Guided empty state displayed when a SUPER_ADMIN enters `/admin` without an active
 * church tenant resolved, allowing them to pick a church or return to the Platform Console.
 *
 * @returns {JSX.Element} Guided church selection panel.
 */
export const NoActiveChurchState: React.FC = () => {
  const { t } = useTranslation(['admin', 'common']);
  const { churches, isLoading, switchChurch, goToSuperAdminConsole } =
    useSuperAdminChurchSwitcher(true);

  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-slate-50/70">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8 text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
          <Building2 size={28} />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
            {t('admin:layout.no_active_church.title')}
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            {t('admin:layout.no_active_church.description')}
          </p>
        </div>

        <div className="text-left">
          <Select
            aria-label={t('admin:layout.no_active_church.select_label')}
            label={t('admin:layout.no_active_church.select_label')}
            value=""
            disabled={isLoading || churches.length === 0}
            onChange={(e) => switchChurch(e.target.value)}
          >
            <option value="" disabled>
              {isLoading
                ? t('common:states.loading', { defaultValue: 'Cargando...' })
                : t('admin:layout.no_active_church.select_placeholder')}
            </option>
            {churches.map((church) => (
              <option key={church.id} value={church.id}>
                {church.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="default"
            block
            onClick={goToSuperAdminConsole}
            className="gap-2"
          >
            <Globe size={16} />
            <span>{t('admin:layout.no_active_church.back_to_platform')}</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
