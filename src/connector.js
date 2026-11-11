import { BOARD_PREFERENCES_KEY, BOARD_SETTINGS_KEY, CARD_DATA_KEY, cardSprintId, defaultSprintDates, formatHours, needsActualTime, normalizePreferences, normalizeSprintBoard, normalizeTimeData } from './model.js';

const icon = new URL('./icon.png?v=2', window.location.href).href;
const badgeIcons = {
  active: new URL('./badge-clock.svg', window.location.href).href,
  completed: new URL('./badge-check.svg', window.location.href).href,
  warning: new URL('./badge-warning.svg', window.location.href).href,
};

window.TrelloPowerUp.initialize({
  'card-buttons': () => [{
    icon,
    text: 'Tid & afslutning',
    condition: 'edit',
    callback: (t) => t.popup({ title: 'Registrér faktisk tid', url: './card.html?v=9', height: 350 }),
  }],
  'card-badges': async (t) => {
    const [stored, card, storedPreferences, storedSprints] = await Promise.all([
      t.get('card', 'shared', CARD_DATA_KEY, {}),
      t.card('dueComplete'),
      t.get('board', 'shared', BOARD_PREFERENCES_KEY, {}),
      t.get('board', 'shared', BOARD_SETTINGS_KEY, null),
    ]);
    const data = normalizeTimeData(stored);
    const preferences = normalizePreferences(storedPreferences);
    const board = normalizeSprintBoard(storedSprints, defaultSprintDates(new Date(), preferences.defaultSprintDays));
    const sprintId = cardSprintId(data, board);
    const tag = board.sprints.find((sprint) => sprint.id === sprintId)?.tag;
    const withTag = (text) => (tag ? `${tag} · ${text}` : text);
    if (!preferences.showCardFrontBadges) return [];
    if (!data.estimate && preferences.remindMissingEstimate && !data.estimateIgnored) {
      return [{ icon: badgeIcons.warning, text: 'Mangler estimat', color: preferences.warningColor, monochrome: true }];
    }
    if (needsActualTime({ ...card, time: data })) {
      return [{ icon: badgeIcons.warning, text: 'Mangler faktisk tid', color: preferences.warningColor, monochrome: true }];
    }
    if (!data.estimate) return [];
    return [{
      icon: data.completedAt ? badgeIcons.completed : badgeIcons.active,
      text: withTag(data.completedAt ? `${formatHours(data.actual)} / ${formatHours(data.estimate)}` : formatHours(data.estimate)),
      monochrome: true,
      color: data.completedAt ? preferences.completedColor : preferences.activeColor,
    }];
  },
  'card-detail-badges': async (t) => {
    const [stored, card, storedPreferences, storedSprints] = await Promise.all([
      t.get('card', 'shared', CARD_DATA_KEY, {}),
      t.card('dueComplete'),
      t.get('board', 'shared', BOARD_PREFERENCES_KEY, {}),
      t.get('board', 'shared', BOARD_SETTINGS_KEY, null),
    ]);
    const data = normalizeTimeData(stored);
    const preferences = normalizePreferences(storedPreferences);
    const board = normalizeSprintBoard(storedSprints, defaultSprintDates(new Date(), preferences.defaultSprintDays));
    const sprintId = cardSprintId(data, board);
    const tag = board.sprints.find((sprint) => sprint.id === sprintId)?.tag;
    const withTag = (text) => (tag ? `${tag} · ${text}` : text);
    if (needsActualTime({ ...card, time: data })) {
      return [{
        title: 'Tid',
        text: data.estimate ? `Mangler faktisk tid · ${formatHours(data.estimate)} estimeret` : 'Mangler tidsregistrering',
        color: preferences.warningColor,
        callback: (context) => context.popup({ title: 'Registrér faktisk tid', url: './card.html?v=9', height: 350 }),
      }];
    }
    if (!data.estimate) {
      return [{
        title: 'Tid',
        text: data.estimateIgnored ? 'Estimat ignoreret' : 'Tilføj estimat',
        color: 'light-gray',
        callback: (context) => context.popup({ title: 'Registrér faktisk tid', url: './card.html?v=9', height: 350 }),
      }];
    }
    return [{
      title: 'Tid',
      text: withTag(data.completedAt ? `${formatHours(data.actual)} faktisk · ${formatHours(data.estimate)} estimeret` : `${formatHours(data.estimate)} estimeret`),
      color: data.completedAt ? preferences.completedColor : preferences.activeColor,
      callback: (context) => context.popup({ title: 'Registrér faktisk tid', url: './card.html?v=9', height: 350 }),
    }];
  },
  'board-buttons': () => [{
    icon: { dark: icon, light: icon },
    text: 'Burndown',
    callback: (t) => t.modal({ url: './dashboard.html', title: 'Sprintline', fullscreen: true, accentColor: '#0C66E4' }),
  }],
  'show-settings': (t) => t.popup({
    title: 'Sprintline-indstillinger',
    url: './settings.html?v=4',
    height: 820,
  }),
});
