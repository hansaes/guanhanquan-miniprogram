<template><cu-custom isBack><template #content>{{ title }}</template><template #right><slot name="right" /></template></cu-custom></template>
<script>
export default { name: 'EmployerNavbar', props: { title: { type: String, default: '' } } }
</script>
