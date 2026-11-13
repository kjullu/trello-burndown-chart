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
    sprintId: normalizeSprintId(value.sprintId),
  };
}

// undefined = never assigned (legacy card), null = backlog, string = sprint id.
function normalizeSprintId(value) {
  if (value === null) return null;
  return typeof value === 'string' && /^[a-z0-9]{1,12}$/i.test(value) ? value : undefined;
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
  if (entries.length === 0) return estimate === null ? [] : normalizeEstimateHistory([{ date: dateKey, estimate }]);
  const last = entries.at(-1);
  if (last && last.date === dateKey) {
    entries[entries.length - 1] = { date: dateKey, estimate };
    return normalizeEstimateHistory(entries);
  }
  if (last && (last.estimate ?? null) === estimate) return normalizeEstimateHistory(entries);
  entries.push({ date: dateKey, estimate });
  return normalizeEstimateHistory(entries);
}

// Sets the estimate from a chosen date. Changes recorded after that date are replaced.
export function setEstimateFrom(history, dateKey, nextEstimate) {
  const earlier = (Array.isArray(history) ? history : []).filter((entry) => entry.date === null || entry.date < dateKey);
  return recordEstimateChange(earlier, dateKey, nextEstimate);
}

// A card registered after it was finished needs its estimate in place on the completion day.
export function backfillEstimate(history, dateKey, nextEstimate) {
  const estimate = positiveNumber(nextEstimate);
  if (!estimate || !validDate(dateKey) || estimateAsOf({ estimateHistory: history }, dateKey) > 0) return history;
  return normalizeEstimateHistory([...history, { date: dateKey.slice(0, 10), estimate }]);
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
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) return false;
  const dateKey = value.slice(0, 10);
  const [year, month, day] = dateKey.split('-').map(Number);
  const parsed = new Date(`${dateKey}T12:00:00`);
  return !Number.isNaN(parsed.getTime())
    && parsed.getFullYear() === year
    && parsed.getMonth() + 1 === month
    && parsed.getDate() === day;
}

export function parseDanishDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  const dateKey = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  return validDate(dateKey) ? dateKey : null;
}

export function formatDanishDate(value) {
  if (!validDate(value)) return '';
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

export function normalizeSprintSettings(value, fallback) {
  const normalizeDate = (date) => validDate(date) ? date.slice(0, 10) : parseDanishDate(date);
  const startDate = normalizeDate(value?.startDate);
  const endDate = normalizeDate(value?.endDate);
  if (startDate && endDate && startDate <= endDate) return { startDate, endDate };
  return { startDate: fallback.startDate, endDate: fallback.endDate };
}

export const SPRINT_LIMIT = 40;
const SPRINT_NAME_LIMIT = 40;
export const SPRINT_TAG_LIMIT = 4;

// Short label shown on card badges. Defaults to the id number, e.g. "S3".
export function defaultSprintTag(id) {
  const number = /^s(\d+)$/.exec(id ?? '')?.[1];
  return number ? `S${number}` : '';
}

// Board settings hold every sprint. Older boards stored a single { startDate, endDate } pair;
// that pair becomes the first sprint, and cards that were never assigned belong to it.
export function normalizeSprintBoard(value, fallback) {
  const normalizeDate = (date) => validDate(date) ? date.slice(0, 10) : parseDanishDate(date);
  const seen = new Set();
  const sprints = (Array.isArray(value?.sprints) ? value.sprints : [])
    .map((sprint) => ({
      id: normalizeSprintId(sprint?.id),
      name: typeof sprint?.name === 'string' ? sprint.name.trim().slice(0, SPRINT_NAME_LIMIT) : '',
      tag: typeof sprint?.tag === 'string' ? sprint.tag.trim().slice(0, SPRINT_TAG_LIMIT) : '',
      startDate: normalizeDate(sprint?.startDate),
      endDate: normalizeDate(sprint?.endDate),
    }))
    .filter((sprint) => sprint.id && sprint.startDate && sprint.endDate && sprint.startDate <= sprint.endDate && !seen.has(sprint.id) && seen.add(sprint.id))
    .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0))
    .slice(0, SPRINT_LIMIT)
    .map((sprint, index) => ({ ...sprint, name: sprint.name || `Sprint ${index + 1}`, tag: sprint.tag || defaultSprintTag(sprint.id) || `S${index + 1}` }));
  if (sprints.length) {
    const legacySprintId = normalizeSprintId(value.legacySprintId);
    const kept = new Set(sprints.map((sprint) => sprint.id));
    // Ended sprints whose leftover cards were already dealt with. One short list keeps the board under Trello's size limit.
    const closedSprintIds = [...new Set(Array.isArray(value.closedSprintIds) ? value.closedSprintIds : [])].filter((id) => kept.has(id));
    return {
      sprints,
      legacySprintId: legacySprintId && kept.has(legacySprintId) ? legacySprintId : null,
      ...(closedSprintIds.length ? { closedSprintIds } : {}),
    };
  }
  const dates = normalizeSprintSettings(value, fallback);
  return { sprints: [{ id: 's1', name: 'Sprint 1', tag: 'S1', ...dates }], legacySprintId: 's1' };
}

