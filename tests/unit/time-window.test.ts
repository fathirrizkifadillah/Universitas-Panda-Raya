import { describe, it, expect } from 'vitest';
import { isWithinAccessWindow } from '../../packages/gateway/src/policy/timeEvaluator.js';

describe('Unit: Time Window Policy Evaluation (Asia/Jakarta 07:00 - 21:00)', () => {
  it('denies access at 06:59 WIB (boundary before opening)', () => {
    // 06:59:00 WIB is 23:59:00 UTC previous day
    const clock = '2026-10-22T23:59:00Z'; // 06:59 in Asia/Jakarta (+7)
    const result = isWithinAccessWindow(clock);
    expect(result.serverHourMinute).toBe('06:59');
    expect(result.isWithinWindow).toBe(false);
  });

  it('allows access at 07:00 WIB (exact opening boundary)', () => {
    const clock = '2026-10-23T00:00:00Z'; // 07:00 in Asia/Jakarta (+7)
    const result = isWithinAccessWindow(clock);
    expect(result.serverHourMinute).toBe('07:00');
    expect(result.isWithinWindow).toBe(true);
  });

  it('allows access at midday (12:30 WIB)', () => {
    const clock = '2026-10-23T05:30:00Z'; // 12:30 in Asia/Jakarta (+7)
    const result = isWithinAccessWindow(clock);
    expect(result.serverHourMinute).toBe('12:30');
    expect(result.isWithinWindow).toBe(true);
  });

  it('allows access at 20:59 WIB (one minute before closing boundary)', () => {
    const clock = '2026-10-23T13:59:00Z'; // 20:59 in Asia/Jakarta (+7)
    const result = isWithinAccessWindow(clock);
    expect(result.serverHourMinute).toBe('20:59');
    expect(result.isWithinWindow).toBe(true);
  });

  it('allows access at 21:00 WIB (exact closing boundary)', () => {
    const clock = '2026-10-23T14:00:00Z'; // 21:00 in Asia/Jakarta (+7)
    const result = isWithinAccessWindow(clock);
    expect(result.serverHourMinute).toBe('21:00');
    expect(result.isWithinWindow).toBe(true);
  });

  it('denies access at 21:01 WIB (boundary after closing)', () => {
    const clock = '2026-10-23T14:01:00Z'; // 21:01 in Asia/Jakarta (+7)
    const result = isWithinAccessWindow(clock);
    expect(result.serverHourMinute).toBe('21:01');
    expect(result.isWithinWindow).toBe(false);
  });
});
