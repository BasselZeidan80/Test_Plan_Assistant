

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'extractTestCases') {
    extractTestCases()
      .then(res => sendResponse({ success: true, data: res }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === 'applyIds') {
    applyIds(message.ids)
      .then(res => sendResponse({ success: true, data: res }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// ─────────────────────────────────────────────
// FEATURE 1: EXTRACT
// ─────────────────────────────────────────────

async function extractTestCases() {
  const suiteName = getSuiteName();

  await scrollToLoadAllRows();

  const rows = findTestCaseRows();

  const testCases = rows
    .map(extractRowData)
    .filter(Boolean);

  return {
    suiteName,
    exportedAt: new Date().toISOString(),
    totalCount: testCases.length,
    testCases
  };
}

function getSuiteName() {
  const selectors = [
    '[aria-label="Test suite name"]',
    '.test-suite-title',
    '.suite-name',
    '.hub-title',
    'h1'
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el?.textContent.trim()) return el.textContent.trim();
  }

  return document.title;
}

function findTestCaseRows() {
  const selectors = [
    '[role="treegrid"] [role="row"]',
    '[role="grid"] [role="row"]',
    '[data-row-index]',
    'tr[data-id]'
  ];

  for (const sel of selectors) {
    const rows = Array.from(document.querySelectorAll(sel))
      .filter(r => getRowId(r) !== null);

    if (rows.length) return rows;
  }

  return [];
}

function getRowId(row) {
  if (row.dataset.id) {
    const n = parseInt(row.dataset.id, 10);
    if (!isNaN(n)) return n;
  }

  const text = row.getAttribute('aria-label') || '';
  const match = text.match(/\b(\d{4,})\b/);
  if (match) return parseInt(match[1], 10);

  const cells = row.querySelectorAll('[role="gridcell"], td');
  for (const c of cells) {
    const t = c.textContent.trim();
    if (/^\d{4,}$/.test(t)) return parseInt(t, 10);
  }

  return null;
}

function extractRowData(row) {
  const id = getRowId(row);
  if (!id) return null;

  const cells = [...row.querySelectorAll('[role="gridcell"], td')];
  const texts = cells.map(c => c.textContent.trim());

  return {
    id,
    title: getTitle(row, texts),
    priority: getPriority(row, texts),
    tags: getTags(row)
  };
}

function getTitle(row, texts) {
  const el = row.querySelector('[class*="title"], a[href*="workitems"]');
  if (el?.textContent.trim()) return el.textContent.trim();

  return texts.find(t => t.length > 3 && !/^\d+$/.test(t)) || '';
}

function getPriority(row, texts) {
  const el = row.querySelector('[aria-label*="Priority" i]');
  if (el) {
    const m = el.getAttribute('aria-label')?.match(/:\s*(.+)/);
    if (m) return m[1].trim();
  }

  return texts.find(t =>
    /^(1|2|3|4|high|medium|low|critical)$/i.test(t)
  ) || '';
}

function getTags(row) {
  const tags = row.querySelectorAll('[class*="tag"], [class*="badge"]');
  return [...tags].map(t => t.textContent.trim()).filter(Boolean);
}

async function scrollToLoadAllRows() {
  const container = document.querySelector('[role="grid"], [role="treegrid"]');
  if (!container) return;

  let pos = 0;
  const step = 400;
  const max = container.scrollHeight;

  while (pos < max) {
    container.scrollTop = pos;
    await sleep(120);
    pos += step;
  }

  container.scrollTop = 0;
  await sleep(200);
}

// ─────────────────────────────────────────────
// FEATURE 2: APPLY IDS (FIXED SELECTION)
// ─────────────────────────────────────────────

async function applyIds(ids) {
  if (!ids?.length) throw new Error('No IDs provided');

  removeHighlights();

  await scrollToLoadAllRows();

  const rows = findTestCaseRows();
  const idSet = new Set(ids);

  const applied = [];
  const notFound = [...ids];

  let firstMatch = null;

  for (const row of rows) {
    const id = getRowId(row);
    if (!id) continue;

    if (idSet.has(id)) {
      const idx = notFound.indexOf(id);
      if (idx !== -1) notFound.splice(idx, 1);

      applied.push(id);

      highlightRow(row);

      await selectCheckbox(row);

      if (!firstMatch) firstMatch = row;
    }
  }

  if (firstMatch) {
    firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return { applied, notFound };
}

// ─────────────────────────────────────────────
// 🔥 FIX: SELECT CHECKBOX (YOUR DOM BASED)
// ─────────────────────────────────────────────

async function selectCheckbox(row) {
  row.scrollIntoView({ block: 'center' });
  await sleep(80);

  const checkbox = row.querySelector(
    '[role="checkbox"][aria-label="Select row"]'
  );

  if (!checkbox) return false;

  // already selected
  if (checkbox.getAttribute('aria-checked') === 'true') {
    return true;
  }

  // ensure hover (ADO behavior)
  row.dispatchEvent(new MouseEvent('mouseover', {
    bubbles: true,
    cancelable: true,
    view: window
  }));

  await sleep(60);

  // 🔥 real pointer simulation
  const events = [
    new MouseEvent('pointerdown', { bubbles: true }),
    new MouseEvent('mousedown', { bubbles: true }),
    new MouseEvent('mouseup', { bubbles: true }),
    new MouseEvent('click', { bubbles: true })
  ];

  for (const e of events) {
    checkbox.dispatchEvent(e);
  }

  await sleep(120);

  // verify selection
  if (checkbox.getAttribute('aria-checked') !== 'true') {
    checkbox.click(); // fallback
    await sleep(80);
  }

  return true;
}

// ─────────────────────────────────────────────
// UI
// ─────────────────────────────────────────────

function highlightRow(row) {
  row.setAttribute('data-selected', 'true');

  row.style.setProperty('background', 'rgba(74,125,252,0.12)', 'important');
  row.style.setProperty('outline', '1px solid rgba(74,125,252,0.4)', 'important');

  const cell = row.querySelector('[role="gridcell"], td');

  if (cell && !cell.querySelector('.badge')) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = '🔥 SMOKE';

    badge.style.cssText = `
      margin-left:6px;
      padding:1px 6px;
      font-size:10px;
      background:#4a7dfc;
      color:#fff;
      border-radius:3px;
      font-weight:600;
    `;

    cell.appendChild(badge);
  }
}

function removeHighlights() {
  document.querySelectorAll('[data-selected="true"]').forEach(r => {
    r.removeAttribute('data-selected');
    r.style.removeProperty('background');
    r.style.removeProperty('outline');
    r.querySelector('.badge')?.remove();
  });
}

// ─────────────────────────────────────────────
// UTIL
// ─────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}