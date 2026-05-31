import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'
import {
  BATWING_BOX_DIMENSIONS,
  type BatwingFamilyType,
  type BatwingSettings,
  type QuadFace,
  type TpmsGeometryType,
  buildTpmsQuadMeshData,
  createBatwingBoxGuideGeometry,
} from './batwingGeometry'
import { subdivideCatmullClark, type QuadMeshData } from './catmullClark'
import { InfiniteFadingGrid } from './infiniteGrid'

type BatwingControlKey = keyof BatwingSettings

type SliderBinding = {
  key: BatwingControlKey
  fallback: number
  slider: HTMLInputElement
  valueInput: HTMLInputElement
}

type BatwingArraySettings = {
  lengthCount: number
  widthCount: number
  heightCount: number
  thickness: number
  subdivisions: number
}

type BatwingDepthGradientSettings = {
  baseDepth: number
  topThin: number
  supportThicken: number
  openingThin: number
  effectStrength: number
}

type BatwingSymmetrySettings = {
  rotationalCopies: number
  screwHeightPerCopy: number
  glideOffsetX: number
}

type ArrayControlKey = keyof BatwingArraySettings

type ArraySliderBinding = {
  key: ArrayControlKey
  fallback: number
  min: number
  max: number
  integer: boolean
  slider: HTMLInputElement
  valueInput: HTMLInputElement
}

type DepthGradientControlKey = keyof BatwingDepthGradientSettings

type DepthGradientSliderBinding = {
  key: DepthGradientControlKey
  fallback: number
  min: number
  max: number
  slider: HTMLInputElement
  valueInput: HTMLInputElement
}

type SymmetryControlKey = keyof BatwingSymmetrySettings

type SymmetrySliderBinding = {
  key: SymmetryControlKey
  fallback: number
  min: number
  max: number
  integer: boolean
  slider: HTMLInputElement
  valueInput: HTMLInputElement
}

type BatwingLatticeSettings = {
  lengthDivisions: number
  widthDivisions: number
  heightDivisions: number
}

type BatwingLatticeInfluenceSettings = {
  falloffRadius: number
  falloffStrength: number
}

type BatwingTargetSurfaceSettings = {
  offsetMode: 'two-sided' | 'one-sided'
  blend: number
  offset: number
  targetScale: number
}

type LatticeControlKey = keyof BatwingLatticeSettings

type LatticeSliderBinding = {
  key: LatticeControlKey
  fallback: number
  min: number
  max: number
  slider: HTMLInputElement
  valueInput: HTMLInputElement
}

type LatticeInfluenceControlKey = keyof BatwingLatticeInfluenceSettings

type LatticeInfluenceSliderBinding = {
  key: LatticeInfluenceControlKey
  fallback: number
  min: number
  max: number
  slider: HTMLInputElement
  valueInput: HTMLInputElement
}

type TargetSurfaceControlKey = Exclude<keyof BatwingTargetSurfaceSettings, 'offsetMode'>

type TargetSurfaceSliderBinding = {
  key: TargetSurfaceControlKey
  fallback: number
  min: number
  max: number
  slider: HTMLInputElement
  valueInput: HTMLInputElement
}

type BatwingGeometrySet = {
  meshGeometry: THREE.BufferGeometry
  wireGeometry: THREE.BufferGeometry
}

type BatwingAppState = {
  geometryType: TpmsGeometryType
  batwingFamily: BatwingFamilyType
  settings: BatwingSettings
  arraySettings: BatwingArraySettings
  depthGradientSettings: BatwingDepthGradientSettings
  symmetrySettings: BatwingSymmetrySettings
  latticeSettings: BatwingLatticeSettings
  latticeInfluenceSettings: BatwingLatticeInfluenceSettings
  targetSurfaceSettings: BatwingTargetSurfaceSettings
  latticePointPositions: number[] | null
  showBaseGrid: boolean
  showWireframe: boolean
  reflectionsEnabled: boolean
  showBoxGuide: boolean
  showLatticeControls: boolean
  showBackFaces: boolean
  showSeamDebug: boolean
  foilColorHex: string
  wireColorHex: string
}

type LoadedTargetSurface = {
  name: string
  triangles: Array<[THREE.Vector3, THREE.Vector3, THREE.Vector3]>
  bounds: THREE.Box3
  previewMesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
}

type BatwingMaterialStyle = {
  color: number
  metalness: number
  roughness: number
  clearcoat: number
  clearcoatRoughness: number
  envMapIntensity: number
  iridescence: number
  iridescenceIOR: number
  iridescenceThicknessRange: [number, number]
  reflectivity: number
  specularIntensity: number
  sheen: number
  sheenRoughness: number
  sheenColor: number
  eggIridescence: number
  eggIridescenceFrequency: number
}

type EggIridescenceState = {
  strength: number
  frequency: number
  backFacesEnabled: boolean
  uniforms:
    | null
    | {
        uEggIridescence: { value: number }
        uEggIridescenceFrequency: { value: number }
        uBackFaceDiagnostic: { value: number }
      }
}

type LatticePoint = {
  index: number
  widthIndex: number
  heightIndex: number
  lengthIndex: number
  restPosition: THREE.Vector3
  position: THREE.Vector3
}

type LatticeState = {
  settings: BatwingLatticeSettings
  bounds: THREE.Box3
  size: THREE.Vector3
  points: LatticePoint[]
}

type LatticeMarqueeState = {
  pointerId: number
  startX: number
  startY: number
  currentX: number
  currentY: number
  mode: LatticeSelectionMode
  active: boolean
}

type LatticeSelectionMode = 'replace' | 'add' | 'remove'

type LatticeTransformDragState = {
  anchorStartMatrix: THREE.Matrix4
  anchorStartInverse: THREE.Matrix4
  pointStartPositions: Map<number, THREE.Vector3>
  allPointStartPositions: Map<number, THREE.Vector3>
  influenceWeights: Map<number, number>
}

type LatticeTransformControlHandle = {
  control: TransformControls
  helper: THREE.Object3D
}

type TransformControlsInternalGizmo = TransformControls & {
  _gizmo?: {
    gizmo?: Record<string, THREE.Object3D>
    picker?: Record<string, THREE.Object3D>
    helper?: Record<string, THREE.Object3D>
  }
}

declare global {
  interface Window {
    __batwingDebug?: {
      getStats: () => {
        vertexCount: number
        indexCount: number
        hasNormals: boolean
        finitePositions: boolean
      }
      setSettings: (settings: BatwingSettings) => void
    }
  }
}

document.title = 'Minimal Surface Atlas'

const EXPORT_BASE_NAME = 'Minimal_Surface_Atlas'
const MAX_HISTORY_STATES = 100
const MAX_ARRAY_COUNT = 20
const MAX_DEPTH_GRADIENT_FACTOR = 2
const MAX_THICKNESS = 1
const MAX_SUBDIVISIONS = 3
const MAX_LATTICE_DIVISIONS = 20
const MAX_SYMMETRY_COPIES = 6
const MAX_SYMMETRY_SCREW_HEIGHT = 8
const MAX_SYMMETRY_GLIDE_OFFSET = 8
const MAX_LATTICE_FALLOFF_RADIUS = 12
const MAX_TARGET_BLEND = 1
const MAX_TARGET_OFFSET = 6
const MAX_TARGET_SCALE = 20
const WELD_EPSILON = 1e-5
const LATTICE_POINT_SIZE = 0.0825
const LATTICE_MARQUEE_THRESHOLD = 4
const LATTICE_COLOR = new THREE.Color(0xd100ff)
const LATTICE_SELECTED_COLOR = new THREE.Color(0xff7a00)
const LATTICE_LINE_COLOR = 0xffd47a
const BOX_GUIDE_COLOR = 0x4aaed5
const SCALE_EPSILON = 1e-4
const BACK_SCALE_HANDLE_OFFSET = 0.4
const TRANSLATE_ARROW_HEAD_SCALE = 2 / 3
const LATTICE_GIZMO_AXIS_COLORS: Record<'X' | 'Y' | 'Z', number> = {
  X: 0xffa1a1,
  Y: 0xa9e9a1,
  Z: 0x9fc5ff,
}
const DEFAULT_SETTINGS: BatwingSettings = {
  t0: 0.5,
  t1: 0.5,
  t2: 0.5,
  t3: 0.5,
}
const DEFAULT_GEOMETRY_TYPE: TpmsGeometryType = 'batwing'
const DEFAULT_BATWING_FAMILY: BatwingFamilyType = 'classic'
const DEFAULT_ARRAY_SETTINGS: BatwingArraySettings = {
  lengthCount: 1,
  widthCount: 1,
  heightCount: 1,
  thickness: 0,
  subdivisions: 0,
}
const DEFAULT_DEPTH_GRADIENT_SETTINGS: BatwingDepthGradientSettings = {
  baseDepth: 0,
  topThin: 0,
  supportThicken: 0,
  openingThin: 0,
  effectStrength: 1,
}
const DEFAULT_SYMMETRY_SETTINGS: BatwingSymmetrySettings = {
  rotationalCopies: 1,
  screwHeightPerCopy: 0,
  glideOffsetX: 0,
}
const DEFAULT_LATTICE_SETTINGS: BatwingLatticeSettings = {
  lengthDivisions: 1,
  widthDivisions: 1,
  heightDivisions: 1,
}
const DEFAULT_LATTICE_INFLUENCE_SETTINGS: BatwingLatticeInfluenceSettings = {
  falloffRadius: 0,
  falloffStrength: 1,
}
const DEFAULT_TARGET_SURFACE_SETTINGS: BatwingTargetSurfaceSettings = {
  offsetMode: 'two-sided',
  blend: 1,
  offset: 0,
  targetScale: 1,
}

const FOIL_MATERIAL_STYLE: BatwingMaterialStyle = {
  color: 0xf1f5ff,
  metalness: 0.72,
  roughness: 0.34,
  clearcoat: 1,
  clearcoatRoughness: 0.2,
  envMapIntensity: 1.32,
  iridescence: 0.72,
  iridescenceIOR: 1.22,
  iridescenceThicknessRange: [140, 460],
  reflectivity: 1,
  specularIntensity: 0.88,
  sheen: 0.1,
  sheenRoughness: 0.5,
  sheenColor: 0xe7eeff,
  eggIridescence: 1.05,
  eggIridescenceFrequency: 1.25,
}

const MATTE_MATERIAL_STYLE: BatwingMaterialStyle = {
  color: 0xc2d5f2,
  metalness: 0.04,
  roughness: 0.86,
  clearcoat: 0,
  clearcoatRoughness: 0,
  envMapIntensity: 0,
  iridescence: 0.18,
  iridescenceIOR: 1.22,
  iridescenceThicknessRange: [140, 460],
  reflectivity: 0.18,
  specularIntensity: 0.22,
  sheen: 0,
  sheenRoughness: 1,
  sheenColor: 0xffffff,
  eggIridescence: 0.42,
  eggIridescenceFrequency: 1.1,
}

const REFLECTION_ACCENT_INTENSITIES = {
  magenta: 3.2,
  cyan: 4.1,
  amber: 3.6,
} as const

const app = document.querySelector<HTMLDivElement>('#app') ?? (() => {
  throw new Error('App root was not found.')
})()

app.innerHTML = `
  <div class="app-shell">
    <canvas class="viewport" aria-label="Batwing mesh viewport"></canvas>
    <div id="lattice-marquee" class="lattice-marquee" hidden></div>
    <section id="ui-panel" class="apple-panel" aria-label="Batwing mesh controls">
      <div id="ui-handle" class="panel-drag-handle">
        <button
          id="collapseToggle"
          class="collapse-button panel-collapse-toggle"
          type="button"
          aria-label="Collapse controls"
          aria-expanded="true"
        >
          <span class="collapse-icon" aria-hidden="true"></span>
        </button>
      </div>
      <div class="ui-body panel-sections">
        <div class="control-hint">Wheel = Zoom, MMB = Pan, RMB = Orbit</div>
        <section class="panel-section">
          <button class="panel-section-header" type="button" aria-expanded="true">
            <span class="panel-section-label">Batwing</span>
          </button>
          <div class="panel-section-content panel-controls-stack">
            <label class="control" for="geometryTypeSelect">
              <div class="control-row">
                <span>Geometry</span>
                <select id="geometryTypeSelect" class="value-pill value-select" aria-label="Geometry selection">
                  <option value="batwing">Batwing</option>
                  <option value="schwarz-p">Schwarz P</option>
                  <option value="scherk-1">Scherk 1</option>
                  <option value="scherk-2">Scherk 2</option>
                  <option value="neovius">Neovius</option>
                </select>
              </div>
            </label>
            <label class="control" for="batwingFamilySelect">
              <div class="control-row">
                <span>Batwing Family</span>
                <select id="batwingFamilySelect" class="value-pill value-select" aria-label="Batwing family selection">
                  <option value="classic">Classic</option>
                  <option value="mirror-x">Mirror X Quadrants</option>
                  <option value="mirror-z">Mirror Z Quadrants</option>
                  <option value="mirror-xz">Mirror X+Z Quadrants</option>
                  <option value="checker">Checker Mirror</option>
                </select>
              </div>
            </label>
            <label class="control" for="t0Slider">
              <div class="control-row">
                <span>Vert Positions 1</span>
                <input id="t0-value" class="value-pill value-input" type="number" inputmode="decimal" min="0.01" max="0.99" step="0.01" value="0.50" />
              </div>
              <input id="t0Slider" type="range" min="0.01" max="0.99" value="0.50" step="0.01" />
            </label>
            <label class="control" for="t1Slider">
              <div class="control-row">
                <span>Vert Positions 2</span>
                <input id="t1-value" class="value-pill value-input" type="number" inputmode="decimal" min="0.01" max="0.99" step="0.01" value="0.50" />
              </div>
              <input id="t1Slider" type="range" min="0.01" max="0.99" value="0.50" step="0.01" />
            </label>
            <label class="control" for="t2Slider">
              <div class="control-row">
                <span>Vert Positions 3</span>
                <input id="t2-value" class="value-pill value-input" type="number" inputmode="decimal" min="0.01" max="0.99" step="0.01" value="0.50" />
              </div>
              <input id="t2Slider" type="range" min="0.01" max="0.99" value="0.50" step="0.01" />
            </label>
            <label class="control" for="t3Slider">
              <div class="control-row">
                <span>Vert Positions 4</span>
                <input id="t3-value" class="value-pill value-input" type="number" inputmode="decimal" min="0.01" max="0.99" step="0.01" value="0.50" />
              </div>
              <input id="t3Slider" type="range" min="0.01" max="0.99" value="0.50" step="0.01" />
            </label>
            <label class="control" for="thicknessSlider">
              <div class="control-row">
                <span>Thickness</span>
                <input id="thickness-value" class="value-pill value-input" type="number" inputmode="decimal" min="0" max="1" step="0.01" value="0.00" />
              </div>
              <input id="thicknessSlider" type="range" min="0" max="1" value="0" step="0.01" />
            </label>
            <label class="control" for="subdivisionsSlider">
              <div class="control-row">
                <span>Subdivisions</span>
                <input id="subdivisions-value" class="value-pill value-input" type="number" inputmode="numeric" min="0" max="3" step="1" value="0" />
              </div>
              <input id="subdivisionsSlider" type="range" min="0" max="3" value="0" step="1" />
            </label>
          </div>
        </section>
        <section class="panel-section">
          <button class="panel-section-header" type="button" aria-expanded="true">
            <span class="panel-section-label">Array</span>
          </button>
          <div class="panel-section-content panel-controls-stack">
            <label class="control" for="lengthCountSlider">
              <div class="control-row">
                <span>Length Count</span>
                <input id="length-count-value" class="value-pill value-input" type="number" inputmode="numeric" min="1" max="20" step="1" value="1" />
              </div>
              <input id="lengthCountSlider" type="range" min="1" max="20" value="1" step="1" />
            </label>
            <label class="control" for="widthCountSlider">
              <div class="control-row">
                <span>Width Count</span>
                <input id="width-count-value" class="value-pill value-input" type="number" inputmode="numeric" min="1" max="20" step="1" value="1" />
              </div>
              <input id="widthCountSlider" type="range" min="1" max="20" value="1" step="1" />
            </label>
            <label class="control" for="heightCountSlider">
              <div class="control-row">
                <span>Height Count</span>
                <input id="height-count-value" class="value-pill value-input" type="number" inputmode="numeric" min="1" max="20" step="1" value="1" />
              </div>
              <input id="heightCountSlider" type="range" min="1" max="20" value="1" step="1" />
            </label>
          </div>
        </section>
        <section class="panel-section">
          <button class="panel-section-header" type="button" aria-expanded="true">
            <span class="panel-section-label">Depth Gradient</span>
          </button>
          <div class="panel-section-content panel-controls-stack">
            <label class="control" for="baseDepthSlider">
              <div class="control-row">
                <span>Deeper At Base</span>
                <input id="base-depth-value" class="value-pill value-input" type="number" inputmode="decimal" min="0" max="2" step="0.01" value="0.00" />
              </div>
              <input id="baseDepthSlider" type="range" min="0" max="2" value="0" step="0.01" />
            </label>
            <label class="control" for="topThinSlider">
              <div class="control-row">
                <span>Top Taper</span>
                <input id="top-thin-value" class="value-pill value-input" type="number" inputmode="decimal" min="0" max="2" step="0.01" value="0.00" />
              </div>
              <input id="topThinSlider" type="range" min="0" max="2" value="0" step="0.01" />
            </label>
            <label class="control" for="supportThickenSlider">
              <div class="control-row">
                <span>Thicker Near Supports</span>
                <input id="support-thicken-value" class="value-pill value-input" type="number" inputmode="decimal" min="0" max="2" step="0.01" value="0.00" />
              </div>
              <input id="supportThickenSlider" type="range" min="0" max="2" value="0" step="0.01" />
            </label>
            <label class="control" for="openingThinSlider">
              <div class="control-row">
                <span>Thinner Near Openings</span>
                <input id="opening-thin-value" class="value-pill value-input" type="number" inputmode="decimal" min="0" max="2" step="0.01" value="0.00" />
              </div>
              <input id="openingThinSlider" type="range" min="0" max="2" value="0" step="0.01" />
            </label>
            <label class="control" for="depthEffectStrengthSlider">
              <div class="control-row">
                <span>Gradient Strength</span>
                <input id="depth-effect-strength-value" class="value-pill value-input" type="number" inputmode="decimal" min="0" max="1" step="0.01" value="1.00" />
              </div>
              <input id="depthEffectStrengthSlider" type="range" min="0" max="1" value="1" step="0.01" />
            </label>
          </div>
        </section>
        <section class="panel-section">
          <button class="panel-section-header" type="button" aria-expanded="true">
            <span class="panel-section-label">Symmetry</span>
          </button>
          <div class="panel-section-content panel-controls-stack">
            <label class="control" for="rotationalCopiesSlider">
              <div class="control-row">
                <span>Rotational Copies</span>
                <input id="rotational-copies-value" class="value-pill value-input" type="number" inputmode="numeric" min="1" max="6" step="1" value="1" />
              </div>
              <input id="rotationalCopiesSlider" type="range" min="1" max="6" value="1" step="1" />
            </label>
            <label class="control" for="screwHeightSlider">
              <div class="control-row">
                <span>Screw Height / Copy</span>
                <input id="screw-height-value" class="value-pill value-input" type="number" inputmode="decimal" min="0" max="8" step="0.01" value="0.00" />
              </div>
              <input id="screwHeightSlider" type="range" min="0" max="8" value="0" step="0.01" />
            </label>
            <label class="control" for="glideOffsetSlider">
              <div class="control-row">
                <span>Glide Offset X</span>
                <input id="glide-offset-value" class="value-pill value-input" type="number" inputmode="decimal" min="0" max="8" step="0.01" value="0.00" />
              </div>
              <input id="glideOffsetSlider" type="range" min="0" max="8" value="0" step="0.01" />
            </label>
          </div>
        </section>
        <section class="panel-section">
          <button class="panel-section-header" type="button" aria-expanded="true">
            <span class="panel-section-label">Surface Mapping</span>
          </button>
          <div class="panel-section-content panel-controls-stack">
            <label class="control" for="targetSurfaceFileInput">
              <div class="control-row">
                <span>Target Surface File</span>
                <input id="targetSurfaceFileInput" type="file" accept=".obj,.stl" />
              </div>
            </label>
            <div class="control control-grid-2">
              <button id="loadTargetSurfaceButton" class="pill-button" type="button">Load Target</button>
              <button id="clearTargetSurfaceButton" class="pill-button" type="button">Clear Target</button>
            </div>
            <div class="control">
              <button id="snapTargetToBatwingButton" class="pill-button control-button-wide" type="button">Snap Target To Batwing Bounds</button>
            </div>
            <div class="control control-grid-2">
              <button id="mapTargetButton" class="pill-button" type="button">Map Batwing To Target</button>
              <button id="unmapTargetButton" class="pill-button" type="button">Stop Mapping</button>
            </div>
            <div class="control control-grid-2">
              <button id="targetMoveModeButton" class="pill-button" type="button">Target Move</button>
              <button id="targetRotateModeButton" class="pill-button" type="button">Target Rotate</button>
              <button id="targetScaleModeButton" class="pill-button" type="button">Target Scale</button>
            </div>
            <label class="control" for="targetOffsetModeSelect">
              <div class="control-row">
                <span>Surface Offset Mode</span>
                <select id="targetOffsetModeSelect" class="value-pill value-select">
                  <option value="two-sided">Two-sided</option>
                  <option value="one-sided">One-sided</option>
                </select>
              </div>
            </label>
            <label class="control">
              <div class="control-row">
                <span>Target Rotation X/Y/Z</span>
              </div>
              <div class="control-grid-2">
                <input id="target-rot-x-value" class="value-pill value-input" type="number" inputmode="decimal" step="0.1" value="0.0" />
                <input id="target-rot-y-value" class="value-pill value-input" type="number" inputmode="decimal" step="0.1" value="0.0" />
                <input id="target-rot-z-value" class="value-pill value-input" type="number" inputmode="decimal" step="0.1" value="0.0" />
              </div>
            </label>
            <label class="control">
              <div class="control-row">
                <span>Target Scale X/Y/Z</span>
              </div>
              <div class="control-row">
                <span>Uniform Scale</span>
                <input id="target-scale-uniform-value" class="value-pill value-input" type="number" inputmode="decimal" min="0.001" step="0.01" value="1.00" />
              </div>
            </label>
            <label class="control" for="targetBlendSlider">
              <div class="control-row">
                <span>Surface Blend</span>
                <input id="target-blend-value" class="value-pill value-input" type="number" inputmode="decimal" min="0" max="1" step="0.01" value="1.00" />
              </div>
              <input id="targetBlendSlider" type="range" min="0" max="1" value="1" step="0.01" />
            </label>
            <label class="control" for="targetOffsetSlider">
              <div class="control-row">
                <span>Normal Offset</span>
                <input id="target-offset-value" class="value-pill value-input" type="number" inputmode="decimal" min="-6" max="6" step="0.01" value="0.00" />
              </div>
              <input id="targetOffsetSlider" type="range" min="-6" max="6" value="0" step="0.01" />
            </label>
            <label class="control" for="targetScaleSlider">
              <div class="control-row">
                <span>Target Scale</span>
                <input id="target-scale-value" class="value-pill value-input" type="number" inputmode="decimal" min="0.05" max="20" step="0.01" value="1.00" />
              </div>
              <input id="targetScaleSlider" type="range" min="0.05" max="20" value="1" step="0.01" />
            </label>
          </div>
        </section>
        <section class="panel-section">
          <button class="panel-section-header" type="button" aria-expanded="true">
            <span class="panel-section-label">Lattice</span>
          </button>
          <div class="panel-section-content panel-controls-stack">
            <label class="control" for="lengthDivisionSlider">
              <div class="control-row">
                <span>Length Division</span>
                <input id="length-division-value" class="value-pill value-input" type="number" inputmode="numeric" min="1" max="20" step="1" value="1" />
              </div>
              <input id="lengthDivisionSlider" type="range" min="1" max="20" value="1" step="1" />
            </label>
            <label class="control" for="widthDivisionSlider">
              <div class="control-row">
                <span>Width Division</span>
                <input id="width-division-value" class="value-pill value-input" type="number" inputmode="numeric" min="1" max="20" step="1" value="1" />
              </div>
              <input id="widthDivisionSlider" type="range" min="1" max="20" value="1" step="1" />
            </label>
            <label class="control" for="heightDivisionSlider">
              <div class="control-row">
                <span>Height Division</span>
                <input id="height-division-value" class="value-pill value-input" type="number" inputmode="numeric" min="1" max="20" step="1" value="1" />
              </div>
              <input id="heightDivisionSlider" type="range" min="1" max="20" value="1" step="1" />
            </label>
            <label class="control" for="falloffRadiusSlider">
              <div class="control-row">
                <span>Falloff Radius</span>
                <input id="falloff-radius-value" class="value-pill value-input" type="number" inputmode="decimal" min="0" max="12" step="0.01" value="0.00" />
              </div>
              <input id="falloffRadiusSlider" type="range" min="0" max="12" value="0" step="0.01" />
            </label>
            <label class="control" for="falloffStrengthSlider">
              <div class="control-row">
                <span>Falloff Strength</span>
                <input id="falloff-strength-value" class="value-pill value-input" type="number" inputmode="decimal" min="0" max="1" step="0.01" value="1.00" />
              </div>
              <input id="falloffStrengthSlider" type="range" min="0" max="1" value="1" step="0.01" />
            </label>
            <div class="control">
              <button id="latticeResetButton" class="pill-button control-button-wide" type="button">Reset</button>
            </div>
          </div>
        </section>
        <section class="panel-section">
          <button class="panel-section-header" type="button" aria-expanded="true">
            <span class="panel-section-label">Display</span>
          </button>
          <div class="panel-section-content panel-controls-stack">
            <label class="toggle-control" for="baseGridToggle">
              <span>Base Grid</span>
              <input id="baseGridToggle" type="checkbox" checked />
            </label>
            <label class="toggle-control" for="boxGuideToggle">
              <span>Bounding Boxes</span>
              <input id="boxGuideToggle" type="checkbox" />
            </label>
            <label class="toggle-control" for="latticeControlsToggle">
              <span>Lattice Controls</span>
              <input id="latticeControlsToggle" type="checkbox" checked />
            </label>
            <label class="toggle-control" for="wireToggle">
              <span>Mesh Wires</span>
              <input id="wireToggle" type="checkbox" checked />
            </label>
            <label class="toggle-control" for="reflectionToggle">
              <span>Foil Material</span>
              <input id="reflectionToggle" type="checkbox" checked />
            </label>
            <label class="toggle-control" for="backFacesToggle">
              <span>Back Faces</span>
              <input id="backFacesToggle" type="checkbox" />
            </label>
            <label class="toggle-control" for="seamDebugToggle">
              <span>Seam Debug</span>
              <input id="seamDebugToggle" type="checkbox" />
            </label>
            <label class="control" for="foilColorInput">
              <div class="control-row">
                <span>Foil Color</span>
                <input id="foilColorInput" type="color" value="#f1f5ff" />
              </div>
            </label>
            <label class="control" for="wireColorInput">
              <div class="control-row">
                <span>Wire Color</span>
                <input id="wireColorInput" type="color" value="#37506c" />
              </div>
            </label>
          </div>
        </section>
        <section class="panel-section">
          <button class="panel-section-header" type="button" aria-expanded="true">
            <span class="panel-section-label">Export</span>
          </button>
          <div class="panel-section-content panel-controls-stack">
            <div class="control">
              <button id="exportObjButton" class="pill-button control-button-wide" type="button">Export OBJ</button>
            </div>
            <div class="control">
              <button id="exportGlbButton" class="pill-button control-button-wide" type="button">Export GLB</button>
            </div>
            <div class="control">
              <button id="exportScreenshotButton" class="pill-button control-button-wide" type="button">Export Screenshot</button>
            </div>
          </div>
        </section>
      </div>
      <div id="ui-handle-bottom"></div>
    </section>
  </div>
`

