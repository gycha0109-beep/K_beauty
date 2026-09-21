\set ON_ERROR_STOP on

do $test$
declare
  v_actor constant uuid := '92000000-0000-4000-8000-000000000001';
  v_product constant uuid := '00000000-0000-4000-8000-000000000301';
  v_subject uuid;
  v_other_subject uuid;
  v_registry constant text := 'trust-phase7d-relational-registry-v1';
  v_parent_fact constant text := 'contains_active';
  v_child_fact constant text := 'active_concentration';
  v_parent_definition jsonb;
  v_child_definition jsonb;
  v_parent_checksum text;
  v_child_checksum text;
  v_registry_checksum text;
  v_registry_payload jsonb;
  v_parent_prop text;
  v_parent_instance constant uuid := '87000000-0000-4000-8000-000000000001';
  v_parent_confirmation constant uuid := '88000000-0000-4000-8000-000000000001';
  v_source_digest text;
  v_candidate_digest text;
  v_claim jsonb := '{"claim":"3% hyaluronic acid"}'::jsonb;
  v_identity jsonb;
  v_plan jsonb;
  v_adopt jsonb;
  v_bad_prop text;
  v_bad_instance uuid;
begin
  select subject_id into v_subject
  from public.product_fact_research_tasks
  where id='82000000-0000-4000-8000-000000000001'::uuid;

  select subject_id into v_other_subject
  from public.product_fact_research_tasks
  where id='82000000-0000-4000-8000-000000000002'::uuid;

  v_parent_definition := jsonb_build_object(
    'fact_key',v_parent_fact,
    'registry_version',v_registry,
    'domain_scope',jsonb_build_array('treatment'),
    'value_type','entity_identifier',
    'allowed_values',null,
    'cardinality','many',
    'permitted_evidence_classes',jsonb_build_array('composition_identity','product_claim'),
    'relationship_schema',jsonb_build_object('subject_ref_required',false)
  );
  v_child_definition := jsonb_build_object(
    'fact_key',v_child_fact,
    'registry_version',v_registry,
    'domain_scope',jsonb_build_array('treatment'),
    'value_type','number_unit',
    'allowed_values',null,
    'unit_schema',jsonb_build_object('allowed_units',jsonb_build_array('percent','ppm','mg_per_g')),
    'cardinality','many',
    'permitted_evidence_classes',jsonb_build_array('product_claim'),
    'relationship_schema',jsonb_build_object(
      'subject_ref_required',true,
      'subject_ref_fact_key',v_parent_fact
    )
  );
  v_parent_checksum := public.product_fact_controlled_sha256_json_v1(v_parent_definition);
  v_child_checksum := public.product_fact_controlled_sha256_json_v1(v_child_definition);
  v_registry_checksum := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'registry_version',v_registry,
      'identity_serializer_version','product-fact-subject-identity-v1',
      'definitions',jsonb_build_array(
        jsonb_build_object('fact_key',v_child_fact,'value_type','number_unit','definition_checksum',v_child_checksum,'deprecated',false,'superseded_by_fact_key',null),
        jsonb_build_object('fact_key',v_parent_fact,'value_type','entity_identifier','definition_checksum',v_parent_checksum,'deprecated',false,'superseded_by_fact_key',null)
      )
    )
  );
  v_registry_payload := jsonb_build_object(
    'registry_version',v_registry,
    'registry_checksum',v_registry_checksum,
    'identity_serializer_version','product-fact-subject-identity-v1',
    'effective_at',null,
    'definitions',jsonb_build_array(
      jsonb_build_object('fact_key',v_child_fact,'value_type','number_unit','definition',v_child_definition,'definition_checksum',v_child_checksum,'deprecated',false,'superseded_by_fact_key',null),
      jsonb_build_object('fact_key',v_parent_fact,'value_type','entity_identifier','definition',v_parent_definition,'definition_checksum',v_parent_checksum,'deprecated',false,'superseded_by_fact_key',null)
    )
  );
  perform public.admin_publish_product_fact_registry_v1(v_actor,'trust-p7d-registry-0001',v_registry_payload);

  v_parent_prop := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'serializer_version','product-fact-proposition-pilot-v1',
      'subject_semantic_key',(select subject_semantic_key from public.product_fact_subjects where subject_id=v_subject),
      'registry_version',v_registry,
      'fact_key',v_parent_fact,
      'value_identity','hyaluronic_acid',
      'scope',jsonb_build_object('market','KR','variant','legacy-variant'),
      'qualifier','{}'::jsonb,
      'parent_proposition_key',null
    )
  );

  insert into public.product_fact_instances(
    fact_instance_id,subject_id,registry_version,fact_key,proposition_key,
    proposition_serializer_version,semantic_status,value_type,value_entity_identifier,
    market,region,locale,qualifier,parent_proposition_key,parent_fact_instance_id,
    authority_ceiling,fused_confidence,fusion_policy_version,fusion_input_digest
  ) values (
    v_parent_instance,v_subject,v_registry,v_parent_fact,v_parent_prop,
    'product-fact-proposition-pilot-v1','supported','entity_identifier','hyaluronic_acid',
    'KR',null,'ko-KR','{}'::jsonb,null,null,
    'product_specific_primary','high','trust-phase7d-fixture-parent-v1',repeat('a',64)
  );

  insert into public.product_fact_confirmations(
    confirmation_id,request_id,namespace,actor_user_id,payload_digest,prestate_digest,
    result_digest,result
  ) values (
    v_parent_confirmation,'trust-p7d-parent-confirm','fixture_parent_confirmation',
    v_actor,repeat('b',64),repeat('c',64),repeat('d',64),'{}'::jsonb
  );

  insert into public.product_fact_current(
    proposition_key,fact_instance_id,subject_id,confirmation_id
  ) values (v_parent_prop,v_parent_instance,v_subject,v_parent_confirmation);

  v_identity := jsonb_build_object('product_id',v_product,'market','KR','variant','legacy-variant');

  insert into public.product_fact_research_tasks(
    id,intake_id,product_id,subject_id,registry_version,fact_key,state,
    source_locator,source_content_digest
  ) values (
    '82000000-0000-4000-8000-000000000003',
    '81000000-0000-4000-8000-000000000001',
    v_product,v_subject,v_registry,v_child_fact,'EVIDENCE_CANDIDATE',
    'https://official.example.test/trust-phase4-fixture',null
  );

  v_source_digest := encode(extensions.digest(convert_to(jsonb_build_object(
    'source_binding_id','85000000-0000-4000-8000-000000000001'::uuid,
    'canonical_locator','https://official.example.test/trust-phase4-fixture',
    'publisher','fixture_official',
    'source_kind','brand_official_product_page',
    'market','KR','locale','ko-KR',
    'observed_claim',v_claim,
    'product_identity_observation',v_identity,
    'observation_version','trust-phase7d-relational-observation-v1'
  )::text,'UTF8'),'sha256'),'hex');

  update public.product_fact_research_tasks
  set source_content_digest=v_source_digest
  where id='82000000-0000-4000-8000-000000000003';

  insert into public.trust_source_observations(
    observation_id,research_task_id,product_id,subject_id,source_binding_id,
    canonical_locator,publisher,source_kind,market,region,locale,
    observed_claim,product_identity_observation,observation_version,
    digest_basis,source_content_digest,observed_at,fetched_at
  ) values (
    '83000000-0000-4000-8000-000000000003',
    '82000000-0000-4000-8000-000000000003',
    v_product,v_subject,'85000000-0000-4000-8000-000000000001',
    'https://official.example.test/trust-phase4-fixture','fixture_official',
    'brand_official_product_page','KR',null,'ko-KR',v_claim,v_identity,
    'trust-phase7d-relational-observation-v1',
    'frozen-first-party-observation-v1-not-live-page-bytes',v_source_digest,now(),now()
  );

  v_candidate_digest := encode(extensions.digest(convert_to(jsonb_strip_nulls(jsonb_build_object(
    'subject_id',v_subject,'registry_version',v_registry,'fact_key',v_child_fact,
    'normalized_value',jsonb_build_object('amount',3,'unit','percent'),
    'parent_proposition_key',v_parent_prop,
    'evidence_class','product_claim','support_direction','supports',
    'negative_admissibility','not_applicable','market','KR','region',null,
    'locale','ko-KR','qualifier','{}'::jsonb,'source_content_digest',v_source_digest
  ))::text,'UTF8'),'sha256'),'hex');

  insert into public.trust_evidence_candidates(
    candidate_id,research_task_id,observation_id,product_id,subject_id,
    registry_version,fact_key,normalized_value,parent_proposition_key,evidence_class,
    evidence_authority,confidence,support_direction,negative_admissibility,
    market,region,locale,qualifier,candidate_state,canonical_evidence_digest
  ) values (
    '84000000-0000-4000-8000-000000000003',
    '82000000-0000-4000-8000-000000000003',
    '83000000-0000-4000-8000-000000000003',
    v_product,v_subject,v_registry,v_child_fact,
    jsonb_build_object('amount',3,'unit','percent'),v_parent_prop,'product_claim',
    'product_specific_primary','high','supports','not_applicable',
    'KR',null,'ko-KR','{}'::jsonb,'READY',v_candidate_digest
  );

  update public.product_fact_research_tasks
  set source_observation_id='83000000-0000-4000-8000-000000000003',
      evidence_candidate_id='84000000-0000-4000-8000-000000000003'
  where id='82000000-0000-4000-8000-000000000003';

  v_plan := public.admin_preflight_trust_evidence_adoption_v1(
    v_actor,'84000000-0000-4000-8000-000000000003'
  );

  if v_plan->>'status' <> 'ready_for_explicit_confirmation'
    or v_plan #>> '{confirmation_payload,parent_proposition_key}' <> v_parent_prop
    or (v_plan #>> '{confirmation_payload,parent_fact_instance_id}')::uuid <> v_parent_instance
    or v_plan #> '{confirmation_payload,value_number}' <> '3'::jsonb
    or v_plan #>> '{confirmation_payload,value_unit}' <> 'percent' then
    raise exception 'phase7d_relational_positive_preflight_failed:%',v_plan;
  end if;

  v_adopt := public.admin_adopt_trust_evidence_candidate_v1(
    v_actor,'trust-p7d-relational-adopt-0001','84000000-0000-4000-8000-000000000003'
  );

  if v_adopt->>'status' <> 'ready_for_explicit_confirmation'
    or coalesce((v_adopt->>'automatic_confirmation')::boolean,true)
    or v_adopt #>> '{confirmation_payload,parent_proposition_key}' <> v_parent_prop
    or (v_adopt #>> '{confirmation_payload,parent_fact_instance_id}')::uuid <> v_parent_instance then
    raise exception 'phase7d_relational_adoption_failed:%',v_adopt;
  end if;

  if not exists (
    select 1 from public.product_evidence_records
    where evidence_id=(v_adopt->>'governed_evidence_id')::uuid
      and parent_proposition_key=v_parent_prop
      and proposition_value_identity is null
  ) then
    raise exception 'phase7d_relational_evidence_identity_failed';
  end if;

  -- Missing parent must fail closed.
  update public.trust_evidence_candidates
  set parent_proposition_key=null,
      canonical_evidence_digest=encode(extensions.digest(convert_to(jsonb_strip_nulls(jsonb_build_object(
        'subject_id',v_subject,'registry_version',v_registry,'fact_key',v_child_fact,
        'normalized_value',jsonb_build_object('amount',3,'unit','percent'),
        'parent_proposition_key',null,'evidence_class','product_claim',
        'support_direction','supports','negative_admissibility','not_applicable',
        'market','KR','region',null,'locale','ko-KR','qualifier','{}'::jsonb,
        'source_content_digest',v_source_digest
      ))::text,'UTF8'),'sha256'),'hex')
  where candidate_id='84000000-0000-4000-8000-000000000003';

  begin
    perform public.admin_preflight_trust_evidence_adoption_v1(
      v_actor,'84000000-0000-4000-8000-000000000003'
    );
    raise exception 'phase7d_missing_parent_not_blocked';
  exception when others then
    if sqlerrm not like '%trust_phase4_parent_proposition_required%' then raise; end if;
  end;

  -- Restore the valid parent, then remove Current: non-current parent must fail.
  update public.trust_evidence_candidates
  set parent_proposition_key=v_parent_prop,
      canonical_evidence_digest=v_candidate_digest
  where candidate_id='84000000-0000-4000-8000-000000000003';

  delete from public.product_fact_current where proposition_key=v_parent_prop;
  begin
    perform public.admin_preflight_trust_evidence_adoption_v1(
      v_actor,'84000000-0000-4000-8000-000000000003'
    );
    raise exception 'phase7d_noncurrent_parent_not_blocked';
  exception when others then
    if sqlerrm not like '%trust_phase4_parent_proposition_not_current%' then raise; end if;
  end;

  -- Wrong fact-key proposition on the same Subject must also fail.
  v_bad_prop := repeat('e',64);
  v_bad_instance := '87000000-0000-4000-8000-000000000002'::uuid;
  insert into public.product_fact_instances(
    fact_instance_id,subject_id,registry_version,fact_key,proposition_key,
    proposition_serializer_version,semantic_status,value_type,value_number,value_unit,
    market,region,locale,qualifier,authority_ceiling,fused_confidence,
    fusion_policy_version,fusion_input_digest
  ) values (
    v_bad_instance,v_subject,v_registry,v_child_fact,v_bad_prop,
    'product-fact-proposition-pilot-v1','supported','number_unit',1,'percent',
    'KR',null,'ko-KR','{}'::jsonb,'product_specific_primary','high',
    'trust-phase7d-fixture-bad-parent-v1',repeat('f',64)
  );
  insert into public.product_fact_confirmations(
    confirmation_id,request_id,namespace,actor_user_id,payload_digest,prestate_digest,
    result_digest,result
  ) values (
    '88000000-0000-4000-8000-000000000002','trust-p7d-bad-confirm','fixture_bad_confirmation',
    v_actor,repeat('1',64),repeat('2',64),repeat('3',64),'{}'::jsonb
  );
  insert into public.product_fact_current(proposition_key,fact_instance_id,subject_id,confirmation_id)
  values(v_bad_prop,v_bad_instance,v_subject,'88000000-0000-4000-8000-000000000002');

  update public.trust_evidence_candidates
  set parent_proposition_key=v_bad_prop,
      canonical_evidence_digest=encode(extensions.digest(convert_to(jsonb_strip_nulls(jsonb_build_object(
        'subject_id',v_subject,'registry_version',v_registry,'fact_key',v_child_fact,
        'normalized_value',jsonb_build_object('amount',3,'unit','percent'),
        'parent_proposition_key',v_bad_prop,'evidence_class','product_claim',
        'support_direction','supports','negative_admissibility','not_applicable',
        'market','KR','region',null,'locale','ko-KR','qualifier','{}'::jsonb,
        'source_content_digest',v_source_digest
      ))::text,'UTF8'),'sha256'),'hex')
  where candidate_id='84000000-0000-4000-8000-000000000003';

  begin
    perform public.admin_preflight_trust_evidence_adoption_v1(
      v_actor,'84000000-0000-4000-8000-000000000003'
    );
    raise exception 'phase7d_wrong_parent_fact_not_blocked';
  exception when others then
    if sqlerrm not like '%trust_phase4_parent_proposition_not_current%' then raise; end if;
  end;

  -- No child confirmation was created by adoption.
  if exists (
    select 1 from public.product_fact_confirmations
    where request_id='trust-p7d-relational-adopt-0001:confirm'
  ) then
    raise exception 'phase7d_automatic_confirmation_detected';
  end if;
end;
$test$;

select 'TRUST_PHASE7D_RELATIONAL_FACT_RUNTIME_VERIFIED';
