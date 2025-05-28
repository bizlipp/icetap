(function () {
  let editableCalls = [];
  let currentEditIndex = -1;

  document.addEventListener('DOMContentLoaded', async () => {
    if (!window.DataStackULTRA) {
      console.error("DataStackULTRA is not initialized. Editor dashboard cannot load data.");
      document.getElementById("editorStatus").textContent = "Error: DataStackULTRA not available.";
      // Display a more comprehensive error in the main area if possible
      const mainContentArea = document.getElementById('editorDashboard'); 
      if(mainContentArea) {
          mainContentArea.innerHTML = '<p class="no-data-message dashboard-section"><i class="fas fa-info-circle mr-2"></i>Error: DataStackULTRA not available. Cannot load editor data.</p>';
      }
      return;
    }
    try {
      const calls = await window.DataStackULTRA.get('loadedCalls', []);
      if (!calls || !Array.isArray(calls) || calls.length === 0) {
        console.warn("No valid calls data found in DataStackULTRA for editor.");
        editableCalls = [];
        displayCallForEditing(-1); // Show no data message
      } else {
        editableCalls = JSON.parse(JSON.stringify(calls)); // Deep copy for local editing to avoid mutating main store directly
        displayCallForEditing(0); // Display first call
      }

      const activeFile = await window.DataStackULTRA.get('activeAuditFile', 'No file loaded');
      const filenameDisplayElement = document.getElementById("editorFilenameDisplay"); 
      if (filenameDisplayElement) {
        filenameDisplayElement.textContent = activeFile ? `File: ${activeFile}` : 'No file loaded';
      }
      
      setupEventListeners();

    } catch (error) {
      console.error("Error loading calls from DataStackULTRA for editor:", error);
      document.getElementById("editorStatus").textContent = "Error loading calls.";
      displayCallForEditing(-1); 
    }
  });

  function setupEventListeners() {
    document.getElementById("prevCallButton")?.addEventListener("click", showPrevCall);
    document.getElementById("nextCallButton")?.addEventListener("click", showNextCall);
    document.getElementById("saveCallButton")?.addEventListener("click", saveCurrentCall);
    document.getElementById("jumpToContactIdButton")?.addEventListener("click", jumpToCallByContactId);
    // Add more listeners for specific field changes if direct updates are needed
  }

  function displayCallForEditing(index) {
    currentEditIndex = index;
    const callEditorForm = document.getElementById("callEditorForm");
    const editorStatus = document.getElementById("editorStatus");
    const navigationControls = document.querySelector(".navigation-controls");
    const editorMainContent = document.querySelector(".editor-main-content"); // Changed from editor-fields-section

    if (!callEditorForm || !editorStatus || !navigationControls || !editorMainContent) {
        console.error("Editor UI elements are missing.");
        if(editorStatus) editorStatus.textContent = "Error: Editor UI incomplete.";
        return;
    }

    if (index === -1 || editableCalls.length === 0) {
      callEditorForm.innerHTML = '<p class="no-data-message" style="padding: 1rem;">No calls loaded to edit. Please load a file on the main page.</p>';
      editorStatus.textContent = `No calls loaded.`;
      // Keep navigation visible for jump to ID
      // navigationControls.style.display = 'none'; 
      editorMainContent.style.display = 'none';
      // Ensure save button is part of editorMainContent or hidden separately
      const saveButtonContainer = editorMainContent.querySelector(".form-actions");
      if(saveButtonContainer) saveButtonContainer.style.display = 'none';
      return;
    }
    
    // navigationControls.style.display = ''; // Already visible
    editorMainContent.style.display = '';
    const saveButtonContainerInForm = editorMainContent.querySelector(".form-actions"); // Save button is now outside form, within editorMainContent
    if(saveButtonContainerInForm) saveButtonContainerInForm.style.display = '';
    
    callEditorForm.innerHTML = ''; // Clear previous form content

    const call = editableCalls[index];
    if (!call || !call.meta) { // Added check for call.meta
        callEditorForm.innerHTML = '<p class="no-data-message" style="padding: 1rem;">Error: Could not load selected call or call metadata is missing.</p>';
        editorStatus.textContent = "Error loading call data.";
        return;
    }

    editorStatus.textContent = `Editing Call ${index + 1} of ${editableCalls.length} (Contact ID: ${call.meta["Contact ID"] || 'N/A'})`;

    // Collapsible Metadata Section
    const metaDetails = document.createElement('details');
    metaDetails.className = 'editor-section collapsible-section card mb-3';
    metaDetails.open = false; // Start collapsed, or true to start open
    const metaSummary = document.createElement('summary');
    metaSummary.className = 'collapsible-summary';
    metaSummary.innerHTML = '<i class="fas fa-info-circle mr-2"></i>Metadata (Click to Expand/Collapse)';
    metaDetails.appendChild(metaSummary);
    const metaList = document.createElement('ul');
    metaList.className = 'metadata-list p-3';
    for (const key in call.meta) {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${key}:</strong> ${call.meta[key]}`;
      metaList.appendChild(li);
    }
    metaDetails.appendChild(metaList);
    callEditorForm.appendChild(metaDetails);
    
    // Collapsible History Summary (if exists)
    if (call.historySummary && Object.keys(call.historySummary).length > 0) {
        const historyDetails = document.createElement('details');
        historyDetails.className = 'editor-section collapsible-section card mb-3';
        historyDetails.open = false;
        const historySummaryTitle = document.createElement('summary');
        historySummaryTitle.className = 'collapsible-summary';
        historySummaryTitle.innerHTML = '<i class="fas fa-user-clock mr-2"></i>Customer Interaction History (Click to Expand/Collapse)';
        historyDetails.appendChild(historySummaryTitle);
        const historyList = document.createElement('ul');
        historyList.className = 'metadata-list p-3';
        for (const key in call.historySummary) {
            const li = document.createElement('li');
            let value = call.historySummary[key];
            let displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            
            if (key === 'pastFlags' && Array.isArray(value)) {
                value = value.length > 0 ? [...new Set(value)].join(', ') : 'None';
            } else if (key === 'recentOutcomes' && Array.isArray(value)) {
                value = value.length > 0 ? value.join(', ') : 'None';
            } else if (Array.isArray(value)) {
                value = value.join(', ') || '-';
            }
            li.innerHTML = `<strong>${displayKey}:</strong> ${value}`;
            historyList.appendChild(li);
        }
        const explanation = document.createElement('p');
        explanation.className = 'text-xs text-gray-500 mt-2 p-2';
        explanation.innerHTML = `<i>This history is based on the customer identifier (e.g., phone number) and may include interactions from different Contact IDs. Current call excluded.</i>`;
        historyDetails.appendChild(historyList);
        historyDetails.appendChild(explanation);
        callEditorForm.appendChild(historyDetails);
    }

    // Editable fields: Issue, Outcome, Summary
    addEditableTextarea(callEditorForm, "callIssue", "Issue Reported", call.issue || "");
    addEditableTextarea(callEditorForm, "callOutcome", "Call Outcome", call.outcome || "");
    addEditableTextarea(callEditorForm, "callSummary", "Call Summary", call.summary || "");
    
    // Tags Section (Placeholder for now, will be enhanced)
    addTagsSection(callEditorForm, call.customTags || [], call.meta["Categories"]);

    // Collapsible Flags (Read-only for now)
    if (call.flags && call.flags.length > 0) {
      const flagsDetails = document.createElement('details');
      flagsDetails.className = 'editor-section collapsible-section card mb-3';
      flagsDetails.open = false;
      const flagsSummary = document.createElement('summary');
      flagsSummary.className = 'collapsible-summary';
      flagsSummary.innerHTML = '<i class="fas fa-flag mr-2"></i>Flags (Read-only for now) (Click to Expand/Collapse)';
      flagsDetails.appendChild(flagsSummary);
      const flagsContent = document.createElement('p');
      flagsContent.className = 'p-3';
      flagsContent.textContent = call.flags.join(', ') || 'None';
      flagsDetails.appendChild(flagsContent);
      callEditorForm.appendChild(flagsDetails);
    }

    // Collapsible Transcript (Read-only)
    if (call.transcript && call.transcript.length > 0) {
      const transcriptDetails = document.createElement('details');
      transcriptDetails.className = 'editor-section collapsible-section card mb-3';
      transcriptDetails.open = true; // Start transcript open by default
      const transcriptSummary = document.createElement('summary');
      transcriptSummary.className = 'collapsible-summary';
      transcriptSummary.innerHTML = '<i class="fas fa-comment-dots mr-2"></i>Transcript (Read-only) (Click to Expand/Collapse)';
      transcriptDetails.appendChild(transcriptSummary);
      const transcriptList = document.createElement('ul');
      transcriptList.className = 'transcript-list p-3';
      (call.transcript || []).forEach(t => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="ts-speaker">${t.speaker} (${t.timestamp}):</span> <span class="ts-text">${t.text}</span>`;
        transcriptList.appendChild(li);
      });
      transcriptDetails.appendChild(transcriptList);
      callEditorForm.appendChild(transcriptDetails);
    }
    
    updateNavigationButtons();
  }

  function addEditableTextarea(parent, id, label, value) {
    const fieldSet = document.createElement('div');
    fieldSet.className = 'form-group editor-section card p-3 mb-3'; // Added card styling
    fieldSet.innerHTML = `<label for="${id}" class="block font-semibold mb-1"><i class="fas fa-edit mr-1"></i>${label}:</label>
                        <textarea id="${id}" name="${id}" rows="4" class="editor-field w-full p-2 border rounded">${value}</textarea>`;
    parent.appendChild(fieldSet);
  }

  function addTagsSection(parent, customTagsArray = [], categoriesString = '') {
    const tagsSection = document.createElement('div');
    tagsSection.className = 'form-group editor-section card p-3 mb-3';
    tagsSection.innerHTML = `
      <label class="block font-semibold mb-1"><i class="fas fa-tags mr-1"></i>Custom Tags:</label>
      <div id="customTagsContainer" class="tags-display-container mb-2">
        <!-- Tags will be rendered here by renderCustomTags -->
      </div>
      <input type="text" id="newCustomTagInput" placeholder="Add a new tag..." class="editor-field w-full p-2 border rounded mb-2" />
      <button id="addCustomTagButton" type="button" class="button text-sm"><i class="fas fa-plus mr-1"></i>Add Tag</button>
      <hr class="my-3">
      <label class="block font-semibold mb-1"><i class="fas fa-cogs mr-1"></i>Original Categories (Read-only):</label>
      <p id="originalCategoriesDisplay" class="text-sm p-2 bg-gray-100 rounded">${categoriesString || 'None'}</p>
    `;
    parent.appendChild(tagsSection);
    renderCustomTags(customTagsArray);

    document.getElementById('addCustomTagButton').addEventListener('click', handleAddCustomTag);
  }

  function renderCustomTags(tagsArray) {
    const container = document.getElementById('customTagsContainer');
    if (!container) return;
    container.innerHTML = ''; // Clear existing tags
    if (!tagsArray || tagsArray.length === 0) {
        container.innerHTML = '<span class="text-xs text-gray-500">No custom tags added yet.</span>';
        return;
    }
    tagsArray.forEach((tag, index) => {
        const tagElement = document.createElement('span');
        tagElement.className = 'custom-tag';
        tagElement.textContent = tag;
        const removeButton = document.createElement('button');
        removeButton.className = 'remove-tag-button';
        removeButton.innerHTML = '&times;';
        removeButton.onclick = () => handleRemoveCustomTag(index);
        tagElement.appendChild(removeButton);
        container.appendChild(tagElement);
    });
  }
  
  function handleAddCustomTag() {
    const input = document.getElementById('newCustomTagInput');
    const newTag = input.value.trim();
    if (newTag && editableCalls[currentEditIndex]) {
        if (!editableCalls[currentEditIndex].customTags) {
            editableCalls[currentEditIndex].customTags = [];
        }
        if (!editableCalls[currentEditIndex].customTags.includes(newTag)) {
            editableCalls[currentEditIndex].customTags.push(newTag);
            renderCustomTags(editableCalls[currentEditIndex].customTags);
            input.value = ''; // Clear input
        } else {
            alert('Tag already exists.');
        }
    }
  }

  function handleRemoveCustomTag(tagIndex) {
      if (editableCalls[currentEditIndex] && editableCalls[currentEditIndex].customTags) {
          editableCalls[currentEditIndex].customTags.splice(tagIndex, 1);
          renderCustomTags(editableCalls[currentEditIndex].customTags);
      }
  }

  function jumpToCallByContactId() {
    const contactIdToFind = document.getElementById("jumpToContactIdInput").value.trim();
    if (!contactIdToFind) {
      alert("Please enter a Contact ID.");
      return;
    }
    const callIndex = editableCalls.findIndex(call => call.meta && call.meta["Contact ID"] === contactIdToFind);
    if (callIndex !== -1) {
      displayCallForEditing(callIndex);
    } else {
      alert(`Contact ID "${contactIdToFind}" not found in the loaded calls.`);
    }
  }
  
  function updateNavigationButtons() {
    document.getElementById("prevCallButton").disabled = currentEditIndex <= 0;
    document.getElementById("nextCallButton").disabled = currentEditIndex >= editableCalls.length - 1;
    document.getElementById("saveCallButton").disabled = currentEditIndex < 0 || currentEditIndex >= editableCalls.length;
  }

  function showPrevCall() {
    if (currentEditIndex > 0) {
      displayCallForEditing(currentEditIndex - 1);
    }
  }

  function showNextCall() {
    if (currentEditIndex < editableCalls.length - 1) {
      displayCallForEditing(currentEditIndex + 1);
    }
  }

  async function saveCurrentCall() {
    if (currentEditIndex === -1 || !editableCalls[currentEditIndex]) {
      alert("No call selected to save.");
      return;
    }

    const callToSave = editableCalls[currentEditIndex];
    callToSave.issue = document.getElementById("callIssue").value;
    callToSave.outcome = document.getElementById("callOutcome").value;
    callToSave.summary = document.getElementById("callSummary").value;
    // Custom tags are already updated in editableCalls[currentEditIndex].customTags by handleAdd/Remove
    // So, callToSave will have them if the property exists on the object.

    try {
        // 1. Update the local `editableCalls` array (already done by direct modification)
        // 2. Get the full `loadedCalls` from DataStackULTRA (as it's the source of truth)
        let allCalls = await window.DataStackULTRA.get('loadedCalls', []);
        if (!Array.isArray(allCalls)) allCalls = [];

        // 3. Find the corresponding call in `allCalls` and update it
        const masterIndex = allCalls.findIndex(c => c.meta["Contact ID"] === callToSave.meta["Contact ID"]);
        if (masterIndex !== -1) {
            allCalls[masterIndex] = { ...allCalls[masterIndex], ...callToSave }; // Merge changes, ensuring historySummary & analysis data is preserved if not edited
        } else {
            // This case should ideally not happen if editableCalls is a copy of a subset of loadedCalls
            // But as a fallback, if it's a new call or ID changed, we might add it or handle error
            console.warn("Call to save not found in master loadedCalls. Appending it. This might be unexpected.");
            allCalls.push(callToSave); 
        }

        // 4. Save the modified `allCalls` back to DataStackULTRA
        await window.DataStackULTRA.set('loadedCalls', allCalls);
        
        // 5. Update the global `parsedCalls` in index.html
        if (window.opener && typeof window.opener.updateGlobalParsedCall === 'function') {
            window.opener.updateGlobalParsedCall(callToSave.meta["Contact ID"], callToSave);
        } else {
            console.warn("Could not find window.opener.updateGlobalParsedCall to sync main page.");
            alert("Call saved in DataStackULTRA. Reload main page or dashboards to see all changes.");
        }

        document.getElementById("editorStatus").textContent = `Call ${currentEditIndex + 1} saved successfully!`;
        alert("Call saved!");

    } catch (error) {
        console.error("Error saving call:", error);
        document.getElementById("editorStatus").textContent = `Error saving call: ${error.message}`;
        alert("Error saving call. See console for details.");
    }
  }
})();