function requireElement<T extends Element>(selector: string): T {
  const element = app.querySelector<T>(selector)
  if (!element) {
    throw new Error(`Missing UI element: ${selector}`)
  }

  return element
}

function addWrappedSoftbox(
  context: CanvasRenderingContext2D,
  width: number,
  x: number,
  y: number,
  boxWidth: number,
  boxHeight: number,
  color: string,
  blur: number,
): void {
  for (const offset of [-width, 0, width]) {
    context.save()
    context.shadowColor = color
    context.shadowBlur = blur
    context.fillStyle = color
    context.fillRect(x + offset - boxWidth / 2, y - boxHeight / 2, boxWidth, boxHeight)
    context.restore()
  }
}

function createStudioReflectionEnvironment(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  const pmremGenerator = new THREE.PMREMGenerator(renderer)
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Could not create environment canvas context.')
  }

  const width = canvas.width
  const height = canvas.height
  const baseGradient = context.createLinearGradient(0, 0, 0, height)
  baseGradient.addColorStop(0, '#05070d')
  baseGradient.addColorStop(0.2, '#111827')
  baseGradient.addColorStop(0.46, '#22324d')
  baseGradient.addColorStop(0.7, '#0a0d14')
  baseGradient.addColorStop(1, '#020306')
  context.fillStyle = baseGradient
  context.fillRect(0, 0, width, height)

  addWrappedSoftbox(context, width, width * 0.52, height * 0.18, width * 0.54, height * 0.08, 'rgba(255,255,255,0.92)', 36)
  addWrappedSoftbox(context, width, width * 0.18, height * 0.54, width * 0.1, height * 0.72, 'rgba(113,215,255,0.72)', 42)
  addWrappedSoftbox(context, width, width * 0.84, height * 0.48, width * 0.12, height * 0.66, 'rgba(255,205,115,0.62)', 42)
  addWrappedSoftbox(context, width, width * 0.5, height * 0.82, width * 0.42, height * 0.1, 'rgba(110,140,210,0.38)', 30)

  context.fillStyle = 'rgba(0,0,0,0.38)'
  context.fillRect(width * 0.44, 0, width * 0.12, height)
  context.fillStyle = 'rgba(255,255,255,0.18)'
  context.fillRect(width * 0.02, height * 0.35, width * 0.96, height * 0.018)
  context.fillRect(width * 0.02, height * 0.67, width * 0.96, height * 0.012)

  const environmentTexture = new THREE.CanvasTexture(canvas)
  environmentTexture.colorSpace = THREE.SRGBColorSpace
  environmentTexture.mapping = THREE.EquirectangularReflectionMapping

  const environmentTarget = pmremGenerator.fromEquirectangular(environmentTexture)
  environmentTexture.dispose()
  pmremGenerator.dispose()
  return environmentTarget
}

const canvas = requireElement<HTMLCanvasElement>('.viewport')
const latticeMarquee = requireElement<HTMLDivElement>('#lattice-marquee')
const uiPanel = requireElement<HTMLDivElement>('#ui-panel')
const uiHandleTop = requireElement<HTMLDivElement>('#ui-handle')
const collapseToggle = requireElement<HTMLButtonElement>('#collapseToggle')
const latticeResetButton = requireElement<HTMLButtonElement>('#latticeResetButton')
const exportObjButton = requireElement<HTMLButtonElement>('#exportObjButton')
const exportGlbButton = requireElement<HTMLButtonElement>('#exportGlbButton')
const exportScreenshotButton = requireElement<HTMLButtonElement>('#exportScreenshotButton')
const baseGridToggle = requireElement<HTMLInputElement>('#baseGridToggle')
const wireToggle = requireElement<HTMLInputElement>('#wireToggle')
const reflectionToggle = requireElement<HTMLInputElement>('#reflectionToggle')
const boxGuideToggle = requireElement<HTMLInputElement>('#boxGuideToggle')
const latticeControlsToggle = requireElement<HTMLInputElement>('#latticeControlsToggle')
const backFacesToggle = requireElement<HTMLInputElement>('#backFacesToggle')
const seamDebugToggle = requireElement<HTMLInputElement>('#seamDebugToggle')
const foilColorInput = requireElement<HTMLInputElement>('#foilColorInput')
const wireColorInput = requireElement<HTMLInputElement>('#wireColorInput')
const geometryTypeSelect = requireElement<HTMLSelectElement>('#geometryTypeSelect')
const batwingFamilySelect = requireElement<HTMLSelectElement>('#batwingFamilySelect')
const targetSurfaceFileInput = requireElement<HTMLInputElement>('#targetSurfaceFileInput')
const loadTargetSurfaceButton = requireElement<HTMLButtonElement>('#loadTargetSurfaceButton')
const clearTargetSurfaceButton = requireElement<HTMLButtonElement>('#clearTargetSurfaceButton')
const snapTargetToBatwingButton = requireElement<HTMLButtonElement>('#snapTargetToBatwingButton')
const mapTargetButton = requireElement<HTMLButtonElement>('#mapTargetButton')
const unmapTargetButton = requireElement<HTMLButtonElement>('#unmapTargetButton')
const targetMoveModeButton = requireElement<HTMLButtonElement>('#targetMoveModeButton')
const targetRotateModeButton = requireElement<HTMLButtonElement>('#targetRotateModeButton')
const targetScaleModeButton = requireElement<HTMLButtonElement>('#targetScaleModeButton')
const targetOffsetModeSelect = requireElement<HTMLSelectElement>('#targetOffsetModeSelect')
const targetRotXInput = requireElement<HTMLInputElement>('#target-rot-x-value')
const targetRotYInput = requireElement<HTMLInputElement>('#target-rot-y-value')
const targetRotZInput = requireElement<HTMLInputElement>('#target-rot-z-value')
const targetScaleUniformInput = requireElement<HTMLInputElement>('#target-scale-uniform-value')

const sliderBindings: SliderBinding[] = [
  {
    key: 't0',
    fallback: DEFAULT_SETTINGS.t0,
    slider: requireElement<HTMLInputElement>('#t0Slider'),
    valueInput: requireElement<HTMLInputElement>('#t0-value'),
  },
  {
    key: 't1',
    fallback: DEFAULT_SETTINGS.t1,
    slider: requireElement<HTMLInputElement>('#t1Slider'),
    valueInput: requireElement<HTMLInputElement>('#t1-value'),
  },
  {
    key: 't2',
    fallback: DEFAULT_SETTINGS.t2,
    slider: requireElement<HTMLInputElement>('#t2Slider'),
    valueInput: requireElement<HTMLInputElement>('#t2-value'),
  },
  {
    key: 't3',
    fallback: DEFAULT_SETTINGS.t3,
    slider: requireElement<HTMLInputElement>('#t3Slider'),
    valueInput: requireElement<HTMLInputElement>('#t3-value'),
  },
]

const arraySliderBindings: ArraySliderBinding[] = [
  {
    key: 'lengthCount',
    fallback: DEFAULT_ARRAY_SETTINGS.lengthCount,
    min: 1,
    max: MAX_ARRAY_COUNT,
    integer: true,
    slider: requireElement<HTMLInputElement>('#lengthCountSlider'),
    valueInput: requireElement<HTMLInputElement>('#length-count-value'),
  },
  {
    key: 'widthCount',
    fallback: DEFAULT_ARRAY_SETTINGS.widthCount,
    min: 1,
    max: MAX_ARRAY_COUNT,
    integer: true,
    slider: requireElement<HTMLInputElement>('#widthCountSlider'),
    valueInput: requireElement<HTMLInputElement>('#width-count-value'),
  },
  {
    key: 'heightCount',
    fallback: DEFAULT_ARRAY_SETTINGS.heightCount,
    min: 1,
    max: MAX_ARRAY_COUNT,
    integer: true,
    slider: requireElement<HTMLInputElement>('#heightCountSlider'),
    valueInput: requireElement<HTMLInputElement>('#height-count-value'),
  },
  {
    key: 'thickness',
    fallback: DEFAULT_ARRAY_SETTINGS.thickness,
    min: 0,
    max: MAX_THICKNESS,
    integer: false,
    slider: requireElement<HTMLInputElement>('#thicknessSlider'),
    valueInput: requireElement<HTMLInputElement>('#thickness-value'),
  },
  {
    key: 'subdivisions',
    fallback: DEFAULT_ARRAY_SETTINGS.subdivisions,
    min: 0,
    max: MAX_SUBDIVISIONS,
    integer: true,
    slider: requireElement<HTMLInputElement>('#subdivisionsSlider'),
    valueInput: requireElement<HTMLInputElement>('#subdivisions-value'),
  },
]

const depthGradientSliderBindings: DepthGradientSliderBinding[] = [
  {
    key: 'baseDepth',
    fallback: DEFAULT_DEPTH_GRADIENT_SETTINGS.baseDepth,
    min: 0,
    max: MAX_DEPTH_GRADIENT_FACTOR,
    slider: requireElement<HTMLInputElement>('#baseDepthSlider'),
    valueInput: requireElement<HTMLInputElement>('#base-depth-value'),
  },
  {
    key: 'topThin',
    fallback: DEFAULT_DEPTH_GRADIENT_SETTINGS.topThin,
    min: 0,
    max: MAX_DEPTH_GRADIENT_FACTOR,
    slider: requireElement<HTMLInputElement>('#topThinSlider'),
    valueInput: requireElement<HTMLInputElement>('#top-thin-value'),
  },
  {
    key: 'supportThicken',
    fallback: DEFAULT_DEPTH_GRADIENT_SETTINGS.supportThicken,
    min: 0,
    max: MAX_DEPTH_GRADIENT_FACTOR,
    slider: requireElement<HTMLInputElement>('#supportThickenSlider'),
    valueInput: requireElement<HTMLInputElement>('#support-thicken-value'),
  },
  {
    key: 'openingThin',
    fallback: DEFAULT_DEPTH_GRADIENT_SETTINGS.openingThin,
    min: 0,
    max: MAX_DEPTH_GRADIENT_FACTOR,
    slider: requireElement<HTMLInputElement>('#openingThinSlider'),
    valueInput: requireElement<HTMLInputElement>('#opening-thin-value'),
  },
  {
    key: 'effectStrength',
    fallback: DEFAULT_DEPTH_GRADIENT_SETTINGS.effectStrength,
    min: 0,
    max: 1,
    slider: requireElement<HTMLInputElement>('#depthEffectStrengthSlider'),
    valueInput: requireElement<HTMLInputElement>('#depth-effect-strength-value'),
  },
]

const symmetrySliderBindings: SymmetrySliderBinding[] = [
  {
    key: 'rotationalCopies',
    fallback: DEFAULT_SYMMETRY_SETTINGS.rotationalCopies,
    min: 1,
    max: MAX_SYMMETRY_COPIES,
    integer: true,
    slider: requireElement<HTMLInputElement>('#rotationalCopiesSlider'),
    valueInput: requireElement<HTMLInputElement>('#rotational-copies-value'),
  },
  {
    key: 'screwHeightPerCopy',
    fallback: DEFAULT_SYMMETRY_SETTINGS.screwHeightPerCopy,
    min: 0,
    max: MAX_SYMMETRY_SCREW_HEIGHT,
    integer: false,
    slider: requireElement<HTMLInputElement>('#screwHeightSlider'),
    valueInput: requireElement<HTMLInputElement>('#screw-height-value'),
  },
  {
    key: 'glideOffsetX',
    fallback: DEFAULT_SYMMETRY_SETTINGS.glideOffsetX,
    min: 0,
    max: MAX_SYMMETRY_GLIDE_OFFSET,
    integer: false,
    slider: requireElement<HTMLInputElement>('#glideOffsetSlider'),
    valueInput: requireElement<HTMLInputElement>('#glide-offset-value'),
  },
]

const latticeSliderBindings: LatticeSliderBinding[] = [
  {
    key: 'lengthDivisions',
    fallback: DEFAULT_LATTICE_SETTINGS.lengthDivisions,
    min: 1,
    max: MAX_LATTICE_DIVISIONS,
    slider: requireElement<HTMLInputElement>('#lengthDivisionSlider'),
    valueInput: requireElement<HTMLInputElement>('#length-division-value'),
  },
  {
    key: 'widthDivisions',
    fallback: DEFAULT_LATTICE_SETTINGS.widthDivisions,
    min: 1,
    max: MAX_LATTICE_DIVISIONS,
    slider: requireElement<HTMLInputElement>('#widthDivisionSlider'),
    valueInput: requireElement<HTMLInputElement>('#width-division-value'),
  },
  {
    key: 'heightDivisions',
    fallback: DEFAULT_LATTICE_SETTINGS.heightDivisions,
    min: 1,
    max: MAX_LATTICE_DIVISIONS,
    slider: requireElement<HTMLInputElement>('#heightDivisionSlider'),
    valueInput: requireElement<HTMLInputElement>('#height-division-value'),
  },
]

const latticeInfluenceSliderBindings: LatticeInfluenceSliderBinding[] = [
  {
    key: 'falloffRadius',
    fallback: DEFAULT_LATTICE_INFLUENCE_SETTINGS.falloffRadius,
    min: 0,
    max: MAX_LATTICE_FALLOFF_RADIUS,
    slider: requireElement<HTMLInputElement>('#falloffRadiusSlider'),
    valueInput: requireElement<HTMLInputElement>('#falloff-radius-value'),
  },
  {
    key: 'falloffStrength',
    fallback: DEFAULT_LATTICE_INFLUENCE_SETTINGS.falloffStrength,
    min: 0,
    max: 1,
    slider: requireElement<HTMLInputElement>('#falloffStrengthSlider'),
    valueInput: requireElement<HTMLInputElement>('#falloff-strength-value'),
  },
]

const targetSurfaceSliderBindings: TargetSurfaceSliderBinding[] = [
  {
    key: 'blend',
    fallback: DEFAULT_TARGET_SURFACE_SETTINGS.blend,
    min: 0,
    max: MAX_TARGET_BLEND,
    slider: requireElement<HTMLInputElement>('#targetBlendSlider'),
    valueInput: requireElement<HTMLInputElement>('#target-blend-value'),
  },
  {
    key: 'offset',
    fallback: DEFAULT_TARGET_SURFACE_SETTINGS.offset,
    min: -MAX_TARGET_OFFSET,
    max: MAX_TARGET_OFFSET,
    slider: requireElement<HTMLInputElement>('#targetOffsetSlider'),
    valueInput: requireElement<HTMLInputElement>('#target-offset-value'),
  },
  {
    key: 'targetScale',
    fallback: DEFAULT_TARGET_SURFACE_SETTINGS.targetScale,
    min: 0.05,
    max: MAX_TARGET_SCALE,
    slider: requireElement<HTMLInputElement>('#targetScaleSlider'),
    valueInput: requireElement<HTMLInputElement>('#target-scale-value'),
  },
]

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
})
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.04
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x000000)
const reflectionEnvironment = createStudioReflectionEnvironment(renderer)
scene.environment = reflectionEnvironment.texture

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200)
camera.position.set(6.4, 4.8, 6.4)

const groundGrid = new InfiniteFadingGrid({
  width: 200,
  height: 200,
  sectionSize: 5,
  sectionThickness: 1.02,
  cellSize: 1,
  cellThickness: 0.46,
  cellColor: '#656b71',
  sectionColor: '#52585f',
  fadeDistance: 140,
  fadeStrength: 1.35,
  infiniteGrid: true,
  followCamera: true,
  y: -BATWING_BOX_DIMENSIONS.height / 2 - 0.002,
  opacity: 0.9,
})
groundGrid.mesh.visible = baseGridToggle.checked
scene.add(groundGrid.mesh)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.target.set(0, 0, 0)
controls.minDistance = 3
controls.maxDistance = Number.POSITIVE_INFINITY
controls.maxPolarAngle = Math.PI - 0.01
controls.mouseButtons.LEFT = -1 as THREE.MOUSE
controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN
controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE

let currentSourceQuadMesh: QuadMeshData | null = null
let latticeState: LatticeState | null = null
let loadedTargetSurface: LoadedTargetSurface | null = null
let targetMappingEnabled = false
let latticePointMesh: THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> | null = null
let latticeHighlightPointMesh: THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> | null = null
let latticeLineSegments: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial> | null = null
let latticeMarqueeState: LatticeMarqueeState | null = null
let latticeTransformDragState: LatticeTransformDragState | null = null
let isUsingLatticeTransformControls = false
let isLatticeTransformDragging = false
let hoveredLatticePointIndex: number | null = null
const selectedLatticePointIndices = new Set<number>()
const latticeRaycaster = new THREE.Raycaster()
const latticePointer = new THREE.Vector2()
const latticeProjection = new THREE.Vector3()
const latticeMatrixHelper = new THREE.Object3D()
const latticeTransformAnchor = new THREE.Object3D()
latticeTransformAnchor.visible = false
scene.add(latticeTransformAnchor)

const targetTransformControl = new TransformControls(camera, renderer.domElement)
targetTransformControl.setSize(0.75)
targetTransformControl.enabled = false
const targetTransformHelper = targetTransformControl.getHelper()
targetTransformHelper.visible = false
targetTransformControl.addEventListener('dragging-changed', (event) => {
  controls.enabled = !event.value
  if (!event.value && targetMappingEnabled) {
    rebuildBatwing()
  }
})
targetTransformControl.addEventListener('objectChange', () => {
  syncTargetTransformInputsFromMesh()
})
scene.add(targetTransformHelper)

const latticeTransformControlHandles = [
  createLatticeTransformControl('translate', 0.75),
  createLatticeTransformControl('rotate', 0.375),
  createLatticeTransformControl('scale', 0.315),
]
const latticeTransformControls = latticeTransformControlHandles.map(({ control }) => control)
const latticeTransformControlHelpers = latticeTransformControlHandles.map(({ helper }) => helper)
latticeTransformControlHandles.forEach(({ control, helper }) => {
  control.attach(latticeTransformAnchor)
  helper.visible = false
})

const ambientLight = new THREE.HemisphereLight(0xdfe9ff, 0x11151d, 0.34)
scene.add(ambientLight)

const keyLight = new THREE.DirectionalLight(0xffffff, 4.2)
keyLight.position.set(-8, 13, 7)
keyLight.target.position.set(0, 0, 0)
scene.add(keyLight.target)
keyLight.castShadow = false
keyLight.shadow.mapSize.set(4096, 4096)
keyLight.shadow.bias = -0.00008
keyLight.shadow.normalBias = 0.024
keyLight.shadow.radius = 5
keyLight.shadow.camera.near = 0.5
keyLight.shadow.camera.far = 120
keyLight.shadow.camera.left = -18
keyLight.shadow.camera.right = 18
keyLight.shadow.camera.top = 18
keyLight.shadow.camera.bottom = -18
scene.add(keyLight)

const fillLight = new THREE.DirectionalLight(0x9fb8df, 0.22)
fillLight.position.set(9, 5, -10)
scene.add(fillLight)

const rimLight = new THREE.DirectionalLight(0x8fc7ff, 0.82)
rimLight.position.set(7, 4, -9)
scene.add(rimLight)

const magentaAccentLight = new THREE.PointLight(
  0xff4cc8,
  REFLECTION_ACCENT_INTENSITIES.magenta,
  30,
  2,
)
magentaAccentLight.position.set(-7.5, 4.5, 4.8)
scene.add(magentaAccentLight)

const cyanAccentLight = new THREE.PointLight(0x4fe6ff, REFLECTION_ACCENT_INTENSITIES.cyan, 28, 2)
cyanAccentLight.position.set(6.5, 2.4, 7.5)
scene.add(cyanAccentLight)

const amberAccentLight = new THREE.PointLight(
  0xffc857,
  REFLECTION_ACCENT_INTENSITIES.amber,
  28,
  2,
)
amberAccentLight.position.set(7.8, 5.2, -4.8)
scene.add(amberAccentLight)

const eggIridescenceState: EggIridescenceState = {
  strength: FOIL_MATERIAL_STYLE.eggIridescence,
  frequency: FOIL_MATERIAL_STYLE.eggIridescenceFrequency,
  backFacesEnabled: backFacesToggle.checked,
  uniforms: null,
}

const batwingMaterial = new THREE.MeshPhysicalMaterial({
  color: FOIL_MATERIAL_STYLE.color,
  metalness: FOIL_MATERIAL_STYLE.metalness,
  roughness: FOIL_MATERIAL_STYLE.roughness,
  clearcoat: FOIL_MATERIAL_STYLE.clearcoat,
  clearcoatRoughness: FOIL_MATERIAL_STYLE.clearcoatRoughness,
  envMapIntensity: FOIL_MATERIAL_STYLE.envMapIntensity,
  iridescence: FOIL_MATERIAL_STYLE.iridescence,
  iridescenceIOR: FOIL_MATERIAL_STYLE.iridescenceIOR,
  iridescenceThicknessRange: FOIL_MATERIAL_STYLE.iridescenceThicknessRange,
  reflectivity: FOIL_MATERIAL_STYLE.reflectivity,
  specularIntensity: FOIL_MATERIAL_STYLE.specularIntensity,
  sheen: FOIL_MATERIAL_STYLE.sheen,
  sheenRoughness: FOIL_MATERIAL_STYLE.sheenRoughness,
  sheenColor: new THREE.Color(FOIL_MATERIAL_STYLE.sheenColor),
  side: THREE.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
})
installEggIridescenceShader(batwingMaterial, eggIridescenceState)
const userFoilColor = new THREE.Color(FOIL_MATERIAL_STYLE.color)

