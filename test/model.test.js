import { describe, expect, it } from 'vitest';
import { addDays, setEstimateFrom, cardSprintId, currentSprint, formatSprintRange, nextSprintDraft, normalizeSprintBoard, sprintError, sprintStatus, setSprintClosed, sprintToWrapUp, unfinishedCards, wrapUpTarget, addWorkDays, buildBurndown, buildBurndownCsv, dateRange, defaultSprintDates, diffDays, backfillEstimate, estimateAsOf, formatDanishDate, formatHours, needsActualTime, normalizePreferences, normalizeSprintSettings, normalizeTimeData, parseDanishDate, recordEstimateChange, validDate, workDayRange } from '../src/model.js';

describe('time data', () => {
  it('keeps an explicitly empty estimate history empty', () => {
    expect(normalizeTimeData({ estimateHistory: [] }).estimateHistory).toEqual([]);
  });

  it('removes invalid and incomplete completion values', () => {
    expect(normalizeTimeData({ estimate: '4', actual: '-2', completedAt: 'nope' })).toEqual({
      estimate: 4,
      actual: null,
      completedAt: null,
      estimateIgnored: false,
      estimateHistory: [{ date: null, estimate: 4 }],
    });
  });

  it('keeps the missing-estimate ignore flag only while no estimate is set', () => {
    expect(normalizeTimeData({ estimateIgnored: true })).toEqual({ estimate: null, actual: null, completedAt: null, estimateIgnored: true, estimateHistory: [] });
    expect(normalizeTimeData({ estimate: '3', estimateIgnored: true })).toEqual({ estimate: 3, actual: null, completedAt: null, estimateIgnored: false, estimateHistory: [{ date: null, estimate: 3 }] });
  });
});

describe('estimate history', () => {
  it('reads the estimate that was in force on a given day', () => {
    const time = normalizeTimeData({ estimate: 8, estimateHistory: [{ date: null, estimate: 5 }, { date: '2026-09-15', estimate: 8 }] });
    expect(estimateAsOf(time, '2026-09-01')).toBe(5);
    expect(estimateAsOf(time, '2026-09-10')).toBe(5);
    expect(estimateAsOf(time, '2026-09-14')).toBe(5);
    expect(estimateAsOf(time, '2026-09-15')).toBe(8);
    expect(estimateAsOf(time, '2026-09-20')).toBe(8);
  });

  it('appends a point when the estimate changes and skips no-op saves', () => {
    expect(recordEstimateChange([], '2026-09-10', 5)).toEqual([{ date: '2026-09-10', estimate: 5 }]);
    expect(recordEstimateChange([{ date: null, estimate: 5 }], '2026-09-12', 5)).toEqual([{ date: null, estimate: 5 }]);
    expect(recordEstimateChange([{ date: null, estimate: 5 }], '2026-09-12', 9)).toEqual([
      { date: null, estimate: 5 },
      { date: '2026-09-12', estimate: 9 },
    ]);
  });

  it('rewrites a same-day change instead of stacking points', () => {
    expect(recordEstimateChange([{ date: null, estimate: 5 }, { date: '2026-09-10', estimate: 6 }], '2026-09-10', 7)).toEqual([
      { date: null, estimate: 5 },
      { date: '2026-09-10', estimate: 7 },
    ]);
  });

  it('can record a backfilled estimate as existing before the sprint', () => {
    expect(recordEstimateChange([], null, 7)).toEqual([{ date: null, estimate: 7 }]);
  });

  it('drops an estimate from the day it is removed', () => {
    const history = recordEstimateChange([{ date: null, estimate: 5 }], '2026-09-14', null);
    expect(history).toEqual([{ date: null, estimate: 5 }, { date: '2026-09-14', estimate: null }]);
    expect(estimateAsOf(normalizeTimeData({ estimateHistory: history }), '2026-09-13')).toBe(5);
    expect(estimateAsOf(normalizeTimeData({ estimateHistory: history }), '2026-09-14')).toBe(0);
  });
});

