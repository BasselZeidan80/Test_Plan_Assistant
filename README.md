# ADO Smoke Scout — Chrome Extension

A lightweight Chrome Extension for Azure DevOps Test Plans that helps QA teams identify and apply Smoke Test or any action need  candidates using an AI-assisted external workflow.

---

## How It Works

```
Azure DevOps Test Suite
        │
        ▼
[1] Export Test Cases → test-cases.json
        │
        ▼
[2] Paste JSON into your AI tool (ChatGPT, Claude, etc.)
    with the included prompt template
        │
        ▼
[3] AI returns: [10452, 10470, 10501]
        │
        ▼
[4] Paste IDs back into the extension
        │
        ▼
[5] Extension highlights + checks matching rows in ADO and select checkBox ✅
```

---

## Installation (Developer Mode)

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder
5. The **Smoke Scout** icon appears in your toolbar

---

## Usage

### Step 1 — Export
1. Open your Azure DevOps Test Plan / Test Suite page
2. Click the Smoke Scout extension icon
3. Click **Export Test Cases**
4. A `test-cases.json` file downloads automatically

### Step 2 — AI Analysis (External)
1. Open any AI tool (ChatGPT, Claude, Gemini, etc.)
2. Click **View AI prompt template** in the popup and copy it
3. Paste the prompt + your `test-cases.json` content into the AI
4. The AI returns a JSON array of Smoke candidate IDs

### Step 3 — Apply IDs
1. Back in the extension, paste the returned array into the textarea:
   ```
   [10452, 10470, 10501]
   ```
   Or click **Upload JSON** to upload a `.json` file
2. Click **Apply Smoke IDs**
3. Matching test cases are highlighted in blue with a  SMOKE badge
4. Checkboxes are automatically selected where possible
5. The view scrolls to the first match

---

## File Structure

```
extension/
├── manifest.json   — Extension configuration (MV3)
├── popup.html      — Extension popup UI
├── popup.js        — Popup controller (export/apply logic)
├── content.js      — DOM interaction with Azure DevOps pages
├── styles.css      — Popup styles (dark/light theme)
├── utils.js        — Shared utilities (parseIds, downloadJSON, readJSONFile)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Exported JSON Format

```json
{
  "suiteName": "Regression Suite",
  "exportedAt": "2026-05-20T10:00:00Z",
  "totalCount": 45,
  "testCases": [
    {
      "id": 10452,
      "title": "Verify successful login",
      "steps": "",
      "expectedResult": "",
      "priority": "1",
      "tags": ["authentication"]
    }
  ]
}
```



## ID Input Formats

The Apply field accepts any of:

```
[10452, 10470, 10501]       ← JSON array
10452, 10470, 10501         ← CSV
10452                       ← single ID
10452\n10470\n10501         ← newline-separated
```

---

## Permissions

| Permission | Reason |
|---|---|
| `activeTab` | Read the currently open ADO page |
| `scripting` | Inject content.js to interact with the DOM |
| `downloads` | Trigger automatic JSON file download |
| `https://dev.azure.com/*` | Host permission for ADO pages |

---

## Notes

- **Virtualized lists**: ADO uses a virtualized row renderer. The extension scrolls the list before extracting to maximize the number of rows in the DOM.
- **DOM stability**: Selectors prioritize `aria-*` attributes and `role` attributes over random class names, which change with ADO releases.
- **No AI API calls**: The extension never calls any AI service. All AI analysis happens externally in a tool of your choice.
- **Re-running Apply**: Clicking Apply again removes previous highlights before applying fresh ones.

---

## Troubleshooting

**"No test cases found"**
→ Make sure you are on a Test Suite page (not the Test Plans overview).
→ Wait for the page to fully load before clicking Export.

**"Not found" IDs after applying**
→ The ID may be in a different suite. Navigate to the correct suite first.
→ ADO's virtualized list may not have rendered those rows. Try scrolling the list manually first.

**Extension not responding**
→ Refresh the ADO page and try again. The content script re-injects on each navigation.

---

## Tech Stack

- Vanilla JavaScript (ES2020)
- HTML5 / CSS3
- Chrome Extension Manifest V3
- No frameworks, no bundlers, no build step required
