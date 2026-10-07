// Sampling without replacement, using only explicitly approved public profiles.
export function selectHomepageMugshots(catalogue, random = Math.random) {
  const eligible = catalogue.filter(profile => profile.homepage === true);
  for (let i = eligible.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
  }
  return eligible.slice(0, 4);
}
