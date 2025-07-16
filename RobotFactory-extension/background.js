const recordedActions = {};
let isRecording = false;
let recordingTabId = null;

function getStepsForTab(tabId) {
  return recordedActions[tabId] || [];
}

// Helper to get the current URL of a tab (returns a Promise)
function getTabUrl(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => resolve(tab?.url || ""));
  });
}

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
      recordedActions[recordingTabId].push(message.action);
      chrome.runtime.sendMessage({
        type: "actions_updated",
        tabId: recordingTabId,
        actions: recordedActions[recordingTabId]
      });
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
            Target: a.elementInfo?.id
              ? `id=${a.elementInfo.id}`
              : (a.elementInfo?.xpath ? `xpath=${a.elementInfo.xpath}` : (a.elementInfo?.cssSelector || "")),
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
    return true; // Keep message port open for async response
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