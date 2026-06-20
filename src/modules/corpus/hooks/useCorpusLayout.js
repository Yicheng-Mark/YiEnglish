import useIsMobile from '../../../hooks/useIsMobile.js'

// 薄封装：移动端布局判断的底层实现已统一到 useIsMobile，
// 此 hook 保留旧名以维持 corpus 模块调用点稳定。
// 返回值：true=移动端布局，false=桌面端布局（与 useIsMobile 一致）。
export default function useCorpusLayout() {
  return useIsMobile()
}
