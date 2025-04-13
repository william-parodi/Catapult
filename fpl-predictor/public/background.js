chrome.runtime.onInstalled.addListener(() => {
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
});