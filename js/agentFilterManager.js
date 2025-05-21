// agentFilterManager.js
// Manages global multi-agent filtering system

function initializeAgentFilterDropdown(agents, onChange) {
  const filter = document.getElementById('agentFilter');
  filter.innerHTML = ''; // Clear existing options

  // Create "All" option
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'All Agents';
  filter.appendChild(allOption);

  // Add individual agents
  agents.forEach(agent => {
    const opt = document.createElement('option');
    opt.value = agent;
    opt.textContent = agent;
    filter.appendChild(opt);
  });

  // Restore from localStorage if available
  const saved = JSON.parse(localStorage.getItem('selectedAgents') || '[]');
  if (saved.length) {
    [...filter.options].forEach(opt => {
      if (saved.includes(opt.value)) opt.selected = true;
    });
  }

  // Change event
  filter.addEventListener('change', () => {
    const selected = [...filter.selectedOptions].map(o => o.value);
    localStorage.setItem('selectedAgents', JSON.stringify(selected));
    onChange(selected);
  });
}
