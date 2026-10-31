import { redirect } from 'next/navigation';import { owner } from '@/lib/auth';import Dashboard from './dashboard';
export const dynamic='force-dynamic';
export default async function Admin(){let id;try{id=await owner()}catch{}if(!id)redirect('/login');return <Dashboard/>}
