import { useLocation } from 'react-router';
import { AssistantInsight } from './AssistantInsight';
import { getAssistantContext } from './assistant-context';

/** Generic screen-level note for routes that do not yet have a data-specific insight block. */
export const AssistantRouteHint = () => {
  const { pathname, search } = useLocation();
  if (pathname === '/' || pathname.startsWith('/tasks') || pathname.startsWith('/maintenance/schedule') || pathname.startsWith('/assistant')) return null;
  const context = getAssistantContext(pathname);
  return (
    <div className="mb-4">
      <AssistantInsight
        context={context.shortLabel}
        summary={`Đang xem ${context.shortLabel.toLowerCase()} trong phạm vi quyền của bạn.`}
        details={`${context.description} Mọi thay đổi cần bạn xác nhận.`}
        sourceHref={`${pathname}${search}`}
        sourceLabel="Mở dữ liệu nguồn"
        suggestions={context.suggestions.slice(0, 2)}
      />
    </div>
  );
};
