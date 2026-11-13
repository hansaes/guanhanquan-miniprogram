<template>
  <view class="page">
    <cu-custom bgColor="bg-white" isBack><template #content>积分与余额</template></cu-custom>

    <auth-gate title="登录后查看账户" target="/pages/wallet/index" @ready="load">
      <view class="balance-card" :aria-busy="loading">
        <view class="item">
          <text class="num">{{ info ? info.points : '—' }}</text>
          <text class="label">积分</text>
        </view>
        <view class="divider"></view>
        <view class="item">
          <text class="num">{{ info ? Number(info.balance).toFixed(2) : '—' }}</text>
          <text class="label">余额（元）</text>
        </view>
      </view>

      <view class="actions">
        <button
          role="button"
          class="sign"
          :loading="signing"
          :disabled="!info || loading || signing || info.signedToday"
          @tap="signIn"
        >
          {{
            !info
              ? '签到'
              : info.signedToday
                ? '今日已签到'
                : '签到 +' + info.signInPoints + ' 积分'
          }}
        </button>
        <button role="button" class="recharge" :disabled="!info || loading" @tap="recharge">
          充值
        </button>
      </view>

      <page-state
        v-if="err || (!info && loading)"
        :loading="loading && !info"
        :error="err"
        @retry="load"
      />

      <view class="card rules" v-if="info">
        <view class="section-title">消耗说明</view>
        <view class="rule"
          ><text>查看联系方式</text><text class="cost">{{ info.contactCost }} 积分 / 次</text></view
        >
        <view class="rule"
          ><text>信息置顶 7 天</text><text class="cost">{{ info.topCost }} 积分 / 次</text></view
        >
        <view class="rule"
          ><text>刷新排序</text><text class="cost">{{ info.refreshCost }} 积分 / 次</text></view
        >
        <button role="button" class="rule task" @tap="goResume">
          <text>首次完善简历</text>
          <view class="reward">
            <text>{{
              info.profileTaskRewarded ? '已领取' : '+' + info.profileTaskPoints + ' 积分'
            }}</text>
            <uni-icons type="right" size="14" color="#657287" />
          </view>
        </button>
        <button role="button" class="rule task" @tap="goBlacklist">
          <text>信用查询</text><uni-icons type="right" size="14" color="#657287" />
        </button>
      </view>

      <view class="card">
        <view class="section-title">收支记录</view>
        <page-state
          v-if="recordsLoading || recordsError"
          :loading="recordsLoading"
          :error="recordsError"
          @retry="load"
        />
        <view v-for="r in records" v-else :key="r.id" class="record">
          <view>
            <text class="biz">{{ r.businessType || '其他' }}</text>
            <text class="remark">{{ r.remark }}</text>
          </view>
          <text :class="r.amount > 0 ? 'plus' : 'minus'"
            >{{ r.amount > 0 ? '+' : '' }}{{ r.amount }}</text
          >
        </view>
        <view v-if="!recordsLoading && !recordsError && !records.length" class="empty"
          >暂无记录</view
        >
      </view>
    </auth-gate>
  </view>
</template>

