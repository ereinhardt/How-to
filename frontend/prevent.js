const prevent = (event) => event.preventDefault();

// Allow only vertical scrolling, no pinch-zoom (touch-action is not inherited,
// so it must be applied to every element). overscroll-behavior stops pull-to-
// refresh and scroll-chaining, both unwanted in an exhibition/kiosk context.
const style = document.createElement("style");
style.textContent =
  "* { touch-action: pan-y; }" + "html, body { overscroll-behavior: none; }";
document.head.appendChild(style);

// Disable browser autocomplete / suggestions, autocorrect and spellcheck on inputs.
document.querySelectorAll("input").forEach((input) => {
  input.setAttribute("autocomplete", "off");
  input.setAttribute("autocorrect", "off");
  input.setAttribute("autocapitalize", "off");
  input.setAttribute("spellcheck", "false");
});

document.addEventListener("contextmenu", prevent);

// Block dragging content out (images/text/links) and dropping files into the page.
["dragstart", "dragover", "drop"].forEach((type) => {
  document.addEventListener(type, prevent, { passive: false });
});

// Block middle-click (auto-scroll / open-in-new-tab) and other non-left buttons.
document.addEventListener("auxclick", (event) => {
  if (event.button !== 0) prevent(event);
});

["gesturestart", "gesturechange", "gestureend"].forEach((type) => {
  document.addEventListener(type, prevent, { passive: false });
});

document.addEventListener(
  "touchstart",
  (event) => {
    if (event.touches.length > 1) prevent(event);
  },
  { passive: false },
);

document.addEventListener(
  "touchmove",
  (event) => {
    // Multi-touch, or an iOS pinch gesture (scale is iOS-only and 1 while scrolling).
    if (event.touches.length > 1 || (event.scale && event.scale !== 1))
      prevent(event);
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

    if (
      ctrl &&
      ["+", "-", "=", "0", "f", "g", "p", "s", "u", "r", "a"].includes(key)
    )
      prevent(event);

    // Block all function keys F1–F12.
    if (/^f([1-9]|1[0-2])$/.test(key)) prevent(event);
    if (ctrl && event.shiftKey && ["i", "j", "c"].includes(key)) prevent(event);

    // Block history navigation: Alt+Left/Right and Backspace outside inputs.
    if (event.altKey && ["arrowleft", "arrowright"].includes(key))
      prevent(event);
    if (key === "backspace" && !inField) prevent(event);
  },
  { passive: false },
);
