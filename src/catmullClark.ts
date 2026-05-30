import * as THREE from 'three'
import type { QuadFace } from './batwingGeometry'

export type QuadMeshData = {
  vertices: THREE.Vector3[]
  quadFaces: QuadFace[]
}

type EdgeRecord = {
  a: number
  b: number
  faces: number[]
}

export function subdivideCatmullClark(sourceMesh: QuadMeshData, levels: number): QuadMeshData {
  let mesh = sourceMesh
  const safeLevels = THREE.MathUtils.clamp(Math.round(levels), 0, 3)

  for (let level = 0; level < safeLevels; level += 1) {
    mesh = subdivideCatmullClarkOnce(mesh)
  }

  return mesh
}

function subdivideCatmullClarkOnce(mesh: QuadMeshData): QuadMeshData {
  const facePoints = mesh.quadFaces.map((face) => averageVectors(face.map((index) => mesh.vertices[index])))
  const edgeRecords: EdgeRecord[] = []
  const edgeLookup = new Map<string, number>()
  const vertexFaces = Array.from({ length: mesh.vertices.length }, () => [] as number[])
  const vertexEdges = Array.from({ length: mesh.vertices.length }, () => [] as number[])

  for (let faceIndex = 0; faceIndex < mesh.quadFaces.length; faceIndex += 1) {
    const [a, b, c, d] = mesh.quadFaces[faceIndex]
    const uniqueVertices = new Set([a, b, c, d])

    for (const vertexIndex of uniqueVertices) {
      vertexFaces[vertexIndex]?.push(faceIndex)
    }

    addFaceEdge(edgeRecords, edgeLookup, vertexEdges, a, b, faceIndex)
    addFaceEdge(edgeRecords, edgeLookup, vertexEdges, b, c, faceIndex)
    addFaceEdge(edgeRecords, edgeLookup, vertexEdges, c, d, faceIndex)
    addFaceEdge(edgeRecords, edgeLookup, vertexEdges, d, a, faceIndex)
  }

  const nextVertices = mesh.vertices.map((vertex, vertexIndex) =>
    smoothOriginalVertex(vertex, vertexIndex, mesh.vertices, facePoints, edgeRecords, vertexFaces, vertexEdges),
  )
  const edgePointIndices = edgeRecords.map((edge) => {
    const index = nextVertices.length
    nextVertices.push(createEdgePoint(edge, mesh.vertices, facePoints))
    return index
  })
  const facePointIndices = facePoints.map((facePoint) => {
    const index = nextVertices.length
    nextVertices.push(facePoint.clone())
    return index
  })

  const nextQuadFaces: QuadFace[] = []
  for (let faceIndex = 0; faceIndex < mesh.quadFaces.length; faceIndex += 1) {
    const [a, b, c, d] = mesh.quadFaces[faceIndex]
    const facePoint = facePointIndices[faceIndex]
    const edgeAB = requireEdgePointIndex(edgeLookup, edgePointIndices, a, b)
    const edgeBC = requireEdgePointIndex(edgeLookup, edgePointIndices, b, c)
    const edgeCD = requireEdgePointIndex(edgeLookup, edgePointIndices, c, d)
    const edgeDA = requireEdgePointIndex(edgeLookup, edgePointIndices, d, a)

    nextQuadFaces.push([a, edgeAB, facePoint, edgeDA])
    nextQuadFaces.push([b, edgeBC, facePoint, edgeAB])
    nextQuadFaces.push([c, edgeCD, facePoint, edgeBC])
    nextQuadFaces.push([d, edgeDA, facePoint, edgeCD])
  }

  return {
    vertices: nextVertices,
    quadFaces: nextQuadFaces,
  }
}

