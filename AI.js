/**
 * AI.js - Natural Language Summary Helpers for SiteStatus Reports
 * ICETAP Reporting System - AI Summary Layer
 * This module generates human-readable insights based on analyzed call data.
 * Intended to be used client-side with call metadata and analysis already complete.
 */

window.AI = {

    /**
     * Generate the introductory summary for the Site Status Report
     * @param {Array} calls - List of analyzed call objects
     * @returns {string} - Summary paragraph
     */
    generateIntroSummary(calls) {
      if (!Array.isArray(calls) || calls.length === 0) return "No calls were available for audit during this period.";
  
      const dateRange = this._getDateRange(calls);
      const agentSet = new Set(calls.map(c => c.agent || "Unknown"));
  
      return `Between ${dateRange.start} and ${dateRange.end}, a total of ${calls.length} customer interactions were reviewed across ${agentSet.size} agents. This report highlights key coaching opportunities, repeat contact drivers, and positive performance trends observed during audits.`;
    },
  
    /**
     * Highlight a few good calls using positive flags and write a praise summary
     * @param {Array} calls
     * @returns {Object} { examples: [...], summary: "..." }
     */
    generatePositiveCallNarrative(calls) {
      const positiveCalls = calls.filter(c => (c.positiveFlags || []).length > 0);
      const examples = positiveCalls.slice(0, 3).map(call => {
        return `Agent ${call.agent} had a standout interaction with ${call.customerId || 'a customer'}, where the call concluded positively despite ${call.issue || 'an initial concern'}.
        Highlights: ${call.positiveFlags.join(", ") || 'n/a'}.
        Summary: ${call.summary || 'No summary available.'}`;
      });
  
      const summary = positiveCalls.length > 0
        ? `Several agents demonstrated strong rapport, especially in handling sensitive or repeat issues with empathy and resolution. Positive themes included professionalism, clarity, and timely resolution.`
        : `No positively flagged calls were found in this audit batch.`;
  
      return { examples, summary };
    },
  
    /**
     * Analyze repeat contact patterns and suggest common callback drivers
     * @param {Array} calls
     * @returns {string}
     */
    summarizeRepeatDrivers(calls) {
      // Apply markRepeatCalls to ensure repeat status is set
      if (window.CallAnalyzer && typeof window.CallAnalyzer.markRepeatCalls === 'function') {
        window.CallAnalyzer.markRepeatCalls(calls);
      }
      
      // Group by customer ID, using the normalized customerId field first
      const callbackGroups = {};
      for (const call of calls) {
        const cid = call.customerId || call.meta?.["Customer phone number / email address"] || "Unknown";
        if (!cid) continue;
        callbackGroups[cid] = callbackGroups[cid] || [];
        callbackGroups[cid].push(call);
      }
  
      const repeatContacts = Object.values(callbackGroups).filter(group => group.length > 1);
      const issueCount = {};
  
      repeatContacts.forEach(group => {
        group.forEach(call => {
          const issue = (call.issue || 'Unknown').toLowerCase();
          issueCount[issue] = (issueCount[issue] || 0) + 1;
        });
      });
  
      const topDrivers = Object.entries(issueCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => k);
      if (repeatContacts.length === 0) return `No repeat contact patterns were observed during this audit window.`;
  
      return `Several customers contacted multiple times during this period. Common callback drivers included: ${topDrivers.join(", ")}. This suggests a need for improved first-call resolution in these areas.`;
    },
  
    /**
     * Evaluate agent sentiment progression: improved vs. worsened calls
     * @param {Array} calls
     * @returns {Object} { topAgents: [...], strugglingAgents: [...] }
     */
    analyzeAgentSentimentTrajectory(calls) {
      const byAgent = {};
      calls.forEach(call => {
        const agent = call.agent || "Unknown";
        if (!call.transcript || call.transcript.length < 2) return;
        const first = call.transcript[0].text || "";
        const last = call.transcript[call.transcript.length - 1].text || "";
        const score = (last.length - first.length); // simplistic proxy for improvement
        byAgent[agent] = byAgent[agent] || [];
        byAgent[agent].push(score);
      });
  
      const scored = Object.entries(byAgent).map(([agent, scores]) => {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        return { agent, avgChange: avg };
      });
  
      const topAgents = scored.filter(a => a.avgChange > 10).map(a => a.agent);
      const strugglingAgents = scored.filter(a => a.avgChange < -10).map(a => a.agent);
  
      return { topAgents, strugglingAgents };
    },

    /**
     * Generate key focus points for the site report
     * @param {Array} calls
     * @returns {Array} - List of focus points
     */
    generateKeyFocusPoints(calls) {
      const focus = [];
      const flaggedEscalations = calls.filter(c => (c.flags || []).includes("escalation"));
      const repeatCount = calls.filter(c => c.repeat).length;
      const avgDuration = calls.map(c => c.durationMinutes || 0).reduce((a, b) => a + b, 0) / calls.length;
      if (flaggedEscalations.length > 5) focus.push("Escalations increased this week.");
      if (repeatCount > calls.length * 0.2) focus.push("Repeat contact rate is above threshold.");
      if (avgDuration > 8) focus.push("Average duration exceeded 8 minutes.");
      return focus.length ? focus : ["No critical patterns detected."];
    },

    /**
     * Extract escalation watch cases
     * @param {Array} calls
     * @returns {Array} - List of escalation cases
     */
    extractEscalationWatch(calls) {
      return calls.filter(c => (c.flags || []).includes("escalation") && (c.transfers || 0) > 1).slice(0, 3).map(c =>
        `Agent ${c.agent} handled escalation with ${c.customerId || 'a customer'}, issue: ${c.issue || 'N/A'}`
      );
    },

    /**
     * Generate coaching themes based on flag frequency
     * @param {Array} calls
     * @returns {Array} - List of coaching themes
     */
    generateCoachingThemes(calls) {
      const flags = {};
      calls.forEach(call => {
        (call.flags || []).forEach(f => {
          const theme = f.toLowerCase();
          flags[theme] = (flags[theme] || 0) + 1;
        });
      });
      return Object.entries(flags).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([theme]) =>
        `Address coaching around: ${theme}`
      );
    },

    /**
     * Generate missed opportunities analysis
     * @param {Array} calls
     * @returns {Array} - List of missed opportunities
     */
    generateMissedOpportunities(calls) {
      const customerMap = {};
      calls.forEach(call => {
        const id = call.customerId;
        if (!id) return;
        customerMap[id] = customerMap[id] || [];
        customerMap[id].push(call);
      });

      const missed = [];
      for (const cid in customerMap) {
        const group = customerMap[cid];
        const hadPositive = group.some(c => (c.positiveFlags || []).length);
        const hadRepeat = group.length > 1;
        if (hadPositive && hadRepeat) {
          missed.push(`Customer ${cid} recontacted despite a positively flagged call. Root cause may be: ${group[0].issue || 'Unknown'}`);
        }
      }
      return missed.slice(0, 3);
    },

    /**
     * Generate outlook summary statistics
     * @param {Array} calls
     * @returns {Array} - List of summary stats
     */
    generateOutlookSummary(calls) {
      const total = calls.length;
      const repeat = calls.filter(c => c.repeat).length;
      const posCount = calls.filter(c => (c.positiveFlags || []).length > 0).length;
      return [
        `• ${total} calls reviewed`,
        `• ${repeat} were repeat contacts`,
        `• ${posCount} showed strong rapport indicators`
      ];
    },
  
    /** Utility: Get audit date range */
    _getDateRange(calls) {
      const dates = calls.map(c => new Date(c.startTime || c.meta?.["Initiation timestamp"])).filter(Boolean);
      dates.sort((a, b) => a - b);
      return {
        start: dates[0]?.toLocaleDateString() || 'N/A',
        end: dates[dates.length - 1]?.toLocaleDateString() || 'N/A'
      };
    },
    
    /**
     * Extract and count frequent phrases used by each speaker type
     * @param {Array} calls - List of analyzed call objects
     * @param {number} minCount - Minimum count to include a phrase
     * @returns {Object} - Object with customer and agent phrase frequencies
     */
    extractFrequentPhrasesBySpeaker(calls, minCount = 3) {
      const phraseCounts = { customer: {}, agent: {} };

      for (const call of calls) {
        if (!call.transcript) continue;
        for (let i = 0; i < call.transcript.length; i++) {
          const line = call.transcript[i];
          const speaker = line.speaker?.toLowerCase();
          if (!['agent', 'customer'].includes(speaker)) continue;

          const words = line.text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
          for (let j = 0; j < words.length - 1; j++) {
            const bigram = `${words[j]} ${words[j + 1]}`;
            phraseCounts[speaker][bigram] = (phraseCounts[speaker][bigram] || 0) + 1;
          }
        }
      }

      // Filter to phrases used more than minCount times
      const filterPhrases = (obj) =>
        Object.entries(obj)
          .filter(([phrase, count]) => count >= minCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10); // limit top 10

      return {
        customer: filterPhrases(phraseCounts.customer),
        agent: filterPhrases(phraseCounts.agent),
      };
    },
    
    /**
     * Analyze timing gaps in a transcript to find silences and delayed responses
     * @param {Object} call - A call object with transcript
     * @returns {Object} - Statistics about transcript timing gaps
     */
    analyzeTranscriptGaps(call) {
      const parseTime = (t) => {
        if (typeof t === "number") return t;
        const [h, m, s] = t.split(':').map(Number);
        return h * 3600 + m * 60 + s;
      };

      const lines = (call.transcript || []).filter(l => l.start && l.end);
      const result = { deadAirInstances: 0, delayedAgentResponses: 0, longestSilence: 0 };

      for (let i = 1; i < lines.length; i++) {
        const prevEnd = parseTime(lines[i - 1].end);
        const currStart = parseTime(lines[i].start);
        const gap = currStart - prevEnd;

        if (gap > 10) result.deadAirInstances++;
        if (gap > result.longestSilence) result.longestSilence = gap;

        const prevSpeaker = lines[i - 1].speaker?.toLowerCase();
        const currSpeaker = lines[i].speaker?.toLowerCase();

        if (prevSpeaker === 'customer' && currSpeaker === 'agent' && gap > 7) {
          result.delayedAgentResponses++;
        }
      }

      return result;
    }
  };
  