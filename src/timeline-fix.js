// Runtime production timeline fix.
// Keeps the cinematic camera journey separate from Bible chapter reading.
// This prevents visitors from landing on the last chapter as soon as the Bible zoom finishes.

const CAMERA_READING_TARGET = 0.78;
const HERO_REVEAL_START = 0.16;
const HERO_REVEAL_END = 0.26;
const HERO_FADE_START = 0.48;
const HERO_FADE_END = 0.62;
const CONTENT_REVEAL_START = 0.72;
const CONTENT_REVEAL_END = 0.8;
const CHAPTER_SCROLL_START = 0.82;
const CHAPTER_SCROLL_END = 1;
const CHAPTER_DAMPING = 8;

let renderedChapterCursor = 0;
let lastTime = performance.now();
let capturedNavigation = false;

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

function applyCenteredHeroStage(hero) {
  hero.style.position = 'fixed';
  hero.style.left = '50%';
  hero.style.top = '49%';
  hero.style.width = 'min(760px, calc(100vw - 3rem))';
  hero.style.maxWidth = '760px';
  hero.style.zIndex = '6';
  hero.style.alignItems = 'center';
  hero.style.textAlign = 'center';
  hero.style.gap = '1rem';

  const eyebrow = hero.querySelector('.eyebrow');
  const title = hero.querySelector('h1');
  const lede = hero.querySelector('.lede');
  const actions = hero.querySelector('.hero-actions');

  if (eyebrow) eyebrow.style.justifyContent = 'center';
  if (title) {
    title.style.maxWidth = '12ch';
    title.style.fontSize = 'clamp(2.7rem, 5.5vw, 5.9rem)';
    title.style.textAlign = 'center';
  }
  if (lede) {
    lede.style.maxWidth = 'min(54ch, 100%)';
    lede.style.textAlign = 'center';
  }
  if (actions) {
    actions.style.justifyContent = 'center';
    actions.style.width = '100%';
  }
}

function updateHeroLockout(progress) {
  const hero = document.getElementById('heroCopy');
  if (!hero) return;

  applyCenteredHeroStage(hero);

  // The hero belongs to the aisle reveal: it appears after entry and leaves before the Bible stage.
  const reveal = smoothstep(HERO_REVEAL_START, HERO_REVEAL_END, progress);
  const fadeOut = smoothstep(HERO_FADE_START, HERO_FADE_END, progress);
  const opacity = reveal * (1 - fadeOut);
  const lift = -18 * reveal - 34 * fadeOut;

  hero.style.opacity = opacity.toFixed(3);
  hero.style.transform = `translate(-50%, -50%) translate3d(0, ${lift.toFixed(1)}px, 0)`;
  hero.style.pointerEvents = opacity > 0.35 ? 'auto' : 'none';
  hero.setAttribute('aria-hidden', opacity > 0.05 ? 'false' : 'true');
}

function updateBibleContent(delta) {
  const chapters = [...document.querySelectorAll('.bible-chapter')];
  const overlay = document.getElementById('pageContentOverlay');
  const surface = document.getElementById('homeBibleContentSurface');
  if (!chapters.length || !overlay || !surface) return;

  const progress = journeyProgress();
  updateHeroLockout(progress);

  const reveal = smoothstep(CONTENT_REVEAL_START, CONTENT_REVEAL_END, progress);

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

function tick(now) {
  const delta = Math.min(0.05, (now - lastTime) / 1000 || 1 / 60);
  lastTime = now;
  setupEnterNavigation();
  updateBibleContent(delta);
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
