import { GamePiece } from "../../domain/entities/GamePiece";
import { Position } from "../../domain/entities/Position";
import { Board } from "../../domain/entities/Board";
import { IMovementRule, MoveValidationContext } from "../../domain/interfaces/IMovementRule";
import {
  PIECE_MOVEMENT_CONFIG,
  MovementPattern,
  CapturePattern,
  type PieceMovementConfigMap,
} from "../../domain/constants/PieceConstants";

type PatternWithClearPath = MovementPattern & { requiresClearPath?: boolean };

/**
 * Motor de movimientos: data-driven, sin ramas por tipo concreto. Las
 * mecánicas especiales (L-shape, bypass de bloqueo, bloqueo lateral, captura
 * que ignora bloqueo) se leen de flags del `PieceMovementConfig` inyectado.
 */
export class MovementRuleEngine implements IMovementRule {
  constructor(public readonly config: PieceMovementConfigMap = PIECE_MOVEMENT_CONFIG) {}

  getValidMoves(piece: GamePiece, board: Board): Position[] {
    // Bench pieces don't have a position on the board
    if (!piece.position) {
      return [];
    }

    const config = this.config[piece.type];

    // L-shape movement (forward first, then lateral) driven by config flag
    if (config.lShape) {
      return this.getLShapeValidMoves(piece, board);
    }

    const validMoves: Position[] = [];
    const directionMultiplier = piece.getDirectionMultiplier();

    const checkMovementPattern = (pattern: PatternWithClearPath, isAlternative = false) => {
      pattern.directions.forEach((dir) => {
        const adjustedDir = {
          dx: dir.dx,
          dy: dir.dy * directionMultiplier,
        };

        for (let distance = pattern.minDistance; distance <= pattern.maxDistance; distance++) {
          if (!piece.position) continue;
          const newX = piece.position.x + adjustedDir.dx * distance;
          const newY = piece.position.y + adjustedDir.dy * distance;

          // Skip if coordinates are negative (out of bounds)
          if (newX < 0 || newY < 0) continue;

          const newPos = new Position(newX, newY);

          if (!board.isValidPosition(newPos)) continue;

          const targetPiece = board.getPieceAt(newPos);
          const isCapture = targetPiece !== undefined;

          if (isCapture && !pattern.canCapture) continue;
          if (isCapture && targetPiece.owner === piece.owner) continue;

          if (!this.canPassThrough(piece, newPos, board)) continue;

          // Alternative patterns may require a clear path (charge moves)
          if (piece.position) {
            if (isAlternative && pattern.requiresClearPath) {
              if (!this.isPathClear(piece.position, newPos, board, piece)) continue;
            }
          }

          validMoves.push(newPos);
        }
      });
    };

    checkMovementPattern(config.movement);

    if (config.alternativeMovement) {
      checkMovementPattern(config.alternativeMovement, true);
    }

    if (config.capture) {
      this.addCaptureMovesIfValid(piece, board, config.capture, directionMultiplier, validMoves);
    }

    return validMoves;
  }

