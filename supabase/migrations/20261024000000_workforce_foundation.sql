-- Additive foundation only: the application still uses its local demo repository.
-- Prefix objects so this migration never replaces an existing application's tables.
begin;

create table public.forma_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 160),
  timezone text not null default 'Asia/Jakarta',
  locale text not null default 'id-ID',
  workweek smallint[] not null default '{1,2,3,4,5}'
    check (cardinality(workweek) between 1 and 7 and workweek <@ array[0,1,2,3,4,5,6]::smallint[]),
  created_at timestamptz not null default now()
);

create table public.forma_departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.forma_organizations(id),
  name text not null check (length(btrim(name)) between 1 and 160),
  unique (organization_id, id),
  unique (organization_id, name)
);

create table public.forma_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.forma_organizations(id),
  name text not null check (length(btrim(name)) between 1 and 160),
  address text not null default '',
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  radius_meters integer not null check (radius_meters between 10 and 10000),
  active boolean not null default true,
  unique (organization_id, id)
);

create table public.forma_employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.forma_organizations(id),
  -- Membership is provisioned by a trusted administrator, never by client role flags.
  auth_user_id uuid unique references auth.users(id) on delete set null,
  department_id uuid,
  location_id uuid,
  name text not null check (length(btrim(name)) between 1 and 160),
  email text not null check (position('@' in email) > 1),
  title text not null default '',
  avatar_path text,
  role text not null default 'employee' check (role in ('employee', 'admin')),
  employment_status text not null default 'Full-time' check (employment_status in ('Full-time', 'Contract')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, email),
  foreign key (organization_id, department_id) references public.forma_departments(organization_id, id),
  foreign key (organization_id, location_id) references public.forma_locations(organization_id, id)
);

create table public.forma_attendance_policies (
  organization_id uuid primary key references public.forma_organizations(id),
  grace_minutes integer not null default 10 check (grace_minutes between 0 and 120),
  max_accuracy_meters integer not null default 80 check (max_accuracy_meters between 1 and 1000),
  require_selfie boolean not null default false,
  allow_overtime boolean not null default true
);

create table public.forma_shifts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.forma_organizations(id),
  name text not null check (length(btrim(name)) between 1 and 160),
  start_time time not null,
  end_time time not null,
  break_minutes integer not null default 60 check (break_minutes between 0 and 1440),
  grace_minutes integer not null default 10 check (grace_minutes between 0 and 120),
  location_required boolean not null default true,
  shift_type text not null default 'Morning' check (shift_type in ('Morning', 'Afternoon', 'Night', 'Flexible', 'Rotating')),
  unique (organization_id, id)
);

create table public.forma_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.forma_organizations(id),
  employee_id uuid not null,
  shift_id uuid not null,
  location_id uuid,
  work_date date not null,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null check (scheduled_end > scheduled_start),
  arrangement text not null default 'Office' check (arrangement in ('Office', 'Remote', 'Hybrid', 'Field')),
  day_off boolean not null default false,
  -- The current product supports one shift per employee per company date.
  unique (organization_id, employee_id, work_date),
  unique (organization_id, id, employee_id),
  foreign key (organization_id, employee_id) references public.forma_employees(organization_id, id),
  foreign key (organization_id, shift_id) references public.forma_shifts(organization_id, id),
  foreign key (organization_id, location_id) references public.forma_locations(organization_id, id)
);

create table public.forma_attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.forma_organizations(id),
  employee_id uuid not null,
  schedule_id uuid not null unique,
  clock_in timestamptz,
  clock_out timestamptz,
  duration_minutes integer not null default 0 check (duration_minutes >= 0),
  late_minutes integer not null default 0 check (late_minutes >= 0),
  early_departure_minutes integer not null default 0 check (early_departure_minutes >= 0),
  overtime_minutes integer not null default 0 check (overtime_minutes >= 0),
  status text not null check (status in ('Present', 'Late', 'Absent', 'Leave', 'Day off', 'Working')),
  check (clock_out is null or (clock_in is not null and clock_out >= clock_in)),
  unique (organization_id, id, employee_id),
  foreign key (organization_id, schedule_id, employee_id) references public.forma_schedules(organization_id, id, employee_id)
);
create unique index forma_one_open_session_per_employee
  on public.forma_attendance_sessions (organization_id, employee_id)
  where clock_in is not null and clock_out is null;

