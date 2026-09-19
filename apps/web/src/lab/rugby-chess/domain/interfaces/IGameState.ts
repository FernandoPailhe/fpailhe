import { Board } from "../entities/Board";
import { Position } from "../entities/Position";

export interface IGameState {
  getBoard(): Board;
  selectTile(position: Position): void;
  hoverTile(position: Position | null): void;
  reset(): void;
  subscribe(callback: () => void): () => void;
}
