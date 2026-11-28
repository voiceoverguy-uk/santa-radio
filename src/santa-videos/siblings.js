export function setupSiblings(onChange) {
  const input = document.getElementById('sibling-name');
  const list = document.getElementById('sibling-list');
  const status = document.getElementById('sibling-status');
  const add = document.getElementById('sibling-add');
  let names = [], disabled = false;
  function render() {
    list.replaceChildren();
    names.forEach((name, index) => {
      const chip = document.createElement('li'), label = document.createElement('span'), remove = document.createElement('button');
      label.textContent = name; remove.type = 'button'; remove.textContent = '×'; remove.className = 'secondary'; remove.disabled = disabled;
      remove.setAttribute('aria-label', `Remove sibling ${name}`);
      remove.addEventListener('click', () => { names.splice(index, 1); render(); onChange(); input.focus(); });
      chip.append(label, remove); list.append(chip);
    });
    input.disabled = disabled || names.length === 5; add.disabled = input.disabled;
    status.textContent = `${names.length} of 5 siblings added. ${names.length === 5 ? 'Remove a name to add another.' : 'Press Enter after each name.'}`;
  }
  function addName() {
    const name = input.value.trim().replace(/\s+/g, ' ');
    if (disabled || !name || names.length >= 5) return;
    if (names.some(item => item.toLocaleLowerCase() === name.toLocaleLowerCase())) { status.textContent = 'That sibling is already added.'; return; }
    names.push(name); input.value = ''; render(); onChange(); if (!input.disabled) input.focus();
  }
  input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); addName(); } });
  add.addEventListener('click', addName);
  render();
  return { get value() { return [...names]; }, get pending() { return !!input.value.trim(); }, focus() { input.focus(); }, setDisabled(value) { disabled = value; render(); } };
}
