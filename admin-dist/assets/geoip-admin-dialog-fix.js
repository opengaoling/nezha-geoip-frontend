(function () {
  var ATTR = "data-geoip-server-group-dialog";
  var FORM_ATTR = "data-geoip-server-group-form";
  var BODY_CLASS = "geoip-server-group-dialog-open";
  var TITLE_MARKERS = [
    "编辑服务器分组",
    "创建服务器分组",
    "EditServerGroup",
    "CreateServerGroup",
    "Edit Server Group",
    "Create Server Group"
  ];

  function hasServerGroupTitle(dialog) {
    var text = dialog.textContent || "";
    return TITLE_MARKERS.some(function (marker) {
      return text.indexOf(marker) !== -1;
    });
  }

  function hasServerSelector(form) {
    var labels = form.querySelectorAll("label");
    for (var i = 0; i < labels.length; i += 1) {
      var text = (labels[i].textContent || "").trim();
      if (text === "服务器" || text === "服务器(ID)" || text === "Server") {
        return true;
      }
    }
    return false;
  }

  function markDialogs() {
    var active = false;
    var dialogs = document.querySelectorAll('#root [role="dialog"]');

    dialogs.forEach(function (dialog) {
      var form = dialog.querySelector("form");
      var matched = !!form && hasServerGroupTitle(dialog) && hasServerSelector(form);

      if (matched) {
        active = true;
        dialog.setAttribute(ATTR, "true");
        form.setAttribute(FORM_ATTR, "true");
      } else {
        dialog.removeAttribute(ATTR);
        if (form) {
          form.removeAttribute(FORM_ATTR);
        }
      }
    });

    document.body.classList.toggle(BODY_CLASS, active);
  }

  function scheduleMarkDialogs() {
    window.requestAnimationFrame(markDialogs);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", markDialogs, { once: true });
  } else {
    markDialogs();
  }

  document.addEventListener("click", scheduleMarkDialogs, true);
  document.addEventListener("keyup", scheduleMarkDialogs, true);
  new MutationObserver(scheduleMarkDialogs).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
