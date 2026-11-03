// Position the boundary above the fixed radio dock, without smooth-scroll races.
export async function approachMugshotBoundary(page) {
  await page.locator('.mugshots-batch-sentinel').evaluate(node => {
    window.scrollTo({
      top: window.scrollY + node.getBoundingClientRect().top - innerHeight + 200,
      behavior: 'instant',
    });
  });
}
