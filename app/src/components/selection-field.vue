<template>
  <view class="selection-field">
    <text class="field-label" :class="{ required }">{{ label }}</text>
    <view class="field-value" :class="{ placeholder: !value }">
      <text>{{ value || placeholder }}</text>
      <uni-icons type="right" size="14" color="#98a2b1" />
    </view>
  </view>
</template>
<script>
export default {
  props: {
    label: String,
    value: String,
    required: Boolean,
    placeholder: { type: String, default: '请选择' }
  }
}
</script>
<style scoped>
.selection-field {
  display: flex;
  align-items: center;
  min-height: 52px;
  padding: 18rpx 0;
  gap: 16rpx;
  border-bottom: 1rpx solid #edf0f4;
}
.field-label {
  width: 150rpx;
  flex-shrink: 0;
  font-size: var(--font-body);
  color: var(--muted);
}
.field-label.required::after {
  content: ' *';
  color: #e5484d;
}
.field-value {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  font-size: var(--font-body);
  line-height: 1.5;
  color: #3f4b5d;
}
.field-value text {
  overflow-wrap: anywhere;
}
.field-value.placeholder {
  color: var(--muted);
}
</style>
