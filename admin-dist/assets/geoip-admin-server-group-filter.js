(function () {
  "use strict";

  var STORAGE_KEY = "geoip-admin-server-group-filter";
  var FILTER_ID = "geoip-admin-server-group-filter";
  var ALL_VALUE = "__all__";
  var state = {
    groups: null,
    selected: sessionStorage.getItem(STORAGE_KEY) || ALL_VALUE,
    observer: null,
    applying: false
  };

  function isServerPage() {
    var path = window.location.pathname.replace(/\/+$/, "");
    return path === "/dashboard";
  }

  function requestGroups() {
    if (state.groups) return Promise.resolve(state.groups);
    return fetch("/api/v1/server-group", {
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    })
      .then(function (response) {
        if (!response.ok) throw new Error("server group request failed");
        return response.json();
      })
      .then(function (payload) {
        var groups = Array.isArray(payload && payload.data) ? payload.data : [];
        state.groups = groups
          .map(function (item) {
            var group = item.group || {};
            return {
              id: String(group.id || group.name || ""),
              name: group.name || "",
              servers: new Set((item.servers || []).map(function (id) { return String(id); }))
            };
          })
          .filter(function (group) { return group.id && group.name; });
        if (state.selected !== ALL_VALUE && !state.groups.some(function (group) { return group.id === state.selected; })) {
          state.selected = ALL_VALUE;
          sessionStorage.setItem(STORAGE_KEY, state.selected);
        }
        return state.groups;
      })
      .catch(function () {
        state.groups = [];
        return state.groups;
      });
  }

  function serverIdFromRow(row) {
    var cells = Array.prototype.slice.call(row.querySelectorAll("td"));
    for (var i = 0; i < cells.length; i += 1) {
      var text = (cells[i].textContent || "").trim();
      var match = text.match(/^(\d+)(?:\s*\(|\b)/);
      if (match) return match[1];
    }
    return "";
  }

  function selectedGroup() {
    if (state.selected === ALL_VALUE) return null;
    return (state.groups || []).find(function (group) { return group.id === state.selected; }) || null;
  }

  function applyFilter() {
    if (!isServerPage() || state.applying) return;
    state.applying = true;
    try {
      var group = selectedGroup();
      var rows = document.querySelectorAll("#root tbody tr");
      rows.forEach(function (row) {
        var id = serverIdFromRow(row);
        var shouldHide = !!(id && group && !group.servers.has(id));
        var isHidden = row.getAttribute("data-geoip-group-filter-hidden") === "true";
        if (shouldHide && !isHidden) row.setAttribute("data-geoip-group-filter-hidden", "true");
        if (!shouldHide && isHidden) row.removeAttribute("data-geoip-group-filter-hidden");
      });
      updateButtons();
    } finally {
      state.applying = false;
    }
  }

  function updateButtons() {
    var root = document.getElementById(FILTER_ID);
    if (!root) return;
    root.querySelectorAll("button[data-group-id]").forEach(function (button) {
      button.setAttribute("aria-pressed", button.getAttribute("data-group-id") === state.selected ? "true" : "false");
    });
  }

  function makeButton(group) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "geoip-admin-server-group-filter__button";
    button.setAttribute("data-group-id", group.id);
    button.setAttribute("aria-pressed", group.id === state.selected ? "true" : "false");
    button.title = group.name;
    button.textContent = group.name;
    button.addEventListener("click", function () {
      state.selected = group.id;
      sessionStorage.setItem(STORAGE_KEY, state.selected);
      applyFilter();
    });
    return button;
  }

  function mountFilter() {
    if (!isServerPage()) {
      var existing = document.getElementById(FILTER_ID);
      if (existing) existing.remove();
      return;
    }

    requestGroups().then(function (groups) {
      if (!isServerPage() || document.getElementById(FILTER_ID)) {
        applyFilter();
        return;
      }

      var page = document.querySelector("#root h1");
      if (!page || !/Server|服务器/.test(page.textContent || "")) return;
      var toolbar = page.closest("div");
      if (!toolbar || !toolbar.parentElement) return;

      var wrapper = document.createElement("section");
      wrapper.id = FILTER_ID;
      wrapper.className = "geoip-admin-server-group-filter";

      var label = document.createElement("span");
      label.className = "geoip-admin-server-group-filter__label";
      label.textContent = "服务器分组";

      var list = document.createElement("div");
      list.className = "geoip-admin-server-group-filter__list";
      list.appendChild(makeButton({ id: ALL_VALUE, name: "全部服务器", servers: new Set() }));
      groups.forEach(function (group) { list.appendChild(makeButton(group)); });

      wrapper.appendChild(label);
      wrapper.appendChild(list);
      toolbar.parentElement.insertBefore(wrapper, toolbar.nextSibling);
      applyFilter();
    });
  }

  function scheduleMount() {
    window.clearTimeout(scheduleMount.timer);
    scheduleMount.timer = window.setTimeout(function () {
      mountFilter();
      applyFilter();
    }, 80);
  }

  function patchHistory(name) {
    var original = history[name];
    history[name] = function () {
      var result = original.apply(this, arguments);
      scheduleMount();
      return result;
    };
  }

  function boot() {
    patchHistory("pushState");
    patchHistory("replaceState");
    window.addEventListener("popstate", scheduleMount);
    state.observer = new MutationObserver(scheduleMount);
    state.observer.observe(document.documentElement, { childList: true, subtree: true });
    scheduleMount();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
