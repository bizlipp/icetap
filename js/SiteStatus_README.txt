# ICETAP SiteStatus Report Integration

This module enhances the ICETAP Reports Dashboard with a high-level, AI-generated Site Status Report for Operational Managers, Site Leads, and Coaches.

---

## ✅ Files Included

- `ai.js` – AI-powered summary generation utility
- `sitestatus.js` – Rendering logic for the SiteStatus report section

---

## 📦 Features

- Human-readable AI summaries of trends and agent behavior
- Visual agent performance breakdown (improving vs declining)
- Escalation risk call highlights
- Callback driver insights and repeat contact clustering
- Missed opportunity detection (positive calls with later callbacks)
- One-click Outlook-ready summary export

---

## 🧰 Integration Checklist

### 1. **Add to Reports Dashboard (HTML)**

In `reports.html`:

#### a. Add SiteStatus Button
```html
<button class="button report-type-button" data-report-type="siteStatus">
  <i class="fas fa-sitemap mr-1"></i>Site Status Report
</button>
```

#### b. Add Output Section
```html
<section id="siteStatusReport" class="report-output-section dashboard-section card mt-4" style="display: none;">
  <h2 class="section-title"><i class="fas fa-sitemap mr-2"></i>Site Status Summary</h2>
  <div id="siteStatusInsights"></div>
</section>
```

---

### 2. **Hook into Reports Logic (JS)**

In `reports.js`:

#### a. Register new report type:
Inside `applyFiltersAndRenderActiveReport()`:
```js
case 'siteStatus':
  renderSiteStatusReport(filteredCalls);
  break;
```

#### b. Load the module:
Make sure `sitestatus.js` is included in the `<script>` tags after `ai.js`.

```html
<script src="../../js/ai.js"></script>
<script src="../../js/sitestatus.js"></script>
```

---

### 3. **Ensure Pre-Analyzed Data**

SiteStatus report assumes all calls are pre-analyzed by `call-analysis.js`. This is typically done when calls are imported and processed into `window.DataStackULTRA` as `loadedCalls`.

---

### 4. **Optional: Style and Chart Enhancements**

- Add more `<canvas>` areas for visualizations (agent performance, time-based sentiment)
- Use Tailwind CSS for styling consistency
- Integrate `Chart.js` if not already present

---

## ✅ Confirmed Working When:

- `window.AI` is available
- `loadedCalls` contains pre-analyzed calls
- You see a clean, readable report under Site Status
- Export button generates a usable `.html` for Outlook/email drop

---

## 🚀 Next Steps (Optional)

- Add trend chart by hour/block (calls vs escalation)
- Enhance risk detection logic using past call outcomes
- Tie flagged agents to `coaching.js` auto-summary tools