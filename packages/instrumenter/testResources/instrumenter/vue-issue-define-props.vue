<template>
  <div class="counter">
    <span>{{ props.label }}</span>
    <em v-if="!props.disabled">{{ props.count }}</em>
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  label: { type: String, default: 'Items in cart' },
  count: { type: Number, default: 0 },
  disabled: { type: Boolean, default: false },
});
</script>
