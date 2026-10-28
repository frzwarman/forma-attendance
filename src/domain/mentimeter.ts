// Participation links live on menti.com; presentation links on mentimeter.com.
export function isMentimeterUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /^(www\.)?(menti|mentimeter)\.com$/.test(url.hostname);
  } catch {
    return false;
  }
}
