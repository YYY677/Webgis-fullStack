<script lang="ts" setup>
import { reactive, ref, computed } from "vue"
import { ElMessage, ElMessageBox } from "element-plus"
import { usePagination } from "@/composables/usePagination"

const { paginationData, handleCurrentChange, handleSizeChange } = usePagination()

// 模拟表格数据
const tableData = Array.from({ length: 46 }, (_, i) => ({
  id: i + 1,
  name: `用户${i + 1}`,
  email: `user${i + 1}@example.com`,
  role: i % 3 === 0 ? "管理员" : "普通用户",
  status: i % 2 === 0 ? "启用" : "禁用",
  created: "2025-01-01"
}))

const currentPageData = computed(() => {
  const start = (paginationData.currentPage - 1) * paginationData.pageSize
  const end = start + paginationData.pageSize
  return tableData.slice(start, end)
})

paginationData.total = tableData.length

// 弹窗
const dialogVisible = ref(false)
const formData = reactive({ name: "", email: "", role: "普通用户" })

function handleAdd() {
  formData.name = ""
  formData.email = ""
  dialogVisible.value = true
}

function handleEdit(row: any) {
  Object.assign(formData, row)
  dialogVisible.value = true
}

function handleDelete(row: any) {
  ElMessageBox.confirm(`确认删除用户 "${row.name}"？`, "提示", { type: "warning" }).then(() => {
    ElMessage.success("删除成功")
  }).catch(() => {})
}

function handleSave() {
  ElMessage.success("保存成功")
  dialogVisible.value = false
}
</script>

<template>
  <div class="app-container">
    <!-- 搜索栏 -->
    <el-card shadow="never" class="search-bar">
      <el-form :inline="true">
        <el-form-item label="用户名">
          <el-input v-model="paginationData.currentPage" placeholder="搜索..." style="width:200px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search">搜索</el-button>
          <el-button icon="Refresh">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 操作栏 -->
    <div style="margin: 16px 0">
      <el-button type="primary" icon="Plus" @click="handleAdd">新增</el-button>
    </div>

    <!-- 表格 -->
    <el-card shadow="never">
      <el-table :data="currentPageData" border stripe style="width:100%">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="name" label="用户名" />
        <el-table-column prop="email" label="邮箱" />
        <el-table-column prop="role" label="角色" width="100" />
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === '启用' ? 'success' : 'danger'" size="small">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div style="margin-top: 16px; display: flex; justify-content: flex-end;">
        <el-pagination
          v-model:current-page="paginationData.currentPage"
          v-model:page-size="paginationData.pageSize"
          :total="paginationData.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handleCurrentChange"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <!-- 弹窗 -->
    <el-dialog v-model="dialogVisible" title="用户信息" width="500px">
      <el-form :model="formData" label-width="80px">
        <el-form-item label="用户名">
          <el-input v-model="formData.name" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="formData.email" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="formData.role">
            <el-option label="管理员" value="管理员" />
            <el-option label="普通用户" value="普通用户" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.search-bar { margin-bottom: 0; }
</style>
