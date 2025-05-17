// js/filterManager.js
// Manages filter UI, state, and applying filters.

let onFilterChangeCallback = null;

export function initializeAgentFilter(processedData, filterElementId = 'agentFilter') {
    const agentFilterSelect = document.getElementById(filterElementId);
    if (!agentFilterSelect) return;

    // Clear existing options except for 'All Agents'
    while (agentFilterSelect.options.length > 1) {
        agentFilterSelect.remove(1);
    }

    const { agents } = processedData;
    const agentNames = Object.keys(agents).sort(); // Sort agent names alphabetically

    agentNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        agentFilterSelect.appendChild(option);
    });

    agentFilterSelect.addEventListener('change', (event) => {
        if (onFilterChangeCallback) {
            onFilterChangeCallback({ agent: event.target.value });
        }
    });
}

export function setOnFilterChange(callback) {
    onFilterChangeCallback = callback;
}

export function getSelectedAgent(filterElementId = 'agentFilter') {
    const agentFilterSelect = document.getElementById(filterElementId);
    return agentFilterSelect ? agentFilterSelect.value : 'all';
} 