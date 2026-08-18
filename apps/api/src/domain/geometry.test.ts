import { alpha, beta, gamma, inner, planets } from './__fixtures__/planets';
import {
  clearanceFor,
  detourFor,
  planetsBetween,
  radiusOf,
  surfaceDistanceBetween,
} from './geometry';

describe('surfaceDistanceBetween', () => {
  it('is zero for a planet and itself', () => {
    expect(surfaceDistanceBetween(alpha, alpha)).toBe(0);
    expect(surfaceDistanceBetween(gamma, gamma)).toBe(0);
  });

  it('subtracts both radii from the centre-to-centre gap', () => {
    // centres 1000 apart, radii 100 and 200
    expect(surfaceDistanceBetween(alpha, beta)).toBe(700);
  });

  it('is symmetric', () => {
    expect(surfaceDistanceBetween(alpha, gamma)).toBe(surfaceDistanceBetween(gamma, alpha));
  });

  it('is direction independent for inward and outward travel', () => {
    // inner is 600 nearer the sun than alpha; radii 50 and 100
    expect(surfaceDistanceBetween(alpha, inner)).toBe(450);
  });

  it('never returns a negative distance for overlapping bodies', () => {
    const bloated = { ...beta, diameterKm: 10_000 };
    expect(surfaceDistanceBetween(alpha, bloated)).toBe(0);
  });
});

describe('planetsBetween', () => {
  it('returns bodies strictly between the endpoints', () => {
    expect(planetsBetween(alpha, gamma, planets).map((p) => p.id)).toEqual(['beta']);
  });

  it('excludes the endpoints themselves', () => {
    expect(planetsBetween(alpha, beta, planets)).toHaveLength(0);
  });

  it('is symmetric', () => {
    expect(planetsBetween(gamma, alpha, planets).map((p) => p.id)).toEqual(['beta']);
  });

  it('returns bodies in ascending order of distance from the sun', () => {
    expect(planetsBetween(inner, gamma, planets).map((p) => p.id)).toEqual(['alpha', 'beta']);
  });
});

describe('detourFor', () => {
  it('is a semicircle over the body', () => {
    expect(detourFor(beta)).toBeCloseTo(Math.PI * 200, 6);
  });

  it('exceeds the diameter it replaces', () => {
    expect(detourFor(beta)).toBeGreaterThan(2 * radiusOf(beta));
  });
});

describe('clearanceFor', () => {
  it('is the arc less the crossing it replaces', () => {
    expect(clearanceFor(beta)).toBeCloseTo(Math.PI * 200 - 400, 6);
  });

  /* The whole point of the distinction: a straight surface-to-surface line has
     already paid to cross a body in the middle, so only the excess is added. */
  it('is a little over one radius, not a little over three', () => {
    expect(clearanceFor(beta)).toBeCloseTo(1.14159 * radiusOf(beta), 2);
    expect(clearanceFor(beta)).toBeLessThan(detourFor(beta));
  });

  it('is positive, so going around is never cheaper than going through', () => {
    expect(clearanceFor(beta)).toBeGreaterThan(0);
  });
});
