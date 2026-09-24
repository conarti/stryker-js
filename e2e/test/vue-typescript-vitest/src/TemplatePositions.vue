<template>
  <section>
    <h2 class="title">{{ title.toUpperCase() }}</h2>
    <p v-if="count > 0" class="positive">positive</p>
    <p v-else-if="count < 0" class="negative">negative</p>
    <p v-show="!collapsed" class="details">details</p>
    <p class="amount" v-text="count === 1 ? 'item' : 'items'"></p>
    <p class="state" :class="{ active: count !== 0 }">state</p>
    <ul>
      <li v-for="item in items.slice(0, 3)" :key="item">{{ item }}</li>
    </ul>
    <button @click="count++">increment</button>
  </section>
</template>
<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{ title: string; start: number; items: string[] }>();

const count = ref(props.start);
const collapsed = ref(true);
</script>
