
/* FRANKIE PHOTOGRAPHY PORTFOLIO */

document.addEventListener("DOMContentLoaded", () => {

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  );

  /* ===================================
     1. STICKY NAVIGATION
  =================================== */

  const header = document.getElementById("site-header");

  function updateHeader() {
    header.classList.toggle(
      "is-scrolled",
      window.scrollY > 20
    );

    document.documentElement.style.setProperty(
      "--header-height",
      `${Math.ceil(header.getBoundingClientRect().height)}px`
    );
  }

  updateHeader();

  window.addEventListener("scroll", updateHeader, {
    passive: true
  });

  if ("ResizeObserver" in window) {
    new ResizeObserver(updateHeader).observe(header);
  } else {
    window.addEventListener("resize", updateHeader);
  }

  /* ===================================
     2. ANIMATED BACKGROUND WAVES
  =================================== */

  const ns = "http://www.w3.org/2000/svg";
  const wavePaths = [];

  for (const [groupId, count, field] of [
    ["wave-group-one", 12, 0],
    ["wave-group-two", 7, 1]
  ]) {

    const group = document.getElementById(groupId);

    for (let i = 0; i < count; i++) {
      const path = document.createElementNS(ns, "path");
      path.setAttribute("class", "wave-line");

      group.appendChild(path);

      wavePaths.push({
        path,
        index: i,
        total: count,
        field
      });
    }
  }

  let wavesFrame = null;
  let lastWaveTime = 0;

  function drawWaves(time) {

    const s = time / 1000;

    wavePaths.forEach(({ path, index, total, field }) => {

      const base =
        (field ? 325 : 635) +
        (index - (total - 1) / 2) * (field ? 11 : 9);

      let data = "";

      for (let x = -100; x <= 1540; x += 36) {

        const y =
          base +
          Math.sin(
            x / 205 - s * .23 + index * .045 + field
          ) * (field ? 58 : 68) +

          Math.sin(
            x / 380 + s * .16 + field * 1.8
          ) * 21 +

          Math.sin(
            x / 120 + s * .12 + index * .025
          ) * 8;

        data +=
          `${x === -100 ? "M" : "L"}${x} ${y.toFixed(2)} `;
      }

      path.setAttribute("d", data);
    });
  }

  function stopWaves() {
    if (wavesFrame !== null) {
      cancelAnimationFrame(wavesFrame);
    }

    wavesFrame = null;
  }

  function runWaves(t) {

    if (
      t - lastWaveTime >=
      (window.innerWidth < 700 ? 66 : 42)
    ) {
      drawWaves(t);
      lastWaveTime = t;
    }

    wavesFrame = requestAnimationFrame(runWaves);
  }

  function startWaves() {

    if (
      wavesFrame !== null ||
      document.hidden ||
      reducedMotion.matches ||
      document.body.classList.contains("gallery-open")
    ) {
      return;
    }

    lastWaveTime = 0;
    wavesFrame = requestAnimationFrame(runWaves);
  }

  drawWaves(0);
  startWaves();

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopWaves();
    } else {
      startWaves();
    }
  });

  const motionChanged = () => {
    if (reducedMotion.matches) {
      stopWaves();
      drawWaves(0);
    } else {
      startWaves();
    }
  };

  if (reducedMotion.addEventListener) {
    reducedMotion.addEventListener(
      "change",
      motionChanged
    );
  } else {
    reducedMotion.addListener(motionChanged);
  }

  /* ===================================
     3. BACKGROUND MUSIC PLAYER
  =================================== */

  const music = document.getElementById(
    "background-music"
  );

  const musicToggle = document.getElementById(
    "music-toggle"
  );

  const musicTooltip = document.querySelector(
    ".music-tooltip"
  );

  let wantsMusic = false;
  let fadeId = null;

  music.pause();
  music.volume = 0;

  function musicUI(on) {

    musicToggle.classList.toggle("is-playing", on);

    musicToggle.setAttribute(
      "aria-pressed",
      String(on)
    );

    const label = on
      ? "Pause background music"
      : "Play background music";

    musicToggle.setAttribute("aria-label", label);
    musicToggle.title = label;

    musicTooltip.textContent = on
      ? "MUSIC ON"
      : "MUSIC OFF";
  }

  function cancelFade() {
    if (fadeId !== null) {
      cancelAnimationFrame(fadeId);
    }

    fadeId = null;
  }

  function fadeTo(target, done) {

    cancelFade();

    const from = music.volume;
    const start = performance.now();
    const duration = 600;

    function tick(t) {

      const p = Math.min(
        1,
        (t - start) / duration
      );

      const eased = p < .5
        ? 2 * p * p
        : 1 - Math.pow(-2 * p + 2, 2) / 2;

      music.volume = Math.max(
        0,
        Math.min(1, from + (target - from) * eased)
      );

      if (p < 1) {
        fadeId = requestAnimationFrame(tick);
      } else {
        fadeId = null;

        if (done) {
          done();
        }
      }
    }

    fadeId = requestAnimationFrame(tick);
  }

  musicToggle.addEventListener("click", async () => {

    wantsMusic = !wantsMusic;

    if (!wantsMusic) {

      musicUI(false);

      if (!music.paused) {
        fadeTo(0, () => {
          if (!wantsMusic) {
            music.pause();
          }
        });
      }

      return;
    }

    cancelFade();

    try {

      if (music.paused) {
        music.volume = 0;
        await music.play();
      }

      if (!wantsMusic) {
        fadeTo(0, () => {
          if (!wantsMusic) music.pause();
        });
        return;
      }

      musicUI(true);
      fadeTo(.35);

    } catch (error) {

      wantsMusic = false;
      musicUI(false);

      console.warn(
        "Could not play background-music.mp3",
        error
      );
    }
  });

  music.addEventListener("pause", () => {
    wantsMusic = false;
    musicUI(false);
  });

  music.addEventListener("error", () => {
    wantsMusic = false;
    musicUI(false);
    musicTooltip.textContent = "AUDIO NOT FOUND";
  });

  musicUI(false);

  /* ===================================
     4. SCROLL REVEAL ANIMATIONS
  =================================== */

  const reveals = document.querySelectorAll(".reveal");

  if (
    "IntersectionObserver" in window &&
    !reducedMotion.matches
  ) {

    const observer = new IntersectionObserver(
      (entries, obs) => {

        entries.forEach(entry => {

          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            obs.unobserve(entry.target);
          }
        });

      },
      {
        threshold: .12,
        rootMargin: "0px 0px -30px 0px"
      }
    );

    reveals.forEach(el => observer.observe(el));

  } else {
    reveals.forEach(el => el.classList.add("visible"));
  }

  /* ===================================
     5. CREATE TEN GALLERY PHOTOS
  =================================== */

  const galleryStack = document.getElementById(
    "gallery-stack"
  );

  /*
    All images are directly in the repository.

    gallery-1.jpg
    gallery-2.jpg
    ...
    gallery-10.jpg
  */

  for (let i = 1; i <= 10; i++) {

    const n = String(i).padStart(2, "0");

    const card = document.createElement("button");

    card.type = "button";
    card.className = "gallery-stack-card";

    card.dataset.image = `gallery-${i}.jpg`;
    card.dataset.title = `${n} / Untitled`;

    card.setAttribute(
      "aria-label",
      `Enlarge photograph ${i}`
    );

    const img = document.createElement("img");

    img.src = `gallery-${i}.jpg`;
    img.alt = `Gallery photograph ${i}`;
    img.loading = i <= 2 ? "eager" : "lazy";
    img.decoding = "async";

    const fallback = document.createElement("span");

    fallback.className = "photo-fallback";
    fallback.textContent = `PHOTOGRAPH / ${n}`;

    const count = document.createElement("span");

    count.className = "gallery-card-number";
    count.textContent = `${n} / 10`;

    card.append(img, fallback, count);

    galleryStack.appendChild(card);
  }

  /* ===================================
     6. PHOTO LOADING
  =================================== */

  const photos = [
    ...document.querySelectorAll(
      ".featured-photo, .gallery-stack-card"
    )
  ];

  photos.forEach(button => {

    const img = button.querySelector("img");

    const missing = () => {
      button.classList.add("image-missing");
      button.disabled = true;
    };

    const loaded = () => {
      button.classList.remove("image-missing");
      button.disabled = false;
    };

    img.addEventListener("error", missing);
    img.addEventListener("load", loaded);

    if (img.complete) {
      img.naturalWidth ? loaded() : missing();
    }
  });

  const portrait = document.querySelector(
    ".portrait-image"
  );

  portrait.addEventListener("error", () => {
    portrait.style.background = "#eeeeee";
  });

  /* ===================================
     7. PHOTOGRAPH POP-UP / LIGHTBOX
  =================================== */

  const lightbox = document.getElementById(
    "lightbox"
  );

  const lightboxImg = document.getElementById(
    "lightbox-image"
  );

  const lightboxTitle = document.getElementById(
    "lightbox-title"
  );

  const lightboxDescription = document.getElementById(
    "lightbox-description"
  );

  const lightboxClose = document.querySelector(
    ".lightbox-close"
  );

  let focusBeforePhoto = null;
  let lightboxTimer = null;

  /*
    Descriptions are blank.
    Add them here whenever required.
  */

  const photoDescriptions = Object.fromEntries(
    [
      ...Array.from(
        { length: 3 },
        (_, i) => `featured-${i + 1}.jpg`
      ),
      ...Array.from(
        { length: 10 },
        (_, i) => `gallery-${i + 1}.jpg`
      )
    ].map(filename => [filename, ""])
  );

  function openPhoto(button) {

    if (button.disabled) return;

    clearTimeout(lightboxTimer);

    focusBeforePhoto = document.activeElement;

    const filename = button.dataset.image;

    lightboxImg.src = filename;

    lightboxImg.alt =
      button.dataset.title || "Photograph";

    lightboxTitle.textContent =
      button.dataset.title || "Photograph";

    lightboxDescription.textContent =
      photoDescriptions[filename] || "";

    lightbox.inert = false;
    lightbox.classList.add("active");

    lightbox.setAttribute(
      "aria-hidden",
      "false"
    );

    document.body.style.overflow = "hidden";

    lightboxClose.focus({
      preventScroll: true
    });
  }

  function closePhoto() {

    if (!lightbox.classList.contains("active")) {
      return;
    }

    lightbox.classList.remove("active");

    lightbox.setAttribute(
      "aria-hidden",
      "true"
    );

    lightbox.inert = true;

    document.body.style.overflow = "";

    if (focusBeforePhoto?.isConnected) {
      focusBeforePhoto.focus({
        preventScroll: true
      });
    }

    lightboxTimer = setTimeout(() => {

      if (!lightbox.classList.contains("active")) {
        lightboxImg.removeAttribute("src");
      }

    }, 400);
  }

  photos.forEach(button => {
    button.addEventListener("click", () => {
      openPhoto(button);
    });
  });

  lightboxClose.addEventListener(
    "click",
    closePhoto
  );

  lightbox.addEventListener("click", event => {
    if (event.target === lightbox) {
      closePhoto();
    }
  });

  /* ===================================
     8. IMMERSIVE VERTICAL GALLERY
  =================================== */

  const gallery = document.getElementById("gallery");

  const galleryScroll = document.getElementById(
    "gallery-scroll"
  );

  const cards = [
    ...galleryStack.querySelectorAll(
      ".gallery-stack-card"
    )
  ];

  const galleryCurrent = document.getElementById(
    "gallery-current"
  );

  const prev = document.getElementById(
    "gallery-prev"
  );

  const next = document.getElementById(
    "gallery-next"
  );

  const exit = document.querySelector(
    ".gallery-exit"
  );

  let focusBeforeGallery = null;
  let current = 0;

  let centers = [];
  let viewportHeight = 0;

  let scrollFrame = null;
  let travelFrame = null;
  let resizeFrame = null;

  const galleryOpen = () =>
    gallery.classList.contains("is-open");

  function cancelTravel() {

    if (travelFrame !== null) {
      cancelAnimationFrame(travelFrame);
    }

    travelFrame = null;

    galleryScroll.classList.remove(
      "is-animating"
    );
  }

  /* Measure the photo positions */

  function measureGallery() {

    viewportHeight = galleryScroll.clientHeight;

    const pad = Math.max(
      0,
      (viewportHeight - cards[0].offsetHeight) / 2
    );

    galleryStack.style.paddingTop = `${pad}px`;
    galleryStack.style.paddingBottom = `${pad}px`;

    centers = cards.map(card =>
      card.offsetTop + card.offsetHeight / 2
    );
  }

  /* Animate the focused photo and neighbours */

  function updateGalleryDepth() {

    if (!galleryOpen() || !centers.length) {
      return;
    }

    const middle =
      galleryScroll.scrollTop + viewportHeight / 2;

    const stride = centers.length > 1
      ? centers[1] - centers[0]
      : 1;

    let nearest = 0;
    let minimum = Infinity;

    cards.forEach((card, i) => {

      const distance = Math.abs(
        centers[i] - middle
      );

      if (distance < minimum) {
        minimum = distance;
        nearest = i;
      }

      const near = distance < stride * 1.65;

      card.classList.toggle("is-near", near);

      card.classList.toggle(
        "is-active",
        distance < stride * .48
      );

      if (near) {

        card.style.setProperty(
          "--depth",
          Math.min(distance / stride, 1).toFixed(3)
        );

      } else {
        card.style.removeProperty("--depth");
      }
    });

    current = nearest;

    galleryCurrent.textContent =
      String(current + 1).padStart(2, "0");

    prev.disabled = current === 0;

    next.disabled =
      current === cards.length - 1;
  }

  /* Smooth movement between photographs */

  function goToPhoto(index, smooth = true) {

    if (!galleryOpen()) return;

    index = Math.max(
      0,
      Math.min(index, cards.length - 1)
    );

    cancelTravel();

    const target = Math.max(
      0,
      centers[index] - viewportHeight / 2
    );

    const origin = galleryScroll.scrollTop;

    const distance = target - origin;

    if (
      !smooth ||
      reducedMotion.matches ||
      Math.abs(distance) < 1
    ) {

      galleryScroll.scrollTop = target;
      updateGalleryDepth();
      return;
    }

    galleryScroll.classList.add(
      "is-animating"
    );

    const duration = Math.min(
      650,
      Math.max(340, 360 + Math.abs(distance) * .10)
    );

    const started = performance.now();

    function tick(t) {

      const p = Math.min(
        1,
        (t - started) / duration
      );

      const eased =
        (1 - Math.cos(Math.PI * p)) / 2;

      galleryScroll.scrollTop =
        origin + distance * eased;

      if (p < 1) {

        travelFrame = requestAnimationFrame(tick);

      } else {

        travelFrame = null;

        galleryScroll.classList.remove(
          "is-animating"
        );

        updateGalleryDepth();
      }
    }

    travelFrame = requestAnimationFrame(tick);
  }

  /* OPEN GALLERY */

  function openGallery() {

    if (galleryOpen()) return;

    focusBeforeGallery = document.activeElement;

    gallery.inert = false;

    gallery.setAttribute(
      "aria-hidden",
      "false"
    );

    gallery.classList.add("is-open");

    document.body.classList.add(
      "gallery-open"
    );

    stopWaves();

    exit.focus({
      preventScroll: true
    });

    requestAnimationFrame(() => {

      measureGallery();
      goToPhoto(0, false);
      updateGalleryDepth();

    });
  }

  /* CLOSE GALLERY */

  function closeGallery() {

    if (!galleryOpen()) return;

    cancelTravel();

    if (scrollFrame !== null) {
      cancelAnimationFrame(scrollFrame);
    }

    scrollFrame = null;

    gallery.classList.remove("is-open");

    gallery.setAttribute(
      "aria-hidden",
      "true"
    );

    gallery.inert = true;

    document.body.classList.remove(
      "gallery-open"
    );

    startWaves();

    if (focusBeforeGallery?.isConnected) {
      focusBeforeGallery.focus({
        preventScroll: true
      });
    }
  }

  /* GALLERY BUTTON */

  document.querySelectorAll(
    "[data-open-gallery]"
  ).forEach(button => {

    button.addEventListener(
      "click",
      openGallery
    );
  });

  exit.addEventListener("click", closeGallery);

  prev.addEventListener("click", () => {
    goToPhoto(current - 1);
  });

  next.addEventListener("click", () => {
    goToPhoto(current + 1);
  });

  /* Allow manual scrolling to interrupt animation */

  ["wheel", "touchstart", "pointerdown"].forEach(
    type => {

      galleryScroll.addEventListener(
        type,
        cancelTravel,
        { passive: true }
      );
    }
  );

  galleryScroll.addEventListener("scroll", () => {

    if (scrollFrame !== null) return;

    scrollFrame = requestAnimationFrame(() => {

      scrollFrame = null;
      updateGalleryDepth();

    });

  }, { passive: true });

  /* Maintain correct image position on resize */

  window.addEventListener("resize", () => {

    if (
      !galleryOpen() ||
      resizeFrame !== null
    ) {
      return;
    }

    resizeFrame = requestAnimationFrame(() => {

      resizeFrame = null;

      cancelTravel();
      measureGallery();
      goToPhoto(current, false);

    });
  });

  /* ===================================
     9. MAIN NAVIGATION
  =================================== */

  document.querySelectorAll(
    'a[href^="#"]'
  ).forEach(link => {

    link.addEventListener("click", event => {

      const targetId =
        link.getAttribute("href");

      const target =
        document.querySelector(targetId);

      if (!target) return;

      event.preventDefault();

      /* Gallery opens in a separate view */
      if (targetId === "#gallery") {
        openGallery();
        return;
      }

      /* Other sections scroll normally */
      target.scrollIntoView({
        behavior: reducedMotion.matches
          ? "auto"
          : "smooth",
        block: "start"
      });
    });
  });

  /* ===================================
     10. KEYBOARD CONTROLS
  =================================== */

  document.addEventListener("keydown", event => {

    /* Full-size photograph is open */
    if (lightbox.classList.contains("active")) {

      if (event.key === "Escape") {
        event.preventDefault();
        closePhoto();
      }

      if (event.key === "Tab") {
        event.preventDefault();
        lightboxClose.focus();
      }

      return;
    }

    if (!galleryOpen()) return;

    if (event.key === "Escape") {

      event.preventDefault();
      closeGallery();

    } else if (
      event.key === "ArrowDown" ||
      event.key === "PageDown"
    ) {

      event.preventDefault();
      goToPhoto(current + 1);

    } else if (
      event.key === "ArrowUp" ||
      event.key === "PageUp"
    ) {

      event.preventDefault();
      goToPhoto(current - 1);

    } else if (event.key === "Home") {

      event.preventDefault();
      goToPhoto(0);

    } else if (event.key === "End") {

      event.preventDefault();
      goToPhoto(cards.length - 1);

    } else if (event.key === "Tab") {

      const focusable = [
        ...gallery.querySelectorAll(
          'button:not(:disabled), [tabindex="0"]'
        )
      ];

      const first = focusable[0];

      const last =
        focusable[focusable.length - 1];

      if (
        event.shiftKey &&
        document.activeElement === first
      ) {

        event.preventDefault();
        last.focus();

      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {

        event.preventDefault();
        first.focus();
      }
    }
  });

  /* Hamburger remains a placeholder */

  console.log(
    "Frankie Portfolio and immersive gallery loaded."
  );

});
