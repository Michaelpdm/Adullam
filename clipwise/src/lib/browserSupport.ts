export interface SupportReport {
  ok: boolean
  missing: string[]
}

/** The editor needs WebCodecs + the File System Access API (Chrome / Edge). */
export function checkBrowserSupport(): SupportReport {
  const missing: string[] = []
  if (typeof VideoDecoder === 'undefined' || typeof VideoEncoder === 'undefined') missing.push('WebCodecs')
  if (typeof (window as any).showSaveFilePicker !== 'function') missing.push('Save to disk')
  if (typeof indexedDB === 'undefined') missing.push('Project storage')
  return { ok: missing.length === 0, missing }
}
