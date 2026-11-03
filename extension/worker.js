const home='https://chat.deepseek.com/';
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
 if(!sender.tab?.url?.startsWith(home)) return;
 (async()=>{
 if(msg.type==='take'){
 const key='draft:'+sender.tab.id; const data=(await chrome.storage.session.get(key))[key]; return data;
 }
 if(msg.type!=='branch') return;
 const current=await chrome.windows.get(sender.tab.windowId);
 const displays=await chrome.system.display.getInfo();
 const area=(displays.find(d=>current.left>=d.bounds.left&&current.left<d.bounds.left+d.bounds.width&&current.top>=d.bounds.top&&current.top<d.bounds.top+d.bounds.height)||displays.find(d=>d.isPrimary)).workArea;
 const half=Math.floor(area.width/2);
 const child=await chrome.windows.create({url:home,left:area.left+half,top:area.top,width:area.width-half,height:area.height});
 await chrome.storage.session.set({['draft:'+child.tabs[0].id]:{text:msg.text,source:sender.tab.url}});
 await chrome.windows.update(current.id,{state:'normal'});
 await chrome.windows.update(current.id,{left:area.left,top:area.top,width:half,height:area.height});
 return true;
 })().then(data=>reply({data}),error=>reply({error:error.message})); return true;
});
