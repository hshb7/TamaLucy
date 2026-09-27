export function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="page-head">
      <button className="btn btn-small" onClick={onBack} aria-label="back">
        ←
      </button>
      <h1>{title}</h1>
      <span style={{ width: 44 }} />
    </header>
  )
}
