import { Icon } from 'leaflet'

export default function getDeviceMarkers(status, Icons) {
  const size = Icons.getSize('device')
  const { offsetX, offsetY, popupX, popupY, sizeMultiplier } = Icons.getModifiers('device')
  return new Icon({
    iconUrl: Icons.getMisc(status),
    iconSize: [size * sizeMultiplier, size * sizeMultiplier],
    iconAnchor: [20 * offsetX, 33.96 * offsetY],
    popupAnchor: [-5 + popupX, -37 + popupY],
    className: 'marker',
  })
}
