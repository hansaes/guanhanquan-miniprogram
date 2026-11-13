<template>
  <div class="page-card content-editor" v-loading="loading">
    <div class="editor-heading">
      <div>
        <h3 class="page-title">小程序内容</h3>
        <span class="muted">名称、标签与入口配置</span>
      </div>
      <el-button type="primary" :loading="saving" :disabled="!form || !!error" @click="save">
        保存配置
      </el-button>
    </div>
    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false">
      <el-button link @click="load">重新加载</el-button>
    </el-alert>
    <el-tabs v-if="form" v-model="active">
      <el-tab-pane label="页面内容" name="copy">
        <el-form label-width="100px" class="copy-form">
          <el-form-item label="小程序名称">
            <el-input v-model="form.brandName" maxlength="20" />
          </el-form-item>
          <el-form-item label="搜索提示">
            <el-input v-model="form.searchPlaceholder" maxlength="40" />
          </el-form-item>
          <el-form-item label="安全提示">
            <el-input v-model="form.safetyNotice" type="textarea" maxlength="200" show-word-limit />
          </el-form-item>
          <el-form-item v-for="(name, key) in badgeNames" :key="key" :label="name">
            <el-input v-model="form.badges[key]" maxlength="8" />
          </el-form-item>
          <el-form-item v-for="(_, i) in form.tabs" :key="i" :label="'底栏 ' + (i + 1)">
            <el-input v-model="form.tabs[i]" maxlength="6" />
          </el-form-item>
        </el-form>
      </el-tab-pane>
      <el-tab-pane label="标签选项" name="dictionaries">
        <el-select v-model="dictionaryKey" class="dictionary-select">
          <el-option v-for="(name, key) in dictionaryNames" :key="key" :label="name" :value="key" />
        </el-select>
        <el-table :data="form.dictionaries[dictionaryKey]">
          <el-table-column label="业务值" width="150">
            <template #default="{ row }">
              <el-input :model-value="String(row.value)" disabled />
            </template>
          </el-table-column>
          <el-table-column label="显示名称">
            <template #default="{ row }"><el-input v-model="row.label" maxlength="40" /></template>
          </el-table-column>
          <el-table-column v-if="dictionaryKey === 'salaryRanges'" label="最低日薪" width="150">
            <template #default="{ row }">
              <el-input-number v-model="row.min" :min="0" :controls="false" />
            </template>
          </el-table-column>
          <el-table-column
            v-if="dictionaryKey === 'salaryRanges'"
            label="最高日薪（0不限）"
            width="170"
          >
            <template #default="{ row }">
              <el-input-number v-model="row.max" :min="0" :controls="false" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="170">
            <template #default="{ $index }">
              <el-button
                link
                :disabled="$index === 0"
                @click="move(form.dictionaries[dictionaryKey], $index, -1)"
              >
                上移
              </el-button>
              <el-button
                link
                :disabled="$index === form.dictionaries[dictionaryKey].length - 1"
                @click="move(form.dictionaries[dictionaryKey], $index, 1)"
              >
                下移
              </el-button>
              <el-button v-if="!fixedDictionary" link type="danger" @click="removeOption($index)">
                移除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-button v-if="!fixedDictionary" class="add-option" @click="addOption">
          新增选项
        </el-button>
        <p class="muted">
          业务值用于匹配已有记录，改显示名称不会修改历史数据。移除后仅不再提供该选项。
        </p>
      </el-tab-pane>
      <el-tab-pane label="快捷入口" name="entries">
        <div v-for="group in ['shortcuts', 'services']" :key="group">
          <h4>{{ group === 'shortcuts' ? '首页专区' : '常用服务' }}</h4>
          <el-table :data="form[group]">
            <el-table-column label="名称">
              <template #default="{ row }">
                <el-input v-model="row.label" maxlength="12" />
              </template>
            </el-table-column>
            <el-table-column label="显示" width="100">
              <template #default="{ row }"><el-switch v-model="row.enabled" /></template>
            </el-table-column>
            <el-table-column label="排序" width="160">
              <template #default="{ $index }">
                <el-button link :disabled="$index === 0" @click="move(form[group], $index, -1)">
                  上移
                </el-button>
                <el-button
                  link
                  :disabled="$index === form[group].length - 1"
                  @click="move(form[group], $index, 1)"
                >
                  下移
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
      <el-tab-pane label="常见问题" name="faq">
        <div v-for="(faq, i) in form.faqs" :key="i" class="faq-editor">
          <el-input v-model="faq.q" placeholder="问题" aria-label="问题" maxlength="100" />
          <el-input
            v-model="faq.a"
            placeholder="回答"
            aria-label="回答"
            type="textarea"
            :rows="3"
            maxlength="600"
          />
          <el-button link type="danger" @click="form.faqs.splice(i, 1)">移除</el-button>
        </div>
        <el-button @click="form.faqs.push({ q: '', a: '' })">新增问题</el-button>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>
