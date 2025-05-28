const domainBox = document.getElementById("domainBox");
const saveBtn = document.getElementById("saveBtn");
const cleanNowBtn = document.getElementById("cleanNowBtn");
const intervalSlider = document.getElementById("intervalSlider");
const intervalValue = document.getElementById("intervalValue");
const exportIcon = document.getElementById("exportIcon");
const importIcon = document.getElementById("importIcon");
const importFile = document.getElementById("importFile");

// Helper to sanitize text
function escapeHTML(str) {
  return str.replace(/[&<>"']/g, match => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;'
  }[match]));
}

// Render domain list with optional highlights
function renderDomainList(domains, highlightSet = new Set()) {
  domainBox.innerHTML = domains.map(domain => {
    const escaped = escapeHTML(domain);
    return `<div${highlightSet.has(domain) ? ' class="domain-new"' : ''}>${escaped}</div>`;
  }).join("");
}

// Load domains and interval
chrome.storage.local.get({ targetDomains: [], cleanInterval: 20 }, (data) => {
  renderDomainList(data.targetDomains);
  intervalSlider.value = data.cleanInterval;
  intervalValue.textContent = data.cleanInterval;
});

// Update slider value
intervalSlider.addEventListener("input", () => {
  intervalValue.textContent = intervalSlider.value;
});

// Save domains
saveBtn.addEventListener("click", () => {
  const lines = Array.from(domainBox.children)
    .map(el => el.textContent.trim().replace(/\/+$/, '').toLowerCase())
    .filter(isValidDomain);

  const uniqueDomains = [...new Set(lines)].sort();
  const interval = parseInt(intervalSlider.value, 10);

  chrome.storage.local.set({
    targetDomains: uniqueDomains,
    cleanInterval: interval
  }, () => {
    renderDomainList(uniqueDomains); // reset highlight
    chrome.runtime.sendMessage({ action: "updateInterval", interval }, () => {
      showStatus("Domains and interval saved!");
    });
  });
});

// Manual clean
cleanNowBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "cleanHistoryNow" }, (response) => {
    if (response?.success) {
      showStatus("History cleaned successfully.");
    }
  });
});

// Export domains
exportIcon.addEventListener("click", () => {
  chrome.storage.local.get({ targetDomains: [] }, (data) => {
    const blob = new Blob([data.targetDomains.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cleanbrowse_domains.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
});

// Import trigger
importIcon.addEventListener("click", () => {
  importFile.click();
});

// Import handler
importFile.addEventListener("change", () => {
  const file = importFile.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const imported = e.target.result
      .split("\n")
      .map(line => line.trim().replace(/\/+$/, '').toLowerCase())
      .filter(isValidDomain);

    const current = Array.from(domainBox.children)
      .map(el => el.textContent.trim().replace(/\/+$/, '').toLowerCase())
      .filter(isValidDomain);

    const merged = [...new Set([...current, ...imported])].sort();
    const highlightSet = new Set(imported.filter(d => !current.includes(d)));
    renderDomainList(merged, highlightSet);
    showStatus("Domains imported.");
  };
  reader.readAsText(file);
});

// Domain validator
function isValidDomain(domain) {
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain);
}

// Status display
function showStatus(message) {
  const statusDiv = document.getElementById("statusMessage");
  statusDiv.textContent = message;
  setTimeout(() => {
    statusDiv.textContent = "";
  }, 3000);
}
