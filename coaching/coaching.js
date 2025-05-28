/*
(function () {
  const calls = JSON.parse(localStorage.getItem("inspiroCallData")) || [];
  if (calls.length) {
    document.dispatchEvent(new CustomEvent("ICETAP_CallsLoaded", { detail: calls }));
  }
})();
*/

(function() {
  // Main logic for Coaching Dashboard
  let allCallsData = []; 
  let processedAgentAnalyses = {}; 
  let currentSearchTerm = "";
  let currentSortKey = "count"; 
  let currentSortDirection = "desc"; 
  let currentView = "list"; 

  // Modal elements (add these at the top with other variable declarations)
  let agentCallDetailsModal = null;
  let modalAgentNameEl = null;
  let modalAgentCallListEl = null;
  let modalCloseButton = null;

  // Helper to safely get agent name (relies on CallAnalyzer's structure if data is pre-analyzed)
  function getAgentName(call) {
    return call.agent || (call.meta && (call.meta.Agent || call.meta["Agent name"])) || "Unknown Agent";
  }

  // Helper to format seconds to MM:SS
  function formatSecondsToMMSS(totalSeconds) {
    if (isNaN(totalSeconds) || totalSeconds === null || totalSeconds < 0) return "00:00";
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  async function initializeCoachingDashboard() {
    if (!window.DataStackULTRA || !window.CallAnalyzer) {
      console.error("Coaching Dashboard: DataStackULTRA or CallAnalyzer is not available.");
      // Display an error message to the user in the dashboard area
      const dashboardElement = document.getElementById('coachingDashboard');
      if (dashboardElement) {
        dashboardElement.innerHTML = '<p class="no-data-message card p-4 text-center"><i class="fas fa-exclamation-triangle mr-2"></i>Error: Critical components (DataStackULTRA or CallAnalyzer) missing. Coaching dashboard cannot be loaded.</p>';
      }
      return;
    }

    try {
      allCallsData = await window.DataStackULTRA.get('loadedCalls', []);
      const activeFile = await window.DataStackULTRA.get('activeAuditFile', 'No file loaded');
      
      // Display filename (optional, if there's a placeholder in HTML)
      // const filenameDisplay = document.getElementById('coachingFilenameDisplay');
      // if (filenameDisplay) filenameDisplay.textContent = activeFile ? `File: ${activeFile}` : 'No file loaded';

      if (Array.isArray(allCallsData) && allCallsData.length > 0) {
        // Process calls with AI features if available
        if (window.AIIntegration && typeof window.AIIntegration.processCallsWithAI === 'function') {
          console.log("🧠 Processing calls with AI features for coaching dashboard...");
          allCallsData = await window.AIIntegration.processCallsWithAI(allCallsData);
        }
        
        // Calls from DataStackULTRA are assumed to be pre-analyzed by CallAnalyzer
        processAllCalls(allCallsData);
        
        // Render AI-powered insights if available
        renderTeamInsights(allCallsData);
        renderPhraseAnalysis(allCallsData);
        renderTimingAnalysis(allCallsData);
      } else {
        console.log("Coaching Dashboard: No calls data found in DataStackULTRA.");
        renderEmptyState();
      }
    } catch (error) {
      console.error("Coaching Dashboard: Error loading calls from DataStackULTRA:", error);
      renderEmptyState("Error loading data from DataStackULTRA.");
    }
    setupEventListeners(); // Ensure listeners are set up after initial data attempt

    // Initialize Modal elements after DOM is loaded
    agentCallDetailsModal = document.getElementById("agentCallDetailsModal");
    modalAgentNameEl = document.getElementById("modalAgentName");
    modalAgentCallListEl = document.getElementById("modalAgentCallList");
    if (agentCallDetailsModal) {
        modalCloseButton = agentCallDetailsModal.querySelector(".modal-close-button");
    }
    setupModalInteraction();
  }
  
  function renderEmptyState(message = "No calls data loaded. Please load a file on the main page."){
    const tbody = document.getElementById("coachAgentBody");
    const grid = document.getElementById("coachGrid");
    if(tbody) tbody.innerHTML = `<tr><td colspan='7' class='no-data-message p-4 text-center'>${message}</td></tr>`;
    if(grid) grid.innerHTML = `<p class='no-data-message p-4 text-center'>${message}</p>`;
    
    // Empty AI insight containers
    const teamPerformanceTrendEl = document.getElementById("teamPerformanceTrend");
    const topCoachingThemesEl = document.getElementById("topCoachingThemes");
    const conversationPatternsEl = document.getElementById("conversationPatterns");
    const coachPhraseAnalysisEl = document.getElementById("coachPhraseAnalysis");
    const coachTimingAnalysisEl = document.getElementById("coachTimingAnalysis");
    
    if (teamPerformanceTrendEl) teamPerformanceTrendEl.innerHTML = "No data available for analysis.";
    if (topCoachingThemesEl) topCoachingThemesEl.innerHTML = "No data available for analysis.";
    if (conversationPatternsEl) conversationPatternsEl.innerHTML = "No data available for analysis.";
    if (coachPhraseAnalysisEl) coachPhraseAnalysisEl.querySelector(".phrase-columns-wrapper").innerHTML = "No data available for phrase analysis.";
    if (coachTimingAnalysisEl) coachTimingAnalysisEl.querySelector(".timing-metrics-container").innerHTML = "No data available for timing analysis.";
    
    // Potentially hide or clear other parts of the UI too
    const coachSummaryTextarea = document.getElementById("coachSummary");
    if(coachSummaryTextarea) coachSummaryTextarea.value = "No data available to generate summaries.";
  }

  function processAllCalls(calls) {
    processedAgentAnalyses = {}; // Reset
    
    // Ensure CallAnalyzer and its functions are available
    if (!window.CallAnalyzer || !window.CallAnalyzer.groupByAgent || !window.CallAnalyzer.analyzeCall || !window.CallAnalyzer.generateCoachingNote) {
        console.error("CallAnalyzer utility functions are missing. Cannot process calls for coaching.");
        renderEmptyState("Critical analysis functions are missing. Cannot process calls.");
        return;
    }
    const callsByAgent = window.CallAnalyzer.groupByAgent(calls);

    for (const agentName in callsByAgent) {
      const agentCalls = callsByAgent[agentName];
      let totalDurationMinutes = 0; // Now sum of durationMinutes
      let totalPositiveInteractions = 0;
      let totalFlags = 0;
      const coachingNotesSet = new Set();
      const callDetails = [];

      agentCalls.forEach(call => {
        // Calls are assumed to be pre-analyzed from DataStackULTRA
        // 'call' itself should be the analysis result or contain it.
        callDetails.push(call); 
        totalDurationMinutes += call.durationMinutes || 0; 
        totalPositiveInteractions += call.thankScore || call.sentimentScore > 0 ? (call.thankScore || 1) : 0; // Use thankScore or sentiment
        totalFlags += (call.flags ? call.flags.length : 0);
        
        // generateCoachingNote expects an analysis result object
        const note = window.CallAnalyzer.generateCoachingNote(call); 
        if (note && note !== "No analysis data available to generate coaching note." && note !== "No specific coaching points identified from this analysis.") {
            // Take first line or a summary if notes are too long for the table cell
            const firstNoteLine = note.split('\n')[0];
            coachingNotesSet.add(firstNoteLine);
        }
      });

      const avgDurationMinutes = agentCalls.length > 0 ? totalDurationMinutes / agentCalls.length : 0;

      processedAgentAnalyses[agentName] = {
        agent: agentName,
        count: agentCalls.length,
        avgDurationFormatted: formatSecondsToMMSS(avgDurationMinutes * 60),
        avgDurationMinutes: avgDurationMinutes, 
        totalPositiveInteractions,
        totalFlags,
        coachingNotes: Array.from(coachingNotesSet),
        callDetails
      };
    }
    renderDynamicViews(); 
  }

  function getFilteredAndSortedAnalyses() {
    let analysesArray = Object.values(processedAgentAnalyses);
    if (currentSearchTerm) {
      analysesArray = analysesArray.filter(analysis => 
        analysis.agent.toLowerCase().includes(currentSearchTerm.toLowerCase())
      );
    }
    analysesArray.sort((a, b) => {
      let valA = a[currentSortKey];
      let valB = b[currentSortKey];
      if (currentSortKey === 'agent') {
        valA = String(valA).toLowerCase(); // Ensure string comparison for agent names
        valB = String(valB).toLowerCase();
      }
      if (valA < valB) return currentSortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return currentSortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return analysesArray;
  }

  function renderAgentTable() {
    const tbody = document.getElementById("coachAgentBody");
    if (!tbody) return;
    tbody.innerHTML = ""; 
    const analysesToRender = getFilteredAndSortedAnalyses();
    if (analysesToRender.length === 0) {
        tbody.innerHTML = "<tr><td colspan='7' class='no-data-message p-4 text-center'>No agents match your criteria or no data loaded.</td></tr>";
        return;
    }
    analysesToRender.forEach(info => {
      const row = document.createElement("tr");
      row.className = "agent-row hover:bg-gray-800 cursor-pointer"; // Added Tailwind-like classes
      row.dataset.agent = info.agent;
      row.innerHTML = `
        <td class="p-2"><input type="checkbox" class="coachCheck form-checkbox text-purple-600" value="${info.agent}" title="Select ${info.agent}"></td>
        <td class="p-2 agent-name text-purple-400 font-semibold">${info.agent}</td>
        <td class="p-2 text-center">${info.count}</td>
        <td class="p-2 text-center">${info.avgDurationFormatted}</td>
        <td class="p-2 text-center positive-count text-green-400">${info.totalPositiveInteractions}</td>
        <td class="p-2 text-center flag-count text-red-400">${info.totalFlags}</td>
        <td class="p-2 notes-cell text-xs text-gray-400">${info.coachingNotes.slice(0, 2).map(n => n.length > 50 ? n.substring(0,47) + '...': n).join("<br>") || "-"}</td>
      `;
      tbody.appendChild(row);
    });
    updateSortIcons();
  }

  function renderAgentCards() {
    const grid = document.getElementById("coachGrid");
    if (!grid) return;
    grid.innerHTML = "";
    const analysesToRender = getFilteredAndSortedAnalyses();
    if (analysesToRender.length === 0) {
        grid.innerHTML = "<p class='no-data-message p-4 text-center'>No agents match your criteria or no data loaded.</p>";
        return;
    }
    analysesToRender.forEach(info => {
      const card = document.createElement("div");
      card.className = "card agent-card bg-gray-800 shadow-lg rounded p-4 hover:shadow-xl transition-shadow"; // Tailwind-like
      card.dataset.agent = info.agent;
      card.innerHTML = `
        <div class="card-header flex justify-between items-center mb-3">
          <h3 class="text-lg font-semibold text-purple-400"><i class="fas fa-user-tie mr-2"></i>${info.agent}</h3>
          <span class="call-count-badge bg-purple-600 text-xs px-2 py-1 rounded-full">${info.count} calls</span>
        </div>
        <div class="card-body text-sm text-gray-300">
          <p><i class="fas fa-clock mr-1 text-gray-500"></i>Avg Duration: <span class="metric font-medium">${info.avgDurationFormatted}</span></p>
          <p><i class="fas fa-thumbs-up mr-1 positive-icon text-green-500"></i>Positive Interactions: <span class="metric font-medium">${info.totalPositiveInteractions}</span></p>
          <p><i class="fas fa-flag mr-1 flag-icon text-red-500"></i>Total Flags: <span class="metric font-medium">${info.totalFlags}</span></p>
          <div class="coaching-notes-summary mt-3">
            <h4 class="text-xs font-semibold text-gray-500 mb-1"><i class="fas fa-clipboard-list mr-1"></i>Key Notes:</h4>
            <ul class="list-disc list-inside text-xs text-gray-400">
              ${info.coachingNotes.length > 0 ? info.coachingNotes.slice(0, 3).map(note => `<li>${note.length > 60 ? note.substring(0,57) + '...': note}</li>`).join("") : "<li>No specific coaching notes generated.</li>"}
            </ul>
          </div>
        </div>
        <div class="card-footer mt-4 text-right">
          <button class="button view-agent-call-details-btn text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded" data-agent="${info.agent}">View Call Details</button>
        </div>
      `;
      grid.appendChild(card);

      const viewDetailsButton = card.querySelector(".view-agent-call-details-btn");
      if (viewDetailsButton) {
        viewDetailsButton.addEventListener("click", () => {
          displayAgentCallDetails(info.agent, info.callDetails);
        });
      }
    });
  }

  function renderDynamicViews() {
    const tableViewContainer = document.getElementById("agentTableViewContainer");
    const cardViewContainer = document.getElementById("agentCardViewContainer");
    if (!tableViewContainer || !cardViewContainer) return;

    if (currentView === "list") {
      tableViewContainer.classList.remove("hidden");
      cardViewContainer.classList.add("hidden");
      renderAgentTable();
    } else { // "cards"
      tableViewContainer.classList.add("hidden");
      cardViewContainer.classList.remove("hidden");
      renderAgentCards();
    }
  }
  
  function updateSortIcons() {
    document.querySelectorAll("#coachAgentTable th.sortable").forEach(th => {
      const icon = th.querySelector("i.fas");
      if(!icon) return;
      th.classList.remove('sort-asc', 'sort-desc');
      icon.className = 'fas fa-sort text-gray-500 ml-1'; 
      if (th.dataset.sortKey === currentSortKey) {
        th.classList.add(currentSortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
        icon.className = currentSortDirection === 'asc' ? 'fas fa-sort-up text-purple-400 ml-1' : 'fas fa-sort-down text-purple-400 ml-1';
      }
    });
  }

  function generateCoachSummary() {
    // Get checked agents
    const checkedAgents = Array.from(document.querySelectorAll("#coachAgentTable .coachCheck:checked"))
        .map(check => check.value);
    
    if (checkedAgents.length === 0) {
      alert("Please select at least one agent to generate a coaching summary.");
      return;
    }
    
    const coachSummaryTextarea = document.getElementById("coachSummary");
    if (!coachSummaryTextarea) return;
    
    try {
      // Filter the analysis objects to only those selected
      const selectedAgentAnalyses = checkedAgents.map(agent => processedAgentAnalyses[agent]).filter(Boolean);
      
      if (!selectedAgentAnalyses.length) {
        coachSummaryTextarea.value = "Could not find analysis data for the selected agent(s).";
        return;
      }
      
      // Combine all calls for selected agents
      const allSelectedCalls = selectedAgentAnalyses.flatMap(analysis => analysis.callDetails);
      
      // Use AI for advanced summary if available
      if (window.AI && typeof window.AI.generateCoachingSummary === 'function') {
        const enhancedSummary = window.AI.generateCoachingSummary(selectedAgentAnalyses);
        if (enhancedSummary) {
          coachSummaryTextarea.value = enhancedSummary;
          return;
        }
      }
      
      // If AI module not available or failed, generate basic summary
      const summaryParts = [];
      
      // Header with date and number of agents
      const today = new Date().toLocaleDateString();
      summaryParts.push(`COACHING SUMMARY (${today})
=================================================
Agents covered: ${checkedAgents.join(", ")}
`);

      // Generate summary for each agent
      selectedAgentAnalyses.forEach(analysis => {
        const totalDuration = analysis.avgDurationMinutes * analysis.count;
        
        summaryParts.push(`
AGENT: ${analysis.agent}
-------------------------------------------------
• Call volume: ${analysis.count} calls (${totalDuration.toFixed(1)} minutes total)
• Average call duration: ${analysis.avgDurationFormatted}
• Positive interactions: ${analysis.totalPositiveInteractions}
• Areas needing attention: ${analysis.totalFlags} flagged issues`);

        // Add coaching notes if available
        if (analysis.coachingNotes && analysis.coachingNotes.length > 0) {
          summaryParts.push(`
KEY COACHING POINTS:
${analysis.coachingNotes.map(note => `• ${note}`).join("\n")}`);
        }
        
        // Add sample call from the agent if available
        const sampleCall = analysis.callDetails[0];
        if (sampleCall) {
          const callDate = sampleCall.startTime ? new Date(sampleCall.startTime).toLocaleDateString() : "Unknown date";
          const callDuration = sampleCall.durationMinutes ? `${sampleCall.durationMinutes} min` : "Unknown duration";
          const callFlags = sampleCall.flags && sampleCall.flags.length > 0 ? sampleCall.flags.join(", ") : "None";
          
          summaryParts.push(`
SAMPLE CALL REFERENCE:
• Date: ${callDate}
• Duration: ${callDuration}
• Customer ID: ${sampleCall.customerId || "Unknown"}
• Flags: ${callFlags}`);
        }
        
        // Add phrase analysis if available
        if (window.AI && typeof window.AI.extractFrequentPhrasesBySpeaker === 'function' &&
            analysis.callDetails.some(call => call.transcript && call.transcript.length > 0)) {
          
          const callsWithTranscripts = analysis.callDetails.filter(call => call.transcript && call.transcript.length > 0);
          if (callsWithTranscripts.length > 0) {
            const phraseData = window.AI.extractFrequentPhrasesBySpeaker(callsWithTranscripts, 2);
            if (phraseData && phraseData.agent && phraseData.agent.length > 0) {
              const topPhrases = phraseData.agent.slice(0, 3).map(([phrase]) => phrase).join('", "');
              
              summaryParts.push(`
COMMON PHRASES:
• "${topPhrases}"`);
            }
          }
        }
        
        // Add sentiment score if available
        if (analysis.callDetails.some(call => call.sentimentScore !== undefined)) {
          const avgSentiment = analysis.callDetails.reduce((sum, call) => sum + (call.sentimentScore || 0), 0) / analysis.callDetails.length;
          const sentimentLabel = avgSentiment > 0.2 ? "Positive" : avgSentiment < -0.2 ? "Negative" : "Neutral";
          
          summaryParts.push(`
OVERALL TONE: ${sentimentLabel} (${avgSentiment.toFixed(2)} score)`);
        }
      });
      
      // Add improvement recommendations if more than one agent selected
      if (selectedAgentAnalyses.length > 1 && window.AI && typeof window.AI.generateTeamRecommendation === 'function') {
        const teamRecommendation = window.AI.generateTeamRecommendation(allSelectedCalls);
        if (teamRecommendation) {
          summaryParts.push(`
=================================================
TEAM IMPROVEMENT RECOMMENDATION:
${teamRecommendation}`);
        }
      }
      
      coachSummaryTextarea.value = summaryParts.join("\n");
      
    } catch (error) {
      console.error("Error generating coaching summary:", error);
      coachSummaryTextarea.value = `Error generating coaching summary: ${error.message}`;
    }
  }

  function copySummaryToClipboard() {
    const coachSummaryTextarea = document.getElementById("coachSummary");
    if (coachSummaryTextarea.value && coachSummaryTextarea.value !== "Please select at least one agent from the table to generate a summary.") {
      navigator.clipboard.writeText(coachSummaryTextarea.value)
        .then(() => { 
            const btn = document.getElementById('btnCopyCoachSummary');
            if(btn) { btn.innerHTML = '<i class="fas fa-check mr-1"></i> Copied!'; setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy mr-1"></i>Copy Summary';}, 2000); }
        })
        .catch(err => {
            console.error("Failed to copy summary: ", err);
            alert("Failed to copy. Check console or browser permissions.");
        });
    } else {
      alert("Nothing to copy or no summary generated.");
    }
  }

  function setupEventListeners() {
    const searchInput = document.getElementById("agentSearchInput");
    const viewToggleBtn = document.getElementById("viewToggleBtn");
    const selectAllCheckbox = document.getElementById("selectAllAgents");
    const generateSummaryBtn = document.getElementById("btnGenerateCoachMessage");
    const copySummaryBtn = document.getElementById("btnCopyCoachSummary");
    const agentTable = document.getElementById("coachAgentTable");

    if (searchInput) searchInput.addEventListener('input', (e) => {
      currentSearchTerm = e.target.value;
      renderDynamicViews();
    });

    if (viewToggleBtn) viewToggleBtn.addEventListener('click', () => {
      currentView = currentView === 'list' ? 'cards' : 'list';
      viewToggleBtn.innerHTML = currentView === 'list' ? '<i class="fas fa-th-large mr-1"></i> Card View' : '<i class="fas fa-th-list mr-1"></i> List View';
      renderDynamicViews();
    });

    if (selectAllCheckbox) selectAllCheckbox.addEventListener('change', (e) => {
      document.querySelectorAll(".coachCheck").forEach(cb => cb.checked = e.target.checked);
    });

    if (generateSummaryBtn) generateSummaryBtn.addEventListener('click', generateCoachSummary);
    if (copySummaryBtn) copySummaryBtn.addEventListener('click', copySummaryToClipboard);
    
    if (agentTable && agentTable.tHead) {
        agentTable.tHead.addEventListener('click', (e) => {
            const headerCell = e.target.closest('th.sortable');
            if (headerCell) {
                const sortKey = headerCell.dataset.sortKey;
                if (currentSortKey === sortKey) {
                    currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSortKey = sortKey;
                    currentSortDirection = 'desc'; // Default to desc for new column
                }
                renderDynamicViews();
            }
        });
    }
  }
  
  // Initialize the dashboard on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', initializeCoachingDashboard);

  // --- New Modal Functions ---
  function setupModalInteraction() {
    if (!agentCallDetailsModal || !modalCloseButton) return;

    modalCloseButton.onclick = () => {
      agentCallDetailsModal.classList.add("hidden");
    };

    // Close modal if clicking outside of modal-content
    agentCallDetailsModal.onclick = (event) => {
      if (event.target === agentCallDetailsModal) { // Click was on the backdrop
        agentCallDetailsModal.classList.add("hidden");
      }
    };
  }

  function displayAgentCallDetails(agentName, calls) {
    if (!agentCallDetailsModal || !modalAgentNameEl || !modalAgentCallListEl) {
      console.error("Modal elements not found for displaying agent call details.");
      return;
    }

    modalAgentNameEl.textContent = `Call Details for Agent: ${agentName}`;
    modalAgentCallListEl.innerHTML = ''; // Clear previous details

    if (!calls || calls.length === 0) {
      modalAgentCallListEl.innerHTML = '<p>No calls found for this agent.</p>';
      agentCallDetailsModal.classList.remove("hidden");
      return;
    }

    const ul = document.createElement('ul');
    calls.forEach(call => {
      const li = document.createElement('li');
      const callTime = call.startTime ? new Date(call.startTime).toLocaleString() : (call.meta && call.meta["Initiation timestamp"] ? new Date(call.meta["Initiation timestamp"]).toLocaleString() : 'N/A');
      const duration = call.durationMinutes ? `${call.durationMinutes.toFixed(1)} min` : (call.meta?.["Contact duration"] || 'N/A');
      
      li.innerHTML = `
        <strong>Contact ID:</strong> ${call.meta?.["Contact ID"] || 'N/A'}<br>
        <strong>Date & Time:</strong> ${callTime}<br>
        <strong>Duration:</strong> ${duration}<br>
        <strong>Issue:</strong> ${call.issue || 'N/A'}<br>
        <strong>Outcome:</strong> ${call.outcome || 'N/A'}<br>
        <strong>Summary:</strong> ${call.summary || 'N/A'}<br>
        <strong>Flags:</strong> ${(call.flags && call.flags.length > 0) ? call.flags.join(', ') : 'None'}
      `;
      ul.appendChild(li);
    });
    modalAgentCallListEl.appendChild(ul);
    agentCallDetailsModal.classList.remove("hidden");
  }

  /**
   * Render team-level AI insights
   * @param {Array} calls - Array of call objects
   */
  function renderTeamInsights(calls) {
    renderTeamPerformanceTrend(calls);
    renderTopCoachingThemes(calls);
    renderConversationPatterns(calls);
  }
  
  /**
   * Render team performance trend insights
   * @param {Array} calls - Array of call objects
   */
  function renderTeamPerformanceTrend(calls) {
    const performanceTrendEl = document.getElementById("teamPerformanceTrend");
    if (!performanceTrendEl) return;
    
    try {
      // Use AI module to analyze agent sentiment trajectory if available
      let performanceHTML = '';
      
      if (window.AI && typeof window.AI.analyzeAgentSentimentTrajectory === 'function') {
        const sentimentData = window.AI.analyzeAgentSentimentTrajectory(calls);
        
        if (sentimentData && (sentimentData.topAgents.length > 0 || sentimentData.strugglingAgents.length > 0)) {
          const topAgents = sentimentData.topAgents.slice(0, 3).map(agent => 
            `<span class="agent-name">${agent}</span><span class="agent-trend-indicator trend-up"><i class="fas fa-arrow-up ml-1"></i></span>`
          ).join(", ");
          
          const strugglingAgents = sentimentData.strugglingAgents.slice(0, 3).map(agent => 
            `<span class="agent-name">${agent}</span><span class="agent-trend-indicator trend-down"><i class="fas fa-arrow-down ml-1"></i></span>`
          ).join(", ");
          
          performanceHTML = `
            <p>Based on analysis of ${calls.length} calls, the following trends were identified:</p>
            <div class="performance-trends mt-2">
              ${topAgents ? `<p><strong>Improving:</strong> ${topAgents}</p>` : ''}
              ${strugglingAgents ? `<p><strong>Needs attention:</strong> ${strugglingAgents}</p>` : ''}
            </div>
          `;
        } else {
          performanceHTML = '<p>No clear performance trends detected in the current dataset.</p>';
        }
      } else {
        // Calculate basic performance metrics if AI module is not available
        const callsByAgent = {};
        calls.forEach(call => {
          const agent = call.agent || (call.meta && (call.meta.Agent || call.meta["Agent name"])) || "Unknown";
          callsByAgent[agent] = callsByAgent[agent] || [];
          callsByAgent[agent].push(call);
        });
        
        // Calculate positive vs negative ratios
        const agentPerformance = Object.entries(callsByAgent).map(([agent, agentCalls]) => {
          const positiveCount = agentCalls.filter(call => 
            (call.positiveFlags && call.positiveFlags.length > 0) || 
            (call.sentimentScore && call.sentimentScore > 0)
          ).length;
          
          const negativeCount = agentCalls.filter(call => 
            (call.flags && call.flags.length > 0) || 
            (call.sentimentScore && call.sentimentScore < 0)
          ).length;
          
          const ratio = agentCalls.length > 0 ? positiveCount / agentCalls.length : 0;
          
          return {
            agent,
            ratio,
            callCount: agentCalls.length
          };
        });
        
        // Sort by ratio (desc) and filter to agents with at least 3 calls
        const sortedPerformance = agentPerformance
          .filter(p => p.callCount >= 3)
          .sort((a, b) => b.ratio - a.ratio);
        
        if (sortedPerformance.length > 0) {
          const topPerformers = sortedPerformance.slice(0, 3).map(p => 
            `<span class="agent-name">${p.agent}</span><span class="agent-trend-indicator trend-up"><i class="fas fa-arrow-up ml-1"></i></span>`
          ).join(", ");
          
          const bottomPerformers = sortedPerformance.slice(-3).reverse().map(p => 
            `<span class="agent-name">${p.agent}</span><span class="agent-trend-indicator trend-down"><i class="fas fa-arrow-down ml-1"></i></span>`
          ).join(", ");
          
          performanceHTML = `
            <p>Based on positive interaction ratio across ${calls.length} calls:</p>
            <div class="performance-trends mt-2">
              ${topPerformers ? `<p><strong>Top performers:</strong> ${topPerformers}</p>` : ''}
              ${bottomPerformers ? `<p><strong>Needs improvement:</strong> ${bottomPerformers}</p>` : ''}
            </div>
          `;
        } else {
          performanceHTML = '<p>Not enough calls per agent to determine performance trends.</p>';
        }
      }
      
      performanceTrendEl.innerHTML = performanceHTML;
    } catch (error) {
      console.error("Error rendering team performance trend:", error);
      performanceTrendEl.innerHTML = "Error analyzing team performance trends.";
    }
  }
  
  /**
   * Render top coaching themes
   * @param {Array} calls - Array of call objects
   */
  function renderTopCoachingThemes(calls) {
    const themesEl = document.getElementById("topCoachingThemes");
    if (!themesEl) return;
    
    try {
      let themesHTML = '';
      
      if (window.AI && typeof window.AI.generateCoachingThemes === 'function') {
        const themes = window.AI.generateCoachingThemes(calls);
        
        if (themes && themes.length > 0) {
          // Clean up themes (remove "Address coaching around: " prefix)
          const cleanThemes = themes.map(theme => {
            const cleanTheme = theme.replace(/^Address coaching around: /i, '');
            return cleanTheme.charAt(0).toUpperCase() + cleanTheme.slice(1);
          });
          
          // Categorize themes by priority
          const highPriorityThemes = cleanThemes.slice(0, 2);
          const mediumPriorityThemes = cleanThemes.slice(2, 4);
          const lowPriorityThemes = cleanThemes.slice(4);
          
          themesHTML = `
            <p>Key coaching themes identified across the team:</p>
            <div class="coaching-themes-container mt-2">
              ${highPriorityThemes.map(theme => `<span class="theme-tag high">${theme}</span>`).join('')}
              ${mediumPriorityThemes.map(theme => `<span class="theme-tag medium">${theme}</span>`).join('')}
              ${lowPriorityThemes.map(theme => `<span class="theme-tag low">${theme}</span>`).join('')}
            </div>
          `;
        } else {
          themesHTML = '<p>No coaching themes identified in the current dataset.</p>';
        }
      } else {
        // Generate basic coaching themes if AI module is not available
        const flagCounts = {};
        calls.forEach(call => {
          if (call.flags && Array.isArray(call.flags)) {
            call.flags.forEach(flag => {
              flagCounts[flag] = (flagCounts[flag] || 0) + 1;
            });
          }
        });
        
        const sortedFlags = Object.entries(flagCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        
        if (sortedFlags.length > 0) {
          // Categorize flags by occurrence count
          const highPriorityFlags = sortedFlags.slice(0, 2).map(([flag]) => flag);
          const mediumPriorityFlags = sortedFlags.slice(2, 4).map(([flag]) => flag);
          const lowPriorityFlags = sortedFlags.slice(4).map(([flag]) => flag);
          
          themesHTML = `
            <p>Top coaching focus areas based on call flags:</p>
            <div class="coaching-themes-container mt-2">
              ${highPriorityFlags.map(flag => `<span class="theme-tag high">${flag}</span>`).join('')}
              ${mediumPriorityFlags.map(flag => `<span class="theme-tag medium">${flag}</span>`).join('')}
              ${lowPriorityFlags.map(flag => `<span class="theme-tag low">${flag}</span>`).join('')}
            </div>
          `;
        } else {
          themesHTML = '<p>No coaching themes identified in the current dataset.</p>';
        }
      }
      
      themesEl.innerHTML = themesHTML;
    } catch (error) {
      console.error("Error rendering coaching themes:", error);
      themesEl.innerHTML = "Error analyzing coaching themes.";
    }
  }
  
  /**
   * Render conversation patterns insights
   * @param {Array} calls - Array of call objects
   */
  function renderConversationPatterns(calls) {
    const patternsEl = document.getElementById("conversationPatterns");
    if (!patternsEl) return;
    
    try {
      // First check if we have transcript data to analyze
      const callsWithTranscripts = calls.filter(call => call.transcript && call.transcript.length > 0);
      
      if (callsWithTranscripts.length === 0) {
        patternsEl.innerHTML = '<p>No transcript data available for conversation pattern analysis.</p>';
        return;
      }
      
      let patternsHTML = '';
      
      if (window.AI && typeof window.AI.extractFrequentPhrasesBySpeaker === 'function') {
        const phraseData = window.AI.extractFrequentPhrasesBySpeaker(callsWithTranscripts);
        
        if (phraseData && (phraseData.agent.length > 0 || phraseData.customer.length > 0)) {
          // Extract top agent phrases
          const agentPhrases = phraseData.agent.slice(0, 3).map(([phrase, count]) => {
            return `<span class="insight-highlight">"${phrase}"</span> (${count})`;
          }).join(', ');
          
          // Extract top customer phrases
          const customerPhrases = phraseData.customer.slice(0, 3).map(([phrase, count]) => {
            return `<span class="insight-highlight">"${phrase}"</span> (${count})`;
          }).join(', ');
          
          patternsHTML = `
            <p>Analysis of ${callsWithTranscripts.length} call transcripts reveals:</p>
            <ul class="mt-2 ml-4 list-disc">
              ${agentPhrases ? `<li><strong>Common agent phrases:</strong> ${agentPhrases}</li>` : ''}
              ${customerPhrases ? `<li><strong>Common customer phrases:</strong> ${customerPhrases}</li>` : ''}
            </ul>
          `;
          
          // Add timing pattern insights if available
          if (window.AI && typeof window.AI.analyzeTranscriptGaps === 'function') {
            let totalDeadAir = 0;
            let totalDelayedResponses = 0;
            
            callsWithTranscripts.forEach(call => {
              const gaps = window.AI.analyzeTranscriptGaps(call);
              if (gaps) {
                totalDeadAir += gaps.deadAirInstances;
                totalDelayedResponses += gaps.delayedAgentResponses;
              }
            });
            
            if (totalDeadAir > 0 || totalDelayedResponses > 0) {
              patternsHTML += `
                <p class="mt-2"><strong>Timing patterns:</strong></p>
                <ul class="ml-4 list-disc">
                  ${totalDeadAir > 0 ? `<li>${totalDeadAir} instances of dead air across calls</li>` : ''}
                  ${totalDelayedResponses > 0 ? `<li>${totalDelayedResponses} delayed agent responses</li>` : ''}
                </ul>
              `;
            }
          }
        } else {
          patternsHTML = '<p>No clear conversation patterns detected in available transcripts.</p>';
        }
      } else {
        // Basic pattern analysis if AI module is not available
        patternsHTML = `<p>Transcript data available for ${callsWithTranscripts.length} calls, but advanced pattern analysis requires AI module.</p>`;
      }
      
      patternsEl.innerHTML = patternsHTML;
    } catch (error) {
      console.error("Error rendering conversation patterns:", error);
      patternsEl.innerHTML = "Error analyzing conversation patterns.";
    }
  }

  /**
   * Render phrase analysis for coaching
   * @param {Array} calls - Array of call objects
   */
  function renderPhraseAnalysis(calls) {
    const phraseAnalysisEl = document.getElementById("coachPhraseAnalysis");
    if (!phraseAnalysisEl) return;
    
    const phraseContainerEl = phraseAnalysisEl.querySelector(".phrase-columns-wrapper");
    if (!phraseContainerEl) return;
    
    // Filter calls with transcripts
    const callsWithTranscripts = calls.filter(call => call.transcript && call.transcript.length > 0);
    
    if (callsWithTranscripts.length === 0) {
      phraseContainerEl.innerHTML = '<p>No transcript data available for phrase analysis.</p>';
      return;
    }
    
    try {
      // Group calls by agent
      const callsByAgent = {};
      callsWithTranscripts.forEach(call => {
        const agent = call.agent || (call.meta && (call.meta.Agent || call.meta["Agent name"])) || "Unknown";
        callsByAgent[agent] = callsByAgent[agent] || [];
        callsByAgent[agent].push(call);
      });
      
      // Get agent names with at least 2 calls
      const agentsWithMultipleCalls = Object.entries(callsByAgent)
        .filter(([_, agentCalls]) => agentCalls.length >= 2)
        .map(([agent]) => agent);
      
      if (agentsWithMultipleCalls.length === 0) {
        phraseContainerEl.innerHTML = '<p>Not enough calls per agent for meaningful phrase analysis.</p>';
        return;
      }
      
      // Process phrases for each agent using AI if available
      if (window.AI && typeof window.AI.extractFrequentPhrasesBySpeaker === 'function') {
        // Get overall agent phrases first
        const allAgentPhrases = window.AI.extractFrequentPhrasesBySpeaker(callsWithTranscripts);
        
        // Helper function to render a phrase column
        const renderPhraseColumn = (title, phrases, columnClass) => {
          if (!phrases || phrases.length === 0) {
            return `
              <div class="phrase-column ${columnClass}">
                <h3>${title}</h3>
                <p class="text-sm text-gray-400">No phrases detected</p>
              </div>
            `;
          }
          
          return `
            <div class="phrase-column ${columnClass}">
              <h3>${title}</h3>
              <ul class="phrase-list">
                ${phrases.slice(0, 5).map(([phrase, count]) => `
                  <li>
                    <span class="phrase-text">${phrase}</span>
                    <span class="phrase-count">${count}</span>
                  </li>
                `).join('')}
              </ul>
            </div>
          `;
        };
        
        // Render the overall agent phrases column
        let columnsHTML = renderPhraseColumn('Team Agent Phrases', allAgentPhrases.agent, 'agent-phrases');
        
        // Get phrases for top 2 agents with most calls
        const topAgents = Object.entries(callsByAgent)
          .sort((a, b) => b[1].length - a[1].length)
          .slice(0, 2)
          .map(([agent, calls]) => ({ agent, calls }));
        
        // Add columns for top agents
        topAgents.forEach(({ agent, calls }) => {
          const agentPhrases = window.AI.extractFrequentPhrasesBySpeaker(calls, 2);
          if (agentPhrases && agentPhrases.agent && agentPhrases.agent.length > 0) {
            columnsHTML += renderPhraseColumn(`${agent}'s Phrases`, agentPhrases.agent, 'agent-phrases');
          }
        });
        
        phraseContainerEl.innerHTML = columnsHTML;
      } else {
        // Basic phrase extraction if AI is not available
        phraseContainerEl.innerHTML = '<p>Advanced phrase analysis requires the AI module.</p>';
      }
    } catch (error) {
      console.error("Error rendering phrase analysis:", error);
      phraseContainerEl.innerHTML = `<p>Error analyzing phrases: ${error.message}</p>`;
    }
  }
  
  /**
   * Render timing analysis for coaching
   * @param {Array} calls - Array of call objects
   */
  function renderTimingAnalysis(calls) {
    const timingAnalysisEl = document.getElementById("coachTimingAnalysis");
    if (!timingAnalysisEl) return;
    
    const timingContainerEl = timingAnalysisEl.querySelector(".timing-metrics-container");
    if (!timingContainerEl) return;
    
    // Filter calls with transcripts
    const callsWithTranscripts = calls.filter(call => call.transcript && call.transcript.length > 0);
    
    if (callsWithTranscripts.length === 0) {
      timingContainerEl.innerHTML = '<p>No transcript data available for timing analysis.</p>';
      return;
    }
    
    try {
      // Group calls by agent
      const callsByAgent = {};
      callsWithTranscripts.forEach(call => {
        const agent = call.agent || (call.meta && (call.meta.Agent || call.meta["Agent name"])) || "Unknown";
        callsByAgent[agent] = callsByAgent[agent] || [];
        callsByAgent[agent].push(call);
      });
      
      // Process timing metrics if AI is available
      if (window.AI && typeof window.AI.analyzeTranscriptGaps === 'function') {
        // Overall timing metrics
        let totalDeadAir = 0;
        let totalDelayedResponses = 0;
        let longestSilence = 0;
        let worstAgent = { name: '', score: 0 };
        
        // Process timing metrics for each agent
        Object.entries(callsByAgent).forEach(([agent, agentCalls]) => {
          let agentDeadAir = 0;
          let agentDelayedResponses = 0;
          
          agentCalls.forEach(call => {
            const gaps = window.AI.analyzeTranscriptGaps(call);
            if (gaps) {
              agentDeadAir += gaps.deadAirInstances;
              agentDelayedResponses += gaps.delayedAgentResponses;
              totalDeadAir += gaps.deadAirInstances;
              totalDelayedResponses += gaps.delayedAgentResponses;
              
              if (gaps.longestSilence > longestSilence) {
                longestSilence = gaps.longestSilence;
              }
            }
          });
          
          // Calculate a simple 'timing issues score' per agent
          const avgIssuesPerCall = (agentDeadAir + agentDelayedResponses) / agentCalls.length;
          
          if (avgIssuesPerCall > worstAgent.score && agentCalls.length >= 2) {
            worstAgent = { 
              name: agent, 
              score: avgIssuesPerCall,
              deadAir: agentDeadAir,
              delayedResponses: agentDelayedResponses,
              callCount: agentCalls.length
            };
          }
        });
        
        // Calculate averages
        const avgDeadAir = callsWithTranscripts.length > 0 ? totalDeadAir / callsWithTranscripts.length : 0;
        const avgDelayedResponses = callsWithTranscripts.length > 0 ? totalDelayedResponses / callsWithTranscripts.length : 0;
        
        // Render the timing metrics
        timingContainerEl.innerHTML = `
          <div class="timing-metric-card dead-air-card">
            <div class="timing-metric-label">Dead Air Instances</div>
            <div class="timing-metric-value">${totalDeadAir}</div>
            <div class="timing-metric-unit">total (${avgDeadAir.toFixed(1)} avg/call)</div>
          </div>
          <div class="timing-metric-card delayed-response-card">
            <div class="timing-metric-label">Delayed Agent Responses</div>
            <div class="timing-metric-value">${totalDelayedResponses}</div>
            <div class="timing-metric-unit">total (${avgDelayedResponses.toFixed(1)} avg/call)</div>
          </div>
          <div class="timing-metric-card longest-silence-card">
            <div class="timing-metric-label">Longest Silence</div>
            <div class="timing-metric-value">${longestSilence.toFixed(1)}</div>
            <div class="timing-metric-unit">seconds</div>
          </div>
        `;
        
        // Add coaching recommendation if we have a clear 'worst performer'
        if (worstAgent.name && worstAgent.score > 1) {
          timingContainerEl.innerHTML += `
            <div class="timing-coach-recommendation mt-3 p-3 bg-gray-800 rounded">
              <h4 class="text-sm font-semibold mb-1">Coaching Recommendation:</h4>
              <p class="text-sm">Focus timing coaching on <strong>${worstAgent.name}</strong> who averages ${worstAgent.score.toFixed(1)} timing issues per call (${worstAgent.deadAir} dead air, ${worstAgent.delayedResponses} delayed responses across ${worstAgent.callCount} calls).</p>
            </div>
          `;
        }
      } else if (window.TimingAnalysis) {
        // Use TimingAnalysis module if available
        let totalGaps = 0;
        let longestSilence = 0;
        
        callsWithTranscripts.forEach(call => {
          if (call.transcript && call.transcript.length > 0) {
            // Convert transcript to string for TimingAnalysis
            const transcriptText = call.transcript.map(line => 
              `${line.speaker || ''}: [${line.start || ''}] ${line.text || ''} [${line.end || ''}]`
            ).join('\n');
            
            const analysis = window.TimingAnalysis.analyzeTranscript(transcriptText);
            if (analysis && analysis.silences) {
              totalGaps += analysis.silences.length;
              
              // Find longest silence
              analysis.silences.forEach(silence => {
                if (silence.duration > longestSilence) {
                  longestSilence = silence.duration;
                }
              });
            }
          }
        });
        
        // Render simplified timing metrics
        timingContainerEl.innerHTML = `
          <div class="timing-metric-card">
            <div class="timing-metric-label">Silence Gaps</div>
            <div class="timing-metric-value">${totalGaps}</div>
            <div class="timing-metric-unit">total (${(totalGaps / callsWithTranscripts.length).toFixed(1)} avg/call)</div>
          </div>
          <div class="timing-metric-card longest-silence-card">
            <div class="timing-metric-label">Longest Silence</div>
            <div class="timing-metric-value">${longestSilence.toFixed(1)}</div>
            <div class="timing-metric-unit">seconds</div>
          </div>
        `;
      } else {
        // Basic message if no timing analysis is available
        timingContainerEl.innerHTML = '<p>Advanced timing analysis requires the AI or TimingAnalysis module.</p>';
      }
    } catch (error) {
      console.error("Error rendering timing analysis:", error);
      timingContainerEl.innerHTML = `<p>Error analyzing timing: ${error.message}</p>`;
    }
  }

})();