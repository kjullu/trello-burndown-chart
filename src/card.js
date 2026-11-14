import { BOARD_PREFERENCES_KEY, BOARD_SETTINGS_KEY, CARD_DATA_KEY, DEFAULT_PREFERENCES, backfillEstimate, cardSprintId, currentSprint, defaultSprintDates, formatSprintRange, hasSavedSprints, localDateKey, normalizeSprintBoard, sprintStatus, normalizePreferences, normalizeTimeData, setEstimateFrom } from './model.js';

const t = window.TrelloPowerUp.iframe();
const form = document.querySelector('#time-form');
const completed = document.querySelector('#completed');
const fields = document.querySelector('#actual-fields');
const estimate = document.querySelector('#estimate');
const actual = document.querySelector('#actual');
const completedAt = document.querySelector('#completed-at');
const ignorePanel = document.querySelector('#ignore-panel');
const ignored = document.querySelector('#estimate-ignored');
const error = document.querySelector('#form-error');
const completedRow = document.querySelector('#completed-row');
const completedDate = document.querySelector('#completed-date');
const completedDateText = document.querySelector('#completed-date-text');
const estimateDate = document.querySelector('#estimate-date');
const estimateDateText = document.querySelector('#estimate-date-text');
const estimatePresets = document.querySelector('#estimate-presets');
const actualPresets = document.querySelector('#actual-presets');
const bars = document.querySelector('#time-bars');
const ACTUAL_MULTIPLIERS = [0.5, 0.75, 1, 1.5, 2];
let preferences = DEFAULT_PREFERENCES;
let storedEstimate = null;
let storedHistory = [];
let sprintOptions = [];
let sprintIndex = 0;
let sprintListOpen = false;
let unsavedBoard = null;
const sprintTrack = document.querySelector('#sprint-track');
const sprintPeek = sprintTrack.parentElement;
const sprintListWrap = document.querySelector('#sprint-list-wrap');
const sprintList = document.querySelector('#sprint-list');
const sprintPrev = document.querySelector('#sprint-prev');
const sprintNext = document.querySelector('#sprint-next');

function sprintDetail(option) {
  if (!option.sprint) return 'ingen sprint';
  return option.active ? `nu · ${formatSprintRange(option.sprint)}` : formatSprintRange(option.sprint);
}

function buildSprintPicker(board, selectedId, todayKey) {
  sprintOptions = [{ id: null, name: 'Backlog', sprint: null, active: false }, ...board.sprints.map((sprint) => ({
    id: sprint.id, name: sprint.name, sprint, active: sprintStatus(sprint, todayKey) === 'active',
  }))];
  sprintIndex = Math.max(0, sprintOptions.findIndex((option) => option.id === selectedId));
  sprintTrack.replaceChildren(...sprintOptions.map((option, index) => {
    const slide = document.createElement('button');
    slide.type = 'button';
    slide.className = `sprint-slide${option.active ? ' is-active' : ''}`;
    const name = document.createElement('b');
    name.textContent = option.name;
    const detail = document.createElement('small');
    detail.textContent = sprintDetail(option);
    slide.append(name, detail);
    slide.addEventListener('click', () => {
      if (index === sprintIndex) setSprintList(!sprintListOpen);
      else selectSprint(index);
    });
    return slide;
  }));
  sprintList.replaceChildren(...sprintOptions.map((option, index) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.setAttribute('role', 'option');
    const name = document.createElement('span');
    name.textContent = option.name;
    const detail = document.createElement('small');
    detail.textContent = option.active ? 'nu' : option.sprint ? formatSprintRange(option.sprint) : '';
    item.append(name, detail);
    item.addEventListener('click', () => { selectSprint(index); setSprintList(false); });
    return item;
  }));
  renderSprintPicker();
}

function selectSprint(index) {
  sprintIndex = Math.max(0, Math.min(sprintOptions.length - 1, index));
  renderSprintPicker();
  limitCompletionDate();
}

// Keep both dates inside the chosen sprint, so the card adds and burns down in that sprint.
function limitCompletionDate() {
  const sprint = sprintOptions[sprintIndex]?.sprint;
  const today = localDateKey();
  const max = sprint && sprint.endDate < today ? sprint.endDate : today;
  for (const input of [completedAt, estimateDate]) {
    input.min = sprint ? sprint.startDate : '';
    input.max = max;
    if (input.value > max) input.value = max;
    if (input.min && input.value && input.value < input.min) input.value = input.min;
  }
  renderTime();
}

function setSprintList(open) {
  sprintListOpen = open;
  sprintListWrap.classList.toggle('open', open);
  sprintListWrap.inert = !open;
  renderSprintPicker();
}

