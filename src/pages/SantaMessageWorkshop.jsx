import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { StudioAccessContext } from '../lib/studioAccessContext.js';
import useWorkshopSounds from '../hooks/useWorkshopSounds.js';
import PageSeo from '../seo/PageSeo.jsx';
import { pageMetadata } from '../seo/catalogue.js';
import WorkshopNamePicker from '../components/WorkshopNamePicker.jsx';
import useSantaRecipient from '../components/useSantaRecipient.js';
import WorkshopAgeCarousel from '../components/WorkshopAgeCarousel.jsx';
import WorkshopChoiceWheel from '../components/WorkshopChoiceWheel.jsx';
import WorkshopNameSpelling from '../components/WorkshopNameSpelling.jsx';
import WorkshopWordingPreview from '../components/WorkshopWordingPreview.jsx';
import WorkshopNamePreview from '../components/WorkshopNamePreview.jsx';
import WorkshopMessageAudio from '../components/WorkshopMessageAudio.jsx';
import { createWorkshopNamePreviewCache } from '../lib/workshopNamePreviewCache.js';
import { workshopTreatWording } from '../lib/workshopTreatWording.js';
import { createStudioLetterVariation } from '../lib/santaStudioLetter.js';
import { getWorkshopWrittenName } from '../lib/workshopNameSpelling.js';
import WorkshopSearchableChoices from '../components/WorkshopSearchableChoices.jsx';
import WorkshopDestinationPicker from '../components/WorkshopDestinationPicker.jsx';
import { selectedWorkshopRegion, workshopRegionalFolders, workshopDestinationCategory, workshopDestinationLabel } from '../lib/workshopDestinations.js';
import './SantaMessageWorkshop.css';
import useStudioGeneration from '../hooks/useStudioGeneration.js';

const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function alignWorkshopBuilder(builder) {
  if (!builder) return;
  const gap = window.matchMedia('(max-width: 760px)').matches ? 6 : 16;
  const headerBottom = document.querySelector('.navbar')?.getBoundingClientRect().bottom || 0;
  builder.style.setProperty('--smw-header-clearance', `${headerBottom + gap}px`);
  const builderTop = builder.getBoundingClientRect().top;
  const top = builderTop + window.scrollY - headerBottom - gap;
  window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
}

const stages = [
  {
    key: 'name',
    label: 'Their name',
    reviewLabel: 'Their recorded name',
    heading: 'What name should Santa say?',
    wording: 'Ho ho ho, hello, Santa here… I’ve a very special message for… ah yes…',
  },
  {
    key: 'age',
    label: 'Age',
    heading: 'How old are they?',
    wording: 'Hello, Santa here… I’ve a very special message for… ah yes… {name}. But have I got the right one? Let me check your age. I believe you are…',
  },
  {
    key: 'talent',
    label: 'Talent',
    heading: 'What are they especially good at?',
    wording: 'Now, my Head Elf tells me you have quite a talent! Apparently, there’s something you’re especially good at… In particular...',
  },
  {
    key: 'activity',
    label: 'Trying hard at',
    reviewLabel: 'Trying hard at',
    heading: 'What have they been trying hard at?',
    wording: 'I’ve heard you’ve been super good, in fact, positively amazing this year… trying especially hard at…',
  },
  {
    key: 'achievement',
    label: 'Achievement',
    reviewLabel: 'Extra celebration',
    heading: 'What deserves an extra celebration?',
    wording: 'I was also delighted to hear how amazing you’ve been at…',
  },
  {
    key: 'treat',
    label: 'Treat',
    reviewLabel: 'A festive treat for Santa',
    heading: 'What might they leave Santa?',
    wording: 'We do like a little treat when we arrive on Christmas Eve… and… I know you like to leave me…',
  },
  {
    key: 'place',
    label: 'Place',
    reviewLabel: 'Santa will be flying in to',
    heading: 'Where is Santa visiting?',
    wording: 'Anyway, as I sit here reading this, Head Elf has just reminded me where we’re coming to… Ah yes…',
    note: 'The list includes countries and real places. Fantasy places and space destinations are labelled separately.',
  },
];

const explainer = [
  {
    number: '01',
    title: 'Start with their name',
    copy: 'Choose a name for Santa’s special greeting.',
    icon: <path d="M5 19c2.1-3.4 4.3-5.1 7-5.1s4.9 1.7 7 5.1M16.5 5.8a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />,
  },
  {
    number: '02',
    title: 'Add the little details',
    copy: 'Pick their age, an optional talent, something they’re working hard at and an achievement worth celebrating. Add a festive treat and a magical place, too.',
    icon: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" /></>,
  },
  {
    number: '03',
    title: 'Check your Christmas creation',
    copy: 'Review your choices and change anything before Santa’s message comes together.',
    icon: <><path d="M4 12a8 8 0 1 0 2.3-5.6L4 8.7" /><path d="M4 4v4.7h4.7M12 8v4l2.8 1.8" /></>,
  },
];

