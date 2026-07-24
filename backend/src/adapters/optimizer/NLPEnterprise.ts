import type { IOptimizer, OptimizeResult, Point, Stop } from './IOptimizer.js';

/**
 * STUB (V3): NLP Enterprise fleet optimizer (multi-depot, traffic-aware).
 */
export class NLPEnterprise implements IOptimizer {
  readonly name = 'nlp-enterprise';
  optimize(_stops: Stop[], _start: Point): OptimizeResult {
    throw Object.assign(new Error('NLPEnterprise is a V3 stub'), { status: 501 });
  }
}
