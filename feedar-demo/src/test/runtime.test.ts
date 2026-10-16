import {describe,expect,it} from 'vitest';
import {resolveSurface,stagingRoleAllowed} from '../app/runtime';
const config={bossOrigin:'https://boss.example.test',appOrigin:'https://app.example.test',apiOrigin:'https://api.example.test'};
describe('hostname-selected application surface',()=>{
 it('keeps Boss and App on their exact configured origins',()=>{expect(resolveSurface('https://boss.example.test',config,false)).toBe('boss');expect(resolveSurface('https://app.example.test',config,false)).toBe('app');expect(resolveSurface('https://other.example.test',config,false)).toBe('unconfigured');});
 it('rejects overlapping origins and keeps the local legacy demo isolated',()=>{expect(resolveSurface('https://boss.example.test',{bossOrigin:config.bossOrigin,appOrigin:config.bossOrigin},false)).toBe('unconfigured');expect(resolveSurface('http://127.0.0.1:5173',config,true)).toBe('demo');});
 it('limits staging roles to their assigned surface',()=>{expect(stagingRoleAllowed('boss','BOSS')).toBe(true);expect(stagingRoleAllowed('boss','OWNER')).toBe(false);expect(stagingRoleAllowed('app','BOSS')).toBe(false);for(const role of ['OWNER','ADMIN','USER'])expect(stagingRoleAllowed('app',role)).toBe(true);});
});
