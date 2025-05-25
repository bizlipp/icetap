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
        // Calls from DataStackULTRA are assumed to be pre-analyzed by CallAnalyzer
        processAllCalls(allCallsData);
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
    const coachSummaryTextarea = document.getElementById("coachSummary");
    const selectedAgents = [...document.querySelectorAll(".coachCheck:checked")].map(cb => cb.value);

    if (selectedAgents.length === 0) {
      coachSummaryTextarea.value = "Please select at least one agent from the table to generate a summary.";
      return;
    }

    let summary = `🎯 Coaching Summary for ${selectedAgents.join(', ')}:\n=====================================\n\n`;
    selectedAgents.forEach(agentName => {
      const analysis = processedAgentAnalyses[agentName]; 
      if (!analysis) return;

      summary += `👤 Agent: ${analysis.agent}\n`;
      summary += `  📞 Total Calls: ${analysis.count}\n`;
      summary += `  ⏱️ Avg. Duration: ${analysis.avgDurationFormatted}\n`;
      summary += `  👍 Positive Interactions: ${analysis.totalPositiveInteractions}\n`;
      summary += `  🚩 Flags: ${analysis.totalFlags}\n`;
      if (analysis.coachingNotes.length > 0) {
        summary += `  📝 Key Coaching Points (from Analysis):\n`;
        analysis.coachingNotes.forEach(note => { summary += `    • ${note}\n`; });
      }
      
      // Add details from call.analysis if available (more robust)
      let commonIssues = [];
      let shortCallsCount = 0;
      let specificCoachingSuggestions = new Set();

      analysis.callDetails.forEach(call => {
          if(call.issue) commonIssues.push(call.issue);
          if(call.durationMinutes < 2) shortCallsCount++; // Example threshold for short call
          if(call.coachingSuggestions && Array.isArray(call.coachingSuggestions)){
              call.coachingSuggestions.forEach(sg => specificCoachingSuggestions.add(sg));
          }
      });
      
      if (specificCoachingSuggestions.size > 0) {
        summary += `  💡 Specific Automated Suggestions:\n`;
        specificCoachingSuggestions.forEach(sg => { summary += `    • ${sg}\n`; });
      }

      if(commonIssues.length > 0){
        const issueCounts = commonIssues.reduce((acc, curr) => (acc[curr] = (acc[curr] || 0) + 1, acc), {});
        summary += `  🚨 Common Issues Reported by Customers: ${Object.entries(issueCounts).map(([k,v]) => `${k} (x${v})`).join(', ')}\n`;
      }
      if(shortCallsCount > 0) summary += `  ⚠️ ${shortCallsCount} call(s) were under 2 minutes.\n`;
      summary += "-------------------------------------\n\n";
    });
    coachSummaryTextarea.value = summary.trim();
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

})();