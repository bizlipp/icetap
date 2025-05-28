document.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('analyticsDashboard');
  const totalEl = document.getElementById('anTotalCalls');
  const avgEl = document.getElementById('anAvgDuration');
  const posEl = document.getElementById('anPositiveFlags');
  const flagList = document.getElementById('anTopFlags');
  const fileDisplay = document.getElementById('analyticsFilenameDisplay');

  if (!window.DataStackULTRA || !window.CallAnalyzer) {
    console.error("DataStackULTRA or CallAnalyzer is not available. Analytics cannot load.");
    if (fileDisplay) fileDisplay.textContent = "⚠️ Critical components missing. Analytics disabled.";
    if (root) root.innerHTML = '<p class="no-data-message dashboard-section"><i class="fas fa-info-circle mr-2"></i>Error: Critical components (DataStackULTRA or CallAnalyzer) missing. Analytics cannot be loaded.</p>';
    return;
  }

  let calls = [];
  let activeFile = 'No file loaded';

  try {
    calls = await window.DataStackULTRA.get('loadedCalls', []);
    activeFile = await window.DataStackULTRA.get('activeAuditFile', 'No file information');

    // Log the first call object to inspect its structure
    if (calls && calls.length > 0) {
      console.log("Analytics Dashboard - First call object received from DataStackULTRA:", JSON.stringify(calls[0], (key, value) => {
        if (value instanceof Date) return value.toISOString(); // Nicer date logging
        if (key === 'transcript' && Array.isArray(value) && value.length > 5) return `Transcript Array (${value.length} entries - Truncated)`;
        if (typeof value === 'string' && value.length > 200) return `${value.substring(0,100)}... (Truncated String)`;
        return value;
      }, 2));
    } else {
      console.log("Analytics Dashboard - No calls received from DataStackULTRA or calls array is empty.");
    }

    if (fileDisplay) {
      fileDisplay.textContent = activeFile ? `File: ${activeFile}` : 'No file loaded';
    }

    if (!Array.isArray(calls) || calls.length === 0) {
      if (totalEl) totalEl.textContent = '0';
      if (avgEl) avgEl.textContent = '0:00';
      if (posEl) posEl.textContent = '0';
      if (flagList) flagList.innerHTML = '<li>No data available to display analytics.</li>';
      // Clear chart if it exists and there's no data
      const hourlyChartCanvas = document.getElementById('hourlyChart');
      if (hourlyChartCanvas) {
          const existingChart = Chart.getChart(hourlyChartCanvas);
          if (existingChart) {
              existingChart.destroy();
          }
          hourlyChartCanvas.getContext('2d').clearRect(0, 0, hourlyChartCanvas.width, hourlyChartCanvas.height);
          // Optionally display a message on the chart area
          // hourlyChartCanvas.getContext('2d').fillText("No data for chart", hourlyChartCanvas.width / 2, hourlyChartCanvas.height / 2);
      }
      console.log("Analytics: No calls data found in DataStackULTRA.");
      return;
    }

    console.log(`📦 Analytics: Loaded ${calls.length} calls from DataStackULTRA.`);
    if (fileDisplay && activeFile) { // Update again in case calls were loaded but file info was separate
        fileDisplay.textContent = `File: ${activeFile} (${calls.length} calls)`;
    }

    // Process new AI features if available
    if (window.CallAnalyzer) {
      // Mark repeat contacts
      if (typeof window.CallAnalyzer.markRepeatCalls === 'function') {
        window.CallAnalyzer.markRepeatCalls(calls);
        console.log("✅ Applied repeat call detection");
      }
      
      // Process timing analysis for calls with transcripts
      if (typeof window.CallAnalyzer.analyzeTranscriptGaps === 'function') {
        let callsWithTimingAnalysis = 0;
        calls.forEach(call => {
          if (call.transcript && call.transcript.length > 0) {
            window.CallAnalyzer.analyzeTranscriptGaps(call);
            callsWithTimingAnalysis++;
          }
        });
        console.log(`✅ Applied timing analysis to ${callsWithTimingAnalysis} calls with transcripts`);
      }
    }

    // === STATS ===
    // Assuming calls from DataStackULTRA are pre-analyzed by CallAnalyzer
    // and include properties like 'durationMinutes'.
    totalEl.textContent = calls.length;
    
    const durationsMinutes = calls.map(c => c.durationMinutes || 0); // Use pre-analyzed durationMinutes
    const totalMinutes = durationsMinutes.reduce((sum, d) => sum + d, 0);
    const avgMinutes = calls.length > 0 ? totalMinutes / calls.length : 0;
    avgEl.textContent = formatDuration(avgMinutes * 60); // formatDuration expects seconds

    // === POSITIVE FLAGS ===
    // Assuming 'positiveFlags' array is present from pre-analysis
    const positiveFlags = {};
    calls.forEach(c => (c.positiveFlags || []).forEach(f => positiveFlags[f] = (positiveFlags[f] || 0) + 1));
    const posCount = Object.values(positiveFlags).reduce((a, b) => a + b, 0);
    posEl.textContent = posCount;

    // === TOP FLAGS ===
    // Assuming 'flags' array is present from pre-analysis
    const allFlags = {};
    calls.forEach(c => (c.flags || []).forEach(f => allFlags[f] = (allFlags[f] || 0) + 1));
    const topFlags = Object.entries(allFlags).sort((a, b) => b[1] - a[1]).slice(0, 10);
    flagList.innerHTML = topFlags.length
      ? topFlags.map(([f, c]) => `<li><strong>${f}</strong>: ${c}</li>`).join('')
      : '<li>No flagged categories found.</li>';

    // === HOURLY CHART ===
    const hourlyCounts = new Array(24).fill(0);
    calls.forEach(c => {
      // Use pre-analyzed 'startTime' which should be a Date object
      const startTime = c.startTime instanceof Date ? c.startTime : (c.meta?.["Initiation timestamp"] ? new Date(c.meta["Initiation timestamp"]) : null);
      if (startTime) {
        const h = startTime.getHours();
        if (!isNaN(h)) hourlyCounts[h]++;
      }
    });

    const hourlyCtx = document.getElementById('hourlyChart').getContext('2d');
    // Clear previous chart instance if any
    const existingHourlyChart = Chart.getChart(hourlyCtx.canvas);
    if (existingHourlyChart) {
        existingHourlyChart.destroy();
    }
    new Chart(hourlyCtx, {
      type: 'bar',
      data: {
        labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
        datasets: [{
          label: 'Calls',
          data: hourlyCounts,
          backgroundColor: '#a43ec9'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true } }
      }
    });

    // === ADVANCED FLAG ANALYSIS ===
    renderFlagPercentages(calls, 'anFlagPercentages');
    renderFlagCooccurrences(calls, 'anFlagCooccurrences');
    renderFlagsOverTimeChart(calls, 'flagsOverTimeChart', 'flagsOverTimeMessage');

    // === NEW FEATURE: PHRASE ANALYSIS ===
    renderPhraseAnalysis(calls);

    // === NEW FEATURE: TIMING ANALYSIS === 
    renderTimingAnalysis(calls);

    // Count repeat calls
    const repeatCalls = calls.filter(call => call.repeat === true).length;
    if (repeatCalls > 0) {
      const repeatWarning = document.createElement('div');
      repeatWarning.className = 'repeat-calls-warning dashboard-section';
      repeatWarning.innerHTML = `
        <h3><i class="fas fa-sync-alt mr-2"></i>Repeat Customer Calls</h3>
        <p class="warning-text"><strong>${repeatCalls}</strong> repeat customer calls detected (${Math.round((repeatCalls/calls.length)*100)}% of total).</p>
      `;
      root.appendChild(repeatWarning);
    }

  } catch (err) {
    console.error("❌ Error rendering analytics:", err);
    if (root) root.innerHTML += `<div class="status-message error-message card mt-4"><i class="fas fa-exclamation-triangle mr-2"></i>Analytics rendering failed due to an error. ${err.message}</div>`;
    if (fileDisplay) fileDisplay.textContent = "⚠️ Error loading analytics data.";
  }
});

