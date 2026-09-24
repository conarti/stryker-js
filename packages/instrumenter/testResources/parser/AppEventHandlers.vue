<template>
  <button @click="submit">submit</button>
  <button v-on:click="obj.submit">obj</button>
  <button @click="obj?.handler">optional</button>
  <button @click="(obj as any).handler">ts</button>
  <button @click="() => count++">arrow</button>
  <button @click="count++">inline</button>
  <button @click="first(); second()">multi</button>
  <button @click.prevent="submit">modifier</button>
</template>

<script setup lang="ts">
const count = 0;
const obj = { submit() {}, handler() {} };
function submit() {}
function first() {}
function second() {}
</script>
