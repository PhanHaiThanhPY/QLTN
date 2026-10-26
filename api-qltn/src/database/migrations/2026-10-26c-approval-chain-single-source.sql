-- BG-01 (ADR-0001 §4.7, SPEC RM-S2 BR-10/BR-11): the PROPOSAL stage becomes the only source of the proposal
-- approval chain. Configurations whose stored chain (approval_step_keys, what the engine runs) differs from their
-- PROPOSAL stage keep the running chain: the PROPOSAL stage is rewritten to it (PD-07 Q9). Every building changed,
-- and every building whose chain has no BQT step, gets one audit row `migrateApprovalChain`. Repair records keep
-- their own snapshot and are not touched.
-- Idempotent: a second run finds nothing out of sync and the "thiếu BQT" rows already written.

DO $$
DECLARE
  config        record;
  proposal      jsonb;
  stored_keys   jsonb;
  out_of_sync   boolean;
  missing_board boolean;
  new_version   integer;
  note          text;
BEGIN
  FOR config IN SELECT building_id, approval_step_keys, workflow_stages, version FROM building_configs LOOP
    SELECT stage INTO proposal
    FROM jsonb_array_elements(config.workflow_stages) AS stage
    WHERE stage->>'key' = 'PROPOSAL';

    stored_keys := to_jsonb(config.approval_step_keys);
    out_of_sync := proposal IS NOT NULL AND proposal->'approvalStepKeys' IS DISTINCT FROM stored_keys;
    missing_board := NOT ('BOARD' = ANY (config.approval_step_keys));

    CONTINUE WHEN NOT out_of_sync AND NOT (
      missing_board AND NOT EXISTS (
        SELECT 1 FROM audit_events
        WHERE subject_type = 'BUILDING' AND subject_id = config.building_id AND action = 'migrateApprovalChain'
      )
    );

    new_version := config.version;
    note := 'Chuỗi duyệt tờ trình: ' || array_to_string(config.approval_step_keys, ' → ');
    IF out_of_sync THEN
      -- Rewrite the PROPOSAL stage; a business step bound to a removed step is re-bound to the chain's first step.
      UPDATE building_configs
      SET workflow_stages = (
            SELECT jsonb_agg(
              CASE WHEN stage->>'key' = 'PROPOSAL' THEN
                jsonb_set(
                  jsonb_set(stage, '{approvalStepKeys}', stored_keys),
                  '{stepBindings}',
                  COALESCE((
                    SELECT jsonb_agg(
                      CASE
                        WHEN binding ? 'approvalStepKey' AND NOT (stored_keys ? (binding->>'approvalStepKey'))
                          THEN jsonb_set(binding, '{approvalStepKey}', stored_keys->0)
                        ELSE binding
                      END
                      ORDER BY ordinality
                    )
                    FROM jsonb_array_elements(stage->'stepBindings') WITH ORDINALITY AS b(binding, ordinality)
                  ), '[]'::jsonb)
                )
              ELSE stage END
              ORDER BY ordinality
            )
            FROM jsonb_array_elements(workflow_stages) WITH ORDINALITY AS s(stage, ordinality)
          ),
          version = version + 1,
          updated_at = now()
      WHERE building_id = config.building_id
      RETURNING version INTO new_version;
      note := 'Đồng bộ giai đoạn Tờ trình theo chuỗi đang chạy: '
        || COALESCE((SELECT string_agg(value, ' → ') FROM jsonb_array_elements_text(proposal->'approvalStepKeys')), '')
        || ' ⇒ ' || array_to_string(config.approval_step_keys, ' → ');
    END IF;
    IF missing_board THEN
      note := note || '. Thiếu BQT: quản trị cần áp mẫu AQUA hoặc STANDARD.';
    END IF;

    INSERT INTO audit_events (subject_type, subject_id, building_id, action, actor_id, entity_version, reason)
    VALUES ('BUILDING', config.building_id, config.building_id, 'migrateApprovalChain', NULL, new_version, note);
  END LOOP;
END $$;
