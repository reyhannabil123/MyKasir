export default function Loading() {
  return (
    <div className="stack-lg" aria-busy="true" aria-label="Memuat">
      <div className="skel" style={{ height: 36, width: "40%" }} />
      <div className="skel" style={{ height: 96 }} />
      <div className="skel" style={{ height: 96 }} />
      <div className="skel" style={{ height: 96 }} />
    </div>
  );
}
