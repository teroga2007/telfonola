import {describe,it,expect,vi,afterEach} from 'vitest';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {trackId} from '../src/track';
import {requestPlayback} from '../src/playback';
import {openScanner} from '../src/scanner';
const id='7fODjB7BrQTGqh0hogW6XD';
const url=`https://open.spotify.com/track/${id}`;
function pixels(inverted=false){
 const qr=QRCode.create(url,{errorCorrectionLevel:'M'}),size=(qr.modules.size+8)*5,data=new Uint8ClampedArray(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const xx=Math.floor(x/5)-4,yy=Math.floor(y/5)-4;
  const dark=xx>=0&&yy>=0&&xx<qr.modules.size&&yy<qr.modules.size&&qr.modules.get(yy,xx);
  const value=(!!dark!==inverted)?0:255,offset=(y*size+x)*4;
  data.set([value,value,value,255],offset);
 }
 return {data,width:size,height:size};
}
afterEach(()=>vi.unstubAllGlobals());
describe('tarjetas',()=>{
 it('acepta URL de canción y parámetros sin metadatos',()=>expect(trackId(`${url}?si=abc`)).toBe(id));
 it.each(['http://open.spotify.com/track/'+id,'https://open.spotify.com.evil.com/track/'+id,'https://user@open.spotify.com/track/'+id,'https://open.spotify.com/album/'+id,'https://open.spotify.com/track/abc','spotify:track:'+id])('rechaza %s',value=>expect(()=>trackId(value)).toThrow());
 it.each([false,true])('decodifica QR real invertido=%s',inverted=>{const p=pixels(inverted);expect(jsQR(p.data,p.width,p.height,{inversionAttempts:'attemptBoth'})?.data).toBe(url);});
});
describe('reproducción oficial',()=>{
 it('envía una solicitud sin navegación y acepta 204',async()=>{const fetcher=vi.fn().mockResolvedValue({status:204});await requestPlayback(id,'test',fetcher);expect(fetcher).toHaveBeenCalledTimes(1);expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({uris:[`spotify:track:${id}`],position_ms:0});});
 it.each([401,403,404,429,500])('explica error %s',async status=>{await expect(requestPlayback(id,'test',vi.fn().mockResolvedValue({status}))).rejects.toThrow();});
});
describe('ciclos de cámara',()=>{
 it('10 ciclos liberan tracks y entregan una lectura por apertura',async()=>{
  const p=pixels(true),stops=vi.fn(),getUserMedia=vi.fn().mockImplementation(async()=>({getTracks:()=>[{stop:stops}]}));
  let tick:FrameRequestCallback=()=>{};
  vi.stubGlobal('isSecureContext',true);vi.stubGlobal('navigator',{mediaDevices:{getUserMedia}});
  vi.stubGlobal('requestAnimationFrame',(cb:FrameRequestCallback)=>{tick=cb;return 1;});vi.stubGlobal('cancelAnimationFrame',vi.fn());
  vi.stubGlobal('document',{createElement:()=>({getContext:()=>({drawImage:vi.fn(),getImageData:()=>p})})});
  for(let n=0;n<10;n++){
   const video={srcObject:null,play:async()=>{},videoWidth:p.width,videoHeight:p.height,readyState:2} as unknown as HTMLVideoElement;
   const read=vi.fn(),error=vi.fn();await openScanner(video,read,error);tick(1000);tick(2000);
   expect(read).toHaveBeenCalledExactlyOnceWith(url);expect(video.srcObject).toBeNull();expect(error).not.toHaveBeenCalled();
  }
  expect(getUserMedia).toHaveBeenCalledTimes(10);expect(stops).toHaveBeenCalledTimes(10);
 });
 it('libera la cámara si falla video.play',async()=>{
  const stop=vi.fn();vi.stubGlobal('isSecureContext',true);vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop}]})}});vi.stubGlobal('cancelAnimationFrame',vi.fn());
  const video={play:async()=>{throw Error();}} as unknown as HTMLVideoElement;
  await expect(openScanner(video,vi.fn(),vi.fn())).rejects.toThrow();expect(stop).toHaveBeenCalledOnce();
 });
});
