export function EmptyState({ icon = '🎲', title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <span className="text-6xl mb-4">{icon}</span>
      <h3 className="text-lg font-bold text-warm-900 mb-2">{title}</h3>
      {description && (
        <p className="text-warm-500 text-sm max-w-xs mb-4">{description}</p>
      )}
      {action && action}
    </div>
  )
}