  /**
   * L-shape movement: la pieza DEBE avanzar al menos 1 casilla hacia adelante
   * y puede seguir lateralmente (sin diagonal), con tope `maxTotalDistance`
   * (adelante + lateral) y `maxLateral` (costado). El camino debe estar libre.
   */
  private getLShapeValidMoves(piece: GamePiece, board: Board): Position[] {
    const validMoves: Position[] = [];
    const config = this.config[piece.type];
    const directionMultiplier = piece.getDirectionMultiplier();
    const startX = piece.position!.x;
    const startY = piece.position!.y;
    const maxTotalDistance = config.maxTotalDistance ?? config.movement.maxDistance;
    const maxLateralDistance = config.maxLateral ?? 1;

    // First, check if the first forward position is blocked
    const firstForwardY = startY + directionMultiplier;
    if (firstForwardY < 0) return [];

    const firstForwardPos = new Position(startX, firstForwardY);
    if (!board.isValidPosition(firstForwardPos)) return [];

    // Check if first forward position is blocked by a piece
    if (board.getPieceAt(firstForwardPos)) return [];

    // Check if first forward position is blocked by a side-blocker
    if (!this.canPassThrough(piece, firstForwardPos, board)) return [];

    // Generate all valid L-shape moves
    // For each forward distance, check if we can move there
    // Then for each valid forward position, check lateral moves

    for (let forwardDist = 1; forwardDist <= maxTotalDistance; forwardDist++) {
      const forwardY = startY + directionMultiplier * forwardDist;

      if (forwardY < 0) continue;

      const forwardPos = new Position(startX, forwardY);
      if (!board.isValidPosition(forwardPos)) continue;

      // Check if the path to this forward position is clear
      let pathClear = true;
      for (let step = 1; step <= forwardDist; step++) {
        const stepY = startY + directionMultiplier * step;
        if (stepY < 0) {
          pathClear = false;
          break;
        }
        const stepPos = new Position(startX, stepY);

        if (!board.isValidPosition(stepPos)) {
          pathClear = false;
          break;
        }

        // Check for blocking pieces (except at final position which can be empty)
        if (step < forwardDist && board.getPieceAt(stepPos)) {
          pathClear = false;
          break;
        }

        // Check for side-blockers
        if (!this.canPassThrough(piece, stepPos, board)) {
          pathClear = false;
          break;
        }
      }

      if (!pathClear) continue;

      // Check if forward position itself has a piece (cannot land on occupied square)
      const targetPiece = board.getPieceAt(forwardPos);
      if (targetPiece) continue;

      // Add the pure forward move
      validMoves.push(forwardPos);

      // Now check lateral moves from this forward position
      for (let lateralDist = 1; lateralDist <= maxLateralDistance; lateralDist++) {
        // Only allow lateral move if total distance doesn't exceed max
        if (forwardDist + lateralDist > maxTotalDistance) continue;
        // Check left
        const leftX = startX - lateralDist;
        if (leftX >= 0) {
          const leftPos = new Position(leftX, forwardY);
          if (board.isValidPosition(leftPos) && !board.getPieceAt(leftPos)) {
            // Check lateral path is clear
            let lateralPathClear = true;
            for (let latStep = 1; latStep <= lateralDist; latStep++) {
              const latStepX = startX - latStep;
              const latStepPos = new Position(latStepX, forwardY);

              // Check for blocking pieces (except at final position)
              if (latStep < lateralDist && board.getPieceAt(latStepPos)) {
                lateralPathClear = false;
                break;
              }

              // Check for side-blockers
              if (!this.canPassThrough(piece, latStepPos, board)) {
                lateralPathClear = false;
                break;
              }
            }

            if (lateralPathClear) {
              validMoves.push(leftPos);
            }
          }
        }

        // Check right
        const rightX = startX + lateralDist;
        const rightPos = new Position(rightX, forwardY);
        if (board.isValidPosition(rightPos) && !board.getPieceAt(rightPos)) {
          // Check lateral path is clear
          let lateralPathClear = true;
          for (let latStep = 1; latStep <= lateralDist; latStep++) {
            const latStepX = startX + latStep;
            const latStepPos = new Position(latStepX, forwardY);

            // Check for blocking pieces (except at final position)
            if (latStep < lateralDist && board.getPieceAt(latStepPos)) {
              lateralPathClear = false;
              break;
            }

            // Check for side-blockers
            if (!this.canPassThrough(piece, latStepPos, board)) {
              lateralPathClear = false;
              break;
            }
          }

          if (lateralPathClear) {
            validMoves.push(rightPos);
          }
        }
      }
    }

    return validMoves;
  }

  private addCaptureMovesIfValid(
    piece: GamePiece,
    board: Board,
    capturePattern: CapturePattern,
    directionMultiplier: number,
    validMoves: Position[],
  ): void {
    capturePattern.directions.forEach((dir) => {
      const adjustedDir = {
        dx: dir.dx,
        dy: dir.dy * directionMultiplier,
      };

      for (
        let distance = capturePattern.minDistance;
        distance <= capturePattern.maxDistance;
        distance++
      ) {
        if (!piece.position) continue;
        const newX = piece.position.x + adjustedDir.dx * distance;
        const newY = piece.position.y + adjustedDir.dy * distance;

        // Skip if coordinates are negative (out of bounds)
        if (newX < 0 || newY < 0) continue;

        const newPos = new Position(newX, newY);

        if (!board.isValidPosition(newPos)) continue;

        const targetPiece = board.getPieceAt(newPos);
        if (!targetPiece || targetPiece.owner === piece.owner) continue;

        if (!this.canPassThrough(piece, newPos, board)) continue;

        if (!validMoves.some((pos) => pos.equals(newPos))) {
          validMoves.push(newPos);
        }
      }
    });
  }

