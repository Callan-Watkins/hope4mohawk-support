-- The PIN value is deliberately not stored in this public repository.
-- Seed private.web_admin_pin through the Supabase SQL editor or a trusted
-- management connection, using a salted extensions.crypt() hash.

create table if not exists private.web_admin_pin (
  singleton boolean primary key default true check (singleton),
  pin_hash text not null,
  updated_at timestamptz not null default now()
);

create table if not exists private.web_admin_pin_attempts (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  attempted_at timestamptz not null default now(),
  accepted boolean not null
);

create index if not exists web_admin_pin_attempts_time_idx
  on private.web_admin_pin_attempts (attempted_at desc);
create index if not exists web_admin_pin_attempts_ip_time_idx
  on private.web_admin_pin_attempts (ip_hash, attempted_at desc);

alter table private.web_admin_pin enable row level security;
alter table private.web_admin_pin_attempts enable row level security;

revoke all on private.web_admin_pin from public, anon, authenticated;
revoke all on private.web_admin_pin_attempts from public, anon, authenticated;
grant select on private.web_admin_pin to service_role;
grant select, insert on private.web_admin_pin_attempts to service_role;

create or replace function public.verify_web_admin_pin(p_pin text, p_ip_hash text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  stored_hash text;
  matched boolean;
begin
  if p_pin is null or p_pin !~ '^[0-9]{4}$'
     or p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  -- Serialize checks and inserts so parallel guesses cannot bypass limits.
  perform pg_catalog.pg_advisory_xact_lock(6011894137::bigint);

  -- A four-digit PIN is low entropy. Limit both individual sources and the
  -- entire endpoint; a deliberate attack can therefore cause a lockout.
  if (select count(*) from private.web_admin_pin_attempts
      where attempted_at > now() - interval '24 hours' and not accepted) >= 10 then
    return false;
  end if;
  if (select count(*) from private.web_admin_pin_attempts
      where attempted_at > now() - interval '24 hours'
        and ip_hash = p_ip_hash and not accepted) >= 3 then
    return false;
  end if;

  select pin_hash into stored_hash
  from private.web_admin_pin where singleton = true;
  if stored_hash is null then
    return false;
  end if;

  matched := stored_hash = extensions.crypt(p_pin, stored_hash);
  insert into private.web_admin_pin_attempts (ip_hash, accepted)
  values (p_ip_hash, matched);
  return matched;
end;
$$;

revoke all on function public.verify_web_admin_pin(text, text)
  from public, anon, authenticated;
grant execute on function public.verify_web_admin_pin(text, text)
  to service_role;
