import jsQR from 'jsqr';
export async function openScanner(video: HTMLVideoElement, onRead: (value:string)=>void, onError:(error:Error)=>void) {
  if (!isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('La cámara necesita HTTPS y un navegador compatible.');
  const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280}},audio:false});
  let stopped = false, frame = 0, last = 0;
  const stop = () => { stopped=true; cancelAnimationFrame(frame); stream.getTracks().forEach(t=>t.stop()); video.srcObject=null; };
  video.srcObject=stream;
  try { await video.play(); } catch { stop(); throw new Error('No se pudo iniciar la cámara. Reintenta.'); }
  const canvas=document.createElement('canvas'); const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
  function tick(time:number) {
    if(stopped) return;
    if(time-last>180 && video.readyState>=2) {
      last=time;
      try {
        const scale=Math.min(1,800/video.videoWidth);
        canvas.width=video.videoWidth*scale; canvas.height=video.videoHeight*scale;
        ctx.drawImage(video,0,0,canvas.width,canvas.height);
        const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
        const code=jsQR(pixels.data,pixels.width,pixels.height,{inversionAttempts:'attemptBoth'});
        if(code) { stop(); onRead(code.data); return; }
      } catch { stop(); onError(new Error('No se pudo leer la cámara. Reintenta.')); return; }
    }
    frame=requestAnimationFrame(tick);
  }
  frame=requestAnimationFrame(tick); return stop;
}
