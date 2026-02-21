
const BLOCKLIST_CONFIG = {
  lists: [
    {
      id: "easylist",
      name: "EasyList (Ads)",
      url: "https://easylist.to/easylist/easylist.txt",
    },
    {
      id: "easyprivacy",
      name: "EasyPrivacy (Trackers)",
      url: "https://easylist.to/easylist/easyprivacy.txt",
    },
  ],

  refreshIntervalMs: 24 * 60 * 60 * 1000,
  maxDynamicRules: 30000,
  // Cap on generic (sitewide)
  maxHideSelectors: 5000,

  storageKeys: {
    rules: "blocklist_rules",
    lastUpdated: "blocklist_last_updated",
    hideCSS: "blocklist_hide_css",
  },
};


function parseEasyListToRules(rawText) {
  const domainRules = [];
  const patternRules = [];
  const pathRules = [];
  
  let ruleId = 1;

  for (let line of rawText.split("\n")) {
    line = line.trim();

    if (!line) continue;
    if (line.startsWith("!") || line.startsWith("[")) continue;
    if (line.includes("##") || line.includes("#@#")) continue;
    if (line.startsWith("@@")) continue;
    if (line.includes("#?#") || line.includes("#$#")) continue;

    let resourceTypes = [
      "main_frame", "sub_frame", "stylesheet", "script",
      "image", "font", "object", "xmlhttprequest",
      "ping", "media", "websocket", "other",
    ];

    if (line.includes("$")) {
      const [pattern, optionsStr] = line.split("$");
      const options = optionsStr.toLowerCase();

      // Skip domain specific
      if (options.includes("domain=") || options.includes("sitekey=")) continue;

      if (options.includes("image")) resourceTypes = ["image"];
      else if (options.includes("script")) resourceTypes = ["script"];
      else if (options.includes("stylesheet")) resourceTypes = ["stylesheet"];
      else if (options.includes("xmlhttprequest")) resourceTypes = ["xmlhttprequest"];

      line = pattern;
    }

    let rule = null;

    const domainOnlyMatch = line.match(/^\|\|([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\^?$/);
    if (domainOnlyMatch) {
      rule = {
        id: ruleId++,
        priority: 1,
        action: { type: "block" },
        condition: {
          urlFilter: `||${domainOnlyMatch[1].toLowerCase()}`,
          domainType: "thirdParty",
          resourceTypes,
        },
      };
      domainRules.push(rule);
      continue;
    }

    const hasWildcard = line.includes("*") && !line.startsWith("*");
    const hasImageExtension = line.match(/\.(gif|jpg|jpeg|png|webp|svg)/i);
    const adPatterns = [
      '/ads/', '/ad/', '/banner', '/track', '/pixel', '/beacon',
      '/analytics', '/telemetry', '/stats', '/click', '/impression',
      '/promo', '/sponsor', '/popup', '/advert'
    ];
    const lowerLine = line.toLowerCase();
    const hasAdKeyword = adPatterns.some(pattern => lowerLine.includes(pattern));
    
    if (hasWildcard || hasImageExtension || hasAdKeyword) {
      const pattern = line.replace(/\^/g, "").replace(/\$/g, "").replace(/^\|+/g, "");
      if (pattern && !pattern.startsWith("||")) {
        rule = {
          id: ruleId++,
          priority: 2,
          action: { type: "block" },
          condition: {
            urlFilter: pattern,
            domainType: "thirdParty",
            resourceTypes,
          },
        };
        patternRules.push(rule);
        continue;
      }
    }

    if (line.startsWith("||")) {
      const pathMatch = line.match(/^\|\|([^/^$|*]+)(.*)/);
      if (pathMatch) {
        const domain = pathMatch[1].toLowerCase();
        const path = pathMatch[2].replace(/\^/g, "").replace(/\$/g, "");
        rule = {
          id: ruleId++,
          priority: 1,
          action: { type: "block" },
          condition: {
            urlFilter: `||${domain}${path}`,
            domainType: "thirdParty",
            resourceTypes,
          },
        };
        pathRules.push(rule);
        continue;
      }
    }

    if (line.startsWith("|http")) {
      const url = line.substring(1).replace(/\^/g, "").replace(/\$/g, "");
      rule = {
        id: ruleId++,
        priority: 1,
        action: { type: "block" },
        condition: {
          urlFilter: `|${url}`,
          domainType: "thirdParty",
          resourceTypes,
        },
      };
      pathRules.push(rule);
    }
  }

  // Merge in priority order and trim to 30k
  patternRules.sort((a, b) => {
    const scoreA = getAdScore(a.condition.urlFilter);
    const scoreB = getAdScore(b.condition.urlFilter);
    return scoreB - scoreA; // Higher score first
  });

  const allRules = [
    ...domainRules,   
    ...patternRules.slice(0, 15000),  
    ...pathRules.slice(0, BLOCKLIST_CONFIG.maxDynamicRules - domainRules.length - Math.min(patternRules.length, 15000))
  ];

  const finalRules = allRules.slice(0, BLOCKLIST_CONFIG.maxDynamicRules).map((rule, index) => ({
    ...rule,
    id: index + 1
  }));

  console.log(
    `[BlocklistManager] Rule breakdown: ${domainRules.length} domain, ` +
    `${Math.min(patternRules.length, 15000)} pattern (from ${patternRules.length}), ` +
    `${Math.min(pathRules.length, finalRules.length - domainRules.length - Math.min(patternRules.length, 15000))} path ` +
    `(kept ${finalRules.length} total)`
  );

  return finalRules;
}

/**
 *
 * @param {string} rawText
 * @returns {string} CSS block
 */
function parseElementHideCSS(rawText) {
  const selectors = new Set();

  for (let line of rawText.split('\n')) {
    line = line.trim();
    if (!line || line.startsWith('!') || line.startsWith('[')) continue;

    if (line.startsWith('@@')) continue;
    const hashIdx = line.indexOf('##');
    if (hashIdx === -1) continue;

    const domainPart = line.slice(0, hashIdx);
    if (domainPart.length > 0) continue;

    const selector = line.slice(hashIdx + 2).trim();
    if (!selector || selector.startsWith('+js(') || selector.includes(':style(') || selector.includes(':remove')) continue;

    selectors.add(selector);
    if (selectors.size >= BLOCKLIST_CONFIG.maxHideSelectors) break;
  }

  if (selectors.size === 0) return '';

  const selectorList = [...selectors].join(',\n');
  return `${selectorList} { display: none !important; }`;
}

function getAdScore(pattern) {
  let score = 0;
  const lower = pattern.toLowerCase();
  
  if (lower.includes('/ad/') || lower.includes('/ads/')) score += 10;
  if (lower.includes('banner')) score += 10;
  if (lower.includes('popup') || lower.includes('pop-up')) score += 10;
  if (lower.includes('doubleclick') || lower.includes('adsystem')) score += 15;
  
  if (lower.includes('track') || lower.includes('pixel')) score += 5;
  if (lower.includes('promo') || lower.includes('sponsor')) score += 5;
  if (lower.includes('click') || lower.includes('impression')) score += 5;
  
  if (lower.match(/\.(gif|jpg|jpeg|png|webp)$/)) score += 8;
  if (lower.includes('*/ad*') || lower.includes('*banner*')) score += 7;
  
  return score;
}

/**
 * Registers a fresh set of rules
 *
 * @param {chrome.declarativeNetRequest.Rule[]} rules
 */
async function registerBlockingRules(rules) {
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const existingIds = existingRules.map((r) => r.id);

  console.log(`[BlocklistManager] Removing ${existingIds.length} existing rules...`);
  console.log(`[BlocklistManager] Adding ${rules.length} new rules...`);
  
  if (rules.length > 0) {
    console.log("[BlocklistManager] Example rules:", rules.slice(0, 5));
  }

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingIds,
      addRules: rules,
    });
    
    console.log(`[BlocklistManager] ✓ Successfully registered ${rules.length} blocking rules.`);
    
    const newRules = await chrome.declarativeNetRequest.getDynamicRules();
    console.log(`[BlocklistManager] Verification: ${newRules.length} rules are now active.`);
  } catch (error) {
    console.error("[BlocklistManager] ERROR registering rules:", error);
    console.error("[BlocklistManager] Failed rules sample:", rules.slice(0, 3));
  }
}

