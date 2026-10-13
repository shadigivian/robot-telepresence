import type { MediaProvider } from '../contracts';

export class LocalMediaProvider implements MediaProvider {
 private streams = new Set<MediaStream>();
 private generation = 0;
 async startCamera():Promise<MediaStream> {
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('Local camera preview is unavailable. Use HTTPS or localhost in a supported browser.');
  return this.acquire(()=>navigator.mediaDevices.getUserMedia({video:true,audio:true}));
 }
 async startScreen():Promise<MediaStream> {
  if(!navigator.mediaDevices?.getDisplayMedia)throw new Error('Screen capture is unavailable in this browser.');
  return this.acquire(()=>navigator.mediaDevices.getDisplayMedia({video:true,audio:false}));
 }
 private async acquire(request:()=>Promise<MediaStream>) {
  const current=this.generation;
  const stream=await request();
  if(current!==this.generation){stream.getTracks().forEach(t=>t.stop());throw new Error('Preview canceled because the session was closed.');}
  this.streams.add(stream);
  stream.getTracks().forEach(t=>t.addEventListener('ended',()=>{if(stream.getTracks().every(track=>track.readyState==='ended'))this.streams.delete(stream);}));
  return stream;
 }
 stop(){this.generation++;for(const stream of this.streams)stream.getTracks().forEach(t=>t.stop());this.streams.clear();}
 stopStream(stream:MediaStream){stream.getTracks().forEach(t=>t.stop());this.streams.delete(stream);}
}
export const localMedia = new LocalMediaProvider();
export function mediaError(error:unknown){if(error instanceof DOMException&&error.name==='NotAllowedError')return 'Permission denied or capture selection canceled. The simulated session remains available.';if(error instanceof DOMException&&error.name==='NotFoundError')return 'No local camera or microphone is available.';return error instanceof Error?error.message:'Local media preview could not start.';}