<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/api/guanhanquan'
const form = ref(null),
  loading = ref(false),
  saving = ref(false),
  error = ref(''),
  active = ref('copy'),
  dictionaryKey = ref('certificates')
const badgeNames = { urgent: '急招标签', top: '置顶标签', verified: '认证标签' }
const dictionaryNames = {
  salaryUnits: '薪资单位',
  payTypes: '发薪方式',
  accommodation: '食宿安排',
  travel: '路费报销',
  certificates: '证书',
  companyScales: '企业规模',
  reportTypes: '举报类型',
  blacklistReasons: '信用标记原因',
  experience: '工作年限',
  availability: '到岗时间',
  salaryRanges: '薪资筛选',
  timeRanges: '时间筛选'
}
const fixedDictionary = computed(() =>
  [
    'salaryUnits',
    'payTypes',
    'accommodation',
    'travel',
    'reportTypes',
    'blacklistReasons'
  ].includes(dictionaryKey.value)
)
async function load() {
  loading.value = true
  error.value = ''
  try {
    form.value = await api.content()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
async function save() {
  if (saving.value) return
  saving.value = true
  try {
    form.value = await api.saveContent(form.value)
    ElMessage.success('已保存，小程序下次刷新时生效')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    saving.value = false
  }
}
function move(rows, index, delta) {
  const [row] = rows.splice(index, 1)
  rows.splice(index + delta, 0, row)
}
async function addOption() {
  try {
    const { value } = await ElMessageBox.prompt(
      dictionaryKey.value === 'timeRanges' ? '请输入小时数（0 为不限）' : '请输入选项名称',
      '新增选项',
      { inputValidator: (v) => !!(v && v.trim()) || '不能为空' }
    )
    const rows = form.value.dictionaries[dictionaryKey.value]
    const key = dictionaryKey.value === 'timeRanges' ? Number(value) : value.trim()
    if (rows.some((x) => String(x.value) === String(key))) return ElMessage.warning('选项已存在')
    rows.push({
      value: key,
      label: dictionaryKey.value === 'timeRanges' ? value + '小时内' : value.trim(),
      ...(dictionaryKey.value === 'salaryRanges' ? { min: 0, max: 0 } : {})
    })
  } catch (e) {
    /* 用户取消 */
  }
}
function removeOption(i) {
  form.value.dictionaries[dictionaryKey.value].splice(i, 1)
}
onMounted(load)
</script>
<style scoped>
.editor-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}
.page-title {
  margin-bottom: 6px;
}
.muted {
  color: #7c8798;
  font-size: 13px;
}
.copy-form {
  max-width: 680px;
  padding-top: 16px;
}
.dictionary-select {
  margin: 12px 0 20px;
  width: 240px;
}
.faq-editor {
  display: grid;
  gap: 12px;
  padding: 20px 0;
  border-bottom: 1px solid #edf0f4;
}
.faq-editor .el-button {
  justify-self: end;
}
.add-option {
  margin-top: 20px;
}
.el-input-number {
  width: 100%;
}
</style>
