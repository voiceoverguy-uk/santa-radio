import { readFile, writeFile } from 'node:fs/promises';

const root = 'generated-artifacts/workshop-access';
const images = await Promise.all(['entry', 'dialog'].map(async name => ({
  name, data: (await readFile(`${root}/${name}.jpg`)).toString('base64'),
})));
const titles = { entry: 'Discreet entry on the unlocked maker', dialog: 'Password dialog' };
await writeFile(`${root}/preview.html`, `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hidden workshop access preview</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#0b241a;color:#fff8e7;font:16px/1.6 system-ui,sans-serif}
main{max-width:1000px;margin:auto;padding:36px 22px}h1{color:#e6ce86;line-height:1.2}
section{margin:28px 0;padding:22px;border:1px solid #d4af3760;border-radius:16px;background:#123326}
h2{font-size:1.15rem;margin:0 0 18px;color:#e6ce86}img{display:block;max-width:100%;height:auto;margin:auto;border-radius:8px}
p{max-width:760px;color:#d5dece}
</style><main><h1>Hidden workshop access preview</h1>
<p>The new sentence sits directly below the free-download notice. Only “coming soon” opens the password dialog. These screenshots show an isolated test session, with no password displayed.</p>
${images.map(image => `<section><h2>${titles[image.name]}</h2><img alt="${titles[image.name]}" src="data:image/jpeg;base64,${image.data}"></section>`).join('')}
</main></html>`);
console.log('Created workshop access screenshot page.');
