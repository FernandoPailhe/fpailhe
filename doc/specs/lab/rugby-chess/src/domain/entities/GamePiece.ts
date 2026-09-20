import { Position } from "./Position";
import { PieceType, Player } from "../constants/PieceConstants";

export class GamePiece {
  constructor(
    public readonly id: string,
    public readonly type: PieceType,
    public position: Position | null,
    public readonly owner: Player,
  ) {}

  moveTo(position: Position | null): void {
    this.position = position;
  }

  clone(): GamePiece {
    return new GamePiece(this.id, this.type, this.position, this.owner);
  }

  equals(other: GamePiece): boolean {
    return this.id === other.id;
  }

  isOwnedBy(player: Player): boolean {
    return this.owner === player;
  }

  getDirectionMultiplier(): number {
    return this.owner === Player.BLANCAS ? 1 : -1;
  }
}
