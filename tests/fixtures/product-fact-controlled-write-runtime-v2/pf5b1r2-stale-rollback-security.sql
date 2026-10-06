create or replace function pg_temp.ready_fixture(p_tag text)
returns jsonb
language plpgsql
as $$
declare
  v_actor constant uuid := '91000000-0000-4000-8000-000000000001';
  v_product constant uuid := '00000000-0000-4000-8000-000000000301';
  v_registry constant text := 'pf5b1r2-registry-v1';
  v_subject uuid;
  v_prop text;
  v_evidence jsonb;
  v_evidence_id uuid;
  v_assignment uuid;
  v_payload jsonb;
  v_preflight jsonb;
  v_request text;
begin
  select subject_id into strict v_subject
  from public.product_fact_subjects
  where subject_semantic_key = public.product_fact_controlled_sha256_json_v1(jsonb_build_object('subject','main'));

  v_prop := public.product_fact_controlled_sha256_json_v1(jsonb_build_object('prop','phase2-'||p_tag));
  v_evidence := pg_temp.ingest_evidence(
    v_actor,
    'pf5b1r2-'||p_tag||'-evidence',
    v_product,
    v_subject,
    v_registry,
    'pf5b1r2_boolean',
    v_prop,
    p_tag||'-support',
    'supports',
    'not_applicable',
    'product_specific_primary'
  );
  v_evidence_id := (v_evidence->>'evidence_id')::uuid;

  v_assignment := (pg_temp.prepare_review(v_actor,'pf5b1r2-'||p_tag||'-review1',v_product,v_subject,v_registry,'pf5b1r2_boolean',v_prop,'queued',v_actor)->>'assignment_id')::uuid;
  perform pg_temp.prepare_review(v_actor,'pf5b1r2-'||p_tag||'-review2',v_product,v_subject,v_registry,'pf5b1r2_boolean',v_prop,'under_review',v_actor);
  perform pg_temp.prepare_review(v_actor,'pf5b1r2-'||p_tag||'-review3',v_product,v_subject,v_registry,'pf5b1r2_boolean',v_prop,'ready_for_confirm',v_actor);

  v_payload := pg_temp.boolean_confirmation_payload(
    v_assignment,v_subject,v_registry,'pf5b1r2_boolean',v_prop,
    'supported',true,'product_specific_primary',array[v_evidence_id],array[]::uuid[]
  );
  v_request := 'pf5b1r2-'||p_tag||'-confirm';
  v_preflight := public.admin_preflight_product_fact_confirmation_v1(v_actor,v_request,v_payload);

  return jsonb_build_object(
    'actor',v_actor,
    'product',v_product,
    'registry',v_registry,
    'subject',v_subject,
    'prop',v_prop,
    'evidence_id',v_evidence_id,
    'assignment_id',v_assignment,
    'payload',v_payload,
    'request_id',v_request,
    'preflight',v_preflight
  );
end;
$$;

create or replace function pg_temp.fail_trigger()
returns trigger
language plpgsql
as $$
begin
  raise exception 'pf5b1r2_forced_rollback:%:%', tg_table_name, tg_op using errcode='P0001';
end;
$$;

do $$
declare
  v_actor constant uuid := '91000000-0000-4000-8000-000000000001';
  v_fixture jsonb;
  v_payload jsonb;
  v_preflight jsonb;
  v_alt_payload jsonb;
  v_alt_preflight jsonb;
  v_before text;
  v_after text;
  v_state text;
  v_message text;
  v_assignment uuid;
  v_subject uuid;
  v_prop text;
  v_evidence uuid;
  v_old_assignment_updated_at timestamptz;
  v_old_subject_updated_at timestamptz;
  v_result jsonb;
  v_source public.product_evidence_sources%rowtype;
  v_binding_payload jsonb;
  v_registry2 text := 'pf5b1r2-registry-v2';
  v_bool_definition jsonb;
  v_enum_definition jsonb;
  v_bool_checksum text;
  v_enum_checksum text;
  v_definitions jsonb;
  v_registry_checksum text;
  v_registry_payload jsonb;
  v_count_before bigint;
  v_count_after bigint;
