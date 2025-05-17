// js/fileParser.js
// Handles file uploading, parsing of various formats (TXT, HTML, CSV, XLSX, ZIP)
// and passes the structured call data to the main platform.

// --- Module-scoped variables ---
let parsedCalls = [];
let contactIdSet = new Set(); // Track unique Contact IDs to prevent duplicates
let uploadedFiles = []; // Keep track of processed file names
let currentZipFile = null; // For storing the current ZIP file being processed

// --- Configuration variables (extracted from index.html) ---
const CONTACT_ID_REGEX = /^[a-f0-9\-]{36}$/i;

const positiveTriggers = [
  "excellent", "awesome", "fantastic", "happy", "satisfied", "appreciate", "helpful", "thanks", "thank you",
  "resolved", "solution", "fixed", "solved", "working", "successful",
  "great job", "great service", "good job", "patient", "kind", "understanding",
  "loyal", "recommend", "refer", "continue service", "sign up again",
  "perfect", "wonderful", "brilliant", "superb", "exceptional", "outstanding"
];

const triggers = [
  "cancel", "refund", "unhappy", "disappointed", "upset", "frustrated", "angry",
  "supervisor", "manager", "escalate", "speak to someone else", "higher up",
  "disconnect", "hang up", "technical issue", "doesn\'t work", "not working", "error",
  "bill", "charge", "overcharge", "payment", "cost", "price", "expensive",
  "gdpr", "privacy", "policy", "terms", "legal", "compliance", "regulation",
  "complaint", "issue", "problem", "fault", "failure", "malfunction", "broken",
  "fraud", "scam", "unauthorized", "suspicious", "security", "hack", "identity",
  "cancel service", "subscription", "upgrade", "downgrade", "change plan"
];

const metadataFieldOrder = [
  "Contact ID", "Channel", "Contact status", "Initiation timestamp",
  "System phone number / email address", "Queue", "Agent", "Recording/Transcript",
  "Customer phone number / email address", "Disconnect timestamp", "Contact duration",
  "Agent name", "Agent first name", "Agent last name", "Routing profile",
  "Connected to agent timestamp", "ACW start timestamp", "ACW end timestamp",
  "Agent interaction duration", "Agent connection attempts", "Number of holds",
  "Is transferred out", "Initiation method", "Disconnect reason",
  "First contact flow name", "First contact flow ID", "Enqueue timestamp",
  "Fraud detection result"
];

const shortMetadataFields = ["Channel", "Contact status", "Initiation timestamp", "System phone number / email address", "Queue", "Agent", "Recording/Transcript"];
const longMetadataFields = [
  "Customer phone number / email address", "Disconnect timestamp", "Contact duration",
  "Agent name", "Agent first name", "Agent last name", "Routing profile",
  "Connected to agent timestamp", "ACW start timestamp", "ACW end timestamp",
  "Agent interaction duration", "Agent connection attempts", "Number of holds",
  "Is transferred out", "Initiation method", "Disconnect reason",
  "First contact flow name", "First contact flow ID", "Enqueue timestamp",
  "Fraud detection result"
];


// --- UI Update Functions ---
function updateStatus(message, isError = false) {
    const statusEl = document.getElementById('platformFileStatus');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.style.color = isError ? '#ff4d4d' : '#ccc'; // Red for error, light gray otherwise
    }
    if (isError) console.error(message); else console.log(message);
}

function updateUploadedFilesUI() {
    const listEl = document.getElementById('platformUploadedFilesList');
    const containerEl = document.getElementById('platformUploadedFilesContainer');
    if (listEl && containerEl) {
        if (uploadedFiles.length > 0) {
            listEl.innerHTML = uploadedFiles.map(file => `<li>${file}</li>`).join('');
            containerEl.style.display = 'block';
        } else {
            listEl.innerHTML = '';
            containerEl.style.display = 'none';
        }
    }
}

