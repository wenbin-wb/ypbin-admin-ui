/**
 * 带预览/裁剪/拖拽排序的上传组件适配。
 *
 * 在 Ant Design Vue Upload 之上补齐管理端高频能力：图片预览、头像裁剪、
 * 大小限制与拖拽排序；供 schema 表单的 `Upload` 组件注册使用。
 */
import type {
  UploadChangeParam,
  UploadFile,
  UploadProps,
} from 'ant-design-vue';

import type { Component, Ref } from 'vue';

import type { Sortable } from '@vben/hooks';
import type { Recordable } from '@vben/types';

import {
  computed,
  defineComponent,
  h,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  render,
  unref,
  watch,
} from 'vue';

import { VCropper } from '@vben/common-ui';
import { useSortable } from '@vben/hooks';
import { IconifyIcon } from '@vben/icons';
import { $t } from '@vben/locales';
import { isEmpty } from '@vben/utils';

import { message, Modal } from 'ant-design-vue';

import { Button, Image, PreviewGroup, Upload } from './async-components';

export type AdapterUploadProps = UploadProps & {
  aspectRatio?: string;
  crop?: boolean;
  draggable?: boolean;
  handleChange?: (event: UploadChangeParam) => void;
  maxSize?: number;
  onDragSort?: (oldIndex: number, newIndex: number) => void;
  onHandleChange?: (event: UploadChangeParam) => void;
};

const IMAGE_EXTENSIONS = new Set([
  'bmp',
  'gif',
  'jpeg',
  'jpg',
  'png',
  'svg',
  'webp',
]);

/** 检查是否为图片文件 */
function isImageFile(file: UploadFile): boolean {
  if (file.url) {
    try {
      const pathname = new URL(file.url, 'http://localhost').pathname;
      const ext = pathname.split('.').pop()?.toLowerCase();
      return ext ? IMAGE_EXTENSIONS.has(ext) : false;
    } catch {
      const ext = file.url?.split('.').pop()?.toLowerCase();
      return ext ? IMAGE_EXTENSIONS.has(ext) : false;
    }
  }
  if (!file.type) {
    const ext = file.name?.split('.').pop()?.toLowerCase();
    return ext ? IMAGE_EXTENSIONS.has(ext) : false;
  }
  return file.type.startsWith('image/');
}

/** 创建默认的上传按钮插槽 */
function createDefaultUploadSlots(listType: string, placeholder: string) {
  if (listType === 'picture-card') {
    return { default: () => placeholder };
  }
  return {
    default: () =>
      h(
        Button,
        {
          icon: h(IconifyIcon, {
            icon: 'ant-design:upload-outlined',
            class: 'mb-1 size-4',
          }),
        },
        () => placeholder,
      ),
  };
}

/** 获取文件的 Base64 */
function getBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.addEventListener('load', () => resolve(reader.result as string));
    reader.addEventListener('error', reject);
  });
}

/** 预览图片 */
async function previewImage(
  file: UploadFile,
  visible: Ref<boolean>,
  fileList: Ref<UploadProps['fileList']>,
) {
  // 非图片文件直接打开链接
  if (!isImageFile(file)) {
    const url = file.url || file.preview;
    if (url) {
      window.open(url, '_blank');
    } else {
      message.error($t('ui.formRules.previewWarning'));
    }
    return;
  }

  const [ImageComponent, PreviewGroupComponent] = await Promise.all([
    Image,
    PreviewGroup,
  ]);

  // 过滤图片文件并生成预览
  const imageFiles = (unref(fileList) || []).filter((f) => isImageFile(f));

  for (const imgFile of imageFiles) {
    if (!imgFile.url && !imgFile.preview && imgFile.originFileObj) {
      imgFile.preview = await getBase64(imgFile.originFileObj);
    }
  }

  const container = document.createElement('div');
  document.body.append(container);
  let isUnmounted = false;

  const currentIndex = imageFiles.findIndex((f) => f.uid === file.uid);

  const PreviewWrapper = {
    setup() {
      return () => {
        if (isUnmounted) return null;
        return h(
          PreviewGroupComponent,
          {
            class: 'hidden',
            preview: {
              visible: visible.value,
              current: currentIndex,
              onVisibleChange: (value: boolean) => {
                visible.value = value;
                if (!value) {
                  setTimeout(() => {
                    if (!isUnmounted && container) {
                      isUnmounted = true;
                      render(null, container);
                      container.remove();
                    }
                  }, 300);
                }
              },
            },
          },
          () =>
            imageFiles.map((imgFile) =>
              h(ImageComponent, {
                key: imgFile.uid,
                src: imgFile.url || imgFile.preview,
              }),
            ),
        );
      };
    },
  };

  render(h(PreviewWrapper), container);
}

