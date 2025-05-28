window.updateMasterLogCache = async function (newEntries = []) {
  if (!window.DataStackULTRA) {
    console.error("DataStackULTRA is not initialized.");
    return [];
  }
  // Get the current master log cache from DataStackULTRA
  const existingCache = await window.DataStackULTRA.get('masterLogCache', []);

  const merged = [...existingCache];

  for (const entry of newEntries) {
    // Try to get contactId from multiple possible locations for flexibility
    const contactId = entry.contactId || 
                      (entry.meta && entry.meta.contactId) || 
                      (entry.meta && entry.meta["Contact ID"]);

    if (!contactId) {
      console.warn("Entry without a clear contactId found, skipping merge for this entry:", entry);
      // Optionally, add to merged array if new entries without ID should always be added
      // merged.push(entry); 
      continue;
    }

    const index = merged.findIndex(e => {
      const existingContactId = e.contactId || 
                                (e.meta && e.meta.contactId) || 
                                (e.meta && e.meta["Contact ID"]);
      return existingContactId === contactId;
    });

    if (index >= 0) {
      // Merge shallow: existing properties are kept, new/updated properties from 'entry' are added/overwritten.
      // This means if merged[index] has a field and entry also has it, entry's value will be used.
      // If the goal is to only add new fields from 'entry' and not overwrite existing ones, a more complex merge is needed.
      merged[index] = { ...merged[index], ...entry };
    } else {
      merged.push(entry);
    }
  }

  // Save the updated cache back to DataStackULTRA
  await window.DataStackULTRA.set('masterLogCache', merged);
  console.log("masterLogCache updated in DataStackULTRA:", merged);
  return merged;
};

// The saveMasterLogBackup and loadMasterLogBackup functions are no longer needed
// as DataStackULTRA handles the persistence and encryption of 'masterLogCache'.

// The auto-load logic previously in comments here will be handled in index.js
// using window.DataStackULTRA.get('masterLogCache', []);

// Optional: Auto-load backup when DataStackULTRA is ready, if not already populated
// This could be called from index.js after DataStackULTRA init.
/*
if (window.DataStackULTRA) {
    (async () => {
        const existingLog = await window.DataStackULTRA.get('masterLog', []);
        if (!existingLog || existingLog.length === 0) {
            await window.loadMasterLogBackup();
        }
    })();
}
*/ 