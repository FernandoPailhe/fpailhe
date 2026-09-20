import { Board } from "../entities/Board";
import { Position } from "../entities/Position";

export interface IRenderer {
  initialize(container: HTMLElement): void;
  render(): void;
  dispose(): void;
  updateBoard(board: Board): void;
  onTileClick(callback: (position: Position) => void): void;
  onTileHover(callback: (position: Position | null) => void): void;
  resetCamera(): void;
  resize(): void;
}
