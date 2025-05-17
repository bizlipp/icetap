// js/dataProcessor.js
// This module will be responsible for all data loading, parsing, and processing logic.

// Placeholder for data processing functions
// export function loadAndProcessData(source) { ... }
// export function calculateAgentScores(calls) { ... }
// etc. 

export function durationToSeconds(str) {
    if (!str || typeof str !== 'string') return 0;
    const parts = str.split(":").map(Number);
    if (parts.length === 3) {
        return (parts[0] * 3600 + parts[1] * 60 + parts[2]);
    }
    // Potentially handle other formats or return error/0 if format is unexpected
    return 0; 
}

export function processCallData(allCalls, filters = {}) {
    const agents = {};
    const themes = {};
    const callbacks = {};
    let totalScore = 0;
    let durationTotal = 0;

    // Filter calls if an agent filter is applied
    const callsToProcess = filters.agent && filters.agent !== 'all' 
        ? allCalls.filter(call => (call.meta?.["Agent name"] || "Unknown") === filters.agent)
        : allCalls;

    let callCount = callsToProcess.length;

    // Process all calls for callback data regardless of agent filter for comprehensive callback analysis
    allCalls.forEach(call => {
        const customerId = call.meta?.["Customer phone number / email address"];
        const contactId = call.meta?.["Contact ID"];
        const timestamp = call.meta?.["Initiation timestamp"] ? new Date(call.meta["Initiation timestamp"]) : null;
        if (customerId) {
            if (!callbacks[customerId]) callbacks[customerId] = [];
            callbacks[customerId].push({ contactId, timestamp });
        }
    });

    callsToProcess.forEach(call => {
        const agent = call.meta?.["Agent name"] || "Unknown";
        const durationStr = call.meta?.["Contact duration"] || "0:00:00";
        const seconds = durationToSeconds(durationStr);
        const flags = call.flags || [];
        const posFlags = call.positiveFlags || [];
        const contactId = call.meta?.["Contact ID"];
        const customerId = call.meta?.["Customer phone number / email address"];
        const timestamp = call.meta?.["Initiation timestamp"] ? new Date(call.meta["Initiation timestamp"]) : null;

        let score = 0;
        score += posFlags.length * 2;
        if (seconds < 240 && posFlags.length) score += 2; 
        score -= flags.length;

        if (customerId && callbacks[customerId] && callbacks[customerId].length > 1) {
            let callIsAfterFirstForCustomer = false;
            if(callbacks[customerId].length > 1){
                const thisCallInCallbackList = callbacks[customerId].find(cbCall => cbCall.contactId === contactId);
                if(thisCallInCallbackList && callbacks[customerId][0].contactId !== contactId) {
                    callIsAfterFirstForCustomer = true;
                }
            }
            if(callIsAfterFirstForCustomer) score -= 2; 
        }

        if (!agents[agent]) agents[agent] = { total: 0, score: 0, shortCount: 0, posCount: 0, flags: 0 };
        agents[agent].total++;
        agents[agent].score += score;
        if (seconds < 240) agents[agent].shortCount++;
        if (posFlags.length) agents[agent].posCount++;
        agents[agent].flags += flags.length;

        totalScore += score;
        durationTotal += seconds;

        [...flags, ...posFlags].forEach(flag => {
            const k = typeof flag === 'string' ? flag.toLowerCase() : "unknown_flag_type";
            themes[k] = (themes[k] || 0) + 1;
        });
    });

    const avgScore = callCount > 0 ? (totalScore / callCount) : 0;
    const avgDuration = callCount > 0 ? (durationTotal / callCount / 60) : 0;
    
    const topThemesArray = Object.entries(themes).sort((a, b) => b[1] - a[1]).slice(0, 5).map(t => t[0]);
    const topAgentsArray = Object.entries(agents)
        .sort((a,b)=> (b[1].total > 0 ? b[1].score/b[1].total : 0) - (a[1].total > 0 ? a[1].score/a[1].total : 0))
        .slice(0,3);

    return {
        agents,
        themes,
        callbacks,
        totalScore,
        durationTotal,
        callCount,
        avgScore,
        avgDuration,
        topThemesArray,
        topAgentsArray
    };
}

export function getInitialOutlookStats(processedData) {
    const { callCount, avgScore, avgDuration, topThemesArray, topAgentsArray } = processedData;
    let outlookText = `📊 Coaching Summary (${callCount} calls)\n\n`;
    outlookText += `⭐ Avg Engagement Score: ${avgScore.toFixed(1)}\n`;
    outlookText += `⏱️ Avg Duration: ${avgDuration.toFixed(1)} min\n`;
    outlookText += `🧠 Top Coaching Themes: ${topThemesArray.join(", ")}\n\n🏅 Agent Standouts:`;
    
    if (topAgentsArray.length > 0) {
        outlookText += topAgentsArray.map(([name, a]) => 
            `\n• ${name} – Score: ${(a.total > 0 ? a.score/a.total : 0).toFixed(2)}, Pos: ${a.posCount}, Flags: ${a.flags}, Short Calls: ${a.shortCount}`
        ).join("");
    } else {
        outlookText += "\nN/A";
    }
    return outlookText;
}

export function generateCoachingSummaryText(processedData) {
  const { agents, themes, callbacks, avgScore, avgDuration, callCount } = processedData;
  
  // This logic is similar to part of getInitialOutlookStats, consider further consolidation if needed
  const topAgentsNames = Object.entries(agents)
    .sort((a,b)=> (b[1].total > 0 ? b[1].score/b[1].total : 0) - (a[1].total > 0 ? a[1].score/a[1].total : 0))
    .slice(0, 3)
    .map(a => a[0]);
  
  const topThemesNames = Object.entries(themes).sort((a,b)=>b[1]-a[1]).slice(0, 3).map(t => t[0]);
  const repeatCallbackUserCount = Object.values(callbacks).filter(arr => arr.length > 1).length;

  const summary = `This week, the team maintained a strong engagement level, averaging a score of ${avgScore.toFixed(1)} over ${callCount} reviewed calls. 
Average call duration held at ${avgDuration.toFixed(1)} minutes, with many calls resolved efficiently and positively.

Shoutouts to standout agents: ${topAgentsNames.join(", ")}, who demonstrated excellent communication and consistency. 
Common themes during coaching moments included: ${topThemesNames.join(", ")} — offering a clear direction for targeted support or refreshers.

${repeatCallbackUserCount > 0 ? `We observed ${repeatCallbackUserCount} customers who called back within a short window. These cases may benefit from reviewing root causes or confirming resolution clarity.` : `No callback spikes were detected this cycle, indicating strong first-contact resolution.`}

Keep celebrating what\'s working while refining moments that can elevate the overall experience.`;
  return summary;
} 