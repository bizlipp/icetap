// js/repeatAnalysis.js
// Manages analytics and rendering for the Repeat Callers tab

// Variable to hold the chart instance, similar to how it's done in dashboard.html
// This should be declared in dashboard.html and passed or accessed globally if needed outside this file for destruction.
// For now, we assume it's managed by dashboard.html (e.g. let callbackVolumeChart = null;)

function updateRepeatCallersTable(enrichedRepeatCallersData) {
  const tableBody = document.getElementById('repeatCallersBody');
  if (!tableBody) {
    console.warn("Repeat callers table body not found.");
    return;
  }

  tableBody.innerHTML = ''; // Clear existing rows

  if (!enrichedRepeatCallersData || enrichedRepeatCallersData.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="8" class="no-data-message">No repeat callers found for current filter</td>';
    tableBody.appendChild(row);
    return;
  }

  // The data is already processed and sorted by calculateEnrichedRepeatCallers
  // We just need to render it.
  enrichedRepeatCallersData.slice(0, 25).forEach(caller => {
    const row = document.createElement('tr');
    const phoneDisplay = caller.phoneNumber.includes('@') ? caller.phoneNumber : caller.phoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
    
    const displayAgentTrail = caller.agentTrail.length > 30 ? caller.agentTrail.substring(0, 27) + "..." : caller.agentTrail;
    const displayPatternTag = caller.patternTag.length > 25 ? caller.patternTag.substring(0,22) + '...' : caller.patternTag;

    row.innerHTML = `
      <td>${phoneDisplay}</td>
      <td>${caller.callCount}</td>
      <td>${caller.spanDays}</td>
      <td>${caller.firstCallDate}</td>
      <td>${caller.lastCallDate}</td>
      <td>${caller.topThemes}</td>
      <td title="${caller.agentTrail}">${displayAgentTrail}</td>
      <td class="pattern-tag-cell" title="${caller.patternTag}">${displayPatternTag}</td>
    `;
    tableBody.appendChild(row);
  });
}

