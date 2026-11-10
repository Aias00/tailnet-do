import { readFile } from 'node:fs/promises';
import '../../src/wasm_exec.js';
const ready=Promise.withResolvers();globalThis.signalReady=ready.resolve;
let socket;
globalThis.WebSocket=class {
 constructor(){socket=this;this.events=new Map();this.readyState=0;this.protocol='';queueMicrotask(()=>{this.readyState=1;this.emit('open',{})})}
 addEventListener(k,f){if(!this.events.has(k))this.events.set(k,new Set());this.events.get(k).add(f)}
 removeEventListener(k,f){this.events.get(k)?.delete(f)}
 emit(k,e){for(const f of [...(this.events.get(k)||[])])f(e)}
 close(code,reason){this.readyState=2;queueMicrotask(()=>{this.readyState=3;this.emit('close',{code,reason,wasClean:false})})}
 send(){}
};
const go=new Go();const {instance}=await WebAssembly.instantiate(await readFile(process.argv[2]),go.importObject);go.run(instance);
const done=globalThis.fixtureSleep();await ready.promise;setTimeout(()=>socket.emit('error',{message:'fixture failure'}),0);console.log(await done);process.exit(0);
