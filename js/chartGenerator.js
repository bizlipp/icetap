// js/chartGenerator.js
// This module will be responsible for creating and updating all charts 
// using Chart.js.

let scoreChartInstance = null;
let themeChartInstance = null;
let callbackChartInstance = null;

function destroyChart(chartInstance) {
    if (chartInstance) {
        chartInstance.destroy();
    }
}

let onAgentChartClickCallback = null;

export function setOnAgentChartClick(callback) {
    onAgentChartClickCallback = callback;
}

export function createAgentScoreChart(processedData, chartId = 'scoreChart') {
    destroyChart(scoreChartInstance);
    const { agents } = processedData;
    const agentNames = Object.keys(agents);
    const agentScores = agentNames.map(name => (agents[name].total > 0 ? agents[name].score / agents[name].total : 0).toFixed(2));

    const ctx = document.getElementById(chartId)?.getContext('2d');
    if (!ctx) return;

    scoreChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: agentNames,
            datasets: [{
                label: 'Avg Score',
                data: agentScores,
                backgroundColor: 'rgba(164, 62, 201, 0.7)',
                borderColor: '#a43ec9',
                borderWidth: 1
            }]
        },
        options: {
            onClick: (event, elements) => {
                if (elements.length > 0 && onAgentChartClickCallback) {
                    const chartElement = elements[0];
                    const agentName = agentNames[chartElement.index];
                    onAgentChartClickCallback(agentName);
                }
            },
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#ccc' }, grid: { color: '#222' } },
                y: { ticks: { color: '#ccc' }, grid: { color: '#222' }, beginAtZero: true }
            }
        }
    });
}

let onThemeChartClickCallback = null;

export function setOnThemeChartClick(callback) {
    onThemeChartClickCallback = callback;
}

export function createThemeChart(processedData, chartId = 'themeChart') {
    destroyChart(themeChartInstance);
    const { themes } = processedData;
    const themeDataForChart = Object.entries(themes).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const themeLabels = themeDataForChart.map(t => t[0]);
    
    const ctx = document.getElementById(chartId)?.getContext('2d');
    if (!ctx) return;

    themeChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: themeLabels,
            datasets: [{
                label: 'Theme Frequency',
                data: themeDataForChart.map(t => t[1]),
                backgroundColor: themeDataForChart.map((_, i) => `hsl(${i * 40}, 70%, 50%)`)
            }]
        },
        options: {
            onClick: (event, elements) => {
                if (elements.length > 0 && onThemeChartClickCallback) {
                    const chartElement = elements[0];
                    const themeName = themeLabels[chartElement.index];
                    onThemeChartClickCallback(themeName);
                }
            },
            plugins: { legend: { labels: { color: '#eee' } } }
        }
    });
}

let onCallbackChartClickCallback = null;

export function setOnCallbackChartClick(callback) {
    onCallbackChartClickCallback = callback;
}

export function createCallbackChart(processedData, chartId = 'callbackChart') {
    destroyChart(callbackChartInstance);
    const { callbacks } = processedData;
    const callbackEntries = Object.entries(callbacks);
    const repeatCountsForChartCorrected = callbackEntries
        .filter(([_, arr]) => arr.length > 1)
        .map(([k, arr]) => ({ customerId: k, count: arr.length })) 
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    const ctx = document.getElementById(chartId)?.getContext('2d');
    if (!ctx) return;

    callbackChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: repeatCountsForChartCorrected.map(r => r.customerId),
            datasets: [{
                label: 'Callback Count',
                data: repeatCountsForChartCorrected.map(r => r.count),
                backgroundColor: 'rgba(255, 77, 77, 0.7)',
                borderColor: '#ff4d4d',
                borderWidth: 1
            }]
        },
        options: {
            onClick: (event, elements) => {
                if (elements.length > 0 && onCallbackChartClickCallback) {
                    const chartElement = elements[0];
                    const customerId = repeatCountsForChartCorrected[chartElement.index].customerId;
                    onCallbackChartClickCallback(customerId);
                }
            },
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#ccc' }, grid: { color: '#222' } },
                y: { beginAtZero: true, ticks: { color: '#ccc' }, grid: { color: '#222' } }
            }
        }
    });
}

// Placeholder for chart generation functions
// export function createAgentScoreChart(data) { ... }
// export function updateThemeChart(data) { ... }
// etc. 

