export interface LoginRequestData {
  /** 用户名 */
  username: string
  /** 密码 */
  password: string
}

export type LoginResponseData = ApiResponseData<{ token: string }>