// --- Data Transmission to Platform ---
// This function is called by the parser once data is ready.
function transmitDataToPlatform(finalParsedCalls) {
    if (window.platformDataHandler && typeof window.platformDataHandler.loadData === 'function') {
        window.platformDataHandler.loadData(finalParsedCalls);
        if (finalParsedCalls.length > 0) {
            updateStatus(`Successfully processed and sent ${finalParsedCalls.length} calls to the dashboard.`);
        } else {
            updateStatus('No calls found in the processed files.', true);
        }
    } else {
        updateStatus('Error: Platform data handler not found. Cannot display data.', true);
        console.error('window.platformDataHandler.loadData is not defined. Data cannot be passed to dashboard.', finalParsedCalls);
    }
}

// --- Core File Handling and Parsing Logic (from index.html, adapted) ---

function handleFileSelect(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    processAndRelayFiles(Array.from(files));
}

function processAndRelayFiles(filesToProcess) {
    updateStatus(`⏳ Processing ${filesToProcess.length} file(s)...`);
    // Reset global parser state for this batch
    parsedCalls = []; 
    contactIdSet.clear();
    // uploadedFiles = []; // Keep uploadedFiles for session display, or clear per batch:
    // For now, clearing it to reflect current batch only in UI, but this could be changed
    // uploadedFiles = []; 
    // updateUploadedFilesUI();


    // Handle ZIP files first if present (as they might contain multiple files)
    const zipFile = filesToProcess.find(f => f.name.toLowerCase().endsWith('.zip'));
    if (zipFile) {
        document.getElementById('platformZipPasswordContainer').style.display = 'block';
        document.getElementById('platformZipPassword').focus();
        currentZipFile = zipFile; // Store the ZIP file
        updateStatus("Enter password for ZIP file if it's protected, then click 'Process ZIP'. Other files will be processed after.");
        // Do not process other files yet if a ZIP is present and needs a password.
        // The actual ZIP processing will handle subsequent files.
        return; 
    }
    
    // If no ZIP, or if ZIP processing will call this again, proceed with other files
    processFilesSequentially(filesToProcess);
}


async function processFilesSequentially(files) {
    let localBatchParsedCalls = []; // Accumulate calls from this specific batch of files

    for (const file of files) {
        if (file.name.toLowerCase().endsWith('.zip')) continue; // Skip ZIP here, handled by processZipWithPassword

        const fileName = file.name.toLowerCase();
        updateStatus(`⏳ Processing ${file.name}...`);

        try {
            if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
                const newCalls = await processSpreadsheetFile(file);
                if (newCalls) localBatchParsedCalls.push(...newCalls);
            } else if (fileName.endsWith('.txt') || fileName.endsWith('.html') || fileName.endsWith('.json')) {
                const newCalls = await processTextOrJsonFile(file);
                if (newCalls) localBatchParsedCalls.push(...newCalls);
            } else {
                updateStatus(`⚠️ File type for ${file.name} not directly supported for parsing. Skipping.`, true);
                uploadedFiles.push(`${file.name} (skipped - unsupported type)`);
            }
        } catch (error) {
            updateStatus(`❌ Error processing ${file.name}: ${error.message}`, true);
            uploadedFiles.push(`${file.name} (error)`);
        }
        updateUploadedFilesUI(); // Update UI after each file attempt
    }

    if (localBatchParsedCalls.length > 0) {
        // Merge with any calls that might have been parsed from a previous step (e.g. ZIP)
        // For now, assuming this is the main path or ZIP processing will call transmit directly.
        parsedCalls = localBatchParsedCalls; // This replaces global parsedCalls
        transmitDataToPlatform(parsedCalls);
    } else if (files.length > 0 && !files.some(f => f.name.toLowerCase().endsWith('.zip'))) {
         // Only show "no calls found" if not waiting for ZIP.
        updateStatus('No calls were successfully parsed from the selected files.', true);
        transmitDataToPlatform([]); // Send empty array to clear dashboard
    }
    // If a ZIP was processed, its own flow will call transmitDataToPlatform.
}


