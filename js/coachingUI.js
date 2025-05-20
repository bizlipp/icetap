// coachingUI.js
// UI rendering for coaching tools

export function renderAgentStoryCard(agent) {
  const card = document.createElement('div');
  card.className = 'dashboard-card';
  card.innerHTML = `
    <div class="card-header">${agent.name}</div>
    <div style="padding: 10px;">
      <p><strong>Total Calls:</strong> ${agent.totalCalls}</p>
      <p><strong>Positive Calls:</strong> ${agent.positiveCalls}</p>
      <p><strong>Flagged Calls:</strong> ${agent.flaggedCalls}</p>
      <p><strong>Avg Duration:</strong> ${agent.avgDuration.toFixed(1)} min</p>
    </div>
  `;
  return card;
}
