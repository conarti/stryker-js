<template>
  <section :class="{ active: count > 0 }" :style="{ width: size + 'px' }">
    <h1>{{ title.toUpperCase() }}</h1>
    <p v-if="count > 10">many</p>
    <p v-else-if="count === 0 && !loading">none</p>
    <p v-show="count >= 1" v-bind:title="'Total ' + count">some</p>
    <button type="button" @click="count++" v-on:dblclick="reset(count - 1)">
      +
    </button>
    <button type="button" @click="actions.reset">reset</button>
    <ul>
      <li
        v-for="(item, index) in items.filter((i) => i.visible)"
        :key="item.id"
      >
        {{ index + 1 }}
      </li>
    </ul>
    <div v-html="html || '<br>'"></div>
    <div v-text="loading ? 'Loading' : title"></div>
  </section>
  <section>
    <input v-model="title" :ref="(el) => el && count + 1" v-focus="count + 2" />
    <List v-slot="{ item = 'none' }">{{ item }}</List>
    <p :[attributeName]="count + 3" v-memo="[count > 4]" :id></p>
    <p v-pre>{{ count + 5 }}</p>
    <p v-bind="{ title: count + 6 }" v-on="{ click: () => count + 7 }"></p>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const count = ref(0);
const loading = ref(false);
const title = ref('Items');
const size = 10;
const html = '';
const id = 'list';
const attributeName = 'title';
const items = ref([{ id: 1, visible: true }]);
const actions = { reset: () => (count.value = 0) };
const vFocus = { mounted: (el: HTMLElement) => el.focus() };

function reset(value: number) {
  count.value = value;
}
</script>
