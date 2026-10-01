interface GameIconProps {
  readonly src: string | null;
  readonly label: string;
  readonly size?: number;
}

/** In-game icon; renders an empty placeholder of the same size when the art is unknown. */
export function GameIcon({ src, label, size = 28 }: GameIconProps) {
  if (!src) return <span className="game-icon game-icon-empty" style={{ width: size, height: size }} aria-hidden />;
  // Plain <img>: icons are tiny local PNGs, next/image optimisation buys nothing here.
  return <img className="game-icon" src={src} alt={label} title={label} width={size} height={size} />;
}
