begin;

create index product_fact_revalidation_transitions_confirmation_idx
  on public.product_fact_revalidation_transitions (confirmation_id, transition_id);

create index product_fact_revalidation_transitions_actor_created_idx
  on public.product_fact_revalidation_transitions (actor_user_id, created_at desc, transition_id);

commit;