// Render Callback Volume Per Day Chart
function renderCallbackVolumeChart(enrichedRepeatCallersData) {
    const timingContainer = document.getElementById('repeatCallersTimingCharts');
    if (!timingContainer) {
        console.warn("Callback timing charts container (repeatCallersTimingCharts) not found.");
        return;
    }
    // Ensure the container is ready for two charts if it's being re-rendered
    let volumeChartDiv = document.getElementById('volumeChartDiv');
    if (!volumeChartDiv) {
        timingContainer.innerHTML = '<div id="volumeChartDiv" style="flex: 1; min-width: 300px;"><canvas id="callbackVolumeLineChart"></canvas></div>' + 
                                  '<div id="pieChartDiv" style="flex: 1; min-width: 300px;"></div>'; // pieChartDiv added here
        volumeChartDiv = document.getElementById('volumeChartDiv');
    }
    const canvasElement = document.getElementById('callbackVolumeLineChart');
    if(!canvasElement) return;

    if (window.callbackVolumeChart instanceof Chart) {
        window.callbackVolumeChart.destroy();
    }

    if (!enrichedRepeatCallersData || enrichedRepeatCallersData.length === 0) {
        // No data message handled by updateRepeatCallersTabContent for the whole timingContainer
        return;
    }
    const callbackCountsByDate = {};
    enrichedRepeatCallersData.forEach(caller => {
        for (let i = 1; i < caller.allCallDetails.length; i++) {
            const callDate = new Date(caller.allCallDetails[i].timestamp).toLocaleDateString();
            callbackCountsByDate[callDate] = (callbackCountsByDate[callDate] || 0) + 1;
        }
    });
    const sortedDates = Object.keys(callbackCountsByDate).sort((a, b) => new Date(a) - new Date(b));
    if (sortedDates.length === 0) {
        volumeChartDiv.innerHTML = '<div class="no-data-message" style="padding:10px;">No callback instances.</div>';
        return;
    } else {
        // If we previously had no data, ensure canvas is there
        if (!document.getElementById('callbackVolumeLineChart')) {
            volumeChartDiv.innerHTML = '<canvas id="callbackVolumeLineChart"></canvas>';
        }
    }
    const chartData = sortedDates.map(date => callbackCountsByDate[date]);
    window.callbackVolumeChart = new Chart(document.getElementById('callbackVolumeLineChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: sortedDates,
            datasets: [{
                label: 'Repeat Call Volume',
                data: chartData,
                borderColor: 'rgba(164, 62, 201, 1)',
                backgroundColor: 'rgba(164, 62, 201, 0.2)',
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { ticks: { color: '#ccc' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                y: { beginAtZero: true, ticks: { color: '#ccc', stepSize: 1 }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
            },
            plugins: {
                legend: { labels: { color: '#ccc' } },
                title: { display: true, text: 'Repeat Call Volume Per Day', color: '#ccc', font: { size: 16 } }
            }
        }
    });
}

// New: Render Repeat Themes Pie Chart
function renderRepeatThemesPieChart(enrichedRepeatCallersData) {
    const pieChartDiv = document.getElementById('pieChartDiv');
    if (!pieChartDiv) {
        console.warn("Pie chart container (pieChartDiv) not found.");
        return;
    }
    pieChartDiv.innerHTML = '<canvas id="repeatThemesPieChartCanvas"></canvas>';
    const canvasElement = document.getElementById('repeatThemesPieChartCanvas');
    if (!canvasElement) return;

    if (window.repeatThemesPieChart instanceof Chart) {
        window.repeatThemesPieChart.destroy();
    }

    if (!enrichedRepeatCallersData || enrichedRepeatCallersData.length === 0) {
         // No data message handled by updateRepeatCallersTabContent for the whole timingContainer
        return;
    }

    const repeatThemesCount = {};
    enrichedRepeatCallersData.forEach(caller => {
        for (let i = 1; i < caller.allCallDetails.length; i++) {
            caller.allCallDetails[i].themes.forEach(theme => {
                repeatThemesCount[theme] = (repeatThemesCount[theme] || 0) + 1;
            });
        }
    });

    const sortedThemes = Object.entries(repeatThemesCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7); // Top 7 for pie chart clarity

    if (sortedThemes.length === 0) {
        pieChartDiv.innerHTML = '<div class="no-data-message" style="padding:10px;">No themes in repeats.</div>';
        return;
    }  else {
        // If we previously had no data, ensure canvas is there
        if (!document.getElementById('repeatThemesPieChartCanvas')) {
            pieChartDiv.innerHTML = '<canvas id="repeatThemesPieChartCanvas"></canvas>';
        }
    }

    const labels = sortedThemes.map(item => item[0]);
    const data = sortedThemes.map(item => item[1]);

    window.repeatThemesPieChart = new Chart(canvasElement.getContext('2d'), {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: 'Repeat Call Themes',
                data: data,
                backgroundColor: window.COLOR_POOL.slice(0, labels.length),
                borderColor: '#222', // Darker border for pie segments
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#ccc' }
                },
                title: {
                    display: true,
                    text: 'Repeat Call Themes Distribution',
                    color: '#ccc',
                    font: { size: 16 }
                }
            }
        }
    });
}

// Placeholder for future: Callback Timing Charts
function renderCallbackTimingCharts(filteredCalls) {
  const container = document.getElementById('repeatCallersTimingCharts');
  if (container) {
    container.innerHTML = '<div class="no-data-message" style="padding: 20px;">Callback timing charts will be here (e.g., frequency per day/week, time between callbacks).</div>';
  }
  // console.log("renderCallbackTimingCharts called - (placeholder) with", filteredCalls ? filteredCalls.length : 0, "calls");
}

// Placeholder for future: Agent-Specific Insights for Repeat Callers
// This div will now be used for the Top Repeat Themes chart initially.
function displayRepeatCallerAgentInsights(enrichedRepeatCallersData) {
  // const container = document.getElementById('repeatCallersAgentInsights');
  // if (container) {
  //   container.innerHTML = '<div class="no-data-message" style="padding: 20px;">Agent-specific insights for repeat callers will be here (e.g., agents with most repeats, common flags causing repeats).</div>';
  // }
  // console.log("displayRepeatCallerAgentInsights called - (placeholder) with", enrichedRepeatCallersData ? enrichedRepeatCallersData.length : 0, "calls");
  renderAgentRepeatCountsChart(enrichedRepeatCallersData); // We'll call the new chart here
}