// === Helpers ===
// Removed local parseDuration as we now use call.durationMinutes from pre-analyzed calls.

function formatDuration(seconds) { // Keep this local helper if specific HH:MM:SS format is needed
  seconds = Math.floor(seconds || 0); // Ensure seconds is a number, default to 0
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// === ADVANCED FLAG ANALYSIS FUNCTIONS ===

function renderFlagPercentages(calls, elementId) {
  const flagPercentagesEl = document.getElementById(elementId);
  if (!flagPercentagesEl) return;

  const flagCounts = {};
  let totalFlags = 0;
  calls.forEach(call => {
    (call.flags || []).forEach(flag => {
      flagCounts[flag] = (flagCounts[flag] || 0) + 1;
      totalFlags++;
    });
  });

  if (totalFlags === 0) {
    flagPercentagesEl.innerHTML = '<li>No flags found to calculate percentages.</li>';
    return;
  }

  const percentages = Object.entries(flagCounts)
    .map(([flag, count]) => ({ flag, count, percentage: (count / totalFlags) * 100 }))
    .sort((a, b) => b.percentage - a.percentage);

  flagPercentagesEl.innerHTML = percentages.length
    ? percentages.map(p => `<li><strong>${p.flag}</strong>: ${p.count} (${p.percentage.toFixed(1)}%)</li>`).join('')
    : '<li>No flags available.</li>';
}

function renderFlagCooccurrences(calls, elementId, minCooccurrence = 2) {
  const cooccurrenceEl = document.getElementById(elementId);
  if (!cooccurrenceEl) return;

  const cooccurrenceMap = {}; // e.g., { "FlagA|FlagB": count }

  calls.forEach(call => {
    const flags = call.flags ? [...new Set(call.flags)].sort() : []; // Unique flags, sorted for consistent key generation
    if (flags.length >= 2) {
      for (let i = 0; i < flags.length; i++) {
        for (let j = i + 1; j < flags.length; j++) {
          const key = `${flags[i]}|${flags[j]}`;
          cooccurrenceMap[key] = (cooccurrenceMap[key] || 0) + 1;
        }
      }
    }
  });

  const sortedCooccurrences = Object.entries(cooccurrenceMap)
    .filter(([_, count]) => count >= minCooccurrence)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10); // Show top 10

  if (sortedCooccurrences.length === 0) {
    cooccurrenceEl.innerHTML = `<li>No significant flag co-occurrences found (min. ${minCooccurrence}).</li>`;
    return;
  }

  cooccurrenceEl.innerHTML = sortedCooccurrences
    .map(([pair, count]) => {
      const [flagA, flagB] = pair.split('|');
      return `<li><strong>${flagA} & ${flagB}</strong>: ${count} times</li>`;
    })
    .join('');
}

