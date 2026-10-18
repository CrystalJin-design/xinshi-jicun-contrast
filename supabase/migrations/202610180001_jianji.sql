-- Additive migration. All resources are isolated from other applications by jianji_.
create table public.jianji_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique check (code_hash ~ '^[a-f0-9]{64}$'),
  label text not null default '',
  used integer not null default 0 check (used between 0 and 3),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.jianji_sessions (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  code_id uuid not null references public.jianji_codes(id),
  expires_at timestamptz not null default now() + interval '7 days'
);
create index jianji_sessions_code_idx on public.jianji_sessions(code_id);
create index jianji_sessions_expiry_idx on public.jianji_sessions(expires_at);
create table public.jianji_attempts (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.jianji_codes(id),
  quiz_id text not null default 'contrast' check (quiz_id = 'contrast'),
  version text not null,
  request_id uuid not null,
  answers jsonb not null default to_jsonb(array_fill(-1, array[48])),
  current_question integer not null default 0 check (current_question between 0 and 47),
  revision integer not null default 0 check (revision >= 0),
  status text not null default 'active' check (status in ('active','complete')),
  result_id text unique check (result_id ~ '^[a-f0-9]{48}$'),
  report jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(code_id, request_id)
);
create unique index jianji_one_active_per_code on public.jianji_attempts(code_id) where status='active';
create index jianji_attempts_code_created_idx on public.jianji_attempts(code_id, created_at desc);
create table public.jianji_rate_limits (
  key_hash text primary key,
  window_start timestamptz not null,
  hits integer not null
);

alter table public.jianji_codes enable row level security;
alter table public.jianji_sessions enable row level security;
alter table public.jianji_attempts enable row level security;
alter table public.jianji_rate_limits enable row level security;
revoke all on public.jianji_codes, public.jianji_sessions, public.jianji_attempts, public.jianji_rate_limits from public, anon, authenticated;
grant all on public.jianji_codes, public.jianji_sessions, public.jianji_attempts, public.jianji_rate_limits to service_role;

create function public.jianji_valid_answers(p_answers jsonb, p_complete boolean default false)
returns boolean language plpgsql immutable set search_path = '' as $$
begin
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then return false; end if;
  if jsonb_array_length(p_answers) <> 48 then return false; end if;
  return not exists(select 1 from jsonb_array_elements(p_answers) v
    where jsonb_typeof(v) <> 'number' or
      (v not in ('-2'::jsonb,'0'::jsonb,'1'::jsonb,'2'::jsonb,'3'::jsonb,'4'::jsonb)
        and (p_complete or v <> '-1'::jsonb)));
end $$;

