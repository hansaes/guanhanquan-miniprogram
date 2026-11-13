<template>
  <view class="page">
    <cu-custom bgColor="bg-white" isBack><template #content>编辑简历</template></cu-custom>
    <auth-gate title="登录后编辑简历" @ready="load">
      <page-state v-if="loading || loadError" :loading="loading" :error="loadError" @retry="load" />
      <view v-else>
        <view v-if="form.reviewStatus === 0" class="banner">
          简历待平台审核，通过后招工方才看得到
        </view>
        <view v-else-if="form.reviewStatus === 2" class="banner danger">
          未通过审核：{{ form.rejectReason || '资料不完整' }}
        </view>

        <view class="card">
          <view class="row">
            <text class="label">公开简历</text>
            <switch
              aria-label="公开简历"
              :checked="form.status === 0"
              color="#2563eb"
              @change="onStatus"
            />
          </view>
        </view>

        <view class="card">
          <view class="section-title">基本信息</view>
          <view class="row">
            <text class="label">称呼</text>
            <input aria-label="称呼" class="input" v-model="form.name" placeholder="如：李师傅" />
          </view>
          <view class="row">
            <text class="label">电话</text>
            <input
              aria-label="联系电话"
              class="input"
              type="number"
              maxlength="11"
              v-model="form.contactPhone"
            />
          </view>
          <view class="row">
            <text class="label">微信</text>
            <input aria-label="微信号" class="input" v-model="form.wechat" placeholder="选填" />
          </view>
          <option-picker
            title="工作年限"
            field-label="工作年限"
            :options="years"
            :value="dictionary('experience').findIndex((x) => x.value === form.workExperience)"
            :display-value="labelFor('experience', form.workExperience, form.workExperience)"
            @change="setChoice('workExperience', 'experience', $event)"
          />
          <option-picker
            title="持有证书"
            field-label="证书"
            :options="certs"
            :value="dictionary('certificates').findIndex((x) => x.value === form.certificateInfo)"
            :display-value="labelFor('certificates', form.certificateInfo, form.certificateInfo)"
            @change="setChoice('certificateInfo', 'certificates', $event)"
          />
          <view class="row column">
            <text class="label">证书照片</text>
            <view class="images">
              <view class="img-box" v-for="(img, i) in form.certificateImages" :key="i">
                <image :src="img" mode="aspectFill" @tap="previewCert(i)" />
                <text class="del" @tap="removeCert(i)">×</text>
              </view>
              <view
                class="img-add"
                role="button"
                aria-label="添加证书照片"
                v-if="form.certificateImages.length < 3"
                @tap="chooseCert"
              >
                <uni-icons type="plusempty" size="28" color="#798496" />
              </view>
            </view>
          </view>
        </view>

        <view class="card">
          <view class="section-title">技能</view>
          <view class="tags">
            <view
              v-for="t in jobTypeOptions"
              :key="t"
              :class="['tag', { active: form.jobTypes.includes(t) }]"
              role="checkbox"
              :aria-checked="form.jobTypes.includes(t)"
              @tap="toggleType(t)"
            >
              {{ t }}
            </view>
          </view>
          <textarea
            aria-label="技术描述"
            class="textarea"
            v-model="form.techDescription"
            maxlength="200"
            placeholder="擅长什么材质、什么工艺，例如：氩电焊、不锈钢管道、能包口"
          />
        </view>

        <view class="card">
          <view class="section-title">求职意向</view>
          <view class="row">
            <text class="label">期望地区</text>
            <input
              aria-label="期望地区"
              class="input"
              v-model="form.expectArea"
              placeholder="如：东北三省 / 沈阳"
            />
          </view>
          <view class="row">
            <text class="label">期望薪资</text>
            <input
              aria-label="期望薪资"
              class="input"
              v-model="form.expectSalary"
              placeholder="如：600-700/天"
            />
          </view>
          <option-picker
            title="到岗时间"
            field-label="到岗时间"
            :options="availables"
            :value="dictionary('availability').findIndex((x) => x.value === form.availableTime)"
            :display-value="labelFor('availability', form.availableTime, form.availableTime)"
            @change="setChoice('availableTime', 'availability', $event)"
          />
        </view>

        <button role="button" class="submit" :loading="saving" :disabled="saving || deleting" @tap="save">
          保存简历
        </button>
        <button role="button" v-if="hasResume" class="delete" :disabled="saving || deleting" @tap="deleteResume">
          删除简历
        </button>
      </view>
    </auth-gate>
  </view>