function renderFlagsOverTimeChart(calls, canvasId, messageId) {
  const canvas = document.getElementById(canvasId);
  const messageEl = document.getElementById(messageId);
  if (!canvas || !messageEl) return;

  const flagsOverTimeCtx = canvas.getContext('2d');
  messageEl.textContent = 'Processing data for flags over time chart...';

  // Get top N flags to track (e.g., top 5 by overall frequency)
  const flagCounts = {};
  calls.forEach(call => {
    (call.flags || []).forEach(flag => flagCounts[flag] = (flagCounts[flag] || 0) + 1);
  });
  const topNFlags = Object.entries(flagCounts)
                      .sort((a,b) => b[1] - a[1])
                      .slice(0, 5)
                      .map(entry => entry[0]);

  if (topNFlags.length === 0) {
    messageEl.textContent = 'No flags found to generate a time-series chart.';
    return;
  }
  
  // Aggregate flag counts by date
  const flagTrends = {}; // { "YYYY-MM-DD": { "FlagA": count, "FlagB": count } }
  calls.forEach(call => {
    const callTime = call.startTime instanceof Date ? call.startTime : (call.meta?.["Initiation timestamp"] ? new Date(call.meta["Initiation timestamp"]) : null);
    if (callTime && call.flags && call.flags.length > 0) {
      const dateKey = callTime.toISOString().split('T')[0]; // YYYY-MM-DD
      if (!flagTrends[dateKey]) {
        flagTrends[dateKey] = {};
      }
      (call.flags || []).forEach(flag => {
        if (topNFlags.includes(flag)) { // Only track top N flags
          flagTrends[dateKey][flag] = (flagTrends[dateKey][flag] || 0) + 1;
        }
      });
    }
  });

  const sortedDates = Object.keys(flagTrends).sort();
  if (sortedDates.length < 2) { // Need at least 2 data points for a meaningful line chart
    messageEl.textContent = 'Not enough distinct date points to render a trend chart for flags.';
    return;
  }

  const datasets = topNFlags.map((flag, index) => {
    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];
    return {
      label: flag,
      data: sortedDates.map(date => flagTrends[date][flag] || 0),
      borderColor: colors[index % colors.length],
      backgroundColor: colors[index % colors.length] + '40', // Add some transparency for area fill if used
      fill: false,
      tension: 0.1
    };
  });

  // Clear previous chart instance if any
  const existingFlagsOverTimeChart = Chart.getChart(flagsOverTimeCtx.canvas);
  if (existingFlagsOverTimeChart) {
      existingFlagsOverTimeChart.destroy();
  }

  new Chart(flagsOverTimeCtx, {
    type: 'line',
    data: {
      labels: sortedDates,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, stacked: false },
        x: { type: 'time', time: { unit: 'day', tooltipFormat: 'MMM dd, yyyy' } }
      },
      plugins: {
        legend: { position: 'top' },
        tooltip: { mode: 'index', intersect: false }
      }
    }
  });
  messageEl.textContent = 'Top flags over time displayed.';
  if (datasets.length === 0) messageEl.textContent = 'No data to display for top flags over time.';
}

