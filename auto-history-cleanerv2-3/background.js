function domainMatches(url, domain) {
  try {
    const u = new URL(url);
    const hostname = u.hostname.toLowerCase();
    const target = domain.toLowerCase();
    return hostname === target || hostname.endsWith("." + target);
  } catch (e) {
    console.error("Invalid URL:", url);
    return false;
  }
}

function cleanHistory() {
  chrome.storage.local.get({ targetDomains: [] }, (data) => {
    const targetDomains = data.targetDomains;
    const now = Date.now();
    const lookback = now - 24 * 60 * 60 * 1000 * 3;

    chrome.history.search(
      {
        text: "",
        startTime: lookback,
        maxResults: 10000,
      },
      function (results) {
        results.forEach((item) => {
          const matchedDomain = targetDomains.find(domain => domainMatches(item.url, domain));
          if (matchedDomain) {
            console.log("Deleting:", item.url, "matched with:", matchedDomain);
            chrome.history.deleteUrl({ url: item.url });
          }
        });
      }
    );

    console.log("History clean triggered at", new Date().toLocaleString(), "for domains:", targetDomains);
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get({ targetDomains: null, cleanInterval: 20 }, async (data) => {
    if (!data.targetDomains) {
      let defaultDomains = [];

      try {
        const res = await fetch(chrome.runtime.getURL("default_list.txt"));
        const text = await res.text();
        const lines = text.split("\n").map(l => l.trim()).filter(l => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(l));
        if (lines.length > 0) {
          defaultDomains = lines;
        } else {
          console.warn("default_list.txt is empty or invalid, using fallback defaults.");
        }
      } catch (err) {
        console.warn("default_list.txt not found, using fallback defaults.");
      }

      if (defaultDomains.length === 0) {
        defaultDomains = [
          "dictionary.cambridge.org",
          "translate.google.com",
          "perplexity.ai",
          "chat.com",
          "mail.google.com",
          "chatgpt.com",
          "teams.microsoft.com"
        ];
      }

      chrome.storage.local.set({ targetDomains: defaultDomains });
    }

    chrome.alarms.create("cleanHistoryAlarm", { periodInMinutes: data.cleanInterval });
    cleanHistory();
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "cleanHistoryAlarm") {
    cleanHistory();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "cleanHistoryNow") {
    cleanHistory();
    sendResponse({ success: true });
  }

  if (message.action === "updateInterval") {
    const interval = parseInt(message.interval, 10);
    if (!isNaN(interval)) {
      chrome.alarms.clear("cleanHistoryAlarm", () => {
        chrome.alarms.create("cleanHistoryAlarm", { periodInMinutes: interval });
        sendResponse({ success: true });
      });
      return true;
    }
  }
});
