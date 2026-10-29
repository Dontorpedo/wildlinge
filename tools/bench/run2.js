const fs=require('fs');
function bench(name,m,n=3000){m.init();for(let i=0;i<300;i++)m.step();const t0=process.hrtime.bigint();for(let i=0;i<n;i++)m.step();const ms=Number(process.hrtime.bigint()-t0)/1e6/n;console.log(name.padEnd(28),ms.toFixed(3),'ms/step',(ms/500*1000).toFixed(2),'us/creature');return ms;}
(async()=>{const o=bench('JS Objekte (wie bisher)',require('./kernel_obj.js'));const a=bench('JS Typed Arrays',require('./kernel.js'));
const {instance}=await WebAssembly.instantiate(fs.readFileSync('kernel.wasm'),{});const b=bench('C -> WebAssembly',instance.exports);
console.log('Faktor Typed/Objekte',(o/a).toFixed(2),'| WASM/Typed',(a/b).toFixed(2),'| WASM/Objekte',(o/b).toFixed(2));})();
