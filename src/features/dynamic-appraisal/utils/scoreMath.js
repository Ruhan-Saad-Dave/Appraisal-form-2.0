// Self-contained numeric helpers for the dynamic appraisal review module.
// Deliberately not shared with the standard/creative-school scoring code so
// this module's math stays independent of theirs.
export const n = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

export const clampScore = (value, max) => {
  const num = n(value);
  if (max === undefined || max === null || !Number.isFinite(Number(max))) return Math.max(0, num);
  return Math.min(Math.max(0, num), Number(max));
};
