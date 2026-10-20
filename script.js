
/* =========================================
   FRANKIE PHOTOGRAPHY PORTFOLIO
   JAVASCRIPT INTERACTIONS
========================================= */

document.addEventListener("DOMContentLoaded", () => {

  // 1. SCROLL REVEAL

  const revealElements =
    document.querySelectorAll(".reveal");

  if ("IntersectionObserver" in window) {

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

  // 2. IMAGE POPUP

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

  const clickablePhotos =
    document.querySelectorAll(
      ".featured-photo, .gallery-item"
    );

  let previousFocus = null;

  // Photo descriptions - currently blank

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

  clickablePhotos.forEach((photo) => {

    photo.addEventListener("click", () => {
      openLightbox(photo);
    });

  });

  closeButton.addEventListener(
    "click",
    closeLightbox
  );

  // Close by clicking outside the photo

  lightbox.addEventListener("click", (event) => {

    if (event.target === lightbox) {
      closeLightbox();
    }

  });

  // Escape key and keyboard focus

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

  // 3. SMOOTH NAVIGATION

  const navigationLinks =
    document.querySelectorAll('a[href^="#"]');

  navigationLinks.forEach((link) => {

    link.addEventListener("click", (event) => {

      const targetId =
        link.getAttribute("href");

      const target =
        document.querySelector(targetId);

      if (target) {

        event.preventDefault();

        const reducedMotion =
          window.matchMedia(
            "(prefers-reduced-motion: reduce)"
          ).matches;

        target.scrollIntoView({
          behavior: reducedMotion ? "instant" : "smooth",
          block: "start"
        });

      }

    });

  });

  // 4. GALLERY HOVER EFFECT

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

  // 5. IMAGE ERROR FALLBACK

  const allImages =
    document.querySelectorAll("img");

  allImages.forEach((image) => {

    image.addEventListener("error", () => {

      if (image.id === "lightbox-image") {
        return;
      }

      image.style.background = "#eeeeee";
      image.style.minHeight = "150px";

    });

  });

  // 6. MUSIC PLACEHOLDER

  const musicButton =
    document.querySelector(".music-button");

  if (musicButton) {

    musicButton.addEventListener("click", () => {
      // Music functionality will be added later.
    });

  }

  // 7. HAMBURGER PLACEHOLDER

  const menuButton =
    document.querySelector(".menu-button");

  if (menuButton) {

    menuButton.addEventListener("click", () => {
      // Navigation menu will be added later.
    });

  }

  console.log("Frankie Photography Portfolio loaded.");

});
