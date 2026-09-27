-- TRUST Phase 8I-0: Phase 6 re-entry runtime search_path / ACL hardening.
-- Semantic behavior is intentionally unchanged. This migration only pins function
-- name resolution and reasserts the existing least-privilege EXECUTE surface.

alter function public.hash_trust_reentry_signal_v1(jsonb)
  set search_path = '';
alter function public.observe_trust_reentry_signal_v1(text,text,text,uuid,uuid,uuid,jsonb)
  set search_path = '';
alter function public.process_trust_reentry_event_v1(uuid)
  set search_path = '';
alter function public.request_trust_reentry_v1(text,uuid,uuid,uuid,text,uuid,text,jsonb)
  set search_path = '';
alter function public.run_trust_reentry_detectors_v1(integer)
  set search_path = '';

revoke all on function public.hash_trust_reentry_signal_v1(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.observe_trust_reentry_signal_v1(text,text,text,uuid,uuid,uuid,jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.process_trust_reentry_event_v1(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.request_trust_reentry_v1(text,uuid,uuid,uuid,text,uuid,text,jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.run_trust_reentry_detectors_v1(integer)
  from public, anon, authenticated, service_role;

grant execute on function public.process_trust_reentry_event_v1(uuid)
  to service_role;
grant execute on function public.request_trust_reentry_v1(text,uuid,uuid,uuid,text,uuid,text,jsonb)
  to service_role;
grant execute on function public.run_trust_reentry_detectors_v1(integer)
  to service_role;
