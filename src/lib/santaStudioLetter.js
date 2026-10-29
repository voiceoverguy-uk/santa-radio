// Public-safe display labels verified against the hosted Studio inventory.
// This deliberately contains no recording paths, IDs, or gated API calls.
export const studioLetterChoices = {
  activity: ['art', 'ballet', 'bike riding', 'building Lego'],
  achievement: ['being brave', 'completing a jigsaw puzzle', 'helping others', 'finishing your homework on time'],
  destination: ['England', 'Scotland', 'Ireland', 'Wales'],
  treats: ['a beautiful note', 'a bowl of porridge', 'a box of shortbread', 'carrots for the reindeer'],
};

export function createStudioLetter(name, random = Math.random) {
  const pick = values => values[Math.floor(random() * values.length)];
  const details = Object.fromEntries(Object.entries(studioLetterChoices).map(([key, values]) => [key, pick(values)]));
  const age = 3 + Math.floor(random() * 9);
  const paragraphs = [
    `Dear ${name},`,
    'What a wonderful moment to find your name in my great big Nice List! Before the elves carry it away for our final Christmas checks, I wanted to send you a very special letter of your own.',
    `My goodness! ${age} already! There has been so much to discover, try and learn, and news of your efforts has travelled all the way to the North Pole.`,
    `I hear you have been working especially hard at ${details.activity}. That brought a lovely smile to my face. Some things take practice, a little patience and another try, and I hope you feel proud of the effort you have made.`,
    `There was something else in my notes that deserved an extra sprinkle of Christmas sparkle: ${details.achievement}. How wonderful! I gave the page a great golden star. Mrs Claus asked what I was smiling about, so naturally I had to tell her.`,
    'Here at the workshop, the elves are busy tying ribbons, polishing sleigh bells and checking that every parcel is ready for its journey. ' +
      `Meanwhile, I have been studying my Christmas Eve route, and ${details.destination} is written in my special travel book. Just thinking about the journey makes the reindeer shuffle their hooves with excitement!`,
    `I also spotted a little note about a treat you might leave for me: ${details.treats}. How thoughtful of you! It is a long night in the sleigh, and a little kindness along the way always makes it feel extra special.`,
    `Now, ${name}, remember this: you do not have to get everything right to have plenty to be proud of. Keep being curious, keep showing kindness, and keep trying the things that matter to you. Those little moments can make more magic than you know.`,
    'When Christmas Eve arrives, settle down for a cosy night and leave the flying to us. I shall be setting off with a sleigh full of surprises and a very happy heart.',
    'With a great big Christmas hug,',
  ];
  return { name, age, ...details, paragraphs,
    closing: ['The North Pole', 'P.S. Your Nice List certificate comes with my personal seal of approval. The elves do love making things official!'] };
}

export const CERTIFICATE_WRITE_MS = 1800;
export const LETTER_CHARACTER_MS = 9;
export const SIGNATURE_WRITE_MS = 1400;
export const letterBodyDuration = letter => letter.paragraphs.join('').length * LETTER_CHARACTER_MS;
export const letterDuration = letter => CERTIFICATE_WRITE_MS + letterBodyDuration(letter) + SIGNATURE_WRITE_MS;