/** 图片裁剪操作 */
function cropImage(file: File, aspectRatio: string | undefined) {
  return new Promise<Blob | string | undefined>((resolve, reject) => {
    const container = document.createElement('div');
    document.body.append(container);

    let isUnmounted = false;
    let objectUrl: null | string = null;

    const open = ref<boolean>(true);
    const cropperRef = ref<InstanceType<typeof VCropper> | null>(null);

    const closeModal = () => {
      open.value = false;
      setTimeout(() => {
        if (!isUnmounted && container) {
          if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
          }
          isUnmounted = true;
          render(null, container);
          container.remove();
        }
      }, 300);
    };

    const CropperWrapper = {
      setup() {
        return () => {
          if (isUnmounted) return null;
          if (!objectUrl) {
            objectUrl = URL.createObjectURL(file);
          }
          return h(
            Modal,
            {
              open: open.value,
              title: h('div', {}, [
                $t('ui.crop.title'),
                h(
                  'span',
                  {
                    class: `${aspectRatio ? '' : 'hidden'} ml-2 text-sm text-gray-400 font-normal`,
                  },
                  $t('ui.crop.titleTip', [aspectRatio]),
                ),
              ]),
              centered: true,
              width: 548,
              zIndex: 9999,
              keyboard: false,
              maskClosable: false,
              closable: false,
              cancelText: $t('common.cancel'),
              okText: $t('ui.crop.confirm'),
              destroyOnClose: true,
              onOk: async () => {
                const cropper = cropperRef.value;
                if (!cropper) {
                  reject(new Error('Cropper not found'));
                  closeModal();
                  return;
                }
                try {
                  const dataUrl = await cropper.getCropImage();
                  if (dataUrl) {
                    resolve(dataUrl);
                  } else {
                    reject(new Error($t('ui.crop.errorTip')));
                  }
                } catch {
                  reject(new Error($t('ui.crop.errorTip')));
                } finally {
                  closeModal();
                }
              },
              onCancel() {
                resolve('');
                closeModal();
              },
            },
            () =>
              h(VCropper, {
                ref: (ref) =>
                  (cropperRef.value = ref as InstanceType<
                    typeof VCropper
                  > | null),
                img: objectUrl as string,
                aspectRatio,
              }),
          );
        };
      },
    };

    render(h(CropperWrapper), container);
  });
}

