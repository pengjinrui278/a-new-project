import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync} from 'node:fs';
import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
mkdirSync(new URL('./.data/',import.meta.url),{recursive:true});
const db=new DatabaseSync(new URL('./.data/workbench.sqlite',import.meta.url));
db.exec('CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT UNIQUE, label TEXT NOT NULL, salt TEXT, hash TEXT); CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, owner INTEGER, expiry INTEGER); CREATE TABLE IF NOT EXISTS notes(id INTEGER PRIMARY KEY, owner INTEGER, title TEXT, blocks TEXT, source TEXT, body TEXT, capture TEXT, UNIQUE(owner,capture));');
const origin='http://127.0.0.1:4177';
const digest=s=>createHash('sha256').update(s).digest('hex');
function json(res,status,data,headers={}){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data));}
async function body(req){let data='';for await(const c of req){data+=c;if(data.length>240000)throw Error('内容过长');}return JSON.parse(data||'{}');}
http.createServer(async(req,res)=>{
 const url=new URL(req.url,origin), p=url.pathname;
 if(req.headers.host!=='127.0.0.1:4177')return json(res,403,{error:'仅允许本机入口'});
 if(req.method!=='GET'&&req.headers.origin!==origin)return json(res,403,{error:'来源不符'});
 if(req.method==='GET'&&(p==='/'||p==='/app.js')){res.writeHead(200,{'Content-Type':p==='/'?'text/html; charset=utf-8':'text/javascript; charset=utf-8','Content-Security-Policy':"default-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'",'Referrer-Policy':'no-referrer'});return res.end(readFileSync(new URL(p==='/'?'./index.html':'./app.js',import.meta.url)));}
 const token=req.headers.cookie?.match(/(?:^|; )sid=([a-f0-9]{64})(?:;|$)/)?.[1]||'';
 const user=db.prepare('SELECT users.id,users.name,users.label FROM sessions JOIN users ON owner=users.id WHERE token=? AND expiry>?').get(digest(token),Date.now());
 try{
 if(req.method==='POST'&&['/api/register','/api/login'].includes(p)){
 const {name,password,label}=await body(req);
 if(typeof name!=='string'||!/^[-a-zA-Z0-9_]{3,32}$/.test(name)||typeof password!=='string'||password.length<8||password.length>128)return json(res,400,{error:'账号为 3–32 位字母、数字或下划线，密码至少 8 位'});
 if(p.endsWith('register')){
 if(db.prepare('SELECT id FROM users WHERE name=?').get(name))return json(res,409,{error:'账号已存在'});
 const salt=randomBytes(16).toString('hex');db.prepare('INSERT INTO users(name,label,salt,hash) VALUES(?,?,?,?)').run(name,String(label||'我的文章').slice(0,50),salt,scryptSync(password,salt,64).toString('hex'));
 }
 const row=db.prepare('SELECT * FROM users WHERE name=?').get(name);
 if(!row||!timingSafeEqual(Buffer.from(row.hash,'hex'),scryptSync(password,row.salt,64)))return json(res,401,{error:'账号或密码错误'});
 const sid=randomBytes(32).toString('hex');
 db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(sid),row.id,Date.now()+7*86400000);
 return json(res,200,{ok:true},{'Set-Cookie':'sid='+sid+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800'});
 }
 if(!user)return json(res,401,{error:'请先登录'});
 if(req.method==='POST'&&p==='/api/logout'){db.prepare('DELETE FROM sessions WHERE token=?').run(digest(token));return json(res,200,{ok:true},{'Set-Cookie':'sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});}
 if(req.method==='GET'&&p==='/api/me')return json(res,200,user);
 if(req.method==='POST'&&p==='/api/settings'){const b=await body(req);db.prepare('UPDATE users SET label=? WHERE id=?').run(String(b.label||'我的文章').slice(0,50),user.id);return json(res,200,{ok:true});}
 if(req.method==='GET'&&p==='/api/notes')return json(res,200,db.prepare('SELECT id,title,blocks,source,body FROM notes WHERE owner=? ORDER BY id DESC').all(user.id));
 if(req.method==='POST'&&p==='/api/notes'){
 const b=await body(req);const source=new URL(b.source);
 if(source.origin!=='https://chat.deepseek.com'||!Array.isArray(b.blocks)||!b.blocks.length||typeof b.capture!=='string')return json(res,400,{error:'摘录格式有误'});
 db.prepare("INSERT OR IGNORE INTO notes(owner,title,blocks,source,body,capture) VALUES(?,?,?,?,'',?)").run(user.id,String(b.plain||'未命名笔记').trim().slice(0,48),JSON.stringify(b.blocks),source.href,b.capture.slice(0,80));
 return json(res,201,{ok:true});
 }
 const id=p.match(/^\/api\/notes\/(\d+)$/)?.[1];
 if(id&&['POST','DELETE'].includes(req.method)){
 const r=req.method==='DELETE'?db.prepare('DELETE FROM notes WHERE id=? AND owner=?').run(id,user.id):await (async()=>{const b=await body(req);return db.prepare('UPDATE notes SET title=?,body=? WHERE id=? AND owner=?').run(String(b.title||'未命名笔记').slice(0,100),String(b.body||'').slice(0,60000),id,user.id);})();
 return json(res,r.changes?200:404,r.changes?{ok:true}:{error:'找不到笔记'});
 }
 return json(res,404,{error:'找不到页面'});
 }catch{return json(res,400,{error:'请求无效或内容过长'});}
}).listen(4177,'127.0.0.1',()=>console.log(origin));
