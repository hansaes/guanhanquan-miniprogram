<template>
  <view class="region-picker">
    <button class="picker-trigger" role="button" :aria-label="label || '选择地区'" @tap="open">
      <slot>
        <selection-field
          :label="label"
          :value="address"
          :required="required"
          placeholder="请选择省市区"
        />
      </slot>
    </button>
    <selection-sheet ref="sheet" title="选择地区">
      <view v-if="loading || error" class="region-state">
        <uni-load-more
          v-if="loading"
          status="loading"
          :content-text="{ contentrefresh: '加载地区' }"
        />
        <template v-else>
          <text>{{ error }}</text>
          <button class="ui-button ui-button-ghost" role="button" @tap="load">重新加载</button>
        </template>
      </view>
      <uni-data-pickerview
        v-else-if="options.length"
        :key="pickerKey"
        ref="cascade"
        class="region-cascade"
        :localdata="options"
        :managed-mode="true"
        @change="choose"
      />
    </selection-sheet>
  </view>
</template>
<script>
import SelectionSheet from './selection-sheet.vue'
import SelectionField from './selection-field.vue'
import { loadRegions, regionOptions, selectedRegionCode, pickerData } from '@/utils/regions'
export default {
  components: { SelectionSheet, SelectionField },
  props: {
    value: { type: Array, default: () => [] },
    allowAll: Boolean,
    label: String,
    address: String,
    required: Boolean
  },
  emits: ['change'],
  data: () => ({ loading: false, error: '', options: [], selectedCode: '', pickerKey: 0 }),
  methods: {
    open() {
      this.$refs.sheet.open()
      this.load()
    },
    async load() {
      this.loading = true
      this.error = ''
      try {
        const tree = await loadRegions()
        this.options = regionOptions(tree, this.allowAll)
        this.selectedCode = selectedRegionCode(tree, this.value, this.allowAll, this.address)
        this.pickerKey++
        this.loading = false
        await this.$nextTick()
        // Use the same managed data contract as uni-data-picker 1.5.12.
        this.$refs.cascade?.updateData(pickerData(this.options, this.selectedCode))
      } catch (e) {
        this.error = '地区加载失败'
      } finally {
        this.loading = false
      }
    },
    choose(selected) {
      const path = selected.filter(
        (node) => node.value !== 'all' && !String(node.value).endsWith('-all')
      )
      this.$emit('change', {
        detail: {
          value: path.map((node) => node.text),
          code: path.length ? path[path.length - 1].value : '',
          codes: path.map((node) => node.value)
        }
      })
      this.$refs.sheet.close()
    }
  }
}
</script>
<style>
.region-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  color: #798496;
}
.region-cascade {
  min-height: 0;
  font-size: 16px;
}
.region-cascade :deep(.selected-list) {
  border-bottom: 1px solid #edf0f4;
  padding: 0 12px;
}
.region-cascade :deep(.selected-item) {
  min-height: 48px;
  padding: 14px 2px;
  margin: 0 12px;
  line-height: 20px;
}
.region-cascade :deep(.selected-item-active) {
  color: #2563eb;
  border-bottom: 3px solid #2563eb;
  font-weight: 600;
}
.region-cascade :deep(.item) {
  min-height: 48px;
  padding: 14px 24px;
  line-height: 22px;
  align-items: center;
}
.region-cascade :deep(.item-text) {
  color: #3f4b5d;
}
.region-cascade :deep(.check) {
  border-color: #2563eb;
  margin-right: 5px;
}
</style>
