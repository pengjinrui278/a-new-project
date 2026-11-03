const $=id=>document.getElementById(id), status=s=>$('status').textContent=s;
const allowed=new Set('math semantics mrow mi mn mo mtext mfrac msqrt mroot msup msub msubsup mover munder munderover mtable mtr mtd mspace'.split(' '));
function math(tree,depth=0){
 if(typeof tree==='string')return document.createTextNode(tree);
 if(depth>45||!Array.isArray(tree)||!allowed.has(tree[0]))return document.createTextNode('');
 const e=document.createElementNS('http://www.w3.org/1998/Math/MathML',tree[0]);for(const n of tree.slice(1))e.append(math(n,depth+1));return e;
}
if(location.hash.startsWith('#capture=')){
 try{const clip=JSON.parse(decodeURIComponent(location.hash.slice(9)));sessionStorage.setItem('capture',JSON.stringify({...clip,capture:crypto.randomUUID()}));}catch{status('无法读取摘录');}
 history.replaceState(null,'','/');
}
async function api(path,method='GET',data){
 const res=await fetch('/api/'+path,{method,headers:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
 const result=await res.json();if(!res.ok)throw Error(result.error);return result;
}
const guard=fn=>async e=>{e?.preventDefault();try{await fn(e);}catch(error){status(error.message);}};
async function refresh(){
 let me;try{me=await api('me');}catch{$('auth').hidden=false;$('library').hidden=true;if(sessionStorage.getItem('capture'))status('登录后保存这条摘录。');return;}
 $('auth').hidden=true;$('library').hidden=false;$('label').textContent=me.label;$('settings').elements.label.value=me.label;
 const pending=sessionStorage.getItem('capture');
 if(pending){await api('notes','POST',JSON.parse(pending));sessionStorage.removeItem('capture');status('已保存为私人笔记。');}
 const list=$('notes');list.replaceChildren();const notes=await api('notes');
 if(!notes.length)list.textContent='暂无笔记。可从 DeepSeek 选中文字后保存。';
 for(const note of notes){
 const article=document.createElement('article'), title=document.createElement('input'), quote=document.createElement('blockquote'), body=document.createElement('textarea'), link=document.createElement('a'), save=document.createElement('button'), remove=document.createElement('button');
 title.value=note.title;title.setAttribute('aria-label','标题');body.value=note.body;body.placeholder='写下自己的理解…';body.setAttribute('aria-label','批注');
 for(const part of JSON.parse(note.blocks))quote.append(typeof part==='string'?document.createTextNode(part):math(part?.math));
 link.href=note.source;link.textContent='查看原会话';link.target='_blank';link.rel='noopener noreferrer';
 save.textContent='保存修改';save.onclick=guard(async()=>{await api('notes/'+note.id,'POST',{title:title.value,body:body.value});status('已保存修改。');});
 remove.textContent='删除';remove.onclick=guard(async()=>{if(confirm('删除这条私人笔记？')){await api('notes/'+note.id,'DELETE');article.remove();}});
 article.append(title,quote,link,body,save,remove);list.append(article);
 }
}
$('auth').onsubmit=guard(async e=>{await api(e.submitter?.value||'login','POST',Object.fromEntries(new FormData(e.target)));e.target.reset();status('');await refresh();});
$('settings').onsubmit=guard(async e=>{await api('settings','POST',Object.fromEntries(new FormData(e.target)));await refresh();});
$('logout').onclick=guard(async()=>{await api('logout','POST');location.reload();});
guard(refresh)();
