// Each credit supplies the same recognisable scene from two different angles.
const credits = [
  ['Home Alone','Macaulay Culkin','Kevin McCallister','Kevin','sets traps for the burglars'],
  ['Home Alone','Catherine O’Hara','Kate McCallister','Kevin’s mum','races home to her son'],
  ['Home Alone','John Heard','Peter McCallister','Kevin’s dad','is Kevin’s father'],
  ['Home Alone','Devin Ratray','Buzz McCallister','Buzz','keeps a pet tarantula'],
  ['Home Alone','Joe Pesci','Harry Lyme','Harry','burns his hand on a door handle'],
  ['Home Alone','Daniel Stern','Marv Murchins','Marv','steps barefoot onto a nail'],
  ['Elf','Will Ferrell','Buddy','Buddy the Elf','puts syrup on spaghetti'],
  ['Elf','James Caan','Walter Hobbs','Walter','works in publishing and discovers he has a grown-up son'],
  ['Elf','Zooey Deschanel','Jovie','','sings in the department store shower'],
  ['Elf','Bob Newhart','Papa Elf','','raises a human child at the North Pole'],
  ['The Santa Clause','Tim Allen','Scott Calvin','Scott','puts on Santa’s suit after Santa falls off the roof'],
  ['The Santa Clause','David Krumholtz','Bernard','Bernard the Elf','explains the Santa Clause to Scott'],
  ['The Santa Clause','Eric Lloyd','Charlie Calvin','Charlie','joins his dad on the sleigh on Christmas Eve'],
  ['The Muppet Christmas Carol','Michael Caine','Ebenezer Scrooge','Scrooge','employs Kermit’s Bob Cratchit'],
  ['The Grinch','Benedict Cumberbatch','The Grinch','Grinch','steals presents with the help of a dog called Max'],
  ['How the Grinch Stole Christmas','Jim Carrey','The Grinch','Grinch','wears a Santa disguise to steal Christmas in Whoville'],
  ['How the Grinch Stole Christmas','Taylor Momsen','Cindy Lou Who','Cindy Lou','befriends the green recluse on Mount Crumpit'],
  ['Die Hard','Bruce Willis','John McClane','McClane','fights barefoot in Nakatomi Plaza'],
  ['Die Hard','Alan Rickman','Hans Gruber','Hans','takes hostages at a Christmas office party'],
  ['Love Actually','Hugh Grant','David','the Prime Minister','dances around Downing Street'],
  ['Love Actually','Bill Nighy','Billy Mack','Billy','records Christmas Is All Around'],
  ['Love Actually','Emma Thompson','Karen','','unwraps a Joni Mitchell CD'],
  ['The Holiday','Kate Winslet','Iris Simpkins','Iris','swaps her Surrey cottage for a house in Los Angeles'],
  ['The Holiday','Cameron Diaz','Amanda Woods','Amanda','leaves Los Angeles to spend Christmas in a Surrey cottage'],
  ['The Holiday','Jude Law','Graham Simpkins','Graham','entertains his daughters as Mr Napkin Head'],
  ['The Holiday','Jack Black','Miles Dumont','Miles','imitates film scores in a video shop'],
  ['It’s a Wonderful Life','James Stewart','George Bailey','George','sees what Bedford Falls would be like without him'],
  ['It’s a Wonderful Life','Henry Travers','Clarence Odbody','Clarence','hopes to earn his angel wings by helping George'],
  ['National Lampoon’s Christmas Vacation','Chevy Chase','Clark Griswold','Clark','covers the family home in thousands of Christmas lights'],
  ['The Christmas Chronicles','Kurt Russell','Santa Claus','Santa','sings in a jail cell with the other prisoners'],
  ['Jingle All the Way','Arnold Schwarzenegger','Howard Langston','Howard','scrambles to buy his son a Turbo Man toy'],
  ['Scrooged','Bill Murray','Frank Cross','Frank','runs a live Christmas Carol television broadcast'],
];
export const modeLabels = { film: 'Movies', character: 'Characters', actor: 'Actors' };
export const peopleGames = {};
for (const mode of ['character','actor']) {
  const names = [...new Set(credits.map(row => row[mode === 'actor' ? 1 : 2]))];
  const entries = names.map(title => {
    const rows = credits.filter(row => row[mode === 'actor' ? 1 : 2] === title);
    return { title, aliases: mode === 'actor' ? (title === 'James Stewart' ? ['Jimmy Stewart'] : []) : rows.map(row => row[3]).filter(Boolean), credits: rows };
  });
  const questions = [...new Set(credits.map(row => row[0]))].map(film => ({
    id: 'credit-' + film, story: true,
    text: mode === 'actor' ? `Would you recognise this actor from ${film}?` : `Does this character appear in ${film}?`,
    responses: entries.map(entry => entry.credits.some(row => row[0] === film)),
  }));
  // Also credit actors in other featured films, even when their second role isn't a target.
  if (mode === 'actor') {
    questions.find(q => q.id === 'credit-Love Actually').responses[names.indexOf('Alan Rickman')] = true;
  }
  entries.forEach((entry, index) => {
    const row = entry.credits[0];
    questions.push({ id: mode + '-' + index, specific: true,
      text: mode === 'actor' ? `In ${row[0]}, does this actor play the character who ${row[4]}?` : `Is this the character who ${row[4]}?`,
      responses: entries.map((_, i) => i === index) });
  });
  peopleGames[mode] = { entries, questions };
}
