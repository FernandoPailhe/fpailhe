import { Tile, TileState } from './Tile';
import { Position } from './Position';
import { GamePiece } from './GamePiece';

export class Board {
  private tiles: Map<string, Tile>;
  private pieces: Map<string, GamePiece>;

  constructor(
    public readonly width: number,
    public readonly height: number
  ) {
    if (width <= 0 || height <= 0) {
      throw new Error('Board dimensions must be positive');
    }

    this.tiles = new Map();
    this.pieces = new Map();
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
      position.x >= 0 &&
      position.x < this.width &&
      position.y >= 0 &&
      position.y < this.height
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
  }

  addPiece(piece: GamePiece): void {
    this.pieces.set(piece.id, piece);
    if (piece.position) {
      const tile = this.getTile(piece.position);
      if (tile) {
        tile.setState(TileState.OCCUPIED);
      }
    }
  }

  removePiece(pieceId: string): void {
    const piece = this.pieces.get(pieceId);
    if (piece) {
      if (piece.position) {
        const tile = this.getTile(piece.position);
        if (tile) {
          tile.setState(TileState.EMPTY);
        }
      }
      this.pieces.delete(pieceId);
    }
  }

  getPieceAt(position: Position): GamePiece | undefined {
    for (const piece of this.pieces.values()) {
      if (piece.position && piece.position.equals(position)) {
        return piece;
      }
    }
    return undefined;
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

    const newTile = this.getTile(to);
    if (newTile) {
      newTile.setState(TileState.OCCUPIED);
    }

    return true;
  }

  highlightPositions(positions: Position[]): void {
    this.clearHighlights();
    positions.forEach(pos => {
      const tile = this.getTile(pos);
      if (tile && !tile.isSelected() && !tile.isOccupied()) {
        tile.setState(TileState.HIGHLIGHTED);
      }
    });
  }
}
