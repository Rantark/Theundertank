// Fullscreen that works both in the desktop app (via the Electron bridge) and in browsers.
export function setFullscreen(on) {
  const desk = window.undercrankDesktop;
  if (desk?.setFullscreen) {
    desk.setFullscreen(on);
    return;
  }
  const doc = document;
  const apply = () => {
    try {
      if (on && !doc.fullscreenElement) doc.documentElement.requestFullscreen?.().catch(() => armOnNextGesture());
      if (!on && doc.fullscreenElement) doc.exitFullscreen?.().catch(() => {});
    } catch {
      armOnNextGesture();
    }
  };
  // Browsers only allow fullscreen right after a user gesture; if the request is refused,
  // retry on the next click or key press.
  const armOnNextGesture = () => {
    const once = () => {
      window.removeEventListener('pointerdown', once, true);
      window.removeEventListener('keydown', once, true);
      if (on && !doc.fullscreenElement) doc.documentElement.requestFullscreen?.().catch(() => {});
    };
    window.addEventListener('pointerdown', once, true);
    window.addEventListener('keydown', once, true);
  };
  apply();
}
