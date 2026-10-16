import { useEffect, useRef, useState } from 'react';
import { Button, Modal } from './ui';

type Detector = { detect(source:HTMLVideoElement):Promise<{rawValue:string}[]> };
type DetectorConstructor = new (options:{formats:string[]})=>Detector;

export function QrIdentifierScanner({onScan}:{onScan:(identifier:string)=>void}){
  const [open,setOpen]=useState(false);const [error,setError]=useState('');const video=useRef<HTMLVideoElement>(null);const scan=useRef(onScan);
  useEffect(()=>{scan.current=onScan;},[onScan]);
  useEffect(()=>{
    if(!open)return;let cancelled=false;let stream:MediaStream|undefined;let timer:ReturnType<typeof setInterval>|undefined;
    const Detector=(window as unknown as {BarcodeDetector?:DetectorConstructor}).BarcodeDetector;
    if(!Detector||!navigator.mediaDevices?.getUserMedia){setError('QR scanning is unavailable here. Enter the identifier manually.');return;}
    const detector=new Detector({formats:['qr_code']});
    void navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false}).then(async media=>{
      if(cancelled){media.getTracks().forEach(track=>track.stop());return;}
      stream=media;const element=video.current;if(!element)return;element.srcObject=media;await element.play();
      timer=setInterval(()=>{if(cancelled||!element||element.readyState<2)return;void detector.detect(element).then(found=>{const raw=found[0]?.rawValue?.trim();if(!raw)return;let identifier=raw;try{identifier=new URL(raw).searchParams.get('identifier')??raw;}catch{/* raw identifier */}if(!/^[A-Za-z0-9][A-Za-z0-9_-]{2,79}$/.test(identifier)){setError('QR does not contain a supported robot identifier.');return;}scan.current(identifier.toUpperCase());setOpen(false);}).catch(()=>setError('Unable to read this QR code. Enter the identifier manually.'));},500);
    }).catch(()=>setError('Camera permission was denied or unavailable. Enter the identifier manually.'));
    return()=>{cancelled=true;if(timer)clearInterval(timer);stream?.getTracks().forEach(track=>track.stop());if(video.current)video.current.srcObject=null;};
  },[open]);
  return <><Button type="button" onClick={()=>{setError('');setOpen(true);}}>Scan robot QR</Button>{open&&<Modal title="Scan robot identifier" onClose={()=>setOpen(false)}><div className="stack"><video ref={video} muted playsInline style={{width:'100%',maxHeight:320}}/><p className="muted">Local camera scan only. No image is uploaded or stored.</p>{error&&<p role="alert" className="error">{error}</p>}<Button onClick={()=>setOpen(false)}>Close scanner</Button></div></Modal>}</>;
}
