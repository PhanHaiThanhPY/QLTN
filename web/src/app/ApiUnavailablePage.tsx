import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';

/**
 * Stand-in for modules that still read the IndexedDB demo data (plan decision D2).
 * Reachable by deep link in api mode; the menu hides them.
 */
export const ApiUnavailablePage = () => (
  <div>
    <PageHeader
      title="Chức năng này chưa nối API"
      description="Ứng dụng đang chạy với dữ liệu thật từ api-qltn (VITE_DATA_SOURCE=api)."
      breadcrumbs={[{ label: 'Chưa nối API' }]}
    />
    <Notice tone="info" title="Module đang được chuyển sang API">
      Màn hình này vẫn dùng dữ liệu mô phỏng trong trình duyệt nên tạm ẩn khi chạy dữ liệu thật. Vui lòng dùng nhóm menu
      Hệ thống hoặc Quản trị; các module còn lại sẽ được nối ở đợt tiếp theo.
    </Notice>
  </div>
);
