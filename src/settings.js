import { BOARD_PREFERENCES_KEY, DEFAULT_PREFERENCES, normalizePreferences } from './model.js';

const t = window.TrelloPowerUp.iframe();
const form = document.querySelector('#preferences-form');
const error = document.querySelector('#settings-error');
const colorOptions = [
  ['blue', 'Blå'],
  ['green', 'Grøn'],
  ['orange', 'Orange'],
  ['red', 'Rød'],
  ['yellow', 'Gul'],
  ['purple', 'Lilla'],
  ['pink', 'Pink'],
  ['sky', 'Lyseblå'],
  ['lime', 'Lime'],
  ['light-gray', 'Grå'],
];

function populateColorSelect(select) {
  colorOptions.forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.append(option);
  });
}

['active-color', 'completed-color', 'warning-color'].forEach((id) => populateColorSelect(document.querySelector(`#${id}`)));

function render(preferences) {
  document.querySelector('#active-color').value = preferences.activeColor;
  document.querySelector('#completed-color').value = preferences.completedColor;
  document.querySelector('#warning-color').value = preferences.warningColor;
  document.querySelector('#default-estimate').value = preferences.defaultEstimate || '';
  document.querySelector('#sprint-days').value = preferences.defaultSprintDays;
  document.querySelector('#copy-estimate').checked = preferences.copyEstimateToActual;
  document.querySelector('#show-front-badges').checked = preferences.showCardFrontBadges;
  document.querySelector('#remind-missing-estimate').checked = preferences.remindMissingEstimate;
  document.querySelector('#warn-over-estimate').checked = preferences.warnOverEstimate;
  t.sizeTo('body');
}

function readForm() {
  return normalizePreferences({
    activeColor: document.querySelector('#active-color').value,
    completedColor: document.querySelector('#completed-color').value,
    warningColor: document.querySelector('#warning-color').value,
    defaultEstimate: document.querySelector('#default-estimate').value,
    defaultSprintDays: Number(document.querySelector('#sprint-days').value),
    copyEstimateToActual: document.querySelector('#copy-estimate').checked,
    showCardFrontBadges: document.querySelector('#show-front-badges').checked,
    remindMissingEstimate: document.querySelector('#remind-missing-estimate').checked,
    warnOverEstimate: document.querySelector('#warn-over-estimate').checked,
  });
}

document.querySelector('#reset').addEventListener('click', () => render(DEFAULT_PREFERENCES));

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  error.hidden = true;
  const save = document.querySelector('#save-settings');
  save.disabled = true;
  save.textContent = 'Gemmer...';
  try {
    await t.set('board', 'shared', BOARD_PREFERENCES_KEY, readForm());
    await t.closePopup();
  } catch (reason) {
    error.textContent = 'Indstillingerne kunne ikke gemmes. Prøv igen.';
    error.hidden = false;
    save.disabled = false;
    save.textContent = 'Gem indstillinger';
    console.error(reason);
  }
});

t.get('board', 'shared', BOARD_PREFERENCES_KEY, {})
  .then((stored) => render(normalizePreferences(stored)))
  .catch((reason) => {
    error.textContent = 'Indstillingerne kunne ikke hentes.';
    error.hidden = false;
    console.error(reason);
  });
