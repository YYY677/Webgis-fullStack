import type { Component } from "vue"

export type LearningRouteComponent = () => Promise<{ default: Component }>

export interface LearningCatalogLesson {
  routeName: string
  title: string
  path: string
  summary: string
  thumbnail: string
  api?: string
  component: LearningRouteComponent
}
