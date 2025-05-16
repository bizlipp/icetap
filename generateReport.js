
function generateReport() {
  const rows = Array.from(document.querySelectorAll('table#auditTable tbody tr'));
  const data = rows.map(row => {
    const cells = row.querySelectorAll('td');
    return {
      compliant: cells[12]?.textContent.trim(),
      violation: cells[13]?.textContent.trim(),
      comments: cells[17]?.textContent.trim(),
    };
  });

  const total = data.length;
  const compliantCount = data.filter(d => d.compliant.toLowerCase() === "yes").length;
  const violations = data.filter(d => d.compliant.toLowerCase() === "no");
  const complianceRate = ((compliantCount / total) * 100).toFixed(1);

  const violationTypes = {};
  const flagWords = {};

  data.forEach(d => {
    if (d.violation) {
      violationTypes[d.violation] = (violationTypes[d.violation] || 0) + 1;
    }
    if (d.comments) {
      const words = d.comments.toLowerCase().split(/\s+/);
      words.forEach(w => {
        if (w.length > 4) flagWords[w] = (flagWords[w] || 0) + 1;
      });
    }
  });

  const topViolation = Object.entries(violationTypes).sort((a,b) => b[1] - a[1])[0]?.[0] || "N/A";
  const topFlags = Object.entries(flagWords).sort((a,b) => b[1] - a[1]).slice(0, 5).map(f => f[0]);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Audit Summary Report</title>
  <style>
    body { font-family: Calibri, sans-serif; color: #333; margin: 20px; }
    h1 { color: #004b8d; }
    .metric-block { margin-top: 20px; border-left: 4px solid #0078D7; padding: 10px 15px; background: #f5faff; }
    .section { margin-top: 30px; }
    .summary-comment { font-style: italic; background: #fff7e6; border-left: 4px solid #ffb84d; padding: 10px 15px; }
    ul { padding-left: 20px; }
  </style>
</head>
<body>
  <h1>🧾 Inspiro Audit Summary</h1>

  <div class="metric-block">
    <h2>📊 Key Stats</h2>
    <p><strong>Total Audits Reviewed:</strong> ${total}</p>
    <p><strong>Compliance Rate:</strong> ${complianceRate}%</p>
    <p><strong>Violations Found:</strong> ${violations.length}</p>
    <p><strong>Most Common Violation Type:</strong> ${topViolation}</p>
    <p><strong>Most Common Flags:</strong> ${topFlags.join(", ")}</p>
  </div>

  <div class="section summary-comment">
    “Automated summary generated from IceTap audit data. Trends suggest focus areas may include: ${topViolation} and recurring flags such as ${topFlags.slice(0,2).join(", ")}.”
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "Audit_Summary_Report.html";
  link.click();
}
