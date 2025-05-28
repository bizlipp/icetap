/**
 * sitestatus.js - SiteStatus Summary Report Renderer
 * Generates AI-supported summary report for the ICETAP Reports Dashboard.
 */

window.renderSiteStatusReport = async function (calls) {
    if (!Array.isArray(calls) || calls.length === 0) {
      document.getElementById("siteStatusContainer").innerHTML = `<p class='no-data-message'>No calls loaded or analyzed. Please load audit data first.</p>`;
      return;
    }
  
    // Ensure AI module is available
    if (!window.AI) {
      console.error("AI module not available. Cannot generate SiteStatus report.");
      return;
    }
  
    const summary = {
      intro: AI.generateIntroSummary(calls),
      keyFocus: AI.generateKeyFocusPoints(calls),
      positive: AI.generatePositiveCallNarrative(calls),
      repeatDrivers: AI.summarizeRepeatDrivers(calls),
      sentiment: AI.analyzeAgentSentimentTrajectory(calls),
      escalationWatch: AI.extractEscalationWatch(calls),
      coachingThemes: AI.generateCoachingThemes(calls),
      missedOpportunities: AI.generateMissedOpportunities(calls),
      outlookSummary: AI.generateOutlookSummary(calls)
    };
  
    // Detect which container ID is present in the current page
    const containerID = document.getElementById("siteStatusContainer") ? "siteStatusContainer" : "siteStatusInsights";
    const container = document.getElementById(containerID);
    
    if (!container) {
      console.error(`Neither "siteStatusContainer" nor "siteStatusInsights" element found in document.`);
      return;
    }
  
    // Render using the reordered section layout and enhanced blocks
    container.innerHTML = `
      ${renderSummaryStatsBlock(calls)}
      ${renderKeyFocusBlock(summary.keyFocus)}
      ${renderRepeatDriversBlock(summary.repeatDrivers)}
      ${renderEscalationWatchBlock(summary.escalationWatch)}
      ${renderPositiveCallsBlock(summary.positive)}
      ${renderCoachingThemesBlock(summary.coachingThemes)}
      ${renderSentimentTrajectoryBlock(summary.sentiment)}
      ${renderMissedOpportunitiesBlock(summary.missedOpportunities)}
      ${renderOutlookSnippetBlock(summary.outlookSummary)}
      <div class="mt-6">
        <button id="exportSiteStatusHTML" class="button success"><i class="fas fa-file-code mr-1"></i>Export for Outlook</button>
      </div>
    `;
    
    // Add the new blocks
    container.innerHTML += renderPhraseInsightBlock(calls);
    container.innerHTML += renderTimingInsightBlock(calls);
    
    // Add clipboard copy functionality for the Outlook snippet
    setupClipboardCopy();
  
    // Export button handler - a more complete HTML export with all sections
    document.getElementById("exportSiteStatusHTML")?.addEventListener("click", () => {
      const htmlContent = `<!DOCTYPE html><html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Calibri, sans-serif; color: #333; line-height: 1.4; max-width: 900px; margin: 0 auto; padding: 20px; }
          h2 { color: #0066cc; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
          h3 { color: #333; margin-top: 20px; }
          .highlight { background-color: #f5f5f5; padding: 10px; border-left: 3px solid #0066cc; }
          .success { color: #2e7d32; }
          .warning { color: #ff8f00; }
          .danger { color: #c62828; }
          ul { padding-left: 20px; }
          footer { margin-top: 30px; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 10px; }
        </style>
      </head>
      <body>
        <h2>📊 Site Status Summary Report</h2>
        <p class="highlight">${summary.intro}</p>
  
        <h3>⚡ Key Focus Areas</h3>
        <ul>
          ${summary.keyFocus.map(f => `<li>${f}</li>`).join('')}
        </ul>
  
        <h3>✅ Positive Call Highlights</h3>
        <ul class="success">
          ${summary.positive.examples.map(e => `<li>${e}</li>`).join('')}
        </ul>
        <p><em>${summary.positive.summary}</em></p>
  
        <h3>🚩 Escalation Watch</h3>
        <ul class="danger">
          ${summary.escalationWatch.length > 0 
            ? summary.escalationWatch.map(e => `<li>${e}</li>`).join('') 
            : '<li>No high-risk calls flagged this period.</li>'}
        </ul>
  
        <h3>🔁 Repeat Contact Drivers</h3>
        <p>${summary.repeatDrivers}</p>
  
        <h3>📚 Coaching Themes</h3>
        <ul>
          ${summary.coachingThemes.map(t => `<li>${t.replace('Address coaching around: ', '')}</li>`).join('')}
        </ul>
  
        <h3>📉 Agent Sentiment Trajectories</h3>
        <p>
          <strong class="success">Improving:</strong> ${summary.sentiment.topAgents.join(', ') || 'None'}<br>
          <strong class="warning">Needs Attention:</strong> ${summary.sentiment.strugglingAgents.join(', ') || 'None'}
        </p>
  
        <h3>💡 Missed Opportunities</h3>
        <ul class="warning">
          ${summary.missedOpportunities.length > 0 
            ? summary.missedOpportunities.map(o => `<li>${o}</li>`).join('') 
            : '<li>No missed opportunities detected.</li>'}
        </ul>
  
        <h3>📋 Summary Statistics</h3>
        <ul>
          ${summary.outlookSummary.map(s => `<li>${s}</li>`).join('')}
        </ul>
        
        <footer>
          Generated by ICETAP SiteStatus Report on ${new Date().toLocaleDateString()}
        </footer>
      </body>
      </html>`;
  
      const blob = new Blob([htmlContent], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SiteStatusReport_${new Date().toISOString().slice(0,10)}.html`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };
  
// Render the summary statistics block
function renderSummaryStatsBlock(calls) {
  const range = AI._getDateRange(calls);
  const agentCount = new Set(calls.map(c => c.agent || "Unknown")).size;
  const positiveCount = calls.filter(c => (c.positiveFlags || []).length > 0).length;
  const repeatCount = calls.filter(c => c.repeat).length;
  const positiveRate = calls.length > 0 ? Math.round((positiveCount / calls.length) * 100) : 0;

  return `
    <div class="card p-4 mb-4 highlight-section">
      <h3 class="text-lg font-semibold site-highlight-purple mb-2">📊 Summary Overview</h3>
      <div class="text-sm grid grid-cols-2 gap-2">
        <div><strong>📅 Date Range:</strong> ${range.start} – ${range.end}</div>
        <div><strong>🔍 Calls Reviewed:</strong> ${calls.length}</div>
        <div><strong>👥 Agents Audited:</strong> ${agentCount}</div>
        <div><strong>✅ Positive Call Rate:</strong> ${positiveRate}%</div>
        <div><strong>🔁 Repeat Contacts:</strong> ${repeatCount}</div>
        <div><strong>📝 Generated:</strong> ${new Date().toLocaleString()}</div>
      </div>
    </div>
  `;
}

// Render key focus areas block
function renderKeyFocusBlock(keyFocus) {
  if (!keyFocus || keyFocus.length === 0) return '';
  
  return `
    <div class="card p-4 mt-4">
      <h3 class="text-lg font-semibold site-highlight-yellow mb-2">⚡ Key Focus Areas</h3>
      <ul class="list-disc ml-5">
        ${keyFocus.map(f => `<li class="mb-1">${f}</li>`).join('')}
      </ul>
    </div>
  `;
}

// Render repeat drivers block
function renderRepeatDriversBlock(repeatDrivers) {
  if (!repeatDrivers) return '';
  
  return `
    <div class="card p-4 mt-4">
      <h3 class="text-lg font-semibold text-blue-300 mb-2">🔁 Repeat Contact Drivers</h3>
      <p>${repeatDrivers}</p>
    </div>
  `;
}

// Render escalation watch block
function renderEscalationWatchBlock(escalationWatch) {
  if (!escalationWatch) return '';
  
  return `
    <div class="card p-4 mt-4">
      <h3 class="text-lg font-semibold site-highlight-red mb-2">🚩 Escalation Watch</h3>
      <ul class="list-disc ml-5">
        ${escalationWatch.length > 0 
          ? escalationWatch.map(e => `<li class="mb-1">${e}</li>`).join('') 
          : '<li>No high-risk calls flagged this period.</li>'}
      </ul>
    </div>
  `;
}

// Render positive calls block with takeaways
function renderPositiveCallsBlock(positive) {
  if (!positive || !positive.examples) return '';
  
  // Add takeaways based on examples content
  const examplesWithTakeaways = positive.examples.map(example => {
    let takeaway = "Valuable customer interaction";
    
    // Extract potential keywords from the example
    if (example.toLowerCase().includes("empathy") || example.toLowerCase().includes("rapport")) {
      takeaway = "Takeaway: Strong emotional connection built with customer";
    } else if (example.toLowerCase().includes("resolution") || example.toLowerCase().includes("solved")) {
      takeaway = "Takeaway: Effective problem resolution under pressure";
    } else if (example.toLowerCase().includes("clarity") || example.toLowerCase().includes("explain")) {
      takeaway = "Takeaway: Clear explanation in a tense moment";
    } else if (example.toLowerCase().includes("policy") || example.toLowerCase().includes("procedure")) {
      takeaway = "Takeaway: Excellent policy explanation without frustrating customer";
    }
    
    return `<li class="mb-2">${example}<br><span class="site-highlight-green">${takeaway}</span></li>`;
  });
  
  return `
    <div class="card p-4 mt-4">
      <h3 class="text-lg font-semibold site-highlight-green mb-2">✅ Positive Call Highlights</h3>
      <ul class="list-disc ml-5">
        ${examplesWithTakeaways.join('')}
      </ul>
      <p class="text-sm italic mt-3">${positive.summary}</p>
    </div>
  `;
}

// Render coaching themes block with improved formatting
function renderCoachingThemesBlock(themes) {
  if (!themes || themes.length === 0) return '';
  
  return `
    <div class="card p-4 mt-4">
      <h3 class="text-lg font-semibold site-highlight-yellow mb-2">📚 Coaching Themes</h3>
      <ul class="list-disc ml-5">
        ${themes.map(t => `<li>${t.replace('Address coaching around: ', '')}</li>`).join('')}
      </ul>
    </div>
  `;
}

// Render sentiment trajectory block
function renderSentimentTrajectoryBlock(sentiment) {
  if (!sentiment) return '';
  
  const improving = sentiment.topAgents && sentiment.topAgents.length > 0 
    ? sentiment.topAgents.join(', ') 
    : 'None identified in this period';
    
  const needsAttention = sentiment.strugglingAgents && sentiment.strugglingAgents.length > 0 
    ? sentiment.strugglingAgents.join(', ') 
    : 'None identified in this period';
  
  return `
    <div class="card p-4 mt-4">
      <h3 class="text-lg font-semibold text-purple-300 mb-2">📈 Agent Sentiment Trajectories</h3>
      <p>
        <span class="site-highlight-green">Improving:</span> ${improving}<br>
        <span class="site-highlight-red">Needs Attention:</span> ${needsAttention}
      </p>
    </div>
  `;
}

// Render missed opportunities block with enhanced root cause analysis
function renderMissedOpportunitiesBlock(opportunities) {
  if (!opportunities || opportunities.length === 0) {
    return `
      <div class="card p-4 mt-4">
        <h3 class="text-lg font-semibold text-orange-300 mb-2">💡 Missed Opportunities</h3>
        <p>No missed opportunities detected in this period.</p>
      </div>
    `;
  }
  
  // Enhance opportunities with additional context
  const enhancedOpportunities = opportunities.map(opp => {
    // Extract customer ID and root cause if available
    const customerMatch = opp.match(/Customer\s+([^\s]+)/);
    const customerId = customerMatch ? customerMatch[1] : 'Unknown';
    
    // Extract time frame information if available
    let timeframeInfo = "";
    if (opp.includes("recontacted") && !opp.includes("within")) {
      timeframeInfo = "within follow-up period";
    }
    
    // Extract root cause if available
    let rootCause = opp.includes("Root cause") ? opp : `${opp} Root cause likely: policy or expectation gap.`;
    
    return `<li class="mb-1">${rootCause}</li>`;
  });
  
  return `
    <div class="card p-4 mt-4">
      <h3 class="text-lg font-semibold text-orange-300 mb-2">💡 Missed Opportunities</h3>
      <ul class="list-disc ml-5">
        ${enhancedOpportunities.join('')}
      </ul>
    </div>
  `;
}

// Render outlook snippet block
function renderOutlookSnippetBlock(lines) {
  if (!lines || lines.length === 0) return '';
  
  return `
    <div class="card p-4 mt-4 bg-gray-900 text-sm">
      <h3 class="text-md font-semibold text-blue-300 mb-2">📧 Outlook Email Snippet</h3>
      <pre id="outlookSnippet" class="bg-gray-800 p-2 rounded">${lines.join('\n')}</pre>
      <button id="copyOutlookButton" class="button small mt-2">📋 Copy to Clipboard</button>
    </div>
  `;
}

// Render phrase insight block
function renderPhraseInsightBlock(calls) {
  const { customer, agent } = AI.extractFrequentPhrasesBySpeaker(calls);

  return `
    <div class="card p-4 mt-4">
      <h3 class="text-lg font-semibold text-blue-300 mb-2">🧠 Language Pattern Highlights</h3>
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <h4 class="text-yellow-400 font-medium mb-1">Top Customer Phrases</h4>
          <ul class="list-disc ml-5">
            ${customer.map(([p, c]) => `<li>${p} (${c})</li>`).join('')}
          </ul>
        </div>
        <div>
          <h4 class="text-green-300 font-medium mb-1">Top Agent Phrases</h4>
          <ul class="list-disc ml-5">
            ${agent.map(([p, c]) => `<li>${p} (${c})</li>`).join('')}
          </ul>
        </div>
      </div>
    </div>
  `;
}

// Render timing insight block
function renderTimingInsightBlock(calls) {
  let totalDeadAir = 0, delayedResponses = 0, maxSilence = 0, reviewed = 0;

  for (const call of calls) {
    const t = AI.analyzeTranscriptGaps(call);
    if (!t) continue;
    totalDeadAir += t.deadAirInstances;
    delayedResponses += t.delayedAgentResponses;
    if (t.longestSilence > maxSilence) maxSilence = t.longestSilence;
    reviewed++;
  }

  return `
    <div class="card p-4 mt-4">
      <h3 class="text-lg font-semibold text-purple-300 mb-2">🕒 Timing Irregularities</h3>
      <p class="text-sm text-gray-300">
        Out of ${reviewed} calls analyzed:
        <ul class="list-disc ml-5 mt-1">
          <li>Dead air instances detected: <strong>${totalDeadAir}</strong></li>
          <li>Delayed agent replies: <strong>${delayedResponses}</strong></li>
          <li>Longest silent gap recorded: <strong>${maxSilence.toFixed(1)}s</strong></li>
        </ul>
      </p>
    </div>
  `;
}

// Setup clipboard copy functionality
function setupClipboardCopy() {
  document.getElementById("copyOutlookButton")?.addEventListener("click", () => {
    const text = document.getElementById("outlookSnippet")?.innerText;
    if (text) {
      navigator.clipboard.writeText(text)
        .then(() => {
          const btn = document.getElementById("copyOutlookButton");
          const originalText = btn.innerText;
          btn.innerText = "✅ Copied!";
          setTimeout(() => {
            btn.innerText = originalText;
          }, 2000);
        })
        .catch(err => {
          console.error("Failed to copy text: ", err);
          alert("Failed to copy to clipboard. Please try again.");
        });
    }
  });
}

// Helper function to copy Outlook summary
function copyOutlookSummary() {
  const text = document.querySelector("#outlookSnippet")?.innerText;
  if (text) {
    navigator.clipboard.writeText(text)
      .then(() => alert("Summary copied to clipboard!"))
      .catch(err => {
        console.error("Failed to copy text: ", err);
        alert("Failed to copy to clipboard. Please try again.");
      });
  }
}
  