<template>
  <view class="publish" :class="{ 'publish-tab': tab }">
    <cu-custom :isBack="!tab">
      <template #content>{{ editingId ? '编辑招工' : '发布招工' }}</template>
    </cu-custom>

    <page-state
      v-if="loading || loadError"
      :loading="loading"
      :error="loadError"
      @retry="initialize"
    />
    <view v-else>
      <view class="card">
        <view class="section-title">基础信息</view>

        <option-picker
          title="选择工种"
          field-label="工种"
          :options="categoryNames"
          :value="categories.findIndex((c) => c.id === form.categoryId)"
          :display-value="categoryName"
          @change="onCategory"
          required
        />

        <view class="row">
          <text class="label">岗位名称</text>
          <input
            aria-label="岗位名称"
            class="input"
            v-model="form.title"
            :placeholder="categoryName || '默认与工种相同'"
            maxlength="20"
          />
        </view>

        <view class="row">
          <text class="label required">薪资</text>
          <input
            aria-label="薪资"
            class="input"
            type="number"
            v-model="form.salary"
            :disabled="salaryUnit === 4"
            :placeholder="salaryUnit === 4 ? '面议' : '如 550'"
          />
          <option-picker
            title="薪资单位"
            :options="unitOptions"
            :value="unitIndex"
            @change="onUnitChange"
          >
            <view class="unit-picker">
              {{ unitOptions[unitIndex] }}
              <uni-icons type="bottom" size="12" color="#2563eb" />
            </view>
          </option-picker>
        </view>

        <view class="row">
          <text class="label">工期</text>
          <input
            aria-label="工期"
            class="input"
            v-model="form.duration"
            placeholder="如：工期到年底 / 两个多月"
            maxlength="30"
          />
        </view>

        <region-picker
          label="工作地区"
          :value="region"
          :address="form.workArea"
          required
          @change="onRegion"
        />

        <view class="row">
          <text class="label">详细地址</text>
          <input
            aria-label="详细地址"
            class="input"
            v-model="form.workAddress"
            placeholder="选填，具体项目地址"
            maxlength="60"
          />
        </view>
      </view>

      <view class="card">
        <view class="section-title">岗位要求</view>

        <option-picker
          title="证书要求"
          field-label="证书"
          :options="certOptions"
          :value="dictionary('certificates').findIndex((x) => x.value === form.certificateReq)"
          :display-value="labelFor('certificates', form.certificateReq, form.certificateReq)"
          @change="setChoice('certificateReq', 'certificates', $event)"
        />

        <view class="row">
          <text class="label">年龄</text>
          <input
            aria-label="年龄限制"
            class="input"
            v-model="form.ageLimit"
            placeholder="如：55 岁以下 / 不超 55 虚岁"
            maxlength="20"
          />
        </view>

        <view class="row">
          <text class="label">技术</text>
          <input
            aria-label="技术要求"
            class="input"
            v-model="form.techReq"
            placeholder="如：能包口 / 焊缝探伤"
            maxlength="40"
          />
        </view>

        <view class="row column">
          <text class="label">其他</text>
          <textarea
            aria-label="其他要求"
            class="textarea"
            v-model="form.otherReq"
            maxlength="200"
            placeholder="填写岗位所需的其他条件"
          />
        </view>
      </view>

      <view class="card">
        <view class="section-title">待遇</view>

        <option-picker
          title="发薪方式"
          field-label="发薪"
          :options="payOptions"
          :value="indexFor('payTypes', form.payType)"
          :display-value="labelFor('payTypes', form.payType)"
          @change="setChoice('payType', 'payTypes', $event)"
        />

        <option-picker
          title="食宿安排"
          field-label="食宿"
          :options="accOptions"
          :value="indexFor('accommodation', form.accommodation)"
          :display-value="labelFor('accommodation', form.accommodation)"
          @change="setChoice('accommodation', 'accommodation', $event)"
        />

        <option-picker
          title="路费报销"
          field-label="路费"
          :options="travelOptions"
          :value="indexFor('travel', form.travelReimburse)"
          :display-value="labelFor('travel', form.travelReimburse)"
          @change="setChoice('travelReimburse', 'travel', $event)"
        />

        <view class="row">
          <text class="label">其他福利</text>
          <input
            aria-label="其他福利"
            class="input"
            v-model="form.otherBenefits"
            placeholder="选填"
            maxlength="40"
          />
        </view>
      </view>

      <view class="card">
        <view class="section-title">联系方式</view>

        <view class="row">
          <text class="label required">联系人</text>
          <input
            aria-label="联系人"
            class="input"
            v-model="form.contactName"
            placeholder="如：张 / 李老板"
            maxlength="10"
          />
        </view>

        <view class="row">
          <text class="label required">电话</text>
          <input
            aria-label="联系电话"
            class="input"
            type="number"
            v-model="form.contactPhone"
            maxlength="11"
            placeholder="11 位手机号"
          />
        </view>

        <view class="row">
          <text class="label">微信同号</text>
          <switch
            aria-label="微信同号"
            :checked="form.wechatSame"
            color="#2563eb"
            @change="(e) => (form.wechatSame = e.detail.value)"
          />
        </view>

        <view class="row">
          <text class="label">急招</text>
          <switch
            aria-label="急招"
            :checked="form.isUrgent"
            color="#e54d42"
            @change="(e) => (form.isUrgent = e.detail.value)"
          />
        </view>

        <view class="row" v-if="!editingId">
          <text class="label">审核后置顶</text>
          <switch
            aria-label="审核后置顶"
            :checked="form.requestTop"
            color="#fa8c16"
            @change="(e) => (form.requestTop = e.detail.value)"
          />
          <text class="unit-picker">{{ topCost }} 积分</text>
        </view>

        <option-picker
          v-if="!editingId"
          title="招工有效期"
          field-label="有效期"
          :options="validLabels"
          :value="validIndex"
          :display-value="validLabels[validIndex]"
          @change="onValidChange"
        />
      </view>

      <view class="tip-box">提交后需平台审核。置顶将按页面显示扣除积分。</view>

      <view class="submit-bar">
        <button role="button" class="submit" :loading="submitting" :disabled="submitting" @tap="submit">
          {{ editingId ? '保存并重新审核' : '提交审核' }}
        </button>
      </view>
    </view>
  </view>
