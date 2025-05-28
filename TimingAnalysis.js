/**
 * Transcript Timing Analysis Utility
 * 
 * This utility provides functions for analyzing timestamps in transcripts,
 * measuring durations, detecting silences, and identifying speech patterns.
 * 
 * Format: UMD-safe, compatible with file:// protocol
 */

(function(global) {
  /**
   * The main TimingAnalysis utility object
   */
  const TimingAnalysis = {
    /**
     * Parses timestamps from transcript text
     * @param {string} text - The transcript text to analyze
     * @returns {Array} Array of extracted timestamp objects with positions and contexts
     */
    parseTimestamps(text) {
      if (!text || typeof text !== 'string') return [];
      
      // Common time formats in transcripts
      const timePatterns = [
        // HH:MM:SS format
        {
          regex: /(\d{1,2}):(\d{2}):(\d{2})/g,
          converter: (match) => {
            const parts = match[0].split(':').map(Number);
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
          },
          format: 'hh:mm:ss'
        },
        // MM:SS format
        {
          regex: /(\d{1,2}):(\d{2}(?:\.\d+)?)/g,
          converter: (match) => {
            const parts = match[0].split(':').map(Number);
            return parts[0] * 60 + parts[1];
          },
          format: 'mm:ss'
        },
        // Seconds with decimal (e.g. 12.5s)
        {
          regex: /(\d+\.\d+)s/g,
          converter: (match) => parseFloat(match[1]),
          format: 'seconds'
        },
        // Bracketed timestamps [00:00]
        {
          regex: /\[(\d{1,2}):(\d{2}(?::\d{2})?)\]/g,
          converter: (match) => {
            const timeStr = match[1] + ':' + match[2];
            const parts = timeStr.split(':').map(Number);
            return parts.length === 3 
              ? parts[0] * 3600 + parts[1] * 60 + parts[2]
              : parts[0] * 60 + parts[1];
          },
          format: 'bracketed'
        }
      ];
      
      let allMatches = [];
      let lineIndex = 0;
      const lines = text.split('\n');
      
      // Process line by line to maintain line context
      lines.forEach((line, i) => {
        const lineStart = text.indexOf(line, lineIndex);
        lineIndex = lineStart + line.length;
        
        // Skip empty lines
        if (!line.trim()) return;
        
        timePatterns.forEach(pattern => {
          const matches = [...line.matchAll(pattern.regex)];
          if (matches.length > 0) {
            matches.forEach(match => {
              // Extract speaker if possible - look for common patterns
              const beforeText = line.substring(0, match.index).trim();
              const speakerMatch = beforeText.match(/(Agent|Customer|Speaker\s\d+|[\w\s]+):/i);
              const speaker = speakerMatch ? speakerMatch[1].trim() : null;
              
              // Extract the text content after the timestamp
              const afterText = line.substring(match.index + match[0].length).trim();
              
              allMatches.push({
                match: match[0],
                seconds: pattern.converter(match),
                format: pattern.format,
                index: lineStart + match.index,
                line: i + 1,
                lineText: line.trim(),
                context: text.substr(Math.max(0, lineStart + match.index - 20), 60),
                speaker: speaker,
                content: afterText
              });
            });
          }
        });
      });
      
      // Sort by seconds (chronological order)
      allMatches.sort((a, b) => a.seconds - b.seconds);
      
      return allMatches;
    },
    
    /**
     * Analyzes timings in a transcript to identify patterns and metrics
     * @param {string} text - The transcript text to analyze
     * @returns {Object} Timing analysis results
     */
    analyzeTranscript(text) {
      const timestamps = this.parseTimestamps(text);
      
      if (timestamps.length === 0) {
        return {
          hasTimestamps: false,
          message: "No recognizable timestamps found in the transcript"
        };
      }
      
      // Extract speakers and organize by speaker
      const speakerSegments = {};
      let previousSpeaker = null;
      let previousTimestamp = null;
      
      // Process timestamps to identify speaker segments and transitions
      const speakerTransitions = [];
      const pauseThresholdSeconds = 3; // Threshold for significant pauses
      const silences = [];
      
      timestamps.forEach((timestamp, i) => {
        // Skip first timestamp for transitions
        if (i > 0) {
          const timeDiff = timestamp.seconds - timestamps[i-1].seconds;
          
          // Check for silence/pause
          if (timeDiff >= pauseThresholdSeconds) {
            silences.push({
              start: timestamps[i-1],
              end: timestamp,
              duration: timeDiff,
              startTime: timestamps[i-1].seconds,
              endTime: timestamp.seconds
            });
          }
          
          // Check for speaker transition
          if (timestamp.speaker && timestamps[i-1].speaker && 
              timestamp.speaker !== timestamps[i-1].speaker) {
            speakerTransitions.push({
              from: timestamps[i-1].speaker,
              to: timestamp.speaker,
              fromTime: timestamps[i-1].seconds,
              toTime: timestamp.seconds,
              transitionTime: timeDiff
            });
          }
        }
        
        // Group by speaker
        if (timestamp.speaker) {
          if (!speakerSegments[timestamp.speaker]) {
            speakerSegments[timestamp.speaker] = [];
          }
          speakerSegments[timestamp.speaker].push(timestamp);
        }
      });
      
      // Calculate metrics
      const totalDuration = timestamps.length > 1 
        ? timestamps[timestamps.length - 1].seconds - timestamps[0].seconds 
        : 0;
      
      // Calculate speaker participation
      const speakerStats = {};
      Object.keys(speakerSegments).forEach(speaker => {
        const segments = speakerSegments[speaker];
        speakerStats[speaker] = {
          count: segments.length,
          percentage: Math.round((segments.length / timestamps.length) * 100)
        };
      });
      
      // Calculate response time stats
      let responseTimeSum = 0;
      let responseTimeCount = 0;
      let maxResponseTime = 0;
      let maxResponsePair = null;
      
      speakerTransitions.forEach(transition => {
        responseTimeSum += transition.transitionTime;
        responseTimeCount++;
        
        if (transition.transitionTime > maxResponseTime) {
          maxResponseTime = transition.transitionTime;
          maxResponsePair = transition;
        }
      });
      
      const avgResponseTime = responseTimeCount > 0 
        ? responseTimeSum / responseTimeCount 
        : 0;
      
      // Sort silences by duration (longest first)
      silences.sort((a, b) => b.duration - a.duration);
      
      return {
        hasTimestamps: true,
        totalTimestamps: timestamps.length,
        density: totalDuration > 0 ? (timestamps.length / totalDuration).toFixed(2) : 0,
        totalDuration: totalDuration,
        firstTimestamp: timestamps[0],
        lastTimestamp: timestamps[timestamps.length - 1],
        speakers: Object.keys(speakerSegments),
        speakerStats: speakerStats,
        speakerTransitions: speakerTransitions,
        responseTimeStats: {
          average: avgResponseTime.toFixed(2),
          max: maxResponseTime.toFixed(2),
          maxPair: maxResponsePair
        },
        silences: silences,
        allTimestamps: timestamps
      };
    },
    
    /**
     * Formats seconds into readable time format
     * @param {number} seconds - The time in seconds
     * @returns {string} Formatted time string
     */
    formatTime(seconds) {
      if (isNaN(seconds)) return '--:--';
      
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      
      return (hrs > 0 ? 
        `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}` : 
        `${mins}:${secs.toString().padStart(2, '0')}`);
    },
    
    /**
     * Generates HTML for timing analysis results
     * @param {Object} analysis - The timing analysis results
     * @returns {string} HTML representation of the analysis
     */
    generateAnalysisHTML(analysis) {
      if (!analysis.hasTimestamps) {
        return `<div class="timing-report">
          <p>${analysis.message}</p>
        </div>`;
      }
      
      // Format duration
      const formattedDuration = this.formatTime(analysis.totalDuration);
      
      // Generate speakers section
      let speakersHTML = '';
      if (analysis.speakers && analysis.speakers.length > 0) {
        speakersHTML = `
          <div class="timing-section">
            <h3>Speaker Analysis</h3>
            <div class="speaker-stats">
              ${analysis.speakers.map(speaker => `
                <div class="speaker-stat">
                  <div class="speaker-name">${speaker}</div>
                  <div class="speaker-percentage">
                    <div class="percentage-bar" style="width: ${analysis.speakerStats[speaker].percentage}%"></div>
                    <span>${analysis.speakerStats[speaker].percentage}%</span>
                  </div>
                  <div class="speaker-count">${analysis.speakerStats[speaker].count} timestamps</div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
      
      // Generate silences section
      let silencesHTML = '';
      if (analysis.silences && analysis.silences.length > 0) {
        const topSilences = analysis.silences.slice(0, 5); // Show top 5 silences
        silencesHTML = `
          <div class="timing-section">
            <h3>Notable Silences/Pauses</h3>
            <table class="timing-table">
              <thead>
                <tr>
                  <th>Duration</th>
                  <th>Time</th>
                  <th>Context</th>
                </tr>
              </thead>
              <tbody>
                ${topSilences.map(silence => `
                  <tr>
                    <td>${silence.duration.toFixed(1)}s</td>
                    <td>${this.formatTime(silence.startTime)} - ${this.formatTime(silence.endTime)}</td>
                    <td>${silence.start.lineText.substring(0, 60)}${silence.start.lineText.length > 60 ? '...' : ''}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }
      
      // Generate response times section
      let responseTimesHTML = '';
      if (analysis.speakerTransitions && analysis.speakerTransitions.length > 0) {
        responseTimesHTML = `
          <div class="timing-section">
            <h3>Response Times</h3>
            <div class="response-stats">
              <div class="response-stat">
                <span>Average Response Time:</span>
                <strong>${analysis.responseTimeStats.average}s</strong>
              </div>
              <div class="response-stat">
                <span>Longest Response Time:</span>
                <strong>${analysis.responseTimeStats.max}s</strong>
                ${analysis.responseTimeStats.maxPair ? 
                  `<div class="response-detail">From: ${analysis.responseTimeStats.maxPair.from} To: ${analysis.responseTimeStats.maxPair.to}</div>` : ''}
              </div>
            </div>
          </div>
        `;
      }
      
      return `
        <div class="timing-report">
          <div class="timing-summary">
            <div class="summary-stat">
              <div class="stat-label">Total Duration</div>
              <div class="stat-value">${formattedDuration}</div>
            </div>
            <div class="summary-stat">
              <div class="stat-label">Timestamps</div>
              <div class="stat-value">${analysis.totalTimestamps}</div>
            </div>
            <div class="summary-stat">
              <div class="stat-label">Density</div>
              <div class="stat-value">${analysis.density} per sec</div>
            </div>
            ${analysis.speakers && analysis.speakers.length > 0 ? `
              <div class="summary-stat">
                <div class="stat-label">Speakers</div>
                <div class="stat-value">${analysis.speakers.length}</div>
              </div>
            ` : ''}
          </div>
          
          ${speakersHTML}
          ${responseTimesHTML}
          ${silencesHTML}
          
          <div class="timing-section">
            <h3>Timeline</h3>
            <div class="timestamp-timeline">
              ${analysis.allTimestamps.slice(0, 50).map((timestamp, i) => `
                <div class="timeline-entry ${timestamp.speaker ? 'has-speaker' : ''}" style="left: ${(timestamp.seconds / analysis.totalDuration * 100).toFixed(2)}%">
                  <div class="timeline-dot ${timestamp.speaker ? `speaker-${analysis.speakers.indexOf(timestamp.speaker) % 5}` : ''}"></div>
                  <div class="timeline-tooltip">
                    <div class="tooltip-time">${this.formatTime(timestamp.seconds)}</div>
                    ${timestamp.speaker ? `<div class="tooltip-speaker">${timestamp.speaker}</div>` : ''}
                    <div class="tooltip-text">${timestamp.content || timestamp.lineText}</div>
                  </div>
                </div>
              `).join('')}
              ${analysis.allTimestamps.length > 50 ? `<div class="timeline-more">+${analysis.allTimestamps.length - 50} more timestamps</div>` : ''}
            </div>
          </div>
        </div>
      `;
    }
  };
  
  // Export the utility to the global scope
  global.TimingAnalysis = TimingAnalysis;
})(window); 