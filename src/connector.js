import { CARD_DATA_KEY, formatHours, normalizeTimeData } from './model.js';

const icon = new URL('/icon.svg', window.location.origin).href;

window.TrelloPowerUp.initialize({
  'card-buttons': () => [{
    icon,
    text: 'Tid & afslutning',
    condition: 'edit',
    callback: (t) => t.popup({ title: 'Tid på opgaven', url: './card.html', height: 386 }),
  }],
  'card-badges': async (t) => {
    const data = normalizeTimeData(await t.get('card', 'shared', CARD_DATA_KEY, {}));
    if (!data.estimate) return [];
    return [{
      icon,
      text: data.completedAt ? `${formatHours(data.actual)} / ${formatHours(data.estimate)}` : formatHours(data.estimate),
      color: data.completedAt ? 'green' : 'blue',
    }];
  },
  'card-detail-badges': async (t) => {
    const data = normalizeTimeData(await t.get('card', 'shared', CARD_DATA_KEY, {}));
    if (!data.estimate) return [];
    return [{
      title: 'Tid',
      text: data.completedAt ? `${formatHours(data.actual)} faktisk · ${formatHours(data.estimate)} estimeret` : `${formatHours(data.estimate)} estimeret`,
      color: data.completedAt ? 'green' : 'blue',
      callback: (context) => context.popup({ title: 'Tid på opgaven', url: './card.html', height: 386 }),
    }];
  },
  'board-buttons': () => [{
    icon: { dark: icon, light: icon },
    text: 'Burndown',
    callback: (t) => t.modal({ url: './dashboard.html', title: 'Sprintline', fullscreen: true, accentColor: '#0C66E4' }),
  }],
});
