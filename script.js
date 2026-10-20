
/* ========================================
   FRANKIE PHOTOGRAPHY PORTFOLIO
   JAVASCRIPT
======================================== */

document.addEventListener("DOMContentLoaded", () => {

  // =====================================
  // 1. SCROLL REVEAL
  // =====================================

  const revealElements =
    document.querySelectorAll(".reveal");

  if ("IntersectionObserver" in window) {

    const observer = new IntersectionObserver(
      (entries, observerInstance) => {

        entries.forEach((entry) => {

          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observerInstance.unobserve(entry.target);
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
  // 2. IMAGE LOADING AND PLACEHOLDERS
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
      button.setAttribute("aria-label", "Photo not yet uploaded");
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
  // 3. IMAGE POPUP / LIGHTBOX
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

  // Add descriptions here in the future.
  // They are intentionally blank for now.

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

  // OPEN ON CLICK

  photoButtons.forEach((photo) => {

    photo.addEventListener("click", () => {
      openLightbox(photo);
    });

  });

  // CLOSE BUTTON

  closeButton.addEventListener(
    "click",
    closeLightbox
  );

  // CLOSE WHEN CLICKING BACKGROUND

  lightbox.addEventListener("click", (event) => {

    if (event.target === lightbox) {
      closeLightbox();
    }

  });

  // CLOSE USING ESCAPE KEY

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
  // 4. SMOOTH TOP NAVIGATION
  // =====================================

  const navigationLinks =
    document.querySelectorAll('a[href^="#"]');

  navigationLinks.forEach((link) => {

    link.addEventListener("click", (event) => {

      const targetId = link.getAttribute("href");

      const target = document.querySelector(targetId);

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
  // 5. GALLERY HOVER
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
  // 6. MAIN PORTRAIT FALLBACK
  // =====================================

  const portrait =
    document.querySelector(".portrait-image");

  if (portrait) {

    portrait.addEventListener("error", () => {
      portrait.style.background = "#eeeeee";
    });

  }

  // =====================================
  // 7. MUSIC PLACEHOLDER
  // =====================================

  const musicButton =
    document.querySelector(".music-button");

  if (musicButton) {

    musicButton.addEventListener("click", () => {
      // Future music functionality.
    });

  }

  // =====================================
  // 8. HAMBURGER PLACEHOLDER
  // =====================================

  const menuButton =
    document.querySelector(".menu-button");

  if (menuButton) {

    menuButton.addEventListener("click", () => {
      // Future menu functionality.
    });

  }

  console.log(
    "Frankie Photography Portfolio loaded successfully."
  );

});