begin
  -- STALE A: Current changes through another valid Confirm; assignment state is restored
  -- to the exact old preflight tuple so Current is the isolated stale dimension.
  v_fixture := pg_temp.ready_fixture('stale-a-current');
  v_payload := v_fixture->'payload';
  v_preflight := v_fixture->'preflight';
  v_assignment := (v_fixture->>'assignment_id')::uuid;
  select updated_at into v_old_assignment_updated_at from public.product_fact_review_assignments where assignment_id=v_assignment;
  v_alt_payload := jsonb_set(v_payload,'{fused_confidence}','"medium"'::jsonb);
  v_alt_preflight := public.admin_preflight_product_fact_confirmation_v1(v_actor,'pf5b1r2-stale-a-alt',v_alt_payload);
  perform public.admin_confirm_product_fact_v1(v_actor,'pf5b1r2-stale-a-alt',v_alt_payload,v_alt_preflight->>'payload_digest',v_alt_preflight->>'prestate_digest');
  update public.product_fact_review_assignments
  set operational_state='ready_for_confirm', updated_at=v_old_assignment_updated_at
  where assignment_id=v_assignment;
  v_before := pg_temp.full_fingerprint();
  begin
    perform public.admin_confirm_product_fact_v1(v_actor,v_fixture->>'request_id',v_payload,v_preflight->>'payload_digest',v_preflight->>'prestate_digest');
    raise exception 'stale_current_not_rejected';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate,v_message=message_text;
    if v_message='stale_current_not_rejected' then raise; end if;
    perform pg_temp.assert_true(v_state='40001' and v_message='product_fact_confirmation_stale_preflight','stale_current_wrong_error');
  end;
  v_after := pg_temp.full_fingerprint();
  perform pg_temp.assert_true(v_before=v_after,'stale_current_mutation');
  insert into pf5b1r2_results values ('stale_A_current','PASS',jsonb_build_object('sqlstate',v_state,'message',v_message,'before',v_before,'after',v_after));

  -- STALE B: a newer Evidence record supersedes an old supporting Evidence record.
  v_fixture := pg_temp.ready_fixture('stale-b-evidence');
  v_payload := v_fixture->'payload';
  v_preflight := v_fixture->'preflight';
  v_evidence := (v_fixture->>'evidence_id')::uuid;
  perform pg_temp.ingest_evidence(
    v_actor,'pf5b1r2-stale-b-newer-evidence',
    (v_fixture->>'product')::uuid,(v_fixture->>'subject')::uuid,v_fixture->>'registry','pf5b1r2_boolean',v_fixture->>'prop',
    'stale-b-newer-support','supports','not_applicable','product_specific_primary','official_product_page',v_evidence,'KR'
  );
  v_before := pg_temp.full_fingerprint();
  begin
    perform public.admin_confirm_product_fact_v1(v_actor,v_fixture->>'request_id',v_payload,v_preflight->>'payload_digest',v_preflight->>'prestate_digest');
    raise exception 'stale_evidence_not_rejected';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate,v_message=message_text;
    if v_message='stale_evidence_not_rejected' then raise; end if;
    perform pg_temp.assert_true(v_state='40001' and v_message='product_fact_confirmation_evidence_stale','stale_evidence_wrong_error');
  end;
  v_after := pg_temp.full_fingerprint();
  perform pg_temp.assert_true(v_before=v_after,'stale_evidence_mutation');
  insert into pf5b1r2_results values ('stale_B_evidence','PASS',jsonb_build_object('sqlstate',v_state,'message',v_message,'before',v_before,'after',v_after));

  -- STALE C: same Source/product gets a newer reviewed binding through the controlled ingest RPC.
  v_fixture := pg_temp.ready_fixture('stale-c-binding');
  v_payload := v_fixture->'payload';
  v_preflight := v_fixture->'preflight';
  v_evidence := (v_fixture->>'evidence_id')::uuid;
  select s.* into strict v_source
  from public.product_evidence_sources s
  join public.product_evidence_records e on e.source_id=s.source_id
  where e.evidence_id=v_evidence;
  v_binding_payload := jsonb_build_object(
    'source',jsonb_build_object(
      'canonical_locator',v_source.canonical_locator,'publisher',v_source.publisher,'source_kind',v_source.source_kind,
      'source_metadata',v_source.source_metadata,'content_digest',v_source.content_digest,
      'external_snapshot_reference',v_source.external_snapshot_reference,'market',v_source.market,'region',v_source.region,'locale',v_source.locale,
      'published_at',v_source.published_at,'accessed_at','2026-08-12T00:00:00Z','observed_at','2026-08-12T00:00:00Z'
    ),
    'binding',jsonb_build_object(
      'product_id',(v_fixture->>'product')::uuid,'subject_id',(v_fixture->>'subject')::uuid,
      'binding_state','exact_subject_match','scope_relation','equivalent','presentation_metadata','{}'::jsonb,
      'identity_resolution_version','pf5b1r2-binding-v2','reviewed_at','2026-08-12T00:00:00Z'
    ),
    'evidence',null
  );
  perform public.admin_ingest_product_fact_evidence_v1(v_actor,'pf5b1r2-stale-c-new-binding',v_binding_payload);
  v_before := pg_temp.full_fingerprint();
  begin
    perform public.admin_confirm_product_fact_v1(v_actor,v_fixture->>'request_id',v_payload,v_preflight->>'payload_digest',v_preflight->>'prestate_digest');
    raise exception 'stale_binding_not_rejected';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate,v_message=message_text;
    if v_message='stale_binding_not_rejected' then raise; end if;
    perform pg_temp.assert_true(v_state='40001' and v_message='product_fact_confirmation_evidence_stale','stale_binding_wrong_error');
  end;
  v_after := pg_temp.full_fingerprint();
  perform pg_temp.assert_true(v_before=v_after,'stale_binding_mutation');
  insert into pf5b1r2_results values ('stale_C_binding','PASS',jsonb_build_object('sqlstate',v_state,'message',v_message,'before',v_before,'after',v_after));

  -- STALE D: local control mutation changes Subject currentness, then exact tuple is restored.
  v_fixture := pg_temp.ready_fixture('stale-d-subject');
  v_payload := v_fixture->'payload';
  v_preflight := v_fixture->'preflight';
  v_subject := (v_fixture->>'subject')::uuid;
  select updated_at into v_old_subject_updated_at from public.product_fact_subjects where subject_id=v_subject;
  update public.product_fact_subjects set current_state='historical',updated_at=now() where subject_id=v_subject;
  v_before := pg_temp.full_fingerprint();
  begin
    perform public.admin_confirm_product_fact_v1(v_actor,v_fixture->>'request_id',v_payload,v_preflight->>'payload_digest',v_preflight->>'prestate_digest');
    raise exception 'stale_subject_not_rejected';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate,v_message=message_text;
    if v_message='stale_subject_not_rejected' then raise; end if;
    perform pg_temp.assert_true(v_state='40001' and v_message='product_fact_confirmation_subject_stale','stale_subject_wrong_error');
  end;
  v_after := pg_temp.full_fingerprint();
  perform pg_temp.assert_true(v_before=v_after,'stale_subject_confirm_mutation');
  update public.product_fact_subjects set current_state='current',updated_at=v_old_subject_updated_at where subject_id=v_subject;
  insert into pf5b1r2_results values ('stale_D_subject','PASS',jsonb_build_object('sqlstate',v_state,'message',v_message,'before',v_before,'after',v_after));

  -- STALE E: assignment leaves ready_for_confirm after preflight.
  v_fixture := pg_temp.ready_fixture('stale-e-assignment');
  v_payload := v_fixture->'payload';
  v_preflight := v_fixture->'preflight';
  v_assignment := (v_fixture->>'assignment_id')::uuid;
  update public.product_fact_review_assignments set operational_state='under_review',updated_at=now() where assignment_id=v_assignment;
  v_before := pg_temp.full_fingerprint();
  begin
    perform public.admin_confirm_product_fact_v1(v_actor,v_fixture->>'request_id',v_payload,v_preflight->>'payload_digest',v_preflight->>'prestate_digest');
    raise exception 'stale_assignment_not_rejected';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate,v_message=message_text;
    if v_message='stale_assignment_not_rejected' then raise; end if;
    perform pg_temp.assert_true(v_state='40001' and v_message='product_fact_confirmation_assignment_stale','stale_assignment_wrong_error');
  end;
  v_after := pg_temp.full_fingerprint();
  perform pg_temp.assert_true(v_before=v_after,'stale_assignment_confirm_mutation');
  insert into pf5b1r2_results values ('stale_E_assignment','PASS',jsonb_build_object('sqlstate',v_state,'message',v_message,'before',v_before,'after',v_after));

  -- ROLLBACK A: Fact and EvidenceLink insert can occur before forced Confirmation failure.
  v_fixture := pg_temp.ready_fixture('rollback-a-confirmation');
  v_before := pg_temp.full_fingerprint();
  create trigger pf5b1r2_fail_confirmation before insert on public.product_fact_confirmations for each row execute function pg_temp.fail_trigger();
  begin
    perform public.admin_confirm_product_fact_v1(v_actor,v_fixture->>'request_id',v_fixture->'payload',v_fixture#>>'{preflight,payload_digest}',v_fixture#>>'{preflight,prestate_digest}');
    raise exception 'rollback_a_not_failed';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate,v_message=message_text;
    if v_message='rollback_a_not_failed' then raise; end if;
    perform pg_temp.assert_true(v_state='P0001' and v_message like 'pf5b1r2_forced_rollback:product_fact_confirmations:%','rollback_a_wrong_error');
  end;
  drop trigger pf5b1r2_fail_confirmation on public.product_fact_confirmations;
  v_after := pg_temp.full_fingerprint();
  perform pg_temp.assert_true(v_before=v_after,'rollback_a_residue');
  insert into pf5b1r2_results values ('rollback_A_post_fact_downstream','PASS',jsonb_build_object('sqlstate',v_state,'message',v_message,'before',v_before,'after',v_after));

  -- ROLLBACK B: fail during EvidenceLink insertion.
  v_fixture := pg_temp.ready_fixture('rollback-b-link');
  v_before := pg_temp.full_fingerprint();
  create trigger pf5b1r2_fail_link before insert on public.product_fact_evidence_links for each row execute function pg_temp.fail_trigger();
  begin
    perform public.admin_confirm_product_fact_v1(v_actor,v_fixture->>'request_id',v_fixture->'payload',v_fixture#>>'{preflight,payload_digest}',v_fixture#>>'{preflight,prestate_digest}');
    raise exception 'rollback_b_not_failed';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate,v_message=message_text;
    if v_message='rollback_b_not_failed' then raise; end if;
    perform pg_temp.assert_true(v_state='P0001' and v_message like 'pf5b1r2_forced_rollback:product_fact_evidence_links:%','rollback_b_wrong_error');
  end;
  drop trigger pf5b1r2_fail_link on public.product_fact_evidence_links;
  v_after := pg_temp.full_fingerprint();
  perform pg_temp.assert_true(v_before=v_after,'rollback_b_residue');
  insert into pf5b1r2_results values ('rollback_B_evidence_link','PASS',jsonb_build_object('sqlstate',v_state,'message',v_message,'before',v_before,'after',v_after));

  -- ROLLBACK C: fail at Current boundary after Fact, links, Confirmation.
  v_fixture := pg_temp.ready_fixture('rollback-c-current');
  v_before := pg_temp.full_fingerprint();
  create trigger pf5b1r2_fail_current before insert or update on public.product_fact_current for each row execute function pg_temp.fail_trigger();
  begin
    perform public.admin_confirm_product_fact_v1(v_actor,v_fixture->>'request_id',v_fixture->'payload',v_fixture#>>'{preflight,payload_digest}',v_fixture#>>'{preflight,prestate_digest}');
    raise exception 'rollback_c_not_failed';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate,v_message=message_text;
    if v_message='rollback_c_not_failed' then raise; end if;
    perform pg_temp.assert_true(v_state='P0001' and v_message like 'pf5b1r2_forced_rollback:product_fact_current:%','rollback_c_wrong_error');
  end;
  drop trigger pf5b1r2_fail_current on public.product_fact_current;
  v_after := pg_temp.full_fingerprint();
  perform pg_temp.assert_true(v_before=v_after,'rollback_c_residue');
  insert into pf5b1r2_results values ('rollback_C_current_boundary','PASS',jsonb_build_object('sqlstate',v_state,'message',v_message,'before',v_before,'after',v_after));

  -- ROLLBACK D: fail at assignment transition after Current write.
  v_fixture := pg_temp.ready_fixture('rollback-d-assignment');
  v_before := pg_temp.full_fingerprint();
  create trigger pf5b1r2_fail_assignment before update on public.product_fact_review_assignments for each row execute function pg_temp.fail_trigger();
  begin
    perform public.admin_confirm_product_fact_v1(v_actor,v_fixture->>'request_id',v_fixture->'payload',v_fixture#>>'{preflight,payload_digest}',v_fixture#>>'{preflight,prestate_digest}');
    raise exception 'rollback_d_not_failed';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate,v_message=message_text;
    if v_message='rollback_d_not_failed' then raise; end if;
    perform pg_temp.assert_true(v_state='P0001' and v_message like 'pf5b1r2_forced_rollback:product_fact_review_assignments:%','rollback_d_wrong_error');
  end;
  drop trigger pf5b1r2_fail_assignment on public.product_fact_review_assignments;
  v_after := pg_temp.full_fingerprint();
  perform pg_temp.assert_true(v_before=v_after,'rollback_d_residue');
  insert into pf5b1r2_results values ('rollback_D_assignment_transition','PASS',jsonb_build_object('sqlstate',v_state,'message',v_message,'before',v_before,'after',v_after));

  -- ROLLBACK E: fail at fact_confirmed Review Event after assignment transition.
  v_fixture := pg_temp.ready_fixture('rollback-e-review-event');
  v_before := pg_temp.full_fingerprint();
  create trigger pf5b1r2_fail_review_event before insert on public.product_fact_review_events for each row execute function pg_temp.fail_trigger();
  begin
    perform public.admin_confirm_product_fact_v1(v_actor,v_fixture->>'request_id',v_fixture->'payload',v_fixture#>>'{preflight,payload_digest}',v_fixture#>>'{preflight,prestate_digest}');
    raise exception 'rollback_e_not_failed';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate,v_message=message_text;
    if v_message='rollback_e_not_failed' then raise; end if;
    perform pg_temp.assert_true(v_state='P0001' and v_message like 'pf5b1r2_forced_rollback:product_fact_review_events:%','rollback_e_wrong_error');
  end;
  drop trigger pf5b1r2_fail_review_event on public.product_fact_review_events;
  v_after := pg_temp.full_fingerprint();
  perform pg_temp.assert_true(v_before=v_after,'rollback_e_residue');
  insert into pf5b1r2_results values ('rollback_E_review_event','PASS',jsonb_build_object('sqlstate',v_state,'message',v_message,'before',v_before,'after',v_after));

  -- STALE F: a newer effective Registry becomes authority after old preflight.
  v_fixture := pg_temp.ready_fixture('stale-f-registry');
  v_payload := v_fixture->'payload';
  v_preflight := v_fixture->'preflight';
  v_bool_definition := jsonb_build_object('fact_key','pf5b1r2_boolean','value_type','boolean','registry_version',v_registry2,'permitted_evidence_classes',jsonb_build_array('product_claim','measurement','observation'));
  v_enum_definition := jsonb_build_object('fact_key','pf5b1r2_enum','value_type','enum','registry_version',v_registry2,'allowed_values',jsonb_build_array('alpha','beta'),'permitted_evidence_classes',jsonb_build_array('product_claim','measurement','observation'));
  v_bool_checksum := public.product_fact_controlled_sha256_json_v1(v_bool_definition);
  v_enum_checksum := public.product_fact_controlled_sha256_json_v1(v_enum_definition);
  v_definitions := jsonb_build_array(
    jsonb_build_object('fact_key','pf5b1r2_boolean','value_type','boolean','definition',v_bool_definition,'definition_checksum',v_bool_checksum,'deprecated',false,'superseded_by_fact_key',null),
    jsonb_build_object('fact_key','pf5b1r2_enum','value_type','enum','definition',v_enum_definition,'definition_checksum',v_enum_checksum,'deprecated',false,'superseded_by_fact_key',null)
  );
  v_registry_checksum := public.product_fact_controlled_sha256_json_v1(jsonb_build_object(
    'registry_version',v_registry2,'identity_serializer_version','product-fact-proposition-identity-v2',
    'definitions',jsonb_build_array(
      jsonb_build_object('fact_key','pf5b1r2_boolean','value_type','boolean','definition_checksum',v_bool_checksum,'deprecated',false,'superseded_by_fact_key',null),
      jsonb_build_object('fact_key','pf5b1r2_enum','value_type','enum','definition_checksum',v_enum_checksum,'deprecated',false,'superseded_by_fact_key',null)
    )
  ));
  v_registry_payload := jsonb_build_object('registry_version',v_registry2,'registry_checksum',v_registry_checksum,'identity_serializer_version','product-fact-proposition-identity-v2','effective_at',null,'definitions',v_definitions);
  perform public.admin_publish_product_fact_registry_v1(v_actor,'pf5b1r2-registry-v2-publish',v_registry_payload);
  v_before := pg_temp.full_fingerprint();
  begin
    perform public.admin_confirm_product_fact_v1(v_actor,v_fixture->>'request_id',v_payload,v_preflight->>'payload_digest',v_preflight->>'prestate_digest');
    raise exception 'stale_registry_not_rejected';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate,v_message=message_text;
    if v_message='stale_registry_not_rejected' then raise; end if;
    perform pg_temp.assert_true(v_state='40001' and v_message='product_fact_confirmation_registry_stale','stale_registry_wrong_error');
  end;
  v_after := pg_temp.full_fingerprint();
  perform pg_temp.assert_true(v_before=v_after,'stale_registry_confirm_mutation');
  insert into pf5b1r2_results values ('stale_F_registry','PASS',jsonb_build_object('sqlstate',v_state,'message',v_message,'before',v_before,'after',v_after));

  -- Runtime security catalog.
  perform pg_temp.assert_true((
    select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in (
      'product_fact_registry_versions','product_fact_definition_snapshots','product_fact_subjects','product_evidence_sources',
      'product_evidence_source_subject_bindings','product_evidence_records','product_fact_instances','product_fact_evidence_links',
      'product_fact_confirmations','product_fact_current','product_fact_review_assignments','product_fact_review_events'
    ) and c.relrowsecurity
  )=12,'security_rls_not_12');

  perform pg_temp.assert_true((
    select count(*) from information_schema.role_table_grants
    where table_schema='public'
      and table_name in (
        'product_fact_registry_versions','product_fact_definition_snapshots','product_fact_subjects','product_evidence_sources',
        'product_evidence_source_subject_bindings','product_evidence_records','product_fact_instances','product_fact_evidence_links',
        'product_fact_confirmations','product_fact_current','product_fact_review_assignments','product_fact_review_events'
      )
      and grantee in ('PUBLIC','anon','authenticated','service_role')
      and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')
  )=0,'security_broad_table_write_grant');

  perform pg_temp.assert_true(
    has_function_privilege('service_role','public.admin_publish_product_fact_registry_v1(uuid,text,jsonb)','EXECUTE')
    and has_function_privilege('service_role','public.admin_register_product_fact_subject_v1(uuid,text,jsonb)','EXECUTE')
    and has_function_privilege('service_role','public.admin_ingest_product_fact_evidence_v1(uuid,text,jsonb)','EXECUTE')
    and has_function_privilege('service_role','public.admin_prepare_product_fact_review_v1(uuid,text,jsonb)','EXECUTE')
    and has_function_privilege('service_role','public.admin_preflight_product_fact_confirmation_v1(uuid,text,jsonb)','EXECUTE')
    and has_function_privilege('service_role','public.admin_confirm_product_fact_v1(uuid,text,jsonb,text,text)','EXECUTE'),
    'security_service_rpc_missing'
  );

  perform pg_temp.assert_true(
    not has_function_privilege('anon','public.admin_publish_product_fact_registry_v1(uuid,text,jsonb)','EXECUTE')
    and not has_function_privilege('authenticated','public.admin_publish_product_fact_registry_v1(uuid,text,jsonb)','EXECUTE')
    and not has_function_privilege('anon','public.admin_register_product_fact_subject_v1(uuid,text,jsonb)','EXECUTE')
    and not has_function_privilege('authenticated','public.admin_register_product_fact_subject_v1(uuid,text,jsonb)','EXECUTE')
    and not has_function_privilege('anon','public.admin_ingest_product_fact_evidence_v1(uuid,text,jsonb)','EXECUTE')
    and not has_function_privilege('authenticated','public.admin_ingest_product_fact_evidence_v1(uuid,text,jsonb)','EXECUTE')
    and not has_function_privilege('anon','public.admin_prepare_product_fact_review_v1(uuid,text,jsonb)','EXECUTE')
    and not has_function_privilege('authenticated','public.admin_prepare_product_fact_review_v1(uuid,text,jsonb)','EXECUTE')
    and not has_function_privilege('anon','public.admin_preflight_product_fact_confirmation_v1(uuid,text,jsonb)','EXECUTE')
    and not has_function_privilege('authenticated','public.admin_preflight_product_fact_confirmation_v1(uuid,text,jsonb)','EXECUTE')
    and not has_function_privilege('anon','public.admin_confirm_product_fact_v1(uuid,text,jsonb,text,text)','EXECUTE')
    and not has_function_privilege('authenticated','public.admin_confirm_product_fact_v1(uuid,text,jsonb,text,text)','EXECUTE'),
    'security_browser_rpc_exposed'
  );

  perform pg_temp.assert_true((
    select count(*) from pg_proc p
    where p.oid in (
      to_regprocedure('public.admin_publish_product_fact_registry_v1(uuid,text,jsonb)'),
      to_regprocedure('public.admin_register_product_fact_subject_v1(uuid,text,jsonb)'),
      to_regprocedure('public.admin_ingest_product_fact_evidence_v1(uuid,text,jsonb)'),
      to_regprocedure('public.admin_prepare_product_fact_review_v1(uuid,text,jsonb)'),
      to_regprocedure('public.admin_preflight_product_fact_confirmation_v1(uuid,text,jsonb)'),
      to_regprocedure('public.admin_confirm_product_fact_v1(uuid,text,jsonb,text,text)')
    ) and p.prosecdef
      and exists(select 1 from unnest(coalesce(p.proconfig,'{}'::text[])) cfg where cfg like 'search_path=%pg_temp%')
  )=6,'security_definer_search_path_invalid');

  perform pg_temp.assert_true(
    not has_function_privilege('service_role','public.product_fact_controlled_json_exact_keys_v1(jsonb,text[])','EXECUTE')
    and not has_function_privilege('service_role','public.product_fact_controlled_canonical_json_v1(jsonb)','EXECUTE')
    and not has_function_privilege('service_role','public.product_fact_controlled_sha256_json_v1(jsonb)','EXECUTE')
    and not has_function_privilege('service_role','public.product_fact_controlled_authority_rank_v1(text)','EXECUTE')
    and not has_function_privilege('service_role','public.product_fact_controlled_latest_registry_v1()','EXECUTE')
    and not has_function_privilege('service_role','public.product_fact_controlled_binding_is_current_v1(uuid)','EXECUTE')
    and not has_function_privilege('service_role','public.product_fact_controlled_build_preflight_v1(uuid,text,jsonb)','EXECUTE'),
    'security_internal_helper_exposed'
  );

  perform pg_temp.assert_true((
    select count(*) from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
    where p.oid in (
      to_regprocedure('public.admin_publish_product_fact_registry_v1(uuid,text,jsonb)'),
      to_regprocedure('public.admin_register_product_fact_subject_v1(uuid,text,jsonb)'),
      to_regprocedure('public.admin_ingest_product_fact_evidence_v1(uuid,text,jsonb)'),
      to_regprocedure('public.admin_prepare_product_fact_review_v1(uuid,text,jsonb)'),
      to_regprocedure('public.admin_preflight_product_fact_confirmation_v1(uuid,text,jsonb)'),
      to_regprocedure('public.admin_confirm_product_fact_v1(uuid,text,jsonb,text,text)')
    ) and acl.grantee=0 and acl.privilege_type='EXECUTE'
  )=0,'security_public_rpc_exposed');

  insert into pf5b1r2_results values ('runtime_security','PASS',jsonb_build_object('rls',12,'broad_write_grants',0,'external_service_execute',6,'browser_execute',0,'internal_service_execute',0));

  perform pg_temp.assert_true((select value#>>'{}' from pf5b1r2_context where key='legacy_before')=pg_temp.legacy_fingerprint(),'legacy_invariance_phase2_failed');
  insert into pf5b1r2_results values ('legacy_recommendation_invariance_final','PASS',jsonb_build_object('fingerprint',pg_temp.legacy_fingerprint()));
end;
$$;

select 'PF5B1R2_FINAL_JSON=' || jsonb_build_object(
  'phase','PF5B1R2_FULL_RUNTIME',
  'status','PASS',
  'tests',(select coalesce(jsonb_agg(jsonb_build_object('name',test_name,'status',status,'detail',detail) order by test_name),'[]'::jsonb) from pf5b1r2_results),
  'counts',jsonb_build_object(
    'registry',(select count(*) from public.product_fact_registry_versions),
    'definitions',(select count(*) from public.product_fact_definition_snapshots),
    'subjects',(select count(*) from public.product_fact_subjects),
    'sources',(select count(*) from public.product_evidence_sources),
    'bindings',(select count(*) from public.product_evidence_source_subject_bindings),
    'evidence',(select count(*) from public.product_evidence_records),
    'facts',(select count(*) from public.product_fact_instances),
    'links',(select count(*) from public.product_fact_evidence_links),
    'confirmations',(select count(*) from public.product_fact_confirmations),
    'current',(select count(*) from public.product_fact_current),
    'assignments',(select count(*) from public.product_fact_review_assignments),
    'review_events',(select count(*) from public.product_fact_review_events)
  ),
  'legacy_fingerprint',pg_temp.legacy_fingerprint()
)::text;
