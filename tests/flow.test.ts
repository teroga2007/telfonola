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
 const devices={ok:true,json:async()=>({devices:[{id:'phone',is_active:true,is_restricted:false}]})};
 const album='spotify:album:4yP0hdKOZPNshxUOjY0cZj';
 const track={ok:true,json:async()=>({uri:`spotify:track:${id}`,album:{uri:album}})};
 const noWait=async()=>{};
 it('inicia el álbum en la pista exacta y confirma el estado',async()=>{const fetcher=vi.fn().mockResolvedValueOnce(devices).mockResolvedValueOnce(track).mockResolvedValueOnce({status:204}).mockResolvedValue({ok:true,status:200,json:async()=>({device:{id:'phone'},item:{id},is_playing:true})});const result=await requestPlayback(id,'test',fetcher,noWait);expect(result.confirmed).toBe(true);expect(fetcher.mock.calls[2][0]).toContain('device_id=phone');expect(JSON.parse(fetcher.mock.calls[2][1].body)).toEqual({context_uri:album,offset:{uri:`spotify:track:${id}`},position_ms:0});expect(fetcher.mock.calls.filter(c=>c[1].method==='PUT')).toHaveLength(1);});
 it.each([401,403,404,429,500])('explica error %s',async status=>{await expect(requestPlayback(id,'test',vi.fn().mockResolvedValueOnce(devices).mockResolvedValueOnce(track).mockResolvedValue({status}),noWait)).rejects.toThrow();});
 it.each([204,'paused','different','other-device','network'])('no confunde 204 con reproducción: %s',async state=>{
  const fetcher=vi.fn().mockResolvedValueOnce(devices).mockResolvedValueOnce(track).mockResolvedValueOnce({status:204});
  if(state==='network')fetcher.mockRejectedValue(Error('network'));
  else fetcher.mockResolvedValue({ok:true,status:state===204?204:200,json:async()=>({device:{id:state==='other-device'?'other':'phone'},item:{id:state==='different'?'different':id},is_playing:state!=='paused'})});
  const result=await requestPlayback(id,'test',fetcher,noWait);expect(result.confirmed).toBe(false);expect(result.message).toBeTruthy();expect(fetcher.mock.calls.filter(c=>c[1].method==='PUT')).toHaveLength(1);
 });
 it('no envía órdenes sin dispositivo activo',async()=>{const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({devices:[]})});await expect(requestPlayback(id,'test',fetcher,noWait)).rejects.toThrow('No hay un dispositivo');expect(fetcher).toHaveBeenCalledOnce();});
 it.each([{ok:false},{ok:true,json:async()=>({album:{uri:'invalid'},uri:'invalid'})}])('no envía órdenes si falla la preparación del álbum',async response=>{const fetcher=vi.fn().mockResolvedValueOnce(devices).mockResolvedValueOnce(response);await expect(requestPlayback(id,'test',fetcher,noWait)).rejects.toThrow();expect(fetcher.mock.calls.filter(c=>c[1].method==='PUT')).toHaveLength(0);});
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