create table public.forma_attendance_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.forma_organizations(id),
  employee_id uuid not null,
  session_id uuid not null,
  event_type text not null check (event_type in ('in', 'out')),
  recorded_at timestamptz not null default now(),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  accuracy_meters double precision check (accuracy_meters between 0 and 100000),
  geofence text check (geofence in ('inside', 'outside', 'uncertain')),
  verification text not null check (verification in ('GPS', 'GPS + selfie', 'Remote', 'Field')),
  selfie_path text,
  idempotency_key text not null check (length(btrim(idempotency_key)) between 1 and 200),
  unique (organization_id, employee_id, idempotency_key),
  unique (session_id, event_type),
  foreign key (organization_id, session_id, employee_id) references public.forma_attendance_sessions(organization_id, id, employee_id)
);

create table public.forma_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.forma_organizations(id),
  employee_id uuid not null,
  kind text not null check (kind in ('leave', 'correction')),
  request_type text not null,
  start_date date,
  end_date date,
  working_days integer,
  attendance_date date,
  requested_time time,
  reason text not null check (length(btrim(reason)) between 10 and 1000),
  attachment_path text,
  status text not null default 'Pending' check (status in ('Pending', 'Approved', 'Rejected', 'Cancelled')),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, id, employee_id),
  foreign key (organization_id, employee_id) references public.forma_employees(organization_id, id),
  check (
    (kind = 'leave' and request_type in ('Annual leave', 'Sick leave', 'Personal leave', 'Unpaid leave')
      and start_date is not null and end_date is not null and end_date >= start_date
      and working_days is not null and working_days > 0 and attendance_date is null and requested_time is null)
    or
    (kind = 'correction' and request_type in ('Forgot to clock in', 'Forgot to clock out', 'Incorrect time', 'Location issue')
      and attendance_date is not null and requested_time is not null
      and start_date is null and end_date is null and working_days is null)
  )
);

create table public.forma_leave_entitlements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.forma_organizations(id),
  employee_id uuid not null,
  leave_year integer not null check (leave_year between 2000 and 9999),
  annual_days integer not null check (annual_days between 0 and 366),
  unique (organization_id, employee_id, leave_year),
  foreign key (organization_id, employee_id) references public.forma_employees(organization_id, id)
);

create table public.forma_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.forma_organizations(id),
  request_id uuid not null unique,
  employee_id uuid not null,
  reviewer_id uuid not null,
  decision text not null check (decision in ('Approved', 'Rejected')),
  reason text,
  decided_at timestamptz not null default now(),
  check (decision <> 'Rejected' or length(btrim(coalesce(reason, ''))) > 0),
  foreign key (organization_id, request_id, employee_id) references public.forma_requests(organization_id, id, employee_id),
  foreign key (organization_id, reviewer_id) references public.forma_employees(organization_id, id)
);

-- Corrections preserve the original events instead of rewriting evidence.
create table public.forma_attendance_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.forma_organizations(id),
  employee_id uuid not null,
  request_id uuid not null unique,
  session_id uuid not null,
  applied_by uuid not null,
  corrected_clock_in timestamptz,
  corrected_clock_out timestamptz,
  reason text not null check (length(btrim(reason)) > 0),
  applied_at timestamptz not null default now(),
  check (corrected_clock_in is not null or corrected_clock_out is not null),
  check (corrected_clock_out is null or corrected_clock_in is null or corrected_clock_out >= corrected_clock_in),
  foreign key (organization_id, request_id, employee_id) references public.forma_requests(organization_id, id, employee_id),
  foreign key (organization_id, session_id, employee_id) references public.forma_attendance_sessions(organization_id, id, employee_id),
  foreign key (organization_id, applied_by) references public.forma_employees(organization_id, id)
);

create table public.forma_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.forma_organizations(id),
  employee_id uuid not null,
  title text not null,
  message text not null,
  category text not null check (category in ('attendance', 'request', 'company')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  foreign key (organization_id, employee_id) references public.forma_employees(organization_id, id)
);

