import { CARD_DATA_KEY, formatHours, needsActualTime, normalizeTimeData } from './model.js';

const icon = new URL('./icon.svg', window.location.href).href;

window.TrelloPowerUp.initialize({
  'card-buttons': () => [{
    icon,
    text: 'Tid & afslutning',
    condition: 'edit',
    callback: (t) => t.popup({ title: 'Tid på opgaven', url: './card.html?v=2', height: 470 }),
  }],
  'card-badges': async (t) => {
    const [stored, card] = await Promise.all([
      t.get('card', 'shared', CARD_DATA_KEY, {}),
      t.card('dueComplete'),
    ]);
    const data = normalizeTimeData(stored);
    if (needsActualTime({ ...card, time: data })) {
      return [{ icon, text: 'Mangler faktisk tid', color: 'red' }];
    }
    if (!data.estimate) return [];
    return [{
      icon,
      text: data.completedAt ? `${formatHours(data.actual)} / ${formatHours(data.estimate)}` : formatHours(data.estimate),
      color: data.completedAt ? 'green' : 'blue',
    }];
  },
  'card-detail-badges': async (t) => {
    const [stored, card] = await Promise.all([
      t.get('card', 'shared', CARD_DATA_KEY, {}),
      t.card('dueComplete'),
    ]);
    const data = normalizeTimeData(stored);
    if (needsActualTime({ ...card, time: data })) {
      return [{
        title: 'Tid',
        text: data.estimate ? `Mangler faktisk tid · ${formatHours(data.estimate)} estimeret` : 'Mangler tidsregistrering',
        color: 'red',
        callback: (context) => context.popup({ title: 'Registrér faktisk tid', url: './card.html?v=2', height: 470 }),
      }];
    }
    if (!data.estimate) {
      return [{
        title: 'Tid',
        text: 'Tilføj estimat',
        color: 'light-gray',
        callback: (context) => context.popup({ title: 'Tid på opgaven', url: './card.html?v=2', height: 470 }),
      }];
    }
    return [{
      title: 'Tid',
      text: data.completedAt ? `${formatHours(data.actual)} faktisk · ${formatHours(data.estimate)} estimeret` : `${formatHours(data.estimate)} estimeret`,
      color: data.completedAt ? 'green' : 'blue',
      callback: (context) => context.popup({ title: 'Tid på opgaven', url: './card.html?v=2', height: 470 }),
    }];
  },
  'board-buttons': () => [{
    icon: { dark: icon, light: icon },
    text: 'Burndown',
    callback: (t) => t.modal({ url: './dashboard.html', title: 'Sprintline', fullscreen: true, accentColor: '#0C66E4' }),
  }],
});
