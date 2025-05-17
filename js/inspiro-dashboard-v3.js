import { processCallData, getInitialOutlookStats, generateCoachingSummaryText, getThemeDetails, getFormulaWeightsFromUI } from './dataProcessor.js';
import { 
    createAgentScoreChart, createThemeChart, createCallbackChart, 
    setOnAgentChartClick, setOnThemeChartClick, setOnCallbackChartClick,
    // New chart functions and setters
    createNewAgentPerformanceChart, createNewFlagDistributionChart, createNewPositiveIndicatorsChart,
    createNewTimeDistributionCharts, createNewChannelAndQueueCharts, createNewCategoriesChart,
    setOnNewAgentPerformanceClick, setOnNewFlagDistributionClick, setOnNewPositiveIndicatorsClick,
    setOnNewCategoriesClick, setOnNewTimeDistributionClick, setOnNewDayDistributionClick,
    setOnNewChannelDistributionClick, setOnNewQueueDistributionClick
} from './chartGenerator.js';
import { 
    displayAgentBadges, displayCoachingSummary, updateOutlookBlock, prependToOutlookBlock, 
    toggleSummaryDisplay, showToast, showSkeleton, hideSkeleton, 
    showAgentDetailModal, closeAgentDetailModal, showThemeDetailModal, closeThemeModal, 
    showCallbackDetailModal, closeCallbackModal,
    // New UI update functions
    updateSummaryStatCards, updateNewCategoryDetailsTable, updateNewRepeatCallersTable,
    updateNewCommonTopicsCloud, updateNewTopAgentsTable, updateNewPositiveCallsList
} from './uiUpdater.js';
import { initializeAgentFilter, setOnFilterChange, getSelectedAgent } from './filterManager.js';
import { initializeFileUploader } from './fileParser.js';

// --- Global Variables ---
let globalProcessedData = {};
let allRawCalls = []; // Store all loaded calls, acts as the single source of truth for raw data

// --- Core Functions ---
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
  // Target the dashboardTab specifically if we only want to print that.
  // For now, using the whole body as inspiro_platform.html might be what's desired for the PDF button in report tab.
  // If downloadPDF is called from within dashboardTab, it should ideally print dashboardTab.
  const dashboardTab = document.getElementById('dashboardTab');
  if(dashboardTab) {
      html2pdf().from(dashboardTab).set({ jsPDF: { unit: 'pt', format: 'a3', orientation: 'landscape' }, margin: [20,20,20,20] }).save('Inspiro_Coaching_Dashboard.pdf');
  } else {
      html2pdf().from(document.body).save('Inspiro_Platform_Report.pdf');
  }
}

// Assign functions to window object for inline HTML event handlers
window.copyOutlook = copyOutlook;
window.downloadPDF = downloadPDF; // This is now more specific for the main dashboard view
window.toggleSummary = () => toggleSummaryDisplay('coachingSummary'); // Ensure ID is passed if generic
window.closeAgentModal = closeAgentDetailModal;
window.closeThemeModal = closeThemeModal;
window.closeCallbackModal = closeCallbackModal;

// --- Platform Data Handler (Called by fileParser.js) ---
window.platformDataHandler = {
    loadData: function(parsedCalls) {
        console.log('Platform received calls:', parsedCalls);
        allRawCalls = parsedCalls;
        if (allRawCalls.length > 0) {
            const currentFormulaWeights = getFormulaWeightsFromUI();
            let initialAgentFilter = 'all';
            const agentFilterElement = document.getElementById('agentFilter');
            if (agentFilterElement) agentFilterElement.value = 'all'; // Reset filter to 'all' on new data load
            
            globalProcessedData = processCallData(allRawCalls, { agent: initialAgentFilter }, currentFormulaWeights);
            console.log('Initial globalProcessedData:', globalProcessedData);
            
            initializeAgentFilter(globalProcessedData.agents); // Populate agent filter based on OLD agents structure for now
            rerenderDashboard();
            showToast(`${allRawCalls.length} calls loaded and processed successfully!`, 3000);
            // hideAllSkeletons(); // Skeletons are not used for new elements yet
        } else {
            showToast('No calls were found in the provided data.', 4000);
            // initializeSkeletons(); // Show skeletons if no data
            clearDashboardDisplay(); // Clear out data from displays
        }
    }
};

