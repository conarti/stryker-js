<template>
  <Transition @enter="obj.start"><p>a</p></Transition>
  <transition @after-enter="obj.done"><p>b</p></transition>
  <TransitionGroup @leave="obj.leave"><p key="c">c</p></TransitionGroup>
  <transition-group @before-enter="obj.before" @after-leave="() => obj.after()"><p key="d">d</p></transition-group>
</template>

<script setup>
const obj = { start() {}, done() {}, leave() {}, before() {}, after() {} };
</script>
