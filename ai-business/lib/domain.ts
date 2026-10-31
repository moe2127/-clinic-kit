import { z } from 'zod';
import { createHash } from 'node:crypto';
export { industries,plans,planNames } from './shared';
import { industries } from './shared';
export type { Plan } from './shared';
import type { Plan } from './shared';
const text=z.string().min(10).max(6000);
export const contentSchema=z.object({
 sns:z.array(text).length(20),blogs:z.array(text).length(4),prompts:z.array(text).length(5),guide:text,
 campaign:text,checklist:z.array(text).min(5).max(12),
 marketing:z.object({x:text,instagram:text,imageIdea:text,reel:text,blog:text,pageImprovement:text})
}).strict();
export type Content=z.infer<typeof contentSchema>;
export type Status='planned'|'draft'|'error'|'review'|'approved'|'returned'|'ready'|'published';
export type Issue={level:'error'|'review';code:string;message:string};
export type Product={id:string;month:string;industry:typeof industries[number];theme:string;status:Status;version:number;scheduledAt:string;content?:Content;issues:Issue[];artifact?:string;artifactHash?:string;approvalHash?:string;approvedBy?:string;approvedAt?:string;repairs:number;origin:'ai'|'fixture';noteUrl?:string;revisionFocus?:string};
export type Source={url:string;title:string;evidence:string;date:string;kind:'search_excerpt';industry:string};
export type Job={id:string;key:string;stage:string;status:'running'|'success'|'error'|'blocked';startedAt:string;endedAt?:string;message?:string};
export type Ledger={id:string;month:string;reservedYen:number;actualYen?:number;status:'reserved'|'settled'|'uncertain';tokens?:number;model:string};
export type Metric={month:string;plan:Plan;revenue:number;members:number;newMembers:number;cancelled:number;openingMembers:number;otherCost:number;productRevenue:number;productName:string;source:string;importedAt:string};
export type Settings={prices:Record<Plan,number>;noteUrls:Record<Plan,string>;monthlyAiLimit:number;automation:boolean;industry:typeof industries[number]};
export type AppState={settings:Settings;products:Product[];sources:Source[];jobs:Job[];ledger:Ledger[];metrics:Metric[];events:{at:string;actor:string;action:string;productId?:string;reason?:string;hash?:string}[];notices:{id:string;at:string;message:string;status:'pending'|'sent'|'unconnected'|'error'}[];loginAttempts:Record<string,{count:number;since:number}>};
export const initialState=():AppState=>({settings:{prices:{light:1980,standard:4980,premium:9800},noteUrls:{light:'',standard:'',premium:''},monthlyAiLimit:3000,automation:false,industry:'鍼灸院'},products:[],sources:[],jobs:[],ledger:[],metrics:[],events:[],notices:[],loginAttempts:{}});
export function noteUrl(value:string){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='note.com'&&!u.port&&!u.username&&!u.password&&/^\/[^/]+\/membership(?:\/|$)/.test(u.pathname)}catch{return false}}
export function noteArticle(value:string){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='note.com'&&!u.port&&!u.username&&!u.password&&/^\/[^/]+\/n\/[a-zA-Z0-9]+$/.test(u.pathname)}catch{return false}}
export const monthSchema=z.string().regex(/^20\d\d-(0[1-9]|1[0-2])$/);
export function tokyo(now=new Date()){return new Date(now.getTime()+9*3600000)}
export function currentMonth(now=new Date()){return tokyo(now).toISOString().slice(0,7)}
export function nextMonth(now=new Date()){const d=tokyo(now);return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1)).toISOString().slice(0,7)}
export function fingerprint(p:Product){return createHash('sha256').update(JSON.stringify({id:p.id,version:p.version,month:p.month,industry:p.industry,theme:p.theme,scheduledAt:p.scheduledAt,origin:p.origin,content:p.content,artifactHash:p.artifactHash})).digest('hex')}
export function selectPlan(content:Content,plan:Plan){return {sns:content.sns.slice(0,plan==='light'?4:plan==='standard'?12:20),guide:content.guide,...(plan!=='light'?{blogs:content.blogs.slice(0,plan==='standard'?2:4),prompts:content.prompts}:{}),...(plan==='premium'?{campaign:content.campaign,checklist:content.checklist}:{})}}
export function approve(p:Product,actor:string,ack:boolean){
 if(p.status!=='review'||!p.content||!p.artifactHash||!p.artifact)throw Error('検査済みの商品だけ承認できます');
 if(p.origin!=='ai')throw Error('検証用素材は販売承認できません');
 if(p.issues.some(i=>i.level==='error'))throw Error('検査エラーがあります');
 if(!ack)throw Error('広告表現・権利・内容の人による確認が必要です');
 p.approvalHash=fingerprint(p);p.approvedBy=actor;p.approvedAt=new Date().toISOString();p.status='approved';
}
export function assertApproved(p:Product){if(!['approved','ready','published'].includes(p.status)||!p.approvedBy||p.approvalHash!==fingerprint(p))throw Error('未承認または承認後に変更された商品です')}
export function markReady(p:Product,now=new Date()){assertApproved(p);if(new Date(p.scheduledAt)>now)throw Error('配信予定日前です');p.status='ready'}
export function spent(s:AppState,month:string){return s.ledger.filter(l=>l.month===month).reduce((n,l)=>n+(l.status==='settled'?(l.actualYen??l.reservedYen):l.reservedYen),0)}
export function reserve(s:AppState,id:string,amount:number,model:string,now=new Date()){
 const month=currentMonth(now);if(!Number.isFinite(amount)||amount<=0)throw Error('費用単価を設定してください');
 if(spent(s,month)+amount>s.settings.monthlyAiLimit)throw Error('AI月額上限に達しました');
 s.ledger.push({id,month,reservedYen:amount,status:'reserved',model});
}
export function inspectContent(c:Content,existing:Product[],selfId:string):Issue[]{
 const issues:Issue[]=[];const pieces=[...c.sns,...c.blogs,...c.prompts,c.guide,c.campaign,...c.checklist,...Object.values(c.marketing)];
 const normalized=pieces.map(t=>t.replace(/\s/g,''));
 if(new Set(normalized).size!==normalized.length)issues.push({level:'error',code:'duplicate',message:'素材内に同一文が重複しています'});
 for(const p of existing){if(p.id===selfId||!p.content)continue;const old=new Set([...p.content.sns,...p.content.blogs].map(t=>t.replace(/\s/g,'')));if([...c.sns,...c.blogs].some(t=>old.has(t.replace(/\s/g,'')))){issues.push({level:'error',code:'past_duplicate',message:'過去商品と同じ本文があります'});break}}
 if(pieces.some(t=>/必ず治|完治|絶対に治|売上保証|100[%％]改善|地域[ＮNn][oＯｏ.]?\.?1|副作用[がは]?ない/.test(t)))issues.push({level:'error',code:'claim',message:'効果断定・最上級・保証に関する表現を修正してください'});
 if(pieces.some(t=>/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(t)||/0\d{1,4}-\d{1,4}-\d{3,4}/.test(t)))issues.push({level:'error',code:'pii',message:'連絡先に見える文字列があります。プレースホルダーを使用してください'});
 if(pieces.some(t=>/�|TODO|Lorem ipsum/i.test(t)))issues.push({level:'error',code:'text',message:'文字化け・未完成の文面があります'});
 issues.push({level:'review',code:'human',message:'広告ルール（あはき・柔整・景品表示等）、誤字、権利、事実、院ごとの表現を人が確認してください。自動検査は法令適合・著作権を保証しません'});
 return issues;
}
export function schedule(now=new Date()):string|null{const day=tokyo(now).getUTCDate();if(day===15)return 'research';if(day===16)return 'plan';if(day>=17&&day<=20)return 'generate';if(day===21)return 'qa';if(day===22)return 'request';if(day===1)return 'release';return null}
export function metricTotals(rows:Metric[]){if(!rows.length)return null;const sum=(k:keyof Metric)=>rows.reduce((n,r)=>n+Number(r[k]),0);return {revenue:sum('revenue'),members:sum('members'),newMembers:sum('newMembers'),cancelled:sum('cancelled'),churn:sum('openingMembers')?sum('cancelled')/sum('openingMembers'):null,otherCost:sum('otherCost'),productRevenue:sum('productRevenue')}}
