import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { AiApi } from '#/api/ai';

import { onUnmounted, ref } from 'vue';

import { message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  batchUploadDocuments,
  deleteDocument,
  getDocumentList,
  retryDocument,
} from '#/api/ai';
import { $t } from '#/locales';
import { extractErrorMessage } from '#/utils/error';

/**
 * 知识库文档列表域：分页查询、关键词过滤、批量上传、删除/重试与"处理中"轮询。
 *
 * 依赖调用方注入当前知识库（文档弹窗打开期间才有值）与文档数变化后的联动刷新。
 */
export function useDocumentsGrid(deps: {
  getKb: () => AiApi.KnowledgeBase | null | undefined;
  onReload: () => void;
}) {
  const docUploading = ref(false);
  const docKeyword = ref('');
  const isPolling = ref(false);

  // 轮询：有"处理中"文档时每 3 秒静默刷新（绕过 grid 代理，避免反复触发 loading）
  let lastPage = { currentPage: 1, pageSize: 20 };
  let pollTimer: null | ReturnType<typeof setInterval> = null;

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(async () => {
      const kb = deps.getKb();
      if (!kb) return;
      // 保持当前分页参数，仅静默替换数据
      const res = await getDocumentList(kb.id, {
        page: lastPage.currentPage,
        pageSize: lastPage.pageSize,
        keyword: docKeyword.value.trim() || undefined,
      });
      gridApi.grid?.loadData(res.items);
      if (!res.items.some((d) => d.status === 0)) stopPolling();
    }, 3000);
    isPolling.value = true;
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    isPolling.value = false;
  }

  const [Grid, gridApi] = useVbenVxeGrid({
    gridOptions: {
      columns: [
        {
          field: 'filename',
          title: $t('page.ai.knowledge.filename'),
          minWidth: 220,
          showOverflow: true,
          slots: { default: 'filename' },
        },
        {
          field: 'fileSize',
          title: $t('page.ai.knowledge.size'),
          minWidth: 90,
          slots: { default: 'size' },
        },
        {
          field: 'chunkCount',
          title: $t('page.ai.knowledge.chunkCount'),
          minWidth: 80,
          formatter: ({ cellValue }) =>
            cellValue > 0 ? String(cellValue) : '-',
        },
        {
          field: 'status',
          title: $t('page.ai.knowledge.status'),
          minWidth: 100,
          slots: { default: 'status' },
        },
        {
          field: 'createTime',
          title: $t('common.createTime'),
          minWidth: 160,
        },
        {
          align: 'center',
          field: 'operation',
          fixed: 'right',
          slots: { default: 'action' },
          title: $t('common.action'),
          minWidth: 90,
        },
      ],
      height: 'auto',
      proxyConfig: {
        ajax: {
          query: async ({ page }) => {
            lastPage = {
              currentPage: page.currentPage,
              pageSize: page.pageSize,
            };
            const kb = deps.getKb();
            if (!kb) return { items: [], total: 0 };
            const res = await getDocumentList(kb.id, {
              page: page.currentPage,
              pageSize: page.pageSize,
              keyword: docKeyword.value.trim() || undefined,
            });
            // 有处理中的文档则轮询，全部就绪/失败则停止
            const hasProcessing = res.items.some((d) => d.status === 0);
            if (hasProcessing) startPolling();
            else stopPolling();
            return { items: res.items, total: res.total };
          },
        },
      },
      rowConfig: { keyField: 'id' },
      toolbarConfig: { custom: true, export: false, refresh: true, zoom: true },
    } as VxeTableGridOptions<AiApi.KbDocument>,
  });

  // 多选文件 → 统一调批量上传接口；before-upload 返回 false 阻止单选自动上传
  const pendingFiles: File[] = [];
  let batchTimer: null | ReturnType<typeof setTimeout> = null;

  function onSelectFile(file: File) {
    pendingFiles.push(file);
    if (batchTimer) clearTimeout(batchTimer);
    batchTimer = setTimeout(() => {
      const files = pendingFiles.splice(0);
      if (files.length > 0) {
        doBatchUpload(files);
      }
    }, 300);
    return false;
  }

  async function doBatchUpload(files: File[]) {
    const kb = deps.getKb();
    if (!kb) return;
    docUploading.value = true;
    try {
      const docs = await batchUploadDocuments(kb.id, files);
      message.success(
        $t('page.ai.knowledge.uploadSuccess').replace(
          '{count}',
          String(docs.length),
        ),
      );
      gridApi.query();
      deps.onReload();
    } catch (error) {
      message.error(extractErrorMessage(error, $t('common.requestFailed')));
    } finally {
      docUploading.value = false;
    }
  }

  function onDeleteDoc(row: AiApi.KbDocument) {
    const kb = deps.getKb();
    if (!kb) return;
    deleteDocument(kb.id, row.id).then(() => {
      message.success($t('common.success'));
      gridApi.query();
      deps.onReload();
    });
  }

  function onRetryDoc(row: AiApi.KbDocument) {
    const kb = deps.getKb();
    if (!kb) return;
    retryDocument(kb.id, row.id)
      .then(() => {
        message.success($t('common.success'));
        gridApi.query();
      })
      .catch((error) => {
        const reason = extractErrorMessage(error, '');
        message.error(reason || $t('page.ai.knowledge.retryFail'));
      });
  }

  function statusTag(status: number) {
    switch (status) {
      case 0: {
        return {
          color: 'processing' as const,
          text: $t('page.ai.knowledge.processing'),
        };
      }
      case 1: {
        return {
          color: 'success' as const,
          text: $t('page.ai.knowledge.ready'),
        };
      }
      default: {
        return {
          color: 'error' as const,
          text: $t('page.ai.knowledge.failed'),
        };
      }
    }
  }

  function formatSize(bytes: number) {
    if (!bytes) return '-';
    const k = 1024;
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / k ** i).toFixed(1)} ${units[i] ?? 'B'}`;
  }

  onUnmounted(stopPolling);

  return {
    docKeyword,
    docUploading,
    formatSize,
    gridApi,
    Grid,
    isPolling,
    onDeleteDoc,
    onRetryDoc,
    onSelectFile,
    statusTag,
    stopPolling,
  };
}
