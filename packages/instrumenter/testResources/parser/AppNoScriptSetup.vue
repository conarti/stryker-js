<template>
  <p v-if="visible">{{ message }}</p>
</template>

<script>
export default {
  data() {
    return { visible: true, message: 'hello' };
  },
};
</script>