<script>
import api from '@/api/index.js'
import { session } from '@/utils/auth'
export default {
  data() {
    return {
      err: '',
      info: null,
      loading: true,
      recordsLoading: true,
      recordsError: '',
      signing: false,
      requestId: 0,
      walletOwner: '',
      records: []
    }
  },
  methods: {
    async load() {
      const owner = session.userInfo?.id
      if (!owner) return
      if (this.walletOwner !== owner) {
        this.info = null
        this.records = []
        this.walletOwner = owner
      }
      const requestId = ++this.requestId
      this.loading = true
      this.recordsLoading = true
      this.err = ''
      this.recordsError = ''
      const [wallet, records] = await Promise.allSettled([
        api.getWallet(),
        api.getWalletRecords({ page: 1, pageSize: 30 })
      ])
      if (requestId !== this.requestId || owner !== session.userInfo?.id) return
      if (wallet.status === 'fulfilled') this.info = wallet.value.data
      else this.err = '账户加载失败，请重试'
      if (records.status === 'fulfilled') this.records = records.value.data?.records || []
      else this.recordsError = '收支记录加载失败，请重试'
      this.loading = false
      this.recordsLoading = false
    },

    async signIn() {
      if (!this.info || this.info.signedToday || this.signing) return
      const owner = session.userInfo?.id
      this.signing = true
      try {
        const res = await api.signIn()
        if (owner !== session.userInfo?.id) return
        this.info.signedToday = true
        uni.showToast({ title: '+' + res.data.points + ' 积分', icon: 'success' })
        await this.load()
      } catch (e) {
        if (owner === session.userInfo?.id)
          uni.showToast({ title: '签到失败，请重试', icon: 'none' })
      } finally {
        this.signing = false
      }
    },
    goBlacklist() {
      uni.navigateTo({ url: '/pages/blacklist/query' })
    },
    goResume() {
      uni.navigateTo({ url: '/pages/resume/my' })
    },
    recharge() {
      const amounts = [10, 30, 50, 100, 200]
      uni.showActionSheet({
        itemList: amounts.map((n) => n + ' 元'),
        success: async (r) => {
          const amount = amounts[r.tapIndex]
          try {
            const res = await api.recharge({ amount })
            const payment = res.data && res.data.payment
            if (!payment) throw new Error('支付参数缺失')
            await new Promise((resolve, reject) => {
              uni.requestPayment({
                provider: 'wxpay',
                timeStamp: payment.timeStamp,
                nonceStr: payment.nonceStr,
                package: payment.package,
                signType: payment.signType,
                paySign: payment.paySign,
                success: resolve,
                fail: reject
              })
            })
            uni.showToast({ title: '充值成功', icon: 'success' })
            this.load()
          } catch (e) {
            if (e && e.errMsg && /cancel/.test(e.errMsg)) return
            uni.showToast({ title: (e && e.message) || '支付未完成', icon: 'none' })
          }
        }
      })
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
.balance-card {
  background: var(--primary);
  margin: 24rpx 32rpx 0;
  border-radius: 28rpx;
  display: flex;
  padding: 40rpx 0;
}
.item {
  flex: 1;
  min-width: 0;
  padding: 0 12px;
  text-align: center;
  color: #fff;
}
.num {
  font-size: var(--font-display);
  font-weight: 700;
  display: block;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}
.label {
  font-size: var(--font-caption);
  opacity: 0.8;
}
.divider {
  width: 1rpx;
  background: rgba(255, 255, 255, 0.25);
}
.actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
  padding: 24rpx 32rpx;
}
.sign,
.recharge {
  margin: 0;
  min-width: 0;
  border-radius: 20rpx;
  min-height: 48px;
  line-height: 48px;
  font-size: var(--font-control);
  padding: 0 8px;
}
.sign {
  background: var(--primary);
  color: #fff;
}
.sign[disabled] {
  background: var(--primary-soft);
  color: var(--muted);
  opacity: 1;
}
.recharge {
  background: #fff;
  color: var(--primary);
  border: 1px solid var(--line);
}
.card {
  background: #fff;
  margin: 0 32rpx 24rpx;
  border-radius: 24rpx;
  padding: 28rpx;
}
.section-title {
  font-size: var(--font-control);
  font-weight: 600;
  margin-bottom: 16rpx;
}
.rule {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 12px 0;
  font-size: var(--font-body);
  color: var(--text);
  line-height: 1.5;
}
.cost {
  color: var(--text);
  flex-shrink: 0;
}
.task {
  margin: 0;
  min-height: 48px;
  background: transparent;
  border-top: 1px solid var(--line);
  border-radius: 0;
  text-align: left;
}
.reward {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--primary);
}
.record {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 16px 0;
  border-bottom: 1px solid var(--line);
}
.record:last-child {
  border-bottom: 0;
}
.biz {
  font-size: var(--font-body);
  display: block;
}
.remark {
  font-size: var(--font-caption);
  color: var(--muted);
}
.plus {
  color: #16864b;
  font-size: var(--font-control);
}
.minus {
  color: #e54d42;
  font-size: var(--font-control);
}
.err {
  color: #e54d42;
  font-size: var(--font-small);
}
.empty {
  text-align: center;
  color: var(--muted);
  font-size: var(--font-small);
  padding: 30rpx 0;
}
</style>
