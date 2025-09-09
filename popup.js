// popup.js - shows streak + daily totals + per-site list
const TIME_KEY = "timeData";
const STREAK_KEY = "focusStreak";
const LAST_DATE_KEY = "lastDate";
const DEFAULT_GOAL = 30; // minutes
const PRODUCTIVE_SITES = [
  // Online Learning Platforms
  "coursera.org", "khanacademy.org", "edx.org", "udemy.com", 
  "udacity.com", "skillshare.com", "futurelearn.com", "pluralsight.com",
  "lynda.com", "linkedin.com/learning", "codecademy.com", "teamtreehouse.com",
  "datacamp.com", "brilliant.org", "masterclass.com", "alison.com",
  
  // Coding & Development
  "stackoverflow.com", "github.com", "gitlab.com", "bitbucket.org",
  "freecodecamp.org", "codepen.io", "jsfiddle.net", "replit.com",
  "glitch.com", "codesandbox.io", "hackerrank.com", "leetcode.com",
  "codewars.com", "exercism.io", "topcoder.com", "chatgpt.com", "chat.deepseek.com", "gemini.google.com", "code.org",
  "w3schools.com", "mdn.io", "dev.to", "css-tricks.com",
  "stackexchange.com", "superuser.com", "serverfault.com",
  
  // Google Services (Productive)
  "docs.google.com", "drive.google.com", "classroom.google.com",
  "scholar.google.com", "research.google.com", "books.google.com",
  
  // Academic & Research
  "jstor.org", "sciencedirect.com", "researchgate.net", "academia.edu",
  "ieee.org", "springer.com", "wiley.com", "tandfonline.com",
  "arxiv.org", "pubmed.ncbi.nlm.nih.gov", "nih.gov", "science.gov",
  
  // Document & Knowledge
  "wikipedia.org", "wikibooks.org", "wikiversity.org", "wikimedia.org",
  "overleaf.com", "zotero.org", "mendeley.com", "notion.so",
  "evernote.com", "onenote.com",
  
  // YouTube Educational Channels
  "youtube.com/c/khanacademy", "youtube.com/c/crashcourse",
  "youtube.com/c/ted-ed", "youtube.com/c/numberphile",
  "youtube.com/c/3blue1brown", "youtube.com/c/computerphile",
  "youtube.com/c/mitocw", "youtube.com/c/stanfordonline",
  "youtube.com/c/harvard", "youtube.com/c/oxford",
  "youtube.com/c/cambridgeuniversity", "youtube.com/c/bbcideas",
  "youtube.com/c/sci-show", "youtube.com/c/veritasium",
  "youtube.com/c/vsauce", "youtube.com/c/minutephysics",
  "youtube.com/c/codeorg", "youtube.com/c/freecodecamp",
  "youtube.com/c/traversymedia", "youtube.com/c/programmingwithmosh",
  
  // Language Learning
  "duolingo.com", "memrise.com", "babbel.com", "busuu.com",
  "rosetta-stone.com", "ankiweb.net", "quizlet.com",
  
  // Other Educational
  "ted.com", "medium.com/topic/technology", "blinkist.com",
  "goodreads.com", "project-gutenberg.org", "archive.org",
  "nationalgeographic.com", "howstuffworks.com", "investopedia.com",
  
  // News & Information (Educational)
  "bbc.com/future", "technologyreview.com", "scientificamerican.com",
  "nature.com", "sciencemag.org", "newscientist.com",
  
  // Productivity Tools
  "trello.com", "asana.com", "todoist.com", "slack.com",
  "teams.microsoft.com", "zoom.us", "meet.google.com"
];

function isProductiveDomain(domain) {
  if (!domain) return false;
  return PRODUCTIVE_SITES.some(site => domain.includes(site));
}

function formatMinutes(seconds) {
  const m = Math.floor(seconds / 60);
  return `${m} min`;
}

function render(timeData = {}, streak = 0) {
  document.getElementById("streak").textContent = streak || 0;
  document.getElementById("goal-min").textContent = DEFAULT_GOAL;

  // compute total seconds and productive seconds
  let totalSeconds = 0;
  let productiveSeconds = 0;
  
  for (const [domain, secs] of Object.entries(timeData)) {
    totalSeconds += secs || 0;
    if (isProductiveDomain(domain)) {
      productiveSeconds += secs || 0;
    }
  }
  
  const totalMinutes = Math.floor(totalSeconds / 60);
  const productiveMinutes = Math.floor(productiveSeconds / 60);
  const progressPercent = Math.min(100, (productiveMinutes / DEFAULT_GOAL) * 100);
  
  document.getElementById("total-min").textContent = `${totalMinutes} min`;
  document.getElementById("productive-min").textContent = `${productiveMinutes} min`;
  document.getElementById("progress-bar").style.width = `${progressPercent}%`;
  
  // Update progress text
  if (productiveMinutes >= DEFAULT_GOAL) {
    document.getElementById("progress-text").textContent = "Goal achieved! 🎉";
    document.getElementById("progress-bar").style.background = "linear-gradient(90deg, #cc0000, #ff3333)";
  } else {
    document.getElementById("progress-text").textContent = 
      `${DEFAULT_GOAL - productiveMinutes} min left to goal`;
    document.getElementById("progress-bar").style.background = "linear-gradient(90deg, #cc0000, #ff3333)";
  }

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
    
    // Add productivity indicator
    const productivityClass = isProductiveDomain(domain) ? "productive" : "distracting";
    div.innerHTML = `
      <span class="domain ${productivityClass}">${domain}</span>
      <span class="mins">${formatMinutes(secs)}</span>
    `;
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
  
  // Refresh button
  const refreshBtn = document.getElementById("refresh-btn");
  refreshBtn.addEventListener("click", () => {
    chrome.storage.local.get([TIME_KEY, STREAK_KEY, LAST_DATE_KEY], (res) => {
      const timeData = res[TIME_KEY] || {};
      const streak = res[STREAK_KEY] || 0;
      render(timeData, streak);
    });
  });
});

// Listen for storage changes to update the UI in real-time
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes[TIME_KEY] || changes[STREAK_KEY]) {
      chrome.storage.local.get([TIME_KEY, STREAK_KEY], (res) => {
        const timeData = res[TIME_KEY] || {};
        const streak = res[STREAK_KEY] || 0;
        render(timeData, streak);
      });
    }
  }
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "timeUpdated") {
    // Refresh the data when time is updated
    chrome.storage.local.get([TIME_KEY, STREAK_KEY], (res) => {
      const timeData = res[TIME_KEY] || {};
      const streak = res[STREAK_KEY] || 0;
      render(timeData, streak);
    });
  }
});
