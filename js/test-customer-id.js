/**
 * Customer ID Integration Test Script
 * This script helps verify that the customerId field and repeat call detection 
 * are working correctly across the ICETAP system.
 */

// Create synthetic test calls with known customerIds
function createTestCalls() {
  const baseTime = new Date();
  
  // Generate sample calls with consistent customerId fields
  const calls = [
    {
      meta: {
        "Contact ID": "test-00001",
        "Customer phone number / email address": "customer1@example.com",
        "Initiation timestamp": new Date(baseTime.getTime() - 3600000).toISOString() // 1 hour ago
      },
      transcript: [{ speaker: "Agent", timestamp: "00:01", text: "Hello" }],
      flags: [],
      positiveFlags: []
    },
    {
      meta: {
        "Contact ID": "test-00002",
        "Customer phone number / email address": "customer1@example.com", // Same customer as above
        "Initiation timestamp": baseTime.toISOString() // Now
      },
      transcript: [{ speaker: "Agent", timestamp: "00:01", text: "Hello again" }],
      flags: [],
      positiveFlags: []
    },
    {
      meta: {
        "Contact ID": "test-00003",
        "Customer phone number / email address": "customer2@example.com", // Different customer
        "Initiation timestamp": baseTime.toISOString()
      },
      transcript: [{ speaker: "Agent", timestamp: "00:01", text: "Hello" }],
      flags: [],
      positiveFlags: []
    }
  ];
  
  return calls;
}

// Run the tests
async function runCustomerIdTests() {
  console.log("🧪 Running Customer ID Integration Tests...");
  
  // Create test calls
  const testCalls = createTestCalls();
  console.log(`Created ${testCalls.length} test calls`);
  
  // Test 1: Apply normalizeCustomerIds
  console.log("\nTest 1: TransformManager.normalizeCustomerIds");
  if (window.TransformManager && typeof window.TransformManager.normalizeCustomerIds === 'function') {
    // Test TransformManager.normalizeCustomerIds
    const normalizedCalls = window.TransformManager.normalizeCustomerIds([...testCalls]);
    const hasCustomerIds = normalizedCalls.every(call => call.customerId);
    console.log(`✅ TransformManager.normalizeCustomerIds found: ${hasCustomerIds ? "PASS" : "FAIL"}`);
    console.log(`Sample customerIds:`, normalizedCalls.map(c => c.customerId));
  } else {
    console.log("❌ TransformManager.normalizeCustomerIds not found");
  }
  
  // Test 2: Call Analyzer Grouping
  console.log("\nTest 2: CallAnalyzer.groupByCustomer");
  if (window.CallAnalyzer && typeof window.CallAnalyzer.groupByCustomer === 'function') {
    // Test groupByCustomer
    const normalizedCalls = testCalls.map(call => {
      call.customerId = call.meta?.["Customer phone number / email address"]?.trim() || null;
      return call;
    });
    
    const grouped = window.CallAnalyzer.groupByCustomer(normalizedCalls);
    const uniqueCustomers = Object.keys(grouped).length;
    const customersWithMultipleCalls = Object.values(grouped).filter(g => g.length > 1).length;
    
    console.log(`✅ CallAnalyzer.groupByCustomer found ${uniqueCustomers} unique customers`);
    console.log(`✅ Customers with multiple calls: ${customersWithMultipleCalls}`);
    console.log(`Result: ${uniqueCustomers === 2 && customersWithMultipleCalls === 1 ? "PASS" : "FAIL"}`);
  } else {
    console.log("❌ CallAnalyzer.groupByCustomer not found");
  }
  
  // Test 3: Mark Repeat Calls
  console.log("\nTest 3: CallAnalyzer.markRepeatCalls");
  if (window.CallAnalyzer && typeof window.CallAnalyzer.markRepeatCalls === 'function') {
    // Test markRepeatCalls
    const normalizedCalls = testCalls.map(call => {
      call.customerId = call.meta?.["Customer phone number / email address"]?.trim() || null;
      return call;
    });
    
    const markedCalls = window.CallAnalyzer.markRepeatCalls([...normalizedCalls]);
    const repeatCount = markedCalls.filter(call => call.repeat).length;
    
    console.log(`✅ CallAnalyzer.markRepeatCalls marked ${repeatCount} calls as repeats`);
    console.log(`Result: ${repeatCount === 2 ? "PASS" : "FAIL"}`);
    
    // Show which calls were marked
    markedCalls.forEach((call, i) => {
      console.log(`Call ${i+1}: ${call.meta["Contact ID"]} - Customer: ${call.customerId} - Repeat: ${call.repeat ? "YES" : "NO"}`);
    });
  } else {
    console.log("❌ CallAnalyzer.markRepeatCalls not found");
  }
  
  // Test 4: AI.summarizeRepeatDrivers 
  console.log("\nTest 4: AI.summarizeRepeatDrivers");
  if (window.AI && typeof window.AI.summarizeRepeatDrivers === 'function') {
    // Test summarizeRepeatDrivers
    const normalizedCalls = testCalls.map(call => {
      call.customerId = call.meta?.["Customer phone number / email address"]?.trim() || null;
      return call;
    });
    
    try {
      const summary = window.AI.summarizeRepeatDrivers(normalizedCalls);
      console.log(`✅ AI.summarizeRepeatDrivers output: "${summary}"`);
      console.log(`Result: ${summary.includes("contacted multiple times") ? "PASS" : "FAIL"}`);
    } catch (error) {
      console.log(`❌ AI.summarizeRepeatDrivers error: ${error.message}`);
    }
  } else {
    console.log("❌ AI.summarizeRepeatDrivers not found");
  }
  
  // Test 5: MasterLogUtil.mergeMasterLog
  console.log("\nTest 5: MasterLogUtil.mergeMasterLog");
  if (window.MasterLogUtil && typeof window.MasterLogUtil.mergeMasterLog === 'function') {
    // Create a simple master log
    const masterLog = [
      { 
        customerId: "customer1@example.com", 
        repeatCount: 5,
        flaggedThemes: ["billing", "technical"],
        recentOutcomes: ["resolved", "escalated"],
        tags: ["VIP", "Retention Risk"]
      }
    ];
    
    const normalizedCalls = testCalls.map(call => {
      call.customerId = call.meta?.["Customer phone number / email address"]?.trim() || null;
      return call;
    });
    
    try {
      const mergedCalls = window.MasterLogUtil.mergeMasterLog(normalizedCalls, masterLog);
      const callWithHistory = mergedCalls.find(call => call.historySummary);
      
      console.log(`✅ MasterLogUtil.mergeMasterLog merged historical data`);
      if (callWithHistory) {
        console.log(`Sample historySummary:`, callWithHistory.historySummary);
        console.log(`Result: PASS`);
      } else {
        console.log(`Result: FAIL - No history data found in merged calls`);
      }
    } catch (error) {
      console.log(`❌ MasterLogUtil.mergeMasterLog error: ${error.message}`);
    }
  } else {
    console.log("❌ MasterLogUtil.mergeMasterLog not found");
  }
  
  console.log("\n🏁 All tests completed!");
}

// Add function to window object
window.runCustomerIdTests = runCustomerIdTests;

// Auto-run if not in a dashboard
if (document.readyState === 'complete') {
  setTimeout(runCustomerIdTests, 1000); // Wait for all scripts to load
} else {
  window.addEventListener('load', () => {
    setTimeout(runCustomerIdTests, 1000); // Wait for all scripts to load
  });
} 