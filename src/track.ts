export function trackId(input: string): string {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error('Este QR no contiene un enlace de Spotify.'); }
  const match = /^\/track\/([A-Za-z0-9]{22})\/?$/.exec(url.pathname);
  if (url.protocol !== 'https:' || url.hostname !== 'open.spotify.com' || url.port || url.username || url.password || !match) throw new Error('Escanea un QR de canción de Spotify válido.');
  return match[1];
}
