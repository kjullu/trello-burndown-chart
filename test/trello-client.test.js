import { describe, expect, it, vi } from 'vitest';
import { createTrelloClient } from '../src/trello-client.js';

describe('createTrelloClient', () => {
  it('returns the local demo client without loading the Trello runtime', async () => {
    const demoClient = { board: vi.fn() };
    const documentObject = { head: { append: vi.fn(() => { throw new Error('Trello runtime should not load'); }) } };

    await expect(createTrelloClient({ demoMode: true, demoClient, documentObject, windowObject: {} })).resolves.toBe(demoClient);
    expect(documentObject.head.append).not.toHaveBeenCalled();
  });

  it('uses the Trello iframe client when the runtime is already available', async () => {
    const iframeClient = { board: vi.fn() };
    const iframe = vi.fn(() => iframeClient);

    await expect(createTrelloClient({ demoMode: false, demoClient: {}, documentObject: {}, windowObject: { TrelloPowerUp: { iframe } } })).resolves.toBe(iframeClient);
    expect(iframe).toHaveBeenCalledOnce();
  });
});