const catalogueCategories = ['age', 'activity', 'achievement', 'treat', 'place'];
const requiredCatalogueCategories = catalogueCategories;
const talentCatalogueCategories = ['sports', 'funny'];
const catalogueTimeout = 20000;

const emptyChoices = () => Object.fromEntries(stages.map(({ key }) => [key, key === 'talent' ? null : '']));

function validateWorkshopCatalogue(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
    || payload.source !== 'hosted'
    || !payload.categories || typeof payload.categories !== 'object' || Array.isArray(payload.categories)) {
    throw new Error('Santa’s hosted choice list returned an unexpected response.');
  }
  for (const field of ['counts', 'excludedAudioCounts', 'needsReviewCounts']) {
    if (!payload[field] || typeof payload[field] !== 'object' || Array.isArray(payload[field])) {
      throw new Error('Santa’s hosted choice list is incomplete. Please try again.');
    }
  }

  const categories = {};
  for (const category of [...requiredCatalogueCategories, ...talentCatalogueCategories]) {
    const optionalTalent = talentCatalogueCategories.includes(category);
    const sourceRecords = payload.categories[category];
    const absentTalent = sourceRecords === undefined && optionalTalent;
    const records = absentTalent ? [] : sourceRecords;
    if (!Array.isArray(records) || (!optionalTalent && records.length === 0) || records.length > 10000
      || (!absentTalent && payload.counts[category] !== records.length)
      || (payload.counts[category] !== undefined && payload.counts[category] !== records.length)
      || (!absentTalent && (!Number.isSafeInteger(payload.excludedAudioCounts[category]) || payload.excludedAudioCounts[category] < 0))
      || (!absentTalent && (!Number.isSafeInteger(payload.needsReviewCounts[category]) || payload.needsReviewCounts[category] < 0))) {
      throw new Error('Santa’s hosted choice list is incomplete. Please try again.');
    }
    const identities = new Set();
    categories[category] = records.map(record => {
      if (!record || typeof record !== 'object' || Array.isArray(record)
        || !['string', 'number'].includes(typeof record.id)
        || (typeof record.id === 'number' && !Number.isSafeInteger(record.id))
        || String(record.id).trim() === ''
        || (optionalTalent && (typeof record.id !== 'string' || !/^c-[a-f0-9]{64}$/.test(record.id)))
        || typeof record.label !== 'string' || !record.label.trim()
        || typeof record.file !== 'string' || !record.file.trim()) {
        throw new Error(`Santa’s hosted ${category} list contains an incomplete choice.`);
      }
      const identity = String(record.id);
      if (identities.has(identity)) {
        throw new Error(`Santa’s hosted ${category} list contains duplicate choices.`);
      }
      identities.add(identity);

      if (category === 'age') {
        const validMonth = record.unit === 'month' && Number.isInteger(record.number)
          && record.number >= 0 && record.number <= 120;
        const validYear = record.unit === 'year' && Number.isInteger(record.number)
          && record.number >= 0 && record.number <= 120;
        if (!validMonth && !validYear) {
          throw new Error('Santa’s hosted age list contains an invalid age choice.');
        }
      }
      if (category === 'place' && record.kind !== undefined
        && !['fantasy', 'space', 'place'].includes(record.kind)) {
        throw new Error('Santa’s hosted destination list contains an invalid place label.');
      }
      return record;
    });
  }

  categories.age.sort((a, b) => {
    const unitOrder = { month: 0, year: 1 };
    return unitOrder[a.unit] - unitOrder[b.unit] || a.number - b.number;
  });
  const regionalGroups = {};
  for (const [folder, parentFile] of Object.entries(workshopRegionalFolders)) {
    const group = payload.regionalGroups?.[folder];
    const parent = categories.place.find(record => record.file === parentFile);
    if (!group || !parent || group.parentId !== parent.id) continue;
    if (!Array.isArray(group.records) || group.records.length > 10000
      || group.records.some(record => !record || typeof record.id !== 'string'
        || !/^c-[a-f0-9]{64}$/.test(record.id) || typeof record.label !== 'string' || !record.label.trim()
        || typeof record.file !== 'string' || !record.file.startsWith(`${folder}/`))
      || new Set(group.records.map(record => record.id)).size !== group.records.length) continue;
    regionalGroups[folder] = group;
  }
  return { ...payload, categories, regionalGroups };
}

function getSoundStatusMessage(status) {
  const statusType = typeof status === 'string'
    ? status
    : status?.state || status?.status || status?.type || '';
  const message = typeof status === 'string'
    ? status
    : typeof status?.message === 'string'
      ? status.message
      : typeof status?.error === 'string'
        ? status.error
        : '';
  const issue = status instanceof Error
    || !!status?.blocked
    || !!status?.error
    || /error|block|fail|denied|unavailable|unlock|gesture|could not|cannot|unable/i.test(String(statusType))
    || /error|block|fail|denied|unavailable|unlock|gesture|could not|cannot|unable/i.test(message);
  if (!issue) return '';
  if (typeof status === 'string' && /^(error|blocked|failed|unavailable)$/i.test(status.trim())) {
    return 'Your browser blocked a workshop sound. You can continue without sound.';
  }
  return message || 'Your browser blocked a workshop sound. You can continue without sound.';
}