create table public.forma_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.forma_organizations(id),
  actor_id uuid not null,
  action text not null,
  entity_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (organization_id, actor_id) references public.forma_employees(organization_id, id)
);

create index forma_employees_department on public.forma_employees (organization_id, department_id);
create index forma_employees_location on public.forma_employees (organization_id, location_id);
create index forma_schedules_shift on public.forma_schedules (organization_id, shift_id);
create index forma_schedules_location on public.forma_schedules (organization_id, location_id);
create index forma_sessions_employee on public.forma_attendance_sessions (organization_id, employee_id);
create index forma_events_session on public.forma_attendance_events (organization_id, session_id, employee_id);
create index forma_requests_employee on public.forma_requests (organization_id, employee_id, created_at desc);
create index forma_requests_pending on public.forma_requests (organization_id, status, created_at);
create index forma_approvals_employee on public.forma_approvals (organization_id, employee_id);
create index forma_approvals_reviewer on public.forma_approvals (organization_id, reviewer_id);
create index forma_adjustments_employee on public.forma_attendance_adjustments (organization_id, employee_id);
create index forma_adjustments_session on public.forma_attendance_adjustments (organization_id, session_id, employee_id);
create index forma_adjustments_actor on public.forma_attendance_adjustments (organization_id, applied_by);
create index forma_notifications_employee on public.forma_notifications (organization_id, employee_id, created_at desc);
create index forma_audit_actor on public.forma_audit_logs (organization_id, actor_id, created_at desc);

-- Definer helpers avoid recursive employee RLS. Only the authenticated UID is trusted.
create function public.forma_is_member(target_organization uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.forma_employees
    where organization_id = target_organization and auth_user_id = (select auth.uid()) and active
  );
$$;
create function public.forma_is_admin(target_organization uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.forma_employees
    where organization_id = target_organization and auth_user_id = (select auth.uid()) and active and role = 'admin'
  );
$$;
create function public.forma_can_read_employee(target_organization uuid, target_employee uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.forma_employees
    where organization_id = target_organization and auth_user_id = (select auth.uid()) and active
      and (id = target_employee or role = 'admin')
  );
$$;

revoke all on function public.forma_is_member(uuid) from public, anon, authenticated;
revoke all on function public.forma_is_admin(uuid) from public, anon, authenticated;
revoke all on function public.forma_can_read_employee(uuid, uuid) from public, anon, authenticated;
grant execute on function public.forma_is_member(uuid), public.forma_is_admin(uuid), public.forma_can_read_employee(uuid, uuid) to authenticated;

-- Explicit grants are needed even when public-schema default grants are permissive.
-- Client writes stay disabled until validated transactional RPCs are implemented.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'forma_organizations', 'forma_departments', 'forma_locations', 'forma_employees',
    'forma_attendance_policies', 'forma_shifts', 'forma_schedules', 'forma_attendance_sessions',
    'forma_attendance_events', 'forma_requests', 'forma_leave_entitlements', 'forma_approvals',
    'forma_attendance_adjustments', 'forma_notifications', 'forma_audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant select on table public.%I to authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
  end loop;

  foreach table_name in array array['forma_departments', 'forma_locations', 'forma_attendance_policies', 'forma_shifts'] loop
    execute format('create policy member_read on public.%I for select to authenticated using (public.forma_is_member(organization_id))', table_name);
  end loop;

  foreach table_name in array array[
    'forma_schedules', 'forma_attendance_sessions', 'forma_attendance_events', 'forma_requests',
    'forma_leave_entitlements', 'forma_approvals', 'forma_attendance_adjustments', 'forma_notifications'
  ] loop
    execute format('create policy employee_read on public.%I for select to authenticated using (public.forma_can_read_employee(organization_id, employee_id))', table_name);
  end loop;
end;
$$;

create policy organization_read on public.forma_organizations for select to authenticated
  using (public.forma_is_member(id));
create policy employee_read on public.forma_employees for select to authenticated
  using (public.forma_can_read_employee(organization_id, id));
create policy audit_admin_read on public.forma_audit_logs for select to authenticated
  using (public.forma_is_admin(organization_id));

commit;
