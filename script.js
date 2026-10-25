/* FRANKIE — animated background, music, sticky nav, immersive 10-photo gallery */
document.addEventListener("DOMContentLoaded", () => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // THEME SWITCH — starts in LIGHT mode on every new page load.
  // Theme only changes the interface: photos retain their uploaded colours.
  const themeToggle = document.getElementById("theme-toggle");
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  function setTheme(theme) {
    const dark = theme === "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    themeToggle.setAttribute("aria-checked", String(dark));
    themeToggle.setAttribute("aria-label", dark ? "Light mode" : "Dark mode");
    themeToggle.title = dark ? "Switch to light mode" : "Switch to dark mode";
    if (themeMeta) themeMeta.content = dark ? "#121315" : "#ffffff";
  }

  setTheme("light");
  themeToggle.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light"
      ? "dark" : "light";
    setTheme(next);
  });

  // STICKY NAVIGATION — original frosted effect
  const header = document.getElementById("site-header");
  function updateHeader() {
    header.classList.toggle("is-scrolled", window.scrollY > 20);
    document.documentElement.style.setProperty("--header-height", `${Math.ceil(header.getBoundingClientRect().height)}px`);
  }
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });
  if ("ResizeObserver" in window) new ResizeObserver(updateHeader).observe(header);
  else window.addEventListener("resize", updateHeader);

  // SAME GENTLE SVG WAVES — pause when a full-screen gallery is open
  const ns = "http://www.w3.org/2000/svg";
  const wavePaths = [];
  for (const [groupId, count, field] of [["wave-group-one", 12, 0], ["wave-group-two", 7, 1]]) {
    const group = document.getElementById(groupId);
    for (let i = 0; i < count; i++) {
      const path = document.createElementNS(ns, "path");
      path.setAttribute("class", "wave-line");
      group.appendChild(path);
      wavePaths.push({ path, index: i, total: count, field });
    }
  }
  let wavesFrame = null;
  let lastWaveTime = 0;
  function drawWaves(time) {
    const s = time / 1000;
    wavePaths.forEach(({ path, index, total, field }) => {
      const base = (field ? 325 : 635) + (index - (total - 1) / 2) * (field ? 11 : 9);
      let data = "";
      for (let x = -100; x <= 1540; x += 36) {
        const y = base
          + Math.sin(x / 205 - s * .23 + index * .045 + field) * (field ? 58 : 68)
          + Math.sin(x / 380 + s * .16 + field * 1.8) * 21
          + Math.sin(x / 120 + s * .12 + index * .025) * 8;
        data += `${x === -100 ? "M" : "L"}${x} ${y.toFixed(2)} `;
      }
      path.setAttribute("d", data);
    });
  }
  function stopWaves() {
    if (wavesFrame !== null) cancelAnimationFrame(wavesFrame);
    wavesFrame = null;
  }
  function runWaves(t) {
    if (t - lastWaveTime >= (window.innerWidth < 700 ? 66 : 42)) {
      drawWaves(t);
      lastWaveTime = t;
    }
    wavesFrame = requestAnimationFrame(runWaves);
  }
  function startWaves() {
    if (wavesFrame !== null || document.hidden || reducedMotion.matches || document.body.classList.contains("gallery-open")) return;
    lastWaveTime = 0;
    wavesFrame = requestAnimationFrame(runWaves);
  }
  drawWaves(0);
  startWaves();
  document.addEventListener("visibilitychange", () => document.hidden ? stopWaves() : startWaves());
  const motionChanged = () => {
    if (reducedMotion.matches) { stopWaves(); drawWaves(0); }
    else startWaves();
  };
  if (reducedMotion.addEventListener) reducedMotion.addEventListener("change", motionChanged);
  else reducedMotion.addListener(motionChanged);

  // MUSIC — silent by default, click to play or pause, gentle fades
  const music = document.getElementById("background-music");
  const musicToggle = document.getElementById("music-toggle");
  const musicTooltip = document.querySelector(".music-tooltip");
  let wantsMusic = false;
  let fadeId = null;
  music.pause();
  music.volume = 0;
  function musicUI(on) {
    musicToggle.classList.toggle("is-playing", on);
    musicToggle.setAttribute("aria-pressed", String(on));
    const label = on ? "Pause background music" : "Play background music";
    musicToggle.setAttribute("aria-label", label);
    musicToggle.title = label;
    musicTooltip.textContent = on ? "MUSIC ON" : "MUSIC OFF";
  }
  function cancelFade() {
    if (fadeId !== null) cancelAnimationFrame(fadeId);
    fadeId = null;
  }
  function fadeTo(target, done) {
    cancelFade();
    const from = music.volume, start = performance.now(), duration = 600;
    function tick(t) {
      const p = Math.min(1, (t - start) / duration);
      const eased = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      music.volume = Math.max(0, Math.min(1, from + (target - from) * eased));
      if (p < 1) fadeId = requestAnimationFrame(tick);
      else { fadeId = null; if (done) done(); }
    }
    fadeId = requestAnimationFrame(tick);
  }
  musicToggle.addEventListener("click", async () => {
    wantsMusic = !wantsMusic;
    if (!wantsMusic) {
      musicUI(false);
      if (!music.paused) fadeTo(0, () => { if (!wantsMusic) music.pause(); });
      return;
    }
    cancelFade();
    try {
      if (music.paused) { music.volume = 0; await music.play(); }
      if (!wantsMusic) { fadeTo(0, () => { if (!wantsMusic) music.pause(); }); return; }
      musicUI(true);
      fadeTo(.35);
    } catch (error) {
      wantsMusic = false;
      musicUI(false);
      console.warn("Could not play background-music.mp3", error);
    }
  });
  music.addEventListener("pause", () => { wantsMusic = false; musicUI(false); });
  music.addEventListener("error", () => { wantsMusic = false; musicUI(false); musicTooltip.textContent = "AUDIO NOT FOUND"; });
  musicUI(false);

  // ABOUT FRANKIE: show elegant placeholders until these three photos are uploaded.
  document.querySelectorAll(".about-photo-frame").forEach(frame => {
    const image = frame.querySelector("img");
    if (!image) return;
    const markMissing = () => frame.classList.add("is-missing");
    const markLoaded = () => frame.classList.remove("is-missing");
    image.addEventListener("error", markMissing);
    image.addEventListener("load", markLoaded);
    if (image.complete) image.naturalWidth ? markLoaded() : markMissing();
  });

  // EXISTING REVEAL-ON-SCROLL ANIMATION
  const reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reducedMotion.matches) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add("visible"); obs.unobserve(entry.target); }
      });
    }, { threshold: .12, rootMargin: "0px 0px -30px 0px" });
    reveals.forEach(el => observer.observe(el));
  } else reveals.forEach(el => el.classList.add("visible"));

  // GALLERY IMAGE SLOTS: the ONLY new photos needed are gallery-1.jpg to gallery-10.jpg
  const galleryStack = document.getElementById("gallery-stack");
  for (let i = 1; i <= 10; i++) {
    const n = String(i).padStart(2, "0");
    const card = document.createElement("button");
    card.type = "button";
    card.className = "gallery-stack-card";
    card.dataset.image = `gallery-${i}.jpg`;
    card.dataset.title = `${n} / Untitled`;
    card.setAttribute("aria-label", `Enlarge photograph ${i}`);
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

  // A missing image gets a clean placeholder, not a broken image icon.
  const photos = [...document.querySelectorAll(".featured-photo, .gallery-stack-card")];
  photos.forEach(button => {
    const img = button.querySelector("img");
    const missing = () => { button.classList.add("image-missing"); button.disabled = true; };
    const loaded = () => { button.classList.remove("image-missing"); button.disabled = false; };
    img.addEventListener("error", missing);
    img.addEventListener("load", loaded);
    if (img.complete) img.naturalWidth ? loaded() : missing();
  });
  const portrait = document.querySelector(".portrait-image");
  portrait.addEventListener("error", () => { portrait.style.background = "#eeeeee"; });

  // LARGE IMAGE POP-UP. Descriptions deliberately blank.
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-image");
  const lightboxTitle = document.getElementById("lightbox-title");
  const lightboxDescription = document.getElementById("lightbox-description");
  const lightboxClose = document.querySelector(".lightbox-close");
  let focusBeforePhoto = null;
  let lightboxTimer = null;
  const photoDescriptions = Object.fromEntries(
    [...Array.from({length:3},(_,i)=>`featured-${i+1}.jpg`), ...Array.from({length:10},(_,i)=>`gallery-${i+1}.jpg`)]
      .map(filename => [filename, ""])
  );
  function openPhoto(button) {
    if (button.disabled) return;
    clearTimeout(lightboxTimer);
    focusBeforePhoto = document.activeElement;
    const filename = button.dataset.image;
    lightboxImg.src = filename;
    lightboxImg.alt = button.dataset.title || "Photograph";
    lightboxTitle.textContent = button.dataset.title || "Photograph";
    lightboxDescription.textContent = photoDescriptions[filename] || "";
    lightbox.inert = false;
    lightbox.classList.add("active");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    lightboxClose.focus({ preventScroll:true });
  }
  function closePhoto() {
    if (!lightbox.classList.contains("active")) return;
    lightbox.classList.remove("active");
    lightbox.setAttribute("aria-hidden", "true");
    lightbox.inert = true;
    document.body.style.overflow = "";
    if (focusBeforePhoto?.isConnected) focusBeforePhoto.focus({ preventScroll:true });
    lightboxTimer = setTimeout(() => {
      if (!lightbox.classList.contains("active")) lightboxImg.removeAttribute("src");
    }, 400);
  }
  photos.forEach(button => button.addEventListener("click", () => openPhoto(button)));
  lightboxClose.addEventListener("click", closePhoto);
  lightbox.addEventListener("click", event => { if (event.target === lightbox) closePhoto(); });

  // IMMERSIVE VERTICAL GALLERY (from the supplied reference)
  const gallery = document.getElementById("gallery");
  const galleryScroll = document.getElementById("gallery-scroll");
  const cards = [...galleryStack.querySelectorAll(".gallery-stack-card")];
  const galleryCurrent = document.getElementById("gallery-current");
  const prev = document.getElementById("gallery-prev");
  const next = document.getElementById("gallery-next");
  const exit = document.querySelector(".gallery-exit");
  let focusBeforeGallery = null;
  let current = 0;
  let centers = [];
  let viewportHeight = 0;
  let scrollFrame = null;
  let travelFrame = null;
  let resizeFrame = null;
  const galleryOpen = () => gallery.classList.contains("is-open");
  function cancelTravel() {
    if (travelFrame !== null) cancelAnimationFrame(travelFrame);
    travelFrame = null;
    galleryScroll.classList.remove("is-animating");
  }
  function measureGallery() {
    viewportHeight = galleryScroll.clientHeight;
    const pad = Math.max(0, (viewportHeight - cards[0].offsetHeight) / 2);
    galleryStack.style.paddingTop = `${pad}px`;
    galleryStack.style.paddingBottom = `${pad}px`;
    centers = cards.map(card => card.offsetTop + card.offsetHeight / 2);
  }
  function updateGalleryDepth() {
    if (!galleryOpen() || !centers.length) return;
    const middle = galleryScroll.scrollTop + viewportHeight / 2;
    const stride = centers.length > 1 ? centers[1] - centers[0] : 1;
    let nearest = 0, minimum = Infinity;
    cards.forEach((card, i) => {
      const distance = Math.abs(centers[i] - middle);
      if (distance < minimum) { minimum = distance; nearest = i; }
      const near = distance < stride * 1.65;
      card.classList.toggle("is-near", near);
      card.classList.toggle("is-active", distance < stride * .48);
      if (near) card.style.setProperty("--depth", Math.min(distance / stride, 1).toFixed(3));
      else card.style.removeProperty("--depth");
    });
    current = nearest;
    galleryCurrent.textContent = String(current + 1).padStart(2, "0");
    prev.disabled = current === 0;
    next.disabled = current === cards.length - 1;
  }
  function goToPhoto(index, smooth = true) {
    if (!galleryOpen()) return;
    index = Math.max(0, Math.min(index, cards.length - 1));
    cancelTravel();
    const target = Math.max(0, centers[index] - viewportHeight / 2);
    const origin = galleryScroll.scrollTop;
    const distance = target - origin;
    if (!smooth || reducedMotion.matches || Math.abs(distance) < 1) {
      galleryScroll.scrollTop = target;
      updateGalleryDepth();
      return;
    }
    galleryScroll.classList.add("is-animating");
    const duration = Math.min(650, Math.max(340, 360 + Math.abs(distance) * .10));
    const started = performance.now();
    function tick(t) {
      const p = Math.min(1, (t - started) / duration);
      const eased = (1 - Math.cos(Math.PI * p)) / 2;
      galleryScroll.scrollTop = origin + distance * eased;
      if (p < 1) travelFrame = requestAnimationFrame(tick);
      else { travelFrame = null; galleryScroll.classList.remove("is-animating"); updateGalleryDepth(); }
    }
    travelFrame = requestAnimationFrame(tick);
  }
  function openGallery() {
    if (galleryOpen()) return;
    focusBeforeGallery = document.activeElement;
    gallery.inert = false;
    gallery.setAttribute("aria-hidden", "false");
    gallery.classList.add("is-open");
    document.body.classList.add("gallery-open");
    stopWaves();
    exit.focus({ preventScroll:true });
    requestAnimationFrame(() => { measureGallery(); goToPhoto(0, false); updateGalleryDepth(); });
  }
  function closeGallery() {
    if (!galleryOpen()) return;
    cancelTravel();
    if (scrollFrame !== null) cancelAnimationFrame(scrollFrame);
    scrollFrame = null;
    gallery.classList.remove("is-open");
    gallery.setAttribute("aria-hidden", "true");
    gallery.inert = true;
    document.body.classList.remove("gallery-open");
    startWaves();
    if (focusBeforeGallery?.isConnected) focusBeforeGallery.focus({ preventScroll:true });
  }
  document.querySelectorAll("[data-open-gallery]").forEach(button => button.addEventListener("click", openGallery));
  exit.addEventListener("click", closeGallery);
  prev.addEventListener("click", () => goToPhoto(current - 1));
  next.addEventListener("click", () => goToPhoto(current + 1));
  ["wheel", "touchstart", "pointerdown"].forEach(type => galleryScroll.addEventListener(type, cancelTravel, { passive:true }));
  galleryScroll.addEventListener("scroll", () => {
    if (scrollFrame !== null) return;
    scrollFrame = requestAnimationFrame(() => { scrollFrame = null; updateGalleryDepth(); });
  }, { passive:true });
  window.addEventListener("resize", () => {
    if (!galleryOpen() || resizeFrame !== null) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = null;
      cancelTravel();
      measureGallery();
      goToPhoto(current, false);
    });
  });

  // Navigation: Gallery opens the pop-up, other links scroll normally.
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener("click", event => {
      const targetId = link.getAttribute("href");
      const target = document.querySelector(targetId);
      if (!target) return;
      event.preventDefault();
      if (targetId === "#gallery") { openGallery(); return; }
      target.scrollIntoView({ behavior:reducedMotion.matches ? "auto" : "smooth", block:"start" });
    });
  });

  // Escape, arrow/page keys and keyboard focus in the gallery.
  document.addEventListener("keydown", event => {
    if (lightbox.classList.contains("active")) {
      if (event.key === "Escape") { event.preventDefault(); closePhoto(); }
      if (event.key === "Tab") { event.preventDefault(); lightboxClose.focus(); }
      return;
    }
    if (!galleryOpen()) return;
    if (event.key === "Escape") { event.preventDefault(); closeGallery(); }
    else if (event.key === "ArrowDown" || event.key === "PageDown") { event.preventDefault(); goToPhoto(current + 1); }
    else if (event.key === "ArrowUp" || event.key === "PageUp") { event.preventDefault(); goToPhoto(current - 1); }
    else if (event.key === "Home") { event.preventDefault(); goToPhoto(0); }
    else if (event.key === "End") { event.preventDefault(); goToPhoto(cards.length - 1); }
    else if (event.key === "Tab") {
      const focusable = [...gallery.querySelectorAll('button:not(:disabled), [tabindex="0"]')];
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  // LET'S CREATE: accessible validation + FormSubmit AJAX delivery.
  // GitHub Pages is static; the form service must be activated via Outlook once.
  const contactForm = document.getElementById("contact-form");
  if (contactForm) {
    const contactFields = {
      name: document.getElementById("contact-name"),
      phone: document.getElementById("contact-phone"),
      email: document.getElementById("contact-email"),
      message: document.getElementById("contact-message")
    };
    const contactStatus = document.getElementById("contact-status");
    const contactSubmit = document.getElementById("contact-submit");
    const contactSubmitLabel = contactSubmit.querySelector(".contact-submit-label");
    const characterCounter = document.getElementById("contact-counter");
    let isSubmittingContact = false;

    function phoneIsValid(value) {
      // Accept international prefixes, spaces, dashes and brackets.
      // Require between 7 and 15 actual digits.
      if (!/^[+\d\s().-]+$/.test(value)) return false;
      const digits = value.replace(/\D/g, "");
      return digits.length >= 7 && digits.length <= 15;
    }

    function fieldMessage(key, value) {
      if (!value) return {
        name: "Please enter your name.",
        phone: "Please enter your phone number.",
        email: "Please enter your email address.",
        message: "Please tell me a little about your enquiry."
      }[key];
      if (key === "name" && value.length < 2)
        return "Your name should have at least 2 characters.";
      if (key === "phone" && !phoneIsValid(value))
        return "Enter a valid phone number (7–15 digits).";
      if (key === "email" && !contactFields.email.validity.valid)
        return "Please enter a valid email address.";
      if (key === "message" && value.length < 15)
        return "Please write at least 15 characters.";
      return "";
    }

    function validateContactField(key, showError = true) {
      const input = contactFields[key];
      const wrapper = input.closest(".contact-field");
      const errorElement = document.getElementById(`contact-${key}-error`);
      const message = fieldMessage(key, input.value.trim());
      if (showError) {
        wrapper.classList.toggle("has-error", Boolean(message));
        input.setAttribute("aria-invalid", String(Boolean(message)));
        errorElement.textContent = message;
      }
      return !message;
    }

    function showContactStatus(message, type) {
      contactStatus.textContent = message;
      contactStatus.classList.remove("is-success", "is-error", "is-visible");
      if (message) {
        contactStatus.classList.add("is-visible", `is-${type}`);
      }
    }

    Object.entries(contactFields).forEach(([key, field]) => {
      field.addEventListener("blur", () => validateContactField(key));
      field.addEventListener("input", () => {
        if (key === "message") {
          characterCounter.textContent = `${field.value.length} / 1500`;
        }
        if (field.closest(".contact-field").classList.contains("has-error")) {
          validateContactField(key);
        }
        if (contactStatus.classList.contains("is-visible")) {
          showContactStatus("", "");
        }
      });
    });

    contactForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (isSubmittingContact) return;

      let allValid = true;
      for (const key of Object.keys(contactFields)) {
        if (!validateContactField(key)) allValid = false;
      }
      if (!allValid) {
        const firstInvalid = contactForm.querySelector('.contact-input[aria-invalid="true"]');
        if (firstInvalid) firstInvalid.focus();
        showContactStatus("Please check the highlighted fields before sending.", "error");
        return;
      }

      // No API token is needed. The email recipient confirms the first activation email.
      const payload = {
        name: contactFields.name.value.trim(),
        phone: contactFields.phone.value.trim(),
        email: contactFields.email.value.trim(),
        message: contactFields.message.value.trim(),
        _replyto: contactFields.email.value.trim(),
        _subject: "New enquiry — Frankie Photography",
        _template: "table",
        _honey: contactForm.elements.namedItem("_honey").value
      };

      isSubmittingContact = true;
      contactSubmit.disabled = true;
      contactSubmit.classList.add("is-sending");
      contactSubmitLabel.textContent = "SENDING...";
      showContactStatus("", "");

      try {
        const response = await fetch(
          "https://formsubmit.co/ajax/horrocks984@outlook.com",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify(payload)
          }
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        if (result.success === false || result.success === "false") {
          throw new Error(result.message || "Form submission was not accepted");
        }

        contactForm.reset();
        characterCounter.textContent = "0 / 1500";
        Object.values(contactFields).forEach((field) => {
          field.setAttribute("aria-invalid", "false");
          field.closest(".contact-field").classList.remove("has-error");
          document.getElementById(`${field.id}-error`).textContent = "";
        });
        showContactStatus("Message submitted. Thank you for getting in touch — I'll respond as soon as I can.", "success");
      } catch (error) {
        console.error("Contact form submission failed:", error);
        showContactStatus("Your message could not be submitted just now. Please try again in a moment.", "error");
      } finally {
        isSubmittingContact = false;
        contactSubmit.disabled = false;
        contactSubmit.classList.remove("is-sending");
        contactSubmitLabel.textContent = "SEND MESSAGE";
      }
    });
  }

  // Hamburger intentionally remains a placeholder for later.
  console.log("Frankie Portfolio and immersive gallery loaded.");
});
