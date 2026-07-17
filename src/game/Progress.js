/**
 * localStorage progress — completed stages become stars in the cosmos.
 */
const SAVE_KEY = 'calamari-damacy-progress-v1';

export function loadProgress() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { completed: [], stars: [] };
    const data = JSON.parse(raw);
    return {
      completed: Array.isArray(data.completed) ? data.completed : [],
      stars: Array.isArray(data.stars) ? data.stars : [],
    };
  } catch {
    return { completed: [], stars: [] };
  }
}

export function saveProgress(progress) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
}

/** A stage is playable if cleared before, first in list, or previous is completed. */
export function isStageUnlocked(stages, progress, stageId) {
  if (progress.completed.includes(stageId)) return true;
  const idx = stages.findIndex((s) => s.id === stageId);
  if (idx <= 0) return true;
  return progress.completed.includes(stages[idx - 1].id);
}

export function recordClear(progress, stage, sizeCm, count) {
  const completed = progress.completed.includes(stage.id)
    ? progress.completed
    : [...progress.completed, stage.id];
  const stars = progress.stars.filter((s) => s.stageId !== stage.id);
  stars.push({
    stageId: stage.id,
    starName: stage.starName,
    sizeCm,
    count,
  });
  const next = { completed, stars };
  saveProgress(next);
  return next;
}

export function clearProgress() {
  localStorage.removeItem(SAVE_KEY);
}
