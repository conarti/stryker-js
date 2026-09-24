<template>
  <label class="field">
    <span>{{ label }}</span>
    <input v-if="editable" :value="value" type="text" />
    <span v-else>{{ value }}</span>
  </label>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });

const label = 'Recipient name';
const editable = true;
const value = 'Jane Doe';
</script>
