export function EmptyState({ icon = '🎲', title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-20 h-20 rounded-3xl bg-warm-100 flex items-center justify-center mb-5">
        <span className="text-4xl">{icon}</span>
      </div>
      <h3 className="font-display text-lg font-bold text-warm-900 mb-1.5">{title}</h3>
      {description && (
        <p className="text-warm-400 text-sm max-w-[240px] mb-5 leading-relaxed">{description}</p>
      )}
      {action && action}
    </div>
  )
}
