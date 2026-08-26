export function EmptyState({ icon = '🎲', title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-20 h-20 rounded-3xl bg-bg-elevated border border-ui-border shadow-card flex items-center justify-center mb-5">
        <span className="text-4xl">{icon}</span>
      </div>
      <h3 className="font-display text-xl font-black text-text-primary mb-2">{title}</h3>
      {description && (
        <p className="text-text-secondary text-sm max-w-[260px] mb-6 leading-relaxed font-medium">{description}</p>
      )}
      {action && action}
    </div>
  )
}
