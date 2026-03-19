/**
 * API Service Tests
 *
 * Tests for the API client utility functions, particularly
 * the org slug extraction logic.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Helper to mock window.location
const mockLocation = (hostname: string, search = '') => {
  Object.defineProperty(window, 'location', {
    value: {
      hostname,
      search,
    },
    writable: true,
  });
};

// Store original location
const originalLocation = window.location;

describe('getOrgSlug', () => {
  beforeEach(() => {
    // Reset modules to get fresh imports with mocked location
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original location
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  it('should return "heal" for localhost', async () => {
    mockLocation('localhost');
    const { getOrgSlug } = await import('./api');
    expect(getOrgSlug()).toBe('heal');
  });

  it('should return "heal" for 127.0.0.1', async () => {
    mockLocation('127.0.0.1');
    const { getOrgSlug } = await import('./api');
    expect(getOrgSlug()).toBe('heal');
  });

  it('should allow org override via URL param on localhost', async () => {
    mockLocation('localhost', '?org=cannwood');
    const { getOrgSlug } = await import('./api');
    expect(getOrgSlug()).toBe('cannwood');
  });

  it('should extract org from canopydata.app domain', async () => {
    mockLocation('heal.canopydata.app');
    const { getOrgSlug } = await import('./api');
    expect(getOrgSlug()).toBe('heal');
  });

  it('should extract org from different canopydata.app subdomain', async () => {
    mockLocation('cannwood.canopydata.app');
    const { getOrgSlug } = await import('./api');
    expect(getOrgSlug()).toBe('cannwood');
  });

  it('should extract org from legacy Railway domain', async () => {
    mockLocation('healdata.up.railway.app');
    const { getOrgSlug } = await import('./api');
    expect(getOrgSlug()).toBe('heal');
  });

  it('should extract org from different Railway subdomain', async () => {
    mockLocation('cannwooddata.up.railway.app');
    const { getOrgSlug } = await import('./api');
    expect(getOrgSlug()).toBe('cannwood');
  });

  it('should fallback to org pattern for other domains', async () => {
    mockLocation('healdata.example.com');
    const { getOrgSlug } = await import('./api');
    expect(getOrgSlug()).toBe('heal');
  });

  it('should default to "heal" for unknown domains', async () => {
    mockLocation('unknown.example.com');
    const { getOrgSlug } = await import('./api');
    expect(getOrgSlug()).toBe('heal');
  });
});
