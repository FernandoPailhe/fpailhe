/** Divisor decorativo a cuadros. */
export function CheckerRule() {
  return (
    <div
      role="presentation"
      className="h-[9px] rounded-sm opacity-50"
      style={{
        backgroundImage:
          "linear-gradient(45deg, var(--color-gold) 25%, transparent 25%, transparent 75%, var(--color-gold) 75%), " +
          "linear-gradient(45deg, var(--color-gold) 25%, transparent 25%, transparent 75%, var(--color-gold) 75%)",
        backgroundSize: "9px 9px",
        backgroundPosition: "0 0, 4.5px 4.5px",
      }}
    />
  );
}