// False while Sprint 1 is still only a suggestion that starts today. It has to be saved once,
// or it would start over every day.
export function hasSavedSprints(value) {
  return normalizeSprintBoard(value, { startDate: null, endDate: null }).sprints[0].startDate !== null;
}

export function sprintStatus(sprint, todayKey) {
  if (sprint.endDate < todayKey) return 'past';
  if (sprint.startDate > todayKey) return 'planned';
  return 'active';
}

// The sprint running today, else the next planned one, else the latest.
export function currentSprint(sprints, todayKey) {
  return sprints.find((sprint) => sprintStatus(sprint, todayKey) === 'active')
    ?? sprints.find((sprint) => sprintStatus(sprint, todayKey) === 'planned')
    ?? sprints.at(-1)
    ?? null;
}

export function cardSprintId(time, board) {
  return time.sprintId === undefined ? board.legacySprintId ?? null : time.sprintId;
}

// Estimated cards still open in a sprint. Cards without an estimate never show on the chart, and cards
// marked done in Trello only miss their actual time, so both are left alone.
export function unfinishedCards(cards, sprint, board) {
  return cards.filter((card) => cardSprintId(card.time, board) === sprint.id && !card.time.completedAt && !card.dueComplete && card.time.estimate);
}

export function isSprintClosed(board, id) {
  return Boolean(board.closedSprintIds?.includes(id));
}

// Marks a sprint as dealt with, or reopens it.
export function setSprintClosed(board, id, closed) {
  const others = (board.closedSprintIds ?? []).filter((other) => other !== id);
  const closedSprintIds = closed ? [...others, id] : others;
  const { closedSprintIds: _, ...rest } = board;
  return closedSprintIds.length ? { ...rest, closedSprintIds } : rest;
}

// Where leftover cards go: the first later sprint that has not ended too.
export function wrapUpTarget(sprints, sprint, todayKey) {
  return sprints.find((other) => other.startDate > sprint.endDate && sprintStatus(other, todayKey) !== 'past') ?? null;
}

// The latest ended sprint whose leftover cards nobody has decided about yet.
export function sprintToWrapUp(cards, board, todayKey, skippedIds = []) {
  return board.sprints
    .filter((sprint) => sprintStatus(sprint, todayKey) === 'past' && !isSprintClosed(board, sprint.id) && !skippedIds.includes(sprint.id))
    .reverse()
    .find((sprint) => unfinishedCards(cards, sprint, board).length) ?? null;
}

export function nextSprintDraft(sprints, todayKey, durationDays = DEFAULT_PREFERENCES.defaultSprintDays) {
  const last = sprints.at(-1);
  const startDate = last && last.endDate >= todayKey ? addDays(last.endDate, 1) : todayKey;
  const ids = sprints.map((sprint) => Number(/^s(\d+)$/.exec(sprint.id)?.[1]) || 0);
  const number = Math.max(0, ...ids) + 1;
  const id = `s${number}`;
  return {
    id,
    tag: defaultSprintTag(id),
    // Numbered like the id, so the name is not taken by an existing sprint after one was deleted.
    name: `Sprint ${number}`,
    startDate,
    endDate: addDays(startDate, Math.max(1, durationDays) - 1),
  };
}

