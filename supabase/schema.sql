create table profiles(id uuid primary key references auth.users on delete cascade, email text, role text default 'user', banned boolean default false, created_at timestamptz default now());
create function handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into profiles(id,email) values(new.id,new.email); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
create function is_admin() returns boolean language sql security definer set search_path=public stable as $$ select exists(select 1 from profiles where id=auth.uid() and role='admin') $$;
alter table profiles enable row level security;
create policy p_read on profiles for select using (id=auth.uid() or is_admin());
create policy p_upd on profiles for update using (is_admin());

create table generators(id uuid primary key default gen_random_uuid(), user_id uuid references auth.users, deal text check (deal in ('sale','rent')), title text, brand text, kva numeric, fuel text, condition text, hours numeric, price numeric, city text, phone text, description text, images text[] default '{}', status text default 'active', created_at timestamptz default now());
alter table generators enable row level security;
create policy g_read on generators for select using (status='active' or user_id=auth.uid() or is_admin());
create policy g_mod on generators for all using (user_id=auth.uid() or is_admin());

create table agent_notes(id uuid primary key default gen_random_uuid(), user_id uuid references auth.users, note text, created_at timestamptz default now());
alter table agent_notes enable row level security;

insert into storage.buckets(id,name,public) values('generators','generators',true) on conflict do nothing;
create policy up on storage.objects for insert to authenticated with check (bucket_id='generators');

-- بعد أول تسجيل دخول لك، نفذ السطر ده عشان تبقى أدمن:
-- update profiles set role='admin' where email='mahmoudabdelaalaboalsaoud@gmail.com';
