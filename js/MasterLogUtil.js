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
    },

    /**
     * Enriches new calls with master log data and updates DataStackULTRA
     * @param {Array} newCalls - Array of newly added call records
     * @param {Array} masterData - Array of historical master log records
     * @returns {Promise<Array>} Promise resolving to enriched call data
     */
    async enrichAndUpdateCalls(newCalls, masterData) {
      if (!newCalls || !newCalls.length || !masterData || !masterData.length) {
        return newCalls;
      }
      
      // Merge master log data with new calls
      const enrichedCalls = this.mergeMasterLog(newCalls, masterData);
      
      // Get existing calls from DataStackULTRA
      let existingCalls = [];
      if (window.DataStackULTRA && typeof window.DataStackULTRA.get === 'function') {
        try {
          existingCalls = await window.DataStackULTRA.get('loadedCalls', []);
        } catch (err) {
          console.error("Error getting existing calls from DataStackULTRA:", err);
        }
      }
      
      // Combine existing calls with enriched new calls
      const allCalls = [...existingCalls, ...enrichedCalls];
      
      // Update DataStackULTRA with combined calls
      if (window.DataStackULTRA && typeof window.DataStackULTRA.set === 'function') {
        try {
          await window.DataStackULTRA.set('loadedCalls', allCalls);
          console.log(`✅ Updated DataStackULTRA with ${enrichedCalls.length} new enriched calls. Total: ${allCalls.length}`);
        } catch (err) {
          console.error("Error updating DataStackULTRA with enriched calls:", err);
        }
      }
      
      return enrichedCalls;
    },
    
    /**
     * Updates master log with new call data
     * @param {Array} newCalls - Array of new calls to add to master log
     * @returns {Promise<Array>} Promise resolving to updated master log
     */
    async updateMasterLog(newCalls) {
      if (!newCalls || !newCalls.length) {
        return [];
      }
      
      // Get existing master log from DataStackULTRA
      let masterLog = [];
      if (window.DataStackULTRA && typeof window.DataStackULTRA.get === 'function') {
        try {
          masterLog = await window.DataStackULTRA.get('masterLogCache', []);
        } catch (err) {
          console.error("Error getting master log from DataStackULTRA:", err);
        }
      }
      
      // Create a map of existing entries by contact ID
      const masterMap = new Map();
      masterLog.forEach(entry => {
        const id = entry["Contact ID"] || entry.contactId || (entry.meta && entry.meta["Contact ID"]);
        if (id) masterMap.set(id, entry);
      });
      
      // Update or add new entries
      newCalls.forEach(call => {
        const id = call["Contact ID"] || (call.meta && call.meta["Contact ID"]);
        if (!id) return;
        
        // If entry already exists, update it
        if (masterMap.has(id)) {
          const existing = masterMap.get(id);
          // Merge properties, prioritizing non-empty values from the new call
          Object.keys(call).forEach(key => {
            const value = call[key];
            if (value !== undefined && value !== null && value !== "") {
              existing[key] = value;
            }
          });
          // Update metadata fields specifically
          if (call.meta && existing.meta) {
            Object.keys(call.meta).forEach(key => {
              const value = call.meta[key];
              if (value !== undefined && value !== null && value !== "") {
                existing.meta[key] = value;
              }
            });
          }
        } else {
          // Add new entry to master log
          masterMap.set(id, { ...call });
        }
      });
      
      // Convert map back to array
      const updatedMasterLog = Array.from(masterMap.values());
      
      // Update DataStackULTRA with updated master log
      if (window.DataStackULTRA && typeof window.DataStackULTRA.set === 'function') {
        try {
          await window.DataStackULTRA.set('masterLogCache', updatedMasterLog);
          console.log(`✅ Updated master log in DataStackULTRA. Total entries: ${updatedMasterLog.length}`);
        } catch (err) {
          console.error("Error updating master log in DataStackULTRA:", err);
        }
      }
      
      return updatedMasterLog;
    }
  };

  global.MasterLogUtil = MasterLogUtil;
})(window);
