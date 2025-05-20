// coachingTools.js
// Generate AI-driven coaching blurbs

export function generateCoachingSummary(agentStats) {
  const { name, totalCalls, flaggedCalls, positiveCalls, avgDuration } = agentStats;
  const positiveRate = ((positiveCalls / totalCalls) * 100).toFixed(1);
  const flaggedRate = ((flaggedCalls / totalCalls) * 100).toFixed(1);

  return `
Agent ${name} has handled ${totalCalls} calls.
✅ ${positiveRate}% were positive (${positiveCalls} calls).
🚩 ${flaggedRate}% raised flags (${flaggedCalls} calls).
Average call duration: ${avgDuration.toFixed(1)} min.

Recommendation:
- Praise for positivity rate if >75%.
- Coaching needed if flagged rate >25%.
  `.trim();
}
