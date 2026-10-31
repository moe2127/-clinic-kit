import { cookies } from 'next/headers';
import { createHmac,timingSafeEqual,createHash } from 'node:crypto';
import { localMode,mutate,supabase } from './store';
export function equal(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
function secret(){const key=process.env.SESSION_SECRET||'';if(key.length<32)throw Error('SESSION_SECRETを32文字以上で設定してください');return key}
export function makeLocalToken(){const body=`local-owner:${Date.now()+3600000}`;return Buffer.from(body).toString('base64url')+'.'+createHmac('sha256',secret()).update(body).digest('hex')}
export function verifyLocalToken(token:string){try{const [encoded,sig]=token.split('.');const body=Buffer.from(encoded,'base64url').toString();return equal(createHmac('sha256',secret()).update(body).digest('hex'),sig||'')&&body.startsWith('local-owner:')&&Number(body.split(':')[1])>Date.now()}catch{return false}}
export async function owner(){const jar=await cookies();const token=jar.get('kit_session')?.value;if(!token)return null;if(localMode())return verifyLocalToken(token)?'local-owner':null;
 const db=supabase();const {data,error}=await db.auth.getUser(token);if(error||!data.user)return null;const {data:role}=await db.from('owners').select('id').eq('id',data.user.id).single();return role?data.user.id:null;
}
export async function requireOwner(){const id=await owner();if(!id)throw Error('ログインが必要です');return id}
export function sameOrigin(req:Request){const origin=req.headers.get('origin');const expected=process.env.APP_URL;if(!expected||origin!==new URL(expected).origin)throw Error('許可されていない操作元です')}
export async function loginLimit(req:Request){const ip=req.headers.get('x-forwarded-for')?.split(',')[0]||'local';const key=createHash('sha256').update(ip).digest('hex');await mutate(s=>{const now=Date.now();s.loginAttempts=Object.fromEntries(Object.entries(s.loginAttempts).filter(([,v])=>now-v.since<900000));const old=s.loginAttempts[key];if(old&&old.count>=10)throw Error('試行回数が多いため15分後にお試しください');s.loginAttempts[key]={count:(old?.count||0)+1,since:old?.since||now}})}
export const cookieOptions=()=>({httpOnly:true,secure:process.env.APP_URL?.startsWith('https://')||false,sameSite:'strict' as const,path:'/',maxAge:3600});
