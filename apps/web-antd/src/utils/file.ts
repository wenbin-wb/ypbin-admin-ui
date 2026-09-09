import { message } from 'ant-design-vue';

/**
 * 根据 Blob 数据下载文件
 * @param blob 二进制数据对象
 * @param fileName 文件名（包含后缀）
 */
export function downloadByBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** 后端统一响应结构（业务失败时 HTTP 恒 200，靠 code/message 区分） */
interface BizErrorBody {
  code?: unknown;
  message?: unknown;
}

/**
 * 从疑似 JSON 错误的文本中解析失败原因。
 * 仅当能解析出 code 且 code !== 200（业务失败）时返回 message，其余情况视为正常文件内容返回空串。
 */
function parseErrorText(text: string): string {
  if (!text.trimStart().startsWith('{')) return '';
  try {
    const body = JSON.parse(text) as BizErrorBody;
    if (
      body &&
      typeof body === 'object' &&
      body.code !== undefined &&
      body.code !== 200
    ) {
      return typeof body.message === 'string' ? body.message : '';
    }
  } catch {
    // 非 JSON 说明是正常二进制/文本文件内容
  }
  return '';
}

/**
 * 安全下载：后端业务失败（HTTP 恒 200，把统一 JSON 错误体当作 blob 返回）时不触发下载，
 * 而是解析失败文案并提示；只有确认为真实文件内容时才调用 downloadByBlob。
 * @param blob 下载响应体
 * @param fileName 文件名（包含后缀）
 * @param errorMsg 失败文案兜底（后端未返回 message 时使用）
 * @returns 是否真正触发了下载
 */
export async function downloadBlobSafe(
  blob: Blob,
  fileName: string,
  errorMsg?: string,
): Promise<boolean> {
  // Content-Type 明确为 JSON 时读全文解析；其余类型只嗅探开头片段，
  // 避免把大型 Excel 文件整体解码成文本。
  const isJsonType = blob.type.toLowerCase().includes('json');
  const sample = isJsonType ? blob : blob.slice(0, 512);
  const text = await sample.text();
  const errorText = text.trimStart().startsWith('{')
    ? parseErrorText(text)
    : '';
  if (errorText) {
    message.error(errorText);
    return false;
  }
  if (isJsonType) {
    // JSON 但不是业务失败体（后端异常契约），按下载失败处理，提示兜底文案
    if (errorMsg) message.error(errorMsg);
    return false;
  }
  downloadByBlob(blob, fileName);
  return true;
}
