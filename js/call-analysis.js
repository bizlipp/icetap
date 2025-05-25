// js/call-analysis.js

// --- Configuration ---
const keywordGroups = {
    escalation: ["supervisor", "escalate", "manager", "complaint", "higher up"],
    ghosting: ["hello?", "are you there?", "can you hear me", "no one there"],
    resolution: ["resolved", "taken care of", "we fixed it", "problem solved", "issue solved", "all set"],
    positiveRapport: ["thank you", "thanks", "appreciate", "great service", "excellent", "helpful", "fantastic"],
    negativeExperience: ["ridiculous", "unacceptable", "terrible", "worst", "not helpful", "frustrated", "angry", "upset"],
    repeatIssue: ["called before", "already tried", "still having issues", "same problem", "again"],
    technicalIssue: ["doesn't work", "not working", "error", "broken", "issue with the system"],
    cancellation: ["cancel", "terminate", "stop service", "close account"],
    billing: ["bill", "charge", "overcharge", "payment", "invoice", "refund"],
};

const defaultAnalysisOptions = {
    includeSentiment: true,
    includeDisconnectReason: true,
    includeKeywordStats: true,
    includeFlagPositions: true,
    includeCoachingSuggestions: true
};

// --- Helper Functions ---

/**
 * Parses a duration string (e.g., "00:03:25" or "03:25" or "25") into total minutes.
 * @param {string} durationStr - The duration string.
 * @returns {number|null} - Total minutes or null if invalid.
 */
function parseDuration(durationStr) {
    if (!durationStr || typeof durationStr !== 'string') return null;
    const parts = durationStr.split(':').map(Number);
    let hours = 0, minutes = 0, seconds = 0;

    if (parts.length === 3) { // HH:MM:SS
        [hours, minutes, seconds] = parts;
    } else if (parts.length === 2) { // MM:SS
        [minutes, seconds] = parts;
    } else if (parts.length === 1 && !isNaN(parts[0])) { // SS (assume seconds if single number)
        seconds = parts[0];
    } else {
        return null;
    }

    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return null;
    return (hours * 60) + minutes + (seconds / 60);
}

/**
 * Parses a timestamp string (e.g., "03:15") into total seconds from the start of the call.
 * Assumes the format MM:SS or HH:MM:SS.
 * @param {string} timestampStr - The timestamp string.
 * @returns {number|null} - Total seconds or null if invalid.
 */
function parseTimestamp(timestampStr) {
    if (!timestampStr || typeof timestampStr !== 'string') return null;
    const parts = timestampStr.split(':').map(Number);
    let hours = 0, minutes = 0, seconds = 0;

    if (parts.length === 3) { // HH:MM:SS
        [hours, minutes, seconds] = parts;
    } else if (parts.length === 2) { // MM:SS
        [minutes, seconds] = parts;
    } else {
        return null; // Invalid format for this simple parser
    }

    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return null;
    return (hours * 3600) + (minutes * 60) + seconds;
}


// --- Normalization Function ---

/**
 * Extracts and normalizes key metadata from a call object.
 * @param {object} callObject - The raw call object.
 * @returns {object} - A normalized metadata object.
 */
