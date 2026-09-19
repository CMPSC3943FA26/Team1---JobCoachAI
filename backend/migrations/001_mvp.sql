-- JOBCOACHAI: FRESH SUPABASE DATABASE SETUP
-- 1. Create a project named JobCoachAI in https://supabase.com/dashboard
-- 2. Open SQL Editor, paste this entire file, and Run once.
-- 3. Enable Anonymous Sign-Ins in Authentication settings.
-- 4. Copy the project URL and publishable key into your local .env files.
--    Backend: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY
--    Frontend: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
--    Frontend API: VITE_API_URL=http://localhost:5000/api
-- No real keys or passwords belong in this file or in GitHub.
--
-- This creates 10 public tables. User identity uses existing Supabase auth.users;
-- the optional public.users extension is not required by this MVP.
-- Multiple master resumes are allowed. All tables have owner-scoped RLS.
-- Added revision and suggestion_states fields support safe saves and undo.
-- field_reference is TEXT per the team design: null for the summary, or
-- a zero-based array index such as '0' for work/project descriptions.
-- Includes RPC functions used by the supplied Flask backend.
-- Use THIS script instead of the older package's 001_mvp.sql; do not run both.
-- This file configures the database; it does not create a hosted project,
-- enable anonymous sign-in, or configure Hugging Face automatically.
--
-- Baseline migration for a NEW Supabase project/database. Not a destructive reset.
-- If these tables already exist, reconcile their schema in a separate migration first.
begin;
create table public.resumes (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 full_name text not null, email text not null, phone text, location text,
 professional_summary text, revision integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.work_experience (
 id uuid primary key default gen_random_uuid(),
 resume_id uuid not null references public.resumes(id) on delete cascade,
 job_title text not null, company text not null, location text, start_date date not null, end_date date, description text not null, sort_order integer not null default 0 check (sort_order >= 0)
);
create index on public.work_experience(resume_id);
create table public.education (
 id uuid primary key default gen_random_uuid(),
 resume_id uuid not null references public.resumes(id) on delete cascade,
 school text not null, degree text, field_of_study text, start_date date, end_date date, sort_order integer not null default 0 check (sort_order >= 0)
);
create index on public.education(resume_id);
create table public.skills (
 id uuid primary key default gen_random_uuid(),
 resume_id uuid not null references public.resumes(id) on delete cascade,
 skill_name text not null, sort_order integer not null default 0 check (sort_order >= 0)
);
create index on public.skills(resume_id);
create table public.projects (
 id uuid primary key default gen_random_uuid(),
 resume_id uuid not null references public.resumes(id) on delete cascade,
 name text not null, description text, link text, sort_order integer not null default 0 check (sort_order >= 0)
);
create index on public.projects(resume_id);
create table public.certifications (
 id uuid primary key default gen_random_uuid(),
 resume_id uuid not null references public.resumes(id) on delete cascade,
 name text not null, issuer text, date_earned date, sort_order integer not null default 0 check (sort_order >= 0)
);
create index on public.certifications(resume_id);
create table public.jobs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null, company text, description text not null,
 source text not null default 'manual', created_at timestamptz not null default now()
);
create table public.tailored_resumes (
 id uuid primary key default gen_random_uuid(),
 resume_id uuid not null references public.resumes(id) on delete cascade,
 job_id uuid not null references public.jobs(id) on delete cascade,
 content jsonb not null, status text not null default 'draft' check (status in ('draft','finalized')),
 revision integer not null default 1, export_filename text,
 last_exported_at timestamptz, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.ai_suggestions (
 id uuid primary key default gen_random_uuid(),
 tailored_resume_id uuid not null references public.tailored_resumes(id) on delete cascade,
 section text not null check (section in ('professional_summary','work_experience','projects')),
 field_reference text, original_value text not null, suggested_value text not null,
 final_value text, reason text not null,
 status text not null default 'pending' check (status in ('pending','accepted','rejected','modified')),
 created_at timestamptz not null default now()
);
create table public.tailored_resume_versions (
 id uuid primary key default gen_random_uuid(),
 tailored_resume_id uuid not null references public.tailored_resumes(id) on delete cascade,
 revision integer not null, content jsonb not null, suggestion_states jsonb not null default '[]',
 created_at timestamptz not null default now(), unique (tailored_resume_id, revision)
);
create index on public.resumes(user_id);
create index on public.jobs(user_id);
create index on public.tailored_resumes(resume_id);
create index on public.tailored_resumes(job_id);
create index on public.ai_suggestions(tailored_resume_id);
alter table public.resumes enable row level security;
revoke all on public.resumes from anon;
grant select, insert, update, delete on public.resumes to authenticated;
create policy owner_access on public.resumes for all to authenticated
 using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter table public.jobs enable row level security;
revoke all on public.jobs from anon;
grant select, insert, update, delete on public.jobs to authenticated;
create policy owner_access on public.jobs for all to authenticated
 using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter table public.work_experience enable row level security;
revoke all on public.work_experience from anon;
grant select, insert, update, delete on public.work_experience to authenticated;
create policy owner_access on public.work_experience for all to authenticated
 using (exists (select 1 from public.resumes r where r.id = resume_id and r.user_id = (select auth.uid()))) with check (exists (select 1 from public.resumes r where r.id = resume_id and r.user_id = (select auth.uid())));
alter table public.education enable row level security;
revoke all on public.education from anon;
grant select, insert, update, delete on public.education to authenticated;
create policy owner_access on public.education for all to authenticated
 using (exists (select 1 from public.resumes r where r.id = resume_id and r.user_id = (select auth.uid()))) with check (exists (select 1 from public.resumes r where r.id = resume_id and r.user_id = (select auth.uid())));
alter table public.skills enable row level security;
revoke all on public.skills from anon;
grant select, insert, update, delete on public.skills to authenticated;
create policy owner_access on public.skills for all to authenticated
 using (exists (select 1 from public.resumes r where r.id = resume_id and r.user_id = (select auth.uid()))) with check (exists (select 1 from public.resumes r where r.id = resume_id and r.user_id = (select auth.uid())));
alter table public.projects enable row level security;
revoke all on public.projects from anon;
grant select, insert, update, delete on public.projects to authenticated;
create policy owner_access on public.projects for all to authenticated
 using (exists (select 1 from public.resumes r where r.id = resume_id and r.user_id = (select auth.uid()))) with check (exists (select 1 from public.resumes r where r.id = resume_id and r.user_id = (select auth.uid())));
alter table public.certifications enable row level security;
revoke all on public.certifications from anon;
grant select, insert, update, delete on public.certifications to authenticated;
create policy owner_access on public.certifications for all to authenticated
 using (exists (select 1 from public.resumes r where r.id = resume_id and r.user_id = (select auth.uid()))) with check (exists (select 1 from public.resumes r where r.id = resume_id and r.user_id = (select auth.uid())));
alter table public.tailored_resumes enable row level security;
revoke all on public.tailored_resumes from anon;
grant select, insert, update, delete on public.tailored_resumes to authenticated;
create policy owner_access on public.tailored_resumes for all to authenticated
 using (exists (select 1 from public.resumes r where r.id = resume_id and r.user_id = (select auth.uid()))
 and exists (select 1 from public.jobs j where j.id = job_id and j.user_id = (select auth.uid()))) with check (exists (select 1 from public.resumes r where r.id = resume_id and r.user_id = (select auth.uid()))
 and exists (select 1 from public.jobs j where j.id = job_id and j.user_id = (select auth.uid())));
alter table public.ai_suggestions enable row level security;
revoke all on public.ai_suggestions from anon;
grant select, insert, update, delete on public.ai_suggestions to authenticated;
create policy owner_access on public.ai_suggestions for all to authenticated
 using (exists (select 1 from public.tailored_resumes t where t.id = tailored_resume_id)) with check (exists (select 1 from public.tailored_resumes t where t.id = tailored_resume_id));
alter table public.tailored_resume_versions enable row level security;
revoke all on public.tailored_resume_versions from anon;
grant select, insert, update, delete on public.tailored_resume_versions to authenticated;
create policy owner_access on public.tailored_resume_versions for all to authenticated
 using (exists (select 1 from public.tailored_resumes t where t.id = tailored_resume_id)) with check (exists (select 1 from public.tailored_resumes t where t.id = tailored_resume_id));

create function public.get_master_resume(p_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object('id', r.id, 'revision', r.revision,
 'created_at', r.created_at, 'updated_at', r.updated_at,
 'content', jsonb_build_object('resume', jsonb_build_object(
 'full_name', r.full_name, 'email', r.email, 'phone', r.phone,
 'location', r.location, 'professional_summary', r.professional_summary)
, 'work_experience', coalesce((select jsonb_agg(to_jsonb(s) - 'id' - 'resume_id' order by s.sort_order, s.id) from public.work_experience s where s.resume_id = r.id), '[]'::jsonb)
, 'education', coalesce((select jsonb_agg(to_jsonb(s) - 'id' - 'resume_id' order by s.sort_order, s.id) from public.education s where s.resume_id = r.id), '[]'::jsonb)
, 'skills', coalesce((select jsonb_agg(to_jsonb(s) - 'id' - 'resume_id' order by s.sort_order, s.id) from public.skills s where s.resume_id = r.id), '[]'::jsonb)
, 'projects', coalesce((select jsonb_agg(to_jsonb(s) - 'id' - 'resume_id' order by s.sort_order, s.id) from public.projects s where s.resume_id = r.id), '[]'::jsonb)
, 'certifications', coalesce((select jsonb_agg(to_jsonb(s) - 'id' - 'resume_id' order by s.sort_order, s.id) from public.certifications s where s.resume_id = r.id), '[]'::jsonb)
)) from public.resumes r where r.id = p_id and r.user_id = auth.uid();
$$;

create function public.save_master_resume(p_id uuid, p_expected_revision integer, p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_revision integer; v_contact jsonb := p_payload->'resume';
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 if p_id is null then
  insert into public.resumes(user_id, full_name, email, phone, location, professional_summary)
  values (auth.uid(), v_contact->>'full_name', v_contact->>'email', v_contact->>'phone',
          v_contact->>'location', v_contact->>'professional_summary') returning id into v_id;
 else
  select revision into v_revision from public.resumes where id = p_id and user_id = auth.uid() for update;
  if not found then raise no_data_found; end if;
  if p_expected_revision is distinct from v_revision then raise serialization_failure; end if;
  v_id := p_id;
  update public.resumes set full_name = v_contact->>'full_name', email = v_contact->>'email',
   phone = v_contact->>'phone', location = v_contact->>'location',
   professional_summary = v_contact->>'professional_summary', updated_at = now(), revision = revision + 1
   where id = v_id;
 end if;
 delete from public.work_experience where resume_id = v_id;
 insert into public.work_experience(resume_id, job_title, company, location, start_date, end_date, description, sort_order) select v_id, job_title, company, location, start_date, end_date, description, sort_order from jsonb_to_recordset(p_payload->'work_experience') as x(job_title text, company text, location text, start_date date, end_date date, description text, sort_order integer);
 delete from public.education where resume_id = v_id;
 insert into public.education(resume_id, school, degree, field_of_study, start_date, end_date, sort_order) select v_id, school, degree, field_of_study, start_date, end_date, sort_order from jsonb_to_recordset(p_payload->'education') as x(school text, degree text, field_of_study text, start_date date, end_date date, sort_order integer);
 delete from public.skills where resume_id = v_id;
 insert into public.skills(resume_id, skill_name, sort_order) select v_id, skill_name, sort_order from jsonb_to_recordset(p_payload->'skills') as x(skill_name text, sort_order integer);
 delete from public.projects where resume_id = v_id;
 insert into public.projects(resume_id, name, description, link, sort_order) select v_id, name, description, link, sort_order from jsonb_to_recordset(p_payload->'projects') as x(name text, description text, link text, sort_order integer);
 delete from public.certifications where resume_id = v_id;
 insert into public.certifications(resume_id, name, issuer, date_earned, sort_order) select v_id, name, issuer, date_earned, sort_order from jsonb_to_recordset(p_payload->'certifications') as x(name text, issuer text, date_earned date, sort_order integer);
 return public.get_master_resume(v_id);
end;
$$;

create function public.get_tailored_resume(p_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
 select to_jsonb(t) || jsonb_build_object('suggestions', coalesce(
 (select jsonb_agg(to_jsonb(s) order by s.created_at, s.id) from public.ai_suggestions s
 where s.tailored_resume_id = t.id), '[]'::jsonb))
 from public.tailored_resumes t where t.id = p_id;
$$;

-- Invoker privileges preserve RLS even when these functions are called via REST directly.
create function public.record_tailored_version(p_id uuid) returns void
language sql security invoker set search_path = '' as $$
 insert into public.tailored_resume_versions(tailored_resume_id, revision, content, suggestion_states)
 select t.id, t.revision, t.content, coalesce((select jsonb_agg(jsonb_build_object(
 'id', s.id, 'status', s.status, 'final_value', s.final_value)) from public.ai_suggestions s
 where s.tailored_resume_id = t.id), '[]'::jsonb)
 from public.tailored_resumes t where t.id = p_id;
$$;

create function public.create_tailored_resume(p_resume_id uuid, p_job_id uuid,
 p_master_revision integer, p_suggestions jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_master jsonb; v_revision integer;
begin
 select revision into v_revision from public.resumes
 where id = p_resume_id and user_id = auth.uid() for share;
 if not found then raise no_data_found; end if;
 if v_revision is distinct from p_master_revision then raise serialization_failure; end if;
 perform 1 from public.jobs where id = p_job_id and user_id = auth.uid() for share;
 if not found then raise no_data_found; end if;
 v_master := public.get_master_resume(p_resume_id);
 insert into public.tailored_resumes(resume_id, job_id, content)
 values(p_resume_id, p_job_id, v_master->'content') returning id into v_id;
 insert into public.ai_suggestions(tailored_resume_id, section, field_reference, original_value, suggested_value, reason)
 select v_id, section, field_reference, original_value, suggested_value, reason
 from jsonb_to_recordset(p_suggestions) as x(section text, field_reference text,
 original_value text, suggested_value text, reason text);
 perform public.record_tailored_version(v_id);
 return public.get_tailored_resume(v_id);
end;
$$;

create function public.mutate_tailored_resume(p_id uuid, p_expected_revision integer,
 p_action text, p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare t public.tailored_resumes; s public.ai_suggestions;
 v public.tailored_resume_versions; v_path text[]; v_value text; v_status text;
begin
 select * into t from public.tailored_resumes where id = p_id for update;
 if not found then raise no_data_found; end if;
 if t.revision is distinct from p_expected_revision then raise serialization_failure; end if;
 if p_action = 'edit' then
  update public.tailored_resumes set content = p_payload->'content', status = p_payload->>'status',
   export_filename = p_payload->>'export_filename' where id = p_id;
 elsif p_action = 'suggestion' then
  select * into s from public.ai_suggestions where id = (p_payload->>'suggestion_id')::uuid
   and tailored_resume_id = p_id for update;
  if not found then raise no_data_found; end if;
  if s.status <> 'pending' then raise serialization_failure; end if;
  v_status := p_payload->>'status';
  if v_status not in ('accepted', 'modified', 'rejected') or v_status is null then
   raise invalid_parameter_value; end if;
  if v_status <> 'rejected' then
   if s.section = 'professional_summary' and s.field_reference is null then
    v_path := array['resume', 'professional_summary'];
   elsif s.section in ('work_experience', 'projects') and s.field_reference ~ '^(0|[1-9][0-9]?)$' then
    v_path := array[s.section, s.field_reference::text, 'description'];
    if (t.content #> array[s.section, s.field_reference::text]) is null then raise serialization_failure; end if;
   else raise invalid_parameter_value; end if;
   if coalesce(t.content #>> v_path, '') <> s.original_value then raise serialization_failure; end if;
   v_value := case when v_status = 'accepted' then s.suggested_value else p_payload->>'final_value' end;
   if v_value is null then raise invalid_parameter_value; end if;
   update public.tailored_resumes set content = jsonb_set(content, v_path, to_jsonb(v_value)), status = 'draft'
    where id = p_id;
  end if;
  update public.ai_suggestions set status = v_status, final_value = v_value where id = s.id;
 elsif p_action = 'restore' then
  select * into v from public.tailored_resume_versions
   where id = (p_payload->>'version_id')::uuid and tailored_resume_id = p_id;
  if not found then raise no_data_found; end if;
  update public.tailored_resumes set content = v.content, status = 'draft' where id = p_id;
  update public.ai_suggestions s2 set status = x.status, final_value = x.final_value
   from jsonb_to_recordset(v.suggestion_states) as x(id uuid, status text, final_value text)
   where s2.id = x.id and s2.tailored_resume_id = p_id;
 else raise invalid_parameter_value;
 end if;
 update public.tailored_resumes set revision = revision + 1, updated_at = now() where id = p_id;
 perform public.record_tailored_version(p_id);
 return public.get_tailored_resume(p_id);
end;
$$;
revoke all on function public.get_master_resume(uuid) from public, anon;
grant execute on function public.get_master_resume(uuid) to authenticated;
revoke all on function public.save_master_resume(uuid, integer, jsonb) from public, anon;
grant execute on function public.save_master_resume(uuid, integer, jsonb) to authenticated;
revoke all on function public.get_tailored_resume(uuid) from public, anon;
grant execute on function public.get_tailored_resume(uuid) to authenticated;
revoke all on function public.record_tailored_version(uuid) from public, anon;
grant execute on function public.record_tailored_version(uuid) to authenticated;
revoke all on function public.create_tailored_resume(uuid, uuid, integer, jsonb) from public, anon;
grant execute on function public.create_tailored_resume(uuid, uuid, integer, jsonb) to authenticated;
revoke all on function public.mutate_tailored_resume(uuid, integer, text, jsonb) from public, anon;
grant execute on function public.mutate_tailored_resume(uuid, integer, text, jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;

-- Verify creation: should return 10 rows, all with rowsecurity = true.
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in (
 'resumes','work_experience','education','skills','projects','certifications',
 'jobs','tailored_resumes','tailored_resume_versions','ai_suggestions')
order by tablename;

