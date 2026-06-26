// Runtime production timeline fix.
// Keeps the cinematic camera journey separate from Bible chapter reading.
// This prevents visitors from landing on the last chapter as soon as the Bible zoom finishes.

const CAMERA_READING_TARGET = 0.78;
const HERO_REVEAL_START = 0.2;
const HERO_REVEAL_END = 0.32;
const HERO_FADE_START = 0.43;
const HERO_FADE_END = 0.54;
const CONTENT_REVEAL_START = 0.72;
const CONTENT_REVEAL_END = 0.8;
const CHAPTER_SCROLL_START = 0.82;
const CHAPTER_SCROLL_END = 0.98;
const CHAPTER_DAMPING = 5.2;

let renderedChapterCursor = 0;
let lastTime = performance.now();
let capturedNavigation = false;
let afterFrameQueued = false;

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

function setupEnterNavigation() {
  if (capturedNavigation) return;
  capturedNavigation = true;

  document.addEventListener(
    'click',
    (event) => {
      const link = event.target.closest('a[data-scroll-end="true"]');
      if (!link) return;

      // Stop the old behavior from jumping to the absolute bottom of the journey.
      event.preventDefault();
      event.stopImmediatePropagation();
      history.pushState(null, '', '#journey');
      scrollJourneyToProgress(CAMERA_READING_TARGET);
    },
    true,
  );
}

function ensureProductionStageStyles() {
  if (document.getElementById('mhc-production-stage-style')) return;
  const style = document.createElement('style');
  style.id = 'mhc-production-stage-style';
  style.textContent = `
    .journey-stage {
      min-height: 2200vh !important;
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
    #heroCopy.mhc-hero-stage .eyebrow {
      justify-content: center !important;
    }
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

    #homeBibleContentSurface.mhc-centered-book-content {
      position: fixed !important;
      left: 50% !important;
      top: 52% !important;
      width: min(1500px, 86vw) !important;
      height: min(650px, 70vh) !important;
      transform: translate(-50%, -50%) rotate(0deg) !important;
      transform-origin: center !important;
      border-radius: 10px !important;
      opacity: var(--page-overlay-opacity, 0) !important;
      transition: opacity 0.32s ease !important;
    }
    #homeBibleContentSurface.mhc-centered-book-content .bible-chapter {
      inset: clamp(1.6rem, 3vw, 3.1rem) !important;
      justify-content: center !important;
    }
    #homeBibleContentSurface.mhc-centered-book-content .chapter-grid {
      grid-template-columns: minmax(0, 1fr) minmax(240px, 0.8fr) !important;
      gap: clamp(1rem, 3vw, 3rem) !important;
      align-items: center !important;
    }
    #homeBibleContentSurface.mhc-centered-book-content .bible-chapter h2 {
      font-size: clamp(1.55rem, 2.65vw, 3rem) !important;
    }
    #homeBibleContentSurface.mhc-centered-book-content .bible-chapter p,
    #homeBibleContentSurface.mhc-centered-book-content .bible-chapter li,
    #homeBibleContentSurface.mhc-centered-book-content .bible-chapter dd {
      font-size: clamp(0.78rem, 1.05vw, 1.08rem) !important;
    }
    #homeBibleContentSurface.mhc-centered-book-content .page-btn {
      min-width: min(380px, 100%) !important;
    }
  `;
  document.head.appendChild(style);
}

function updateHeroLockout(progress) {
  const hero = document.getElementById('heroCopy');
  if (!hero) return;

  ensureProductionStageStyles();
  hero.classList.add('mhc-hero-stage');

  // The hero belongs to the aisle reveal, before the lectern/book closeup.
  const reveal = smoothstep(HERO_REVEAL_START, HERO_REVEAL_END, progress);
  const fadeOut = smoothstep(HERO_FADE_START, HERO_FADE_END, progress);
  const opacity = reveal * (1 - fadeOut);
  const lift = -14 * reveal - 30 * fadeOut;

  hero.style.setProperty('--hero-stage-opacity', opacity.toFixed(3));
  hero.style.setProperty('--hero-stage-y', `${lift.toFixed(1)}px`);
  hero.style.setProperty('--hero-stage-pointer', opacity > 0.35 ? 'auto' : 'none');
  hero.setAttribute('aria-hidden', opacity > 0.05 ? 'false' : 'true');
}

function updateBibleContent(delta) {
  const chapters = [...document.querySelectorAll('.bible-chapter')];
  const overlay = document.getElementById('pageContentOverlay');
  const surface = document.getElementById('homeBibleContentSurface');
  if (!chapters.length || !overlay || !surface) return;

  ensureProductionStageStyles();

  const progress = journeyProgress();
  updateHeroLockout(progress);

  const reveal = smoothstep(CONTENT_REVEAL_START, CONTENT_REVEAL_END, progress);
  surface.classList.toggle('mhc-centered-book-content', reveal > 0.02);

  // The content should appear when the Bible is framed, but Chapter 1 should hold first.
  const chapterProgress = smoothstep(CHAPTER_SCROLL_START, CHAPTER_SCROLL_END, progress);
  const chapterCount = Math.max(1, Math.max(...chapters.map((chapter) => Number(chapter.dataset.chapter || 0))) + 1);
  const goalCursor = chapterProgress * Math.max(0, chapterCount - 1);
  renderedChapterCursor = damp(renderedChapterCursor, goalCursor, CHAPTER_DAMPING, delta);

  overlay.style.setProperty('--page-overlay-opacity', reveal.toFixed(3));
  overlay.classList.toggle('is-readable', reveal > 0.45);
  surface.style.setProperty('--page-overlay-opacity', reveal.toFixed(3));
  surface.style.setProperty('--safe-border-opacity', '0');

  chapters.forEach((chapter) => {
    const index = Number(chapter.dataset.chapter || 0);
    const chapterOpacity = smoothstep(0, 1, clamp(1 - Math.abs(renderedChapterCursor - index), 0, 1)) * reveal;
    chapter.style.setProperty('--chapter-opacity', chapterOpacity.toFixed(3));
    chapter.style.setProperty('--chapter-shift', `${((index - renderedChapterCursor) * 16).toFixed(1)}px`);
    chapter.classList.toggle('is-active', chapterOpacity > 0.45);
    chapter.setAttribute('aria-hidden', chapterOpacity > 0.12 ? 'false' : 'true');
  });
}

function runAfterSceneFrame() {
  afterFrameQueued = false;
  const now = performance.now();
  const delta = Math.min(0.05, (now - lastTime) / 1000 || 1 / 60);
  lastTime = now;
  setupEnterNavigation();
  updateBibleContent(delta);
}

function tick() {
  if (!afterFrameQueued) {
    afterFrameQueued = true;
    setTimeout(runAfterSceneFrame, 0);
  }
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
