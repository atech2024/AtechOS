-- Allow overpayment on every valid fee. The existing payment workflow caps the
-- portion applied to a charge, then review_finance_payment stores the remainder
-- as a student-specific credit and allocates it by due date.
do $$
declare fn regprocedure; definition text; revised text;
begin
  foreach fn in array array[
    'public.record_finance_payment(uuid,numeric,text,text,text,timestamptz)'::regprocedure,
    'public.submit_family_finance_payment(uuid,numeric,text,text,text)'::regprocedure
  ] loop
    definition:=pg_get_functiondef(fn);
    revised:=regexp_replace(definition,
      'if p_amount\s*>\s*remaining\s+and[\s\S]*?raise exception ''overpayment_only_allowed_for_entry_fees'';\s*end if;',
      '-- Excess is retained as a student-specific credit after validation.', 'g');
    if revised=definition then
      raise exception 'expected_overpayment_guard_not_found_in_%',fn;
    end if;
    execute revised;
  end loop;
end $$;