// --- New Chart Generation Functions (from dashboard.html logic) ---

let newAgentPerformance_Chart = null;
let newFlagDistribution_Chart = null;
let newPositiveIndicators_Chart = null;
let newTimeDistribution_Chart = null;
let newDayDistribution_Chart = null;
let newChannelDistribution_Chart = null;
let newQueueDistribution_Chart = null;
let newCategories_Chart = null;

// Callbacks for new chart interactions (to be set by main script)
let onNewAgentPerformanceClickCallback = null;
let onNewFlagDistributionClickCallback = null;
let onNewPositiveIndicatorsClickCallback = null;
let onNewCategoriesClickCallback = null;
let onNewTimeDistributionClickCallback = null;
let onNewDayDistributionClickCallback = null;
let onNewChannelDistributionClickCallback = null;
let onNewQueueDistributionClickCallback = null;

export function setOnNewAgentPerformanceClick(callback) { onNewAgentPerformanceClickCallback = callback; }
export function setOnNewFlagDistributionClick(callback) { onNewFlagDistributionClickCallback = callback; }
export function setOnNewPositiveIndicatorsClick(callback) { onNewPositiveIndicatorsClickCallback = callback; }
export function setOnNewCategoriesClick(callback) { onNewCategoriesClickCallback = callback; }
export function setOnNewTimeDistributionClick(callback) { onNewTimeDistributionClickCallback = callback; }
export function setOnNewDayDistributionClick(callback) { onNewDayDistributionClickCallback = callback; }
export function setOnNewChannelDistributionClick(callback) { onNewChannelDistributionClickCallback = callback; }
export function setOnNewQueueDistributionClick(callback) { onNewQueueDistributionClickCallback = callback; }


export function createNewAgentPerformanceChart(agentMetricsData) {
  const ctx = document.getElementById('newAgentPerformanceChart')?.getContext('2d');
  if (!ctx) return;

  const topAgents = Object.values(agentMetricsData)
    .sort((a, b) => b.totalCalls - a.totalCalls) // Top 5 by call volume as in dashboard.html
    .slice(0, 5);

  const labels = topAgents.map(a => a.name);
  const positiveData = topAgents.map(a => a.distinctPositiveCalls);
  const flaggedData = topAgents.map(a => a.distinctFlaggedCalls);
  // neutralCallsCount is pre-calculated in dataProcessor to ensure stack adds up to totalCalls
  const neutralData = topAgents.map(a => a.neutralCallsCount);

  if (newAgentPerformance_Chart) {
    newAgentPerformance_Chart.destroy();
  }
  newAgentPerformance_Chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Positive Calls',
          data: positiveData,
          backgroundColor: 'rgba(76, 175, 80, 0.7)',
          borderColor: 'rgba(76, 175, 80, 1)',
        },
        {
          label: 'Neutral Calls',
          data: neutralData,
          backgroundColor: 'rgba(158, 158, 158, 0.7)',
          borderColor: 'rgba(158, 158, 158, 1)',
        },
        {
          label: 'Flagged Calls',
          data: flaggedData,
          backgroundColor: 'rgba(255, 77, 77, 0.7)',
          borderColor: 'rgba(255, 77, 77, 1)',
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, ticks: { color: '#ccc' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
        y: { stacked: true, ticks: { color: '#ccc' }, grid: { color: 'rgba(255, 255, 255, 0.05)' }, beginAtZero: true }
      },
      plugins: { legend: { labels: { color: '#ccc' } } },
      onClick: (event, elements) => {
        if (elements.length > 0 && onNewAgentPerformanceClickCallback) {
          const chartElement = elements[0];
          const agentName = labels[chartElement.index];
          // Future: could also pass datasetIndex if we want to know if they clicked positive/neutral/flagged bar
          onNewAgentPerformanceClickCallback(agentName);
        }
      }
    }
  });
}

