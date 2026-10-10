export function setupPreferences() {
  document.querySelector('.skip-link').addEventListener('click', e => { e.preventDefault(); const main = document.getElementById('main-content'); main.focus({preventScroll:true}); main.scrollIntoView(); });
  const root = document.documentElement, font = document.getElementById('font-choice'), theme = document.getElementById('theme');
  const settings = document.getElementById('site-settings'), trigger = settings.querySelector('summary');
  const restoreFont = () => { root.dataset.font = globalThis.rotationFontPreference.read(); font.value = root.dataset.font; };
  restoreFont();
  font.addEventListener('change', () => globalThis.rotationFontPreference.save(font.value));
  font.addEventListener('input', () => globalThis.rotationFontPreference.save(font.value));
  window.addEventListener('pageshow', restoreFont);
  window.addEventListener('storage', e => { if (e.key === 'map-rotation-font') restoreFont(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) restoreFont(); });
  let preference = 'auto';
  try { const saved = localStorage.getItem('map-rotation-theme'); if (['auto', 'light', 'dark'].includes(saved)) preference = saved; } catch {}
  theme.value = preference;
  const media = matchMedia('(prefers-color-scheme: dark)');
  const applyTheme = () => { root.dataset.theme = preference === 'auto' ? media.matches ? 'dark' : 'light' : preference; };
  theme.addEventListener('change', () => { preference = theme.value; try { localStorage.setItem('map-rotation-theme', preference); } catch {} applyTheme(); });
  media.addEventListener('change', applyTheme); applyTheme();
  settings.addEventListener('toggle', () => trigger.setAttribute('aria-expanded', String(settings.open)));
  document.addEventListener('pointerdown', e => { if (!settings.contains(e.target)) settings.open = false; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && settings.open) { settings.open = false; trigger.focus(); } });
  settings.addEventListener('focusout', e => { if (e.relatedTarget && !settings.contains(e.relatedTarget)) settings.open = false; });
}
export function showNotice(message) {
  const notice = document.getElementById('site-notice');
  notice.textContent = message; notice.hidden = false;
  clearTimeout(showNotice.timer);
  showNotice.timer = setTimeout(() => { notice.hidden = true; }, 6000);
}
