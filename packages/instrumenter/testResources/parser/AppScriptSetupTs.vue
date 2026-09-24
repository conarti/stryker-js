<template>
  <p v-if="count > 0">{{ (count as number) + 1 }}</p>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const count = ref<number>(0);
</script>
