import { Position } from './Position';

export enum TileState {
  EMPTY = 'EMPTY',
  OCCUPIED = 'OCCUPIED',
  SELECTED = 'SELECTED',
  HIGHLIGHTED = 'HIGHLIGHTED',
}

export class Tile {
  private state: TileState;

  constructor(
    public readonly position: Position,
    state: TileState = TileState.EMPTY
  ) {
    this.state = state;
  }

  getState(): TileState {
    return this.state;
  }

  setState(state: TileState): void {
    this.state = state;
  }

  isEmpty(): boolean {
    return this.state === TileState.EMPTY;
  }

  isOccupied(): boolean {
    return this.state === TileState.OCCUPIED;
  }

  isSelected(): boolean {
    return this.state === TileState.SELECTED;
  }

  isHighlighted(): boolean {
    return this.state === TileState.HIGHLIGHTED;
  }

  clone(): Tile {
    return new Tile(this.position, this.state);
  }
}
