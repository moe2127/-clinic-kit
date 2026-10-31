import { randomUUID } from 'node:crypto';
import { mutate,readState } from './store';
export async function notify(message:string){const id=randomUUID();await mutate(s=>s.notices.unshift({id,at:new Date().toISOString(),message,status:'pending'}));await sendNotice(id)}
export async function sendNotice(id:string){const n=(await readState()).notices.find(n=>n.id===id);if(!n||n.status==='sent')return;
 const token=process.env.RESEND_API_KEY,to=process.env.OWNER_NOTIFICATION_EMAIL,from=process.env.NOTIFICATION_FROM;
 if(!token||!to||!from){await mutate(s=>{s.notices.find(n=>n.id===id)!.status='unconnected'});return}
 try{const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','Idempotency-Key':id},body:JSON.stringify({from,to:[to],subject:'AI販促・運営キット：確認のお知らせ',text:n.message+'\n管理画面：'+process.env.APP_URL+'/admin'}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();await mutate(s=>{s.notices.find(n=>n.id===id)!.status='sent'})}catch{await mutate(s=>{s.notices.find(n=>n.id===id)!.status='error'})}
}
