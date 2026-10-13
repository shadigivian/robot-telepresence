import { describe, it, expect, vi } from 'vitest';
import { LocalMediaProvider } from '../services/demo/media';

describe('local media lifecycle',()=>{
 it('stops late-resolving permissions after navigation or cancellation',async()=>{
  let resolve!:(stream:MediaStream)=>void;
  const stop=vi.fn();const track={stop,addEventListener:vi.fn(),readyState:'live'};
  const stream={getTracks:()=>[track]} as unknown as MediaStream;
  vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:()=>new Promise<MediaStream>(r=>resolve=r)}});
  const provider=new LocalMediaProvider();const pending=provider.startCamera();provider.stop();resolve(stream);
  await expect(pending).rejects.toThrow('canceled');expect(stop).toHaveBeenCalledOnce();vi.unstubAllGlobals();
 });
 it('cleans all acquired tracks on explicit end',async()=>{
  const stop=vi.fn();const track={stop,addEventListener:vi.fn(),readyState:'live'};
  vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[track]})}});
  const provider=new LocalMediaProvider();await provider.startCamera();provider.stop();expect(stop).toHaveBeenCalledOnce();vi.unstubAllGlobals();
 });
});
