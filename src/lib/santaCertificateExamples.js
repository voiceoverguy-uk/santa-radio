// Keep the original examples first, followed by the additional rotation names.
export const certificateExampleNames = [
  'Edward', 'Ayla', 'Erin', 'Charlotte', 'Freya', 'Harry',
  'Arabella', 'Jessica', 'Charlie', 'Olivia', 'Oliver',
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
