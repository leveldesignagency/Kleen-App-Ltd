-- ============================================================================
-- KLEEN — Reset Script
-- Run this FIRST in the SQL Editor to drop all old tables, types, and triggers
-- Then run 001_full_schema.sql
-- ============================================================================

-- Drop all triggers on auth.users (our handle_new_user trigger)
drop trigger if exists on_auth_user_created on auth.users;

-- Drop views
drop view if exists public.unread_notification_count cascade;
drop view if exists public.user_dashboard_stats cascade;

-- Drop all tables (order matters due to foreign keys — children first)
drop table if exists public.promo_redemptions cascade;
drop table if exists public.promo_codes cascade;
drop table if exists public.app_settings cascade;
drop table if exists public.activity_log cascade;
drop table if exists public.email_queue cascade;
drop table if exists public.email_templates cascade;
drop table if exists public.notifications cascade;
drop table if exists public.dispute_messages cascade;
drop table if exists public.disputes cascade;
drop table if exists public.reviews cascade;
drop table if exists public.quote_responses cascade;
drop table if exists public.quote_requests cascade;
drop table if exists public.availability_slots cascade;
drop table if exists public.job_assignments cascade;
drop table if exists public.operatives cascade;
drop table if exists public.payments cascade;
drop table if exists public.payment_methods cascade;
drop table if exists public.recurring_schedules cascade;
drop table if exists public.job_templates cascade;
drop table if exists public.quotes cascade;
drop table if exists public.job_details cascade;
drop table if exists public.jobs cascade;
drop table if exists public.services cascade;
drop table if exists public.service_categories cascade;
drop table if exists public.addresses cascade;
drop table if exists public.business_profiles cascade;
drop table if exists public.profiles cascade;

-- Drop old tables from previous schema (if any)
drop table if exists public.service_configs cascade;
drop table if exists public.users cascade;

-- Drop all custom functions
drop function if exists on_job_completed_save_template() cascade;
drop function if exists on_dispute_status_change() cascade;
drop function if exists on_review_created() cascade;
drop function if exists on_payment_status_change() cascade;
drop function if exists on_job_created() cascade;
drop function if exists on_job_status_change() cascade;
drop function if exists generate_job_reference() cascade;
drop function if exists update_updated_at() cascade;
drop function if exists handle_new_user() cascade;
drop function if exists notify_user(uuid, text, text, jsonb) cascade;
drop function if exists queue_email(text, text, text, text, uuid, jsonb) cascade;
drop function if exists log_activity(uuid, text, text, text, jsonb) cascade;
drop function if exists is_admin() cascade;
drop function if exists is_operative() cascade;

-- Drop all custom enums
drop type if exists quote_request_status cascade;
drop type if exists recurrence_frequency cascade;
drop type if exists schedule_status cascade;
drop type if exists email_status cascade;
drop type if exists notification_channel cascade;
drop type if exists discount_type cascade;
drop type if exists dispute_status cascade;
drop type if exists payment_method_type cascade;
drop type if exists payment_status cascade;
drop type if exists job_status cascade;
drop type if exists job_complexity cascade;
drop type if exists room_size cascade;
drop type if exists cleaning_type cascade;
drop type if exists account_type cascade;
drop type if exists user_role cascade;

-- Also drop any old enums from the previous schema
drop type if exists "JobStatus" cascade;
