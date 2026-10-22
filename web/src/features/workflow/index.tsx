import { Plus } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState, LoadingState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { getWorkflowIndex } from '@/services/building-service';
import { BuildingPicker } from '@/features/buildings/components/BuildingPicker';
import { WorkflowDesignerCard } from './components/WorkflowDesignerCard';
import { WorkflowListCard } from './components/WorkflowListCard';

const WorkflowRulesPage = () => {
  const [params, setParams] = useSearchParams();
  const isEditor = params.get('view') === 'editor';
  const selectedId = params.get('b') ?? undefined;
  const isCreateMode = params.get('mode') === 'create';
  const query = useServiceQuery(['workflow', 'index'], getWorkflowIndex);

  if (query.isLoading) return <LoadingState rows={5} />;
  if (query.error || !query.data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const { buildings, workflows, roles, canConfigure } = query.data;
  const selected = workflows.find((item) => item.building.id === selectedId) ?? workflows[0];
  if (!selected) return <ErrorState error={new Error('Chưa có tòa nhà để cấu hình workflow.')} />;

  const openEditor = (buildingId: string, mode: 'create' | 'edit' = 'edit') => {
    setParams({ view: 'editor', b: buildingId, ...(mode === 'create' ? { mode } : {}) });
  };

  if (isEditor) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={isCreateMode ? 'Tạo workflow' : 'Chỉnh sửa workflow'}
          description="Thiết lập quy trình xử lý hồ sơ theo từng bước, vai trò phê duyệt và bước nghiệp vụ."
          backTo="/settings/workflow"
          backLabel="Danh sách workflow"
          actions={<BuildingPicker buildings={buildings} value={selected.building.id} onChange={(id) => openEditor(id)} className="w-full sm:w-72" />}
        />
        <WorkflowDesignerCard key={`${selected.building.id}-${selected.config.version}`} building={selected.building} config={selected.config} workflowTargets={workflows} roles={roles} canEdit={canConfigure} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Workflow Engine"
        description="Quản lý các workflow theo từng tòa nhà trước khi mở màn hình thiết kế chi tiết."
        actions={canConfigure ? <Button onClick={() => openEditor(buildings[0].id, 'create')}><Plus aria-hidden /> Thêm mới</Button> : null}
      />
      <WorkflowListCard items={workflows} onOpen={(buildingId) => openEditor(buildingId)} />
    </div>
  );
};

export default WorkflowRulesPage;
