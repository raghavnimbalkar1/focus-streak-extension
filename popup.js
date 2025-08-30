// popup.js - shows streak + daily totals + per-site list
const TIME_KEY = "timeData";
const STREAK_KEY = "focusStreak";
const LAST_DATE_KEY = "lastDate";
const DEFAULT_GOAL = 30; // minutes

function formatMinutes(seconds) {
  const m = Math.floor(seconds / 60);
  return `${m} min`;
}

function render(timeData = {}, streak = 0) {
  document.getElementById("streak").textContent = streak || 0;
  document.getElementById("goal-min").textContent = DEFAULT_GOAL;

  // compute total seconds
  let totalSeconds = 0;
  for (const val of Object.values(timeData)) totalSeconds += val || 0;
  document.getElementById("total-min").textContent = `${Math.floor(totalSeconds / 60)} min`;

  const listEl = document.getElementById("site-list");
  listEl.innerHTML = "";

  const entries = Object.entries(timeData).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    listEl.innerHTML = "<div style='color:#6b7280;padding:6px'>No activity yet</div>";
    return;
  }

  const frag = document.createDocumentFragment();
  for (const [domain, secs] of entries) {
    const div = document.createElement("div");
    div.className = "site-item";
    div.innerHTML = `<span class="domain">${domain}</span><span class="mins">${formatMinutes(secs)}</span>`;
    frag.appendChild(div);
  }
  listEl.appendChild(frag);
}

// Load data on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get([TIME_KEY, STREAK_KEY, LAST_DATE_KEY], (res) => {
    const timeData = res[TIME_KEY] || {};
    const streak = res[STREAK_KEY] || 0;
    render(timeData, streak);
  });

  // Reset button
  const resetBtn = document.getElementById("reset-btn");
  resetBtn.addEventListener("click", () => {
    if (!confirm("Reset today's tracked data? This cannot be undone.")) return;
    chrome.storage.local.set({ [TIME_KEY]: {} }, () => {
      render({}, 0);
    });
  });
});
