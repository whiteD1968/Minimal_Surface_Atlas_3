import * as THREE from 'three'

export interface BatwingSettings {
  t0: number
  t1: number
  t2: number
  t3: number
}

export type TpmsGeometryType = 'batwing' | 'schwarz-p' | 'scherk-1' | 'scherk-2' | 'neovius'
export type BatwingFamilyType = 'classic' | 'mirror-x' | 'mirror-z' | 'mirror-xz' | 'checker'

export type QuadFace = [number, number, number, number]
type EdgePair = [number, number]

type BatwingMeshData = {
  vertices: THREE.Vector3[]
  indices: number[]
  quadFaces: QuadFace[]
}

export type BatwingQuadMeshData = {
  vertices: THREE.Vector3[]
  quadFaces: QuadFace[]
}

export const BATWING_BOX_DIMENSIONS = {
  width: 3.6,
  depth: 3.6,
  height: 3.6,
} as const

const SOURCE_VERTEX_COUNT = 4
const SOURCE_VERTEX_TOTAL = SOURCE_VERTEX_COUNT * 2

export function buildBatwingGeometry(settings: BatwingSettings): THREE.BufferGeometry {
  const meshData = buildBatwingMeshData(settings, 'batwing')
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(meshData.vertices.length * 3)

  for (let index = 0; index < meshData.vertices.length; index += 1) {
    const position = meshData.vertices[index]
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y) || !Number.isFinite(position.z)) {
      throw new Error(`Batwing geometry produced a non-finite vertex at index ${index}.`)
    }

    positions[index * 3 + 0] = position.x
    positions[index * 3 + 1] = position.y
    positions[index * 3 + 2] = position.z
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setIndex(meshData.indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  geometry.userData.batwing = {
    vertexCount: meshData.vertices.length,
    indexCount: meshData.indices.length,
    quadCount: meshData.quadFaces.length,
  }

  return geometry
}

export function buildBatwingQuadMeshData(settings: BatwingSettings): BatwingQuadMeshData {
  const meshData = buildBatwingMeshData(settings, 'batwing')
  return {
    vertices: meshData.vertices.map((vertex) => vertex.clone()),
    quadFaces: meshData.quadFaces.map(([a, b, c, d]) => [a, b, c, d]),
  }
}

