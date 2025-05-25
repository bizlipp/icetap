(function() {
  // loadedCalls will be retrieved from DataStackULTRA and is assumed to be pre-analyzed.

  document.addEventListener('DOMContentLoaded', async () => {
    const filenameDisplayEl = document.getElementById("callbackFilenameDisplay");
    const totalCallsEl = document.getElementById("cbTotalCalls");
    const repeatContactsEl = document.getElementById("cbRepeatContactsValue");
    const flaggedRisksEl = document.getElementById("cbFlaggedRisksValue");
    const traceBodyEl = document.getElementById("cbTraceBody");
    const mainContentArea = document.getElementById('callbackDashboard');

    // New stat card elements
    const avgCallsPerRepeaterEl = document.getElementById("cbAvgCallsPerRepeater");
    const percentCallbacksEl = document.getElementById("cbPercentCallbacks");
    const avgAgentHopsEl = document.getElementById("cbAvgAgentHops");
    const commonFlagsInCallbacksEl = document.getElementById("cbCommonFlagsInCallbacks");

    // Modal elements
    const modal = document.getElementById("callbackDeepDiveModal");
    const modalCustomerIdentifierEl = document.getElementById("modalCustomerIdentifier");
    const modalCallSequenceDetailsEl = document.getElementById("modalCallSequenceDetails");
    const closeModalButton = modal ? modal.querySelector(".close-button") : null;

    function setupModalEventListeners(modalInstance, closeButtonInstance) {
      if (closeButtonInstance) {
        closeButtonInstance.onclick = function() {
          if (modalInstance) modalInstance.classList.add("hidden");
        }
      }
      window.addEventListener('click', function(event) { // Use addEventListener for window
        if (event.target == modalInstance) {
          if (modalInstance) modalInstance.classList.add("hidden");
        }
      });
    }

    if (modal) setupModalEventListeners(modal, closeModalButton);

    if (!window.DataStackULTRA) {
      console.error("DataStackULTRA is not initialized. Callback dashboard cannot load data.");
      if (totalCallsEl) totalCallsEl.textContent = "Error";
      if (traceBodyEl) traceBodyEl.innerHTML = "<tr><td colspan='5' class='no-data-message p-4 text-center'>Error loading data. DataStackULTRA not found.</td></tr>";
      if (mainContentArea) {
        mainContentArea.innerHTML = '<p class="no-data-message dashboard-section"><i class="fas fa-info-circle mr-2"></i>Error: DataStackULTRA not available. Cannot load callback data.</p>';
      }
      return;
    }

    let callsToRender = [];
    let activeFile = 'No file information';

    try {
      callsToRender = await window.DataStackULTRA.get('loadedCalls', []);
      activeFile = await window.DataStackULTRA.get('activeAuditFile', 'No file information');

      if (filenameDisplayEl) {
        filenameDisplayEl.textContent = activeFile ? `File: ${activeFile}` : 'No file loaded';
      }
      
      renderCallbackTable(callsToRender);

    } catch (error) {
      console.error("Error loading or processing callback data:", error);
      if (mainContentArea) {
           mainContentArea.innerHTML = `<p class="no-data-message dashboard-section"><i class="fas fa-exclamation-triangle mr-2"></i>Error loading callback data: ${error.message}.</p>`;
      }
      if (filenameDisplayEl) filenameDisplayEl.textContent = "Error loading data.";
    }
  });

  function renderCallbackTable(callsToRender) {
    const totalCallsEl = document.getElementById("cbTotalCalls"); // Re-fetch in case of late DOM
    const repeatContactsEl = document.getElementById("cbRepeatContactsValue");
    const flaggedRisksEl = document.getElementById("cbFlaggedRisksValue");
    const traceBodyEl = document.getElementById("cbTraceBody");
    const mainContentArea = document.getElementById('callbackDashboard');

    // New stat card elements
    const avgCallsPerRepeaterEl = document.getElementById("cbAvgCallsPerRepeater");
    const percentCallbacksEl = document.getElementById("cbPercentCallbacks");
    const avgAgentHopsEl = document.getElementById("cbAvgAgentHops");
    const commonFlagsInCallbacksEl = document.getElementById("cbCommonFlagsInCallbacks");

    // Modal elements
    const modal = document.getElementById("callbackDeepDiveModal");
    const modalCustomerIdentifierEl = document.getElementById("modalCustomerIdentifier");
    const modalCallSequenceDetailsEl = document.getElementById("modalCallSequenceDetails");
    const closeModalButton = modal ? modal.querySelector(".close-button") : null;

    if (closeModalButton) {
      closeModalButton.onclick = function() {
        if (modal) modal.classList.add("hidden");
      }
    }
    // Close modal if clicking outside of modal-content
    window.onclick = function(event) {
      if (event.target == modal) {
        if (modal) modal.classList.add("hidden");
      }
    }

    if (!totalCallsEl || !traceBodyEl || !mainContentArea || 
        !avgCallsPerRepeaterEl || !percentCallbacksEl || !avgAgentHopsEl || !commonFlagsInCallbacksEl) {
        console.error("Callback dashboard critical DOM elements not found for rendering.");
        return;
    }
    
    totalCallsEl.textContent = callsToRender.length;
    traceBodyEl.innerHTML = ""; 

    const statsGrid = mainContentArea.querySelector('.stats-grid');
    const tableSection = mainContentArea.querySelector('.table-section');
    let noDataMessageEl = mainContentArea.querySelector('#no-data-callback-msg');

    if (callsToRender.length === 0) {
        if (traceBodyEl) traceBodyEl.innerHTML = "<tr><td colspan='5' class='no-data-message p-4 text-center'>No calls loaded.</td></tr>";
        if(repeatContactsEl) repeatContactsEl.textContent = "0";
        if(flaggedRisksEl) flaggedRisksEl.textContent = "0";
        
        if (statsGrid) statsGrid.style.display = 'none';
        if (tableSection) tableSection.style.display = 'none';
        
        if (!noDataMessageEl) {
            noDataMessageEl = document.createElement('div');
            noDataMessageEl.id = 'no-data-callback-msg';
            noDataMessageEl.className = 'no-data-message-container dashboard-section card mt-4 p-4 text-center';
            // Insert after the header section or at a sensible default place
            const headerSection = mainContentArea.querySelector('.dashboard-header'); // Assuming a common class for header
            if (headerSection && headerSection.nextElementSibling) {
                headerSection.parentNode.insertBefore(noDataMessageEl, headerSection.nextElementSibling);
            } else {
                mainContentArea.insertBefore(noDataMessageEl, mainContentArea.firstChild); // Fallback
            }
        }
        noDataMessageEl.innerHTML = '<p><i class="fas fa-info-circle mr-2"></i>No calls available for callback analysis. Please load a file on the main page.</p>';
        noDataMessageEl.style.display = 'block';

        return; 
    } else {
        if (statsGrid) statsGrid.style.display = ''; // Or original display value
        if (tableSection) tableSection.style.display = ''; // Or original display value
        if (noDataMessageEl) noDataMessageEl.style.display = 'none';
    }

    let repeatContactCount = 0;
    let flaggedRiskCount = 0;
    let totalCallbackInteractions = 0; // Sum of all calls that are part of any callback sequence
    let sumOfCallsPerRepeater = 0; // Sum of call counts for each repeating customer
    let totalAgentHopsInCallbacks = 0; // Sum of unique agent counts for each callback sequence
    const callbackFlagCounts = {}; // To count flags specifically in callback sequences

    // Use CallAnalyzer.groupByCustomer for consistency and to leverage central logic
    if (!window.CallAnalyzer || !window.CallAnalyzer.groupByCustomer) {
        console.error("CallAnalyzer.groupByCustomer is not available. Callback dashboard cannot group calls by customer.");
        traceBodyEl.innerHTML = "<tr><td colspan='5' class='no-data-message p-4 text-center'>Error: Critical grouping function missing.</td></tr>";
        if(repeatContactsEl) repeatContactsEl.textContent = "Error";
        if(flaggedRisksEl) flaggedRisksEl.textContent = "Error";
        return;
    }
    const callsByCustomer = window.CallAnalyzer.groupByCustomer(callsToRender);

    Object.values(callsByCustomer).forEach(customerCalls => {
      if (customerCalls.length > 1) { // This is a callback sequence
        repeatContactCount++;
        sumOfCallsPerRepeater += customerCalls.length;
        totalCallbackInteractions += customerCalls.length;

        // Ensure startTime is a Date object for sorting
        customerCalls.sort((a, b) => {
            const dateA = a.startTime instanceof Date ? a.startTime : new Date(a.meta["Initiation timestamp"]);
            const dateB = b.startTime instanceof Date ? b.startTime : new Date(b.meta["Initiation timestamp"]);
            return dateA - dateB;
        });

        const firstCall = customerCalls[0];
        const lastCall = customerCalls[customerCalls.length - 1];
        const agentsInvolvedList = customerCalls.map(c => c.agent || (c.meta && (c.meta["Agent name"] || c.meta["Agent"])) || "Unknown");
        const uniqueAgentsInSequence = [...new Set(agentsInvolvedList)];
        totalAgentHopsInCallbacks += uniqueAgentsInSequence.length;
        const agentsInvolvedDisplay = uniqueAgentsInSequence.join(", ");
        
        const firstCallTime = firstCall.startTime instanceof Date ? firstCall.startTime : new Date(firstCall.meta["Initiation timestamp"]);
        const lastCallTime = lastCall.startTime instanceof Date ? lastCall.startTime : new Date(lastCall.meta["Initiation timestamp"]);

        const timeDiffMs = lastCallTime - firstCallTime;
        const diffDays = Math.floor(timeDiffMs / (1000 * 60 * 60 * 24));
        const diffHrs = Math.floor((timeDiffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const diffMins = Math.floor((timeDiffMs % (1000 * 60 * 60)) / (1000 * 60));
        let repeatSpan = "";
        if (diffDays > 0) repeatSpan += `${diffDays}d `;
        if (diffHrs > 0) repeatSpan += `${diffHrs}h `;
        if (diffMins > 0 || (diffDays === 0 && diffHrs === 0)) repeatSpan += `${diffMins}m`;
        

        const uniqueFlags = [...new Set(customerCalls.flatMap(c => c.flags || []))];
        if (uniqueFlags.length > 0) {
          flaggedRiskCount++;
          uniqueFlags.forEach(flag => {
            callbackFlagCounts[flag] = (callbackFlagCounts[flag] || 0) + 1;
          });
        }
        
        // customerId should be consistent from the grouping key
        const displayCustomerId = firstCall.customerId || (firstCall.meta && firstCall.meta["Customer phone number / email address"]) || "Unknown Customer";

        const row = traceBodyEl.insertRow();
        row.innerHTML = `
          <td class="p-2">${displayCustomerId}</td>
          <td class="p-2 text-center">${customerCalls.length}</td>
          <td class="p-2">${agentsInvolvedDisplay}</td>
          <td class="p-2">${repeatSpan.trim() || "0m"}</td>
          <td class="p-2">${uniqueFlags.length > 0 ? `<span class="flag-indicator">${uniqueFlags.join(", ")}</span>` : "-"}</td>
        `;

        // Store data and add click listener for deep dive
        row.setAttribute('data-customer-calls', JSON.stringify(customerCalls)); // Storing all calls for this customer
        row.classList.add('cursor-pointer', 'hover:bg-gray-700'); // Add styling for clickability
        row.onclick = function() {
          const storedCallsData = this.getAttribute('data-customer-calls');
          if (storedCallsData && modal && modalCustomerIdentifierEl && modalCallSequenceDetailsEl) {
            const sequenceData = JSON.parse(storedCallsData);
            modalCustomerIdentifierEl.textContent = `Callback Sequence for: ${sequenceData[0].customerId || (sequenceData[0].meta && sequenceData[0].meta["Customer phone number / email address"]) || "Unknown Customer"}`;
            
            let detailsHtml = '<ul class="list-disc pl-5">';
            sequenceData.forEach((call, index) => {
              const callTime = call.startTime ? new Date(call.startTime).toLocaleString() : (call.meta && call.meta["Initiation timestamp"] ? new Date(call.meta["Initiation timestamp"]).toLocaleString() : 'N/A');
              detailsHtml += `<li>`;
              detailsHtml += `<strong>Call ${index + 1}:</strong> ${callTime}<br/>`;
              detailsHtml += `  Agent: ${call.agent || (call.meta && (call.meta["Agent name"] || call.meta.Agent)) || "Unknown"}<br/>`;
              detailsHtml += `  Duration: ${call.durationText || 'N/A'}<br/>`;
              detailsHtml += `  Flags: ${(call.flags && call.flags.length > 0) ? call.flags.join(', ') : 'None'}<br/>`;
              detailsHtml += `  Summary: ${call.summary || 'N/A'}<br/>`;
              detailsHtml += `</li>`;
            });
            detailsHtml += '</ul>';
            modalCallSequenceDetailsEl.innerHTML = detailsHtml;
            modal.classList.remove("hidden");
          }
        };
      }
    });

    if(repeatContactsEl) repeatContactsEl.textContent = repeatContactCount;
    if(flaggedRisksEl) flaggedRisksEl.textContent = flaggedRiskCount;

    // Calculate and display new metrics
    if (avgCallsPerRepeaterEl) {
      avgCallsPerRepeaterEl.textContent = repeatContactCount > 0 ? (sumOfCallsPerRepeater / repeatContactCount).toFixed(1) : "0.0";
    }
    if (percentCallbacksEl) {
      percentCallbacksEl.textContent = callsToRender.length > 0 ? ((totalCallbackInteractions / callsToRender.length) * 100).toFixed(1) + '%' : "0%";
    }
    if (avgAgentHopsEl) {
      avgAgentHopsEl.textContent = repeatContactCount > 0 ? (totalAgentHopsInCallbacks / repeatContactCount).toFixed(1) : "0.0";
    }

    // Display common flags in callbacks
    if (commonFlagsInCallbacksEl) {
      const sortedCallbackFlags = Object.entries(callbackFlagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5); // Show top 5

      if (sortedCallbackFlags.length > 0) {
        commonFlagsInCallbacksEl.innerHTML = sortedCallbackFlags
          .map(([flag, count]) => `<li><strong>${flag}</strong>: ${count} occurrences in callback sequences</li>`)
          .join('');
      } else {
        commonFlagsInCallbacksEl.innerHTML = '<li>No flags found specifically within callback sequences.</li>';
      }
    }

    if (traceBodyEl.rows.length === 0 && callsToRender.length > 0) { 
        traceBodyEl.innerHTML = "<tr><td colspan='5' class='no-data-message p-4 text-center'>No repeat call traces found in the current data.</td></tr>";
    } 
  }
})();