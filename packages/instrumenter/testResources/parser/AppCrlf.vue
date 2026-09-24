<template>
  <p v-if="visible">
    {{ message }}
  </p>
</template>

<script setup>
const visible = true;
const message = "hello";
</script>
