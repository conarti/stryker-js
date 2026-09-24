<template>
  <ul>
    <li v-for="item in items" :key="String(item)">{{ render(item) }}</li>
  </ul>
</template>

<script setup lang="ts" generic="T">
const { items, render } = defineProps<{ items: T[]; render: (item: T) => string }>();
</script>
