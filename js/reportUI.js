// reportUI.js
// UI tools for report export, copy, and print preview

function initializeReportUI(reportContentElementId, copyButtonId) {
    const reportContentElement = document.getElementById(reportContentElementId);
    const copyButton = document.getElementById(copyButtonId);

    if (!reportContentElement || !copyButton) {
        console.warn("Report UI elements not found. Ensure reportContentElementId (", reportContentElementId, ") and copyButtonId (", copyButtonId, ") are correct.");
        return;
    }

    copyButton.addEventListener('click', () => {
        copyReportToClipboard(reportContentElement, copyButton);
    });
}

function copyReportToClipboard(reportElement, buttonElement) {
    if (!reportElement) return;

    const range = document.createRange();
    range.selectNodeContents(reportElement);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    let success = false;
    try {
        success = document.execCommand('copy');
    } catch (err) {
        console.error('Error copying report to clipboard:', err);
    }

    selection.removeAllRanges();

    if (buttonElement) {
        const originalText = buttonElement.textContent;
        if (success) {
            buttonElement.textContent = 'Copied!';
            buttonElement.style.backgroundColor = '#4caf50'; // Positive feedback color
        } else {
            buttonElement.textContent = 'Copy Failed';
            buttonElement.style.backgroundColor = '#ff4d4d'; // Negative feedback color
        }
        setTimeout(() => {
            buttonElement.textContent = originalText;
            buttonElement.style.backgroundColor = ''; // Revert to original/CSS color
        }, 2000);
    } else {
        // Fallback alert if buttonElement is not provided, though it should be.
        if (success) {
            alert("Report content copied to clipboard!");
        } else {
            alert("Failed to copy report content.");
        }
    }
}

// Example Usage (would typically be called from dashboard.js or similar when the tab loads):
// document.addEventListener('DOMContentLoaded', () => {
// if (document.getElementById('repeatSummaryBlock') && document.getElementById('copyCoachingSummaryButton')) {
// initializeReportUI('repeatSummaryBlock', 'copyCoachingSummaryButton'); 
// }
// });
