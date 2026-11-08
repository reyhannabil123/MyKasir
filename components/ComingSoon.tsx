export function ComingSoon({ title, stage, children }: { title: string; stage: string; children: React.ReactNode }) {
  return (
    <div className="stack-lg">
      <header className="ph"><div><h1>{title}</h1></div></header>
      <div className="empty">
        <b>Akan dibuat di {stage}</b>
        <p style={{ marginTop: 6 }}>{children}</p>
      </div>
    </div>
  );
}
