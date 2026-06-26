// Runtime production timeline fix.
// Separates the closed-book Chapter 1 intro from the open-Bible website chapters.
// After Chapter 1, the book finishes opening/zooming first. Then the website chapters appear and scroll normally.

const ENTER_TARGET = 0.55;
const OPEN_BOOK_TARGET = 0.84;

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
// The content starts after the zoom/opening has visually settled.
const OPEN_READING_START = 0.84;
const OPEN_READING_FULL = 0.89;
const CHAPTER_SCROLL_START = 0.89;
const CHAPTER_SCROLL_END = 0.995;
const OPEN_CONTENT_DAMPING = 6.4;

let renderedReadingProgress = 0;
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
      transition: opacity 0.4s ease !important;
    }
    #homeBibleContentSurface .bible-chapter[data-chapter="0"] {
      display: none !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
    #homeBibleContentSurface.mhc-centered-book-content .bible-chapter {
      inset: clamp(1.6rem, 3vw, 3.1rem) !important;
      justify-content: center !important;
      opacity: var(--chapter-opacity, 0) !important;
      transform: translate3d(0, var(--chapter-shift, 0px), 0) !important;
      transition: none !important;
      will-change: opacity, transform !important;
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
  const fade = Math.min(0.04, segment * 0.22);

  const fadeIn = smoothstep(start, start + fade, readingProgress);
  const fadeOut = 1 - smoothstep(end - fade, end, readingProgress);
  return clamp(fadeIn * fadeOut);
}

function updateOpenBookContent(progress, delta) {
  const chapters = [...document.querySelectorAll('.bible-chapter')];
  const overlay = document.getElementById('pageContentOverlay');
  const surface = document.getElementById('homeBibleContentSurface');
  if (!chapters.length || !overlay || !surface) return;

  const openReveal = smoothstep(OPEN_READING_START, OPEN_READING_FULL, progress);
  surface.classList.toggle('mhc-centered-book-content', openReveal > 0.02);

  const targetReadingProgress = smoothstep(CHAPTER_SCROLL_START, CHAPTER_SCROLL_END, progress);
  renderedReadingProgress = damp(renderedReadingProgress, targetReadingProgress, OPEN_CONTENT_DAMPING, delta);

  const openChapters = chapters
    .map((chapter) => ({ element: chapter, index: Number(chapter.dataset.chapter || 0) }))
    .filter((item) => item.index > 0)
    .sort((a, b) => a.index - b.index);

  overlay.style.setProperty('--page-overlay-opacity', openReveal.toFixed(3));
  overlay.classList.toggle('is-readable', openReveal > 0.45);
  surface.style.setProperty('--page-overlay-opacity', openReveal.toFixed(3));
  surface.style.setProperty('--safe-border-opacity', '0');

  chapters.forEach((chapter) => {
    const index = Number(chapter.dataset.chapter || 0);
    const ordinal = openChapters.findIndex((item) => item.index === index);
    const sectionOpacity = ordinal >= 0 ? openChapterOpacity(renderedReadingProgress, ordinal, openChapters.length) : 0;
    const chapterOpacity = sectionOpacity * openReveal;
    const chapterShift = ordinal >= 0 ? (ordinal / Math.max(1, openChapters.length - 1) - renderedReadingProgress) * 24 : 0;

    chapter.style.setProperty('--chapter-opacity', chapterOpacity.toFixed(3));
    chapter.style.setProperty('--chapter-shift', `${chapterShift.toFixed(1)}px`);
    chapter.classList.toggle('is-active', chapterOpacity > 0.45);
    chapter.setAttribute('aria-hidden', chapterOpacity > 0.12 ? 'false' : 'true');
  });
}

function updateTimeline(delta) {
  ensureProductionStageStyles();
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
