let activeTabId = null;
let activeDomain = null;
let lastActivated = Date.now();

// Get domain from URL
function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return null;
  }
}

// Save time spent on a domain
function saveTime(domain, seconds) {
  if (!domain || seconds <= 0) return;

  chrome.storage.local.get(["timeData"], (res) => {
    let timeData = res.timeData || {};
    if (!timeData[domain]) {
      timeData[domain] = 0;
    }
    timeData[domain] += seconds;

    chrome.storage.local.set({ timeData });
    console.log(`⏱️ Saved ${seconds}s for ${domain}. Total: ${timeData[domain]}s`);
  });
}

// When a new tab becomes active
chrome.tabs.onActivated.addListener((activeInfo) => {
  const now = Date.now();
  const elapsed = Math.floor((now - lastActivated) / 1000);

  if (activeDomain) {
    saveTime(activeDomain, elapsed);
  }

  lastActivated = now;

  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab && tab.url) {
      activeTabId = tab.id;
      activeDomain = getDomain(tab.url);
      console.log(`🔍 Switched to ${activeDomain}`);
    }
  });
});

// When tab URL changes (like navigation)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.url) {
    const now = Date.now();
    const elapsed = Math.floor((now - lastActivated) / 1000);

    if (activeDomain) {
      saveTime(activeDomain, elapsed);
    }

    activeDomain = getDomain(changeInfo.url);
    lastActivated = now;
    console.log(`🌍 Navigated to ${activeDomain}`);
  }
});

// On extension unload, save last session
self.addEventListener("beforeunload", () => {
  const now = Date.now();
  const elapsed = Math.floor((now - lastActivated) / 1000);
  if (activeDomain) {
    saveTime(activeDomain, elapsed);
  }
});
