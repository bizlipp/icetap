import { processCallData, getInitialOutlookStats, generateCoachingSummaryText, getThemeDetails, getFormulaWeightsFromUI } from './dataProcessor.js';
import { createAgentScoreChart, createThemeChart, createCallbackChart, setOnAgentChartClick, setOnThemeChartClick, setOnCallbackChartClick } from './chartGenerator.js';
import { displayAgentBadges, displayCoachingSummary, updateOutlookBlock, prependToOutlookBlock, toggleSummaryDisplay, showToast, showSkeleton, hideSkeleton, showAgentDetailModal, closeAgentDetailModal, showThemeDetailModal, closeThemeDetailModal, showCallbackDetailModal, closeCallbackDetailModal } from './uiUpdater.js';
import { initializeAgentFilter, setOnFilterChange, getSelectedAgent } from './filterManager.js';
import { initializeFileUploader } from './fileParser.js';

function copyOutlook() {
  const text = document.getElementById("outlookBlock").innerText;
  navigator.clipboard.writeText(text).then(() => {
    showToast("Copied to clipboard!");
  }).catch(err => {
    console.error('Failed to copy text: ', err);
    showToast("Failed to copy. See console for details.", 5000);
  });
}

function downloadPDF() {
  html2pdf().from(document.body).save('Inspiro_Coaching_Report.pdf');
}

// Assign functions to window object for inline HTML event handlers
window.copyOutlook = copyOutlook;
window.downloadPDF = downloadPDF;
window.toggleSummary = () => toggleSummaryDisplay();
window.closeAgentModal = closeAgentDetailModal;
window.closeThemeModal = closeThemeDetailModal;
window.closeCallbackModal = closeCallbackDetailModal;

let globalProcessedData = {};
let allRawCalls = []; // Store all loaded calls

// Define the data handler for fileParser.js to call
window.platformDataHandler = {
    loadData: function(parsedCalls) {
        console.log('Platform received calls:', parsedCalls);
        allRawCalls = parsedCalls;
        if (allRawCalls.length > 0) {
            // Perform initial processing and rendering
            const currentFormulaWeights = getFormulaWeightsFromUI();
            // Agent filter defaults to 'all' on new data load
            // If agentFilter element exists and has a value, respect it, otherwise default to all
            let initialAgentFilter = 'all';
            const agentFilterElement = document.getElementById('agentFilter');
            if (agentFilterElement && agentFilterElement.value) {
                initialAgentFilter = agentFilterElement.value;
            } else {
                 // If filter doesn't exist or has no value, ensure it's set to 'all' for fresh load
                if(agentFilterElement) agentFilterElement.value = 'all';
            }
            
            globalProcessedData = processCallData(allRawCalls, { agent: initialAgentFilter }, currentFormulaWeights);
            initializeAgentFilter(globalProcessedData); // Initialize/Re-initialize agent filter based on new data
            rerenderDashboard();
            showToast(`${allRawCalls.length} calls loaded and processed successfully!`, 3000);
            hideAllSkeletons(); // Ensure skeletons are hidden after successful load
        } else {
            showToast('No calls were found in the provided data.', 4000);
            // Potentially clear dashboard or show no data message more formally
            initializeSkeletons(); // Show skeletons if no data
        }
    }
};

function initializeSkeletons() {
    showSkeleton('scoreChartSkeleton', 'scoreChart');
    showSkeleton('themeChartSkeleton', 'themeChart');
    showSkeleton('callbackChartSkeleton', 'callbackChart');
    showSkeleton('agentBadgesSkeleton', 'agentBadges');
}

function hideAllSkeletons() {
    hideSkeleton('scoreChartSkeleton', 'scoreChart');
    hideSkeleton('themeChartSkeleton', 'themeChart');
    hideSkeleton('callbackChartSkeleton', 'callbackChart');
    hideSkeleton('agentBadgesSkeleton', 'agentBadges');
}

function handleAgentChartClick(agentName) {
    if (globalProcessedData && globalProcessedData.agents && globalProcessedData.agents[agentName]) {
        showAgentDetailModal(agentName, globalProcessedData.agents[agentName]);
    } else {
        console.warn(`Data for agent ${agentName} not found.`);
        showToast(`Could not retrieve details for agent ${agentName}.`, 3000);
    }
}

function handleThemeChartClick(themeName) {
    if (allRawCalls.length > 0) {
        const themeDetails = getThemeDetails(themeName, allRawCalls, globalProcessedData.agents);
        showThemeDetailModal(themeName, themeDetails);
    } else {
        showToast("No raw call data available to show theme details.", 3000);
    }
}

function handleCallbackChartClick(customerIdentifier) {
    if (globalProcessedData && globalProcessedData.callbacks && globalProcessedData.callbacks[customerIdentifier] && allRawCalls.length > 0) {
        showCallbackDetailModal(customerIdentifier, globalProcessedData.callbacks[customerIdentifier], allRawCalls);
    } else {
        console.warn(`Callback data for customer ${customerIdentifier} not found or raw call data missing.`);
        showToast(`Could not retrieve details for customer ${customerIdentifier}.`, 3000);
    }
}