// New: Render Agent Repeat Counts Chart
function renderAgentRepeatCountsChart(enrichedRepeatCallersData) {
    const insightsContainer = document.getElementById('repeatCallersAgentInsights');
    if (!insightsContainer) {
        console.warn("Agent insights container (repeatCallersAgentInsights) not found.");
        return;
    }
    // Reuse the canvas ID or create a new one if preferred. Let's use a new ID for clarity.
    insightsContainer.innerHTML = '<canvas id="agentRepeatCountsBarChart"></canvas>'; 
    const canvasElement = document.getElementById('agentRepeatCountsBarChart');
    if (!canvasElement) {
        console.warn("Dynamically created canvas for agent repeat counts chart not found.");
        return;
    }

    if (window.agentRepeatCountsChart instanceof Chart) {
        window.agentRepeatCountsChart.destroy();
    }

    if (!enrichedRepeatCallersData || enrichedRepeatCallersData.length === 0) {
        insightsContainer.innerHTML = '<div class="no-data-message" style="padding: 20px;">No repeat caller data for agent insights.</div>';
        return;
    }

    const agentRepeatCustomerCount = {};
    enrichedRepeatCallersData.forEach(caller => {
        // Credit the last agent in the trail for this repeat customer
        if (caller.allCallDetails.length > 0) {
            const lastAgent = caller.allCallDetails[caller.allCallDetails.length - 1].agent;
            if (lastAgent && lastAgent !== "Unknown") {
                agentRepeatCustomerCount[lastAgent] = (agentRepeatCustomerCount[lastAgent] || 0) + 1;
            }
        }
    });

    const sortedAgents = Object.entries(agentRepeatCustomerCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10); // Top 10 agents

    if (sortedAgents.length === 0) {
        insightsContainer.innerHTML = '<div class="no-data-message" style="padding: 20px;">No agent data for repeat customers.</div>';
        return;
    }

    const labels = sortedAgents.map(item => item[0]);
    const data = sortedAgents.map(item => item[1]);

    window.agentRepeatCountsChart = new Chart(canvasElement.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Unique Repeat Customers',
                data: data,
                // Use agent-specific colors if available, otherwise default pool
                backgroundColor: labels.map(agentName => window.dashboardData.agentColors[agentName] ? window.dashboardData.agentColors[agentName].replace('0.8', '0.7') : window.COLOR_POOL[labels.indexOf(agentName) % window.COLOR_POOL.length]),
                borderColor: labels.map(agentName => window.dashboardData.agentColors[agentName] || window.COLOR_POOL[labels.indexOf(agentName) % window.COLOR_POOL.length]),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    ticks: { color: '#ccc' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: '#ccc', stepSize: 1 },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                }
            },
            plugins: {
                legend: { display: true, labels: {color: '#ccc'} }, 
                title: {
                    display: true,
                    text: 'Agents by Most Repeat Customers (Last Agent)',
                    color: '#ccc',
                    font: { size: 16 }
                }
            }
        }
    });
}