const initialGeometrySet = buildBatwingGeometrySet(
  DEFAULT_GEOMETRY_TYPE,
  DEFAULT_BATWING_FAMILY,
  DEFAULT_SETTINGS,
  DEFAULT_ARRAY_SETTINGS,
  DEFAULT_DEPTH_GRADIENT_SETTINGS,
  DEFAULT_SYMMETRY_SETTINGS,
)
const batwingMesh = new THREE.Mesh(initialGeometrySet.meshGeometry, batwingMaterial)
batwingMesh.castShadow = false
batwingMesh.receiveShadow = false
batwingMesh.frustumCulled = false
scene.add(batwingMesh)

const seamDebugPoints = new THREE.Points(
  new THREE.BufferGeometry(),
  new THREE.PointsMaterial({
    size: 0.1,
    sizeAttenuation: true,
    vertexColors: true,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    opacity: 0.95,
    toneMapped: false,
  }),
)
seamDebugPoints.visible = seamDebugToggle.checked
seamDebugPoints.renderOrder = 10
scene.add(seamDebugPoints)

const wireMaterial = new THREE.LineBasicMaterial({
  color: 0x37506c,
  transparent: true,
  opacity: 0.46,
  depthWrite: false,
  toneMapped: false,
})

const wireOverlay = new THREE.LineSegments(
  initialGeometrySet.wireGeometry,
  wireMaterial,
)
wireOverlay.visible = wireToggle.checked
wireOverlay.frustumCulled = false
wireOverlay.renderOrder = 3
scene.add(wireOverlay)
applyFoilColorFromHex(`#${FOIL_MATERIAL_STYLE.color.toString(16).padStart(6, '0')}`)
applyWireColorFromHex('#37506c')

const boxGuide = new THREE.LineSegments(
  buildArrayBoxGuideGeometry(DEFAULT_ARRAY_SETTINGS),
  new THREE.LineBasicMaterial({
    color: BOX_GUIDE_COLOR,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    toneMapped: false,
  }),
)
boxGuide.visible = boxGuideToggle.checked
boxGuide.renderOrder = 2
scene.add(boxGuide)

rebuildLatticeFromCurrentSource()
updateLightingForCurrentGeometry()

const exportCounters = {
  obj: 0,
  glb: 0,
  png: 0,
}

const panelDragOffset = { x: 0, y: 0 }
let panelDragging = false
let animationFrameId = 0
let pendingControlHistoryState: BatwingAppState | null = null
let isApplyingHistoryState = false
let geometryTypeBeforeEdit: TpmsGeometryType | null = null
let batwingFamilyBeforeEdit: BatwingFamilyType | null = null
const undoHistory: BatwingAppState[] = []
const redoHistory: BatwingAppState[] = []

app.addEventListener(
  'contextmenu',
  (event) => {
    event.preventDefault()
  },
  { capture: true },
)

function readSliderNumber(input: HTMLInputElement, fallback: number): number {
  const value = Number.parseFloat(input.value)
  return Number.isFinite(value) ? value : fallback
}

function readArraySliderNumber(binding: ArraySliderBinding): number {
  return normalizeArraySliderValue(binding, readSliderNumber(binding.slider, binding.fallback))
}

function readSymmetrySliderNumber(binding: SymmetrySliderBinding): number {
  return normalizeSymmetrySliderValue(binding, readSliderNumber(binding.slider, binding.fallback))
}

function readLatticeSliderNumber(binding: LatticeSliderBinding): number {
  return normalizeLatticeSliderValue(binding, readSliderNumber(binding.slider, binding.fallback))
}

function readLatticeInfluenceSliderNumber(binding: LatticeInfluenceSliderBinding): number {
  return normalizeLatticeInfluenceSliderValue(binding, readSliderNumber(binding.slider, binding.fallback))
}

function readTargetSurfaceSliderNumber(binding: TargetSurfaceSliderBinding): number {
  return normalizeTargetSurfaceSliderValue(binding, readSliderNumber(binding.slider, binding.fallback))
}

function normalizeArraySliderValue(binding: ArraySliderBinding, value: number): number {
  const safeValue = Number.isFinite(value) ? value : binding.fallback
  const clampedValue = clampNumber(safeValue, binding.min, binding.max)
  const snappedValue = snapValueToSlider(clampedValue, binding.slider)
  const nextValue = binding.integer ? Math.round(snappedValue) : snappedValue
  return clampNumber(nextValue, binding.min, binding.max)
}

function normalizeDepthGradientValue(binding: DepthGradientSliderBinding, value: number): number {
  const safeValue = Number.isFinite(value) ? value : binding.fallback
  const clampedValue = clampNumber(safeValue, binding.min, binding.max)
  return snapValueToSlider(clampedValue, binding.slider)
}

function normalizeLatticeSliderValue(binding: LatticeSliderBinding, value: number): number {
  const safeValue = Number.isFinite(value) ? value : binding.fallback
  const clampedValue = clampNumber(safeValue, binding.min, binding.max)
  const snappedValue = snapValueToSlider(clampedValue, binding.slider)
  return Math.round(clampNumber(snappedValue, binding.min, binding.max))
}

function normalizeSymmetrySliderValue(binding: SymmetrySliderBinding, value: number): number {
  const safeValue = Number.isFinite(value) ? value : binding.fallback
  const clampedValue = clampNumber(safeValue, binding.min, binding.max)
  const snappedValue = snapValueToSlider(clampedValue, binding.slider)
  const nextValue = binding.integer ? Math.round(snappedValue) : snappedValue
  return clampNumber(nextValue, binding.min, binding.max)
}

function normalizeLatticeInfluenceSliderValue(binding: LatticeInfluenceSliderBinding, value: number): number {
  const safeValue = Number.isFinite(value) ? value : binding.fallback
  const clampedValue = clampNumber(safeValue, binding.min, binding.max)
  return snapValueToSlider(clampedValue, binding.slider)
}

function normalizeTargetSurfaceSliderValue(binding: TargetSurfaceSliderBinding, value: number): number {
  const safeValue = Number.isFinite(value) ? value : binding.fallback
  const clampedValue = clampNumber(safeValue, binding.min, binding.max)
  return snapValueToSlider(clampedValue, binding.slider)
}

function formatSymmetrySliderValue(binding: SymmetrySliderBinding, value: number): string {
  return binding.integer ? `${Math.round(value)}` : formatSliderValue(value)
}

function formatArraySliderValue(binding: ArraySliderBinding, value: number): string {
  return binding.integer ? `${Math.round(value)}` : formatSliderValue(value)
}

function formatLatticeSliderValue(value: number): string {
  return `${Math.round(value)}`
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function getSliderStep(slider: HTMLInputElement): number | null {
  if (slider.step === 'any') {
    return null
  }

  const step = Number.parseFloat(slider.step)
  return Number.isFinite(step) && step > 0 ? step : null
}

function getDecimalPlaces(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  const valueText = value.toString().toLowerCase()
  if (valueText.includes('e-')) {
    const [, exponentText] = valueText.split('e-')
    const exponent = Number.parseInt(exponentText ?? '0', 10)
    const decimalSection = valueText.split('.')[1]?.split('e')[0] ?? ''
    return decimalSection.length + exponent
  }

  return valueText.split('.')[1]?.length ?? 0
}

function snapValueToSlider(value: number, slider: HTMLInputElement): number {
  const min = Number.parseFloat(slider.min)
  const max = Number.parseFloat(slider.max)
  let nextValue = value

  if (Number.isFinite(min) && Number.isFinite(max)) {
    nextValue = clampNumber(nextValue, min, max)
  }

  const step = getSliderStep(slider)
  if (step === null) {
    return nextValue
  }

  const base = Number.isFinite(min) ? min : 0
  const snapped = Math.round((nextValue - base) / step) * step + base
  const decimals = getDecimalPlaces(step)
  return Number.parseFloat(snapped.toFixed(decimals))
}

function formatSliderValue(value: number): string {
  return value.toFixed(2)
}

function updateRangeProgress(input: HTMLInputElement): void {
  const min = Number.parseFloat(input.min)
  const max = Number.parseFloat(input.max)
  const value = Number.parseFloat(input.value)
  const progress =
    Number.isFinite(min) && Number.isFinite(max) && Number.isFinite(value) && max !== min
      ? ((value - min) / (max - min)) * 100
      : 0
  input.style.setProperty('--range-progress', `${clampNumber(progress, 0, 100)}%`)
}

function getCurrentSettings(): BatwingSettings {
  return sliderBindings.reduce<BatwingSettings>(
    (settings, binding) => {
      settings[binding.key] = readSliderNumber(binding.slider, binding.fallback)
      return settings
    },
    { ...DEFAULT_SETTINGS },
  )
}

function getCurrentArraySettings(): BatwingArraySettings {
  return arraySliderBindings.reduce<BatwingArraySettings>(
    (settings, binding) => {
      settings[binding.key] = readArraySliderNumber(binding)
      return settings
    },
    { ...DEFAULT_ARRAY_SETTINGS },
  )
}

function getCurrentDepthGradientSettings(): BatwingDepthGradientSettings {
  return depthGradientSliderBindings.reduce<BatwingDepthGradientSettings>(
    (settings, binding) => {
      settings[binding.key] = normalizeDepthGradientValue(binding, readSliderNumber(binding.slider, binding.fallback))
      return settings
    },
    { ...DEFAULT_DEPTH_GRADIENT_SETTINGS },
  )
}

function getCurrentSymmetrySettings(): BatwingSymmetrySettings {
  return symmetrySliderBindings.reduce<BatwingSymmetrySettings>(
    (settings, binding) => {
      settings[binding.key] = readSymmetrySliderNumber(binding)
      return settings
    },
    { ...DEFAULT_SYMMETRY_SETTINGS },
  )
}

function getCurrentLatticeSettings(): BatwingLatticeSettings {
  return latticeSliderBindings.reduce<BatwingLatticeSettings>(
    (settings, binding) => {
      settings[binding.key] = readLatticeSliderNumber(binding)
      return settings
    },
    { ...DEFAULT_LATTICE_SETTINGS },
  )
}

function getCurrentLatticeInfluenceSettings(): BatwingLatticeInfluenceSettings {
  return latticeInfluenceSliderBindings.reduce<BatwingLatticeInfluenceSettings>(
    (settings, binding) => {
      settings[binding.key] = readLatticeInfluenceSliderNumber(binding)
      return settings
    },
    { ...DEFAULT_LATTICE_INFLUENCE_SETTINGS },
  )
}

function getCurrentTargetSurfaceSettings(): BatwingTargetSurfaceSettings {
  const sliderSettings = targetSurfaceSliderBindings.reduce<Omit<BatwingTargetSurfaceSettings, 'offsetMode'>>(
    (settings, binding) => {
      settings[binding.key] = readTargetSurfaceSliderNumber(binding)
      return settings
    },
    {
      blend: DEFAULT_TARGET_SURFACE_SETTINGS.blend,
      offset: DEFAULT_TARGET_SURFACE_SETTINGS.offset,
      targetScale: DEFAULT_TARGET_SURFACE_SETTINGS.targetScale,
    },
  )
  return {
    offsetMode: targetOffsetModeSelect.value === 'one-sided' ? 'one-sided' : 'two-sided',
    ...sliderSettings,
  }
}

function cloneSettings(settings: BatwingSettings): BatwingSettings {
  return {
    t0: settings.t0,
    t1: settings.t1,
    t2: settings.t2,
    t3: settings.t3,
  }
}

function cloneArraySettings(settings: BatwingArraySettings): BatwingArraySettings {
  return {
    lengthCount: settings.lengthCount,
    widthCount: settings.widthCount,
    heightCount: settings.heightCount,
    thickness: settings.thickness,
    subdivisions: settings.subdivisions,
  }
}

function cloneDepthGradientSettings(settings: BatwingDepthGradientSettings): BatwingDepthGradientSettings {
  return {
    baseDepth: settings.baseDepth,
    topThin: settings.topThin,
    supportThicken: settings.supportThicken,
    openingThin: settings.openingThin,
    effectStrength: settings.effectStrength,
  }
}

function cloneSymmetrySettings(settings: BatwingSymmetrySettings): BatwingSymmetrySettings {
  return {
    rotationalCopies: settings.rotationalCopies,
    screwHeightPerCopy: settings.screwHeightPerCopy,
    glideOffsetX: settings.glideOffsetX,
  }
}

function cloneLatticeSettings(settings: BatwingLatticeSettings): BatwingLatticeSettings {
  return {
    lengthDivisions: settings.lengthDivisions,
    widthDivisions: settings.widthDivisions,
    heightDivisions: settings.heightDivisions,
  }
}

function cloneLatticeInfluenceSettings(
  settings: BatwingLatticeInfluenceSettings,
): BatwingLatticeInfluenceSettings {
  return {
    falloffRadius: settings.falloffRadius,
    falloffStrength: settings.falloffStrength,
  }
}

function cloneTargetSurfaceSettings(settings: BatwingTargetSurfaceSettings): BatwingTargetSurfaceSettings {
  return {
    offsetMode: settings.offsetMode,
    blend: settings.blend,
    offset: settings.offset,
    targetScale: settings.targetScale,
  }
}

function captureLatticePointPositions(): number[] | null {
  if (!latticeState) {
    return null
  }

  const positions: number[] = []
  for (const point of latticeState.points) {
    positions.push(point.position.x, point.position.y, point.position.z)
  }
  return positions
}

function latticePointPositionsEqual(a: number[] | null, b: number[] | null): boolean {
  if (a === b) {
    return true
  }
  if (!a || !b || a.length !== b.length) {
    return false
  }

  for (let index = 0; index < a.length; index += 1) {
    if (Math.abs(a[index] - b[index]) > 1e-8) {
      return false
    }
  }
  return true
}

function cloneAppState(state: BatwingAppState): BatwingAppState {
  return {
    geometryType: state.geometryType,
    batwingFamily: state.batwingFamily,
    settings: cloneSettings(state.settings),
    arraySettings: cloneArraySettings(state.arraySettings),
    depthGradientSettings: cloneDepthGradientSettings(state.depthGradientSettings),
    symmetrySettings: cloneSymmetrySettings(state.symmetrySettings),
    latticeSettings: cloneLatticeSettings(state.latticeSettings),
    latticeInfluenceSettings: cloneLatticeInfluenceSettings(state.latticeInfluenceSettings),
    targetSurfaceSettings: cloneTargetSurfaceSettings(state.targetSurfaceSettings),
    latticePointPositions: state.latticePointPositions ? [...state.latticePointPositions] : null,
    showBaseGrid: state.showBaseGrid,
    showWireframe: state.showWireframe,
    reflectionsEnabled: state.reflectionsEnabled,
    showBoxGuide: state.showBoxGuide,
    showLatticeControls: state.showLatticeControls,
    showBackFaces: state.showBackFaces,
    showSeamDebug: state.showSeamDebug,
    foilColorHex: state.foilColorHex,
    wireColorHex: state.wireColorHex,
  }
}

function captureAppState(): BatwingAppState {
  return {
    geometryType: getCurrentGeometryType(),
    batwingFamily: getCurrentBatwingFamily(),
    settings: getCurrentSettings(),
    arraySettings: getCurrentArraySettings(),
    depthGradientSettings: getCurrentDepthGradientSettings(),
    symmetrySettings: getCurrentSymmetrySettings(),
    latticeSettings: getCurrentLatticeSettings(),
    latticeInfluenceSettings: getCurrentLatticeInfluenceSettings(),
    targetSurfaceSettings: getCurrentTargetSurfaceSettings(),
    latticePointPositions: captureLatticePointPositions(),
    showBaseGrid: baseGridToggle.checked,
    showWireframe: wireToggle.checked,
    reflectionsEnabled: reflectionToggle.checked,
    showBoxGuide: boxGuideToggle.checked,
    showLatticeControls: latticeControlsToggle.checked,
    showBackFaces: backFacesToggle.checked,
    showSeamDebug: seamDebugToggle.checked,
    foilColorHex: normalizeColorInputHex(foilColorInput.value, userFoilColor.getHexString()),
    wireColorHex: normalizeColorInputHex(wireColorInput.value, wireMaterial.color.getHexString()),
  }
}

function appStatesEqual(a: BatwingAppState, b: BatwingAppState): boolean {
  return (
    a.geometryType === b.geometryType &&
    a.batwingFamily === b.batwingFamily &&
    a.settings.t0 === b.settings.t0 &&
    a.settings.t1 === b.settings.t1 &&
    a.settings.t2 === b.settings.t2 &&
    a.settings.t3 === b.settings.t3 &&
    a.arraySettings.lengthCount === b.arraySettings.lengthCount &&
    a.arraySettings.widthCount === b.arraySettings.widthCount &&
    a.arraySettings.heightCount === b.arraySettings.heightCount &&
    a.arraySettings.thickness === b.arraySettings.thickness &&
    a.arraySettings.subdivisions === b.arraySettings.subdivisions &&
    a.depthGradientSettings.baseDepth === b.depthGradientSettings.baseDepth &&
    a.depthGradientSettings.topThin === b.depthGradientSettings.topThin &&
    a.depthGradientSettings.supportThicken === b.depthGradientSettings.supportThicken &&
    a.depthGradientSettings.openingThin === b.depthGradientSettings.openingThin &&
    a.depthGradientSettings.effectStrength === b.depthGradientSettings.effectStrength &&
    a.symmetrySettings.rotationalCopies === b.symmetrySettings.rotationalCopies &&
    a.symmetrySettings.screwHeightPerCopy === b.symmetrySettings.screwHeightPerCopy &&
    a.symmetrySettings.glideOffsetX === b.symmetrySettings.glideOffsetX &&
    a.latticeSettings.lengthDivisions === b.latticeSettings.lengthDivisions &&
    a.latticeSettings.widthDivisions === b.latticeSettings.widthDivisions &&
    a.latticeSettings.heightDivisions === b.latticeSettings.heightDivisions &&
    a.latticeInfluenceSettings.falloffRadius === b.latticeInfluenceSettings.falloffRadius &&
    a.latticeInfluenceSettings.falloffStrength === b.latticeInfluenceSettings.falloffStrength &&
    a.targetSurfaceSettings.offsetMode === b.targetSurfaceSettings.offsetMode &&
    a.targetSurfaceSettings.blend === b.targetSurfaceSettings.blend &&
    a.targetSurfaceSettings.offset === b.targetSurfaceSettings.offset &&
    a.targetSurfaceSettings.targetScale === b.targetSurfaceSettings.targetScale &&
    latticePointPositionsEqual(a.latticePointPositions, b.latticePointPositions) &&
    a.showBaseGrid === b.showBaseGrid &&
    a.showWireframe === b.showWireframe &&
    a.reflectionsEnabled === b.reflectionsEnabled &&
    a.showBoxGuide === b.showBoxGuide &&
    a.showLatticeControls === b.showLatticeControls &&
    a.showBackFaces === b.showBackFaces &&
    a.showSeamDebug === b.showSeamDebug &&
    a.foilColorHex === b.foilColorHex &&
    a.wireColorHex === b.wireColorHex
  )
}

function pushUndoHistoryState(state: BatwingAppState): void {
  undoHistory.push(cloneAppState(state))
  if (undoHistory.length > MAX_HISTORY_STATES) {
    undoHistory.shift()
  }
}

function commitHistoryCheckpoint(previousState: BatwingAppState): void {
  if (isApplyingHistoryState) {
    return
  }

  const currentState = captureAppState()
  if (appStatesEqual(previousState, currentState)) {
    return
  }

  pushUndoHistoryState(previousState)
  redoHistory.length = 0
}

function beginControlHistoryEdit(): void {
  if (isApplyingHistoryState || pendingControlHistoryState) {
    return
  }

  pendingControlHistoryState = captureAppState()
}

function finishControlHistoryEdit(): void {
  if (!pendingControlHistoryState) {
    return
  }

  commitHistoryCheckpoint(pendingControlHistoryState)
  pendingControlHistoryState = null
}

function clearControlHistoryEdit(): void {
  pendingControlHistoryState = null
}

function applyAppState(state: BatwingAppState): void {
  isApplyingHistoryState = true
  applyGeometryType(state.geometryType)
  applyBatwingFamily(state.batwingFamily)
  applySettings(state.settings)
  applyArraySettings(state.arraySettings)
  applyDepthGradientSettings(state.depthGradientSettings)
  applySymmetrySettings(state.symmetrySettings)
  applyLatticeSettings(state.latticeSettings)
  applyLatticeInfluenceSettings(state.latticeInfluenceSettings)
  applyTargetSurfaceSettings(state.targetSurfaceSettings)
  applyLatticePointPositions(state.latticePointPositions)
  baseGridToggle.checked = state.showBaseGrid
  groundGrid.mesh.visible = state.showBaseGrid
  wireToggle.checked = state.showWireframe
  wireOverlay.visible = state.showWireframe
  reflectionToggle.checked = state.reflectionsEnabled
  applyMaterialStyle(state.reflectionsEnabled ? FOIL_MATERIAL_STYLE : MATTE_MATERIAL_STYLE)
  boxGuideToggle.checked = state.showBoxGuide
  boxGuide.visible = state.showBoxGuide
  latticeControlsToggle.checked = state.showLatticeControls
  updateLatticeControlsVisibility()
  backFacesToggle.checked = state.showBackFaces
  applyBackFacesDiagnosticMode(state.showBackFaces)
  seamDebugToggle.checked = state.showSeamDebug
  seamDebugPoints.visible = state.showSeamDebug
  applyFoilColorFromHex(state.foilColorHex)
  applyWireColorFromHex(state.wireColorHex)
  isApplyingHistoryState = false
}

function undoHistoryState(): void {
  finishControlHistoryEdit()
  const previousState = undoHistory.pop()
  if (!previousState) {
    return
  }

  redoHistory.push(captureAppState())
  applyAppState(previousState)
}

function redoHistoryState(): void {
  finishControlHistoryEdit()
  const nextState = redoHistory.pop()
  if (!nextState) {
    return
  }

  pushUndoHistoryState(captureAppState())
  applyAppState(nextState)
}

function applySettings(settings: BatwingSettings): void {
  for (const binding of sliderBindings) {
    const nextValue = snapValueToSlider(settings[binding.key], binding.slider)
    binding.slider.value = `${nextValue}`
    binding.valueInput.value = formatSliderValue(nextValue)
    updateRangeProgress(binding.slider)
  }

  rebuildBatwing()
}

function getCurrentGeometryType(): TpmsGeometryType {
  const value = geometryTypeSelect.value
  if (value === 'schwarz-p' || value === 'scherk-1' || value === 'scherk-2' || value === 'neovius') {
    return value
  }
  return 'batwing'
}

function applyGeometryType(geometryType: TpmsGeometryType): void {
  geometryTypeSelect.value = geometryType
  updateBatwingFamilyControlAvailability(geometryType)
}

function getCurrentBatwingFamily(): BatwingFamilyType {
  const value = batwingFamilySelect.value
  if (value === 'mirror-x' || value === 'mirror-z' || value === 'mirror-xz' || value === 'checker') {
    return value
  }
  return 'classic'
}

function applyBatwingFamily(family: BatwingFamilyType): void {
  batwingFamilySelect.value = family
}

function updateBatwingFamilyControlAvailability(geometryType: TpmsGeometryType): void {
  batwingFamilySelect.disabled = geometryType !== 'batwing'
}

function applyArraySettings(settings: BatwingArraySettings): void {
  for (const binding of arraySliderBindings) {
    const nextValue = normalizeArraySliderValue(binding, settings[binding.key])
    binding.slider.value = `${nextValue}`
    binding.valueInput.value = formatArraySliderValue(binding, nextValue)
    updateRangeProgress(binding.slider)
  }

  rebuildBatwing()
}

function applyDepthGradientSettings(settings: BatwingDepthGradientSettings): void {
  for (const binding of depthGradientSliderBindings) {
    const nextValue = normalizeDepthGradientValue(binding, settings[binding.key])
    binding.slider.value = `${nextValue}`
    binding.valueInput.value = formatSliderValue(nextValue)
    updateRangeProgress(binding.slider)
  }

  rebuildBatwing()
}

function applySymmetrySettings(settings: BatwingSymmetrySettings): void {
  for (const binding of symmetrySliderBindings) {
    const nextValue = normalizeSymmetrySliderValue(binding, settings[binding.key])
    binding.slider.value = `${nextValue}`
    binding.valueInput.value = formatSymmetrySliderValue(binding, nextValue)
    updateRangeProgress(binding.slider)
  }

  rebuildBatwing()
}

function applyLatticeSettings(settings: BatwingLatticeSettings): void {
  for (const binding of latticeSliderBindings) {
    const nextValue = normalizeLatticeSliderValue(binding, settings[binding.key])
    binding.slider.value = `${nextValue}`
    binding.valueInput.value = formatLatticeSliderValue(nextValue)
    updateRangeProgress(binding.slider)
  }

  rebuildBatwing()
}

function applyLatticeInfluenceSettings(settings: BatwingLatticeInfluenceSettings): void {
  for (const binding of latticeInfluenceSliderBindings) {
    const nextValue = normalizeLatticeInfluenceSliderValue(binding, settings[binding.key])
    binding.slider.value = `${nextValue}`
    binding.valueInput.value = formatSliderValue(nextValue)
    updateRangeProgress(binding.slider)
  }
}

function applyTargetSurfaceSettings(settings: BatwingTargetSurfaceSettings): void {
  targetOffsetModeSelect.value = settings.offsetMode
  for (const binding of targetSurfaceSliderBindings) {
    const nextValue = normalizeTargetSurfaceSliderValue(binding, settings[binding.key])
    binding.slider.value = `${nextValue}`
    binding.valueInput.value = formatSliderValue(nextValue)
    updateRangeProgress(binding.slider)
  }
  rebuildBatwing()
}

function applyLatticePointPositions(positions: number[] | null): void {
  if (!latticeState || !positions || positions.length !== latticeState.points.length * 3) {
    return
  }

  for (let index = 0; index < latticeState.points.length; index += 1) {
    latticeState.points[index].position.set(
      positions[index * 3 + 0],
      positions[index * 3 + 1],
      positions[index * 3 + 2],
    )
  }

  refreshLatticeVisuals()
  rebuildCurrentDeformedGeometry()
}

function resetLatticePointsToRestPositions(): void {
  if (!latticeState) {
    return
  }

  for (const point of latticeState.points) {
    point.position.copy(point.restPosition)
  }

  refreshLatticeVisuals()
  rebuildCurrentDeformedGeometry()
}

function commitValueInput(binding: SliderBinding): void {
  const parsedValue = Number.parseFloat(binding.valueInput.value)
  const nextValue = snapValueToSlider(
    Number.isFinite(parsedValue) ? parsedValue : binding.fallback,
    binding.slider,
  )
  binding.slider.value = `${nextValue}`
  binding.valueInput.value = formatSliderValue(nextValue)
  updateRangeProgress(binding.slider)
  rebuildBatwing()
}

function commitArrayValueInput(binding: ArraySliderBinding): void {
  const parsedValue = Number.parseFloat(binding.valueInput.value)
  const nextValue = normalizeArraySliderValue(binding, parsedValue)
  binding.slider.value = `${nextValue}`
  binding.valueInput.value = formatArraySliderValue(binding, nextValue)
  updateRangeProgress(binding.slider)
  rebuildBatwing()
}

function commitDepthGradientValueInput(binding: DepthGradientSliderBinding): void {
  const parsedValue = Number.parseFloat(binding.valueInput.value)
  const nextValue = normalizeDepthGradientValue(binding, parsedValue)
  binding.slider.value = `${nextValue}`
  binding.valueInput.value = formatSliderValue(nextValue)
  updateRangeProgress(binding.slider)
  rebuildBatwing()
}

function commitSymmetryValueInput(binding: SymmetrySliderBinding): void {
  const parsedValue = Number.parseFloat(binding.valueInput.value)
  const nextValue = normalizeSymmetrySliderValue(binding, parsedValue)
  binding.slider.value = `${nextValue}`
  binding.valueInput.value = formatSymmetrySliderValue(binding, nextValue)
  updateRangeProgress(binding.slider)
  rebuildBatwing()
}

function commitLatticeValueInput(binding: LatticeSliderBinding): void {
  const parsedValue = Number.parseFloat(binding.valueInput.value)
  const nextValue = normalizeLatticeSliderValue(binding, parsedValue)
  binding.slider.value = `${nextValue}`
  binding.valueInput.value = formatLatticeSliderValue(nextValue)
  updateRangeProgress(binding.slider)
  rebuildBatwing()
}

function commitLatticeInfluenceValueInput(binding: LatticeInfluenceSliderBinding): void {
  const parsedValue = Number.parseFloat(binding.valueInput.value)
  const nextValue = normalizeLatticeInfluenceSliderValue(binding, parsedValue)
  binding.slider.value = `${nextValue}`
  binding.valueInput.value = formatSliderValue(nextValue)
  updateRangeProgress(binding.slider)
}

function commitTargetSurfaceValueInput(binding: TargetSurfaceSliderBinding): void {
  const parsedValue = Number.parseFloat(binding.valueInput.value)
  const nextValue = normalizeTargetSurfaceSliderValue(binding, parsedValue)
  binding.slider.value = `${nextValue}`
  binding.valueInput.value = formatSliderValue(nextValue)
  updateRangeProgress(binding.slider)
  rebuildBatwing()
}

function bindSlider(binding: SliderBinding): void {
  const syncFromSlider = (): void => {
    beginControlHistoryEdit()
    const value = readSliderNumber(binding.slider, binding.fallback)
    binding.valueInput.value = formatSliderValue(value)
    updateRangeProgress(binding.slider)
    rebuildBatwing()
  }

  binding.slider.addEventListener('pointerdown', beginControlHistoryEdit)
  binding.slider.addEventListener('pointerup', finishControlHistoryEdit)
  binding.slider.addEventListener('pointercancel', finishControlHistoryEdit)
  binding.slider.addEventListener('keydown', (event) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) {
      beginControlHistoryEdit()
    }
  })
  binding.slider.addEventListener('input', syncFromSlider)
  binding.slider.addEventListener('change', finishControlHistoryEdit)
  binding.valueInput.addEventListener('focus', beginControlHistoryEdit)
  binding.valueInput.addEventListener('change', () => {
    commitValueInput(binding)
    finishControlHistoryEdit()
  })
  binding.valueInput.addEventListener('blur', () => {
    commitValueInput(binding)
    finishControlHistoryEdit()
  })
  binding.valueInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitValueInput(binding)
      finishControlHistoryEdit()
      binding.valueInput.blur()
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      binding.valueInput.value = formatSliderValue(readSliderNumber(binding.slider, binding.fallback))
      clearControlHistoryEdit()
      binding.valueInput.blur()
    }
  })
}

