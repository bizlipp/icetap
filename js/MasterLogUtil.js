/**
 * ICETAP Master Log Merge Utility
 * This script can be shared and called across dashboards to handle 
 * smart field updates between current call sessions and a long-term master audit log.
 * Format: UMD-safe, file:// compatible
 */

(function(global) {
  const MasterLogUtil = {
    /**
     * Merges metadata from the master log into current session entries
     * @param {Array} sessionData - Array of current ICETAP calls (parsed from drop)
     * @param {Array} masterData - Array of historical call records (loaded from master CSV/JSON)
     * @returns {Array} sessionData with additional merged fields if Contact ID matches
     */
    mergeMasterLog(sessionData, masterData) {
      const masterIndex = {};
      masterData.forEach(entry => {
        const id = entry["Contact ID"] || entry.contactId;
        if (id) masterIndex[id] = entry;
      });

      return sessionData.map(call => {
        const id = call["Contact ID"] || call.meta?.["Contact ID"];
        if (!id || !masterIndex[id]) return call;

        const master = masterIndex[id];
        const merged = { ...call };

        // Preserve all existing fields in call, merge only empty fields
        const fieldsToPreserve = [
          "Contact ID", "Channel", "Contact status", "Initiation timestamp",
          "System phone number / email address", "Queue", "Agent",
          "Recording/Transcript", "Customer phone number / email address",
          "Disconnect timestamp", "Contact duration", "Agent name",
          "Agent first name", "Agent last name", "Routing profile",
          "Connected to agent timestamp", "ACW start timestamp",
          "ACW end timestamp", "Agent interaction duration",
          "Agent connection attempts", "Number of holds",
          "Is transferred out", "Initiation method", "Disconnect reason",
          "First contact flow name", "First contact flow ID", "Enqueue timestamp",
          "Fraud detection result", "Categories", "Transcript", "Issue",
          "Outcome", "Summary", "positiveScore"
        ];

        fieldsToPreserve.forEach(field => {
          const current = call[field] || call.meta?.[field];
          const historical = master[field];
          if ((current === undefined || current === null || current === "") && historical !== undefined) {
            if (merged.meta) merged.meta[field] = historical;
            else merged[field] = historical;
          }
        });

        // Attach history summary snapshot for visual reference (not persistent)
        merged.historySummary = {
          repeatCount: master.repeatCount || 0,
          flaggedThemes: master.flaggedThemes || [],
          recentOutcomes: master.recentOutcomes || [],
          tags: master.tags || []
        };

        return merged;
      });
    }
  };

  global.MasterLogUtil = MasterLogUtil;
})(window);
