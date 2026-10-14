/**
 * Row-level security. Applied by `migrate.ts` after the schema migrations, and safe to re-run.
 *
 * Every table with an `org_id` column gets one policy: a row is visible or writable only when
 * `app.org_id` (set per transaction by `withOrg`) matches, or when `app.bypass_rls` is on
 * (sign-in lookups, seeds). FORCE makes the policy apply to the table owner too, so the API's own
 * connection cannot read across organizations by accident.
 *
 * Kept as one statement per array entry: PGlite (and the extended protocol in general) refuses more
 * than one command in a prepared statement, so `applyRls` runs these one at a time.
 */
export const RLS_STATEMENTS: string[] = [
  `create or replace function app_org() returns uuid language sql stable as $$
  select nullif(current_setting('app.org_id', true), '')::uuid
$$`,
  `create or replace function app_user() returns uuid language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$`,
  `create or replace function app_bypass() returns boolean language sql stable as $$
  select coalesce(current_setting('app.bypass_rls', true), '') = 'on'
$$`,
  `do $$
declare t text;
begin
  for t in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'org_id'
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists org_isolation on %I', t);
    execute format(
      'create policy org_isolation on %I using (org_id = app_org() or app_bypass()) with check (org_id = app_org() or app_bypass())',
      t
    );
  end loop;
end $$`,
  `alter table orgs enable row level security`,
  `alter table orgs force row level security`,
  `drop policy if exists org_self on orgs`,
  `create policy org_self on orgs using (id = app_org() or app_bypass()) with check (id = app_org() or app_bypass())`,
];

/** The same policies as one script, for reading or for psql. */
export const RLS_SQL = RLS_STATEMENTS.map((s) => `${s};`).join("\n\n");