function bindArraySlider(binding: ArraySliderBinding): void {
  const syncFromSlider = (): void => {
    beginControlHistoryEdit()
    const value = readArraySliderNumber(binding)
    binding.slider.value = `${value}`
    binding.valueInput.value = formatArraySliderValue(binding, value)
    updateRangeProgress(binding.slider)
    rebuildBatwing()
  }

  binding.slider.addEventListener('pointerdown', beginControlHistoryEdit)
  binding.slider.addEventListener('pointerup', finishControlHistoryEdit)
  binding.slider.addEventListener('pointercancel', finishControlHistoryEdit)
  binding.slider.addEventListener('keydown', (event) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) {
      beginControlHistoryEdit()
    }
  })
  binding.slider.addEventListener('input', syncFromSlider)
  binding.slider.addEventListener('change', finishControlHistoryEdit)
  binding.valueInput.addEventListener('focus', beginControlHistoryEdit)
  binding.valueInput.addEventListener('change', () => {
    commitArrayValueInput(binding)
    finishControlHistoryEdit()
  })
  binding.valueInput.addEventListener('blur', () => {
    commitArrayValueInput(binding)
    finishControlHistoryEdit()
  })
  binding.valueInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitArrayValueInput(binding)
      finishControlHistoryEdit()
      binding.valueInput.blur()
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      binding.valueInput.value = formatArraySliderValue(binding, readArraySliderNumber(binding))
      clearControlHistoryEdit()
      binding.valueInput.blur()
    }
  })
}

function bindDepthGradientSlider(binding: DepthGradientSliderBinding): void {
  const syncFromSlider = (): void => {
    beginControlHistoryEdit()
    const value = normalizeDepthGradientValue(binding, readSliderNumber(binding.slider, binding.fallback))
    binding.slider.value = `${value}`
    binding.valueInput.value = formatSliderValue(value)
    updateRangeProgress(binding.slider)
    rebuildBatwing()
  }

  binding.slider.addEventListener('pointerdown', beginControlHistoryEdit)
  binding.slider.addEventListener('pointerup', finishControlHistoryEdit)
  binding.slider.addEventListener('pointercancel', finishControlHistoryEdit)
  binding.slider.addEventListener('keydown', (event) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) {
      beginControlHistoryEdit()
    }
  })
  binding.slider.addEventListener('input', syncFromSlider)
  binding.slider.addEventListener('change', finishControlHistoryEdit)
  binding.valueInput.addEventListener('focus', beginControlHistoryEdit)
  binding.valueInput.addEventListener('change', () => {
    commitDepthGradientValueInput(binding)
    finishControlHistoryEdit()
  })
  binding.valueInput.addEventListener('blur', () => {
    commitDepthGradientValueInput(binding)
    finishControlHistoryEdit()
  })
}

function bindSymmetrySlider(binding: SymmetrySliderBinding): void {
  const syncFromSlider = (): void => {
    beginControlHistoryEdit()
    const value = readSymmetrySliderNumber(binding)
    binding.slider.value = `${value}`
    binding.valueInput.value = formatSymmetrySliderValue(binding, value)
    updateRangeProgress(binding.slider)
    rebuildBatwing()
  }

  binding.slider.addEventListener('pointerdown', beginControlHistoryEdit)
  binding.slider.addEventListener('pointerup', finishControlHistoryEdit)
  binding.slider.addEventListener('pointercancel', finishControlHistoryEdit)
  binding.slider.addEventListener('keydown', (event) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) {
      beginControlHistoryEdit()
    }
  })
  binding.slider.addEventListener('input', syncFromSlider)
  binding.slider.addEventListener('change', finishControlHistoryEdit)
  binding.valueInput.addEventListener('focus', beginControlHistoryEdit)
  binding.valueInput.addEventListener('change', () => {
    commitSymmetryValueInput(binding)
    finishControlHistoryEdit()
  })
  binding.valueInput.addEventListener('blur', () => {
    commitSymmetryValueInput(binding)
    finishControlHistoryEdit()
  })
  binding.valueInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitSymmetryValueInput(binding)
      finishControlHistoryEdit()
      binding.valueInput.blur()
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      binding.valueInput.value = formatSymmetrySliderValue(binding, readSymmetrySliderNumber(binding))
      clearControlHistoryEdit()
      binding.valueInput.blur()
    }
  })
}

function bindLatticeSlider(binding: LatticeSliderBinding): void {
  const syncFromSlider = (): void => {
    beginControlHistoryEdit()
    const value = readLatticeSliderNumber(binding)
    binding.slider.value = `${value}`
    binding.valueInput.value = formatLatticeSliderValue(value)
    updateRangeProgress(binding.slider)
    rebuildBatwing()
  }

  binding.slider.addEventListener('pointerdown', beginControlHistoryEdit)
  binding.slider.addEventListener('pointerup', finishControlHistoryEdit)
  binding.slider.addEventListener('pointercancel', finishControlHistoryEdit)
  binding.slider.addEventListener('keydown', (event) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) {
      beginControlHistoryEdit()
    }
  })
  binding.slider.addEventListener('input', syncFromSlider)
  binding.slider.addEventListener('change', finishControlHistoryEdit)
  binding.valueInput.addEventListener('focus', beginControlHistoryEdit)
  binding.valueInput.addEventListener('change', () => {
    commitLatticeValueInput(binding)
    finishControlHistoryEdit()
  })
  binding.valueInput.addEventListener('blur', () => {
    commitLatticeValueInput(binding)
    finishControlHistoryEdit()
  })
  binding.valueInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitLatticeValueInput(binding)
      finishControlHistoryEdit()
      binding.valueInput.blur()
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      binding.valueInput.value = formatLatticeSliderValue(readLatticeSliderNumber(binding))
      clearControlHistoryEdit()
      binding.valueInput.blur()
    }
  })
}

function bindLatticeInfluenceSlider(binding: LatticeInfluenceSliderBinding): void {
  const syncFromSlider = (): void => {
    beginControlHistoryEdit()
    const value = readLatticeInfluenceSliderNumber(binding)
    binding.slider.value = `${value}`
    binding.valueInput.value = formatSliderValue(value)
    updateRangeProgress(binding.slider)
  }

  binding.slider.addEventListener('pointerdown', beginControlHistoryEdit)
  binding.slider.addEventListener('pointerup', finishControlHistoryEdit)
  binding.slider.addEventListener('pointercancel', finishControlHistoryEdit)
  binding.slider.addEventListener('keydown', (event) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) {
      beginControlHistoryEdit()
    }
  })
  binding.slider.addEventListener('input', syncFromSlider)
  binding.slider.addEventListener('change', finishControlHistoryEdit)
  binding.valueInput.addEventListener('focus', beginControlHistoryEdit)
  binding.valueInput.addEventListener('change', () => {
    commitLatticeInfluenceValueInput(binding)
    finishControlHistoryEdit()
  })
  binding.valueInput.addEventListener('blur', () => {
    commitLatticeInfluenceValueInput(binding)
    finishControlHistoryEdit()
  })
  binding.valueInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitLatticeInfluenceValueInput(binding)
      finishControlHistoryEdit()
      binding.valueInput.blur()
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      binding.valueInput.value = formatSliderValue(readLatticeInfluenceSliderNumber(binding))
      clearControlHistoryEdit()
      binding.valueInput.blur()
    }
  })
}

function bindTargetSurfaceSlider(binding: TargetSurfaceSliderBinding): void {
  const syncFromSlider = (): void => {
    beginControlHistoryEdit()
    const value = readTargetSurfaceSliderNumber(binding)
    binding.slider.value = `${value}`
    binding.valueInput.value = formatSliderValue(value)
    updateRangeProgress(binding.slider)
    rebuildBatwing()
  }

  binding.slider.addEventListener('pointerdown', beginControlHistoryEdit)
  binding.slider.addEventListener('pointerup', finishControlHistoryEdit)
  binding.slider.addEventListener('pointercancel', finishControlHistoryEdit)
  binding.slider.addEventListener('keydown', (event) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) {
      beginControlHistoryEdit()
    }
  })
  binding.slider.addEventListener('input', syncFromSlider)
  binding.slider.addEventListener('change', finishControlHistoryEdit)
  binding.valueInput.addEventListener('focus', beginControlHistoryEdit)
  binding.valueInput.addEventListener('change', () => {
    commitTargetSurfaceValueInput(binding)
    finishControlHistoryEdit()
  })
  binding.valueInput.addEventListener('blur', () => {
    commitTargetSurfaceValueInput(binding)
    finishControlHistoryEdit()
  })
}

function rebuildBatwing(): void {
  const geometryType = getCurrentGeometryType()
  const batwingFamily = getCurrentBatwingFamily()
  const settings = getCurrentSettings()
  const arraySettings = getCurrentArraySettings()
  const depthGradientSettings = getCurrentDepthGradientSettings()
  const symmetrySettings = getCurrentSymmetrySettings()
  const sourceQuadMesh = buildSubdividedWeldedArrayQuadMesh(
    geometryType,
    batwingFamily,
    settings,
    arraySettings,
    symmetrySettings,
  )
  currentSourceQuadMesh = cloneQuadMeshData(sourceQuadMesh)
  rebuildLatticeFromCurrentSource()
  const mappedQuadMesh = applyTargetSurfaceMapping(
    applyLatticeDeformation(sourceQuadMesh),
    getCurrentTargetSurfaceSettings(),
  )
  const displayQuadMesh = buildFinalDisplayQuadMesh(
    mappedQuadMesh,
    arraySettings,
    depthGradientSettings,
    getCurrentTargetSurfaceSettings().offsetMode,
  )
  const nextGeometrySet = buildGeometrySetFromQuadMesh(displayQuadMesh, arraySettings)

  batwingMesh.geometry.dispose()
  batwingMesh.geometry = nextGeometrySet.meshGeometry

  wireOverlay.geometry.dispose()
  wireOverlay.geometry = nextGeometrySet.wireGeometry

  boxGuide.geometry.dispose()
  boxGuide.geometry = buildArrayBoxGuideGeometry(arraySettings)
  updateSeamDebugGeometry()
  updateLightingForCurrentGeometry()
  updateGeometryDataset()
}

function rebuildCurrentDeformedGeometry(): void {
  const sourceQuadMesh = currentSourceQuadMesh
  if (!sourceQuadMesh) {
    return
  }

  const arraySettings = getCurrentArraySettings()
  const depthGradientSettings = getCurrentDepthGradientSettings()
  const mappedQuadMesh = applyTargetSurfaceMapping(
    applyLatticeDeformation(sourceQuadMesh),
    getCurrentTargetSurfaceSettings(),
  )
  const displayQuadMesh = buildFinalDisplayQuadMesh(
    mappedQuadMesh,
    arraySettings,
    depthGradientSettings,
    getCurrentTargetSurfaceSettings().offsetMode,
  )
  const nextGeometrySet = buildGeometrySetFromQuadMesh(displayQuadMesh, arraySettings)
  batwingMesh.geometry.dispose()
  batwingMesh.geometry = nextGeometrySet.meshGeometry
  wireOverlay.geometry.dispose()
  wireOverlay.geometry = nextGeometrySet.wireGeometry
  updateSeamDebugGeometry()
  updateLightingForCurrentGeometry()
  updateGeometryDataset()
}

function updateLightingForCurrentGeometry(): void {
  batwingMesh.updateWorldMatrix(true, false)
  const boundingBox = new THREE.Box3().setFromObject(batwingMesh)
  if (boundingBox.isEmpty()) {
    return
  }

  const center = boundingBox.getCenter(new THREE.Vector3())
  const size = boundingBox.getSize(new THREE.Vector3())
  const shadowRadius = Math.max(size.x, size.y, size.z, BATWING_BOX_DIMENSIONS.width) / 2 + 9
  const lightScale = Math.max(1, shadowRadius / 18)
  keyLight.position.set(center.x - 8 * lightScale, center.y + 13 * lightScale, center.z + 7 * lightScale)
  keyLight.target.position.copy(center)
  keyLight.target.updateMatrixWorld()
  fillLight.position.set(center.x + 9 * lightScale, center.y + 5 * lightScale, center.z - 10 * lightScale)
  rimLight.position.set(center.x + 7 * lightScale, center.y + 4 * lightScale, center.z - 9 * lightScale)
}

function getArrayInstanceCount(settings: BatwingArraySettings): number {
  return settings.lengthCount * settings.widthCount * settings.heightCount
}

function getWeldKey(x: number, y: number, z: number): string {
  const qx = Math.round(x / WELD_EPSILON)
  const qy = Math.round(y / WELD_EPSILON)
  const qz = Math.round(z / WELD_EPSILON)
  return `${qx},${qy},${qz}`
}

function getArrayOffset(
  lengthIndex: number,
  widthIndex: number,
  heightIndex: number,
  settings: BatwingArraySettings,
): THREE.Vector3 {
  return new THREE.Vector3(
    (widthIndex - (settings.widthCount - 1) / 2) * BATWING_BOX_DIMENSIONS.width,
    heightIndex * BATWING_BOX_DIMENSIONS.height,
    (lengthIndex - (settings.lengthCount - 1) / 2) * BATWING_BOX_DIMENSIONS.depth,
  )
}

function forEachArrayOffset(
  settings: BatwingArraySettings,
  callback: (
    offset: THREE.Vector3,
    instanceIndex: number,
    lengthIndex: number,
    widthIndex: number,
    heightIndex: number,
  ) => void,
): void {
  let instanceIndex = 0

  for (let heightIndex = 0; heightIndex < settings.heightCount; heightIndex += 1) {
    for (let widthIndex = 0; widthIndex < settings.widthCount; widthIndex += 1) {
      for (let lengthIndex = 0; lengthIndex < settings.lengthCount; lengthIndex += 1) {
        callback(
          getArrayOffset(lengthIndex, widthIndex, heightIndex, settings),
          instanceIndex,
          lengthIndex,
          widthIndex,
          heightIndex,
        )
        instanceIndex += 1
      }
    }
  }
}

