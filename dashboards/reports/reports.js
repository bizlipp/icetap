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
    document.getElementById('exportPhraseAnalysisButton')?.addEventListener('click', () => exportCurrentReport('phraseAnalysis'));
    document.getElementById('exportTimingAnalysisButton')?.addEventListener('click', () => exportCurrentReport('timingAnalysis'));
    // The Site Status export button is handled by sitestatus.js
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
      case 'phraseAnalysis':
        renderPhraseAnalysisReport(filteredCalls);
        break;
      case 'timingAnalysis':
        renderTimingAnalysisReport(filteredCalls);
        break;
      case 'siteStatus':
        if (typeof window.renderSiteStatusReport === 'function') {
          window.renderSiteStatusReport(filteredCalls);
        } else {
          console.error("renderSiteStatusReport function not found. Make sure sitestatus.js is loaded properly.");
          const siteStatusContainer = document.getElementById("siteStatusInsights");
          if (siteStatusContainer) {
            siteStatusContainer.innerHTML = '<p class="no-data-message p-4 text-center">Error: Site Status report module not loaded correctly.</p>';
          }
        }
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
  
  function renderPhraseAnalysisReport(calls) {
    const container = document.getElementById('phraseAnalysisContainer');
    
    if (!container) {
      console.error("Phrase analysis container not found in DOM");
      return;
    }
    
    // Clear previous content
    container.innerHTML = '';
    
    if (calls.length === 0) {
      container.innerHTML = '<p class="no-data-message p-4 text-center">No calls match the current filters for phrase analysis.</p>';
      return;
    }
    
    // Check if we have transcripts to analyze
    const callsWithTranscripts = calls.filter(call => call.transcript && call.transcript.length > 0);
    if (callsWithTranscripts.length === 0) {
      container.innerHTML = '<p class="no-data-message p-4 text-center">No transcripts found in the filtered calls. Phrase analysis requires transcript data.</p>';
      return;
    }
    
    // Use the AI utility to extract phrases
    if (!window.AI || typeof window.AI.extractFrequentPhrasesBySpeaker !== 'function') {
      container.innerHTML = '<p class="no-data-message p-4 text-center">The AI.extractFrequentPhrasesBySpeaker function is not available. Make sure AI.js is loaded correctly.</p>';
      return;
    }
    
    try {
      // Create the main container
      const phraseAnalysisDiv = document.createElement('div');
      phraseAnalysisDiv.className = 'phrase-analysis-container';
      
      // Add summary info
      const summaryDiv = document.createElement('div');
      summaryDiv.className = 'summary-info mb-4';
      summaryDiv.innerHTML = `
        <p>Analyzed ${callsWithTranscripts.length} calls with transcripts out of ${calls.length} total filtered calls.</p>
        <p class="text-sm text-gray-400 mt-2">The analysis identifies frequently used two-word phrases (bigrams) by both customers and agents across all calls.</p>
      `;
      phraseAnalysisDiv.appendChild(summaryDiv);
      
      // Extract phrases using the AI utility
      const { customer, agent } = window.AI.extractFrequentPhrasesBySpeaker(calls);
      
      // Create columns wrapper
      const columnsWrapper = document.createElement('div');
      columnsWrapper.className = 'phrase-columns-wrapper';
      
      // Customer phrases column
      const customerColumn = document.createElement('div');
      customerColumn.className = 'phrase-column customer-phrases';
      customerColumn.innerHTML = `<h3><i class="fas fa-user mr-2"></i>Top Customer Phrases</h3>`;
      
      if (customer.length === 0) {
        customerColumn.innerHTML += `<p class="text-sm text-gray-400">No frequent customer phrases detected in the transcripts.</p>`;
      } else {
        const customerList = document.createElement('ul');
        customerList.className = 'phrase-list';
        
        customer.forEach(([phrase, count]) => {
          const li = document.createElement('li');
          li.innerHTML = `
            <span class="phrase-text">${phrase}</span>
            <span class="phrase-count">${count}x</span>
          `;
          customerList.appendChild(li);
        });
        
        customerColumn.appendChild(customerList);
      }
      
      // Agent phrases column
      const agentColumn = document.createElement('div');
      agentColumn.className = 'phrase-column agent-phrases';
      agentColumn.innerHTML = `<h3><i class="fas fa-headset mr-2"></i>Top Agent Phrases</h3>`;
      
      if (agent.length === 0) {
        agentColumn.innerHTML += `<p class="text-sm text-gray-400">No frequent agent phrases detected in the transcripts.</p>`;
      } else {
        const agentList = document.createElement('ul');
        agentList.className = 'phrase-list';
        
        agent.forEach(([phrase, count]) => {
          const li = document.createElement('li');
          li.innerHTML = `
            <span class="phrase-text">${phrase}</span>
            <span class="phrase-count">${count}x</span>
          `;
          agentList.appendChild(li);
        });
        
        agentColumn.appendChild(agentList);
      }
      
      // Add columns to wrapper
      columnsWrapper.appendChild(customerColumn);
      columnsWrapper.appendChild(agentColumn);
      
      // Add wrapper to main container
      phraseAnalysisDiv.appendChild(columnsWrapper);
      
      // Add insights section if we have enough data
      if (customer.length > 0 || agent.length > 0) {
        const insightsDiv = document.createElement('div');
        insightsDiv.className = 'phrase-insights mt-4 p-4 rounded';
        insightsDiv.style.backgroundColor = 'rgba(159, 112, 253, 0.1)';
        insightsDiv.style.borderLeft = '4px solid var(--inspiro-purple-primary)';
        
        // Generate basic insights
        let insightsHtml = '<h3 class="text-lg font-semibold mb-2">Potential Insights</h3><ul class="list-disc ml-5">';
        
        if (customer.length > 0) {
          // Look for question patterns in customer phrases
          const questionPhrases = customer.filter(([phrase]) => 
            phrase.includes('how') || phrase.includes('what') || 
            phrase.includes('why') || phrase.includes('when') || 
            phrase.includes('where') || phrase.includes('can') || 
            phrase.includes('will')
          );
          
          if (questionPhrases.length > 0) {
            insightsHtml += `<li>Customers frequently ask questions containing: ${questionPhrases.slice(0, 3).map(([p]) => `"${p}"`).join(', ')}</li>`;
          }
          
          // Look for problem indicators
          const problemPhrases = customer.filter(([phrase]) => 
            phrase.includes('problem') || phrase.includes('issue') || 
            phrase.includes('error') || phrase.includes('wrong') || 
            phrase.includes('not working') || phrase.includes('doesn\'t work')
          );
          
          if (problemPhrases.length > 0) {
            insightsHtml += `<li>Customers frequently mention problems using: ${problemPhrases.slice(0, 3).map(([p]) => `"${p}"`).join(', ')}</li>`;
          }
        }
        
        if (agent.length > 0) {
          // Look for service phrases in agent responses
          const servicePhrases = agent.filter(([phrase]) => 
            phrase.includes('help') || phrase.includes('assist') || 
            phrase.includes('support') || phrase.includes('service') || 
            phrase.includes('resolve')
          );
          
          if (servicePhrases.length > 0) {
            insightsHtml += `<li>Agents frequently use service-oriented language: ${servicePhrases.slice(0, 3).map(([p]) => `"${p}"`).join(', ')}</li>`;
          }
          
          // Look for reassurance phrases
          const reassurancePhrases = agent.filter(([phrase]) => 
            phrase.includes('understand') || phrase.includes('sorry') || 
            phrase.includes('apologize') || phrase.includes('definitely') || 
            phrase.includes('absolutely')
          );
          
          if (reassurancePhrases.length > 0) {
            insightsHtml += `<li>Agents use reassurance language: ${reassurancePhrases.slice(0, 3).map(([p]) => `"${p}"`).join(', ')}</li>`;
          }
        }
        
        insightsHtml += '</ul>';
        insightsDiv.innerHTML = insightsHtml;
        
        phraseAnalysisDiv.appendChild(insightsDiv);
      }
      
      // Add the entire phrase analysis to the container
      container.appendChild(phraseAnalysisDiv);
      
      // Add event listener to the export button
      document.getElementById('exportPhraseAnalysisButton')?.addEventListener('click', () => exportCurrentReport('phraseAnalysis'));
      
    } catch (error) {
      console.error("Error rendering phrase analysis:", error);
      container.innerHTML = `<p class="no-data-message p-4 text-center">Error generating phrase analysis: ${error.message}</p>`;
    }
  }

  function renderTimingAnalysisReport(calls) {
    const container = document.getElementById('timingAnalysisContainer');
    
    if (!container) {
      console.error("Timing analysis container not found in DOM");
      return;
    }
    
    // Clear previous content
    container.innerHTML = '';
    
    if (calls.length === 0) {
      container.innerHTML = '<p class="no-data-message p-4 text-center">No calls match the current filters for timing analysis.</p>';
      return;
    }
    
    // Check if we have transcripts with timing info to analyze
    const callsWithTimingInfo = calls.filter(call => 
      call.transcript && 
      call.transcript.length > 1 && 
      call.transcript.some(line => line.start && line.end)
    );
    
    if (callsWithTimingInfo.length === 0) {
      container.innerHTML = '<p class="no-data-message p-4 text-center">No transcript timing data found in the filtered calls. Timing analysis requires transcript data with timestamps.</p>';
      return;
    }
    
    // Use the AI utility to analyze transcript gaps
    if (!window.AI || typeof window.AI.analyzeTranscriptGaps !== 'function') {
      container.innerHTML = '<p class="no-data-message p-4 text-center">The AI.analyzeTranscriptGaps function is not available. Make sure AI.js is loaded correctly.</p>';
      return;
    }
    
    try {
      // Create the main container
      const timingAnalysisDiv = document.createElement('div');
      timingAnalysisDiv.className = 'timing-analysis-container';
      
      // Add summary info
      const summaryDiv = document.createElement('div');
      summaryDiv.className = 'summary-info mb-4';
      summaryDiv.innerHTML = `
        <p>Analyzed ${callsWithTimingInfo.length} calls with transcript timing data out of ${calls.length} total filtered calls.</p>
        <p class="text-sm text-gray-400 mt-2">This analysis identifies silences, delays, and timing patterns in conversations that may affect customer experience.</p>
      `;
      timingAnalysisDiv.appendChild(summaryDiv);
      
      // Analyze each call and compile metrics
      let totalDeadAir = 0;
      let totalDelayedResponses = 0;
      let longestSilence = 0;
      let callsWithSilence = 0;
      let callsWithDelays = 0;
      
      // Store per-call details for the detailed table
      const callDetails = [];
      
      callsWithTimingInfo.forEach(call => {
        const timing = window.AI.analyzeTranscriptGaps(call);
        if (!timing) return;
        
        // Add to totals
        totalDeadAir += timing.deadAirInstances;
        totalDelayedResponses += timing.delayedAgentResponses;
        if (timing.deadAirInstances > 0) callsWithSilence++;
        if (timing.delayedAgentResponses > 0) callsWithDelays++;
        if (timing.longestSilence > longestSilence) longestSilence = timing.longestSilence;
        
        // Store details for table
        callDetails.push({
          id: call.meta?.["Contact ID"] || 'Unknown',
          agent: call.agent || (call.meta && (call.meta["Agent name"] || call.meta["Agent"])) || "Unknown",
          startTime: call.startTime instanceof Date ? call.startTime : new Date(call.meta["Initiation timestamp"]),
          deadAir: timing.deadAirInstances,
          delayedResponses: timing.delayedAgentResponses,
          longestSilence: timing.longestSilence
        });
      });
      
      // Create metrics cards
      const metricsContainer = document.createElement('div');
      metricsContainer.className = 'timing-metrics-container';
      
      // Dead air card
      const deadAirCard = document.createElement('div');
      deadAirCard.className = 'timing-metric-card dead-air-card';
      deadAirCard.innerHTML = `
        <div class="timing-metric-label">Dead Air Instances</div>
        <div class="timing-metric-value">${totalDeadAir}</div>
        <div class="timing-metric-unit">across ${callsWithSilence} calls</div>
      `;
      metricsContainer.appendChild(deadAirCard);
      
      // Delayed response card
      const delayedResponseCard = document.createElement('div');
      delayedResponseCard.className = 'timing-metric-card delayed-response-card';
      delayedResponseCard.innerHTML = `
        <div class="timing-metric-label">Delayed Agent Responses</div>
        <div class="timing-metric-value">${totalDelayedResponses}</div>
        <div class="timing-metric-unit">across ${callsWithDelays} calls</div>
      `;
      metricsContainer.appendChild(delayedResponseCard);
      
      // Longest silence card
      const longestSilenceCard = document.createElement('div');
      longestSilenceCard.className = 'timing-metric-card longest-silence-card';
      longestSilenceCard.innerHTML = `
        <div class="timing-metric-label">Longest Silence</div>
        <div class="timing-metric-value">${longestSilence.toFixed(1)}</div>
        <div class="timing-metric-unit">seconds</div>
      `;
      metricsContainer.appendChild(longestSilenceCard);
      
      // Add metrics container to main container
      timingAnalysisDiv.appendChild(metricsContainer);
      
      // Add detailed table
      if (callDetails.length > 0) {
        const tableContainer = document.createElement('div');
        tableContainer.className = 'timing-table-container mt-4';
        
        const table = document.createElement('table');
        table.className = 'timing-detail-table';
        
        // Table header
        const thead = document.createElement('thead');
        thead.innerHTML = `
          <tr>
            <th>Contact ID</th>
            <th>Agent</th>
            <th>Date & Time</th>
            <th>Dead Air</th>
            <th>Delayed Responses</th>
            <th>Longest Silence (s)</th>
          </tr>
        `;
        table.appendChild(thead);
        
        // Table body
        const tbody = document.createElement('tbody');
        
        // Sort by most problematic calls first (most silences + delays)
        callDetails.sort((a, b) => (b.deadAir + b.delayedResponses) - (a.deadAir + a.delayedResponses));
        
        callDetails.forEach(detail => {
          const row = document.createElement('tr');
          
          // Highlight rows with significant timing issues
          if (detail.deadAir > 3 || detail.delayedResponses > 3) {
            row.style.backgroundColor = 'rgba(255, 77, 77, 0.1)';
          }
          
          row.innerHTML = `
            <td>${detail.id}</td>
            <td>${detail.agent}</td>
            <td>${detail.startTime ? detail.startTime.toLocaleString() : 'N/A'}</td>
            <td>${detail.deadAir}</td>
            <td>${detail.delayedResponses}</td>
            <td>${detail.longestSilence.toFixed(1)}</td>
          `;
          
          tbody.appendChild(row);
        });
        
        table.appendChild(tbody);
        tableContainer.appendChild(table);
        
        // Add insights about the results
        const insightsDiv = document.createElement('div');
        insightsDiv.className = 'timing-insights mt-4 p-4 rounded';
        insightsDiv.style.backgroundColor = 'rgba(159, 112, 253, 0.1)';
        insightsDiv.style.borderLeft = '4px solid var(--inspiro-purple-primary)';
        
        let insightContent = '<h3 class="text-lg font-semibold mb-2">Timing Insights</h3><ul class="list-disc ml-5">';
        
        // Generate insights based on the data
        const avgDeadAirPerCall = totalDeadAir / callsWithTimingInfo.length;
        const avgDelayedResponsesPerCall = totalDelayedResponses / callsWithTimingInfo.length;
        
        // Insights about dead air
        if (avgDeadAirPerCall > 2) {
          insightContent += `<li>High frequency of dead air instances (${avgDeadAirPerCall.toFixed(1)} per call average) may indicate agent uncertainty or system issues</li>`;
        } else if (avgDeadAirPerCall > 0) {
          insightContent += `<li>Moderate level of dead air instances (${avgDeadAirPerCall.toFixed(1)} per call average)</li>`;
        } else {
          insightContent += `<li>No significant dead air detected in analyzed calls</li>`;
        }
        
        // Insights about delayed responses
        if (avgDelayedResponsesPerCall > 2) {
          insightContent += `<li>High frequency of delayed agent responses (${avgDelayedResponsesPerCall.toFixed(1)} per call average) suggests potential agent training or tool access issues</li>`;
        } else if (avgDelayedResponsesPerCall > 0) {
          insightContent += `<li>Some delayed agent responses detected (${avgDelayedResponsesPerCall.toFixed(1)} per call average)</li>`;
        } else {
          insightContent += `<li>No significant agent response delays detected in analyzed calls</li>`;
        }
        
        // Insights about longest silence
        if (longestSilence > 30) {
          insightContent += `<li>Very long silence detected (${longestSilence.toFixed(1)}s) may indicate substantial system issues or call transfers</li>`;
        } else if (longestSilence > 15) {
          insightContent += `<li>Moderate silence peaks (${longestSilence.toFixed(1)}s) suggest occasional system lookups or research needs</li>`;
        }
        
        insightContent += '</ul>';
        insightsDiv.innerHTML = insightContent;
        
        // Add table and insights
        timingAnalysisDiv.appendChild(tableContainer);
        timingAnalysisDiv.appendChild(insightsDiv);
      }
      
      // Add the entire timing analysis to the container
      container.appendChild(timingAnalysisDiv);
      
      // Add event listener to the export button
      document.getElementById('exportTimingAnalysisButton')?.addEventListener('click', () => exportCurrentReport('timingAnalysis'));
      
    } catch (error) {
      console.error("Error rendering timing analysis:", error);
      container.innerHTML = `<p class="no-data-message p-4 text-center">Error generating timing analysis: ${error.message}</p>`;
    }
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
        case 'phraseAnalysis':
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
            sheetName = "Phrase_Analysis";
            break;
        case 'timingAnalysis':
            if (!window.AI || typeof window.AI.analyzeTranscriptGaps !== 'function') {
                alert("Timing analysis function not available. Cannot export data.");
                return;
            }
            
            // Find calls with transcript timing data
            const callsWithTiming = callsToExport.filter(call => 
                call.transcript && 
                call.transcript.length > 1 && 
                call.transcript.some(line => line.start && line.end)
            );
            
            if (callsWithTiming.length === 0) {
                alert("No transcript timing data found in filtered calls. Cannot export timing analysis.");
                return;
            }
            
            // Analyze each call and create report rows
            reportData = callsWithTiming.map(call => {
                const callTime = call.startTime instanceof Date ? call.startTime : new Date(call.meta["Initiation timestamp"]);
                const timing = window.AI.analyzeTranscriptGaps(call);
                
                return {
                    "Contact ID": call.meta?.["Contact ID"] || 'N/A',
                    "Date & Time": callTime ? callTime.toLocaleString() : 'N/A',
                    "Agent": call.agent || (call.meta && (call.meta["Agent name"] || call.meta["Agent"])) || "Unknown",
                    "Dead Air Instances": timing ? timing.deadAirInstances : 'N/A',
                    "Delayed Agent Responses": timing ? timing.delayedAgentResponses : 'N/A',
                    "Longest Silence (s)": timing ? timing.longestSilence.toFixed(1) : 'N/A',
                    "Customer ID": call.customerId || call.meta?.["Customer phone number / email address"] || 'N/A',
                    "Issue": call.issue || '-',
                    "Summary": call.summary || '-'
                };
            });
            sheetName = "Timing_Analysis";
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