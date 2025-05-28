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
    
    // New AI insight elements
    const driverAnalysisEl = document.getElementById("cbDriverAnalysis");
    const journeyPatternsEl = document.getElementById("cbJourneyPatterns");
    const resolutionEfficiencyEl = document.getElementById("cbResolutionEfficiency");
    const phraseAnalysisEl = document.getElementById("cbPhraseAnalysis");
    const timingAnalysisEl = document.getElementById("cbTimingAnalysis");

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
      
      // Process calls with AI features if available
      if (window.AIIntegration && typeof window.AIIntegration.processCallsWithAI === 'function') {
        console.log("🧠 Processing calls with AI features...");
        callsToRender = await window.AIIntegration.processCallsWithAI(callsToRender);
      }
      
      renderCallbackTable(callsToRender);
      
      // Render AI-powered insights if available
      if (callsToRender.length > 0) {
        renderAIInsights(callsToRender);
        renderPhraseAnalysis(callsToRender);
        renderTimingAnalysis(callsToRender);
      }

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
    
    // Ensure all calls have customerId field using TransformManager if available
    if (window.TransformManager && typeof window.TransformManager.normalizeCustomerIds === 'function') {
      console.log("Normalizing customerId fields for callback dashboard...");
      callsToRender = window.TransformManager.normalizeCustomerIds(callsToRender);
    } else {
      // Fall back to manual normalization if TransformManager is not available
      callsToRender.forEach(call => {
        call.customerId = call.customerId || call.meta?.["Customer phone number / email address"]?.trim() || null;
      });
    }
    
    // Mark repeat calls if the CallAnalyzer is available
    if (window.CallAnalyzer && typeof window.CallAnalyzer.markRepeatCalls === 'function') {
      console.log("Marking repeat calls for callback dashboard...");
      window.CallAnalyzer.markRepeatCalls(callsToRender);
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
        
        // Count how many calls are marked as repeats (have the repeat flag)
        const repeatMarkedCount = customerCalls.filter(call => call.repeat).length;
        // Create a visual indicator for marked repeat calls
        const repeatIndicator = repeatMarkedCount > 0 
          ? `<span title="${repeatMarkedCount} calls marked by system as repeats" class="repeat-badge">${repeatMarkedCount}</span>` 
          : '';

        const uniqueFlags = [...new Set(customerCalls.flatMap(c => c.flags || []))];
        if (uniqueFlags.length > 0) {
          flaggedRiskCount++;
          uniqueFlags.forEach(flag => {
            callbackFlagCounts[flag] = (callbackFlagCounts[flag] || 0) + 1;
          });
        }
        
        // Use the consistent customerId field directly instead of extracting it from meta
        const displayCustomerId = firstCall.customerId || (firstCall.meta && firstCall.meta["Customer phone number / email address"]) || "Unknown Customer";

        const row = traceBodyEl.insertRow();
        row.innerHTML = `
          <td class="p-2">${displayCustomerId}</td>
          <td class="p-2 text-center">${customerCalls.length} ${repeatIndicator}</td>
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
            // Use customerId directly for the modal title
            modalCustomerIdentifierEl.textContent = `Callback Sequence for: ${sequenceData[0].customerId || (sequenceData[0].meta && sequenceData[0].meta["Customer phone number / email address"]) || "Unknown Customer"}`;
            
            // Generate enhanced call sequence display with timeline
            modalCallSequenceDetailsEl.innerHTML = generateCallTimelineDisplay(sequenceData);
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

  /**
   * Generate an enhanced timeline visualization for call sequences
   * @param {Array} calls - Array of call objects for the same customer
   * @returns {string} - HTML for timeline visualization
   */
  function generateCallTimelineDisplay(calls) {
    if (!calls || !Array.isArray(calls) || calls.length === 0) {
      return '<p>No call data available</p>';
    }

    // Sort calls by timestamp
    const sortedCalls = [...calls].sort((a, b) => {
      const aTime = a.startTime || new Date(a.meta?.["Initiation timestamp"]);
      const bTime = b.startTime || new Date(b.meta?.["Initiation timestamp"]); 
      return new Date(aTime) - new Date(bTime);
    });

    // Determine timeline range
    const firstCallTime = new Date(sortedCalls[0].startTime || sortedCalls[0].meta?.["Initiation timestamp"]);
    const lastCallTime = new Date(sortedCalls[sortedCalls.length-1].startTime || sortedCalls[sortedCalls.length-1].meta?.["Initiation timestamp"]);
    const timeSpanMs = lastCallTime - firstCallTime;
    
    let html = '<div class="call-timeline-container">';
    
    // Add timeline visualization
    html += '<div class="timeline-visualization">';
    html += '<div class="timeline-axis"></div>';
    
    sortedCalls.forEach((call, index) => {
      const callTime = new Date(call.startTime || call.meta?.["Initiation timestamp"]);
      const position = ((callTime - firstCallTime) / timeSpanMs) * 100;
      const repeatClass = call.repeat ? 'repeat-call' : '';
      
      html += `<div class="timeline-marker ${repeatClass}" style="left: ${position}%">
        <div class="timeline-point" title="Call ${index + 1}"></div>
        <div class="timeline-label">${callTime.toLocaleDateString()}</div>
      </div>`;
    });
    
    html += '</div>'; // End timeline-visualization
    
    // Add detailed call list
    html += '<div class="call-details-list">';
    html += '<ul>';
    
    sortedCalls.forEach((call, index) => {
      const callTime = new Date(call.startTime || call.meta?.["Initiation timestamp"]);
      const agentName = call.agent || (call.meta && (call.meta["Agent name"] || call.meta.Agent)) || "Unknown";
      const repeatClass = call.repeat ? 'repeat-call' : '';
      
      html += `<li class="${repeatClass}">
        <div class="call-header">
          <span class="call-number">Call ${index + 1}</span> - 
          <span class="call-time">${callTime.toLocaleString()}</span>
          ${call.repeat ? '<span class="repeat-badge">Repeat</span>' : ''}
        </div>
        <div class="call-body">
          <div><strong>Agent:</strong> ${agentName}</div>
          <div><strong>Duration:</strong> ${call.durationText || call.meta?.["Contact duration"] || 'N/A'}</div>
          <div><strong>Issue:</strong> ${call.issue || 'N/A'}</div>
          <div><strong>Outcome:</strong> ${call.outcome || 'N/A'}</div>
          <div><strong>Flags:</strong> ${(call.flags && call.flags.length > 0) ? call.flags.join(', ') : 'None'}</div>
          <div><strong>Summary:</strong> ${call.summary || 'N/A'}</div>
        </div>
      </li>`;
    });
    
    html += '</ul>';
    html += '</div>'; // End call-details-list
    
    html += '</div>'; // End call-timeline-container
    
    return html;
  }

  /**
   * Render AI-powered insights for callback dashboard
   * @param {Array} calls - Array of call objects
   */
  function renderAIInsights(calls) {
    const driverAnalysisEl = document.getElementById("cbDriverAnalysis");
    const journeyPatternsEl = document.getElementById("cbJourneyPatterns");
    const resolutionEfficiencyEl = document.getElementById("cbResolutionEfficiency");
    
    if (!calls || calls.length === 0) {
      if (driverAnalysisEl) driverAnalysisEl.innerHTML = "No data available for analysis.";
      if (journeyPatternsEl) journeyPatternsEl.innerHTML = "No data available for analysis.";
      if (resolutionEfficiencyEl) resolutionEfficiencyEl.innerHTML = "No data available for analysis.";
      return;
    }
    
    // Group calls by customer
    const callsByCustomer = {};
    calls.forEach(call => {
      const customerId = call.customerId || call.meta?.["Customer phone number / email address"] || "Unknown";
      callsByCustomer[customerId] = callsByCustomer[customerId] || [];
      callsByCustomer[customerId].push(call);
    });
    
    // Get only repeat customers (have more than 1 call)
    const repeatCustomers = Object.entries(callsByCustomer)
      .filter(([_, customerCalls]) => customerCalls.length > 1)
      .map(([id, customerCalls]) => ({ id, calls: customerCalls }));
    
    // Driver Analysis - Generate natural language summary of callback drivers
    if (driverAnalysisEl && window.AI) {
      try {
        const repeatDrivers = window.AI.summarizeRepeatDrivers(calls);
        let driverAnalysisHTML = '';
        
        if (repeatCustomers.length > 0) {
          // Count common issues in repeat calls
          const issueCount = {};
          repeatCustomers.forEach(customer => {
            customer.calls.forEach(call => {
              const issue = call.issue || call.meta?.Issue || "Unknown";
              issueCount[issue] = (issueCount[issue] || 0) + 1;
            });
          });
          
          const topIssues = Object.entries(issueCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
            
          driverAnalysisHTML = `
            <p>${repeatDrivers}</p>
            <p class="mt-2"><strong>Top callback drivers:</strong></p>
            <ul class="list-disc ml-4 mt-1">
              ${topIssues.map(([issue, count]) => 
                `<li><span class="insight-highlight">${issue}</span>: ${count} occurrences</li>`
              ).join('')}
            </ul>
          `;
        } else {
          driverAnalysisHTML = '<p>No repeat contact patterns were identified in the current dataset.</p>';
        }
        
        driverAnalysisEl.innerHTML = driverAnalysisHTML;
      } catch (error) {
        console.error("Error generating driver analysis:", error);
        driverAnalysisEl.innerHTML = "Error generating insights.";
      }
    }
    
    // Journey Patterns - Analyze customer journey through callback sequences
    if (journeyPatternsEl) {
      try {
        let journeyHTML = '';
        
        if (repeatCustomers.length > 0) {
          // Analyze agent handoff patterns
          const handoffPatterns = {};
          repeatCustomers.forEach(customer => {
            const agentSequence = customer.calls
              .sort((a, b) => new Date(a.startTime || a.meta?.["Initiation timestamp"]) - new Date(b.startTime || b.meta?.["Initiation timestamp"]))
              .map(call => call.agent || call.meta?.["Agent name"] || "Unknown")
              .filter((agent, index, arr) => index === 0 || agent !== arr[index - 1]); // Remove consecutive duplicates
            
            if (agentSequence.length > 1) {
              const pattern = agentSequence.join(" → ");
              handoffPatterns[pattern] = (handoffPatterns[pattern] || 0) + 1;
            }
          });
          
          const patterns = Object.entries(handoffPatterns)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
          
          journeyHTML = `
            <p>Analysis of ${repeatCustomers.length} customer callback sequences reveals the following patterns:</p>
            ${patterns.length > 0 ? `
              <p class="mt-2"><strong>Common agent handoff patterns:</strong></p>
              <ul class="list-disc ml-4 mt-1">
                ${patterns.map(([pattern, count]) => 
                  `<li><span class="insight-highlight">${pattern}</span>: ${count} sequences</li>`
                ).join('')}
              </ul>
            ` : '<p>No clear agent handoff patterns detected.</p>'}
          `;
          
          // Add time between contacts insights
          const timeGaps = [];
          repeatCustomers.forEach(customer => {
            const sortedCalls = [...customer.calls].sort((a, b) => 
              new Date(a.startTime || a.meta?.["Initiation timestamp"]) - new Date(b.startTime || b.meta?.["Initiation timestamp"])
            );
            
            for (let i = 1; i < sortedCalls.length; i++) {
              const prevCall = sortedCalls[i-1];
              const currCall = sortedCalls[i];
              const prevTime = new Date(prevCall.startTime || prevCall.meta?.["Initiation timestamp"]);
              const currTime = new Date(currCall.startTime || currCall.meta?.["Initiation timestamp"]);
              const hoursBetween = (currTime - prevTime) / (1000 * 60 * 60);
              
              if (!isNaN(hoursBetween)) {
                timeGaps.push({
                  customerId: customer.id,
                  hoursBetween,
                  prevAgent: prevCall.agent || prevCall.meta?.["Agent name"] || "Unknown",
                  currAgent: currCall.agent || currCall.meta?.["Agent name"] || "Unknown"
                });
              }
            }
          });
          
          if (timeGaps.length > 0) {
            // Calculate average time between callbacks
            const avgHours = timeGaps.reduce((sum, gap) => sum + gap.hoursBetween, 0) / timeGaps.length;
            const sameDay = timeGaps.filter(gap => gap.hoursBetween <= 24).length;
            const sameDayPercent = Math.round((sameDay / timeGaps.length) * 100);
            
            journeyHTML += `
              <p class="mt-2"><strong>Time between contacts:</strong></p>
              <ul class="list-disc ml-4 mt-1">
                <li>Average: <span class="insight-highlight">${avgHours.toFixed(1)} hours</span></li>
                <li>${sameDayPercent}% of callbacks occur within the same day</li>
              </ul>
            `;
          }
        } else {
          journeyHTML = '<p>No repeat contact sequences were identified in the current dataset.</p>';
        }
        
        journeyPatternsEl.innerHTML = journeyHTML;
      } catch (error) {
        console.error("Error generating journey patterns:", error);
        journeyPatternsEl.innerHTML = "Error analyzing customer journeys.";
      }
    }
    
    // Resolution Efficiency - Analyze resolution rates and efficiency metrics
    if (resolutionEfficiencyEl) {
      try {
        let efficiencyHTML = '';
        
        if (repeatCustomers.length > 0) {
          // Calculate percentage of single-contact vs multi-contact resolutions
          const totalCustomers = Object.keys(callsByCustomer).length;
          const singleContactCount = totalCustomers - repeatCustomers.length;
          const singleContactRate = Math.round((singleContactCount / totalCustomers) * 100);
          
          // Calculate average calls needed to resolve
          const avgCalls = calls.length / totalCustomers;
          
          // Calculate average duration of calls in repeat sequences vs single calls
          const repeatCallsList = repeatCustomers.flatMap(c => c.calls);
          const singleCalls = calls.filter(call => {
            const customerId = call.customerId || call.meta?.["Customer phone number / email address"] || "Unknown";
            return callsByCustomer[customerId].length === 1;
          });
          
          const getAvgDuration = callList => {
            let totalMinutes = 0, count = 0;
            callList.forEach(call => {
              const duration = call.durationMinutes || 
                (call.meta?.["Contact duration"] ? parseInt(call.meta["Contact duration"]) : 0);
              if (duration > 0) {
                totalMinutes += duration;
                count++;
              }
            });
            return count > 0 ? (totalMinutes / count).toFixed(1) : "N/A";
          };
          
          const repeatAvgDuration = getAvgDuration(repeatCallsList);
          const singleAvgDuration = getAvgDuration(singleCalls);
          
          efficiencyHTML = `
            <p>First-contact resolution analysis for ${totalCustomers} customers:</p>
            <ul class="list-disc ml-4 mt-2">
              <li><span class="insight-highlight">${singleContactRate}%</span> of customers resolved in a single contact</li>
              <li>Average of <span class="insight-highlight">${avgCalls.toFixed(1)}</span> calls needed per customer</li>
              <li>Avg. duration of repeat calls: <span class="insight-highlight">${repeatAvgDuration} min</span></li>
              <li>Avg. duration of single calls: <span class="insight-highlight">${singleAvgDuration} min</span></li>
            </ul>
          `;
          
          // Add efficiency recommendation if available
          if (window.AI && typeof window.AI.generateMissedOpportunities === 'function') {
            const opportunities = window.AI.generateMissedOpportunities(calls);
            if (opportunities && opportunities.length > 0) {
              efficiencyHTML += `
                <p class="mt-2"><strong>Improvement opportunity:</strong></p>
                <p class="text-sm">${opportunities[0]}</p>
              `;
            }
          }
        } else {
          efficiencyHTML = '<p>All customers were handled in a single contact. No repeat contacts to analyze.</p>';
        }
        
        resolutionEfficiencyEl.innerHTML = efficiencyHTML;
      } catch (error) {
        console.error("Error generating resolution efficiency:", error);
        resolutionEfficiencyEl.innerHTML = "Error analyzing resolution efficiency.";
      }
    }
  }

  /**
   * Renders phrase analysis from transcript data
   * @param {Array} calls - Array of call objects with transcripts
   */
  function renderPhraseAnalysis(calls) {
    const phraseAnalysisEl = document.getElementById("cbPhraseAnalysis");
    if (!phraseAnalysisEl) return;
    
    // Filter to only calls with transcripts
    const callsWithTranscripts = calls.filter(call => call.transcript && call.transcript.length > 0);
    
    if (callsWithTranscripts.length === 0) {
      phraseAnalysisEl.innerHTML = `
        <div class="phrase-columns-wrapper">
          <p>No transcript data available for phrase analysis.</p>
        </div>
      `;
      return;
    }
    
    try {
      // Use the AI module to extract frequent phrases if available
      let phraseData = { customer: [], agent: [] };
      
      if (window.AI && typeof window.AI.extractFrequentPhrasesBySpeaker === 'function') {
        phraseData = window.AI.extractFrequentPhrasesBySpeaker(callsWithTranscripts);
      }
      
      // Separate repeat calls from non-repeat calls
      const repeatCalls = calls.filter(call => call.repeat === true);
      const nonRepeatCalls = calls.filter(call => call.repeat !== true);
      
      // Generate phrase analysis specifically for repeat calls if available
      let repeatPhraseData = { customer: [], agent: [] };
      if (repeatCalls.length > 0 && window.AI && typeof window.AI.extractFrequentPhrasesBySpeaker === 'function') {
        const repeatCallsWithTranscripts = repeatCalls.filter(call => call.transcript && call.transcript.length > 0);
        if (repeatCallsWithTranscripts.length > 0) {
          repeatPhraseData = window.AI.extractFrequentPhrasesBySpeaker(repeatCallsWithTranscripts, 2); // Lower threshold for repeat calls
        }
      }
      
      // Helper function to render phrase list
      const renderPhraseList = (phrases, title, headerClass) => {
        if (!phrases || phrases.length === 0) {
          return `
            <div class="phrase-column ${headerClass}">
              <h3>${title}</h3>
              <p class="text-sm text-gray-400">No phrases detected</p>
            </div>
          `;
        }
        
        return `
          <div class="phrase-column ${headerClass}">
            <h3>${title}</h3>
            <ul class="phrase-list">
              ${phrases.map(([phrase, count]) => `
                <li>
                  <span class="phrase-text">${phrase}</span>
                  <span class="phrase-count">${count}</span>
                </li>
              `).join('')}
            </ul>
          </div>
        `;
      };
      
      // Render the columns
      phraseAnalysisEl.innerHTML = `
        <div class="phrase-columns-wrapper">
          ${renderPhraseList(phraseData.customer, 'Customer Phrases', 'customer-phrases')}
          ${renderPhraseList(phraseData.agent, 'Agent Phrases', 'agent-phrases')}
          ${repeatPhraseData.customer.length > 0 ? 
            renderPhraseList(repeatPhraseData.customer, 'Repeat Call Phrases', 'customer-phrases') : ''}
        </div>
        <div class="text-sm text-gray-400 mt-2">
          Analysis based on ${callsWithTranscripts.length} calls with transcript data.
        </div>
      `;
      
    } catch (error) {
      console.error("Error rendering phrase analysis:", error);
      phraseAnalysisEl.innerHTML = `
        <div class="phrase-columns-wrapper">
          <p>Error generating phrase analysis: ${error.message}</p>
        </div>
      `;
    }
  }
  
  /**
   * Renders timing analysis from transcript data
   * @param {Array} calls - Array of call objects with transcripts
   */
  function renderTimingAnalysis(calls) {
    const timingAnalysisEl = document.getElementById("cbTimingAnalysis");
    if (!timingAnalysisEl) return;
    
    // Filter to only calls with transcripts
    const callsWithTranscripts = calls.filter(call => call.transcript && call.transcript.length > 0);
    
    if (callsWithTranscripts.length === 0) {
      timingAnalysisEl.innerHTML = `
        <div class="timing-metrics-container">
          <p>No transcript data available for timing analysis.</p>
        </div>
      `;
      return;
    }
    
    try {
      // Calculate timing metrics using the AI module
      let deadAirInstances = 0;
      let delayedAgentResponses = 0;
      let longestSilence = 0;
      
      callsWithTranscripts.forEach(call => {
        if (window.AI && typeof window.AI.analyzeTranscriptGaps === 'function') {
          const analysis = window.AI.analyzeTranscriptGaps(call);
          if (analysis) {
            deadAirInstances += analysis.deadAirInstances;
            delayedAgentResponses += analysis.delayedAgentResponses;
            if (analysis.longestSilence > longestSilence) {
              longestSilence = analysis.longestSilence;
            }
          }
        }
      });
      
      // Calculate average metrics per call
      const avgDeadAir = deadAirInstances / callsWithTranscripts.length;
      const avgDelayedResponses = delayedAgentResponses / callsWithTranscripts.length;
      
      // Render the metrics
      timingAnalysisEl.innerHTML = `
        <div class="timing-metrics-container">
          <div class="timing-metric-card dead-air-card">
            <div class="timing-metric-label">Dead Air Instances</div>
            <div class="timing-metric-value">${deadAirInstances}</div>
            <div class="timing-metric-unit">total (${avgDeadAir.toFixed(1)} avg/call)</div>
          </div>
          <div class="timing-metric-card delayed-response-card">
            <div class="timing-metric-label">Delayed Agent Responses</div>
            <div class="timing-metric-value">${delayedAgentResponses}</div>
            <div class="timing-metric-unit">total (${avgDelayedResponses.toFixed(1)} avg/call)</div>
          </div>
          <div class="timing-metric-card longest-silence-card">
            <div class="timing-metric-label">Longest Silence</div>
            <div class="timing-metric-value">${longestSilence.toFixed(1)}</div>
            <div class="timing-metric-unit">seconds</div>
          </div>
        </div>
      `;
      
      // Add specific timing analysis for repeat calls if available
      const repeatCalls = calls.filter(call => call.repeat === true);
      if (repeatCalls.length > 0) {
        const repeatCallsWithTranscripts = repeatCalls.filter(call => call.transcript && call.transcript.length > 0);
        
        if (repeatCallsWithTranscripts.length > 0) {
          let repeatDeadAir = 0;
          let repeatDelayedResponses = 0;
          
          repeatCallsWithTranscripts.forEach(call => {
            if (window.AI && typeof window.AI.analyzeTranscriptGaps === 'function') {
              const analysis = window.AI.analyzeTranscriptGaps(call);
              if (analysis) {
                repeatDeadAir += analysis.deadAirInstances;
                repeatDelayedResponses += analysis.delayedAgentResponses;
              }
            }
          });
          
          // Add repeat call specific warning if timing issues are present
          if (repeatDeadAir > 0 || repeatDelayedResponses > 0) {
            timingAnalysisEl.innerHTML += `
              <div class="repeat-calls-warning mt-3">
                <h3>Repeat Call Timing Issues</h3>
                <div class="warning-text">
                  ${repeatDeadAir > 0 ? `${repeatDeadAir} dead air instances found in repeat calls.` : ''}
                  ${repeatDelayedResponses > 0 ? `${repeatDelayedResponses} delayed agent responses in repeat calls.` : ''}
                  These timing issues may contribute to customer frustration in callback sequences.
                </div>
              </div>
            `;
          }
        }
      }
      
    } catch (error) {
      console.error("Error rendering timing analysis:", error);
      timingAnalysisEl.innerHTML = `
        <div class="timing-metrics-container">
          <p>Error generating timing analysis: ${error.message}</p>
        </div>
      `;
    }
  }
})();