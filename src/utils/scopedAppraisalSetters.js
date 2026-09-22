// Check before every write, not just after a loader returns: loaders may call
// many setters internally while another academic-year request is in flight.
export function scopedAppraisalSetters(setters, isCurrentLoad) {
  return Object.fromEntries(Object.entries(setters).map(([key, setter]) => [key, (...args) => {
    if (isCurrentLoad()) return setter?.(...args);
  }]));
}
