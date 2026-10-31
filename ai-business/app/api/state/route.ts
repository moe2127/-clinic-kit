import { requireOwner } from '@/lib/auth';import { readState } from '@/lib/store';import { failure } from '@/lib/http';import { connections } from '@/lib/connections';
export const dynamic='force-dynamic';
export async function GET(){try{await requireOwner();return Response.json({state:await readState(),connections:connections()},{headers:{'Cache-Control':'no-store'}})}catch(e){return failure(e)}}
