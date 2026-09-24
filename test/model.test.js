import { describe, expect, it } from 'vitest';
import { buildBurndown, dateRange, needsActualTime, normalizeTimeData } from '../src/model.js';

describe('time data', () => {
  it('removes invalid and incomplete completion values', () => {
    expect(normalizeTimeData({ estimate: '4', actual: '-2', completedAt: 'nope' })).toEqual({ estimate: 4, actual: null, completedAt: null });
  });
});

describe('dateRange', () => {
  it('includes both sprint boundaries', () => {
    expect(dateRange('2026-09-01', '2026-09-03')).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
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
});

describe('needsActualTime', () => {
  it('flags a Trello-completed card until actual time is recorded', () => {
    expect(needsActualTime({ dueComplete: true, time: { completedAt: null } })).toBe(true);
    expect(needsActualTime({ dueComplete: true, time: { completedAt: '2026-09-24' } })).toBe(false);
    expect(needsActualTime({ dueComplete: false, time: { completedAt: null } })).toBe(false);
  });
});
