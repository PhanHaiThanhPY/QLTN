// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

const Boom = (): never => {
  throw new Error('render failed');
};

describe('ErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('should render the Vietnamese fallback with a reload button when a child throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert').textContent).toContain('Đã xảy ra lỗi ngoài ý muốn');
    expect(screen.getByRole('button', { name: 'Tải lại trang' })).toBeTruthy();
    expect(consoleError).toHaveBeenCalledWith('Unhandled render error:', expect.any(Error), expect.anything());
  });

  it('should render children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>Nội dung</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText('Nội dung')).toBeTruthy();
  });
});
