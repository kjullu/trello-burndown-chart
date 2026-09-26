import { describe, expect, it } from 'vitest';
import { buildBurndown, buildBurndownCsv, dateRange, defaultSprintDates, needsActualTime, normalizePreferences, normalizeTimeData, workDayRange } from '../src/model.js';

describe('time data', () => {
  it('removes invalid and incomplete completion values', () => {
    expect(normalizeTimeData({ estimate: '4', actual: '-2', completedAt: 'nope' })).toEqual({ estimate: 4, actual: null, completedAt: null, estimateIgnored: false });
  });

  it('keeps the missing-estimate ignore flag only while no estimate is set', () => {
    expect(normalizeTimeData({ estimateIgnored: true })).toEqual({ estimate: null, actual: null, completedAt: null, estimateIgnored: true });
    expect(normalizeTimeData({ estimate: '3', estimateIgnored: true })).toEqual({ estimate: 3, actual: null, completedAt: null, estimateIgnored: false });
  });
});

describe('dateRange', () => {
  it('includes both sprint boundaries', () => {
    expect(dateRange('2026-09-01', '2026-09-03')).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
  });
});

describe('workDayRange', () => {
  it('skips weekends while keeping both boundaries when they fall on weekdays', () => {
    expect(workDayRange('2026-09-07', '2026-09-11')).toEqual(['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11']);
  });

  it('exposes only the weekdays inside a calendar range that spans a weekend', () => {
    expect(workDayRange('2026-09-04', '2026-09-14')).toEqual([
      '2026-09-04', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-14',
    ]);
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
    expect(result.points.map((point) => point.actual)).toEqual([8, 3, 3]);
    expect(result.remaining).toBe(3);
    expect(result.variance).toBe(2);
    expect(result.completedCount).toBe(1);
  });

  it('does not draw actual data into the future', () => {
    const cards = [{ time: { estimate: 4, actual: null, completedAt: null } }];
    const result = buildBurndown(cards, { startDate: '2026-09-01', endDate: '2026-09-03' }, '2026-09-02');
    expect(result.points.map((point) => point.actual)).toEqual([4, 4, null]);
  });

  it('plots workdays only and positions completions on the nearest plotted day', () => {
    const cards = [
      { time: { estimate: 8, actual: null, completedAt: '2026-09-05' } },
      { time: { estimate: 5, actual: null, completedAt: null } },
    ];
    const result = buildBurndown(cards, { startDate: '2026-09-04', endDate: '2026-09-14' }, '2026-09-14');
    expect(result.points.map((point) => point.date)).toEqual([
      '2026-09-04', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-14',
    ]);
    expect(result.points.map((point) => point.actual)).toEqual([13, 5, 5, 5, 5, 5, 5]);
  });
});

describe('buildBurndownCsv', () => {
  it('exports chart points and leaves future actual values empty', () => {
    const csv = buildBurndownCsv([
      { date: '2026-09-01', ideal: 8, actual: 8 },
      { date: '2026-09-02', ideal: 4, actual: null },
    ]);
    expect(csv).toBe([
      'Dato,Ideelle resterende timer,Faktiske resterende timer',
      '2026-09-01,8,8',
      '2026-09-02,4,',
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

  it('uses the configured sprint duration for new sprints', () => {
    expect(defaultSprintDates(new Date('2026-09-24T12:00:00'), 7)).toEqual({ startDate: '2026-09-24', endDate: '2026-09-30' });
  });
});
