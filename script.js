/* ==========================================================
   Men Gher Ghesh - Season 2 | script.js
   All settings live in config.js. No animation library is used:
   animations are CSS + IntersectionObserver. If anything below
   throws, the "js" class is removed so the site shows without animations.
   ========================================================== */
(() => {
"use strict";
const root = document.documentElement;

try {
const C = window.SITE_CONFIG || {};
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const hasIO = "IntersectionObserver" in window;
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- 1) Loader + page transition ---------- */
const loader = $("#loader");
let started = false;

function enter() {
  if (started) return;
  started = true;
  root.classList.add("is-loaded");
  if (!loader) return;
  loader.className = "loader is-out";
  setTimeout(() => (loader.hidden = true), 800);
}

const go = () => setTimeout(enter, reduce ? 0 : 350);
document.readyState === "complete" ? go() : addEventListener("load", go);
setTimeout(enter, 3500);   // safety net: the loader can never get stuck

// Back/forward cache restore
addEventListener("pageshow", e => {
  if (e.persisted && loader) {
    loader.hidden = true;
    loader.className = "loader is-out";
    root.classList.add("is-loaded");
  }
});

// Slide-over transition between index.html and register.html
if (loader && !reduce) {
  $$("a[href]").forEach(a => {
    if (a.target === "_blank" || a.hasAttribute("download")) return;
    let url;
    try { url = new URL(a.href, location.href); } catch { return; }
    const samePage = url.pathname === location.pathname;
    const isPage = /(index|register)\.html$|\/$/.test(url.pathname);
    if (url.origin !== location.origin || !isPage || samePage) return;

    a.addEventListener("click", e => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      e.preventDefault();
      loader.hidden = false;
      loader.className = "loader is-below";
      void loader.offsetWidth;   // force reflow so the transition runs
      loader.className = "loader";
      setTimeout(() => (location.href = a.href), 650);
    });
  });
}

/* ---------- 2) Navbar + mobile menu ---------- */
const nav = $("#nav"), burger = $("#burger"), menu = $("#menu");
addEventListener("scroll", () => nav.classList.toggle("is-s", scrollY > 10), { passive: true });

const mq = matchMedia("(max-width: 860px)");
[...menu.children].forEach((el, i) => el.style.setProperty("--k", i));

function setMenu(open) {
  menu.classList.toggle("open", open);
  burger.classList.toggle("is-open", open);
  burger.setAttribute("aria-expanded", open);
  burger.setAttribute("aria-label", open ? "إغلاق القائمة" : "فتح القائمة");
  menu.inert = mq.matches && !open;   // hidden links must not be focusable
}

setMenu(false);
burger.addEventListener("click", () => setMenu(!menu.classList.contains("open")));
$$("a", menu).forEach(a => a.addEventListener("click", () => setMenu(false)));
document.addEventListener("click", e => {
  if (menu.classList.contains("open") && !nav.contains(e.target)) setMenu(false);
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && menu.classList.contains("open")) { setMenu(false); burger.focus(); }
});
mq.addEventListener("change", () => setMenu(false));
addEventListener("pageshow", () => setMenu(false));

// Highlight the menu link of the section being read
if (hasIO) {
  const links = $$('.menu__a[href^="#"]');
  const map = new Map(links.map(a => [$(a.getAttribute("href")), a]).filter(([s]) => s));
  const so = new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) {
      links.forEach(l => l.classList.remove("on"));
      map.get(en.target).classList.add("on");
    }
  }), { rootMargin: "-45% 0px -50% 0px" });
  map.forEach((_, s) => so.observe(s));
}

/* ---------- 3) Reveal on scroll + counters ---------- */
const revealEls = $$("[data-reveal]");
if (!hasIO) {
  revealEls.forEach(el => el.classList.add("in"));
} else {
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
  }), { rootMargin: "0px 0px -10% 0px", threshold: 0.08 });
  revealEls.forEach(el => io.observe(el));
}

// The real numbers are written in the HTML; they are re-counted with an animation when visible.
const counters = $$(".count");
if (counters.length && hasIO && !reduce) {
  counters.forEach(el => (el.textContent = "0"));
  const co = new IntersectionObserver(entries => entries.forEach(en => {
    if (!en.isIntersecting) return;
    co.unobserve(en.target);
    const el = en.target, to = +el.dataset.to, t0 = performance.now(), dur = 1600;
    (function tick(t) {
      const p = Math.min((t - t0) / dur, 1);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick); else el.textContent = to;
    })(t0);
  }), { threshold: 0.6 });
  counters.forEach(el => co.observe(el));
}