describe('date helpers', () => {
  it('round-trips Danish date input through the canonical stored format', () => {
    expect(parseDanishDate('7/9/2026')).toBe('2026-09-07');
    expect(formatDanishDate('2026-09-07')).toBe('07/09/2026');
  });

  it('rejects impossible calendar dates', () => {
    expect(parseDanishDate('31/02/2026')).toBeNull();
    expect(validDate('2026-02-31')).toBe(false);
  });

  it('normalizes stored ISO and legacy Danish sprint dates', () => {
    const fallback = { startDate: '2026-09-01', endDate: '2026-09-14' };
    expect(normalizeSprintSettings({ startDate: '2026-10-01', endDate: '2026-10-12' }, fallback)).toEqual({ startDate: '2026-10-01', endDate: '2026-10-12' });
    expect(normalizeSprintSettings({ startDate: '1/10/2026', endDate: '12/10/2026' }, fallback)).toEqual({ startDate: '2026-10-01', endDate: '2026-10-12' });
  });

  it('falls back when stored sprint dates are malformed or reversed', () => {
    const fallback = { startDate: '2026-09-01', endDate: '2026-09-14' };
    expect(normalizeSprintSettings({ startDate: 'nope', endDate: '12/10/2026' }, fallback)).toEqual(fallback);
    expect(normalizeSprintSettings({ startDate: '13/10/2026', endDate: '12/10/2026' }, fallback)).toEqual(fallback);
  });

  it('includes both sprint boundaries', () => {
    expect(dateRange('2026-09-01', '2026-09-03')).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
  });

  it('adds and diffs calendar days', () => {
    expect(addDays('2026-09-01', 4)).toBe('2026-09-05');
    expect(diffDays('2026-09-01', '2026-09-05')).toBe(4);
    expect(diffDays('2026-09-05', '2026-09-01')).toBe(-4);
  });

  it('lists and advances through workdays only', () => {
    expect(workDayRange('2026-09-04', '2026-09-08')).toEqual(['2026-09-04', '2026-09-07', '2026-09-08']);
    expect(addWorkDays('2026-09-11', 5)).toBe('2026-09-18');
  });
});

