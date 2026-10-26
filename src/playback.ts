export async function requestPlayback(id: string, token: string, fetcher: typeof fetch = fetch, wait:(ms:number)=>Promise<void>=ms=>new Promise(resolve=>setTimeout(resolve,ms))): Promise<{confirmed:boolean;message:string}> {
  const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
  const devicesResponse=await fetcher('https://api.spotify.com/v1/me/player/devices',{headers,cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!devicesResponse.ok) throw new Error(devicesResponse.status===401||devicesResponse.status===403?'Vuelve a conectar Spotify para conceder los permisos de reproducción y consulta.':'No se pudieron consultar los dispositivos Spotify. Espera y reintenta.');
  const {devices}=await devicesResponse.json();
  const device=(devices as {id:string|null;is_active:boolean;is_restricted:boolean}[]).find(d=>d.id&&d.is_active&&!d.is_restricted);
  if(!device)throw new Error('No hay un dispositivo Spotify activo que podamos controlar. Reproduce algo en este teléfono, vuelve y reintenta.');
  // Album context avoids the reported single-track URI playback failure.
  // Only keep the URIs needed for playback; never display or log metadata.
  const trackResponse=await fetcher(`https://api.spotify.com/v1/tracks/${encodeURIComponent(id)}`,{headers,cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!trackResponse.ok)throw new Error('No se pudo preparar la tarjeta con Spotify. Espera y reintenta.');
  const track=await trackResponse.json();
  const albumUri=track.album?.uri;
  const playbackUri=track.uri;
  if(!/^spotify:album:[A-Za-z0-9]{22}$/.test(albumUri??'')||!/^spotify:track:[A-Za-z0-9]{22}$/.test(playbackUri??''))throw new Error('Spotify no devolvió una canción y un álbum válidos para esta tarjeta.');
  const result = await fetcher(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(device.id!)}`, {
    method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ context_uri: albumUri, offset:{uri:playbackUri}, position_ms: 0 }), signal: AbortSignal.timeout(15000),
  });
  if (result.status === 204) {
    let message='Spotify aceptó la solicitud, pero no pudimos comprobar el estado. Reintenta manualmente.';
    // Only read state; never resend playback automatically or log metadata.
    for(let attempt=0;attempt<3;attempt++) {
      await wait(800);
      try {
        const response=await fetcher('https://api.spotify.com/v1/me/player',{headers,cache:'no-store',signal:AbortSignal.timeout(10000)});
        if(response.status===429)break;
        if(response.status===204){message='Spotify aceptó la solicitud, pero después no informa de una sesión de reproducción. Abre Spotify, reproduce algo y reintenta.';continue;}
        if(!response.ok){message='Solicitud aceptada; no se pudo consultar el estado. Vuelve a conectar Spotify y reintenta.';break;}
        // Compare IDs and flags transiently. Never render or persist song details.
        const state=await response.json();
        const matches=state.item?.id===id||state.item?.linked_from?.id===id||state.item?.uri===playbackUri;
        if(state.device?.id!==device.id){message='Spotify informa de otro dispositivo. Activa la reproducción en este teléfono y reintenta.';continue;}
        if(matches&&state.is_playing)return {confirmed:true,message:'Spotify informa que la canción está reproduciéndose. Esto no comprueba el sonido del altavoz.'};
        message=matches?'Spotify cargó la canción, pero informa que está pausada. Abre Spotify y comprueba si permite reproducirla.':'Spotify aceptó la solicitud, pero no inició la canción de la tarjeta. Prueba la misma tarjeta con el lector nativo y reintenta.';
      }catch{message='Solicitud aceptada; no se pudo verificar por un problema de conexión. No se enviaron órdenes adicionales.';break;}
    }
    return {confirmed:false,message};
  }
  const messages: Record<number, string> = {401:'Tu conexión caducó. Vuelve a conectar Spotify.',403:'Spotify no permite reproducir. Revisa Premium, permisos y usuarios autorizados.',404:'Abre Spotify y reproduce algo en este teléfono. Después vuelve e inténtalo.',429:'Spotify pide una pausa. Espera un momento antes de reintentar.'};
  throw new Error(messages[result.status] ?? 'No se pudo solicitar la reproducción. Inténtalo de nuevo.');
}
