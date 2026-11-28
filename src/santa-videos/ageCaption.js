export const AGE_WINDOW = [17, 24];

export async function ageCaptionPng(age) {
  if (!Number.isInteger(age?.number) || age.number < 0 || age.number > 120 || !['year', 'month'].includes(age.unit)) throw new Error('Please choose an age from the live list.');
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 720;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser could not prepare the age caption.');
  context.textAlign = 'center'; context.textBaseline = 'middle';
  context.fillStyle = '#7a1c24';
  context.font = '110px Georgia, "Times New Roman", serif';
  context.fillText(String(age.number), 490, 350, 300);
  context.fillStyle = '#594331';
  context.font = 'italic 38px Georgia, "Times New Roman", serif';
  context.fillText(`${age.unit}${age.number === 1 ? '' : 's'} old`, 490, 430, 300);
  const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!png) throw new Error('The age caption could not be prepared.');
  return new Uint8Array(await png.arrayBuffer());
}
