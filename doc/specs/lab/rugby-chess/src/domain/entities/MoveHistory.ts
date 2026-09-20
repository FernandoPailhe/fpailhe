import { Position } from "./Position";
import { Player, PieceType } from "../constants/PieceConstants";

export interface MoveRecord {
  moveNumber: number;
  player: Player;
  pieceId: string;
  pieceType: PieceType;
  from: Position;
  to: Position;
  captured?: {
    pieceId: string;
    pieceType: PieceType;
    position: Position;
  };
  boardSnapshot: string; // JSON serialized board state
  timestamp: Date;
}

export class MoveHistory {
  private moves: MoveRecord[] = [];
  private currentIndex: number = -1;

  addMove(move: MoveRecord): void {
    // Remove any moves after current index (if we went back and made a new move)
    this.moves = this.moves.slice(0, this.currentIndex + 1);

    this.moves.push(move);
    this.currentIndex = this.moves.length - 1;
  }

  canGoBack(): boolean {
    return this.currentIndex > 0;
  }

  canGoForward(): boolean {
    return this.currentIndex < this.moves.length - 1;
  }

  goBack(): MoveRecord | null {
    if (!this.canGoBack()) return null;
    this.currentIndex--;
    return this.moves[this.currentIndex];
  }

  goForward(): MoveRecord | null {
    if (!this.canGoForward()) return null;
    this.currentIndex++;
    return this.moves[this.currentIndex];
  }

  getCurrentMove(): MoveRecord | null {
    if (this.currentIndex < 0) return null;
    return this.moves[this.currentIndex];
  }

  getAllMoves(): MoveRecord[] {
    return [...this.moves];
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  getTotalMoves(): number {
    return this.moves.length;
  }

  clear(): void {
    this.moves = [];
    this.currentIndex = -1;
  }

  isViewingHistory(): boolean {
    return this.currentIndex < this.moves.length - 1;
  }
}