  private isPathClear(from: Position, to: Position, board: Board, piece: GamePiece): boolean {
    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;
    const forwardSteps = Math.abs(deltaY);

    if (forwardSteps <= 1 && Math.abs(deltaX) <= 1) return true;

    const stepY = deltaY === 0 ? 0 : deltaY / Math.abs(deltaY);

    // L-shape pieces move forward first, then laterally at the end:
    // check each forward position (staying in same column until final step)
    if (this.config[piece.type].lShape) {
      for (let i = 1; i < forwardSteps; i++) {
        const checkX = from.x;
        const checkY = from.y + stepY * i;

        if (checkX < 0 || checkY < 0) return false;

        const checkPos = new Position(checkX, checkY);

        // Check if there's a piece blocking
        if (board.getPieceAt(checkPos)) {
          return false;
        }

        // Check if this position is blocked by a side-blocker
        if (!this.canPassThrough(piece, checkPos, board)) {
          return false;
        }
      }
      return true;
    }

    // For other pieces: check diagonal path
    const stepX = deltaX === 0 ? 0 : deltaX / Math.abs(deltaX);
    const steps = Math.max(Math.abs(deltaX), Math.abs(deltaY));

    for (let i = 1; i < steps; i++) {
      const newX = from.x + stepX * i;
      const newY = from.y + stepY * i;

      if (newX < 0 || newY < 0) return false;

      const checkPos = new Position(newX, newY);
      if (board.getPieceAt(checkPos)) {
        return false;
      }

      if (!this.canPassThrough(piece, checkPos, board)) {
        return false;
      }
    }

    return true;
  }

  isValidMove(context: MoveValidationContext): boolean {
    const validMoves = this.getValidMoves(context.piece, context.board);
    return validMoves.some((pos) => pos.equals(context.to));
  }

  getBlockedMoves(piece: GamePiece, board: Board): Position[] {
    if (!piece.position) return [];

    const blockedPositions: Position[] = [];
    const config = this.config[piece.type];
    const directionMultiplier = piece.getDirectionMultiplier();

    // L-shape pieces: if forward position is blocked, ALL moves are blocked
    if (config.lShape) {
      const startX = piece.position.x;
      const startY = piece.position.y;
      const maxTotalDistance = config.maxTotalDistance ?? config.movement.maxDistance;
      const maxLateralDistance = config.maxLateral ?? 1;

      const forwardY = startY + directionMultiplier;

      if (forwardY >= 0) {
        const forwardPos = new Position(startX, forwardY);
        if (board.isValidPosition(forwardPos)) {
          const forwardPiece = board.getPieceAt(forwardPos);
          const canPassForward = this.canPassThrough(piece, forwardPos, board);

          // If forward position is blocked (by piece or side-blocker), ALL potential moves are blocked
          if (forwardPiece !== undefined || !canPassForward) {
            // Add all potential L-shape move positions as blocked
            for (let fwd = 1; fwd <= maxTotalDistance; fwd++) {
              const fwdY = startY + directionMultiplier * fwd;
              if (fwdY < 0) continue;

              const fwdPos = new Position(startX, fwdY);
              if (board.isValidPosition(fwdPos)) {
                blockedPositions.push(fwdPos);
              }

              // Add lateral positions
              for (let lat = 1; lat <= maxLateralDistance; lat++) {
                // Only add if total distance doesn't exceed max
                if (fwd + lat > maxTotalDistance) continue;

                // El constructor de Position lanza con coordenadas negativas:
                // hay que chequear el borde izquierdo ANTES de construir.
                const leftX = startX - lat;
                if (leftX >= 0) {
                  const leftPos = new Position(leftX, fwdY);
                  if (board.isValidPosition(leftPos)) {
                    blockedPositions.push(leftPos);
                  }
                }

                const rightPos = new Position(startX + lat, fwdY);
                if (board.isValidPosition(rightPos)) {
                  blockedPositions.push(rightPos);
                }
              }
            }

            return blockedPositions;
          }
        }
      }

      // For L-shape pieces, return empty blocked positions if forward is not blocked
      // (getValidMoves already handles all the blocking logic)
      return [];
    }

    const checkPattern = (pattern: PatternWithClearPath) => {
      pattern.directions.forEach((dir) => {
        const adjustedDir = {
          dx: dir.dx,
          dy: dir.dy * directionMultiplier,
        };

        for (let distance = pattern.minDistance; distance <= pattern.maxDistance; distance++) {
          const newX = piece.position!.x + adjustedDir.dx * distance;
          const newY = piece.position!.y + adjustedDir.dy * distance;

          if (newX < 0 || newY < 0) continue;

          const newPos = new Position(newX, newY);
          if (!board.isValidPosition(newPos)) continue;

          const targetPiece = board.getPieceAt(newPos);
          const isOccupied = targetPiece !== undefined;

          // Skip if occupied by own piece or if capture not allowed
          if (isOccupied && (targetPiece.owner === piece.owner || !pattern.canCapture)) {
            continue;
          }

          // For L-shape pieces, only add to blocked if cannot pass through (side block).
          // Don't use isPathClear for diagonal moves since L-shape isn't diagonal.
          if (config.lShape) {
            const canPass = this.canPassThrough(piece, newPos, board);
            if (!canPass) {
              blockedPositions.push(newPos);
            }
          } else {
            // For other pieces, check both path and side-blockers
            const pathClear = this.isPathClear(piece.position!, newPos, board, piece);
            const canPass = this.canPassThrough(piece, newPos, board);

            if (!pathClear || !canPass) {
              blockedPositions.push(newPos);
            }
          }
        }
      });
    };

    checkPattern(config.movement);

    if (config.alternativeMovement) {
      checkPattern(config.alternativeMovement);
    }

    return blockedPositions;
  }

