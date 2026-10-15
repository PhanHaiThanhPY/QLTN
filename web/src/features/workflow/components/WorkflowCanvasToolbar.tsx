import { Eye, Plus, Redo2, Undo2, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { WorkflowStageConfig, WorkflowStageKey } from '@/domain/types';
import { cn } from '@/lib/cn';

interface WorkflowCanvasToolbarProps {
  stages: readonly WorkflowStageConfig[];
  selectedStageKey: WorkflowStageKey;
  currentStage?: WorkflowStageConfig;
  canUndo: boolean;
  canRedo: boolean;
  canEdit: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onPreview: () => void;
  onAdd: () => void;
  onStageChange: (key: WorkflowStageKey) => void;
}

/** Undo/redo, preview, add-step actions and the stage switcher above the canvas. */
export const WorkflowCanvasToolbar = ({
  stages,
  selectedStageKey,
  currentStage,
  canUndo,
  canRedo,
  canEdit,
  onUndo,
  onRedo,
  onPreview,
  onAdd,
  onStageChange,
}: WorkflowCanvasToolbarProps) => (
  <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex overflow-hidden rounded-lg border border-line bg-surface">
        <Button variant="ghost" size="icon-sm" aria-label="Hoàn tác" disabled={!canUndo} onClick={onUndo}><Undo2 /></Button>
        <Button variant="ghost" size="icon-sm" aria-label="Làm lại" disabled={!canRedo} onClick={onRedo}><Redo2 /></Button>
      </div>
      <span className="mr-auto text-xs text-ink-3">Chọn giai đoạn để cấu hình riêng từng phần của quy trình.</span>
      <Button variant="outline" size="sm" onClick={onPreview}><Eye /> Xem trước</Button>
      <Button size="sm" disabled={!canEdit} onClick={onAdd}><Plus /> Thêm bước duyệt</Button>
    </div>
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {stages.filter((stage) => stage.enabled).map((stage) => (
        <button key={stage.key} type="button" onClick={() => onStageChange(stage.key)} className={cn('rounded-lg border px-3 py-2.5 text-left transition', selectedStageKey === stage.key ? 'border-accent bg-accent-soft/60 ring-2 ring-accent/10' : 'border-line bg-surface hover:border-accent/50')}>
          <span className="flex items-center gap-2 text-xs font-semibold text-ink"><span className={cn('flex size-6 items-center justify-center rounded-md', selectedStageKey === stage.key ? 'bg-accent text-white' : 'bg-surface-3 text-ink-2')}><Workflow className="size-3.5" aria-hidden /></span>{stage.label}</span>
          <span className="mt-1 block text-2xs text-ink-3">{stage.approvalStepKeys.length} bước phê duyệt</span>
        </button>
      ))}
    </div>
    {currentStage ? <div className="rounded-lg border border-line bg-surface px-3 py-2.5"><p className="text-xs font-semibold text-ink">{currentStage.label}</p><p className="mt-0.5 text-xs text-ink-2">{currentStage.description}</p></div> : null}
  </div>
);
