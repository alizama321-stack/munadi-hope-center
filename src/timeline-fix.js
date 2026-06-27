// Runtime production timeline fix.
// Separates the closed-book Chapter 1 intro from the open-Bible website chapters.
// Desktop: the open Bible pages become the website surface.
// Mobile: the Bible becomes a cinematic background and readable mobile sections appear above it.

const ENTER_TARGET = 0.55;
const OPEN_BOOK_TARGET = 0.86;

const HERO_REVEAL_START = 0.16;
const HERO_REVEAL_END = 0.26;
const HERO_FADE_START = 0.36;
const HERO_FADE_END = 0.48;

// Chapter 1 appears only while the book is still closed.
const CLOSED_INTRO_START = 0.50;
const CLOSED_INTRO_FULL = 0.55;
const CLOSED_INTRO_FADE_START = 0.59;
const CLOSED_INTRO_END = 0.62;

// Open-book reading stage. It intentionally skips Chapter 1.
// Wash starts first, then real website content appears after the open-book zoom settles.
const PAGE_WASH_START = 0.80;
const PAGE_WASH_FULL = 0.87;
const OPEN_READING_START = 0.87;
const OPEN_READING_FULL = 0.92;
const CHAPTER_SCROLL_START = 0.92;
const CHAPTER_SCROLL_END = 0.995;
const OPEN_CONTENT_DAMPING = 6.8;

const MOBILE_QUERY = '(max-width: 767px)';

let renderedReadingProgress = 0;
let lastTime = performance.now();
let capturedNavigation = false;
let afterFrameQueued = false;
let mobileMediaQuery = null;

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function damp(current, target, lambda, delta) {
  return current + (target - current) * (1 - Math.exp(-lambda * delta));
}

function journeyProgress() {
  const journey = document.getElementById('journey');
  if (!journey) return 0;
  const rect = journey.getBoundingClientRect();
  const max = Math.max(1, journey.offsetHeight - window.innerHeight);
  return clamp(-rect.top / max);
}

function scrollJourneyToProgress(progress) {
  const journey = document.getElementById('journey');
  if (!journey) return;
  const max = Math.max(1, journey.offsetHeight - window.innerHeight);
  const top = journey.offsetTop + max * clamp(progress);
  window.scrollTo({ top, behavior: 'smooth' });
}

function isMobileViewport() {
  if (!mobileMediaQuery) mobileMediaQuery = window.matchMedia(MOBILE_QUERY);
  return mobileMediaQuery.matches;
}

function setupNavigation() {
  if (capturedNavigation) return;
  capturedNavigation = true;

  document.addEventListener(
    'click',
    (event) => {
      const openBookLink = event.target.closest('[data-open-book="true"]');
      if (openBookLink) {
        event.preventDefault();
        event.stopImmediatePropagation();
        scrollJourneyToProgress(OPEN_BOOK_TARGET);
        return;
      }

      const link = event.target.closest('a[data-scroll-end="true"]');
      if (!link) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      history.pushState(null, '', '#journey');
      scrollJourneyToProgress(ENTER_TARGET);
    },
    true,
  );
}

function removeDuplicateIds(root, suffix) {
  root.querySelectorAll('[id]').forEach((element) => {
    element.id = `${element.id}-${suffix}`;
  });
}

function ensureClosedBookIntro() {
  let intro = document.getElementById('closedBookIntro');
  if (intro) return intro;

  const chapterOne = document.querySelector('.bible-chapter[data-chapter="0"]');
  if (!chapterOne) return null;

  intro = document.createElement('aside');
  intro.id = 'closedBookIntro';
  intro.className = 'mhc-closed-book-intro';
  intro.setAttribute('aria-label', 'Welcome chapter intro');
  intro.innerHTML = chapterOne.innerHTML;

  intro.querySelectorAll('[data-scroll-end]').forEach((element) => {
    element.removeAttribute('data-scroll-end');
    element.setAttribute('data-open-book', 'true');
  });

  document.body.appendChild(intro);
  return intro;
}

function ensurePageWashLayer() {
  let wash = document.getElementById('openBookPageWash');
  if (wash) return wash;

  wash = document.createElement('div');
  wash.id = 'openBookPageWash';
  wash.className = 'mhc-open-book-page-wash';
  wash.setAttribute('aria-hidden', 'true');
  document.body.appendChild(wash);
  return wash;
}