function clearDashboardDisplay() {
    // Call update functions with empty or default data to clear them
    updateSummaryStatCards({});
    createNewAgentPerformanceChart({});
    createNewFlagDistributionChart({});
    createNewPositiveIndicatorsChart({});
    createNewTimeDistributionCharts([], []);
    createNewChannelAndQueueCharts({}, {});
    createNewCategoriesChart({});
    updateNewCategoryDetailsTable({}, 0);
    updateNewRepeatCallersTable({});
    updateNewCommonTopicsCloud({});
    updateNewTopAgentsTable([]);
    updateNewPositiveCallsList([]);

    // Clear old charts/UI if they were separate
    // createAgentScoreChart({agents:{}}); // Example if old charts were still active
    // displayAgentBadges({agents:{}}); 

    updateOutlookBlock("No data loaded. Please upload call data.");
    displayCoachingSummary("Upload data to see coaching summary.", 'coachingSummary');

    // Consider clearing filter dropdown or setting to a default state
    const agentFilterElement = document.getElementById('agentFilter');
    if(agentFilterElement) {
      agentFilterElement.innerHTML = '<option value="all">All Agents</option>';
    }
}


// --- Event Handlers for New Chart Drill-Downs ---
function handleNewAgentPerformanceClick(agentName) {
    // This can reuse the existing agent detail modal logic
    if (globalProcessedData && globalProcessedData.agentMetrics && globalProcessedData.agentMetrics[agentName]) {
        // Pass the structure expected by showAgentDetailModal or adapt showAgentDetailModal
        // showAgentDetailModal expects an agent object with .score, .callCount etc.
        // It also uses globalProcessedData.agentThemes[agentName]
        // Let's ensure we pass a compatible structure or adapt the modal function later.
        // For now, the agentMetrics[agentName] is quite detailed.
        // The original modal also used `agentThemes` from original `processedData`.
        showAgentDetailModal(agentName, globalProcessedData.agentMetrics[agentName], globalProcessedData.agentThemes?.[agentName]);
    } else {
        showToast(`Details for agent ${agentName} not found in new metrics.`, 3000);
    }
}

function handleNewFlagOrIndicatorClick(itemName, isPositive) {
    // This can reuse the existing theme detail modal logic
    // getThemeDetails expects themeName, allRawCalls, and the old agentStats structure
    // We need to ensure getThemeDetails can work or adapt the modal.
    const themeDetails = getThemeDetails(itemName, allRawCalls, globalProcessedData.agents); // agents is the old structure
    showThemeDetailModal(itemName, themeDetails, isPositive ? 'Positive Indicator' : 'Flag');
}

function handleNewCategoryClick(categoryName) {
    const themeDetails = getThemeDetails(categoryName, allRawCalls, globalProcessedData.agents);
    showThemeDetailModal(categoryName, themeDetails, 'Category'); 
}

function handleNewTimeDistributionClick(hourIndex) {
    showToast(`Clicked on hour: ${hourIndex}:00 - ${hourIndex+1}:00. Drill-down TBD.`, 3000);
    // TODO: Implement modal or view for calls in this hour
    // Will need a new function in dataProcessor: getCallsForHour(hourIndex, allRawCalls)
    // And a new modal in uiUpdater.
}

function handleNewDayDistributionClick(dayName, dayIndex) {
    showToast(`Clicked on day: ${dayName}. Drill-down TBD.`, 3000);
    // TODO: Implement modal or view for calls on this day
    // Will need: getCallsForDay(dayIndex, allRawCalls) and new modal.
}

