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
