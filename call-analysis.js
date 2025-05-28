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
    if (!callObject) return null;
    const meta = callObject.meta || {};
    
    // Normalize customerId first for consistent use across all functions
    if (!callObject.customerId) {
        callObject.customerId = meta["Customer phone number / email address"]?.trim() || null;
    }
    
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
        customerId: callObject.customerId || meta["Customer phone number / email address"] || meta.customerIdentifier || meta.customerId || "Unknown",
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
    if (!callObject) return null;
    
    const finalOptions = { ...defaultAnalysisOptions, ...options };
    const meta = callObject.meta || {};
    
    // Ensure customerId is set
    callObject.customerId = callObject.customerId || meta["Customer phone number / email address"]?.trim() || null;
    
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
        // Always use customerId first, with fallback options
        const customerId = call.customerId || (call.meta && call.meta["Customer phone number / email address"]) || "Unknown Customer";
        if (!acc[customerId]) acc[customerId] = [];
        acc[customerId].push(call);
        return acc;
    }, {});
}

/**
 * Marks calls from the same customer within a specified time window as repeat calls
 * @param {Array<object>} calls - Array of call objects to process
 * @param {number} windowHours - Number of hours to consider for repeat detection (default: 72)
 * @returns {Array<object>} - The processed calls with repeat flags
 */
function markRepeatCalls(calls, windowHours = 72) {
    if (!Array.isArray(calls) || calls.length === 0) return calls;
    
    // First ensure all calls have customerId set
    calls.forEach(call => {
        if (!call.customerId && call.meta) {
            call.customerId = call.meta["Customer phone number / email address"]?.trim() || null;
        }
    });
    
    const grouped = groupByCustomer(calls);

    for (const callsList of Object.values(grouped)) {
        // Only process groups with more than one call
        if (callsList.length <= 1) continue;
        
        const sorted = callsList
            .filter(c => c.startTime || (c.meta && c.meta["Initiation timestamp"]))
            .sort((a, b) => {
                const aTime = a.startTime ? new Date(a.startTime) : new Date(a.meta["Initiation timestamp"]);
                const bTime = b.startTime ? new Date(b.startTime) : new Date(b.meta["Initiation timestamp"]);
                return aTime - bTime;
            });

        for (let i = 1; i < sorted.length; i++) {
            const prevTime = sorted[i - 1].startTime 
                ? new Date(sorted[i - 1].startTime) 
                : new Date(sorted[i - 1].meta["Initiation timestamp"]);
            
            const currTime = sorted[i].startTime 
                ? new Date(sorted[i].startTime) 
                : new Date(sorted[i].meta["Initiation timestamp"]);
            
            const delta = (currTime - prevTime) / (1000 * 60 * 60);
            if (delta <= windowHours) {
                sorted[i - 1].repeat = true;
                sorted[i].repeat = true;
            }
        }
    }
    
    return calls;
}

/**
 * Test function to validate customerId integration
 * For development use only - can be removed in production
 */
function testCustomerIdIntegration(calls) {
    console.log("=== Testing Customer ID Integration ===");
    
    // Test 1: Check if customerId field is set on all calls
    const callsWithCustomerId = calls.filter(call => call.customerId);
    console.log(`Test 1: ${callsWithCustomerId.length}/${calls.length} calls have customerId set`);
    
    // Test 2: Test markRepeatCalls functionality
    const originalRepeatCount = calls.filter(call => call.repeat).length;
    const testCalls = JSON.parse(JSON.stringify(calls)); // Deep clone for testing
    
    // Set identical customer ID on the first two calls to force them to be repeats
    if (testCalls.length >= 2) {
        testCalls[0].customerId = "test-customer-1"; 
        testCalls[1].customerId = "test-customer-1";
        
        // Set timestamps 1 hour apart
        const baseTime = new Date();
        testCalls[0].startTime = new Date(baseTime.getTime() - 3600000).toISOString(); // 1 hour ago
        testCalls[1].startTime = baseTime.toISOString(); // now
        
        // Apply markRepeatCalls
        if (typeof markRepeatCalls === 'function') {
            const markedCalls = markRepeatCalls(testCalls);
            console.log(`Test 2: markRepeatCalls function ${markedCalls[0].repeat && markedCalls[1].repeat ? "PASSED ✓" : "FAILED ✗"}`);
            
            // Show which calls were marked
            markedCalls.forEach((call, i) => {
                console.log(`Call ${i+1}: ${call.meta?.["Contact ID"] || 'unknown'} - Customer: ${call.customerId} - Repeat: ${call.repeat ? "YES" : "NO"}`);
            });
        } else {
            console.log("❌ markRepeatCalls function not found");
        }
    } else {
        console.log("Test 2: Skipped - not enough calls for testing markRepeatCalls");
    }
    
    // Test 3: Test groupByCustomer function
    if (typeof groupByCustomer === 'function') {
        const grouped = groupByCustomer(testCalls);
        const customerKeys = Object.keys(grouped);
        console.log(`Test 3: groupByCustomer function returned ${customerKeys.length} unique customers`);
        
        // Show first few customer groups
        customerKeys.slice(0, 3).forEach(key => {
            console.log(`  - Customer "${key}": ${grouped[key].length} calls`);
        });
    } else {
        console.log("❌ groupByCustomer function not found");
    }
    
    // Test 4: AI.summarizeRepeatDrivers 
    console.log("\nTest 4: AI.summarizeRepeatDrivers");
    if (window.AI && typeof window.AI.summarizeRepeatDrivers === 'function') {
        try {
            const summary = window.AI.summarizeRepeatDrivers(testCalls);
            console.log(`Result: ${summary.substring(0, 100)}...`);
        } catch (e) {
            console.error(`Error in summarizeRepeatDrivers: ${e.message}`);
        }
    } else {
        console.log("❌ AI.summarizeRepeatDrivers not found");
    }
    
    return testCalls;
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
        markRepeatCalls,
        keywordGroups, // Expose config for potential dynamic use
        testCustomerIdIntegration
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
        markRepeatCalls,
        keywordGroups,
        testCustomerIdIntegration
    };
} 