import {describe,it,expect} from 'vitest';
import {createElement,Fragment} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {execFileSync} from 'node:child_process';
import {FeedarAsset} from '../components/feedar-asset';
import {feedarAssets} from '../components/feedar-asset.generated';
import {Empty,FeedarMark} from '../components/ui';

describe('reviewed Feedar v1 vector integration',()=>{
 it('reproduces JSX from the sixteen self-contained canonical SVG files',()=>{
  expect(Object.keys(feedarAssets)).toHaveLength(16);
  expect(new Set(Object.values(feedarAssets).map(a=>a.id)).size).toBe(16);
  expect(execFileSync(process.execPath,['--preserve-symlinks','--preserve-symlinks-main','scripts/generate-feedar-assets.mjs','--check'],{encoding:'utf8'})).toContain('16 canonical SVG sources match');
 });
 it('renders a capacity graphic without inventing an unknown battery reading or product thresholds',()=>{
  for(const[percentage,count]of [[0,0],[7,1],[52,3],[87,4]]as const){
   const html=renderToStaticMarkup(createElement(FeedarAsset,{name:'battery',batteryPercent:percentage}));
   expect(html.match(/opacity="1"/g)?.length??0).toBe(count);
   expect(html).not.toContain(`${percentage}%`);
  }
  const unknown=renderToStaticMarkup(createElement(FeedarAsset,{name:'battery'}));
  expect(unknown).toContain('data-battery-known="false"');
  expect(unknown).not.toContain('opacity="1"');
  expect(unknown).not.toContain('0%');
 });
 it('selects exactly one ticket glyph and keeps new as an open alias',()=>{
  for(const state of ['open','in_review','awaiting_reply','resolved','closed']as const){
   const html=renderToStaticMarkup(createElement(FeedarAsset,{name:'ticketStatus',ticketStatus:state}));
   expect(html.match(/display="none"/g)).toHaveLength(4);
   expect(html).toContain(`data-ticket-state="${state}"`);
  }
  expect(renderToStaticMarkup(createElement(FeedarAsset,{name:'ticketStatus',ticketStatus:'new'}))).toBe(renderToStaticMarkup(createElement(FeedarAsset,{name:'ticketStatus',ticketStatus:'open'})));
 });
 it('keeps decorative vectors silent, permits a semantic name, and has no repeated SVG IDs',()=>{
  const silent=renderToStaticMarkup(createElement(FeedarAsset,{name:'online'}));
  expect(silent).toContain('aria-hidden="true"');
  expect(silent).not.toMatch(/<title|<desc|\sid="/);
  const named=renderToStaticMarkup(createElement(Fragment,null,createElement(FeedarAsset,{name:'online',label:'Connected'}),createElement(FeedarAsset,{name:'online',label:'Connected'})));
  expect(named.match(/aria-label="Connected"/g)).toHaveLength(2);
  expect(named).not.toContain('aria-hidden');
  expect(named).not.toMatch(/\sid="/);
  const brand=renderToStaticMarkup(createElement(FeedarMark));
  expect(brand.match(/aria-label="Feedar"/g)).toHaveLength(1);
 });
 it('does not turn missing workspace, errors, or successful actions into empty data',()=>{
  expect(renderToStaticMarkup(createElement(Empty,{title:'No records'}))).toContain('FDR-SHARED-EMPTY');
  for(const state of ['unavailable','error','success']as const){
   const html=renderToStaticMarkup(createElement(Empty,{state}));
   expect(html).not.toContain('FDR-SHARED-EMPTY');
   expect(html).toContain('aria-hidden="true"');
  }
 });
});
