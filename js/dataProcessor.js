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

const defaultFormulaWeights = {
    pointsPositiveFlag: 2,
    pointsShortPositiveCall: 2,
    penaltyFlag: -1,
    penaltyCallback: -2
};

export function getFormulaWeightsFromUI() {
    const weights = {};
    weights.pointsPositiveFlag = parseInt(document.getElementById('pointsPositiveFlag')?.value) || defaultFormulaWeights.pointsPositiveFlag;
    weights.pointsShortPositiveCall = parseInt(document.getElementById('pointsShortPositiveCall')?.value) || defaultFormulaWeights.pointsShortPositiveCall;
    weights.penaltyFlag = parseInt(document.getElementById('penaltyFlag')?.value) || defaultFormulaWeights.penaltyFlag;
    weights.penaltyCallback = parseInt(document.getElementById('penaltyCallback')?.value) || defaultFormulaWeights.penaltyCallback;
    return weights;
}

export function processCallData(allCalls, filters = {}, formulaWeights = defaultFormulaWeights) {
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
        score += posFlags.length * formulaWeights.pointsPositiveFlag;
        if (seconds < 240 && posFlags.length) score += formulaWeights.pointsShortPositiveCall;
        score += flags.length * formulaWeights.penaltyFlag;

        if (customerId && callbacks[customerId] && callbacks[customerId].length > 1) {
            let callIsAfterFirstForCustomer = false;
            if(callbacks[customerId].length > 1){
                const thisCallInCallbackList = callbacks[customerId].find(cbCall => cbCall.contactId === contactId);
                if(thisCallInCallbackList && callbacks[customerId][0].contactId !== contactId) {
                    callIsAfterFirstForCustomer = true;
                }
            }
            if(callIsAfterFirstForCustomer) score += formulaWeights.penaltyCallback;
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
        topAgentsArray,
        appliedFormulaWeights: formulaWeights
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

export function generateCoachingSummaryText(processedData, allRawCallsData) {
  const { agents, themes, callbacks, avgScore, avgDuration, callCount, topAgentsArray, topThemesArray, appliedFormulaWeights } = processedData;
  
  let summary = `This period, ${callCount} calls were analyzed, resulting in an average team engagement score of ${avgScore.toFixed(1)}. 
Average call duration was ${avgDuration.toFixed(1)} minutes.

`;

  // Agent Standouts (already good)
  if (topAgentsArray.length > 0) {
    summary += `🌟 **Agent Standouts:** Congratulations to ${topAgentsArray.map(a => a[0]).join(", ")} for leading with high engagement scores!
`;
  } else if (Object.keys(agents).length > 0) {
    summary += "No specific agent standouts in the current filtered view based on top scores, but let's look at overall team efforts.\n";
  } else {
    summary += "No agent data to display for standouts in the current view.\n";
  }

  // Top Coaching Themes (already good)
  if (topThemesArray.length > 0) {
    summary += `🧠 **Key Themes:** Common themes observed include: ${topThemesArray.join(", ")}. Consider focusing training or discussions around these topics.
`;
  }

  // Callback Analysis
  const repeatCallbackEntries = Object.entries(callbacks).filter(([_, arr]) => arr.length > 1);
  const repeatCallbackUserCount = repeatCallbackEntries.length;

  if (repeatCallbackUserCount > 0) {
    summary += `📞 **Callback Focus:** ${repeatCallbackUserCount} customer(s) had multiple contacts. 
`;
    const highCallbackCustomers = repeatCallbackEntries.sort((a,b) => b[1].length - a[1].length).slice(0,3);
    summary += `   - Prioritize reviewing interactions for: ${highCallbackCustomers.map(c => c[0] + " ("+c[1].length+" calls)").join(", ")}. 
`;
    summary +=  `   - This can help identify opportunities to enhance first-call resolution.
`;
  } else {
    summary += `👍 **First-Call Resolution:** Strong performance in first-call resolution, with no significant repeat callback patterns detected in this dataset.
`;
  }

  // Deeper Agent Insights (Example)
  let areasForDevelopment = [];
  let areasOfStrength = [];

  for (const [agentName, data] of Object.entries(agents)) {
    const agentAvgScore = data.total > 0 ? (data.score / data.total) : 0;
    const positiveInteractionRate = data.total > 0 ? (data.posCount / data.total) * 100 : 0;
    const flagRate = data.total > 0 ? (data.flags / data.total) : 0; // flags per call

    if (data.total === 0) continue; // Skip agents with no calls in the current view

    if (agentAvgScore < avgScore * 0.8 && avgScore > 0) { // Significantly below team average
        areasForDevelopment.push(`${agentName} (Avg Score: ${agentAvgScore.toFixed(1)}, vs team avg: ${avgScore.toFixed(1)})`);
    }
    if (flagRate > 0.5 && data.flags > 2) { // High flag rate (e.g. > 0.5 flags per call and more than 2 total flags)
        areasForDevelopment.push(`${agentName} (High flag rate: ${data.flags} flags in ${data.total} calls)`);
    }
    if (positiveInteractionRate < 50 && data.total >= 5) { // Low positive interaction rate on a decent number of calls
        areasForDevelopment.push(`${agentName} (Low positive interactions: ${positiveInteractionRate.toFixed(0)}% in ${data.total} calls)`);
    }
    // Example of strength
    if (agentAvgScore > avgScore * 1.1 && data.total >=5 ) {
        areasOfStrength.push(`${agentName} (Score: ${agentAvgScore.toFixed(1)}, ${positiveInteractionRate.toFixed(0)}% positive interactions)`);
    }
  }

  if (areasOfStrength.length > 0) {
    summary += `
🚀 **Kudos & Recognition:**
`;
    areasOfStrength.slice(0,3).forEach(area => summary += `   - ${area}\n`);
  }
  
  if (areasForDevelopment.length > 0) {
    summary += `
📈 **Development Opportunities:**
`;
    // Show top 3-4 development areas to keep it concise
    areasForDevelopment.slice(0,3).forEach(area => summary += `   - Focus on: ${area}\n`);
  } else if (Object.keys(agents).length > 0) {
    summary += `
✅ **Consistent Performance:** Overall, agents are performing consistently within the expected parameters based on the current formula and data.
`;
  }
  
  summary += `
Formula used: +${appliedFormulaWeights.pointsPositiveFlag}/pos.flag, +${appliedFormulaWeights.pointsShortPositiveCall}/short pos. call, ${appliedFormulaWeights.penaltyFlag}/flag, ${appliedFormulaWeights.penaltyCallback}/callback hit.`;
  summary += `
Remember to use the agent filter and click on charts for more granular details!`;

  return summary;
}

export function getThemeDetails(themeName, allRawCalls, processedAgentsData) {
    const themeNameLower = themeName.toLowerCase();
    let totalOccurrences = 0;
    let sumOfScoresWithTheme = 0;
    let callsWithThemeCount = 0;
    const agentsInvolved = {};

    allRawCalls.forEach(call => {
        const callFlags = (call.flags || []).map(f => typeof f === 'string' ? f.toLowerCase() : '');
        const callPositiveFlags = (call.positiveFlags || []).map(f => typeof f === 'string' ? f.toLowerCase() : '');
        const allCallThemes = [...callFlags, ...callPositiveFlags];

        if (allCallThemes.includes(themeNameLower)) {
            totalOccurrences++;
            const agentName = call.meta?.["Agent name"] || "Unknown";
            agentsInvolved[agentName] = (agentsInvolved[agentName] || 0) + 1;

            const durationStr = call.meta?.["Contact duration"] || "0:00:00";
            const seconds = durationToSeconds(durationStr);
            let score = 0;
            const currentWeights = getFormulaWeightsFromUI();
            score += (call.positiveFlags || []).length * currentWeights.pointsPositiveFlag;
            if (seconds < 240 && (call.positiveFlags || []).length) score += currentWeights.pointsShortPositiveCall;
            score += (call.flags || []).length * currentWeights.penaltyFlag;
            
            sumOfScoresWithTheme += score;
            callsWithThemeCount++;
        }
    });

    return {
        totalOccurrences,
        avgScoreWithTheme: callsWithThemeCount > 0 ? sumOfScoresWithTheme / callsWithThemeCount : 0,
        agentsInvolved
    };
} 