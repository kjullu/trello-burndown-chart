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
    style: {},
    children: [],
    addEventListener: vi.fn(),
    setAttribute: vi.fn(),
    replaceChildren(...children) { this.children = children; },
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
    const [heading, row] = getElement('#task-list').children[0].children;
    expect(heading.textContent).toBe('Færdige · 1');
    expect(row.children[1].children[1].textContent).toBe(detail);
    expect(getElement('#dashboard-content').hidden).toBe(false);
    expect(getElement('#dashboard-error').hidden).toBe(true);
    expect(consoleError).not.toHaveBeenCalled();
  });
});

function stubPage() {
  const elements = new Map();
  const getElement = (selector) => {
    if (!elements.has(selector)) elements.set(selector, element());
    return elements.get(selector);
  };
  vi.stubGlobal('window', { location: { search: '' }, confirm: () => true });
  vi.stubGlobal('document', {
    querySelector: getElement,
    getElementById: (id) => getElement(`#${id}`),
    createElement: element,
  });
  return getElement;
}

describe('dashboard sprints', () => {
  it('saves the suggested first sprint on a new board', async () => {
    const getElement = stubPage();
    const set = vi.fn(async () => undefined);
    const { createTrelloClient } = await import('../src/trello-client.js');
    createTrelloClient.mockResolvedValue({
      board: async () => ({ name: 'Test board' }),
      cards: async () => [],
      get: async (scope, visibility, key, fallback) => fallback,
      set,
    });

    await import('../src/dashboard.js');

    await vi.waitFor(() => expect(set).toHaveBeenCalledTimes(1));
    const [scope, , key, board] = set.mock.calls[0];
    expect([scope, key]).toEqual(['board', 'sprintlineSettings']);
    expect(board.sprints).toHaveLength(1);
    expect(getElement('#dashboard-error').hidden).toBe(true);
  });

  it('moves the cards of a deleted sprint to the backlog', async () => {
    const getElement = stubPage();
    const store = {
      board: {
        sprints: [
          { id: 's1', name: 'Sprint 1', startDate: '2026-01-05', endDate: '2026-01-18' },
          { id: 's2', name: 'Sprint 2', startDate: '2026-01-19', endDate: '2026-02-01' },
        ],
        legacySprintId: 's2',
        closedSprintIds: ['s1', 's2'],
      },
      a: { estimate: 3, sprintId: 's2' },
      b: { estimate: 2, actual: 2, completedAt: '2026-01-20', sprintId: 's2' },
      c: { estimate: 1, sprintId: 's1' },
    };
    const { createTrelloClient } = await import('../src/trello-client.js');
    createTrelloClient.mockResolvedValue({
      board: async () => ({ name: 'Test board' }),
      cards: async () => ['a', 'b', 'c'].map((id) => ({ id, name: id, url: '#', dueComplete: false })),
      get: async (scope, visibility, key, fallback) => (key === 'sprintlinePreferences' ? fallback : store[scope] ?? fallback),
      set: async (scope, visibility, key, value) => { store[scope] = value; },
    });

    await import('../src/dashboard.js');
    await vi.waitFor(() => expect(getElement('#sprint-rows').children).toHaveLength(2));
    const click = (target) => target.addEventListener.mock.calls.find(([type]) => type === 'click')[1]();
    click(getElement('#sprint-rows').children[1]);
    await click(getElement('#delete-sprint'));

    expect(store.a.sprintId).toBeNull();
    expect(store.b.sprintId).toBeNull();
    expect(store.c.sprintId).toBe('s1');
    expect(store.board).toEqual({ sprints: [expect.objectContaining({ id: 's1' })], legacySprintId: null, closedSprintIds: ['s1'] });
    expect(getElement('#dashboard-error').hidden).toBe(true);
  });
});
