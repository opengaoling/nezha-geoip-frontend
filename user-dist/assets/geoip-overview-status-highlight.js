(function () {
  if (window.__geoipOverviewStatusHighlightInstalled) return;
  window.__geoipOverviewStatusHighlightInstalled = true;

  var selectedClass = "geoip-overview-status-selected";
  var styleId = "geoip-overview-status-highlight-style";
  var currentStatus = "online";
  var defaultApplied = false;
  var syncing = false;

  function ensureStyle() {
    if (document.getElementById(styleId)) return;
    var style = document.createElement("style");
    style.id = styleId;
    style.textContent = [
      ".server-overview > ." + selectedClass + " {",
      "  border-color: rgb(34 197 94) !important;",
      "  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.95), 0 0 0 5px rgba(34, 197, 94, 0.14) !important;",
      "}",
      ".dark .server-overview > ." + selectedClass + " {",
      "  border-color: rgb(22 163 74) !important;",
      "  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.95), 0 0 0 5px rgba(34, 197, 94, 0.2) !important;",
      "}",
      ".server-overview > ." + selectedClass + ":focus-visible {",
      "  outline: 2px solid rgba(34, 197, 94, 0.95);",
      "  outline-offset: 2px;",
      "}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function overviewCards() {
    var overview = document.querySelector("#root .server-overview");
    if (!overview) return [];
    return Array.prototype.slice.call(overview.children, 0, 3);
  }

  function statusIndex(status) {
    if (status === "online") return 1;
    if (status === "offline") return 2;
    return 0;
  }

  function detectReactStatus(cards) {
    if (cards[1] && cards[1].classList.contains("ring-2")) return "online";
    if (cards[2] && cards[2].classList.contains("ring-2")) return "offline";
    return null;
  }

  function applySelected(status) {
    ensureStyle();
    var cards = overviewCards();
    if (cards.length < 3) return;

    currentStatus = status || detectReactStatus(cards) || currentStatus;
    var activeIndex = statusIndex(currentStatus);
    cards.forEach(function (card, index) {
      card.classList.toggle(selectedClass, index === activeIndex);
      card.setAttribute("aria-pressed", index === activeIndex ? "true" : "false");
    });
  }

  function syncFromDom() {
    if (syncing) return;
    syncing = true;
    window.requestAnimationFrame(function () {
      syncing = false;
      var cards = overviewCards();
      if (cards.length < 3) return;
      var detected = detectReactStatus(cards);
      applySelected(detected || currentStatus);
    });
  }

  function bindClicks() {
    var cards = overviewCards();
    if (cards.length < 3) return false;
    ["all", "online", "offline"].forEach(function (status, index) {
      if (cards[index].__geoipOverviewStatusBound) return;
      cards[index].__geoipOverviewStatusBound = true;
      cards[index].addEventListener("click", function () {
        applySelected(status);
        window.setTimeout(syncFromDom, 0);
      });
    });
    if (!defaultApplied) {
      defaultApplied = true;
      window.setTimeout(function () {
        var nextCards = overviewCards();
        if (nextCards[1]) {
          nextCards[1].click();
        } else {
          applySelected("online");
        }
      }, 0);
      return true;
    }
    applySelected(currentStatus);
    return true;
  }

  function start() {
    ensureStyle();
    bindClicks();
    var root = document.getElementById("root");
    if (!root) return;
    var observer = new MutationObserver(function () {
      bindClicks();
      syncFromDom();
    });
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
