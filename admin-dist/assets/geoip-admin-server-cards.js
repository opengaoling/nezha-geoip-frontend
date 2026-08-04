(function () {
  "use strict";

  var VIEW_ID = "geoip-admin-server-card-view";
  var REFRESH_MS = 20000;
  var SORT_KEY = "geoip-admin-server-sort-key";
  var SORT_DIRECTION_KEY = "geoip-admin-server-sort-direction";
  var SORT_OPTIONS = [
    ["default", "默认"],
    ["name", "名称"],
    ["uptime", "运行时间"],
    ["system", "系统"],
    ["cpu", "CPU"],
    ["mem", "内存"],
    ["disk", "磁盘"],
    ["up", "上行速率"],
    ["down", "下行速率"],
    ["up_total", "上行总量"],
    ["down_total", "下行总量"],
    ["mem_total", "内存容量"],
    ["cpu_cores", "CPU核心数"],
    ["disk_total", "存储容量"],
    ["region", "地区"],
    ["organization", "组织"]
  ];
  var state = {
    servers: [],
    request: null,
    sortKey: localStorage.getItem(SORT_KEY) || "default",
    sortDirection: localStorage.getItem(SORT_DIRECTION_KEY) === "asc" ? "asc" : "desc"
  };

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

  function uptime(value) {
    var seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds <= 0) return "-";
    var days = Math.floor(seconds / 86400);
    var hours = Math.floor(seconds % 86400 / 3600);
    if (days > 0) return days + " 天 " + hours + " 小时";
    return Math.floor(seconds / 3600) + " 小时";
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

  function cpuCores(server) {
    var cpu = server.host && server.host.cpu;
    if (Array.isArray(cpu)) return cpu.length;
    if (typeof cpu === "number" && Number.isFinite(cpu)) return cpu;
    return 0;
  }

  function cpuType(server) {
    var virtualization = String((server.host && server.host.virtualization) || "").trim();
    if (!virtualization || /^(none|physical|bare[ -]?metal|native)$/i.test(virtualization)) return "物理";
    return "虚拟 · " + virtualization;
  }

  function serverIps(server) {
    var ip = (server.geoip && server.geoip.ip) || {};
    return [ip.ipv4_addr, ip.ipv6_addr, server.ipv4_addr, server.ipv6_addr]
      .filter(function (item, index, values) { return item && values.indexOf(item) === index; });
  }

  function displayId(server) {
    var id = String(server.id == null ? "" : server.id);
    return server.display_index == null ? id : id + "(" + server.display_index + ")";
  }

  function sortValue(server, key) {
    var stateData = server.state || {};
    var host = server.host || {};
    var geoip = server.geoip || {};
    switch (key) {
      case "name": return String(server.name || "");
      case "uptime": return Number(stateData.uptime) || 0;
      case "system": return String(host.platform || "");
      case "cpu": return Number(stateData.cpu) || 0;
      case "mem": return Number(stateData.mem_used || stateData.mem) || 0;
      case "disk": return Number(stateData.disk_used || stateData.disk) || 0;
      case "up": return Number(stateData.net_out_speed) || 0;
      case "down": return Number(stateData.net_in_speed) || 0;
      case "up_total": return Number(stateData.net_out_transfer) || 0;
      case "down_total": return Number(stateData.net_in_transfer) || 0;
      case "mem_total": return Number(host.mem_total) || 0;
      case "cpu_cores": return cpuCores(server);
      case "disk_total": return Number(host.disk_total) || 0;
      case "region": return String(geoip.country_code || server.country_code || "");
      case "organization": return String(geoip.organization || server.organization || "");
      default: return 0;
    }
  }

  function compareValues(left, right) {
    if (typeof left === "string" || typeof right === "string") {
      return String(left).localeCompare(String(right), "zh-CN", { sensitivity: "base" });
    }
    return left === right ? 0 : left > right ? 1 : -1;
  }

  function sortedServers() {
    return state.servers.slice().sort(function (left, right) {
      if (state.sortKey !== "name") {
        var leftOnline = isOnline(left);
        var rightOnline = isOnline(right);
        if (leftOnline !== rightOnline) return leftOnline ? -1 : 1;
      }
      var result = state.sortKey === "default" ? 0 : compareValues(sortValue(left, state.sortKey), sortValue(right, state.sortKey));
      if (state.sortDirection === "asc") result = -result;
      return result || Number(left.id) - Number(right.id);
    });
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

  function renderInfo(label, content, className) {
    var info = document.createElement("div");
    info.className = "geoip-admin-server-card__info" + (className ? " " + className : "");
    var caption = document.createElement("span");
    caption.className = "geoip-admin-server-card__info-label";
    caption.textContent = label;
    var valueNode = document.createElement("strong");
    valueNode.className = "geoip-admin-server-card__info-value";
    valueNode.textContent = content || "-";
    valueNode.title = content || "-";
    info.appendChild(caption);
    info.appendChild(valueNode);
    return info;
  }

  function serverIdFromCell(cell) {
    var match = (cell.textContent || "").trim().match(/^(\d+)(?:\s*\(|\b)/);
    return match ? match[1] : "";
  }

  function originalRow(serverId) {
    var rows = document.querySelectorAll("#root tbody tr");
    for (var index = 0; index < rows.length; index += 1) {
      var cells = rows[index].querySelectorAll("td");
      for (var cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
        if (serverIdFromCell(cells[cellIndex]) === String(serverId)) return rows[index];
      }
    }
    return null;
  }

  function originalCellText(serverId, index) {
    var row = originalRow(serverId);
    var cells = row ? row.querySelectorAll("td") : [];
    return cells[index] ? (cells[index].textContent || "").trim() : "";
  }

  function clickOriginalAction(serverId, position) {
    var row = originalRow(serverId);
    if (!row) return;
    var actionCell = row.querySelector("td:last-child");
    var buttons = actionCell ? actionCell.querySelectorAll("button") : [];
    if (!buttons.length) return;
    var button = position === "delete" ? buttons[buttons.length - 1] : buttons[position];
    if (button && typeof button.click === "function") button.click();
  }

  function originalSelection(serverId) {
    var row = originalRow(serverId);
    return row ? row.querySelector('input[type="checkbox"]') : null;
  }

  function renderSelection(serverId) {
    var label = document.createElement("label");
    label.className = "geoip-admin-server-card__selection";
    label.title = "选择服务器";
    var input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("aria-label", "选择服务器");
    var original = originalSelection(serverId);
    input.checked = !!(original && original.checked);
    input.addEventListener("click", function (event) {
      event.stopPropagation();
      var source = originalSelection(serverId);
      if (source && source.checked !== input.checked) source.click();
    });
    label.appendChild(input);
    return label;
  }

  function renderActionButton(label, serverId, position, danger) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "geoip-admin-server-card__action" + (danger ? " geoip-admin-server-card__action--danger" : "");
    button.textContent = label;
    button.title = label;
    button.addEventListener("click", function () { clickOriginalAction(serverId, position); });
    return button;
  }

  function renderCard(server) {
    var online = isOnline(server);
    var host = server.host || {};
    var geoip = server.geoip || {};
    var ips = serverIps(server);
    var platform = [host.platform, host.platform_version, host.arch].filter(Boolean).join(" ");
    var groupLabel = Array.isArray(server.groups)
      ? server.groups.map(function (group) { return typeof group === "string" ? group : group && group.name; }).filter(Boolean).join(", ")
      : originalCellText(server.id, 2);
    var ownerLabel = server.owner && (server.owner.username || server.owner.name)
      ? (server.owner.username || server.owner.name)
      : originalCellText(server.id, 3);
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
    title.insertBefore(renderSelection(server.id), title.firstChild);
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
      ["ID", displayId(server)],
      ["系统", platform || "未知"],
      ["地区", geoip.country_code || server.country_code || "未知"],
      ["组织", geoip.organization || server.organization || "未知"],
      ["分组", groupLabel || "未分组"],
      ["所属用户", ownerLabel || "-"],
      ["版本", host.version || "未知"]
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
    metrics.appendChild(renderMetric("运行时间", uptime((server.state || {}).uptime)));
    metrics.appendChild(renderMetric("上行", bytes(value(server, "up")) + "/s"));
    metrics.appendChild(renderMetric("下行", bytes(value(server, "down")) + "/s"));
    metrics.appendChild(renderMetric("上行总量", bytes((server.state || {}).net_out_transfer)));
    metrics.appendChild(renderMetric("下行总量", bytes((server.state || {}).net_in_transfer)));
    metrics.appendChild(renderMetric("CPU核心", cpuCores(server) ? cpuCores(server) + " 核" : "-"));
    metrics.appendChild(renderMetric("CPU类型", cpuType(server)));

    var info = document.createElement("div");
    info.className = "geoip-admin-server-card__info-grid";
    info.appendChild(renderInfo("IP", ips.length ? ips.join(" / ") : "-", "geoip-admin-server-card__info--ip"));
    info.appendChild(renderInfo("UUID", server.uuid || "-"));
    info.appendChild(renderInfo("备注", server.note || server.public_note || "-"));
    info.appendChild(renderInfo("DDNS", server.enable_ddns ? "已启用" : "未启用"));
    info.appendChild(renderInfo("访客可见", server.hide_for_guest ? "否" : "是"));

    var actions = document.createElement("div");
    actions.className = "geoip-admin-server-card__actions";
    actions.appendChild(renderActionButton("编辑", server.id, 0, false));
    actions.appendChild(renderActionButton("终端", server.id, 1, false));
    actions.appendChild(renderActionButton("更多", server.id, 2, false));
    actions.appendChild(renderActionButton("删除", server.id, "delete", true));

    card.appendChild(header);
    card.appendChild(meta);
    card.appendChild(metrics);
    card.appendChild(info);
    card.appendChild(actions);
    return card;
  }

  function makeSortControls() {
    var controls = document.createElement("div");
    controls.className = "geoip-admin-server-card-view__sort";
    var direction = document.createElement("button");
    direction.type = "button";
    direction.className = "geoip-admin-server-card-view__sort-direction";
    direction.setAttribute("aria-label", "切换排序方向");
    var select = document.createElement("select");
    select.setAttribute("aria-label", "服务器排序");
    SORT_OPTIONS.forEach(function (option) { select.add(new Option(option[1], option[0])); });
    select.value = state.sortKey;
    select.addEventListener("change", function () {
      state.sortKey = select.value;
      localStorage.setItem(SORT_KEY, state.sortKey);
      render();
    });
    direction.addEventListener("click", function () {
      state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
      localStorage.setItem(SORT_DIRECTION_KEY, state.sortDirection);
      render();
    });
    controls.appendChild(direction);
    controls.appendChild(select);
    updateSortDirection(direction);
    return controls;
  }

  function updateSortDirection(button) {
    button.textContent = state.sortDirection === "asc" ? "升序" : "降序";
  }

  function findTableContainer() {
    var table = document.querySelector("#root main table, #root table");
    if (!table) return null;
    return table.parentElement;
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
    title.textContent = "服务器列表";
    var count = document.createElement("span");
    count.className = "geoip-admin-server-card-view__count";
    heading.appendChild(title);
    heading.appendChild(count);
    heading.appendChild(makeSortControls());
    var grid = document.createElement("div");
    grid.className = "geoip-admin-server-card-view__grid";
    view.appendChild(heading);
    view.appendChild(grid);
    tableContainer.parentElement.insertBefore(view, tableContainer);
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
    var sorted = sortedServers();
    grid.replaceChildren.apply(grid, sorted.map(renderCard));
    count.textContent = sorted.length + " 台服务器";
    document.querySelectorAll("[data-geoip-admin-original-table]").forEach(function (node) {
      node.style.setProperty("display", "none", "important");
    });
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
    new MutationObserver(function (records) {
      var view = document.getElementById(VIEW_ID);
      if (view && records.every(function (record) { return view.contains(record.target); })) return;
      schedule();
    }).observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("popstate", schedule);
    schedule();
    window.setInterval(requestServers, REFRESH_MS);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