// Main function to update all content in the Repeat Callers Tab
function updateRepeatCallersTabContent(filteredCalls) {
    const enrichedRepeatCallersData = calculateEnrichedRepeatCallers(filteredCalls);
    const timingChartsContainer = document.getElementById('repeatCallersTimingCharts');
    const agentInsightsContainer = document.getElementById('repeatCallersAgentInsights');

    if (!enrichedRepeatCallersData || enrichedRepeatCallersData.length === 0) {
        const tableBody = document.getElementById('repeatCallersBody');
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="8" class="no-data-message">No repeat caller data for current filter</td></tr>';
        
        if (timingChartsContainer) {
            timingChartsContainer.innerHTML = '<div class="no-data-message" style="padding: 20px; text-align:center; width:100%;">No data for timing charts.</div>';
        }
        if (window.callbackVolumeChart instanceof Chart) {
            window.callbackVolumeChart.destroy();
            window.callbackVolumeChart = null;
        }
        if (window.repeatThemesPieChart instanceof Chart) { 
            window.repeatThemesPieChart.destroy();
            window.repeatThemesPieChart = null;
        }
        
        if (agentInsightsContainer) {
            agentInsightsContainer.innerHTML = '<div class="no-data-message" style="padding: 20px; text-align:center; width:100%;">No data for agent insights.</div>';
        }
        if (window.agentRepeatCountsChart instanceof Chart) { // Clear new agent chart
            window.agentRepeatCountsChart.destroy();
            window.agentRepeatCountsChart = null;
        }
        return;
    } else {
        if (timingChartsContainer && (!document.getElementById('volumeChartDiv') || !document.getElementById('pieChartDiv'))) {
             timingChartsContainer.innerHTML = '<div id="volumeChartDiv" style="flex: 1; min-width: 300px;"><canvas id="callbackVolumeLineChart"></canvas></div>' +
                                            '<div id="pieChartDiv" style="flex: 1; min-width: 300px;"><canvas id="repeatThemesPieChartCanvas"></canvas></div>';
        }
        if (agentInsightsContainer && !document.getElementById('agentRepeatCountsBarChart')) { // Check for new canvas ID
            agentInsightsContainer.innerHTML = '<canvas id="agentRepeatCountsBarChart"></canvas>';
        }
    }

    updateRepeatCallersTable(enrichedRepeatCallersData);
    renderCallbackVolumeChart(enrichedRepeatCallersData);
    renderRepeatThemesPieChart(enrichedRepeatCallersData); 
    renderAgentRepeatCountsChart(enrichedRepeatCallersData); // Call the new agent chart function
    updateCoachingSummaryReport(enrichedRepeatCallersData, filteredCalls); // New call for coaching summary
}

// New function to generate and display the coaching summary report
function updateCoachingSummaryReport(enrichedRepeatCallersData, allCallsForContext) {
    const summaryBlock = document.getElementById('repeatSummaryBlock');
    if (!summaryBlock) {
        console.warn("repeatSummaryBlock not found in the DOM.");
        return;
    }

    if (!enrichedRepeatCallersData || enrichedRepeatCallersData.length === 0) {
        summaryBlock.innerHTML = '<div class="no-data-message">No repeat caller data for coaching summary.</div>';
        return;
    }

    // We need to ensure generateCoachingSummary is available globally
    // or ReportComposer object is exposed, e.g., window.ReportComposer.generateCoachingSummary
    if (typeof generateCoachingSummary === 'function') {
        // Pass allCallsForContext which might be the globally filtered calls from dashboardData
        // CORRECTED: Pass enrichedRepeatCallersData which contains the detailed structures needed by generateCoachingSummary
        const coachingHtml = generateCoachingSummary(enrichedRepeatCallersData, allCallsForContext); 
        summaryBlock.innerHTML = coachingHtml;
    } else {
        summaryBlock.innerHTML = '<div class="no-data-message">Error: Coaching summary generation function not found.</div>';
        console.error("generateCoachingSummary function is not defined globally or on window.ReportComposer.");
    }
}

