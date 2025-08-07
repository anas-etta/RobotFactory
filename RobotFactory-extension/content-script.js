console.log("RobotFactory content script loaded!");

// Prevent multiple registrations of event listeners
if (!window.__rf_click_listener_added) {
  window.__rf_click_listener_added = true;

  function getElementInfo(element) {
    // Prefer unique id, else absolute XPath
    let info = {};
    if (
      element.id &&
      document.querySelectorAll(`#${CSS.escape(element.id)}`).length === 1
    ) {
      info.id = element.id;
    } else {
      info.absXPath = getAbsoluteXPath(element);
    }
    return info;
  }

  function getAbsoluteXPath(element) {
    if (!element) return "";
    const paths = [];
    for (
      ;
      element && element.nodeType === Node.ELEMENT_NODE;
      element = element.parentNode
    ) {
      let index = 1;
      let sibling = element.previousSibling;
      while (sibling) {
        if (
          sibling.nodeType === Node.ELEMENT_NODE &&
          sibling.nodeName === element.nodeName
        )
          index++;
        sibling = sibling.previousSibling;
      }
      paths.unshift(element.nodeName.toLowerCase() + `[${index}]`);
    }
    return "/" + paths.join("/");
  }

  // Robust sendAction that ignores extension context errors
  function sendAction(action) {
    if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        chrome.runtime.sendMessage({ type: "recorded_action", action }, () => {});
      } catch (err) {
        if (!err || err.message !== "Extension context invalidated.") {
          console.warn("Extension context invalidated or sendMessage failed.", err, action);
        }
      }
    }
  }

  // Click events
  document.addEventListener(
    "click",
    function (e) {
      let target = e.target;
      sendAction({
        cmd: "click",
        elementInfo: getElementInfo(target),
        url: window.location.href,
        timestamp: new Date().toISOString()
      });
    },
    true
  );

  // Only record input on blur (not on input or debounce)
  document.addEventListener(
    "blur",
    function (e) {
      let target = e.target;
      if (
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.getAttribute("contenteditable") === "true")
      ) {
        sendAction({
          cmd: "input",
          value: target.value,
          elementInfo: getElementInfo(target),
          url: window.location.href,
          timestamp: new Date().toISOString()
        });
      }
    },
    true
  );

  // Navigation events
  window.addEventListener("hashchange", function () {
    sendAction({
      cmd: "navigate",
      elementInfo: getElementInfo(document.body),
      url: window.location.href,
      timestamp: new Date().toISOString()
    });
  });

  window.addEventListener("popstate", function () {
    sendAction({
      cmd: "navigate",
      elementInfo: getElementInfo(document.body),
      url: window.location.href,
      timestamp: new Date().toISOString()
    });
  });
}

// Do NOT send an "open" action here! The "open" command is only added at export.