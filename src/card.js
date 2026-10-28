import { BOARD_PREFERENCES_KEY, CARD_DATA_KEY, DEFAULT_PREFERENCES, backfillEstimate, localDateKey, normalizePreferences, normalizeTimeData, recordEstimateChange } from './model.js';

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
const estimatePresets = document.querySelector('#estimate-presets');
const actualPresets = document.querySelector('#actual-presets');
const bars = document.querySelector('#time-bars');
const ACTUAL_MULTIPLIERS = [0.5, 0.75, 1, 1.5, 2];
let preferences = DEFAULT_PREFERENCES;
let storedEstimate = null;
let storedHistory = [];

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
  const [card, stored, storedPreferences] = await Promise.all([
    t.card('dueComplete'),
    t.get('card', 'shared', CARD_DATA_KEY, {}),
    t.get('board', 'shared', BOARD_PREFERENCES_KEY, {}),
  ]);
  const data = normalizeTimeData(stored);
  preferences = normalizePreferences(storedPreferences);
  storedEstimate = data.estimate;
  storedHistory = data.estimateHistory;
  ignored.checked = Boolean(data.estimateIgnored);
  estimate.value = data.estimate || (ignored.checked ? '' : preferences.defaultEstimate) || '';
  completed.checked = Boolean(data.completedAt || card.dueComplete);
  actual.value = data.actual || (preferences.copyEstimateToActual && completed.checked ? data.estimate || preferences.defaultEstimate : '') || '';
  completedAt.value = data.completedAt || localDateKey();
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
completedDate.addEventListener('click', (event) => {
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
  const history = recordEstimateChange(storedHistory, savedOn, estimate.value);
  const data = normalizeTimeData({
    estimate: estimate.value,
    actual: completed.checked ? actual.value : null,
    completedAt: completed.checked ? completedAt.value : null,
    estimateIgnored: ignored.checked,
    estimateHistory: completed.checked ? backfillEstimate(history, completedAt.value, estimate.value) : history,
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
