import { IChurch, IChurchBranding } from '@/libs/models/Church';

export const TENANT_BRANDING_CACHE_KEY = 'ff_tenant_branding_cache';
export const DEV_TENANT_OVERRIDE_KEY = 'lumbrela_dev_tenant_override';

export interface TenantHostContext {
  hostname: string;
  isSuperAdminHost: boolean;
  tenantSlug: string | null;
}

const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api']);

/**
 * Checks whether a hostname corresponds to a local development, IP, or Vercel preview environment.
 *
 * @param {string} hostname - Lowercase hostname from `window.location.hostname`.
 * @returns {boolean} True when running in a local or preview host environment.
 */
export const isLocalTenantHost = (hostname: string): boolean =>
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) ||
  hostname.endsWith('.vercel.app') ||
  hostname.endsWith('.localhost');

/**
 * Extracts the root domain from a production hostname (stripping `admin.` or a tenant subdomain).
 *
 * @param {string} hostname - Lowercase hostname from `window.location.hostname`.
 * @returns {string} Root domain string (e.g. `lumbrela.app`).
 */
const getRootDomain = (hostname: string): string => {
  if (hostname.startsWith('admin.')) return hostname.slice('admin.'.length);
  const parts = hostname.split('.');
  if (parts.length >= 3) return parts.slice(1).join('.');
  return hostname;
};

/**
 * Resolves the active host context from window.location (and optional ?tenant= query parameter for local dev).
 * Persists `?tenant=` in sessionStorage on local/preview hosts so internal navigation preserves the tenant context.
 *
 * @returns {TenantHostContext} Parsed host context indicating whether it is the Superadmin console or a church tenant.
 */
export const resolveTenantHostContext = (): TenantHostContext => {
  if (typeof window === 'undefined') {
    return { hostname: '', isSuperAdminHost: false, tenantSlug: null };
  }

  const rawHostname = window.location.hostname.toLowerCase();
  const searchParams = new URLSearchParams(window.location.search);
  const queryTenant = searchParams.get('tenant')?.trim().toLowerCase() || null;
  const isLocal = isLocalTenantHost(rawHostname);

  if (
    isLocal &&
    queryTenant &&
    (queryTenant === 'admin' || !RESERVED_SUBDOMAINS.has(queryTenant))
  ) {
    try {
      sessionStorage.setItem(DEV_TENANT_OVERRIDE_KEY, queryTenant);
    } catch {
      // Ignore sessionStorage access errors
    }
  }

  let effectiveQueryTenant = queryTenant;
  if (!effectiveQueryTenant && isLocal) {
    try {
      effectiveQueryTenant =
        sessionStorage.getItem(DEV_TENANT_OVERRIDE_KEY)?.trim().toLowerCase() ||
        null;
    } catch {
      effectiveQueryTenant = null;
    }
  }

  if (effectiveQueryTenant === 'admin') {
    return { hostname: rawHostname, isSuperAdminHost: true, tenantSlug: null };
  }

  if (effectiveQueryTenant && !RESERVED_SUBDOMAINS.has(effectiveQueryTenant)) {
    return {
      hostname: rawHostname,
      isSuperAdminHost: false,
      tenantSlug: effectiveQueryTenant,
    };
  }

  if (rawHostname.startsWith('admin.')) {
    return { hostname: rawHostname, isSuperAdminHost: true, tenantSlug: null };
  }

  if (isLocal) {
    const localParts = rawHostname.split('.');
    if (
      localParts.length >= 2 &&
      localParts[localParts.length - 1] === 'localhost'
    ) {
      const candidate = localParts[0];
      if (candidate === 'admin') {
        return {
          hostname: rawHostname,
          isSuperAdminHost: true,
          tenantSlug: null,
        };
      }
      if (candidate && !RESERVED_SUBDOMAINS.has(candidate)) {
        return {
          hostname: rawHostname,
          isSuperAdminHost: false,
          tenantSlug: candidate,
        };
      }
    }
    return { hostname: rawHostname, isSuperAdminHost: false, tenantSlug: null };
  }

  const parts = rawHostname.split('.');
  if (parts.length >= 3) {
    const subdomain = parts[0];
    if (subdomain && !RESERVED_SUBDOMAINS.has(subdomain)) {
      return {
        hostname: rawHostname,
        isSuperAdminHost: false,
        tenantSlug: subdomain,
      };
    }
  }

  return { hostname: rawHostname, isSuperAdminHost: false, tenantSlug: null };
};

/**
 * Builds the admin panel URL for a church tenant, using `/admin?tenant=<slug>` in local/preview
 * environments and `https://<slug>.<rootDomain>/admin` in production.
 *
 * @param {Pick<IChurch, 'slug'>} church - Target church tenant.
 * @returns {string} Admin panel URL for the given church, or '#' if no slug is available.
 */