// Helper function to encapsulate the logic for enriching repeat caller data
// This was previously inside updateRepeatCallersTable, now separated for reusability
function calculateEnrichedRepeatCallers(filteredCalls) {
    const enrichedData = [];
    const customerCallGroups = {};

    filteredCalls.forEach(call => {
        const customerPhone = call.meta["Customer phone number / email address"];
        if (customerPhone && customerPhone !== "Unknown" && customerPhone !== "N/A") {
            if (!customerCallGroups[customerPhone]) {
                customerCallGroups[customerPhone] = [];
            }
            customerCallGroups[customerPhone].push({
                id: call.meta["Contact ID"],
                timestamp: call.meta["Initiation timestamp"],
                date: new Date(call.meta["Initiation timestamp"]),
                flags: call.flags || [],
                themes: (call.flags || []).map(flag => getFlagTheme(flag)),
                agent: call.meta["Agent name"] || call.meta["Agent"] || "Unknown",
                disconnectReason: call.meta["Disconnect reason"] || "N/A"
            });
        }
    });

    for (const phone in customerCallGroups) {
        const callsInGroup = customerCallGroups[phone];
        if (callsInGroup.length > 1) {
            callsInGroup.sort((a, b) => a.date - b.date);
            const firstCall = callsInGroup[0];
            const lastCall = callsInGroup[callsInGroup.length - 1];
            let spanDays = 'N/A';
            if (firstCall.timestamp && lastCall.timestamp) {
                const diffTime = Math.abs(lastCall.date - firstCall.date);
                spanDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (spanDays === 0 && callsInGroup.length > 1) spanDays = 1;
            }
            const allFlagsForCustomer = callsInGroup.reduce((acc, call) => acc.concat(call.flags), []);
            const allThemesForCustomer = {};
            allFlagsForCustomer.forEach(flag => {
                const theme = getFlagTheme(flag);
                allThemesForCustomer[theme] = (allThemesForCustomer[theme] || 0) + 1;
            });
            const topOverallThemes = Object.entries(allThemesForCustomer)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([theme, count]) => `${theme} (${count})`)
                .join(', ');
            const agentTrail = callsInGroup.map(c => c.agent).join(' → ');
            const patternTags = new Set();
            const firstCallThemes = new Set(firstCall.themes);
            const lastCallThemes = new Set(lastCall.themes);
            if (callsInGroup.some(call => call.themes.includes("Resolution Failure"))) {
                patternTags.add("📌 Missed Resolution");
            }
            const criticalThemes = ["Billing", "Technical", "Account", "Product Issue"];
            firstCallThemes.forEach(theme => {
                if (criticalThemes.includes(theme) && lastCallThemes.has(theme)) {
                    patternTags.add("⚠️ Same Critical Theme");
                }
            });
            if (firstCall.themes.length > 0) {
                const topFirstThemesMap = firstCall.themes.reduce((acc, th) => {acc[th] = (acc[th] || 0) + 1; return acc;}, {});
                const sortedTopFirstThemes = Object.entries(topFirstThemesMap).sort((a,b) => b[1]-a[1]);
                if (sortedTopFirstThemes.length > 0) {
                    const topFirstTheme = sortedTopFirstThemes[0][0];
                    if (lastCall.themes.includes(topFirstTheme) && criticalThemes.includes(topFirstTheme)){
                        patternTags.add("⚠️ " + topFirstTheme + " Repeated");
                    }
                }
            }
            for (let i = 0; i < callsInGroup.length - 1; i++) {
                const currentCall = callsInGroup[i];
                const nextCall = callsInGroup[i+1];
                const currentThemes = new Set(currentCall.themes);
                if ((currentThemes.has("Call Experience") || currentThemes.has("Process")) && 
                    (currentCall.flags.some(f => f.toLowerCase().includes("escalate") || f.toLowerCase().includes("supervisor")))) {
                    if (nextCall.flags.some(f => f.toLowerCase().includes("hang up") || f.toLowerCase().includes("disconnect"))) {
                        patternTags.add("🧭 Escalation → Drop");
                    }
                }
            }
            if (firstCall.themes.includes("Call Experience") || firstCall.themes.includes("Process")){
                if (firstCall.flags.some(f => f.toLowerCase().includes("escalate") || f.toLowerCase().includes("supervisor"))){
                    patternTags.add("⤴️ Escalated Early");
                }
            }
            if (firstCall.themes.includes("Call Handling") || firstCall.themes.includes("Call Experience")){
                if (firstCall.flags.some(f => f.toLowerCase().includes("hang up") || f.toLowerCase().includes("disconnect"))) {
                    patternTags.add("📉 Dropped Early");
                }
            }
            let finalPatternTag = Array.from(patternTags).join(', ') || '-'; // Default to hyphen
            if (finalPatternTag.length > 50) { 
                finalPatternTag = Array.from(patternTags).slice(0,2).join(', ') + ', ...';
            }
            enrichedData.push({
                phoneNumber: phone,
                callCount: callsInGroup.length,
                firstCallDate: firstCall.timestamp ? firstCall.date.toLocaleDateString() : 'N/A',
                lastCallDate: lastCall.timestamp ? lastCall.date.toLocaleDateString() : 'N/A',
                spanDays: spanDays === 'N/A' ? 'N/A' : `${spanDays} day(s)`,
                topThemes: topOverallThemes || 'None',
                agentTrail: agentTrail,
                patternTag: finalPatternTag,
                allCallDetails: callsInGroup
            });
        }
    }
    enrichedData.sort((a, b) => b.callCount - a.callCount);
    return enrichedData;
} 