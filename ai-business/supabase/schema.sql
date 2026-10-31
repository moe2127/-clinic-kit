-- Supabase SQL Editorで一度実行。ブラウザーから直接状態・ファイルを操作できない設計。
create table if not exists public.owners(id uuid primary key references auth.users(id) on delete cascade);
alter table public.owners enable row level security;
revoke all on public.owners from anon, authenticated;
grant all on public.owners to service_role;
create table if not exists public.app_state(id text primary key check(id='main'),revision integer not null default 0,data jsonb not null);
alter table public.app_state enable row level security;
revoke all on public.app_state from anon, authenticated;
grant all on public.app_state to service_role;
insert into public.app_state(id,data) values('main','{"settings":{"prices":{"light":1980,"standard":4980,"premium":9800},"noteUrls":{"light":"","standard":"","premium":""},"monthlyAiLimit":3000,"automation":false,"industry":"鍼灸院"},"products":[],"sources":[],"jobs":[],"ledger":[],"metrics":[],"events":[],"notices":[],"loginAttempts":{}}') on conflict do nothing;
create or replace function public.compare_and_swap_state(expected_revision integer,new_data jsonb) returns boolean language plpgsql security invoker set search_path=public as $$
begin
 update public.app_state set data=new_data,revision=revision+1 where id='main' and revision=expected_revision;
 return found;
end;$$;
revoke all on function public.compare_and_swap_state(integer,jsonb) from public,anon,authenticated;
grant execute on function public.compare_and_swap_state(integer,jsonb) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('kits','kits',false,3000000,array['application/zip']) on conflict(id) do update set public=false;
-- Authで作成したオーナーのUUIDに置換して別途実行してください。
-- insert into public.owners(id) values('オーナーのUUID');
-- Storageにanon/authenticated用の公開ポリシーを追加しないでください。
