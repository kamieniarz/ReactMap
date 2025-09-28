// @ts-check
import { getBlockCenters } from './s2Grid'

/**
 * Get scan next coords using S2 L15 9x9 blocks
 * S -> 1 center, M -> 3x3 centers, XL -> 5x5 centers
 * @param {[number, number]} center
 * @param {import('../hooks/store').UseScanStore['scanNextSize']} size
 * @returns {import('../hooks/store').UseScanStore['scanCoords']}
 */
export const getScanNextCoords = (center, size) => {
  return getBlockCenters(center, size)
}
