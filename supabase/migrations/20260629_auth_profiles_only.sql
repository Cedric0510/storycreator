-- Minimal Supabase setup for auth-only Author Studio.
-- Use this migration on a fresh Supabase project when online project saving is disabled.
-- It intentionally does not create author_projects, author_project_access,
-- author_project_logs, or any Storage bucket.

create table if not exists public.author_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text not null default 'Auteur',
  platform_role text not null default 'reader'
    check (platform_role in ('admin', 'author', 'reader')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists author_profiles_platform_role_idx
  on public.author_profiles (platform_role);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_author_profiles_updated_at on public.author_profiles;
create trigger set_author_profiles_updated_at
before update on public.author_profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  initial_role text := 'reader';
begin
  -- Bootstrap the first registered account as admin so the instance remains manageable.
  if not exists (
    select 1 from public.author_profiles where platform_role = 'admin'
  ) then
    initial_role := 'admin';
  end if;

  insert into public.author_profiles (user_id, email, display_name, platform_role)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Auteur'
    ),
    initial_role
  )
  on conflict (user_id)
  do update set
    email = excluded.email,
    display_name = coalesce(
      nullif(excluded.display_name, ''),
      public.author_profiles.display_name
    ),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
after update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_new_auth_user();

alter table public.author_profiles enable row level security;

drop policy if exists author_profiles_select_self on public.author_profiles;
create policy author_profiles_select_self
on public.author_profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists author_profiles_insert_self on public.author_profiles;
create policy author_profiles_insert_self
on public.author_profiles
for insert
to authenticated
with check (
  auth.uid() = user_id
  and platform_role = 'reader'
  and (
    email is null
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

drop policy if exists author_profiles_update_self on public.author_profiles;
create policy author_profiles_update_self
on public.author_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.guard_author_profiles_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requester uuid := auth.uid();
begin
  -- Service-role/admin maintenance and auth triggers may run without an auth.uid().
  if requester is null then
    return new;
  end if;

  if new.email is distinct from old.email then
    raise exception 'email is managed by auth.users';
  end if;

  if new.platform_role is distinct from old.platform_role
     and not exists (
       select 1
       from public.author_profiles ap
       where ap.user_id = requester
         and ap.platform_role = 'admin'
     ) then
    raise exception 'platform_role update forbidden';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_author_profiles_sensitive_fields on public.author_profiles;
create trigger guard_author_profiles_sensitive_fields
before update on public.author_profiles
for each row execute function public.guard_author_profiles_sensitive_fields();

create or replace function public.is_platform_admin(target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.author_profiles ap
    where ap.user_id = target_user
      and ap.platform_role = 'admin'
  );
$$;

grant execute on function public.is_platform_admin(uuid) to authenticated;

create or replace function public.can_use_author_tools(target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.author_profiles ap
    where ap.user_id = target_user
      and ap.platform_role in ('admin', 'author')
  );
$$;

grant execute on function public.can_use_author_tools(uuid) to authenticated;

create or replace function public.platform_list_profiles()
returns table (
  user_id uuid,
  email text,
  display_name text,
  platform_role text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select ap.user_id, ap.email, ap.display_name, ap.platform_role, ap.created_at
  from public.author_profiles ap
  where public.is_platform_admin(auth.uid())
  order by ap.created_at asc;
$$;

grant execute on function public.platform_list_profiles() to authenticated;

create or replace function public.platform_set_profile_role(target_user uuid, next_role text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  requester uuid := auth.uid();
  is_target_admin boolean := false;
  admins_count integer := 0;
begin
  if requester is null then
    return false;
  end if;

  if not public.is_platform_admin(requester) then
    return false;
  end if;

  if next_role not in ('admin', 'author', 'reader') then
    return false;
  end if;

  if not exists (
    select 1
    from public.author_profiles ap
    where ap.user_id = target_user
  ) then
    return false;
  end if;

  select exists (
    select 1
    from public.author_profiles ap
    where ap.user_id = target_user
      and ap.platform_role = 'admin'
  )
  into is_target_admin;

  if is_target_admin and next_role <> 'admin' then
    select count(*)
    into admins_count
    from public.author_profiles ap
    where ap.platform_role = 'admin';

    if admins_count <= 1 then
      return false;
    end if;
  end if;

  update public.author_profiles ap
  set platform_role = next_role,
      updated_at = now()
  where ap.user_id = target_user;

  return found;
end;
$$;

grant execute on function public.platform_set_profile_role(uuid, text) to authenticated;