export function createNewFlagDistributionChart(flagDistributionData) {
  const ctx = document.getElementById('newFlagDistributionChart')?.getContext('2d');
  if (!ctx) return;

  const topFlags = Object.entries(flagDistributionData)
    .sort(([, countA], [, countB]) => countB - countA)
    .slice(0, 8);

  const labels = topFlags.map(f => f[0]);
  const data = topFlags.map(f => f[1]);

  if (newFlagDistribution_Chart) {
    newFlagDistribution_Chart.destroy();
  }
  newFlagDistribution_Chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Flag Occurrences',
        data: data,
        backgroundColor: 'rgba(255, 77, 77, 0.7)',
        borderColor: 'rgba(255, 77, 77, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: '#ccc' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
        y: { ticks: { color: '#ccc' }, grid: { color: 'rgba(255, 255, 255, 0.05)' }, beginAtZero: true }
      },
      plugins: { legend: { display: false, labels: { color: '#ccc' } } }, // Legend often not needed for single dataset bar
      onClick: (event, elements) => {
        if (elements.length > 0 && onNewFlagDistributionClickCallback) {
          const flagName = labels[elements[0].index];
          onNewFlagDistributionClickCallback(flagName);
        }
      }
    }
  });
}

export function createNewPositiveIndicatorsChart(positiveIndicatorData) {
  const ctx = document.getElementById('newPositiveIndicatorsChart')?.getContext('2d');
  if (!ctx) return;

  const topIndicators = Object.entries(positiveIndicatorData)
    .sort(([, countA], [, countB]) => countB - countA)
    .slice(0, 8);

  const labels = topIndicators.map(f => f[0]);
  const data = topIndicators.map(f => f[1]);

  if (newPositiveIndicators_Chart) {
    newPositiveIndicators_Chart.destroy();
  }
  newPositiveIndicators_Chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Positive Indicator Occurrences',
        data: data,
        backgroundColor: 'rgba(76, 175, 80, 0.7)',
        borderColor: 'rgba(76, 175, 80, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: '#ccc' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
        y: { ticks: { color: '#ccc' }, grid: { color: 'rgba(255, 255, 255, 0.05)' }, beginAtZero: true }
      },
      plugins: { legend: { display: false, labels: { color: '#ccc' } } },
       onClick: (event, elements) => {
        if (elements.length > 0 && onNewPositiveIndicatorsClickCallback) {
          const indicatorName = labels[elements[0].index];
          onNewPositiveIndicatorsClickCallback(indicatorName);
        }
      }
    }
  });
}

