export interface SeatPosition {
  x: number
  y: number
  cardOffsetX: number
  cardOffsetY: number
  betOffsetX: number
  betOffsetY: number
}

/**
 * Calculate seat positions around an elliptical table.
 * Self (mySeatIndex) is always at bottom center (angle = PI/2).
 * Returns a map from seatIndex -> SeatPosition.
 */
export function calculateSeatPositions(
  mySeatIndex: number,
  totalSeats: number,
  tableWidth: number,
  tableHeight: number,
  centerX: number,
  centerY: number,
): Map<number, SeatPosition> {
  const positions = new Map<number, SeatPosition>()

  // Ellipse radii — slightly larger than the felt so players sit on the rim
  const rx = tableWidth * 0.46
  const ry = tableHeight * 0.42

  // Self is at the bottom, i.e. angle = PI/2 (pointing downward in canvas coords)
  const selfAngle = Math.PI / 2

  for (let i = 0; i < totalSeats; i++) {
    // How many seats away from self (clockwise)
    const offset = ((i - mySeatIndex) % totalSeats + totalSeats) % totalSeats
    // Distribute evenly; self at angle PI/2, others go counter-clockwise visually
    const angle = selfAngle - (2 * Math.PI * offset) / totalSeats

    const x = centerX + rx * Math.cos(angle)
    const y = centerY + ry * Math.sin(angle)

    // Toward center: unit vector pointing from seat to center
    const dx = centerX - x
    const dy = centerY - y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const nx = dx / dist
    const ny = dy / dist

    const cardOffsetX = nx * 30
    const cardOffsetY = ny * 30

    const betOffsetX = nx * 55
    const betOffsetY = ny * 55

    positions.set(i, { x, y, cardOffsetX, cardOffsetY, betOffsetX, betOffsetY })
  }

  return positions
}
