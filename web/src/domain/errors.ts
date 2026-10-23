export const ERROR_CODE = {
  /** Missing/expired session: the caller must sign in again (HTTP 401). */
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  CONFLICT: 'CONFLICT',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;
export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

export type FieldErrors = Record<string, string>;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors?: FieldErrors;

  constructor(code: ErrorCode, message: string, fieldErrors?: FieldErrors) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export const forbidden = (message = 'Bạn không có quyền thực hiện thao tác này.'): AppError =>
  new AppError(ERROR_CODE.FORBIDDEN, message);

export const unauthorized = (message = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'): AppError =>
  new AppError(ERROR_CODE.UNAUTHORIZED, message);

export const notFound = (message = 'Không tìm thấy dữ liệu hoặc dữ liệu ngoài phạm vi của bạn.'): AppError =>
  new AppError(ERROR_CODE.NOT_FOUND, message);

export const invalidTransition = (message: string): AppError =>
  new AppError(ERROR_CODE.INVALID_TRANSITION, message);

export const conflict = (
  message = 'Dữ liệu đã được thay đổi ở nơi khác. Vui lòng tải lại trước khi thao tác.',
): AppError => new AppError(ERROR_CODE.CONFLICT, message);

export const validationError = (fieldErrors: FieldErrors, message = 'Dữ liệu chưa hợp lệ.'): AppError =>
  new AppError(ERROR_CODE.VALIDATION_ERROR, message, fieldErrors);

/** Throws VALIDATION_ERROR when the collected map is not empty. */
export const assertNoFieldErrors = (fieldErrors: FieldErrors): void => {
  const keys = Object.keys(fieldErrors);
  if (keys.length === 0) return;
  throw validationError(fieldErrors, fieldErrors[keys[0]]);
};

export const isAppError = (error: unknown): error is AppError => error instanceof AppError;

export const toErrorMessage = (error: unknown): string => {
  if (isAppError(error)) return error.message;
  if (error instanceof Error && error.name === 'QuotaExceededError') {
    return 'Bộ nhớ trình duyệt đã đầy. Dữ liệu trước thao tác vẫn được giữ.';
  }
  return 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.';
};
