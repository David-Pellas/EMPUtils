// categorizeDomain() and TRACKER_DB are provided by domain-intelligence.js (loaded first).

let allDomains = [];
let currentFilter = 'all';

async function analyzePage() {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const resultsDiv = document.getElementById('results');
  
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = 'Analyzing...';
  
  resultsDiv.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>Scanning page for external domains...</p>
    </div>
  `;
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
   
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractDomains
    });
    
    const domains = results[0].result;
    allDomains = domains;

    const stored = await chrome.storage.local.get('lastAnalysis');
    const existing = stored.lastAnalysis || {};
    const merged = { ...existing };
    for (const [domain, count] of Object.entries(domains)) {
      merged[domain] = (merged[domain] || 0) + count;
    }
    const entries = Object.entries(merged);
    if (entries.length > 500) {
      const trimmed = Object.fromEntries(entries.sort((a, b) => b[1] - a[1]).slice(0, 500));
      await chrome.storage.local.set({ lastAnalysis: trimmed });
    } else {
      await chrome.storage.local.set({ lastAnalysis: merged });
    }
    
    await displayResults(domains);
    updateStats(domains);
    if (typeof initReportTab === 'function') initReportTab();

  } catch (error) {
    resultsDiv.innerHTML = `
      <div class="empty-state">
        <p>
          Can't analyze this page
          <span style="position: relative; display: inline-block; margin-left: 4px;">
            <svg style="width:14px;height:14px;vertical-align:middle;color:#94a3b8;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            <span style="
              display: none;
              position: absolute;
              top: 50%;
              left: calc(100% + 6px);
              transform: translateY(-50%);
              background: #1e293b;
              color: #e2e8f0;
              font-size: 11px;
              padding: 6px 10px;
              border-radius: 6px;
              white-space: nowrap;
              max-width: 400px;
              pointer-events: none;
              z-index: 10;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            ">${error.message}</span>
          </span>
        </p>
      </div>
    `;
    const chevronWrap = resultsDiv.querySelector('.empty-state span[style]');
    const tooltip = chevronWrap.querySelector('span:last-child');
    chevronWrap.addEventListener('mouseenter', () => tooltip.style.display = 'block');
    chevronWrap.addEventListener('mouseleave', () => tooltip.style.display = 'none');
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'Manual Analysis';
  }
}

function extractDomains() {
  const currentDomain = window.location.hostname;
  const domainCounts = {};
  
  // Get all links
  document.querySelectorAll('a[href]').forEach(link => {
    try {
      const url = new URL(link.href);
      if (url.hostname && url.hostname !== currentDomain) {
        domainCounts[url.hostname] = (domainCounts[url.hostname] || 0) + 1;
      }
    } catch (e) {}
  });
  
  // Get all scripts
  document.querySelectorAll('script[src]').forEach(script => {
    try {
      const url = new URL(script.src);
      if (url.hostname && url.hostname !== currentDomain) {
        domainCounts[url.hostname] = (domainCounts[url.hostname] || 0) + 1;
      }
    } catch (e) {}
  });

  document.querySelectorAll('iframe[src]').forEach(iframe => {
    try {
      const url = new URL(iframe.src);
      if (url.hostname && url.hostname !== currentDomain) {
        domainCounts[url.hostname] = (domainCounts[url.hostname] || 0) + 1;
      }
    } catch (e) {}
  });
  
  // Get all images
  document.querySelectorAll('img[src]').forEach(img => {
    try {
      const url = new URL(img.src);
      if (url.hostname && url.hostname !== currentDomain) {
        domainCounts[url.hostname] = (domainCounts[url.hostname] || 0) + 1;
      }
    } catch (e) {}
  });
  
  document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
    try {
      const url = new URL(link.href);
      if (url.hostname && url.hostname !== currentDomain) {
        domainCounts[url.hostname] = (domainCounts[url.hostname] || 0) + 1;
      }
    } catch (e) {}
  });
  
  return domainCounts;
}

async function displayResults(domains, filterCategory = 'all', searchTerm = '') {
  const resultsDiv = document.getElementById('results');
  
  if (Object.keys(domains).length === 0) {
    resultsDiv.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <p>No external domains found on this page</p>
      </div>
    `;
    return;
  }
  
  const data = await chrome.storage.local.get(['disabledTrackers', 'allowedTrackers']);
  const blockedTrackers = data.disabledTrackers || [];
  const allowedTrackers = data.allowedTrackers || [];

  const sortedDomains = Object.entries(domains).sort((a, b) => b[1] - a[1]);

  const filteredDomains = sortedDomains.filter(([domain, count]) => {
    if (blockedTrackers.includes(domain)) return false;
    const category = categorizeDomain(domain);
    const matchesFilter = filterCategory === 'all' || category === filterCategory;
    const matchesSearch = domain.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });
  
  if (filteredDomains.length === 0) {
    resultsDiv.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"></div>
        <p>No domains match your filter</p>
      </div>
    `;
    return;
  }
  
  resultsDiv.innerHTML = filteredDomains.map(([domain, count]) => {
    const category = categorizeDomain(domain);
    const info = getDomainInfo(domain, category);
    const risk = info.risk.toLowerCase();
    const isBlocked = blockedTrackers.includes(domain);
    const isAllowed = allowedTrackers.includes(domain);
    
    return `
      <div class="domain-item ${category}" data-domain="${domain}" data-category="${category}">
        <div style="flex: 1; min-width: 0; cursor: pointer;" class="domain-clickable">
          <div class="domain-name" style="word-break: break-all;">${domain}</div>
          <div style="display: flex; align-items: center; gap: 6px; margin-top: 6px;">
            <span style="background: #e2e8f0; color: #475569; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 500; text-transform: uppercase; line-height: 1; display: inline-block;">${category}</span>
            <span class="risk-badge risk-${risk}">${info.risk}</span>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
          <span class="domain-count">${count}</span>
          <button class="action-btn block-btn ${isBlocked ? 'blocked' : ''}" data-domain="${domain}" data-action="block" title="${isBlocked ? 'Unblock' : 'Block'} this domain">
            ${isBlocked ? '✓ Blocked' : 'Block'}
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  document.querySelectorAll('.domain-clickable').forEach(item => {
    item.addEventListener('click', () => {
      const domainItem = item.closest('.domain-item');
      const domain = domainItem.dataset.domain;
      const category = domainItem.dataset.category;
      showDomainInfo(domain, category);
    });
  });
  
  document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const domain = btn.dataset.domain;
      const action = btn.dataset.action;
      if (action === 'block') {
        await toggleBlockTracker(domain, btn);
      }
    });
  });
}