function buildArrayLineGeometry(baseGeometry: THREE.BufferGeometry, settings: BatwingArraySettings): THREE.BufferGeometry {
  const basePosition = baseGeometry.getAttribute('position') as THREE.BufferAttribute
  const instanceCount = getArrayInstanceCount(settings)
  const positions = new Float32Array(basePosition.count * instanceCount * 3)

  forEachArrayOffset(settings, (offset, instanceIndex) => {
    const instanceOffset = instanceIndex * basePosition.count * 3
    for (let vertexIndex = 0; vertexIndex < basePosition.count; vertexIndex += 1) {
      const targetIndex = instanceOffset + vertexIndex * 3
      positions[targetIndex + 0] = basePosition.getX(vertexIndex) + offset.x
      positions[targetIndex + 1] = basePosition.getY(vertexIndex) + offset.y
      positions[targetIndex + 2] = basePosition.getZ(vertexIndex) + offset.z
    }
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.computeBoundingSphere()
  return geometry
}

function buildBatwingGeometrySet(
  geometryType: TpmsGeometryType,
  batwingFamily: BatwingFamilyType,
  settings: BatwingSettings,
  arraySettings: BatwingArraySettings,
  depthGradientSettings: BatwingDepthGradientSettings,
  symmetrySettings: BatwingSymmetrySettings,
): BatwingGeometrySet {
  const quadMesh = buildSubdividedWeldedArrayQuadMesh(
    geometryType,
    batwingFamily,
    settings,
    arraySettings,
    symmetrySettings,
  )
  currentSourceQuadMesh = cloneQuadMeshData(quadMesh)
  const displayQuadMesh = buildFinalDisplayQuadMesh(
    quadMesh,
    arraySettings,
    depthGradientSettings,
    DEFAULT_TARGET_SURFACE_SETTINGS.offsetMode,
  )
  return buildGeometrySetFromQuadMesh(displayQuadMesh, arraySettings)
}

function buildGeometrySetFromQuadMesh(
  quadMesh: QuadMeshData,
  arraySettings: BatwingArraySettings,
): BatwingGeometrySet {
  return {
    meshGeometry: buildGeometryFromQuadMesh(quadMesh, arraySettings),
    wireGeometry: buildQuadWireGeometry(quadMesh),
  }
}

function cloneQuadMeshData(quadMesh: QuadMeshData): QuadMeshData {
  return {
    vertices: quadMesh.vertices.map((vertex) => vertex.clone()),
    quadFaces: quadMesh.quadFaces.map(([a, b, c, d]) => [a, b, c, d]),
  }
}

function createLatticeTransformControl(
  mode: 'translate' | 'rotate' | 'scale',
  size: number,
): LatticeTransformControlHandle {
  const control = new TransformControls(camera, renderer.domElement)
  control.setMode(mode)
  control.setSpace('local')
  control.setSize(size)
  control.addEventListener('dragging-changed', () => {
    if (control.dragging) {
      setExclusiveLatticeTransformControl(control)
    } else {
      setExclusiveLatticeTransformControl(null)
    }
    updateLatticeTransformDraggingState()
  })
  control.addEventListener('mouseDown', () => {
    if (!getLatticeTransformControlAxis(control)) {
      return
    }
    beginLatticeTransformDrag(control)
    isUsingLatticeTransformControls = true
  })
  control.addEventListener('objectChange', updateLatticeTransformDrag)
  control.addEventListener('mouseUp', () => {
    finishLatticeTransformDrag()
    window.setTimeout(() => {
      isUsingLatticeTransformControls = false
      setExclusiveLatticeTransformControl(null)
    }, 0)
  })

  const helper = control.getHelper()
  helper.renderOrder = 8
  stripNonAxisTransformHandles(control, mode)
  if (mode === 'translate') {
    stripTranslateBackArrows(control)
    resizeTranslateArrowHeads(control, TRANSLATE_ARROW_HEAD_SCALE)
  }
  if (mode === 'scale') {
    pushBackScaleHandles(control, BACK_SCALE_HANDLE_OFFSET)
  }
  tintLatticeTransformGizmo(control)
  scene.add(helper)
  return { control, helper }
}

function tintLatticeTransformGizmo(control: TransformControls): void {
  const gizmo = (control as TransformControlsInternalGizmo)._gizmo
  if (!gizmo) {
    return
  }

  for (const modeGroup of Object.values(gizmo.gizmo ?? {})) {
    tintTransformGroupAxisMaterials(modeGroup)
  }
  for (const modeGroup of Object.values(gizmo.helper ?? {})) {
    tintTransformGroupAxisMaterials(modeGroup)
  }
}

function tintTransformGroupAxisMaterials(group: THREE.Object3D): void {
  group.traverse((child) => {
    if (child.name !== 'X' && child.name !== 'Y' && child.name !== 'Z') {
      return
    }

    const materialCarrier = child as THREE.Object3D & {
      material?: THREE.Material | THREE.Material[]
    }
    const materials = Array.isArray(materialCarrier.material)
      ? materialCarrier.material
      : materialCarrier.material
        ? [materialCarrier.material]
        : []
    for (const material of materials) {
      const colorMaterial = material as THREE.Material & { color?: THREE.Color }
      colorMaterial.color?.setHex(LATTICE_GIZMO_AXIS_COLORS[child.name])
    }
  })
}

function stripNonAxisTransformHandles(
  control: TransformControls,
  mode: 'translate' | 'rotate' | 'scale',
): void {
  const allowedNames = mode === 'scale' ? new Set(['X', 'Y', 'Z', 'XYZ']) : new Set(['X', 'Y', 'Z'])
  const gizmo = (control as TransformControlsInternalGizmo)._gizmo
  if (!gizmo) {
    return
  }

  const helperGroup = gizmo.helper?.[mode]
  if (helperGroup) {
    for (const child of [...helperGroup.children]) {
      helperGroup.remove(child)
    }
  }

  const groups: Array<THREE.Object3D | undefined> = [gizmo.gizmo?.[mode], gizmo.picker?.[mode]]
  for (const group of groups) {
    if (!group) {
      continue
    }

    const toRemove = group.children.filter((child) => !allowedNames.has(child.name))
    for (const child of toRemove) {
      group.remove(child)
    }
  }
}

function stripTranslateBackArrows(control: TransformControls): void {
  const axisVectors: Record<'X' | 'Y' | 'Z', THREE.Vector3> = {
    X: new THREE.Vector3(1, 0, 0),
    Y: new THREE.Vector3(0, 1, 0),
    Z: new THREE.Vector3(0, 0, 1),
  }
  const gizmo = (control as TransformControlsInternalGizmo)._gizmo
  if (!gizmo) {
    return
  }

  const groups: Array<THREE.Object3D | undefined> = [gizmo.gizmo?.translate, gizmo.picker?.translate]
  for (const group of groups) {
    if (!group) {
      continue
    }

    for (const axisName of ['X', 'Y', 'Z'] as const) {
      const axisChildren = group.children.filter((child) => child.name === axisName)
      if (axisChildren.length <= 1) {
        continue
      }

      const axisVector = axisVectors[axisName]
      const toRemove: THREE.Object3D[] = []
      for (const child of axisChildren) {
        const meshLike = child as THREE.Object3D & { geometry?: THREE.BufferGeometry }
        const geometry = meshLike.geometry
        if (!geometry) {
          continue
        }

        geometry.computeBoundingBox()
        const boundingBox = geometry.boundingBox
        if (!boundingBox) {
          continue
        }

        const center = boundingBox.getCenter(new THREE.Vector3())
        const projection = center.dot(axisVector)
        if (projection < -1e-4) {
          toRemove.push(child)
        }
      }

      for (const child of toRemove) {
        group.remove(child)
      }
    }
  }
}

function resizeTranslateArrowHeads(control: TransformControls, scaleFactor: number): void {
  const axisVectors: Record<'X' | 'Y' | 'Z', THREE.Vector3> = {
    X: new THREE.Vector3(1, 0, 0),
    Y: new THREE.Vector3(0, 1, 0),
    Z: new THREE.Vector3(0, 0, 1),
  }
  const group = (control as TransformControlsInternalGizmo)._gizmo?.gizmo?.translate
  if (!group) {
    return
  }

  for (const axisName of ['X', 'Y', 'Z'] as const) {
    const axisVector = axisVectors[axisName]
    for (const child of group.children) {
      if (child.name !== axisName) {
        continue
      }

      const meshLike = child as THREE.Object3D & { geometry?: THREE.BufferGeometry }
      const geometry = meshLike.geometry
      if (!geometry) {
        continue
      }

      geometry.computeBoundingBox()
      const boundingBox = geometry.boundingBox
      if (!boundingBox) {
        continue
      }

      const center = boundingBox.getCenter(new THREE.Vector3())
      const size = boundingBox.getSize(new THREE.Vector3())
      const maxExtent = Math.max(size.x, size.y, size.z)
      const minExtent = Math.min(size.x, size.y, size.z)
      const projection = center.dot(axisVector)
      const isArrowHead = projection > 0.35 && maxExtent <= 0.16 && minExtent > 0.03
      if (!isArrowHead) {
        continue
      }

      const centerInv = center.clone().multiplyScalar(-1)
      geometry.translate(centerInv.x, centerInv.y, centerInv.z)
      geometry.scale(scaleFactor, scaleFactor, scaleFactor)
      geometry.translate(center.x, center.y, center.z)
    }
  }
}

function pushBackScaleHandles(control: TransformControls, offset: number): void {
  const axisVectors: Record<'X' | 'Y' | 'Z', THREE.Vector3> = {
    X: new THREE.Vector3(1, 0, 0),
    Y: new THREE.Vector3(0, 1, 0),
    Z: new THREE.Vector3(0, 0, 1),
  }
  const gizmo = (control as TransformControlsInternalGizmo)._gizmo
  if (!gizmo) {
    return
  }

  const visualGroup = gizmo.gizmo?.scale
  if (visualGroup) {
    pushBackScaleHandleGroup(visualGroup, axisVectors, offset)
  }

  const pickerGroup = gizmo.picker?.scale
  if (pickerGroup) {
    pushBackScaleHandleGroup(pickerGroup, axisVectors, offset)
  }
}

function pushBackScaleHandleGroup(
  group: THREE.Object3D,
  axisVectors: Record<'X' | 'Y' | 'Z', THREE.Vector3>,
  offset: number,
): void {
  for (const axisName of ['X', 'Y', 'Z'] as const) {
    const axisVector = axisVectors[axisName]
    const toRemove: THREE.Object3D[] = []
    for (const child of group.children) {
      if (child.name !== axisName) {
        continue
      }

      const meshLike = child as THREE.Object3D & { geometry?: THREE.BufferGeometry }
      const geometry = meshLike.geometry
      if (!geometry) {
        continue
      }

      geometry.computeBoundingBox()
      const boundingBox = geometry.boundingBox
      if (!boundingBox) {
        continue
      }

      const center = boundingBox.getCenter(new THREE.Vector3())
      const projection = center.dot(axisVector)
      if (projection > 1e-4) {
        toRemove.push(child)
      } else if (projection < -1e-4) {
        geometry.translate(-axisVector.x * offset, -axisVector.y * offset, -axisVector.z * offset)
      }
    }
    for (const child of toRemove) {
      group.remove(child)
    }
  }
}

function beginLatticeTransformDrag(activeControl: TransformControls): void {
  if (selectedLatticePointIndices.size === 0 || !latticeState || !getLatticeTransformControlAxis(activeControl)) {
    return
  }

  beginControlHistoryEdit()
  setExclusiveLatticeTransformControl(activeControl)
  latticeTransformAnchor.updateMatrixWorld(true)
  const anchorStartMatrix = latticeTransformAnchor.matrixWorld.clone()
  const anchorStartInverse = anchorStartMatrix.clone().invert()
  const pointStartPositions = new Map<number, THREE.Vector3>()
  const allPointStartPositions = new Map<number, THREE.Vector3>()
  for (const point of latticeState.points) {
    allPointStartPositions.set(point.index, point.position.clone())
  }
  selectedLatticePointIndices.forEach((index) => {
    const point = latticeState?.points[index]
    if (point) {
      pointStartPositions.set(index, point.position.clone())
    }
  })
  const influenceWeights = buildLatticeInfluenceWeights(
    latticeState,
    pointStartPositions,
    getCurrentLatticeInfluenceSettings(),
  )

  latticeTransformDragState = {
    anchorStartMatrix,
    anchorStartInverse,
    pointStartPositions,
    allPointStartPositions,
    influenceWeights,
  }
}

function updateLatticeTransformDrag(): void {
  if (!latticeState || !latticeTransformDragState) {
    return
  }

  latticeTransformAnchor.updateMatrixWorld(true)
  for (const point of latticeState.points) {
    const startPosition = latticeTransformDragState.allPointStartPositions.get(point.index)
    if (!startPosition) {
      continue
    }
    const influence = latticeTransformDragState.influenceWeights.get(point.index) ?? 0
    if (influence <= 0) {
      point.position.copy(startPosition)
      continue
    }

    const transformedPosition = startPosition
      .clone()
      .applyMatrix4(latticeTransformDragState.anchorStartInverse)
      .applyMatrix4(latticeTransformAnchor.matrixWorld)
    point.position.copy(startPosition).lerp(transformedPosition, influence)
  }

  refreshLatticeVisuals(false)
  rebuildCurrentDeformedGeometry()
}

function buildLatticeInfluenceWeights(
  state: LatticeState,
  selectedStartPositions: ReadonlyMap<number, THREE.Vector3>,
  settings: BatwingLatticeInfluenceSettings,
): Map<number, number> {
  const weights = new Map<number, number>()
  if (selectedStartPositions.size === 0) {
    return weights
  }

  const selectedPoints = [...selectedStartPositions.values()]
  const radius = Math.max(settings.falloffRadius, 0)
  const strength = clampNumber(settings.falloffStrength, 0, 1)
  for (const point of state.points) {
    if (selectedStartPositions.has(point.index)) {
      weights.set(point.index, 1)
      continue
    }

    if (radius <= 0 || strength <= 0) {
      weights.set(point.index, 0)
      continue
    }

    const nearestDistance = selectedPoints.reduce(
      (nearest, selectedPoint) => Math.min(nearest, selectedPoint.distanceTo(point.position)),
      Number.POSITIVE_INFINITY,
    )
    const normalizedDistance = clampNumber(nearestDistance / radius, 0, 1)
    const falloff = 1 - normalizedDistance * normalizedDistance * (3 - 2 * normalizedDistance)
    weights.set(point.index, clampNumber(falloff * strength, 0, 1))
  }

  return weights
}

function finishLatticeTransformDrag(): void {
  updateLatticeTransformDrag()
  latticeTransformDragState = null
  syncLatticeTransformAnchorToSelection()
  finishControlHistoryEdit()
}

function setExclusiveLatticeTransformControl(activeControl: TransformControls | null): void {
  for (const control of latticeTransformControls) {
    control.enabled = activeControl === null || control === activeControl
  }
}

function updateLatticeTransformDraggingState(): void {
  const isDragging = latticeTransformControls.some((control) => control.dragging)
  isLatticeTransformDragging = isDragging
  controls.enabled = !isDragging
}

function getLatticeTransformControlAxis(control: TransformControls): string | null {
  const axis = (control as unknown as { axis?: string | null }).axis
  return typeof axis === 'string' ? axis : null
}

function rebuildLatticeFromCurrentSource(): void {
  const sourceQuadMesh = currentSourceQuadMesh
  const previousLatticeState = latticeState ? cloneLatticeState(latticeState) : null
  if (!sourceQuadMesh || sourceQuadMesh.vertices.length === 0) {
    latticeState = null
    hoveredLatticePointIndex = null
    selectedLatticePointIndices.clear()
    refreshLatticeVisuals()
    return
  }

  const settings = getCurrentLatticeSettings()
  const bounds = computeQuadMeshBounds(sourceQuadMesh)
  const size = bounds.getSize(new THREE.Vector3())
  const points: LatticePoint[] = []
  const widthPointCount = getLatticeWidthPointCount(settings)
  const heightPointCount = getLatticeHeightPointCount(settings)
  const lengthPointCount = getLatticeLengthPointCount(settings)

  for (let heightIndex = 0; heightIndex < heightPointCount; heightIndex += 1) {
    for (let widthIndex = 0; widthIndex < widthPointCount; widthIndex += 1) {
      for (let lengthIndex = 0; lengthIndex < lengthPointCount; lengthIndex += 1) {
        const position = new THREE.Vector3(
          getLatticeAxisPosition(bounds.min.x, size.x, widthPointCount, widthIndex),
          getLatticeAxisPosition(bounds.min.y, size.y, heightPointCount, heightIndex),
          getLatticeAxisPosition(bounds.min.z, size.z, lengthPointCount, lengthIndex),
        )
        points.push({
          index: points.length,
          widthIndex,
          heightIndex,
          lengthIndex,
          restPosition: position.clone(),
          position,
        })
      }
    }
  }

  latticeState = {
    settings: cloneLatticeSettings(settings),
    bounds,
    size,
    points,
  }
  if (previousLatticeState) {
    preserveLatticeDeformation(previousLatticeState, latticeState)
  }
  hoveredLatticePointIndex = null
  selectedLatticePointIndices.clear()
  latticeTransformDragState = null
  refreshLatticeVisuals()
}

function cloneLatticeState(state: LatticeState): LatticeState {
  return {
    settings: cloneLatticeSettings(state.settings),
    bounds: state.bounds.clone(),
    size: state.size.clone(),
    points: state.points.map((point) => ({
      index: point.index,
      widthIndex: point.widthIndex,
      heightIndex: point.heightIndex,
      lengthIndex: point.lengthIndex,
      restPosition: point.restPosition.clone(),
      position: point.position.clone(),
    })),
  }
}

function preserveLatticeDeformation(previousState: LatticeState, nextState: LatticeState): void {
  for (const point of nextState.points) {
    const normalized = getNormalizedPointInBounds(point.restPosition, nextState.bounds, nextState.size)
    const previousRestPosition = getPointFromNormalizedBounds(normalized, previousState.bounds, previousState.size)
    const previousDeformedPosition = sampleLatticeStatePosition(previousState, previousRestPosition)
    const previousDelta = previousDeformedPosition.sub(previousRestPosition)
    point.position.copy(point.restPosition).add(scaleLatticeDeltaToBounds(previousDelta, previousState.size, nextState.size))
  }
}

function computeQuadMeshBounds(quadMesh: QuadMeshData): THREE.Box3 {
  const bounds = new THREE.Box3()
  for (const vertex of quadMesh.vertices) {
    bounds.expandByPoint(vertex)
  }
  return bounds
}

function getNormalizedPointInBounds(point: THREE.Vector3, bounds: THREE.Box3, size: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3(
    getNormalizedAxisValue(point.x, bounds.min.x, size.x),
    getNormalizedAxisValue(point.y, bounds.min.y, size.y),
    getNormalizedAxisValue(point.z, bounds.min.z, size.z),
  )
}

function getNormalizedAxisValue(value: number, min: number, size: number): number {
  if (Math.abs(size) <= SCALE_EPSILON) {
    return 0.5
  }
  return clampNumber((value - min) / size, 0, 1)
}

function getPointFromNormalizedBounds(normalized: THREE.Vector3, bounds: THREE.Box3, size: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3(
    bounds.min.x + size.x * normalized.x,
    bounds.min.y + size.y * normalized.y,
    bounds.min.z + size.z * normalized.z,
  )
}

function scaleLatticeDeltaToBounds(delta: THREE.Vector3, previousSize: THREE.Vector3, nextSize: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3(
    scaleLatticeDeltaAxis(delta.x, previousSize.x, nextSize.x),
    scaleLatticeDeltaAxis(delta.y, previousSize.y, nextSize.y),
    scaleLatticeDeltaAxis(delta.z, previousSize.z, nextSize.z),
  )
}

function scaleLatticeDeltaAxis(delta: number, previousSize: number, nextSize: number): number {
  if (Math.abs(previousSize) <= SCALE_EPSILON) {
    return delta
  }
  return (delta / previousSize) * nextSize
}

function getLatticeAxisPosition(min: number, size: number, count: number, index: number): number {
  if (count <= 1 || Math.abs(size) <= SCALE_EPSILON) {
    return min + size / 2
  }
  return min + size * (index / (count - 1))
}

function applyLatticeDeformation(quadMesh: QuadMeshData): QuadMeshData {
  if (!latticeState) {
    return quadMesh
  }

  return {
    vertices: quadMesh.vertices.map((vertex) => sampleLatticeDeformation(vertex)),
    quadFaces: quadMesh.quadFaces,
  }
}

function applyTargetSurfaceMapping(
  quadMesh: QuadMeshData,
  settings: BatwingTargetSurfaceSettings,
): QuadMeshData {
  if (!targetMappingEnabled || !loadedTargetSurface || loadedTargetSurface.triangles.length === 0) {
    return quadMesh
  }
  loadedTargetSurface.previewMesh.updateMatrixWorld(true)
  const meshMatrix = loadedTargetSurface.previewMesh.matrixWorld.clone()
  const targetScale = Math.max(settings.targetScale, 0.01)
  const blend = clampNumber(settings.blend, 0, 1)
  const offset = settings.offset
  const sourceBounds = computeQuadMeshBounds(quadMesh)
  const sourceSize = sourceBounds.getSize(new THREE.Vector3())

  const transformedTriangles = loadedTargetSurface.triangles.map(([a, b, c]) => [
    a.clone().multiplyScalar(targetScale).applyMatrix4(meshMatrix),
    b.clone().multiplyScalar(targetScale).applyMatrix4(meshMatrix),
    c.clone().multiplyScalar(targetScale).applyMatrix4(meshMatrix),
  ] as [THREE.Vector3, THREE.Vector3, THREE.Vector3])
  const targetBounds = new THREE.Box3()
  for (const [a, b, c] of transformedTriangles) {
    targetBounds.expandByPoint(a)
    targetBounds.expandByPoint(b)
    targetBounds.expandByPoint(c)
  }
  const targetSize = targetBounds.getSize(new THREE.Vector3())
  const targetMin = targetBounds.min

  const vertices = quadMesh.vertices.map((vertex) => {
    const nx = Math.abs(sourceSize.x) <= SCALE_EPSILON ? 0.5 : clampNumber((vertex.x - sourceBounds.min.x) / sourceSize.x, 0, 1)
    const ny = Math.abs(sourceSize.y) <= SCALE_EPSILON ? 0.5 : clampNumber((vertex.y - sourceBounds.min.y) / sourceSize.y, 0, 1)
    const nz = Math.abs(sourceSize.z) <= SCALE_EPSILON ? 0.5 : clampNumber((vertex.z - sourceBounds.min.z) / sourceSize.z, 0, 1)
    const seedPoint = new THREE.Vector3(
      targetMin.x + targetSize.x * nx,
      targetMin.y + targetSize.y * ny,
      targetMin.z + targetSize.z * nz,
    )
    const closest = getClosestPointOnTriangleSet(seedPoint, transformedTriangles)
    const target = closest.position
    const blended = vertex.clone().lerp(target, blend)
    const normalDir = closest.normal.clone()
    if (!Number.isFinite(normalDir.lengthSq()) || normalDir.lengthSq() <= 1e-12) {
      return blended
    }
    return blended.addScaledVector(normalDir, offset)
  })

  return {
    vertices,
    quadFaces: quadMesh.quadFaces,
  }
}

function getClosestPointOnTriangleSet(
  point: THREE.Vector3,
  triangles: ReadonlyArray<[THREE.Vector3, THREE.Vector3, THREE.Vector3]>,
): { position: THREE.Vector3; normal: THREE.Vector3 } {
  let bestDistanceSquared = Number.POSITIVE_INFINITY
  let bestPoint = point.clone()
  let bestNormal = new THREE.Vector3(0, 1, 0)
  const tempClosest = new THREE.Vector3()
  const tempNormal = new THREE.Vector3()
  const tempTriangle = new THREE.Triangle()

  for (const [a, b, c] of triangles) {
    THREE.Triangle.getNormal(a, b, c, tempNormal)
    tempTriangle.set(a, b, c)
    tempTriangle.closestPointToPoint(point, tempClosest)
    const distanceSquared = tempClosest.distanceToSquared(point)
    if (distanceSquared < bestDistanceSquared) {
      bestDistanceSquared = distanceSquared
      bestPoint = tempClosest.clone()
      bestNormal = tempNormal.clone()
    }
  }

  if (bestNormal.lengthSq() <= 1e-12) {
    bestNormal.set(0, 1, 0)
  } else {
    bestNormal.normalize()
  }
  return { position: bestPoint, normal: bestNormal }
}

async function loadTargetSurfaceFromInput(): Promise<void> {
  const file = targetSurfaceFileInput.files?.[0]
  if (!file) {
    return
  }

  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension !== 'obj' && extension !== 'stl') {
    return
  }

  const fileText = extension === 'obj' ? await file.text() : null
  const fileBuffer = extension === 'stl' ? await file.arrayBuffer() : null
  const geometry = extension === 'obj' ? parseObjGeometry(fileText ?? '') : parseStlGeometry(fileBuffer ?? new ArrayBuffer(0))
  if (!geometry) {
    return
  }

  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  // Center target geometry so transform gizmo pivots at geometric center.
  const initialBounds = geometry.boundingBox?.clone() ?? new THREE.Box3()
  const initialCenter = initialBounds.getCenter(new THREE.Vector3())
  geometry.translate(-initialCenter.x, -initialCenter.y, -initialCenter.z)
  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox?.clone() ?? new THREE.Box3()
  const triangles = extractGeometryTriangles(geometry)
  const previewMesh = new THREE.Mesh(
    geometry.clone(),
    new THREE.MeshStandardMaterial({
      color: 0x8fd5ff,
      roughness: 0.5,
      metalness: 0.05,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
      wireframe: false,
    }),
  )
  previewMesh.renderOrder = 1
  previewMesh.frustumCulled = false
  scene.add(previewMesh)

  if (loadedTargetSurface) {
    scene.remove(loadedTargetSurface.previewMesh)
    loadedTargetSurface.previewMesh.geometry.dispose()
    loadedTargetSurface.previewMesh.material.dispose()
  }

  loadedTargetSurface = {
    name: file.name,
    triangles,
    bounds,
    previewMesh,
  }
  targetTransformControl.attach(previewMesh)
  targetTransformControl.enabled = true
  targetTransformHelper.visible = true
  targetTransformControl.setMode('translate')
  snapTargetToBatwingBounds()
  syncTargetTransformInputsFromMesh()
  targetMappingEnabled = false
  geometry.dispose()
  rebuildBatwing()
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180
}

function syncTargetTransformInputsFromMesh(): void {
  const mesh = loadedTargetSurface?.previewMesh
  if (!mesh) {
    targetRotXInput.value = '0.0'
    targetRotYInput.value = '0.0'
    targetRotZInput.value = '0.0'
    targetScaleUniformInput.value = '1.00'
    return
  }

  // Enforce uniform scale if gizmo introduced non-uniform values.
  const uniformScale = (mesh.scale.x + mesh.scale.y + mesh.scale.z) / 3
  mesh.scale.setScalar(uniformScale)

  targetRotXInput.value = radiansToDegrees(mesh.rotation.x).toFixed(1)
  targetRotYInput.value = radiansToDegrees(mesh.rotation.y).toFixed(1)
  targetRotZInput.value = radiansToDegrees(mesh.rotation.z).toFixed(1)
  targetScaleUniformInput.value = uniformScale.toFixed(2)
}

function applyTargetTransformFromInputs(): void {
  const mesh = loadedTargetSurface?.previewMesh
  if (!mesh) {
    return
  }

  const rotX = Number.parseFloat(targetRotXInput.value)
  const rotY = Number.parseFloat(targetRotYInput.value)
  const rotZ = Number.parseFloat(targetRotZInput.value)
  const uniformScale = Number.parseFloat(targetScaleUniformInput.value)
  if (Number.isFinite(rotX)) {
    mesh.rotation.x = degreesToRadians(rotX)
  }
  if (Number.isFinite(rotY)) {
    mesh.rotation.y = degreesToRadians(rotY)
  }
  if (Number.isFinite(rotZ)) {
    mesh.rotation.z = degreesToRadians(rotZ)
  }
  if (Number.isFinite(uniformScale) && uniformScale > 1e-4) {
    mesh.scale.setScalar(uniformScale)
  }
  mesh.updateMatrixWorld(true)
  syncTargetTransformInputsFromMesh()
  if (targetMappingEnabled) {
    rebuildBatwing()
  }
}

function snapTargetToBatwingBounds(): void {
  if (!loadedTargetSurface || !currentSourceQuadMesh) {
    return
  }

  const sourceBounds = computeQuadMeshBounds(currentSourceQuadMesh)
  const sourceCenter = sourceBounds.getCenter(new THREE.Vector3())
  const sourceSize = sourceBounds.getSize(new THREE.Vector3())
  const targetSize = loadedTargetSurface.bounds.getSize(new THREE.Vector3())
  const safeTargetSize = new THREE.Vector3(
    Math.max(targetSize.x, 1e-6),
    Math.max(targetSize.y, 1e-6),
    Math.max(targetSize.z, 1e-6),
  )
  const fitScale = Math.min(sourceSize.x / safeTargetSize.x, sourceSize.y / safeTargetSize.y, sourceSize.z / safeTargetSize.z)
  loadedTargetSurface.previewMesh.position.copy(sourceCenter)
  loadedTargetSurface.previewMesh.rotation.set(0, 0, 0)
  loadedTargetSurface.previewMesh.scale.setScalar(clampNumber(fitScale, 1e-4, 1e4))
  loadedTargetSurface.previewMesh.updateMatrixWorld(true)
  syncTargetTransformInputsFromMesh()
  if (targetMappingEnabled) {
    rebuildBatwing()
  }
}

function parseObjGeometry(source: string): THREE.BufferGeometry | null {
  const object = new OBJLoader().parse(source)
  const geometries: THREE.BufferGeometry[] = []
  object.traverse((child) => {
    const meshLike = child as THREE.Object3D & { geometry?: THREE.BufferGeometry }
    if (meshLike.geometry) {
      geometries.push(meshLike.geometry)
    }
  })
  if (geometries.length === 0) {
    return null
  }
  return mergeBufferGeometries(geometries)
}

function parseStlGeometry(buffer: ArrayBuffer): THREE.BufferGeometry | null {
  if (buffer.byteLength === 0) {
    return null
  }
  const geometry = new STLLoader().parse(buffer)
  return geometry
}

function extractGeometryTriangles(
  geometry: THREE.BufferGeometry,
): Array<[THREE.Vector3, THREE.Vector3, THREE.Vector3]> {
  const position = geometry.getAttribute('position')
  const triangles: Array<[THREE.Vector3, THREE.Vector3, THREE.Vector3]> = []
  const index = geometry.getIndex()
  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const aIndex = index.getX(i)
      const bIndex = index.getX(i + 1)
      const cIndex = index.getX(i + 2)
      triangles.push([
        new THREE.Vector3(position.getX(aIndex), position.getY(aIndex), position.getZ(aIndex)),
        new THREE.Vector3(position.getX(bIndex), position.getY(bIndex), position.getZ(bIndex)),
        new THREE.Vector3(position.getX(cIndex), position.getY(cIndex), position.getZ(cIndex)),
      ])
    }
    return triangles
  }

  for (let i = 0; i + 2 < position.count; i += 3) {
    triangles.push([
      new THREE.Vector3(position.getX(i), position.getY(i), position.getZ(i)),
      new THREE.Vector3(position.getX(i + 1), position.getY(i + 1), position.getZ(i + 1)),
      new THREE.Vector3(position.getX(i + 2), position.getY(i + 2), position.getZ(i + 2)),
    ])
  }
  return triangles
}

