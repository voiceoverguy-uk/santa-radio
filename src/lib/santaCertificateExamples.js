// Keep the original examples first, followed by the additional rotation names.
export const certificateExampleNames = [
  'Edward', 'Ayla', 'Erin', 'Charlotte', 'Freya', 'Harry',
  'Arabella', 'Jessica', 'Charlie', 'Olivia', 'Oliver',
];

// Studio previews write names onto the blank artwork at runtime, so these do
// not need (and must not imply) additional pre-rendered certificate files.
export const studioGiftExampleNames = [
  ...certificateExampleNames,
  'Lydia', 'Layla', 'Jack', 'Ellis', 'Matilda', 'Jasmine', 'Claudia', 'Bob', 'Alfie',
];

const certificateForName = name => ({
  name,
  src: `/certificates/examples/${name.toLowerCase()}.webp`,
  alt: `Example Official Nice List Certificate for ${name}`,
});

export const certificateExamples = certificateExampleNames.map(certificateForName);

// Mohani is available for matching audio without changing the normal rotation.
export const allCertificateExamples = [
  ...certificateExamples,
  certificateForName('Mohani'),
];
