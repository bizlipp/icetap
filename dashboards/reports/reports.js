(function () {
  let allLoadedCalls = []; // This will store all calls from DataStackULTRA (pre-analyzed)
  let currentFilters = {};
  let activeReportType = 'filteredCallList'; // Default active report
  let flagFrequencyChartInstance = null;

  function filterCallsByDateRange(calls, range) {
    const now = new Date();
    let startDate = new Date();

    switch (range) {
      case "today":
        startDate.setHours(0, 0, 0, 0);
        break;
      case "yesterday":
        startDate.setDate(now.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        const endDateYesterday = new Date(startDate);
        endDateYesterday.setHours(23, 59, 59, 999);
        // Ensure call.startTime is a Date object
        return calls.filter(call => call.startTime && call.startTime >= startDate && call.startTime <= endDateYesterday);
      case "last7":
        startDate.setDate(now.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "last30":
        startDate.setDate(now.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "all":
      default:
        return calls; // No filtering needed for "all"
    }
    // For ranges other than 'yesterday' and 'all', filter up to 'now'
    return calls.filter(call => call.startTime && call.startTime >= startDate && call.startTime <= now);
  }

  function generateReportText(calls) {
    if (calls.length === 0) return "No calls match the selected period.";

    let report = `Call Report - Generated: ${new Date().toLocaleString()}\n`;
    report += `Total Calls: ${calls.length}\n\n`;

    calls.forEach((call, index) => {
      report += `Call ${index + 1}:\n`;
      report += `  Contact ID: ${call.contactId}\n`;
      report += `  Agent: ${call.agent}\n`;
      report += `  Customer ID: ${call.customerId}\n`;
      // Ensure call.startTime is a Date object before calling toLocaleString
      report += `  Start Time: ${call.startTime ? call.startTime.toLocaleString() : 'N/A'}\n`;
      report += `  Duration: ${call.durationText} (${call.durationMinutes !== undefined ? call.durationMinutes.toFixed(2) : 'N/A'} mins)\n`;
      report += `  Issue: ${call.issue || "N/A"}\n`;
      report += `  Outcome: ${call.outcome || "N/A"}\n`;
      report += `  Flags: ${call.flags && call.flags.length > 0 ? call.flags.join(", ") : "None"}\n`;
      // Ensure generateCoachingNote is available (from call-analysis.js)
      report += `  Coaching Note: ${window.CallAnalyzer && window.CallAnalyzer.generateCoachingNote ? (window.CallAnalyzer.generateCoachingNote(call) || "None") : "N/A (utility missing)"}\n\n`;
    });
    return report;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (!window.DataStackULTRA) {
      console.error("DataStackULTRA is not initialized. Reports dashboard cannot load data.");
      const mainContentArea = document.getElementById('reportsDashboard');
      if (mainContentArea) {
          mainContentArea.innerHTML = '<p class="no-data-message dashboard-section card"><i class="fas fa-info-circle mr-2"></i>Error: DataStackULTRA not available. Cannot load reports data.</p>';
      }
      document.querySelectorAll('.filters-section, .report-selection-section, .report-output-section').forEach(el => el.style.display = 'none');
      return;
    }
    try {
      const calls = await window.DataStackULTRA.get('loadedCalls', []);
      if (!calls || !Array.isArray(calls)) {
        console.warn("No valid calls data found in DataStackULTRA for reports.");
        allLoadedCalls = [];
      } else {
        allLoadedCalls = calls.map(call => ({ // Ensure startTime is a Date object
            ...call,
            startTime: call.meta?.["Initiation timestamp"] ? new Date(call.meta["Initiation timestamp"]) : null
        }));
      }
      
      const activeFile = await window.DataStackULTRA.get('activeAuditFile', 'No file loaded');
      const filenameDisplayElement = document.getElementById("reportsFilenameDisplay"); 
      if (filenameDisplayElement) {
        filenameDisplayElement.textContent = activeFile ? `File: ${activeFile}` : 'No file loaded';
      }
      
      setupReportTypeSelector();
      setupFilterEventListeners();
      populateCommonFilters();
      applyFiltersAndRenderActiveReport(); // Initial render

    } catch (error) {
      console.error("Error loading calls from DataStackULTRA for reports:", error);
      allLoadedCalls = [];
      applyFiltersAndRenderActiveReport();
      const mainContentArea = document.getElementById('reportsDashboard');
      if(mainContentArea && !mainContentArea.querySelector('.fatal-error-message')) {
          const errorP = document.createElement('p');
          errorP.className = 'no-data-message card fatal-error-message';
          errorP.innerHTML = '<i class="fas fa-exclamation-triangle mr-2"></i>Error loading data for reports. Check console.';
          mainContentArea.appendChild(errorP);
      }
    }
  });

  function setupReportTypeSelector() {
    const reportTypeButtons = document.querySelectorAll('.report-type-button');
    reportTypeButtons.forEach(button => {
      button.addEventListener('click', () => {
        reportTypeButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        activeReportType = button.dataset.reportType;
        renderActiveReportContainer();
        applyFiltersAndRenderActiveReport();
      });
    });
  }

  function setupFilterEventListeners() {
    document.getElementById("applyReportFilters")?.addEventListener('click', applyFiltersAndRenderActiveReport);
    document.getElementById("resetReportFilters")?.addEventListener('click', resetFiltersAndRender);
    // Add event listeners for export buttons if they are specific to report types
    document.getElementById('exportFilteredListButton')?.addEventListener('click', () => exportCurrentReport('filteredCallList'));
    document.getElementById('exportAgentPerformanceButton')?.addEventListener('click', () => exportCurrentReport('agentPerformance'));
    document.getElementById('exportFlagFrequencyButton')?.addEventListener('click', () => exportCurrentReport('flagFrequency'));
  }
  
  function resetFiltersAndRender() {
    document.getElementById("reportDateFrom").value = '';
    document.getElementById("reportDateTo").value = '';
    document.getElementById("reportAgentFilter").value = 'all';
    document.getElementById("reportFlagFilter").value = 'all';
    currentFilters = {}; // Clear stored filters
    applyFiltersAndRenderActiveReport();
  }

  function populateCommonFilters() {
    if (allLoadedCalls.length > 0) {
      const agentSelect = document.getElementById("reportAgentFilter");
      const flagSelect = document.getElementById("reportFlagFilter");
      if (agentSelect) populateAgentFilter(allLoadedCalls, agentSelect);
      if (flagSelect) populateFlagFilter(allLoadedCalls, flagSelect);
    }
  }
  
  function populateAgentFilter(calls, selectElement) {
    const agents = [...new Set(calls.map(call => call.agent || (call.meta && (call.meta["Agent name"] || call.meta["Agent"])) || "Unknown"))].sort();
    selectElement.innerHTML = '<option value="all">All Agents</option>';
    agents.forEach(agent => {
      if (agent === "Unknown" && !agents.find(a => a !== "Unknown")) return;
      const option = document.createElement('option');
      option.value = agent;
      option.textContent = agent;
      selectElement.appendChild(option);
    });
  }

  function populateFlagFilter(calls, selectElement) {
    const flags = [...new Set(calls.flatMap(call => call.flags || []))].sort();
    selectElement.innerHTML = '<option value="all">All Flags</option>';
    flags.forEach(flag => {
      const option = document.createElement('option');
      option.value = flag;
      option.textContent = flag;
      selectElement.appendChild(option);
    });
  }

  function applyFiltersAndRenderActiveReport() {
    const dateFromValue = document.getElementById("reportDateFrom")?.value;
    const dateToValue = document.getElementById("reportDateTo")?.value;
    const selectedAgent = document.getElementById("reportAgentFilter")?.value;
    const selectedFlag = document.getElementById("reportFlagFilter")?.value;

    currentFilters = {
        dateFrom: dateFromValue ? new Date(dateFromValue + 'T00:00:00') : null, 
        dateTo: dateToValue ? new Date(dateToValue + 'T23:59:59') : null,    
        agent: selectedAgent,
        flag: selectedFlag
    };
    
    let filteredCalls = allLoadedCalls;
    if (currentFilters.dateFrom) {
        filteredCalls = filteredCalls.filter(call => {
            const callTime = call.startTime instanceof Date ? call.startTime : new Date(call.meta["Initiation timestamp"]);
            return callTime >= currentFilters.dateFrom;
        });
    }
    if (currentFilters.dateTo) {
        filteredCalls = filteredCalls.filter(call => {
            const callTime = call.startTime instanceof Date ? call.startTime : new Date(call.meta["Initiation timestamp"]);
            return callTime <= currentFilters.dateTo;
        });
    }
    if (currentFilters.agent && currentFilters.agent !== 'all') {
        filteredCalls = filteredCalls.filter(call => (call.agent || (call.meta && (call.meta["Agent name"] || call.meta["Agent"])) || "Unknown") === currentFilters.agent);
    }
    if (currentFilters.flag && currentFilters.flag !== 'all') {
        filteredCalls = filteredCalls.filter(call => call.flags && call.flags.includes(currentFilters.flag));
    }
    
    renderActiveReportContainer(); // Ensure correct container is visible
    switch (activeReportType) {
      case 'filteredCallList':
        renderFilteredCallList(filteredCalls);
        break;
      case 'agentPerformance':
        renderAgentPerformanceReport(filteredCalls);
        break;
      case 'flagFrequency':
        renderFlagFrequencyReport(filteredCalls, currentFilters.flag); // Pass all filtered calls and the specific flag if one is selected
        break;
      default:
        console.error("Unknown report type:", activeReportType);
    }
  }

  function renderActiveReportContainer() {
    document.querySelectorAll('.report-output-section').forEach(section => {
      section.style.display = 'none';
    });
    const activeSection = document.getElementById(`${activeReportType}Report`);
    if (activeSection) {
      activeSection.style.display = 'block';
    } else {
        console.error(`Report container not found for: ${activeReportType}Report`);
    }
  }
  
  function renderFilteredCallList(callsToRender) {
    const reportTableBody = document.getElementById("reportTableBody");
    const reportSummary = document.getElementById("reportSummary");
    const noDataMessageContainer = document.getElementById('reportsDashboard').querySelector('.no-data-message-container');

    reportTableBody.innerHTML = ''; // Clear previous content
    
    if (allLoadedCalls.length === 0) {
        if(noDataMessageContainer) noDataMessageContainer.innerHTML = '<p class="no-data-message card"><i class="fas fa-info-circle mr-2"></i>No calls loaded. Please load data on the main page.</p>';
        document.querySelectorAll('.filters-section, .report-output-section').forEach(el => el.style.display = 'none');
        document.querySelector('.report-selection-section').style.display = 'none'; // Hide report selector too
        return;
    } else {
        if(noDataMessageContainer) noDataMessageContainer.innerHTML = ''; // Clear global no data message
        document.querySelectorAll('.filters-section, .report-output-section').forEach(el => el.style.display = ''); // This will be managed by renderActiveReportContainer
        document.querySelector('.report-selection-section').style.display = '';
        renderActiveReportContainer(); // Ensure correct section is visible
    }

    if (callsToRender.length === 0) {
      reportTableBody.innerHTML = '<tr><td colspan="8" class="no-data-message p-4 text-center">No calls match the current filter criteria.</td></tr>';
      reportSummary.innerHTML = `<p>Showing 0 of ${allLoadedCalls.length} total calls based on current filters.</p>`;
      return;
    }

    reportSummary.innerHTML = `<p>Showing ${callsToRender.length} of ${allLoadedCalls.length} total calls. Filters: Date (${currentFilters.dateFrom?.toLocaleDateString() || 'Any'} - ${currentFilters.dateTo?.toLocaleDateString() || 'Any'}), Agent (${currentFilters.agent || 'All'}), Flag (${currentFilters.flag && currentFilters.flag !== 'all' ? currentFilters.flag : 'Any'}).</p>`;

    callsToRender.forEach(call => {
      const row = reportTableBody.insertRow();
      const callTime = call.startTime instanceof Date ? call.startTime : new Date(call.meta["Initiation timestamp"]);
      const formattedDate = callTime ? callTime.toLocaleString() : 'N/A';

      row.innerHTML = `
        <td class="p-2">${call.meta?.["Contact ID"] || 'N/A'}</td>
        <td class="p-2">${formattedDate}</td>
        <td class="p-2">${call.agent || (call.meta && (call.meta["Agent name"] || call.meta["Agent"])) || "Unknown"}</td>
        <td class="p-2">${call.durationMinutes ? call.durationMinutes.toFixed(0) + ' min' : (call.meta?.["Contact duration"] || 'N/A')}</td>
        <td class="p-2">${(call.flags && call.flags.length > 0) ? call.flags.join(', ') : '-'}</td>
        <td class="p-2">${(call.positiveFlags && call.positiveFlags.length > 0) ? call.positiveFlags.join(', ') : '-'}</td>
        <td class="p-2">${call.issue || '-'}</td>
        <td class="p-2">${call.summary || '-'}</td>
      `;
    });
  }

  function renderAgentPerformanceReport(calls) {
    const container = document.getElementById('agentPerformanceSummaryContainer');
    container.innerHTML = ''; // Clear previous

    if (calls.length === 0) {
      container.innerHTML = '<p class="no-data-message p-4 text-center">No calls match the current filters for agent performance.</p>';
      return;
    }

    const agentStats = {};
    calls.forEach(call => {
      const agentName = call.agent || (call.meta && (call.meta["Agent name"] || call.meta["Agent"])) || "Unknown";
      if (!agentStats[agentName]) {
        agentStats[agentName] = { totalCalls: 0, totalDurationMinutes: 0, totalFlags: 0, totalPositiveFlags: 0, callsWithDuration: 0 };
      }
      agentStats[agentName].totalCalls++;
      if (call.durationMinutes !== null && call.durationMinutes !== undefined) {
         agentStats[agentName].totalDurationMinutes += call.durationMinutes;
         agentStats[agentName].callsWithDuration++;
      }
      if (call.flags) agentStats[agentName].totalFlags += call.flags.length;
      if (call.positiveFlags) agentStats[agentName].totalPositiveFlags += call.positiveFlags.length;
    });

    const table = document.createElement('table');
    table.className = 'dashboard-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Agent</th>
          <th>Total Calls</th>
          <th>Avg. Call Duration (min)</th>
          <th>Total Flags</th>
          <th>Total Positive Flags</th>
        </tr>
      </thead>
      <tbody>
      </tbody>
    `;
    const tbody = table.querySelector('tbody');
    for (const agentName in agentStats) {
      const stats = agentStats[agentName];
      const avgDuration = stats.callsWithDuration > 0 ? (stats.totalDurationMinutes / stats.callsWithDuration).toFixed(1) : 'N/A';
      const row = tbody.insertRow();
      row.innerHTML = `
        <td class="p-2">${agentName}</td>
        <td class="p-2 text-center">${stats.totalCalls}</td>
        <td class="p-2 text-center">${avgDuration}</td>
        <td class="p-2 text-center">${stats.totalFlags}</td>
        <td class="p-2 text-center">${stats.totalPositiveFlags}</td>
      `;
    }
    container.appendChild(table);
  }

  function renderFlagFrequencyReport(calls, selectedFlagFilter) {
    const chartContainer = document.getElementById('flagFrequencyChartContainer');
    const canvas = document.getElementById('flagFrequencyChart');
    const noDataMessage = chartContainer.querySelector('.no-data-message');
    chartContainer.innerHTML = ''; // Clear previous, including canvas and no data message
    chartContainer.appendChild(canvas); // Re-add canvas
    const newNoDataP = document.createElement('p');
    newNoDataP.className = 'no-data-message p-4 text-center';
    chartContainer.appendChild(newNoDataP);

    if (calls.length === 0) {
        newNoDataP.textContent = 'No calls match the current filters for flag frequency.';
        canvas.style.display = 'none';
        return;
    }

    const flagCounts = {};
    calls.forEach(call => {
      if (call.flags) {
        call.flags.forEach(flag => {
          flagCounts[flag] = (flagCounts[flag] || 0) + 1;
        });
      }
    });

    const sortedFlags = Object.entries(flagCounts).sort(([,a],[,b]) => b-a);
    
    if (sortedFlags.length === 0) {
        newNoDataP.textContent = 'No flags found in the filtered calls.';
        canvas.style.display = 'none';
        return;
    }
    
    newNoDataP.style.display = 'none'; // Hide no data message if we have flags
    canvas.style.display = 'block';

    const topN = 15; // Show top N flags
    const chartData = sortedFlags.slice(0, topN);
    const labels = chartData.map(item => item[0]);
    const data = chartData.map(item => item[1]);

    if (flagFrequencyChartInstance) {
      flagFrequencyChartInstance.destroy();
    }
    flagFrequencyChartInstance = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Flag Frequency',
          data: data,
          backgroundColor: 'rgba(255, 99, 132, 0.5)', // Example color
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1
        }]
      },
      options: {
        indexAxis: 'y', // Horizontal bar chart
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            beginAtZero: true,
            ticks: { stepSize: 1 }
          }
        },
        plugins: {
            legend: { display: false },
            title: { display: true, text: `Top ${topN} Flags (Filtered by Date/Agent${selectedFlagFilter && selectedFlagFilter !== 'all' ? '/Flag: ' + selectedFlagFilter : ''})` }
        }
      }
    });
  }
  
  function exportCurrentReport(reportType) {
    // This function will need to be expanded to handle different report types.
    // For now, it just calls the original exportReport function which exports the filtered list.
    let callsToExport = getFilteredCallsForExport();
    let sheetName = "Report_Export";
    let reportData = [];

    if (callsToExport.length === 0) {
        alert("No data to export based on current filters.");
        return;
    }

    switch(reportType) {
        case 'filteredCallList':
            reportData = callsToExport.map(call => {
                const callTime = call.startTime instanceof Date ? call.startTime : new Date(call.meta["Initiation timestamp"]);
                return {
                    "Contact ID": call.meta?.["Contact ID"] || 'N/A',
                    "Date & Time": callTime ? callTime.toLocaleString() : 'N/A',
                    "Agent": call.agent || (call.meta && (call.meta["Agent name"] || call.meta["Agent"])) || "Unknown",
                    "Duration (min)": call.durationMinutes ? call.durationMinutes.toFixed(1) : 'N/A',
                    "Flags": (call.flags && call.flags.length > 0) ? call.flags.join('; ') : '-',
                    "Positive Flags": (call.positiveFlags && call.positiveFlags.length > 0) ? call.positiveFlags.join('; ') : '-',
                    "Issue": call.issue || '-',
                    "Summary": call.summary || '-',
                };
            });
            sheetName = "Filtered_Call_List";
            break;
        case 'agentPerformance':
            const agentStats = {};
            callsToExport.forEach(call => {
                const agentName = call.agent || (call.meta && (call.meta["Agent name"] || call.meta["Agent"])) || "Unknown";
                if (!agentStats[agentName]) {
                    agentStats[agentName] = { totalCalls: 0, totalDurationMinutes: 0, totalFlags: 0, totalPositiveFlags: 0, callsWithDuration: 0 };
                }
                agentStats[agentName].totalCalls++;
                if (call.durationMinutes !== null && call.durationMinutes !== undefined) {
                    agentStats[agentName].totalDurationMinutes += call.durationMinutes;
                    agentStats[agentName].callsWithDuration++;
                }
                if (call.flags) agentStats[agentName].totalFlags += call.flags.length;
                if (call.positiveFlags) agentStats[agentName].totalPositiveFlags += call.positiveFlags.length;
            });
            for (const agentName in agentStats) {
                const stats = agentStats[agentName];
                reportData.push({
                    "Agent": agentName,
                    "Total Calls": stats.totalCalls,
                    "Avg. Call Duration (min)": stats.callsWithDuration > 0 ? (stats.totalDurationMinutes / stats.callsWithDuration).toFixed(1) : 'N/A',
                    "Total Flags": stats.totalFlags,
                    "Total Positive Flags": stats.totalPositiveFlags
                });
            }
            sheetName = "Agent_Performance";
            break;
        case 'flagFrequency':
            const flagCounts = {};
            callsToExport.forEach(call => {
                if (call.flags) {
                    call.flags.forEach(flag => {
                        flagCounts[flag] = (flagCounts[flag] || 0) + 1;
                    });
                }
            });
            const sortedFlags = Object.entries(flagCounts).sort(([,a],[,b]) => b-a);
            reportData = sortedFlags.map(([flag, count]) => ({ "Flag": flag, "Frequency": count }));
            sheetName = "Flag_Frequency";
            break;
        default:
            alert("Unknown report type for export.");
            return;
    }

    if (reportData.length === 0) {
        alert("No data to export for this report type with current filters.");
        return;
    }

    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${sheetName}_${new Date().toISOString().slice(0,10)}.xlsx`);
  }
  
  function getFilteredCallsForExport() {
    let filteredCalls = allLoadedCalls;
    if (currentFilters.dateFrom) {
        filteredCalls = filteredCalls.filter(call => {
            const callTime = call.startTime instanceof Date ? call.startTime : new Date(call.meta["Initiation timestamp"]);
            return callTime && callTime >= currentFilters.dateFrom;
        });
    }
    if (currentFilters.dateTo) {
        filteredCalls = filteredCalls.filter(call => {
            const callTime = call.startTime instanceof Date ? call.startTime : new Date(call.meta["Initiation timestamp"]);
            return callTime && callTime <= currentFilters.dateTo;
        });
    }
    if (currentFilters.agent && currentFilters.agent !== 'all') {
        filteredCalls = filteredCalls.filter(call => (call.agent || (call.meta && (call.meta["Agent name"] || call.meta["Agent"])) || "Unknown") === currentFilters.agent);
    }
    // For export, typically you'd apply the flag filter if it's relevant to the report type being exported.
    // Example: if exporting 'filteredCallList', you'd apply it.
    // If exporting 'flagFrequency' without a specific flag selected in filter, you'd ignore it for the main data pull.
    if (currentFilters.flag && currentFilters.flag !== 'all') { // General rule for lists
         if (activeReportType === 'filteredCallList' || activeReportType === 'agentPerformance') { // Apply if relevant to the list itself
            filteredCalls = filteredCalls.filter(call => call.flags && call.flags.includes(currentFilters.flag));
         }
    }
    return filteredCalls;
  }
})();