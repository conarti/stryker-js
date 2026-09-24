<template>
  <div>
    <button class="identifier" @click="submit">identifier</button>
    <button class="member" @click="form.submit">member</button>
    <button class="optional" @click="maybeForm?.submit">optional</button>
    <button class="non-null" @click="form!.submit">non null</button>
    <button class="arrow" @click="() => count++">arrow</button>
    <button class="async" @click="async () => await save()">async</button>
    <button class="block" @click="() => { count += 2 }">block</button>
    <button class="update" @click="count++">update</button>
    <button class="call" @click="select(selected)">call</button>
    <button class="event" @click="handle($event)">event</button>
    <button class="multiple" @click="count++; select(selected)">multiple</button>
    <form @submit.prevent="form.submit"><button class="prevent">prevent</button></form>
    <input class="enter" @keyup.enter="submit" />
    <Transition @before-enter="hooks.beforeEnter">
      <p v-if="shown" class="transition">shown</p>
    </Transition>
    <button class="toggle" @click="shown = !shown">toggle</button>
    <p class="count">{{ count }}</p>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';

interface Handler {
  submit(...args: unknown[]): void;
}

const props = defineProps<{
  form: Handler;
  maybeForm?: Handler;
  hooks: { beforeEnter(element: Element): void };
  selected: number;
  submit(...args: unknown[]): void;
  save(): Promise<void>;
  select(value: number): void;
  handle(event: Event): void;
}>();

const count = ref(0);
const shown = ref(false);
</script>
