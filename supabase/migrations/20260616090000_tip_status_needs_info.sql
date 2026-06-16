-- ═══════════════════════════════════════════════════════════════════════════
--  Add tip_status 'needs_info' — lets a kommun-admin send a submission BACK to
--  its author for completion (the "be om mer information"-loop) instead of only
--  publish/reject. Must live in its OWN migration: a freshly added enum value
--  cannot be referenced in the same transaction that adds it, and the follow-up
--  migration (…_place_contributions.sql) uses 'needs_info' in policies/RPCs.
-- ═══════════════════════════════════════════════════════════════════════════
alter type public.tip_status add value if not exists 'needs_info' after 'pending';
