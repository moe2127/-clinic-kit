import { createClient } from '@supabase/supabase-js';
import { mkdir,readFile,writeFile,rename,open,unlink } from 'node:fs/promises';
import path from 'node:path';
import { initialState,type AppState } from './domain';
export function localMode(){return process.env.APP_MODE==='local'&&!process.env.VERCEL}
export function supabase(){if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Supabase未接続');return createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})}
export function dataDir(){return path.resolve(process.env.LOCAL_DATA_DIR||'.data')}
const stateFile=()=>path.join(dataDir(),'state.json');
export async function readState():Promise<AppState>{
 if(localMode()){try{return JSON.parse(await readFile(stateFile(),'utf8'))}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return initialState();throw e}}
 const {data,error}=await supabase().from('app_state').select('data').eq('id','main').single();if(error)throw Error('データベースを読み込めません。Supabase設定を確認してください');return data.data;
}
export async function mutate<T>(fn:(s:AppState)=>T):Promise<T>{
 if(localMode()){
  await mkdir(dataDir(),{recursive:true});const lock=path.join(dataDir(),'state.lock');let handle;
  for(let i=0;i<80;i++){try{handle=await open(lock,'wx');break}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;await new Promise(r=>setTimeout(r,25))}}
  if(!handle)throw Error('更新処理が混雑しています');
  try{const state=await readState();const result=fn(state);const temp=stateFile()+'.tmp';await writeFile(temp,JSON.stringify(state),{mode:0o600});await rename(temp,stateFile());return result}finally{await handle.close();await unlink(lock)}
 }
 for(let i=0;i<12;i++){
  const db=supabase();const {data,error}=await db.from('app_state').select('*').eq('id','main').single();if(error)throw Error('Supabase未設定または読み込みエラー');
  const state:AppState=data.data;const result=fn(state);const {data:ok,error:err}=await db.rpc('compare_and_swap_state',{expected_revision:data.revision,new_data:state});if(err)throw Error('データ保存に失敗しました');if(ok)return result;
 }
 throw Error('同時更新のため保存できませんでした。再実行してください');
}
export async function publicSettings(){try{const {settings}=await readState();return {prices:settings.prices,noteUrls:settings.noteUrls,connected:true}}catch{return {prices:initialState().settings.prices,noteUrls:initialState().settings.noteUrls,connected:false}}}
