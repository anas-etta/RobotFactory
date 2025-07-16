console.log("RobotFactory content script loaded!");

function getElementInfo(element) {
  let info = {
    id: element.id || "",
    name: element.name || "",
    className: element.className || "",
    tagName: element.tagName || "",
    cssSelector: getCssSelector(element),
    xpath: getElementXPath(element)
  };
  return info;
}

function getCssSelector(el) {
  if (!(el instanceof Element)) return "";
  let path = [];
  while (el.nodeType === Node.ELEMENT_NODE) {
    let selector = el.nodeName.toLowerCase();
    if (el.id) {
      selector += "#" + el.id;
      path.unshift(selector);
      break;
    } else {
      if (typeof el.className === "string" && el.className.trim().length > 0) {
        selector += "." + el.className.trim().replace(/\s+/g, ".");
      }
      let sibling = el, nth = 1;
      while ((sibling = sibling.previousElementSibling)) {
        if (sibling.nodeName.toLowerCase() === el.nodeName.toLowerCase()) nth++;
      }
      path.unshift(selector + (nth > 1 ? `:nth-of-type(${nth})` : ""));
      el = el.parentNode;
    }
  }
  return path.join(" > ");
}

function getElementXPath(element) {
  if (!element) return "";
  if (element.id) return `//*[@id="${element.id}"]`;

  // Try using unique attributes for input/button elements
  if (element.tagName === "INPUT" && element.getAttribute("placeholder")) {
    return `//input[@placeholder="${element.getAttribute("placeholder")}"]`;
  }
  if (
    (element.tagName === "BUTTON" || element.tagName === "A") &&
    element.textContent.trim() !== ""
  ) {
    return `//${element.tagName.toLowerCase()}[normalize-space(text())="${element.textContent.trim()}"]`;
  }

  // Fallback to index-based XPath
  const parts = [];
  while (element && element.nodeType === Node.ELEMENT_NODE) {
    let index = 1, sibling = element.previousSibling;
    while (sibling) {
      if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === element.nodeName) index++;
      sibling = sibling.previousSibling;
    }
    parts.unshift(element.nodeName.toLowerCase() + `[${index}]`);
    element = element.parentNode;
  }
  return "/" + parts.join("/");
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

document.addEventListener("click", function (e) {
  let target = e.target;
  sendAction({
    cmd: "click",
    selector: target.tagName.toLowerCase(),
    elementInfo: getElementInfo(target),
    url: window.location.href,
    timestamp: new Date().toISOString(),
  });
}, true);

document.addEventListener("input", function (e) {
  let target = e.target;
  sendAction({
    cmd: "input",
    selector: target.tagName.toLowerCase(),
    value: target.value,
    elementInfo: getElementInfo(target),
    url: window.location.href,
    timestamp: new Date().toISOString(),
  });
}, true);

window.addEventListener("hashchange", function () {
  sendAction({
    cmd: "navigate",
    selector: "body",
    elementInfo: getElementInfo(document.body),
    url: window.location.href,
    timestamp: new Date().toISOString(),
  });
});
window.addEventListener("popstate", function () {
  sendAction({
    cmd: "navigate",
    selector: "body",
    elementInfo: getElementInfo(document.body),
    url: window.location.href,
    timestamp: new Date().toISOString(),
  });
});

sendAction({
  cmd: "open",
  selector: "body",
  elementInfo: getElementInfo(document.body),
  url: window.location.href,
  timestamp: new Date().toISOString(),
});