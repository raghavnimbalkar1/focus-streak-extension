// background.js - Focus Streak
// Tracks time spent per domain (seconds), does daily rollover and streak updates.

const TIME_KEY = "timeData";       // { domain: seconds, ... }
const STREAK_KEY = "focusStreak";  // integer days
const LAST_DATE_KEY = "lastDate";  // "YYYY-MM-DD"
const DAILY_GOAL_MINUTES = 30;     // default goal for productive sites
const PRODUCTIVE_SITES = [
  "coursera.org", "khanacademy.org", "edx.org",
  "udemy.com", "stackoverflow.com", "github.com",
  "docs.google.com", "drive.google.com", "classroom.google.com",
  "scholar.google", "research.google"
];

let activeTabId = null;
let activeDomain = null;
let lastStart = Date.now();
let isTracking = false;
let trackingInterval = null;

// --- Promisified chrome storage/tab helpers ---
function getStorage(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}
function setStorage(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}
function queryActiveTab() {
  return new Promise((resolve) =>
    chrome.tabs.query({ active: true, currentWindow: true }, resolve)
  );
}
function getTab(tabId) {
  return new Promise((resolve) =>
    chrome.tabs.get(tabId, (tab) => resolve(tab))
  );
}

// --- Helpers ---
function todayStr() {
  return new Date().toISOString().split("T")[0];
}
function getDomain(url) {
  try {
    const h = new URL(url).hostname;
    return h.replace(/^www\./, "");
  } catch {
    return null;
  }
}
function msUntilNextMidnight() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

// Check if domain is productive
function isProductiveDomain(domain) {
  if (!domain) return false;
  return PRODUCTIVE_SITES.some(site => domain.includes(site));
}

// Start the tracking interval
function startTrackingInterval() {
  if (trackingInterval) clearInterval(trackingInterval);
  
  trackingInterval = setInterval(async () => {
    if (activeDomain && isTracking) {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - lastStart) / 1000);
      
      if (elapsedSeconds >= 15) { // Save every 15 seconds
        await incrementTime(activeDomain, elapsedSeconds);
        lastStart = now;
        
        // Update UI if popup is open
        chrome.runtime.sendMessage({type: "timeUpdated"}).catch(() => {});
      }
    }
  }, 5000); // Check every 5 seconds
}

// Increment time (seconds) for domain in storage
async function incrementTime(domain, seconds) {
  if (!domain || seconds <= 0) return;
  const data = await getStorage(TIME_KEY);
  const timeData = data[TIME_KEY] || {};
  timeData[domain] = (timeData[domain] || 0) + seconds;
  await setStorage({ [TIME_KEY]: timeData });
  console.log(`Saved +${seconds}s for ${domain} (total ${(timeData[domain] || 0)}s)`);
  
  // Check if we should update streak immediately
  await checkAndUpdateStreak();
}

// Check if we've reached the daily goal and update streak
async function checkAndUpdateStreak() {
  const data = await getStorage([TIME_KEY, STREAK_KEY, LAST_DATE_KEY]);
  const storedTimes = data[TIME_KEY] || {};
  let streak = data[STREAK_KEY] || 0;
  
  // Calculate productive seconds
  let productiveSeconds = 0;
  for (const [domain, secs] of Object.entries(storedTimes)) {
    if (isProductiveDomain(domain)) {
      productiveSeconds += secs;
    }
  }
  
  const productiveMinutes = Math.floor(productiveSeconds / 60);
  
  // If we've reached the goal, update streak
  if (productiveMinutes >= DAILY_GOAL_MINUTES && streak === 0) {
    streak = 1;
    await setStorage({ [STREAK_KEY]: streak });
    console.log(`✅ Streak started! productiveMinutes=${productiveMinutes}. New streak=${streak}`);
  }
}

// Called when switching away from current site — save elapsed
async function saveElapsedForCurrent() {
  if (!activeDomain || !lastStart || !isTracking) return;
  const now = Date.now();
  const elapsedSeconds = Math.floor((now - lastStart) / 1000);
  if (elapsedSeconds > 0) {
    await incrementTime(activeDomain, elapsedSeconds);
  }
  lastStart = now;
}

// Daily rollover check: evaluate yesterday's productive minutes -> update streak -> reset timeData
async function dailyRolloverIfNeeded() {
  const data = await getStorage([TIME_KEY, STREAK_KEY, LAST_DATE_KEY]);
  const lastDate = data[LAST_DATE_KEY];
  const storedTimes = data[TIME_KEY] || {};
  let streak = data[STREAK_KEY] || 0;

  if (!lastDate) {
    // First time setup
    await setStorage({ [LAST_DATE_KEY]: todayStr() });
    return;
  }

  if (lastDate !== todayStr()) {
    // Evaluate productive minutes from the storedTimes (yesterday)
    let productiveSeconds = 0;
    for (const [domain, secs] of Object.entries(storedTimes)) {
      if (isProductiveDomain(domain)) {
        productiveSeconds += secs;
      }
    }
    const productiveMinutes = Math.floor(productiveSeconds / 60);
    
    // Check if we should break the streak
    if (productiveMinutes < DAILY_GOAL_MINUTES && streak > 0) {
      streak = 0;
      console.log(`❌ Missed goal. productiveMinutes=${productiveMinutes}. Streak reset.`);
    } else if (productiveMinutes >= DAILY_GOAL_MINUTES) {
      streak += 1;
      console.log(`✅ Earned streak. productiveMinutes=${productiveMinutes}. New streak=${streak}`);
    }

    // Reset site times for the new day and store new lastDate & streak
    await setStorage({
      [TIME_KEY]: {},
      [STREAK_KEY]: streak,
      [LAST_DATE_KEY]: todayStr(),
    });
    
    // Send notification if streak was broken
    if (streak === 0 && productiveMinutes < DAILY_GOAL_MINUTES) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Focus Streak Broken',
        message: `You missed your daily goal of ${DAILY_GOAL_MINUTES} minutes. Your streak has been reset.`
      });
    }
  }
}