function mergeBufferGeometries(geometries: readonly THREE.BufferGeometry[]): THREE.BufferGeometry {
  const mergedPositions: number[] = []
  for (const geometry of geometries) {
    const position = geometry.getAttribute('position')
    for (let index = 0; index < position.count; index += 1) {
      mergedPositions.push(position.getX(index), position.getY(index), position.getZ(index))
    }
  }
  const mergedGeometry = new THREE.BufferGeometry()
  mergedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(mergedPositions, 3))
  return mergedGeometry
}

function sampleLatticeDeformation(position: THREE.Vector3): THREE.Vector3 {
  if (!latticeState) {
    return position.clone()
  }
  return sampleLatticeStatePosition(latticeState, position)
}

function sampleLatticeStatePosition(state: LatticeState, position: THREE.Vector3): THREE.Vector3 {
  const { bounds, size, settings } = state
  const widthSample = getLatticeAxisSample(position.x, bounds.min.x, size.x, getLatticeWidthPointCount(settings))
  const heightSample = getLatticeAxisSample(position.y, bounds.min.y, size.y, getLatticeHeightPointCount(settings))
  const lengthSample = getLatticeAxisSample(position.z, bounds.min.z, size.z, getLatticeLengthPointCount(settings))

  return trilinearSampleLatticePoint(
    state,
    widthSample.index0,
    widthSample.index1,
    widthSample.alpha,
    heightSample.index0,
    heightSample.index1,
    heightSample.alpha,
    lengthSample.index0,
    lengthSample.index1,
    lengthSample.alpha,
  )
}

function getLatticeAxisSample(
  coordinate: number,
  min: number,
  size: number,
  count: number,
): { index0: number; index1: number; alpha: number } {
  if (count <= 1 || Math.abs(size) <= SCALE_EPSILON) {
    return { index0: 0, index1: 0, alpha: 0 }
  }

  const normalized = clampNumber((coordinate - min) / size, 0, 1)
  const gridCoordinate = normalized * (count - 1)
  const index0 = Math.floor(gridCoordinate)
  const index1 = Math.min(index0 + 1, count - 1)
  return {
    index0,
    index1,
    alpha: gridCoordinate - index0,
  }
}

function trilinearSampleLatticePoint(
  state: LatticeState,
  width0: number,
  width1: number,
  widthAlpha: number,
  height0: number,
  height1: number,
  heightAlpha: number,
  length0: number,
  length1: number,
  lengthAlpha: number,
): THREE.Vector3 {
  const p000 = getLatticePointPosition(state, width0, height0, length0)
  const p100 = getLatticePointPosition(state, width1, height0, length0)
  const p010 = getLatticePointPosition(state, width0, height1, length0)
  const p110 = getLatticePointPosition(state, width1, height1, length0)
  const p001 = getLatticePointPosition(state, width0, height0, length1)
  const p101 = getLatticePointPosition(state, width1, height0, length1)
  const p011 = getLatticePointPosition(state, width0, height1, length1)
  const p111 = getLatticePointPosition(state, width1, height1, length1)

  const x00 = p000.clone().lerp(p100, widthAlpha)
  const x10 = p010.clone().lerp(p110, widthAlpha)
  const x01 = p001.clone().lerp(p101, widthAlpha)
  const x11 = p011.clone().lerp(p111, widthAlpha)
  const y0 = x00.lerp(x10, heightAlpha)
  const y1 = x01.lerp(x11, heightAlpha)
  return y0.lerp(y1, lengthAlpha)
}

function getLatticePointPosition(
  state: LatticeState,
  widthIndex: number,
  heightIndex: number,
  lengthIndex: number,
): THREE.Vector3 {
  const point = state.points[getLatticePointIndex(widthIndex, heightIndex, lengthIndex, state.settings)]
  return point?.position ?? new THREE.Vector3()
}

function getLatticePointIndex(
  widthIndex: number,
  heightIndex: number,
  lengthIndex: number,
  settings: BatwingLatticeSettings,
): number {
  const widthPointCount = getLatticeWidthPointCount(settings)
  const lengthPointCount = getLatticeLengthPointCount(settings)
  return (heightIndex * widthPointCount + widthIndex) * lengthPointCount + lengthIndex
}

function getLatticeLengthPointCount(settings: BatwingLatticeSettings): number {
  return settings.lengthDivisions + 1
}

function getLatticeWidthPointCount(settings: BatwingLatticeSettings): number {
  return settings.widthDivisions + 1
}

function getLatticeHeightPointCount(settings: BatwingLatticeSettings): number {
  return settings.heightDivisions + 1
}

function refreshLatticeVisuals(syncTransformAnchor = true): void {
  refreshLatticePointMesh()
  refreshLatticeLineSegments()
  if (syncTransformAnchor) {
    syncLatticeTransformAnchorToSelection()
  }
}

function isLatticeControlsVisible(): boolean {
  return latticeControlsToggle.checked
}

function updateLatticeControlsVisibility(): void {
  const visible = isLatticeControlsVisible()
  if (!visible) {
    clearLatticeHover()
    latticeMarquee.hidden = true
  }

  if (latticePointMesh) {
    latticePointMesh.visible = visible
  }
  if (latticeHighlightPointMesh) {
    latticeHighlightPointMesh.visible = visible
  }
  if (latticeLineSegments) {
    latticeLineSegments.visible = visible
  }
  syncLatticeTransformAnchorToSelection()
}

function refreshLatticePointMesh(): void {
  if (!latticeState || latticeState.points.length === 0) {
    disposeLatticePointMesh()
    return
  }

  if (!latticePointMesh || !latticeHighlightPointMesh || latticePointMesh.count !== latticeState.points.length) {
    disposeLatticePointMesh()
    const pointMaterial = new THREE.MeshBasicMaterial({
      color: LATTICE_COLOR,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 1,
      toneMapped: false,
    })
    const highlightMaterial = new THREE.MeshBasicMaterial({
      color: LATTICE_SELECTED_COLOR,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 1,
      toneMapped: false,
    })

    latticePointMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 12, 8),
      pointMaterial,
      latticeState.points.length,
    )
    latticeHighlightPointMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 12, 8),
      highlightMaterial,
      latticeState.points.length,
    )
    latticePointMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    latticeHighlightPointMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    latticePointMesh.frustumCulled = false
    latticeHighlightPointMesh.frustumCulled = false
    latticePointMesh.renderOrder = 7
    latticeHighlightPointMesh.renderOrder = 8
    scene.add(latticePointMesh)
    scene.add(latticeHighlightPointMesh)
  }

  const displayScale = getLatticePointDisplayScale()
  let highlightCount = 0
  for (const point of latticeState.points) {
    latticeMatrixHelper.position.copy(point.position)
    latticeMatrixHelper.rotation.set(0, 0, 0)
    latticeMatrixHelper.scale.setScalar(displayScale)
    latticeMatrixHelper.updateMatrix()
    latticePointMesh.setMatrixAt(point.index, latticeMatrixHelper.matrix)
    if (selectedLatticePointIndices.has(point.index) || hoveredLatticePointIndex === point.index) {
      latticeMatrixHelper.scale.setScalar(displayScale * 1.1)
      latticeMatrixHelper.updateMatrix()
      latticeHighlightPointMesh.setMatrixAt(highlightCount, latticeMatrixHelper.matrix)
      highlightCount += 1
    }
  }

  latticeHighlightPointMesh.count = highlightCount
  latticePointMesh.visible = isLatticeControlsVisible()
  latticeHighlightPointMesh.visible = isLatticeControlsVisible()
  latticePointMesh.instanceMatrix.needsUpdate = true
  latticeHighlightPointMesh.instanceMatrix.needsUpdate = true
  latticePointMesh.computeBoundingSphere()
  latticePointMesh.computeBoundingBox()
  latticeHighlightPointMesh.computeBoundingSphere()
  latticeHighlightPointMesh.computeBoundingBox()
}

