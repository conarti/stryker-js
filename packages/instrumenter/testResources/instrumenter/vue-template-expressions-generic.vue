<template>
  <p v-if="items.length > 0">{{ items[0] ?? fallback }}</p>
</template>

<script setup lang="ts" generic="T">
const props = defineProps<{ items: T[]; fallback: T }>();
const { items, fallback } = props;
</script>
