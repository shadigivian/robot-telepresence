export type Surface = 'demo' | 'boss' | 'app' | 'unconfigured';
export interface SurfaceConfig { bossOrigin?: string; appOrigin?: string; apiOrigin?: string }
const origin=(value?:string):string|undefined=>{if(!value)return undefined;try {const url=new URL(value);return url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname))?url.origin:undefined;}catch{return undefined;}};
export const surfaceConfig:SurfaceConfig={bossOrigin:origin(import.meta.env.VITE_BOSS_ORIGIN),appOrigin:origin(import.meta.env.VITE_APP_ORIGIN),apiOrigin:origin(import.meta.env.VITE_API_ORIGIN)};
export function resolveSurface(currentOrigin:string,config:SurfaceConfig,development:boolean):Surface {
 if(config.bossOrigin&&config.appOrigin&&config.bossOrigin===config.appOrigin)return 'unconfigured';
 if(currentOrigin===config.bossOrigin)return 'boss';
 if(currentOrigin===config.appOrigin)return 'app';
 try {const host=new URL(currentOrigin).hostname;if(['localhost','127.0.0.1','::1'].includes(host)||(development&&host.endsWith('.localhost')))return 'demo';}catch{/* invalid host */}
 return 'unconfigured';
}
export const surface: Surface = resolveSurface(
 typeof window === 'undefined' ? 'http://localhost' : window.location.origin,
 surfaceConfig,
 import.meta.env.DEV
);
export const demoDevelopment = surface === 'demo' && import.meta.env.DEV;
export const stagingDemo = import.meta.env.VITE_STAGING_DEMO === 'true' &&
 !!surfaceConfig.bossOrigin && !!surfaceConfig.appOrigin &&
 surfaceConfig.bossOrigin !== surfaceConfig.appOrigin &&
 (surface === 'boss' || surface === 'app');
export const demoAvailable = demoDevelopment || stagingDemo;
export function stagingRoleAllowed(target:Surface,role:string):boolean {
 return target === 'boss' ? role === 'BOSS' : target === 'app' ? ['OWNER','ADMIN','USER'].includes(role) : false;
}