async function processTextOrJsonFile(file) {
    const content = await file.text();
    uploadedFiles.push(`${file.name} (text/json)`);
    if (file.name.toLowerCase().endsWith('.json')) {
        try {
            const jsonData = JSON.parse(content);
            if (!Array.isArray(jsonData)) throw new Error("JSON content is not an array.");
            // Assume JSON data is already in the correct `parsedCalls` format
            // Need to ensure no duplicates if multiple JSONs are loaded.
            let newCalls = [];
            for(const call of jsonData){
                const contactId = call.meta && call.meta["Contact ID"];
                if(contactId && contactIdSet.has(contactId)){
                    console.warn("Skipping duplicate Contact ID from JSON:", contactId);
                    continue;
                }
                if(contactId) contactIdSet.add(contactId);
                newCalls.push(call);
            }
            return newCalls;
        } catch (e) {
            throw new Error(`Invalid JSON file ${file.name}: ${e.message}`);
        }
    } else { // TXT or HTML
        return parseContent(content); // This function handles duplicates with contactIdSet
    }
}

async function processZipFileWithPassword() {
    const passwordInput = document.getElementById('platformZipPassword');
    const password = passwordInput.value;

    if (!currentZipFile) {
        updateStatus("❌ No ZIP file selected for processing.", true);
        return;
    }

    updateStatus("⏳ Extracting ZIP file...");
    const zip = new JSZip();
    try {
        const zipData = await currentZipFile.arrayBuffer();
        const zipContents = await zip.loadAsync(zipData, { password: password || undefined });
        
        const filesToProcessFromZip = [];
        const filePromises = [];

        zipContents.forEach((relativePath, zipEntry) => {
            if (!zipEntry.dir && (relativePath.toLowerCase().endsWith('.txt') || relativePath.toLowerCase().endsWith('.html') || relativePath.toLowerCase().endsWith('.json') || relativePath.toLowerCase().endsWith('.csv') || relativePath.toLowerCase().endsWith('.xlsx') || relativePath.toLowerCase().endsWith('.xls'))) {
                filePromises.push(
                    zipEntry.async('blob').then(blob => {
                        // Create a File object from the blob to reuse existing parsers
                        const extractedFile = new File([blob], relativePath, { type: blob.type });
                        filesToProcessFromZip.push(extractedFile);
                        uploadedFiles.push(`${currentZipFile.name} -> ${relativePath}`);
                    })
                );
            }
        });

        await Promise.all(filePromises);
        updateUploadedFilesUI();

        if (filesToProcessFromZip.length === 0) {
            updateStatus(`❌ No valid TXT, HTML, JSON, CSV or XLSX files found in ${currentZipFile.name}.`, true);
            return;
        }

        updateStatus(`⏳ Processing ${filesToProcessFromZip.length} files from ${currentZipFile.name}...`);
        // Reset password field and hide container
        passwordInput.value = '';
        document.getElementById('platformZipPasswordContainer').style.display = 'none';
        
        // Process these extracted files
        let allCallsFromZip = [];
        for (const file of filesToProcessFromZip) {
            try {
                let newCalls;
                if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls') || file.name.toLowerCase().endsWith('.csv')) {
                     newCalls = await processSpreadsheetFile(file);
                } else { // txt, html, json
                     newCalls = await processTextOrJsonFile(file);
                }
                if(newCalls) allCallsFromZip.push(...newCalls);
            } catch (error) {
                 updateStatus(`❌ Error processing ${file.name} from ZIP: ${error.message}`, true);
            }
        }
        currentZipFile = null; // Clear current ZIP
        
        // Here, parsedCalls should be replaced by allCallsFromZip or merged
        parsedCalls = allCallsFromZip;
        transmitDataToPlatform(parsedCalls);

    } catch (error) {
        updateStatus(`❌ Error processing ZIP ${currentZipFile.name}: ${error.message}. Check password or file.`, true);
        console.error("ZIP processing error:", error);
        currentZipFile = null; 
    }
}


async function processSpreadsheetFile(file) {
    const fileName = file.name.toLowerCase();
    const fileData = await file.arrayBuffer();
    let data;

    if (fileName.endsWith('.csv')) {
        const text = await file.text();
        return new Promise((resolve, reject) => {
            Papa.parse(text, {
                header: true,
                skipEmptyLines: true,
                complete: results => {
                    if (results.errors.length > 0) {
                        console.error("CSV parsing errors:", results.errors);
                        reject(new Error(`CSV parsing error in ${file.name}: ${results.errors[0].message}`));
                        return;
                    }
                    const processed = processSpreadsheetData(results.data, file.name);
                    uploadedFiles.push(`${file.name} (spreadsheet)`);
                    resolve(processed);
                },
                error: error => reject(new Error(`PapaParse error for ${file.name}: ${error.message}`))
            });
        });
    } else { // XLSX or XLS
        const workbook = XLSX.read(fileData, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) throw new Error(`No sheets found in Excel file ${file.name}`);
        const worksheet = workbook.Sheets[firstSheetName];
        data = XLSX.utils.sheet_to_json(worksheet, { defval: "" }); // Ensure empty cells are empty strings
        const processed = processSpreadsheetData(data, file.name);
        uploadedFiles.push(`${file.name} (spreadsheet)`);
        return processed;
    }
}

