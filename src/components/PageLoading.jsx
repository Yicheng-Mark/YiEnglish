import React from 'react'

const PageLoading = React.memo(function PageLoading() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/90 dark:bg-black/90 backdrop-blur-sm transition-opacity duration-200">
      <div className="relative">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-gray-200 border-t-indigo-500 dark:border-gray-700 dark:border-t-indigo-400" />
      </div>
      <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 animate-pulse">加载中...</p>
    </div>
  )
})

export default PageLoading
