// Dotted orbs for the Boxbox pit wall: a small vanilla canvas engine.
// The idea of an animated dotted orb per agent state comes from thinking-orbs
// (github.com/Jakubantalik/thinking-orbs, MIT). This is a fresh canvas port; no code was copied.
"use strict";
(function () {
  const KINDS = {
    think:   { label: "Planning",  mode: "orbits", hue: "#5aa9ff", desc: "working out the next step" },
    read:    { label: "Reading",   mode: "globe",  hue: "#7fd4ff", desc: "opening a file" },
    search:  { label: "Searching", mode: "globe",  hue: "#7fd4ff", desc: "searching the codebase" },
    edit:    { label: "Editing",   mode: "ribbon", hue: "#b38cff", desc: "changing code" },
    run:     { label: "Terminal",  mode: "bands",  hue: "#ffc53d", desc: "running a command" },
    test:    { label: "Testing",   mode: "bands",  hue: "#3ddc84", desc: "running the tests" },
    web:     { label: "Web",       mode: "web",    hue: "#ff8fb1", desc: "searching the web" },
    page:    { label: "Page",      mode: "ribbon", hue: "#e9f1fb", desc: "writing a Boxbox page" },
    commit:  { label: "Commit",    mode: "ring",   hue: "#3ddc84", desc: "committing a task" },
    skill:   { label: "Skill",     mode: "web",    hue: "#7ee0c3", desc: "loading or installing a skill" },
    crew:    { label: "Crew",      mode: "orbits", hue: "#9fb4ff", desc: "a subagent started or finished" },
    wait:    { label: "Waiting",   mode: "ring",   hue: "#ffc53d", desc: "waiting for you" },
    stage:   { label: "Stage",     mode: "orbits", hue: "#e9f1fb", desc: "a step in the Boxbox flow" },
    prompt:  { label: "You",       mode: "ring",   hue: "#ffc53d", desc: "you replied in chat" },
    session: { label: "Session",   mode: "ring",   hue: "#93a3b8", desc: "a session started or ended" }
  };

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const orbs = [];

  function makeOrb(canvas, size, group) {
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = size * dpr; canvas.height = size * dpr;
    canvas.style.width = size + "px"; canvas.style.height = size + "px";
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    const n = size > 100 ? 420 : size > 24 ? 90 : 46;
    const pts = []; // fibonacci sphere
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996;
      pts.push([Math.cos(th) * r, y, Math.sin(th) * r]);
    }
    const web = pts.filter((_, i) => i % Math.max(1, Math.floor(n / 22)) === 0);
    const o = { canvas, ctx, size, pts, web, mode: "orbits", paused: false, ink: "#e9f1fb", group: group || "" };
    orbs.push(o);
    if (reduce) drawOrb(o, 1.3);
    return o;
  }

  function dropGroup(group) {
    for (let i = orbs.length - 1; i >= 0; i--) if (orbs[i].group === group) orbs.splice(i, 1);
  }

  function rot(p, ax, ay) { // rotate around y then x
    let [x, y, z] = p;
    let c = Math.cos(ay), s = Math.sin(ay);
    [x, z] = [x * c - z * s, x * s + z * c];
    c = Math.cos(ax); s = Math.sin(ax);
    [y, z] = [y * c - z * s, y * s + z * c];
    return [x, y, z];
  }

  function drawOrb(o, t) {
    const { ctx, size } = o, R = size * 0.42, cx = size / 2, cy = size / 2, big = size > 100, dot = big ? 1.6 : size > 24 ? 1.1 : 0.8;
    ctx.clearRect(0, 0, size, size);
    const put = (x, y, z, a, r) => {
      ctx.globalAlpha = Math.max(0, Math.min(1, a));
      ctx.beginPath(); ctx.arc(cx + x * R, cy - y * R, r || dot * (0.6 + 0.5 * (z + 1) / 2), 0, 6.283); ctx.fill();
    };
    ctx.fillStyle = o.ink; ctx.strokeStyle = o.ink;
    const m = o.paused ? "ring" : o.mode;
    if (m === "globe") { // a scan meridian sweeps a dotted globe
      const scan = (t * 0.9) % 6.283;
      for (const p of o.pts) {
        const q = rot(p, 0.35, t * 0.35), lon = Math.atan2(q[2], q[0]), d = Math.abs(((lon - scan + 9.42) % 6.283) - 3.14);
        const near = d < 0.28 ? 1 : 0;
        put(q[0], q[1], q[2], (q[2] + 1.2) / 2.6 + near * 0.6, near ? dot * 1.6 : 0);
      }
    } else if (m === "orbits") { // particles on tilted orbits
      for (const p of o.pts) { const q = rot(p, 0.4, t * 0.12); put(q[0], q[1], q[2], 0.08 + (q[2] + 1) * 0.06); }
      const rings = [[0.5, 0], [1.15, 1.2], [-0.7, 2.3]], per = big ? 40 : 12;
      rings.forEach(([tilt, ph], ri) => {
        for (let i = 0; i < per; i++) {
          const a = i / per * 6.283 + t * (0.9 + ri * 0.25) + ph;
          let p = [Math.cos(a) * 1.02, 0, Math.sin(a) * 1.02];
          p = rot(p, tilt, ph + t * 0.2);
          const tail = (i % per) / per;
          put(p[0], p[1], p[2], 0.25 + 0.75 * tail * ((p[2] + 1.4) / 2.4), dot * (0.8 + tail * 0.9));
        }
      });
    } else if (m === "ribbon") { // an undulating band: editing
      for (const p of o.pts) {
        const q = rot(p, 0.3, t * 0.4);
        const band = Math.abs(q[1] - 0.45 * Math.sin(Math.atan2(q[2], q[0]) * 2 + t * 1.6));
        put(q[0], q[1], q[2], band < 0.2 ? 0.35 + (q[2] + 1) * 0.33 : 0.06 + (q[2] + 1) * 0.04, band < 0.2 ? dot * 1.3 : 0);
      }
    } else if (m === "bands") { // latitude bands step against each other: terminal and tests
      const step = Math.floor(t * 1.2), frac = Math.min(1, (t * 1.2 - step) * 3);
      for (const p of o.pts) {
        const band = Math.floor((p[1] + 1) * 2.5), dir = band % 2 ? 1 : -1;
        const ang = (step + (frac < 1 ? frac : 1)) * 0.52 * dir + t * 0.1;
        const q = rot(p, 0.45, ang);
        put(q[0], q[1], q[2], 0.18 + (q[2] + 1) * 0.32);
      }
    } else if (m === "web") { // a constellation wires itself
      const W = o.web.map(p => rot(p, 0.4, t * 0.3));
      ctx.lineWidth = big ? 0.7 : 0.4;
      for (let i = 0; i < W.length; i++) for (let j = i + 1; j < W.length; j++) {
        const a = W[i], b = W[j], d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        if (d < 0.75) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 2 + i + j);
          ctx.globalAlpha = (0.1 + 0.25 * pulse) * ((a[2] + b[2] + 2) / 4);
          ctx.beginPath(); ctx.moveTo(cx + a[0] * R, cy - a[1] * R); ctx.lineTo(cx + b[0] * R, cy - b[1] * R); ctx.stroke();
        }
      }
      for (const q of W) put(q[0], q[1], q[2], 0.4 + (q[2] + 1) * 0.3, dot * 1.5);
    } else { // ring: waiting, paused, commit
      const per = big ? 120 : 30, br = 0.82 + 0.12 * Math.sin(t * 1.4);
      for (let i = 0; i < per; i++) {
        const a = i / per * 6.283, w = 1 + 0.06 * Math.sin(a * 3 + t * 1.1);
        let p = [Math.cos(a) * br * w, 0, Math.sin(a) * br * w];
        p = rot(p, 1.1, t * 0.15);
        put(p[0], p[1], p[2], 0.3 + (p[2] + 1) * 0.33);
      }
    }
    ctx.globalAlpha = 1;
  }

  const t0 = performance.now();
  function frame(now) {
    const t = (now - t0) / 1000;
    for (const o of orbs) if (o.canvas.isConnected && o.canvas.offsetParent !== null) drawOrb(o, t);
    requestAnimationFrame(frame);
  }
  // With reduced motion, orbs are drawn once as still dots and redrawn only when their state changes.
  function redraw(o) { if (reduce) drawOrb(o, 1.3); }
  if (!reduce) requestAnimationFrame(frame);

  window.BoxboxOrbs = { KINDS, makeOrb, dropGroup, redraw, reduce };
})();
