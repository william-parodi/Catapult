// contentScript.js

console.log("Content script injected and loaded.");

// Immediately check for the sign-in heading to detect login status.
(function() {
    // Attempt to find the h2 element with the 'Sign In' text.
    const signInHeading = document.querySelector('h2.Login__LoginTitle-sc-1dpiyoc-1.jBlYiT');
    // Alternatively, if unsure about the classes, you can search all h2 elements:
    // const signInHeading = [...document.querySelectorAll('h2')]
    //   .find(el => el.textContent.includes('Sign In'));
    if (signInHeading && signInHeading.textContent.includes('Sign In')) {
      // Found the "Sign In" heading => user is NOT logged in
      chrome.storage.local.set({ isFPLLoggedIn: false });
    } else {
      // If we don't see that heading, assume user is logged in (or on a different part of the site)
      chrome.storage.local.set({ isFPLLoggedIn: true });
    }
})();

// Listen for messages from the extension (popup or background)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Received message:", request);
  if (request.type === "GET_FPL_STATS") {
    console.log("Received request for FPL stats.");
    getFPLStats(request.team, request.gw)
      .then((stats) => {
        // Store the aggregated statistics in chrome.storage.local
        chrome.storage.local.set({ fplStats: stats }, () => {
          console.log("FPL stats stored successfully.");
          sendResponse({ status: "success", stats: stats });
        });
      })
      .catch((error) => {
        console.error("Error fetching FPL stats:", error);
        sendResponse({ status: "error", error: error.toString() });
      });
    // Signal asynchronous response
    return true;
  }
});

// Fetch the current event (gameweek) from FPL's bootstrap static endpoint.
async function getCurrentEvent() {
  const response = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/");
  if (!response.ok) {
    throw new Error("Failed to fetch bootstrap data.");
  }
  const data = await response.json();
  // Find the event with is_current true; fallback to is_next
  const currentEvent = data.events.find((e) => e.is_current);
  if (currentEvent) return currentEvent.id;
  const nextEvent = data.events.find((e) => e.is_next);
  if (nextEvent) return nextEvent.id;
  throw new Error("No current or next event found.");
}


// Helper: Returns a promise that resolves after ms milliseconds.
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// background.js (Manifest V3 service worker)

// The automation code we want to inject into the Transfers page.
async function waitForElement(selector, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const intervalTime = 500;
    let timeElapsed = 0;
    const interval = setInterval(() => {
      const element = document.querySelector(selector);
      if (element) {
        clearInterval(interval);
        resolve(element);
      }
      timeElapsed += intervalTime;
      if (timeElapsed >= timeout) {
        clearInterval(interval);
        reject(new Error("Element not found: " + selector));
      }
    }, intervalTime);
  });
}

async function automateTransfer(currentPlayerId, newPlayerId) {
  try {
    // 1) Attempt to find or click a navigation link to /transfers
    let navButton = Array.from(document.querySelectorAll('a')).find(a => {
      const href = a.getAttribute("href");
      return href && href.trim() === "/transfers" && a.textContent.trim().toLowerCase().includes("transfers");
    });
    // If not found, try an XPath or other fallback logic...
    if (!navButton) {
      console.warn("Transfers nav link not found by querySelector, using fallback...");
      const xpath = '/html/body/main/div/div[1]/div/div/div/nav/ul/li[4]/a';
      navButton = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    }
    if (!navButton) throw new Error("Transfers nav link not found");
    navButton.click();
    console.log("Clicked the Transfers nav link.");
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 2) Wait for the list view button
    const listViewSelector = "#root > div:nth-child(2) > div.SquadBase__PusherWrap-sc-16cuskw-0.sQBlU > div > div > div.Layout__Main-sc-eg6k6r-1.eRnmvx > div:nth-child(2) > div.GraphicPatterns__PatternWrapMain-sc-bfgp6c-0.jbGktN > div:nth-child(3) > ul > li:nth-child(2) > a";
    const listViewButton = await waitForElement(listViewSelector, 15000);
    listViewButton.click();
    console.log("Clicked list view button.");
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 3) Fetch bootstrap-static data to get web_name
    const res = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/");
    const data = await res.json();
    const elements = data.elements;
    const currentPlayerData = elements.find(p => p.id === Number(currentPlayerId));
    const newPlayerData = elements.find(p => p.id === Number(newPlayerId));
    if (!currentPlayerData || !newPlayerData) {
      throw new Error("Could not find data for one or both players in bootstrap-static");
    }
    const currentWebName = currentPlayerData.web_name;
    const newWebName = newPlayerData.web_name;
    console.log("Removing player:", currentWebName, "Adding player:", newWebName);

    // 4) Remove current player
    let removeButton = null;
    const candidateButtons = Array.from(document.querySelectorAll("button"));
    candidateButtons.forEach(btn => {
      if (btn.innerText.toLowerCase().includes(currentWebName.toLowerCase()) &&
          btn.innerText.toLowerCase().includes("remove")) {
        removeButton = btn;
      }
    });
    if (!removeButton) throw new Error("Remove button not found for " + currentWebName);
    removeButton.click();
    console.log("Clicked remove for", currentWebName);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 5) Search for + add new player
    const searchInput = await waitForElement('input[placeholder*="Search players"]', 10000);
    searchInput.value = newWebName;
    const inputEvent = new Event('input', { bubbles: true });
    searchInput.dispatchEvent(inputEvent);
    console.log("Typed new player's name in search.");
    await new Promise(resolve => setTimeout(resolve, 3000));

    let addButton = null;
    const allButtons = Array.from(document.querySelectorAll("button"));
    allButtons.forEach(btn => {
      if (btn.innerText.toLowerCase().includes(newWebName.toLowerCase()) &&
          btn.innerText.toLowerCase().includes("add")) {
        addButton = btn;
      }
    });
    if (!addButton) throw new Error("Add button not found for " + newWebName);
    addButton.click();
    console.log("Clicked add for", newWebName);

  } catch (err) {
    console.error("Error in automateTransfer:", err);
  }
}

// Listen for messages from ComparePlayer.js
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.type === 'AUTOMATE_TRANSFER') {
    const { currentId, newId } = request.payload;
    console.log("Received request to automate transfer from", currentId, "to", newId);

    // We get the active tab so we can run the injection there
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      console.error("No active tab found.");
      sendResponse({ error: "No active tab" });
      return;
    }

    // Use chrome.scripting to inject + run the function in the current tab
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (cId, nId) => automateTransfer(cId, nId), // references the function above
        args: [currentId, newId]
      });
      sendResponse({ success: true });
    } catch (err) {
      console.error("Injection failed:", err);
      sendResponse({ error: err.message });
    }
    return true; // indicates async response
  }
});