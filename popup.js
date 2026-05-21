
// ─── DOM References ───────────────────────────────────────────────────────────
const exportBtn     = document.getElementById('exportBtn');
const applyBtn      = document.getElementById('applyBtn');
const idsInput      = document.getElementById('idsInput');
const fileInput     = document.getElementById('fileInput');
const logBody       = document.getElementById('logBody');
const clearLogBtn   = document.getElementById('clearLogBtn');
const themeToggle   = document.getElementById('themeToggle');
const copyPromptBtn = document.getElementById('copyPromptBtn');
const promptText    = document.getElementById('promptText');

// ─── Theme ────────────────────────────────────────────────────────────────────
const savedTheme = localStorage.getItem('smokeScoutTheme') || 'dark';
applyTheme(savedTheme);

themeToggle.addEventListener('click', () => {
  const next = document.body.classList.contains('light') ? 'dark' : 'light';
  applyTheme(next);
  localStorage.setItem('smokeScoutTheme', next);
});

function applyTheme(theme) {
  document.body.classList.toggle('light', theme === 'light');
}

// ─── Copy AI Prompt ───────────────────────────────────────────────────────────
copyPromptBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(promptText.textContent.trim()).then(() => {
    copyPromptBtn.textContent = 'Copied!';
    setTimeout(() => (copyPromptBtn.textContent = 'Copy prompt'), 1800);
  });
});

// ─── Log Helpers ──────────────────────────────────────────────────────────────
function log(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  entry.textContent = `[${time}] ${message}`;
  logBody.appendChild(entry);
  logBody.scrollTop = logBody.scrollHeight;
}

clearLogBtn.addEventListener('click', () => {
  logBody.innerHTML = '';
  log('Log cleared.');
});

// ─── Shared: Get active ADO tab ───────────────────────────────────────────────
async function getActiveADOTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) throw new Error('No active tab found.');

  if (!tab.url.includes('dev.azure.com')) {
    throw new Error('Please open an Azure DevOps Test Suite page first.');
  }

  return tab;
}

// ─── Shared: Set button loading state ─────────────────────────────────────────
function setLoading(btn, isLoading, originalHTML) {
  if (isLoading) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Working…`;
  } else {
    btn.disabled = false;
    btn.innerHTML = originalHTML;
  }
}

// ─── FEATURE 1: Export Test Cases ─────────────────────────────────────────────
const exportBtnHTML = exportBtn.innerHTML;

exportBtn.addEventListener('click', async () => {
  setLoading(exportBtn, true, exportBtnHTML);
  log('Starting test case extraction…');

  try {
    const tab = await getActiveADOTab();

    // Ensure content script is injected (handles cases where it wasn't auto-injected)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['utils.js', 'content.js'],
    }).catch(() => {}); // Ignore if already injected

    // Send extraction request to content.js
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractTestCases' });

    if (!response || !response.success) {
      throw new Error(response?.error || 'Extraction failed — no response from page.');
    }

    const data = response.data;
    log(`Found ${data.totalCount} test cases in "${data.suiteName}".`, 'success');

    // Download the JSON file
    const filename = `test-cases-${sanitizeFilename(data.suiteName)}-${formatDate()}.json`;
    downloadJSON(data, filename);

    log(`Downloaded: ${filename}`, 'success');
    log('Send this file to your AI tool with the prompt template above.');

  } catch (err) {
    log(`Export failed: ${err.message}`, 'error');
    console.error('[Smoke Scout] Export error:', err);
  } finally {
    setLoading(exportBtn, false, exportBtnHTML);
  }
});

// ─── FEATURE 2: Apply Smoke IDs ───────────────────────────────────────────────
const applyBtnHTML = applyBtn.innerHTML;

applyBtn.addEventListener('click', async () => {
  const rawInput = idsInput.value.trim();
  if (!rawInput) {
    log('Please paste IDs or upload a JSON file first.', 'warn');
    return;
  }

  // Parse the raw input using the shared utility
  const ids = parseIds(rawInput);
  if (ids.length === 0) {
    log('No valid IDs found in input. Use format: [10452, 10470] or 10452, 10470', 'warn');
    return;
  }

  log(`Parsed ${ids.length} smoke candidate ID${ids.length !== 1 ? 's' : ''}: ${ids.join(', ')}`);

  setLoading(applyBtn, true, applyBtnHTML);

  try {
    const tab = await getActiveADOTab();

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['utils.js', 'content.js'],
    }).catch(() => {});

    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'applyIds',
      ids,
    });

    if (!response || !response.success) {
      throw new Error(response?.error || 'Apply failed — no response from page.');
    }

    const { applied, notFound } = response.data;

    if (applied.length > 0) {
      log(`✓ Applied smoke highlight to ${applied.length} test case${applied.length !== 1 ? 's' : ''}: ${applied.join(', ')}`, 'success');
    }

    if (notFound.length > 0) {
      log(
        `⚠ ${notFound.length} ID${notFound.length !== 1 ? 's' : ''} not found in current view: ${notFound.join(', ')}. ` +
        `They may be in a different suite or not currently visible.`,
        'warn'
      );
    }

    if (applied.length === 0 && notFound.length > 0) {
      log('No matches found. Ensure you are on the correct Test Suite page.', 'error');
    }

  } catch (err) {
    log(`Apply failed: ${err.message}`, 'error');
    console.error('[Smoke Scout] Apply error:', err);
  } finally {
    setLoading(applyBtn, false, applyBtnHTML);
  }
});

// ─── File Upload Handler ───────────────────────────────────────────────────────
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const data = await readJSONFile(file);

    let ids = [];

    // Accept two formats:
    // 1. Plain array: [10452, 10470]
    if (Array.isArray(data)) {
      ids = data;
    }
    // 2. Object with an "ids" or "smokeIds" field: { "ids": [...] }
    else if (data && typeof data === 'object') {
      ids = data.ids || data.smokeIds || data.selectedIds || data.testCaseIds || [];
    }

    if (ids.length === 0) {
      log('Uploaded file has no recognizable IDs. Expected array or { ids: [...] }.', 'warn');
      return;
    }

    // Put them into the textarea so the user can review/edit
    idsInput.value = JSON.stringify(ids);
    log(`Loaded ${ids.length} IDs from "${file.name}". Click Apply to proceed.`, 'success');

  } catch (err) {
    log(`File read error: ${err.message}`, 'error');
  }

  // Reset file input so re-uploading same file works
  fileInput.value = '';
});

// ─── Local helpers (inline, not from utils.js) ────────────────────────────────

function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9]/gi, '-').toLowerCase().replace(/-+/g, '-').slice(0, 40);
}

function formatDate() {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
}

function pad(n) {
  return String(n).padStart(2, '0');
}