function normalizeMeta(callObject) {
    if (!callObject || typeof callObject !== 'object') {
        console.warn("normalizeMeta: Invalid callObject provided.");
        return {};
    }
    const meta = callObject.meta || {};
    console.log("normalizeMeta INPUT callObject.meta:", JSON.stringify(meta, null, 2));

    const initiationTimestampStr = meta["Initiation timestamp"] || meta.initiationTimestamp || meta.timestamp;
    const startTime = initiationTimestampStr ? new Date(initiationTimestampStr) : null;
    
    let durationMinutes = null;
    const durationStringSource = meta["Contact duration"] || meta.contactDuration || meta.duration;
    if (durationStringSource) {
        durationMinutes = parseDuration(durationStringSource);
    }

    let endTime = null;
    if (startTime && durationMinutes !== null) {
        endTime = new Date(startTime.getTime() + durationMinutes * 60000);
    } else if (meta["Disconnect timestamp"] || meta.disconnectTimestamp) {
        endTime = new Date(meta["Disconnect timestamp"] || meta.disconnectTimestamp);
        // Recalculate duration if start and end are present but durationMinutes was not
        if (startTime && durationMinutes === null && endTime) { // Added check for endTime
            durationMinutes = (endTime - startTime) / 60000;
        }
    }
    
    const agentName = meta["Agent name"] || meta.agentName || meta.Agent || meta.agent || "Unknown";

    const normalizedOutput = {
        contactId: meta["Contact ID"] || meta.contactId || `unknown-${Date.now()}`,
        agent: agentName,
        customerId: meta["Customer phone number / email address"] || meta.customerIdentifier || meta.customerId || "Unknown",
        startTime: startTime,
        endTime: endTime,
        durationMinutes: durationMinutes,
        durationText: (durationMinutes !== null) ? `${Math.floor(durationMinutes)}m ${Math.round((durationMinutes % 1) * 60)}s` : "N/A",
        channel: meta.Channel || meta.channel || "Unknown",
        queue: meta["Queue"] || meta.queue || "Unknown",
        routingProfile: meta["Routing profile"] || meta.routingProfile || "Unknown",
        flags: callObject.flags || [], // Assume flags are already processed and attached
        positiveFlags: callObject.positiveFlags || [], // Assume positive flags are already processed
        summary: callObject.summary || "",
        issue: callObject.issue || "",
        outcome: callObject.outcome || "",
        categories: meta.Categories || callObject.categories || "",
        // rawMeta: meta // Optionally include for debugging or deeper access
    };
    console.log("normalizeMeta OUTPUT (startTime, durationMinutes, durationText):", 
        startTime, 
        durationMinutes,
        normalizedOutput.durationText
    );
    return normalizedOutput;
}

// --- Core Analysis Function ---

/**
 * Performs various analyses on a single call object.
 * @param {object} callObject - The call object (should ideally have transcript and metadata).
 * @param {object} [options] - Options to control analysis modules.
 * @returns {object|null} - An analysis result object or null if validation fails.
 */
