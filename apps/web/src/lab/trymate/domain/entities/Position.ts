export class Position {
  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {
    if (x < 0 || y < 0) {
      throw new Error("Position coordinates must be non-negative");
    }
  }

  equals(other: Position): boolean {
    return this.x === other.x && this.y === other.y;
  }

  toString(): string {
    return `(${this.x}, ${this.y})`;
  }

  static fromString(str: string): Position {
    const match = str.match(/\((\d+),\s*(\d+)\)/);
    const x = match?.[1];
    const y = match?.[2];
    if (x === undefined || y === undefined) {
      throw new Error("Invalid position string format");
    }
    return new Position(parseInt(x), parseInt(y));
  }
}
