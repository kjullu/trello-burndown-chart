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
  teamSize: 1,
  hoursPerDay: 8,
  efficiencyFactor: 1,
});

const BADGE_COLORS = new Set(['blue', 'green', 'orange', 'red', 'yellow', 'purple', 'pink', 'sky', 'lime', 'light-gray']);
const HISTORY_LIMIT = 60;

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
    teamSize: boundedNumber(value.teamSize, 1, 50) ?? DEFAULT_PREFERENCES.teamSize,
    hoursPerDay: boundedNumber(value.hoursPerDay, 1, 24) ?? DEFAULT_PREFERENCES.hoursPerDay,
    efficiencyFactor: boundedNumber(value.efficiencyFactor, 0.1, 3) ?? DEFAULT_PREFERENCES.efficiencyFactor,
  };
}

export function normalizeTimeData(value = {}) {
  const estimate = positiveNumber(value.estimate);
  const actual = positiveNumber(value.actual);
  const completedAt = validDate(value.completedAt) ? value.completedAt.slice(0, 10) : null;
  const estimateHistory = Array.isArray(value.estimateHistory)
    ? normalizeEstimateHistory(value.estimateHistory)
    : estimate ? [{ date: null, estimate }] : [];
  return {
    estimate,
    actual: completedAt ? actual : null,
    completedAt,
    estimateIgnored: estimate ? false : value.estimateIgnored === true,
    estimateHistory,
  };
}

function normalizeEstimateHistory(value) {
  const entries = [];
  value.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const rawDate = entry.date;
    let date = null;
    if (rawDate !== null && rawDate !== undefined) {
      if (!validDate(rawDate)) return;
      date = rawDate.slice(0, 10);
    }
    entries.push({ date, estimate: positiveNumber(entry.estimate) });
  });
  entries.sort((a, b) => {
    if (a.date === b.date) return 0;
    if (a.date === null) return -1;
    if (b.date === null) return 1;
    return a.date < b.date ? -1 : 1;
  });
  if (entries[0]?.estimate !== null) entries[0].date = null;
  const collapsed = [];
  entries.forEach((entry) => {
    const last = collapsed.at(-1);
    if (last && (last.estimate ?? null) === (entry.estimate ?? null)) return;
    collapsed.push(entry);
  });
  return collapsed.length > HISTORY_LIMIT ? [collapsed[0], ...collapsed.slice(-(HISTORY_LIMIT - 1))] : collapsed;
}

export function recordEstimateChange(history, dateKey, nextEstimate) {
  const entries = (Array.isArray(history) ? history : []).map((entry) => ({ date: entry.date, estimate: entry.estimate ?? null }));
  const estimate = positiveNumber(nextEstimate);
  if (entries.length === 0) return estimate === null ? [] : [{ date: null, estimate }];
  const last = entries.at(-1);
  if (last && last.date === dateKey) {
    entries[entries.length - 1] = { date: dateKey, estimate };
    return normalizeEstimateHistory(entries);
  }
  if (last && (last.estimate ?? null) === estimate) return normalizeEstimateHistory(entries);
  entries.push({ date: dateKey, estimate });
  return normalizeEstimateHistory(entries);
}

