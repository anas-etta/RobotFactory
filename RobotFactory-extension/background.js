const recordedActions = {};
let isRecording = false;
let recordingTabId = null;
let recordingStartUrl = null; // <-- Track the starting URL

function getStepsForTab(tabId) {
  return recordedActions[tabId] || [];
}

// Helper: get the URL of a tab (returns a Promise)
function getTabUrl(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => resolve(tab?.url || ""));
  });
}

// Returns "id=..." if id exists, else "xpath=..." for absXPath
function getBestSelector(elementInfo) {
  if (elementInfo.id) return `id=${elementInfo.id}`;
  if (elementInfo.absXPath) return `xpath=${elementInfo.absXPath}`;
  return "";
}

// Auto-inject content script after navigation if recording is active
chrome.webNavigation.onCompleted.addListener(
  function (details) {
    if (
      details.tabId === recordingTabId &&
      isRecording &&
      details.frameId === 0 // main frame only
    ) {
      chrome.scripting.executeScript({
        target: { tabId: details.tabId },
        files: ["content-script.js"],
      });
    }
  },
  { url: [{ schemes: ["http", "https"] }] }
);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "start_recording") {
    isRecording = true;
    recordingTabId = message.tabId;

    // Set the starting URL for this recording session
    if (sender.tab && sender.tab.url) {
      recordingStartUrl = sender.tab.url;
    } else if (message.tabUrl) {
      recordingStartUrl = message.tabUrl;
    } else {
      // fallback to try to get it via chrome.tabs.get
      chrome.tabs.get(recordingTabId, (tab) => {
        recordingStartUrl = tab?.url || "";
      });
    }

    if (!recordedActions[recordingTabId]) recordedActions[recordingTabId] = [];
    sendResponse({ success: true });
    return;
  }
  if (message.type === "stop_recording") {
    isRecording = false;
    recordingTabId = null;
    // Leave recordingStartUrl as is, so download_json uses it.
    sendResponse({ success: true });
    return;
  }
  if (message.type === "get_recording_state") {
    sendResponse({ isRecording, recordingTabId });
    return;
  }
  if (message.type === "get_recorded_actions") {
    sendResponse({ actions: getStepsForTab(message.tabId) });
    return;
  }
  if (message.type === "recorded_action" && sender.tab) {
    if (isRecording && sender.tab.id === recordingTabId) {
      if (!recordedActions[recordingTabId]) recordedActions[recordingTabId] = [];
      // Exclude any action with cmd "open" (shouldn't happen if content-script.js is correct)
      if (message.action.cmd !== "open") {
        recordedActions[recordingTabId].push(message.action);
        chrome.runtime.sendMessage({
          type: "actions_updated",
          tabId: recordingTabId,
          actions: recordedActions[recordingTabId],
        });
      }
    }
    sendResponse({ success: true });
    return;
  }
  if (message.type === "download_json") {
    let tabId = message.tabId || recordingTabId;
    let actions = recordedActions[tabId] || [];
    // Always use the url where recording started
    let urlToUse = recordingStartUrl;
    if (!urlToUse) {
      // fallback to current tab URL if for some reason it's missing
      getTabUrl(tabId).then((tabUrl) => {
        urlToUse = tabUrl;
        exportJson(urlToUse, actions, sendResponse);
      });
      return true;
    } else {
      exportJson(urlToUse, actions, sendResponse);
      return true;
    }
  }
  if (message.type === "clear_actions") {
    const tabId = message.tabId;
    if (tabId) recordedActions[tabId] = [];
    chrome.runtime.sendMessage({
      type: "actions_updated",
      tabId: tabId,
      actions: []
    });
    sendResponse({ success: true });
    return;
  }
});

// Helper to export rechJson
function exportJson(urlToUse, actions, sendResponse) {
  const openCmd = {
    Command: "open",
    Target: urlToUse,
    Value: "",
    Description: ""
  };
  const rechJson = {
    Name: "rech",
    CreationDate: new Date().toISOString().split("T")[0],
    Commands: [
      openCmd,
      ...actions.map(a => ({
        Command: a.cmd === "input" ? "type" : a.cmd,
        Target: a.elementInfo ? getBestSelector(a.elementInfo) : "",
        Value: a.value || "",
        Targets: [],
        Description: ""
      }))
    ]
  };
  const json = JSON.stringify(rechJson, null, 2);
  const base64 = btoa(unescape(encodeURIComponent(json)));
  const url = "data:application/json;base64," + base64;
  chrome.downloads.download({
    url: url,
    filename: "rech.json",
    saveAs: true
  });
  sendResponse({ success: true });
}