function ensureMobileReadingLayer() {
  let layer = document.getElementById('mobileReadingLayer');
  if (layer) return layer;

  const openChapters = [...document.querySelectorAll('#homeBibleContentSurface .bible-chapter')]
    .filter((chapter) => Number(chapter.dataset.chapter || 0) > 0)
    .sort((a, b) => Number(a.dataset.chapter || 0) - Number(b.dataset.chapter || 0));

  if (!openChapters.length) return null;

  layer = document.createElement('section');
  layer.id = 'mobileReadingLayer';
  layer.className = 'mhc-mobile-reading-layer';
  layer.setAttribute('aria-label', 'Munadi Hope Center mobile chapters');

  openChapters.forEach((chapter, ordinal) => {
    const section = document.createElement('article');
    section.className = 'mhc-mobile-reading-section';
    section.dataset.ordinal = String(ordinal);
    section.dataset.sourceChapter = chapter.dataset.chapter || String(ordinal + 1);
    section.innerHTML = chapter.innerHTML;
    removeDuplicateIds(section, `mobile-${ordinal}`);

    section.querySelectorAll('.page-map').forEach((map) => {
      if (!map.querySelector('.mobile-map-link')) {
        const link = document.createElement('a');
        link.className = 'page-btn mobile-map-link';
        link.href = 'https://www.google.com/maps/search/?api=1&query=House%2014%20Street%202%20Sector%20G-6%2F4%20Islamabad%20Pakistan';
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = 'Open Location';
        map.appendChild(link);
      }
    });

    layer.appendChild(section);
  });

  document.body.appendChild(layer);
  return layer;
}