describe('buildBurndown', () => {
  it('burns estimated hours on the completion day and tracks actual variance', () => {
    const cards = [
      { time: { estimate: 5, actual: 7, completedAt: '2026-09-02' } },
      { time: { estimate: 3, actual: null, completedAt: null } },
      { time: { estimate: null, actual: null, completedAt: null } },
    ];
    const result = buildBurndown(cards, { startDate: '2026-09-01', endDate: '2026-09-03' }, '2026-09-03');
    expect(result.points.filter((point) => point.date <= '2026-09-03').map((point) => point.actual)).toEqual([8, 3, 3]);
    expect(result.remaining).toBe(3);
    expect(result.variance).toBe(2);
    expect(result.completedCount).toBe(1);
  });

  it('does not draw actual data into the future', () => {
    const cards = [{ time: { estimate: 4, actual: null, completedAt: null } }];
    const result = buildBurndown(cards, { startDate: '2026-09-01', endDate: '2026-09-03' }, '2026-09-02');
    expect(result.points.map((point) => point.actual)).toEqual([4, 4, null]);
  });

  it('plots sprint and forecast points on workdays only', () => {
    const cards = [{ time: { estimate: 8, actual: null, completedAt: null } }];
    const result = buildBurndown(cards, { startDate: '2026-09-04', endDate: '2026-09-08' }, '2026-09-08', { hoursPerDay: 8 });
    expect(result.points.filter((point) => point.date <= '2026-09-08').map((point) => point.date)).toEqual([
      '2026-09-04', '2026-09-07', '2026-09-08',
    ]);
  });

  it('shows only the work that existed on each day instead of rewriting the past', () => {
    const cards = [
      { time: { estimate: 10, estimateHistory: [{ date: null, estimate: 10 }] } },
      { time: { estimate: 10, estimateHistory: [{ date: null, estimate: null }, { date: '2026-09-03', estimate: 10 }] } },
    ];
    const result = buildBurndown(cards, { startDate: '2026-09-01', endDate: '2026-09-04' }, '2026-09-04');
    expect(result.points.filter((point) => point.date <= '2026-09-04').map((point) => point.actual)).toEqual([10, 10, 20, 20]);
    expect(result.baseline).toBe(10);
  });

  it('anchors the ideal line at the sprint-start backlog', () => {
    const cards = [
      { time: { estimate: 10, estimateHistory: [{ date: null, estimate: 10 }] } },
      { time: { estimate: 10, estimateHistory: [{ date: null, estimate: null }, { date: '2026-09-03', estimate: 10 }] } },
    ];
    const result = buildBurndown(cards, { startDate: '2026-09-01', endDate: '2026-09-04' }, '2026-09-04');
    const ideal = result.points.map((point) => point.ideal);
    expect(ideal[0]).toBe(10);
    expect(ideal[3]).toBe(0);
    expect(ideal[1]).toBeCloseTo(10 * (1 - 1 / 3), 10);
    expect(ideal[2]).toBeCloseTo(10 * (1 - 2 / 3), 10);
  });

  it('starts the actual line at the ideal line', () => {
    const cards = [
      { time: { estimate: 10, actual: 9, completedAt: '2026-08-20' } },
      { time: { estimate: 10, actual: null, completedAt: null } },
    ];
    const result = buildBurndown(cards, { startDate: '2026-09-01', endDate: '2026-09-04' }, '2026-09-04');
    expect(result.points[0].actual).toBe(result.points[0].ideal);
    expect(result.points[0].actual).toBe(10);
    expect(result.completedCount).toBe(0);
    expect(result.tracked.map((card) => card.time.estimate)).toEqual([10]);
  });

  it('keeps work completed on the first sprint day in the starting backlog', () => {
    const cards = [{ time: { estimate: 8, actual: 8, completedAt: '2026-09-01' } }];
    const result = buildBurndown(cards, { startDate: '2026-09-01', endDate: '2026-09-03' }, '2026-09-02');
    expect(result.baseline).toBe(8);
    expect(result.points.map((point) => point.actual)).toEqual([0, 0, null]);
    expect(result.variance).toBe(0);
  });

  it('keeps the starting backlog but removes same-day completions from the current remainder', () => {
    const openCards = [0.5, 3, 0.5, 2, 3, 0.5, 2, 3].map((estimate) => ({ time: { estimate } }));
    const cards = [
      ...openCards,
      { time: { estimate: 2, actual: 2, completedAt: '2026-09-30' } },
      { time: { estimate: 1, actual: 2, completedAt: '2026-09-30' } },
    ];
    const result = buildBurndown(cards, { startDate: '2026-09-30', endDate: '2026-10-13' }, '2026-09-30', { hoursPerDay: 8, teamSize: 2, efficiencyFactor: 1 });

    expect(result.baseline).toBe(17.5);
    expect(result.remaining).toBe(14.5);
    expect(result.points[0]).toMatchObject({ ideal: 17.5, actual: 14.5, projection: 14.5 });
  });

  it('clamps historical headline values to the sprint end', () => {
    const cards = [{ time: { estimate: 8, actual: 8, completedAt: '2026-09-10' } }];
    const result = buildBurndown(cards, { startDate: '2026-09-01', endDate: '2026-09-07' }, '2026-09-20');
    expect(result.points.find((point) => point.date === '2026-09-07').actual).toBe(8);
    expect(result.remaining).toBe(8);
    expect(result.completedCount).toBe(0);
  });

  it('reports velocity and the measured efficiency factor', () => {
    const cards = [
      { time: { estimate: 8, actual: 10, completedAt: '2026-09-02' } },
      { time: { estimate: 8, actual: 8, completedAt: '2026-09-04' } },
    ];
    const result = buildBurndown(cards, { startDate: '2026-09-01', endDate: '2026-09-07' }, '2026-09-07', { hoursPerDay: 8, teamSize: 1, efficiencyFactor: 1 });
    expect(result.velocity).toBe(16 / 5);
    expect(result.measuredEfficiency).toBe(16 / 18);
    expect(result.efficiency).toBeCloseTo(16 / 18, 10);
  });

  it('falls back to the planned efficiency when nothing is recorded yet', () => {
    const cards = [{ time: { estimate: 14, actual: null, completedAt: null } }];
    const result = buildBurndown(cards, { startDate: '2026-09-01', endDate: '2026-09-07' }, '2026-09-02', { hoursPerDay: 7, teamSize: 1, efficiencyFactor: 0.7 });
    expect(result.measuredEfficiency).toBeNull();
    expect(result.efficiency).toBe(0.7);
    expect(result.burnRate).toBeCloseTo(7 * 0.7, 10);
  });

  it('predicts the finish from work divided by workers divided by efficiency', () => {
    const cards = [{ time: { estimate: 28, actual: null, completedAt: null } }];
    const result = buildBurndown(cards, { startDate: '2026-09-01', endDate: '2026-10-31' }, '2026-09-01', { hoursPerDay: 1, teamSize: 2, efficiencyFactor: 0.7 });
    expect(result.predictedDays).toBe(20);
    expect(result.predictedEndDate).toBe('2026-09-28');
  });

  it('projects the remaining work from the current position', () => {
    const cards = [{ time: { estimate: 20, actual: null, completedAt: null } }];
    const result = buildBurndown(cards, { startDate: '2026-09-01', endDate: '2026-09-30' }, '2026-09-11', { hoursPerDay: 4, teamSize: 1, efficiencyFactor: 1 });
    expect(result.remaining).toBe(20);
    expect(result.projectedDays).toBe(5);
    expect(result.projectedEndDate).toBe('2026-09-18');
  });

  it('keeps the chart within the sprint when the prognosis is later', () => {
    const cards = [{ time: { estimate: 40, actual: null, completedAt: null } }];
    const result = buildBurndown(cards, { startDate: '2026-09-01', endDate: '2026-09-07' }, '2026-09-04', { hoursPerDay: 8, teamSize: 1, efficiencyFactor: 1 });
    expect(result.projectedEndDate).toBe('2026-09-11');
    expect(result.points.at(-1)).toMatchObject({ date: '2026-09-07', ideal: 0, actual: null, projection: 32 });
    expect(result.points.map((point) => point.date)).not.toContain('2026-09-06');
  });

  it('preserves the date of a first estimate added during the sprint', () => {
    const cards = [{ time: { estimate: 2, estimateHistory: [{ date: '2026-09-26', estimate: 2 }] } }];
    const result = buildBurndown(cards, { startDate: '2026-09-24', endDate: '2026-09-29' }, '2026-09-26', { hoursPerDay: 8, teamSize: 1, efficiencyFactor: 1 });
    expect(result.baseline).toBe(0);
    expect(result.remaining).toBe(2);
    expect(result.projectedEndDate).toBe('2026-09-28');
    expect(result.points[0]).toMatchObject({ ideal: 0, actual: 0 });
    expect(result.points.map((point) => point.date)).not.toContain('2026-09-26');
    expect(result.points.find((point) => point.date === '2026-09-25').actual).toBe(0);
  });

  it('raises the actual line on the first-estimate save date without changing earlier points or the ideal line', () => {
    const settings = { startDate: '2026-09-01', endDate: '2026-09-04' };
    const existing = [{ time: { estimate: 10 } }];
    const before = buildBurndown(existing, settings, '2026-09-04');
    const added = normalizeTimeData({ estimate: 5, estimateHistory: recordEstimateChange([], '2026-09-03', 5) });
    // Round-trip through storage and normalize again, as the dashboard does.
    const result = buildBurndown([...existing, { time: JSON.parse(JSON.stringify(added)) }], settings, '2026-09-04');

    expect(result.points.map((point) => point.actual)).toEqual([10, 10, 15, 15]);
    expect(result.points.map((point) => point.ideal)).toEqual(before.points.map((point) => point.ideal));
    expect(result.baseline).toBe(10);
    expect(result.remaining).toBe(15);
    expect(buildBurndownCsv(result.points)).toContain('2026-09-03,3.33,15,');
  });

  it('keeps dated estimates saved before sprint start in the initial backlog', () => {
    const time = { estimate: 5, estimateHistory: recordEstimateChange([], '2026-08-31', 5) };
    const result = buildBurndown([{ time }], { startDate: '2026-09-01', endDate: '2026-09-04' }, '2026-09-04');
    expect(result.baseline).toBe(5);
    expect(result.points[0]).toMatchObject({ ideal: 5, actual: 5 });
  });

  it('burns newly added work on its completion date', () => {
    const time = { estimate: 5, actual: 6, completedAt: '2026-09-04', estimateHistory: recordEstimateChange([], '2026-09-03', 5) };
    const result = buildBurndown([{ time }], { startDate: '2026-09-01', endDate: '2026-09-04' }, '2026-09-04');
    expect(result.points.map((point) => point.actual)).toEqual([0, 0, 5, 0]);
    expect(result.completedCount).toBe(1);
    expect(result.variance).toBe(1);
  });
});