create function public.jianji_take_rate_limit(p_key_hash text, p_limit integer, p_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_hits integer;
begin
  insert into public.jianji_rate_limits as r(key_hash,window_start,hits) values(p_key_hash,now(),1)
  on conflict(key_hash) do update set
    hits = case when r.window_start < now()-make_interval(secs=>p_seconds) then 1 else r.hits+1 end,
    window_start = case when r.window_start < now()-make_interval(secs=>p_seconds) then now() else r.window_start end
  returning hits into v_hits;
  if random() < 0.02 then
    delete from public.jianji_rate_limits where window_start < now()-interval '1 day';
    delete from public.jianji_sessions where expires_at < now();
  end if;
  return v_hits <= p_limit;
end $$;

create function public.jianji_auth_code(p_session_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_code uuid;
begin
  select c.id into v_code from public.jianji_sessions s join public.jianji_codes c on c.id=s.code_id
    where s.token_hash=p_session_hash and s.expires_at>now() and c.enabled;
  if v_code is null then raise exception 'SESSION_EXPIRED'; end if;
  return v_code;
end $$;

create function public.jianji_attempt_json(p_id uuid)
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object('id',id,'quizId',quiz_id,'answers',answers,
    'currentQuestion',current_question,'revision',revision,'status',status,'resultId',result_id)
    from public.jianji_attempts where id=p_id;
$$;

create function public.jianji_session_for_code(p_code_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_used integer; v_active uuid; v_results jsonb;
begin
  select used into v_used from public.jianji_codes where id=p_code_id;
  select id into v_active from public.jianji_attempts where code_id=p_code_id and status='active';
  select coalesce(jsonb_agg(jsonb_build_object('id',result_id,'quizId',quiz_id,
    'title',report->'test'->>'shortTitle','name',report->'profile'->>'name','createdAt',completed_at)
    order by completed_at desc),'[]'::jsonb) into v_results
    from public.jianji_attempts where code_id=p_code_id and status='complete';
  return jsonb_build_object('remaining',3-v_used,'total',3,
    'active',public.jianji_attempt_json(v_active),'results',v_results);
end $$;

create function public.jianji_session(p_session_hash text)
returns jsonb language sql security definer set search_path = '' as $$
  select public.jianji_session_for_code(public.jianji_auth_code(p_session_hash));
$$;

create function public.jianji_login(p_code_hash text, p_token_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_code uuid;
begin
  select id into v_code from public.jianji_codes where code_hash=p_code_hash and enabled;
  if v_code is null then raise exception 'INVALID_CODE'; end if;
  insert into public.jianji_sessions(token_hash,code_id) values(p_token_hash,v_code);
  return public.jianji_session_for_code(v_code);
end $$;

create function public.jianji_logout(p_session_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  delete from public.jianji_sessions where token_hash=p_session_hash;
  return true;
end $$;

create function public.jianji_start(p_session_hash text, p_request_id uuid, p_quiz_id text, p_version text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_code_id uuid; v_code public.jianji_codes; v_attempt uuid;
begin
  if p_quiz_id is distinct from 'contrast' then raise exception 'INVALID_INPUT'; end if;
  v_code_id := public.jianji_auth_code(p_session_hash);
  select * into v_code from public.jianji_codes where id=v_code_id for update;
  if not v_code.enabled then raise exception 'SESSION_EXPIRED'; end if;
  select id into v_attempt from public.jianji_attempts where code_id=v_code_id and request_id=p_request_id;
  if v_attempt is null then
    select id into v_attempt from public.jianji_attempts where code_id=v_code_id and status='active';
  end if;
  if v_attempt is null then
    if v_code.used >= 3 then raise exception 'QUOTA_EXHAUSTED'; end if;
    update public.jianji_codes set used=used+1 where id=v_code_id;
    insert into public.jianji_attempts(code_id,request_id,quiz_id,version)
      values(v_code_id,p_request_id,p_quiz_id,p_version) returning id into v_attempt;
  end if;
  return jsonb_build_object('attempt',public.jianji_attempt_json(v_attempt),
    'session',public.jianji_session_for_code(v_code_id));
end $$;

create function public.jianji_save(p_session_hash text, p_attempt_id uuid, p_answers jsonb, p_current_question integer, p_revision integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_code uuid; v_attempt public.jianji_attempts;
begin
  v_code := public.jianji_auth_code(p_session_hash);
  select * into v_attempt from public.jianji_attempts where id=p_attempt_id and code_id=v_code for update;
  if v_attempt.id is null then raise exception 'ATTEMPT_NOT_FOUND'; end if;
  if v_attempt.status <> 'active' then raise exception 'ATTEMPT_COMPLETED'; end if;
  if v_attempt.revision is distinct from p_revision then
    return jsonb_build_object('_error','REVISION_CONFLICT','attempt',public.jianji_attempt_json(p_attempt_id));
  end if;
  if not public.jianji_valid_answers(p_answers) or p_current_question is null or p_current_question not between 0 and 47 then
    raise exception 'INVALID_ANSWERS';
  end if;
  update public.jianji_attempts set answers=p_answers,current_question=p_current_question,revision=revision+1 where id=p_attempt_id;
  return public.jianji_attempt_json(p_attempt_id);
end $$;

create function public.jianji_complete(p_session_hash text, p_attempt_id uuid, p_answers jsonb, p_revision integer, p_report jsonb, p_result_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_code uuid; v_attempt public.jianji_attempts;
begin
  v_code := public.jianji_auth_code(p_session_hash);
  select * into v_attempt from public.jianji_attempts where id=p_attempt_id and code_id=v_code for update;
  if v_attempt.id is null then raise exception 'ATTEMPT_NOT_FOUND'; end if;
  if v_attempt.status='complete' then
    return jsonb_build_object('resultId',v_attempt.result_id,'session',public.jianji_session_for_code(v_code));
  end if;
  if v_attempt.revision is distinct from p_revision then
    return jsonb_build_object('_error','REVISION_CONFLICT','attempt',public.jianji_attempt_json(p_attempt_id));
  end if;
  if not public.jianji_valid_answers(p_answers,true) then raise exception 'INVALID_ANSWERS'; end if;
  if p_report is null or jsonb_typeof(p_report)<>'object' or p_report->>'version' is distinct from v_attempt.version then
    raise exception 'INVALID_INPUT';
  end if;
  update public.jianji_attempts set answers=p_answers,
    report=p_report || jsonb_build_object('createdAt',now()),result_id=p_result_id,
    status='complete',completed_at=now(),revision=revision+1 where id=p_attempt_id;
  return jsonb_build_object('resultId',p_result_id,'session',public.jianji_session_for_code(v_code));
end $$;

create function public.jianji_result(p_result_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_report jsonb;
begin
  select report into v_report from public.jianji_attempts where result_id=p_result_id and status='complete';
  if v_report is null then raise exception 'RESULT_NOT_FOUND'; end if;
  return v_report || jsonb_build_object('id',p_result_id);
end $$;

create function public.jianji_create_code(p_code_hash text, p_label text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.jianji_codes(code_hash,label) values(p_code_hash,left(p_label,100)) returning id into v_id;
  return v_id;
end $$;

-- Revoke default function EXECUTE privileges, including helper functions.
do $$ declare fn record;
begin
  for fn in select p.proname,pg_get_function_identity_arguments(p.oid) args from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'jianji\_%' escape '\'
  loop
    execute format('revoke all on function public.%I(%s) from public, anon, authenticated',fn.proname,fn.args);
    execute format('grant execute on function public.%I(%s) to service_role',fn.proname,fn.args);
  end loop;
end $$;
