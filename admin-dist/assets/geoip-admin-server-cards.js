(function () {
  "use strict";

  var VIEW_ID = "geoip-admin-server-card-view";
  var DATA_EVENT = "geoip-admin-server-data";
  var REFRESH_MS = 20000;
  var state = { servers: [], request: null };

  function isServerPage() {
    return window.location.pathname.replace(/\/+$/, "") === "/dashboard";
  }

  function isOnline(server) {
    if (typeof server.online === "boolean") return server.online;
    var lastActive = server.last_active ? new Date(server.last_active).getTime() : 0;
    return Number.isFinite(lastActive) && lastActive > 0 && Date.now() - lastActive < 35000;
  }

  function bytes(value) {
    var amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return "-";
    var units = ["B", "KB", "MB", "GB", "TB"];
    var index = 0;
    while (amount >= 1024 && index < units.length - 1) {
      amount /= 1024;
      index += 1;
    }
    return (amount >= 10 || index === 0 ? amount.toFixed(0) : amount.toFixed(1)) + " " + units[index];
  }

  function percent(value) {
    var amount = Number(value);
    return Number.isFinite(amount) ? Math.max(0, Math.min(100, amount)).toFixed(1) + "%" : "-";
  }

  function value(server, key) {
    var stateData = server.state || {};
    var host = server.host || {};
    if (key === "cpu") return stateData.cpu;
    if (key === "memory") return stateData.mem_used || stateData.mem;
    if (key === "memoryTotal") return host.mem_total;
    if (key === "disk") return stateData.disk_used || stateData.disk;
    if (key === "diskTotal") return host.disk_total;
    if (key === "up") return stateData.net_out_speed;
    if (key === "down") return stateData.net_in_speed;
    return "";
  }

  function renderMetric(label, content) {
    var metric = document.createElement("div");
    metric.className = "geoip-admin-server-card__metric";
    var caption = document.createElement("span");
    caption.className = "geoip-admin-server-card__metric-label";
    caption.textContent = label;
    var valueNode = document.createElement("strong");
    valueNode.textContent = content;
    metric.appendChild(caption);
    metric.appendChild(valueNode);
    return metric;
  }

  function renderCard(server) {
    var online = isOnline(server);
    var host = server.host || {};
    var geoip = server.geoip || {};
    var card = document.createElement("article");
    card.className = "geoip-admin-server-card";
    card.setAttribute("data-geoip-admin-server-card", "true");
    card.setAttribute("data-server-id", String(server.id));
    card.setAttribute("data-status", online ? "online" : "offline");

    var header = document.createElement("header");
    header.className = "geoip-admin-server-card__header";
    var title = document.createElement("div");
    title.className = "geoip-admin-server-card__title";
    var dot = document.createElement("span");
    dot.className = "geoip-admin-server-card__dot";
    dot.setAttribute("data-status", online ? "online" : "offline");
    var name = document.createElement("strong");
    name.textContent = server.name || "未命名服务器";
    title.appendChild(dot);
    title.appendChild(name);
    var status = document.createElement("span");
    status.className = "geoip-admin-server-card__status";
    status.textContent = online ? "在线" : "离线";
    header.appendChild(title);
    header.appendChild(status);

    var meta = document.createElement("div");
    meta.className = "geoip-admin-server-card__meta";
    [
      ["系统", host.platform || "未知"],
      ["地区", geoip.country_code || "未知"],
      ["组织", geoip.organization || "未知"]
    ].forEach(function (item) {
      var tag = document.createElement("span");
      tag.textContent = item[0] + " · " + item[1];
      tag.title = item[1];
      meta.appendChild(tag);
    });

    var metrics = document.createElement("div");
    metrics.className = "geoip-admin-server-card__metrics";
    metrics.appendChild(renderMetric("CPU", percent(value(server, "cpu"))));
    metrics.appendChild(renderMetric("内存", value(server, "memoryTotal") ? bytes(value(server, "memory")) + " / " + bytes(value(server, "memoryTotal")) : "-"));
    metrics.appendChild(renderMetric("存储", value(server, "diskTotal") ? bytes(value(server, "disk")) + " / " + bytes(value(server, "diskTotal")) : "-"));
    metrics.appendChild(renderMetric("上行", bytes(value(server, "up")) + "/s"));
    metrics.appendChild(renderMetric("下行", bytes(value(server, "down")) + "/s"));

    card.appendChild(header);
    card.appendChild(meta);
    card.appendChild(metrics);
    return card;
  }

  function findTableContainer() {
    var table = document.querySelector("#root main table, #root table");
    if (!table) return null;
    return table.parentElement && table.parentElement.parentElement
      ? table.parentElement.parentElement
      : table.parentElement;
  }

  function mountView() {
    if (!isServerPage()) return null;
    var existing = document.getElementById(VIEW_ID);
    if (existing) return existing;
    var tableContainer = findTableContainer();
    if (!tableContainer || !tableContainer.parentElement) return null;
    tableContainer.setAttribute("data-geoip-admin-original-table", "true");
    var view = document.createElement("section");
    view.id = VIEW_ID;
    view.className = "geoip-admin-server-card-view";
    var heading = document.createElement("div");
    heading.className = "geoip-admin-server-card-view__heading";
    var title = document.createElement("h2");
    title.textContent = "服务器";
    var count = document.createElement("span");
    count.className = "geoip-admin-server-card-view__count";
    heading.appendChild(title);
    heading.appendChild(count);
    var grid = document.createElement("div");
    grid.className = "geoip-admin-server-card-view__grid";
    view.appendChild(heading);
    view.appendChild(grid);
    tableContainer.parentElement.appendChild(view);
    return view;
  }

  function render() {
    if (!isServerPage()) {
      var old = document.getElementById(VIEW_ID);
      if (old) old.remove();
      return;
    }
    var view = mountView();
    if (!view) return;
    var grid = view.querySelector(".geoip-admin-server-card-view__grid");
    var count = view.querySelector(".geoip-admin-server-card-view__count");
    grid.replaceChildren.apply(grid, state.servers.map(renderCard));
    count.textContent = state.servers.length + " 台服务器";
    document.dispatchEvent(new CustomEvent(DATA_EVENT, { detail: state.servers }));
  }

  function requestServers() {
    if (!isServerPage() || state.request) return state.request;
    state.request = fetch("/api/v1/server", { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(function (response) {
        if (!response.ok) throw new Error("server request failed");
        return response.json();
      })
      .then(function (payload) {
        state.servers = Array.isArray(payload && payload.data) ? payload.data : [];
        render();
      })
      .catch(function () {})
      .finally(function () { state.request = null; });
    return state.request;
  }

  function schedule() {
    window.clearTimeout(schedule.timer);
    schedule.timer = window.setTimeout(function () {
      render();
      requestServers();
    }, 80);
  }

  function boot() {
    new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("popstate", schedule);
    schedule();
    window.setInterval(requestServers, REFRESH_MS);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
