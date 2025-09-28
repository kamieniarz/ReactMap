// @ts-check
import {
  S2LatLng,
  S2RegionCoverer,
  S2LatLngRect,
  S2CellId,
  S2Cell,
  S2Point,
} from 'nodes2ts'

/**
 * Return the S2 Level 15 parent cell for lat/lon
 * @param {number} lat
 * @param {number} lon
 */
export function getL15CellId(lat, lon) {
  const ll = S2LatLng.fromDegrees(lat, lon)
  return S2CellId.fromPoint(ll.toPoint()).parentL(15)
}

/**
 * Build the exact outer boundary of the 9x9 block by taking all 81 cells,
 * cancelling shared edges (edges seen twice), and walking the remaining ring.
 * @param {number} lat
 * @param {number} lon
 * @returns {import('@rm/types').S2Polygon}
 */
export function get9x9Boundary(lat, lon) {
  const cells = get9x9Cells(lat, lon)
  /** @type {Map<string, {a:[number,number], b:[number,number], count:number}>} */
  const edges = new Map()
  const addEdge = (a, b) => {
    const key = JSON.stringify(
      a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]) ? [a, b] : [b, a],
    )
    const ex = edges.get(key)
    if (ex) ex.count += 1
    else edges.set(key, { a, b, count: 1 })
  }
  for (const cell of cells) {
    const v = cell.coords
    addEdge(v[0], v[1])
    addEdge(v[1], v[2])
    addEdge(v[2], v[3])
    addEdge(v[3], v[0])
  }
  // keep only edges that appear once (outer boundary)
  /** @type {Array<{a:[number,number], b:[number,number]}>} */
  const boundary = []
  for (const { a, b, count } of edges.values())
    if (count === 1) boundary.push({ a, b })

  // Build adjacency map vertex -> neighbors
  /** @type {Map<string, [number,number][]>} */
  const adj = new Map()
  const key = (p) => `${p[0].toFixed(12)},${p[1].toFixed(12)}`
  const pushAdj = (x, y) => {
    const k = key(x)
    const arr = adj.get(k)
    if (arr) arr.push(y)
    else adj.set(k, [y])
  }
  for (const { a, b } of boundary) {
    pushAdj(a, b)
    pushAdj(b, a)
  }
  // pick start: lowest lon, then lowest lat for stability
  const verts = Array.from(adj.keys()).map((k) => k.split(',').map(Number))
  verts.sort((u, v) => (u[1] === v[1] ? u[0] - v[0] : u[1] - v[1]))
  /** @type {[number,number]} */
  let start = [verts[0][0], verts[0][1]]
  /** @type {[number,number][]} */
  const ring = [start]
  /** @type {[number,number] | null} */
  let prev = null
  for (;;) {
    const k = key(start)
    const neighbors = adj.get(k) || []
    const next = neighbors.find((n) => !prev || key(n) !== key(prev)) || null
    if (!next) break
    if (key(next) === key(ring[0])) break
    ring.push(next)
    prev = start
    start = next
    if (ring.length > 1000) break
  }
  return ring
}

/**
 * Compute convex hull of a set of [lat, lon] points (Andrew's monotone chain)
 * Returns hull in CCW order.
 * @param {[number, number][]} pts
 * @returns {[number, number][]}
 */
function convexHull(pts) {
  if (pts.length <= 1) return pts.slice()
  // sort by lon then lat for stability
  const p = pts
    .map((q) => [q[1], q[0]])
    .sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]))
    .map((q) => [q[1], q[0]])

  const cross = (o, a, b) =>
    (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1])

  const lower = []
  for (const pt of p) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], pt) <= 0
    ) {
      lower.pop()
    }
    lower.push(pt)
  }
  const upper = []
  for (let i = p.length - 1; i >= 0; i -= 1) {
    const pt = p[i]
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], pt) <= 0
    ) {
      upper.pop()
    }
    upper.push(pt)
  }
  upper.pop()
  lower.pop()
  return lower.concat(upper)
}

/**
 * Build outer polygon for the 9x9 block as convex hull of all 81 cell vertices
 * This guarantees edges meet the overlay exactly and avoids tiny numerical drifts.
 * @param {number} lat
 * @param {number} lon
 * @returns {import('@rm/types').S2Polygon}
 */
export function get9x9Hull(lat, lon) {
  const cells = get9x9Cells(lat, lon)
  /** @type {[number, number][]} */
  const verts = []
  for (const c of cells) verts.push(...c.coords)
  return convexHull(verts)
}

/**
 * Build outer rectangles for all blocks (S=1, M=3x3, XL=5x5) from a single SW origin.
 * Order matches getBlockCenters (row-major over ranges).
 * @param {[number, number]} centerLatLon
 * @param {'S'|'M'|'L'|'XL'} size
 * @returns {import('@rm/types').S2Polygon[]}
 */