function isMetadataOnlyFormat(data) {
    if (!data || data.length === 0) return false;
    const firstRow = data[0];
    const hasMetadataFields = firstRow.hasOwnProperty('Contact ID') || firstRow.hasOwnProperty('ContactID') || firstRow.hasOwnProperty('tact ID');
    const lacksTranscriptFields = !firstRow.hasOwnProperty('transcript') && !firstRow.hasOwnProperty('Issue') && !firstRow.hasOwnProperty('Outcome') && !firstRow.hasOwnProperty('text') && !firstRow.hasOwnProperty('Message');
    return hasMetadataFields && lacksTranscriptFields;
}

function enhanceExistingCallsWithCSV(data, fileName) {
    if (parsedCalls.length === 0) {
        // Option: Process as new calls if user confirms.
        // For now, just log and return as this case might be complex for platform.
        updateStatus(`⚠️ No existing calls to enhance with ${fileName}. Load transcript data first.`, true);
        return 0; // No calls added or enhanced
    }

    const existingCallMap = new Map();
    parsedCalls.forEach(call => {
        const contactId = call.meta["Contact ID"];
        if (contactId && contactId !== "N/A" && contactId !== "Unknown") {
            existingCallMap.set(contactId, call);
        }
    });

    let enhancedCount = 0;
    let notFoundCount = 0;

    data.forEach(row => {
        const contactId = row['Contact ID'] || row['ContactID'] || row['tact ID'] || row['contact_id'];
        if (!contactId) return;

        const existingCall = existingCallMap.get(contactId);
        if (existingCall) {
            enhancedCount++;
            Object.entries(row).forEach(([key, value]) => {
                if (value && value !== "" && value !== "N/A") { // Only update with meaningful values
                    let normalizedKey = key;
                    if (key === 'tact ID') normalizedKey = 'Contact ID';
                    else if (key === 'System phone number') normalizedKey = 'System phone number / email address';
                    else if (key === 'Customer phone number') normalizedKey = 'Customer phone number / email address';
                    
                    if (existingCall.meta[normalizedKey] === undefined || existingCall.meta[normalizedKey] === "N/A" || existingCall.meta[normalizedKey] === "") {
                         existingCall.meta[normalizedKey] = value;
                    } else if (String(existingCall.meta[normalizedKey]).toLowerCase() !== String(value).toLowerCase()) {
                        // Potentially log conflicts or decide on an update strategy
                        // For now, prefer existing non-empty data unless explicitly told otherwise
                        // console.log(`Metadata conflict for ${contactId} - Key: ${normalizedKey}, Existing: "${existingCall.meta[normalizedKey]}", New: "${value}"`);
                    }
                }
            });
        } else {
            notFoundCount++;
        }
    });
    
    updateStatus(`Enhanced ${enhancedCount} calls with metadata from ${fileName}. ${notFoundCount} IDs not found.`);
    return enhancedCount; // Return number of calls enhanced, not new calls.
}