function updateStats(domains) {
  const uniqueCount = Object.keys(domains).length;
  const totalCount = Object.values(domains).reduce((sum, count) => sum + count, 0);
  document.getElementById('uniqueDomains').textContent = uniqueCount;
  document.getElementById('totalRequests').textContent = totalCount;
}

function exportResults() {
  if (allDomains.length === 0 || Object.keys(allDomains).length === 0) {
    alert('No data to export. Please analyze a page first.');
    return;
  }
  
  const csvContent = [
    'Domain,Count,Category',
    ...Object.entries(allDomains).map(([domain, count]) => {
      const category = categorizeDomain(domain);
      return `"${domain}",${count},${category}`;
    })
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `domain-analysis-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function clearResults() {
  allDomains = [];
  await chrome.storage.local.remove('lastAnalysis');
  document.getElementById('results').innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon"></div>
      <p>Click "Analyze Page" to scan for external domains</p>
    </div>
  `;
  document.getElementById('uniqueDomains').textContent = '0';
  document.getElementById('totalRequests').textContent = '0';
  document.getElementById('searchBox').value = '';
}

document.getElementById('analyzeBtn').addEventListener('click', analyzePage);
document.getElementById('exportBtn').addEventListener('click', exportResults);
document.getElementById('clearBtn').addEventListener('click', clearResults);

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    await displayResults(allDomains, currentFilter, document.getElementById('searchBox').value);
  });
});

document.getElementById('searchBox').addEventListener('input', async (e) => {
  await displayResults(allDomains, currentFilter, e.target.value);
});

let currentDomainForVerification = null;

