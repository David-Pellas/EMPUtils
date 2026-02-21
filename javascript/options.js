

const CATEGORY_RISK = {
  tracker:   'high',
  ads:       'high',
  analytics: 'medium',
  social:    'medium',
  other:     'low'
};

function getRisk(domain) {
  return CATEGORY_RISK[categorizeDomain(domain)] || 'low';
}

async function loadTrackerStats() {
  const data = await chrome.storage.local.get('lastAnalysis');
  const domains = data.lastAnalysis || null;

  if (!domains || Object.keys(domains).length === 0) {
    return;
  }

  let low = 0, medium = 0, high = 0;

  for (const domain of Object.keys(domains)) {
    const risk = getRisk(domain);
    if (risk === 'high')        high++;
    else if (risk === 'medium') medium++;
    else                        low++;
  }

  document.getElementById('stat-low').textContent    = low;
  document.getElementById('stat-medium').textContent = medium;
  document.getElementById('stat-high').textContent   = high;
  document.getElementById('stat-total').textContent  = low + medium + high;
}


async function loadSettings() {
  const data = await chrome.storage.local.get([
    'allowedPopups',
    'disabledTrackers',
    'alertDuration',
    'themeColor', 
    'allowAlerts'
  ]);

  renderList('popup-list',   data.allowedPopups   || [], 'allowedPopups');
  renderList('tracker-list', data.disabledTrackers || [], 'disabledTrackers');

  if (data.hasOwnProperty('allowAlerts')) {
      document.getElementById('allowAlerts').checked = data.allowAlerts;
  }

  if (data.alertDuration) {
    document.getElementById('alertDuration').value = data.alertDuration;
  }

  if (data.themeColor) {
    document.getElementById('themeColor').value = data.themeColor;
    document.getElementById('colorHex').textContent = data.themeColor.toUpperCase();
    document.getElementById('swatchBg').style.background = data.themeColor; // Add this line
  }
}

async function saveCustomSettings() {
  const duration = document.getElementById('alertDuration').value;
  const color    = document.getElementById('themeColor').value;
  const allowAlerts = document.getElementById('allowAlerts').checked;

  await chrome.storage.local.set({
    alertDuration: parseInt(duration),
    themeColor: color,
	allowAlerts: allowAlerts
  });

  const saveBtn = document.getElementById('saveSettings');
  const originalText = saveBtn.textContent;
  saveBtn.textContent = 'SAVED!';
  saveBtn.style.background = '#166534';
  setTimeout(() => {
    saveBtn.textContent = originalText;
    saveBtn.style.background = '';
  }, 2000);
}

function renderList(elementId, items, storageKey) {
  const container = document.getElementById(elementId);
  container.innerHTML = '';

  if (items.length === 0) {
    container.innerHTML = '<p class="empty">No items in this list.</p>';
    return;
  }

  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = `
      <span>${item}</span>
      <span class="remove-btn" data-item="${item}">REMOVE</span>
    `;
    div.querySelector('.remove-btn').onclick = async () => {
      const currentData = await chrome.storage.local.get(storageKey);
      const newList = currentData[storageKey].filter(i => i !== item);
      await chrome.storage.local.set({ [storageKey]: newList });
      loadSettings();
    };
    container.appendChild(div);
  });
}
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadTrackerStats();

  document.getElementById('saveSettings').addEventListener('click', saveCustomSettings);

  document.getElementById('themeColor').addEventListener('input', (e) => {
    const newColor = e.target.value.toUpperCase();
    document.getElementById('colorHex').textContent = newColor;
    document.getElementById('swatchBg').style.background = newColor;
  });
});