function loadAndProcessData(calls, filters = {}, formulaWeights) {
    allRawCalls = calls; // Store/update the master list of calls
    globalProcessedData = processCallData(allRawCalls, filters, formulaWeights);
    // Only re-initialize agent filter if it's an actual data load, not just formula change
    // For formula changes, agents list doesn't change, just their scores.
    if(filters.agent === 'all' && calls === allRawCalls) { // Check if it is a full data reload scenario
        initializeAgentFilter(globalProcessedData);
    }
    rerenderDashboard();
}

document.addEventListener("DOMContentLoaded", function () {
  initializeSkeletons();
  initializeFileUploader();
  setOnAgentChartClick(handleAgentChartClick);
  setOnThemeChartClick(handleThemeChartClick);
  setOnCallbackChartClick(handleCallbackChartClick);
  
  setOnFilterChange((filters) => {
    const weights = getFormulaWeightsFromUI();
    globalProcessedData = processCallData(allRawCalls, filters, weights);
    rerenderDashboard(); // Filter change doesn't re-init agent list, but re-renders with new data scope
  });

  const applyFormulaBtn = document.getElementById('applyFormulaBtn');
  if (applyFormulaBtn) {
    applyFormulaBtn.addEventListener('click', () => {
        const weights = getFormulaWeightsFromUI();
        const currentFilters = { agent: getSelectedAgent() };
        // For formula change, we re-process allRawCalls with current filters and NEW weights
        globalProcessedData = processCallData(allRawCalls, currentFilters, weights);
        // Agent list for filter dropdown does not change, so no need to re-initialize it explicitly here.
        rerenderDashboard();
        showToast("Formula weights applied!", 2000);
    });
  }

  const exportJsonBtn = document.getElementById('exportJsonBtn');
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
        if (allRawCalls.length > 0) {
            const jsonDataStr = JSON.stringify(allRawCalls, null, 2);
            const blob = new Blob([jsonDataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'inspiro_processed_calls.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('Raw data exported as JSON!', 2000);
        } else {
            showToast('No data to export.', 3000);
        }
    });
  }

  const exportCsvBtn = document.getElementById('exportCsvBtn');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
        if (allRawCalls.length > 0) {
            try {
                // Basic CSV conversion: assumes flat objects or specific fields
                // For complex/nested data, a more robust mapping would be needed.
                // PapaParse.unparse can take an array of objects.
                // We need to decide what fields go into the CSV.
                // For simplicity, let's use globalProcessedData.calls if available and flattened,
                // or make a simplified version of allRawCalls.

                // Example: Exporting a summary of calls with key metadata
                const callsForCsv = allRawCalls.map(call => ({
                    contact_id: call.meta?.["Contact ID"],
                    agent_name: call.meta?.["Agent name"],
                    initiation_timestamp: call.meta?.["Initiation timestamp"],
                    contact_duration: call.meta?.["Contact duration"],
                    customer_phone: call.meta?.["Customer phone number / email address"],
                    flags: call.flags ? call.flags.join('; ') : '',
                    positive_flags: call.positiveFlags ? call.positiveFlags.join('; ') : '',
                    // Add other relevant fields from call.meta or top level
                }));

                if (callsForCsv.length === 0) {
                    showToast('No suitable data in calls for CSV export.', 3000);
                    return;
                }

                const csv = Papa.unparse(callsForCsv);
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'inspiro_calls_export.csv';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showToast('Data exported as CSV!', 2000);
            } catch (error) {
                console.error("Error exporting CSV:", error);
                showToast('Error exporting CSV. See console.', 5000);
            }
        } else {
            showToast('No data to export.', 3000);
        }
    });
  }
});

function rerenderDashboard() {
    if (!globalProcessedData || Object.keys(globalProcessedData).length === 0 || globalProcessedData.callCount === undefined ) {
        console.warn("rerenderDashboard called with no or incomplete globalProcessedData. Initializing skeletons.");
        initializeSkeletons();
        updateOutlookBlock("No data loaded. Please upload call data.");
        displayCoachingSummary("Upload data to see coaching summary.");
        return; // Exit if no data to render
    }

    updateOutlookBlock(getInitialOutlookStats(globalProcessedData));
    const coachingSummaryFullText = generateCoachingSummaryText(globalProcessedData, allRawCalls);
    displayCoachingSummary(coachingSummaryFullText);
    if (coachingSummaryFullText) {
        prependToOutlookBlock(coachingSummaryFullText.split("\n")[0]);
    }
    
    createAgentScoreChart(globalProcessedData);
    createThemeChart(globalProcessedData);
    createCallbackChart(globalProcessedData);
    hideSkeleton('scoreChartSkeleton', 'scoreChart');
    hideSkeleton('themeChartSkeleton', 'themeChart');
    hideSkeleton('callbackChartSkeleton', 'callbackChart');

    displayAgentBadges(globalProcessedData);
    hideSkeleton('agentBadgesSkeleton', 'agentBadges');
} 