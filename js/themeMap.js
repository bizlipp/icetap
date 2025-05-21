// js/themeMap.js
// Maps specific flags to broader themes for analysis.

const themeMap = {
  // Billing & Payments
  "billing issue": "Billing",
  "payment failed": "Billing",
  "refund request": "Billing",
  "late fee": "Billing",
  "dispute charge": "Billing",
  "invoice": "Billing",
  "payment": "Billing",
  "charge": "Billing",
  "bill": "Billing",

  // Technical Support
  "no service": "Technical",
  "internet down": "Technical",
  "slow speed": "Technical",
  "cannot login": "Technical",
  "equipment issue": "Technical",
  "tv issue": "Technical",
  "outage": "Technical",
  "technical support": "Technical",
  "issue": "Technical", // Generic, but often tech
  "problem": "Technical", // Generic, but often tech

  // Account Management
  "update address": "Account",
  "change plan": "Account",
  "cancel service": "Account",
  "add user": "Account",
  "account access": "Account",
  "password reset": "Account",

  // Agent Tone & Behavior / Call Experience
  "rude agent": "Agent Behavior",
  "agent hung up": "Agent Behavior",
  "long hold": "Call Experience",
  "unhelpful agent": "Agent Behavior",
  "language barrier": "Call Experience",
  "supervisor request": "Call Experience",
  "escalate": "Call Experience", // Could also be process
  "disconnected": "Call Experience", // If agent caused
  "hang up": "Call Experience", // If agent caused

  // Call Handling & Process
  "transfer": "Process",
  "callback request": "Process",
  "issue not resolved": "Resolution Failure",
  "problem not fixed": "Resolution Failure",
  "still an issue": "Resolution Failure",
  "not resolved": "Resolution Failure",

  // Product/Service Issues
  "defective product": "Product Issue",
  "missing item": "Product Issue",
  "wrong item": "Product Issue",
  "product question": "Product Inquiry",

  // Sentiment/General
  "complaint": "Complaint",
  "frustrated": "Sentiment-Negative",
  "confused": "Sentiment-Negative",
  "upset": "Sentiment-Negative",

  // Add more mappings as needed based on your specific flags
};

// Function to get theme for a flag, defaults to 'General Inquiry' or the flag itself if not mapped.
function getFlagTheme(flag) {
  if (!flag) return 'Other';
  const lowerFlag = flag.toLowerCase().trim();

  // Exact match first
  if (themeMap[lowerFlag]) {
    return themeMap[lowerFlag];
  }

  // Partial match (more specific first)
  for (const key in themeMap) {
    if (lowerFlag.includes(key)) {
      return themeMap[key];
    }
  }
  
  // Generic keyword matching as a fallback
  if (lowerFlag.includes('bill') || lowerFlag.includes('payment') || lowerFlag.includes('charge') || lowerFlag.includes('refund') || lowerFlag.includes('invoice')) return 'Billing';
  if (lowerFlag.includes('tech') || lowerFlag.includes('service') || lowerFlag.includes('internet') || lowerFlag.includes('login') || lowerFlag.includes('password') || lowerFlag.includes('outage') || lowerFlag.includes('problem') || lowerFlag.includes('issue')) return 'Technical';
  if (lowerFlag.includes('account') || lowerFlag.includes('plan') || lowerFlag.includes('cancel') || lowerFlag.includes('address')) return 'Account';
  if (lowerFlag.includes('agent') || lowerFlag.includes('supervisor') || lowerFlag.includes('hold') || lowerFlag.includes('rude') || lowerFlag.includes('unhelpful')) return 'Agent Interaction';
  if (lowerFlag.includes('escalate') || lowerFlag.includes('hang up') || lowerFlag.includes('disconnect') || lowerFlag.includes('transfer')) return 'Call Handling';
  if (lowerFlag.includes('resolve') || lowerFlag.includes('fixed') || lowerFlag.includes('still')) return 'Resolution';
  if (lowerFlag.includes('product') || lowerFlag.includes('item')) return 'Product';

  // Capitalize first letter of flag if no theme found, for better display
  let themedFlag = flag.charAt(0).toUpperCase() + flag.slice(1);
  // If still generic, classify as Other
  if (themedFlag.length > 25) return "Other"; // Too long, likely not a good theme name
  if (!themedFlag.match(/^[A-Z][a-z\s]+$/) && !Object.values(themeMap).includes(themedFlag)) return "Other";


  return themedFlag; 
} 