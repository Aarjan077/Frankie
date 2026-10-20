
/* ==========================================
   FRANKIE PHOTOGRAPHY PORTFOLIO
   ANIMATED MONOCHROME EDITION
========================================== */

document.addEventListener("DOMContentLoaded", () => {

  /* ========================================
     1. ANIMATED FLOWING CONTOUR WAVES
  ======================================== */

  const svgNamespace = "http://www.w3.org/2000/svg";

  const waveGroupOne =
    document.getElementById("wave-group-one");

  const waveGroupTwo =
    document.getElementById("wave-group-two");

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  );

  const wavePaths = [];

  let waveAnimationFrame = null;
  let lastWaveFrame = 0;

  /*
    Each wave is a real SVG path.

    JavaScript changes the path coordinates
    smoothly over time to create the effect
    of constantly flowing contour lines.
  */

  function createWaveGroup(group, count, field) {

    if (!group) return;

    for (let i = 0; i < count; i++) {

      const path = document.createElementNS(
        svgNamespace,
        "path"
      );

      path.setAttribute("class", "wave-line");

      group.appendChild(path);

      wavePaths.push({
        element: path,
        index: i,
        total: count,
        field: field
      });
    }
  }

  // Main flowing wave ribbon
  createWaveGroup(waveGroupOne, 18, 0);

  // Secondary softer wave ribbon
  createWaveGroup(waveGroupTwo, 12, 1);

  function drawWaves(time) {

    const seconds = time / 1000;

    wavePaths.forEach((wave) => {

      const {
        element,
        index,
        total,
        field
      } = wave;

      const relativeIndex =
        index - (total - 1) / 2;

      // Different heights for the two ribbons
      const baseHeight = field === 0
        ? 635
        : 325;

      const lineSpacing = field === 0
        ? 9
        : 11;

      const amplitude = field === 0
        ? 68
        : 58;

      const baseY =
        baseHeight + relativeIndex * lineSpacing;

      let pathData = "";

      // Draw across the full SVG width.
      for (let x = -100; x <= 1540; x += 36) {

        /*
          Layered sine waves produce organic
          movement rather than rigid motion.
        */

        const primaryWave = Math.sin(
          x / 205
          - seconds * 0.23
          + index * 0.045
          + field
        ) * amplitude;

        const secondaryWave = Math.sin(
          x / 380
          + seconds * 0.16
          + field * 1.8
        ) * 21;

        const fineWave = Math.sin(
          x / 120
          + seconds * 0.12
          + index * 0.025
        ) * 8;

        const y =
          baseY
          + primaryWave
          + secondaryWave
          + fineWave;

        pathData +=
          (x === -100 ? "M" : "L") +
          x + " " + y.toFixed(2) + " ";
      }

      element.setAttribute("d", pathData);

    });
  }

  /*
    Limit the animation to approximately
    30 frames per second on desktop, and
    slightly fewer frames on small screens.
  */

  function animateWaves(time) {

    const frameInterval =
      window.innerWidth < 700 ? 42 : 33;

    if (time - lastWaveFrame >= frameInterval) {

      drawWaves(time);
      lastWaveFrame = time;
    }

    waveAnimationFrame =
      requestAnimationFrame(animateWaves);
  }

  function stopWaveAnimation() {

    if (waveAnimationFrame !== null) {

      cancelAnimationFrame(waveAnimationFrame);

      waveAnimationFrame = null;
    }
  }

  function startWaveAnimation() {

    if (
      reducedMotion.matches ||
      document.hidden ||
      waveAnimationFrame !== null
    ) {
      return;
    }

    lastWaveFrame = 0;

    waveAnimationFrame =
      requestAnimationFrame(animateWaves);
  }

  // Draw the first frame immediately.
  drawWaves(0);

  // Start continuous movement.
  startWaveAnimation();

  // Pause animations when the tab is hidden.
  document.addEventListener(
    "visibilitychange",
    () => {

      if (document.hidden) {
        stopWaveAnimation();
      } else {
        startWaveAnimation();
      }

    }
  );

  // Respect accessibility motion preferences.
  function handleMotionPreference() {

    if (reducedMotion.matches) {

      stopWaveAnimation();
      drawWaves(0);

    } else {

      startWaveAnimation();
    }
  }

  if (reducedMotion.addEventListener) {

    reducedMotion.addEventListener(
      "change",
      handleMotionPreference
    );

  } else if (reducedMotion.addListener) {

    reducedMotion.addListener(
      handleMotionPreference
    );
  }

  /* ========================================
     2. BACKGROUND MUSIC PLAYER
  ======================================== */

  const music =
    document.getElementById("background-music");

  const musicButton =
    document.getElementById("music-toggle");

  const musicTooltip =
    document.querySelector(".music-tooltip");

  const MUSIC_VOLUME = 0.35;
  const MUSIC_FADE_DURATION = 600;

  let wantsMusic = false;
  let musicFadeFrame = null;

  // Website always opens with the music off.
  music.pause();
  music.volume = 0;

  function updateMusicButton(isPlaying) {

    musicButton.classList.toggle(
      "is-playing",
      isPlaying
    );

    musicButton.setAttribute(
      "aria-pressed",
      String(isPlaying)
    );

    const label = isPlaying
      ? "Pause background music"
      : "Play background music";

    musicButton.setAttribute(
      "aria-label",
      label
    );

    musicButton.title = label;

    musicTooltip.textContent = isPlaying
      ? "MUSIC ON"
      : "MUSIC OFF";
  }

  updateMusicButton(false);

  function cancelMusicFade() {

    if (musicFadeFrame !== null) {

      cancelAnimationFrame(musicFadeFrame);

      musicFadeFrame = null;
    }
  }

  function fadeMusic(targetVolume, onComplete) {

    cancelMusicFade();

    const startingVolume = music.volume;

    const difference =
      targetVolume - startingVolume;

    const startTime = performance.now();

    function animateVolume(currentTime) {

      const elapsed =
        currentTime - startTime;

      const progress = Math.min(
        elapsed / MUSIC_FADE_DURATION,
        1
      );

      // Smooth ease-in-out transition.
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const nextVolume =
        startingVolume + difference * eased;

      music.volume = Math.max(
        0,
        Math.min(1, nextVolume)
      );

      if (progress < 1) {

        musicFadeFrame = requestAnimationFrame(
          animateVolume
        );

      } else {

        musicFadeFrame = null;

        if (typeof onComplete === "function") {
          onComplete();
        }
      }
    }

    musicFadeFrame =
      requestAnimationFrame(animateVolume);
  }

  // Turn the music on.
  async function playMusic() {

    cancelMusicFade();

    try {

      if (music.paused) {

        music.volume = 0;

        // Called directly from the click action.
        await music.play();
      }

      // Handle clicks made during loading.
      if (!wantsMusic) {

        fadeMusic(0, () => {
          if (!wantsMusic) music.pause();
        });

        return;
      }

      updateMusicButton(true);
      fadeMusic(MUSIC_VOLUME);

    } catch (error) {

      console.error(
        "Unable to play the music:",
        error
      );

      wantsMusic = false;
      updateMusicButton(false);
    }
  }

  // Turn the music off.
  function pauseMusic() {

    updateMusicButton(false);

    if (music.paused) {
      cancelMusicFade();
      music.volume = 0;
      return;
    }

    fadeMusic(0, () => {

      if (!wantsMusic) {
        music.pause();
      }
    });
  }

  musicButton.addEventListener("click", () => {

    wantsMusic = !wantsMusic;

    if (wantsMusic) {
      playMusic();
    } else {
      pauseMusic();
    }
  });

  music.addEventListener("pause", () => {

    if (wantsMusic) {
      wantsMusic = false;
    }

    updateMusicButton(false);
  });

  music.addEventListener("error", () => {

    cancelMusicFade();

    wantsMusic = false;

    updateMusicButton(false);

    musicTooltip.textContent = "AUDIO NOT FOUND";

    console.error(
      "Check that background-music.mp3 " +
      "exists in the GitHub repository."
    );
  });

  /* ========================================
     3. SCROLL REVEAL ANIMATIONS
  ======================================== */

  const revealElements =
    document.querySelectorAll(".reveal");

  if (
    "IntersectionObserver" in window &&
    !reducedMotion.matches
  ) {

    const revealObserver = new IntersectionObserver(
      (entries, observer) => {

        entries.forEach((entry) => {

          if (entry.isIntersecting) {

            entry.target.classList.add("visible");

            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -30px 0px"
      }
    );

    revealElements.forEach((element) => {
      revealObserver.observe(element);
    });

  } else {

    revealElements.forEach((element) => {
      element.classList.add("visible");
    });
  }

  /* ========================================
     4. PHOTO LOADING AND PLACEHOLDERS
  ======================================== */

  const photoButtons =
    document.querySelectorAll(
      ".featured-photo, .gallery-item"
    );

  photoButtons.forEach((button) => {

    const image = button.querySelector("img");

    if (!image) return;

    function markMissing() {

      button.classList.add("image-missing");

      button.disabled = true;

      button.setAttribute(
        "aria-label",
        "Photograph not yet uploaded"
      );
    }

    function markLoaded() {

      button.classList.remove("image-missing");

      button.disabled = false;
    }

    image.addEventListener("error", markMissing);
    image.addEventListener("load", markLoaded);

    if (image.complete && image.currentSrc) {

      if (image.naturalWidth === 0) {
        markMissing();
      } else {
        markLoaded();
      }
    }
  });

  /* ========================================
     5. PHOTOGRAPH LIGHTBOX
  ======================================== */

  const lightbox =
    document.getElementById("lightbox");

  const lightboxImage =
    document.getElementById("lightbox-image");

  const lightboxTitle =
    document.getElementById("lightbox-title");

  const lightboxDescription =
    document.getElementById("lightbox-description");

  const closeButton =
    document.querySelector(".lightbox-close");

  let previousFocus = null;

  // Descriptions intentionally left blank.
  const photoDescriptions = {
    "featured-1.jpg": "",
    "featured-2.jpg": "",
    "featured-3.jpg": "",
    "gallery-1.jpg": "",
    "gallery-2.jpg": "",
    "gallery-3.jpg": "",
    "gallery-4.jpg": "",
    "gallery-5.jpg": ""
  };

  function openLightbox(photo) {

    if (
      photo.classList.contains("image-missing")
    ) {
      return;
    }

    const imagePath = photo.dataset.image;

    const imageTitle =
      photo.dataset.title || "Photograph";

    const filename = imagePath.split("/").pop();

    previousFocus = document.activeElement;

    lightboxImage.src = imagePath;
    lightboxImage.alt = imageTitle;

    lightboxTitle.textContent = imageTitle;

    lightboxDescription.textContent =
      photoDescriptions[filename] || "";

    lightbox.classList.add("active");

    lightbox.setAttribute(
      "aria-hidden",
      "false"
    );

    document.body.style.overflow = "hidden";

    closeButton.focus();
  }

  function closeLightbox() {

    if (!lightbox.classList.contains("active")) {
      return;
    }

    lightbox.classList.remove("active");

    lightbox.setAttribute(
      "aria-hidden",
      "true"
    );

    document.body.style.overflow = "";

    if (previousFocus) {
      previousFocus.focus();
    }

    setTimeout(() => {

      if (!lightbox.classList.contains("active")) {
        lightboxImage.removeAttribute("src");
      }

    }, 400);
  }

  photoButtons.forEach((photo) => {

    photo.addEventListener("click", () => {
      openLightbox(photo);
    });
  });

  closeButton.addEventListener(
    "click",
    closeLightbox
  );

  // Close by clicking the dark background.
  lightbox.addEventListener("click", (event) => {

    if (event.target === lightbox) {
      closeLightbox();
    }
  });

  // Close with Escape.
  document.addEventListener("keydown", (event) => {

    if (!lightbox.classList.contains("active")) {
      return;
    }

    if (event.key === "Escape") {
      closeLightbox();
    }

    if (event.key === "Tab") {

      event.preventDefault();
      closeButton.focus();
    }
  });

  /* ========================================
     6. SMOOTH NAVIGATION
  ======================================== */

  const navigationLinks =
    document.querySelectorAll('a[href^="#"]');

  navigationLinks.forEach((link) => {

    link.addEventListener("click", (event) => {

      const targetId =
        link.getAttribute("href");

      const target =
        document.querySelector(targetId);

      if (!target) return;

      event.preventDefault();

      target.scrollIntoView({
        behavior: reducedMotion.matches
          ? "auto"
          : "smooth",
        block: "start"
      });
    });
  });

  /* ========================================
     7. GALLERY HOVER
  ======================================== */

  const galleryItems =
    document.querySelectorAll(".gallery-item");

  galleryItems.forEach((item) => {

    item.addEventListener("mouseenter", () => {
      item.style.zIndex = "2";
    });

    item.addEventListener("mouseleave", () => {
      item.style.zIndex = "";
    });
  });

  /* ========================================
     8. PORTRAIT IMAGE FALLBACK
  ======================================== */

  const portrait =
    document.querySelector(".portrait-image");

  if (portrait) {

    portrait.addEventListener("error", () => {

      portrait.style.background = "#eeeeee";
    });
  }

  /* ========================================
     9. HAMBURGER PLACEHOLDER
  ======================================== */

  // The hamburger icon remains available
  // for you to add functionality later.

  console.log(
    "Frankie Photography Portfolio " +
    "with animated background loaded."
  );

});
