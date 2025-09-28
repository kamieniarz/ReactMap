// @ts-check
import * as React from 'react'
import { Polygon } from 'react-leaflet'
import { COLORS } from '../Shared'
import { useScanStore } from '../hooks/store'
import { get9x9Boundary } from './s2Grid'

/**
 * Render outer rectangles for 9x9 S2 L15 blocks (S:1, M:9, XL:25)
 */
export function ScanBlocks() {
  const scanCoords = useScanStore((s) => s.scanCoords)
  const validCoords = useScanStore((s) => s.validCoords)

  return (
    <>
      {scanCoords.map(([lat, lon], i) => {
        const rect = get9x9Boundary(lat, lon)
        const color = validCoords[i] ? COLORS.blue : COLORS.red
        return (
          <Polygon
            key={`${i}-${rect[0].join(',')}`}
            positions={[...rect, rect[0]]}
            color={color}
            fillColor={color}
            fillOpacity={0.1}
            weight={1}
          />
        )
      })}
    </>
  )
}
