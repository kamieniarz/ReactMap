// @ts-check
import * as React from 'react'

import { ScanBlocks } from './Blocks'
import { useCheckValid } from '../hooks/useCheckValid'
import { ScanNextPopup } from './PopupContent'
import { ScanOnDemandMarker } from '../Marker'
import { ScanOnDemandPopup } from '../Popup'
import { useScanStore } from '../hooks/store'

/**
 * @returns {JSX.Element}
 */
export function ScanNext() {
  useCheckValid('scanNext')

  const scanLocation = useScanStore((s) => s.scanLocation)
  const scanNextSize = useScanStore((s) => s.scanNextSize)
  return (
    <>
      <ScanOnDemandMarker>
        <ScanOnDemandPopup mode="scanNext">
          <ScanNextPopup />
        </ScanOnDemandPopup>
      </ScanOnDemandMarker>
      {/* Render S2 9x9 blocks */}
      <ScanBlocks />
    </>
  )
}
