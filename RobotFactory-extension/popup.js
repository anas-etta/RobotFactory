let currentTabId = null;
let isRecording = false;

function updateUI(isRecording, actions = []) {
  const statusEl = document.getElementById("status");
  const toggleBtn = document.getElementById("toggleRecording");
  const stepsEl = document.getElementById("steps");

  if (isRecording) {
    statusEl.textContent = "Recording actions...";
    toggleBtn.textContent = "Stop Recording";
  } else {
    statusEl.textContent = "Not recording.";
    toggleBtn.textContent = "Start Recording";
  }

  renderSteps(actions);
}

function renderSteps(actions) {
  const stepsEl = document.getElementById("steps");
  if (!actions || actions.length === 0) {
    stepsEl.innerHTML = "<span style='color:#888'>No actions recorded yet.</span>";
    return;
  }
  stepsEl.innerHTML = actions.map((a, i) => {
    let label = `<span class="step-cmd">${a.cmd}</span>`;
    if (a.cmd === "click") {
      label += ` on <code>${a.elementInfo?.xpath || a.elementInfo?.cssSelector || a.elementInfo?.tagName || "?"}</code>`;
    } else if (a.cmd === "input") {
      label += ` on <code>${a.elementInfo?.xpath || a.elementInfo?.cssSelector || a.elementInfo?.tagName || "?"}</code> = <code>${a.value ?? ""}</code>`;
    } else if (a.cmd === "navigate" || a.cmd === "open") {
      label += ` to <code>${a.url}</code>`;
    }
    return `<div class="step-row">${i + 1}. ${label}</div>`;
  }).join("");
}

function refreshSteps() {
  if (!currentTabId) return;
  chrome.runtime.sendMessage({ type: "get_recorded_actions", tabId: currentTabId }, resp => {
    renderSteps(resp && resp.actions ? resp.actions : []);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const statusEl = document.getElementById("status");
  const toggleBtn = document.getElementById("toggleRecording");
  const downloadBtn = document.getElementById("downloadJson");
  const clearBtn = document.getElementById("clearActions");

  // Get current tab and update UI based on recording state and current steps
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (
      !tab ||
      !tab.id ||
      tab.url.startsWith("chrome://") ||
      tab.url.startsWith("chrome-extension://") ||
      tab.url.startsWith("https://chrome.google.com/webstore")
    ) {
      updateUI(false, []);
      statusEl.textContent = "Cannot record on this tab.";
      return;
    }
    currentTabId = tab.id;
    chrome.runtime.sendMessage({ type: "get_recording_state" }, (resp) => {
      isRecording = resp && resp.isRecording && resp.recordingTabId === currentTabId;
      chrome.runtime.sendMessage({ type: "get_recorded_actions", tabId: currentTabId }, actionsResp => {
        updateUI(isRecording, actionsResp && actionsResp.actions ? actionsResp.actions : []);
      });
    });
  });

  toggleBtn.addEventListener("click", () => {
    if (!currentTabId) return;
    chrome.tabs.get(currentTabId, (tab) => {
      if (
        !tab ||
        !tab.url ||
        tab.url.startsWith("chrome://") ||
        tab.url.startsWith("chrome-extension://") ||
        tab.url.startsWith("https://chrome.google.com/webstore")
      ) {
        statusEl.textContent = "Cannot record on this tab.";
        return;
      }
      chrome.runtime.sendMessage({ type: "get_recording_state" }, (resp) => {
        const currentlyRecordingThisTab = resp && resp.isRecording && resp.recordingTabId === currentTabId;
        if (!currentlyRecordingThisTab) {
          chrome.scripting.executeScript(
            {
              target: { tabId: currentTabId },
              files: ["content-script.js"]
            },
            () => {
              chrome.runtime.sendMessage({ type: "start_recording", tabId: currentTabId }, () => {
                isRecording = true;
                refreshSteps();
                updateUI(true);
              });
            }
          );
        } else {
          chrome.runtime.sendMessage({ type: "stop_recording" }, () => {
            isRecording = false;
            // Don't clear actions; just update UI
            refreshSteps();
            updateUI(false);
          });
        }
      });
    });
  });

  downloadBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "download_json", tabId: currentTabId }, (resp) => {
      if (resp && resp.success) {
        statusEl.textContent = "rech.json download triggered.";
      } else {
        statusEl.textContent = "Failed to download rech.json.";
      }
    });
  });

  clearBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "clear_actions", tabId: currentTabId }, (resp) => {
      if (resp && resp.success) {
        refreshSteps();
        statusEl.textContent = "Recorded actions cleared.";
      } else {
        statusEl.textContent = "Failed to clear actions.";
      }
    });
  });

  // Listen for updates from background to live-refresh steps as you interact!
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "actions_updated" && msg.tabId === currentTabId) {
      renderSteps(msg.actions);
    }
  });
});