describe('buildBurndownCsv', () => {
  it('exports chart points and leaves future actual values empty', () => {
    const csv = buildBurndownCsv([
      { date: '2026-09-01', ideal: 8, actual: 8, projection: 8 },
      { date: '2026-09-02', ideal: 4, actual: null, projection: null },
    ]);
    expect(csv).toBe([
      'Dato,Ideelle resterende timer,Faktiske resterende timer,Prognose',
      '2026-09-01,8,8,8',
      '2026-09-02,4,,',
    ].join('\r\n'));
  });

  it('rounds calculated values instead of exporting floating-point noise', () => {
    expect(buildBurndownCsv([
      { date: '2026-10-01', ideal: 15.555555555555555, actual: 14.5, projection: 7.249999999999999 },
    ])).toContain('2026-10-01,15.56,14.5,7.25');
  });
});

describe('hour formatting', () => {
  it('shows missing hours without treating them as zero', () => {
    expect(formatHours(null)).toBe('–');
    expect(formatHours(undefined)).toBe('–');
    expect(formatHours(0)).toBe('0 t');
  });

  it('shows up to two decimal places everywhere hours are formatted', () => {
    expect(formatHours(2)).toBe('2 t');
    expect(formatHours(2.75)).toBe('2,75 t');
    expect(formatHours(2.746)).toBe('2,75 t');
  });
});

