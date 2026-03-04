-- Clean up the broken auth user so we can recreate via the API
delete from auth.identities where provider_id = 'ryan@kleen.co.uk';
delete from auth.users where email = 'ryan@kleen.co.uk';
delete from public.profiles where email = 'ryan@kleen.co.uk';