/* ---------- 4) Footer links + playlist (from config.js) ---------- */
const okUrl = u => typeof u === "string" && /^https?:\/\/\S+$/i.test(u.trim());
let anySocial = false;

$$("[data-social]").forEach(a => {
  const url = (C.SOCIAL || {})[a.dataset.social];
  if (okUrl(url)) { a.href = url.trim(); anySocial = true; }
  else a.hidden = true;   // no valid URL: hide the icon (no dead links)
});
const socBox = $(".foot__soc");
if (socBox && !anySocial) socBox.hidden = true;

const dev = $("#devLink");
if (dev) {
  if (okUrl(C.DEV_URL)) dev.href = C.DEV_URL.trim();
  else { dev.removeAttribute("href"); dev.removeAttribute("target"); }
}

const playlistId = String(C.PLAYLIST_ID || "").trim();
if (/^[\w-]{10,}$/.test(playlistId)) {
  const playlistUrl = "https://www.youtube.com/playlist?list=" + playlistId;
  $$("[data-playlist]").forEach(a => (a.href = playlistUrl));
  const plBtn = $("#playlistBtn");
  if (plBtn) { plBtn.href = playlistUrl; plBtn.hidden = false; }
}

/* ---------- 5) Final episode (iframe is created only on click) ---------- */
const vBox = $("#videoBox");
if (vBox) {
  const id = String(C.FINAL_VIDEO_ID || "").trim();
  const play = $("#videoPlay"), empty = $("#videoEmpty");
  if (/^[\w-]{6,}$/.test(id)) {
    empty.hidden = true;
    play.hidden = false;
    vBox.style.backgroundImage = `url(https://i.ytimg.com/vi/${id}/hqdefault.jpg)`;
    play.addEventListener("click", () => {
      const f = document.createElement("iframe");
      f.src = `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
      f.title = "الحلقة النهائية – من غير غش";
      f.allow = "autoplay; encrypted-media; picture-in-picture";
      f.allowFullscreen = true;
      play.remove();
      vBox.appendChild(f);
      f.focus();
    });
  }
}

/* ---------- 6) Gallery: Swiper + Lightbox ---------- */
const galEl = $(".gal");
if (galEl) {
  const galWrap = $("#galWrap"), galCount = $("#galCount");
  const items = $$(".gal__item");
  const canHover = matchMedia("(hover: hover) and (pointer: fine)").matches;

  // Phones: one large centred card with the neighbours peeking. Larger screens: 2 / 3 / 4 cards.
  const swiper = typeof Swiper !== "undefined" ? new Swiper(galEl, {
    slidesPerView: 1.25,
    centeredSlides: true,
    spaceBetween: 12,
    grabCursor: true,
    rewind: true,
    speed: 500,
    watchOverflow: true,
    watchSlidesProgress: true,
    breakpoints: {
      520:  { slidesPerView: 2, centeredSlides: false, spaceBetween: 16 },
      900:  { slidesPerView: 3, centeredSlides: false, spaceBetween: 20 },
      1100: { slidesPerView: 4, centeredSlides: false, spaceBetween: 22 }
    },
    navigation: { nextEl: ".gal__next", prevEl: ".gal__prev" },
    keyboard: { enabled: true },
    // Autoplay only with a mouse; on touch screens it fights the user's swipe
    autoplay: reduce || !canHover ? false : { delay: 3500, disableOnInteraction: true, pauseOnMouseEnter: true }
  }) : null;

  if (swiper && galWrap) {
    galWrap.classList.add("gal-ready");
    const updateCount = () => { if (galCount) galCount.textContent = `${swiper.realIndex + 1} / ${items.length}`; };
    swiper.on("slideChange", updateCount);
    updateCount();
  }

  const lb = $("#lb"), lbImg = $("#lbImg"), lbCap = $("#lbCap");
  let cur = 0, opener = null;

  function showImg(i) {
    cur = (i + items.length) % items.length;
    const img = $("img", items[cur]);
    lbImg.src = img.currentSrc || img.src;
    lbImg.alt = img.alt;
    lbCap.textContent = items[cur].dataset.cap || "";
  }
  function openLb(i) {
    opener = items[i];
    showImg(i);
    lb.hidden = false;
    document.body.style.overflow = "hidden";
    $("#lbClose").focus();
    if (swiper && swiper.autoplay && swiper.autoplay.running) swiper.autoplay.stop();
  }
  function closeLb() {
    lb.hidden = true;
    document.body.style.overflow = "";
    if (swiper) swiper.slideTo(cur);   // gallery follows the last viewed photo
    if (opener) opener.focus();
  }

  items.forEach((b, i) => b.addEventListener("click", () => openLb(i)));
  $("#lbClose").addEventListener("click", closeLb);
  $("#lbPrev").addEventListener("click", () => showImg(cur - 1));
  $("#lbNext").addEventListener("click", () => showImg(cur + 1));
  lb.addEventListener("click", e => { if (e.target === lb) closeLb(); });

  // Swipe inside the lightbox (RTL: dragging to the right shows the next photo)
  let sx = 0, sy = 0;
  lb.addEventListener("touchstart", e => { sx = e.changedTouches[0].clientX; sy = e.changedTouches[0].clientY; }, { passive: true });
  lb.addEventListener("touchend", e => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) showImg(dx > 0 ? cur + 1 : cur - 1);
  }, { passive: true });

  document.addEventListener("keydown", e => {
    if (lb.hidden) return;
    if (e.key === "Escape") closeLb();
    if (e.key === "ArrowLeft") showImg(cur + 1);    // RTL: left arrow = next
    if (e.key === "ArrowRight") showImg(cur - 1);
    if (e.key === "Tab") {                          // keep keyboard focus inside the lightbox
      const f = $$("button", lb), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}

/* ---------- 7) Registration form ---------- */
const form = $("#regForm");
if (form) {
  const t0 = Date.now();
  const btn = $("#submitBtn"), spin = $(".spin", btn), btnT = $(".btn__t", btn);
  const msg = $("#formMsg"), closedMsg = $("#closedMsg"), ageIn = $("#age");
  const MIN = +C.MIN_AGE || 10, MAX = +C.MAX_AGE || 16;

  const ar2en = s => String(s).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
  const phoneOK = v => /^01[0125]\d{8}$/.test(v);
  const NAME_RE = /^[\u0621-\u063A\u0641-\u064A\u064B-\u0652\u0671a-zA-Z\s]+$/;
  const PHONE_MSG = "اكتب رقم موبايل مصري صحيح (11 رقمًا يبدأ بـ 01)";

  let sending = false, closed = false, retry = false;
  let lastKey = "", lastRid = "";   // same data => same request id, so a retry can never double-register

  // Full years on today's date, from a YYYY-MM-DD string
  const parts = s => /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split("-").map(Number) : null;
  function ageOf(birth) {
    const b = parts(birth);
    if (!b) return null;
    const d = new Date(b[0], b[1] - 1, b[2]);
    if (d.getFullYear() !== b[0] || d.getMonth() !== b[1] - 1 || d.getDate() !== b[2]) return null;   // e.g. 2012-02-31
    const n = new Date();
    let a = n.getFullYear() - b[0];
    if (n.getMonth() + 1 < b[1] || (n.getMonth() + 1 === b[1] && n.getDate() < b[2])) a--;
    return a;
  }

  const pad = n => String(n).padStart(2, "0");
  const now = new Date();
  $("#birth").max = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  $("#birth").min = `${now.getFullYear() - 40}-01-01`;

  // One rule per text field: returns "" when valid, otherwise the message shown under the field
  const rules = {
    name: v => v.trim().split(/\s+/).length >= 3 && NAME_RE.test(v.trim()) && v.trim().length <= 80
      ? "" : "اكتب الاسم ثلاثيًا على الأقل بحروف فقط",
    birth: v => {
      if (!v) return "اختر تاريخ ميلادك";
      const a = ageOf(v);
      if (a === null || a < 0) return "تاريخ الميلاد غير صحيح";
      if (a < MIN) return `عمرك ${a} سنة؛ التسجيل من ${MIN} إلى ${MAX} سنة`;
      if (a > MAX) return `عمرك ${a} سنة؛ التسجيل من ${MIN} إلى ${MAX} سنة (الحدّان مشمولان)`;
      return "";
    },
    phone: v => phoneOK(ar2en(v)) ? "" : PHONE_MSG,
    parent: v => !phoneOK(ar2en(v)) ? PHONE_MSG
      : ar2en(v) === ar2en($("#phone").value) ? "رقم ولي الأمر يجب أن يختلف عن رقم الطالب" : "",
    area: v => v.trim().length >= 2 ? "" : "اكتب اسم المنطقة",
    address: v => v.trim().length >= 10 ? "" : "اكتب العنوان بالتفصيل (10 أحرف على الأقل)"
  };
  const checkMsg = {
    phoneWa: "أكّد أن الرقم عليه واتساب",
    parentWa: "أكّد أن رقم ولي الأمر عليه واتساب",
    agree: "يجب الموافقة على الشروط والإقرار بصحة البيانات"
  };

  function setState(id, error) {
    const field = $("#" + id).closest(".field");
    field.classList.toggle("bad", !!error);
    field.classList.toggle("ok", !error);
    $(".err", field).textContent = error;
    return !error;
  }
  const validateField = id => {
    const el = $("#" + id);
    return rules[id] ? setState(id, rules[id](el.value)) : setState(id, el.checked ? "" : checkMsg[id]);
  };
  const ids = [...Object.keys(rules), ...Object.keys(checkMsg)];

  ids.forEach(id => {
    const el = $("#" + id);
    const evt = el.type === "checkbox" || el.type === "date" ? "change" : "blur";
    el.addEventListener(evt, () => validateField(id));
  });

  $("#birth").addEventListener("input", e => {
    const a = ageOf(e.target.value);
    ageIn.value = a !== null && a >= 0 ? `${a} سنة` : "";   // display only
  });
  ["phone", "parent"].forEach(id => $("#" + id).addEventListener("input", e => {
    e.target.value = ar2en(e.target.value).replace(/\D/g, "");
  }));
  // Changing the student's number can fix or break the "different numbers" rule of the parent's number
  $("#phone").addEventListener("blur", () => { if ($("#parent").value) validateField("parent"); });

  function show(type, text) {
    msg.hidden = false;
    msg.className = "msg msg--" + type;
    msg.textContent = text;
    msg.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  }
  function busy(on, label) {
    sending = on;
    btn.disabled = on || closed;
    btn.setAttribute("aria-busy", on);
    spin.hidden = !on;
    btnT.textContent = label || (on ? "جارٍ الإرسال..." : retry ? "إعادة المحاولة" : "إرسال بياناتي");
  }
  const fmtD = s => { const p = parts(s); return p ? `${p[2]}/${p[1]}/${p[0]}` : s; };

  function setClosed(st) {
    closed = true;
    btn.disabled = true;
    form.classList.add("is-closed");
    const texts = {
      not_started: `التسجيل لم يبدأ بعد${st.start ? "؛ يبدأ في " + fmtD(st.start) : ""}.`,
      ended: "انتهت فترة التسجيل.",
      not_configured: "التسجيل غير متاح حاليًا."
    };
    closedMsg.textContent = texts[st.reason] || texts.not_configured;
    closedMsg.hidden = false;
  }

  // Registration status comes from the server (the single source of truth for the dates)
  if (C.SCRIPT_URL) {
    fetch(C.SCRIPT_URL, { cache: "no-store" })
      .then(r => r.json())
      .then(st => { if (st && st.open === false) setClosed(st); })
      .catch(() => {});
  }

  // Server error code -> [field to highlight, message]
  const fieldErrors = {
    name: ["name", "اكتب الاسم ثلاثيًا على الأقل بحروف فقط"],
    birth: ["birth", "تاريخ الميلاد غير صحيح"],
    age: ["birth", `السن يجب أن يكون من ${MIN} إلى ${MAX} سنة`],
    phone: ["phone", "تأكد من رقمي الهاتف (11 رقمًا، ومختلفان عن بعض)"],
    area: ["area", "اكتب اسم المنطقة"],
    address: ["address", "اكتب العنوان بالتفصيل (10 أحرف على الأقل)"],
    agree: ["agree", checkMsg.agree],
    duplicate: ["phone", "هذا الرقم مسجّل من قبل."]
  };

  async function send(payload) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 30000);
    try {
      // text/plain avoids the CORS preflight request that Apps Script does not answer
      const res = await fetch(C.SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        signal: ctl.signal
      });
      if (!res.ok) throw Object.assign(new Error("http"), { code: "http" });
      let out;
      try { out = await res.json(); } catch { throw Object.assign(new Error("bad"), { code: "bad_response" }); }
      return out;
    } catch (err) {
      if (err.code) throw err;
      throw Object.assign(new Error("net"), { code: "network" });   // offline, DNS, blocked, timeout (abort)
    } finally {
      clearTimeout(timer);
    }
  }

  function handleFailure(code) {
    retry = true;
    if (code.startsWith("closed:")) {
      setClosed({ reason: code.split(":")[1] });
      return show("no", closedMsg.textContent);
    }
    if (fieldErrors[code]) {
      const [id, text] = fieldErrors[code];
      setState(id, text);
      $("#" + id).focus();
      return show("no", "لم يتم تسجيلك: " + text);
    }
    if (code === "network") {
      return show("no", "تعذّر الاتصال بالخادم، ولم نتأكد من حفظ بياناتك. تأكد من الإنترنت ثم اضغط «إعادة المحاولة»؛ بياناتك ما زالت في الفورم ولن تُسجَّل مرتين.");
    }
    if (code === "http" || code === "bad_response") {
      return show("no", "الخادم لم يرد بشكل صحيح، ولم يتم تسجيل بياناتك. أعد المحاولة بعد قليل.");
    }
    return show("no", "حدث خطأ أثناء الحفظ ولم يتم تسجيل بياناتك. أعد المحاولة بعد قليل.");
  }

  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (sending || closed) return;   // blocks double clicks while a request is in flight
    msg.hidden = true;

    const results = ids.map(validateField);
    if (results.includes(false)) {
      const first = $(".bad input, .bad select, .bad textarea");
      if (first) first.focus();
      return show("no", "راجع الحقول المظللة بالأحمر ثم أعد المحاولة.");
    }
    if ($("#website").value) return;   // honeypot filled: it is a bot, drop silently

    if (!C.SCRIPT_URL) return show("no", "لم يتم ربط النموذج بـ Google Sheets بعد. راجع ملف README.");

    const phone = ar2en($("#phone").value);
    try {
      if (localStorage.getItem("mgg_sent") === phone) return show("no", "تم تسجيل هذا الرقم من هذا الجهاز بالفعل.");
    } catch {}

    const data = {
      name: $("#name").value.trim(),
      birth: $("#birth").value,
      phone,
      parent: ar2en($("#parent").value),
      area: $("#area").value.trim(),
      address: $("#address").value.trim(),
      agree: true,
      website: ""
    };

    // Same data => same request id; the server answers a repeated id with the original registration number
    const key = JSON.stringify(data);
    if (key !== lastKey) {
      lastKey = key;
      lastRid = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "r" + Date.now() + Math.random().toString(36).slice(2, 10);
    }

    busy(true);
    try {
      // Anti-bot: a human cannot fill the form faster than MIN_FILL_MS, so just wait the remaining time
      const wait = (C.MIN_FILL_MS || 4000) - (Date.now() - t0);
      if (wait > 0) await sleep(wait);

      const out = await send({ ...data, rid: lastRid });
      if (!out || out.ok !== true || !out.id) {
        const err = new Error("rejected");
        err.code = String((out && out.error) || "server");
        throw err;
      }

      // Success is shown only now, after the server confirmed the row was written
      try { localStorage.setItem("mgg_sent", phone); } catch {}
      lastKey = ""; lastRid = ""; retry = false;
      form.reset();
      $$(".field").forEach(f => f.classList.remove("ok", "bad"));
      ageIn.value = "";
      show("ok", `تم تسجيلك بنجاح! رقم التسجيل: ${out.id}. سنتواصل معك عبر واتساب.`);
    } catch (err) {
      handleFailure(err.code || "server");
    } finally {
      busy(false);
    }
  });
}

} catch (err) {
  root.classList.remove("js");   // unexpected failure: show the site without animations
  const l = document.getElementById("loader");
  if (l) l.hidden = true;
  console.error(err);
}
})();