function renderSprintPicker() {
  const width = sprintPeek.clientWidth;
  const slideWidth = width * 0.56;
  [...sprintTrack.children].forEach((slide, index) => {
    const current = index === sprintIndex;
    slide.style.width = `${slideWidth}px`;
    slide.classList.toggle('current', current);
    slide.tabIndex = current ? 0 : -1;
    if (current) slide.setAttribute('aria-expanded', String(sprintListOpen));
    else slide.removeAttribute('aria-expanded');
  });
  sprintTrack.style.transform = `translateX(${width / 2 - slideWidth / 2 - sprintIndex * slideWidth}px)`;
  [...sprintList.children].forEach((item, index) => item.setAttribute('aria-selected', String(index === sprintIndex)));
  sprintPrev.disabled = sprintIndex === 0;
  sprintNext.disabled = sprintIndex === sprintOptions.length - 1;
}

sprintPrev.addEventListener('click', () => selectSprint(sprintIndex - 1));
sprintNext.addEventListener('click', () => selectSprint(sprintIndex + 1));
document.querySelector('.sprint-stepper').addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') selectSprint(sprintIndex - 1);
  else if (event.key === 'ArrowRight') selectSprint(sprintIndex + 1);
  else if (event.key === 'Escape' && sprintListOpen) setSprintList(false);
  else return;
  event.preventDefault();
  event.stopPropagation();
});
new ResizeObserver(() => renderSprintPicker()).observe(sprintPeek);

const hours = (value) => {
  const number = Number.parseFloat(String(value).replace(',', '.'));
  return number > 0 ? number : null;
};
const formatHours = (value) => String(Number(value.toFixed(2))).replace('.', ',');
const prettyDate = (value) => (value ? new Date(`${value}T12:00`).toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' }) : 'vælg dato');

function renderTime() {
  const estimateHours = hours(estimate.value);
  const actualHours = hours(actual.value);
  for (const button of estimatePresets.children) button.classList.toggle('active', hours(button.dataset.value) === estimateHours);

  const values = estimateHours ? [...new Set(ACTUAL_MULTIPLIERS.map((m) => Math.max(0.25, Math.round(estimateHours * m * 4) / 4)))] : [];
  actualPresets.replaceChildren(...values.map((value) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.value = value;
    button.textContent = formatHours(value);
    button.classList.toggle('active', value === actualHours);
    return button;
  }));
  actualPresets.hidden = values.length === 0;

  bars.hidden = !(estimateHours && actualHours);
  if (!bars.hidden) {
    const max = Math.max(estimateHours, actualHours);
    document.querySelector('#estimate-bar').style.width = `${(estimateHours / max) * 100}%`;
    document.querySelector('#actual-bar').style.width = `${(actualHours / max) * 100}%`;
    document.querySelector('#actual-bar-track').classList.toggle('over', actualHours > estimateHours);
    document.querySelector('#time-summary').textContent = `Estimat ${formatHours(estimateHours)} t · Faktisk ${formatHours(actualHours)} t`;
    const delta = document.querySelector('#time-delta');
    const difference = actualHours - estimateHours;
    delta.className = Math.abs(difference) < 0.01 ? '' : difference > 0 ? 'over' : 'under';
    delta.textContent = Math.abs(difference) < 0.01 ? 'Præcis som estimeret' : `${formatHours(Math.abs(difference))} t ${difference > 0 ? 'over' : 'under'}`;
  }
  completedDateText.textContent = prettyDate(completedAt.value);
  estimateDateText.textContent = estimateDate.value === localDateKey() ? 'i dag' : prettyDate(estimateDate.value);
}

function showCompletionFields() {
  fields.classList.toggle('open', completed.checked);
  fields.inert = !completed.checked;
  completedRow.classList.toggle('on', completed.checked);
  completedDate.hidden = !completed.checked;
  actual.required = completed.checked;
  completedAt.required = completed.checked;
  if (preferences.copyEstimateToActual && completed.checked && !actual.value && estimate.value) {
    actual.value = estimate.value;
  }
  renderTime();
}

