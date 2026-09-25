import { Tile, TileState } from "./Tile";
import { Position } from "./Position";
import { GamePiece } from "./GamePiece";
import type { Player } from "../constants/PieceConstants";

export class Board {
  private tiles: Map<string, Tile>;
  private pieces: Map<string, GamePiece>;
  private positionIndex: Map<string, string>;
  private piecesByOwner: Map<Player, GamePiece[]> | null;

  constructor(
    public readonly width: number,
    public readonly height: number,
  ) {
    if (width <= 0 || height <= 0) {
      throw new Error("Board dimensions must be positive");
    }

    this.tiles = new Map();
    this.pieces = new Map();
    this.positionIndex = new Map();
    this.piecesByOwner = null;
    this.initializeTiles();
  }

  private initializeTiles(): void {
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        const position = new Position(x, y);
        const tile = new Tile(position);
        this.tiles.set(this.getKey(position), tile);
      }
    }
  }

  private getKey(position: Position): string {
    return `${position.x},${position.y}`;
  }

  getTile(position: Position): Tile | undefined {
    return this.tiles.get(this.getKey(position));
  }

  getAllTiles(): Tile[] {
    return Array.from(this.tiles.values());
  }

  isValidPosition(position: Position): boolean {
    return (
      position.x >= 0 && position.x < this.width && position.y >= 0 && position.y < this.height
    );
  }

  selectTile(position: Position): boolean {
    if (!this.isValidPosition(position)) {
      return false;
    }

    this.clearSelection();
    const tile = this.getTile(position);
    if (tile) {
      tile.setState(TileState.SELECTED);
      return true;
    }
    return false;
  }

  clearSelection(): void {
    this.tiles.forEach((tile) => {
      if (tile.isSelected()) {
        tile.setState(TileState.EMPTY);
      }
    });
  }

  highlightTile(position: Position): boolean {
    if (!this.isValidPosition(position)) {
      return false;
    }

    const tile = this.getTile(position);
    if (tile && !tile.isSelected()) {
      tile.setState(TileState.HIGHLIGHTED);
      return true;
    }
    return false;
  }

  clearHighlights(): void {
    this.tiles.forEach((tile) => {
      if (tile.isHighlighted()) {
        tile.setState(TileState.EMPTY);
      }
    });
  }

  reset(): void {
    this.tiles.forEach((tile) => {
      tile.setState(TileState.EMPTY);
    });
    this.pieces.clear();
    this.positionIndex.clear();
    this.piecesByOwner = null;
  }

  addPiece(piece: GamePiece): void {
    this.pieces.set(piece.id, piece);
    if (piece.position) {
      this.positionIndex.set(this.getKey(piece.position), piece.id);
      const tile = this.getTile(piece.position);
      if (tile) {
        tile.setState(TileState.OCCUPIED);
      }
    }
    this.piecesByOwner = null;
  }

  removePiece(pieceId: string): void {
    const piece = this.pieces.get(pieceId);
    if (piece) {
      if (piece.position) {
        this.positionIndex.delete(this.getKey(piece.position));
        const tile = this.getTile(piece.position);
        if (tile) {
          tile.setState(TileState.EMPTY);
        }
      }
      this.pieces.delete(pieceId);
      this.piecesByOwner = null;
    }
  }

  private rebuildIndex(): void {
    this.positionIndex.clear();
    for (const piece of this.pieces.values()) {
      if (piece.position) {
        this.positionIndex.set(this.getKey(piece.position), piece.id);
      }
    }
  }

  getPieceAt(position: Position): GamePiece | undefined {
    const id = this.positionIndex.get(this.getKey(position));
    const piece = id === undefined ? undefined : this.pieces.get(id);
    // La posición pudo cambiar por fuera (piece.moveTo directo): verificar.
    if (piece?.position?.equals(position)) {
      return piece;
    }
    this.rebuildIndex();
    const retryId = this.positionIndex.get(this.getKey(position));
    const retry = retryId === undefined ? undefined : this.pieces.get(retryId);
    return retry?.position?.equals(position) ? retry : undefined;
  }

  getPiecesOf(player: Player): GamePiece[] {
    if (this.piecesByOwner === null) {
      this.piecesByOwner = new Map();
      for (const piece of this.pieces.values()) {
        const list = this.piecesByOwner.get(piece.owner);
        if (list) {
          list.push(piece);
        } else {
          this.piecesByOwner.set(piece.owner, [piece]);
        }
      }
    }
    return this.piecesByOwner.get(player) ?? [];
  }

  getPieceById(pieceId: string): GamePiece | undefined {
    return this.pieces.get(pieceId);
  }

  getAllPieces(): GamePiece[] {
    return Array.from(this.pieces.values());
  }

  movePiece(pieceId: string, to: Position): boolean {
    const piece = this.pieces.get(pieceId);
    if (!piece || !this.isValidPosition(to)) {
      return false;
    }

    if (piece.position) {
      this.positionIndex.delete(this.getKey(piece.position));
      const oldTile = this.getTile(piece.position);
      if (oldTile) {
        oldTile.setState(TileState.EMPTY);
      }
    }

    const capturedPiece = this.getPieceAt(to);
    if (capturedPiece) {
      this.removePiece(capturedPiece.id);
    }

    piece.moveTo(to);
    this.positionIndex.set(this.getKey(to), piece.id);

    const newTile = this.getTile(to);
    if (newTile) {
      newTile.setState(TileState.OCCUPIED);
    }

    return true;
  }

  highlightPositions(positions: Position[]): void {
    this.clearHighlights();
    positions.forEach((pos) => {
      const tile = this.getTile(pos);
      if (tile && !tile.isSelected() && !tile.isOccupied()) {
        tile.setState(TileState.HIGHLIGHTED);
      }
    });
  }
}
