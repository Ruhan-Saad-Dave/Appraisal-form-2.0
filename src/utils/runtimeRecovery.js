// Retrying a React.lazy rejection or a mismatched dev runtime in the same
// document reuses the failed module. Recovery needs an explicit page reload.
export function requiresPageReload(error) {
  const message = String(error?.message || error || "");
  return /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|loading chunk [\w-]+ failed|chunkloaderror|outdated optimize dep/i.test(message)
    || /[Cc]annot read properties of null \(reading ['"]use[A-Z]\w*['"]\)/.test(message);
}
