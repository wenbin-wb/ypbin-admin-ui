/**
 * 从未知异常中提取可展示给用户的失败原因。
 *
 * 优先取后端业务文案（AxiosError 响应体中的 message），其次取异常自身的 message，
 * 兜底用调用方提供的 fallback 文案；避免在业务代码里写 `catch (error: any)`。
 */
export function extractErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error) {
    return error;
  }
  if (error instanceof Error) {
    const axiosLike = error as Error & {
      data?: { message?: unknown };
      response?: { data?: { message?: unknown } };
    };
    const bizMessage =
      axiosLike.response?.data?.message ?? axiosLike.data?.message;
    if (typeof bizMessage === 'string' && bizMessage) {
      return bizMessage;
    }
    if (error.message) {
      return error.message;
    }
  } else if (error && typeof error === 'object') {
    const record = error as { data?: { message?: unknown }; message?: unknown; };
    if (typeof record.message === 'string' && record.message) {
      return record.message;
    }
    const nested = record.data?.message;
    if (typeof nested === 'string' && nested) {
      return nested;
    }
  }
  return fallback;
}