function processSpreadsheetData(data, fileName) {
    if (!data || data.length === 0) {
        updateStatus(`❌ No valid data found in spreadsheet ${fileName}`, true);
        return [];
    }
    
    // Check if this is metadata only and we have existing calls
    if (parsedCalls.length > 0 && isMetadataOnlyFormat(data)) {
        enhanceExistingCallsWithCSV(data, fileName);
        return []; // Enhancement modifies existing `parsedCalls`, doesn't return new ones for this flow
    }


    updateStatus(`⏳ Converting ${data.length} spreadsheet rows from ${fileName} to call format...`);
    let localConvertedCalls = [];
    let duplicateCount = 0;

    const isOurFormat = data[0] && (data[0].hasOwnProperty('Contact ID') || data[0].hasOwnProperty('contactId') || data[0].hasOwnProperty('meta') || data[0].hasOwnProperty("Raw JSON Data (Do not modify)"));

    if (data[0] && data[0].hasOwnProperty("Raw JSON Data (Do not modify)")) {
        // Handle re-import of "Audit Template" export
        try {
            const rawJsonString = data[0]["Raw JSON Data (Do not modify)"];
            // This might be an array of calls, or a single call. For now, assume it's one call per row.
            // If it's an array of calls in one cell, that's more complex.
            // The original index.html `exportToAuditTemplate` put one compressed call per row.
            
            for (const row of data) {
                 const jsonCell = row["Raw JSON Data (Do not modify)"];
                 if (jsonCell) {
                    try {
                        const callData = JSON.parse(jsonCell);
                        // callData is expected to be a single call object here based on how exportToAuditTemplate creates it
                        const contactId = callData.contactId || (callData.meta && callData.meta["Contact ID"]);
                        if (contactId && contactIdSet.has(contactId)) {
                            duplicateCount++;
                            continue;
                        }
                        if (contactId) contactIdSet.add(contactId);

                        // Reconstruct the call object
                        localConvertedCalls.push({
                            meta: callData.meta || { "Contact ID": contactId, "Agent name": callData.agent, "Initiation timestamp": callData.timestamp },
                            transcript: callData.transcript || (callData.transcriptSummary ? [{speaker:"System", text:`Transcript summary: ${callData.transcriptSummary.count} entries`, timestamp:"00:00"}] : []),
                            flags: callData.flags || [],
                            positiveFlags: callData.positiveFlags || [],
                            issue: callData.issue || "",
                            outcome: callData.outcome || "",
                            summary: callData.summary || "",
                            positiveScore: callData.positiveScore !== undefined ? callData.positiveScore : (callData.positiveFlags || []).length - (callData.flags || []).length
                        });

                    } catch (e) { console.warn("Skipping row due to JSON parse error in Raw Data:", e, jsonCell); }
                 }
            }
        } catch (e) {
            updateStatus(`Error processing Raw JSON Data from ${fileName}: ${e.message}`, true);
            // Fallback to standard row processing might be an option here.
        }

    } else if (isOurFormat) {
        for (const row of data) {
            const contactId = row['Contact ID'] || row.contactId || (row.meta && row.meta['Contact ID']) || `spreadsheet-${Date.now()}-${Math.random()}`;
            if (contactIdSet.has(contactId) && !(contactId.startsWith('spreadsheet-'))) { // Allow generated IDs
                duplicateCount++;
                continue;
            }
            contactIdSet.add(contactId);

            const meta = (typeof row.meta === 'object' && row.meta !== null) ? row.meta : {
                "Contact ID": contactId,
                "Agent name": row['Agent name'] || row.agent || row['Agent'] || "Unknown",
                "Initiation timestamp": row['Initiation timestamp'] || row.timestamp || new Date().toISOString(),
                "Contact duration": row['Contact duration'] || row.duration || "0",
                "Channel": row['Channel'] || "Unknown",
            };
            // Ensure core fields are present in meta
            if(!meta["Contact ID"]) meta["Contact ID"] = contactId;
            if(!meta["Agent name"] && !meta["Agent"]) meta["Agent name"] = "Unknown";


            let transcript = [];
            if (row.transcript) {
                if (Array.isArray(row.transcript)) {
                    transcript = row.transcript.map(entry => (typeof entry === 'object' ? {speaker: entry.speaker || "System", timestamp: entry.timestamp || "00:00", text: entry.text || "", flags: entry.flags || [], positiveFlags: entry.positiveFlags || []} : {speaker:"System", timestamp:"00:00", text: String(entry), flags:[], positiveFlags:[]}));
                } else if (typeof row.transcript === 'string') {
                     transcript = [{ speaker: "System", timestamp: "00:00", text: row.transcript, flags: [], positiveFlags: [] }];
                }
            } else if (row.Speaker && row.Message) { // Flattened transcript
                 transcript = [{ speaker: row.Speaker || "Unknown", timestamp: row.Timestamp || "00:00", text: row.Message || "", flags: [], positiveFlags: [] }];
            }


            localConvertedCalls.push({
                meta,
                transcript,
                flags: row.flags ? (Array.isArray(row.flags) ? row.flags : String(row.flags).split(';').map(f=>f.trim())) : [],
                positiveFlags: row.positiveFlags ? (Array.isArray(row.positiveFlags) ? row.positiveFlags : String(row.positiveFlags).split(';').map(f=>f.trim())) : [],
                issue: row.issue || "",
                outcome: row.outcome || "",
                summary: row.summary || "",
                positiveScore: row.positiveScore !== undefined ? row.positiveScore : (row.positiveFlags ? (Array.isArray(row.positiveFlags) ? row.positiveFlags.length : String(row.positiveFlags).split(';').length) : 0) - (row.flags ? (Array.isArray(row.flags) ? row.flags.length : String(row.flags).split(';').length) : 0)
            });
        }
    } else { // Generic CSV/Excel
        for (const row of data) {
            let contactId = "Unknown";
            const idCandidates = ['contact id', 'contactid', 'id', 'callid', 'call id'];
            for (const key in row) {
                if (idCandidates.includes(key.toLowerCase())) { contactId = row[key]; break; }
            }
            if (contactId === "Unknown") contactId = `generic-${Date.now()}-${Math.random()}`;
            
            if (contactIdSet.has(contactId) && !contactId.startsWith('generic-')) {
                duplicateCount++;
                continue;
            }
            contactIdSet.add(contactId);

            let agent = "Unknown";
            const agentCandidates = ['agent name', 'agent', 'rep name', 'employee name'];
             for (const key in row) {
                if (agentCandidates.includes(key.toLowerCase())) { agent = row[key]; break; }
            }

            let timestamp = new Date().toISOString();
            const timeCandidates = ['timestamp', 'initiation timestamp', 'date', 'call time'];
            for (const key in row) {
                if (timeCandidates.includes(key.toLowerCase())) { timestamp = row[key]; break; }
            }
            
            let textContent = "";
            const textCandidates = ['text', 'transcript', 'message', 'notes', 'description'];
            for (const key in row) {
                if (textCandidates.includes(key.toLowerCase())) { textContent = row[key]; break; }
            }

            const meta = { "Contact ID": contactId, "Agent name": agent, "Initiation timestamp": timestamp, "Source": fileName };
            Object.keys(row).forEach(key => { // Add all other columns as metadata
                if (!meta.hasOwnProperty(key) && !idCandidates.includes(key.toLowerCase()) && !agentCandidates.includes(key.toLowerCase()) && !timeCandidates.includes(key.toLowerCase()) && !textCandidates.includes(key.toLowerCase()) ) {
                    meta[key] = row[key];
                }
            });

            const transcript = textContent ? [{ speaker: "System", text: textContent, timestamp: "00:00", flags:[], positiveFlags:[] }] : [];
            
            const tempFlags = []; // Basic flag detection from textContent
            const tempPosFlags = [];
            if(textContent){
                triggers.forEach(t => { if(textContent.toLowerCase().includes(t)) tempFlags.push(t); });
                positiveTriggers.forEach(pt => { if(textContent.toLowerCase().includes(pt)) tempPosFlags.push(pt); });
            }

            localConvertedCalls.push({
                meta, transcript, 
                flags: tempFlags, positiveFlags: tempPosFlags, 
                issue: "", outcome: "", summary: textContent.substring(0,200), // use part of text as summary
                positiveScore: tempPosFlags.length - tempFlags.length
            });
        }
    }
    
    let statusText = `✅ Converted ${localConvertedCalls.length} rows from ${fileName}`;
    if (duplicateCount > 0) statusText += ` (skipped ${duplicateCount} duplicates)`;
    updateStatus(statusText);
    
    return localConvertedCalls;
}