export default function SantaMessageWorkshop() {
  const accessKind = useContext(StudioAccessContext);
  const recipient = useSantaRecipient();
  // Carry only an intentional selection through same-tab navigation, never a
  // rotating example or a name saved in browser storage.
  const [initialRecipient] = useState(() => recipient || '');
  const [stageIndex, setStageIndex] = useState(0);
  const [choices, setChoices] = useState(emptyChoices);
  const [talentCategory, setTalentCategory] = useState('sports');
  const [destinationCategory, setDestinationCategory] = useState('countries');
  const [selectedName, setSelectedName] = useState(null);
  const [namePreviewCache] = useState(createWorkshopNamePreviewCache);
  // Keep a clip across other detail edits, but clear it when its recipient
  // changes or the visitor leaves Studio.
   useEffect(() => {
     const clear = () => namePreviewCache.clear();
     window.addEventListener('pagehide', clear);
     return () => { window.removeEventListener('pagehide', clear); clear(); };
   }, [namePreviewCache, selectedName?.id]);
  const [nameSpelling, setNameSpelling] = useState('');
  // Survives review unmounts while a detail is edited; never stored or name-seeded.
  const [letterVariation] = useState(createStudioLetterVariation);
  const [completedGift, setCompletedGift] = useState(null);
  const [audioPhase, setAudioPhase] = useState('idle');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [correction, setCorrection] = useState(false);
  const generation = useStudioGeneration(data => {
    if (data.record && data.choices) {
      setSelectedName(data.record);
      setChoices({ ...data.choices, name: `${data.record.name}${data.record.variant ? ` — ${data.record.variant}` : ''}` });
      setTalentCategory(data.choices.talent?.category || 'sports');
      setDestinationCategory(data.locked.category);
      setStageIndex(stages.length);
      setEditing(false);
      setCorrection(false);
    }
  });
  const locked = !!generation.state?.locked;
  const audioEditingAllowed = !locked || (correction && generation.state?.remaining > 0);
  const [catalogueRetry, setCatalogueRetry] = useState(0);
  const [catalogueState, setCatalogueState] = useState({
    status: 'loading',
    catalogue: null,
    message: '',
  });
  const {
    prepare,
    playTick,
    playNext,
    status: workshopSoundStatus,
  } = useWorkshopSounds();
  const selectedRegion = selectedWorkshopRegion(catalogueState.catalogue, choices.place, choices.region);
  const selectedCountry = catalogueState.catalogue?.categories.place.find(record => record.id === choices.place);
  const destinationSummary = selectedRegion ? `${selectedRegion.label}, ${selectedCountry.label}` : workshopDestinationLabel(selectedCountry?.label);
  const destinationValid = !!selectedCountry
    && workshopDestinationCategory(selectedCountry) === destinationCategory
    && (!choices.region || !!selectedRegion);
  const workshopSoundNotice = getSoundStatusMessage(workshopSoundStatus);
  const pageRef = useRef(null);
  const builderRef = useRef(null);
  const keyboardFocus = useRef(false);
  const nameEntryAligned = useRef(false);
  const stageHeading = useRef(null);
  const previousStageIndex = useRef(null);
  const stage = stages[stageIndex];
  const isReview = stageIndex === stages.length;
  const catalogueOptions = stage && stage.key !== 'name'
    ? catalogueState.catalogue?.categories?.[stage.key === 'talent' ? talentCategory : stage.key] || []
    : [];
  const hasCatalogueOptions = catalogueState.status === 'ready' && catalogueOptions.length > 0;
  const hasCurrentStageChoice = stage?.key === 'name'
    ? !!selectedName && !!choices.name
    : stage?.key === 'talent'
      ? choices.talent?.skip === true || (choices.talent?.category === talentCategory
        && catalogueOptions.some(record => record.id === choices.talent.id))
      : !!stage && hasCatalogueOptions && catalogueOptions.some(record => record.id === choices[stage.key]);
  const canContinue = !isReview && hasCurrentStageChoice && (stage?.key !== 'place' || destinationValid);
  const selectionKey = JSON.stringify([selectedName?.id, choices.region,
    ...catalogueCategories.map(key => choices[key]), choices.talent]);
  const giftDetailsFor = giftChoices => {
    const region = selectedWorkshopRegion(catalogueState.catalogue, giftChoices.place, giftChoices.region);
    const country = catalogueState.catalogue?.categories.place.find(record => record.id === giftChoices.place);
    const destination = region ? `${region.label}, ${country.label}` : country?.label;
    return { ...Object.fromEntries([
    ['age', 'age'], ['activity', 'activity'], ['achievement', 'achievement'],
    ['destination', 'place'], ['treats', 'treat'],
  ].map(([key, category]) => {
    const label = category === 'place' ? destination || '' : catalogueState.catalogue?.categories?.[category]
      ?.find(record => record.id === giftChoices[category])?.label || '';
    return [key, category === 'treat' ? workshopTreatWording(label)
      : category === 'place' ? label.replace(/ — (?:Fantasy place|Space destination)$/, '') : label];
  })), context: Object.fromEntries([
    ['age', 'age'], ['activity', 'activity'], ['achievement', 'achievement'],
    ['destination', 'place'], ['treats', 'treat'],
  ].map(([key, category]) => [key, category === 'place' && region
    ? region.letterContext : catalogueState.catalogue?.categories?.[category]
      ?.find(record => record.id === giftChoices[category])?.letterContext])) };
  };
  const giftDetails = giftDetailsFor(choices);
  // A confirmed previous success also unlocks its gifts after reopening Studio,
  // without requiring the MP3 to be fetched or played again.
  useEffect(() => {
    const completed = generation.state;
    if (!completed?.successes || !completed.record || !completed.choices
      || catalogueState.status !== 'ready'
      || (completedGift?.successes || 0) >= completed.successes
      || !catalogueCategories.every(key => catalogueState.catalogue.categories[key]
        ?.some(option => option.id === completed.choices[key]))) return;
    const record = completed.record;
    const completedChoices = completed.choices;
    setCompletedGift({
      selectionKey: JSON.stringify([record.id, completedChoices.region,
        ...catalogueCategories.map(key => completedChoices[key]), completedChoices.talent]),
      record: { ...record }, details: giftDetailsFor(completedChoices),
      variation: letterVariation,
      writtenName: getWorkshopWrittenName(record.name, record.id === selectedName?.id ? nameSpelling : ''),
      successes: completed.successes,
      revision: crypto.randomUUID(),
    });
  }, [generation.state, catalogueState.status, catalogueState.catalogue, completedGift?.successes,
    letterVariation, selectedName?.id, nameSpelling]);
  const giftPreparing = audioPhase === 'preparing' || audioPhase === 'receiving' || generation.state?.pending;
  const giftNotice = completedGift
        ? completedGift.selectionKey !== selectionKey
          ? 'Showing the last completed gift set, not your edited audio choices. These gifts switch only when the replacement MP3 succeeds.'
          : 'Gifts for your completed message. You can download them even when creating another message is unavailable.'
        : giftPreparing
          ? 'Preparing your MP3. Gift downloads unlock together only after it is successfully ready.'
          : audioPhase === 'error'
            ? 'MP3 preparation or playback failed. Gift downloads are disabled; retry your message.'
            : undefined;

  useEffect(() => {
    const dock = document.querySelector('.radio-dock');
    if (!dock) return;
    const updateClearance = () => {
      pageRef.current?.style.setProperty('--smw-dock-clearance', `${Math.ceil(dock.getBoundingClientRect().height) + 40}px`);
    };
    updateClearance();
    const observer = new ResizeObserver(updateClearance);
    observer.observe(dock);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, catalogueTimeout);
    setCatalogueState({ status: 'loading', catalogue: null, message: '' });

    const loadCatalogue = async () => {
      try {
        const response = await fetch('/api/santa-workshop-catalogue', {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
          if (response.status === 403) window.dispatchEvent(new Event('santa-workshop-access-change'));
          throw new Error(`Santa’s hosted choice list could not be loaded (status ${response.status}).`);
        }
        let payload;
        try {
          payload = await response.json();
        } catch {
          throw new Error('Santa’s hosted choice list returned invalid data.');
        }
        const catalogue = validateWorkshopCatalogue(payload);
        if (!controller.signal.aborted) {
          setCatalogueState({ status: 'ready', catalogue, message: '' });
        }
      } catch (failure) {
        if (controller.signal.aborted && !timedOut) return;
        setCatalogueState({
          status: 'error',
          catalogue: null,
          message: timedOut
            ? 'Santa’s hosted choice list took too long to respond. Please try again.'
            : failure instanceof Error
              ? failure.message
              : 'Santa’s hosted choice list could not be loaded. Please try again.',
        });
      } finally {
        window.clearTimeout(timeout);
      }
    };
    loadCatalogue();
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [catalogueRetry]);

  useBrowserLayoutEffect(() => {
    if (previousStageIndex.current === stageIndex) return;
    const firstLoad = previousStageIndex.current === null;
    previousStageIndex.current = stageIndex;
    // Every mobile page, including initial entry, starts at the same panel
    // position. Keep the existing desktop introduction on first load.
    if (firstLoad && !window.matchMedia('(max-width: 760px)').matches) return;
    // Reposition once, before paint. A second write on the next frame can
    // visibly fight Safari's keyboard/viewport adjustment.
    alignWorkshopBuilder(builderRef.current);
    stageHeading.current?.focus({ preventScroll: true });
  }, [stageIndex]);

  const choose = (key, value) => {
    if (!audioEditingAllowed || (locked && ['name', 'place', 'region'].includes(key))) return;
    setChoices(current => ({ ...current, [key]: value,
      ...(key === 'place' && current.place !== value ? { region: '' } : {}) }));
    setError('');
  };

  const skipTalent = () => {
    setChoices(current => ({ ...current, talent: { skip: true } }));
    setError('');
    playNext();
    setStageIndex(index => editing ? stages.length : index + 1);
    setEditing(false);
  };

  const continueToNext = () => {
    if (!canContinue) {
      setError(`Please choose ${stage.label.toLowerCase()} before continuing.`);
      return;
    }
    setError('');
    playNext();
    if (stage.key === 'treat' && !editing) {
      setDestinationCategory(workshopDestinationCategory(selectedCountry));
    }
    setStageIndex(index => editing ? stages.length : index + 1);
    setEditing(false);
  };

  const goBack = () => {
    setError('');
    if (!editing && stageIndex - 1 === stages.findIndex(item => item.key === 'place')) {
      setDestinationCategory(workshopDestinationCategory(selectedCountry));
    }
    setStageIndex(index => editing ? stages.length : Math.max(0, index - 1));
    setEditing(false);
  };

  const startAgain = () => {
    setError('');
    setEditing(false);
    nameEntryAligned.current = false;
    setStageIndex(0);
  };

  const editStage = index => {
    if (!audioEditingAllowed || (locked && ['name', 'place'].includes(stages[index]?.key))) return;
    setError('');
    if (stages[index]?.key === 'place') {
      setDestinationCategory(workshopDestinationCategory(selectedCountry));
    }
    setEditing(true);
    setStageIndex(index);
  };

  return (
    <main className="smw-page" ref={pageRef}
      onKeyDownCapture={() => { keyboardFocus.current = true; }}
      onPointerDownCapture={() => { keyboardFocus.current = false; }}
      onFocusCapture={event => {
      // The mobile browser already pans a text field into the keyboard's
      // visible area. An additional application scroll fights that movement.
      if (window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches
          && event.target.matches('input, textarea, [contenteditable="true"]')) return;
       if (stageIndex === 0 && event.target.matches('.smw-name-search') && !nameEntryAligned.current) {
        // Entering the first field starts the workshop visually, without moving
        // focus away from the input or reacting to each keystroke/result change.
         nameEntryAligned.current = true;
         alignWorkshopBuilder(builderRef.current);
      }
      if (!keyboardFocus.current) return;
      if (!event.target.matches('input, button, [role=listbox], .smw-stage-heading h3')) return;
      const control = event.target.matches('[role=listbox]')
        ? event.target.querySelector('[aria-selected=true], [role=option]') || event.target
        : event.target.closest('.smw-choice') || event.target;
      const clearance = parseFloat(getComputedStyle(pageRef.current).getPropertyValue('--smw-dock-clearance')) || 120;
      const bottom = control.getBoundingClientRect().bottom;
      if (bottom > window.innerHeight - clearance) {
        window.scrollBy({ top: bottom - window.innerHeight + clearance, behavior: 'instant' });
      }
    }}>
      <PageSeo metadata={pageMetadata({
        path: '/santa-message-workshop',
         title: 'Santa’s Message Maker Studio Preview | Santa Radio',
         description: 'Create a longer personalised recorded Santa greeting in the private Message Maker Studio.',
        noindex: true,
      })} />

      <div className="smw-shell">
        <header className={`smw-intro${accessKind === 'paid-sandbox' ? ' smw-intro-with-notice' : ''}`}>
          <div className="smw-title-wrap">
            <p className="smw-eyebrow"><span aria-hidden="true" /> A little North Pole Magic</p>
            <h1>Santa’s Message<br className="smw-title-break" /> Maker Studio</h1>
          </div>
          {accessKind === 'paid-sandbox' && <aside className="smw-preview-note" aria-label="Sandbox test notice">
            <span className="smw-preview-mark" aria-hidden="true">
              <svg viewBox="0 0 20 20" focusable="false"><path d="m10 1.5 2.2 6.3 6.3 2.2-6.3 2.2L10 18.5l-2.2-6.3-6.3-2.2 6.3-2.2L10 1.5Z" /></svg>
            </span>
            <div>
              <p>Sandbox test payment confirmed — no real money moved. You can test the Studio choices and an individual message. Family-bundle downloads and email return links are not connected yet.</p>
            </div>
          </aside>}
        </header>

        <section className="smw-builder" ref={builderRef} aria-labelledby="smw-builder-title">
          <div className="smw-builder-head">
            <div>
              <h2 id="smw-builder-title" ref={stageHeading} tabIndex="-1">
                {isReview ? 'Time to Review' : stage.heading}
              </h2>
            </div>
            <span className={`smw-step-count${canContinue ? ' smw-step-count--actionable' : ''}`} aria-live="polite">
              {isReview ? 'Step 8 of 8' : `Step ${stageIndex + 1} of ${stages.length}`}
            </span>
            {canContinue && <button className="smw-header-continue" type="button" onClick={continueToNext}
              aria-label={editing ? 'Return to review from top' : stageIndex === stages.length - 1 ? 'Continue to review' : 'Continue to next step'}>
              {editing ? 'Return to review' : 'Continue'} <span aria-hidden="true">→</span>
            </button>}
          </div>
          <div className="smw-progress" role="progressbar" aria-valuemin="1" aria-valuemax={stages.length}
            aria-valuenow={isReview ? stages.length : stageIndex + 1}
            aria-label={isReview ? 'Workshop progress: all 7 questions complete; review your message' : `Workshop progress: step ${stageIndex + 1} of ${stages.length}`}>
            {stages.map((item, index) => (
              <span
                key={item.key}
                className={`smw-progress-segment${index <= stageIndex ? ' is-complete' : ''}`}
                aria-hidden="true"
              />
            ))}
          </div>
          <ol className="smw-step-labels" aria-hidden="true">
            {stages.map((item, index) => (
              <li key={item.key} className={index === stageIndex ? 'is-current' : ''}>{item.label}</li>
            ))}
          </ol>
          {!isReview ? (
            <div className="smw-stage" key={stage.key}>
              {locked && <p role="status" className="smw-stage-note">
                {['name', 'place'].includes(stage.key)
                  ? 'The recorded name and full destination are locked to your first message.'
                  : !audioEditingAllowed ? 'Use “Edit and regenerate once” on the review to make your one correction.' : 'You are editing your one correction.'}
              </p>}
              <fieldset className="smw-stage-fields" disabled={!audioEditingAllowed || (locked && ['name', 'place'].includes(stage.key))}>
              {locked && ['name', 'place'].includes(stage.key) ? (
                <p className="smw-audio-disclaimer">{stage.key === 'name' ? choices.name : destinationSummary} — locked</p>
              ) : stage.key === 'name' ? (
                <div className="smw-activity-preview-layout smw-name-preview-layout">
                  <WorkshopNamePicker
                    initialName={initialRecipient}
                    selected={selectedName}
                    onRefreshSelection={setSelectedName}
                    invalid={!!error}
                    onSelect={record => {
                      if (record && record.id !== selectedName?.id) setNameSpelling('');
                      setSelectedName(record);
                      choose('name', record ? `${record.name}${record.variant ? ` — ${record.variant}` : ''}` : '');
                    }}
                  />
                  <WorkshopWordingPreview wording={stage.wording} selectedText={selectedName?.name || ''} />
                </div>
              ) : stage.key === 'talent' ? (
                <div className="smw-talent-step">
                  <div className="smw-talent-categories" role="group" aria-label="Choose a talent category">
                    <button type="button" className={talentCategory === 'sports' ? 'is-selected' : ''}
                      aria-pressed={talentCategory === 'sports'} onClick={() => {
                        if (talentCategory !== 'sports') {
                          setTalentCategory('sports');
                          choose('talent', null);
                        }
                      }}>Sports &amp; activities</button>
                    <button type="button" className={talentCategory === 'funny' ? 'is-selected' : ''}
                      aria-pressed={talentCategory === 'funny'} onClick={() => {
                        if (talentCategory !== 'funny') {
                          setTalentCategory('funny');
                          choose('talent', null);
                        }
                      }}>Something funny</button>
                  </div>
                  {catalogueState.status === 'loading' ? (
                    <div className="smw-catalogue-loading" role="status" aria-live="polite">
                      <span>Checking Santa’s hosted choice list…</span>
                      <span className="smw-catalogue-skeleton" aria-hidden="true" />
                    </div>
                  ) : catalogueState.status === 'error' ? (
                    <div className="smw-catalogue-error" role="alert">
                      <p>{catalogueState.message}</p>
                      <button className="smw-catalogue-retry" type="button" onClick={() => {
                        stageHeading.current?.focus({ preventScroll: true });
                        setError('');
                        setCatalogueRetry(count => count + 1);
                      }}>Retry hosted choices</button>
                    </div>
                  ) : catalogueOptions.length === 0 ? (
                    <div className="smw-activity-preview-layout">
                      <p className="smw-catalogue-empty" role="status">
                        There are no selectable talent choices in this hosted category right now.
                      </p>
                      <WorkshopWordingPreview wording={stage.wording} />
                    </div>
                  ) : (
                    <WorkshopSearchableChoices
                      key={talentCategory}
                      category={talentCategory}
                      label={talentCategory === 'sports' ? 'Sports & activities' : 'Something funny'}
                      options={catalogueOptions}
                      value={choices.talent?.category === talentCategory ? choices.talent.id : ''}
                      onChange={id => choose('talent', { category: talentCategory, id: String(id) })}
                      invalid={!!error} onTick={playTick} onSoundInteraction={prepare} wording={stage.wording}
                    />
                  )}
                </div>
              ) : catalogueState.status === 'loading' ? (
                <div className="smw-catalogue-loading" role="status" aria-live="polite">
                  <span>Checking Santa’s hosted choice list…</span>
                  <span className="smw-catalogue-skeleton" aria-hidden="true" />
                </div>
              ) : catalogueState.status === 'error' ? (
                <div className="smw-catalogue-error" role="alert">
                  <p>{catalogueState.message}</p>
                  <button
                    className="smw-catalogue-retry"
                    type="button"
                    onClick={() => {
                      stageHeading.current?.focus({ preventScroll: true });
                      setError('');
                      setCatalogueRetry(count => count + 1);
                    }}
                  >
                    Retry hosted choices
                  </button>
                </div>
              ) : catalogueOptions.length === 0 ? (
                <p className="smw-catalogue-empty" role="status">
                  There are no selectable {stage.label.toLowerCase()} choices in the hosted inventory right now.
                </p>
               ) : stage.key === 'place' ? (
                 <WorkshopDestinationPicker options={catalogueOptions}
                   category={destinationCategory}
                   onCategoryChange={category => {
                     setDestinationCategory(category);
                     choose('place', '');
                   }}
                   regionalGroups={catalogueState.catalogue.regionalGroups}
                   value={choices.place} region={choices.region || ''}
                   onChange={value => choose('place', value)} onRegionChange={value => choose('region', value)}
                   invalid={!!error} onTick={playTick} onSoundInteraction={prepare} wording={stage.wording} />
               ) : stage.wording && stage.key !== 'age' ? (
                <WorkshopSearchableChoices
                  key={stage.key}
                  category={stage.key} label={stage.label} options={catalogueOptions}
                  value={choices[stage.key]} onChange={value => choose(stage.key, value)}
                  invalid={!!error} onTick={playTick} onSoundInteraction={prepare} wording={stage.wording}
                />
              ) : stage.wording ? (
                <div className={`smw-activity-preview-layout${stage.key === 'age' ? ' smw-age-preview-layout' : ''}`}>
                  {stage.key === 'age' ? <WorkshopAgeCarousel
                    options={catalogueOptions}
                    value={choices.age}
                    onChange={value => choose('age', value)}
                    invalid={!!error}
                    onTick={playTick}
                    onSoundInteraction={prepare}
                  /> : <WorkshopChoiceWheel
                    showCount={false}
                    label={stage.label}
                    options={catalogueOptions}
                    value={choices[stage.key]}
                    onChange={value => choose(stage.key, value)}
                    invalid={!!error}
                    onTick={playTick}
                    onSoundInteraction={prepare}
                  />}
                  <WorkshopWordingPreview
                    wording={stage.wording}
                    name={selectedName?.name || ''}
                    heading={stage.key === 'activity' ? 'Santa will say:' : 'Santa will say…'}
                    selectedText={stage.key === 'age'
                      ? catalogueOptions.find(option => option.id === choices.age)?.label || ''
                      : ''}
                  />
                </div>
              ) : <WorkshopChoiceWheel
                label={stage.label}
                options={catalogueOptions}
                value={choices[stage.key]}
                onChange={value => choose(stage.key, value)}
                invalid={!!error}
                onTick={playTick}
                onSoundInteraction={prepare}
              />}
              {stage.note && <p className="smw-stage-note">{stage.key === 'place'
                ? destinationCategory === 'fantasy'
                  ? 'Choose from the recorded fantasy places and space destinations.'
                  : 'Choose from the recorded countries and real places.'
                : stage.note}</p>}
              </fieldset>
              <p className="smw-validation" id="smw-validation" role="alert">{error}</p>
              <div className="smw-actions">
                {(stageIndex > 0 || editing) && <button className="smw-button smw-button-back" type="button" onClick={goBack}>
                  <span aria-hidden="true">←</span> Back
                </button>}
                {stage.key === 'talent' && <button className="smw-button smw-button-skip" type="button" onClick={skipTalent} disabled={!audioEditingAllowed}>
                  Skip this section
                </button>}
                <button className="smw-button smw-button-next" type="button" onClick={continueToNext}
                  disabled={stage.key === 'talent' ? !hasCurrentStageChoice : stage.key !== 'name' && !hasCatalogueOptions}>
                  {editing ? 'Return to review' : stageIndex === stages.length - 1 ? 'Review my choices' : 'Continue'} <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="smw-review" key="review">
              <p className="smw-review-description">Confirm your selections. Modify any if needed.</p>
              <dl className="smw-summary">
                {stages.map((item, index) => (
                  <div className="smw-summary-row" key={item.key}>
                    <div>
                      <dt>{item.reviewLabel || item.label}</dt>
                      <dd>{item.key === 'name'
                        ? <span className="smw-name-review-value">
                            <span className="smw-summary-answer">{choices.name || 'Not chosen'}</span>
                            <WorkshopNamePreview key={selectedName?.id} record={selectedName} cache={namePreviewCache} />
                          </span>
                        : item.key === 'talent'
                          ? <span className="smw-summary-answer">{choices.talent?.skip
                              ? 'Skipped'
                              : choices.talent
                                ? `${choices.talent.category === 'sports' ? 'Sports & activities' : 'Something funny'} — ${
                                  catalogueState.catalogue?.categories?.[choices.talent.category]
                                    ?.find(record => record.id === choices.talent.id)?.label || 'This choice is no longer available.'}`
                                : 'Not chosen'}</span>
                          : <span className="smw-summary-answer">{item.key === 'place' ? destinationSummary : catalogueState.catalogue?.categories?.[item.key]
                            ?.find(record => record.id === choices[item.key])?.label
                            || 'This choice is no longer available.'}</span>}</dd>
                    </div>
                    <button type="button" className="smw-change" onClick={() => editStage(index)}
                      disabled={!audioEditingAllowed || (locked && ['name', 'place'].includes(item.key))}
                      aria-label={`Change ${item.reviewLabel || item.label}`} title={locked && ['name', 'place'].includes(item.key) ? 'Locked after your first message' : `Edit ${item.reviewLabel || item.label}`}>
                      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m16 4 4 4M4 20l4-1 12-12a2.83 2.83 0 0 0-4-4L4 15z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </dl>
              {destinationValid ? <WorkshopNameSpelling
                key={selectedName?.id}
                recordedName={selectedName?.name || ''}
                recordingId={selectedName?.id ?? ''}
                spelling={nameSpelling}
                letterVariation={letterVariation}
                giftDetails={giftDetails}
                completedGift={completedGift}
                downloadReady={!!completedGift}
                downloadNotice={giftNotice}
                onChange={spelling => {
                  setNameSpelling(spelling);
                  setCompletedGift(current => current?.record.id === selectedName?.id
                    ? { ...current, writtenName: getWorkshopWrittenName(selectedName.name, spelling) }
                    : current);
                }}
              /> : <p className="smw-stage-note" role="status">Choose a destination to preview your keepsakes.</p>}
            </div>
          )}
              <div className="smw-actions smw-actions--review" hidden={!isReview}>
                <button className="smw-button smw-button-back" type="button" onClick={startAgain}>
                  <span aria-hidden="true">←</span> Start Again
                </button>
                <WorkshopMessageAudio generation={generation} correction={correction}
                  tester={accessKind === 'tester' && generation.state?.testerCanStartAnother === true}
                  onCorrection={() => setCorrection(true)} visible={isReview}
                  record={selectedName} choices={choices} spelling={nameSpelling}
                  onPhaseChange={setAudioPhase}
                  onReady={message => {
                    const record = message?.record || selectedName;
                    const completedChoices = message?.choices || choices;
                    setCompletedGift({
                      selectionKey: JSON.stringify([record.id, completedChoices.region,
                        ...catalogueCategories.map(key => completedChoices[key]), completedChoices.talent]),
                      record: { ...record }, details: giftDetailsFor(completedChoices),
                      variation: letterVariation,
                      writtenName: getWorkshopWrittenName(record.name, record.id === selectedName?.id ? nameSpelling : ''),
                      successes: message.successes,
                      revision: crypto.randomUUID(),
                    });
                  }}
                  complete={!!selectedName && destinationValid && catalogueCategories.every(key =>
                    catalogueState.catalogue?.categories?.[key]?.some(record => record.id === choices[key]))
                    && (choices.talent?.skip === true || (choices.talent?.category
                      && catalogueState.catalogue?.categories?.[choices.talent.category]
                        ?.some(record => record.id === choices.talent.id)))}
                />
              </div>
          {workshopSoundNotice && (
            <p className="smw-sound-notice" role="status" aria-live="polite">
              {workshopSoundNotice}
            </p>
          )}
        </section>

        <section className="smw-explainer" aria-labelledby="smw-explainer-title">
          <div className="smw-explainer-heading">
            <span className="smw-rule" aria-hidden="true" />
            <h2 id="smw-explainer-title">A little Christmas magic, in three steps</h2>
            <span className="smw-rule" aria-hidden="true" />
          </div>
          <div className="smw-explainer-cards">
            {explainer.map(item => (
              <article className="smw-explainer-card" key={item.number}>
                <div className="smw-card-top">
                  <span className="smw-card-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false">{item.icon}</svg>
                  </span>
                  <span className="smw-card-number">{item.number}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </article>
            ))}
          </div>
        </section>
        <p className="smw-footer-note">
          Names come from Santa’s hosted recording library. Age, activity, achievement, treat and place choices come from Santa’s hosted file inventory. Destinations include countries and real places as well as fantasy and space choices; the supplied labels identify fantasy and space destinations. Files flagged for review are not selectable.
        </p>
      </div>
    </main>
  );
}
