/** Pure, fail-closed OOS model-promotion policy. */
export const PROMOTION_POLICY = Object.freeze({
    minimumOutOfSampleDays: 252,
    minimumDirectionalAccuracyImprovementPp: 0.05,
    coverage90Range: [0.85, 0.95],
    requireIndependentApproval: true
});

export function assessPromotion({ baseline, candidate, policy = PROMOTION_POLICY } = {}) {
    const n = Number(candidate?.sampleSize);
    const baseAccuracy = Number(baseline?.directionalAccuracy);
    const candidateAccuracy = Number(candidate?.directionalAccuracy);
    const coverage90 = Number(candidate?.coverage90);
    if (![n, baseAccuracy, candidateAccuracy, coverage90].every(Number.isFinite)) {
        return { promoted: false, status: 'candidate_evidence_unavailable', reasons: ['candidate evidence unavailable'] };
    }
    const [low, high] = policy.coverage90Range;
    const improvementPp = candidateAccuracy - baseAccuracy;
    const reasons = [];
    if (n < policy.minimumOutOfSampleDays) reasons.push('insufficient out-of-sample days');
    if (improvementPp < policy.minimumDirectionalAccuracyImprovementPp) reasons.push('directional improvement below gate');
    if (coverage90 < low || coverage90 > high) reasons.push('90% interval coverage outside gate');
    if (policy.requireIndependentApproval && candidate?.independentApproval !== true) {
        reasons.push('independent promotion approval missing');
    }
    return {
        promoted: reasons.length === 0,
        status: reasons.length === 0 ? 'rolling_validation_promoted' : 'baseline_pending_rolling_validation',
        improvementPp,
        reasons
    };
}
