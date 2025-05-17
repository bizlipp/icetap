// js/dataProcessor.js
// This module will be responsible for all data loading, parsing, and processing logic.

// Placeholder for data processing functions
// export function loadAndProcessData(source) { ... }
// export function calculateAgentScores(calls) { ... }
// etc. 

// Default formula weights, can be overridden by UI
export const defaultFormulaWeights = {
    pointsPositiveFlag: 2,
    pointsShortPositiveCall: 2, // If call is < 4 minutes and has positive flags
    penaltyFlag: -1,
    penaltyCallback: -2,
};

// Helper function to get formula weights from UI elements
export function getFormulaWeightsFromUI() {
    const weights = { ...defaultFormulaWeights }; // Start with defaults
    const pointsPositiveFlagEl = document.getElementById('pointsPositiveFlag');
    if (pointsPositiveFlagEl) weights.pointsPositiveFlag = parseInt(pointsPositiveFlagEl.value, 10) || defaultFormulaWeights.pointsPositiveFlag;
    
    const pointsShortPositiveCallEl = document.getElementById('pointsShortPositiveCall');
    if (pointsShortPositiveCallEl) weights.pointsShortPositiveCall = parseInt(pointsShortPositiveCallEl.value, 10) || defaultFormulaWeights.pointsShortPositiveCall;
    
    const penaltyFlagEl = document.getElementById('penaltyFlag');
    if (penaltyFlagEl) weights.penaltyFlag = parseInt(penaltyFlagEl.value, 10) || defaultFormulaWeights.penaltyFlag;
    
    const penaltyCallbackEl = document.getElementById('penaltyCallback');
    if (penaltyCallbackEl) weights.penaltyCallback = parseInt(penaltyCallbackEl.value, 10) || defaultFormulaWeights.penaltyCallback;
    
    return weights;
}

// Helper function to parse duration strings to seconds
function parseDurationToSeconds(durationText) {
    if (durationText === null || typeof durationText === 'undefined') return 0;

    if (typeof durationText === 'number') return durationText; // Already in seconds

    const text = String(durationText);
    // Format: "HH:MM:SS"
    const timeMatch = text.match(/(\d+):(\d+):(\d+)/);
    if (timeMatch) {
        const hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        const seconds = parseInt(timeMatch[3], 10);
        return hours * 3600 + minutes * 60 + seconds;
    }

    // Format: "X minutes Y seconds" or "X min Y sec"
    const minSecMatch = text.match(/(\d+)\s*min(?:utes)?\s*(?:and\s*)?(?:(\d+)\s*sec(?:onds)?)?/i);
    if (minSecMatch) {
        const minutes = parseInt(minSecMatch[1] || 0, 10);
        const seconds = parseInt(minSecMatch[2] || 0, 10);
        return minutes * 60 + seconds;
    }
    
    // Format: "X seconds" or "X sec"
    const secOnlyMatch = text.match(/(\d+)\s*sec(?:onds)?/i);
    if (secOnlyMatch) {
        return parseInt(secOnlyMatch[1] || 0, 10);
    }

    const num = parseFloat(text);
    if (!isNaN(num)) return num;

    return 0;
}

