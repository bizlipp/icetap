// js/uiUpdater.js
// This module will handle direct DOM manipulations, 
// such as updating text content, managing UI elements (like badges, summaries), 
// and displaying notifications or skeleton loaders.

// Placeholder for UI update functions
// export function updateOutlookBlock(text) { ... }
// export function displayAgentBadges(badgesData) { ... }
// etc. 

export function displayAgentBadges(processedData, containerId = 'agentBadges') {
    const { agents, avgScore: teamAvgScore } = processedData;
    const badgeContainer = document.getElementById(containerId);
    if (!badgeContainer) return;

    badgeContainer.innerHTML = ""; // Clear previous badges
    Object.entries(agents).forEach(([name, a]) => {
        const agentAvgScore = a.total > 0 ? a.score / a.total : 0;
        let badges = [];

        if (a.shortCount >= a.total * 0.5 && a.posCount >= a.total * 0.7) {
            badges.push("🏅 Resolution Hero");
        }
        // Ensure teamAvgScore is defined and a number before comparing
        if (typeof teamAvgScore === 'number' && agentAvgScore >= teamAvgScore) {
            badges.push("🌟 Team Uplifter");
        }
        if (a.flags === 0 && a.posCount === a.total && a.total > 0) {
            badges.push("🧘 Clarity Master");
        }

        if (badges.length) {
            const line = document.createElement("div");
            line.textContent = `${name}: ${badges.join("  ")}`;
            badgeContainer.appendChild(line);
        }
    });
}

export function displayCoachingSummary(summaryText, containerId = 'coachingSummary') {
    const summaryContainer = document.getElementById(containerId);
    if (!summaryContainer) return;
    summaryContainer.textContent = summaryText;
}

export function updateOutlookBlock(text, elementId = 'outlookBlock') {
    const outlookBlockElement = document.getElementById(elementId);
    if (outlookBlockElement) {
        outlookBlockElement.textContent = text;
    }
}

export function prependToOutlookBlock(textToPrepend, elementId = 'outlookBlock') {
    const outlookBlockElement = document.getElementById(elementId);
    if (outlookBlockElement) {
        outlookBlockElement.textContent = textToPrepend + "\n\n" + outlookBlockElement.textContent;
    }
}

export function toggleSummaryDisplay(elementId = 'coachingSummary') {
    const el = document.getElementById(elementId);
    if (el) {
        el.style.display = el.style.display === "none" ? "block" : "none";
    }
}

// Basic toast notification system
let toastTimeout;
export function showToast(message, duration = 3000) {
    let toast = document.getElementById('toast-notification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-notification';
        // Basic styling - can be moved to CSS file
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.padding = '10px 20px';
        toast.style.background = '#333';
        toast.style.color = 'white';
        toast.style.borderRadius = '5px';
        toast.style.zIndex = '1000';
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s ease';
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.opacity = '1';

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.style.opacity = '0';
    }, duration);
}

export function showSkeleton(skeletonId, contentId) {
    const skeleton = document.getElementById(skeletonId);
    const content = document.getElementById(contentId);
    if (skeleton) skeleton.style.display = 'block';
    if (content) content.style.display = 'none';
}

export function hideSkeleton(skeletonId, contentId) {
    const skeleton = document.getElementById(skeletonId);
    const content = document.getElementById(contentId);
    if (skeleton) skeleton.style.display = 'none';
    if (content) content.style.display = 'block'; // Or 'flex', 'grid' depending on content
}

