// A new controller belongs to one mounted listening page, never to browser
// storage. Shuffle the first non-empty list once; polling only refreshes rows.
export function createContenderOrdering(random = Math.random) {
  let order = null;
  return entries => {
    if (order === null && entries.length) {
      order = entries.map(entry => entry.id);
      // Fisher–Yates: every entry, including demo entries, is treated equally.
      for (let index = order.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(random() * (index + 1));
        [order[index], order[swap]] = [order[swap], order[index]];
      }
    }
    if (order === null) return [];
    const known = new Set(order);
    // Newly approved entries can appear without moving existing recordings.
    for (const entry of entries) {
      if (!known.has(entry.id)) {
        order.push(entry.id);
        known.add(entry.id);
      }
    }
    const byId = new Map(entries.map(entry => [entry.id, entry]));
    return order.map(id => byId.get(id)).filter(Boolean);
  };
}
