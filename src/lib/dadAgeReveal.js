import dinosaurs from '../assets/dad-age-dinosaurs.webp';
import flowers from '../assets/dad-age-flowers.webp';
import unicorns from '../assets/dad-age-unicorns.webp';
import fairies from '../assets/dad-age-fairies.webp';

export const DAD_AGE_THEMES = [
  { id: 'fairies', label: 'Fairies', colour: '#532274', centre: [0.49, 0.51], artwork: fairies },
  { id: 'unicorns', label: 'Unicorns', colour: '#9c145a', centre: [0.42, 0.548], artwork: unicorns },
  { id: 'flowers', label: 'Flowers', colour: '#97202f', centre: [0.49, 0.469], artwork: flowers },
  { id: 'dinosaurs', label: 'Dinosaurs', colour: '#254723', centre: [0.51, 0.619], artwork: dinosaurs },
];

const SUPERHERO_THEME = {
  id: 'superheroes', label: 'Superheroes', colour: '#163965', centre: [0.51, 0.57],
  artwork: '/images/studio-scenes/age-superheroes-v3.webp',
};
const findAgeTheme = theme => theme === SUPERHERO_THEME.id ? SUPERHERO_THEME : DAD_AGE_THEMES.find(option => option.id === theme);
export const KIDS_AGE_THEMES = ['fairies', 'superheroes', 'unicorns', 'dinosaurs'].map(findAgeTheme);

export const DAD_AGE_REVEAL_SECONDS = 4;
export const DAD_AGE_REVEAL_Y = 305;

export async function drawDadAgeReveal(theme, age) {
  const selection = findAgeTheme(theme);
  if (!selection || age == null) return null;

  const sheet = new Image();
  sheet.src = selection.artwork;
  await sheet.decode();

  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 205;
  const context = canvas.getContext('2d');
  const width = Math.round(canvas.height * sheet.naturalWidth / sheet.naturalHeight);
  const x = 1030 - width / 2;

  context.drawImage(sheet, x, 0, width, canvas.height);
  const {colour, centre} = selection;
  const number = String(age);
  context.font = 'bold 72px Georgia, serif';
  if (context.measureText(number).width > 125) context.font = 'bold 60px Georgia, serif';
  const bounds = context.measureText(number);
  const numberX = x + centre[0] * width + (bounds.actualBoundingBoxLeft - bounds.actualBoundingBoxRight) / 2;
  const numberY = centre[1] * canvas.height + (bounds.actualBoundingBoxAscent - bounds.actualBoundingBoxDescent) / 2;
  context.lineWidth = 5;
  context.strokeStyle = '#fff7e7';
  context.fillStyle = colour;
  context.strokeText(number, numberX, numberY);
  context.fillText(number, numberX, numberY);
  return canvas;
}
