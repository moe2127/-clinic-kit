import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
export function failure(e:unknown){const message=e instanceof ZodError?'入力内容を確認してください（空欄・形式・範囲が不正です）':e instanceof Error?e.message:'処理に失敗しました';return NextResponse.json({error:message},{status:message.includes('ログイン')?401:400})}
export async function body(req:Request){if(Number(req.headers.get('content-length')||0)>150000)throw Error('リクエストが大きすぎます');const text=await req.text();if(Buffer.byteLength(text)>150000)throw Error('リクエストが大きすぎます');return JSON.parse(text)}