function analyzeCall(callObject, options = {}) {
    const finalOptions = { ...defaultAnalysisOptions, ...options };

    // 1. Data Contract Validation
    if (!callObject || typeof callObject !== 'object' || !callObject.meta || !callObject.transcript) {
        console.warn("analyzeCall: Invalid call object structure. Missing meta or transcript.", JSON.stringify(callObject, null, 2));
        return null;
    }
    // Added more detailed logging for missing timestamp
    if (!callObject.meta["Initiation timestamp"] && !callObject.meta.initiationTimestamp && !callObject.meta.timestamp) {
        console.warn("analyzeCall: Call object missing 'Initiation timestamp' (or variants). Contact ID:", callObject.meta["Contact ID"] || callObject.meta.contactId, "Full meta:", JSON.stringify(callObject.meta, null, 2));
    }

    const normalized = normalizeMeta(callObject); // Start with normalized data
    const analysisResult = { ...normalized }; // Base result on normalized data

    const transcript = callObject.transcript || [];
    let hasCustomerResponse = false;
    let flaggedEarly = false;
    let firstFlagTime = null;
    const flagPositions = { first: null, last: null, count: 0, timeline: [] };
    let sentimentScore = 0;
    const phraseMentions = {};
    const coachingSuggestions = new Set();


    // 2. Transcript-based Analysis
    transcript.forEach(entry => {
        if (entry.speaker && entry.speaker.toLowerCase().includes('customer')) {
            hasCustomerResponse = true;
        }

        const entryTextLower = entry.text ? entry.text.toLowerCase() : "";
        const entryTimestampSeconds = entry.timestamp ? parseTimestamp(entry.timestamp) : null;

        // Keyword stats & phrase mentions
        if (finalOptions.includeKeywordStats) {
            for (const group in keywordGroups) {
                keywordGroups[group].forEach(keyword => {
                    if (entryTextLower.includes(keyword.toLowerCase())) {
                        phraseMentions[group] = (phraseMentions[group] || 0) + 1;
                        phraseMentions[`keyword_${keyword.replace(/\s/g, '_')}`] = (phraseMentions[`keyword_${keyword.replace(/\s/g, '_')}`] || 0) + 1;

                        // Basic coaching suggestions based on keywords
                        if (finalOptions.includeCoachingSuggestions) {
                            if (group === "escalation") coachingSuggestions.add("Review escalation handling procedures.");
                            if (group === "ghosting") coachingSuggestions.add("Address potential ghost call patterns or dead air.");
                            if (group === "negativeExperience") coachingSuggestions.add("Focus on de-escalation and empathy for negative experiences.");
                            if (group === "repeatIssue") coachingSuggestions.add("Investigate reasons for repeat customer contact.");
                            if (group === "cancellation") coachingSuggestions.add("Explore reasons for cancellation request and potential retention strategies.");
                        }
                    }
                });
            }
        }
        
        // Sentiment (Light NLP)
        if (finalOptions.includeSentiment) {
            keywordGroups.positiveRapport.forEach(phrase => {
                if (entryTextLower.includes(phrase.toLowerCase())) sentimentScore++;
            });
            keywordGroups.negativeExperience.forEach(phrase => {
                if (entryTextLower.includes(phrase.toLowerCase())) sentimentScore--;
            });
        }

        // Flag positions and flaggedEarly
        if (entry.flags && entry.flags.length > 0 && entryTimestampSeconds !== null) {
            if (finalOptions.includeFlagPositions) {
                flagPositions.count += entry.flags.length; // Count each flag instance if multiple in one entry
                flagPositions.timeline.push(entryTimestampSeconds);
                if (flagPositions.first === null || entryTimestampSeconds < flagPositions.first) {
                    flagPositions.first = entryTimestampSeconds;
                }
                if (flagPositions.last === null || entryTimestampSeconds > flagPositions.last) {
                    flagPositions.last = entryTimestampSeconds;
                }
            }
            if (entryTimestampSeconds <= 60) {
                flaggedEarly = true;
                if (firstFlagTime === null || entryTimestampSeconds < firstFlagTime) {
                    firstFlagTime = entryTimestampSeconds;
                }
            }
        }
    });

    if (finalOptions.includeFlagPositions && flagPositions.timeline.length > 0) {
        flagPositions.timeline.sort((a, b) => a - b); // Ensure timeline is sorted
    } else if (finalOptions.includeFlagPositions) { // Ensure object exists even if no flags
        analysisResult.flagPositions = flagPositions;
    }


    // 3. Populate Analysis Result Object
    analysisResult.hasCustomerResponse = hasCustomerResponse;
    analysisResult.flaggedEarly = flaggedEarly;
    analysisResult.firstFlagTimeSeconds = firstFlagTime; // Time of the first flag if within 60s

    if (finalOptions.includeKeywordStats) {
        analysisResult.phraseMentions = phraseMentions;
        analysisResult.thankScore = phraseMentions.positiveRapport || 0; // Specific "thank you" count
    }

    if (finalOptions.includeSentiment) {
        analysisResult.sentimentScore = sentimentScore;
        if (finalOptions.includeCoachingSuggestions) {
            if (sentimentScore > 1) coachingSuggestions.add("Acknowledge and reinforce positive rapport building.");
            if (sentimentScore < -1) coachingSuggestions.add("Review empathy and de-escalation techniques for highly negative sentiment.");
        }
    }
    
    if (finalOptions.includeFlagPositions) {
        analysisResult.flagPositions = flagPositions;
        if (finalOptions.includeCoachingSuggestions && flagPositions.count > 2 && flagPositions.first !== null && flagPositions.first <= 60) {
            coachingSuggestions.add(`Multiple flags (${flagPositions.count}) occurred early (first at ${flagPositions.first}s). Review opening and policy adherence.`);
        }
    }

    // Disconnect Reason
    if (finalOptions.includeDisconnectReason) {
        analysisResult.disconnectReason = "normal"; // Default
        if (normalized.durationMinutes !== null && normalized.durationMinutes < 1) { // Example: less than 1 minute
            analysisResult.disconnectReason = "short_duration";
            if (finalOptions.includeCoachingSuggestions) coachingSuggestions.add("Investigate short duration call; ensure full resolution or proper process followed.");
        } else if (normalized.flags && normalized.flags.length > 0) {
            analysisResult.disconnectReason = "flagged_disconnect";
             if (finalOptions.includeCoachingSuggestions) coachingSuggestions.add("Call ended with unresolved flags. Review closing and issue resolution.");
        }
        // Could add more logic based on callObject.meta["Disconnect reason"] if available
    }
    
    if (finalOptions.includeCoachingSuggestions) {
        analysisResult.coachingSuggestions = Array.from(coachingSuggestions);
    }

    // Log the final analysis result before returning
    console.log(`analyzeCall: FINAL analysisResult for Contact ID ${analysisResult.contactId}:`, JSON.stringify(analysisResult, (key, value) => {
        // Custom replacer to handle Date objects for cleaner logging
        if (value instanceof Date) {
            return value.toISOString();
        }
        return value;
    }, 2));

    return analysisResult;
}


