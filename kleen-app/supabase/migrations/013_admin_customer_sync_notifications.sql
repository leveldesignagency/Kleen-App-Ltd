-- ============================================================================
-- KLEEN — Migration 013: Admin ↔ Customer sync
-- 1. Extend on_job_status_change so customer gets friendly notifications when
--    admin updates status (e.g. sent_to_customer = "Quote ready").
-- ============================================================================

create or replace function on_job_status_change()
returns trigger language plpgsql security definer as $$
declare
  v_title    text;
  v_body     text;
  v_svc_name text;
  v_email    text;
  v_name     text;
begin
  if old.status = new.status then return new; end if;

  select s.name into v_svc_name from public.services s where s.id = new.service_id;
  select p.email, p.full_name into v_email, v_name from public.profiles p where p.id = new.user_id;

  case new.status
    when 'quoted' then
      v_title := 'Quote ready';
      v_body  := format('Your quote for %s is ready to review.', v_svc_name);
    when 'sent_to_customer' then
      v_title := 'Quote ready';
      v_body  := format('Your quote for %s is ready. View it in your dashboard and choose your preferred option.', v_svc_name);
    when 'accepted' then
      v_title := 'Quote accepted';
      v_body  := format('You accepted the quote for %s. We''re scheduling your clean.', v_svc_name);
    when 'customer_accepted' then
      v_title := 'Quote accepted';
      v_body  := format('Your quote for %s has been accepted. We''re assigning your cleaner.', v_svc_name);
    when 'scheduled' then
      v_title := 'Job scheduled';
      v_body  := format('Your %s has been scheduled for %s.', v_svc_name, to_char(new.preferred_date, 'DD Mon YYYY'));
    when 'awaiting_completion' then
      v_title := 'Cleaner assigned';
      v_body  := format('Your %s is confirmed. The team will complete the work on the scheduled date.', v_svc_name);
    when 'in_progress' then
      v_title := 'Cleaning in progress';
      v_body  := format('Your %s is now underway!', v_svc_name);
    when 'pending_confirmation' then
      v_title := 'Completion pending';
      v_body  := format('Your %s is awaiting confirmation. We''ll notify you when it''s complete.', v_svc_name);
    when 'completed' then
      v_title := 'Job completed';
      v_body  := format('Your %s is finished. Please leave a review!', v_svc_name);
    when 'disputed' then
      v_title := 'Dispute opened';
      v_body  := format('A dispute has been opened for your %s. We''ll review it shortly.', v_svc_name);
    when 'cancelled' then
      v_title := 'Job cancelled';
      v_body  := format('Your %s booking has been cancelled.', v_svc_name);
    when 'funds_released' then
      v_title := 'Payment complete';
      v_body  := format('Payment for your %s has been finalised. Thank you!', v_svc_name);
    else
      v_title := 'Job updated';
      v_body  := format('Your %s has been updated. Check your dashboard for details.', v_svc_name);
  end case;

  perform notify_user(
    new.user_id,
    v_title,
    v_body,
    jsonb_build_object('job_id', new.id, 'reference', new.reference, 'old_status', old.status, 'new_status', new.status)
  );

  perform queue_email(
    v_email,
    v_name,
    'KLEEN — ' || v_title,
    format('<h2>%s</h2><p>%s</p><p>Job ref: <strong>%s</strong></p>', v_title, v_body, new.reference)
  );

  perform log_activity(
    new.user_id,
    'job',
    new.id::text,
    'status_changed',
    jsonb_build_object('from', old.status, 'to', new.status)
  );

  return new;
end;
$$;