function refreshLatticeLineSegments(): void {
  if (!latticeState || latticeState.points.length === 0) {
    disposeLatticeLineSegments()
    return
  }

  const geometry = buildLatticeLineGeometry()
  if (!latticeLineSegments) {
    latticeLineSegments = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({
        color: LATTICE_LINE_COLOR,
        transparent: true,
        opacity: 0.34,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    )
    latticeLineSegments.frustumCulled = false
    latticeLineSegments.renderOrder = 6
    latticeLineSegments.visible = isLatticeControlsVisible()
    scene.add(latticeLineSegments)
    return
  }

  latticeLineSegments.geometry.dispose()
  latticeLineSegments.geometry = geometry
  latticeLineSegments.visible = isLatticeControlsVisible()
}

function buildLatticeLineGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  if (!latticeState) {
    return new THREE.BufferGeometry()
  }

  const { settings } = latticeState
  const widthPointCount = getLatticeWidthPointCount(settings)
  const heightPointCount = getLatticeHeightPointCount(settings)
  const lengthPointCount = getLatticeLengthPointCount(settings)
  const addLine = (a: THREE.Vector3, b: THREE.Vector3): void => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z)
  }

  for (let heightIndex = 0; heightIndex < heightPointCount; heightIndex += 1) {
    for (let widthIndex = 0; widthIndex < widthPointCount; widthIndex += 1) {
      for (let lengthIndex = 0; lengthIndex < lengthPointCount; lengthIndex += 1) {
        const point = getLatticePointPosition(latticeState, widthIndex, heightIndex, lengthIndex)
        if (widthIndex + 1 < widthPointCount) {
          addLine(point, getLatticePointPosition(latticeState, widthIndex + 1, heightIndex, lengthIndex))
        }
        if (heightIndex + 1 < heightPointCount) {
          addLine(point, getLatticePointPosition(latticeState, widthIndex, heightIndex + 1, lengthIndex))
        }
        if (lengthIndex + 1 < lengthPointCount) {
          addLine(point, getLatticePointPosition(latticeState, widthIndex, heightIndex, lengthIndex + 1))
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeBoundingSphere()
  return geometry
}

function getLatticePointDisplayScale(): number {
  if (!latticeState) {
    return LATTICE_POINT_SIZE
  }

  const maxSize = Math.max(latticeState.size.x, latticeState.size.y, latticeState.size.z, 1)
  return clampNumber(maxSize / 120, LATTICE_POINT_SIZE, 0.24)
}

function disposeLatticePointMesh(): void {
  if (latticePointMesh) {
    scene.remove(latticePointMesh)
    latticePointMesh.geometry.dispose()
    latticePointMesh.material.dispose()
    latticePointMesh = null
  }

  if (latticeHighlightPointMesh) {
    scene.remove(latticeHighlightPointMesh)
    latticeHighlightPointMesh.geometry.dispose()
    latticeHighlightPointMesh.material.dispose()
    latticeHighlightPointMesh = null
  }
}

function disposeLatticeLineSegments(): void {
  if (!latticeLineSegments) {
    return
  }

  scene.remove(latticeLineSegments)
  latticeLineSegments.geometry.dispose()
  latticeLineSegments.material.dispose()
  latticeLineSegments = null
}

function syncLatticeTransformAnchorToSelection(): void {
  const average = getSelectedLatticeAverage()
  const hasSelection = average !== null
  const showTransformControls = hasSelection && isLatticeControlsVisible()
  latticeTransformAnchor.visible = showTransformControls
  for (const helper of latticeTransformControlHelpers) {
    helper.visible = showTransformControls
  }

  if (!average || !showTransformControls) {
    for (const control of latticeTransformControls) {
      control.detach()
    }
    return
  }

  latticeTransformAnchor.position.copy(average)
  latticeTransformAnchor.rotation.set(0, 0, 0)
  latticeTransformAnchor.scale.set(1, 1, 1)
  latticeTransformAnchor.updateMatrixWorld(true)
  for (const control of latticeTransformControls) {
    control.attach(latticeTransformAnchor)
  }
}

function getSelectedLatticeAverage(): THREE.Vector3 | null {
  if (!latticeState || selectedLatticePointIndices.size === 0) {
    return null
  }

  const average = new THREE.Vector3()
  let count = 0
  selectedLatticePointIndices.forEach((index) => {
    const point = latticeState?.points[index]
    if (point) {
      average.add(point.position)
      count += 1
    }
  })

  if (count === 0) {
    return null
  }
  return average.multiplyScalar(1 / count)
}

function getLatticeSelectionMode(event: MouseEvent): LatticeSelectionMode {
  if (event.ctrlKey || event.metaKey) {
    return 'remove'
  }
  return event.shiftKey ? 'add' : 'replace'
}

function selectSingleLatticePoint(index: number, mode: LatticeSelectionMode): void {
  if (mode === 'remove') {
    selectedLatticePointIndices.delete(index)
    refreshLatticeVisuals()
    return
  }

  if (mode === 'replace') {
    selectedLatticePointIndices.clear()
  }

  if (mode === 'add' && selectedLatticePointIndices.has(index)) {
    selectedLatticePointIndices.delete(index)
  } else {
    selectedLatticePointIndices.add(index)
  }

  refreshLatticeVisuals()
}

function selectLatticePoints(indices: readonly number[], mode: LatticeSelectionMode): void {
  if (mode === 'remove') {
    for (const index of indices) {
      selectedLatticePointIndices.delete(index)
    }
    refreshLatticeVisuals()
    return
  }

  if (mode === 'replace') {
    selectedLatticePointIndices.clear()
  }

  for (const index of indices) {
    selectedLatticePointIndices.add(index)
  }

  refreshLatticeVisuals()
}

function clearLatticeSelection(): void {
  if (selectedLatticePointIndices.size === 0) {
    return
  }

  selectedLatticePointIndices.clear()
  refreshLatticeVisuals()
}

function onLatticePointerDown(event: PointerEvent): void {
  if (event.button !== 0 || isLatticeTransformPointerActive() || !isLatticeControlsVisible()) {
    return
  }

  const hitIndex = pickLatticePoint(event)
  const selectionMode = getLatticeSelectionMode(event)
  if (hitIndex !== null) {
    event.preventDefault()
    selectSingleLatticePoint(hitIndex, selectionMode)
    return
  }

  latticeMarqueeState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    currentX: event.clientX,
    currentY: event.clientY,
    mode: selectionMode,
    active: false,
  }
  canvas.setPointerCapture(event.pointerId)
  event.preventDefault()
}

function onLatticePointerMove(event: PointerEvent): void {
  const marqueeState = latticeMarqueeState
  if (!marqueeState || marqueeState.pointerId !== event.pointerId) {
    updateLatticeHover(event)
    return
  }

  marqueeState.currentX = event.clientX
  marqueeState.currentY = event.clientY
  const deltaX = marqueeState.currentX - marqueeState.startX
  const deltaY = marqueeState.currentY - marqueeState.startY
  if (!marqueeState.active && Math.hypot(deltaX, deltaY) >= LATTICE_MARQUEE_THRESHOLD) {
    marqueeState.active = true
    latticeMarquee.hidden = false
  }

  if (marqueeState.active) {
    updateLatticeMarqueeElement(marqueeState)
  }
}

function updateLatticeHover(event: PointerEvent): void {
  if (isLatticeTransformPointerActive() || !isLatticeControlsVisible()) {
    clearLatticeHover()
    return
  }

  const hitIndex = pickLatticePoint(event)
  if (hoveredLatticePointIndex === hitIndex) {
    return
  }

  hoveredLatticePointIndex = hitIndex
  refreshLatticePointMesh()
}

function clearLatticeHover(): void {
  if (hoveredLatticePointIndex === null) {
    return
  }

  hoveredLatticePointIndex = null
  refreshLatticePointMesh()
}

function onLatticePointerUp(event: PointerEvent): void {
  const marqueeState = latticeMarqueeState
  if (!marqueeState || marqueeState.pointerId !== event.pointerId) {
    return
  }

  if (marqueeState.active) {
    selectLatticePoints(getLatticePointsInMarquee(marqueeState), marqueeState.mode)
  } else if (marqueeState.mode === 'replace') {
    clearLatticeSelection()
  }

  finishLatticeMarquee(event.pointerId)
}

function onLatticePointerCancel(event: PointerEvent): void {
  const marqueeState = latticeMarqueeState
  if (!marqueeState || marqueeState.pointerId !== event.pointerId) {
    return
  }
  finishLatticeMarquee(event.pointerId)
}

function finishLatticeMarquee(pointerId: number): void {
  if (canvas.hasPointerCapture(pointerId)) {
    canvas.releasePointerCapture(pointerId)
  }
  latticeMarqueeState = null
  latticeMarquee.hidden = true
  latticeMarquee.classList.remove('is-deselecting')
}

function isLatticeTransformPointerActive(): boolean {
  return isUsingLatticeTransformControls || isLatticeTransformDragging
}

function pickLatticePoint(event: PointerEvent): number | null {
  if (!latticePointMesh || !latticeState || !isLatticeControlsVisible()) {
    return null
  }

  setPointerFromEvent(event)
  latticeRaycaster.setFromCamera(latticePointer, camera)
  const hits = latticeRaycaster.intersectObject(latticePointMesh, false)
  const hit = hits.find((candidate) => typeof candidate.instanceId === 'number')
  if (hit?.instanceId === undefined || hit.instanceId < 0 || hit.instanceId >= latticeState.points.length) {
    return null
  }

  return hit.instanceId
}

function setPointerFromEvent(event: PointerEvent): void {
  const rect = canvas.getBoundingClientRect()
  latticePointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  latticePointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
}

function updateLatticeMarqueeElement(marqueeState: LatticeMarqueeState): void {
  const left = Math.min(marqueeState.startX, marqueeState.currentX)
  const top = Math.min(marqueeState.startY, marqueeState.currentY)
  const width = Math.abs(marqueeState.currentX - marqueeState.startX)
  const height = Math.abs(marqueeState.currentY - marqueeState.startY)
  latticeMarquee.style.left = `${left}px`
  latticeMarquee.style.top = `${top}px`
  latticeMarquee.style.width = `${width}px`
  latticeMarquee.style.height = `${height}px`
  latticeMarquee.classList.toggle('is-deselecting', marqueeState.mode === 'remove')
}

function getLatticePointsInMarquee(marqueeState: LatticeMarqueeState): number[] {
  if (!latticeState) {
    return []
  }

  const left = Math.min(marqueeState.startX, marqueeState.currentX)
  const right = Math.max(marqueeState.startX, marqueeState.currentX)
  const top = Math.min(marqueeState.startY, marqueeState.currentY)
  const bottom = Math.max(marqueeState.startY, marqueeState.currentY)
  const rect = canvas.getBoundingClientRect()
  const selectedIndices: number[] = []

  for (const point of latticeState.points) {
    latticeProjection.copy(point.position).project(camera)
    if (latticeProjection.z < -1 || latticeProjection.z > 1) {
      continue
    }

    const screenX = rect.left + ((latticeProjection.x + 1) / 2) * rect.width
    const screenY = rect.top + ((-latticeProjection.y + 1) / 2) * rect.height
    if (screenX >= left && screenX <= right && screenY >= top && screenY <= bottom) {
      selectedIndices.push(point.index)
    }
  }

  return selectedIndices
}

function buildSubdividedWeldedArrayQuadMesh(
  geometryType: TpmsGeometryType,
  batwingFamily: BatwingFamilyType,
  settings: BatwingSettings,
  arraySettings: BatwingArraySettings,
  symmetrySettings: BatwingSymmetrySettings,
): QuadMeshData {
  const weldedMesh = buildWeldedArrayQuadMesh(geometryType, batwingFamily, settings, arraySettings, symmetrySettings)
  return weldQuadMeshByPositionPreservingFaceDirections(subdivideCatmullClark(weldedMesh, arraySettings.subdivisions))
}

function buildFinalDisplayQuadMesh(
  mappedQuadMesh: QuadMeshData,
  arraySettings: BatwingArraySettings,
  depthGradientSettings: BatwingDepthGradientSettings,
  offsetMode: BatwingTargetSurfaceSettings['offsetMode'],
): QuadMeshData {
  const depthThicknessScaleMap = buildDepthGradientThicknessScaleMap(mappedQuadMesh, depthGradientSettings)
  const thickenedMesh = createThickenedQuadMesh(
    mappedQuadMesh,
    arraySettings.thickness,
    buildArrayCenterThicknessNormalMap(arraySettings),
    depthThicknessScaleMap,
    offsetMode,
  )
  return weldQuadMeshByPositionPreservingFaceDirections(thickenedMesh)
}

function buildWeldedArrayQuadMesh(
  geometryType: TpmsGeometryType,
  batwingFamily: BatwingFamilyType,
  settings: BatwingSettings,
  arraySettings: BatwingArraySettings,
  symmetrySettings: BatwingSymmetrySettings,
): QuadMeshData {
  return weldQuadMeshByPositionPreservingFaceDirections(
    buildCheckerboardArrayQuadMesh(geometryType, batwingFamily, settings, arraySettings, symmetrySettings),
  )
}

function buildCheckerboardArrayQuadMesh(
  geometryType: TpmsGeometryType,
  batwingFamily: BatwingFamilyType,
  settings: BatwingSettings,
  arraySettings: BatwingArraySettings,
  symmetrySettings: BatwingSymmetrySettings,
): QuadMeshData {
  const baseMesh = buildTpmsQuadMeshData(settings, geometryType, batwingFamily)
  const vertices: THREE.Vector3[] = []
  const quadFaces: QuadFace[] = []
  const symmetryTransforms = buildSymmetryTransforms(symmetrySettings)

  forEachArrayOffset(arraySettings, (offset, _instanceIndex, lengthIndex, widthIndex, heightIndex) => {
    for (const transform of symmetryTransforms) {
      const transformedVertices = baseMesh.vertices.map((vertex) => applySymmetryTransform(vertex, transform))
      const normalizedVertices = normalizeVerticesToCellBounds(transformedVertices)
      const vertexOffset = vertices.length
      for (const vertex of normalizedVertices) {
        vertices.push(vertex.clone().add(offset))
      }

      const flipWinding = shouldFlipArrayCellWinding(lengthIndex, widthIndex, heightIndex)
      for (const baseFace of baseMesh.quadFaces) {
        quadFaces.push(offsetQuadFace(flipWinding ? reverseQuadFace(baseFace) : baseFace, vertexOffset))
      }
    }
  })

  return {
    vertices,
    quadFaces,
  }
}

function normalizeVerticesToCellBounds(vertices: readonly THREE.Vector3[]): THREE.Vector3[] {
  if (vertices.length === 0) {
    return []
  }

  const bounds = new THREE.Box3()
  for (const vertex of vertices) {
    bounds.expandByPoint(vertex)
  }
  const size = bounds.getSize(new THREE.Vector3())
  const center = bounds.getCenter(new THREE.Vector3())
  const halfWidth = BATWING_BOX_DIMENSIONS.width / 2
  const halfHeight = BATWING_BOX_DIMENSIONS.height / 2
  const halfDepth = BATWING_BOX_DIMENSIONS.depth / 2

  return vertices.map((vertex) => {
    const x = Math.abs(size.x) <= SCALE_EPSILON ? 0 : ((vertex.x - center.x) / (size.x / 2)) * halfWidth
    const y = Math.abs(size.y) <= SCALE_EPSILON ? 0 : ((vertex.y - center.y) / (size.y / 2)) * halfHeight
    const z = Math.abs(size.z) <= SCALE_EPSILON ? 0 : ((vertex.z - center.z) / (size.z / 2)) * halfDepth
    return new THREE.Vector3(x, y, z)
  })
}

function buildDepthGradientThicknessScaleMap(
  quadMesh: QuadMeshData,
  settings: BatwingDepthGradientSettings,
): Map<string, number> {
  const scaleMap = new Map<string, number>()
  if (
    settings.baseDepth <= 1e-6 &&
    settings.topThin <= 1e-6 &&
    settings.supportThicken <= 1e-6 &&
    settings.openingThin <= 1e-6
  ) {
    return scaleMap
  }

  const bounds = computeQuadMeshBounds(quadMesh)
  const size = bounds.getSize(new THREE.Vector3())
  const min = bounds.min
  const max = bounds.max
  const cellWidth = BATWING_BOX_DIMENSIONS.width
  const cellDepth = BATWING_BOX_DIMENSIONS.depth
  const cellHeight = BATWING_BOX_DIMENSIONS.height
  const supportCorners = [
    new THREE.Vector2(min.x, min.z),
    new THREE.Vector2(min.x, max.z),
    new THREE.Vector2(max.x, min.z),
    new THREE.Vector2(max.x, max.z),
  ]

  for (const vertex of quadMesh.vertices) {
    const yNorm = Math.abs(size.y) <= SCALE_EPSILON ? 0.5 : clampNumber((vertex.y - min.y) / size.y, 0, 1)
    const baseTerm = (1 - yNorm) * settings.baseDepth

    const distanceToSupport = supportCorners.reduce(
      (nearest, support) => Math.min(nearest, support.distanceTo(new THREE.Vector2(vertex.x, vertex.z))),
      Number.POSITIVE_INFINITY,
    )
    const supportRange = Math.max(cellWidth, cellDepth, 1e-6)
    const supportProximity = Math.exp(-((distanceToSupport / supportRange) ** 2) * 2.8)
    const supportTerm = supportProximity * settings.supportThicken

    const openingProximity =
      periodicCenterWeight(vertex.x, min.x, cellWidth) *
      periodicCenterWeight(vertex.y, min.y, cellHeight) *
      periodicCenterWeight(vertex.z, min.z, cellDepth)
    const openingTerm = openingProximity * settings.openingThin

    // Preserve top baseline thickness by design: all additive terms attenuate with (1 - yNorm).
    const topAttenuation = 1 - yNorm
    const topTaper = clampNumber(settings.topThin, 0, MAX_DEPTH_GRADIENT_FACTOR)
    const taperResponse = Math.pow(topAttenuation, 1 + topTaper * 1.5)
    const combined =
      (baseTerm + supportTerm * topAttenuation - openingTerm * topAttenuation) *
      taperResponse *
      clampNumber(settings.effectStrength, 0, 1)
    const depthScale = clampNumber(1 + combined, 0.25, 3.0)
    scaleMap.set(getWeldKey(vertex.x, vertex.y, vertex.z), depthScale)
  }

  return scaleMap
}

function periodicCenterWeight(value: number, origin: number, period: number): number {
  if (period <= 1e-6) {
    return 0
  }
  const phase = ((value - origin) / period) % 1
  const wrapped = phase < 0 ? phase + 1 : phase
  return 0.5 - 0.5 * Math.cos(wrapped * Math.PI * 2)
}

function buildSymmetryTransforms(
  settings: BatwingSymmetrySettings,
): Array<{ angle: number; screwYOffset: number; glideX: number }> {
  const copies = Math.max(1, Math.round(settings.rotationalCopies))
  const transforms: Array<{ angle: number; screwYOffset: number; glideX: number }> = []
  for (let index = 0; index < copies; index += 1) {
    transforms.push({
      angle: (Math.PI * 2 * index) / copies,
      screwYOffset: settings.screwHeightPerCopy * index,
      glideX: index % 2 === 0 ? 0 : settings.glideOffsetX,
    })
  }
  return transforms
}

function applySymmetryTransform(
  vertex: THREE.Vector3,
  transform: { angle: number; screwYOffset: number; glideX: number },
): THREE.Vector3 {
  const sin = Math.sin(transform.angle)
  const cos = Math.cos(transform.angle)
  const x = vertex.x * cos - vertex.z * sin + transform.glideX
  const z = vertex.x * sin + vertex.z * cos
  const y = vertex.y + transform.screwYOffset
  return new THREE.Vector3(x, y, z)
}

function shouldFlipArrayCellWinding(
  lengthIndex: number,
  widthIndex: number,
  heightIndex: number,
): boolean {
  return (lengthIndex + widthIndex + heightIndex) % 2 === 1
}

function reverseQuadFace([a, b, c, d]: QuadFace): QuadFace {
  return [a, d, c, b]
}

function offsetQuadFace([a, b, c, d]: QuadFace, vertexOffset: number): QuadFace {
  return [vertexOffset + a, vertexOffset + b, vertexOffset + c, vertexOffset + d]
}

function buildArrayCenterThicknessNormalMap(arraySettings: BatwingArraySettings): Map<string, THREE.Vector3> {
  const centerNormals = new Map<string, THREE.Vector3>()
  forEachArrayOffset(arraySettings, (offset, _instanceIndex, lengthIndex, widthIndex, heightIndex) => {
    const yDirection = shouldFlipArrayCellWinding(lengthIndex, widthIndex, heightIndex) ? -1 : 1
    centerNormals.set(getWeldKey(offset.x, offset.y, offset.z), new THREE.Vector3(0, yDirection, 0))
  })
  return centerNormals
}

function createThickenedQuadMesh(
  quadMesh: QuadMeshData,
  thickness: number,
  forcedThicknessNormalMap = new Map<string, THREE.Vector3>(),
  thicknessScaleMap = new Map<string, number>(),
  offsetMode: BatwingTargetSurfaceSettings['offsetMode'] = 'two-sided',
): QuadMeshData {
  const safeThickness = clampNumber(thickness, 0, MAX_THICKNESS)
  if (safeThickness <= 0.0001) {
    return quadMesh
  }

  const outwardThickness = offsetMode === 'one-sided' ? safeThickness : safeThickness / 2
  const inwardThickness = offsetMode === 'one-sided' ? 0 : safeThickness / 2
  const vertexNormals = computeQuadMeshVertexNormals(quadMesh)
  for (let index = 0; index < quadMesh.vertices.length; index += 1) {
    const vertex = quadMesh.vertices[index]
    const forcedNormal = forcedThicknessNormalMap.get(getWeldKey(vertex.x, vertex.y, vertex.z))
    if (forcedNormal) {
      vertexNormals[index].copy(forcedNormal)
    }
  }
  const vertexCount = quadMesh.vertices.length
  const vertices: THREE.Vector3[] = []
  const quadFaces: QuadFace[] = []

  for (let index = 0; index < vertexCount; index += 1) {
    const vertex = quadMesh.vertices[index]
    const scale = clampNumber(thicknessScaleMap.get(getWeldKey(vertex.x, vertex.y, vertex.z)) ?? 1, 0.1, 4)
    vertices.push(vertex.clone().addScaledVector(vertexNormals[index], outwardThickness * scale))
  }

  for (let index = 0; index < vertexCount; index += 1) {
    const vertex = quadMesh.vertices[index]
    const scale = clampNumber(thicknessScaleMap.get(getWeldKey(vertex.x, vertex.y, vertex.z)) ?? 1, 0.1, 4)
    vertices.push(vertex.clone().addScaledVector(vertexNormals[index], -inwardThickness * scale))
  }

  for (const [a, b, c, d] of quadMesh.quadFaces) {
    quadFaces.push([a, b, c, d])
    quadFaces.push([
      a + vertexCount,
      d + vertexCount,
      c + vertexCount,
      b + vertexCount,
    ])
  }

  for (const [a, b] of buildDirectedBoundaryEdges(quadMesh.quadFaces)) {
    quadFaces.push([b, a, a + vertexCount, b + vertexCount])
  }

  return {
    vertices,
    quadFaces,
  }
}

function buildGeometryFromQuadMesh(
  quadMesh: QuadMeshData,
  arraySettings: BatwingArraySettings,
): THREE.BufferGeometry {
  validateFiniteVertices(quadMesh.vertices)

  const positions = new Float32Array(quadMesh.vertices.length * 3)
  for (let index = 0; index < quadMesh.vertices.length; index += 1) {
    const position = quadMesh.vertices[index]
    positions[index * 3 + 0] = position.x
    positions[index * 3 + 1] = position.y
    positions[index * 3 + 2] = position.z
  }

  const indices = triangulateQuadFaces(quadMesh.quadFaces)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  applyContinuousReflectionNormals(geometry, quadMesh, arraySettings.subdivisions)
  geometry.computeBoundingSphere()
  geometry.userData.batwing = {
    welded: true,
    rawVertexCount: getArrayInstanceCount(arraySettings) * 33,
    vertexCount: quadMesh.vertices.length,
    indexCount: indices.length,
    quadCount: quadMesh.quadFaces.length,
    instanceCount: getArrayInstanceCount(arraySettings),
    thickness: arraySettings.thickness,
    subdivisions: arraySettings.subdivisions,
  }
  return geometry
}

function weldQuadMeshByPosition(quadMesh: QuadMeshData): QuadMeshData {
  const weldedVertices: THREE.Vector3[] = []
  const vertexLookup = new Map<string, number>()
  const sourceToWelded = new Array<number>(quadMesh.vertices.length)

  for (let vertexIndex = 0; vertexIndex < quadMesh.vertices.length; vertexIndex += 1) {
    const vertex = quadMesh.vertices[vertexIndex]
    const key = getWeldKey(vertex.x, vertex.y, vertex.z)
    let weldedIndex = vertexLookup.get(key)

    if (weldedIndex === undefined) {
      weldedIndex = weldedVertices.length
      vertexLookup.set(key, weldedIndex)
      weldedVertices.push(vertex.clone())
    }

    sourceToWelded[vertexIndex] = weldedIndex
  }

  return {
    vertices: weldedVertices,
    quadFaces: quadMesh.quadFaces.map(([a, b, c, d]) => [
      sourceToWelded[a],
      sourceToWelded[b],
      sourceToWelded[c],
      sourceToWelded[d],
    ]),
  }
}

function weldQuadMeshByPositionPreservingFaceDirections(quadMesh: QuadMeshData): QuadMeshData {
  const sourceFaceNormals = quadMesh.quadFaces.map((quadFace) => computeQuadNormal(quadMesh.vertices, quadFace))
  const weldedMesh = weldQuadMeshByPosition(quadMesh)
  const quadFaces = weldedMesh.quadFaces.map((quadFace, faceIndex) => {
    const sourceNormal = sourceFaceNormals[faceIndex]
    if (!sourceNormal || sourceNormal.lengthSq() <= 1e-12) {
      return quadFace
    }

    const weldedNormal = computeQuadNormal(weldedMesh.vertices, quadFace)
    if (weldedNormal.lengthSq() > 1e-12 && weldedNormal.dot(sourceNormal) < 0) {
      return reverseQuadFace(quadFace)
    }

    return quadFace
  })

  return {
    vertices: weldedMesh.vertices,
    quadFaces,
  }
}

function computeQuadMeshVertexNormals(quadMesh: QuadMeshData): THREE.Vector3[] {
  const normals = Array.from({ length: quadMesh.vertices.length }, () => new THREE.Vector3())

  for (const quadFace of quadMesh.quadFaces) {
    const quadNormal = computeQuadNormal(quadMesh.vertices, quadFace)
    if (quadNormal.lengthSq() <= 1e-12) {
      continue
    }

    for (const vertexIndex of quadFace) {
      normals[vertexIndex].add(quadNormal)
    }
  }

  for (const normal of normals) {
    if (normal.lengthSq() > 1e-12) {
      normal.normalize()
    } else {
      normal.set(0, 1, 0)
    }
  }

  averageNormalsByPosition(normals, quadMesh.vertices)
  return normals
}

function buildDirectedBoundaryEdges(quadFaces: readonly QuadFace[]): [number, number][] {
  const edgeUseCounts = new Map<string, { a: number; b: number; count: number }>()

  const addEdge = (a: number, b: number): void => {
    const min = Math.min(a, b)
    const max = Math.max(a, b)
    const key = `${min},${max}`
    const existingEdge = edgeUseCounts.get(key)
    if (existingEdge) {
      existingEdge.count += 1
      return
    }

    edgeUseCounts.set(key, { a, b, count: 1 })
  }

  for (const [a, b, c, d] of quadFaces) {
    addEdge(a, b)
    addEdge(b, c)
    addEdge(c, d)
    addEdge(d, a)
  }

  const boundaryEdges: [number, number][] = []
  for (const edge of edgeUseCounts.values()) {
    if (edge.count === 1) {
      boundaryEdges.push([edge.a, edge.b])
    }
  }

  return boundaryEdges
}

function applyContinuousReflectionNormals(
  geometry: THREE.BufferGeometry,
  quadMesh: QuadMeshData,
  subdivisions: number,
): void {
  const computedNormals = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined
  const normalSourceVertices = buildReflectionNormalSourceVertices(quadMesh, subdivisions)
  const normals = Array.from({ length: quadMesh.vertices.length }, (_value, index) => {
    if (!computedNormals) {
      return new THREE.Vector3()
    }

    return new THREE.Vector3(
      computedNormals.getX(index),
      computedNormals.getY(index),
      computedNormals.getZ(index),
    )
  })
  const quadNormalSums = Array.from({ length: quadMesh.vertices.length }, () => new THREE.Vector3())

  for (const quadFace of quadMesh.quadFaces) {
    const quadNormal = computeQuadNormal(normalSourceVertices, quadFace)
    if (quadNormal.lengthSq() <= 1e-12) {
      continue
    }

    for (const vertexIndex of quadFace) {
      quadNormalSums[vertexIndex].add(quadNormal)
    }
  }

  for (let index = 0; index < normals.length; index += 1) {
    if (quadNormalSums[index].lengthSq() > 1e-12) {
      normals[index].copy(quadNormalSums[index]).normalize()
    } else if (normals[index].lengthSq() > 1e-12) {
      normals[index].normalize()
    } else {
      normals[index].set(0, 1, 0)
    }
  }

  averageNormalsByPosition(normals, quadMesh.vertices)

  if (subdivisions > 0) {
    relaxNormalsAcrossQuadEdges(normals, quadMesh.quadFaces, 4 + subdivisions * 2, 0.62)
  }

  const normalValues = new Float32Array(normals.length * 3)
  for (let index = 0; index < normals.length; index += 1) {
    normalValues[index * 3 + 0] = normals[index].x
    normalValues[index * 3 + 1] = normals[index].y
    normalValues[index * 3 + 2] = normals[index].z
  }

  geometry.setAttribute('normal', new THREE.BufferAttribute(normalValues, 3))
}

function buildReflectionNormalSourceVertices(
  quadMesh: QuadMeshData,
  subdivisions: number,
): THREE.Vector3[] {
  if (subdivisions <= 0) {
    return quadMesh.vertices
  }

  return relaxQuadMeshVertices(quadMesh.vertices, quadMesh.quadFaces, 5 + subdivisions * 3, 0.22, false)
}

function computeQuadNormal(vertices: readonly THREE.Vector3[], quadFace: QuadFace): THREE.Vector3 {
  const normal = new THREE.Vector3()

  for (let index = 0; index < quadFace.length; index += 1) {
    const current = vertices[quadFace[index]]
    const next = vertices[quadFace[(index + 1) % quadFace.length]]
    normal.x += (current.y - next.y) * (current.z + next.z)
    normal.y += (current.z - next.z) * (current.x + next.x)
    normal.z += (current.x - next.x) * (current.y + next.y)
  }

  if (normal.lengthSq() > 1e-12) {
    return normal.normalize()
  }

  const [a, b, c] = quadFace
  return new THREE.Vector3()
    .subVectors(vertices[b], vertices[a])
    .cross(new THREE.Vector3().subVectors(vertices[c], vertices[a]))
    .normalize()
}

function averageNormalsByPosition(normals: THREE.Vector3[], vertices: readonly THREE.Vector3[]): void {
  const normalSums = new Map<string, THREE.Vector3>()

  for (let index = 0; index < vertices.length; index += 1) {
    const vertex = vertices[index]
    const key = getWeldKey(vertex.x, vertex.y, vertex.z)
    const normalSum = normalSums.get(key)
    if (normalSum) {
      normalSum.add(normals[index])
    } else {
      normalSums.set(key, normals[index].clone())
    }
  }

  for (let index = 0; index < vertices.length; index += 1) {
    const vertex = vertices[index]
    const normalSum = normalSums.get(getWeldKey(vertex.x, vertex.y, vertex.z))
    if (normalSum && normalSum.lengthSq() > 1e-12) {
      normals[index].copy(normalSum).normalize()
    }
  }
}

function relaxNormalsAcrossQuadEdges(
  normals: THREE.Vector3[],
  quadFaces: readonly QuadFace[],
  iterations: number,
  amount: number,
): void {
  const neighbors = buildQuadVertexNeighbors(normals.length, quadFaces)

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const relaxedNormals = normals.map((normal, vertexIndex) => {
      const neighborIndices = neighbors[vertexIndex]
      if (neighborIndices.size === 0) {
        return normal.clone()
      }

      const neighborAverage = new THREE.Vector3()
      for (const neighborIndex of neighborIndices) {
        neighborAverage.add(normals[neighborIndex])
      }
      neighborAverage.multiplyScalar(1 / neighborIndices.size)

      return normal.clone().lerp(neighborAverage.normalize(), amount).normalize()
    })

    for (let index = 0; index < normals.length; index += 1) {
      normals[index].copy(relaxedNormals[index])
    }
  }
}

function relaxQuadMeshVertices(
  vertices: readonly THREE.Vector3[],
  quadFaces: readonly QuadFace[],
  iterations: number,
  amount: number,
  preserveBoundary: boolean,
): THREE.Vector3[] {
  const neighbors = buildQuadVertexNeighbors(vertices.length, quadFaces)
  const boundaryVertices = preserveBoundary ? buildBoundaryVertexSet(quadFaces) : new Set<number>()
  let relaxedVertices = vertices.map((vertex) => vertex.clone())

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const nextVertices = relaxedVertices.map((vertex, vertexIndex) => {
      const neighborIndices = neighbors[vertexIndex]
      if (neighborIndices.size === 0 || boundaryVertices.has(vertexIndex)) {
        return vertex.clone()
      }

      const neighborAverage = new THREE.Vector3()
      for (const neighborIndex of neighborIndices) {
        neighborAverage.add(relaxedVertices[neighborIndex])
      }
      neighborAverage.multiplyScalar(1 / neighborIndices.size)

      return vertex.clone().lerp(neighborAverage, amount)
    })

    relaxedVertices = nextVertices
  }

  return relaxedVertices
}

function buildBoundaryVertexSet(quadFaces: readonly QuadFace[]): Set<number> {
  const edgeUseCounts = new Map<string, { a: number; b: number; count: number }>()

  const addEdge = (a: number, b: number): void => {
    const min = Math.min(a, b)
    const max = Math.max(a, b)
    const key = `${min},${max}`
    const existingEdge = edgeUseCounts.get(key)
    if (existingEdge) {
      existingEdge.count += 1
      return
    }

    edgeUseCounts.set(key, { a, b, count: 1 })
  }

  for (const [a, b, c, d] of quadFaces) {
    addEdge(a, b)
    addEdge(b, c)
    addEdge(c, d)
    addEdge(d, a)
  }

  const boundaryVertices = new Set<number>()
  for (const edge of edgeUseCounts.values()) {
    if (edge.count === 1) {
      boundaryVertices.add(edge.a)
      boundaryVertices.add(edge.b)
    }
  }

  return boundaryVertices
}

function buildQuadVertexNeighbors(vertexCount: number, quadFaces: readonly QuadFace[]): Set<number>[] {
  const neighbors = Array.from({ length: vertexCount }, () => new Set<number>())

  const addNeighborPair = (a: number, b: number): void => {
    if (a === b) {
      return
    }

    neighbors[a].add(b)
    neighbors[b].add(a)
  }

  for (const [a, b, c, d] of quadFaces) {
    addNeighborPair(a, b)
    addNeighborPair(b, c)
    addNeighborPair(c, d)
    addNeighborPair(d, a)
  }

  return neighbors
}