// === NEW FEATURE: PHRASE ANALYSIS ===
function renderPhraseAnalysis(calls) {
  // Check if the CallAnalyzer.extractFrequentPhrasesBySpeaker function exists
  if (!window.CallAnalyzer || typeof window.CallAnalyzer.extractFrequentPhrasesBySpeaker !== 'function') {
    console.warn("CallAnalyzer.extractFrequentPhrasesBySpeaker is not available, skipping phrase analysis");
    return;
  }

  // Only process calls with transcripts
  const callsWithTranscripts = calls.filter(call => call.transcript && call.transcript.length > 0);
  
  if (callsWithTranscripts.length === 0) {
    console.log("No calls with transcripts found for phrase analysis");
    return;
  }
  
  try {
    // Get phrase data using the new AI feature
    const phraseData = window.CallAnalyzer.extractFrequentPhrasesBySpeaker(callsWithTranscripts);
    
    if (!phraseData || (!phraseData.agent && !phraseData.customer)) {
      console.warn("No phrase data returned from extractFrequentPhrasesBySpeaker");
      return;
    }
    
    // Check if the phrase insight container already exists, if not create it
    let phraseInsightContainer = document.getElementById('phraseInsightContainer');
    if (!phraseInsightContainer) {
      // Create container
      const analyticsDashboard = document.getElementById('analyticsDashboard');
      phraseInsightContainer = document.createElement('div');
      phraseInsightContainer.id = 'phraseInsightContainer';
      phraseInsightContainer.className = 'dashboard-section phrase-analysis-container';
      
      // Append to the dashboard
      analyticsDashboard.appendChild(phraseInsightContainer);
    }
    
    // Build the phrase analysis HTML
    phraseInsightContainer.innerHTML = `
      <h3 class="text-lg font-semibold mb-4"><i class="fas fa-comment-dots mr-2"></i>Phrase Analysis</h3>
      <div class="phrase-columns-wrapper">
        <div class="phrase-column customer-phrases">
          <h3><i class="fas fa-user mr-2"></i>Top Customer Phrases</h3>
          <ul class="phrase-list">
            ${phraseData.customer ? 
              phraseData.customer.map(p => 
                `<li>
                  <span class="phrase-text">${p.phrase}</span>
                  <span class="phrase-count">${p.count}</span>
                </li>`
              ).join('') : 
              '<li>No frequent customer phrases found.</li>'
            }
          </ul>
        </div>
        <div class="phrase-column agent-phrases">
          <h3><i class="fas fa-headset mr-2"></i>Top Agent Phrases</h3>
          <ul class="phrase-list">
            ${phraseData.agent ? 
              phraseData.agent.map(p => 
                `<li>
                  <span class="phrase-text">${p.phrase}</span>
                  <span class="phrase-count">${p.count}</span>
                </li>`
              ).join('') : 
              '<li>No frequent agent phrases found.</li>'
            }
          </ul>
        </div>
      </div>
    `;
    
    console.log("✅ Rendered phrase analysis");
  } catch (error) {
    console.error("Error rendering phrase analysis:", error);
  }
}