// Main content parser for .txt/.html files (Fragile by design, from index.html)
function parseContent(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim());
    const calls = [];
    let i = 0;
    let duplicateCountInThisFile = 0;

    while (i < lines.length) {
        if (CONTACT_ID_REGEX.test(lines[i])) {
            const contactId = lines[i];
            if (contactIdSet.has(contactId)) {
                duplicateCountInThisFile++;
                while (i < lines.length && (!CONTACT_ID_REGEX.test(lines[i]) || lines[i] === contactId)) {
                    i++;
                }
                continue;
            }
            contactIdSet.add(contactId);

            const meta = {};
            metadataFieldOrder.forEach(field => { meta[field] = "N/A"; });
            meta["Contact ID"] = contactId;
            i++;
            while (i < lines.length && !lines[i]) i++; // Skip empty lines

            if (i < lines.length) { // Short metadata
                const shortMetaValues = lines[i++].split("\t");
                for (let j = 0; j < shortMetadataFields.length && j < shortMetaValues.length; j++) {
                    meta[shortMetadataFields[j]] = shortMetaValues[j] || "N/A";
                }
                while (i < lines.length && !lines[i]) i++;
                if (i < lines.length) { // Long metadata
                    const longMetaValues = lines[i++].split("\t");
                    for (let j = 0; j < longMetadataFields.length && j < longMetaValues.length; j++) {
                        meta[longMetadataFields[j]] = longMetaValues[j] || "N/A";
                    }
                }
            }

            const transcript = [];
            const flags = new Set(); // Use Set to avoid duplicate flags per call
            const positiveFlags = new Set(); // Use Set for positive flags
            let issue = "", outcome = "", summary = "";
            let currentLabel = "";
            let categories = "";
            let inTranscriptSection = false;
            let foundTranscriptMarker = false;

            while (i < lines.length && !CONTACT_ID_REGEX.test(lines[i])) {
                const line = lines[i];
                if (!line) { i++; continue; }

                if (!foundTranscriptMarker && line.trim().toLowerCase() === "transcript") {
                    foundTranscriptMarker = true; i++; continue;
                }
                if (line.trim().toLowerCase() === "categories") {
                    currentLabel = "categories"; i++; continue;
                }

                if (foundTranscriptMarker && !inTranscriptSection) {
                    if (["agent", "customer", "system"].includes(line.trim().toLowerCase())) {
                        inTranscriptSection = true;
                        if (currentLabel === "categories") currentLabel = "";
                        // Don't i++ here, process this line as start of transcript
                    } else {
                        if (currentLabel === "categories") categories += line + ", ";
                        i++; continue;
                    }
                }

                if (inTranscriptSection) {
                    if (currentLabel === "categories") currentLabel = "";
                    const isSpeakerLine = ["agent", "customer", "system"].includes(line.trim().toLowerCase());
                    if (isSpeakerLine && i + 2 < lines.length) {
                        const speaker = line.trim();
                        const timestampLine = lines[i + 1];
                        const timeMatch = timestampLine.match(/^\d{2}:\d{2}/);
                        if (timeMatch) {
                            const textContent = lines[i + 2] || "";
                            const currentLineFlags = triggers.filter(t => textContent.toLowerCase().includes(t));
                            const currentLinePosFlags = positiveTriggers.filter(t => textContent.toLowerCase().includes(t));
                            
                            transcript.push({ speaker, timestamp: timestampLine, text: textContent, flags: currentLineFlags, positiveFlags: currentLinePosFlags });
                            currentLineFlags.forEach(f => flags.add(f));
                            currentLinePosFlags.forEach(pf => positiveFlags.add(pf));
                            i += 3; continue;
                        }
                    }
                    i++; continue; // If not a structured transcript line, move on
                }

                const lowerLine = line.toLowerCase();
                if (["audio", "summary", "issue", "outcome"].includes(lowerLine)) {
                    currentLabel = lowerLine === "audio" ? "" : lowerLine;
                    i++; continue;
                }
                if (currentLabel) {
                    const clean = line.replace(/^Generated by AI\s*/i, "").trim();
                    if (currentLabel === "issue") issue += clean + " ";
                    else if (currentLabel === "outcome") outcome += clean + " ";
                    else if (currentLabel === "summary") summary += clean + " ";
                    else if (currentLabel === "categories") categories += clean + ", ";
                }
                i++;
            }
            if (categories) meta["Categories"] = categories.replace(/,\s*$/, "").trim();
            
            calls.push({
                meta, transcript,
                flags: Array.from(flags),
                positiveFlags: Array.from(positiveFlags),
                issue: issue.trim(), outcome: outcome.trim(), summary: summary.trim(),
                positiveScore: positiveFlags.size - flags.size
            });
        } else {
            i++;
        }
    }
    if (duplicateCountInThisFile > 0) {
        updateStatus(`Note: Skipped ${duplicateCountInThisFile} duplicate Contact IDs within one of the TXT/HTML files.`);
    }
    return calls;
}

