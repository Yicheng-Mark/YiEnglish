// 全屏居中的空/错/完成态卡片：统一外壳布局（全屏居中 + card + 图标圆圈），
// 内容由 children 自定义，保证各调用处外观一致、消除重复布局代码。
export default function EmptyState({ icon, iconBg, children }) {
  return (
    <div className="h-[calc(100dvh-3rem)] md:h-[calc(100vh-4rem)] bg-background dark:bg-transparent flex items-center justify-center transition-colors duration-500">
      <div className="text-center card p-8 shadow-lg dark:shadow-black/40 mx-4">
        {icon && (
          <div className={`w-16 h-16 ${iconBg} rounded-full flex items-center justify-center mx-auto mb-4`}>
            {icon}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
