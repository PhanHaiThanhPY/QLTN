import { Link } from 'react-router';
import { EmptyState } from '@/components/common/States';

export const NotFoundPage = () => (
  <EmptyState
    title="Không tìm thấy trang"
    description="Đường dẫn không tồn tại hoặc nằm ngoài phạm vi tài khoản của bạn."
    action={
      <Link to="/" className="text-sm font-medium text-accent hover:underline">
        Về Tổng quan
      </Link>
    }
  />
);
