import { defineStore } from "pinia"
import { ref, computed } from "vue"
import { getToken, setToken, removeToken } from "@/utils/localStorage"
import { loginApi, getUserInfoApi } from "@/api/auth"

export const useUserStore = defineStore("user", () => {
  const token = ref(getToken() || "")
  const username = ref("")
  const roles = ref<string[]>([])

  const isLoggedIn = computed(() => !!token.value)

  async function login(cred: { username: string; password: string }) {
    const res = await loginApi(cred)
    token.value = res.data.token
    setToken(res.data.token)
  }

  async function getInfo() {
    const res = await getUserInfoApi()
    username.value = res.data.username
    roles.value = res.data.roles?.length > 0 ? res.data.roles : ["default"]
  }

  function logout() {
    token.value = ""
    username.value = ""
    roles.value = []
    removeToken()
  }

  return { token, username, roles, isLoggedIn, login, getInfo, logout }
})
