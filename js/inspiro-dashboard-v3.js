import { processCallData, getInitialOutlookStats, generateCoachingSummaryText } from './dataProcessor.js';
import { createAgentScoreChart, createThemeChart, createCallbackChart, setOnAgentChartClick } from './chartGenerator.js';
import { displayAgentBadges, displayCoachingSummary, updateOutlookBlock, prependToOutlookBlock, toggleSummaryDisplay, showToast, showSkeleton, hideSkeleton, showAgentDetailModal, closeAgentDetailModal } from './uiUpdater.js';
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

function loadAndProcessData(calls, filters = {}) {
    allRawCalls = calls; // Store for future filtering if this is the initial load
    globalProcessedData = processCallData(allRawCalls, filters);
    initializeAgentFilter(globalProcessedData); // Initialize/update agent filter dropdown
    rerenderDashboard();
}

document.addEventListener("DOMContentLoaded", function () {
  initializeSkeletons();
  setOnAgentChartClick(handleAgentChartClick);
  
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
  if (initialCalls.length === 0 && !document.getElementById('dataFileUpload').value) { // Check if file upload has a value later
      showToast("No call data found. Please upload a JSON file with call data.", 5000);
  }

  loadAndProcessData(initialCalls, { agent: 'all' }); // Initial load with 'all' agents
  
  setOnFilterChange((filters) => {
    globalProcessedData = processCallData(allRawCalls, filters);
    rerenderDashboard();
  });

  const fileUploadInput = document.getElementById('dataFileUpload');
  if (fileUploadInput) {
    fileUploadInput.addEventListener('change', handleFileUpload);
  }
});

function rerenderDashboard() {
    const currentFilters = { agent: getSelectedAgent() };
    // Re-process with current filters if not already done by the caller
    // globalProcessedData = processCallData(allRawCalls, currentFilters); 
    // ^ This line is tricky. If rerenderDashboard is called AFTER data is processed with filters, it's redundant.
    // If called directly, it might need to re-process. Let's assume data is processed before calling rerenderDashboard.

    updateOutlookBlock(getInitialOutlookStats(globalProcessedData));
    const coachingSummaryFullText = generateCoachingSummaryText(globalProcessedData);
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
        allRawCalls = jsonData; // Update the master list of calls
        const currentFilters = { agent: getSelectedAgent() }; // Get current filter state
        // Reset filter to 'all' if previous agent not in new data? Or just let it be?
        // For now, just re-apply current filter to new data.
        globalProcessedData = processCallData(allRawCalls, currentFilters);
        initializeAgentFilter(globalProcessedData); // Re-initialize filter with new agent list
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