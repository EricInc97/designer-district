-- Generated campaign imagery, and the asynchronous jobs behind it.
--
-- Higgsfield generation is not request/response: you submit, you get a
-- request_id, and the picture exists some minutes later. Something has to
-- remember the job across that gap, and it cannot be the browser — a tab
-- closed mid-generation would otherwise lose the result and there would be
-- no way to find it again, having paid for it.
--
-- The other reason this table exists is ownership. The request_id is the only
-- handle on a generation, and anyone holding one can read its result or
-- cancel it. Storing it against the staff member who started it is what lets
-- the status and cancel paths check that the caller is entitled to it.

create table if not exists public.campaign_jobs (
  id          uuid primary key default gen_random_uuid(),
  request_id  text not null unique,
  model       text not null,
  status      text not null default 'queued'
                check (status in ('queued','in_progress','completed','failed','nsfw','canceled')),
  prompt      text not null,
  -- What was sent, so a good result can be reproduced and a bad one diagnosed.
  input       jsonb not null default '{}'::jsonb,
  -- Nullable: a campaign image can be generated before it is assigned to
  -- anything, and a product being deleted should not delete its history.
  product_id  uuid references public.products(id) on delete set null,
  created_by  uuid not null references public.profiles(id) on delete cascade,
  -- Higgsfield's own URL. Documented to expire seven days after completion,
  -- which is why it is never the one a product points at.
  result_url  text,
  -- Our copy in the product-images bucket. This one does not expire.
  stored_url  text,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists campaign_jobs_mine_idx
  on public.campaign_jobs (created_by, created_at desc);
create index if not exists campaign_jobs_product_idx
  on public.campaign_jobs (product_id);
-- The poller asks "what is still moving?" on every visit to the page.
create index if not exists campaign_jobs_open_idx
  on public.campaign_jobs (status) where status in ('queued','in_progress');

alter table public.campaign_jobs enable row level security;

/* Your own jobs, or anyone's if you administer staff.
 *
 * Deliberately narrower than the rest of the admin: a generation costs money
 * against one account and the results are drafts until somebody applies them,
 * so the default is that they are yours. */
drop policy if exists campaign_jobs_read on public.campaign_jobs;
create policy campaign_jobs_read on public.campaign_jobs
  for select to authenticated
  using (created_by = auth.uid() or public.has_scope('staff.manage'));

/* Writing needs both: it has to be your row, and you have to be allowed to
 * manage products in the first place. The second half is what stops a
 * customer account inserting rows for itself. */
drop policy if exists campaign_jobs_write on public.campaign_jobs;
create policy campaign_jobs_write on public.campaign_jobs
  for all to authenticated
  using (created_by = auth.uid() and public.has_scope('products.manage'))
  with check (created_by = auth.uid() and public.has_scope('products.manage'));

-- There is no generic updated_at trigger in this schema (tickets have their
-- own, and it does more than a timestamp), so this table brings its own.
create or replace function public.touch_campaign_job()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists campaign_jobs_touch on public.campaign_jobs;
create trigger campaign_jobs_touch
  before update on public.campaign_jobs
  for each row execute function public.touch_campaign_job();
