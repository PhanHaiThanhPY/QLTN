import { ArrowDown, CheckCircle2, Maximize2, Play, Plus, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ApprovalStepKey, BusinessWorkflowStepKey } from '@/domain/constants';
import type { WorkflowApprovalStep, WorkflowStepBinding } from '@/domain/types';
import { stepFor } from '../workflow-designer-meta';
import { WorkflowBusinessStep } from './WorkflowBusinessStep';
import { WorkflowFixedNode } from './WorkflowFixedNode';
import { WorkflowStep } from './WorkflowStep';

interface WorkflowCanvasProps {
  steps: ApprovalStepKey[];
  approvalSteps: readonly WorkflowApprovalStep[];
  stepBindings: WorkflowStepBinding[];
  selectedIndex: number | null;
  disabled: boolean;
  zoom: number;
  onZoomChange: (value: number) => void;
  onSelect: (index: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (index: number) => void;
  onRemoveBusinessStep: (key: BusinessWorkflowStepKey) => void;
}

/** Vertical flow: start node, business steps, approval steps and the end node. */
export const WorkflowCanvas = ({
  steps,
  approvalSteps,
  stepBindings,
  selectedIndex,
  disabled,
  zoom,
  onZoomChange,
  onSelect,
  onMove,
  onRemove,
  onRemoveBusinessStep,
}: WorkflowCanvasProps) => (
  <div className="relative min-h-[28rem] max-h-[34rem] overflow-auto rounded-xl border border-line bg-[radial-gradient(circle_at_1px_1px,#d6e7f1_1px,transparent_0)] [background-size:18px_18px]">
    <div className="absolute left-2 top-2 z-20 flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
      <Button variant="ghost" size="icon-sm" aria-label="Phóng to canvas" onClick={() => onZoomChange(Math.min(1.18, zoom + 0.08))}><Plus /></Button>
      <Button variant="ghost" size="icon-sm" aria-label="Thu nhỏ canvas" onClick={() => onZoomChange(Math.max(0.82, zoom - 0.08))}><ZoomOut /></Button>
      <Button variant="ghost" size="icon-sm" aria-label="Vừa khung canvas" onClick={() => onZoomChange(1)}><Maximize2 /></Button>
    </div>
    <div className="absolute bottom-6 left-1/2 top-6 w-px -translate-x-1/2 bg-line-2" aria-hidden />
    <div className="relative flex min-h-[28rem] flex-col items-center justify-center gap-1.5 px-10 py-6 transition-transform duration-200" style={{ transform: `scale(${zoom})` }}>
      <WorkflowFixedNode icon={Play} label="Bắt đầu" description="Điểm hệ thống" tone="good" />
      {stepBindings.length > 0 || steps.length > 0 ? <ArrowDown className="size-4 text-ink-3" aria-hidden /> : null}
      {stepBindings.map((binding) => <WorkflowBusinessStep key={binding.businessStepKey} binding={binding} approvalSteps={approvalSteps} disabled={disabled} onRemove={() => onRemoveBusinessStep(binding.businessStepKey)} />)}
      {stepBindings.length > 0 && steps.length > 0 ? <ArrowDown className="size-4 text-ink-3" aria-hidden /> : null}
      {steps.map((key, index) => {
        const step = stepFor(key, approvalSteps);
        return <WorkflowStep key={`${key}-${index}`} step={step} index={index} selected={selectedIndex === index} disabled={disabled} first={index === 0} last={index === steps.length - 1} onSelect={() => onSelect(index)} onMove={(direction) => onMove(index, direction)} onRemove={() => onRemove(index)} />;
      })}
      {steps.length === 0 && stepBindings.length === 0 ? <div className="z-10 max-w-xs rounded-xl border border-dashed border-accent/40 bg-surface px-4 py-5 text-center text-xs text-ink-2">Thêm một bước từ thư viện để bắt đầu thiết kế.</div> : null}
      {steps.length > 0 || stepBindings.length > 0 ? <ArrowDown className="size-4 text-ink-3" aria-hidden /> : null}
      <WorkflowFixedNode icon={CheckCircle2} label="Hoàn tất" description="Hệ thống đóng workflow" tone="accent" />
    </div>
  </div>
);
