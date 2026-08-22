import type { Planet } from './types';

export interface Stage {
  body: Planet;
  isDeparture: boolean;
  isSelected: boolean;
  isPassed: boolean;
  isOnRoute: boolean;
}
