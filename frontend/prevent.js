const prevent = (event) => event.preventDefault();

document.addEventListener("contextmenu", prevent);

["gesturestart", "gesturechange", "gestureend"].forEach((type) => {
  document.addEventListener(type, prevent, { passive: false });
});

document.addEventListener(
  "touchmove",
  (event) => {
    if (event.touches.length > 1) prevent(event);
  },
  { passive: false },
);

let lastTouch = 0;
document.addEventListener(
  "touchend",
  (event) => {
    const now = Date.now();
    if (now - lastTouch <= 300) prevent(event);
    lastTouch = now;
  },
  { passive: false },
);

document.addEventListener(
  "wheel",
  (event) => {
    if (event.ctrlKey) prevent(event);
  },
  { passive: false },
);

document.addEventListener(
  "keydown",
  (event) => {
    const key = event.key.toLowerCase();
    const ctrl = event.ctrlKey || event.metaKey;
    const inField =
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement;

    // Allow "select all" inside input fields, block it everywhere else.
    if (ctrl && key === "a" && inField) return;

    if (ctrl && ["+", "-", "=", "0", "f", "g", "p", "s", "u", "r", "a"].includes(key))
      prevent(event);

    // Block all function keys F1–F12.
    if (/^f([1-9]|1[0-2])$/.test(key)) prevent(event);
    if (ctrl && event.shiftKey && ["i", "j", "c"].includes(key)) prevent(event);
  },
  { passive: false },
);
