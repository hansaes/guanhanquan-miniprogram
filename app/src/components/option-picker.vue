<template>
  <view class="option-picker">
    <button class="picker-trigger" role="button" :aria-label="title" @tap="open">
      <slot>
        <selection-field :label="fieldLabel || title" :value="displayValue" :required="required" />
      </slot>
    </button>
    <selection-sheet ref="sheet" :title="title" compact>
      <scroll-view
        class="option-list"
        scroll-y
        role="radiogroup"
        :aria-label="title"
        :style="{ height: Math.max(1, options.length) * 52 + 'px' }"
      >
        <button
          v-for="(option, index) in options"
          :key="index"
          class="option-row"
          :class="{ 'option-selected': index === Number(value) }"
          role="radio"
          :aria-label="label(option)"
          :aria-checked="index === Number(value)"
          @tap="choose(index)"
        >
          <text>{{ label(option) }}</text>
          <uni-icons
            v-if="index === Number(value)"
            type="checkmarkempty"
            size="21"
            color="#2563eb"
          />
        </button>
        <view v-if="!options.length" class="ui-end">暂无可选项</view>
      </scroll-view>
    </selection-sheet>
  </view>
</template>
<script>
import SelectionSheet from './selection-sheet.vue'
import SelectionField from './selection-field.vue'
export default {
  components: { SelectionSheet, SelectionField },
  props: {
    title: String,
    fieldLabel: String,
    displayValue: String,
    required: Boolean,
    options: { type: Array, default: () => [] },
    value: { type: Number, default: 0 }
  },
  emits: ['change'],
  methods: {
    label(option) {
      return typeof option === 'object' ? option.label : option
    },
    open() {
      this.$refs.sheet.open()
    },
    choose(index) {
      this.$emit('change', { detail: { value: index } })
      this.$refs.sheet.close()
    }
  }
}
</script>
<style scoped>
.option-list {
  flex: 1;
  min-height: 0;
  max-height: calc(68vh - 64px);
}
.option-row {
  width: 100%;
  min-height: 52px;
  padding: 14px 24px;
  margin: 0;
  background: #fff;
  border-radius: 0;
  text-align: left;
  font-size: 16px;
  line-height: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  color: #3f4b5d;
}
.option-row::after {
  border: 0;
}
.option-selected {
  background: #edf4ff;
  color: #2563eb;
  font-weight: 600;
}
</style>
