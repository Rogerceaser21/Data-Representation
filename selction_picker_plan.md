# Deferred plan · custom selection picker for the R3 form

> Written: 2026-06-02 (during the v0.15 → v0.16 transition)
> Status: **PARKED**, may not be needed after v0.16
> Trigger to revisit: only if you decide the Inspector cell should expose
> BOTH a searchable field AND a "select" button-style dropdown alongside
> each other (the dual-mode UI we deferred from Igor's v0.16 brief, item 5).

---

## Why this file exists

After v0.16, the R3 form has zero native `<select>` elements. Inspector,
Curriculum, and Subject are all replaced by patterns iPad Safari handles
without bugs (pill group for Curriculum, searchable input for Inspector
and Subject). So the immediate iPad problem is solved without writing a
custom dropdown.

The reason this plan is preserved on disk: Igor's brief for v0.16 item
5 mentioned wanting Inspector to support BOTH the searchable field AND a
"select" button-style picker, "until a name is selected". That dual-mode
UI requires a real custom dropdown component because the native
`<select>` cannot be made to work on iPad Safari at all.

If you ever start work on that dual-mode Inspector cell (or any other
genuine `<select>` replacement), use this document as the starting brief.

---

## Failure history that led here

Three attempts to fix the iPad Safari "first-tap doesn't open the picker"
bug on `appearance: none` styled `<select>` elements:

| Version | What it tried | Why it failed |
|---|---|---|
| v0.14 | `touch-action: manipulation`, `-webkit-user-select: none`, `-webkit-tap-highlight-color`, bigger `<select>` tap target, 16px font on coarse pointer | None of those properties control the iOS long-press text-callout. They handle different things. |
| v0.14.1 | Added `-webkit-touch-callout: none` | Documented as broken on iOS Safari since iOS 15. Confirmed still broken in iOS 26.1 per [Apple Dev Forums thread/808606](https://developer.apple.com/forums/thread/808606). WebKit silently regressed it and never repaired it. |
| v0.15 | `<button>` trigger + hidden native `<select>` + `HTMLSelectElement.showPicker()` | **Safari does not implement `showPicker()` for `<select>`**. Listed as "blocking baseline" on [Web Platform DX](https://web-platform-dx.github.io/web-features-explorer/features/show-picker-select/). Caniuse confirms. Method does not exist on iOS Safari, fallback (`focus()` + `click()`) does not open the picker either. |

The lesson: **no CSS configuration or JS API trick can make a styled
native `<select>` reliably open on iPad Safari in 2026.** The only way
to ship a dropdown that opens on first tap is to build it as a custom
component with no `<select>` underneath.

---

## The architecture that works

Same architecture React component libraries use ([Radix UI Select](https://www.radix-ui.com/primitives/docs/components/select),
[Headless UI Listbox](https://headlessui.com/react/listbox), shadcn's
Select, react-select):

```
<div class="info-cell info-cell-dropdown">
  <label id="inspector-label">Inspector</label>
  <button type="button"
          class="dropdown-trigger"
          aria-haspopup="listbox"
          aria-expanded="false"
          aria-labelledby="inspector-label"
          data-name="inspector">
    <span class="dropdown-value is-placeholder">— select —</span>
    <svg class="dropdown-chevron" aria-hidden="true">...</svg>
  </button>
  <div class="dropdown-menu" role="listbox" hidden
       aria-labelledby="inspector-label">
    <!-- Items rendered from loaded list -->
    <button type="button" role="option" class="dropdown-item"
            data-value="Hayden Ryan">Hayden Ryan</button>
    <button type="button" role="option" class="dropdown-item"
            data-value="Dave Richards">Dave Richards</button>
    ...
  </div>
  <input type="hidden" name="inspector" id="inspector" value="">
</div>
```

**No `<select>` element anywhere.** The button trigger and the listbox
div are both `<button>` / `<div>` elements. iOS Safari's text-selection
gesture never arms on these.

### Behaviour contract

| Interaction | Result |
|---|---|
| Tap trigger button | Menu opens immediately. Other open menus on the page close. |
| Tap an option | Hidden input gets `data-value`, trigger label updates, menu closes, change event dispatched on hidden input. |
| Tap outside menu | Menu closes (use `pointerdown` on `document`, like the existing Teacher search). |
| Press Escape | Menu closes, trigger keeps focus. |
| Arrow Down / Up | Move highlight through options. Wrap at ends. |
| Home / End | Highlight first / last. |
| Enter / Space on highlighted | Commit selection, close menu. |
| Type a letter | Jump to first option whose label starts with that letter. |
| Tab | Close menu (if open) and move focus to next field. |

### CSS sketch

Reuse existing tokens (`--card-bg`, `--rule`, `--paper`, `--surface-mid`,
etc.). The trigger should look identical to a current `.info-cell` value
text (display-font, focus underline in success-green). The menu should
look like the existing `.searchable-list` (positioned absolute below the
trigger, max-height with scroll, hover/selected states).

```css
.info-cell-dropdown { position: relative; }
.dropdown-trigger { /* mirror .select-trigger from v0.15 */ }
.dropdown-trigger[aria-expanded="true"] .dropdown-chevron { transform: rotate(180deg); }
.dropdown-menu {
  /* same as .searchable-list */
  position: absolute;
  top: 100%; left: 0; right: 0;
  max-height: 280px;
  overflow-y: auto;
  background: var(--card-bg);
  border: 1px solid var(--rule);
  border-radius: 0 0 0.4rem 0.4rem;
  box-shadow: 0 12px 28px -12px rgba(20, 54, 66, 0.22);
  z-index: 30;
}
.dropdown-item { /* button reset + .searchable-item layout */ }
.dropdown-item[aria-selected="true"] { /* highlighted state */ }
@media (hover: hover) {
  .dropdown-item:hover { background: var(--surface-mid); }
}
```

### JS sketch (~80-100 lines for a reusable component)

```js
function setupDropdown(name, getItems, opts = {}) {
  const wrap = document.querySelector(`.info-cell-dropdown[data-name="${name}"]`);
  const trigger = wrap.querySelector('.dropdown-trigger');
  const menu = wrap.querySelector('.dropdown-menu');
  const hidden = wrap.querySelector(`input[type="hidden"][name="${name}"]`);
  const valueLabel = trigger.querySelector('.dropdown-value');
  const placeholder = opts.placeholder || '— select —';
  let highlightedIdx = -1;

  function open() {
    rebuild();
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    highlightedIdx = findIndexByValue(hidden.value);
    paintHighlight();
  }
  function close() {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  }
  function rebuild() {
    const items = getItems() || [];
    menu.innerHTML = items.map((it, i) => {
      const v = opts.value ? opts.value(it) : String(it);
      const d = opts.display ? opts.display(it) : String(it);
      return `<button type="button" role="option" class="dropdown-item"
              data-value="${escapeHtml(v)}" data-idx="${i}"
              aria-selected="${v === hidden.value}">${escapeHtml(d)}</button>`;
    }).join('');
  }
  function commit(value, display) {
    hidden.value = value;
    valueLabel.textContent = display || value || placeholder;
    valueLabel.classList.toggle('is-placeholder', !value);
    close();
    trigger.focus();
    hidden.dispatchEvent(new Event('change', { bubbles: true }));
  }

  trigger.addEventListener('click', () => {
    if (FORM.classList.contains('is-locked')) return;
    menu.hidden ? open() : close();
  });
  menu.addEventListener('pointerdown', e => {
    const item = e.target.closest('.dropdown-item');
    if (!item) return;
    e.preventDefault();
    commit(item.dataset.value, item.textContent);
  });
  document.addEventListener('pointerdown', e => {
    if (!menu.hidden && !wrap.contains(e.target)) close();
  });
  trigger.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      if (menu.hidden) { open(); e.preventDefault(); }
    } else if (e.key === 'Escape') {
      close();
    }
  });
  menu.addEventListener('keydown', e => {
    // arrow nav, enter to commit highlighted, escape, type-to-jump
    // (~30 lines, modelled on Radix Select keyboard behaviour)
  });
}
```

### Accessibility checklist (must pass before shipping)

- [ ] VoiceOver on iPad: trigger announces label, current value, "popup, list box, collapsed/expanded"
- [ ] Keyboard: Tab lands on trigger, Enter opens, arrows navigate, Enter commits, Escape closes
- [ ] Type-to-jump: typing a letter highlights first matching option
- [ ] No `<select>` anywhere in the cell
- [ ] Hidden `<input>` carries the value for form submission
- [ ] Click outside closes
- [ ] Multiple dropdowns on the page: opening one closes others

---

## When to revisit this plan

Triggers:
1. Igor explicitly asks for the dual-mode Inspector UI (searchable + dropdown trigger together)
2. A new field is added that genuinely needs a `<select>` semantic (large fixed list, keyboard-first usage) and the searchable + pill patterns don't fit
3. A future iOS Safari version actually implements `HTMLSelectElement.showPicker()` AND the long-press regression is fixed — at which point we could reconsider native selects, but this plan would still be the safer default

When you revisit:
- Audit current iOS Safari version and re-check [WebKit Bug 261703](https://bugs.webkit.org/show_bug.cgi?id=261703) and [Web Platform DX feature page](https://web-platform-dx.github.io/web-features-explorer/features/show-picker-select/) to see if the situation has changed.
- The searchable Teacher / Inspector / Subject components after v0.16 are existence proofs that this pattern works on Igor's iPad. Lift their event-handling patterns (`pointerdown` for commit, document `pointerdown` for outside-click) into the dropdown component.
- The first dropdown should be the Inspector dual-mode UI per Igor's brief. Use a feature flag or per-cell opt-in so other cells stay on the searchable pattern unless explicitly migrated.

---

## Sources / further reading

- [WebKit Bug 231161 · -webkit-user-select: none regression](https://bugs.webkit.org/show_bug.cgi?id=231161)
- [WebKit Bug 261703 · showPicker not implemented on iOS](https://bugs.webkit.org/show_bug.cgi?id=261703)
- [Apple Dev Forums thread/808606 · webkit-touch-callout broken iOS 26.1](https://developer.apple.com/forums/thread/808606)
- [Web Platform DX · showPicker for select](https://web-platform-dx.github.io/web-features-explorer/features/show-picker-select/)
- [caniuse · HTMLSelectElement.showPicker](https://caniuse.com/mdn-api_htmlselectelement_showpicker)
- [Radix UI Primitives #2673 · why not hidden native select](https://github.com/radix-ui/primitives/issues/2673)
- [Radix UI Select source](https://github.com/radix-ui/primitives/tree/main/packages/react/select)
- [Headless UI Listbox docs](https://headlessui.com/react/listbox)