  canPassThrough(piece: GamePiece, targetPosition: Position, board: Board): boolean {
    const blockers = this.findBlockingPieces(piece, targetPosition, board);

    for (const blocker of blockers) {
      if (!this.canBypassBlocker(piece, blocker, targetPosition, board)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Casillas que `piece` capturaría si hubiera una pieza rival ahí: el patrón
   * de captura filtrado por los bloqueos, evaluados como si el destino tuviera
   * un rival (respeta `captureIgnoresSideBlock`).
   */
  getCaptureSquares(piece: GamePiece, board: Board): Position[] {
    if (!piece.position) return [];
    const capture = this.config[piece.type].capture;
    if (!capture) return [];

    const directionMultiplier = piece.getDirectionMultiplier();
    const squares: Position[] = [];

    for (const dir of capture.directions) {
      for (let distance = capture.minDistance; distance <= capture.maxDistance; distance++) {
        const newX = piece.position.x + dir.dx * distance;
        const newY = piece.position.y + dir.dy * directionMultiplier * distance;

        // Position lanza con coordenadas negativas: chequear bordes antes.
        if (newX < 0 || newY < 0) continue;

        const newPos = new Position(newX, newY);
        if (!board.isValidPosition(newPos)) continue;
        if (!this.canPassThroughAsCapture(piece, newPos, board)) continue;

        if (!squares.some((pos) => pos.equals(newPos))) {
          squares.push(newPos);
        }
      }
    }

    return squares;
  }

  /** `canPassThrough` evaluado como si el destino tuviera una pieza rival. */
  private canPassThroughAsCapture(
    piece: GamePiece,
    targetPosition: Position,
    board: Board,
  ): boolean {
    // Si capturar ignora el bloqueo lateral, la casilla siempre es amenazada.
    if (this.config[piece.type].captureIgnoresSideBlock) return true;

    const blockers = this.findBlockingPieces(piece, targetPosition, board);
    for (const blocker of blockers) {
      if (!this.canBypassBlocker(piece, blocker, targetPosition, board)) {
        return false;
      }
    }
    return true;
  }

  private findBlockingPieces(
    piece: GamePiece,
    targetPosition: Position,
    board: Board,
  ): GamePiece[] {
    const blockers: GamePiece[] = [];
    const allPieces = board.getAllPieces();

    for (const potentialBlocker of allPieces) {
      if (potentialBlocker.owner === piece.owner) continue;
      if (!potentialBlocker.position) continue;

      const blockerConfig = this.config[potentialBlocker.type];
      if (!blockerConfig.blocksSides || !blockerConfig.blockedSideOffsets) continue;

      const directionMultiplier = potentialBlocker.getDirectionMultiplier();
      const blockedPositions = blockerConfig.blockedSideOffsets
        .map((offset) => {
          const newX = potentialBlocker.position!.x + offset.dx;
          const newY = potentialBlocker.position!.y + offset.dy * directionMultiplier;

          // Skip if coordinates are negative (out of bounds)
          if (newX < 0 || newY < 0) return null;

          return new Position(newX, newY);
        })
        .filter((pos): pos is Position => pos !== null);

      if (blockedPositions.some((pos) => pos.equals(targetPosition))) {
        blockers.push(potentialBlocker);
      }
    }

    return blockers;
  }

  private canBypassBlocker(
    movingPiece: GamePiece,
    blocker: GamePiece,
    targetPosition: Position,
    board: Board,
  ): boolean {
    const moverConfig = this.config[movingPiece.type];

    // Capture that ignores the side block: allowed only onto an enemy piece.
    if (moverConfig.captureIgnoresSideBlock) {
      const targetPiece = board.getPieceAt(targetPosition);
      if (targetPiece && targetPiece.owner !== movingPiece.owner) {
        return true;
      }
    }

    if (moverConfig.canBypassBlocker) {
      const directionMultiplier = movingPiece.getDirectionMultiplier();
      // Distance from the mover to the blocker (in forward direction)
      const blockerDeltaY = (blocker.position!.y - movingPiece.position!.y) * directionMultiplier;

      // The mover can only bypass the blocker if it's at MORE than the
      // minimum distance ahead — closer (or behind) means blocked.
      return blockerDeltaY >= (moverConfig.bypassMinDistance ?? 2);
    }

    return false;
  }
}
