import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('card badge colors', () => {
  it('uses the completed color when actual time exceeds the estimate', async () => {
    let capabilities;
    vi.stubGlobal('window', {
      location: { href: 'https://example.com/' },
      TrelloPowerUp: { initialize: (value) => { capabilities = value; } },
    });
    await import('../src/connector.js');
    const t = {
      get: vi.fn(async (scope, visibility, key) => key === 'sprintlineTime'
        ? { estimate: 1, actual: 2, completedAt: '2026-09-30' }
        : { completedColor: 'green', warningColor: 'red', warnOverEstimate: true }),
      card: vi.fn(async () => ({ dueComplete: true })),
    };

    const [badge] = await capabilities['card-badges'](t);

    expect(badge.color).toBe('green');
  });
});
