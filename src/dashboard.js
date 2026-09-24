import { BOARD_SETTINGS_KEY, CARD_DATA_KEY, buildBurndown, defaultSprintDates, formatHours, needsActualTime, normalizeTimeData } from './model.js';
import { renderChart } from './chart.js';

const demoMode = new URLSearchParams(window.location.search).has('demo');
const demoTimes = {
  c1: { estimate: 8, actual: 7.5, completedAt: '2026-09-18' },
  c2: { estimate: 5, actual: 6, completedAt: '2026-09-20' },
  c3: { estimate: 13, actual: null, completedAt: null },
  c4: { estimate: 3, actual: 2.5, completedAt: '2026-09-22' },
  c5: { estimate: 8, actual: null, completedAt: null },
};
const demoClient = {
  board: async () => ({ name: 'Produktlancering' }),
  cards: async () => [
    { id: 'c1', name: 'Interview tre pilotkunder', url: '#', dueComplete: true },
    { id: 'c2', name: 'Byg onboarding-flow', url: '#', dueComplete: true },
    { id: 'c3', name: 'Klargør betalingsside', url: '#', dueComplete: false },
    { id: 'c4', name: 'Skriv hjælpetekster', url: '#', dueComplete: true },
    { id: 'c5', name: 'Test mobilvisning', url: '#', dueComplete: true },
  ],
  get: async (scope, visibility, key, fallback) => key === BOARD_SETTINGS_KEY
    ? { startDate: '2026-09-16', endDate: '2026-09-29' }
    : demoTimes[scope] || fallback,
  set: async () => undefined,
};
const t = demoMode ? demoClient : window.TrelloPowerUp.iframe();
const settingsPanel = document.querySelector('#settings-panel');
const settingsToggle = document.querySelector('#settings-toggle');
let cards = [];

function formatDate(date) {
  return new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`));
}

function renderTaskList(tracked) {
  const list = document.querySelector('#task-list');
  list.replaceChildren();
  [...tracked].sort((a, b) => Number(Boolean(a.time.completedAt)) - Number(Boolean(b.time.completedAt))).forEach((card) => {
    const missingActual = needsActualTime(card);
    const row = document.createElement('article');
    row.className = `task-row${card.time.completedAt ? ' is-complete' : ''}${missingActual ? ' needs-actual' : ''}`;
    const status = document.createElement('span');
    status.className = 'task-status';
    status.setAttribute('aria-label', missingActual ? 'Mangler faktisk tid' : card.time.completedAt ? 'Færdig' : 'Åben');
    const text = document.createElement('div');
    const name = document.createElement('a');
    name.href = card.url;
    name.target = '_blank';
    name.rel = 'noreferrer';
    name.textContent = card.name;
    const detail = document.createElement('small');
    detail.textContent = missingActual
      ? `Mangler faktisk tid · ${formatHours(card.time.estimate)} estimeret`
      : card.time.completedAt
        ? `${formatHours(card.time.actual)} faktisk · ${formatHours(card.time.estimate)} estimeret`
        : `${formatHours(card.time.estimate)} tilbage`;
    text.append(name, detail);
    row.append(status, text);
    list.append(row);
  });
}

function render(settings) {
  const result = buildBurndown(cards, settings);
  document.querySelector('#start-date').value = settings.startDate;
  document.querySelector('#end-date').value = settings.endDate;
  document.querySelector('#loading').hidden = true;
  if (!result.tracked.length) {
    document.querySelector('#dashboard-content').hidden = true;
    document.querySelector('#empty-state').hidden = false;
    return;
  }
  document.querySelector('#empty-state').hidden = true;
  document.querySelector('#dashboard-content').hidden = false;
  document.querySelector('#remaining-hours').textContent = formatHours(result.remaining);
  document.querySelector('#completed-count').textContent = `${result.completedCount} / ${result.tracked.length}`;
  const variance = result.variance;
  document.querySelector('#variance').textContent = `${variance > 0 ? '+' : ''}${formatHours(variance)}`;
  document.querySelector('#variance').className = variance > 0 ? 'metric-warning' : '';
  document.querySelector('#date-range').textContent = `${formatDate(settings.startDate)} til ${formatDate(settings.endDate)}`;
  document.querySelector('#tracked-label').textContent = `${result.tracked.length} kort med estimat`;
  renderChart(document.querySelector('#chart'), result.points, result.totalEstimate);
  renderTaskList(result.tracked);
}

async function load() {
  const [board, trelloCards, storedSettings] = await Promise.all([
    t.board('name'),
    t.cards('id', 'name', 'url', 'dueComplete'),
    t.get('board', 'shared', BOARD_SETTINGS_KEY, null),
  ]);
  document.querySelector('#board-title').textContent = board.name;
  cards = await Promise.all(trelloCards.map(async (card) => ({
    ...card,
    time: normalizeTimeData(await t.get(card.id, 'shared', CARD_DATA_KEY, {})),
  })));
  const defaults = defaultSprintDates();
  const settings = storedSettings?.startDate && storedSettings?.endDate ? storedSettings : defaults;
  render(settings);
}

settingsToggle.addEventListener('click', () => {
  settingsPanel.hidden = !settingsPanel.hidden;
  settingsToggle.setAttribute('aria-expanded', String(!settingsPanel.hidden));
});

document.querySelector('#settings-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const settings = {
    startDate: document.querySelector('#start-date').value,
    endDate: document.querySelector('#end-date').value,
  };
  const error = document.querySelector('#dashboard-error');
  if (settings.startDate > settings.endDate) {
    error.textContent = 'Slutdatoen skal ligge efter startdatoen.';
    error.hidden = false;
    return;
  }
  error.hidden = true;
  await t.set('board', 'shared', BOARD_SETTINGS_KEY, settings);
  settingsPanel.hidden = true;
  settingsToggle.setAttribute('aria-expanded', 'false');
  render(settings);
});

load().catch((reason) => {
  document.querySelector('#loading').hidden = true;
  const error = document.querySelector('#dashboard-error');
  error.textContent = 'Boardets data kunne ikke hentes. Genåbn dashboardet og prøv igen.';
  error.hidden = false;
  console.error(reason);
});