function showDomainInfo(domain, category) {
  const info = getDomainInfo(domain, category);
  const modal = document.getElementById('domainModal');
  
  currentDomainForVerification = domain;
  
  document.getElementById('modalDomainName').textContent = info.name;
  document.getElementById('modalCategory').textContent = info.category;
  document.getElementById('modalOwner').textContent = info.owner;
  document.getElementById('modalPurpose').textContent = info.purpose;
  document.getElementById('modalDescription').textContent = info.description;
  
  const riskBadge = document.getElementById('modalRisk');
  riskBadge.textContent = info.risk;
  riskBadge.className = `risk-badge risk-${info.risk}`;
  
  const dataList = document.getElementById('modalDataCollected');
  dataList.innerHTML = info.dataCollected.map(item => `<li>${item}</li>`).join('');
  
  const verifyButton = document.getElementById('verifyButton');
  verifyButton.disabled = false;
  verifyButton.textContent = 'Verify Ownership';
  document.getElementById('verificationResults').innerHTML = 
    '<p class="verification-hint">Click "Verify Ownership" to check domain registration and confirm the actual owner.</p>';
  
  modal.style.display = 'block';
}

document.getElementById('verifyButton').addEventListener('click', async () => {
  if (!currentDomainForVerification) return;
  
  const verifyButton = document.getElementById('verifyButton');
  const resultsDiv = document.getElementById('verificationResults');
  const modalOwner = document.getElementById('modalOwner');
  const modalRisk = document.getElementById('modalRisk');
  
  verifyButton.disabled = true;
  verifyButton.textContent = 'Authenticating...';
  resultsDiv.innerHTML = `
    <div class="verification-loading" style="display: flex; align-items: center; gap: 8px; color: #64748b;">
      <div class="mini-spinner"></div>
      <span>Consulting global registry & infrastructure records...</span>
    </div>
  `;
  
  try {
    const verificationData = await verifyDomain(currentDomainForVerification);
    const ownershipInfo = await lookupDomainOwnership(currentDomainForVerification);
    
    if (ownershipInfo && !ownershipInfo.includes('Failed')) {
      modalOwner.textContent = ownershipInfo;
      modalOwner.style.color = "#2563eb";
      if (ownershipInfo.includes('Verified') || ownershipInfo.includes('Infrastructure')) {
        modalRisk.textContent = 'IDENTIFIED';
      }
    }

    let resultsHTML = '<div class="verification-success" style="font-size: 11px; line-height: 1.4;">';
    
    if (verificationData.checks.whois.status === 'success' && verificationData.checks.whois.data) {
      const whois = verificationData.checks.whois.data;
      resultsHTML += `<div style="border-left: 2px solid #2563eb; padding-left: 8px; margin-bottom: 8px;">`;
      resultsHTML += `<strong>ENTITY RECORD:</strong><br>`;
      resultsHTML += `Organization: ${whois.organization || 'Private/Protected'}<br>`;
      resultsHTML += `Registrar: ${whois.registrar || 'Unknown'}<br>`;
      resultsHTML += `Age: ${whois.createdDate ? whois.createdDate : 'Unknown'}`;
      resultsHTML += `</div>`;
    }
    
    if (ownershipInfo) {
      resultsHTML += `<div style="margin-top: 8px; font-weight: 600; color: #1e293b;">Infrastructure Detail:</div>`;
      resultsHTML += `<div style="color: #475569;">${ownershipInfo}</div>`;
    }
    
    resultsHTML += '</div>';
    resultsDiv.innerHTML = resultsHTML;
    verifyButton.textContent = 'Analysis Complete';
    
  } catch (error) {
    const isTimeout = error.name === 'AbortError' || error.message.includes('timeout');
    resultsDiv.innerHTML = `
      <div class="verification-error" style="background: #fffbeb; border: 1px solid #fef3c7; padding: 8px; color: #92400e; font-size: 11px;">
        <strong>System Busy:</strong> ${isTimeout ? 'The registry took too long to respond.' : 'Unable to reach verification servers.'}<br>
        <span style="font-size: 10px; opacity: 0.8;">Suggestion: Wait 5 seconds and click "Retry Analysis".</span>
      </div>
    `;
    verifyButton.disabled = false;
    verifyButton.textContent = 'Retry Analysis';
  }
});

document.getElementById('closeModal').addEventListener('click', () => {
  document.getElementById('domainModal').style.display = 'none';
});

