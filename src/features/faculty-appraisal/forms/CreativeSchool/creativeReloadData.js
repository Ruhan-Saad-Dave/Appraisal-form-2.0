// Persistence applies normalized arrays/info through the scoped setters before
// the final Creative merge. Preserve those values instead of restoring raw API
// aliases from the returned snapshot. Keep scalar snapshot metadata untouched.
export function creativeReloadData(rawForm, normalizedState, arrayKeys) {
  const incoming = { ...rawForm };
  for (const key of arrayKeys) {
    if (Array.isArray(normalizedState[key])) incoming[key] = normalizedState[key];
  }
  incoming.info = { ...rawForm.info, ...normalizedState.info };
  return incoming;
}
