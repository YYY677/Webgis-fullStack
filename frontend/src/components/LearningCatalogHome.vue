<script setup lang="ts">
import type { LearningCatalogLesson } from "@/types/learning-catalog"

// 使用 withDefaults 为 defineProps 提供默认值
withDefaults(defineProps<{
  // 眉线/标题上方的装饰文本，必需属性，类型为字符串
  eyebrow: string
  title: string
  description: string
  // 课程列表，必需属性，类型为 LearningCatalogLesson 数组
  lessons: LearningCatalogLesson[]
  tone?: "blue" | "green"
}>(), {
  // 为 tone 属性设置默认值为 "blue"
  tone: "blue",
})
</script>

<template>
  <main class="learning-home" :class="`learning-home--${tone}`">
    <section class="hero">
      <p class="eyebrow">{{ eyebrow }}</p>
      <h2>{{ title }}</h2>
      <p>{{ description }}</p>
    </section>

    <section class="topic-grid" :aria-label="`${title}章节`">
      <RouterLink v-for="lesson in lessons" :key="lesson.path" :to="lesson.path" class="topic-card">
        <div class="topic-card__preview">
          <img :src="lesson.thumbnail" :alt="`${lesson.title} 页面截图`" />
          <span class="topic-card__index">{{ lesson.title.slice(0, 2) }}</span>
          <span v-if="lesson.api" class="topic-card__api">{{ lesson.api }}</span>
        </div>
        <div class="topic-card__body">
          <h2>{{ lesson.title }}</h2>
          <p>{{ lesson.summary }}</p>
          <span class="topic-card__action">进入章节 <span aria-hidden="true">→</span></span>
        </div>
      </RouterLink>
    </section>
  </main>
</template>

<style scoped lang="scss">
.learning-home {
  --learning-accent: var(--el-color-primary);
  --learning-accent-light: var(--el-color-primary-light-3);
  min-height: 100%;
  padding: 56px clamp(24px, 6vw, 96px) 72px;
  background: radial-gradient(circle at 92% 2%, color-mix(in srgb, var(--learning-accent) 16%, transparent), transparent 30%), var(--el-bg-color-page);
}

.learning-home--green {
  --learning-accent: var(--el-color-success);
  --learning-accent-light: var(--el-color-success-light-3);
}

.hero {
  max-width: 760px;
  margin-bottom: 40px;
}

.eyebrow {
  margin: 0 0 12px;
  color: var(--learning-accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .12em;
}

h2 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: clamp(32px, 5vw, 52px);
}

.hero>p:last-child {
  max-width: 650px;
  margin: 20px 0 0;
  color: var(--el-text-color-regular);
  font-size: 16px;
  line-height: 1.75;
}

.topic-grid {
  display: grid;
  // 3 列布局，列宽最小为 0，最大为 1fr，fr 表示剩余空间的分配单位
  grid-template-columns: repeat(3, minmax(0, 1fr)); 
  gap: 20px;
  max-width: 1400px;
}

.topic-card {
  min-width: 0;
  overflow: hidden;
  color: inherit;
  text-decoration: none;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 18px;
  transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
}

.topic-card:hover {
  border-color: var(--learning-accent-light);
  box-shadow: 0 16px 36px color-mix(in srgb, var(--el-text-color-primary) 12%, transparent);
  transform: translateY(-4px);
}

.topic-card__preview {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: #122b4d;
}

.topic-card__preview::after {
  position: absolute;
  inset: 0;
  content: "";
  background: linear-gradient(180deg, transparent 45%, rgba(6, 18, 37, .68));
  pointer-events: none;
}

.topic-card__preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform .3s ease;
}

.topic-card:hover .topic-card__preview img {
  transform: scale(1.04);
}

.topic-card__index,
.topic-card__api {
  position: absolute;
  z-index: 1;
  color: #f5fbff;
}

.topic-card__index {
  top: 14px;
  left: 15px;
  display: grid;
  width: 36px;
  height: 27px;
  place-items: center;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: -.03em;
  background: rgba(9, 27, 55, .72);
  border: 1px solid rgba(255, 255, 255, .18);
  border-radius: 7px;
  backdrop-filter: blur(8px);
}

.topic-card__api {
  right: 14px;
  bottom: 13px;
  max-width: calc(100% - 28px);
  overflow: hidden;
  font-size: 11px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topic-card__body {
  padding: 20px;
}

.topic-card__body h2 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 20px;
}

.topic-card__body p {
  min-height: 47px;
  margin: 9px 0 17px;
  color: var(--el-text-color-regular);
  font-size: 14px;
  line-height: 1.65;
}

.topic-card__action {
  color: var(--learning-accent);
  font-size: 14px;
  font-weight: 600;
}

@media (max-width: 1080px) {
  .topic-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 620px) {
  .learning-home {
    padding: 38px 20px 48px;
  }

  .topic-grid {
    grid-template-columns: 1fr;
  }
}
</style>