async function initialize() {
  const [card, stored, storedPreferences, storedSprints] = await Promise.all([
    t.card('dueComplete'),
    t.get('card', 'shared', CARD_DATA_KEY, {}),
    t.get('board', 'shared', BOARD_PREFERENCES_KEY, {}),
    t.get('board', 'shared', BOARD_SETTINGS_KEY, null),
  ]);
  const data = normalizeTimeData(stored);
  preferences = normalizePreferences(storedPreferences);
  const today = localDateKey();
  const board = normalizeSprintBoard(storedSprints, defaultSprintDates(new Date(), preferences.defaultSprintDays));
  unsavedBoard = hasSavedSprints(storedSprints) ? null : board;
  // A card that was never registered starts in the sprint running now.
  const hasTime = Boolean(data.estimate || data.completedAt || data.estimateIgnored);
  const selectedId = data.sprintId !== undefined || hasTime ? cardSprintId(data, board) : currentSprint(board.sprints, today)?.id ?? null;
  buildSprintPicker(board, selectedId, today);
  storedEstimate = data.estimate;
  storedHistory = data.estimateHistory;
  ignored.checked = Boolean(data.estimateIgnored);
  estimate.value = data.estimate || (ignored.checked ? '' : preferences.defaultEstimate) || '';
  completed.checked = Boolean(data.completedAt || card.dueComplete);
  actual.value = data.actual || (preferences.copyEstimateToActual && completed.checked ? data.estimate || preferences.defaultEstimate : '') || '';
  completedAt.value = data.completedAt || localDateKey();
  estimateDate.value = localDateKey();
  // New work on a sprint that already ended most likely belonged to it from the start.
  const chosen = sprintOptions[sprintIndex]?.sprint;
  if (chosen && chosen.endDate < estimateDate.value && !data.estimate) estimateDate.value = chosen.startDate;
  limitCompletionDate();
  syncIgnoreState();
  showCompletionFields();
}

function syncIgnoreState() {
  ignorePanel.hidden = !(preferences.remindMissingEstimate && !storedEstimate);
  estimate.required = !(!ignorePanel.hidden && ignored.checked);
  if (!ignorePanel.hidden && ignored.checked) estimate.value = '';
  renderTime();
}

let sizeFrame = 0;
new ResizeObserver(() => {
  cancelAnimationFrame(sizeFrame);
  sizeFrame = requestAnimationFrame(() => t.sizeTo('body'));
}).observe(document.body);

completed.addEventListener('change', showCompletionFields);
form.addEventListener('input', renderTime);
completedAt.addEventListener('change', renderTime);
estimateDate.addEventListener('change', renderTime);
document.querySelector('#estimate-date-toggle').addEventListener('click', (event) => {
  if (event.target === estimateDate) return;
  try { estimateDate.showPicker(); } catch { estimateDate.focus(); }
});
completedDate.addEventListener('click', (event) => {
  // A click on the hidden date input opens the native picker. showPicker() is blocked in Trello's cross-origin iframe.
  if (event.target === completedAt) return;
  event.preventDefault();
  try { completedAt.showPicker(); } catch { completedAt.focus(); }
});
form.addEventListener('click', (event) => {
  const step = event.target.closest('.step');
  if (step) {
    const input = document.getElementById(step.dataset.target);
    input.value = Math.max(0.5, (hours(input.value) || 0) + Number(step.dataset.step));
  }
  const preset = event.target.closest('.presets button');
  if (preset) (preset.parentElement === estimatePresets ? estimate : actual).value = preset.dataset.value;
  if (!step && !preset) return;
  if (ignored.checked && (step?.dataset.target === 'estimate' || preset?.parentElement === estimatePresets)) {
    ignored.checked = false;
    syncIgnoreState();
  }
  renderTime();
});
ignored.addEventListener('change', () => {
  if (!ignored.checked) estimate.value = storedEstimate || preferences.defaultEstimate || '';
  syncIgnoreState();
});
document.querySelector('#cancel').addEventListener('click', () => t.closePopup());
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  error.hidden = true;
  const savedOn = localDateKey();
  const history = setEstimateFrom(storedHistory, estimateDate.value || savedOn, estimate.value);
  const data = normalizeTimeData({
    estimate: estimate.value,
    actual: completed.checked ? actual.value : null,
    completedAt: completed.checked ? completedAt.value : null,
    estimateIgnored: ignored.checked,
    estimateHistory: completed.checked ? backfillEstimate(history, completedAt.value, estimate.value) : history,
    sprintId: sprintOptions[sprintIndex]?.id ?? null,
  });
  if ((!data.estimate && !ignored.checked) || (completed.checked && (!data.actual || !data.completedAt))) {
    error.textContent = 'Udfyld estimatet og den faktiske tid med tal over 0.';
    error.hidden = false;
    return;
  }
  const save = document.querySelector('#save');
  save.disabled = true;
  save.textContent = 'Gemmer...';
  try {
    // Keep the suggested first sprint, so it does not start over tomorrow.
    if (unsavedBoard) await t.set('board', 'shared', BOARD_SETTINGS_KEY, unsavedBoard);
    await t.set('card', 'shared', CARD_DATA_KEY, data);
    await t.closePopup();
  } catch (reason) {
    error.textContent = 'Tiden kunne ikke gemmes. Prøv igen.';
    error.hidden = false;
    save.disabled = false;
    save.textContent = 'Gem tid';
    console.error(reason);
  }
});

initialize().catch((reason) => {
  error.textContent = 'Kortets data kunne ikke hentes.';
  error.hidden = false;
  console.error(reason);
});
