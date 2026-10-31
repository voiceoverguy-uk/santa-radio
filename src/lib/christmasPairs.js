export const PAIRS_PICTURES = [
  { id: 'puppy', label: 'Puppy', src: '/images/christmas-pairs/puppy.webp' },
  { id: 'burger', label: 'Burger and chips', src: '/images/christmas-pairs/burger.webp' },
  { id: 'soft-toy', label: 'Blue soft toy', src: '/images/christmas-pairs/soft-toy.webp' },
  { id: 'christmas-book', label: 'Christmas picture book', src: '/images/christmas-pairs/christmas-book.webp' },
  ...[
    ['bunbuns', 'Fluffy bunny'],
    ['cappy', 'Capybara'],
    ['carbootgoodies', 'Box of Christmas goodies'],
    ['chocolates', 'Box of chocolates'],
    ['chocolateteapot', 'Christmas teapot'],
    ['coal', 'Gift-wrapped coal'],
    ['console', 'Games console'],
    ['cracker', 'Christmas cracker'],
    ['cupcakedoll', 'Pink doll'],
    ['cushion', 'Christmas cushion'],
    ['doll', 'Christmas doll'],
    ['fluffycrocodile', 'Christmas crocodile'],
    ['gingerbread', 'Gingerbread house'],
    ['globe', 'Snow globe'],
    ['goldroll', 'Gold ribbon'],
    ['grater', 'Gift-wrapped grater'],
    ['hamsterbike', 'Hamster on a bicycle'],
    ['homework', 'Gift-wrapped homework'],
    ['jumper', 'Christmas jumper'],
    ['kazoo', 'Golden kazoo'],
    ['longtie', 'Christmas tie'],
    ['mug', 'Santa Radio mug'],
    ['northpoleair', 'Bottle of North Pole air'],
    ['pinkcowboyhat', 'Pink cowboy hat'],
    ['pram', 'Toy pram'],
    ['robot', 'Christmas robot'],
    ['rosierabbit', 'Rosie rabbit'],
    ['slippers', 'Reindeer slippers'],
    ['socks', 'Christmas socks'],
    ['sprout', 'Gift-wrapped sprout'],
    ['teddy', 'Christmas teddy'],
    ['tinchair', 'Decorative chair'],
    ['tin', 'Blue biscuit tin'],
    ['turkey', 'Christmas turkey'],
    ['windupsprout', 'Wind-up sprout'],
  ].map(([id, label]) => ({ id, label, src: `/images/christmas-pairs/${id}.webp` })),
];

export const previewDuration = level => Math.max(2000, 6000 - level * 1000);
const LEVEL_PAIRS = [3, 4, 6, 8, 10, 12];
export const pairCount = level => LEVEL_PAIRS[Math.min(Math.max(0, level - 1), LEVEL_PAIRS.length - 1)];

function shuffle(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function makePairsDeck(level, random = Math.random) {
  const pictures = shuffle(PAIRS_PICTURES, random).slice(0, pairCount(level));
  return shuffle(pictures.flatMap(picture => [0, 1].map(copy => ({
    id: `${picture.id}-${copy}`, picture,
  }))), random);
}

export const initialPairsState = {
  phase: 'idle', level: 1, cards: [], selected: [], matched: [],
  paused: false, moves: 0, remainingMs: 0, error: null,
};

export function pairsReducer(state, action) {
  switch (action.type) {
    case 'ROUND':
      return { ...initialPairsState, phase: 'loading', level: action.level, cards: action.cards };
    case 'READY':
      return state.phase === 'loading'
        ? { ...state, phase: 'preview', remainingMs: previewDuration(state.level) } : state;
    case 'ERROR':
      return state.phase === 'loading'
        ? { ...state, phase: 'error', error: 'The card pictures couldn’t load. Please retry when your connection is ready.' } : state;
    case 'PAUSE':
      return ['preview', 'playing'].includes(state.phase) ? { ...state, paused: true } : state;
    case 'TOGGLE_PAUSE':
      return ['preview', 'playing'].includes(state.phase) ? { ...state, paused: !state.paused } : state;
    case 'TICK': {
      if (state.paused || !['preview', 'playing'].includes(state.phase) || state.remainingMs <= 0) return state;
      const remainingMs = Math.max(0, state.remainingMs - action.elapsed);
      if (remainingMs) return { ...state, remainingMs };
      return { ...state, remainingMs: 0, phase: 'playing', selected: [] };
    }
    case 'FLIP': {
      if (state.phase !== 'playing' || state.paused || state.selected.length >= 2 ||
          state.selected.includes(action.id)) return state;
      const card = state.cards.find(item => item.id === action.id);
      if (!card || state.matched.includes(card.picture.id)) return state;
      if (!state.selected.length) return { ...state, selected: [card.id] };
      const first = state.cards.find(item => item.id === state.selected[0]);
      const moves = state.moves + 1;
      if (first.picture.id !== card.picture.id) {
        return { ...state, selected: [first.id, card.id], moves, remainingMs: 900 };
      }
      const matched = [...state.matched, card.picture.id];
      return {
        ...state, selected: [], matched, moves, remainingMs: 0,
        phase: matched.length === state.cards.length / 2 ? 'complete' : 'playing',
      };
    }
    default:
      return state;
  }
}
