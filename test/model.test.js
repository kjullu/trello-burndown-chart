import { describe, expect, it } from 'vitest';
import { addDays, addWorkDays, buildBurndown, buildBurndownCsv, dateRange, defaultSprintDates, diffDays, estimateAsOf, needsActualTime, normalizePreferences, normalizeTimeData, recordEstimateChange, workDayRange } from '../src/model.js';

describe('time data', () => {
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
    expect(recordEstimateChange([], '2026-09-10', 5)).toEqual([{ date: null, estimate: 5 }]);
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
    expect(result.points.filter((point) => point.date <= '2026-09-03').map((point) => point.actual)).toEqual([8, 8, 3]);
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
    expect(result.points.map((point) => point.actual)).toEqual([8, 0, null]);
    expect(result.variance).toBe(0);
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

  it('extends the chart through a prognosis after the sprint end', () => {
    const cards = [{ time: { estimate: 40, actual: null, completedAt: null } }];
    const result = buildBurndown(cards, { startDate: '2026-09-01', endDate: '2026-09-07' }, '2026-09-04', { hoursPerDay: 8, teamSize: 1, efficiencyFactor: 1 });
    expect(result.projectedEndDate).toBe('2026-09-11');
    expect(result.points.at(-1)).toMatchObject({ date: '2026-09-11', ideal: null, actual: null, projection: 0 });
    expect(result.points.map((point) => point.date)).not.toContain('2026-09-06');
  });

  it('migrates a dated first estimate so the ideal and actual lines start together', () => {
    const cards = [{ time: { estimate: 2, estimateHistory: [{ date: '2026-09-26', estimate: 2 }] } }];
    const result = buildBurndown(cards, { startDate: '2026-09-24', endDate: '2026-09-29' }, '2026-09-26', { hoursPerDay: 8, teamSize: 1, efficiencyFactor: 1 });
    expect(result.baseline).toBe(2);
    expect(result.remaining).toBe(2);
    expect(result.projectedEndDate).toBe('2026-09-28');
    expect(result.points[0]).toMatchObject({ ideal: 2, actual: 2 });
    expect(result.points.map((point) => point.date)).not.toContain('2026-09-26');
    expect(result.points.find((point) => point.date === '2026-09-25').projection).toBe(2);
    expect(result.points.find((point) => point.date === '2026-09-28').projection).toBe(0);
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
    expect(normalizePreferences({ activeColor: 'purple', warningColor: 'invalid', defaultSprintDays: 21, copyEstimateToActual: false, remindMissingEstimate: true })).toMatchObject({
      activeColor: 'purple',
      warningColor: 'red',
      defaultSprintDays: 21,
      copyEstimateToActual: false,
      remindMissingEstimate: true,
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
