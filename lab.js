// Page loader: shown once per session (decided in the page head). Waits for
// the page and fonts, but at least long enough for the pen to lay its strokes
// and never longer than the cap; then the ink floods and the sheet lifts.
(() => {
  const root = document.documentElement;
  if (!root.classList.contains("is-loading")) return;
  const start = performance.now();
  const shortest = 1150;
  const longest = 2600;

  const pageLoaded = new Promise((resolve) => {
    if (document.readyState === "complete") resolve();
    else addEventListener("load", resolve, { once: true });
  });
  const ready = Promise.all([pageLoaded, document.fonts ? document.fonts.ready : null]);
  const cap = new Promise((resolve) => setTimeout(resolve, longest));

  Promise.race([ready, cap]).then(() => {
    const wait = Math.max(0, shortest - (performance.now() - start));
    setTimeout(() => {
      root.classList.add("is-loaded");
      setTimeout(() => root.classList.remove("is-loading", "is-loaded"), 800);
    }, wait);
  });
})();

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
