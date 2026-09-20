import { GamePiece } from "../../domain/entities/GamePiece";
import { Position } from "../../domain/entities/Position";
import { Board } from "../../domain/entities/Board";
import { IMovementRule, MoveValidationContext } from "../../domain/interfaces/IMovementRule";
import {
  PIECE_MOVEMENT_CONFIG,
  PieceType,
  MovementPattern,
  CapturePattern,
} from "../../domain/constants/PieceConstants";

export class MovementRuleEngine implements IMovementRule {
  getValidMoves(piece: GamePiece, board: Board): Position[] {
    // Bench pieces don't have a position on the board
    if (!piece.position) {
      return [];
    }

    // Special handling for PIONEER - uses L-shape movement (forward first, then lateral)
    if (piece.type === PieceType.PIONEER) {
      return this.getPioneerValidMoves(piece, board);
    }

    const validMoves: Position[] = [];
    const config = PIECE_MOVEMENT_CONFIG[piece.type];
    const directionMultiplier = piece.getDirectionMultiplier();

    const checkMovementPattern = (pattern: MovementPattern, isAlternative = false) => {
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

          // Check if path is clear for STRIKER alternative movement
          if (piece.position) {
            if (piece.type === PieceType.STRIKER && isAlternative) {
              if (!this.isPathClear(piece.position, newPos, board, piece)) continue;
            }
          }

          validMoves.push(newPos);
        }
      });
    };

    checkMovementPattern(config.movement);

    if ("alternativeMovement" in config && config.alternativeMovement) {
      checkMovementPattern(config.alternativeMovement, true);
    }

    if ("capture" in config && config.capture) {
      this.addCaptureMovesIfValid(piece, board, config.capture, directionMultiplier, validMoves);
    }

    return validMoves;
  }

  /**
   * Special movement logic for PIONEER piece:
   * - MUST move at least 1 square forward (required)
   * - CAN move laterally (optional) but only AFTER moving forward
   * - Maximum 3 squares total (forward + lateral)
   * - Does NOT move diagonally - moves in L-shape (forward then lateral)
   * - Path must be clear of pieces and blocks
   */
  private getPioneerValidMoves(piece: GamePiece, board: Board): Position[] {
    const validMoves: Position[] = [];
    const directionMultiplier = piece.getDirectionMultiplier();
    const startX = piece.position!.x;
    const startY = piece.position!.y;
    const maxTotalDistance = 3;

    // First, check if the first forward position is blocked
    const firstForwardY = startY + directionMultiplier;
    if (firstForwardY < 0) return [];

    const firstForwardPos = new Position(startX, firstForwardY);
    if (!board.isValidPosition(firstForwardPos)) return [];

    // Check if first forward position is blocked by a piece
    if (board.getPieceAt(firstForwardPos)) return [];

    // Check if first forward position is blocked by Fort/Striker
    if (!this.canPassThrough(piece, firstForwardPos, board)) return [];

    // Generate all valid L-shape moves
    // For each forward distance (1, 2, or 3), check if we can move there
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

        // Check for Fort/Striker blocking
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
      // PIONEER can only move max 1 square laterally
      const maxLateralDistance = 1;

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

              // Check for Fort/Striker blocking
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

            // Check for Fort/Striker blocking
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

    // For PIONEER: check each forward step in the path
    // PIONEER moves forward first, then can move laterally at the end
    if (piece.type === PieceType.PIONEER) {
      // Check each forward position (staying in same column until final step)
      for (let i = 1; i < forwardSteps; i++) {
        const checkX = from.x;
        const checkY = from.y + stepY * i;

        if (checkX < 0 || checkY < 0) return false;

        const checkPos = new Position(checkX, checkY);

        // Check if there's a piece blocking
        if (board.getPieceAt(checkPos)) {
          return false;
        }

        // Check if this position is blocked by Fort
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
    const config = PIECE_MOVEMENT_CONFIG[piece.type];
    const directionMultiplier = piece.getDirectionMultiplier();

    // Special handling for PIONEER: if forward position is blocked, ALL moves are blocked
    if (piece.type === PieceType.PIONEER) {
      const startX = piece.position.x;
      const startY = piece.position.y;
      const maxTotalDistance = 3;

      const forwardY = startY + directionMultiplier;

      if (forwardY >= 0) {
        const forwardPos = new Position(startX, forwardY);
        if (board.isValidPosition(forwardPos)) {
          const forwardPiece = board.getPieceAt(forwardPos);
          const canPassForward = this.canPassThrough(piece, forwardPos, board);

          // If forward position is blocked (by piece or Fort/Striker), ALL potential moves are blocked
          if (forwardPiece !== undefined || !canPassForward) {
            // Add all potential L-shape move positions as blocked
            for (let fwd = 1; fwd <= maxTotalDistance; fwd++) {
              const fwdY = startY + directionMultiplier * fwd;
              if (fwdY < 0) continue;

              const fwdPos = new Position(startX, fwdY);
              if (board.isValidPosition(fwdPos)) {
                blockedPositions.push(fwdPos);
              }

              // Add lateral positions (max 1 square lateral for PIONEER)
              const maxLateralDistance = 1;
              for (let lat = 1; lat <= maxLateralDistance; lat++) {
                // Only add if total distance doesn't exceed max
                if (fwd + lat > maxTotalDistance) continue;

                const leftPos = new Position(startX - lat, fwdY);
                const rightPos = new Position(startX + lat, fwdY);

                if (board.isValidPosition(leftPos)) {
                  blockedPositions.push(leftPos);
                }
                if (board.isValidPosition(rightPos)) {
                  blockedPositions.push(rightPos);
                }
              }
            }

            return blockedPositions;
          }
        }
      }

      // For PIONEER, return empty blocked positions if forward is not blocked
      // (the getValidMoves function already handles all the blocking logic)
      return [];
    }

    const checkPattern = (pattern: MovementPattern) => {
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

          // For PIONEER, only add to blocked if cannot pass through (Fort blocking)
          // Don't use isPathClear for diagonal moves since PIONEER doesn't move diagonally
          if (piece.type === PieceType.PIONEER) {
            const canPass = this.canPassThrough(piece, newPos, board);
            if (!canPass) {
              blockedPositions.push(newPos);
            }
          } else {
            // For other pieces, check both path and Fort blocking
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

  private findBlockingPieces(
    piece: GamePiece,
    targetPosition: Position,
    board: Board,
  ): GamePiece[] {
    const blockers: GamePiece[] = [];
    const allPieces = board.getAllPieces();

    for (const potentialBlocker of allPieces) {
      if (potentialBlocker.owner === piece.owner) continue;

      // Only FORT can block sides
      if (potentialBlocker.type !== PieceType.FORT) continue;

      const config = PIECE_MOVEMENT_CONFIG[potentialBlocker.type];
      if (!config.blocksSides) continue;

      const directionMultiplier = potentialBlocker.getDirectionMultiplier();
      const blockedPositions = config
        .blockedSideOffsets!.map((offset) => {
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
    if (movingPiece.type === PieceType.FORT) {
      const targetPiece = board.getPieceAt(targetPosition);
      if (targetPiece && targetPiece.owner !== movingPiece.owner) {
        return true;
      }
    }

    if (movingPiece.type === PieceType.PIONEER) {
      const directionMultiplier = movingPiece.getDirectionMultiplier();
      // Distance from PIONEER to Fort (in forward direction)
      const blockerDeltaY = (blocker.position!.y - movingPiece.position!.y) * directionMultiplier;

      // PIONEER can only bypass Fort if it's at MORE than 1 row distance
      // If Fort is at 2+ rows ahead -> can bypass
      // Otherwise (0, 1 row, or behind) -> blocked
      return blockerDeltaY >= 2;
    }

    return false;
  }
}
