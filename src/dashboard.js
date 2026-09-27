import { BOARD_PREFERENCES_KEY, BOARD_SETTINGS_KEY, CARD_DATA_KEY, buildBurndown, buildBurndownCsv, defaultSprintDates, formatDanishDate, formatHours, localDateKey, needsActualTime, normalizePreferences, normalizeSprintSettings, normalizeTimeData, parseDanishDate } from './model.js';
import { renderChart } from './chart.js';
import { createTrelloClient } from './trello-client.js';

const query = new URLSearchParams(window.location.search);
const demoMode = query.has('demo');
const demoScenario = query.get('demo');
const defaultDemoTimes = {
  c1: { estimate: 8, actual: 7.5, completedAt: '2026-09-18' },
  c2: { estimate: 5, actual: 6, completedAt: '2026-09-20' },
  c3: { estimate: 13, actual: null, completedAt: null },
  c4: { estimate: 3, actual: 2.5, completedAt: '2026-09-22' },
  c5: { estimate: 8, actual: null, completedAt: null },
};
const wikipediaBaselineDemo = demoScenario === 'wikipedia-baseline';
const demoTimes = wikipediaBaselineDemo
  ? { c1: { estimate: 2, actual: null, completedAt: null, estimateHistory: [{ date: null, estimate: 2 }] } }
  : defaultDemoTimes;
const demoClient = {
  board: async () => ({ name: wikipediaBaselineDemo ? 'Wikipedia-baseline test' : 'Produktlancering' }),
  cards: async () => wikipediaBaselineDemo ? [
    { id: 'c1', name: 'test', url: '#', dueComplete: false },
  ] : [
    { id: 'c1', name: 'Interview tre pilotkunder', url: '#', dueComplete: true },
    { id: 'c2', name: 'Byg onboarding-flow', url: '#', dueComplete: true },
    { id: 'c3', name: 'Klargør betalingsside', url: '#', dueComplete: false },
    { id: 'c4', name: 'Skriv hjælpetekster', url: '#', dueComplete: true },
    { id: 'c5', name: 'Test mobilvisning', url: '#', dueComplete: true },
  ],
  get: async (scope, visibility, key, fallback) => key === BOARD_SETTINGS_KEY
    ? wikipediaBaselineDemo
      ? { startDate: '2026-09-24', endDate: '2026-09-29' }
      : { startDate: '2026-09-16', endDate: '2026-09-29' }
    : demoTimes[scope] || fallback,
  set: async () => undefined,
};
const t = await createTrelloClient({ demoMode, demoClient });
const settingsPanel = document.querySelector('#settings-panel');
const settingsToggle = document.querySelector('#settings-toggle');
let cards = [];
let currentBurndown = null;
let boardName = '';
let preferences = normalizePreferences();

function filenamePart(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'board';
}

function downloadCsv() {
  if (!currentBurndown) return;
  const csv = buildBurndownCsv(currentBurndown.points);
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filenamePart(boardName)}-burndown-${currentBurndown.startDate}-${currentBurndown.endDate}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function formatDate(date) {
  return new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`));
}

for (const field of ['start-date', 'end-date']) {
  const input = document.getElementById(field);
  const picker = document.getElementById(`${field}-picker`);
  picker.addEventListener('change', () => { if (picker.value) input.value = formatDanishDate(picker.value); });
  input.addEventListener('change', () => { picker.value = parseDanishDate(input.value) || ''; });
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

function render(settings, preferences) {
  const result = buildBurndown(cards, settings, demoMode ? '2026-09-26' : localDateKey(), preferences);
  currentBurndown = { ...result, ...settings };
  for (const [field, date] of [['start-date', settings.startDate], ['end-date', settings.endDate]]) {
    document.getElementById(field).value = formatDanishDate(date);
    document.getElementById(`${field}-picker`).value = date;
  }
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
  document.querySelector('#velocity').textContent = result.velocity === null ? '–' : `${formatHours(result.velocity)} / arbejdsdag`;
  document.querySelector('#efficiency').textContent = result.measuredEfficiency === null
    ? `${Math.round(result.plannedEfficiency * 100)}% (planlagt)`
    : `${Math.round(result.efficiency * 100)}%`;
  document.querySelector('#efficiency').className = result.measuredEfficiency !== null && result.efficiency < 1 ? 'metric-warning' : '';
  document.querySelector('#prognosis').textContent = formatDate(result.projectedEndDate);
  document.querySelector('#prognosis').className = result.projectedEndDate > settings.endDate ? 'metric-warning' : '';
  document.querySelector('#date-range').textContent = `${formatDate(settings.startDate)} til ${formatDate(settings.endDate)}`;
  document.querySelector('#tracked-label').textContent = `${result.tracked.length} kort med estimat`;
  renderChart(document.querySelector('#chart'), result.points, result.totalEstimate);
  renderTaskList(result.tracked);
}

async function load() {
  const [board, trelloCards, storedSettings, storedPreferences] = await Promise.all([
    t.board('name'),
    t.cards('id', 'name', 'url', 'dueComplete'),
    t.get('board', 'shared', BOARD_SETTINGS_KEY, null),
    t.get('board', 'shared', BOARD_PREFERENCES_KEY, {}),
  ]);
  boardName = board.name;
  document.querySelector('#board-title').textContent = board.name;
  cards = await Promise.all(trelloCards.map(async (card) => ({
    ...card,
    time: normalizeTimeData(await t.get(card.id, 'shared', CARD_DATA_KEY, {})),
  })));
  preferences = normalizePreferences(storedPreferences);
  const defaults = defaultSprintDates(new Date(), preferences.defaultSprintDays);
  const settings = normalizeSprintSettings(storedSettings, defaults);
  try {
    render(settings, preferences);
  } catch (reason) {
    const error = document.querySelector('#dashboard-error');
    error.textContent = 'Dashboardet kunne ikke vises. Kontrollér sprintdatoerne og prøv igen.';
    error.hidden = false;
    throw reason;
  }
}

settingsToggle.addEventListener('click', () => {
  settingsPanel.hidden = !settingsPanel.hidden;
  settingsToggle.setAttribute('aria-expanded', String(!settingsPanel.hidden));
});

document.querySelector('#export-csv').addEventListener('click', downloadCsv);

document.querySelector('#settings-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const settings = {
    startDate: parseDanishDate(document.querySelector('#start-date').value),
    endDate: parseDanishDate(document.querySelector('#end-date').value),
  };
  const error = document.querySelector('#dashboard-error');
  if (!settings.startDate || !settings.endDate) {
    error.textContent = 'Skriv gyldige datoer som dd/mm/åååå.';
    error.hidden = false;
    return;
  }
  if (settings.startDate > settings.endDate) {
    error.textContent = 'Slutdatoen skal ligge efter startdatoen.';
    error.hidden = false;
    return;
  }
  error.hidden = true;
  try {
    await t.set('board', 'shared', BOARD_SETTINGS_KEY, settings);
    settingsPanel.hidden = true;
    settingsToggle.setAttribute('aria-expanded', 'false');
    render(settings, preferences);
  } catch (reason) {
    error.textContent = 'Sprintdatoerne kunne ikke gemmes. Prøv igen.';
    error.hidden = false;
    console.error(reason);
  }
});

load().catch((reason) => {
  document.querySelector('#loading').hidden = true;
  const error = document.querySelector('#dashboard-error');
  if (error.hidden) error.textContent = 'Boardets data kunne ikke hentes. Genåbn dashboardet og prøv igen.';
  error.hidden = false;
  console.error(reason);
});
