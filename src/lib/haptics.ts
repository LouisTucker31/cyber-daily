/* Light haptic tap.
   Android: the Vibration API.
   iPhone (iOS 18+): Safari has no vibration API, but toggling a native
   <input type="checkbox" switch> plays the system haptic, so we tap a hidden one.
   Anywhere else this quietly does nothing. */

let label: HTMLLabelElement | null = null;

function iosSwitch(): HTMLLabelElement {
  if (label) return label;
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.id = 'haptic-switch';
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');
  label = document.createElement('label');
  label.htmlFor = input.id;
  label.setAttribute('aria-hidden', 'true');
  label.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;left:-100px;';
  label.appendChild(input);
  document.body.appendChild(label);
  return label;
}

/* firm = a stronger version (used in the last seconds of Acronym Blitz) */
export function haptic(pattern: 'tap' | 'success' | 'error' = 'tap', firm = false): void {
  try {
    if (typeof navigator.vibrate === 'function') {
      if (firm) navigator.vibrate(pattern === 'error' ? [30, 50, 30] : pattern === 'success' ? 40 : 20);
      else navigator.vibrate(pattern === 'error' ? [12, 60, 12] : pattern === 'success' ? 18 : 8);
      return;
    }
    // iOS taps can't be made stronger, so a firm one is an extra tap
    const l = iosSwitch();
    const taps = (pattern === 'error' ? 2 : 1) + (firm ? 1 : 0);
    for (let i = 0; i < taps; i++) {
      if (i === 0) l.click();
      else setTimeout(() => l.click(), i * (firm ? 70 : 90));
    }
  } catch { /* no haptics available */ }
}
