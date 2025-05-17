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

export function createThemeChart(processedData, chartId = 'themeChart') {
    destroyChart(themeChartInstance);
    const { themes } = processedData;
    const themeDataForChart = Object.entries(themes).sort((a, b) => b[1] - a[1]).slice(0, 8);
    
    const ctx = document.getElementById(chartId)?.getContext('2d');
    if (!ctx) return;

    themeChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: themeDataForChart.map(t => t[0]),
            datasets: [{
                label: 'Theme Frequency',
                data: themeDataForChart.map(t => t[1]),
                backgroundColor: themeDataForChart.map((_, i) => `hsl(${i * 40}, 70%, 50%)`)
            }]
        },
        options: {
            plugins: { legend: { labels: { color: '#eee' } } }
        }
    });
}

export function createCallbackChart(processedData, chartId = 'callbackChart') {
    destroyChart(callbackChartInstance);
    const { callbacks } = processedData;
    const callbackEntries = Object.entries(callbacks);
    const repeatCountsForChartCorrected = callbackEntries
        .filter(([_, arr]) => arr.length > 1)
        .map(([k, arr]) => ({ k: k, count: arr.length })) 
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    const ctx = document.getElementById(chartId)?.getContext('2d');
    if (!ctx) return;

    callbackChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: repeatCountsForChartCorrected.map(r => r.k),
            datasets: [{
                label: 'Callback Count',
                data: repeatCountsForChartCorrected.map(r => r.count),
                backgroundColor: 'rgba(255, 77, 77, 0.7)',
                borderColor: '#ff4d4d',
                borderWidth: 1
            }]
        },
        options: {
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