export function buildBatwingWireGeometry(settings: BatwingSettings): THREE.BufferGeometry {
  const meshData = buildBatwingMeshData(settings, 'batwing')
  const edgePairs = buildUniqueQuadEdges(meshData.quadFaces)
  const positions = new Float32Array(edgePairs.length * 2 * 3)

  for (let index = 0; index < edgePairs.length; index += 1) {
    const [a, b] = edgePairs[index]
    const start = meshData.vertices[a]
    const end = meshData.vertices[b]
    const offset = index * 6
    positions[offset + 0] = start.x
    positions[offset + 1] = start.y
    positions[offset + 2] = start.z
    positions[offset + 3] = end.x
    positions[offset + 4] = end.y
    positions[offset + 5] = end.z
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.computeBoundingSphere()
  return geometry
}

export function createBatwingBoxGuideGeometry(): THREE.BufferGeometry {
  const vertices = createSourceVertices()
  const edges: EdgePair[] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ]
  const positions = new Float32Array(edges.length * 2 * 3)

  for (let index = 0; index < edges.length; index += 1) {
    const [a, b] = edges[index]
    const start = vertices[a]
    const end = vertices[b]
    const offset = index * 6
    positions[offset + 0] = start.x
    positions[offset + 1] = start.y
    positions[offset + 2] = start.z
    positions[offset + 3] = end.x
    positions[offset + 4] = end.y
    positions[offset + 5] = end.z
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.computeBoundingSphere()
  return geometry
}

export function buildTpmsQuadMeshData(
  settings: BatwingSettings,
  geometryType: TpmsGeometryType,
  batwingFamily: BatwingFamilyType = 'classic',
): BatwingQuadMeshData {
  const meshData = buildBatwingMeshData(settings, geometryType, batwingFamily)
  return {
    vertices: meshData.vertices.map((vertex) => vertex.clone()),
    quadFaces: meshData.quadFaces.map(([a, b, c, d]) => [a, b, c, d]),
  }
}

function buildBatwingMeshData(
  settings: BatwingSettings,
  geometryType: TpmsGeometryType,
  batwingFamily: BatwingFamilyType = 'classic',
): BatwingMeshData {
  const t0 = expandSetting(settings.t0)
  const t1 = expandSetting(settings.t1)
  const t2 = expandSetting(settings.t2)
  const t3 = expandSetting(settings.t3)
  const mv = createSourceVertices(geometryType, batwingFamily)
  const ep: THREE.Vector3[] = []
  const fv: THREE.Vector3[] = []
  const np: THREE.Vector3[] = []
  const tv: THREE.Vector3[] = []
  const tve: THREE.Vector3[] = []
  const edgePointLookup = new Map<string, number>()
  const vertexMask = new Array<number>(SOURCE_VERTEX_COUNT).fill(0)
  const edgeLoop = appendPrepend(SOURCE_VERTEX_COUNT - 1)

  for (let step = 0; step <= SOURCE_VERTEX_COUNT - 1; step += 1) {
    const ua = edgeLoop[step]
    const va = edgeLoop[step + 1]
    const ub = ua + SOURCE_VERTEX_COUNT
    const vb = va + SOURCE_VERTEX_COUNT
    const sideCenter = averagePoints([mv[ua], mv[va], mv[ub], mv[vb]])

    if (vertexMask[ua] === 0) {
      vertexMask[ua] = step < 2 ? 1 : 2
    }

    if (step < 2) {
      const topCenterPoint = addPoint(ep, lerpPoint(sideCenter, mv[va], t1[va]))
      edgePointLookup.set(edgeKey(ua, va, 0), topCenterPoint)
      edgePointLookup.set(edgeKey(va, ua, 0), topCenterPoint)

      const bottomCenterPoint = addPoint(ep, lerpPoint(sideCenter, mv[ub], t1[ub]))
      edgePointLookup.set(edgeKey(vb, ub, 0), bottomCenterPoint)
      edgePointLookup.set(edgeKey(ub, vb, 0), bottomCenterPoint)

      const topEdgePoint = addPoint(ep, lerpPoint(mv[ua], mv[va], t0[ua]))
      edgePointLookup.set(edgeKey(ua, va, 1), topEdgePoint)
      edgePointLookup.set(edgeKey(va, ua, 1), topEdgePoint)

      const bottomEdgePoint = addPoint(ep, lerpPoint(mv[vb], mv[ub], t0[vb]))
      edgePointLookup.set(edgeKey(vb, ub, 1), bottomEdgePoint)
      edgePointLookup.set(edgeKey(ub, vb, 1), bottomEdgePoint)
    } else {
      const topCenterPoint = addPoint(ep, lerpPoint(sideCenter, mv[ua], t1[ua]))
      edgePointLookup.set(edgeKey(ua, va, 0), topCenterPoint)
      edgePointLookup.set(edgeKey(va, ua, 0), topCenterPoint)

      const bottomCenterPoint = addPoint(ep, lerpPoint(sideCenter, mv[vb], t1[vb]))
      edgePointLookup.set(edgeKey(vb, ub, 0), bottomCenterPoint)
      edgePointLookup.set(edgeKey(ub, vb, 0), bottomCenterPoint)

      const topEdgePoint = addPoint(ep, lerpPoint(mv[va], mv[ua], t0[va]))
      edgePointLookup.set(edgeKey(ua, va, 1), topEdgePoint)
      edgePointLookup.set(edgeKey(va, ua, 1), topEdgePoint)

      const bottomEdgePoint = addPoint(ep, lerpPoint(mv[ub], mv[vb], t0[ub]))
      edgePointLookup.set(edgeKey(vb, ub, 1), bottomEdgePoint)
      edgePointLookup.set(edgeKey(ub, vb, 1), bottomEdgePoint)
    }
  }

  for (let index = 0; index < SOURCE_VERTEX_COUNT; index += 1) {
    if (vertexMask[index] === 1) {
      np.push(lerpPoint(mv[index], mv[index + SOURCE_VERTEX_COUNT], t0[index]))
    } else {
      np.push(lerpPoint(mv[index + SOURCE_VERTEX_COUNT], mv[index], t0[index + SOURCE_VERTEX_COUNT]))
    }
  }

  const topCenter = averagePoints(mv.slice(0, SOURCE_VERTEX_COUNT))
  const bottomCenter = averagePoints(mv.slice(SOURCE_VERTEX_COUNT, SOURCE_VERTEX_TOTAL))
  const boxCenter = averagePoints([topCenter, bottomCenter])
  const t3TopAverage = t3.slice(0, SOURCE_VERTEX_COUNT).reduce((sum, value) => sum + value, 0) / SOURCE_VERTEX_COUNT
  const t3BottomAverage =
    t3.slice(SOURCE_VERTEX_COUNT, SOURCE_VERTEX_TOTAL).reduce((sum, value) => sum + value, 0) /
    SOURCE_VERTEX_COUNT

  fv.push(lerpPoint(bottomCenter, topCenter, t3TopAverage / 2))
  fv.push(lerpPoint(topCenter, bottomCenter, t3BottomAverage / 2))
  fv.push(boxCenter.clone())

  const faceLoop = appendPrepend(SOURCE_VERTEX_COUNT - 1)
  for (let step = 1; step <= SOURCE_VERTEX_COUNT; step += 1) {
    const current = faceLoop[step]
    const next = faceLoop[step + 1]
    const sideFaceCenter = averagePoints([
      mv[current],
      mv[next],
      mv[next + SOURCE_VERTEX_COUNT],
      mv[current + SOURCE_VERTEX_COUNT],
    ])
    const sideT3 =
      (t3[current] +
        t3[next] +
        t3[next + SOURCE_VERTEX_COUNT] +
        t3[current + SOURCE_VERTEX_COUNT]) /
      4

    tv.push(lerpPoint(sideFaceCenter, boxCenter, sideT3))

    if (current % 2) {
      if (step > 2) {
        tve.push(lerpPoint(mv[current], boxCenter, t2[current]))
      } else {
        tve.push(lerpPoint(mv[current + SOURCE_VERTEX_COUNT], boxCenter, t2[current + SOURCE_VERTEX_COUNT]))
      }
    } else {
      tve.push(lerpPoint(mv[current], topCenter, t1[current]))
      tve.push(lerpPoint(mv[current + SOURCE_VERTEX_COUNT], bottomCenter, t1[current + SOURCE_VERTEX_COUNT]))
    }
  }

  const faceBase = ep.length
  const verticalBase = faceBase + fv.length
  const sideBase = verticalBase + np.length
  const detailBase = sideBase + tv.length
  const quadFaces = buildQuadFaces(edgePointLookup, faceLoop, {
    faceBase,
    verticalBase,
    sideBase,
    detailBase,
  })
  const vertices = [...ep, ...fv, ...np, ...tv, ...tve]
  const indices = triangulateQuads(quadFaces)

  if (vertices.length !== 33 || quadFaces.length !== 24 || indices.length !== 144) {
    throw new Error(
      `Unexpected batwing topology: ${vertices.length} vertices, ${quadFaces.length} quads, ${indices.length} indices.`,
    )
  }

  return {
    vertices,
    indices,
    quadFaces,
  }
}

function buildQuadFaces(
  edgePointLookup: ReadonlyMap<string, number>,
  faceLoop: readonly number[],
  bases: {
    faceBase: number
    verticalBase: number
    sideBase: number
    detailBase: number
  },
): QuadFace[] {
  const quadFaces: QuadFace[] = []
  const xv = [0, 1, 2, 3]
  const f0 = bases.faceBase
  const f1 = bases.faceBase + 1
  const f2 = bases.faceBase + 2
  const n = (index: number): number => bases.verticalBase + index
  const side = (index: number): number => bases.sideBase + index
  const detail = (index: number): number => bases.detailBase + index

  for (let step = 1; step <= SOURCE_VERTEX_COUNT; step += 1) {
    const current = xv[faceLoop[step]]
    const next = xv[faceLoop[step + 1]]
    const ei0 = requireEdgePoint(edgePointLookup, current, next, 0)
    const ei1 = requireEdgePoint(
      edgePointLookup,
      current + SOURCE_VERTEX_COUNT,
      next + SOURCE_VERTEX_COUNT,
      0,
    )
    const ei2 = requireEdgePoint(edgePointLookup, current, next, 1)
    const ei3 = requireEdgePoint(
      edgePointLookup,
      current + SOURCE_VERTEX_COUNT,
      next + SOURCE_VERTEX_COUNT,
      1,
    )
    const w = side(faceLoop[step])

    if (step < 3) {
      if (step % 2) {
        quadFaces.push([w, ei0, n(xv[faceLoop[2]]), detail(2)])
        quadFaces.push([ei0, w, f2, ei2])
        quadFaces.push([ei1, w, detail(2), ei3])
        quadFaces.push([w, ei1, n(xv[faceLoop[1]]), f2])
        quadFaces.push([f1, detail(0), ei2, f2])
        quadFaces.push([f0, detail(1), ei3, detail(2)])
      } else {
        quadFaces.push([ei0, w, detail(2), n(xv[faceLoop[2]])])
        quadFaces.push([w, ei0, ei2, f2])
        quadFaces.push([w, ei1, ei3, detail(2)])
        quadFaces.push([ei1, w, f2, n(xv[faceLoop[3]])])
        quadFaces.push([detail(3), f1, f2, ei2])
        quadFaces.push([detail(4), f0, detail(2), ei3])
      }
    } else if (step % 2) {
      quadFaces.push([ei0, w, detail(5), ei2])
      quadFaces.push([w, ei0, n(xv[faceLoop[step]]), f2])
      quadFaces.push([ei1, n(xv[faceLoop[0]]), detail(5), w])
      quadFaces.push([ei1, w, f2, ei3])
      quadFaces.push([f0, detail(4), ei3, f2])
      quadFaces.push([f1, detail(3), ei2, detail(5)])
    } else {
      quadFaces.push([w, ei0, ei2, detail(5)])
      quadFaces.push([ei0, w, f2, n(xv[faceLoop[step + 1]])])
      quadFaces.push([n(xv[faceLoop[0]]), ei1, w, detail(5)])
      quadFaces.push([w, ei1, ei3, f2])
      quadFaces.push([detail(1), f0, f2, ei3])
      quadFaces.push([detail(0), f1, detail(5), ei2])
    }
  }

  return quadFaces
}

function createSourceVertices(
  geometryType: TpmsGeometryType = 'batwing',
  batwingFamily: BatwingFamilyType = 'classic',
): THREE.Vector3[] {
  const halfWidth = BATWING_BOX_DIMENSIONS.width / 2
  const halfDepth = BATWING_BOX_DIMENSIONS.depth / 2
  const halfHeight = BATWING_BOX_DIMENSIONS.height / 2
  const topY = halfHeight
  const bottomY = -halfHeight

  const baseVertices = [
    new THREE.Vector3(-halfWidth, topY, -halfDepth),
    new THREE.Vector3(halfWidth, topY, -halfDepth),
    new THREE.Vector3(halfWidth, topY, halfDepth),
    new THREE.Vector3(-halfWidth, topY, halfDepth),
    new THREE.Vector3(-halfWidth, bottomY, -halfDepth),
    new THREE.Vector3(halfWidth, bottomY, -halfDepth),
    new THREE.Vector3(halfWidth, bottomY, halfDepth),
    new THREE.Vector3(-halfWidth, bottomY, halfDepth),
  ]

  if (geometryType === 'batwing') {
    return applyBatwingFamily(baseVertices, batwingFamily)
  }

  return baseVertices.map((vertex) => warpVertexForTpms(vertex, geometryType, halfWidth, halfHeight, halfDepth))
}

function applyBatwingFamily(vertices: THREE.Vector3[], family: BatwingFamilyType): THREE.Vector3[] {
  if (family === 'classic') {
    return vertices
  }

  return vertices.map((vertex) => {
    if (family === 'mirror-x') {
      return new THREE.Vector3(-vertex.x, vertex.y, vertex.z)
    }
    if (family === 'mirror-z') {
      return new THREE.Vector3(vertex.x, vertex.y, -vertex.z)
    }
    if (family === 'mirror-xz') {
      return new THREE.Vector3(-vertex.x, vertex.y, -vertex.z)
    }

    // Checker family: pure half-turn in the xz plane.
    // Keep y unchanged so vertical array seams remain periodic and weld cleanly.
    return new THREE.Vector3(-vertex.x, vertex.y, -vertex.z)
  })
}

function warpVertexForTpms(
  vertex: THREE.Vector3,
  geometryType: TpmsGeometryType,
  halfWidth: number,
  halfHeight: number,
  halfDepth: number,
): THREE.Vector3 {
  const nx = vertex.x / Math.max(halfWidth, Number.EPSILON)
  const ny = vertex.y / Math.max(halfHeight, Number.EPSILON)
  const nz = vertex.z / Math.max(halfDepth, Number.EPSILON)
  const domainScale = 1.35
  const x = nx * Math.PI * domainScale
  const y = ny * Math.PI * domainScale
  const z = nz * Math.PI * domainScale
  const displacement = evaluateTpmsDisplacement(geometryType, x, y, z)
  const offsetScale = 0.22
  return new THREE.Vector3(
    vertex.x + displacement.x * halfWidth * offsetScale,
    vertex.y + displacement.y * halfHeight * offsetScale,
    vertex.z + displacement.z * halfDepth * offsetScale,
  )
}

function evaluateTpmsField(geometryType: TpmsGeometryType, x: number, y: number, z: number): number {
  switch (geometryType) {
    case 'schwarz-p':
      return Math.cos(x) + Math.cos(y) + Math.cos(z)
    case 'scherk-1':
      return Math.exp(z * 0.2) * Math.cos(x) - Math.cos(y)
    case 'scherk-2':
      return Math.sin(z) - Math.sinh(x * 0.2) * Math.sinh(y * 0.2)
    case 'neovius':
      return 3 * (Math.cos(x) + Math.cos(y) + Math.cos(z)) + 4 * Math.cos(x) * Math.cos(y) * Math.cos(z)
    default:
      return 0
  }
}

function evaluateTpmsDisplacement(
  geometryType: TpmsGeometryType,
  x: number,
  y: number,
  z: number,
): THREE.Vector3 {
  const phase = Math.PI / 3
  const fx = evaluateTpmsField(geometryType, x + phase, y, z)
  const fy = evaluateTpmsField(geometryType, x, y + phase, z)
  const fz = evaluateTpmsField(geometryType, x, y, z + phase)
  return new THREE.Vector3(Math.tanh(fx), Math.tanh(fy), Math.tanh(fz))
}

function appendPrepend(maxIndex: number): number[] {
  const values = Array.from({ length: maxIndex + 1 }, (_value, index) => index)
  values.push(0)
  values.unshift(maxIndex)
  return values
}

function expandSetting(value: number): number[] {
  const clampedValue = THREE.MathUtils.clamp(value, 0, 1)
  return Array.from({ length: SOURCE_VERTEX_TOTAL }, () => clampedValue)
}

function addPoint(points: THREE.Vector3[], point: THREE.Vector3): number {
  const index = points.length
  points.push(point)
  return index
}

function lerpPoint(origin: THREE.Vector3, target: THREE.Vector3, t: number): THREE.Vector3 {
  return origin.clone().lerp(target, THREE.MathUtils.clamp(t, 0, 1))
}

function averagePoints(points: readonly THREE.Vector3[]): THREE.Vector3 {
  const average = new THREE.Vector3()
  for (const point of points) {
    average.add(point)
  }

  return average.multiplyScalar(1 / points.length)
}

function edgeKey(a: number, b: number, selector: number): string {
  return `${a},${b},${selector}`
}

function requireEdgePoint(
  edgePointLookup: ReadonlyMap<string, number>,
  a: number,
  b: number,
  selector: number,
): number {
  const key = edgeKey(a, b, selector)
  const index = edgePointLookup.get(key)
  if (index === undefined) {
    throw new Error(`Missing batwing edge point ${key}.`)
  }

  return index
}

function triangulateQuads(quadFaces: readonly QuadFace[]): number[] {
  const indices: number[] = []
  for (const [a, b, c, d] of quadFaces) {
    indices.push(a, b, c, a, c, d)
  }

  return indices
}

function buildUniqueQuadEdges(quadFaces: readonly QuadFace[]): EdgePair[] {
  const edges: EdgePair[] = []
  const seen = new Set<string>()

  const addEdge = (a: number, b: number): void => {
    const min = Math.min(a, b)
    const max = Math.max(a, b)
    const key = `${min},${max}`
    if (seen.has(key)) {
      return
    }

    seen.add(key)
    edges.push([a, b])
  }

  for (const [a, b, c, d] of quadFaces) {
    addEdge(a, b)
    addEdge(b, c)
    addEdge(c, d)
    addEdge(d, a)
  }

  return edges
}
