// Owner-approved membership, not an extension-based or inferred sport classifier.
// Exact case, spacing and source identities are intentional.
export const moreSportsFiles = new Set([
  'American Football', 'Athletics', 'Badminton', 'Ballet', 'Baseball', 'Basketball',
  'Boxing', 'Cheerleading', 'Climbing', 'Cricket', 'Cycling', 'Dancing', 'Diving',
  'Dodgeball', 'Farting', 'Fencing', 'Field Hockey', 'Football', 'Gaming', 'Golf',
  'Gymnastics', 'Hockey', 'Horse Riding', 'Ice Hockey', 'Ice Skating', 'Judo',
  'Karate', 'Kick Boxing', 'Martial Arts', 'Netball', 'Paddleboarding', 'Padel',
  'Pickle Ball', 'Racket Sports', 'Roller Skating', 'Rounders', 'Rowing', 'Rugby',
  'Rugbyu', 'Running', 'Sailing', 'Skiing', 'Snowboarding', 'Soft Ball', 'Surfing',
  'Swimming', 'Table Tennis', 'Team Sports', 'Tennis', 'Untitled 1Judo',
  'Volley Ball', 'Wrestling', 'archery', 'fishing', 'taekwondo', 'trampolining',
].map(stem => `Trying Hard at/${stem}.mp3`));