export const buildTenantAdminUrl = (church: Pick<IChurch, 'slug'>): string => {
  const slug = church.slug?.trim().toLowerCase();
  if (!slug || typeof window === 'undefined') return '#';

  const { protocol, hostname } = window.location;
  const normalizedHost = hostname.toLowerCase();

  if (isLocalTenantHost(normalizedHost))
    return `/admin?tenant=${encodeURIComponent(slug)}`;

  const rootDomain = getRootDomain(normalizedHost);
  return `${protocol}//${slug}.${rootDomain}/admin`;
};

/**
 * Builds the Superadmin console URL, using `/?tenant=admin` in local/preview
 * environments and `https://admin.<rootDomain>` in production.
 *
 * @returns {string} Superadmin console URL.
 */
export const buildSuperAdminConsoleUrl = (): string => {
  if (typeof window === 'undefined') return '#';

  const { protocol, hostname } = window.location;
  const normalizedHost = hostname.toLowerCase();

  if (isLocalTenantHost(normalizedHost)) return '/?tenant=admin';

  const rootDomain = getRootDomain(normalizedHost);
  return `${protocol}//admin.${rootDomain}`;
};

/**
 * Persists the active church's branding metadata in localStorage for instant pre-React splash screen rendering
 * and updates DOM document title, theme-color, apple-touch-icon, favicon, and CSS brand variables.
 *
 * @param {IChurch | null | undefined} church - Resolved church object.
 * @returns {void}
 */
export const applyChurchBrandingToDom = (church?: IChurch | null): void => {
  if (typeof document === 'undefined' || !church) return;

  const branding: IChurchBranding = church.branding || {};
  const appName = branding.appName || church.name || 'Iglekids';
  const shortName = branding.shortName || appName;
  const primaryColor = branding.primaryColor || '#2563EB';
  const themeColor = branding.themeColor || '#ffffff';
  const backgroundColor = branding.backgroundColor || '#ffffff';
  const icon192Url = branding.icon192Url || '/icons/icon-192x192.png';
  const appleTouchIconUrl = branding.appleTouchIconUrl || icon192Url;
  const logoUrl = branding.logoUrl || icon192Url || '/logo-iglekids.png';

  document.title = appName;

  const setMetaContent = (selector: string, content: string) => {
    const element = document.querySelector<HTMLMetaElement>(selector);
    if (element) element.setAttribute('content', content);
  };

  setMetaContent('meta[name="theme-color"]', themeColor);
  setMetaContent('meta[name="application-name"]', shortName);
  setMetaContent('meta[name="apple-mobile-web-app-title"]', shortName);

  const appleIconLink = document.querySelector<HTMLLinkElement>(
    'link[rel="apple-touch-icon"]',
  );
  if (appleIconLink && appleTouchIconUrl)
    appleIconLink.href = appleTouchIconUrl;

  const icon192Link = document.querySelector<HTMLLinkElement>(
    'link[rel="icon"][sizes="192x192"]',
  );
  if (icon192Link && icon192Url) icon192Link.href = icon192Url;

  document.documentElement.style.setProperty('--church-primary', primaryColor);
  document.documentElement.style.setProperty('--church-theme', themeColor);
  document.documentElement.style.setProperty('--church-bg', backgroundColor);

  try {
    localStorage.setItem(
      TENANT_BRANDING_CACHE_KEY,
      JSON.stringify({
        churchId: church.id,
        slug: church.slug,
        appName,
        shortName,
        primaryColor,
        themeColor,
        backgroundColor,
        logoUrl,
        icon192Url,
        appleTouchIconUrl,
      }),
    );
  } catch {
    // Ignore storage quota errors
  }
};

/**
 * Reads the currently active church ID from localStorage cache or Vite fallback environment variable.
 *
 * @returns {string | undefined} Active church UUID if available.
 */
export const getActiveTenantChurchId = (): string | undefined => {
  const hostContext = resolveTenantHostContext();
  if (hostContext.isSuperAdminHost) return undefined;

  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(TENANT_BRANDING_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as {
          churchId?: string;
          slug?: string;
        };
        const matchesTenantSlug =
          !hostContext.tenantSlug ||
          !parsed?.slug ||
          parsed.slug === hostContext.tenantSlug;
        if (parsed?.churchId && matchesTenantSlug) return parsed.churchId;
      }
    } catch {
      // Ignore parse errors
    }
  }
  return hostContext.tenantSlug
    ? undefined
    : import.meta.env.VITE_CHURCH_ID || undefined;
};

/**
 * Resolves the active church ID or throws if no church tenant context is available.
 *
 * @param {string | null | undefined} churchIdFromStore - Optional church ID already loaded in Redux state.
 * @returns {string} Guaranteed active church UUID.
 */
export const getActiveChurchId = (
  churchIdFromStore?: string | null,
): string => {
  const churchId = churchIdFromStore || getActiveTenantChurchId();
  if (!churchId)
    throw new Error('Active church context is required for this operation.');
  return churchId;
};