// Main data processing function - Now significantly expanded
export function processCallData(rawCalls, filters = {}, formulaWeights = getFormulaWeightsFromUI()) {
    if (!rawCalls || rawCalls.length === 0) {
        return {
            callCount: 0, agents: {}, themes: {}, callbacks: {}, agentThemes: {},
            summaryStats: { totalCalls: 0, flaggedCallsCount: 0, positiveCallsCount: 0, totalDurationSeconds: 0, avgDurationSeconds: 0 },
            agentMetrics: {}, flagDistribution: {}, positiveIndicatorDistribution: {}, 
            hourDistribution: new Array(24).fill(0), dayDistribution: new Array(7).fill(0),
            channelDistribution: {}, queueDistribution: {}, wordFrequency: {},
            repeatCallers: {}, categoryDistribution: {},
            processedCalls: [],
            appliedFormulaWeights: formulaWeights,
            positiveCallsForList: [],
            topAgentsForTable: [],
        };
    }

    const stopwords = [
        "this", "that", "what", "with", "have", "your", "from", "there", "would", "could", "about", "which",
        "just", "like", "it's", "yeah", "don't", "going", "gonna", "you're", "thank", "then", "know", "because",
        "they", "well", "need", "give", "take", "back", "right", "name", "alright", "when", "want", "here",
        "make", "let's", "will", "okay", "actually", "sorry", "able", "sure", "were", "been", "does", "doing", 
        "should", "can't", "didn't", "isn't", "that's", "i'll", "we'll", "wasn't", "they're",
        "where", "their", "them", "these", "those", "some", "myself", "yourself", "himself", "herself",
        "please", "account", "information", "customer", "service", "contact", "number", "email", "phone", 
        "call", "calling", "assistance", "help", "good", "time", "more", "only", "send", "still", "text", "data", "said", "today", 
        "what's", "we're", "boost", "card", "digit", "yeah,", "you,", "here.", "know,", "right,", "yes,",
        "alright,", "that,", "bye,", "cxo-supcall-de-escalate", "credit_debit_number", "choosing", 
        "payment", "cxo-wireless-call-issues", "i've", "um", "uh", "ah", "er", "ok", "sir", "maam", "hello", "hi"
    ];

    let filteredCalls = rawCalls;
    if (filters.agent && filters.agent !== 'all') {
        filteredCalls = rawCalls.filter(call => (call.meta?.['Agent name'] || call.meta?.['Agent']) === filters.agent);
    }

    const agents = {}; // For existing inspiro-audit-report compatibility
    const themes = {}; // For existing inspiro-audit-report compatibility (negative flags)
    const callbacks = {}; // For existing inspiro-audit-report compatibility
    const agentThemes = {}; // For existing inspiro-audit-report compatibility

    const summaryStats = { totalCalls: 0, flaggedCallsCount: 0, positiveCallsCount: 0, totalDurationSeconds: 0 }; 
    const agentMetrics = {}; 
    const flagDistribution = {}; 
    const positiveIndicatorDistribution = {}; 
    const hourDistribution = new Array(24).fill(0);
    const dayDistribution = new Array(7).fill(0);
    const channelDistribution = {};
    const queueDistribution = {};
    const wordFrequency = {};
    const repeatCallers = {};
    const categoryDistribution = {};
    let processedCallsForOutput = [];

    filteredCalls.forEach(call => {
        const agentName = call.meta?.['Agent name'] || call.meta?.['Agent'] || 'Unknown';
        const callDurationSeconds = parseDurationToSeconds(call.meta?.['Contact duration']);
        const isShortCall = callDurationSeconds < 240;

        if (!agents[agentName]) {
            agents[agentName] = { name: agentName, score: 0, callCount: 0, totalPositiveFlags: 0, totalNegativeFlags: 0, callbackHits: 0 };
            agentThemes[agentName] = {};
        }
        if (!agentMetrics[agentName]) {
            agentMetrics[agentName] = {
                name: agentName, totalCalls: 0, distinctFlaggedCalls: 0, distinctPositiveCalls: 0,
                totalPositiveScoreFromFormula: 0, totalDurationSeconds: 0,
                sumOfAllPositiveFlags: 0, sumOfAllNegativeFlags: 0
            };
        }

        agents[agentName].callCount++;
        agentMetrics[agentName].totalCalls++;
        agentMetrics[agentName].totalDurationSeconds += callDurationSeconds;

        let callScore = 0;
        let isFlaggedCall = false;
        let isPositiveCall = false;

        if (call.flags && call.flags.length > 0) {
            isFlaggedCall = true;
            call.flags.forEach(flag => {
                callScore += formulaWeights.penaltyFlag;
                agents[agentName].totalNegativeFlags++;
                themes[flag] = (themes[flag] || 0) + 1;
                agentThemes[agentName][flag] = (agentThemes[agentName][flag] || 0) + 1;
                flagDistribution[flag] = (flagDistribution[flag] || 0) + 1; 
                agentMetrics[agentName].sumOfAllNegativeFlags++;
            });
        }

        if (call.positiveFlags && call.positiveFlags.length > 0) {
            isPositiveCall = true;
            call.positiveFlags.forEach(pFlag => {
                callScore += formulaWeights.pointsPositiveFlag;
                agents[agentName].totalPositiveFlags++;
                positiveIndicatorDistribution[pFlag] = (positiveIndicatorDistribution[pFlag] || 0) + 1;
                agentMetrics[agentName].sumOfAllPositiveFlags++;
            });
            if (isShortCall) {
                callScore += formulaWeights.pointsShortPositiveCall;
            }
        }
        
        summaryStats.totalCalls++;
        if (isFlaggedCall) agentMetrics[agentName].distinctFlaggedCalls++;
        if (isPositiveCall) agentMetrics[agentName].distinctPositiveCalls++;
        if (isFlaggedCall) summaryStats.flaggedCallsCount++;
        if (isPositiveCall) summaryStats.positiveCallsCount++;
        summaryStats.totalDurationSeconds += callDurationSeconds;

        const customerId = call.meta?.['Customer phone number / email address'] || call.meta?.['Contact ID'];
        if (customerId && customerId !== 'Unknown' && customerId !== 'N/A') {
            if (!callbacks[customerId]) {
                callbacks[customerId] = { count: 0, calls: [], agentNames: new Set() };
            }
            callbacks[customerId].count++;
            callbacks[customerId].calls.push({ 
                contactId: call.meta['Contact ID'], timestamp: call.meta['Initiation timestamp'], agent: agentName 
            });
            callbacks[customerId].agentNames.add(agentName);
            if (callbacks[customerId].count > 1) {
                callScore += formulaWeights.penaltyCallback;
                agents[agentName].callbackHits = (agents[agentName].callbackHits || 0) + 1;
            }

            if (!repeatCallers[customerId]) {
                repeatCallers[customerId] = {
                    identifier: customerId, calls: [], flagCount: {}, 
                    firstCallTimestamp: null, latestCallTimestamp: null, callCount: 0
                };
            }
            const rec = repeatCallers[customerId];
            rec.callCount++;
            rec.calls.push({ id: call.meta['Contact ID'], timestamp: call.meta['Initiation timestamp'], flags: call.flags || [], agent: agentName });
            if (call.flags) call.flags.forEach(f => rec.flagCount[f] = (rec.flagCount[f] || 0) + 1);
            const ts = call.meta['Initiation timestamp'];
            if (ts) {
                const d = new Date(ts);
                if (!isNaN(d.getTime())) {
                    if (!rec.firstCallTimestamp || d < new Date(rec.firstCallTimestamp)) rec.firstCallTimestamp = ts;
                    if (!rec.latestCallTimestamp || d > new Date(rec.latestCallTimestamp)) rec.latestCallTimestamp = ts;
                }
            }
        }

        agents[agentName].score += callScore;
        agentMetrics[agentName].totalPositiveScoreFromFormula += callScore;

        try {
            const timestamp = call.meta["Initiation timestamp"];
            if (timestamp) {
                const date = new Date(timestamp);
                if (!isNaN(date.getTime())) {
                    hourDistribution[date.getHours()]++;
                    dayDistribution[date.getDay()]++;
                }
            }
        } catch (e) { /* ignore */ }

        const channel = call.meta["Channel"] || "Unknown";
        channelDistribution[channel] = (channelDistribution[channel] || 0) + 1;
        const queue = call.meta["Queue"] || "Unknown";
        queueDistribution[queue] = (queueDistribution[queue] || 0) + 1;

        if (call.meta["Categories"] && call.meta["Categories"] !== "N/A") {
            String(call.meta["Categories"]).split(',').map(c => c.trim()).forEach(cat => {
                if (cat) categoryDistribution[cat] = (categoryDistribution[cat] || 0) + 1;
            });
        }

        if (call.transcript && Array.isArray(call.transcript)) {
            call.transcript.forEach(entry => {
                if (entry.text) {
                    String(entry.text).toLowerCase().split(/[^a-zA-Z0-9']+/).filter(w => 
                        w.length > 2 && w.length < 20 && !stopwords.includes(w) && !/^\d+$/.test(w)
                    ).forEach(w => wordFrequency[w] = (wordFrequency[w] || 0) + 1);
                }
            });
        }
        processedCallsForOutput.push({ ...call, calculatedScore: callScore});
    });

    Object.values(agentMetrics).forEach(metric => {
        metric.avgDurationSeconds = metric.totalCalls > 0 ? metric.totalDurationSeconds / metric.totalCalls : 0;
        metric.avgScore = metric.totalCalls > 0 ? metric.totalPositiveScoreFromFormula / metric.totalCalls : 0;
        metric.positiveRatio = metric.totalCalls > 0 ? metric.distinctPositiveCalls / metric.totalCalls : 0;
        metric.negativeRatio = metric.totalCalls > 0 ? metric.distinctFlaggedCalls / metric.totalCalls : 0;

        let callsWithBothFlags = 0;
        filteredCalls.forEach(call => {
            const callAgentName = call.meta?.['Agent name'] || call.meta?.['Agent'] || 'Unknown';
            if (callAgentName === metric.name) {
                const hasPos = call.positiveFlags && call.positiveFlags.length > 0;
                const hasNeg = call.flags && call.flags.length > 0;
                if (hasPos && hasNeg) callsWithBothFlags++;
            }
        });
        metric.neutralCallsCount = metric.totalCalls - metric.distinctPositiveCalls - metric.distinctFlaggedCalls + callsWithBothFlags;
        metric.neutralCallsCount = Math.max(0, metric.neutralCallsCount);
    });

    summaryStats.avgDurationSeconds = summaryStats.totalCalls > 0 ? summaryStats.totalDurationSeconds / summaryStats.totalCalls : 0;

    const positiveCallsForList = processedCallsForOutput
        .filter(call => call.calculatedScore > 0 && call.positiveFlags && call.positiveFlags.length > 0)
        .sort((a, b) => b.calculatedScore - a.calculatedScore)
        .slice(0, 5);

    const topAgentsForTable = Object.values(agentMetrics)
        .sort((a, b) => b.avgScore - a.avgScore) // Sort by avgScore from formula
        .slice(0, 5);

    // Ensure the original agents structure (used by older parts of dashboard) is compatible
    // It expects `agents[agentName].score` to be the sum of scores, and `agents[agentName].callCount`
    Object.keys(agents).forEach(agentName => {
        if (agentMetrics[agentName]) {
            agents[agentName].score = agentMetrics[agentName].totalPositiveScoreFromFormula; // Align scores
            agents[agentName].callCount = agentMetrics[agentName].totalCalls; // Align call counts
        }
    });

    return {
        callCount: filteredCalls.length,
        agents, 
        themes, 
        callbacks, 
        agentThemes, 
        summaryStats,
        agentMetrics, 
        flagDistribution,
        positiveIndicatorDistribution,
        hourDistribution,
        dayDistribution,
        channelDistribution,
        queueDistribution,
        wordFrequency,
        repeatCallers,
        categoryDistribution,
        processedCalls: processedCallsForOutput, 
        appliedFormulaWeights: formulaWeights,
        positiveCallsForList, 
        topAgentsForTable,
    };
}

// Original function was called durationToSeconds, ensure it's used or replaced by parseDurationToSeconds
// Assuming parseDurationToSeconds is the one to use globally now.
function durationToSeconds(durationStr) { 
    return parseDurationToSeconds(durationStr);
}

export function getInitialOutlookStats(processedData) {
    const { callCount, summaryStats, themes, callbacks, agents } = processedData;
    let outlookText = `📊 Coaching Summary (${summaryStats?.totalCalls || callCount} calls)\n\n`;
    outlookText += `⭐ Avg Engagement Score: ${summaryStats?.avgScore !== undefined ? summaryStats.avgScore.toFixed(1) : (processedData.avgScore !== undefined ? processedData.avgScore.toFixed(1) : 'N/A')}\n`; // Fallback to older avgScore if new one isn't there for some reason
    outlookText += `⏱️ Avg Duration: ${summaryStats?.avgDurationSeconds ? (summaryStats.avgDurationSeconds / 60).toFixed(1) : 'N/A'} min\n`;
    
    const topThemeEntry = Object.entries(themes || {}).sort((a,b) => b[1]-a[1])[0];
    if(topThemeEntry) outlookText += `🧠 Top Coaching Theme: ${topThemeEntry[0]} (${topThemeEntry[1]} times)\n`;
    
    const multiCallbackCustomersCount = Object.values(callbacks || {}).filter(c => c.count > 1).length;
    const totalInitialCustomers = Object.keys(callbacks || {}).length;
    const callbackPercentage = totalInitialCustomers > 0 ? (multiCallbackCustomersCount / totalInitialCustomers * 100).toFixed(1) : 0;

    outlookText += `📞 Repeat Contacts: ${multiCallbackCustomersCount} customers contacted more than once (${callbackPercentage}% of unique customers).\n`;
    outlookText += `--- Report Generated: ${new Date().toLocaleString()} ---\n`;
    return outlookText;
}

export function generateCoachingSummaryText(processedData, allRawCallsData) {
  const { agents, themes, callbacks, agentMetrics, summaryStats, appliedFormulaWeights, callCount, topAgentsForTable } = processedData;
  
  let summary = `This period, ${summaryStats?.totalCalls || callCount} calls were analyzed, resulting in an average team engagement score of ${summaryStats?.avgScore !== undefined ? summaryStats.avgScore.toFixed(1) : 'N/A'}.\n`;
  summary += `Average call duration was ${summaryStats?.avgDurationSeconds ? (summaryStats.avgDurationSeconds/60).toFixed(1) : 'N/A'} minutes.\n\n`;

  if (topAgentsForTable && topAgentsForTable.length > 0) {
    summary += `🌟 **Agent Standouts (Top by Avg Score):** Congratulations to ${topAgentsForTable.map(a => a.name).join(", ")} for leading with high engagement scores!\n`;
  } else if (Object.keys(agentMetrics || agents || {}).length > 0) {
    summary += "No specific agent standouts in the current filtered view based on top scores, but let's look at overall team efforts.\n";
  } else {
    summary += "No agent data to display for standouts in the current view.\n";
  }

  const topThemesArray = Object.entries(themes || {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(t => t[0]);
  if (topThemesArray.length > 0) {
    summary += `🧠 **Key Themes (Negative Flags):** Common themes observed include: ${topThemesArray.join(", ")}. Consider focusing training or discussions around these topics.\n`;
  }

  const repeatCallbackEntries = Object.values(callbacks || {}).filter(data => data.count > 1);
  const repeatCallbackUserCount = repeatCallbackEntries.length;

  if (repeatCallbackUserCount > 0) {
    summary += `📞 **Callback Focus:** ${repeatCallbackUserCount} customer(s) had multiple contacts. \n`;
    const highCallbackCustomers = repeatCallbackEntries.sort((a,b) => b.count - a.count).slice(0,3);
    summary += `   - Prioritize reviewing interactions for: ${highCallbackCustomers.map(c => `${c.calls[0]?.contactId?.substring(0,8)}... (${c.count} calls)`).join(", ")}. \n`; // Using contact ID prefix for customer ID
    summary +=  `   - This can help identify opportunities to enhance first-call resolution.\n`;
  } else {
    summary += `👍 **First-Call Resolution:** Strong performance in first-call resolution, with no significant repeat callback patterns detected in this dataset.\n`;
  }

  summary += `\n💡 **Deeper Agent Insights:**\n`;
  const detailedAgents = Object.values(agentMetrics || {});
  if (detailedAgents.length > 0) {
    const praiseWorthy = detailedAgents
        .filter(a => a.avgScore > 1 && a.positiveRatio > 0.6 && a.totalCalls >= 3)
        .sort((a,b)=>b.avgScore-a.avgScore)
        .slice(0,2);
    const developmentFocus = detailedAgents
        .filter(a => a.avgScore < 0 && (a.negativeRatio) > 0.3 && a.totalCalls >= 3)
        .sort((a,b)=>a.avgScore-b.avgScore)
        .slice(0,2);

    if(praiseWorthy.length > 0) {
        summary += `🚀 Agents for Praise (High Avg Score & Pos. Ratio): \n`;
        praiseWorthy.forEach(a => summary += `   - ${a.name} (Avg Score: ${a.avgScore.toFixed(2)}, Pos Ratio: ${(a.positiveRatio*100).toFixed(0)}%)\n`);
    } else { summary += `   - No agents specifically identified for praise based on current high-performance thresholds.\n`; }

    if(developmentFocus.length > 0) {
        summary += `📈 Agents for Development (Low Avg Score & High Neg. Ratio): \n`;
        developmentFocus.forEach(a => summary += `   - ${a.name} (Avg Score: ${a.avgScore.toFixed(2)}, Neg Call Ratio: ${((a.negativeRatio)*100).toFixed(0)}%)\n`);
    } else { summary += `   - No agents specifically identified for development focus based on current thresholds.\n`; }

  } else {
    summary += `   - No detailed agent metrics available for deeper insights.\n`;
  }
  
  summary += `\n📖 **Agent Specific Theme Focus (Top Negative Themes per Agent):**\n`;
  let agentsWithThemesDisplayed = 0;
  for (const agentName in (agentThemes || {})) {
      const topAgentThemes = Object.entries(agentThemes[agentName])
          .sort(([, countA], [, countB]) => countB - countA)
          .slice(0, 2);
      if (topAgentThemes.length > 0) {
          summary += `   - ${agentName}: Consider focusing on reducing '${topAgentThemes.map(t => t[0]).join("' and '")}'.\n`;
          agentsWithThemesDisplayed++;
      }
      if(agentsWithThemesDisplayed >= 3) break;
  }
  if(agentsWithThemesDisplayed === 0) summary += `   - No specific themes stood out per agent based on available data.\n`;

  summary += `\n📜 Formula used: +${appliedFormulaWeights.pointsPositiveFlag}/pos.flag, +${appliedFormulaWeights.pointsShortPositiveCall}/short pos. call, ${appliedFormulaWeights.penaltyFlag}/flag, ${appliedFormulaWeights.penaltyCallback}/callback hit.`;
  summary += `\nRemember to use the agent filter and click on charts for more granular details!`;

  return summary;
}

export function getThemeDetails(themeName, allRawCalls, processedAgentsData) {
    const themeNameLower = themeName.toLowerCase();
    let totalOccurrences = 0;
    let sumOfScoresWithTheme = 0;
    let callsWithThemeCount = 0;
    const agentsInvolvedCount = {};
    const sampleCalls = [];

    allRawCalls.forEach(call => {
        const callFlags = (call.flags || []).map(f => typeof f === 'string' ? f.toLowerCase() : '');
        const callPositiveFlags = (call.positiveFlags || []).map(f => typeof f === 'string' ? f.toLowerCase() : '');
        const allCallThemes = [...callFlags, ...callPositiveFlags];

        if (allCallThemes.includes(themeNameLower)) {
            totalOccurrences++;
            if(sampleCalls.length < 10) sampleCalls.push(call);

            const agentName = call.meta?.["Agent name"] || call.meta?.['Agent'] || "Unknown";
            agentsInvolvedCount[agentName] = (agentsInvolvedCount[agentName] || 0) + 1;

            // Recalculate score for this call for context - using current formula from UI
            const durationSeconds = parseDurationToSeconds(call.meta?.['Contact duration']);
            const isShortCall = durationSeconds < 240;
            let score = 0;
            const currentWeights = getFormulaWeightsFromUI(); // Use current weights for this calculation
            
            score += (call.positiveFlags || []).length * currentWeights.pointsPositiveFlag;
            if (isShortCall && (call.positiveFlags || []).length > 0) {
                 score += currentWeights.pointsShortPositiveCall;
            }
            score += (call.flags || []).length * currentWeights.penaltyFlag;
            
            // Callback penalty if applicable (simplified check - assumes `callbacks` object is not available here directly)
            // This part is tricky without passing full callback data. For simplicity, we might omit callback penalty for this specific theme score.
            // Or, one might need to re-process/check callback status for each of these calls if crucial.
            // For now, score is based on flags and short positive call bonus.

            sumOfScoresWithTheme += score;
            callsWithThemeCount++;
        }
    });

    const sortedAgentsInvolved = Object.entries(agentsInvolvedCount).sort((a,b)=>b[1]-a[1]);

    return {
        themeName,
        totalOccurrences,
        avgScoreWithTheme: callsWithThemeCount > 0 ? sumOfScoresWithTheme / callsWithThemeCount : 0,
        agentsInvolved: sortedAgentsInvolved, // Array of [agentName, count]
        calls: sampleCalls // Sample of raw calls that include this theme
    };
}

// The old processCallData is below, it will be replaced by the one above.
// I am keeping it here temporarily just in case something was missed in the merge,
// but the intention is that the new one at the top is the primary.
/*
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

        if (!agents[agent]) agents[agent] = { total: 0, score: 0, shortCount: 0, posCount: 0, flags: 0, agentThemes: {} };
        // Ensure agentThemes is initialized if agent object already exists from a previous pass (e.g. if data processing is refactored later)
        if (!agents[agent].agentThemes) {
            agents[agent].agentThemes = {};
        }
        agents[agent].total++;
        agents[agent].score += score;
        if (seconds < 240) agents[agent].shortCount++;
        if (posFlags.length) agents[agent].posCount++;
        agents[agent].flags += flags.length;

        totalScore += score;
        durationTotal += seconds;

        [...flags, ...posFlags].forEach(flag => {
            const k = typeof flag === 'string' ? flag.toLowerCase() : "unknown_flag_type";
            themes[k] = (themes[k] || 0) + 1; // Global themes
            agents[agent].agentThemes[k] = (agents[agent].agentThemes[k] || 0) + 1; // Per-agent themes
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
*/ 