describe('needsActualTime', () => {
  it('flags a Trello-completed card until actual time is recorded', () => {
    expect(needsActualTime({ dueComplete: true, time: { completedAt: null } })).toBe(true);
    expect(needsActualTime({ dueComplete: true, time: { completedAt: '2026-09-24' } })).toBe(false);
    expect(needsActualTime({ dueComplete: false, time: { completedAt: null } })).toBe(false);
  });
});

describe('board preferences', () => {
  it('normalizes unsafe values and preserves valid choices', () => {
    expect(normalizePreferences({ activeColor: 'purple', warningColor: 'invalid', defaultSprintDays: 21, copyEstimateToActual: false, remindMissingEstimate: true, warnOverEstimate: false })).toMatchObject({
      activeColor: 'purple',
      warningColor: 'red',
      defaultSprintDays: 21,
      copyEstimateToActual: false,
      remindMissingEstimate: true,
      warnOverEstimate: false,
    });
  });

  it('clamps team size, hours per day and efficiency', () => {
    expect(normalizePreferences({ teamSize: 0, hoursPerDay: 99, efficiencyFactor: 0 })).toMatchObject({
      teamSize: 1,
      hoursPerDay: 8,
      efficiencyFactor: 1,
    });
    expect(normalizePreferences({ teamSize: 3, hoursPerDay: 6, efficiencyFactor: 0.75 })).toMatchObject({
      teamSize: 3,
      hoursPerDay: 6,
      efficiencyFactor: 0.75,
    });
  });

  it('uses the configured sprint duration for new sprints', () => {
    expect(defaultSprintDates(new Date('2026-09-24T12:00:00'), 7)).toEqual({ startDate: '2026-09-24', endDate: '2026-09-30' });
  });
});

describe('cards registered after completion', () => {
  const settings = { startDate: '2026-09-21', endDate: '2026-09-25' };
  const open = { id: 'b', time: { estimate: 10, estimateHistory: [{ date: null, estimate: 10 }] } };

  it('ignores efficiency when completed cards had no estimate on their completion day', () => {
    const late = { id: 'a', time: { estimate: 8, actual: 8, completedAt: '2026-09-22', estimateHistory: [{ date: '2026-09-24', estimate: 8 }] } };
    const result = buildBurndown([late, open], settings, '2026-09-24');
    expect(result.measuredEfficiency).toBeNull();
    expect(result.burnRate).toBeGreaterThan(0);
  });

  it('backfills a missing estimate on the completion day', () => {
    const history = backfillEstimate(recordEstimateChange([], '2026-09-24', 8), '2026-09-22', 8);
    const card = { id: 'a', time: { estimate: 8, actual: 6, completedAt: '2026-09-22', estimateHistory: history } };
    expect(buildBurndown([card, open], settings, '2026-09-24').measuredEfficiency).toBeCloseTo(8 / 6);
  });

  it('backfills even when the estimate itself is unchanged', () => {
    const stored = [{ date: '2026-09-24', estimate: 8 }];
    const history = backfillEstimate(recordEstimateChange(stored, '2026-09-24', 8), '2026-09-22', 8);
    expect(estimateAsOf({ estimateHistory: history }, '2026-09-22')).toBe(8);
  });

  it('keeps old estimates when a completed card is edited later', () => {
    const stored = [{ date: '2026-09-21', estimate: 8 }];
    const history = backfillEstimate(recordEstimateChange(stored, '2026-09-24', 12), '2026-09-21', 12);
    expect(estimateAsOf({ estimateHistory: history }, '2026-09-21')).toBe(8);
    expect(estimateAsOf({ estimateHistory: history }, '2026-09-24')).toBe(12);
  });
});

