-- Keep the official daily BRH page URL as the immutable source of FX snapshots.
-- The prior migration constrained snapshots to the BRH's older exchange-rate page.
alter table public.finance_brh_reference_rates
  drop constraint finance_brh_reference_rates_source_url_check,
  add constraint finance_brh_reference_rates_source_url_check
    check (source_url in ('https://www.brh.ht/politique-monetaire/taux-de-change/', 'https://www.brh.ht/taux-du-jour/'));

alter table public.finance_payments
  drop constraint finance_payment_fx_snapshot_complete;
alter table public.finance_payments
  add constraint finance_payment_fx_snapshot_complete
    check ((exchange_rate_snapshot is null and exchange_rate_effective_date is null and exchange_rate_source_url is null)
        or (currency_code='USD' and exchange_rate_snapshot > 0 and exchange_rate_effective_date is not null and exchange_rate_source_url in ('https://www.brh.ht/politique-monetaire/taux-de-change/', 'https://www.brh.ht/taux-du-jour/')));

create or replace function public.record_brh_reference_rate(p_effective_date date,p_rate numeric,p_source_url text)
returns void language plpgsql security definer set search_path=''
as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'not_authorized'; end if;
  if p_effective_date is null or p_rate is null or p_rate <= 0 or p_rate > 100000
     or p_source_url <> 'https://www.brh.ht/taux-du-jour/' then
    raise exception 'invalid_brh_reference_rate';
  end if;
  insert into public.finance_brh_reference_rates(effective_date,htg_per_usd,source_url)
  values(p_effective_date,round(p_rate,6),p_source_url) on conflict(effective_date,htg_per_usd) do nothing;
end $$;
revoke all on function public.record_brh_reference_rate(date,numeric,text) from public,anon,authenticated;
grant execute on function public.record_brh_reference_rate(date,numeric,text) to service_role;