// Returns an error message, or null when the sprint fits next to the others.
export function sprintError(sprint, sprints) {
  if (!validDate(sprint.startDate) || !validDate(sprint.endDate)) return 'Skriv gyldige datoer som dd/mm/åååå.';
  if (sprint.startDate > sprint.endDate) return 'Slutdatoen må ikke ligge før startdatoen.';
  const overlap = sprints.find((other) => other.id !== sprint.id && sprint.startDate <= other.endDate && sprint.endDate >= other.startDate);
  if (overlap) return `Datoerne overlapper ${overlap.name}.`;
  if (!sprints.some((other) => other.id === sprint.id) && sprints.length >= SPRINT_LIMIT) return `Et board kan højst have ${SPRINT_LIMIT} sprints.`;
  return null;
}

export function formatSprintRange(sprint) {
  const short = (dateKey) => `${Number(dateKey.slice(8, 10))}/${Number(dateKey.slice(5, 7))}`;
  return `${short(sprint.startDate)} - ${short(sprint.endDate)}`;
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
  const remainingAtStartOfDay = (card, dateKey) => (card.time.completedAt && card.time.completedAt < dateKey
    ? 0
    : estimateAsOf(card.time, dateKey));
  const remainingOf = (card, dateKey) => (card.time.completedAt && card.time.completedAt <= dateKey
    ? 0
    : estimateAsOf(card.time, dateKey));
  const remainingOn = (dateKey) => normalized.reduce((sum, card) => sum + remainingOf(card, dateKey), 0);

  const baselineDate = sprintDays[0] ?? settings.startDate;
  const baseline = normalized.reduce((sum, card) => sum + remainingAtStartOfDay(card, baselineDate), 0);
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
  const measuredEfficiency = totalActual > 0 && completedEstimate > 0 ? completedEstimate / totalActual : null;
  const efficiency = measuredEfficiency ?? plannedEfficiency;
  const burnRate = hoursPerDay * teamSize * efficiency;

  const remaining = remainingOn(observationDay);
  const predictedDays = baseline > 0 && burnRate > 0 ? Math.ceil(baseline / burnRate) : 0;
  const predictedEndDate = predictedDays > 0 ? addWorkDays(sprintDays[0] ?? settings.startDate, predictedDays - 1) : null;
  const projectedDays = remaining > 0 && burnRate > 0 ? Math.ceil(remaining / burnRate) : 0;
  const projectionOrigin = lastActualDay >= settings.startDate ? lastActualDay : settings.startDate;
  // Without a burn rate there is no honest projection while work remains.
  const projectedEndDate = remaining > 0 && burnRate <= 0
    ? null
    : projectedDays > 0 ? addWorkDays(projectionOrigin, projectedDays) : projectionOrigin;

  const points = sprintDays.map((date) => {
    const sprintIndex = sprintDays.indexOf(date);
    return {
      date,
      ideal: sprintIndex === -1
        ? null
        : sprintDays.length <= 1 ? 0 : baseline * (1 - sprintIndex / (sprintDays.length - 1)),
      // A weekend at the end of the sprint has no later workday, so the last point absorbs it.
      actual: date <= lastActualDay && date <= settings.endDate
        ? Math.max(0, remainingOn(sprintIndex === sprintDays.length - 1 && lastActualDay > date ? lastActualDay : date))
        : null,
      projection: null,
    };
  });

  const projectionStart = points.reduce((last, point, index) => (point.actual === null ? last : index), -1);
  if (projectionStart >= 0 && points.length && projectedEndDate) {
    const from = points[projectionStart].actual;
    const projectionEnd = points.findIndex((point) => point.date === projectedEndDate);
    const visibleEnd = projectionEnd === -1 ? points.length - 1 : projectionEnd;
    const span = Math.max(1, workDayRange(points[projectionStart].date, projectedEndDate).length - 1);
    points.forEach((point, index) => {
      if (index < projectionStart || index > visibleEnd) return;
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
    ...points.map((point) => [point.date, csvNumber(point.ideal), csvNumber(point.actual), csvNumber(point.projection)]),
  ];
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

function csvNumber(value) {
  return value === null || value === undefined ? '' : roundToTwoDecimals(value);
}

function csvCell(value) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function formatHours(value) {
  if (value === null || value === undefined) return '–';
  return `${new Intl.NumberFormat('da-DK', { maximumFractionDigits: 2 }).format(roundToTwoDecimals(value))} t`;
}

function roundToTwoDecimals(value) {
  return Number(value.toFixed(2));
}

export function needsActualTime(card) {
  return Boolean(card.dueComplete && !card.time?.completedAt);
}
