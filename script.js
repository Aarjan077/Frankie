
/* ========================================
   FRANKIE PHOTOGRAPHY PORTFOLIO
   JAVASCRIPT
======================================== */

document.addEventListener("DOMContentLoaded", () => {

  // =====================================
  // 1. BACKGROUND MUSIC PLAYER
  // =====================================

  const music = document.getElementById(
    "background-music"
  );

  const musicButton = document.getElementById(
    "music-toggle"
  );

  const musicTooltip = document.querySelector(
    ".music-tooltip"
  );

  // Default volume: 35%
  const MAX_VOLUME = 0.35;

  // Duration of volume transitions
  const FADE_DURATION = 600;

  let fadeFrame = null;
  let isStarting = false;

  // Start paused and silent
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

    musicButton.setAttribute(
      "aria-label",
      isPlaying
        ? "Pause background music"
        : "Play background music"
    );

    musicButton.title = isPlaying
      ? "Pause background music"
      : "Play background music";

    musicTooltip.textContent = isPlaying
      ? "MUSIC ON"
      : "MUSIC OFF";
  }

  // Set initial button state
  updateMusicButton(false);

  // Smoothly change music volume
  function fadeVolume(targetVolume, onComplete) {

    if (fadeFrame !== null) {
      cancelAnimationFrame(fadeFrame);
      fadeFrame = null;
    }

    const startVolume = music.volume;
    const difference = targetVolume - startVolume;
    const startTime = performance.now();

    function animateVolume(currentTime) {

      const elapsed = currentTime - startTime;

      const progress = Math.min(
        elapsed / FADE_DURATION,
        1
      );

      // Smooth ease-in-out
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const newVolume =
        startVolume + difference * eased;

      music.volume = Math.max(
        0,
        Math.min(1, newVolume)
      );

      if (progress < 1) {

        fadeFrame = requestAnimationFrame(
          animateVolume
        );

      } else {

        fadeFrame = null;

        if (typeof onComplete === "function") {
          onComplete();
        }

      }
    }

    fadeFrame = requestAnimationFrame(
      animateVolume
    );
  }

  // PLAY MUSIC
  async function playMusic() {

    if (isStarting || !music.paused) return;

    isStarting = true;

    try {

      // A new play starts at zero volume.
      // Resuming after a fade-out also starts quietly.
      music.volume = 0;

      await music.play();

      updateMusicButton(true);

      fadeVolume(MAX_VOLUME);

    } catch (error) {

      console.error(
        "Could not play background music:",
        error
      );

      updateMusicButton(false);

    } finally {

      isStarting = false;

    }
  }

  // PAUSE MUSIC
  function pauseMusic() {

    if (music.paused) return;

    updateMusicButton(false);

    fadeVolume(0, () => {
      music.pause();
    });
  }

  // MUSIC BUTTON CLICK
  musicButton.addEventListener("click", () => {

    if (music.paused) {
      playMusic();
    } else {
      // If fading out, another click can restart
      // the music instead of waiting.
      if (musicButton.classList.contains("is-playing")) {
        pauseMusic();
      } else {
        updateMusicButton(true);
        fadeVolume(MAX_VOLUME);
      }
    }

  });

  // Handle unexpected playback ending
  music.addEventListener("pause", () => {
    updateMusicButton(false);
  });

  music.addEventListener("error", () => {

    console.error(
      "Music file could not be loaded. " +
      "Check background-music.mp3 in GitHub."
    );

    updateMusicButton(false);

  });

  // =====================================
  // 2. SCROLL REVEAL
  // =====================================

  const revealElements =
    document.querySelectorAll(".reveal");

  if ("IntersectionObserver" in window) {

    const observer = new IntersectionObserver(
      (entries, observerInstance) => {

        entries.forEach((entry) => {

          if (entry.isIntersecting) {

            entry.target.classList.add("visible");

            observerInstance.unobserve(
              entry.target
            );

          }

        });

      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -30px 0px"
      }
    );

    revealElements.forEach((element) => {
      observer.observe(element);
    });

  } else {

    revealElements.forEach((element) => {
      element.classList.add("visible");
    });

  }

  // =====================================
  // 3. PHOTO LOADING
  // =====================================

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
        "Photo not yet uploaded"
      );
    }

    if (image.complete && image.naturalWidth === 0) {
      markMissing();
    }

    image.addEventListener("error", markMissing);

    image.addEventListener("load", () => {

      button.classList.remove("image-missing");

      button.disabled = false;

    });

  });

  // =====================================
  // 4. PHOTO LIGHTBOX
  // =====================================

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

  // Descriptions intentionally left blank
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

    if (photo.classList.contains("image-missing")) {
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

  lightbox.addEventListener("click", (event) => {

    if (event.target === lightbox) {
      closeLightbox();
    }

  });

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

  // =====================================
  // 5. SMOOTH NAVIGATION
  // =====================================

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

      const reducedMotion =
        window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches;

      target.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start"
      });

    });

  });

  // =====================================
  // 6. GALLERY HOVER
  // =====================================

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

  // =====================================
  // 7. PORTRAIT FALLBACK
  // =====================================

  const portrait =
    document.querySelector(".portrait-image");

  if (portrait) {

    portrait.addEventListener("error", () => {
      portrait.style.background = "#eeeeee";
    });

  }

  // =====================================
  // 8. FUTURE HAMBURGER MENU
  // =====================================

  const menuButton =
    document.querySelector(".menu-button");

  if (menuButton) {

    menuButton.addEventListener("click", () => {
      // Menu functionality will be added later.
    });

  }

  console.log(
    "Frankie Photography Portfolio loaded."
  );

});
