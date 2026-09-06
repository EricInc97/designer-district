/**
 * Four L-shaped corner brackets inset from the edges.
 *
 * Drawn with `border-current`, so it takes the colour of whatever layer it
 * sits inside. That is what lets the brand tiles keep their brackets legible
 * when the tile flips to a house colourway on hover.
 */
export default function CornerFrame({
  inset = "inset-2.5",
  size = "h-4 w-4",
  className = "",
}: {
  inset?: string;
  size?: string;
  className?: string;
}) {
  const corners = [
    "left-0 top-0 border-l border-t",
    "right-0 top-0 border-r border-t",
    "bottom-0 left-0 border-b border-l",
    "bottom-0 right-0 border-b border-r",
  ];

  return (
    <span aria-hidden className={`pointer-events-none absolute ${inset} ${className}`}>
      {corners.map((c) => (
        <span key={c} className={`absolute ${size} ${c} border-current`} />
      ))}
    </span>
  );
}
