document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["timeData"], (res) => {
    const timeData = res.timeData || {};
    const list = document.getElementById("timeList");
    list.innerHTML = "";

    for (const [domain, seconds] of Object.entries(timeData)) {
      const minutes = Math.floor(seconds / 60);
      const li = document.createElement("li");
      li.textContent = `${domain}: ${minutes} min`;
      list.appendChild(li);
    }

    if (Object.keys(timeData).length === 0) {
      list.innerHTML = "<li>No data yet</li>";
    }
  });
});