// Schedule midnight alarm to do the rollover
function scheduleMidnightAlarm() {
  const ms = msUntilNextMidnight();
  chrome.alarms.create("midnightReset", { when: Date.now() + ms });
  console.log(`Midnight alarm scheduled in ${Math.round(ms / 1000)}s`);
}

// Send notification if user is on non-productive site for too long
async function checkProductiveTime() {
  if (!activeDomain) return;
  
  const data = await getStorage(TIME_KEY);
  const timeData = data[TIME_KEY] || {};
  const currentSiteTime = timeData[activeDomain] || 0;
  
  // If on non-productive site for more than 5 minutes, send notification
  if (!isProductiveDomain(activeDomain) && currentSiteTime > 300) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Focus Alert',
      message: `You've been on ${activeDomain} for over 5 minutes. Consider returning to your studies!`
    });
  }
}

// --- Event listeners ---

// Init on startup/installation
chrome.runtime.onInstalled.addListener(async () => {
  console.log("Focus Streak installed/updated.");
  await dailyRolloverIfNeeded();
  scheduleMidnightAlarm();
  // set initial active tab info
  const tabs = await queryActiveTab();
  if (tabs && tabs[0]) {
    activeTabId = tabs[0].id;
    activeDomain = getDomain(tabs[0].url) || "newtab";
    lastStart = Date.now();
    isTracking = true;
    startTrackingInterval();
  }
});

// Also init when service worker starts (cold start)
(async function initOnStart() {
  try {
    await dailyRolloverIfNeeded();
    scheduleMidnightAlarm();
    const tabs = await queryActiveTab();
    if (tabs && tabs[0]) {
      activeTabId = tabs[0].id;
      activeDomain = getDomain(tabs[0].url) || null;
      lastStart = Date.now();
      isTracking = true;
      startTrackingInterval();
    }
    console.log("Background init done. activeDomain=", activeDomain);
  } catch (e) {
    console.error("Init error:", e);
  }
})();

// When a tab becomes active (switches tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    await dailyRolloverIfNeeded();

    // save time for previous active site
    await saveElapsedForCurrent();

    // set new active tab/domain
    const tab = await getTab(activeInfo.tabId);
    activeTabId = activeInfo.tabId;
    activeDomain = getDomain(tab?.url) || null;
    lastStart = Date.now();
    isTracking = true;
    
    // Check if we should send a notification about time spent
    await checkProductiveTime();
    
    console.log("Activated tab ->", activeDomain);
  } catch (e) {
    console.error("onActivated error:", e);
  }
});

// When an active tab updates (navigates/loads)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  try {
    if (tab.active && changeInfo.status === "complete") {
      await dailyRolloverIfNeeded();
      // save elapsed for prior domain then switch
      await saveElapsedForCurrent();
      activeDomain = getDomain(tab.url) || null;
      lastStart = Date.now();
      isTracking = true;
      
      // Check if we should send a notification about time spent
      await checkProductiveTime();
      
      console.log("Tab updated (active) ->", activeDomain);
    }
  } catch (e) {
    console.error("onUpdated error:", e);
  }
});

// Window focus change (browser lost/gained focus)
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  try {
    await dailyRolloverIfNeeded();

    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      // lost focus (user switched to other app)
      await saveElapsedForCurrent();
      activeDomain = null;
      activeTabId = null;
      isTracking = false;
      console.log("Window lost focus -> paused tracking");
    } else {
      // regained focus: set active tab domain
      const tabs = await queryActiveTab();
      if (tabs && tabs[0]) {
        await saveElapsedForCurrent();
        activeTabId = tabs[0].id;
        activeDomain = getDomain(tabs[0].url) || null;
        lastStart = Date.now();
        isTracking = true;
        
        // Check if we should send a notification about time spent
        await checkProductiveTime();
        
        console.log("Window focus ->", activeDomain);
      }
    }
  } catch (e) {
    console.error("onFocusChanged error:", e);
  }
});

// Alarm (midnight) handler
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "midnightReset") {
    console.log("Midnight alarm triggered, running daily rollover...");
    // Save elapsed for current site (end of day)
    await saveElapsedForCurrent();
    // perform rollover
    await dailyRolloverIfNeeded();
    // schedule next alarm
    scheduleMidnightAlarm();
  }
});

// Ensure we save elapsed time when the worker is unloaded (best-effort)
chrome.runtime.onSuspend.addListener(() => {
  saveElapsedForCurrent().catch(() => {});
});