export function estimateAsOf(time, dateKey) {
  const history = time?.estimateHistory;
  if (!Array.isArray(history)) return positiveNumber(time?.estimate) ?? 0;
  let value = 0;
  history.forEach((entry) => {
    if (entry.date === null || entry.date <= dateKey) value = entry.estimate ?? 0;
  });
  return value;
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function boundedNumber(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
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

export function addDays(dateKey, days) {
  const cursor = new Date(`${dateKey}T12:00:00`);
  cursor.setDate(cursor.getDate() + days);
  return localDateKey(cursor);
}

function isWorkDay(dateKey) {
  const day = new Date(`${dateKey}T12:00:00`).getDay();
  return day !== 0 && day !== 6;
}

export function addWorkDays(dateKey, days) {
  let cursor = dateKey;
  let remaining = Math.max(0, Math.trunc(days));
  while (remaining > 0) {
    cursor = addDays(cursor, 1);
    if (isWorkDay(cursor)) remaining -= 1;
  }
  return cursor;
}

export function diffDays(fromKey, toKey) {
  const from = new Date(`${fromKey}T12:00:00`);
  const to = new Date(`${toKey}T12:00:00`);
  return Math.round((to - from) / 86400000);
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

export function workDayRange(start, end) {
  return dateRange(start, end).filter(isWorkDay);
}

export function defaultSprintDates(today = new Date(), durationDays = DEFAULT_PREFERENCES.defaultSprintDays) {
  const start = new Date(today);
  const end = new Date(today);
  end.setDate(end.getDate() + Math.max(1, durationDays) - 1);
  return { startDate: localDateKey(start), endDate: localDateKey(end) };
}

export function buildBurndown(cards, settings, todayKey = localDateKey(), capacity = {}) {
  const hoursPerDay = boundedNumber(capacity.hoursPerDay, 1, 24) ?? DEFAULT_PREFERENCES.hoursPerDay;
  const teamSize = boundedNumber(capacity.teamSize, 1, 50) ?? DEFAULT_PREFERENCES.teamSize;
  const plannedEfficiency = boundedNumber(capacity.efficiencyFactor, 0.1, 3) ?? DEFAULT_PREFERENCES.efficiencyFactor;
  const sprintDays = workDayRange(settings.startDate, settings.endDate);

  const normalized = cards.map((card) => ({ ...card, time: normalizeTimeData(card.time) }));
  const remainingOf = (card, dateKey) => (card.time.completedAt && card.time.completedAt < dateKey
    ? 0
    : estimateAsOf(card.time, dateKey));
  const remainingOn = (dateKey) => normalized.reduce((sum, card) => sum + remainingOf(card, dateKey), 0);

  const baseline = sprintDays.length ? remainingOn(sprintDays[0]) : remainingOn(settings.startDate);
  const lastActualDay = todayKey < settings.endDate ? todayKey : settings.endDate;
  const observationDay = todayKey < settings.startDate
    ? settings.startDate
    : todayKey > settings.endDate ? settings.endDate : todayKey;
  const completed = normalized.filter((card) => card.time.completedAt
    && card.time.completedAt >= settings.startDate
    && card.time.completedAt <= observationDay);
  const totalActual = completed.reduce((sum, card) => sum + (card.time.actual || 0), 0);
  const completedEstimate = completed.reduce((sum, card) => sum + estimateAsOf(card.time, card.time.completedAt), 0);

  const elapsedDays = lastActualDay >= settings.startDate ? Math.max(1, workDayRange(settings.startDate, lastActualDay).length) : 0;
  const velocity = elapsedDays > 0 && completedEstimate > 0 ? completedEstimate / elapsedDays : null;
  const measuredEfficiency = totalActual > 0 ? completedEstimate / totalActual : null;
  const efficiency = measuredEfficiency ?? plannedEfficiency;
  const burnRate = hoursPerDay * teamSize * efficiency;

  const remaining = remainingOn(observationDay);
  const predictedDays = baseline > 0 && burnRate > 0 ? Math.ceil(baseline / burnRate) : 0;
  const predictedEndDate = predictedDays > 0 ? addWorkDays(sprintDays[0] ?? settings.startDate, predictedDays - 1) : null;
  const projectedDays = remaining > 0 && burnRate > 0 ? Math.ceil(remaining / burnRate) : 0;
  const projectionOrigin = lastActualDay >= settings.startDate ? lastActualDay : settings.startDate;
  const projectedEndDate = projectedDays > 0 ? addWorkDays(projectionOrigin, projectedDays) : projectionOrigin;

  const projectionExtension = projectedEndDate > settings.endDate
    ? workDayRange(addDays(settings.endDate, 1), projectedEndDate)
    : [];
  const days = [...new Set([...sprintDays, ...projectionExtension])].sort();
  const points = days.map((date) => {
    const sprintIndex = sprintDays.indexOf(date);
    return {
      date,
      ideal: sprintIndex === -1
        ? null
        : sprintDays.length <= 1 ? 0 : baseline * (1 - sprintIndex / (sprintDays.length - 1)),
      actual: date <= lastActualDay && date <= settings.endDate ? Math.max(0, remainingOn(date)) : null,
      projection: null,
    };
  });

  const projectionStart = points.reduce((last, point, index) => (point.actual === null ? last : index), -1);
  if (projectionStart >= 0 && points.length) {
    const from = points[projectionStart].actual;
    const projectionEnd = points.findIndex((point) => point.date === projectedEndDate);
    const span = Math.max(1, projectionEnd - projectionStart);
    points.forEach((point, index) => {
      if (index < projectionStart || index > projectionEnd) return;
      point.projection = Math.max(0, from * (1 - (index - projectionStart) / span));
    });
  }

  const tracked = normalized.filter((card) => {
    if (card.time.completedAt && card.time.completedAt < settings.startDate) return false;
    if (card.time.completedAt && card.time.completedAt <= settings.endDate) return true;
    return Boolean(card.time.estimate) && sprintDays.some((day) => remainingOf(card, day) > 0);
  });

  return {
    tracked,
    points,
    baseline,
    totalEstimate: baseline,
    remaining,
    completedCount: completed.length,
    variance: totalActual - completedEstimate,
    velocity,
    efficiency,
    measuredEfficiency,
    plannedEfficiency,
    teamSize,
    hoursPerDay,
    burnRate,
    predictedDays,
    predictedEndDate,
    projectedDays,
    projectedEndDate,
  };
}

export function buildBurndownCsv(points) {
  const rows = [
    ['Dato', 'Ideelle resterende timer', 'Faktiske resterende timer', 'Prognose'],
    ...points.map((point) => [point.date, point.ideal, point.actual ?? '', point.projection ?? '']),
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
