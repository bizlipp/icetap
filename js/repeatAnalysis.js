// js/repeatAnalysis.js
// Manages analytics and rendering for the Repeat Callers tab

// Originally from dashboard.html, now moved here
function updateRepeatCallersTable(filteredCalls) {
  const tableBody = document.getElementById('repeatCallersBody');
  if(!tableBody) {
    console.warn("Repeat callers table body not found.");
    return;
  }

  const localRepeatCallers = {};
  filteredCalls.forEach(call => {
      const customerPhone = call.meta["Customer phone number / email address"];
      if (customerPhone && customerPhone !== "Unknown" && customerPhone !== "N/A") {
          if (!localRepeatCallers[customerPhone]) {
              localRepeatCallers[customerPhone] = { phoneNumber: customerPhone, calls: [], flagCount: {}, firstCall: null, latestCall: null };
          }
          const callerRecord = localRepeatCallers[customerPhone];
          callerRecord.calls.push({
              id: call.meta["Contact ID"],
              timestamp: call.meta["Initiation timestamp"],
              flags: call.flags || [],
              agent: call.meta["Agent"] || call.meta["Agent name"] || "Unknown"
          });
          if (call.flags) {
              call.flags.forEach(flag => { callerRecord.flagCount[flag] = (callerRecord.flagCount[flag] || 0) + 1; });
          }
          const timestamp = call.meta["Initiation timestamp"];
          if (timestamp) {
              const date = new Date(timestamp);
              if (!isNaN(date.getTime())) {
                  if (!callerRecord.firstCall || date < new Date(callerRecord.firstCall)) callerRecord.firstCall = timestamp;
                  if (!callerRecord.latestCall || date > new Date(callerRecord.latestCall)) callerRecord.latestCall = timestamp;
              }
          }
      }
  });

  const repeatCallers = Object.values(localRepeatCallers)
    .filter(caller => caller.calls.length > 1)
    .sort((a, b) => b.calls.length - a.calls.length);
  
  tableBody.innerHTML = '';
  
  if (repeatCallers.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="5" class="no-data-message">No repeat callers found for current filter</td>';
    tableBody.appendChild(row);
    return;
  }
  
  repeatCallers.slice(0, 15).forEach(caller => { // Show top 15
    const row = document.createElement('tr');
    
    const topFlags = Object.entries(caller.flagCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([flag, count]) => `${flag} (${count})`)
      .join(', ');
    
    const phoneDisplay = caller.phoneNumber.includes('@') ? caller.phoneNumber : caller.phoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
    
    row.innerHTML = `
      <td>${phoneDisplay}</td>
      <td>${caller.calls.length}</td>
      <td>${caller.latestCall ? new Date(caller.latestCall).toLocaleDateString() : 'N/A'}</td>
      <td>${caller.firstCall ? new Date(caller.firstCall).toLocaleDateString() : 'N/A'}</td>
      <td>${topFlags || 'None'}</td>
    `;
    
    tableBody.appendChild(row);
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
function displayRepeatCallerAgentInsights(filteredCalls) {
  const container = document.getElementById('repeatCallersAgentInsights');
  if (container) {
    container.innerHTML = '<div class="no-data-message" style="padding: 20px;">Agent-specific insights for repeat callers will be here (e.g., agents with most repeats, common flags causing repeats).</div>';
  }
  // console.log("displayRepeatCallerAgentInsights called - (placeholder) with", filteredCalls ? filteredCalls.length : 0, "calls");
}

// Main function to update all content in the Repeat Callers Tab
function updateRepeatCallersTabContent(filteredCalls) {
    if (!filteredCalls || filteredCalls.length === 0) {
        // console.warn("updateRepeatCallersTabContent called with no or empty filteredCalls");
        const tableBody = document.getElementById('repeatCallersBody');
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="5" class="no-data-message">No repeat caller data for current filter</td></tr>';
        
        const timingChartsContainer = document.getElementById('repeatCallersTimingCharts');
        if (timingChartsContainer) timingChartsContainer.innerHTML = '<div class="no-data-message" style="padding: 20px;">No data for timing charts.</div>';
        
        const agentInsightsContainer = document.getElementById('repeatCallersAgentInsights');
        if (agentInsightsContainer) agentInsightsContainer.innerHTML = '<div class="no-data-message" style="padding: 20px;">No data for agent insights.</div>';
        return;
    }
    updateRepeatCallersTable(filteredCalls);
    renderCallbackTimingCharts(filteredCalls);
    displayRepeatCallerAgentInsights(filteredCalls);
} 