function ensureProductionStageStyles() {
  if (document.getElementById('mhc-production-stage-style')) return;
  const style = document.createElement('style');
  style.id = 'mhc-production-stage-style';
  style.textContent = `
    .journey-stage {
      min-height: 1700vh !important;
    }

    #heroCopy.mhc-hero-stage {
      position: fixed !important;
      left: 50% !important;
      top: 49% !important;
      width: min(760px, calc(100vw - 3rem)) !important;
      max-width: 760px !important;
      z-index: 6 !important;
      align-items: center !important;
      text-align: center !important;
      gap: 1rem !important;
      opacity: var(--hero-stage-opacity, 0) !important;
      transform: translate(-50%, -50%) translate3d(0, var(--hero-stage-y, 0px), 0) !important;
      pointer-events: var(--hero-stage-pointer, none) !important;
      will-change: opacity, transform !important;
    }
    #heroCopy.mhc-hero-stage .eyebrow { justify-content: center !important; }
    #heroCopy.mhc-hero-stage h1 {
      max-width: 12ch !important;
      font-size: clamp(2.7rem, 5.5vw, 5.9rem) !important;
      text-align: center !important;
    }
    #heroCopy.mhc-hero-stage .lede {
      max-width: min(54ch, 100%) !important;
      text-align: center !important;
    }
    #heroCopy.mhc-hero-stage .hero-actions {
      justify-content: center !important;
      width: 100% !important;
    }

    .mhc-closed-book-intro {
      position: fixed;
      left: clamp(2.2rem, 7vw, 7rem);
      top: 52%;
      z-index: 7;
      width: min(620px, 38vw);
      color: var(--cream);
      opacity: var(--closed-book-opacity, 0);
      transform: translateY(-50%) translate3d(0, var(--closed-book-y, 0px), 0);
      pointer-events: var(--closed-book-pointer, none);
      transition: opacity 0.28s ease, transform 0.28s ease;
      text-shadow: 0 16px 38px rgba(0, 0, 0, 0.66);
      will-change: opacity, transform;
    }
    .mhc-closed-book-intro .bible-chapter,
    .mhc-closed-book-intro .chapter-grid,
    .mhc-closed-book-intro .chapter-grid-intro {
      display: block !important;
      position: relative !important;
      inset: auto !important;
      opacity: 1 !important;
      transform: none !important;
    }
    .mhc-closed-book-intro .page-kicker {
      color: var(--gold-light) !important;
      margin-bottom: 0.95rem !important;
      text-shadow: 0 10px 32px rgba(0, 0, 0, 0.72) !important;
    }
    .mhc-closed-book-intro h2 {
      color: var(--cream) !important;
      font-size: clamp(2.8rem, 5.5vw, 6rem) !important;
      line-height: 0.96 !important;
      max-width: 11ch !important;
      text-shadow: 0 22px 54px rgba(0, 0, 0, 0.62) !important;
    }
    .mhc-closed-book-intro p {
      color: rgba(255, 248, 233, 0.86) !important;
      font-size: clamp(0.95rem, 1.2vw, 1.15rem) !important;
      max-width: 42ch !important;
    }
    .mhc-closed-book-intro .chapter-callout {
      margin-top: 1.2rem !important;
      padding-left: 0 !important;
      border-left: 0 !important;
    }
    .mhc-closed-book-intro .scripture-note {
      color: var(--gold-light) !important;
      font-size: clamp(1.1rem, 1.7vw, 1.55rem) !important;
      margin-bottom: 0.8rem !important;
    }
    .mhc-closed-book-intro .page-btn {
      display: inline-flex !important;
      width: auto !important;
      min-width: 210px !important;
      background: rgba(240, 201, 117, 0.92) !important;
      color: var(--burgundy-deep) !important;
    }

    .mhc-open-book-page-wash {
      position: fixed;
      left: 50%;
      top: 52%;
      z-index: 4;
      width: min(1560px, 92vw);
      height: min(730px, 78vh);
      pointer-events: none;
      opacity: var(--book-wash-opacity, 0);
      transform: translate(-50%, -50%) rotate(0deg);
      border-radius: 18px;
      background:
        radial-gradient(ellipse at 24% 28%, rgba(255, 252, 230, 0.66), transparent 52%),
        radial-gradient(ellipse at 76% 40%, rgba(255, 229, 156, 0.45), transparent 60%),
        linear-gradient(90deg, rgba(255, 247, 215, 0.64), rgba(237, 196, 104, 0.30) 49%, rgba(170, 105, 34, 0.10) 50%, rgba(244, 207, 123, 0.34) 52%, rgba(255, 236, 172, 0.50));
      box-shadow: inset 0 0 80px rgba(255,255,255,0.28), inset 0 -50px 90px rgba(85,41,15,0.18);
      mask-image: radial-gradient(ellipse at center, #000 70%, rgba(0,0,0,0.82) 88%, transparent 100%);
      -webkit-mask-image: radial-gradient(ellipse at center, #000 70%, rgba(0,0,0,0.82) 88%, transparent 100%);
      mix-blend-mode: screen;
      will-change: opacity;
    }
    .mhc-open-book-page-wash::after {
      content: '';
      position: absolute;
      left: 49.4%;
      top: 3%;
      width: 2.2%;
      height: 94%;
      background: linear-gradient(90deg, transparent, rgba(102, 52, 18, 0.22), transparent);
      filter: blur(3px);
    }

    #pageContentOverlay {
      pointer-events: none !important;
    }
    #homeBibleContentSurface.mhc-desktop-reading {
      position: fixed !important;
      left: 50% !important;
      top: 52% !important;
      z-index: 6 !important;
      width: min(1480px, 84vw) !important;
      height: min(650px, 68vh) !important;
      transform: translate(-50%, -50%) rotate(0deg) !important;
      transform-origin: center !important;
      opacity: var(--page-overlay-opacity, 0) !important;
      transition: opacity 0.4s ease !important;
      background: transparent !important;
      border: 0 !important;
      box-shadow: none !important;
      border-radius: 0 !important;
      backdrop-filter: none !important;
      color: #2e1710 !important;
    }
    #homeBibleContentSurface.mhc-desktop-reading::before,
    #homeBibleContentSurface.mhc-desktop-reading::after {
      display: none !important;
    }
    #homeBibleContentSurface .bible-chapter[data-chapter="0"] {
      display: none !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
    #homeBibleContentSurface.mhc-desktop-reading .bible-chapter {
      inset: clamp(1.9rem, 3.2vw, 3.6rem) !important;
      justify-content: center !important;
      opacity: var(--chapter-opacity, 0) !important;
      transform: translate3d(0, var(--chapter-shift, 0px), 0) !important;
      transition: none !important;
      will-change: opacity, transform !important;
    }
    #homeBibleContentSurface.mhc-desktop-reading .chapter-grid {
      grid-template-columns: minmax(0, 1.06fr) minmax(280px, 0.78fr) !important;
      gap: clamp(1.5rem, 4vw, 4.5rem) !important;
      align-items: center !important;
    }
    #homeBibleContentSurface.mhc-desktop-reading .bible-chapter h2 {
      font-size: clamp(1.75rem, 2.8vw, 3.25rem) !important;
      line-height: 1 !important;
    }
    #homeBibleContentSurface.mhc-desktop-reading .bible-chapter p,
    #homeBibleContentSurface.mhc-desktop-reading .bible-chapter li,
    #homeBibleContentSurface.mhc-desktop-reading .bible-chapter dd {
      font-size: clamp(0.92rem, 1.05vw, 1.08rem) !important;
      line-height: 1.55 !important;
    }
    #homeBibleContentSurface.mhc-desktop-reading .page-form {
      max-width: 460px !important;
    }
    #homeBibleContentSurface.mhc-desktop-reading .page-btn {
      min-width: min(360px, 100%) !important;
    }

    .mhc-mobile-reading-layer {
      display: none;
    }

    @media (max-width: 767px) {
      .journey-stage {
        min-height: 1850vh !important;
      }
      .mhc-open-book-page-wash {
        top: 49%;
        width: 112vw;
        height: 72vh;
        opacity: calc(var(--book-wash-opacity, 0) * 0.42);
        background: radial-gradient(ellipse at center, rgba(255, 228, 146, 0.28), transparent 66%);
        mix-blend-mode: screen;
      }
      #pageContentOverlay,
      #homeBibleContentSurface {
        pointer-events: none !important;
      }
      body.mhc-mobile-mode #homeBibleContentSurface,
      body.mhc-mobile-mode #pageContentOverlay {
        opacity: 0 !important;
        visibility: hidden !important;
      }
      body.mhc-mobile-mode .scene-vignette {
        opacity: 0.88;
      }
      .mhc-closed-book-intro {
        left: 1.2rem;
        right: 1.2rem;
        top: 52%;
        width: auto;
      }
      .mhc-closed-book-intro h2 {
        font-size: clamp(2.35rem, 13vw, 4.1rem) !important;
      }
      .mhc-mobile-reading-layer {
        display: block;
        position: fixed;
        z-index: 8;
        left: 1rem;
        right: 1rem;
        top: clamp(5.8rem, 12vh, 7rem);
        bottom: 1rem;
        opacity: var(--mobile-reading-opacity, 0);
        pointer-events: var(--mobile-reading-pointer, none);
        will-change: opacity;
      }
      .mhc-mobile-reading-section {
        position: absolute;
        inset: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        opacity: var(--mobile-section-opacity, 0);
        transform: translate3d(0, var(--mobile-section-y, 22px), 0);
        pointer-events: var(--mobile-section-pointer, none);
        padding: 1.05rem;
        border: 1px solid rgba(240, 201, 117, 0.24);
        border-radius: 20px;
        background:
          radial-gradient(circle at 20% 0%, rgba(255, 240, 190, 0.18), transparent 32%),
          linear-gradient(160deg, rgba(34, 15, 9, 0.78), rgba(96, 42, 18, 0.52));
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(7px);
        color: var(--cream);
      }
      .mhc-mobile-reading-section .chapter-grid,
      .mhc-mobile-reading-section .chapter-grid-intro,
      .mhc-mobile-reading-section .chapter-grid-map {
        display: block !important;
      }
      .mhc-mobile-reading-section .page-kicker {
        color: var(--gold-light) !important;
        margin-bottom: 0.75rem !important;
        font-size: 0.72rem !important;
        letter-spacing: 0.22em !important;
      }
      .mhc-mobile-reading-section h2 {
        color: var(--cream) !important;
        font-size: clamp(2rem, 9.5vw, 3rem) !important;
        line-height: 0.98 !important;
        margin-bottom: 0.8rem !important;
      }
      .mhc-mobile-reading-section p,
      .mhc-mobile-reading-section li,
      .mhc-mobile-reading-section dd,
      .mhc-mobile-reading-section label,
      .mhc-mobile-reading-section input,
      .mhc-mobile-reading-section textarea,
      .mhc-mobile-reading-section select {
        font-size: 0.96rem !important;
        line-height: 1.55 !important;
      }
      .mhc-mobile-reading-section p,
      .mhc-mobile-reading-section li,
      .mhc-mobile-reading-section dd,
      .mhc-mobile-reading-section label {
        color: rgba(255, 248, 233, 0.88) !important;
      }
      .mhc-mobile-reading-section .chapter-callout,
      .mhc-mobile-reading-section .pastor-mini,
      .mhc-mobile-reading-section .page-details,
      .mhc-mobile-reading-section .page-form,
      .mhc-mobile-reading-section .page-map {
        margin-top: 1.1rem !important;
      }
      .mhc-mobile-reading-section .page-form {
        width: 100% !important;
        max-width: none !important;
        display: grid !important;
        gap: 0.75rem !important;
      }
      .mhc-mobile-reading-section input,
      .mhc-mobile-reading-section select,
      .mhc-mobile-reading-section textarea {
        width: 100% !important;
        min-height: 44px !important;
      }
      .mhc-mobile-reading-section .page-btn {
        width: 100% !important;
        min-height: 48px !important;
        justify-content: center !important;
      }
      .mhc-mobile-reading-section .page-map iframe {
        display: none !important;
      }
      .mhc-mobile-reading-section .page-stats {
        display: grid !important;
        gap: 0.5rem !important;
      }
      .whatsapp-fab {
        z-index: 10 !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function updateHero(progress) {
  const hero = document.getElementById('heroCopy');
  if (!hero) return;

  hero.classList.add('mhc-hero-stage');

  const reveal = smoothstep(HERO_REVEAL_START, HERO_REVEAL_END, progress);
  const fadeOut = smoothstep(HERO_FADE_START, HERO_FADE_END, progress);
  const opacity = reveal * (1 - fadeOut);
  const lift = -14 * reveal - 30 * fadeOut;

  hero.style.setProperty('--hero-stage-opacity', opacity.toFixed(3));
  hero.style.setProperty('--hero-stage-y', `${lift.toFixed(1)}px`);
  hero.style.setProperty('--hero-stage-pointer', opacity > 0.35 ? 'auto' : 'none');
  hero.setAttribute('aria-hidden', opacity > 0.05 ? 'false' : 'true');
}

function updateClosedBookIntro(progress) {
  const intro = ensureClosedBookIntro();
  if (!intro) return 0;

  const reveal = smoothstep(CLOSED_INTRO_START, CLOSED_INTRO_FULL, progress);
  const fadeOut = smoothstep(CLOSED_INTRO_FADE_START, CLOSED_INTRO_END, progress);
  const opacity = reveal * (1 - fadeOut);
  const y = (1 - reveal) * 18 - fadeOut * 20;

  intro.style.setProperty('--closed-book-opacity', opacity.toFixed(3));
  intro.style.setProperty('--closed-book-y', `${y.toFixed(1)}px`);
  intro.style.setProperty('--closed-book-pointer', opacity > 0.45 ? 'auto' : 'none');
  intro.setAttribute('aria-hidden', opacity > 0.08 ? 'false' : 'true');
  return opacity;
}

function openChapterOpacity(readingProgress, ordinal, count) {
  if (count <= 1) return 1;

  const segment = 1 / count;
  const start = ordinal * segment;
  const end = (ordinal + 1) * segment;
  const fade = Math.min(0.045, segment * 0.24);

  const fadeIn = smoothstep(start, start + fade, readingProgress);
  const fadeOut = 1 - smoothstep(end - fade, end, readingProgress);
  return clamp(fadeIn * fadeOut);
}

function getOpenChapterItems() {
  return [...document.querySelectorAll('#homeBibleContentSurface .bible-chapter')]
    .map((chapter) => ({ element: chapter, index: Number(chapter.dataset.chapter || 0) }))
    .filter((item) => item.index > 0)
    .sort((a, b) => a.index - b.index);
}

function updateDesktopReading(openReveal, readingProgress) {
  const overlay = document.getElementById('pageContentOverlay');
  const surface = document.getElementById('homeBibleContentSurface');
  const openChapters = getOpenChapterItems();
  if (!overlay || !surface || !openChapters.length) return;

  surface.classList.add('mhc-desktop-reading');
  surface.classList.remove('mhc-centered-book-content');
  overlay.style.setProperty('--page-overlay-opacity', openReveal.toFixed(3));
  overlay.classList.toggle('is-readable', openReveal > 0.45);
  surface.style.setProperty('--page-overlay-opacity', openReveal.toFixed(3));
  surface.style.setProperty('--safe-border-opacity', '0');

  const allChapters = [...document.querySelectorAll('#homeBibleContentSurface .bible-chapter')];
  allChapters.forEach((chapter) => {
    const index = Number(chapter.dataset.chapter || 0);
    const ordinal = openChapters.findIndex((item) => item.index === index);
    const sectionOpacity = ordinal >= 0 ? openChapterOpacity(readingProgress, ordinal, openChapters.length) : 0;
    const chapterOpacity = sectionOpacity * openReveal;
    const chapterShift = ordinal >= 0 ? (ordinal / Math.max(1, openChapters.length - 1) - readingProgress) * 24 : 0;

    chapter.style.setProperty('--chapter-opacity', chapterOpacity.toFixed(3));
    chapter.style.setProperty('--chapter-shift', `${chapterShift.toFixed(1)}px`);
    chapter.classList.toggle('is-active', chapterOpacity > 0.45);
    chapter.setAttribute('aria-hidden', chapterOpacity > 0.12 ? 'false' : 'true');
  });
}

function updateMobileReading(openReveal, readingProgress) {
  const layer = ensureMobileReadingLayer();
  if (!layer) return;

  layer.style.setProperty('--mobile-reading-opacity', openReveal.toFixed(3));
  layer.style.setProperty('--mobile-reading-pointer', openReveal > 0.55 ? 'auto' : 'none');

  const sections = [...layer.querySelectorAll('.mhc-mobile-reading-section')];
  sections.forEach((section, ordinal) => {
    const opacity = openChapterOpacity(readingProgress, ordinal, sections.length) * openReveal;
    const y = (ordinal / Math.max(1, sections.length - 1) - readingProgress) * 28;
    section.style.setProperty('--mobile-section-opacity', opacity.toFixed(3));
    section.style.setProperty('--mobile-section-y', `${y.toFixed(1)}px`);
    section.style.setProperty('--mobile-section-pointer', opacity > 0.55 ? 'auto' : 'none');
    section.classList.toggle('is-active', opacity > 0.45);
    section.setAttribute('aria-hidden', opacity > 0.12 ? 'false' : 'true');
  });
}

function updateOpenBookContent(progress, delta) {
  const wash = ensurePageWashLayer();
  const isMobile = isMobileViewport();

  const washOpacity = smoothstep(PAGE_WASH_START, PAGE_WASH_FULL, progress);
  const openReveal = smoothstep(OPEN_READING_START, OPEN_READING_FULL, progress);
  const targetReadingProgress = smoothstep(CHAPTER_SCROLL_START, CHAPTER_SCROLL_END, progress);
  renderedReadingProgress = damp(renderedReadingProgress, targetReadingProgress, OPEN_CONTENT_DAMPING, delta);

  wash.style.setProperty('--book-wash-opacity', washOpacity.toFixed(3));
  document.body.classList.toggle('mhc-mobile-mode', isMobile && openReveal > 0.02);
  document.body.classList.toggle('mhc-desktop-mode', !isMobile && openReveal > 0.02);

  if (isMobile) {
    updateDesktopReading(0, renderedReadingProgress);
    updateMobileReading(openReveal, renderedReadingProgress);
  } else {
    const mobileLayer = document.getElementById('mobileReadingLayer');
    if (mobileLayer) {
      mobileLayer.style.setProperty('--mobile-reading-opacity', '0');
      mobileLayer.style.setProperty('--mobile-reading-pointer', 'none');
    }
    updateDesktopReading(openReveal, renderedReadingProgress);
  }
}

function updateTimeline(delta) {
  ensureProductionStageStyles();
  ensurePageWashLayer();
  ensureMobileReadingLayer();

  const progress = journeyProgress();
  updateHero(progress);
  updateClosedBookIntro(progress);
  updateOpenBookContent(progress, delta);
}

function runAfterSceneFrame() {
  afterFrameQueued = false;
  const now = performance.now();
  const delta = Math.min(0.05, (now - lastTime) / 1000 || 1 / 60);
  lastTime = now;
  setupNavigation();
  updateTimeline(delta);
}

function tick() {
  if (!afterFrameQueued) {
    afterFrameQueued = true;
    setTimeout(runAfterSceneFrame, 0);
  }
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
