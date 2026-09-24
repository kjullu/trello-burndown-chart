export const CARD_DATA_KEY = 'sprintlineTime';
export const BOARD_SETTINGS_KEY = 'sprintlineSettings';

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

export function defaultSprintDates(today = new Date()) {
  const start = new Date(today);
  const end = new Date(today);
  start.setDate(start.getDate() - 3);
  end.setDate(end.getDate() + 10);
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

export function formatHours(value) {
  const rounded = Math.round(value * 10) / 10;
  return `${new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 }).format(rounded)} t`;
}

export function needsActualTime(card) {
  return Boolean(card.dueComplete && !card.time?.completedAt);
}
