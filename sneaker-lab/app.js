(() => {
  const root = document.documentElement;
  const experience = document.querySelector('.experience');
  const canvas = document.querySelector('#clinic-scene');
  const status = document.querySelector('#scene-status');
  const progressFill = document.querySelector('#scene-progress-fill');
  const counter = document.querySelector('#scene-counter');
  const scenePhoto = document.querySelector('#scene-photo');
  const beats = [...document.querySelectorAll('.scene-copy')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const smallScreen = window.matchMedia('(max-width: 760px)').matches;
  const lowPower = (navigator.deviceMemory && navigator.deviceMemory <= 4) || navigator.connection?.saveData;

  root.classList.add('js');

  const menuButton = document.querySelector('.menu-toggle');
  const mobileMenu = document.querySelector('#mobile-menu');
  if (menuButton && mobileMenu) {
    menuButton.addEventListener('click', () => {
      const open = menuButton.getAttribute('aria-expanded') === 'true';
      menuButton.setAttribute('aria-expanded', String(!open));
      menuButton.setAttribute('aria-label', open ? 'Open navigation' : 'Close navigation');
      mobileMenu.hidden = open;
    });
    mobileMenu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', 'Open navigation');
      mobileMenu.hidden = true;
    }));
  }

  let scene = null;
  if (smallScreen || reducedMotion || lowPower || !window.ClinicScene || !canvas) {
    root.classList.add('no-webgl');
    if (status) {
      status.textContent = smallScreen ? 'A CLOSER LOOK AT CARE' : 'EXPLORE THE CLINIC';
      status.classList.add('is-hidden');
    }
  }

  let scrollFrame = 0;
  let currentScene = -1;
  let storyProgress = 0;
  function updateStory() {
    scrollFrame = 0;
    if (!experience || reducedMotion) return;
    const rect = experience.getBoundingClientRect();
    const travel = Math.max(experience.offsetHeight - window.innerHeight, 1);
    const progress = Math.max(0, Math.min(1, -rect.top / travel));
    storyProgress = progress;
    const sceneIndex = Math.min(3, Math.floor(progress * 4));

    if (sceneIndex !== currentScene) {
      currentScene = sceneIndex;
      beats.forEach((beat, index) => {
        const active = index === sceneIndex;
        beat.classList.toggle('is-current', active);
        beat.setAttribute('aria-hidden', String(!active));
      });
      experience.dataset.scene = String(sceneIndex);
      if (counter) counter.innerHTML = `0${sceneIndex + 1} <i>/ 04</i>`;
    }

    if (progressFill) progressFill.style.transform = `scaleX(${progress})`;
    if (scenePhoto) {
      const reveal = Math.max(0, Math.min(1, (progress - 0.49) / 0.115));
      const conceal = Math.max(0, Math.min(1, (progress - 0.7) / 0.09));
      const amount = Math.max(0, reveal - conceal);
      scenePhoto.style.opacity = String(Math.min(1, reveal * 1.5) * (1 - conceal));
      scenePhoto.style.clipPath = `inset(0 ${(1 - amount) * 100}% 0 0)`;
    }
    scene?.setProgress(progress);
  }
  function requestStoryUpdate() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateStory);
  }
  if (!reducedMotion) {
    window.addEventListener('scroll', requestStoryUpdate, { passive: true });
    window.addEventListener('resize', requestStoryUpdate, { passive: true });
    requestStoryUpdate();
  }

  if (!smallScreen && !reducedMotion && !lowPower && window.ClinicScene && canvas) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      scene = window.ClinicScene.mount(canvas);
      if (!scene) {
        root.classList.add('no-webgl');
        if (status) status.classList.add('is-hidden');
        return;
      }
      root.classList.add('webgl-ready');
      if (status) status.classList.add('is-hidden');
      scene.setProgress(storyProgress);
      canvas.addEventListener('clinicweblost', () => root.classList.remove('webgl-ready'));
      canvas.addEventListener('clinicwebrestored', () => root.classList.add('webgl-ready'));
      if ('IntersectionObserver' in window) {
        const visibility = new IntersectionObserver(([entry]) => scene?.setVisible(entry.isIntersecting), { threshold: 0 });
        visibility.observe(experience);
      }
    }));
  }

  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-seen');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.18 });
    document.querySelectorAll('.service-row, .clinic-image, .clinic-facts > div').forEach((element) => revealObserver.observe(element));
  }

  window.addEventListener('pagehide', () => scene?.destroy(), { once: true });
})();
