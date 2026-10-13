/* Boxbox 0.6 page script. Loaded in <head> by every page, the board and the pit wall.
   Every page reads fine without it. What it adds:
   - the dark/light switch: Auto follows the system; a choice is kept under "boxbox-theme" when storage allows
   - the contents list and reading time, built from the page's sections
   - the "Pit wall" crumb, shown only when the page is opened from the pit wall
   - manual checklist ticks, kept in this browser when storage allows */
(function () {
  "use strict";
  var root = document.documentElement;
  var KEY = "boxbox-theme";
  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { if (v == null) window.localStorage.removeItem(k); else window.localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  };

  /* ---------- theme: runs before first paint ---------- */
  function urlTheme() { var m = /[?&]theme=(light|dark)\b/.exec(location.search); return m ? m[1] : null; }
  var saved = store.get(KEY) || urlTheme();
  if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);

  function current() { return root.getAttribute("data-theme") || "auto"; }
  function sync() {
    var t = current();
    document.querySelectorAll("[data-theme-set]").forEach(function (b) { b.setAttribute("aria-checked", String(b.getAttribute("data-theme-set") === t)); });
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-theme-set]");
    if (!b) return;
    var t = b.getAttribute("data-theme-set");
    if (t === "auto") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", t);
    store.set(KEY, t === "auto" ? null : t);
    sync();
    document.dispatchEvent(new CustomEvent("boxbox-theme", { detail: t }));
  });
  window.BoxboxTheme = { current: current };

  function ready() {
    sync();

    /* ---------- crumbs: the pit wall link works only when served by the pit wall ---------- */
    var fromPitwall = /^https?:$/.test(location.protocol) && location.pathname.indexOf("/b/") === 0;
    document.querySelectorAll("a.pitlink").forEach(function (a) { if (fromPitwall) a.href = "/"; else a.hidden = true; });

    /* ---------- contents and reading time ---------- */
    var article = document.querySelector(".article");
    var toc = document.querySelector("nav.toc");
    if (article && toc) {
      var list = toc.querySelector("ol") || toc.appendChild(document.createElement("ol"));
      var heads = [];
      article.querySelectorAll("section[data-section]").forEach(function (s) {
        var h = s.querySelector(":scope > h2");
        if (!h || s.closest(".pagefoot")) return;
        if (!s.id) s.id = s.getAttribute("data-section");
        heads.push({ s: s, h: h });
      });
      if (!list.children.length) heads.forEach(function (x) {
        var li = document.createElement("li"), a = document.createElement("a");
        a.href = "#" + x.s.id;
        a.textContent = x.h.getAttribute("data-short") || x.h.textContent;
        li.appendChild(a); list.appendChild(li);
      });
      var rt = toc.querySelector(".readtime");
      if (rt && !rt.textContent.trim()) {
        var prose = 0, code = 0;
        article.querySelectorAll("p, li, dd, td, figcaption, h2, h3").forEach(function (n) { if (!n.closest("pre")) prose += (n.textContent.match(/\S+/g) || []).length; });
        article.querySelectorAll("pre").forEach(function (n) { code += n.textContent.split("\n").length; });
        rt.textContent = Math.max(1, Math.round(prose / 220 + code / 40)) + " min read";
      }
      if ("IntersectionObserver" in window && heads.length) {
        var links = {};
        list.querySelectorAll("a").forEach(function (a) { links[a.getAttribute("href").slice(1)] = a; });
        var visible = {};
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting; });
          var first = heads.filter(function (x) { return visible[x.s.id]; })[0];
          if (!first) return;
          Object.keys(links).forEach(function (id) { links[id].setAttribute("aria-current", String(id === first.s.id)); });
          var a = links[first.s.id];
          if (a && toc.scrollWidth > toc.clientWidth) a.scrollIntoView({ block: "nearest", inline: "nearest" });
        }, { rootMargin: "-80px 0px -55% 0px" });
        heads.forEach(function (x) { io.observe(x.s); });
      }
    }

    /* ---------- checklist ticks ---------- */
    var pageKey = "boxbox:" + location.pathname + ":check:";
    document.querySelectorAll(".checklist input[type=checkbox]").forEach(function (box, i) {
      var k = pageKey + (box.id || i);
      box.checked = store.get(k) === "1";
      box.addEventListener("change", function () { store.set(k, box.checked ? "1" : "0"); });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready); else ready();
})();