// === NEW FEATURE: TIMING ANALYSIS ===
function renderTimingAnalysis(calls) {
  // Check if the necessary function exists
  if (!window.CallAnalyzer || typeof window.CallAnalyzer.analyzeTranscriptGaps !== 'function') {
    console.warn("CallAnalyzer.analyzeTranscriptGaps is not available, skipping timing analysis");
    return;
  }

  // We need to analyze timing data across all calls
  const callsWithTimingData = calls.filter(call => 
    call.transcript && 
    call.transcript.length > 0 && 
    call.timingAnalysis
  );
  
  if (callsWithTimingData.length === 0) {
    console.log("No calls with timing data found");
    return;
  }
  
  try {
    // Aggregate timing metrics across all analyzed calls
    const totalDeadAir = callsWithTimingData.reduce((sum, call) => 
      sum + (call.timingAnalysis?.deadAirInstances?.length || 0), 0);
      
    const totalDelayedResponses = callsWithTimingData.reduce((sum, call) => 
      sum + (call.timingAnalysis?.delayedAgentReplies?.length || 0), 0);
      
    // Find longest silence across all calls
    let longestSilence = 0;
    let longestSilenceCall = null;
    
    callsWithTimingData.forEach(call => {
      if (call.timingAnalysis?.longestSilence?.duration > longestSilence) {
        longestSilence = call.timingAnalysis.longestSilence.duration;
        longestSilenceCall = call;
      }
    });
    
    // Check if the timing container already exists, if not create it
    let timingContainer = document.getElementById('timingAnalysisContainer');
    if (!timingContainer) {
      // Create container
      const analyticsDashboard = document.getElementById('analyticsDashboard');
      timingContainer = document.createElement('div');
      timingContainer.id = 'timingAnalysisContainer';
      timingContainer.className = 'dashboard-section timing-analysis-container';
      
      // Append to the dashboard
      analyticsDashboard.appendChild(timingContainer);
    }
    
    // Build the timing analysis HTML
    timingContainer.innerHTML = `
      <h3 class="text-lg font-semibold mb-4"><i class="fas fa-clock mr-2"></i>Conversation Timing Analysis</h3>
      <div class="timing-metrics-container">
        <div class="timing-metric-card dead-air-card">
          <div class="timing-metric-label">Dead Air Instances</div>
          <div class="timing-metric-value">${totalDeadAir}</div>
          <div class="timing-metric-unit">total instances</div>
        </div>
        
        <div class="timing-metric-card delayed-response-card">
          <div class="timing-metric-label">Delayed Agent Responses</div>
          <div class="timing-metric-value">${totalDelayedResponses}</div>
          <div class="timing-metric-unit">total instances</div>
        </div>
        
        <div class="timing-metric-card longest-silence-card">
          <div class="timing-metric-label">Longest Silence</div>
          <div class="timing-metric-value">${longestSilence.toFixed(1)}</div>
          <div class="timing-metric-unit">seconds</div>
        </div>
      </div>
      
      ${callsWithTimingData.length > 0 ? `
        <div class="timing-detail-section mt-4">
          <h4 class="text-md font-semibold mb-2">Calls with Timing Issues</h4>
          <table class="timing-detail-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Call Date</th>
                <th>Dead Air</th>
                <th>Delayed Responses</th>
                <th>Longest Silence</th>
              </tr>
            </thead>
            <tbody>
              ${callsWithTimingData
                .filter(call => 
                  (call.timingAnalysis?.deadAirInstances?.length > 0) || 
                  (call.timingAnalysis?.delayedAgentReplies?.length > 0))
                .slice(0, 5) // Show top 5 calls with issues
                .map(call => {
                  const agent = call.meta["Agent name"] || call.meta["Agent"] || "Unknown";
                  const date = call.meta["Initiation timestamp"] ? 
                    new Date(call.meta["Initiation timestamp"]).toLocaleDateString() : "Unknown";
                  const deadAir = call.timingAnalysis?.deadAirInstances?.length || 0;
                  const delayedResponses = call.timingAnalysis?.delayedAgentReplies?.length || 0;
                  const longestSilence = call.timingAnalysis?.longestSilence?.duration.toFixed(1) || "0.0";
                  
                  return `
                    <tr>
                      <td>${agent}</td>
                      <td>${date}</td>
                      <td>${deadAir}</td>
                      <td>${delayedResponses}</td>
                      <td>${longestSilence}s</td>
                    </tr>
                  `;
                }).join('')
              }
            </tbody>
          </table>
        </div>
      ` : ''}
    `;
    
    console.log("✅ Rendered timing analysis");
  } catch (error) {
    console.error("Error rendering timing analysis:", error);
  }
}
