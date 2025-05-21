// js/reportComposer.js - Logic for generating repeat caller report content

// Placeholder for themeMap, will be populated or passed as needed
// const themeMap = { /* ... */ }; 

function generateCoachingSummary(enrichedRepeatCallersArray, allCallsForContext) {
    if (!enrichedRepeatCallersArray || enrichedRepeatCallersArray.length === 0) {
        return "<p>No repeat caller data available to generate a coaching summary.</p>";
    }

    let summaryHtml = "<h3>Coaching Summary & Root Cause Analysis:</h3>";
    summaryHtml += "<p>Analysis of customers with multiple interactions, highlighting patterns and potential coaching opportunities.</p>";

    const totalRepeatCustomers = enrichedRepeatCallersArray.length;
    summaryHtml += `<p><strong>Total Repeat Customers Analyzed:</strong> ${totalRepeatCustomers}</p>`;

    let totalRiskScoreSum = 0;
    const allIdentifiedPatternsCount = {}; // This will now count tags from patternTag
    let highRiskCustomerCount = 0;

    summaryHtml += "<h4>Individual Repeat Customer Details:</h4>";
    summaryHtml += "<div style=\"max-height: 300px; overflow-y: auto; border: 1px solid #333; padding: 10px; margin-bottom:15px; background: #222; border-radius: 4px;\"><ul style=\"list-style-type: none; padding-left: 0;\">";

    enrichedRepeatCallersArray.forEach(customerData => {
        const customerId = customerData.phoneNumber;
        
        // Create a detail object for risk score calculation if it needs specific structure
        const customerDetailsForRiskScore = {
            calls: customerData.allCallDetails,
        };
        const riskScore = calculateRiskScore(customerDetailsForRiskScore);
        totalRiskScoreSum += riskScore;
        if (riskScore > 40) highRiskCustomerCount++;

        // Use the pre-calculated patternTag from enrichedRepeatCallersArray
        const patternTags = customerData.patternTag && customerData.patternTag !== '-' 
                            ? customerData.patternTag.split(', ').map(tag => tag.trim()) 
                            : ["No specific patterns identified."];
        
        patternTags.forEach(tag => {
            if (tag !== "No specific patterns identified.") {
                allIdentifiedPatternsCount[tag] = (allIdentifiedPatternsCount[tag] || 0) + 1;
            }
        });
        
        const firstCallDateStr = customerData.firstCallDate || "N/A";
        const lastCallDateStr = customerData.lastCallDate || "N/A";
        const callSpanDaysDisplay = customerData.spanDays || "0 day(s)";
        const agentTrailDisplay = customerData.agentTrail || 'N/A';
        const topThemesDisplay = customerData.topThemes || 'N/A';

        summaryHtml += `<li style=\"margin-bottom: 10px; padding: 8px; background: #2a2a2a; border-radius: 3px;\">
            <strong>Customer:</strong> ${customerId.includes('@') ? customerId : customerId.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')} <br>
            <strong>Repeat Calls:</strong> ${customerData.callCount} (Span: ${callSpanDaysDisplay}, From: ${firstCallDateStr} to ${lastCallDateStr})<br>
            <strong>Agent Trail:</strong> ${agentTrailDisplay}<br>
            <strong>Top Themes in Repeats:</strong> ${topThemesDisplay}<br>
            <strong>Detected Patterns:</strong> ${patternTags.join(", ")}<br>
            <strong>Risk Score:</strong> <span style=\"color: ${riskScore > 40 ? '#ff4d4d' : (riskScore > 20 ? '#ffc107' : '#4caf50')}; font-weight: bold;\">${riskScore}</span>
        </li>`;
    });

    summaryHtml += "</ul></div>";

    summaryHtml += "<h4>Overall Repeat Call Statistics:</h4>";
    const averageRiskScore = totalRepeatCustomers > 0 ? (totalRiskScoreSum / totalRepeatCustomers).toFixed(1) : "N/A";
    summaryHtml += `<p><strong>Average Risk Score:</strong> ${averageRiskScore}</p>`;
    summaryHtml += `<p><strong>Customers with High Risk Score (>40):</strong> ${highRiskCustomerCount} (${totalRepeatCustomers > 0 ? (highRiskCustomerCount/totalRepeatCustomers*100).toFixed(1) : 0}%)</p>`;

    summaryHtml += "<strong>Most Common Repeat Patterns:</strong>";
    const sortedPatterns = Object.entries(allIdentifiedPatternsCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (sortedPatterns.length > 0) {
        summaryHtml += "<ul style=\"list-style-type: disc; padding-left: 20px;\">";
        sortedPatterns.forEach(([pattern, count]) => {
            summaryHtml += `<li>${pattern}: ${count} occurrence(s)</li>`;
        });
        summaryHtml += "</ul>";
    } else {
        summaryHtml += " No specific patterns identified across multiple customers.<br>";
    }
    
    summaryHtml += "<p style=\"font-size: 0.9em; color: #aaa; margin-top: 15px;\"><em>Note: Risk scores and patterns are indicative and based on available data. Review individual call details for full context.</em></p>";

    return summaryHtml;
}

function calculateRiskScore(customerDetails) { // Expects customerDetails.calls
    let score = 0;
    if (customerDetails && customerDetails.calls && customerDetails.calls.length > 1) {
        score += (customerDetails.calls.length -1) * 15; 

        const negativeFlags = ["Issue unresolved", "Customer frustrated", "Agent error", "Complaint", "Supervisor request"];
        customerDetails.calls.forEach(call => {
            (call.flags || []).forEach(flag => {
                if (negativeFlags.some(nf => flag.toLowerCase().includes(nf.toLowerCase()))) {
                    score += 5; 
                }
            });
        });
        
        if (customerDetails.calls.some(call => (call.flags || []).includes("Issue unresolved"))) {
            score += 10;
        }
        if (customerDetails.calls.some(call => (call.flags || []).some(f => f.toLowerCase().includes("escalat")))) {
            score += 5;
        }
    }
    return Math.min(score, 100); 
}

// Note: Functions are globally accessible when <script> tag is used.
// No explicit window.ReportComposer assignment is strictly needed for this setup. 