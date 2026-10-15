import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { AssignmentRulesEditor } from '@/features/buildings/components/AssignmentRulesEditor';
import type { BuildingConfig, Building, AssignmentRule } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';
import { useReferenceData } from '@/hooks/useReferenceData';
import { toConfigPayload, toDraft } from '@/features/buildings/config-form';

interface WorkflowRulesCardProps {
  building: Building;
  config: BuildingConfig;
  canEdit: boolean;
}

/** Workflow assignment rules separated from general building settings. */
export const WorkflowRulesCard = ({ building, config, canEdit }: WorkflowRulesCardProps) => {
  const { data } = useReferenceData();
  const [rules, setRules] = useState<AssignmentRule[]>(() => toDraft(config).assignmentRules);
  const command = useCommand({ successMessage: 'Đã lưu quy tắc phân công workflow.' });
  const departments = (data?.departments ?? []).filter((department) => department.buildingIds.length === 0 || department.buildingIds.includes(building.id));
  const locations = data?.locations.filter((location) => location.buildingId === building.id && location.active !== false) ?? [];
  const save = () => {
    const draft = toDraft(config);
    void command.execute({
      subjectType: 'BUILDING',
      subjectId: building.id,
      expectedVersion: config.version,
      action: 'updateBuildingConfig',
      payload: toConfigPayload({ ...draft, assignmentRules: rules, approvalStepKeys: config.approvalStepKeys }, config.templateKey),
    });
  };

  return (
    <Card>
      <CardHeader title="Quy tắc phân công workflow" description="Thiết lập người xử lý theo bộ phận, vai trò và phạm vi vị trí của từng tòa nhà." />
      <CardBody className="space-y-5">
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-ink-2">Quy tắc phân công</h3>
            <p className="text-xs text-ink-3">Thiết lập bộ phận, vai trò và phạm vi vị trí cho từng tòa nhà.</p>
          </div>
        <AssignmentRulesEditor value={rules} departments={departments} locations={locations} disabled={!canEdit} onChange={setRules} />
        </section>
        {canEdit ? <div className="flex justify-end"><Button isLoading={command.isPending} onClick={save}>Lưu quy tắc</Button></div> : null}
      </CardBody>
    </Card>
  );
};
