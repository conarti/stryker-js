<template>
  <button @click="submit">submit</button>
  <button @click="actions.submit">member</button>
  <button @click="actions?.submit">optional member</button>
  <button @click="actions!.submit">non null member</button>
  <button @click="() => count++">arrow</button>
  <button @click="async () => await save()">async arrow</button>
  <button @click="count++">inline</button>
  <button @click="select(count)">call</button>
  <button @click="handle($event)">event</button>
  <button @click="count++; submit()">statements</button>
  <button @click.prevent="actions.submit">prevent</button>
  <input @keyup.enter="submit" />
  <ul>
    <li v-for="item in items" :key="item.id">
      <button @click="item.remove">remove</button>
    </li>
  </ul>
  <Transition @after-enter="actions.done"><p v-if="count">shown</p></Transition>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const count = ref(0);
const items = ref([{ id: 1, remove: () => undefined }]);
const actions = { submit: () => undefined, done: () => undefined };

function submit() {
  count.value = 0;
}
async function save() {
  count.value = 1;
}
function select(value: number) {
  count.value = value;
}
function handle(event: Event) {
  count.value = event.timeStamp;
}
</script>
