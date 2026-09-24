export const CARD_DATA_KEY = 'sprintlineTime';
export const BOARD_SETTINGS_KEY = 'sprintlineSettings';
export const BOARD_PREFERENCES_KEY = 'sprintlinePreferences';

export const DEFAULT_PREFERENCES = Object.freeze({
  activeColor: 'blue',
  completedColor: 'green',
  warningColor: 'red',
  defaultEstimate: null,
  copyEstimateToActual: true,
  showCardFrontBadges: true,
  remindMissingEstimate: false,
  warnOverEstimate: true,
  defaultSprintDays: 14,
});

const BADGE_COLORS = new Set(['blue', 'green', 'orange', 'red', 'yellow', 'purple', 'pink', 'sky', 'lime', 'light-gray']);

export function normalizePreferences(value = {}) {
  const sprintDays = Number(value.defaultSprintDays);
  return {
    activeColor: BADGE_COLORS.has(value.activeColor) ? value.activeColor : DEFAULT_PREFERENCES.activeColor,
    completedColor: BADGE_COLORS.has(value.completedColor) ? value.completedColor : DEFAULT_PREFERENCES.completedColor,
    warningColor: BADGE_COLORS.has(value.warningColor) ? value.warningColor : DEFAULT_PREFERENCES.warningColor,
    defaultEstimate: positiveNumber(value.defaultEstimate),
    copyEstimateToActual: value.copyEstimateToActual !== false,
    showCardFrontBadges: value.showCardFrontBadges !== false,
    remindMissingEstimate: value.remindMissingEstimate === true,
    warnOverEstimate: value.warnOverEstimate !== false,
    defaultSprintDays: Number.isInteger(sprintDays) && sprintDays >= 1 && sprintDays <= 90 ? sprintDays : DEFAULT_PREFERENCES.defaultSprintDays,
  };
}

export function normalizeTimeData(value = {}) {
  const estimate = positiveNumber(value.estimate);
  const actual = positiveNumber(value.actual);
  const completedAt = validDate(value.completedAt) ? value.completedAt.slice(0, 10) : null;
  return {
    estimate,
    actual: completedAt ? actual : null,
    completedAt,
  };
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) && !Number.isNaN(new Date(`${value.slice(0, 10)}T12:00:00`).getTime());
}

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dateRange(start, end) {
  if (!validDate(start) || !validDate(end) || start > end) return [];
  const days = [];
  const cursor = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  while (cursor <= last && days.length < 367) {
    days.push(localDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function defaultSprintDates(today = new Date(), durationDays = DEFAULT_PREFERENCES.defaultSprintDays) {
  const start = new Date(today);
  const end = new Date(today);
  end.setDate(end.getDate() + Math.max(1, durationDays) - 1);
  return { startDate: localDateKey(start), endDate: localDateKey(end) };
}

export function buildBurndown(cards, settings, todayKey = localDateKey()) {
  const tracked = cards.filter((card) => card.time?.estimate);
  const totalEstimate = tracked.reduce((sum, card) => sum + card.time.estimate, 0);
  const days = dateRange(settings.startDate, settings.endDate);
  const lastActualDay = todayKey < settings.endDate ? todayKey : settings.endDate;
  const points = days.map((date, index) => {
    const burned = tracked
      .filter((card) => card.time.completedAt && card.time.completedAt <= date)
      .reduce((sum, card) => sum + card.time.estimate, 0);
    return {
      date,
      ideal: days.length <= 1 ? 0 : totalEstimate * (1 - index / (days.length - 1)),
      actual: date <= lastActualDay ? Math.max(0, totalEstimate - burned) : null,
    };
  });
  const completed = tracked.filter((card) => card.time.completedAt);
  const totalActual = completed.reduce((sum, card) => sum + (card.time.actual || 0), 0);
  const completedEstimate = completed.reduce((sum, card) => sum + card.time.estimate, 0);
  return {
    tracked,
    points,
    totalEstimate,
    remaining: Math.max(0, totalEstimate - completedEstimate),
    completedCount: completed.length,
    variance: totalActual - completedEstimate,
  };
}

export function buildBurndownCsv(points) {
  const rows = [
    ['Dato', 'Ideelle resterende timer', 'Faktiske resterende timer'],
    ...points.map((point) => [point.date, point.ideal, point.actual ?? '']),
  ];
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

function csvCell(value) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function formatHours(value) {
  const rounded = Math.round(value * 10) / 10;
  return `${new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 }).format(rounded)} t`;
}

export function needsActualTime(card) {
  return Boolean(card.dueComplete && !card.time?.completedAt);
}
