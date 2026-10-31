import { equal } from '@/lib/auth';import { readState,mutate } from '@/lib/store';import { schedule } from '@/lib/domain';import { runStage } from '@/lib/workflow';import { notify } from '@/lib/notify';
export const maxDuration=300;
export const dynamic='force-dynamic';
export async function GET(req:Request){const key=process.env.CRON_SECRET;if(!key||key.length<32||!equal(req.headers.get('authorization')||'',`Bearer ${key}`))return Response.json({error:'Unauthorized'},{status:401});
 try{
 const stale=await mutate(s=>{const jobs=s.jobs.filter(j=>j.status==='running'&&Date.now()-Date.parse(j.startedAt)>20*60000);for(const j of jobs){j.status='error';j.endedAt=new Date().toISOString();j.message='実行中断を検出。重複課金防止のため自動再実行しません'}return jobs.length});if(stale)await notify('中断した工程を検出しました。実行履歴と費用予約を確認してください。');
 const s=await readState();if(!s.settings.automation)return Response.json({status:'paused',message:'自動運転は停止中'});const stage=schedule();if(!stage)return Response.json({status:'idle'});
 // Stages are once-per-period. Generation on 18–20 will not duplicate a completed draft.
 try{await runStage(stage,'cron');return Response.json({status:'complete',stage})}catch(e){const message=e instanceof Error?e.message:'error';return Response.json({status:'blocked',stage,message},{status:message.includes('実行済み')?200:409})}
 }catch{return Response.json({error:'定期実行の接続または保存に失敗しました'},{status:500})}}
