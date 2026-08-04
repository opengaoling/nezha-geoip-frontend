(function () {
  if (window.__geoipAdminThemeInstalled) return;
  window.__geoipAdminThemeInstalled = true;

  var version = "admin-theme-20260804a";
  var scripts = [
    "/dashboard/assets/geoip-auth-guard.js",
    "/dashboard/assets/geoip-session-timeout-setting-20260616.js",
    "/dashboard/assets/geoip-scroll-tools-20260613.js"
  ];

  function versioned(src) {
    return src + "?v=" + version;
  }

  function appendScript(src) {
    var script = document.createElement("script");
    script.src = versioned(src);
    script.async = false;
    document.head.appendChild(script);
  }

  function removeRetiredFrontendLink() {
    document.querySelectorAll('#root a[href="/"]').forEach(function (link) {
      link.remove();
    });
  }

  if (document.readyState === "loading") {
    document.write(scripts.map(function (src) {
      return '<script src="' + versioned(src) + '"><\/script>';
    }).join(""));
  } else {
    scripts.forEach(appendScript);
  }

  var observer = new MutationObserver(removeRetiredFrontendLink);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setTimeout(removeRetiredFrontendLink, 0);
  window.setTimeout(removeRetiredFrontendLink, 500);
})();
