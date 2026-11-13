<template>
  <cu-custom :bgColor="bgColor" :isBack="showBack">
    <template #content>{{ title }}</template>
    <template #right><slot name="right" /></template>
  </cu-custom>
</template>

<script>
export default {
  name: 'nav-bar',
  props: {
    title: { type: String, default: '' },
    showBack: { type: [Boolean, String], default: false },
    bgColor: { type: String, default: 'bg-white' }
  }
}
</script>
