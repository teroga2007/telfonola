const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined;
const redirect = () => `${location.origin}/`;
export const configured = Boolean(clientId);
export const token = () => {
  const expires = Number(sessionStorage.getItem('expires'));
  return Date.now() < expires ? sessionStorage.getItem('token') : null;
};
export async function connect() {
  const bytes = crypto.getRandomValues(new Uint8Array(48));
  const verifier = Array.from(bytes, b => b.toString(16).padStart(2,'0')).join('');
  const state = crypto.randomUUID();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  sessionStorage.setItem('pkce',verifier); sessionStorage.setItem('oauth-state',state);
  const params = new URLSearchParams({client_id:clientId!,response_type:'code',redirect_uri:redirect(),scope:'user-modify-playback-state',code_challenge_method:'S256',code_challenge:challenge,state});
  location.assign(`https://accounts.spotify.com/authorize?${params}`);
}
export async function finishAuth() {
  const params = new URLSearchParams(location.search);
  if (!params.has('code') && !params.has('error')) return;
  history.replaceState(null,'','/');
  const verifier = sessionStorage.getItem('pkce');
  const expected = sessionStorage.getItem('oauth-state');
  sessionStorage.removeItem('pkce'); sessionStorage.removeItem('oauth-state');
  if (params.has('error')) throw new Error('No se autorizó Spotify. Puedes volver a conectar.');
  if (!verifier || !expected || params.get('state') !== expected) throw new Error('La conexión no es válida. Vuelve a conectar Spotify.');
  const result = await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId!,grant_type:'authorization_code',code:params.get('code')!,redirect_uri:redirect(),code_verifier:verifier}),signal:AbortSignal.timeout(15000)});
  if (!result.ok) throw new Error('No se pudo conectar Spotify. Inténtalo de nuevo.');
  const data = await result.json();
  sessionStorage.setItem('token',data.access_token); sessionStorage.setItem('expires',String(Date.now()+data.expires_in*1000-30000));
}