function handleNewChannelOrQueueClick(itemName, type) { // type is 'Channel' or 'Queue'
    showToast(`Clicked on ${type}: ${itemName}. Drill-down TBD.`, 3000);
    // TODO: Implement modal or view for calls for this channel/queue
    // Will need: getCallsForChannel(channelName, allRawCalls) etc. and new modal.
}

// --- Main Application Logic ---
document.addEventListener("DOMContentLoaded", function () {
  // initializeSkeletons(); // Skeletons not actively used for new dashboard items yet.
  initializeFileUploader();
  
  // Set up callbacks for OLD charts (if they are still used/visible somewhere)
  setOnAgentChartClick(handleOldAgentChartClick); 
  setOnThemeChartClick(handleOldThemeChartClick);
  setOnCallbackChartClick(handleOldCallbackChartClick);

  // Set up callbacks for NEW charts
  setOnNewAgentPerformanceClick(handleNewAgentPerformanceClick);
  setOnNewFlagDistributionClick((flagName) => handleNewFlagOrIndicatorClick(flagName, false));
  setOnNewPositiveIndicatorsClick((indicatorName) => handleNewFlagOrIndicatorClick(indicatorName, true));
  setOnNewCategoriesClick(handleNewCategoryClick);
  setOnNewTimeDistributionClick(handleNewTimeDistributionClick);
  setOnNewDayDistributionClick(handleNewDayDistributionClick);
  setOnNewChannelDistributionClick((channelName) => handleNewChannelOrQueueClick(channelName, 'Channel'));
  setOnNewQueueDistributionClick((queueName) => handleNewChannelOrQueueClick(queueName, 'Queue'));

  setOnFilterChange((filters) => {
    const weights = getFormulaWeightsFromUI();
    globalProcessedData = processCallData(allRawCalls, filters, weights);
    rerenderDashboard(); 
  });

  const applyFormulaBtn = document.getElementById('applyFormulaBtn');
  if (applyFormulaBtn) {
    applyFormulaBtn.addEventListener('click', () => {
        const weights = getFormulaWeightsFromUI();
        const currentAgentFilter = getSelectedAgent(); // Ensure this function exists and works
        globalProcessedData = processCallData(allRawCalls, { agent: currentAgentFilter }, weights);
        rerenderDashboard();
        showToast("Formula weights applied!", 2000);
    });
  }

  // Export button event listeners (JSON and CSV)
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
        if (allRawCalls.length > 0) {
            // Export allRawCalls as it's the most complete dataset before specific dashboard processing
            const jsonDataStr = JSON.stringify(allRawCalls, null, 2);
            const blob = new Blob([jsonDataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'inspiro_raw_calls_export.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('Raw call data exported as JSON!', 2000);
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
                // Use globalProcessedData.processedCalls which includes calculatedScore
                // Or, choose specific fields from allRawCalls for a more controlled CSV.
                const callsForCsv = (globalProcessedData.processedCalls || allRawCalls).map(call => ({
                    contact_id: call.meta?.["Contact ID"],
                    agent_name: call.meta?.["Agent name"] || call.meta?.["Agent"],
                    initiation_timestamp: call.meta?.["Initiation timestamp"],
                    contact_duration: call.meta?.["Contact duration"],
                    customer_phone: call.meta?.["Customer phone number / email address"],
                    channel: call.meta?.Channel,
                    queue: call.meta?.Queue,
                    calculated_score: call.calculatedScore !== undefined ? call.calculatedScore.toFixed(2) : 'N/A',
                    flags: call.flags ? call.flags.join('; ') : '',
                    positive_flags: call.positiveFlags ? call.positiveFlags.join('; ') : '',
                    summary: call.summary || ''
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
  
  // Initial clear or render
  if(allRawCalls.length === 0) {
      clearDashboardDisplay();
  }
});

// --- Rerender Dashboard (Main Update Function) ---
function rerenderDashboard() {
    if (!globalProcessedData || Object.keys(globalProcessedData).length === 0 || globalProcessedData.callCount === undefined ) {
        console.warn("rerenderDashboard called with no or incomplete globalProcessedData. Clearing display.");
        clearDashboardDisplay();
        return;
    }

    // Update new summary stat cards
    updateSummaryStatCards(globalProcessedData.summaryStats);

    // Update new charts
    createNewAgentPerformanceChart(globalProcessedData.agentMetrics);
    createNewFlagDistributionChart(globalProcessedData.flagDistribution);
    createNewPositiveIndicatorsChart(globalProcessedData.positiveIndicatorDistribution);
    createNewTimeDistributionCharts(globalProcessedData.hourDistribution, globalProcessedData.dayDistribution);
    createNewChannelAndQueueCharts(globalProcessedData.channelDistribution, globalProcessedData.queueDistribution);
    createNewCategoriesChart(globalProcessedData.categoryDistribution);

    // Update new tables and lists
    updateNewCategoryDetailsTable(globalProcessedData.categoryDistribution, globalProcessedData.processedCalls.length);
    updateNewRepeatCallersTable(globalProcessedData.repeatCallers);
    updateNewCommonTopicsCloud(globalProcessedData.wordFrequency);
    updateNewTopAgentsTable(globalProcessedData.topAgentsForTable); // Uses pre-sorted top 5 from dataProcessor
    updateNewPositiveCallsList(globalProcessedData.positiveCallsForList); // Uses pre-filtered/sorted from dataProcessor

    // Update retained UI components (Coaching Summary, Outlook Block)
    updateOutlookBlock(getInitialOutlookStats(globalProcessedData));
    const coachingSummaryFullText = generateCoachingSummaryText(globalProcessedData, allRawCalls);
    displayCoachingSummary(coachingSummaryFullText, 'coachingSummary');
    // Prepend first line of coaching summary to outlook block is a feature from before - check if still desired
    // if (coachingSummaryFullText && coachingSummaryFullText.includes('\n')) {
    //     prependToOutlookBlock(coachingSummaryFullText.split("\n")[0]);
    // }

    // Hide Skeletons (if they were used for the new elements)
    // For now, new elements rely on "no data message" in their containers.
    // hideAllSkeletons(); 

    // Note: Old chart rendering calls like createAgentScoreChart, createThemeChart, displayAgentBadges
    // have been removed from here as the new dashboard layout replaces them.
    // If any old charts/UI were to coexist, their update calls would be here.
}

// --- Fallback/Compatibility Handlers for OLD chart clicks (if old charts were still active somewhere) ---
// These would need to be connected to actual old chart elements if they existed.
function handleOldAgentChartClick(agentName) {
    if (globalProcessedData && globalProcessedData.agents && globalProcessedData.agents[agentName]) {
        showAgentDetailModal(agentName, globalProcessedData.agents[agentName], globalProcessedData.agentThemes?.[agentName]);
    } else {
        showToast(`Old chart: Data for agent ${agentName} not found.`, 3000);
    }
}

function handleOldThemeChartClick(themeName) {
    if (allRawCalls.length > 0) {
        const themeDetails = getThemeDetails(themeName, allRawCalls, globalProcessedData.agents);
        showThemeDetailModal(themeName, themeDetails);
    } else {
        showToast("Old chart: No raw call data available for theme details.", 3000);
    }
}

function handleOldCallbackChartClick(customerIdentifier) {
    // This used globalProcessedData.callbacks and allRawCalls
    if (globalProcessedData && globalProcessedData.callbacks && globalProcessedData.callbacks[customerIdentifier] && allRawCalls.length > 0) {
        showCallbackDetailModal(customerIdentifier, globalProcessedData.callbacks[customerIdentifier], allRawCalls);
    } else {
        showToast(`Old chart: Callback details for ${customerIdentifier} not found.`, 3000);
    }
} 