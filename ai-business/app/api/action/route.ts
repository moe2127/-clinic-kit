import { z } from 'zod';
import { revisionFocuses } from '@/lib/shared';
import { requireOwner,sameOrigin } from '@/lib/auth';
import { body,failure } from '@/lib/http';
import { mutate,readState } from '@/lib/store';
import { approve,markReady,assertApproved,noteArticle,metricTotals,type Metric } from '@/lib/domain';
import { settingsSchema,metricSchema,parseMetrics } from '@/lib/input';
import { audit,createFixture,runStage } from '@/lib/workflow';
import { sendNotice } from '@/lib/notify';
import { canAutomate } from '@/lib/connections';
import { aiJson } from '@/lib/ai';
export const maxDuration=300;
const actionSchema=z.object({action:z.enum(['fixture','stage','approve','return','ready','published','settings','metric','csv','retryJob','retryNotice','analysis']),id:z.string().max(100).optional(),stage:z.enum(['research','plan','generate','qa','request','release']).optional(),reason:z.string().max(1000).optional(),focus:z.enum(revisionFocuses).optional(),ack:z.boolean().optional(),noteUrl:z.string().max(400).optional(),checks:z.array(z.boolean()).optional(),data:z.unknown().optional()}).strict();
export async function POST(req:Request){try{sameOrigin(req);const actor=await requireOwner();const input=actionSchema.parse(await body(req));
 if(input.action==='fixture')await createFixture(actor);
 else if(input.action==='stage'){if(!input.stage)throw Error('工程を選択してください');await runStage(input.stage,actor,input.id)}
 else if(input.action==='settings'){const data=settingsSchema.parse(input.data);if(data.automation&&!canAutomate())throw Error('必要な接続が未設定のため自動運転を有効にできません');await mutate(s=>{s.settings=data;audit(s,actor,'販売表示設定を変更（既存会員の課金変更なし）')})}
 else if(input.action==='metric'||input.action==='csv'){const rows=input.action==='csv'?parseMetrics(z.string().parse(input.data)):[metricSchema.parse(input.data)];await mutate(s=>{for(const r of rows){const row={...r,importedAt:new Date().toISOString()};s.metrics=s.metrics.filter(x=>x.month!==r.month||x.plan!==r.plan);s.metrics.push(row as Metric)}audit(s,actor,'集計データを保存（同じ月・プランは置換）')})}
 else if(input.action==='retryJob'){await mutate(s=>{const j=s.jobs.find(j=>j.id===input.id);if(!j||!['error','blocked'].includes(j.status))throw Error('再試行できる履歴ではありません');j.key+=':released:'+Date.now();audit(s,actor,'工程エラーを確認し再試行を許可',undefined,j.id)})}
 else if(input.action==='retryNotice'){if(!input.id)throw Error('通知がありません');await sendNotice(input.id)}
 else if(input.action==='analysis'){const state=await readState();if(!state.metrics.length)throw Error('分析する実績が未登録です');const totals=[...new Set(state.metrics.map(r=>r.month))].map(month=>({month,registeredPlans:state.metrics.filter(r=>r.month===month).length,totals:metricTotals(state.metrics.filter(r=>r.month===month))}));const r=await aiJson(z.object({analysis:z.string().min(10).max(2500)}),'集計実績だけを分析し、期間が複数月ならその旨を明記。売上予測を断定せず、不足データと検証の次の行動を提案。集計:'+JSON.stringify(totals));await mutate(s=>audit(s,actor,'AI集計分析: '+r.analysis))}
 else{await mutate(s=>{const p=s.products.find(p=>p.id===input.id);if(!p)throw Error('商品が見つかりません');if(s.jobs.some(j=>j.status==='running'&&j.key.includes(p.id)))throw Error('制作処理中は変更できません');
 if(input.action==='approve'){approve(p,actor,!!input.ack);audit(s,actor,'商品と集客下書きを承認',p.id,undefined,p.approvalHash)}
 if(input.action==='return'){if(!input.reason?.trim())throw Error('修正理由を入力してください');if(p.status==='published')throw Error('配信済み商品は変更できません');p.status='returned';p.revisionFocus=input.focus;p.version++;delete p.approvalHash;delete p.approvedAt;delete p.approvedBy;delete p.artifact;delete p.artifactHash;p.issues=[];p.repairs=0;audit(s,actor,'差し戻し（理由はAIへ送信しません）',p.id,input.reason)}
 if(input.action==='ready'){markReady(p);audit(s,actor,'手動配信準備',p.id)}
 if(input.action==='published'){assertApproved(p);if(p.status!=='ready')throw Error('配信準備済みの商品が対象です');if(!input.checks||input.checks.length!==4||input.checks.some(c=>!c))throw Error('公開チェックリストをすべて確認してください');if(!input.noteUrl||!noteArticle(input.noteUrl))throw Error('公開したnote記事のURLを入力してください');p.status='published';p.noteUrl=input.noteUrl;audit(s,actor,'noteでの手動公開を記録（APIでの確認なし）',p.id,input.noteUrl,p.approvalHash)}
 })}
 return Response.json({ok:true});}catch(e){return failure(e)}}
