import { BOARD_PREFERENCES_KEY, addDays, BOARD_SETTINGS_KEY, CARD_DATA_KEY, buildBurndown, buildBurndownCsv, cardSprintId, currentSprint, defaultSprintDates, formatDanishDate, formatHours, formatSprintRange, hasSavedSprints, localDateKey, needsActualTime, nextSprintDraft, normalizePreferences, normalizeSprintBoard, normalizeTimeData, parseDanishDate, sprintError, sprintStatus, setSprintClosed, sprintToWrapUp, unfinishedCards, workDayRange, wrapUpTarget } from './model.js';
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
const addedWorkDemo = demoScenario === 'added-work';
const demoTimes = wikipediaBaselineDemo
  ? { c1: { estimate: 2, actual: null, completedAt: null, estimateHistory: [{ date: null, estimate: 2 }] } }
  : addedWorkDemo
    ? { ...defaultDemoTimes, c6: { estimate: 10, estimateHistory: [{ date: '2026-09-23', estimate: 10 }] } }
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
    ...(addedWorkDemo ? [{ id: 'c6', name: 'Ny opgave tilføjet 23. september', url: '#', dueComplete: false }] : []),
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
let sprintBoard = null;
let selectedSprintId = null;
let editingSprint = null;
const today = demoMode ? '2026-09-26' : localDateKey();
const sprintTitle = document.querySelector('#sprint-title');
const sprintMenu = document.querySelector('#sprint-menu');
const sprintSwitch = document.querySelector('.sprint-switch');
const sprintForm = document.querySelector('#settings-form');
const STATUS_LABELS = { past: 'afsluttet', active: 'aktiv', planned: 'planlagt' };

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
  link.download = `${filenamePart(boardName)}-${filenamePart(currentBurndown.name)}-burndown-${currentBurndown.startDate}-${currentBurndown.endDate}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function formatDate(date) {
  return new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`));
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`));
}

for (const field of ['start-date', 'end-date']) {
  const input = document.getElementById(field);
  const picker = document.getElementById(`${field}-picker`);
  picker.addEventListener('change', () => { if (picker.value) input.value = formatDanishDate(picker.value); });
  input.addEventListener('change', () => { picker.value = parseDanishDate(input.value) || ''; });
  picker.addEventListener('change', () => checkSprintForm());
  input.addEventListener('input', () => checkSprintForm({ quietWhileTyping: true }));
  input.addEventListener('change', () => checkSprintForm());
}

function sprintFromForm() {
  return {
    ...editingSprint,
    name: document.querySelector('#sprint-name').value.trim() || editingSprint.name,
    tag: document.querySelector('#sprint-tag').value.trim() || editingSprint.tag,
    startDate: parseDanishDate(document.querySelector('#start-date').value),
    endDate: parseDanishDate(document.querySelector('#end-date').value),
  };
}

// Shows the sprint date problem right under the fields. While typing, an
// unfinished date is not flagged yet; overlaps and reversed dates are.
function checkSprintForm({ quietWhileTyping = false } = {}) {
  if (!editingSprint) return null;
  const sprint = sprintFromForm();
  const incomplete = !sprint.startDate || !sprint.endDate;
  const message = quietWhileTyping && incomplete ? null : sprintError(sprint, sprintBoard.sprints);
  const box = document.querySelector('#sprint-form-error');
  box.textContent = message || '';
  box.hidden = !message;
  const overlap = message && sprint.startDate && sprint.endDate
    ? sprintBoard.sprints.find((other) => other.id !== sprint.id && sprint.startDate <= other.endDate && sprint.endDate >= other.startDate)
    : null;
  const fields = { 'start-date': sprint.startDate, 'end-date': sprint.endDate };
  const bad = new Set();
  if (message) {
    for (const [field, date] of Object.entries(fields)) if (!date && !quietWhileTyping) bad.add(field);
    if (!incomplete && sprint.startDate > sprint.endDate) Object.keys(fields).forEach((f) => bad.add(f));
    if (overlap) {
      for (const [field, date] of Object.entries(fields)) if (date >= overlap.startDate && date <= overlap.endDate) bad.add(field);
      if (!bad.size) Object.keys(fields).forEach((f) => bad.add(f)); // covers the other sprint entirely
    }
  }
  for (const field of Object.keys(fields)) document.getElementById(field).setAttribute('aria-invalid', String(bad.has(field)));
  return message;
}

const taskGroups = [
  { title: 'Kræver handling', matches: (card) => needsActualTime(card) },
  { title: 'Åbne', matches: (card) => !needsActualTime(card) && !card.time.completedAt },
  { title: 'Færdige', matches: (card) => Boolean(card.time.completedAt) },
];

function hoursBar(className, hours, maxHours) {
  const bar = document.createElement('span');
  bar.className = `hours-bar ${className}`;
  const fill = document.createElement('i');
  fill.style.width = `${Math.min(100, ((hours || 0) / maxHours) * 100)}%`;
  bar.append(fill);
  return bar;
}

function renderTaskRow(card, maxHours) {
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
  const bars = document.createElement('div');
  bars.className = 'task-bars';
  bars.setAttribute('aria-hidden', 'true');
  bars.append(hoursBar('is-estimate', card.time.estimate, maxHours));
  if (card.time.actual) bars.append(hoursBar(card.time.actual > (card.time.estimate || 0) ? 'is-actual is-over' : 'is-actual', card.time.actual, maxHours));
  row.append(status, text, bars);
  return row;
}

function renderTaskList(tracked) {
  const list = document.querySelector('#task-list');
  list.replaceChildren();
  const maxHours = Math.max(1, ...tracked.map((card) => Math.max(card.time.estimate || 0, card.time.actual || 0)));
  taskGroups.forEach((group) => {
    const groupCards = tracked.filter(group.matches);
    if (!groupCards.length) return;
    const section = document.createElement('section');
    section.className = 'task-group';
    const heading = document.createElement('h3');
    heading.textContent = `${group.title} · ${groupCards.length}`;
    section.append(heading, ...groupCards.map((card) => renderTaskRow(card, maxHours)));
    list.append(section);
  });
}

function workDaysAfter(fromDate, toDate) {
  return Math.max(0, workDayRange(fromDate, toDate).length - 1);
}

function renderVerdict(result, settings) {
  const verdict = document.querySelector('#verdict');
  const label = document.querySelector('#verdict-label');
  const text = document.querySelector('#verdict-text');
  if (result.remaining <= 0) {
    verdict.className = 'verdict is-done';
    label.textContent = 'Færdig';
    text.textContent = 'Alle estimerede timer i sprinten er brændt ned.';
    return;
  }
  if (!result.projectedEndDate) {
    verdict.className = 'verdict is-late';
    label.textContent = 'Ukendt tempo';
    text.textContent = 'Der er timer tilbage, men intet tempo at beregne en prognose ud fra.';
    return;
  }
  const daysLate = result.projectedEndDate > settings.endDate ? workDaysAfter(settings.endDate, result.projectedEndDate) : 0;
  if (daysLate > 0) {
    verdict.className = 'verdict is-late';
    label.textContent = `${daysLate} ${daysLate === 1 ? 'arbejdsdag' : 'arbejdsdage'} bagud`;
    text.textContent = `Med det nuværende tempo bliver sprinten færdig ${formatDate(result.projectedEndDate)} i stedet for ${formatDate(settings.endDate)}.`;
    return;
  }
  verdict.className = 'verdict is-on-track';
  label.textContent = 'På sporet';
  text.textContent = `Med det nuværende tempo bliver sprinten færdig ${formatDate(result.projectedEndDate)}, inden slutdatoen ${formatDate(settings.endDate)}.`;
}

function selectedSprint() {
  return sprintBoard.sprints.find((sprint) => sprint.id === selectedSprintId) ?? sprintBoard.sprints[0];
}

function sprintCards(sprint) {
  return cards.filter((card) => cardSprintId(card.time, sprintBoard) === sprint.id);
}

function sprintSubtitle(sprint) {
  const status = sprintStatus(sprint, today);
  if (status !== 'active') return `${formatSprintRange(sprint)} · ${STATUS_LABELS[status]}`;
  const left = workDayRange(addDays(today, 1), sprint.endDate).length;
  return `${formatSprintRange(sprint)} · ${left} ${left === 1 ? 'arbejdsdag' : 'arbejdsdage'} tilbage`;
}

function renderSprintSwitch() {
  const sprint = selectedSprint();
  const index = sprintBoard.sprints.indexOf(sprint);
  sprintTitle.textContent = sprint.name;
  document.querySelector('#sprint-sub').textContent = sprintSubtitle(sprint);
  document.querySelector('#sprint-prev').disabled = index <= 0;
  document.querySelector('#sprint-next').disabled = index >= sprintBoard.sprints.length - 1;
  sprintMenu.replaceChildren(...sprintBoard.sprints.map((option) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', String(option.id === sprint.id));
    const name = document.createElement('span');
    name.textContent = option.name;
    const detail = document.createElement('small');
    detail.textContent = sprintStatus(option, today) === 'active' ? 'nu' : formatSprintRange(option);
    item.append(name, detail);
    item.addEventListener('click', () => { setSprintMenu(false); showSprint(option.id); sprintTitle.focus?.(); });
    return item;
  }));
  document.querySelector('#sprint-rows').replaceChildren(...sprintBoard.sprints.map((option) => {
    const row = document.createElement('button');
    row.type = 'button';
    const status = sprintStatus(option, today);
    row.className = `sprint-row${status === 'active' ? ' is-active' : ''}`;
    const name = document.createElement('b');
    name.textContent = option.name;
    const dates = document.createElement('small');
    dates.textContent = `${formatDanishDate(option.startDate)} – ${formatDanishDate(option.endDate)}`;
    const label = document.createElement('span');
    label.textContent = STATUS_LABELS[status];
    row.append(name, dates, label);
    row.addEventListener('click', () => editSprint(option));
    return row;
  }));
}

function setSprintMenu(open) {
  sprintMenu.hidden = !open;
  sprintTitle.setAttribute('aria-expanded', String(open));
}

function showSprint(id) {
  selectedSprintId = id;
  renderSprintSwitch();
  const sprint = selectedSprint();
  render({ startDate: sprint.startDate, endDate: sprint.endDate }, preferences, sprintCards(sprint), sprint);
}

function editSprint(sprint) {
  editingSprint = sprint;
  document.querySelector('#sprint-name').value = sprint.name;
  document.querySelector('#sprint-tag').value = sprint.tag ?? '';
  for (const [field, date] of [['start-date', sprint.startDate], ['end-date', sprint.endDate]]) {
    document.getElementById(field).value = formatDanishDate(date);
    document.getElementById(`${field}-picker`).value = date;
  }
  const isNew = !sprintBoard.sprints.some((other) => other.id === sprint.id);
  document.querySelector('#delete-sprint').hidden = isNew || sprintBoard.sprints.length <= 1;
  document.querySelector('#dashboard-error').hidden = true;
  sprintForm.hidden = false;
  checkSprintForm();
  document.querySelector('#sprint-name').focus?.();
}

function closeSprintForm() {
  editingSprint = null;
  sprintForm.hidden = true;
}

async function saveSprintBoard(next, failMessage) {
  const error = document.querySelector('#dashboard-error');
  try {
    await t.set('board', 'shared', BOARD_SETTINGS_KEY, next);
  } catch (reason) {
    error.textContent = failMessage;
    error.hidden = false;
    console.error(reason);
    return false;
  }
  sprintBoard = next;
  return true;
}

function render(settings, preferences, sprintCardList, sprint) {
  const result = buildBurndown(sprintCardList, settings, today, preferences);
  currentBurndown = { ...result, ...settings, name: sprint.name };
  document.querySelector('#loading').hidden = true;
  if (!result.tracked.length) {
    document.querySelector('#dashboard-content').hidden = true;
    document.querySelector('#empty-state').hidden = false;
    document.querySelector('#empty-title').textContent = `${sprint.name} har ingen timer endnu`;
    return;
  }
  document.querySelector('#empty-state').hidden = true;
  document.querySelector('#dashboard-content').hidden = false;
  const missingActualCount = result.tracked.filter((card) => needsActualTime(card)).length;
  renderVerdict(result, settings);
  document.querySelector('#remaining-hours').textContent = formatHours(result.remaining);
  document.querySelector('#remaining-total').textContent = `af ${formatHours(result.totalEstimate)} ved sprintstart`;
  document.querySelector('#completed-count').textContent = `${result.completedCount} / ${result.tracked.length}`;
  document.querySelector('#completed-note').textContent = missingActualCount
    ? `${missingActualCount} mangler faktisk tid`
    : `${result.tracked.length - result.completedCount} åbne`;
  document.querySelector('#completed-note').className = missingActualCount ? 'metric-warning' : '';
  const variance = result.variance;
  document.querySelector('#variance').textContent = `${variance > 0 ? '+' : ''}${formatHours(variance)}`;
  document.querySelector('#variance').className = variance > 0 ? 'metric-warning' : '';
  document.querySelector('#velocity').textContent = result.velocity === null ? '–' : `${formatHours(result.velocity)} / arbejdsdag`;
  document.querySelector('#efficiency').textContent = result.measuredEfficiency === null
    ? `${Math.round(result.plannedEfficiency * 100)}% (planlagt)`
    : `${Math.round(result.efficiency * 100)}%`;
  document.querySelector('#efficiency').className = result.measuredEfficiency !== null && result.efficiency < 1 ? 'metric-warning' : '';
  document.querySelector('#prognosis').textContent = result.projectedEndDate ? formatShortDate(result.projectedEndDate) : '–';
  document.querySelector('#prognosis').className = !result.projectedEndDate || result.projectedEndDate > settings.endDate ? 'metric-warning' : '';
  document.querySelector('#prognosis-note').textContent = `slutdato ${formatShortDate(settings.endDate)}`;
  document.querySelector('#date-range').textContent = `${formatDate(settings.startDate)} til ${formatDate(settings.endDate)} · ${workDayRange(settings.startDate, settings.endDate).length} arbejdsdage`;
  document.querySelector('#tracked-label').textContent = `${result.tracked.length} kort med estimat`;
  renderChart(document.querySelector('#chart'), result.points, result.totalEstimate, { today, endDate: settings.endDate });
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
  cards = await Promise.all(trelloCards.map(async (card) => {
    const stored = await t.get(card.id, 'shared', CARD_DATA_KEY, {});
    return { ...card, stored, time: normalizeTimeData(stored) };
  }));
  preferences = normalizePreferences(storedPreferences);
  const defaults = defaultSprintDates(new Date(), preferences.defaultSprintDays);
  sprintBoard = normalizeSprintBoard(storedSettings, defaults);
  try {
    showSprint(currentSprint(sprintBoard.sprints, today).id);
  } catch (reason) {
    const error = document.querySelector('#dashboard-error');
    error.textContent = 'Dashboardet kunne ikke vises. Kontrollér sprintdatoerne og prøv igen.';
    error.hidden = false;
    throw reason;
  }
  if (!demoMode && !hasSavedSprints(storedSettings)) {
    // Best effort: a member who may not edit the board just sees the suggested sprint.
    try { await t.set('board', 'shared', BOARD_SETTINGS_KEY, sprintBoard); } catch { /* read-only */ }
  }
  offerWrapUp();
}

// When a sprint has ended with open cards, ask once what should happen to them.
const wrapUpDialog = document.querySelector('#wrap-up');
const wrapUpForm = document.querySelector('#wrap-up-form');
const skippedWrapUps = [];
let wrapUpSprint = null;
let wrapUpBusy = false;
let wrapUpHandled = false;

class WrapUpError extends Error {}

function offerWrapUp() {
  wrapUpSprint = sprintToWrapUp(cards, sprintBoard, today, skippedWrapUps);
  if (!wrapUpSprint || typeof wrapUpDialog?.showModal !== 'function') return;
  wrapUpHandled = false;
  const left = unfinishedCards(cards, wrapUpSprint, sprintBoard);
  const hours = left.reduce((sum, card) => sum + card.time.estimate, 0);
  const next = wrapUpTarget(sprintBoard.sprints, wrapUpSprint, today);
  document.querySelector('#wrap-up-title').textContent = `${wrapUpSprint.name} er slut`;
  document.querySelector('#wrap-up-summary').textContent = `${left.length} kort med i alt ${formatHours(hours)} blev ikke færdige.`;
  document.querySelector('#wrap-up-cards').replaceChildren(...left.map((card) => {
    const item = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = card.name;
    const estimate = document.createElement('span');
    estimate.textContent = formatHours(card.time.estimate);
    item.append(name, estimate);
    return item;
  }));
  document.querySelector('#wrap-up-next').textContent = next ? `Flyt til ${next.name}` : 'Flyt til en ny sprint';
  document.querySelector('#wrap-up-stay').textContent = `${wrapUpSprint.name}s graf ender over nul`;
  document.querySelector('#wrap-up-error').hidden = true;
  wrapUpForm.querySelector('input[value="next"]').checked = true;
  wrapUpDialog.showModal();
}

async function saveBoard(board, message) {
  try {
    await t.set('board', 'shared', BOARD_SETTINGS_KEY, board);
  } catch (reason) {
    throw new WrapUpError(message, { cause: reason });
  }
  sprintBoard = board;
}

async function targetSprintId(sprint) {
  const existing = wrapUpTarget(sprintBoard.sprints, sprint, today);
  if (existing) return existing.id;
  const draft = nextSprintDraft(sprintBoard.sprints, today, preferences.defaultSprintDays);
  const problem = sprintError(draft, sprintBoard.sprints);
  if (problem) throw new WrapUpError(`Der kunne ikke oprettes en ny sprint: ${problem}`);
  const board = normalizeSprintBoard({ ...sprintBoard, sprints: [...sprintBoard.sprints, draft] });
  if (!board.sprints.some((other) => other.id === draft.id)) throw new WrapUpError('Der kunne ikke oprettes en ny sprint.');
  // Save the new sprint before any card points at it.
  await saveBoard(board, 'Den nye sprint kunne ikke gemmes. Prøv igen.');
  renderSprintSwitch();
  return draft.id;
}

async function moveCard(card, sprintId, targetId) {
  try {
    // Read the card again, so a teammate's change since the dashboard opened is not overwritten.
    const latest = await t.get(card.id, 'shared', CARD_DATA_KEY, {});
    const time = normalizeTimeData(latest);
    const stored = time.completedAt || cardSprintId(time, sprintBoard) !== sprintId ? latest : { ...latest, sprintId: targetId };
    if (stored !== latest) await t.set(card.id, 'shared', CARD_DATA_KEY, stored);
    card.stored = stored;
    card.time = normalizeTimeData(stored);
  } catch (reason) {
    throw new WrapUpError('Nogle kort kunne ikke flyttes. Prøv igen.', { cause: reason });
  }
}

// A deleted sprint's id can be handed out again, so its cards must stop pointing at it.
async function sendToBacklog(card, sprintId) {
  const latest = await t.get(card.id, 'shared', CARD_DATA_KEY, {});
  const stored = normalizeTimeData(latest).sprintId === sprintId ? { ...latest, sprintId: null } : latest;
  if (stored !== latest) await t.set(card.id, 'shared', CARD_DATA_KEY, stored);
  card.stored = stored;
  card.time = normalizeTimeData(stored);
}

async function wrapUp(choice) {
  const sprint = wrapUpSprint;
  const left = unfinishedCards(cards, sprint, sprintBoard);
  const targetId = choice === 'next' ? await targetSprintId(sprint) : null;
  if (choice !== 'stay') await Promise.all(left.map((card) => moveCard(card, sprint.id, targetId)));
  await saveBoard(setSprintClosed(sprintBoard, sprint.id, true), 'Valget kunne ikke gemmes, så du bliver spurgt igen næste gang.');
  return targetId;
}

function setWrapUpBusy(busy) {
  wrapUpBusy = busy;
  document.querySelector('#wrap-up-submit').disabled = busy;
  document.querySelector('#wrap-up-later').disabled = busy;
}

function redraw(id) {
  try {
    showSprint(id);
  } catch (reason) {
    const error = document.querySelector('#dashboard-error');
    error.textContent = 'Dashboardet kunne ikke vises. Genåbn dashboardet og prøv igen.';
    error.hidden = false;
    console.error(reason);
  }
}

wrapUpForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (wrapUpBusy) return;
  const choice = wrapUpForm.querySelector('input[name="wrap-up-choice"]:checked')?.value ?? 'stay';
  setWrapUpBusy(true);
  let targetId;
  try {
    targetId = await wrapUp(choice);
  } catch (reason) {
    const error = document.querySelector('#wrap-up-error');
    error.textContent = reason instanceof WrapUpError ? reason.message : 'Noget gik galt. Prøv igen.';
    error.hidden = false;
    console.error(reason);
    redraw(selectedSprintId);
    return;
  } finally {
    setWrapUpBusy(false);
  }
  wrapUpHandled = true;
  redraw(targetId ?? selectedSprintId);
  wrapUpDialog.close();
});

// Escape works like "Senere", but not while a choice is being saved.
wrapUpDialog?.addEventListener('cancel', (event) => { if (wrapUpBusy) event.preventDefault(); });
document.querySelector('#wrap-up-later')?.addEventListener('click', () => wrapUpDialog.close());
// Every way of closing ends here: skip the sprint unless it was dealt with, then ask about the next one.
wrapUpDialog?.addEventListener('close', () => {
  if (wrapUpSprint && !wrapUpHandled) skippedWrapUps.push(wrapUpSprint.id);
  offerWrapUp();
});

settingsToggle.addEventListener('click', () => {
  settingsPanel.hidden = !settingsPanel.hidden;
  settingsToggle.setAttribute('aria-expanded', String(!settingsPanel.hidden));
});

document.querySelector('#export-csv').addEventListener('click', downloadCsv);

sprintTitle.addEventListener('click', () => setSprintMenu(sprintMenu.hidden));
// Keep focus inside the switch while picking, so focusout does not close the menu first.
sprintMenu.addEventListener('mousedown', (event) => event.preventDefault());
sprintSwitch.addEventListener('focusout', (event) => {
  if (!sprintSwitch.contains?.(event.relatedTarget)) setSprintMenu(false);
});
sprintSwitch.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || sprintMenu.hidden) return;
  setSprintMenu(false);
  sprintTitle.focus();
});
for (const [id, step] of [['#sprint-prev', -1], ['#sprint-next', 1]]) {
  document.querySelector(id).addEventListener('click', () => {
    const index = sprintBoard.sprints.indexOf(selectedSprint()) + step;
    if (sprintBoard.sprints[index]) showSprint(sprintBoard.sprints[index].id);
  });
}

document.querySelector('#add-sprint').addEventListener('click', () => {
  editSprint(nextSprintDraft(sprintBoard.sprints, today, preferences.defaultSprintDays));
});
document.querySelector('#cancel-sprint').addEventListener('click', closeSprintForm);
document.querySelector('#delete-sprint').addEventListener('click', async () => {
  if (!editingSprint || sprintBoard.sprints.length <= 1) return;
  const cardCount = sprintCards(editingSprint).length;
  const warning = cardCount ? ` ${cardCount} kort flyttes til backlog.` : '';
  if (!window.confirm(`Slet ${editingSprint.name}?${warning}`)) return;
  const removedId = editingSprint.id;
  try {
    await Promise.all(cards.filter((card) => card.time.sprintId === removedId).map((card) => sendToBacklog(card, removedId)));
  } catch (reason) {
    const error = document.querySelector('#dashboard-error');
    error.textContent = 'Sprinten kunne ikke slettes. Prøv igen.';
    error.hidden = false;
    console.error(reason);
    return;
  }
  // Normalizing also drops the deleted sprint from the legacy and closed lists.
  const next = normalizeSprintBoard({ ...sprintBoard, sprints: sprintBoard.sprints.filter((sprint) => sprint.id !== removedId) });
  if (!await saveSprintBoard(next, 'Sprinten kunne ikke slettes. Prøv igen.')) return;
  closeSprintForm();
  showSprint(selectedSprintId === removedId ? currentSprint(sprintBoard.sprints, today).id : selectedSprintId);
});

sprintForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!editingSprint) return;
  const sprint = sprintFromForm();
  const error = document.querySelector('#dashboard-error');
  if (checkSprintForm()) return;
  error.hidden = true;
  const others = sprintBoard.sprints.filter((other) => other.id !== sprint.id);
  // A sprint moved back into the present has not ended, so it may be asked about again later.
  const board = sprint.endDate >= today ? setSprintClosed(sprintBoard, sprint.id, false) : sprintBoard;
  const next = normalizeSprintBoard({ ...board, sprints: [...others, sprint] });
  if (!await saveSprintBoard(next, 'Sprinten kunne ikke gemmes. Prøv igen.')) return;
  closeSprintForm();
  try {
    showSprint(sprint.id);
  } catch (reason) {
    error.textContent = 'Sprinten blev gemt, men dashboardet kunne ikke vises. Genåbn dashboardet og prøv igen.';
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