export function createNewTimeDistributionCharts(hourDistributionData, dayDistributionData) {
  const hourCtx = document.getElementById('newTimeDistributionChart')?.getContext('2d');
  const dayCtx = document.getElementById('newDayDistributionChart')?.getContext('2d');
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]; // Shorter names for chart

  if (hourCtx) {
    if (newTimeDistribution_Chart) newTimeDistribution_Chart.destroy();
    const hourLabels = Array.from({length: 24}, (_, i) => `${i}:00`);
    newTimeDistribution_Chart = new Chart(hourCtx, {
      type: 'bar',
      data: {
        labels: hourLabels,
        datasets: [{
          label: 'Calls by Hour',
          data: hourDistributionData,
          backgroundColor: 'rgba(164, 62, 201, 0.7)',
          borderColor: 'rgba(164, 62, 201, 1)',
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, scales: {x:{ticks:{color:'#ccc'}, grid:{color:'rgba(255,255,255,0.05)'}}, y:{ticks:{color:'#ccc'}, grid:{color:'rgba(255,255,255,0.05)'}, beginAtZero:true}}, plugins:{legend:{display: false}},
        onClick: (event, elements) => {
            if (elements.length > 0 && onNewTimeDistributionClickCallback) {
                const hourIndex = elements[0].index;
                onNewTimeDistributionClickCallback(hourIndex); // Pass hour index (0-23)
            }
        }
      }
    });
  }

  if (dayCtx) {
    if (newDayDistribution_Chart) newDayDistribution_Chart.destroy();
    newDayDistribution_Chart = new Chart(dayCtx, {
      type: 'bar',
      data: {
        labels: dayNames,
        datasets: [{
          label: 'Calls by Day',
          data: dayDistributionData,
          backgroundColor: 'rgba(76, 175, 80, 0.6)', // Slightly different color
          borderColor: 'rgba(76, 175, 80, 1)',
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, scales: {x:{ticks:{color:'#ccc'}, grid:{color:'rgba(255,255,255,0.05)'}}, y:{ticks:{color:'#ccc'}, grid:{color:'rgba(255,255,255,0.05)'}, beginAtZero:true}}, plugins:{legend:{display: false}},
        onClick: (event, elements) => {
            if (elements.length > 0 && onNewDayDistributionClickCallback) {
                const dayIndex = elements[0].index; // Pass day index (0-6)
                onNewDayDistributionClickCallback(dayNames[dayIndex], dayIndex);
            }
        }
      }
    });
  }
}

export function createNewChannelAndQueueCharts(channelData, queueData) {
  const channelCtx = document.getElementById('newChannelDistributionChart')?.getContext('2d');
  const queueCtx = document.getElementById('newQueueDistributionChart')?.getContext('2d');
  const pieChartColors = [
      'rgba(255, 99, 132, 0.7)', 'rgba(54, 162, 235, 0.7)', 'rgba(255, 206, 86, 0.7)',
      'rgba(75, 192, 192, 0.7)', 'rgba(153, 102, 255, 0.7)', 'rgba(255, 159, 64, 0.7)',
      'rgba(199, 199, 199, 0.7)', 'rgba(83, 109, 254, 0.7)'
  ];
  const pieBorderColor = '#2a2a2a';

  if (channelCtx) {
    if (newChannelDistribution_Chart) newChannelDistribution_Chart.destroy();
    const channelLabels = Object.keys(channelData);
    const channelCounts = Object.values(channelData);
    newChannelDistribution_Chart = new Chart(channelCtx, {
      type: 'pie',
      data: { labels: channelLabels, datasets: [{ data: channelCounts, backgroundColor: pieChartColors, borderColor: pieBorderColor, borderWidth: 1 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#ccc' } } },
        onClick: (event, elements) => {
            if (elements.length > 0 && onNewChannelDistributionClickCallback) {
                const channelName = channelLabels[elements[0].index];
                onNewChannelDistributionClickCallback(channelName);
            }
        }
      }
    });
  }

  if (queueCtx) {
    if (newQueueDistribution_Chart) newQueueDistribution_Chart.destroy();
    const queueLabels = Object.keys(queueData);
    const queueCounts = Object.values(queueData);
    newQueueDistribution_Chart = new Chart(queueCtx, {
      type: 'pie',
      data: { labels: queueLabels, datasets: [{ data: queueCounts, backgroundColor: pieChartColors.slice().reverse(), borderColor: pieBorderColor, borderWidth: 1 }] }, // Reversed colors for variety
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#ccc' } } },
        onClick: (event, elements) => {
            if (elements.length > 0 && onNewQueueDistributionClickCallback) {
                const queueName = queueLabels[elements[0].index];
                onNewQueueDistributionClickCallback(queueName);
            }
        }
      }
    });
  }
}

export function createNewCategoriesChart(categoryData) {
  const ctx = document.getElementById('newCategoriesChart')?.getContext('2d');
  if (!ctx) return;

  const topCategories = Object.entries(categoryData)
    .sort(([, countA], [, countB]) => countB - countA)
    .slice(0, 10);
  
  if (topCategories.length === 0) {
    if (newCategories_Chart) newCategories_Chart.destroy(); // Destroy if exists and no data
    // Optionally, display a "no data" message on the canvas itself, handled by uiUpdater for the table part.
    return;
  }

  const labels = topCategories.map(c => c[0]);
  const counts = topCategories.map(c => c[1]);
  const chartColors = counts.map((_, index) => {
    const ratio = counts.length <= 1 ? 0.5 : index / (counts.length - 1);
    const r = Math.round(164 + (76 - 164) * ratio);
    const g = Math.round(62 + (175 - 62) * ratio);
    const b = Math.round(201 + (80 - 201) * ratio);
    return `rgba(${r}, ${g}, ${b}, 0.7)`;
  });

  if (newCategories_Chart) {
    newCategories_Chart.destroy();
  }
  newCategories_Chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Call Count',
        data: counts,
        backgroundColor: chartColors,
        borderColor: chartColors.map(c => c.replace('0.7', '1')),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: '#ccc' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
        y: { ticks: { color: '#ccc' }, grid: { color: 'rgba(255, 255, 255, 0.05)' }, beginAtZero: true }
      },
      plugins: {
        legend: { display: false, labels: { color: '#ccc' } },
        title: { display: true, text: 'Top Call Categories', color: '#ccc', font: { size: 14 } }
      },
      onClick: (event, elements) => {
        if (elements.length > 0 && onNewCategoriesClickCallback) {
          const categoryName = labels[elements[0].index];
          onNewCategoriesClickCallback(categoryName);
        }
      }
    }
  });
} 