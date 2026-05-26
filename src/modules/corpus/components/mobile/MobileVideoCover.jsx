export default function MobileVideoCover({ posterUrl, title, subtitle, videoId }) {
  return (
    <div className="relative w-full h-[28vh] min-h-[180px] max-h-[240px] overflow-hidden shrink-0 rounded-b-2xl">
      {posterUrl ? (
        <img src={posterUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30" />
      {videoId && (
        <div className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full bg-black/40 backdrop-blur-sm text-white text-[10px] font-semibold tracking-wide">
          Ep.{videoId}
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <h1 className="text-white text-base font-bold truncate drop-shadow-sm">{title}</h1>
        {subtitle && (
          <p className="text-white/80 text-sm truncate mt-0.5 drop-shadow-sm">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