async function saveRules(rules, hideCSS) {
  await chrome.storage.local.set({
    [BLOCKLIST_CONFIG.storageKeys.rules]: rules,
    [BLOCKLIST_CONFIG.storageKeys.hideCSS]: hideCSS,
    [BLOCKLIST_CONFIG.storageKeys.lastUpdated]: Date.now(),
  });
  console.log(`[BlocklistManager] Saved ${rules.length} rules + ${hideCSS.length} chars of element-hide CSS.`);
}

async function loadRules() {
  const data = await chrome.storage.local.get([
    BLOCKLIST_CONFIG.storageKeys.rules,
    BLOCKLIST_CONFIG.storageKeys.hideCSS,
    BLOCKLIST_CONFIG.storageKeys.lastUpdated,
  ]);

  return {
    rules: data[BLOCKLIST_CONFIG.storageKeys.rules] || [],
    hideCSS: data[BLOCKLIST_CONFIG.storageKeys.hideCSS] || '',
    lastUpdated: data[BLOCKLIST_CONFIG.storageKeys.lastUpdated] || null,
  };
}

function isCacheStale(lastUpdated) {
  if (!lastUpdated) return true;
  return Date.now() - lastUpdated > BLOCKLIST_CONFIG.refreshIntervalMs;
}

async function fetchSingleList(listConfig) {
  console.log(`[BlocklistManager] Fetching ${listConfig.name}...`);
  try {
    const response = await fetch(listConfig.url, { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    const rules = parseEasyListToRules(text);
    const hideCSS = parseElementHideCSS(text);
    console.log(`[BlocklistManager] ${listConfig.name}: ${rules.length} rules, ${hideCSS.length} chars of element-hide CSS.`);
    return { rules, hideCSS };
  } catch (err) {
    console.warn(`[BlocklistManager] Failed to fetch ${listConfig.name}: ${err.message}`);
    return { rules: [], hideCSS: '' };
  }
}

async function fetchAllLists() {
  const results = await Promise.all(
    BLOCKLIST_CONFIG.lists.map((list) => fetchSingleList(list))
  );

  const allRules = results.flatMap(r => r.rules);
  const uniqueRules = [];
  const seenPatterns = new Set();
  for (const rule of allRules) {
    const pattern = rule.condition.urlFilter;
    if (!seenPatterns.has(pattern)) {
      seenPatterns.add(pattern);
      uniqueRules.push({ ...rule, id: uniqueRules.length + 1 });
    }
  }
  const finalRules = uniqueRules.slice(0, BLOCKLIST_CONFIG.maxDynamicRules);

  const allSelectors = new Set();
  for (const { hideCSS } of results) {
    if (!hideCSS) continue;
    const body = hideCSS.slice(0, hideCSS.lastIndexOf('{')).trim();
    for (const sel of body.split(',\n')) {
      const s = sel.trim();
      if (s) allSelectors.add(s);
      if (allSelectors.size >= BLOCKLIST_CONFIG.maxHideSelectors) break;
    }
  }
  const mergedHideCSS = allSelectors.size > 0
    ? `${[...allSelectors].join(',\n')} { display: none !important; }`
    : '';

  console.log(`[BlocklistManager] Merged total: ${finalRules.length} unique DNR rules, ${allSelectors.size} element-hide selectors.`);
  return { rules: finalRules, hideCSS: mergedHideCSS };
}


const blocklistState = {
  ready: false,
  ruleCount: 0,
  lastUpdated: null,
};

export async function initBlocklist() {
  console.log("[BlocklistManager] Initializing...");

  const { rules: cachedRules, lastUpdated } = await loadRules();

  if (cachedRules.length > 0) {
    await registerBlockingRules(cachedRules);
    blocklistState.ruleCount = cachedRules.length;
    blocklistState.lastUpdated = lastUpdated;
    blocklistState.ready = true;
    console.log(`[BlocklistManager] Re-registered ${cachedRules.length} cached rules.`);
  }

  if (isCacheStale(lastUpdated)) {
    console.log("[BlocklistManager] Cache stale — fetching fresh lists...");
    await refreshBlocklist();
  } else {
    const ageMinutes = Math.round((Date.now() - lastUpdated) / 60000);
    console.log(`[BlocklistManager] Cache is fresh (${ageMinutes}m old). Done.`);
  }
}

export async function refreshBlocklist() {
  const { rules: freshRules, hideCSS } = await fetchAllLists();

  if (freshRules.length === 0) {
    console.warn("[BlocklistManager] Fetch returned 0 rules. Keeping existing.");
    return;
  }

  await saveRules(freshRules, hideCSS);
  await registerBlockingRules(freshRules);

  blocklistState.ruleCount = freshRules.length;
  blocklistState.lastUpdated = Date.now();
  blocklistState.ready = true;

  console.log(`[BlocklistManager] Refresh complete — ${freshRules.length} rules active.`);
}

export function getBlocklistStats() {
  return {
    ready: blocklistState.ready,
    ruleCount: blocklistState.ruleCount,
    lastUpdated: blocklistState.lastUpdated,
  };
}