// --- Coaching Note Generation ---

/**
 * Generates a coaching note based on analysis results.
 * @param {object} analysisResult - The result from analyzeCall.
 * @returns {string} - A formatted coaching note.
 */
function generateCoachingNote(analysisResult) {
    if (!analysisResult) return "No analysis data available to generate coaching note.";

    const notes = [];

    // Use coaching suggestions if available
    if (analysisResult.coachingSuggestions && analysisResult.coachingSuggestions.length > 0) {
        analysisResult.coachingSuggestions.forEach(suggestion => notes.push(`💡 ${suggestion}`));
    } else {
        // Fallback to manual note generation if suggestions aren't present/enabled
        if (analysisResult.flaggedEarly) {
            notes.push("⚠️ Flag occurred within the first 60 seconds. Review call opening and initial interaction.");
        }
        if (analysisResult.thankScore && analysisResult.thankScore > 0) {
            notes.push(`✅ Positive rapport detected (${analysisResult.thankScore} "thank you" phrase(s)). Good job!`);
        } else if (analysisResult.sentimentScore > 0) {
            notes.push("✅ Generally positive sentiment observed.");
        }
        if (analysisResult.sentimentScore < 0) {
            notes.push("📉 Negative sentiment observed. Focus on empathy and de-escalation.");
        }
        if (analysisResult.phraseMentions) {
            if (analysisResult.phraseMentions.escalation) {
                notes.push("❗ Escalation terms mentioned. Ensure proper de-escalation procedures were followed.");
            }
            if (analysisResult.phraseMentions.ghosting) {
                notes.push("👻 Possible 'ghost call' or one-sided audio. Investigate and consider verification methods.");
            }
             if (analysisResult.phraseMentions.repeatIssue) {
                notes.push("🔁 Customer mentioned a repeat issue. Ensure thorough resolution and first-call resolution focus.");
            }
        }
        if (analysisResult.disconnectReason === "short_duration") {
            notes.push("⏱️ Call was very short. Verify if customer's issue was fully addressed.");
        }
         if (analysisResult.disconnectReason === "flagged_disconnect" && analysisResult.flags && analysisResult.flags.length > 0) {
            notes.push(`🚩 Call ended with flags: ${analysisResult.flags.join(', ')}. Review if resolution was achieved.`);
        }
    }


    if (notes.length === 0) return "No specific coaching points identified from this analysis.";
    return notes.join("\n");
}


// --- Grouping Utility Functions ---

/**
 * Groups calls by agent.
 * @param {Array<object>} calls - Array of call objects (ideally normalized or analyzed).
 * @returns {object} - An object where keys are agent names and values are arrays of calls.
 */
function groupByAgent(calls) {
    if (!Array.isArray(calls)) return {};
    return calls.reduce((acc, call) => {
        const agent = call.agent || (call.meta && (call.meta["Agent name"] || call.meta.Agent)) || "Unknown Agent";
        if (!acc[agent]) acc[agent] = [];
        acc[agent].push(call);
        return acc;
    }, {});
}

/**
 * Groups calls by customer ID.
 * @param {Array<object>} calls - Array of call objects (ideally normalized or analyzed).
 * @returns {object} - An object where keys are customer IDs and values are arrays of calls.
 */
function groupByCustomer(calls) {
     if (!Array.isArray(calls)) return {};
    return calls.reduce((acc, call) => {
        const customerId = call.customerId || (call.meta && call.meta["Customer phone number / email address"]) || "Unknown Customer";
        if (!acc[customerId]) acc[customerId] = [];
        acc[customerId].push(call);
        return acc;
    }, {});
}

// --- Expose to Window ---
if (typeof window !== 'undefined') {
    window.CallAnalyzer = {
        normalizeMeta,
        parseDuration,
        parseTimestamp,
        analyzeCall,
        generateCoachingNote,
        groupByAgent,
        groupByCustomer,
        keywordGroups // Expose config for potential dynamic use
    };
}

// For Node.js environment (optional, if you intend to use it there too)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        normalizeMeta,
        parseDuration,
        parseTimestamp,
        analyzeCall,
        generateCoachingNote,
        groupByAgent,
        groupByCustomer,
        keywordGroups
    };
} 