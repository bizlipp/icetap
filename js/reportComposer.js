// reportComposer.js
// Generate markdown-style summaries for Outlook or internal reports

export function generateEODReport(agentData) {
  return agentData.map(agent => {
    return \`📌 Agent: \${agent.name}
- Calls Handled: \${agent.totalCalls}
- Positivity Rate: \${((agent.positiveCalls / agent.totalCalls) * 100).toFixed(1)}%
- Avg Duration: \${agent.avgDuration.toFixed(1)} min
- Flags: \${agent.flaggedCalls}
\`;
  }).join('\n\n');
}
