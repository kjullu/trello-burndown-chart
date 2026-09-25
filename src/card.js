import { BOARD_PREFERENCES_KEY, CARD_DATA_KEY, DEFAULT_PREFERENCES, localDateKey, normalizePreferences, normalizeTimeData } from './model.js';

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
let preferences = DEFAULT_PREFERENCES;
let storedEstimate = null;

function showCompletionFields() {
  fields.hidden = !completed.checked;
  actual.required = completed.checked;
  completedAt.required = completed.checked;
  if (preferences.copyEstimateToActual && completed.checked && !actual.value && estimate.value) {
    actual.value = estimate.value;
  }
  t.sizeTo('body');
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
  t.sizeTo('body');
}

completed.addEventListener('change', showCompletionFields);
ignored.addEventListener('change', () => {
  if (!ignored.checked) estimate.value = storedEstimate || preferences.defaultEstimate || '';
  syncIgnoreState();
});
document.querySelector('#cancel').addEventListener('click', () => t.closePopup());
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  error.hidden = true;
  const data = normalizeTimeData({
    estimate: estimate.value,
    actual: completed.checked ? actual.value : null,
    completedAt: completed.checked ? completedAt.value : null,
    estimateIgnored: ignored.checked,
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
