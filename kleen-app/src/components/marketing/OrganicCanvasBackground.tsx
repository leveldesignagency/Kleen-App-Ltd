/** White light accents on solid blue canvas — decorative only */
export default function OrganicCanvasBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <div className="organic-blob organic-blob-a absolute -left-24 -top-16 h-80 w-80 rounded-full bg-white/20 blur-3xl" />
      <div className="organic-blob organic-blob-b absolute -right-20 top-[25%] h-72 w-72 rounded-full bg-white/15 blur-3xl" />
      <div className="organic-blob organic-blob-c absolute bottom-8 left-[35%] h-64 w-96 rounded-full bg-white/10 blur-3xl" />
    </div>
  );
}
