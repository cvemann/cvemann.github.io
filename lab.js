// Page loader: shown once per session (decided in the page head). The mark is
// written by a pen (CSS); once the page and fonts are ready, and at least
// long enough for the pull to land, the printed logo glides into the header
// logo's exact place and hands over to it.
function runLoader() {
  const root = document.documentElement;
  if (!root.classList.contains("is-loading")) return;
  const start = performance.now();
  const shortest = 2650; // the ink settles at ~2.45s, then a short beat
  const longest = 3400;

  const pageLoaded = new Promise((resolve) => {
    if (document.readyState === "complete") resolve();
    else addEventListener("load", resolve, { once: true });
  });
  const ready = Promise.all([pageLoaded, document.fonts ? document.fonts.ready : null]);
  const cap = new Promise((resolve) => setTimeout(resolve, longest));

  function finish() {
    root.classList.add("loader-done");
    root.classList.remove("is-loading", "is-loaded");
  }

  function handOff() {
    const mark = document.querySelector(".loader-mark");
    const target = document.querySelector(".site-header .logo");
    root.classList.add("is-loaded");
    if (!mark || !target) return setTimeout(finish, 700);

    const from = mark.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    const inView = to.bottom > 0 && to.top < innerHeight;
    if (!inView) {
      // header is off-screen (arrived at a section link): just let the sheet fade
      mark.style.transition = "opacity 0.4s ease";
      mark.style.opacity = "0";
      return setTimeout(finish, 700);
    }

    const scale = to.width / from.width;
    mark.style.transition = "transform 0.72s cubic-bezier(0.7, 0, 0.2, 1)";
    mark.style.transform =
      `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${scale})`;
    mark.addEventListener("transitionend", finish, { once: true });
    setTimeout(finish, 1000); // in case transitionend never fires
  }

  Promise.race([ready, cap]).then(() => {
    const wait = Math.max(0, shortest - (performance.now() - start));
    setTimeout(handOff, wait);
  });
}
runLoader();

// Theme toggle: dark by default; light when the visitor picks it, remembered
// in this browser. The label comes from CSS, so this only switches the theme
// and keeps the button's accessible name right.
(() => {
  const button = document.querySelector(".theme-toggle");
  if (!button) return;
  const root = document.documentElement;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

  const current = () => (root.dataset.theme === "light" ? "light" : "dark");

  function render() {
    const next = current() === "dark" ? "light" : "dark";
    button.setAttribute("aria-label", `Switch to ${next} mode`);
  }

  function apply(theme) {
    if (theme === "light") root.dataset.theme = "light";
    else delete root.dataset.theme;
    try { localStorage.setItem("theme", theme); } catch (e) {}
    render();
  }

  button.addEventListener("click", () => {
    const next = current() === "dark" ? "light" : "dark";
    // crossfade the whole page at once where supported, so nothing changes early
    if (document.startViewTransition && !reduceMotion.matches) {
      document.startViewTransition(() => apply(next));
    } else {
      apply(next);
    }
  });

  render();
})();

