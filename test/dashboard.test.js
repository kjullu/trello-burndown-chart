import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/chart.js', () => ({ renderChart: vi.fn() }));
vi.mock('../src/trello-client.js', () => ({ createTrelloClient: vi.fn() }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

function element() {
  return {
    hidden: true,
    textContent: '',
    children: [],
    addEventListener: vi.fn(),
    setAttribute: vi.fn(),
    replaceChildren() { this.children = []; },
    append(...children) { this.children.push(...children); },
  };
}

describe('dashboard task list', () => {
  it.each([
    { estimate: null, actual: 2, detail: '2 t faktisk · – estimeret' },
    { estimate: 3, actual: null, detail: '– faktisk · 3 t estimeret' },
    { estimate: null, actual: null, detail: '– faktisk · – estimeret' },
  ])('renders a completed card with estimate=$estimate and actual=$actual', async ({ estimate, actual, detail }) => {
    const elements = new Map();
    const getElement = (selector) => {
      if (!elements.has(selector)) elements.set(selector, element());
      return elements.get(selector);
    };
    vi.stubGlobal('window', { location: { search: '' } });
    vi.stubGlobal('document', {
      querySelector: getElement,
      getElementById: (id) => getElement(`#${id}`),
      createElement: element,
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { createTrelloClient } = await import('../src/trello-client.js');
    createTrelloClient.mockResolvedValue({
      board: async () => ({ name: 'Test board' }),
      cards: async () => [{ id: 'done', name: 'Completed task', url: '#', dueComplete: true }],
      get: async (scope, visibility, key, fallback) => {
        if (key === 'sprintlineSettings') return { startDate: '2026-09-21', endDate: '2026-10-10' };
        if (key === 'sprintlineTime') return { estimate, actual, completedAt: '2026-09-22' };
        return fallback;
      },
    });

    await import('../src/dashboard.js');

    await vi.waitFor(() => expect(getElement('#task-list').children).toHaveLength(1));
    const row = getElement('#task-list').children[0];
    expect(row.children[1].children[1].textContent).toBe(detail);
    expect(getElement('#dashboard-content').hidden).toBe(false);
    expect(getElement('#dashboard-error').hidden).toBe(true);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
