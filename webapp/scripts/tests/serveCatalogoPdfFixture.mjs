// Ambiente de teste isolado: nunca importa o cliente Supabase real nem registra leads reais.
// Executar: node scripts/tests/serveCatalogoPdfFixture.mjs
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';
import { transformSync } from 'rolldown/experimental';

const root = fileURLToPath(new URL('../../', import.meta.url));
const tests = fs.readFileSync(path.join(root, 'scripts/tests/catalogoGeneration.test.mjs'), 'utf8');
const mockCode = tests.slice(tests.indexOf('export const FAMILY'), tests.indexOf('const signal =')).replaceAll('export ', '');
const auth = `import React from 'react'; export const FixtureAuthContext=React.createContext(null); export const useAuth=()=>React.useContext(FixtureAuthContext);`;
const supabase = `${mockCode}
const tables=fixtureTables();
tables.catalogo_categorias=[{id:'category',nome:'Fechaduras',parent_id:null,ordem:0,ativo:true},{id:'category2',nome:'Maçanetas',parent_id:null,ordem:1,ativo:true}];
tables.produtos.forEach(product=>{product.foto_local='/fixture-image.svg';product.foto_local_gde='/fixture-image.svg';product.galeria=[];});
if(new URLSearchParams(location.search).get('scenario')==='image-fail')tables.catalogo_familias_paginas[1].imagem_url='/failed-page.svg';
export const supabase=mockClient(tables,1);
const originalFrom=supabase.from.bind(supabase);
supabase.from=table=>{const query=originalFrom(table);const insert=query.insert;query.insert=async(payload)=>{const result=await insert(payload);document.getElementById('fixture-leads').textContent=String(supabase.inserts.length);return result;};return query;};
supabase.channel=()=>({on(){return this;},subscribe(){return this;}});supabase.removeChannel=()=>{};`;
const entry = `import React,{useState} from 'react'; import {createRoot} from 'react-dom/client'; import {BrowserRouter} from 'react-router-dom';
import {FixtureAuthContext} from 'fixture-auth'; import {Catalogo2} from './src/pages/Catalogo2.jsx'; import {CatalogoPdf2} from './src/pages/CatalogoPdf2.jsx';
import {createCatalogGeneration,saveCatalogGeneration,GENERATION_PREFIX} from './src/lib/catalogoGeneration.js';
const params=new URLSearchParams(location.search),mode=params.get('mode')||'pdf',scenario=params.get('scenario')||'mixed';
const id='10000000-0000-4000-8000-000000000001',family='02076a1f-4cc4-446e-9037-d0f73a9a9e71';
const session={user:{id:'fixture-user',email:'fixture@example.invalid',user_metadata:{}}};
if(mode==='pdf'){
 const include=!['products','empty'].includes(scenario);
 const ids=['families-only','empty'].includes(scenario)?[]:['2474','2475'];
 const contract=createCatalogGeneration({id,produtoIds:ids,incluirFamilias:include,familiaIds:include?[family]:[],filtros:{brands:[],search:''}});
 if(scenario==='invalid')localStorage.setItem(GENERATION_PREFIX+id,'{');else if(scenario!=='missing')saveCatalogGeneration(localStorage,contract);else localStorage.removeItem(GENERATION_PREFIX+id);
 history.replaceState(null,'',location.pathname+'?mode=pdf&scenario='+scenario+'&generation='+id);
}
const nativeFetch=window.fetch.bind(window);window.fetch=(input,options)=>String(input).startsWith('https://ipapi.co/')?Promise.resolve({json:async()=>({region_code:'SP'})}):nativeFetch(input,options);
window.open=url=>{const generation=new URL(url,location.href).searchParams.get('generation');document.getElementById('fixture-generation').textContent=JSON.stringify({url,contract:JSON.parse(localStorage.getItem(GENERATION_PREFIX+generation))});return null;};
function App(){const [signed,setSigned]=useState(mode==='pdf'||scenario==='authenticated');return React.createElement(FixtureAuthContext.Provider,{value:{session:signed?session:null,profile:{nome:'Teste isolado',role:'cliente'},loading:false,signOut:async()=>setSigned(false)}},
 React.createElement(BrowserRouter,null,React.createElement('button',{id:'fixture-login',onClick:()=>setSigned(true)},'Entrar simuladamente'),React.createElement(mode==='pdf'?CatalogoPdf2:Catalogo2)))}
createRoot(document.getElementById('root')).render(React.createElement(App));`;
const bundle = await rolldown({
  input: 'fixture-entry',
  resolve: { alias: { 'fixture-auth': 'fixture-auth' } },
  plugins: [{
    name: 'ori-isolated-fixture',
    resolveId(id) {
      if (['fixture-entry', 'fixture-auth', 'fixture-supabase'].includes(id)) return '\0' + id;
      if (id.endsWith('/context/AuthContext')) return '\0fixture-auth';
      if (id.endsWith('/lib/supabase')) return '\0fixture-supabase';
      if (id.startsWith('./src/')) return path.join(root, id);
      if (id.endsWith('.css')) return '\0fixture-css';
    },
    load(id) {
      if (id === '\0fixture-entry') return entry;
      if (id === '\0fixture-auth') return auth;
      if (id === '\0fixture-supabase') return supabase;
      if (id === '\0fixture-css') return '';
    },
    transform(code, id) {
      if (id.endsWith('.jsx')) return transformSync(id, "import React from 'react';\n" + code, { jsx: { runtime: 'classic' } }).code;
    },
  }],
});
const { output } = await bundle.generate({ format: 'iife' });
await bundle.close();
const js = output.find(item => item.type === 'chunk').code;
const css = ['global.css', 'catalogo2.css', 'catalogo-pdf2.css'].map(name => fs.readFileSync(path.join(root, 'src/styles', name), 'utf8').replace(/@import[^;]+;/g, '')).join('\n');
const image = label => `<svg xmlns="http://www.w3.org/2000/svg" width="210" height="297"><rect width="210" height="297" fill="white"/><rect x="1" y="1" width="208" height="295" fill="none" stroke="#1767b4"/><text x="105" y="140" text-anchor="middle" font-size="10">${label}</text><text x="105" y="286" text-anchor="middle" font-size="7">Limite inferior A4</text></svg>`;
let failedRequests = 0;
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('Cache-Control', 'no-store');
  if (url.pathname === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(js); return; }
  if (url.pathname === '/fixture.css') { res.setHeader('Content-Type', 'text/css'); res.end(css); return; }
  if (url.pathname === '/failed-page.svg' && failedRequests++ === 0) { res.writeHead(404); res.end('Falha simulada'); return; }
  if (url.pathname.endsWith('.svg')) { res.setHeader('Content-Type', 'image/svg+xml'); res.end(image(url.pathname)); return; }
  if (url.pathname.startsWith('/assets/')) {
    const filename = path.resolve(root, 'public', '.' + url.pathname);
    const publicRoot = path.resolve(root, 'public') + path.sep;
    if (filename.startsWith(publicRoot) && fs.existsSync(filename)) { res.setHeader('Content-Type', filename.endsWith('.png') ? 'image/png' : 'image/jpeg'); res.end(fs.readFileSync(filename)); return; }
    res.setHeader('Content-Type', 'image/svg+xml'); res.end(image('Ativo local de teste')); return;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>ORI — teste isolado sem leads reais</title><link rel="stylesheet" href="/fixture.css"><style>#fixture-login{position:fixed;bottom:4px;right:4px;z-index:500;font-size:10px}.fixture-diagnostics{pointer-events:none;position:fixed;bottom:4px;left:4px;z-index:500;background:#fff;font-size:10px;max-width:200px;max-height:70px;overflow:auto}@media print{.fixture-diagnostics,#fixture-login{display:none!important}}</style><div class="fixture-diagnostics">Leads simulados: <output id="fixture-leads">0</output><output id="fixture-generation"></output></div><div id="root"></div><script>globalThis.process={env:{NODE_ENV:"development"}}</script><script src="/fixture.js"></script>');
}).listen(5176, '127.0.0.1', () => console.log('Fixture isolada em http://127.0.0.1:5176 — Supabase e leads são mocks.'));