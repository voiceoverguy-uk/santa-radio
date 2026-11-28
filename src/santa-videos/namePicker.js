import { loadBrowserSantaNames, matchBrowserSantaNames } from '../lib/browserSantaNames.js';
import { santaNameDisplay } from '../lib/santaNameSearch.js';

export function setupNamePicker(onChange) {
  const input = document.getElementById('name-search');
  const list = document.getElementById('name-results');
  const status = document.getElementById('name-status');
  const retry = document.getElementById('name-retry');
  const clear = document.getElementById('name-clear');
  let selected = '', matches = [], activeIndex = -1, revision = 0, disabled = false;
  function close() {
    list.hidden = true; input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant'); activeIndex = -1;
  }
  function choose(record) {
    if (disabled) return;
    revision++; selected = santaNameDisplay(record.name); input.value = selected;
    status.textContent = `${selected} will appear on the parchment at 0:11–0:17 and again at 1:24–1:30.`;
    retry.hidden = true; clear.hidden = false; close(); onChange();
  }
  async function search() {
    const version = ++revision;
    close(); retry.hidden = true;
    if (selected || disabled) return;
    if ([...input.value.trim()].length < 2) {
      status.textContent = input.value ? 'Type at least two letters, then choose a name.' : 'Optional: choose a name from the live kids’ message-maker list.';
      return;
    }
    status.textContent = 'Loading Santa’s live name list…';
    try {
      const names = await loadBrowserSantaNames();
      if (version !== revision || disabled) return;
      matches = matchBrowserSantaNames(names, input.value);
      list.replaceChildren();
      for (const [index, record] of matches.entries()) {
        const option = document.createElement('li');
        option.id = `video-name-option-${index}`; option.role = 'option'; option.setAttribute('aria-selected', 'false');
        option.textContent = santaNameDisplay(record.name);
        option.addEventListener('pointerdown', event => event.preventDefault());
        option.addEventListener('click', () => choose(record)); list.append(option);
      }
      list.hidden = !matches.length; input.setAttribute('aria-expanded', String(!!matches.length));
      status.textContent = matches.length ? `Choose a match from ${names.length.toLocaleString('en-GB')} live names.` : 'No matching name. Try fewer letters or another spelling.';
    } catch (error) {
      if (version !== revision) return;
      status.textContent = error.name === 'AbortError' ? 'Loading names took too long. Please retry.' : error.message;
      retry.hidden = false;
    }
  }
  input.addEventListener('input', () => { selected = ''; clear.hidden = !input.value; onChange(); search(); });
  input.addEventListener('focus', search);
  input.addEventListener('blur', () => setTimeout(close, 120));
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') { revision++; close(); return; }
    if (list.hidden || event.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const down = event.key === 'ArrowDown';
      activeIndex = activeIndex < 0 ? (down ? 0 : matches.length - 1) : (activeIndex + (down ? 1 : -1) + matches.length) % matches.length;
      [...list.children].forEach((item, index) => item.setAttribute('aria-selected', String(index === activeIndex)));
      input.setAttribute('aria-activedescendant', list.children[activeIndex].id);
      list.children[activeIndex].scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter' && activeIndex >= 0) { event.preventDefault(); choose(matches[activeIndex]); }
  });
  retry.addEventListener('click', search);
  clear.addEventListener('click', () => {
    selected = ''; input.value = ''; revision++; clear.hidden = true; retry.hidden = true; close(); onChange();
    status.textContent = 'No name caption selected.'; input.focus();
  });
  return {
    get value() { return selected; },
    get hasUnselectedQuery() { return !!input.value.trim() && !selected; },
    focus: () => input.focus(),
    setDisabled(value) {
      disabled = value; input.disabled = value; retry.disabled = value; clear.disabled = value;
      if (value) { revision++; close(); }
    },
  };
}