describe('sprint board', () => {
  const fallback = { startDate: '2026-11-01', endDate: '2026-11-14' };
  const sprints = [
    { id: 's1', name: 'Sprint 1', startDate: '2026-11-04', endDate: '2026-11-17' },
    { id: 's2', name: 'Sprint 2', startDate: '2026-11-18', endDate: '2026-12-01' },
  ];

  it('turns the old single date pair into a first sprint that owns unassigned cards', () => {
    const board = normalizeSprintBoard({ startDate: '2026-09-16', endDate: '2026-09-29' }, fallback);
    expect(board).toEqual({ sprints: [{ id: 's1', name: 'Sprint 1', tag: 'S1', startDate: '2026-09-16', endDate: '2026-09-29' }], legacySprintId: 's1' });
    expect(normalizeSprintBoard(null, fallback).sprints[0]).toMatchObject(fallback);
  });

  it('sorts sprints, drops broken ones and fills in missing names', () => {
    const board = normalizeSprintBoard({ sprints: [sprints[1], { id: 's9', startDate: '2026-12-02', endDate: '2026-12-01' }, { ...sprints[0], name: ' ' }, sprints[1]], legacySprintId: 'gone' }, fallback);
    expect(board.sprints.map((sprint) => [sprint.id, sprint.name])).toEqual([['s1', 'Sprint 1'], ['s2', 'Sprint 2']]);
    expect(board.legacySprintId).toBeNull();
  });

  it('picks the running sprint, then the next planned one, then the latest', () => {
    expect(currentSprint(sprints, '2026-11-20').id).toBe('s2');
    expect(currentSprint(sprints, '2026-10-01').id).toBe('s1');
    expect(currentSprint(sprints, '2027-01-01').id).toBe('s2');
    expect(sprintStatus(sprints[0], '2026-11-20')).toBe('past');
  });

  it('keeps backlog and legacy cards apart', () => {
    const board = { sprints, legacySprintId: 's1' };
    expect(cardSprintId(normalizeTimeData({ estimate: 2 }), board)).toBe('s1');
    expect(cardSprintId(normalizeTimeData({ estimate: 2, sprintId: null }), board)).toBeNull();
    expect(cardSprintId(normalizeTimeData({ estimate: 2, sprintId: 's2' }), board)).toBe('s2');
    expect(normalizeTimeData({ sprintId: '<bad>' }).sprintId).toBeUndefined();
  });

  it('drafts the next sprint right after the last one', () => {
    expect(nextSprintDraft(sprints, '2026-11-20', 14)).toEqual({ id: 's3', tag: 'S3', name: 'Sprint 3', startDate: '2026-12-02', endDate: '2026-12-15' });
    expect(nextSprintDraft(sprints, '2027-01-05', 7)).toMatchObject({ startDate: '2027-01-05', endDate: '2027-01-11' });
  });

  it('rejects overlapping or reversed sprints', () => {
    expect(sprintError({ id: 's3', tag: 'S3', name: 'Sprint 3', startDate: '2026-12-01', endDate: '2026-12-10' }, sprints)).toBe('Datoerne overlapper Sprint 2.');
    expect(sprintError({ id: 's2', name: 'Sprint 2', startDate: '2026-11-25', endDate: '2026-11-20' }, sprints)).toBe('Slutdatoen må ikke ligge før startdatoen.');
    expect(sprintError({ ...sprints[1], endDate: '2026-12-05' }, sprints)).toBeNull();
    expect(formatSprintRange(sprints[1])).toBe('18/11 - 1/12');
  });
});