export function showAgentDetailModal(agentName, agentData) {
    const modal = document.getElementById('agentDetailModal');
    const titleElement = document.getElementById('agentModalTitle');
    const bodyElement = document.getElementById('agentModalBody');

    if (modal && titleElement && bodyElement && agentData) {
        titleElement.textContent = `Details for Agent: ${agentName}`;
        
        let bodyHTML = `<p><strong>Total Calls:</strong> ${agentData.total}</p>`;
        bodyHTML += `<p><strong>Overall Score:</strong> ${agentData.score}</p>`;
        bodyHTML += `<p><strong>Average Score:</strong> ${(agentData.total > 0 ? (agentData.score / agentData.total) : 0).toFixed(2)}</p>`;
        bodyHTML += `<p><strong>Positive Flag Count:</strong> ${agentData.posCount}</p>`;
        bodyHTML += `<p><strong>Negative Flag Count:</strong> ${agentData.flags}</p>`;
        bodyHTML += `<p><strong>Short Call Count (<4min):</strong> ${agentData.shortCount}</p>`;
        
        // Add Top Themes & Coaching Prompts
        if (agentData.agentThemes && Object.keys(agentData.agentThemes).length > 0) {
            bodyHTML += `<div style="margin-top: 15px;"><strong>Top Themes for ${agentName}:</strong><ul>`;
            const sortedThemes = Object.entries(agentData.agentThemes)
                                     .sort(([,a],[,b]) => b-a)
                                     .slice(0, 3);
            sortedThemes.forEach(([theme, count]) => {
                bodyHTML += `<li><strong>${theme}</strong> (${count} mentions): Consider discussing strategies for effectively addressing or leveraging this theme.</li>`;
            });
            bodyHTML += `</ul></div>`;
        } else {
            bodyHTML += `<p style="margin-top: 15px;">No specific theme data available for this agent in the current view.</p>`;
        }
        // Potentially list specific calls, flags, or other details here in a more advanced version
        
        bodyElement.innerHTML = bodyHTML;
        modal.style.display = 'flex'; // Use flex as per modal CSS for centering
    } else {
        console.error("Modal elements not found or agent data missing for agent:", agentName);
        if(!agentData) console.error("Agent data is: ", agentData);
    }
}

