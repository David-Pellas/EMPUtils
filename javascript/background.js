
import {
  initBlocklist,
  refreshBlocklist,
  getBlocklistStats,
} from "./blocklist-manager.js";

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`[Background] onInstalled — reason: ${details.reason}`);
  await initBlocklist();
  schedulePeriodicRefresh();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log("[Background] onStartup — re-initializing blocklist.");
  await initBlocklist();
  schedulePeriodicRefresh();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {

    case "REFRESH_BLOCKLIST":
      refreshBlocklist().then(() => {
        sendResponse({ success: true, stats: getBlocklistStats() });
      }).catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
      return true;

    case "GET_BLOCKLIST_STATUS":
      sendResponse({ success: true, stats: getBlocklistStats() });
      break;

    default:
      sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
  }
});

function schedulePeriodicRefresh() {
  // Prevent duplicate alarms
  chrome.alarms.get("blocklist-refresh", (existing) => {
    if (!existing) {
      chrome.alarms.create("blocklist-refresh", {
        delayInMinutes: 60 * 24,
        periodInMinutes: 60 * 24,
      });
      console.log("[Background] Scheduled 24h blocklist refresh alarm.");
    }
  });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "blocklist-refresh") {
    console.log("[Background] 24h alarm — refreshing blocklists.");
    await refreshBlocklist();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "WHITELIST_DOMAIN") {
        const domain = message.domain;

        // Use priority 2, else breaks
        chrome.declarativeNetRequest.updateDynamicRules({
            addRules: [{
                "id": 8888, 
                "priority": 2, 
                "action": { "type": "allow" },
                "condition": {
                    "initiatorDomains": [domain],
                    "resourceTypes": ["script", "xmlhttprequest", "sub_frame"]
                }
            }],
            removeRuleIds: [8888]
        }).then(() => {
            console.log(`[Background] DNR Bypass active for: ${domain}`);
            sendResponse({ success: true });
        });
        return true; 
    }
});