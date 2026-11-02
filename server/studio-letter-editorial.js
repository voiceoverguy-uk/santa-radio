import { destinationPassages } from './studio-destination-passages.js';
// Server-only editorial index. Never import this full choice mapping into the
// browser: the hosted catalogue remains behind the existing Studio access gate.
const key = value => value.normalize('NFC').trim().toLocaleLowerCase('en-GB').replace(/'/g, '’');
const index = groups => Object.fromEntries(Object.entries(groups).flatMap(([group, labels]) =>
  labels.split('|').map(label => [key(label), group])));

const activities = index({
  target: 'Archery|Golf',
  art: 'Art|Arts & crafts|Crafting|Drawing|Drawing with chalk|Learning to draw|Making art projects|Painting|Painting rocks',
  cooking: 'Baking & cooking|Baking cakes|Cooking',
  dance: 'Ballet|Dancing',
  team: 'Basketball|Football|Netball|Playing football|Teamwork',
  courtesy: 'Being respectful|Listening to parents|Practising manners',
  wheels: 'Bike riding|Cycling|Riding a scooter|Roller skating|Skateboarding',
  play: 'Blowing bubbles|Building sandcastles|Playing catch|Playing hide and seek|Playing in the snow|Playing playdough|Playing tag',
  building: 'Building lego|Woodwork',
  games: 'Candy crush|Minecraft|Playing board games|Playing on iPad|Watching tv',
  puzzles: 'Chess|Jigsaw puzzles|Playing puzzles|Problem solving|Puzzles',
  tidying: 'Cleaning|Helping round the house|Keeping room tidy|Tidying away toys|Tidying up',
  movement: 'Climbing|Exercising|Gymnastics|Hula hooping|Keeping active & healthy|Racket sports|Running|Skipping|Snowboarding|Sports|Trampolining|Yoga',
  code: 'Coding|Programming|Technology',
  writing: 'Creative writing|Making up stories|Storytelling|Writing',
  festive: 'Decorating|Decorating for christmas',
  environment: 'Enviromental awareness|Litter picking|Recycling|Saving the planet',
  nature: 'Exploring nature|Feeding the birds|Feeding the ducks|Fishing',
  garden: 'Gardening|Helping in the garden',
  study: 'Geography|History|Homework|Mathematics|Mathletics|School|School clubs|School work|Science|Tt rocksstars',
  kindness: 'Helping others|Helping the homeless|Kindness|Taking care of siblings|Volunteering',
  martial: 'Karate|Martial arts',
  language: 'Learning a new language|Learning colours|Learning letters|Learning to count|Learning to talk',
  music: 'Learning new songs|Piano playing|Playing your musical instrument|Singing|Singing christmas carols',
  sharing: 'Learning to share|Sharing|Taking turns',
  friends: 'Making friends|Socialising',
  calm: 'Mindfulness',
  care: 'Personal hygiene',
  animals: 'Pet care|Pets',
  reading: 'Reading|Reading books|Reading picture books',
  stage: 'Drama|Public speaking',
  saving: 'Saving money',
  video: 'Tik tok videos|Video editing',
  swimming: 'Swimming',
});

const achievements = index({
  brave: 'Being brave',
  siblings: 'Being patient with your siblings|Looking after little brother|Looking after little sister',
  building: 'Building something awesome with lego',
  home: 'Cleaning your room all by yourself|Helping around the house|Helping your daddy|Helping your mummy',
  puzzle: 'Completing a jigsaw puzzle',
  sport: 'Doing well in sports day|Riding your bike|Started new sport',
  exams: 'Doing well in your exams',
  art: 'Drawing great pictures',
  homework: 'Finishing your homework on time',
  helping: 'Helping others|Helping your teacher',
  cooking: 'Helping to cook dinner',
  skill: 'Learning a new skill|Learning to tie your shoelaces|Started new hobby',
  swimming: 'Learning to swim',
  numbers: 'Learning your times tables',
  friends: 'Making new friends',
  stage: 'Performing in a school play',
  garden: 'Planting and caring for a garden',
  music: 'Practising your musical instrument|Singing lessons going great',
  reading: 'Reading your first book',
  saving: 'Saving your pocket money',
  school: 'School',
  sharing: 'Sharing your toys with others',
  starting: 'Starting nursery|Starting school',
  animals: 'Taking care of your pet',
  prize: 'Winning a prize at school',
  writing: 'Writing your first story',
});

const treats = index({
  food: 'Bag of nuts|Baklava|Bowl of porridge|Box of shortbread|Bûche de Noël|Candy canes|Carrot cake|Cheese|Cheese and crackers|Chewing gum|Chocolate|Chocolate coins|Christmas cookie|Christmas pan de jamon|Christmas pudding slice|Cinnamon roll|Cookie biscuit|Cookie mince pie|Cupcakes|Dulce de leche|Favourite snack|Festive brownie|Festive doughnut|Fruit|Fruit cake slice|Fruitcake cookie|Ginger cake|Gingerbread house|Gingerbreadman|Hot churros|Jar of honey|Kanelbulle|Leftover dinner|Lots of chocolate|Macarons|Milk and a candy cane|Mince pie|Mini mince pie|Packet of crisps|Pavlova slice|Pfeffernüsse|Piece of fudge|Pizza slice|Plate of biscuits|Rosca de reyes|Shortcake|Slice cake|Slice of yule log|Speculoos cookies|Stollen slice|Terrys choc orange|Turrón|Whole cheeseboard',
  drink: 'Bottle of fizzy pop|Coconut milk|Cup of coffee|Cup of tea|Favourite drink|Glass milk|Hot chocolate|Instant coffee',
  alcohol: 'Box of wine|Crate of beer|Cup of mulled wine|Glass of baileys|Glass of wine|Glass whisky|Glühwein|Hot mulled cider|Little beer|Pint of lager|Santa’s sake',
  rumCake: 'Rum cake',
  energy: 'Energy drink',
  letter: 'Beautiful note|Lovely letter',
  reindeer: 'Carrots for reindeer|Packet of reindeer food|Some carrots',
  practical: 'Ear plugs|Hand sanitiser|Hot water bottle|Map|Reusable shopping bag|Slippers|Stress ball|Sunglasses|Torch|Travel bag|Warm blanket for the sleigh',
  amusement: 'Christmas cracker|Crossword puzzle|Joke book',
  socks: 'Smelly socks',
  rubbish: 'Your rubbish',
  coal: 'Lump of coal',
});

// An explicit allow-list, not a claim about countries, borders, weather or customs.
const realPlaces = new Set(('England|Scotland|Ireland|Wales|United States|Andorra|Antarctica|Argentina|Aruba|Australia|Austria|Bahamas|Barbados|Belgium|Bermuda|Bhutan|Botswana|Brunei|Bulgaria|Canada|Cayman Islands|Chile|China|Costa Rica|Croatia|Cyprus|Denmark|Dubai|Egypt|Estonia|Eswatini|Faroe Islands|France|Germany|Gibraltar|Greece|Greenland|Guernsey|Hong Kong|Hungary|Iceland|India|Indonesia|Iraq|Isle of Man|Italy|Japan|Jersey|Jordan|Kenya|Kuwait|Latvia|Lebanon|Liechtenstein|Lithuania|Luxembourg|Maldives|Malta|Mauritius|Mexico|Monaco|Montenegro|Montserrat|Mozambique|Namibia|Netherlands|New Zealand|Nicaragua|Nigeria|Northern Ireland|Oman|Palestine|Papua New Guinea|Philippines|Poland|Portugal|Puffin Island|Qatar|Romania|San Marino|Seychelles|Slovakia|South Africa|Spain|Sri Lanka|Sweden|Switzerland|Taiwan|Thailand|Tonga|Trinidad and Tobago|Turkey|United Arab Emirates|Us Virgin Islands|Uzbekistan|Vietnam|Western Sahara|Yemen|Yorkshire|Zimbabwe').split('|').map(key));
realPlaces.add('falkland islands');
const fantasyPlaces = new Set(('Atlantis|Camelot|Cloud Cuckoo Land|Discworld|Emerald City|Hundred Acre Wood|Jurassic Island|Middle Earth|Narnia|Neverland|Oz|Pandora|Radiator Springs|Sodor|The Enchanted Forest|Whoville|Wonderland').split('|').map(key));
const spacePlaces = new Set(['mars', 'the moon']);

export function studioEditorialContext(category, record) {
  const label = key(record.label.replace(/ — (?:Fantasy place|Space destination)$/, ''));
  let group;
  if (category === 'age') {
    group = record.unit === 'month' ? 'months'
      : record.number <= 5 ? 'young' : record.number <= 12 ? 'child'
        : record.number <= 17 ? 'teen' : record.number === 18 ? 'eighteen' : 'adult';
  } else if (category === 'place') {
    group = realPlaces.has(label) ? 'real' : fantasyPlaces.has(label) ? 'fantasy'
      : spacePlaces.has(label) ? 'space' : undefined;
  } else {
    group = ({ activity: activities, achievement: achievements, treat: treats })[category]?.[label];
  }
  if (category === 'place' && group === 'real') {
    const passages = destinationPassages[label];
    return passages ? { group, needsReview: false, passages }
      : { group: 'neutral', needsReview: true };
  }
  return { group: group || 'neutral', needsReview: !group };
}

// For private audit tooling and Node tests only, never a public endpoint.
export const studioEditorialGroups = { activity: activities, achievement: achievements, treat: treats };
