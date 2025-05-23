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