describe('sprint ending on a weekend', () => {
  it('shows work finished on the final Sunday on the last workday point', () => {
    const cards = [{ id: 'a', time: { estimate: 27.5, actual: 28, completedAt: '2026-11-01', estimateHistory: [{ date: '2026-10-26', estimate: 27.5 }] } }];
    const result = buildBurndown(cards, { startDate: '2026-10-26', endDate: '2026-11-01' }, '2026-11-04');
    expect(result.points.at(-1)).toMatchObject({ date: '2026-10-30', actual: 0 });
    expect(result.points.at(-2).actual).toBe(27.5);
  });
});

describe('setEstimateFrom', () => {
  it('moves the estimate to an earlier date and drops later changes', () => {
    const history = [{ date: '2026-11-04', estimate: 28 }];
    expect(setEstimateFrom(history, '2026-10-26', 30)).toEqual([{ date: '2026-10-26', estimate: 30 }]);
    expect(setEstimateFrom([{ date: null, estimate: 5 }], '2026-10-26', 8)).toEqual([{ date: null, estimate: 5 }, { date: '2026-10-26', estimate: 8 }]);
  });
});

describe('sprint tags', () => {
  it('keeps a custom tag and falls back to the id number', () => {
    const board = normalizeSprintBoard({ sprints: [
      { id: 's1', tag: ' Q1 ', startDate: '2026-11-02', endDate: '2026-11-13' },
      { id: 's2', tag: 'toolong', startDate: '2026-11-16', endDate: '2026-11-27' },
      { id: 's7', startDate: '2026-12-01', endDate: '2026-12-10' },
    ] });
    expect(board.sprints.map((sprint) => sprint.tag)).toEqual(['Q1', 'tool', 'S7']);
  });
});

describe('sprint wrap-up', () => {
  const board = normalizeSprintBoard({ sprints: [
    { id: 's1', startDate: '2026-11-02', endDate: '2026-11-13' },
    { id: 's2', startDate: '2026-11-16', endDate: '2026-11-27' },
    { id: 's3', startDate: '2026-11-30', endDate: '2026-12-11' },
  ], legacySprintId: 's1' });
  const card = (id, time, dueComplete = false) => ({ id, name: id, dueComplete, time: normalizeTimeData(time) });
  const cards = [
    card('open', { estimate: 5, sprintId: 's1' }),
    card('done', { estimate: 3, completedAt: '2026-11-10', sprintId: 's1' }),
    card('needs-actual', { estimate: 4, sprintId: 's1' }, true),
    card('blank', {}),
    card('later', { estimate: 2, sprintId: 's2' }),
  ];

  it('only lists open cards with an estimate that are not done in Trello', () => {
    expect(unfinishedCards(cards, board.sprints[0], board).map((c) => c.id)).toEqual(['open']);
  });

  it('asks about the latest ended sprint that is not closed or skipped', () => {
    expect(sprintToWrapUp(cards, board, '2026-11-20')?.id).toBe('s1');
    expect(sprintToWrapUp(cards, board, '2026-11-10')).toBeNull();
    expect(sprintToWrapUp(cards, board, '2026-11-20', ['s1'])).toBeNull();
    const closed = normalizeSprintBoard(setSprintClosed(board, 's1', true));
    expect(closed.closedSprintIds).toEqual(['s1']);
    expect(sprintToWrapUp(cards, closed, '2026-11-20')).toBeNull();
    expect(sprintToWrapUp(cards, board, '2026-12-01')?.id).toBe('s2');
    expect(setSprintClosed(closed, 's1', false)).not.toHaveProperty('closedSprintIds');
  });

  it('forgets closed ids of deleted sprints', () => {
    const next = normalizeSprintBoard({ ...setSprintClosed(board, 's9', true), sprints: board.sprints });
    expect(next).not.toHaveProperty('closedSprintIds');
  });

  it('never moves cards into a sprint that has ended too', () => {
    expect(wrapUpTarget(board.sprints, board.sprints[0], '2026-11-20')?.id).toBe('s2');
    expect(wrapUpTarget(board.sprints, board.sprints[0], '2026-12-01')?.id).toBe('s3');
    expect(wrapUpTarget(board.sprints, board.sprints[0], '2026-12-20')).toBeNull();
  });
});
