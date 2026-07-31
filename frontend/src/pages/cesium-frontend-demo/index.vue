<script setup lang="ts">
import { cesiumLessons } from "./cesium-learning-catalog"
</script>

<template>
  <main class="learning-home">
    <section class="hero">
      <p class="eyebrow">CESIUM LEARNING SPACE</p>
      <p>
        从 Viewer 初始化到场景环境，多个示例按现有文件顺序排列；每张卡片都对应一个可独立进入的学习页面。
      </p>
    </section>

    <section class="topic-grid" aria-label="Cesium 全部章节">
      <RouterLink v-for="lesson in cesiumLessons" :key="lesson.path" class="topic-card" :to="lesson.path">
        <div class="topic-card__preview">
          <img :src="lesson.thumbnail" :alt="`${lesson.title} 页面快照`" />
          <span class="topic-card__index">{{ lesson.title.slice(0, 2) }}</span>
          <span class="topic-card__count">{{ lesson.api }}</span>
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
  min-height: 100%;
  padding: 56px clamp(24px, 6vw, 96px) 72px;
  background:
    radial-gradient(circle at 92% 2%, color-mix(in srgb, var(--el-color-primary) 16%, transparent), transparent 30%),
    var(--el-bg-color-page);
}

.hero {
  max-width: 760px;
  margin-bottom: 40px;
}

.eyebrow {
  margin: 0 0 12px;
  color: var(--el-color-primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .12em;
}

.hero>p:last-child {
  max-width: 590px;
  margin: 20px 0 0;
  color: var(--el-text-color-regular);
  font-size: 16px;
  line-height: 1.75;
}

.topic-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
  max-width: 1400px;
}

.topic-card {
  min-width: 0;
  overflow: hidden;
  padding: 0;
  color: inherit;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 18px;
  transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
}

.topic-card:hover {
  border-color: var(--el-color-primary-light-3);
  box-shadow: 0 16px 36px color-mix(in srgb, var(--el-text-color-primary) 12%, transparent);
  transform: translateY(-4px);
}

.topic-card__preview {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  color: #f5fbff;
  background: linear-gradient(135deg, #173a67, #0c1f3d);
}

.topic-card__preview::after {
  position: absolute;
  inset: 0;
  content: "";
  background: linear-gradient(180deg, rgba(6, 18, 37, .04), rgba(6, 18, 37, .68));
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
.topic-card__count {
  position: absolute;
  z-index: 1;
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

.topic-card__count {
  right: 14px;
  bottom: 13px;
  max-width: calc(100% - 28px);
  overflow: hidden;
  color: rgba(255, 255, 255, .9);
  font-size: 11px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topic-card__body {
  padding: 20px;
}

h2 {
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
  color: var(--el-color-primary);
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
