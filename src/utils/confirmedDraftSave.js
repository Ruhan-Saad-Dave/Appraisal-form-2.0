export const DRAFT_CONNECTION_ERROR = 'Draft save not confirmed\n\nWe couldn’t confirm that your latest changes were saved. Check your internet connection, then click Save as Draft to retry.\n\nYour entries are still on this page. Please don’t refresh or close it until saving succeeds.';

export function assertDraftOnline() {
  if (globalThis.navigator?.onLine === false) {
    const error = new Error(DRAFT_CONNECTION_ERROR);
    error.code = 'DRAFT_OFFLINE';
    throw error;
  }
}

// A browser online flag is only a hint. The save API must acknowledge the write.
// These messages are returned by the faculty and reviewer snapshot endpoints.
export async function confirmedDraftSave(save) {
  assertDraftOnline();
  const result = await save();
  if (result?.success === false || !['saved', 'draft saved'].includes(String(result?.message || '').trim().toLowerCase())) {
    const error = new Error('Save draft could not be confirmed by the server. Stay on this page and retry.');
    error.code = 'DRAFT_UNCONFIRMED';
    throw error;
  }
  return result;
}

export function draftSaveErrorMessage(error) {
  if (error?.code === 'DRAFT_OFFLINE' || error?.code === 'ERR_NETWORK' || error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT' || (error?.request && !error?.response)) return DRAFT_CONNECTION_ERROR;
  if (error?.code === 'DRAFT_UNCONFIRMED') return error.message;
  return `Save draft failed. ${error?.message || 'Please try again.'}`;
}
