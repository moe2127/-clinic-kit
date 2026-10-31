import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { aiJson } from './ai';
import { contentSchema,inspectContent,nextMonth,currentMonth,markReady,industries,fingerprint,type Product,type AppState,type Content } from './domain';
import { readState,mutate,localMode } from './store';
import { buildKit,saveArtifact } from './artifacts';
import { notify } from './notify';
import { fixtureContent } from './fixtures';
export function audit(s:AppState,actor:string,action:string,productId?:string,reason?:string,hash?:string){s.events.unshift({at:new Date().toISOString(),actor,action,productId,reason,hash})}
export async function createFixture(actor:string){if(!localMode())throw Error('検証用素材はローカル専用です');const state=await readState();const p:Product={id:randomUUID(),month:nextMonth(),industry:state.settings.industry,theme:'検証用セット（AI未生成・販売承認不可）',status:'draft',version:1,scheduledAt:nextMonth()+'-01T00:00:00+09:00',issues:[],repairs:0,origin:'fixture',content:fixtureContent()};await mutate(s=>{s.products.unshift(p);audit(s,actor,'検証用セットを作成',p.id)});await qaProduct(p.id);return p.id}
export async function research(industry:string){
 if(!process.env.BRAVE_SEARCH_API_KEY)throw Error('外部検索未接続。調査結果は生成しません');
 const url=new URL('https://api.search.brave.com/res/v1/web/search');url.searchParams.set('q',`${industry} 一人運営 予約管理 発信 課題`);url.searchParams.set('count','5');
 const r=await fetch(url,{headers:{'X-Subscription-Token':process.env.BRAVE_SEARCH_API_KEY},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('外部検索エラー');const json=await r.json();
 const results=(json.web?.results||[]).slice(0,5).filter((x:{url:string;description:string})=>{try{return new URL(x.url).protocol==='https:'&&typeof x.description==='string'}catch{return false}}).map((x:{url:string;title:string;description:string})=>({url:x.url,title:x.title.slice(0,200),evidence:x.description.replace(/<[^>]*>/g,'').slice(0,800),date:new Date().toISOString(),kind:'search_excerpt' as const,industry}));
 if(!results.length)throw Error('調査結果がありません');await mutate(s=>{s.sources.push(...results);audit(s,'system','公開検索結果を保存（原文未確認）')});
}
export async function plan(industry:typeof industries[number],month:string){
 const state=await readState();if(state.products.some(p=>p.month===month&&p.industry===industry&&p.origin==='ai'))throw Error('同じ月・業種の商品企画は存在します');
 const sources=state.sources.filter(s=>s.industry===industry&&Date.now()-Date.parse(s.date)<31*86400000);if(!sources.length)throw Error('最近の調査結果がないため企画を停止しました');
 const themeResult=await aiJson(z.object({theme:z.string().min(5).max(100),hypothesis:z.string().min(10).max(600)}),`対象:${industry}、販売月:${month}。公開検索結果の抜粋（原文未確認）:${JSON.stringify(sources.map(s=>({url:s.url,evidence:s.evidence})))}。過去のテーマ:${JSON.stringify(state.products.map(p=>p.theme).slice(0,30))}。同じテーマを避け、営業案内・運営管理の翌月キットのテーマを選んでください。hypothesisは仮説として記載。`);
 if(state.products.some(p=>p.theme===themeResult.theme))throw Error('過去テーマと重複しています');
 const p:Product={id:randomUUID(),month,industry,theme:themeResult.theme,status:'planned',version:1,scheduledAt:month+'-01T00:00:00+09:00',issues:[],repairs:0,origin:'ai'};
 await mutate(s=>{if(s.products.some(x=>x.month===month&&x.industry===industry&&x.origin==='ai'))throw Error('企画が重複しました');s.products.unshift(p);audit(s,'system','企画仮説: '+themeResult.hypothesis,p.id)});
}
async function generateText(p:Product,repairCodes:string[]=[]):Promise<Content>{return aiJson(contentSchema,`商品対象:${p.industry}、月:${p.month}、テーマ:${p.theme}。修正方針:${p.revisionFocus||'初回制作'}。全素材を独自の日本語で作成。SNS20本、ブログ4本、AIプロンプト5個、使い方、キャンペーン1本、改善チェックリスト5項目以上。SNSは各120〜220字、ブログは各400〜700字を目安とする。集客下書きにはX、Instagram、画像案、リール台本、ブログ、販売ページ改善案を各1本。使い方は1ページ相当。Excelはシステムが別途生成するため、基本管理表（予約枠・予約件数・来院数・売上）、応用管理表（平均来院単価と振り返り）、経営分析（費用控除参考額）の使い方を説明。休診日0枠、患者情報なし、架空数値の削除を案内。ブログ等は内容を重複させない。修正すべき検査コード:${JSON.stringify(repairCodes)}。個別相談・カスタマイズ・効果保証なし。`)}
export async function generateProduct(id:string){const p=(await readState()).products.find(p=>p.id===id);if(!p||p.origin!=='ai'||!['planned','returned'].includes(p.status))throw Error('生成対象ではありません');const c=await generateText(p);await mutate(s=>{const live=s.products.find(x=>x.id===id)!;if(live.version!==p.version||!['planned','returned'].includes(live.status))throw Error('商品状態が変わりました');live.content=c;live.status='draft';audit(s,'system','商品下書きを生成',id)})}
export async function qaProduct(id:string){
 let p=(await readState()).products.find(p=>p.id===id);if(!p?.content||!['draft','error'].includes(p.status))throw Error('検査できる下書きがありません');
 for(;;){
 const state=await readState();p=state.products.find(p=>p.id===id)!;const issues=inspectContent(contentSchema.parse(p.content),state.products,p.id);let artifact:{key:string;hash:string}|undefined;
 if(!issues.some(i=>i.level==='error'))try{const file=await buildKit(p.month,p.content!);artifact={key:await saveArtifact(p.id,p.version,file.zip,file.sha256),hash:file.sha256}}catch{issues.push({level:'error',code:'xlsx',message:'Excel生成・検査・保存に失敗しました。Python接続を確認してください'})}
 if(!issues.some(i=>i.level==='error')&&artifact){await mutate(s=>{const live=s.products.find(x=>x.id===id)!;if(live.version!==p!.version||!['draft','error'].includes(live.status))throw Error('商品状態が変わりました');live.issues=issues;live.artifact=artifact!.key;live.artifactHash=artifact!.hash;live.status='review';audit(s,'system','品質検査完了（人による確認待ち）',id)});return}
 await mutate(s=>{const live=s.products.find(x=>x.id===id)!;live.issues=issues;live.status='error'});
 if(p.repairs>=3||p.origin==='fixture'||issues.some(i=>i.code==='xlsx')){await notify('商品検査エラー：'+p.theme+'。承認へは進めません。管理画面を確認してください。');return}
 await mutate(s=>{s.products.find(x=>x.id===id)!.repairs+=1});
 try{const c=await generateText(p,issues.filter(i=>i.level==='error').map(i=>i.code));await mutate(s=>{const live=s.products.find(x=>x.id===id)!;live.content=c;live.version+=1;live.status='draft';audit(s,'system','自動修正',id)})}catch(e){await notify('自動修正を停止しました。費用上限または接続を確認してください。');throw e}
 }
}
export async function runStage(stage:string,actor:string,productId?:string){
 const state=await readState();const month=stage==='release'?currentMonth():nextMonth();const industry=state.settings.industry;
 const p=productId?state.products.find(p=>p.id===productId):state.products.find(p=>p.month===month&&p.industry===industry&&p.origin==='ai');
 if(productId&&!p)throw Error('商品が見つかりません');
 const jobKey=`${month}:${industry}:${stage}:${p?.id||'none'}:${p?.version||0}`;
 const jobId=randomUUID();
 await mutate(s=>{if(s.jobs.some(j=>j.key===jobKey&&['running','success','error','blocked'].includes(j.status)))throw Error('この工程は実行済みまたは実行中です。エラーの再試行は実行履歴から解除してください');if(p&&s.jobs.some(j=>j.status==='running'&&j.key.includes(p.id)))throw Error('同じ商品の処理が実行中です');s.jobs.unshift({id:jobId,key:jobKey,stage,status:'running',startedAt:new Date().toISOString()});audit(s,actor,'工程開始: '+stage,p?.id)});
 try{
 if(stage==='research')await research(industry);
 else if(stage==='plan')await plan(industry,month);
 else if(stage==='generate'){if(!p)throw Error('商品企画がありません');await generateProduct(p.id)}
 else if(stage==='qa'){if(!p)throw Error('商品がありません');await qaProduct(p.id);const updated=(await readState()).products.find(x=>x.id===p.id);if(updated?.status==='error')throw Error('品質検査が失敗しました。承認不可です')}
 else if(stage==='request'){if(!p||p.status!=='review')throw Error('検査完了の商品がありません');await notify('承認依頼：'+p.theme+'。配信予定 '+p.scheduledAt)}
 else if(stage==='release'){await mutate(s=>{let count=0;for(const x of s.products.filter(x=>x.month===month&&x.origin==='ai'&&x.status==='approved')){markReady(x);audit(s,'system','手動配信用に準備（note未公開）',x.id,undefined,fingerprint(x));count++}if(!count)throw Error('当月の承認済み商品がないため公開を停止しました')});await notify('承認済み商品を配信準備にしました。noteへの実際の公開はチェックリストから手動で行ってください。')}
 else throw Error('不明な工程');
 await mutate(s=>{const j=s.jobs.find(j=>j.id===jobId)!;j.status='success';j.endedAt=new Date().toISOString()});
 }catch(e){const message=e instanceof Error?e.message:'工程エラー';await mutate(s=>{const j=s.jobs.find(j=>j.id===jobId)!;j.status='error';j.endedAt=new Date().toISOString();j.message=message});await notify('工程エラー：'+stage+' / '+message);throw e}
}