</template>

<script>
import api from '@/api/index.js'
import { content, loadContent, dictionary, labelFor, indexFor } from '@/utils/content'

export default {
  data() {
    return {
      saving: false,
      hasResume: false,
      deleting: false,
      loading: true,
      loadError: '',
      content,
      categories: [],
      form: {
        name: '',
        contactPhone: '',
        wechat: '',
        workExperience: '',
        certificateInfo: '',
        certificateImages: [],
        jobTypes: [],
        techDescription: '',
        expectArea: '',
        expectSalary: '',
        availableTime: '',
        status: 0,
        reviewStatus: 1,
        rejectReason: ''
      }
    }
  },
  computed: {
    years() {
      return dictionary('experience').map((x) => x.label)
    },
    certs() {
      return dictionary('certificates').map((x) => x.label)
    },
    availables() {
      return dictionary('availability').map((x) => x.label)
    },
    jobTypeOptions() {
      return this.categories.map((x) => x.name)
    }
  },
  methods: {
    dictionary,
    labelFor,
    indexFor,
    setChoice(field, key, event) {
      const option = dictionary(key)[Number(event.detail.value)]
      if (option) this.form[field] = option.value
    },
    async load() {
      this.loading = true
      this.loadError = ''
      try {
        const [res, categories] = await Promise.all([
          api.getWorkerProfile(),
          api.getCategories(),
          loadContent()
        ])
        this.categories = categories.data || []
        const d = res.data || {}
        this.hasResume = !!d.id
        this.form = Object.assign({}, this.form, {
          name: d.name || '',
          contactPhone: d.contactPhone || '',
          wechat: d.wechat || '',
          workExperience: d.workExperience || '',
          certificateInfo: d.certificateInfo || '',
          certificateImages: d.certificateImages || [],
          jobTypes: d.jobTypes || [],
          techDescription: d.techDescription || '',
          expectArea: d.expectArea || '',
          expectSalary: d.expectSalary || '',
          availableTime: d.availableTime || '',
          status: d.status === undefined ? 0 : d.status,
          reviewStatus: d.reviewStatus === undefined ? 1 : d.reviewStatus,
          rejectReason: d.rejectReason || ''
        })
      } catch (e) {
        this.loadError = '简历加载失败'
      } finally {
        this.loading = false
      }
    },
    onStatus(e) {
      this.form.status = e.detail.value ? 0 : 1
    },
    toggleType(t) {
      const i = this.form.jobTypes.indexOf(t)
      if (i >= 0) this.form.jobTypes.splice(i, 1)
      else this.form.jobTypes.push(t)
    },
    chooseCert() {
      uni.chooseImage({
        count: 3 - this.form.certificateImages.length,
        sizeType: ['compressed'],
        success: async (res) => {
          uni.showLoading({ title: '上传中' })
          try {
            for (const path of res.tempFilePaths) {
              const fileID = await api.uploadFile(path, 'certificate')
              this.form.certificateImages.push(fileID)
            }
          } catch (e) {
            uni.showToast({ title: '上传失败', icon: 'none' })
          } finally {
            uni.hideLoading()
          }
        }
      })
    },
    previewCert(i) {
      uni.previewImage({
        current: this.form.certificateImages[i],
        urls: this.form.certificateImages
      })
    },
    removeCert(i) {
      this.form.certificateImages.splice(i, 1)
    },
    async deleteResume() {
      if (this.deleting || this.saving) return
      uni.showModal({
        title: '删除简历',
        content: '删除后招工方将看不到你的简历，确认删除？',
        confirmColor: '#e54d42',
        success: async (r) => {
          if (!r.confirm) return
          this.deleting = true
          try {
            await api.deleteWorkerProfile()
            this.hasResume = false
            this.form = Object.assign({}, this.form, {
              name: '',
              jobTypes: [],
              certificateInfo: '',
              certificateImages: [],
              workExperience: '',
              techDescription: '',
              expectArea: '',
              expectSalary: '',
              availableTime: '',
              status: 1,
              reviewStatus: 1
            })
            uni.showToast({ title: '已删除', icon: 'success' })
          } catch (e) {
          } finally {
            this.deleting = false
          }
        }
      })
    },
    async save() {
      if (this.saving || this.deleting) return
      if (!this.form.name) return uni.showToast({ title: '请填写称呼', icon: 'none' })
      if (!/^1\d{10}$/.test(String(this.form.contactPhone)))
        return uni.showToast({ title: '请填写正确手机号', icon: 'none' })
      if (!this.form.jobTypes.length)
        return uni.showToast({ title: '请至少选一个工种', icon: 'none' })
      if (this.saving) return
      this.saving = true
      try {
        await api.updateWorkerProfile(this.form)
        this.hasResume = true
        this.form.reviewStatus = 0
        this.form.rejectReason = ''
        uni.showToast({ title: '已保存，等待审核', icon: 'success' })
        setTimeout(() => uni.navigateBack(), 600)
      } catch (e) {
      } finally {
        this.saving = false
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--canvas);
  padding-bottom: 40rpx;
}
.card {
  background: #fff;
  margin: 24rpx 32rpx;
  border-radius: 24rpx;
  padding: 28rpx;
}
.section-title {
  font-size: var(--font-control);
  font-weight: 600;
  margin-bottom: 12rpx;
}
.row {
  display: flex;
  align-items: center;
  min-height: 52px;
  gap: 16rpx;
  justify-content: space-between;
  padding: 18rpx 0;
  border-bottom: 1rpx solid var(--canvas);
}
.row.column {
  flex-direction: column;
  align-items: flex-start;
}
.row:last-child {
  border-bottom: none;
}
.label {
  width: 150rpx;
  color: var(--muted);
  font-size: var(--font-body);
  flex-shrink: 0;
}
.input {
  flex: 1;
  min-width: 0;
  font-size: var(--font-body);
}
.picker {
  font-size: var(--font-body);
  color: var(--text);
}
.hint {
  font-size: var(--font-caption);
  color: var(--muted);
  margin-left: 12rpx;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 12rpx;
}
.tag {
  min-height: 44px;
  display: flex;
  align-items: center;
  padding: 10rpx 24rpx;
  margin: 0 12rpx 12rpx 0;
  border-radius: 30rpx;
  background: var(--canvas);
  font-size: var(--font-small);
  color: var(--muted);
}
.tag.active {
  background: var(--primary);
  color: #fff;
}
.textarea {
  width: 100%;
  height: 160rpx;
  background: #f7f8fa;
  border-radius: 12rpx;
  padding: 20rpx;
  font-size: var(--font-body);
  box-sizing: border-box;
}
.submit {
  margin: 24rpx 32rpx 0;
  background: var(--primary);
  color: #fff;
  border-radius: 20rpx;
  height: 48px;
  line-height: 48px;
  font-size: var(--font-control);
}
.delete {
  margin: 24rpx 32rpx;
  background: transparent;
  color: #e54d42;
  font-size: var(--font-body);
}
.banner {
  margin: 24rpx 32rpx;
  padding: 18rpx 24rpx;
  border-radius: 12rpx;
  background: #fff7e6;
  color: #fa8c16;
  font-size: var(--font-caption);
}
.banner.danger {
  background: #fff1f0;
  color: #e54d42;
}
.images {
  display: flex;
  flex-wrap: wrap;
  margin-top: 12rpx;
}
.img-box,
.img-add {
  width: 140rpx;
  height: 140rpx;
  margin: 0 14rpx 14rpx 0;
  border-radius: 10rpx;
  overflow: hidden;
  position: relative;
}
.img-box image {
  width: 100%;
  height: 100%;
}
.img-add {
  border: 1rpx dashed #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-display);
  color: #bbb;
}
.del {
  position: absolute;
  top: 0;
  right: 0;
  width: 40rpx;
  height: 40rpx;
  line-height: 40rpx;
  text-align: center;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: var(--font-small);
}
</style>
