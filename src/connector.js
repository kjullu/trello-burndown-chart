import { BOARD_PREFERENCES_KEY, CARD_DATA_KEY, formatHours, needsActualTime, normalizePreferences, normalizeTimeData } from './model.js';

const icon = new URL('./icon.png?v=2', window.location.href).href;

window.TrelloPowerUp.initialize({
  'card-buttons': () => [{
    icon,
    text: 'Tid & afslutning',
    condition: 'edit',
    callback: (t) => t.popup({ title: 'Registrér faktisk tid', url: './card.html?v=3', height: 350 }),
  }],
  'card-badges': async (t) => {
    const [stored, card, storedPreferences] = await Promise.all([
      t.get('card', 'shared', CARD_DATA_KEY, {}),
      t.card('dueComplete'),
      t.get('board', 'shared', BOARD_PREFERENCES_KEY, {}),
    ]);
    const data = normalizeTimeData(stored);
    const preferences = normalizePreferences(storedPreferences);
    if (!preferences.showCardFrontBadges) return [];
    if (!data.estimate && preferences.remindMissingEstimate) {
      return [{ icon, text: 'Mangler estimat', color: preferences.warningColor, monochrome: false }];
    }
    if (needsActualTime({ ...card, time: data })) {
      return [{ icon, text: 'Mangler faktisk tid', color: preferences.warningColor, monochrome: false }];
    }
    if (!data.estimate) return [];
    return [{
      icon,
      text: data.completedAt ? `${formatHours(data.actual)} / ${formatHours(data.estimate)}` : formatHours(data.estimate),
      monochrome: false,
      color: data.completedAt
        ? preferences.warnOverEstimate && data.actual > data.estimate ? preferences.warningColor : preferences.completedColor
        : preferences.activeColor,
    }];
  },
  'card-detail-badges': async (t) => {
    const [stored, card, storedPreferences] = await Promise.all([
      t.get('card', 'shared', CARD_DATA_KEY, {}),
      t.card('dueComplete'),
      t.get('board', 'shared', BOARD_PREFERENCES_KEY, {}),
    ]);
    const data = normalizeTimeData(stored);
    const preferences = normalizePreferences(storedPreferences);
    if (needsActualTime({ ...card, time: data })) {
      return [{
        title: 'Tid',
        text: data.estimate ? `Mangler faktisk tid · ${formatHours(data.estimate)} estimeret` : 'Mangler tidsregistrering',
        color: preferences.warningColor,
        callback: (context) => context.popup({ title: 'Registrér faktisk tid', url: './card.html?v=3', height: 350 }),
      }];
    }
    if (!data.estimate) {
      return [{
        title: 'Tid',
        text: 'Tilføj estimat',
        color: 'light-gray',
        callback: (context) => context.popup({ title: 'Registrér faktisk tid', url: './card.html?v=3', height: 350 }),
      }];
    }
    return [{
      title: 'Tid',
      text: data.completedAt ? `${formatHours(data.actual)} faktisk · ${formatHours(data.estimate)} estimeret` : `${formatHours(data.estimate)} estimeret`,
      color: data.completedAt
        ? preferences.warnOverEstimate && data.actual > data.estimate ? preferences.warningColor : preferences.completedColor
        : preferences.activeColor,
      callback: (context) => context.popup({ title: 'Registrér faktisk tid', url: './card.html?v=3', height: 350 }),
    }];
  },
  'board-buttons': () => [{
    icon: { dark: icon, light: icon },
    text: 'Burndown',
    callback: (t) => t.modal({ url: './dashboard.html', title: 'Sprintline', fullscreen: true, accentColor: '#0C66E4' }),
  }],
  'show-settings': (t) => t.popup({
    title: 'Sprintline-indstillinger',
    url: './settings.html?v=1',
    height: 650,
  }),
});
