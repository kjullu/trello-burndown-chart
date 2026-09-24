import { CARD_DATA_KEY, localDateKey, normalizeTimeData } from './model.js';

const t = window.TrelloPowerUp.iframe();
const form = document.querySelector('#time-form');
const completed = document.querySelector('#completed');
const fields = document.querySelector('#actual-fields');
const estimate = document.querySelector('#estimate');
const actual = document.querySelector('#actual');
const completedAt = document.querySelector('#completed-at');
const error = document.querySelector('#form-error');

function showCompletionFields() {
  fields.hidden = !completed.checked;
  actual.required = completed.checked;
  completedAt.required = completed.checked;
  if (completed.checked && !actual.value && estimate.value) {
    actual.value = estimate.value;
  }
  t.sizeTo('body');
}

async function initialize() {
  const [card, stored] = await Promise.all([
    t.card('name', 'dueComplete'),
    t.get('card', 'shared', CARD_DATA_KEY, {}),
  ]);
  const data = normalizeTimeData(stored);
  document.querySelector('#card-title').textContent = card.name;
  estimate.value = data.estimate || '';
  completed.checked = Boolean(data.completedAt || card.dueComplete);
  actual.value = data.actual || (completed.checked ? data.estimate : '') || '';
  completedAt.value = data.completedAt || localDateKey();
  showCompletionFields();
}

completed.addEventListener('change', showCompletionFields);
document.querySelector('#cancel').addEventListener('click', () => t.closePopup());
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  error.hidden = true;
  const data = normalizeTimeData({
    estimate: estimate.value,
    actual: completed.checked ? actual.value : null,
    completedAt: completed.checked ? completedAt.value : null,
  });
  if (!data.estimate || (completed.checked && (!data.actual || !data.completedAt))) {
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
