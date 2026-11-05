// Explicit opt-in: change to 'random' to choose from the supplied costumes.
// Keep this build-time choice separate from visitor preferences and storage.
export const STUDIO_RUNNER_MODE = 'classic';

export const STUDIO_RUNNER_COSTUMES = Object.freeze([
  'classic', 'midnight', 'elf-boss', 'golden', 'bedtime', 'holiday',
  'funny', 'bizniz', 'kilty', 'frank', 'fairy',
]);

// Call only once an MP3 preparation attempt has been accepted, never on render.
export function selectStudioRunnerCostume(mode = STUDIO_RUNNER_MODE, random = Math.random) {
  return mode === 'random'
    ? STUDIO_RUNNER_COSTUMES[Math.floor(random() * STUDIO_RUNNER_COSTUMES.length)]
    : 'classic';
}
