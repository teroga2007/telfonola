export async function requestPlayback(id: string, token: string, fetcher: typeof fetch = fetch): Promise<void> {
  const result = await fetcher('https://api.spotify.com/v1/me/player/play', {
    method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ uris: [`spotify:track:${id}`], position_ms: 0 }), signal: AbortSignal.timeout(15000),
  });
  if (result.status === 204) return;
  const messages: Record<number, string> = {401:'Tu conexión caducó. Vuelve a conectar Spotify.',403:'Spotify no permite reproducir. Revisa Premium, permisos y usuarios autorizados.',404:'Abre Spotify y reproduce algo en este teléfono. Después vuelve e inténtalo.',429:'Spotify pide una pausa. Espera un momento antes de reintentar.'};
  throw new Error(messages[result.status] ?? 'No se pudo solicitar la reproducción. Inténtalo de nuevo.');
}