function buildQuadWireGeometry(quadMesh: QuadMeshData): THREE.BufferGeometry {
  const edgePairs = buildUniqueQuadEdges(quadMesh.quadFaces)
  const positions = new Float32Array(edgePairs.length * 2 * 3)

  for (let edgeIndex = 0; edgeIndex < edgePairs.length; edgeIndex += 1) {
    const [a, b] = edgePairs[edgeIndex]
    const start = quadMesh.vertices[a]
    const end = quadMesh.vertices[b]
    const offset = edgeIndex * 6
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

function triangulateQuadFaces(quadFaces: readonly QuadFace[]): number[] {
  const indices: number[] = []
  for (const [a, b, c, d] of quadFaces) {
    indices.push(a, b, c, a, c, d)
  }

  return indices
}

function buildUniqueQuadEdges(quadFaces: readonly QuadFace[]): [number, number][] {
  const edges: [number, number][] = []
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

function validateFiniteVertices(vertices: readonly THREE.Vector3[]): void {
  for (let index = 0; index < vertices.length; index += 1) {
    const vertex = vertices[index]
    if (!Number.isFinite(vertex.x) || !Number.isFinite(vertex.y) || !Number.isFinite(vertex.z)) {
      throw new Error(`Batwing geometry produced a non-finite vertex at index ${index}.`)
    }
  }
}

function buildArrayBoxGuideGeometry(arraySettings: BatwingArraySettings): THREE.BufferGeometry {
  const baseGeometry = createBatwingBoxGuideGeometry()
  const geometry = buildArrayLineGeometry(baseGeometry, arraySettings)
  baseGeometry.dispose()
  return geometry
}

function applyMaterialStyle(style: BatwingMaterialStyle): void {
  batwingMesh.material.color.copy(userFoilColor)
  batwingMesh.material.metalness = style.metalness
  batwingMesh.material.roughness = style.roughness
  batwingMesh.material.clearcoat = style.clearcoat
  batwingMesh.material.clearcoatRoughness = style.clearcoatRoughness
  batwingMesh.material.envMapIntensity = style.envMapIntensity
  batwingMesh.material.iridescence = style.iridescence
  batwingMesh.material.iridescenceIOR = style.iridescenceIOR
  batwingMesh.material.iridescenceThicknessRange = [...style.iridescenceThicknessRange]
  batwingMesh.material.reflectivity = style.reflectivity
  batwingMesh.material.specularIntensity = style.specularIntensity
  batwingMesh.material.sheen = style.sheen
  batwingMesh.material.sheenRoughness = style.sheenRoughness
  batwingMesh.material.sheenColor.setHex(style.sheenColor)
  eggIridescenceState.strength = style.eggIridescence
  eggIridescenceState.frequency = style.eggIridescenceFrequency
  if (eggIridescenceState.uniforms) {
    eggIridescenceState.uniforms.uEggIridescence.value = style.eggIridescence
    eggIridescenceState.uniforms.uEggIridescenceFrequency.value = style.eggIridescenceFrequency
  }
  batwingMesh.material.needsUpdate = true
}

function normalizeColorInputHex(value: string, fallbackHex: string): string {
  const match = /^#[0-9a-fA-F]{6}$/.exec(value)
  if (match) {
    return value.toLowerCase()
  }
  return `#${fallbackHex.toLowerCase()}`
}

function applyFoilColorFromHex(hex: string): void {
  const normalized = normalizeColorInputHex(hex, userFoilColor.getHexString())
  foilColorInput.value = normalized
  userFoilColor.set(normalized)
  batwingMesh.material.color.copy(userFoilColor)
  batwingMesh.material.needsUpdate = true
}

function applyWireColorFromHex(hex: string): void {
  const normalized = normalizeColorInputHex(hex, wireMaterial.color.getHexString())
  wireColorInput.value = normalized
  wireMaterial.color.set(normalized)
  wireMaterial.needsUpdate = true
}

function applyBackFacesDiagnosticMode(enabled: boolean): void {
  eggIridescenceState.backFacesEnabled = enabled
  if (eggIridescenceState.uniforms) {
    eggIridescenceState.uniforms.uBackFaceDiagnostic.value = enabled ? 1 : 0
  }
}

function installEggIridescenceShader(
  material: THREE.MeshPhysicalMaterial,
  state: EggIridescenceState,
): void {
  material.customProgramCacheKey = () => 'batwing-gyroid-foil-iridescence-v2'
  material.onBeforeCompile = (shader) => {
    const uniforms = {
      uEggIridescence: { value: state.strength },
      uEggIridescenceFrequency: { value: state.frequency },
      uBackFaceDiagnostic: { value: state.backFacesEnabled ? 1 : 0 },
    }
    state.uniforms = uniforms
    shader.uniforms.uEggIridescence = uniforms.uEggIridescence
    shader.uniforms.uEggIridescenceFrequency = uniforms.uEggIridescenceFrequency
    shader.uniforms.uBackFaceDiagnostic = uniforms.uBackFaceDiagnostic

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vEggIriWorldPosition;
varying vec3 vEggIriWorldNormal;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
vEggIriWorldPosition = worldPosition.xyz;
vEggIriWorldNormal = normalize( mat3( modelMatrix ) * normal );`,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uEggIridescence;
uniform float uEggIridescenceFrequency;
uniform float uBackFaceDiagnostic;
varying vec3 vEggIriWorldPosition;
varying vec3 vEggIriWorldNormal;

float eggSaturate01(float value) {
  return clamp(value, 0.0, 1.0);
}

float eggHash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}

float eggSmoothNoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);

  float n000 = eggHash13(i + vec3(0.0, 0.0, 0.0));
  float n100 = eggHash13(i + vec3(1.0, 0.0, 0.0));
  float n010 = eggHash13(i + vec3(0.0, 1.0, 0.0));
  float n110 = eggHash13(i + vec3(1.0, 1.0, 0.0));
  float n001 = eggHash13(i + vec3(0.0, 0.0, 1.0));
  float n101 = eggHash13(i + vec3(1.0, 0.0, 1.0));
  float n011 = eggHash13(i + vec3(0.0, 1.0, 1.0));
  float n111 = eggHash13(i + vec3(1.0, 1.0, 1.0));

  float nx00 = mix(n000, n100, u.x);
  float nx10 = mix(n010, n110, u.x);
  float nx01 = mix(n001, n101, u.x);
  float nx11 = mix(n011, n111, u.x);
  float nxy0 = mix(nx00, nx10, u.y);
  float nxy1 = mix(nx01, nx11, u.y);
  return mix(nxy0, nxy1, u.z);
}

vec3 eggBismuthPalette(float t) {
  t = fract(t);
  vec3 c0 = vec3(1.00, 0.84, 0.20);
  vec3 c1 = vec3(1.00, 0.33, 0.77);
  vec3 c2 = vec3(0.18, 0.93, 1.00);
  vec3 c3 = vec3(0.30, 1.00, 0.46);
  if (t < 0.25) {
    return mix(c0, c1, t * 4.0);
  }
  if (t < 0.50) {
    return mix(c1, c2, (t - 0.25) * 4.0);
  }
  if (t < 0.75) {
    return mix(c2, c3, (t - 0.50) * 4.0);
  }
  return mix(c3, c0, (t - 0.75) * 4.0);
}

vec3 applyEggIridescence(vec3 baseColor) {
  float iriStrength = eggSaturate01(uEggIridescence);
  if (iriStrength <= 0.0001) {
    return baseColor;
  }

  vec3 n = normalize(vEggIriWorldNormal);
  vec3 viewDir = normalize(cameraPosition - vEggIriWorldPosition);
  float ndv = eggSaturate01(dot(n, viewDir));
  float jitter = eggSmoothNoise3(vEggIriWorldPosition * 1.5 + vec3(31.4));
  float broadNoise = eggSmoothNoise3(vEggIriWorldPosition * 0.48 + vec3(11.7));
  float bandFreq = max(0.2, uEggIridescenceFrequency);
  float facetBand =
    (vEggIriWorldPosition.y * 1.8 + vEggIriWorldPosition.x * 0.42 - vEggIriWorldPosition.z * 0.31) * bandFreq;
  float stepBand = (abs(vEggIriWorldPosition.x) + abs(vEggIriWorldPosition.z)) * 0.92;
  float swirl =
    0.5 +
    0.5 *
      sin(
        dot(vEggIriWorldPosition, vec3(0.73, 0.51, -0.46)) * bandFreq * 1.25 +
        broadNoise * 4.6 +
        6.283
      );
  float thicknessT = fract(facetBand * 0.123 + stepBand * 0.081 + swirl * 0.39 + jitter * 0.27 + 5.7);
  float thicknessNm = mix(120.0, 980.0, thicknessT);

  vec3 wavelengths = vec3(680.0, 540.0, 440.0);
  vec3 phase = (4.0 * 3.14159265 * 1.65 * thicknessNm * max(ndv, 0.08)) / wavelengths;
  vec3 interference = 0.5 + 0.5 * cos(phase + vec3(0.0, 2.094, 4.188));

  float hueSweep =
    fract(
      thicknessT * (0.55 + uEggIridescenceFrequency * 0.65) +
      dot(n, vec3(0.23, 0.11, -0.37)) * 0.18
    );
  vec3 oxidePalette = eggBismuthPalette(hueSweep);
  vec3 oxideColor = mix(interference, oxidePalette, 0.68);

  float fresnel = pow(1.0 - ndv, 2.2);
  float filmAmount = iriStrength * (0.48 + 0.52 * fresnel);
  vec3 branchTint = mix(vec3(1.0), baseColor, 0.58);
  vec3 metallicBase = vec3(0.92, 0.94, 0.98) * mix(vec3(1.0), branchTint, 0.26);
  vec3 oxideTinted = mix(oxideColor, oxideColor * branchTint, 0.62);
  vec3 blendTint = mix(metallicBase, oxideTinted, eggSaturate01(filmAmount * 0.78));
  vec3 overlayTint = mix(vec3(1.0), blendTint, 0.62 * iriStrength);
  vec3 iridescentBase = baseColor * overlayTint;
  iridescentBase += oxideColor * fresnel * iriStrength * 0.22;
  return mix(baseColor, iridescentBase, 0.85 * iriStrength);
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
diffuseColor.rgb = applyEggIridescence(diffuseColor.rgb);`,
      )
      .replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
if (uBackFaceDiagnostic > 0.5) {
  gl_FragColor = vec4(gl_FrontFacing ? vec3(1.0) : vec3(1.0, 0.0, 0.85), diffuseColor.a);
}`,
      )
  }
}

function getPrimaryMaterialColor(material: THREE.Material): THREE.Color {
  const colorCarrier = material as THREE.Material & { color?: THREE.Color }
  return colorCarrier.color?.clone() ?? new THREE.Color(0xf1f5ff)
}

function buildExportMesh(): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> {
  batwingMesh.updateWorldMatrix(true, false)
  const exportGeometry = batwingMesh.geometry.clone()
  exportGeometry.applyMatrix4(batwingMesh.matrixWorld)
  exportGeometry.computeVertexNormals()
  exportGeometry.computeBoundingSphere()

  const exportMaterial = new THREE.MeshStandardMaterial({
    color: getPrimaryMaterialColor(batwingMesh.material),
    metalness: batwingMesh.material.metalness,
    roughness: batwingMesh.material.roughness,
    side: THREE.DoubleSide,
  })

  const exportMesh = new THREE.Mesh(exportGeometry, exportMaterial)
  exportMesh.name = EXPORT_BASE_NAME
  return exportMesh
}

function disposeExportMesh(mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material>): void {
  mesh.geometry.dispose()
  mesh.material.dispose()
}

function nextExportName(type: 'obj' | 'glb' | 'png'): string {
  exportCounters[type] += 1
  const serial = String(exportCounters[type]).padStart(3, '0')
  return `${EXPORT_BASE_NAME}_${serial}.${type}`
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function exportObj(): void {
  const exportMesh = buildExportMesh()
  const position = exportMesh.geometry.getAttribute('position')
  const index = exportMesh.geometry.getIndex()
  let output = `# ${EXPORT_BASE_NAME} OBJ Export\n`
  output += `o ${EXPORT_BASE_NAME}\n`

  for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex += 1) {
    output += `v ${position.getX(vertexIndex)} ${position.getY(vertexIndex)} ${position.getZ(vertexIndex)}\n`
  }

  if (index) {
    for (let faceIndex = 0; faceIndex < index.count; faceIndex += 3) {
      const a = index.getX(faceIndex) + 1
      const b = index.getX(faceIndex + 1) + 1
      const c = index.getX(faceIndex + 2) + 1
      output += `f ${a} ${b} ${c}\n`
    }
  }

  downloadBlob(new Blob([output], { type: 'text/plain;charset=utf-8' }), nextExportName('obj'))
  disposeExportMesh(exportMesh)
}

function exportGlb(): void {
  const exportMesh = buildExportMesh()
  const exporter = new GLTFExporter()
  const exportGroup = new THREE.Group()
  exportGroup.add(exportMesh)

  exporter.parse(
    exportGroup,
    (result) => {
      if (result instanceof ArrayBuffer) {
        downloadBlob(new Blob([result], { type: 'model/gltf-binary' }), nextExportName('glb'))
      }
      disposeExportMesh(exportMesh)
    },
    (error) => {
      console.error('GLB export failed.', error)
      disposeExportMesh(exportMesh)
    },
    { binary: true },
  )
}

function exportScreenshot(): void {
  renderer.render(scene, camera)
  canvas.toBlob((blob) => {
    if (!blob) {
      return
    }

    downloadBlob(blob, nextExportName('png'))
  }, 'image/png')
}

function getCurrentGeometryStats(): {
  vertexCount: number
  indexCount: number
  hasNormals: boolean
  finitePositions: boolean
} {
  const position = batwingMesh.geometry.getAttribute('position')
  const normal = batwingMesh.geometry.getAttribute('normal')
  const index = batwingMesh.geometry.getIndex()
  let finitePositions = true

  for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex += 1) {
    if (
      !Number.isFinite(position.getX(vertexIndex)) ||
      !Number.isFinite(position.getY(vertexIndex)) ||
      !Number.isFinite(position.getZ(vertexIndex))
    ) {
      finitePositions = false
      break
    }
  }

  return {
    vertexCount: position.count,
    indexCount: index?.count ?? 0,
    hasNormals: normal !== undefined && normal.count === position.count,
    finitePositions,
  }
}

function updateSeamDebugGeometry(): void {
  const source = batwingMesh.geometry.getAttribute('position')
  if (!source || source.count === 0) {
    const emptyGeometry = new THREE.BufferGeometry()
    seamDebugPoints.geometry.dispose()
    seamDebugPoints.geometry = emptyGeometry
    return
  }

  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (let index = 0; index < source.count; index += 1) {
    const y = source.getY(index)
    if (y < minY) {
      minY = y
    }
    if (y > maxY) {
      maxY = y
    }
  }

  const height = Math.max(maxY - minY, 1e-6)
  const epsilon = Math.max(height * 1e-4, 1e-4)
  const seamPositions: number[] = []
  const seamColors: number[] = []

  for (let index = 0; index < source.count; index += 1) {
    const x = source.getX(index)
    const y = source.getY(index)
    const z = source.getZ(index)

    if (Math.abs(y - maxY) <= epsilon) {
      seamPositions.push(x, y, z)
      seamColors.push(1, 0.1, 0.85)
    } else if (Math.abs(y - minY) <= epsilon) {
      seamPositions.push(x, y, z)
      seamColors.push(0.1, 0.95, 1)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(seamPositions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(seamColors, 3))
  geometry.computeBoundingSphere()
  seamDebugPoints.geometry.dispose()
  seamDebugPoints.geometry = geometry
}

function updateGeometryDataset(): void {
  const stats = getCurrentGeometryStats()
  canvas.dataset.vertexCount = `${stats.vertexCount}`
  canvas.dataset.indexCount = `${stats.indexCount}`
  canvas.dataset.hasNormals = `${stats.hasNormals}`
  canvas.dataset.finitePositions = `${stats.finitePositions}`
}

function updatePanelSectionControls(): void {
  const headers = app.querySelectorAll<HTMLButtonElement>('.panel-section-header')
  headers.forEach((header) => {
    header.addEventListener('click', () => {
      const section = header.closest<HTMLElement>('.panel-section')
      if (!section) {
        return
      }

      const collapsed = section.classList.toggle('is-collapsed')
      header.setAttribute('aria-expanded', collapsed ? 'false' : 'true')
    })
  })
}

function enablePerSectionScrolling(): void {
  const contents = app.querySelectorAll<HTMLElement>('.panel-section-content')
  contents.forEach((content) => {
    content.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault()
        event.stopPropagation()
        content.scrollTop += event.deltaY
      },
      { passive: false },
    )
  })
}

function onResize(): void {
  const width = window.innerWidth
  const height = window.innerHeight
  camera.aspect = width / Math.max(height, 1)
  camera.updateProjectionMatrix()
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(width, height, false)
}

function animate(): void {
  controls.update()
  groundGrid.update(camera)
  renderer.render(scene, camera)
  animationFrameId = window.requestAnimationFrame(animate)
}

function cleanup(): void {
  window.cancelAnimationFrame(animationFrameId)
  controls.dispose()
  targetTransformControl.dispose()
  for (const control of latticeTransformControls) {
    control.dispose()
  }
  for (const helper of latticeTransformControlHelpers) {
    scene.remove(helper)
  }
  disposeLatticePointMesh()
  disposeLatticeLineSegments()
  batwingMesh.geometry.dispose()
  batwingMesh.material.dispose()
  wireOverlay.geometry.dispose()
  wireOverlay.material.dispose()
  boxGuide.geometry.dispose()
  boxGuide.material.dispose()
  if (loadedTargetSurface) {
    scene.remove(loadedTargetSurface.previewMesh)
    loadedTargetSurface.previewMesh.geometry.dispose()
    loadedTargetSurface.previewMesh.material.dispose()
  }
  seamDebugPoints.geometry.dispose()
  seamDebugPoints.material.dispose()
  reflectionEnvironment.dispose()
  groundGrid.dispose()
  renderer.dispose()
}

for (const binding of sliderBindings) {
  bindSlider(binding)
  updateRangeProgress(binding.slider)
}

for (const binding of arraySliderBindings) {
  bindArraySlider(binding)
  updateRangeProgress(binding.slider)
}

for (const binding of depthGradientSliderBindings) {
  bindDepthGradientSlider(binding)
  updateRangeProgress(binding.slider)
}

for (const binding of symmetrySliderBindings) {
  bindSymmetrySlider(binding)
  updateRangeProgress(binding.slider)
}

for (const binding of latticeSliderBindings) {
  bindLatticeSlider(binding)
  updateRangeProgress(binding.slider)
}

for (const binding of latticeInfluenceSliderBindings) {
  bindLatticeInfluenceSlider(binding)
  updateRangeProgress(binding.slider)
}

for (const binding of targetSurfaceSliderBindings) {
  bindTargetSurfaceSlider(binding)
  updateRangeProgress(binding.slider)
}

geometryTypeSelect.value = DEFAULT_GEOMETRY_TYPE
batwingFamilySelect.value = DEFAULT_BATWING_FAMILY
updateBatwingFamilyControlAvailability(DEFAULT_GEOMETRY_TYPE)
geometryTypeSelect.addEventListener('pointerdown', () => {
  geometryTypeBeforeEdit = getCurrentGeometryType()
})
geometryTypeSelect.addEventListener('focus', () => {
  geometryTypeBeforeEdit = getCurrentGeometryType()
})
geometryTypeSelect.addEventListener('change', () => {
  const previousGeometryType = geometryTypeBeforeEdit ?? DEFAULT_GEOMETRY_TYPE
  const previousState = captureAppState()
  previousState.geometryType = previousGeometryType
  updateBatwingFamilyControlAvailability(getCurrentGeometryType())
  rebuildBatwing()
  commitHistoryCheckpoint(previousState)
  geometryTypeBeforeEdit = null
})
batwingFamilySelect.addEventListener('pointerdown', () => {
  batwingFamilyBeforeEdit = getCurrentBatwingFamily()
})
batwingFamilySelect.addEventListener('focus', () => {
  batwingFamilyBeforeEdit = getCurrentBatwingFamily()
})
batwingFamilySelect.addEventListener('change', () => {
  const previousFamily = batwingFamilyBeforeEdit ?? DEFAULT_BATWING_FAMILY
  const previousState = captureAppState()
  previousState.batwingFamily = previousFamily
  rebuildBatwing()
  commitHistoryCheckpoint(previousState)
  batwingFamilyBeforeEdit = null
})
loadTargetSurfaceButton.addEventListener('click', () => {
  void loadTargetSurfaceFromInput()
})
clearTargetSurfaceButton.addEventListener('click', () => {
  if (loadedTargetSurface) {
    scene.remove(loadedTargetSurface.previewMesh)
    loadedTargetSurface.previewMesh.geometry.dispose()
    loadedTargetSurface.previewMesh.material.dispose()
  }
  loadedTargetSurface = null
  targetMappingEnabled = false
  targetTransformControl.detach()
  targetTransformControl.enabled = false
  targetTransformHelper.visible = false
  targetSurfaceFileInput.value = ''
  syncTargetTransformInputsFromMesh()
  rebuildBatwing()
})
snapTargetToBatwingButton.addEventListener('click', () => {
  snapTargetToBatwingBounds()
})
mapTargetButton.addEventListener('click', () => {
  if (!loadedTargetSurface) {
    return
  }
  targetMappingEnabled = true
  rebuildBatwing()
})
unmapTargetButton.addEventListener('click', () => {
  targetMappingEnabled = false
  rebuildBatwing()
})
targetMoveModeButton.addEventListener('click', () => {
  if (!loadedTargetSurface) {
    return
  }
  targetTransformControl.setMode('translate')
})
targetRotateModeButton.addEventListener('click', () => {
  if (!loadedTargetSurface) {
    return
  }
  targetTransformControl.setMode('rotate')
})
targetScaleModeButton.addEventListener('click', () => {
  if (!loadedTargetSurface) {
    return
  }
  targetTransformControl.setMode('scale')
})
targetOffsetModeSelect.addEventListener('change', () => {
  const previousState = captureAppState()
  previousState.targetSurfaceSettings.offsetMode =
    targetOffsetModeSelect.value === 'one-sided' ? 'two-sided' : 'one-sided'
  rebuildBatwing()
  commitHistoryCheckpoint(previousState)
})

for (const input of [targetRotXInput, targetRotYInput, targetRotZInput, targetScaleUniformInput]) {
  input.addEventListener('change', () => {
    applyTargetTransformFromInputs()
  })
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      applyTargetTransformFromInputs()
      input.blur()
    }
  })
}

latticeResetButton.addEventListener('click', () => {
  const previousState = captureAppState()
  resetLatticePointsToRestPositions()
  commitHistoryCheckpoint(previousState)
})

canvas.addEventListener('pointerdown', onLatticePointerDown)
canvas.addEventListener('pointermove', onLatticePointerMove)
canvas.addEventListener('pointerup', onLatticePointerUp)
canvas.addEventListener('pointercancel', onLatticePointerCancel)
canvas.addEventListener('pointerleave', clearLatticeHover)

baseGridToggle.addEventListener('change', () => {
  const previousState = captureAppState()
  previousState.showBaseGrid = !baseGridToggle.checked
  groundGrid.mesh.visible = baseGridToggle.checked
  commitHistoryCheckpoint(previousState)
})

wireToggle.addEventListener('change', () => {
  const previousState = captureAppState()
  previousState.showWireframe = !wireToggle.checked
  wireOverlay.visible = wireToggle.checked
  commitHistoryCheckpoint(previousState)
})

reflectionToggle.addEventListener('change', () => {
  const previousState = captureAppState()
  previousState.reflectionsEnabled = !reflectionToggle.checked
  applyMaterialStyle(reflectionToggle.checked ? FOIL_MATERIAL_STYLE : MATTE_MATERIAL_STYLE)
  commitHistoryCheckpoint(previousState)
})

backFacesToggle.addEventListener('change', () => {
  const previousState = captureAppState()
  previousState.showBackFaces = !backFacesToggle.checked
  applyBackFacesDiagnosticMode(backFacesToggle.checked)
  commitHistoryCheckpoint(previousState)
})

seamDebugToggle.addEventListener('change', () => {
  const previousState = captureAppState()
  previousState.showSeamDebug = !seamDebugToggle.checked
  seamDebugPoints.visible = seamDebugToggle.checked
  commitHistoryCheckpoint(previousState)
})

foilColorInput.addEventListener('input', () => {
  beginControlHistoryEdit()
  applyFoilColorFromHex(foilColorInput.value)
})
foilColorInput.addEventListener('change', () => {
  finishControlHistoryEdit()
})

wireColorInput.addEventListener('input', () => {
  beginControlHistoryEdit()
  applyWireColorFromHex(wireColorInput.value)
})
wireColorInput.addEventListener('change', () => {
  finishControlHistoryEdit()
})

boxGuideToggle.addEventListener('change', () => {
  const previousState = captureAppState()
  previousState.showBoxGuide = !boxGuideToggle.checked
  boxGuide.visible = boxGuideToggle.checked
  commitHistoryCheckpoint(previousState)
})

latticeControlsToggle.addEventListener('change', () => {
  const previousState = captureAppState()
  previousState.showLatticeControls = !latticeControlsToggle.checked
  updateLatticeControlsVisibility()
  commitHistoryCheckpoint(previousState)
})

exportObjButton.addEventListener('click', exportObj)
exportGlbButton.addEventListener('click', exportGlb)
exportScreenshotButton.addEventListener('click', exportScreenshot)

collapseToggle.addEventListener('pointerdown', (event) => {
  event.stopPropagation()
})

collapseToggle.addEventListener('click', () => {
  const collapsed = uiPanel.classList.toggle('is-collapsed')
  collapseToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true')
})

uiHandleTop.addEventListener('pointerdown', (event) => {
  if ((event.target as Element).closest('#collapseToggle')) {
    return
  }

  const rect = uiPanel.getBoundingClientRect()
  panelDragging = true
  panelDragOffset.x = event.clientX - rect.left
  panelDragOffset.y = event.clientY - rect.top
  uiHandleTop.setPointerCapture(event.pointerId)
  event.preventDefault()
})

uiHandleTop.addEventListener('pointermove', (event) => {
  if (!panelDragging) {
    return
  }

  const rect = uiPanel.getBoundingClientRect()
  const nextLeft = clampNumber(event.clientX - panelDragOffset.x, 8, window.innerWidth - rect.width - 8)
  const nextTop = clampNumber(event.clientY - panelDragOffset.y, 8, window.innerHeight - rect.height - 8)
  uiPanel.style.left = `${nextLeft}px`
  uiPanel.style.top = `${nextTop}px`
})

uiHandleTop.addEventListener('pointerup', (event) => {
  panelDragging = false
  uiHandleTop.releasePointerCapture(event.pointerId)
})

uiHandleTop.addEventListener('pointercancel', (event) => {
  panelDragging = false
  uiHandleTop.releasePointerCapture(event.pointerId)
})

uiPanel.addEventListener(
  'pointermove',
  (event) => {
    if (event.pointerType === 'touch') {
      event.stopPropagation()
    }
  },
  { passive: true },
)

updatePanelSectionControls()
enablePerSectionScrolling()
updateGeometryDataset()
onResize()
window.addEventListener('resize', onResize)
window.addEventListener('beforeunload', cleanup)
window.addEventListener('keydown', (event) => {
  if (!event.ctrlKey || event.altKey) {
    return
  }

  const key = event.key.toLowerCase()
  if (key === 'z') {
    event.preventDefault()
    if (event.shiftKey) {
      redoHistoryState()
    } else {
      undoHistoryState()
    }
    return
  }

  if (key === 'y' && !event.shiftKey) {
    event.preventDefault()
    redoHistoryState()
  }
})

window.__batwingDebug = {
  getStats: getCurrentGeometryStats,
  setSettings: applySettings,
}

requestAnimationFrame(() => {
  document.documentElement.classList.add('ui-ready')
})

animate()
