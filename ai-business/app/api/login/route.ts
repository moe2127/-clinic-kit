import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { sameOrigin,loginLimit,equal,makeLocalToken,cookieOptions } from '@/lib/auth';
import { localMode,supabase } from '@/lib/store';
import { body,failure } from '@/lib/http';
export async function POST(req:Request){try{sameOrigin(req);await loginLimit(req);const input=z.object({email:z.string().max(254),password:z.string().min(1).max(200)}).strict().parse(await body(req));let token:string;
 if(localMode()){if(!process.env.LOCAL_OWNER_PASSWORD||process.env.LOCAL_OWNER_PASSWORD.length<12||!equal(input.password,process.env.LOCAL_OWNER_PASSWORD))throw Error('ログイン情報を確認してください');token=makeLocalToken()}
 else{const db=supabase();const {data,error}=await db.auth.signInWithPassword(input);if(error||!data.user||!data.session)throw Error('ログイン情報を確認してください');const {data:role}=await db.from('owners').select('id').eq('id',data.user.id).single();if(!role)throw Error('オーナー権限がありません');token=data.session.access_token}
 (await cookies()).set('kit_session',token,cookieOptions());return NextResponse.json({ok:true});}catch(e){return failure(e)}}
