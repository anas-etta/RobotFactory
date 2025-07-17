const recordedActions = {};
let isRecording = false;
let recordingTabId = null;

function getStepsForTab(tabId) {
  return recordedActions[tabId] || [];
}

// Helper: get the URL of a tab (returns a Promise)
function getTabUrl(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => resolve(tab?.url || ""));
  });
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
    if (!recordedActions[recordingTabId]) recordedActions[recordingTabId] = [];
    sendResponse({ success: true });
    return;
  }
  if (message.type === "stop_recording") {
    isRecording = false;
    recordingTabId = null;
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
    getTabUrl(tabId).then((tabUrl) => {
      const openCmd = {
        Command: "open",
        Target: tabUrl,
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
            Target: a.elementInfo?.xpath ? `xpath=${a.elementInfo.xpath}` : "",
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
    });
    return true; // Keep the message channel open for async response
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