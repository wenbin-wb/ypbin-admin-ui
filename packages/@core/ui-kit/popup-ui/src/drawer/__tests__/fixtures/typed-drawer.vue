<script setup lang="ts">
import { useVbenDrawer } from '../../use-drawer';

interface TypedDrawerData {
  id: number;
  mode: 'edit' | 'view';
}

const [, drawerApi] = useVbenDrawer<null | TypedDrawerData>();

defineExpose({ drawerApi });
</script>

<template>
  <div />
</template>
