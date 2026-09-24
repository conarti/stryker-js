<template>
  <p :title="title">{{ count + 1 }}</p>
</template>

<script setup>
const { title } = defineProps({ title: { type: String, default: 'hello' } });
const count = defineModel('count', { default: 0 });
</script>
