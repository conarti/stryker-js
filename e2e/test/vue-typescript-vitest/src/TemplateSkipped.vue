<template>
  <div v-bind="extraAttributes" v-on="{ focusin: onFocus }">
    <input
      v-model="text"
      :ref="text.length > 3 ? 'long' : 'short'"
      v-highlight="text.length > 3 && !disabled"
    />
    <span
      :key="text.length > 0 ? 'filled' : 'empty'"
      :[attributeName]="text.length > 0 ? 'filled' : 'empty'"
      :title
      @[eventName]="text = text.length > 0 ? '' : 'reset'"
      >skipped</span
    >
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  title: string;
  disabled: boolean;
  attributeName: string;
  eventName: string;
  extraAttributes: Record<string, string>;
  onFocus: () => void;
}>();

const text = ref('hello');
</script>
