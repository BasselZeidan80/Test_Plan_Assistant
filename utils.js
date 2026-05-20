/**
 * utils.js — Shared utility functions for ADO Smoke Scout
 * Used by both popup.js and content.js (injected)
 */

/**
 * Parse a raw string of IDs into a clean number array.
 * Accepts:
 *   - JSON array:  [10452, 10470, 10501]
 *   - CSV string:  10452, 10470, 10501
 *   - Newline-separated
 *
 * @param {string} raw
 * @returns {number[]}
 */
function parseIds(raw) {
  if (!raw || !raw.trim()) return [];

  // Try JSON array first
  try {
    const parsed = JSON.parse(raw.trim());
    if (Array.isArray(parsed)) {
      return parsed
        .map(v => parseInt(v, 10))
        .filter(n => !isNaN(n));
    }
    // Single number JSON
    if (typeof parsed === 'number') return [parsed];
  } catch (_) {
    // Not valid JSON — fall through to CSV parsing
  }

  // CSV / whitespace / newline separated
  return raw
    .split(/[\s,;\n]+/)
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n));
}

/**
 * Trigger a JSON file download in the browser.
 *
 * @param {object} data   — JS object to serialize
 * @param {string} filename — e.g. "test-cases.json"
 */
function downloadJSON(data, filename) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();

  // Clean up object URL after download triggers
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Read a File object and return parsed JSON.
 *
 * @param {File} file
 * @returns {Promise<any>}
 */
function readJSONFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        resolve(JSON.parse(e.target.result));
      } catch (err) {
        reject(new Error('Invalid JSON file: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsText(file);
  });
}

/**
 * Debounce helper — prevents rapid repeated calls.
 *
 * @param {Function} fn
 * @param {number} delay ms
 * @returns {Function}
 */
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
