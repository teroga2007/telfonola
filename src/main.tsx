import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {configured,connect,finishAuth,token} from './auth';
import {trackId} from './track';
import {requestPlayback} from './playback';
import {openScanner} from './scanner';
import './style.css';

type Phase='inicio'|'escaneando'|'preparando'|'escucha';
function App(){
 const [phase,setPhase]=useState<Phase>('inicio'),[message,setMessage]=useState(''),[ready,setReady]=useState(false),[connected,setConnected]=useState(false),[full,setFull]=useState(false),[probe,setProbe]=useState('');
 const root=useRef<HTMLDivElement>(null),video=useRef<HTMLVideoElement>(null),busy=useRef(false),lastId=useRef<string|null>(null);
 useEffect(()=>{finishAuth().catch(()=>setMessage('No se pudo conectar Spotify. Vuelve a intentarlo.')).finally(()=>{setConnected(!!token());setReady(true);});},[]);
 async function fullscreen(){try{await root.current?.requestFullscreen();}catch{setMessage('Pantalla completa no disponible. Puedes seguir jugando.');}}
 useEffect(()=>{const change=()=>setFull(!!document.fullscreenElement);document.addEventListener('fullscreenchange',change);return()=>document.removeEventListener('fullscreenchange',change);},[]);
 useEffect(()=>{
  if(phase==='inicio')return;
  let wake:WakeLockSentinel|null=null,disposed=false;
  const acquire=async()=>{if(document.visibilityState!=='visible'||disposed||wake&&!wake.released)return;try{const lock=await navigator.wakeLock?.request('screen');if(disposed)await lock?.release();else wake=lock??null;}catch{/* El navegador puede denegar el bloqueo. */}};
  void acquire();document.addEventListener('visibilitychange',acquire);
  return()=>{disposed=true;void wake?.release();document.removeEventListener('visibilitychange',acquire);};
 },[phase]);
 async function play(id:string){
  if(busy.current)return;busy.current=true;setMessage('');setPhase('preparando');lastId.current=id;
  try{const access=token();if(!access){setConnected(false);throw new Error('Conecta Spotify para continuar.');}await requestPlayback(id,access);setPhase('escucha');}
  catch(e){setPhase('escucha');setMessage(e instanceof Error?e.message:'No se pudo contactar con Spotify. Reintenta.');}
  finally{busy.current=false;}
 }
 useEffect(()=>{
  if(phase!=='escaneando'||!video.current)return;
  let disposed=false,stop:(()=>void)|undefined;
  void openScanner(video.current,value=>{
   if(disposed)return;
   try{const id=trackId(value);void play(id);}catch(e){setMessage((e as Error).message);setPhase('escucha');lastId.current=null;}
  },error=>{if(!disposed){setMessage(error.message);setPhase('escucha');}}).then(cleanup=>{if(disposed)cleanup();else stop=cleanup;}).catch(()=>{if(!disposed){setMessage('No se pudo abrir la cámara. Revisa el permiso y usa HTTPS.');setPhase('escucha');}});
  return()=>{disposed=true;stop?.();};
 },[phase]);
 function scan(){if(busy.current)return;lastId.current=null;setMessage('');setPhase('escaneando');}
 function start(){void fullscreen();scan();}
 const loading=phase==='preparando';
 return <div className="app" ref={root}>
  <header><a className="brand" href="/" onClick={e=>e.preventDefault()}><span className="brand-icon">◉</span> SURCO<span className="edition">LA MÚSICA ES EL JUEGO</span></a><button className="fullscreen" onClick={()=>void fullscreen()} disabled={full}>⛶ <span>{full?'PANTALLA COMPLETA ACTIVA':'PANTALLA COMPLETA'}</span></button></header>
  <main>
   <div className="eyebrow"><span/> {phase==='inicio'?'TU PRÓXIMA CANCIÓN ESTÁ AQUÍ':phase==='escaneando'?'BUSCANDO EL RITMO':loading?'UN MOMENTO':'QUE SUENE LA MÚSICA'}</div>
   <h1>{phase==='inicio'?<>Una carta.<br/><em>Una canción.</em></>:phase==='escaneando'?<>Encuentra<br/><em>el siguiente tema.</em></>:loading?<>Preparando<br/><em>la canción.</em></>:<>Escucha.<br/><em>Déjate llevar.</em></>}</h1>
   <div className="stage">
    {phase==='escaneando'?<div className="camera"><video ref={video} muted playsInline autoPlay/><div className="scan-frame"/><span>Coloca el QR dentro del marco</span></div>:<div className={`vinyl ${phase==='escucha'&&!message?'spinning':''}`} role="img" aria-label="Disco de vinilo decorativo"><div className="label"><span>SURCO</span><i/><small>SIDE A · 33 RPM</small></div></div>}
    {phase!=='escaneando'&&<span className="stage-note">{phase==='escucha'&&!message?'REPRODUCCIÓN SOLICITADA · ANIMACIÓN VISUAL':'DALE UNA VUELTA A LA NOCHE'}</span>}
   </div>
   <div className="controls" aria-live="polite">
    {message&&<p className="error" role="alert">{message}</p>}
    {phase==='inicio'&&<p className="intro">Escanea una tarjeta. Escucha en Spotify.<br/>La canción es el único secreto.</p>}
    {phase==='inicio'&&!connected&&<><p className="hint">Necesitas Spotify Premium y Spotify activo en este teléfono.</p>{!configured&&<p className="error">Falta configurar el Client ID de Spotify. Consulta README.</p>}<button className="primary" disabled={!configured||!ready} onClick={()=>void connect().catch(()=>setMessage('No se pudo iniciar la conexión. Reintenta.'))}>CONECTAR SPOTIFY ↗</button></>}
    {phase==='inicio'&&connected&&<button className="primary" onClick={start}>EMPEZAR <span>→</span></button>}
    {loading&&<button className="primary" disabled>PREPARANDO…</button>}
    {phase==='escaneando'&&<button className="secondary" onClick={()=>{setPhase('escucha');setMessage('Escaneo cancelado. Puedes volver a intentarlo.');}}>CANCELAR</button>}
    {phase==='escucha'&&<>{!connected&&<button className="secondary" onClick={()=>void connect().catch(()=>setMessage('No se pudo conectar.'))}>CONECTAR SPOTIFY</button>}{message&&lastId.current&&connected&&<button className="secondary" onClick={()=>void play(lastId.current!)}>REINTENTAR REPRODUCCIÓN</button>}<button className="primary" onClick={scan}>SIGUIENTE CARTA <span>→</span></button>{!message&&<p className="hint">Solicitud aceptada por Spotify.<br/>El disco no confirma que el audio esté sonando.</p>}</>}
   </div>
   {phase==='inicio'&&connected&&<details><summary>Prueba mínima de reproducción</summary><p>Antes de usar la cámara: pega un enlace de tarjeta y solicita reproducir. Comprueba que esta web sigue visible y el teléfono suena.</p><input type="url" aria-label="Enlace Spotify para prueba" placeholder="https://open.spotify.com/track/…" value={probe} onChange={e=>setProbe(e.target.value)}/><button className="secondary" onClick={()=>{try{void play(trackId(probe));setProbe('');}catch(e){setMessage((e as Error).message);}}}>PROBAR SIN CÁMARA</button></details>}
  </main><footer><span>SOLO TÚ, LAS CARTAS Y LA MÚSICA.</span><span>HECHO PARA ESCUCHAR</span></footer>
 </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
if('serviceWorker'in navigator)window.addEventListener('load',()=>{void navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(registration=>registration.update()).catch(()=>{});});