</template>

<script>
import api from '@/api/index.js'
import { content, loadContent, dictionary, labelFor, indexFor } from '@/utils/content'

export default {
  props: { jobId: { type: String, default: '' }, tab: Boolean },
  data() {
    return {
      content,
      loading: true,
      loadError: '',
      editingId: '',
      categories: [],
      region: [],
      submitting: false,
      unitIndex: 0,
      validLabels: ['7 天', '15 天', '30 天'],
      validIndex: 0,
      topCost: 30,
      form: {
        categoryId: '',
        title: '',
        salary: '',
        duration: '',
        workArea: '',
        workAddress: '',
        certificateReq: '',
        ageLimit: '',
        techReq: '',
        otherReq: '',
        payType: 1,
        accommodation: 1,
        travelReimburse: 1,
        otherBenefits: '',
        contactName: '',
        contactPhone: '',
        wechatSame: false,
        isUrgent: false,
        requestTop: false
      }
    }
  },
  computed: {
    travelOptions() {
      return dictionary('travel').map((x) => x.label)
    },
    accOptions() {
      return dictionary('accommodation').map((x) => x.label)
    },
    payOptions() {
      return dictionary('payTypes').map((x) => x.label)
    },
    certOptions() {
      return dictionary('certificates').map((x) => x.label)
    },
    unitOptions() {
      return dictionary('salaryUnits').map((x) => x.label)
    },
    categoryNames() {
      return this.categories.map((c) => c.name)
    },
    categoryName() {
      const c = this.categories.find((x) => String(x.id) === String(this.form.categoryId))
      return c ? c.name : ''
    },
    salaryUnit() {
      return (dictionary('salaryUnits')[this.unitIndex] || {}).value || 1
    }
  },
  mounted() {
    this.initialize()
  },
  methods: {
    dictionary,
    labelFor,
    indexFor,
    setChoice(field, key, event) {
      const option = dictionary(key)[Number(event.detail.value)]
      if (option) this.form[field] = option.value
    },
    async initialize() {
      this.loading = true
      this.loadError = ''
      try {
        await loadContent()
        this.unitIndex = indexFor('salaryUnits', 1)
        const [categories, wallet] = await Promise.all([api.getCategories(), api.getWallet()])
        this.categories = categories.data || []
        this.topCost = wallet.data.topCost ?? 30
        await this.prefillContact()
        if (this.jobId) {
          this.editingId = this.jobId
          await this.loadJob(this.jobId)
        }
      } catch (e) {
        this.loadError = '发布信息加载失败，请重试'
      } finally {
        this.loading = false
      }
    },
    async loadCategories() {
      try {
        const res = await api.getCategories()
        this.categories = res.data || []
      } catch (e) {
        uni.showToast({ title: '工种加载失败', icon: 'none' })
      }
    },
    async prefillContact() {
      try {
        const res = await api.getUserProfile()
        const u = res.data
        if (u) {
          this.form.contactName = this.form.contactName || u.nickname || ''
          this.form.contactPhone = this.form.contactPhone || u.phone || ''
        }
      } catch (e) {}
    },
    async loadJob(id) {
      try {
        const res = await api.getJobDetail(id)
        const j = res.data || {}
        this.form = Object.assign({}, this.form, {
          categoryId: j.categoryId || '',
          title: j.title || '',
          salary: j.salary || '',
          duration: j.duration || '',
          workArea: j.workArea || '',
          workAddress: j.workAddress || '',
          certificateReq: j.certificateReq || '',
          ageLimit: j.ageLimit || '',
          techReq: j.techReq || '',
          otherReq: j.otherReq || '',
          payType: j.payType || 1,
          accommodation: j.accommodation || 1,
          travelReimburse: j.travelReimburse || 1,
          otherBenefits: j.otherBenefits || '',
          contactName: j.contactName || '',
          contactPhone: j.contactPhone || '',
          wechatSame: !!j.wechatSame,
          isUrgent: !!j.isUrgent,
          requestTop: false
        })
        this.unitIndex = Math.max(
          0,
          dictionary('salaryUnits').findIndex((x) => x.value === Number(j.salaryUnit || 1))
        )
        const left = Math.ceil((Number(j.expireAt || 0) - Date.now()) / 86400000)
        this.validIndex = left > 15 ? 2 : left > 7 ? 1 : 0
      } catch (e) {
        throw e
      }
    },
    onCategory(e) {
      const c = this.categories[Number(e.detail.value)]
      if (!c) return
      this.form.categoryId = c.id
      if (!this.form.title) this.form.title = c.name
    },
    onRegion(e) {
      const picked = e.detail.value || []
      this.region = picked
      this.form.workArea = [...new Set(picked.filter(Boolean))].join(' ')
    },
    onUnitChange(e) {
      this.unitIndex = Number(e.detail.value)
      if (this.salaryUnit === 4) this.form.salary = ''
    },
    onValidChange(e) {
      this.validIndex = Number(e.detail.value)
    },
    validate() {
      const f = this.form
      if (!f.categoryId) return '请选择工种'
      if (this.salaryUnit !== 4 && (!f.salary || Number(f.salary) <= 0)) return '请填写薪资'
      if (!f.workArea) return '请填写工作地区'
      if (!f.contactName) return '请填写联系人'
      if (!/^1\d{10}$/.test(String(f.contactPhone))) return '请填写正确的手机号'
      return ''
    },
    async submit() {
      if (this.submitting || this.loading || this.loadError) return
      const err = this.validate()
      if (err) {
        uni.showToast({ title: err, icon: 'none' })
        return
      }
      this.submitting = true
      try {
        const payload = Object.assign({}, this.form, {
          title: this.form.title || this.categoryName,
          salary: this.salaryUnit === 4 ? 0 : Number(this.form.salary),
          salaryUnit: this.salaryUnit,
          validDays: [7, 15, 30][this.validIndex],
          requestTop: !!this.form.requestTop
        })
        if (this.editingId) await api.updateJob(this.editingId, payload)
        else {
          await api.publishJob(payload)
          this.form = {
            ...this.$options.data.call(this).form,
            contactName: payload.contactName,
            contactPhone: payload.contactPhone
          }
          this.unitIndex = indexFor('salaryUnits', 1)
          this.validIndex = 0
          this.region = []
        }
        uni.showToast({
          title: this.editingId ? '已保存，重新审核' : '已提交审核',
          icon: 'success'
        })
        setTimeout(() => uni.navigateTo({ url: '/pages/employer/jobManage' }), 600)
      } catch (e) {
        // 请求层已提示
      } finally {
        this.submitting = false
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.publish {
  min-height: 100vh;
  background: var(--canvas);
  padding-bottom: 160rpx;
}
.card {
  background: #fff;
  margin: 24rpx 32rpx;
  border-radius: 24rpx;
  padding: 28rpx;
}
.section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16rpx;
}
.row {
  display: flex;
  align-items: center;
  min-height: 52px;
  gap: 16rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid var(--canvas);
}
.row:last-child {
  border-bottom: none;
}
.row.column {
  flex-direction: column;
  align-items: flex-start;
}
.label {
  width: 150rpx;
  color: var(--muted);
  font-size: var(--font-body);
  flex-shrink: 0;
}
.label.required::after {
  content: ' *';
  color: #e54d42;
}
.input {
  flex: 1;
  min-width: 0;
  font-size: var(--font-body);
  height: 44px;
}
.unit-picker {
  font-size: var(--font-small);
  color: var(--primary);
  margin-left: 8rpx;
}
.picker {
  font-size: var(--font-body);
  color: var(--text);
}
.picker.placeholder {
  color: #bbb;
}
.textarea {
  width: 100%;
  height: 140rpx;
  font-size: var(--font-body);
  margin-top: 12rpx;
  background: #f7f8fa;
  border-radius: 12rpx;
  padding: 20rpx;
  box-sizing: border-box;
}
.tip-box {
  margin: 20rpx 24rpx;
  font-size: var(--font-caption);
  color: var(--muted);
  line-height: 1.6;
}
.submit-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff;
  padding: 20rpx 24rpx calc(20rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.05);
}
.submit {
  background: var(--primary);
  color: #fff;
  border-radius: 44rpx;
  min-height: 48px;
  line-height: 48px;
  font-size: var(--font-control);
}
.publish-tab {
  padding-bottom: calc(var(--tabbar-height) + 16px + env(safe-area-inset-bottom));
}
.publish-tab .submit-bar {
  position: static;
  margin: 24rpx 32rpx;
  padding: 0;
  background: transparent;
  box-shadow: none;
}
</style>