// Fallback parsing strategies (less structured data)
function parseAlternativeFormat(text) {
    // ... (Implementation of parseAlternativeFormat from index.html - complex and long)
    // This is a simplified placeholder for brevity in this step.
    // The full function from index.html should be placed here.
    console.warn("parseAlternativeFormat called, but using simplified placeholder. Full logic needed.");
    return createSyntheticCall(text); // Fallback to synthetic if alternative is not fully implemented here
}

function createSyntheticCall(text) {
    // ... (Implementation of createSyntheticCall from index.html - complex and long)
    // This is a simplified placeholder.
    console.warn("createSyntheticCall called, but using simplified placeholder. Full logic needed.");
    const meta = { "Contact ID": `synthetic-${Date.now()}`, "Agent name": "Unknown", "Initiation timestamp": new Date().toISOString() };
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    const transcript = lines.map(line => ({ speaker: "Unknown", text: line, timestamp: "00:00", flags:[], positiveFlags:[] }));
    let flags = [], positiveFlags = [];
    if(text){
        triggers.forEach(t => { if(text.toLowerCase().includes(t)) flags.push(t); });
        positiveTriggers.forEach(pt => { if(text.toLowerCase().includes(pt)) positiveFlags.push(pt); });
    }
    return [{ meta, transcript, flags, positiveFlags, issue: "", outcome: "", summary: text.substring(0, 200), positiveScore: positiveFlags.length - flags.length }];
}


