import { cookies } from 'next/headers';
import { sameOrigin } from '@/lib/auth';
import { failure } from '@/lib/http';
export async function POST(req:Request){try{sameOrigin(req);(await cookies()).delete('kit_session');return Response.json({ok:true})}catch(e){return failure(e)}}
