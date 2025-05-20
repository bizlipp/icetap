// repeatAnalysis.js
// Logic for analyzing repeat callers and callbacks

export function getRepeatCallerData(calls) {
  const repeatCallers = {};
  const dailyCallbacks = {};

  calls.forEach(call => {
    const customer = call.meta["Customer phone number / email address"];
    const date = new Date(call.meta["Initiation timestamp"]).toISOString().split('T')[0];

    if (!customer || customer === "N/A") return;

    if (!repeatCallers[customer]) {
      repeatCallers[customer] = [];
    }
    repeatCallers[customer].push(call);

    if (!dailyCallbacks[date]) dailyCallbacks[date] = 0;
    dailyCallbacks[date]++;
  });

  const repeatList = Object.entries(repeatCallers)
    .filter(([_, arr]) => arr.length > 1)
    .map(([customer, calls]) => ({
      customer,
      calls: calls.length,
      firstCall: calls[0].meta["Initiation timestamp"],
      latestCall: calls[calls.length - 1].meta["Initiation timestamp"],
      flags: calls.flatMap(c => c.flags || [])
    }));

  return { repeatList, dailyCallbacks };
}