export function getBlockRects(centerLatLon, size) {
  const [lat, lon] = centerLatLon
  const centerId = getL15CellId(lat, lon)
  const baseSW = moveCells(moveCells(centerId, 'W', 4), 'S', 4)
  const normalized = size === 'L' ? 'XL' : size
  const ranges =
    normalized === 'S'
      ? [0]
      : normalized === 'M'
        ? [-1, 0, 1]
        : [-2, -1, 0, 1, 2]

  /** @type {import('@rm/types').S2Polygon[]} */
  const rects = []
  for (const r of ranges) {
    for (const c of ranges) {
      let sw = baseSW
      if (r > 0) sw = moveCells(sw, 'N', r * 9)
      if (r < 0) sw = moveCells(sw, 'S', -r * 9)
      if (c > 0) sw = moveCells(sw, 'E', c * 9)
      if (c < 0) sw = moveCells(sw, 'W', -c * 9)
      // reuse ring builder by taking center of this block and calling get9x9BlockRect
      const centerCell = moveCells(moveCells(sw, 'E', 4), 'N', 4)
      const { lat: cLat, lon: cLon } = getCellCenterLatLon(centerCell)
      rects.push(get9x9BlockRect(cLat, cLon))
    }
  }
  return rects
}

/**
 * Move a given L15 cell a number of cells in a cardinal direction.
 * @param {S2CellId} cellId
 * @param {'N'|'S'|'E'|'W'} dir
 * @param {number} steps
 */
function moveCells(cellId, dir, steps) {
  let cur = cellId
  for (let i = 0; i < steps; i += 1) cur = stepNeighbor(cur, dir)
  return cur
}

function getCellCenterLatLon(cellId) {
  const rect = new S2Cell(cellId).getRectBound()
  return {
    lat: (rect.lo().latDegrees + rect.hi().latDegrees) / 2,
    lon: (rect.lo().lngDegrees + rect.hi().lngDegrees) / 2,
  }
}

/**
 * Build the polygon [ [lat,lon], ... ] for a given S2CellId
 * @param {S2CellId} cellId
 * @returns {import('@rm/types').S2Polygon}
 */
export function polygonFromCellId(cellId) {
  const cell = new S2Cell(cellId)
  /** @type {import('@rm/types').S2Polygon} */
  const poly = []
  for (let i = 0; i <= 3; i += 1) {
    const v = cell.getVertex(i)
    const p = new S2Point(v.x, v.y, v.z)
    const ll = S2LatLng.fromPoint(p)
    poly.push([ll.latDegrees, ll.lngDegrees])
  }
  return poly
}

/**
 * Compute approximate angular size (deg) of a level 15 cell at lat/lon
 * @param {number} lat
 * @param {number} lon
 */
export function getL15CellSize(lat, lon) {
  const cellId = getL15CellId(lat, lon)
  const cell = new S2Cell(cellId)
  const rect = cell.getRectBound()
  const dLat = Math.abs(rect.lo().latDegrees - rect.hi().latDegrees)
  const dLon = Math.abs(rect.lo().lngDegrees - rect.hi().lngDegrees)
  return { dLat, dLon }
}

/**
 * Step to an adjacent L15 cell by moving slightly past the current cell bound.
 * dir in { 'N','S','E','W' }
 * @param {S2CellId} cellId
 * @param {'N'|'S'|'E'|'W'} dir
 */
function stepNeighbor(cellId, dir) {
  const cell = new S2Cell(cellId)
  const rect = cell.getRectBound()
  const eps = 1e-6
  switch (dir) {
    case 'N':
      return getL15CellId(
        rect.hi().latDegrees + eps,
        (rect.lo().lngDegrees + rect.hi().lngDegrees) / 2,
      )
    case 'S':
      return getL15CellId(
        rect.lo().latDegrees - eps,
        (rect.lo().lngDegrees + rect.hi().lngDegrees) / 2,
      )
    case 'E':
      return getL15CellId(
        (rect.lo().latDegrees + rect.hi().latDegrees) / 2,
        rect.hi().lngDegrees + eps,
      )
    case 'W':
      return getL15CellId(
        (rect.lo().latDegrees + rect.hi().latDegrees) / 2,
        rect.lo().lngDegrees - eps,
      )
    default:
      return cellId
  }
}

/**
 * Get unique 9x9 grid of L15 cells centered at lat/lon (contiguous)
 * @param {number} lat
 * @param {number} lon
 * @returns {{ id: string, coords: import('@rm/types').S2Polygon }[]}
 */
export function get9x9Cells(lat, lon) {
  const centerId = getL15CellId(lat, lon)
  // get southwest corner: 4 cells west, then 4 cells south
  let southWest = centerId
  for (let i = 0; i < 4; i += 1) southWest = stepNeighbor(southWest, 'W')
  for (let i = 0; i < 4; i += 1) southWest = stepNeighbor(southWest, 'S')

  /** @type {{ id: string, coords: import('@rm/types').S2Polygon }[]} */
  const out = []
  for (let r = 0; r < 9; r += 1) {
    // start of this row = southWest moved r cells north
    let rowStart = southWest
    for (let i = 0; i < r; i += 1) rowStart = stepNeighbor(rowStart, 'N')
    let cellId = rowStart
    for (let c = 0; c < 9; c += 1) {
      const idStr = cellId.id.toString()
      out.push({ id: idStr, coords: polygonFromCellId(cellId) })
      cellId = stepNeighbor(cellId, 'E')
    }
  }
  return out
}

