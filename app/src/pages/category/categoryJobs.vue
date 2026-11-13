<template><view><page-state loading /></view></template>
<script>
export default { onLoad(options) { uni.redirectTo({ url: '/pages/jobSearch/jobSearch?id=' + encodeURIComponent(options.id || '') }) } }
</script>
