export type LeafletLatLng = readonly [number, number]
export type LeafletBoundsInput = readonly [LeafletLatLng, LeafletLatLng]
export type LeafletPoint = { x: number; y: number }
export type LeafletPadding = readonly [number, number]

export interface LeafletBounds {
  pad(ratio: number): LeafletBounds
  isValid(): boolean
}

export interface LeafletLayer {
  addTo(target: LeafletMap | LeafletLayerGroup): this
}

export interface LeafletLayerGroup extends LeafletLayer {
  clearLayers(): this
}

export interface LeafletTileLayer extends LeafletLayer {
  on(event: 'tileerror' | 'tileload', listener: () => void): this
  setOpacity(opacity: number): this
  setUrl(url: string): this
}

export interface LeafletGeoJSONLayer extends LeafletLayer {
  getBounds(): LeafletBounds
}

export interface LeafletMap {
  setView(center: LeafletLatLng, zoom: number, options?: { animate?: boolean }): this
  setMinZoom(zoom: number): this
  invalidateSize(options?: { pan?: boolean; debounceMoveend?: boolean }): this
  fitBounds(bounds: LeafletBounds, options?: { padding?: LeafletPadding; maxZoom?: number; animate?: boolean; duration?: number }): this
  getSize(): LeafletPoint
  latLngToContainerPoint(point: LeafletLatLng): LeafletPoint
  whenReady(callback: () => void): this
  on(events: string, callback: () => void): this
  off(events: string, callback: () => void): this
  scrollWheelZoom: { enable(): void; disable(): void }
  _loaded?: boolean
}

export interface LeafletApi {
  map(element: HTMLElement, options?: Record<string, boolean | number | LeafletBounds | string>): LeafletMap
  latLngBounds(bounds: LeafletBoundsInput): LeafletBounds
  control: { zoom(options?: { position?: string }): { addTo(map: LeafletMap): LeafletLayer } }
  tileLayer(url: string, options?: { maxZoom?: number; opacity?: number; attribution?: string }): LeafletTileLayer
  layerGroup(): LeafletLayerGroup
  geoJSON(feature: object, options?: {
    interactive?: boolean
    style?: object | ((feature: { properties?: Record<string, string | number | boolean | null> } | undefined) => object)
  }): LeafletGeoJSONLayer
  polygon(points: readonly LeafletLatLng[], options?: Record<string, string | number | boolean>): LeafletLayer
  circle(center: LeafletLatLng, options?: Record<string, string | number | boolean>): LeafletLayer
}