// --- Initialization ---
export function initializeFileUploader() {
    const dropZone = document.getElementById('dropZone'); // This is the ID in inspiro_platform.html
    const fileInput = document.getElementById('platformFileInput');
    const processZipButton = document.getElementById('platformProcessZipButton');

    if (!dropZone || !fileInput || !processZipButton) {
        console.error('File uploader DOM elements not found in inspiro_platform.html. Parser cannot be initialized.');
        updateStatus('Error: Uploader UI component missing.', true);
        return;
    }

    dropZone.addEventListener('dragover', (event) => {
        event.stopPropagation();
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        dropZone.style.borderColor = '#a43ec9';
    });

    dropZone.addEventListener('dragleave', (event) => {
        dropZone.style.borderColor = '#555';
    });

    dropZone.addEventListener('drop', (event) => {
        event.stopPropagation();
        event.preventDefault();
        dropZone.style.borderColor = '#555';
        const files = event.dataTransfer.files;
        if (files.length) {
            // fileInput.files = files; // This doesn't work for security reasons with drop.
            processAndRelayFiles(Array.from(files));
        }
    });

    fileInput.addEventListener('change', (event) => {
        const files = event.target.files;
        processAndRelayFiles(Array.from(files));
        event.target.value = null; // Clear the input
    });

    processZipButton.addEventListener('click', processZipFileWithPassword);
    
    const clearButton = document.getElementById('platformClearDataButton'); // Assuming you'll add a clear button
    if (clearButton) {
        clearButton.addEventListener('click', () => {
            parsedCalls = [];
            contactIdSet.clear();
            uploadedFiles = [];
            updateUploadedFilesUI();
            transmitDataToPlatform([]); // Send empty array to clear dashboard
            updateStatus('Data cleared. Ready for new files.');
            document.getElementById('platformZipPasswordContainer').style.display = 'none';
            if(document.getElementById('platformZipPassword')) document.getElementById('platformZipPassword').value = '';

        });
    }


    updateStatus('File uploader initialized. Ready for files.');
}

// Utility: Helper function to format duration in seconds to HH:MM:SS (if needed by parser, unlikely)
// function formatDuration(seconds) { /* ... from index.html if used ... */ }
// Utility: getWeekEndingDate (if needed by parser, unlikely)
// function getWeekEndingDate(date) { /* ... from index.html if used ... */ }

console.log('js/fileParser.js loaded and initialized.'); 