export function closeAgentDetailModal() {
    const modal = document.getElementById('agentDetailModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

export function showThemeDetailModal(themeName, themeDetails) {
    const modal = document.getElementById('themeDetailModal');
    const titleElement = document.getElementById('themeModalTitle');
    const bodyElement = document.getElementById('themeModalBody');

    if (modal && titleElement && bodyElement && themeDetails) {
        titleElement.textContent = `Details for Theme: ${themeName}`;
        
        let bodyHTML = `<p><strong>Total Occurrences:</strong> ${themeDetails.totalOccurrences}</p>`;
        bodyHTML += `<p><strong>Average Score on Calls with this Theme:</strong> ${themeDetails.avgScoreWithTheme.toFixed(2)}</p>`;
        bodyHTML += `<p><strong>Agents associated with this theme:</strong></p><ul>`;
        Object.entries(themeDetails.agentsInvolved).forEach(([agentName, count]) => {
            bodyHTML += `<li>${agentName}: ${count} occurrence(s)</li>`;
        });
        bodyHTML += `</ul>`;
        // Potentially list specific calls in a more advanced version
        
        bodyElement.innerHTML = bodyHTML;
        modal.style.display = 'flex'; 
    } else {
        console.error("Theme modal elements not found or theme details missing for:", themeName);
    }
}

export function closeThemeDetailModal() {
    const modal = document.getElementById('themeDetailModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

export function showCallbackDetailModal(customerIdentifier, callbackEntries, allRawCalls) {
    const modal = document.getElementById('callbackDetailModal');
    const titleElement = document.getElementById('callbackModalTitle');
    const bodyElement = document.getElementById('callbackModalBody');

    if (modal && titleElement && bodyElement && callbackEntries) {
        titleElement.textContent = `Callback Details for: ${customerIdentifier}`;
        
        let bodyHTML = `<p><strong>Customer ID:</strong> ${customerIdentifier}</p>`;
        bodyHTML += `<p><strong>Total Callbacks:</strong> ${callbackEntries.length}</p>`;
        bodyHTML += `<strong>Call Log:</strong><ul>`;

        // Sort callbacks by timestamp, oldest first if timestamps are valid
        const sortedEntries = [...callbackEntries].sort((a, b) => {
            const dateA = a.timestamp ? new Date(a.timestamp) : 0;
            const dateB = b.timestamp ? new Date(b.timestamp) : 0;
            return dateA - dateB;
        });

        sortedEntries.forEach(entry => {
            const callTimestamp = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'N/A';
            // Find the agent for this specific call using contactId from allRawCalls
            let agentName = 'Unknown Agent';
            const relatedCall = allRawCalls.find(call => call.meta?.["Contact ID"] === entry.contactId);
            if (relatedCall && relatedCall.meta?.["Agent name"]) {
                agentName = relatedCall.meta["Agent name"];
            }
            bodyHTML += `<li>Contact ID: ${entry.contactId || 'N/A'} (Agent: ${agentName}) - Timestamp: ${callTimestamp}</li>`;
        });
        bodyHTML += `</ul>`;
        
        bodyElement.innerHTML = bodyHTML;
        modal.style.display = 'flex'; 
    } else {
        console.error("Callback modal elements not found or callback data missing for:", customerIdentifier);
    }
}

export function closeCallbackDetailModal() {
    const modal = document.getElementById('callbackDetailModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// --- New UI Update Functions (for dashboard.html components) ---

export function updateSummaryStatCards(summaryStats) {
  document.getElementById('statTotalCalls').textContent = summaryStats?.totalCalls || '0';
  document.getElementById('statFlaggedCalls').textContent = summaryStats?.flaggedCallsCount || '0';
  document.getElementById('statPositiveCalls').textContent = summaryStats?.positiveCallsCount || '0';
  const avgDurationMinutes = summaryStats?.avgDurationSeconds ? (summaryStats.avgDurationSeconds / 60).toFixed(1) : '0';
  document.getElementById('statAvgDuration').textContent = `${avgDurationMinutes} min`;
}

export function updateNewCategoryDetailsTable(categoryDistribution, totalProcessedCalls) {
  const container = document.getElementById('newCategoryDetails');
  if (!container) return;

  const topCategories = Object.entries(categoryDistribution || {})
    .sort(([, countA], [, countB]) => countB - countA)
    .slice(0, 10);

  if (topCategories.length === 0) {
    container.innerHTML = '<div class="no-data-message">No categories data available</div>';
    return;
  }

  let detailsHtml = `
    <h3 style="font-size: 0.95em; margin-bottom: 10px; color: #bbb; font-weight:600;">Category Distribution Details</h3>
    <table style="width: 100%;">
      <thead>
        <tr>
          <th style="text-align: left;">Category</th>
          <th style="text-align: right;">Count</th>
          <th style="text-align: right;">Percentage</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  topCategories.forEach(([category, count]) => {
    const percentage = totalProcessedCalls > 0 ? (count / totalProcessedCalls * 100).toFixed(1) : 0;
    detailsHtml += `
      <tr>
        <td style="text-align: left;">${category}</td>
        <td style="text-align: right;">${count}</td>
        <td style="text-align: right;">${percentage}%</td>
      </tr>
    `;
  });
  
  detailsHtml += `
      </tbody>
    </table>
  `;
  container.innerHTML = detailsHtml;
}

export function updateNewRepeatCallersTable(repeatCallersData) {
  const tableBody = document.getElementById('newRepeatCallersBody');
  if (!tableBody) return;

  const callersArray = Object.values(repeatCallersData || {})
    .filter(caller => caller.callCount > 1)
    .sort((a, b) => b.callCount - a.callCount)
    .slice(0, 10); // Top 10

  tableBody.innerHTML = ''; // Clear existing rows

  if (callersArray.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5" class="no-data-message">No repeat callers found (with >1 call)</td></tr>';
    return;
  }

  callersArray.forEach(caller => {
    const row = tableBody.insertRow();
    const topFlags = Object.entries(caller.flagCount || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([flag, count]) => `${flag} (${count})`)
      .join(', ') || 'None';
    
    // Mask identifier if it looks like a phone number, else show as is (e.g., email or Contact ID)
    let displayIdentifier = caller.identifier;
    if (/^\+?\d{7,}$/.test(caller.identifier)) { // Basic check for phone number like string
        displayIdentifier = caller.identifier.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'); // Example masking
        if (displayIdentifier.length > 15) displayIdentifier = displayIdentifier.substring(0,12) + '...'; // Truncate if still too long
    } else if (caller.identifier.length > 20) {
        displayIdentifier = caller.identifier.substring(0,20) + '...';
    }

    row.insertCell().textContent = displayIdentifier;
    row.insertCell().textContent = caller.callCount;
    row.insertCell().textContent = caller.latestCallTimestamp ? new Date(caller.latestCallTimestamp).toLocaleDateString() : 'N/A';
    row.insertCell().textContent = caller.firstCallTimestamp ? new Date(caller.firstCallTimestamp).toLocaleDateString() : 'N/A';
    row.insertCell().textContent = topFlags;
  });
}

export function updateNewCommonTopicsCloud(wordFrequencyData) {
  const container = document.getElementById('newCommonTopics');
  if (!container) return;

  const topWords = Object.entries(wordFrequencyData || {})
    .sort(([, countA], [, countB]) => countB - countA)
    .slice(0, 40);

  container.innerHTML = ''; // Clear existing

  if (topWords.length === 0) {
    container.innerHTML = '<div class="no-data-message">No word frequency data available</div>';
    return;
  }

  const maxFrequency = topWords.length > 0 ? topWords[0][1] : 1;

  topWords.forEach(([word, count]) => {
    const fontSize = Math.max(12, Math.min(28, 12 + (count / maxFrequency) * 16)); // Scaled font size
    const opacity = Math.max(0.3, Math.min(1, 0.5 + (count / maxFrequency) * 0.5));
    
    const wordElement = document.createElement('div');
    wordElement.style.fontSize = `${fontSize}px`;
    wordElement.style.padding = '3px 8px';
    wordElement.style.margin = '3px';
    wordElement.style.borderRadius = '5px'; // Adjusted border radius
    wordElement.style.background = `rgba(164, 62, 201, ${opacity * 0.3})`; // Use accent color with opacity
    wordElement.style.color = `rgba(238, 238, 238, ${opacity + 0.2})`; // Ensure text is readable
    wordElement.style.cursor = 'pointer'; // Indicate clickable
    wordElement.title = `${count} occurrences - Click to see calls with this topic (future feature)`;
    wordElement.textContent = word;
    // TODO: Add click listener to wordElement for drill-down (Phase 5)
    container.appendChild(wordElement);
  });
}

export function updateNewTopAgentsTable(topAgentsData) { // Expects processedData.topAgentsForTable
  const tableBody = document.getElementById('newTopAgentsBody');
  if (!tableBody) return;

  tableBody.innerHTML = ''; // Clear existing rows

  if (!topAgentsData || topAgentsData.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5" class="no-data-message">No agent data available</td></tr>';
    return;
  }

  topAgentsData.forEach(agent => {
    const row = tableBody.insertRow();
    row.insertCell().textContent = agent.name;
    row.insertCell().textContent = agent.totalCalls;
    row.insertCell().textContent = `${(agent.positiveRatio * 100).toFixed(1)}%`;
    row.insertCell().textContent = agent.avgScore.toFixed(2);
    row.insertCell().textContent = `${(agent.avgDurationSeconds / 60).toFixed(1)} min`;
  });
}

export function updateNewPositiveCallsList(positiveCallsListData) { // Expects processedData.positiveCallsForList
  const container = document.getElementById('newPositiveCallsList');
  if (!container) return;

  container.innerHTML = ''; // Clear existing

  if (!positiveCallsListData || positiveCallsListData.length === 0) {
    container.innerHTML = '<div class="no-data-message">No positive calls to display</div>';
    return;
  }

  positiveCallsListData.forEach(call => {
    const agent = call.meta?.["Agent name"] || call.meta?.['Agent'] || "Unknown";
    const date = call.meta?.["Initiation timestamp"] || "Unknown date";
    const durationSeconds = parseDurationToSeconds(call.meta?.["Contact duration"]); // Use helper
    const durationDisplay = durationSeconds > 0 ? `${(durationSeconds / 60).toFixed(1)} min` : "N/A";
    
    const callElement = document.createElement('div');
    callElement.className = 'positive-call-item'; // Use class for styling from CSS
    
    let flagsHTML = '';
    if (call.positiveFlags && call.positiveFlags.length > 0) {
        flagsHTML = call.positiveFlags.map(flag => 
            `<span class="positive-call-flag">${flag}</span>`
        ).join('');
    }

    let summaryHTML = '';
    if (call.summary) {
        summaryHTML = `<div class="positive-call-summary">${call.summary}</div>`;
    }

    callElement.innerHTML = `
      <div><strong>${agent}</strong> - ${new Date(date).toLocaleString()} - Duration: ${durationDisplay}</div>
      <div>Positive Score: <span class="positive-color">${call.calculatedScore.toFixed(2)}</span></div>
      ${flagsHTML ? `<div>${flagsHTML}</div>` : ''}
      ${summaryHTML}
    `;
    // TODO: Add click listener for drill-down to this specific call (Phase 5)
    container.appendChild(callElement);
  });
}

// Helper function to parse duration (already in dataProcessor.js, but if uiUpdater needs it independently)
// For now, assuming dataProcessor provides seconds, and uiUpdater formats it.
/* function parseDurationToSecondsForUI(durationText) { ... } */ 