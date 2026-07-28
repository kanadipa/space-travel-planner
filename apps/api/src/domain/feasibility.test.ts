import { describe, expect, it } from 'vitest';
import { alpha, beta, fragile, gamma, planets, workhorse } from './__fixtures__/planets';
import { evaluate, evaluateFleet } from './feasibility';

const codes = (failures: { code: string }[]) => failures.map((f) => f.code);

describe('evaluate', () => {
  it('passes a craft that clears every constraint', () => {
    const result = evaluate(workhorse, alpha, [beta], planets, 4);
    expect(result.feasible).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it('reports capacity as actionable', () => {
    const result = evaluate(workhorse, alpha, [beta], planets, 20);
    const failure = result.failures.find((f) => f.code === 'CAPACITY_EXCEEDED');
    expect(failure?.actionable).toBe(true);
    expect(failure?.detail.capacity).toBe(10);
  });

  it('reports temperature as intrinsic and not actionable', () => {
    const result = evaluate(fragile, alpha, [beta], planets, 1);
    const failure = result.failures.find((f) => f.code === 'TEMPERATURE_OUT_OF_BOUNDS');
    expect(failure?.actionable).toBe(false);
    expect(failure?.detail.planetName).toBe('Beta');
  });

  it('binds temperature at bodies flown past, not only at destinations', () => {
    const result = evaluate(fragile, alpha, [gamma], planets, 1);
    const offenders = result.failures
      .filter((f) => f.code === 'TEMPERATURE_OUT_OF_BOUNDS')
      .map((f) => f.detail.planetName);
    expect(offenders).toContain('Beta');
  });

  it('collects every independent failure rather than stopping at the first', () => {
    const result = evaluate(fragile, alpha, [gamma], planets, 20);
    expect(codes(result.failures)).toEqual(
      expect.arrayContaining(['CAPACITY_EXCEEDED', 'OUT_OF_RANGE', 'TEMPERATURE_OUT_OF_BOUNDS']),
    );
  });

  it('orders actionable failures before intrinsic ones', () => {
    const result = evaluate(fragile, alpha, [gamma], planets, 20);
    const firstIntrinsic = result.failures.findIndex((f) => !f.actionable);
    const lastActionable = result.failures.map((f) => f.actionable).lastIndexOf(true);
    expect(lastActionable).toBeLessThan(firstIntrinsic);
  });

  it('is monotonic in passenger count: feasible at capacity implies feasible below', () => {
    const atCapacity = evaluate(workhorse, alpha, [beta], planets, workhorse.capacity);
    expect(atCapacity.feasible).toBe(true);
    for (let n = 1; n < workhorse.capacity; n += 1) {
      expect(evaluate(workhorse, alpha, [beta], planets, n).feasible).toBe(true);
    }
  });
});

describe('evaluateFleet', () => {
  it('lists feasible craft before infeasible ones', () => {
    const results = evaluateFleet([fragile, workhorse], alpha, [beta], planets, 2);
    expect(results[0]?.spacecraftId).toBe('workhorse');
    expect(results[0]?.feasible).toBe(true);
    expect(results[1]?.feasible).toBe(false);
  });
});
