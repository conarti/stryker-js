<template>
  <section class="disclosure">
    <h2>{{ title }}</h2>
    <button type="button" @click="open = !open">
      {{ open ? 'Hide' : 'Show' }}
    </button>
    <p v-if="open">{{ body }}</p>
  </section>
</template>

<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false });

const title = 'Shipping details';
const body = 'Delivery takes two business days.';
</script>