/** 带预览功能的上传组件 */
export const withPreviewUpload = (): Component => {
  return defineComponent({
    name: Upload.name,
    emits: ['update:modelValue'],
    setup(
      props: Recordable<any>,
      {
        attrs,
        slots,
        emit,
      }: {
        attrs: Recordable<any>;
        emit: (event: string, ...args: unknown[]) => void;
        slots: Recordable<any>;
      },
    ) {
      const previewVisible = ref<boolean>(false);
      const placeholder = attrs?.placeholder || $t('ui.placeholder.upload');
      const listType = attrs?.listType || attrs?.['list-type'] || 'text';
      const fileList = ref<UploadProps['fileList']>(
        attrs?.fileList || attrs?.['file-list'] || [],
      );

      const maxSize = computed(() => attrs?.maxSize ?? attrs?.['max-size']);
      const aspectRatio = computed(
        () => attrs?.aspectRatio ?? attrs?.['aspect-ratio'],
      );

      const handleBeforeUpload = async (
        file: UploadFile,
        originFileList: Array<File>,
      ) => {
        // 文件大小限制
        if (maxSize.value && (file.size || 0) / 1024 / 1024 > maxSize.value) {
          message.error($t('ui.formRules.sizeLimit', [maxSize.value]));
          file.status = 'removed';
          return false;
        }

        // 图片裁剪处理
        if (
          attrs.crop &&
          !attrs.multiple &&
          originFileList[0] &&
          isImageFile(file)
        ) {
          file.status = 'removed';
          const blob = await cropImage(originFileList[0], aspectRatio.value);
          if (!blob) {
            throw new Error($t('ui.crop.errorTip'));
          }
          return blob;
        }

        return attrs.beforeUpload?.(file) ?? true;
      };

      const handleChange = (event: UploadChangeParam) => {
        try {
          attrs.handleChange?.(event);
          attrs.onHandleChange?.(event);
        } catch (error) {
          console.error(error);
        }
        fileList.value = event.fileList.filter(
          (file) => file.status !== 'removed',
        );
        emit(
          'update:modelValue',
          event.fileList?.length ? fileList.value : undefined,
        );
      };

      const handlePreview = async (file: UploadFile) => {
        previewVisible.value = true;
        await previewImage(file, previewVisible, fileList);
      };

      const renderUploadButton = () => {
        if (attrs.disabled) return {};
        return isEmpty(slots)
          ? createDefaultUploadSlots(listType, placeholder)
          : slots;
      };

      // 拖拽排序
      const draggable = computed(
        () => (attrs.draggable ?? false) && !attrs.disabled,
      );
      const uploadId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const sortableInstance = ref<null | Sortable>(null);

      const styleId = `upload-drag-style-${uploadId}`;

      function injectDragStyle() {
        if (!document.querySelector(`[id="${styleId}"]`)) {
          const style = document.createElement('style');
          style.id = styleId;
          style.textContent = `
            [data-upload-id="${uploadId}"] .ant-upload-list-item { cursor: move; }
            [data-upload-id="${uploadId}"] .ant-upload-list-item:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
          `;
          document.head.append(style);
        }
      }

      function removeDragStyle() {
        document.querySelector(`[id="${styleId}"]`)?.remove();
      }

      async function initSortable(retryCount = 0) {
        if (!draggable.value) return;

        injectDragStyle();
        await nextTick();
        await new Promise((resolve) => setTimeout(resolve, 100));

        const container = document.querySelector(
          `[data-upload-id="${uploadId}"] .ant-upload-list`,
        ) as HTMLElement;

        if (!container) {
          if (retryCount < 5) {
            setTimeout(() => initSortable(retryCount + 1), 200);
          }
          return;
        }

        const { initializeSortable } = useSortable(container, {
          animation: 300,
          delay: 400,
          delayOnTouchOnly: true,
          filter:
            '.ant-upload-select, .ant-upload-list-item-error, .ant-upload-list-item-uploading',
          onEnd: (evt) => {
            const { oldIndex, newIndex } = evt;
            if (
              oldIndex === undefined ||
              newIndex === undefined ||
              oldIndex === newIndex
            ) {
              return;
            }

            const list = [...(fileList.value || [])];
            const [movedItem] = list.splice(oldIndex, 1);
            if (movedItem) {
              list.splice(newIndex, 0, movedItem);
              fileList.value = list;
            }

            attrs.onDragSort?.(oldIndex, newIndex);
            emit('update:modelValue', fileList.value);
          },
        });

        sortableInstance.value = await initializeSortable();
      }

      // 监听表单值变化
      watch(
        () => attrs.modelValue,
        (res) => {
          fileList.value = res;
        },
      );

      onMounted(initSortable);
      onUnmounted(() => {
        sortableInstance.value?.destroy();
        removeDragStyle();
      });

      return () =>
        h(
          'div',
          { 'data-upload-id': uploadId, class: 'w-full' },
          h(
            Upload,
            {
              ...props,
              ...attrs,
              fileList: fileList.value,
              beforeUpload: handleBeforeUpload,
              onChange: handleChange,
              onPreview: handlePreview,
            },
            renderUploadButton(),
          ),
        );
    },
  });
};
