/* Fieldline mockup behaviors: screen router, faces, segmented controls, chips, tabs,
   sheets, toasts, count-ups, status demos, design notes. Mockup only; the product's
   real behavior lives in React. */
(function () {
  "use strict";
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var screens = $$(".screen");
  var order = screens.map(function (s) { return s.id.replace(/^s-/, ""); });
  var select = $("#rb-select");
  var counter = $("#rb-counter");
  var faceLabel = $("#rb-face");
  var notesBtn = $("#rb-notes");
  var notesPanel = $("#notes");
  var toastHost = $("#toasts");
  var current = null;
  var parentOf = { "work-order": "work-orders", "site-equipment": "customers", "new-customer": "customers", "quote-editor": "quoting", "new-wo": "dispatch" };
  var topTitle = $("#top-title");
  var side = $("#side");

  function groupLabel(g) {
    return { office: "Office", tech: "Tech phone", customer: "Customer", review: "Review" }[g] || g;
  }

  function buildSelect() {
    if (!select) return;
    var groups = {};
    screens.forEach(function (s) {
      var g = s.getAttribute("data-group") || "office";
      (groups[g] = groups[g] || []).push(s);
    });
    ["review", "office", "tech", "customer"].forEach(function (g) {
      if (!groups[g]) return;
      var og = document.createElement("optgroup");
      og.label = groupLabel(g);
      groups[g].forEach(function (s) {
        var o = document.createElement("option");
        o.value = s.id.replace(/^s-/, "");
        o.textContent = s.getAttribute("data-title") || o.value;
        og.appendChild(o);
      });
      select.appendChild(og);
    });
  }

  function showScreen(id, push) {
    var target = $("#s-" + id) || screens[0];
    if (!target) return;
    id = target.id.replace(/^s-/, "");
    if (id === current && target.classList.contains("on")) return;
    var face = target.getAttribute("data-face") || "office";
    $$(".face").forEach(function (f) { f.classList.toggle("on", f.getAttribute("data-face") === face); });
    screens.forEach(function (s) { s.classList.remove("on"); });
    void target.offsetWidth;
    target.classList.add("on");
    var navId = parentOf[id] || id;
    $$(".tab[data-go], .side-item[data-go]").forEach(function (t) { t.classList.toggle("on", t.getAttribute("data-go") === navId); });
    if (topTitle && face === "office") topTitle.textContent = target.getAttribute("data-title") || "";
    if (side) side.classList.remove("open");
    if (select) select.value = id;
    if (counter) counter.textContent = (order.indexOf(id) + 1) + " / " + order.length;
    if (faceLabel) faceLabel.textContent = groupLabel(target.getAttribute("data-group") || face);
    renderNotes(target);
    $$("[data-countup]", target).forEach(countUp);
    if (push !== false && location.hash !== "#" + id) {
      try { history.replaceState(null, "", "#" + id); } catch (e) { /* ignore */ }
    }
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    current = id;
  }

  function step(delta) {
    var i = order.indexOf(current);
    var n = (i + delta + order.length) % order.length;
    showScreen(order[n]);
  }

  function renderNotes(target) {
    if (!notesPanel) return;
    var src = $(".notes", target);
    if (!src) { notesPanel.innerHTML = "<h3>Design notes</h3><p class='muted'>No notes for this screen.</p>"; return; }
    notesPanel.innerHTML = "<h3>Design notes · " + (target.getAttribute("data-title") || "") + "</h3>" + src.innerHTML;
  }

  function countUp(el) {
    var end = parseFloat(el.getAttribute("data-countup"));
    if (isNaN(end)) return;
    var dec = (el.getAttribute("data-decimals") || "0") | 0;
    var prefix = el.getAttribute("data-prefix") || "";
    var suffix = el.getAttribute("data-suffix") || "";
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var t0 = performance.now(), dur = reduce ? 0 : 700;
    function frame(t) {
      var p = dur ? Math.min(1, (t - t0) / dur) : 1;
      var e = 1 - Math.pow(1 - p, 3);
      var v = end * e;
      el.textContent = prefix + v.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function toast(msg, ok) {
    if (!toastHost) return;
    var t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = (ok === false ? "" : "<span class='ok'>✓</span>") + "<span></span>";
    t.lastChild.textContent = msg;
    toastHost.appendChild(t);
    setTimeout(function () { t.style.opacity = "0"; t.style.transition = "opacity 300ms"; }, 2400);
    setTimeout(function () { t.remove(); }, 2800);
  }

  function openOverlay(sel) {
    var el = $(sel);
    if (!el) return;
    el.classList.add("open");
    var scrim = $("#scrim");
    if (scrim) scrim.classList.add("on");
  }
  function closeOverlays() {
    $$(".sheet.open, .modal.open").forEach(function (el) { el.classList.remove("open"); });
    var scrim = $("#scrim");
    if (scrim) scrim.classList.remove("on");
  }

  document.addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-go], [data-seg] > button, [data-chip], [data-tab], [data-open], [data-close], [data-toast], [data-status-cycle], [data-toggle-class], [data-check], [data-switch], [data-option]");
    if (!t) return;
    if (t.hasAttribute("data-go")) { ev.preventDefault(); showScreen(t.getAttribute("data-go")); return; }
    if (t.parentElement && t.parentElement.hasAttribute("data-seg")) {
      $$(":scope > button", t.parentElement).forEach(function (b) { b.classList.toggle("on", b === t); });
      var panels = t.parentElement.getAttribute("data-seg");
      var val = t.getAttribute("data-val");
      if (panels && val) {
        $$("[data-seg-panel='" + panels + "']").forEach(function (p) { p.classList.toggle("on", p.getAttribute("data-val") === val); });
      }
      return;
    }
    if (t.hasAttribute("data-chip")) { t.classList.toggle("on"); return; }
    if (t.hasAttribute("data-tab")) {
      var group = t.closest("[data-tabs]");
      var name = t.getAttribute("data-tab");
      if (group) {
        $$("[data-tab]", group).forEach(function (b) { b.classList.toggle("on", b === t); });
        var scope = group.getAttribute("data-tabs");
        $$("[data-panel]").forEach(function (p) {
          if (p.getAttribute("data-panel-group") !== scope) return;
          p.classList.toggle("on", p.getAttribute("data-panel") === name);
        });
      }
      return;
    }
    if (t.hasAttribute("data-open")) { ev.preventDefault(); openOverlay(t.getAttribute("data-open")); return; }
    if (t.hasAttribute("data-close")) { ev.preventDefault(); closeOverlays(); return; }
    if (t.hasAttribute("data-toast")) { toast(t.getAttribute("data-toast")); }
    if (t.hasAttribute("data-status-cycle")) {
      var host = t.closest("[data-status-host]") || document;
      var next = t.getAttribute("data-status-cycle");
      $$("[data-status-host] .status-track .st", host).forEach(function (st) {
        var k = st.getAttribute("data-st");
        st.classList.remove("now");
        if (k === next) st.classList.add("now");
      });
      var seq = $$(".status-track .st", host);
      var hit = false;
      seq.forEach(function (st) { if (st.getAttribute("data-st") === next) hit = true; st.classList.toggle("done", !hit && st.getAttribute("data-st") !== next); });
      $$("[data-status-btn]", host).forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-status-cycle") === next); });
      var label = $("[data-status-label]", host);
      if (label) label.textContent = t.getAttribute("data-status-text") || t.textContent.trim();
      toast(t.getAttribute("data-status-text") || t.textContent.trim());
    }
    if (t.hasAttribute("data-toggle-class")) {
      var tgt = t.getAttribute("data-target") ? $(t.getAttribute("data-target")) : t;
      if (tgt) tgt.classList.toggle(t.getAttribute("data-toggle-class"));
    }
    if (t.hasAttribute("data-check") || t.hasAttribute("data-switch")) { t.classList.toggle("on"); }
    if (t.hasAttribute("data-option")) {
      var oc = t.closest(".option-cards");
      if (oc) $$(".option-card", oc).forEach(function (c) { c.classList.toggle("on", c === t); });
    }
  });

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") closeOverlays();
    var tag = (ev.target && ev.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (ev.key === "ArrowRight" && ev.altKey) step(1);
    if (ev.key === "ArrowLeft" && ev.altKey) step(-1);
  });

  if (select) select.addEventListener("change", function () { showScreen(select.value); });
  var prev = $("#rb-prev"), next = $("#rb-next");
  if (prev) prev.addEventListener("click", function () { step(-1); });
  if (next) next.addEventListener("click", function () { step(1); });
  if (notesBtn) notesBtn.addEventListener("click", function () {
    var on = document.body.classList.toggle("show-notes");
    notesBtn.classList.toggle("on", on);
    if (notesPanel) notesPanel.hidden = !on;
  });
  var scrimEl = $("#scrim");
  if (scrimEl) scrimEl.addEventListener("click", closeOverlays);
  window.addEventListener("hashchange", function () { showScreen(location.hash.replace(/^#/, ""), false); });

  // delegated select changes for faces that swap user/company in the top bar (demo only)
  $$("[data-select-toast]").forEach(function (s) {
    s.addEventListener("change", function () { toast(s.getAttribute("data-select-toast") + " " + s.options[s.selectedIndex].text); });
  });

  buildSelect();
  var start = location.hash.replace(/^#/, "") || order[0];
  showScreen(start, false);
  // Entrance animations only run once the page is actually painting (a background or
  // thumbnail capture never gets the class, so everything is visible at rest).
  var frozen = false;
  function now() { return (document.timeline && typeof document.timeline.currentTime === "number") ? document.timeline.currentTime : performance.now(); }
  function armAnimations() {
    var t0 = now();
    document.documentElement.classList.add("anim");
    setTimeout(function () {
      if (now() - t0 < 100) { document.documentElement.classList.remove("anim"); frozen = true; }
    }, 500);
  }
  requestAnimationFrame(function () { requestAnimationFrame(armAnimations); });
  document.addEventListener("click", function () { if (frozen) { frozen = false; armAnimations(); } }, true);
  window.FL = { show: showScreen, toast: toast, step: step };
})();
