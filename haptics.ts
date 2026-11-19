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

export function haptic(pattern: 'tap' | 'success' | 'error' = 'tap'): void {
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern === 'error' ? [12, 60, 12] : pattern === 'success' ? 18 : 8);
      return;
    }
    const l = iosSwitch();
    l.click();
    if (pattern === 'error') setTimeout(() => l.click(), 90);
  } catch { /* no haptics available */ }
}