window.addEventListener('click', (e) => {
  const modal = document.getElementById('domainModal');
  if (e.target === modal) {
    modal.style.display = 'none';
  }
});

async function updateWhitelistButton(domain) {
  const data = await chrome.storage.local.get('allowedPopups');
  const list = data.allowedPopups || [];
  const btn = document.getElementById('whitelistCurrentSite');
  const svg = btn.querySelector('svg');

  if (list.includes(domain)) {
    svg.setAttribute('stroke', '#4ade80');
    btn.style.opacity = '1';
    btn.title = 'Whitelisted — Click to Remove & Reload';
    btn.dataset.whitelisted = 'true';
  } else {
    svg.setAttribute('stroke', 'white');
    btn.style.opacity = '0.8';
    btn.title = 'Whitelist Current Site';
    btn.dataset.whitelisted = 'false';
  }
}

document.getElementById('whitelistCurrentSite').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return;

  const domain = new URL(tab.url).hostname;
  const data = await chrome.storage.local.get('allowedPopups');
  const list = data.allowedPopups || [];
  const btn = document.getElementById('whitelistCurrentSite');
  const isWhitelisted = btn.dataset.whitelisted === 'true';

  if (isWhitelisted) {
    const updated = list.filter(d => d !== domain);
    await chrome.storage.local.set({ allowedPopups: updated });
  } else {
    if (!list.includes(domain)) list.push(domain);
    await chrome.storage.local.set({ allowedPopups: list });
    try {
      chrome.tabs.sendMessage(tab.id, { type: "WHITELIST_DOMAIN", domain }, () => {
        void chrome.runtime.lastError;
      });
    } catch (e) {}
  }

  chrome.tabs.reload(tab.id, {}, async () => {
    await updateWhitelistButton(domain);
  });
});

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url) {
    const domain = new URL(tab.url).hostname;
    await updateWhitelistButton(domain);
  }
})();

document.getElementById('openSettings').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
});

async function toggleBlockTracker(domain, buttonElement) {
  const data = await chrome.storage.local.get('disabledTrackers');
  const blockedList = data.disabledTrackers || [];
  const isCurrentlyBlocked = blockedList.includes(domain);
  
  if (isCurrentlyBlocked) {
    const newList = blockedList.filter(d => d !== domain);
    await chrome.storage.local.set({ disabledTrackers: newList });
    buttonElement.classList.remove('blocked');
    buttonElement.textContent = 'Block';
    buttonElement.title = 'Block this domain';
  } else {
    blockedList.push(domain);
    await chrome.storage.local.set({ disabledTrackers: blockedList });
    buttonElement.classList.add('blocked');
    buttonElement.textContent = '✓ Blocked';
    buttonElement.title = 'Unblock this domain';
  }
}

async function toggleAllowTracker(domain, buttonElement) {
  const data = await chrome.storage.local.get('allowedTrackers');
  const allowedList = data.allowedTrackers || [];
  const isCurrentlyAllowed = allowedList.includes(domain);
  
  if (isCurrentlyAllowed) {
    const newList = allowedList.filter(d => d !== domain);
    await chrome.storage.local.set({ allowedTrackers: newList });
    buttonElement.classList.remove('allowed');
    buttonElement.textContent = 'Allow';
    buttonElement.title = 'Trust this domain';
  } else {
    allowedList.push(domain);
    await chrome.storage.local.set({ allowedTrackers: allowedList });
    buttonElement.classList.add('allowed');
    buttonElement.textContent = '✓ Allowed';
    buttonElement.title = 'Remove from trusted list';
  }
}

async function applyUserTheme() {
  const data = await chrome.storage.local.get('themeColor');
  if (data.themeColor) {
    document.documentElement.style.setProperty('--header-bg', data.themeColor);
    document.documentElement.style.setProperty('--primary', data.themeColor);
    document.documentElement.style.setProperty('--primary-dark', data.themeColor);
  }
}

document.addEventListener('DOMContentLoaded', applyUserTheme);

document.addEventListener('DOMContentLoaded', () => {
  const navBtns = document.querySelectorAll('.sidebar-btn[data-tab]');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      navBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + target).classList.add('active');
    });
  });
});
analyzePage();