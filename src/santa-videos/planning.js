import { videoRequest } from './request.js';
const KEY = 'santa-video-detail-plan-v1';
const fields = [
  ['age', 'Age'], ['talent', 'Talent'], ['activity', 'Trying hard at'],
  ['achievement', 'Achievement'], ['treat', 'Treat for Santa'], ['place', 'Location'], ['region', 'County / state'],
];
export function setupPlanning(onAgeChange = () => {}) {
  const el = id => document.getElementById(id);
  let busy = false, catalogue, name = '', saved = { choices: {}, notes: {} };
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (parsed && typeof parsed === 'object') {
      for (const group of ['choices', 'notes']) for (const [key] of fields) {
        if (typeof parsed[group]?.[key] === 'string') saved[group][key] = parsed[group][key].slice(0, 1000);
      }
    }
  } catch { /* Work without persistence if storage is unavailable. */ }
  const selects = {}, summaries = {}, notes = {};
  const option = (value, label) => { const item = document.createElement('option'); item.value = value; item.textContent = label; return item; };
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(saved)); }
    catch { el('planning-notice').textContent = 'This browser cannot save the plan; use Copy plan to keep it.'; }
  }
  function row(key, label) {
    const tr = document.createElement('tr'), heading = document.createElement('th'), value = document.createElement('td'), idea = document.createElement('td');
    heading.scope = 'row'; heading.textContent = label; value.textContent = 'Not selected'; summaries[key] = value;
    if (key === 'name') idea.textContent = 'Centred name · 0:11–0:17 and 1:24–1:30';
    else {
      const input = document.createElement('textarea'); input.className = 'plan-note'; input.rows = 1; input.maxLength = 1000;
      input.setAttribute('aria-label', `${label}: placement or visual idea`); input.placeholder = key === 'age' ? 'Shown at 0:17–0:24 · number with age underneath' : 'e.g. show at 0:25, or beside Santa'; input.value = saved.notes[key] || '';
      input.addEventListener('input', () => { saved.notes[key] = input.value; persist(); }); idea.append(input); notes[key] = input;
    }
    tr.append(heading, value, idea); el('planning-rows').append(tr);
  }
  row('name', 'Name');
  for (const [key, label] of fields) {
    const wrapper = document.createElement('div'); wrapper.className = 'planning-field'; wrapper.id = `plan-field-${key}`;
    const heading = document.createElement('label'); heading.htmlFor = `plan-${key}`; heading.textContent = label;
    const select = document.createElement('select'); select.id = heading.htmlFor; select.disabled = true;
    select.append(option('', 'Choose when ready')); wrapper.append(heading, select); el('planning-fields').append(wrapper); selects[key] = select;
    select.addEventListener('change', () => {
      saved.choices[key] = select.value;
      if (key === 'place') { saved.choices.region = ''; updateRegions(); }
      updateSummary(); persist();
      if (key === 'age') onAgeChange();
    });
    row(key, label);
  }
  function fill(select, groups, chosen) {
    select.replaceChildren(option('', 'Choose when ready'));
    for (const [label, records] of groups) {
      if (!records.length) continue;
      const parent = label ? document.createElement('optgroup') : select;
      if (label) parent.label = label;
      for (const record of records) parent.append(option(record.id, record.label));
      if (label) select.append(parent);
    }
    select.value = chosen || ''; if (select.selectedIndex < 0) select.value = '';
    select.disabled = select.options.length <= 1 || (select === selects.age && busy);
  }
  function updateRegions() {
    const group = catalogue?.regionalGroups.find(item => item.parentId === selects.place.value);
    fill(selects.region, [['', group?.records || []]], saved.choices.region);
    saved.choices.region = selects.region.value;
    el('plan-field-region').hidden = !group?.records.length;
  }
  function updateSummary() {
    summaries.name.textContent = name || 'Choose a name above';
    for (const [key] of fields) summaries[key].textContent = selects[key].value ? selects[key].selectedOptions[0].textContent : key === 'region' && !selects.place.value ? 'Choose a location first' : key === 'region' && selects.region.disabled ? 'No regional choice for this location' : 'Not selected';
  }
  async function load() {
    el('planning-status').textContent = 'Loading the live message-maker choices…'; el('planning-retry').hidden = true;
    try {
      const response = await videoRequest('choices', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw Error('The live choices could not be loaded. Please retry.');
      const data = await response.json();
      if (!data.categories || !Array.isArray(data.regionalGroups) || ['age','sports','funny','activity','achievement','treat','place'].some(key => !Array.isArray(data.categories[key]) || data.categories[key].some(record => typeof record.id !== 'string' || typeof record.label !== 'string')) || data.regionalGroups.some(group => typeof group.parentId !== 'string' || !Array.isArray(group.records) || group.records.some(record => typeof record.id !== 'string' || typeof record.label !== 'string'))) throw Error('The choice list could not be read. Please retry.');
      catalogue = data;
      const c = catalogue.categories;
      for (const key of ['age', 'achievement', 'treat']) fill(selects[key], [['', c[key]]], saved.choices[key]);
      fill(selects.talent, [['Sports', c.sports], ['Funny talents', c.funny]], saved.choices.talent);
      fill(selects.activity, [['Trying hard at', c.activity.filter(item => item.activityGroup !== 'more-sports')], ['More sports', c.activity.filter(item => item.activityGroup === 'more-sports')]], saved.choices.activity);
      fill(selects.place, [['Countries and real places', c.place.filter(item => !['fantasy','space'].includes(item.kind))], ['Fantasy and space', c.place.filter(item => ['fantasy','space'].includes(item.kind))]], saved.choices.place);
      updateRegions(); updateSummary();
      for (const [key] of fields) saved.choices[key] = selects[key].value;
      persist(); el('planning-status').textContent = 'Live kids’ message-maker choices loaded. Choose any details you want to plan.';
    } catch {
      el('planning-status').textContent = 'The live message-maker choices are unavailable. Your notes are kept; retry to load the options.';
      el('planning-retry').hidden = false;
    }
  }
  el('planning-retry').addEventListener('click', load);
  el('planning-copy').addEventListener('click', async () => {
    const text = ['Santa video plan', `Name: ${name || 'Not selected'} — 0:11–0:17 and 1:24–1:30`, ...fields.map(([key, label]) => `${label}: ${summaries[key].textContent}${saved.notes[key] ? ` — ${saved.notes[key]}` : ''}`)].join('\n');
    try { await navigator.clipboard.writeText(text); el('planning-notice').textContent = 'Plan copied.'; }
    catch { el('planning-notice').textContent = 'Copy was blocked by the browser. You can select and copy the plan text on this page.'; }
  });
  el('planning-clear').addEventListener('click', () => {
    if (busy) return;
    saved = { choices: {}, notes: {} };
    onAgeChange();
    for (const [key] of fields) { selects[key].value = ''; notes[key].value = ''; }
    updateRegions(); updateSummary(); persist(); el('planning-notice').textContent = 'Extra details and planning notes cleared.';
  });
  updateRegions(); updateSummary(); load();
  return {
    get age() { return catalogue?.categories.age.find(item => item.id === selects.age.value) || null; },
    setDisabled(value) { busy = value; selects.age.disabled = value || selects.age.options.length <= 1; el('planning-clear').disabled = value; },
    setName(value) { name = value; updateSummary(); }
  };
}