function smoothOriginalVertex(
  vertex: THREE.Vector3,
  vertexIndex: number,
  vertices: readonly THREE.Vector3[],
  facePoints: readonly THREE.Vector3[],
  edgeRecords: readonly EdgeRecord[],
  vertexFaces: readonly number[][],
  vertexEdges: readonly number[][],
): THREE.Vector3 {
  const incidentFaceIndices = vertexFaces[vertexIndex] ?? []
  const incidentEdgeIndices = vertexEdges[vertexIndex] ?? []
  if (incidentFaceIndices.length === 0 || incidentEdgeIndices.length === 0) {
    return vertex.clone()
  }

  const boundaryNeighbors = getBoundaryNeighbors(vertexIndex, edgeRecords, incidentEdgeIndices)
  if (boundaryNeighbors.length > 0) {
    const smoothed = vertex.clone().multiplyScalar(6)
    for (const neighborIndex of boundaryNeighbors) {
      smoothed.add(vertices[neighborIndex])
    }

    return smoothed.multiplyScalar(1 / (6 + boundaryNeighbors.length))
  }

  const faceAverage = averageVectors(incidentFaceIndices.map((faceIndex) => facePoints[faceIndex]))
  const edgeAverage = averageVectors(
    incidentEdgeIndices.map((edgeIndex) => createEdgeMidpoint(edgeRecords[edgeIndex], vertices)),
  )
  const valence = incidentFaceIndices.length

  return faceAverage
    .add(edgeAverage.multiplyScalar(2))
    .add(vertex.clone().multiplyScalar(valence - 3))
    .multiplyScalar(1 / valence)
}

function createEdgePoint(
  edge: EdgeRecord,
  vertices: readonly THREE.Vector3[],
  facePoints: readonly THREE.Vector3[],
): THREE.Vector3 {
  if (edge.faces.length === 2) {
    return averageVectors([vertices[edge.a], vertices[edge.b], facePoints[edge.faces[0]], facePoints[edge.faces[1]]])
  }

  if (edge.faces.length > 2) {
    return averageVectors([
      vertices[edge.a],
      vertices[edge.b],
      ...edge.faces.map((faceIndex) => facePoints[faceIndex]),
    ])
  }

  return createEdgeMidpoint(edge, vertices)
}

function createEdgeMidpoint(edge: EdgeRecord, vertices: readonly THREE.Vector3[]): THREE.Vector3 {
  return vertices[edge.a].clone().add(vertices[edge.b]).multiplyScalar(0.5)
}

function getBoundaryNeighbors(
  vertexIndex: number,
  edgeRecords: readonly EdgeRecord[],
  incidentEdgeIndices: readonly number[],
): number[] {
  const neighbors = new Set<number>()

  for (const edgeIndex of incidentEdgeIndices) {
    const edge = edgeRecords[edgeIndex]
    if (edge.faces.length !== 1) {
      continue
    }

    const neighborIndex = edge.a === vertexIndex ? edge.b : edge.a
    if (neighborIndex !== vertexIndex) {
      neighbors.add(neighborIndex)
    }
  }

  return [...neighbors]
}

function addFaceEdge(
  edgeRecords: EdgeRecord[],
  edgeLookup: Map<string, number>,
  vertexEdges: number[][],
  a: number,
  b: number,
  faceIndex: number,
): void {
  const key = getEdgeKey(a, b)
  let edgeIndex = edgeLookup.get(key)

  if (edgeIndex === undefined) {
    edgeIndex = edgeRecords.length
    edgeLookup.set(key, edgeIndex)
    edgeRecords.push({
      a: Math.min(a, b),
      b: Math.max(a, b),
      faces: [],
    })
    vertexEdges[a]?.push(edgeIndex)
    if (a !== b) {
      vertexEdges[b]?.push(edgeIndex)
    }
  }

  const edge = edgeRecords[edgeIndex]
  if (!edge.faces.includes(faceIndex)) {
    edge.faces.push(faceIndex)
  }
}

function requireEdgePointIndex(
  edgeLookup: ReadonlyMap<string, number>,
  edgePointIndices: readonly number[],
  a: number,
  b: number,
): number {
  const edgeIndex = edgeLookup.get(getEdgeKey(a, b))
  if (edgeIndex === undefined) {
    throw new Error(`Missing Catmull-Clark edge ${a},${b}.`)
  }

  return edgePointIndices[edgeIndex]
}

function getEdgeKey(a: number, b: number): string {
  const min = Math.min(a, b)
  const max = Math.max(a, b)
  return `${min},${max}`
}

function averageVectors(points: readonly THREE.Vector3[]): THREE.Vector3 {
  if (points.length === 0) {
    return new THREE.Vector3()
  }

  const average = new THREE.Vector3()
  for (const point of points) {
    average.add(point)
  }

  return average.multiplyScalar(1 / points.length)
}
