(()=>{
const app='http://127.0.0.1:4177/';
const host=document.createElement('div');host.style.cssText='position:fixed;right:16px;bottom:110px;z-index:2147483647';document.documentElement.append(host);
const root=host.attachShadow({mode:'closed'});
root.innerHTML='<style>section{max-width:300px;background:white;color:#243041;border:1px solid #c6d6e6;border-radius:10px;padding:10px;font:14px system-ui;box-shadow:0 4px 16px #0002}button{margin:3px;padding:6px}small{display:block}</style><section hidden><button id="branch">展开追问</button><button id="save">存为笔记</button><button id="fill" hidden>填入分支上下文</button><small role="status"></small></section>';
const box=root.querySelector('section'), status=root.querySelector('small');
let clip=null, draft=null;
const mathTags=new Set('math semantics mrow mi mn mo mtext mfrac msqrt mroot msup msub msubsup mover munder munderover mtable mtr mtd mspace'.split(' '));
function mathTree(n){if(n.nodeType===3)return n.textContent;if(!mathTags.has(n.localName))return null;return [n.localName,...Array.from(n.childNodes,mathTree).filter(x=>x!==null)];}
function capture(range){
 const blocks=[]; let plain='';
 const walk=n=>{
 if(n.nodeType===3){const last=blocks.at(-1);if(typeof last==='string')blocks[blocks.length-1]+=n.textContent;else blocks.push(n.textContent);plain+=n.textContent;return;}
 if(n.nodeType===1){
 const math=n.matches('math')?n:n.matches('.katex')?n.querySelector('math'):null;
 if(math){const tex=math.querySelector('annotation[encoding="application/x-tex"]')?.textContent;blocks.push({math:mathTree(math)});plain+=tex?' \\('+tex+'\\) ':(' '+math.textContent+' ');return;}
 if(n.matches('.katex-html,button,script,style,textarea,input'))return;
 if(n.matches('br')){walk(document.createTextNode('\n'));return;}
 }
 for(const c of n.childNodes)walk(c);
 if(n.nodeType===1&&n.matches('p,div,li,pre'))walk(document.createTextNode('\n'));
 };
 walk(range.cloneContents());return {blocks,plain,source:location.href};
}
document.addEventListener('selectionchange',()=>{
 const s=getSelection();if(!s?.rangeCount||s.isCollapsed||s.anchorNode?.parentElement?.closest('input,textarea,[contenteditable]'))return;
 const r=s.getRangeAt(0).cloneRange();
 for(const m of document.querySelectorAll('.katex,math:not(.katex math)')){
 if(!r.intersectsNode(m))continue;
 const q=document.createRange();q.selectNode(m);
 if(r.compareBoundaryPoints(Range.START_TO_START,q)>0)r.setStart(q.startContainer,q.startOffset);
 if(r.compareBoundaryPoints(Range.END_TO_END,q)<0)r.setEnd(q.endContainer,q.endOffset);
 }
 const next=capture(r);if(!next.plain.trim()||next.plain.length>12000)return;
 clip=next;box.hidden=false;status.textContent='已选中 '+clip.plain.trim().length+' 字';
});
root.querySelector('#save').onclick=()=>{if(!clip)return; const value=encodeURIComponent(JSON.stringify(clip));if(value.length>160000)return status.textContent='选文太长，请缩小范围';window.open(app+'#capture='+value,'_blank','noopener');};
root.querySelector('#branch').onclick=async()=>{if(!clip)return;const extra=prompt('补充原题、条件或追问（可留空）','');if(extra===null)return;const text='请根据下面摘录继续讨论，若缺少条件请先指出。\\n摘录：'+clip.plain+'\\n补充与追问：'+extra;const result=await chrome.runtime.sendMessage({type:'branch',text});status.textContent=result.error||'已打开并排窗口，请在新会话填入并确认发送。';};
const fill=root.querySelector('#fill');
async function check(){const r=await chrome.runtime.sendMessage({type:'take'});if(r?.data){draft=r.data;fill.hidden=false;box.hidden=false;status.textContent='请先确认当前是新会话，再填入上下文。';}}
check();setTimeout(check,1500);
fill.onclick=async()=>{if(!draft)return;
const inputs=[...document.querySelectorAll('textarea')].filter(e=>!e.disabled&&e.getClientRects().length);
if(inputs.length!==1||inputs[0].value.trim()){
 await navigator.clipboard.writeText(draft.text);
 status.textContent='已复制上下文，可手动粘贴；已有草稿未改动。';return;
}
const input=inputs[0];Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,draft.text);input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();status.textContent='请检查内容，然后用原网站发送。';
};
})();
