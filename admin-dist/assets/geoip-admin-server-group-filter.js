(function () {
  "use strict";

  var STORAGE_KEY = "geoip-admin-server-group-filter";
  var FILTER_ID = "geoip-admin-server-group-filter";
  var ALL_VALUE = "__all__";
  var state = {
    groups: null,
    serverStatus: null,
    serverStatusPromise: null,
    serverStatusRequestedAt: 0,
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

  function isOnline(server) {
    if (typeof server.online === "boolean") return server.online;
    if (!server.last_active) return false;
    var lastActive = new Date(server.last_active).getTime();
    if (!Number.isFinite(lastActive) || lastActive <= 0) return false;
    return Date.now() - lastActive < 35000;
  }

  function requestServerStatus(force) {
    var now = Date.now();
    if (!force && state.serverStatus && now - state.serverStatusRequestedAt < 15000) {
      return Promise.resolve(state.serverStatus);
    }
    if (state.serverStatusPromise) return state.serverStatusPromise;

    state.serverStatusRequestedAt = now;
    state.serverStatusPromise = fetch("/api/v1/server", {
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    })
      .then(function (response) {
        if (!response.ok) throw new Error("server status request failed");
        return response.json();
      })
      .then(function (payload) {
        var servers = Array.isArray(payload && payload.data) ? payload.data : [];
        var status = new Map();
        servers.forEach(function (server) {
          if (server && server.id) status.set(String(server.id), isOnline(server));
        });
        state.serverStatus = status;
        return status;
      })
      .catch(function () {
        state.serverStatus = state.serverStatus || new Map();
        return state.serverStatus;
      })
      .finally(function () {
        state.serverStatusPromise = null;
      });
    return state.serverStatusPromise;
  }

  function serverIdFromRow(row) {
    var cell = serverIdCellFromRow(row);
    return cell ? serverIdFromCell(cell) : "";
  }

  function serverIdFromCell(cell) {
    var text = (cell.textContent || "").trim();
    var match = text.match(/^(\d+)(?:\s*\(|\b)/);
    return match ? match[1] : "";
  }

  function serverIdCellFromRow(row) {
    var cells = Array.prototype.slice.call(row.querySelectorAll("td"));
    for (var i = 0; i < cells.length; i += 1) {
      if (serverIdFromCell(cells[i])) return cells[i];
    }
    return null;
  }

  function applyServerStatus() {
    if (!isServerPage() || !state.serverStatus) return;
    var rows = document.querySelectorAll("#root tbody tr");
    rows.forEach(function (row) {
      var cell = serverIdCellFromRow(row);
      if (!cell) return;
      var id = serverIdFromCell(cell);
      var online = state.serverStatus.get(id);
      var dot = cell.querySelector(":scope > .geoip-admin-server-status-dot");
      if (!dot) {
        dot = document.createElement("span");
        dot.className = "geoip-admin-server-status-dot";
        dot.setAttribute("aria-hidden", "true");
        cell.insertBefore(dot, cell.firstChild);
      }
      var label = online === true ? "在线" : online === false ? "离线" : "未知";
      dot.setAttribute("data-status", online === true ? "online" : online === false ? "offline" : "unknown");
      dot.title = label;
      cell.setAttribute("data-geoip-admin-server-status", label);
    });
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
      applyServerStatus();
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
      requestServerStatus(false).then(applyServerStatus);
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
    window.setInterval(function () {
      if (isServerPage()) requestServerStatus(true).then(applyServerStatus);
    }, 20000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