// Project preview plate: on wide screens with a mouse, hovering (or tabbing to)
// a project shows a larger plate in the right margin. It rides a vertical rail,
// following the cursor up and down, leans while it moves and settles straight
// on whole pixels so the image stays sharp when it's still.
(() => {
  const list = document.querySelector(".projects");
  const column = document.querySelector(".page");
  if (!list || !column) return;

  const canHover = matchMedia("(hover: hover) and (pointer: fine)");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const projects = [...list.querySelectorAll(".project")];


  const figure = document.createElement("figure");
  figure.className = "preview";
  figure.setAttribute("aria-hidden", "true");
  figure.innerHTML =
    '<div class="preview-plate"><div class="preview-media"></div>' +
    '<figcaption><b class="preview-no"></b><span class="preview-name"></span>' +
    '<span class="preview-year"></span></figcaption></div>';
  document.body.append(figure);

  const media = figure.querySelector(".preview-media");
  const number = figure.querySelector(".preview-no");
  const name = figure.querySelector(".preview-name");
  const year = figure.querySelector(".preview-year");

  let active = null;
  let y = 0;
  let targetY = 0;
  let tilt = 0;
  let frame = 0;
  let preloaded = false;

  const gap = 40;
  const edge = 24;

  // width of the free margin to the right of the text column, or 0 if too narrow
  function railWidth() {
    const right = column.getBoundingClientRect().right - parseFloat(getComputedStyle(column).paddingRight);
    const room = innerWidth - right - gap - edge;
    return room >= 220 ? Math.min(300, room) : 0;
  }

  function placeRail() {
    const width = railWidth();
    if (!width) return false;
    const right = column.getBoundingClientRect().right - parseFloat(getComputedStyle(column).paddingRight);
    figure.style.width = width + "px";
    figure.style.left = right + gap + "px";
    return true;
  }

  function clampY(centre) {
    const h = figure.offsetHeight || 220;
    return Math.max(edge, Math.min(innerHeight - h - edge, centre - h / 2));
  }

  function preload() {
    if (preloaded) return;
    preloaded = true;
    projects.forEach((p) => {
      const img = new Image();
      img.src = p.querySelector("img").currentSrc || p.querySelector("img").src;
    });
  }

  function swapImage(src) {
    const img = document.createElement("img");
    img.alt = "";
    img.src = src;
    if (media.children.length && !reduceMotion.matches) img.className = "is-new";
    media.append(img);
    // keep only the plate underneath and the new one
    while (media.children.length > 2) media.firstElementChild.remove();
    img.addEventListener("animationend", () => {
      while (media.firstElementChild !== img) media.firstElementChild.remove();
    }, { once: true });
  }

  function show(project, centreY) {
    if (!canHover.matches || !placeRail()) return hide();
    if (project === active) return;
    const index = projects.indexOf(project);
    const wasHidden = !active;
    active = project;

    swapImage(project.querySelector("img").currentSrc || project.querySelector("img").src);
    number.textContent = "fig. " + String(index + 1).padStart(2, "0");
    name.textContent = project.querySelector("h3").textContent;
    year.textContent = project.dataset.year || "";

    targetY = clampY(centreY);
    if (wasHidden) {
      y = targetY;
      tilt = 0;
    }
    figure.classList.add("is-on");
    tick();
  }

  function hide() {
    active = null;
    figure.classList.remove("is-on");
  }

  function tick() {
    cancelAnimationFrame(frame);
    figure.style.willChange = "transform";
    const step = () => {
      const ease = reduceMotion.matches ? 1 : 0.16;
      y += (targetY - y) * ease;
      // a little drag: the plate leans into the direction it's moving
      const lean = reduceMotion.matches ? 0 : Math.max(-2.5, Math.min(2.5, (targetY - y) * 0.035));
      tilt += (lean - tilt) * (reduceMotion.matches ? 1 : 0.2);
      const moving = Math.abs(targetY - y) > 0.5 || Math.abs(tilt) > 0.02;
      if (moving) {
        figure.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) rotate(${tilt.toFixed(3)}deg)`;
        frame = requestAnimationFrame(step);
      } else {
        // at rest: no rotation, whole pixels, no compositing layer, so it renders crisp
        y = Math.round(targetY);
        tilt = 0;
        figure.style.transform = `translateY(${y}px)`;
        figure.style.willChange = "auto";
      }
    };
    step();
  }

  list.addEventListener("pointerenter", preload);

  projects.forEach((project) => {
    project.addEventListener("pointerenter", (e) => show(project, e.clientY));
    project.addEventListener("focusin", () => {
      const r = project.getBoundingClientRect();
      show(project, r.top + r.height / 2);
    });
  });

  list.addEventListener("pointermove", (e) => {
    if (!active) return;
    targetY = clampY(e.clientY);
    tick();
  });

  list.addEventListener("pointerleave", hide);
  list.addEventListener("focusout", (e) => {
    if (!list.contains(e.relatedTarget)) hide();
  });

  addEventListener("scroll", () => active && !list.matches(":hover") && hide(), { passive: true });
  addEventListener("resize", () => active && (placeRail() || hide()));
})();

// Scroll motion: M2 hero, M3 header and nav marker, M4/M5 row reveals,
// M8 footer signature.
// One passive scroll listener and one rAF per frame; reveals use an
// IntersectionObserver. Reveals only run when the page has the .motion flag
// (set in the head when reduced motion is off).
(() => {
  const root = document.documentElement;
  const header = document.querySelector(".site-header");
  const nav = document.querySelector(".site-nav");
  const hero = document.querySelector(".kinetic");
  const sections = ["projects", "learning", "contact"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  if (!header) return;

  const motion = root.classList.contains("motion");

  // M3: the marker that sits under the current section's link
  const marker = document.createElement("span");
  marker.className = "nav-marker";
  marker.setAttribute("aria-hidden", "true");
  nav.append(marker);
  const links = new Map(
    [...nav.querySelectorAll('a[href^="#"]')].map((a) => [a.getAttribute("href").slice(1), a])
  );
  let current = null;

  function setCurrent(id) {
    if (id === current) return;
    current = id;
    links.forEach((a, key) => a.setAttribute("aria-current", String(key === id)));
    const a = id && links.get(id);
    if (!a) {
      marker.style.opacity = "0";
      return;
    }
    marker.style.opacity = "1";
    marker.style.width = a.offsetWidth + "px";
    marker.style.transform = `translateX(${a.offsetLeft}px)`;
  }

  let ticking = false;
  function update() {
    ticking = false;
    const y = scrollY;
    header.classList.toggle("is-condensed", y > 120);

    // the last section whose top has passed a reading line. the line slides
    // from 40% of the screen at the top of the page to the bottom edge at the
    // end, so every section gets its turn even on a short page
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const line = innerHeight * (0.4 + 0.6 * Math.min(1, y / max));
    let id = null;
    for (const s of sections) if (s.getBoundingClientRect().top <= line) id = s.id;
    setCurrent(id);

    // M2: 0 at the top, 1 once the hero has scrolled up under the header
    if (hero && motion) {
      const box = hero.closest(".hero").getBoundingClientRect();
      const span = box.height + box.top + y - 80;
      const p = Math.min(1, Math.max(0, y / Math.max(1, span)));
      hero.style.setProperty("--hero", p.toFixed(3));
    }
  }

  addEventListener("scroll", () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
  addEventListener("resize", () => {
    current = null;
    update();
  });
  update();

  if (!motion) return;

  // M4/M5: give each row's items their stagger, then reveal rows as they enter
  const rows = [...document.querySelectorAll("main .row")];
  rows.forEach((row) => {
    const items = row.querySelectorAll(".project, .ledger > div, .row-text > *");
    const step = row.id === "projects" ? 80 : row.querySelector(".ledger") ? 50 : 60;
    items.forEach((el, i) => {
      el.classList.add("reveal");
      el.style.setProperty("--d", 150 + i * step + "ms");
    });
  });

  function startReveals() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.12 });
    rows.forEach((row) => io.observe(row));

    // M8: the pen signs the footer once, when it is 60% in view
    const footer = document.querySelector(".site-footer");
    if (footer && footer.querySelector(".signature")) {
      const sign = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        footer.classList.add("is-signed");
        sign.disconnect();
      }, { threshold: 0.6 });
      sign.observe(footer);
    }
  }

  // wait for the loader to hand off, so nothing reveals behind it
  if (root.classList.contains("is-loading")) {
    const watch = new MutationObserver(() => {
      if (!root.classList.contains("is-loading") || root.classList.contains("is-loaded")) {
        watch.disconnect();
        startReveals();
      }
    });
    watch.observe(root, { attributes: true, attributeFilter: ["class"] });
  } else {
    startReveals();
  }
})();
