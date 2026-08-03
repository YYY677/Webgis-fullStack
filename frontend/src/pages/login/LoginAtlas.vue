<script lang="ts" setup>
import { reactive, ref } from "vue"
import { useRoute, useRouter } from "vue-router"
// 这些虚拟导入由 unplugin-icons 在构建时生成 Tabler SVG Vue 组件。
import IconArrowRight from "~icons/tabler/arrow-right"
import IconLock from "~icons/tabler/lock"
import IconUser from "~icons/tabler/user"
import { useUserStore } from "@/stores/user"

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const loading = ref(false)
const loginForm = reactive({ username: "admin", password: "admin123" })

async function handleLogin() {
  loading.value = true
  try {
    await userStore.login(loginForm)
    await userStore.getInfo()
    await router.push((route.query.redirect as string) || "/dashboard")
  } catch {
    // 请求拦截器会显示接口错误信息。
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="atlas-login">
    <div class="atlas-login__grid" aria-hidden="true" />
    <section class="atlas-login__intro">
      <div class="atlas-brand"><span class="atlas-brand__mark">◎</span><span>WebGIS Atlas</span></div>
      <!-- Motion：品牌文案从左下方进入，使视觉焦点自然过渡到登录面板。 -->
      <div v-motion class="atlas-login__copy" :initial="{ opacity: 0, x: -28, y: 12 }"
        :enter="{ opacity: 1, x: 0, y: 0 }" :delay="120" :duration="680">
        <p>SPATIAL LEARNING CONSOLE</p>
        <h1>让每一次探索，<br /><em>都有坐标可循。</em></h1>
        <span>从二维图层到三维场景，在一个清晰而专注的空间里继续你的 WebGIS 学习路径。</span>
      </div>
      <div class="atlas-login__coordinates">31°13′ N　121°28′ E　LOCAL / READY</div>
    </section>

    <!-- Motion：登录面板采用弹簧入场，避免生硬的线性位移。 -->
    <section v-motion class="atlas-login__panel" :initial="{ opacity: 0, x: 36, y: 16, scale: .97 }"
      :enter="{ opacity: 1, x: 0, y: 0, scale: 1, transition: { type: 'spring', stiffness: 180, damping: 22 } }">
      <header>
        <p>欢迎回来</p>
        <h2>进入学习空间</h2><span>使用本地开发账号继续。</span>
      </header>
      <form @submit.prevent="handleLogin">
        <label for="atlas-username">账号</label>
        <el-input id="atlas-username" v-model="loginForm.username" size="large" autocomplete="username"><template
            #prefix>
            <IconUser />
          </template></el-input>
        <label for="atlas-password">密码</label>
        <el-input id="atlas-password" v-model="loginForm.password" type="password" size="large"
          autocomplete="current-password" show-password><template #prefix>
            <IconLock />
          </template></el-input>
        <!-- Motion：按钮悬停微放大、按下微缩小，鼠标和触屏设备均可获得按压反馈。 -->
        <el-button v-motion class="atlas-login__submit" :hovered="{ scale: 1.015 }" :tapped="{ scale: .985 }"
          type="primary" native-type="submit" :loading="loading">进入系统
          <IconArrowRight v-if="!loading" />
        </el-button>
      </form>
      <footer>演示账号：admin　密码：admin123</footer>
    </section>
  </main>
</template>

<style scoped lang="scss">
.atlas-login {
  min-height: 100vh;
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(380px, .8fr);
  overflow: hidden;
  color: var(--atlas-text);
  background: var(--atlas-login-bg);
}

.atlas-login__grid {
  position: absolute;
  inset: 0;
  opacity: .42;
  background-image: linear-gradient(var(--atlas-login-grid) 1px, transparent 1px), linear-gradient(90deg, var(--atlas-login-grid) 1px, transparent 1px);
  background-size: 54px 54px;
  mask-image: radial-gradient(ellipse at 38% 52%, #000 4%, transparent 73%);
}

.atlas-login__grid::after {
  content: "";
  position: absolute;
  width: min(68vw, 880px);
  aspect-ratio: 1;
  left: 7%;
  top: 12%;
  border: 1px solid var(--atlas-login-ring);
  border-radius: 50%;
  box-shadow: 0 0 0 52px rgba(85, 214, 255, .035), 0 0 0 128px rgba(85, 214, 255, .025), 0 0 0 238px rgba(85, 214, 255, .018);
  /* CSS 动画：低频呼吸环，为静态网格增加空间感，不参与业务状态表达。 */
  animation: atlas-login-orbit 8s ease-in-out infinite alternate;
}

.atlas-login__intro,
.atlas-login__panel {
  position: relative;
  z-index: 1;
}

.atlas-login__intro {
  display: flex;
  min-height: 100vh;
  flex-direction: column;
  justify-content: space-between;
  padding: clamp(30px, 5vw, 74px);
}

.atlas-brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  font-size: 18px;
  font-weight: 750;
  letter-spacing: -.02em;
}

.atlas-brand__mark {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border: 1px solid var(--atlas-login-ring);
  border-radius: 13px;
  color: var(--atlas-cyan);
  font-size: 23px;
  box-shadow: 0 0 28px rgba(85, 214, 255, .15);
}

.atlas-login__copy {
  max-width: 620px;
  margin: auto 0;
}

.atlas-login__copy p {
  margin: 0 0 16px;
  color: var(--atlas-cyan);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .18em;
}

.atlas-login__copy h1 {
  margin: 0;
  font-size: clamp(42px, 5.3vw, 78px);
  font-weight: 720;
  letter-spacing: -.075em;
  line-height: 1.04;
}

.atlas-login__copy h1 em {
  color: var(--atlas-cyan);
  font-style: normal;
}

.atlas-login__copy>span {
  display: block;
  max-width: 390px;
  margin-top: 26px;
  color: var(--atlas-muted);
  font-size: 15px;
  line-height: 1.8;
}

.atlas-login__coordinates {
  color: var(--atlas-login-coordinate);
  font: 11px ui-monospace, SFMono-Regular, Consolas, monospace;
  letter-spacing: .08em;
}

.atlas-login__panel {
  align-self: center;
  width: min(100% - 40px, 440px);
  margin-inline: auto;
  padding: 34px;
  border: 1px solid rgba(210, 236, 246, .56);
  border-radius: 22px;
  color: #132333;
  background: rgba(248, 252, 254, .97);
  box-shadow: var(--atlas-login-panel-shadow);
}

.atlas-login__panel header p {
  margin: 0 0 6px;
  color: #4c7185;
  font-size: 13px;
}

.atlas-login__panel h2 {
  margin: 0;
  font-size: 29px;
  letter-spacing: -.05em;
}

.atlas-login__panel header span {
  display: block;
  margin-top: 10px;
  color: #7892a1;
  font-size: 13px;
}

.atlas-login__panel form {
  display: grid;
  margin-top: 28px;
}

.atlas-login__panel label {
  margin-bottom: 8px;
  color: #537083;
  font-size: 12px;
  font-weight: 700;
}

.atlas-login__panel :deep(.el-input) {
  margin-bottom: 18px;
}

.atlas-login__panel :deep(.el-input__wrapper) {
  min-height: 46px;
  border-radius: 10px;
  box-shadow: 0 0 0 1px #cedce4 inset;
}

.atlas-login__panel :deep(.el-input__prefix-inner) {
  color: #628399;
}

.atlas-login__submit {
  display: inline-flex;
  width: 100%;
  height: 48px;
  justify-content: center;
  gap: 9px;
  margin-top: 4px;
  border: 0;
  border-radius: 10px;
  color: var(--atlas-accent-contrast);
  font-weight: 750;
  background: var(--atlas-cyan);
}

.atlas-login__submit svg {
  width: 18px;
}

.atlas-login__panel footer {
  margin-top: 20px;
  color: #7892a1;
  font-size: 12px;
  text-align: center;
}

@keyframes atlas-login-orbit {
  from { transform: rotate(-4deg) scale(.98); opacity: .72; }
  to { transform: rotate(5deg) scale(1.03); opacity: 1; }
}

@media (max-width: 860px) {
  .atlas-login {
    grid-template-columns: 1fr;
  }

  .atlas-login__intro {
    min-height: auto;
    padding-bottom: 38px;
  }

  .atlas-login__copy {
    margin: 100px 0 54px;
  }

  .atlas-login__panel {
    margin-bottom: 42px;
  }
}

@media (max-width: 540px) {
  .atlas-login__intro {
    padding: 24px;
  }

  .atlas-login__copy {
    margin: 70px 0 42px;
  }

  .atlas-login__copy h1 {
    font-size: 42px;
  }

  .atlas-login__panel {
    width: calc(100% - 32px);
    padding: 25px 22px;
  }

  .atlas-login__coordinates {
    font-size: 10px;
  }
}
</style>
