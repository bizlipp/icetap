/**
 * AI Feature Integration for ICETAP
 * Provides connections between AI features and MasterLog functionality
 */

(function(global) {
  // Ensure dependencies are available
  if (!global.MasterLogUtil) {
    console.error("MasterLogUtil not found. AI Integration cannot initialize.");
    return;
  }

  const AIIntegration = {
    /**
     * Enriches calls with AI features and updates MasterLog
     * @param {Array} calls - Array of call records to process
     * @returns {Promise<Array>} - Processed calls with AI features
     */
    async processCallsWithAI(calls) {
      if (!calls || !Array.isArray(calls) || calls.length === 0) {
        console.warn("No calls to process with AI");
        return calls;
      }

      try {
        console.log(`🧠 Processing ${calls.length} calls with AI features...`);
        
        // Step 1: Process with available AI features
        if (global.CallAnalyzer) {
          // Mark repeat calls if available
          if (typeof global.CallAnalyzer.markRepeatCalls === 'function') {
            global.CallAnalyzer.markRepeatCalls(calls);
            console.log("✅ Applied repeat call detection");
          }
          
          // Apply timing analysis to calls with transcripts
          if (typeof global.CallAnalyzer.analyzeTranscriptGaps === 'function') {
            let analyzedCount = 0;
            calls.forEach(call => {
              if (call.transcript && call.transcript.length > 0) {
                global.CallAnalyzer.analyzeTranscriptGaps(call);
                analyzedCount++;
              }
            });
            console.log(`✅ Applied timing analysis to ${analyzedCount} calls with transcripts`);
          }
          
          // Extract phrase data for log
          if (typeof global.CallAnalyzer.extractFrequentPhrasesBySpeaker === 'function') {
            const callsWithTranscripts = calls.filter(call => call.transcript && call.transcript.length > 0);
            if (callsWithTranscripts.length > 0) {
              const phraseData = global.CallAnalyzer.extractFrequentPhrasesBySpeaker(callsWithTranscripts);
              // Store overall phrase data at the master log level
              if (global.DataStackULTRA && typeof global.DataStackULTRA.set === 'function') {
                await global.DataStackULTRA.set('masterPhraseData', phraseData);
                console.log("✅ Stored master phrase data in DataStackULTRA");
              }
            }
          }
        }
        
        // Step 2: Update Master Log with enhanced calls
        if (global.MasterLogUtil && typeof global.MasterLogUtil.updateMasterLog === 'function') {
          // Get current master log
          let masterLog = [];
          if (global.DataStackULTRA && typeof global.DataStackULTRA.get === 'function') {
            masterLog = await global.DataStackULTRA.get('masterLogCache', []);
          }
          
          // Update master log with new AI-enhanced calls
          const updatedMasterLog = await global.MasterLogUtil.updateMasterLog(calls);
          console.log(`✅ Updated master log with ${calls.length} AI-enhanced calls. Master log now has ${updatedMasterLog.length} entries.`);
        }
        
        // Step 3: Enrich calls with master log data
        if (global.MasterLogUtil && typeof global.MasterLogUtil.enrichAndUpdateCalls === 'function') {
          // Get current master log
          let masterLog = [];
          if (global.DataStackULTRA && typeof global.DataStackULTRA.get === 'function') {
            masterLog = await global.DataStackULTRA.get('masterLogCache', []);
          }
          
          // Enrich calls with master log data
          if (masterLog.length > 0) {
            const enrichedCalls = await global.MasterLogUtil.enrichAndUpdateCalls(calls, masterLog);
            console.log(`✅ Enriched ${enrichedCalls.length} calls with master log data`);
            return enrichedCalls;
          }
        }
        
        return calls;
      } catch (error) {
        console.error("Error in AI Integration:", error);
        return calls; // Return original calls on error
      }
    },
    
    /**
     * Get master log-enriched repeat call metrics
     * @returns {Promise<Object>} Object with repeat call metrics
     */
    async getRepeatCallMetrics() {
      try {
        // Get current calls and master log
        let currentCalls = [];
        let masterLog = [];
        
        if (global.DataStackULTRA && typeof global.DataStackULTRA.get === 'function') {
          currentCalls = await global.DataStackULTRA.get('loadedCalls', []);
          masterLog = await global.DataStackULTRA.get('masterLogCache', []);
        }
        
        if (!currentCalls.length && !masterLog.length) {
          return { repeatRate: 0, repeatCount: 0, totalCalls: 0 };
        }
        
        // Use either current calls or master log (prefer master log if available)
        const dataSource = masterLog.length > 0 ? masterLog : currentCalls;
        
        // Count repeat calls
        const repeatCalls = dataSource.filter(call => call.repeat === true);
        const repeatRate = dataSource.length > 0 ? (repeatCalls.length / dataSource.length) * 100 : 0;
        
        return {
          repeatRate: repeatRate,
          repeatCount: repeatCalls.length,
          totalCalls: dataSource.length,
          // Add additional metrics if needed
          repeatCallsLast7Days: repeatCalls.filter(call => {
            const callDate = new Date(call.meta?.["Initiation timestamp"]);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return callDate >= weekAgo;
          }).length
        };
      } catch (error) {
        console.error("Error getting repeat call metrics:", error);
        return { repeatRate: 0, repeatCount: 0, totalCalls: 0 };
      }
    }
  };
  
  // Make available globally
  global.AIIntegration = AIIntegration;
  
  // Auto-initialize and connect
  document.addEventListener('DOMContentLoaded', async () => {
    // If calls are already loaded, process them with AI features
    if (global.DataStackULTRA && typeof global.DataStackULTRA.get === 'function') {
      try {
        const loadedCalls = await global.DataStackULTRA.get('loadedCalls', []);
        if (loadedCalls && loadedCalls.length > 0) {
          console.log(`🧠 AI Integration found ${loadedCalls.length} calls, processing with AI features...`);
          await AIIntegration.processCallsWithAI(loadedCalls);
        }
      } catch (error) {
        console.error("Error during AI Integration auto-initialization:", error);
      }
    }
  });
  
})(window); 