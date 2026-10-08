/* Boxbox page script. Optional helpers; every page reads fine without it.
   - builds the section nav from <h2 id> when the page has <nav class="toc" data-auto>
   - remembers "mark as done" boxes in this browser
   - shows a reading progress bar when the page has <div id="readbar"> */
(function () {
  "use strict";

  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  };
  var pageKey = "boxbox:" + location.pathname + ":";

  // section nav
  var toc = document.querySelector("nav.toc[data-auto]");
  if (toc) {
    document.querySelectorAll("h2[id]").forEach(function (h) {
      var a = document.createElement("a");
      a.href = "#" + h.id;
      a.textContent = h.getAttribute("data-short") || h.textContent;
      toc.appendChild(a);
    });
  }

  // mark as done
  document.querySelectorAll(".donebox input[type=checkbox]").forEach(function (box, i) {
    var key = pageKey + "done:" + (box.id || i);
    box.checked = store.get(key) === "1";
    box.addEventListener("change", function () { store.set(key, box.checked ? "1" : "0"); });
  });

  // reading progress
  var bar = document.getElementById("readbar");
  if (bar) {
    var update = function () {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0) + "%";
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
  }
})();
