import { GamePiece } from './GamePiece';
import { PieceType } from '../constants/PieceConstants';

export class PlayerState {
  private selectedPieces: PieceType[] = [];
  private placedPieces: GamePiece[] = [];
  private benchPieces: GamePiece[] = [];
  private score: number = 0;

  constructor(public readonly playerId: string) {}

  addSelectedPiece(type: PieceType): void {
    this.selectedPieces.push(type);
  }

  getSelectedPieces(): PieceType[] {
    return [...this.selectedPieces];
  }

  getSelectedPieceCount(type: PieceType): number {
    return this.selectedPieces.filter(p => p === type).length;
  }

  getTotalSelectedCount(): number {
    return this.selectedPieces.length;
  }

  addPlacedPiece(piece: GamePiece): void {
    this.placedPieces.push(piece);
  }

  getPlacedPieces(): GamePiece[] {
    return [...this.placedPieces];
  }

  getPlacedPiecesCount(): number {
    return this.placedPieces.length;
  }

  addBenchPiece(piece: GamePiece): void {
    this.benchPieces.push(piece);
  }

  getBenchPieces(): GamePiece[] {
    return [...this.benchPieces];
  }

  removeBenchPiece(pieceId: string): GamePiece | undefined {
    const index = this.benchPieces.findIndex(p => p.id === pieceId);
    if (index !== -1) {
      return this.benchPieces.splice(index, 1)[0];
    }
    return undefined;
  }

  incrementScore(): void {
    this.score++;
  }

  getScore(): number {
    return this.score;
  }

  reset(): void {
    this.selectedPieces = [];
    this.placedPieces = [];
    this.benchPieces = [];
    this.score = 0;
  }
}