/**
 * Return outer rectangle polygon of the 9x9 block
 * @param {number} lat
 * @param {number} lon
 * @returns {import('@rm/types').S2Polygon}
 */
export function get9x9BlockRect(lat, lon) {
  const centerId = getL15CellId(lat, lon)
  // base SW corner cell for the 9x9 grid
  const southWest = moveCells(moveCells(centerId, 'W', 4), 'S', 4)

  // Helpers to extract edges from a cell using vertex positions
  function verts(cellId) {
    const cell = new S2Cell(cellId)
    /** @type {[number, number][]} */
    const v = []
    for (let i = 0; i < 4; i += 1) {
      const p = cell.getVertex(i)
      const ll = S2LatLng.fromPoint(p)
      v.push([ll.latDegrees, ll.lngDegrees])
    }
    return v
  }
  const byLatAsc = (a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0])
  const byLonAsc = (a, b) => (a[1] === b[1] ? a[0] - b[0] : a[1] - b[1])

  function southEdge(cellId) {
    const v = verts(cellId).slice().sort(byLatAsc).slice(0, 2).sort(byLonAsc)
    return v // [SW, SE]
  }
  function eastEdge(cellId) {
    const v = verts(cellId).slice().sort(byLonAsc).slice(2).sort(byLatAsc)
    return v // [SE, NE]
  }
  function northEdge(cellId) {
    const v = verts(cellId)
      .slice()
      .sort((a, b) => -byLatAsc(a, b))
      .slice(0, 2)
      .sort((a, b) => b[1] - a[1])
    return v // [NE, NW]
  }
  function westEdge(cellId) {
    const v = verts(cellId)
      .slice()
      .sort((a, b) => -byLonAsc(a, b))
      .slice(0, 2)
      .sort((a, b) => b[0] - a[0])
    return v // [NW, SW]
  }

  /** @type {[number, number][]} */
  const ring = []
  // South side
  let c = southWest
  const firstSouth = southEdge(c)
  ring.push(firstSouth[0])
  ring.push(firstSouth[1])
  for (let i = 1; i < 9; i += 1) {
    c = moveCells(c, 'E', 1)
    ring.push(southEdge(c)[1])
  }
  // East side
  for (let i = 0; i < 9; i += 1) {
    ring.push(eastEdge(c)[1])
    if (i < 8) c = moveCells(c, 'N', 1)
  }
  // North side
  for (let i = 0; i < 9; i += 1) {
    ring.push(northEdge(c)[1])
    if (i < 8) c = moveCells(c, 'W', 1)
  }
  // West side
  for (let i = 0; i < 9; i += 1) {
    ring.push(westEdge(c)[1])
    if (i < 8) c = moveCells(c, 'S', 1)
  }

  return ring
}

/**
 * Compute block centers for size mapping:
 * S -> 1 center, M -> 3x3, XL -> 5x5
 * Spacing equals the angular size of a 9x9 block (9 * cell size)
 * @param {[number, number]} centerLatLon
 * @param {'S'|'M'|'L'|'XL'} size
 * @returns {[number, number][]}
 */
export function getBlockCenters(centerLatLon, size) {
  const [lat, lon] = centerLatLon
  const centerId = getL15CellId(lat, lon)
  // establish a consistent SW origin for the base 9x9
  const baseSW = moveCells(moveCells(centerId, 'W', 4), 'S', 4)
  const normalized = size === 'L' ? 'XL' : size
  const ranges =
    normalized === 'S'
      ? [0]
      : normalized === 'M'
        ? [-1, 0, 1]
        : [-2, -1, 0, 1, 2]
  /** @type {[number, number][]} */
  const out = []
  for (const r of ranges) {
    for (const c of ranges) {
      // SW corner cell for this block = baseSW moved by r*9 north and c*9 east
      let blockSW = baseSW
      if (r > 0) blockSW = moveCells(blockSW, 'N', r * 9)
      if (r < 0) blockSW = moveCells(blockSW, 'S', -r * 9)
      if (c > 0) blockSW = moveCells(blockSW, 'E', c * 9)
      if (c < 0) blockSW = moveCells(blockSW, 'W', -c * 9)
      // Center cell of this 9x9 is blockSW moved 4E and 4N
      const centerCell = moveCells(moveCells(blockSW, 'E', 4), 'N', 4)
      const { lat: tLat, lon: tLon } = getCellCenterLatLon(centerCell)
      out.push([tLat, tLon])
    }
  }
  return out
}
