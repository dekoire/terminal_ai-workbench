/* Lucide Icons — replace all [data-lucide] placeholders with SVG */
  if (window.lucide) { lucide.createIcons(); }

  /* Theme Toggle */
  (function() {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;
    const saved = localStorage.getItem('codera-theme');
    if (saved === 'light') document.body.classList.add('theme-light');
    toggle.addEventListener('click', () => {
      document.body.classList.toggle('theme-light');
      localStorage.setItem('codera-theme', document.body.classList.contains('theme-light') ? 'light' : 'dark');
    });
  })();

  /* Intersection Observer for scroll-triggered fade-in animations */
  (function() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -24px 0px' });

    const selectors = '.section, .feature-card, .workflow-timeline__item, .testsec-card, .comparison__col, .cta-banner, .orbit-gallery__main, .orbit-gallery__side';
    document.querySelectorAll(selectors).forEach((el, i) => {
      el.classList.add('fade-in--' + ((i % 6) + 1));
      observer.observe(el);
    });
  })();

  /* 3D Tilt fuer Hero-Visual */
  (function() {
    const visuals = document.querySelectorAll('.hero__visual');
    visuals.forEach(card => {
      card.addEventListener('mousemove', e => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const dx = (x - cx) / cx;
        const dy = (y - cy) / cy;
        card.style.transform = 'perspective(900px) rotateX(' + (dy * -5) + 'deg) rotateY(' + (dx * 5) + 'deg) scale(1.01)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(900px) rotateX(0) rotateY(0) scale(1)';
      });
    });
  })();