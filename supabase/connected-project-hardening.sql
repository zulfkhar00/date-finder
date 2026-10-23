-- The connected Supabase project includes a public RLS event-trigger function.
-- Browser roles do not need to execute it through the Data API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
