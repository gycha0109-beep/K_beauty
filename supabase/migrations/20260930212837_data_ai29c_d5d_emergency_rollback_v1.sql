begin;

grant recommendation_admission_reader_owner to postgres;
set local role recommendation_admission_reader_owner;

update public.sunscreen_spf_runtime_activation_v1
set enabled = false,
    activated_by = 'automatic_rollback_after_d5c_regression',
    updated_at = now()
where scope = 'authenticated_product_query_beta';

reset role;
revoke recommendation_admission_reader_owner from postgres;

commit;
