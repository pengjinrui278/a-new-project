import assert from 'node:assert/strict';
const base='http://127.0.0.1:4177';
async function req(path,method='GET',data,cookie=''){
 const r=await fetch(base+'/api/'+path,{method,headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:data?JSON.stringify(data):undefined});
 return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
const a={name:'verify_'+Date.now(),password:'test-only-987654',label:'验证文章库'};
const login=await req('register','POST',a);assert.equal(login.status,200);
const payload={source:'https://chat.deepseek.com/a/chat/s/example',blocks:['分数：',{math:['math',['mfrac',['mn','1'],['mn','2']]]}],plain:'分数',capture:'sample'};
assert.equal((await req('notes','POST',payload,login.cookie)).status,201);
await req('notes','POST',payload,login.cookie);
assert.equal((await req('logout','POST',{},login.cookie)).status,200);
assert.equal((await req('notes','GET',null,login.cookie)).status,401);
const back=await req('login','POST',a);
const notes=(await req('notes','GET',null,back.cookie)).body;
assert.equal(notes.length,1);assert.deepEqual(JSON.parse(notes[0].blocks),payload.blocks);
const b=await req('register','POST',{...a,name:a.name+'_b'});
assert.deepEqual((await req('notes','GET',null,b.cookie)).body,[]);
assert.equal((await req('notes/'+notes[0].id,'POST',{title:'越权'},b.cookie)).status,404);
assert.equal((await req('notes/'+notes[0].id,'DELETE',null,b.cookie)).status,404);
assert.equal((await req('notes/'+notes[0].id,'DELETE',null,back.cookie)).status,200);
console.log('PASS: persistence after relogin, formula structure, dedupe, owner isolation, edit/delete protection.');
