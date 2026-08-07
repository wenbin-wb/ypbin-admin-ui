<script setup lang="ts">
import { useVbenModal } from '../../use-modal';

interface TypedModalData {
  id: number;
  mode: 'edit' | 'view';
}

const [, modalApi] = useVbenModal<null | TypedModalData>();

defineExpose({ modalApi });
</script>

<template>
  <div />
</template>
