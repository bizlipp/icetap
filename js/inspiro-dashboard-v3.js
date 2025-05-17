import { processCallData, getInitialOutlookStats, generateCoachingSummaryText, getThemeDetails, getFormulaWeightsFromUI } from './dataProcessor.js';
import { createAgentScoreChart, createThemeChart, createCallbackChart, setOnAgentChartClick, setOnThemeChartClick, setOnCallbackChartClick } from './chartGenerator.js';
import { displayAgentBadges, displayCoachingSummary, updateOutlookBlock, prependToOutlookBlock, toggleSummaryDisplay, showToast, showSkeleton, hideSkeleton, showAgentDetailModal, closeAgentDetailModal, showThemeDetailModal, closeThemeDetailModal, showCallbackDetailModal, closeCallbackDetailModal } from './uiUpdater.js';
import { initializeAgentFilter, setOnFilterChange, getSelectedAgent } from './filterManager.js';

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
let allRawCalls = []; // Store all loaded calls for re-filtering

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
  setOnAgentChartClick(handleAgentChartClick);
  setOnThemeChartClick(handleThemeChartClick);
  setOnCallbackChartClick(handleCallbackChartClick);
  
  let initialCalls = [];
  try {
    const storedData = localStorage.getItem("inspiroCallData");
    if (storedData) {
        initialCalls = JSON.parse(storedData);
    }
  } catch (error) {
    console.error("Error parsing InspiroCallData from localStorage:", error);
    showToast("Error loading data from localStorage. Check console.", 5000);
  }

  if (!Array.isArray(initialCalls)) {
    console.warn("InspiroCallData from localStorage is not an array or is missing. Initializing with empty data.");
    initialCalls = []; 
  }
  if (initialCalls.length === 0 && !(document.getElementById('dataFileUpload') && document.getElementById('dataFileUpload').value)) { 
      showToast("No call data found. Please upload a JSON file with call data.", 5000);
  }
  
  const currentFormulaWeights = getFormulaWeightsFromUI();
  loadAndProcessData(initialCalls, { agent: getSelectedAgent() }, currentFormulaWeights);
  
  setOnFilterChange((filters) => {
    const weights = getFormulaWeightsFromUI();
    globalProcessedData = processCallData(allRawCalls, filters, weights);
    rerenderDashboard(); // Filter change doesn't re-init agent list, but re-renders with new data scope
  });

  const fileUploadInput = document.getElementById('dataFileUpload');
  if (fileUploadInput) {
    fileUploadInput.addEventListener('change', handleFileUpload);
  }

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
});

function rerenderDashboard() {
    const currentFilters = { agent: getSelectedAgent() };
    // Re-process with current filters if not already done by the caller
    // globalProcessedData = processCallData(allRawCalls, currentFilters); 
    // ^ This line is tricky. If rerenderDashboard is called AFTER data is processed with filters, it's redundant.
    // If called directly, it might need to re-process. Let's assume data is processed before calling rerenderDashboard.

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

async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (file) {
    initializeSkeletons();
    try {
      const fileContents = await file.text();
      const jsonData = JSON.parse(fileContents);
      if (Array.isArray(jsonData)) {
        allRawCalls = jsonData; 
        const currentFilters = { agent: getSelectedAgent() };
        const currentWeights = getFormulaWeightsFromUI();
        globalProcessedData = processCallData(allRawCalls, currentFilters, currentWeights);
        initializeAgentFilter(globalProcessedData); // Re-initialize filter with new agent list from new data
        rerenderDashboard();
        showToast("Data loaded from file successfully!", 3000);
      } else {
        showToast("Invalid file format. Expected a JSON array.", 5000);
        hideAllSkeletons();
      }
    } catch (error) {
      console.error("Error processing uploaded file:", error);
      showToast("Error processing file. Check console.", 5000);
      hideAllSkeletons();
    }
    event.target.value = null;
  }
} 