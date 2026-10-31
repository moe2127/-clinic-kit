import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir,writeFile,readFile } from 'node:fs/promises';
import path from 'node:path';
import { localMode,dataDir,supabase } from './store';
import type { Content } from './domain';
export async function buildKit(month:string,content:Content):Promise<{zip:string;sha256:string;checks:string[]}>{
 const payload=JSON.stringify({month,content});
 if(localMode())return new Promise((resolve,reject)=>{const child=spawn(process.env.PYTHON_BIN||'python',['python/kit.py'],{stdio:['pipe','pipe','pipe']});let out='';const timer=setTimeout(()=>{child.kill();reject(Error('Excel生成タイムアウト'))},30000);child.stdout.on('data',d=>{out+=d;if(out.length>3000000){child.kill();reject(Error('成果物が上限を超えました'))}});child.stderr.resume();child.on('error',()=>{clearTimeout(timer);reject(Error('Pythonを起動できません'))});child.on('close',code=>{clearTimeout(timer);try{if(code!==0)throw Error();resolve(JSON.parse(out))}catch{reject(Error('Excel生成・検査に失敗しました'))}});child.stdin.end(payload)});
 const url=process.env.PYTHON_WORKER_URL,token=process.env.PYTHON_WORKER_TOKEN;if(!url?.startsWith('https://')||!token)throw Error('Pythonワーカー未接続');
 const response=await fetch(new URL('/build',url),{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:payload,signal:AbortSignal.timeout(45000)});if(!response.ok)throw Error('Excelワーカーの検査に失敗しました');const result=await response.json();if(!result.zip||!result.sha256||result.zip.length>3000000)throw Error('Excelワーカーの応答が不正です');return result;
}
export async function saveArtifact(id:string,version:number,zip:string,hash:string){
 const buf=Buffer.from(zip,'base64');if(createHash('sha256').update(buf).digest('hex')!==hash)throw Error('成果物ハッシュ不一致');const key=`${id}/v${version}-${hash}.zip`;
 if(localMode()){await mkdir(path.join(dataDir(),'files',id),{recursive:true});await writeFile(path.join(dataDir(),'files',key),buf,{mode:0o600})}
 else{const {error}=await supabase().storage.from('kits').upload(key,buf,{contentType:'application/zip',upsert:false});if(error)throw Error('成果物の保存に失敗しました')}
 return key;
}
export async function loadArtifact(key:string,hash:string){
 if(!/^[a-f0-9-]+\/v\d+-[a-f0-9]+\.zip$/.test(key))throw Error('不正なファイルパス');
 let buf:Buffer;if(localMode())buf=await readFile(path.join(dataDir(),'files',key));else{const {data,error}=await supabase().storage.from('kits').download(key);if(error||!data)throw Error('ファイルを読み込めません');buf=Buffer.from(await data.arrayBuffer())}
 if(createHash('sha256').update(buf).digest('hex')!==hash)throw Error('ファイルが変更されています');return buf;
}
