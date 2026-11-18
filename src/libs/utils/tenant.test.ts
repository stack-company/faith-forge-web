import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DEV_TENANT_OVERRIDE_KEY,
  TENANT_BRANDING_CACHE_KEY,
  applyChurchBrandingToDom,
  buildSuperAdminConsoleUrl,
  buildTenantAdminUrl,
  getActiveTenantChurchId,
  resolveTenantHostContext,
} from './tenant';
import { EntityState, IChurch } from '@/libs/models/Church';

const setWindowLocation = (url: string) => {
  const parsed = new URL(url);
  Object.defineProperty(window, 'location', {
    writable: true,
    value: {
      href: parsed.href,
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port,
      pathname: parsed.pathname,
      search: parsed.search,
      assign: vi.fn(),
    },
  });
};

describe('tenant host resolution and URL builders', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('persists ?tenant=<slug> in sessionStorage on localhost and keeps it across internal navigation', () => {
    setWindowLocation('http://localhost:3000/admin?tenant=iglesia-norte');
    const initialContext = resolveTenantHostContext();

    expect(initialContext).toEqual({
      hostname: 'localhost',
      isSuperAdminHost: false,
      tenantSlug: 'iglesia-norte',
    });
    expect(sessionStorage.getItem(DEV_TENANT_OVERRIDE_KEY)).toBe('iglesia-norte');

    // Simulate React Router navigating to /admin/campuses without ?tenant= in the URL
    setWindowLocation('http://localhost:3000/admin/campuses');
    const navigatedContext = resolveTenantHostContext();

    expect(navigatedContext).toEqual({
      hostname: 'localhost',
      isSuperAdminHost: false,
      tenantSlug: 'iglesia-norte',
    });
  });

  it('activates SuperAdminHost mode when ?tenant=admin is passed and persists it locally', () => {
    setWindowLocation('http://127.0.0.1:3000/?tenant=admin');
    const initialContext = resolveTenantHostContext();

    expect(initialContext.isSuperAdminHost).toBe(true);
    expect(initialContext.tenantSlug).toBeNull();
    expect(sessionStorage.getItem(DEV_TENANT_OVERRIDE_KEY)).toBe('admin');

    setWindowLocation('http://127.0.0.1:3000/super-admin/operations');
    const navigatedContext = resolveTenantHostContext();

    expect(navigatedContext.isSuperAdminHost).toBe(true);
    expect(navigatedContext.tenantSlug).toBeNull();
  });

  it('keeps returning the active church UUID for x-church-id across internal routes', () => {
    setWindowLocation('http://localhost:3000/admin?tenant=iglesia-norte');
    const iglesiaNorte = {
      id: 'uuid-iglesia-norte',
      name: 'Iglesia Norte',
      slug: 'iglesia-norte',
      state: EntityState.ACTIVE,
    } as IChurch;

    applyChurchBrandingToDom(iglesiaNorte);

    // Navigate to /admin/campuses without query param
    setWindowLocation('http://localhost:3000/admin/campuses');
    expect(getActiveTenantChurchId()).toBe('uuid-iglesia-norte');
  });

  it('ignores stale cached church IDs when switching to a different tenant slug', () => {
    localStorage.setItem(
      TENANT_BRANDING_CACHE_KEY,
      JSON.stringify({ churchId: 'uuid-otra-iglesia', slug: 'otra-iglesia' }),
    );
    setWindowLocation('http://localhost:3000/admin?tenant=iglesia-norte');

    expect(getActiveTenantChurchId()).toBeUndefined();
  });

  it('builds /admin?tenant=<slug> in local environments and subdomain URL in production', () => {
    setWindowLocation('http://localhost:3000/?tenant=admin');
    expect(buildTenantAdminUrl({ slug: 'iglesia-norte' })).toBe('/admin?tenant=iglesia-norte');
    expect(buildTenantAdminUrl({ slug: '' })).toBe('#');
    expect(buildSuperAdminConsoleUrl()).toBe('/?tenant=admin');

    setWindowLocation('https://admin.lumbrela.app/');
    expect(buildTenantAdminUrl({ slug: 'iglesia-norte' })).toBe(
      'https://iglesia-norte.lumbrela.app/admin',
    );
    expect(buildSuperAdminConsoleUrl()).toBe('https://admin.lumbrela.app');

    setWindowLocation('https://iglesia-norte.lumbrela.app/admin');
    expect(buildSuperAdminConsoleUrl()).toBe('https://admin.lumbrela.app');
  });
});
