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

type BatwingAggregatorSettings = {
  enabled: boolean
  moduleCount: number
  seed: number
  growthMode: AggregatorGrowthMode
  adjacencyRule: AggregatorAdjacencyRule
}

type AggregatorGrowthMode = 'branching' | 'compact' | 'vertical' | 'radial' | 'strata' | 'random-walk'

type AggregatorAdjacencyRule = 'face' | 'edge' | 'corner' | 'bridge'

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

type AggregatorControlKey = Exclude<keyof BatwingAggregatorSettings, 'enabled' | 'growthMode' | 'adjacencyRule'>

type ArraySliderBinding = {
  key: ArrayControlKey
  fallback: number
  min: number
  max: number
  integer: boolean
  slider: HTMLInputElement
  valueInput: HTMLInputElement
}

type AggregatorSliderBinding = {
  key: AggregatorControlKey
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
  uSubdivisions: number
  vSubdivisions: number
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
  integer?: boolean
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
  aggregatorSettings: BatwingAggregatorSettings
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
  viewportDisplayMode: ViewportDisplayMode
  foilColorHex: string
  wireColorHex: string
}

type LoadedTargetSurface = {
  name: string
  triangles: Array<[THREE.Vector3, THREE.Vector3, THREE.Vector3]>
  bounds: THREE.Box3
  previewMesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
  panelGridLines: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>
  panelGridMarkers: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>
}

type TargetSurfaceParameterization = {
  origin: THREE.Vector3
  uAxis: THREE.Vector3
  vAxis: THREE.Vector3
  minU: number
  maxU: number
  minV: number
  maxV: number
  triangles: ProjectedTargetTriangle[]
}

type ProjectedTargetTriangle = {
  a: THREE.Vector3
  b: THREE.Vector3
  c: THREE.Vector3
  au: number
  av: number
  bu: number
  bv: number
  cu: number
  cv: number
  normal: THREE.Vector3
}

type TargetSurfaceSample = {
  position: THREE.Vector3
  normal: THREE.Vector3
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

type ViewportDisplayMode = 'gloss' | 'solid' | 'wire' | 'uv-map'

type ArrayCell = {
  offset: THREE.Vector3
  instanceIndex: number
  lengthIndex: number
  widthIndex: number
  heightIndex: number
}

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
const MAX_AGGREGATE_MODULES = 50
const MAX_AGGREGATE_SEED = 1000
const AGGREGATE_FIELD_CAPACITY_MULTIPLIER = 3
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
const MAX_TARGET_SURFACE_SUBDIVISIONS = 50
const WELD_EPSILON = 1e-5
const LATTICE_POINT_SIZE = 0.052
const LATTICE_MARQUEE_THRESHOLD = 4
const LATTICE_COLOR = new THREE.Color(0xd100ff)
const LATTICE_CORNER_COLOR = new THREE.Color(0x8d5cff)
const LATTICE_HOVER_COLOR = new THREE.Color(0x7de7ff)
const LATTICE_SELECTED_COLOR = new THREE.Color(0xff7a00)
const LATTICE_PIVOT_COLOR = new THREE.Color(0x78ffbc)
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
const DEFAULT_VIEWPORT_DISPLAY_MODE: ViewportDisplayMode = 'gloss'
const DEFAULT_STATUS_MESSAGE = 'Wheel zooms. Middle mouse pans. Right mouse orbits.'
const DEFAULT_ARRAY_SETTINGS: BatwingArraySettings = {
  lengthCount: 1,
  widthCount: 1,
  heightCount: 1,
  thickness: 0,
  subdivisions: 0,
}
const DEFAULT_AGGREGATOR_SETTINGS: BatwingAggregatorSettings = {
  enabled: false,
  moduleCount: 8,
  seed: 1,
  growthMode: 'branching',
  adjacencyRule: 'face',
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
  uSubdivisions: 8,
  vSubdivisions: 8,
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
    <div id="lattice-tooltip" class="lattice-tooltip" role="status" hidden></div>
    <div id="viewport-status" class="viewport-status" role="status" aria-live="polite">
      <span class="viewport-status-label">Orbit</span>
      <span id="viewport-status-message">Wheel zooms. Middle mouse pans. Right mouse orbits.</span>
    </div>
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
        <nav class="panel-tabbar" aria-label="Control groups">
          <button class="panel-tab-button is-active" type="button" data-panel-tab-button="geometry" aria-pressed="true">Geometry</button>
          <button class="panel-tab-button" type="button" data-panel-tab-button="array" aria-pressed="false">Array</button>
          <button class="panel-tab-button" type="button" data-panel-tab-button="materials" aria-pressed="false">Materials</button>
          <button class="panel-tab-button" type="button" data-panel-tab-button="display" aria-pressed="false">Display</button>
          <button class="panel-tab-button" type="button" data-panel-tab-button="export" aria-pressed="false">Export</button>
        </nav>
        <section class="panel-section" data-panel-tab="geometry">
          <button class="panel-section-header" type="button" aria-expanded="true">
            <span class="panel-section-label">Batwing</span>
          </button>
          <div class="panel-section-content panel-controls-stack">
            <label class="control" for="geometryTypeSelect">
              <div class="control-row">
                <span>Geometry</span>
                <select id="geometryTypeSelect" class="value-pill value-select" aria-label="Geometry selection">
                  <option value="batwing">Batwing</option>
                  <option value="scherks">Scherks</option>
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
        <section class="panel-section" data-panel-tab="array" hidden>
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
        <section class="panel-section" data-panel-tab="array" hidden>
          <button class="panel-section-header" type="button" aria-expanded="true">
            <span class="panel-section-label">Aggregator</span>
          </button>
          <div class="panel-section-content panel-controls-stack">
            <label class="toggle-control" for="aggregatorToggle">
              <span>Aggregate Mode</span>
              <input id="aggregatorToggle" type="checkbox" />
            </label>
            <label class="control" for="growthModeSelect">
              <div class="control-row">
                <span>Growth Mode</span>
                <select id="growthModeSelect" class="value-pill value-select" aria-label="Growth mode">
                  <option value="branching">Branching</option>
                  <option value="compact">Compact</option>
                  <option value="vertical">Vertical</option>
                  <option value="radial">Radial</option>
                  <option value="strata">Strata</option>
                  <option value="random-walk">Random Walk</option>
                </select>
              </div>
            </label>
            <label class="control" for="adjacencyRuleSelect">
              <div class="control-row">
                <span>Adjacency Rule</span>
                <select id="adjacencyRuleSelect" class="value-pill value-select" aria-label="Adjacency rule">
                  <option value="face">Face</option>
                  <option value="edge">Face + Edge</option>
                  <option value="corner">Face + Corner</option>
                  <option value="bridge">Bridge</option>
                </select>
              </div>
            </label>
            <label class="control" for="moduleCountSlider">
              <div class="control-row">
                <span>Module Count</span>
                <input id="module-count-value" class="value-pill value-input" type="number" inputmode="numeric" min="1" max="50" step="1" value="8" />
              </div>
              <input id="moduleCountSlider" type="range" min="1" max="50" value="8" step="1" />
            </label>
            <label class="control" for="aggregateSeedSlider">
              <div class="control-row">
                <span>Seed</span>
                <input id="aggregate-seed-value" class="value-pill value-input" type="number" inputmode="numeric" min="1" max="1000" step="1" value="1" />
              </div>
              <input id="aggregateSeedSlider" type="range" min="1" max="1000" value="1" step="1" />
            </label>
            <div class="control">
              <button id="populateAggregateButton" class="pill-button control-button-wide" type="button">
                <span class="control-icon icon-target" aria-hidden="true"></span>
                <span>Populate</span>
              </button>
            </div>
          </div>
        </section>
        <section class="panel-section" data-panel-tab="geometry">
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
        <section class="panel-section" data-panel-tab="geometry">
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
        <section class="panel-section" data-panel-tab="geometry">
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
              <button id="loadTargetSurfaceButton" class="pill-button" type="button">
                <span class="control-icon icon-target" aria-hidden="true"></span>
                <span>Load Target</span>
              </button>
              <button id="clearTargetSurfaceButton" class="pill-button" type="button">
                <span class="control-icon icon-reset" aria-hidden="true"></span>
                <span>Clear Target</span>
              </button>
            </div>
            <div class="control">
              <button id="snapTargetToBatwingButton" class="pill-button control-button-wide" type="button">
                <span class="control-icon icon-crosshair" aria-hidden="true"></span>
                <span>Snap Target To Batwing Bounds</span>
              </button>
            </div>
            <div class="control control-grid-2">
              <button id="mapTargetButton" class="pill-button" type="button">
                <span class="control-icon icon-target" aria-hidden="true"></span>
                <span>Map Batwing To Target</span>
              </button>
              <button id="unmapTargetButton" class="pill-button" type="button">
                <span class="control-icon icon-reset" aria-hidden="true"></span>
                <span>Stop Mapping</span>
              </button>
            </div>
            <div class="control control-grid-2">
              <button id="targetMoveModeButton" class="pill-button" type="button">
                <span class="control-icon icon-move" aria-hidden="true"></span>
                <span>Target Move</span>
              </button>
              <button id="targetRotateModeButton" class="pill-button" type="button">
                <span class="control-icon icon-rotate" aria-hidden="true"></span>
                <span>Target Rotate</span>
              </button>
              <button id="targetScaleModeButton" class="pill-button" type="button">
                <span class="control-icon icon-scale" aria-hidden="true"></span>
                <span>Target Scale</span>
              </button>
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
                <span>Grid Z Offset</span>
                <input id="target-offset-value" class="value-pill value-input" type="number" inputmode="decimal" min="-6" max="6" step="0.01" value="0.00" />
              </div>
              <input id="targetOffsetSlider" type="range" min="-6" max="6" value="0" step="0.01" />
            </label>
            <label class="control" for="targetUSubdivisionsSlider">
              <div class="control-row">
                <span>U Subdivisions</span>
                <input id="target-u-subdivisions-value" class="value-pill value-input" type="number" inputmode="numeric" min="1" max="50" step="1" value="8" />
              </div>
              <input id="targetUSubdivisionsSlider" type="range" min="1" max="50" value="8" step="1" />
            </label>
            <label class="control" for="targetVSubdivisionsSlider">
              <div class="control-row">
                <span>V Subdivisions</span>
                <input id="target-v-subdivisions-value" class="value-pill value-input" type="number" inputmode="numeric" min="1" max="50" step="1" value="8" />
              </div>
              <input id="targetVSubdivisionsSlider" type="range" min="1" max="50" value="8" step="1" />
            </label>
            <div class="control">
              <button id="applySurfaceFieldButton" class="pill-button control-button-wide" type="button">
                <span class="control-icon icon-target" aria-hidden="true"></span>
                <span>Apply Surface Field</span>
              </button>
            </div>
            <label class="control" for="targetScaleSlider">
              <div class="control-row">
                <span>Target Scale</span>
                <input id="target-scale-value" class="value-pill value-input" type="number" inputmode="decimal" min="0.05" max="20" step="0.01" value="1.00" />
              </div>
              <input id="targetScaleSlider" type="range" min="0.05" max="20" value="1" step="0.01" />
            </label>
          </div>
        </section>
        <section class="panel-section" data-panel-tab="array" hidden>
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
              <button id="latticeResetButton" class="pill-button control-button-wide" type="button">
                <span class="control-icon icon-reset" aria-hidden="true"></span>
                <span>Reset</span>
              </button>
            </div>
          </div>
        </section>
        <section class="panel-section" data-panel-tab="display" hidden>
          <button class="panel-section-header" type="button" aria-expanded="true">
            <span class="panel-section-label">Display</span>
          </button>
          <div class="panel-section-content panel-controls-stack">
            <label class="control" for="viewportModeSelect">
              <div class="control-row">
                <span>Viewport Mode</span>
                <select id="viewportModeSelect" class="value-pill value-select" aria-label="Viewport display mode">
                  <option value="gloss">Gloss</option>
                  <option value="solid">Solid</option>
                  <option value="wire">Wire</option>
                  <option value="uv-map">UV/Map</option>
                </select>
              </div>
            </label>
            <label class="toggle-control" for="baseGridToggle">
              <span class="control-icon icon-eye" aria-hidden="true"></span>
              <span>Base Grid</span>
              <input id="baseGridToggle" type="checkbox" checked />
            </label>
            <label class="toggle-control" for="boxGuideToggle">
              <span class="control-icon icon-eye" aria-hidden="true"></span>
              <span>Bounding Boxes</span>
              <input id="boxGuideToggle" type="checkbox" />
            </label>
            <label class="toggle-control" for="latticeControlsToggle">
              <span class="control-icon icon-eye" aria-hidden="true"></span>
              <span>Lattice Controls</span>
              <input id="latticeControlsToggle" type="checkbox" checked />
            </label>
            <label class="toggle-control" for="wireToggle">
              <span class="control-icon icon-eye" aria-hidden="true"></span>
              <span>Mesh Wires</span>
              <input id="wireToggle" type="checkbox" checked />
            </label>
            <label class="toggle-control" for="seamDebugToggle">
              <span class="control-icon icon-eye" aria-hidden="true"></span>
              <span>Seam Debug</span>
              <input id="seamDebugToggle" type="checkbox" />
            </label>
          </div>
        </section>
        <section class="panel-section" data-panel-tab="materials" hidden>
          <button class="panel-section-header" type="button" aria-expanded="true">
            <span class="panel-section-label">Materials</span>
          </button>
          <div class="panel-section-content panel-controls-stack">
            <label class="toggle-control" for="reflectionToggle">
              <span class="control-icon icon-eye" aria-hidden="true"></span>
              <span>Foil Material</span>
              <input id="reflectionToggle" type="checkbox" checked />
            </label>
            <label class="toggle-control" for="backFacesToggle">
              <span class="control-icon icon-eye" aria-hidden="true"></span>
              <span>Back Faces</span>
              <input id="backFacesToggle" type="checkbox" />
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
        <section class="panel-section" data-panel-tab="export" hidden>
          <button class="panel-section-header" type="button" aria-expanded="true">
            <span class="panel-section-label">Export</span>
          </button>
          <div class="panel-section-content panel-controls-stack">
            <div class="control">
              <button id="exportObjButton" class="pill-button control-button-wide" type="button">
                <span class="control-icon icon-download" aria-hidden="true"></span>
                <span>Export OBJ</span>
              </button>
            </div>
            <div class="control">
              <button id="exportGlbButton" class="pill-button control-button-wide" type="button">
                <span class="control-icon icon-download" aria-hidden="true"></span>
                <span>Export GLB</span>
              </button>
            </div>
            <div class="control">
              <button id="exportScreenshotButton" class="pill-button control-button-wide" type="button">
                <span class="control-icon icon-download" aria-hidden="true"></span>
                <span>Export Screenshot</span>
              </button>
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
const latticeTooltip = requireElement<HTMLDivElement>('#lattice-tooltip')
const viewportStatus = requireElement<HTMLDivElement>('#viewport-status')
const viewportStatusMessage = requireElement<HTMLSpanElement>('#viewport-status-message')
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
const viewportModeSelect = requireElement<HTMLSelectElement>('#viewportModeSelect')
const foilColorInput = requireElement<HTMLInputElement>('#foilColorInput')
const wireColorInput = requireElement<HTMLInputElement>('#wireColorInput')
const geometryTypeSelect = requireElement<HTMLSelectElement>('#geometryTypeSelect')
const batwingFamilySelect = requireElement<HTMLSelectElement>('#batwingFamilySelect')
const aggregatorToggle = requireElement<HTMLInputElement>('#aggregatorToggle')
const growthModeSelect = requireElement<HTMLSelectElement>('#growthModeSelect')
const adjacencyRuleSelect = requireElement<HTMLSelectElement>('#adjacencyRuleSelect')
const populateAggregateButton = requireElement<HTMLButtonElement>('#populateAggregateButton')
const targetSurfaceFileInput = requireElement<HTMLInputElement>('#targetSurfaceFileInput')
const loadTargetSurfaceButton = requireElement<HTMLButtonElement>('#loadTargetSurfaceButton')
const clearTargetSurfaceButton = requireElement<HTMLButtonElement>('#clearTargetSurfaceButton')
const snapTargetToBatwingButton = requireElement<HTMLButtonElement>('#snapTargetToBatwingButton')
const mapTargetButton = requireElement<HTMLButtonElement>('#mapTargetButton')
const unmapTargetButton = requireElement<HTMLButtonElement>('#unmapTargetButton')
const applySurfaceFieldButton = requireElement<HTMLButtonElement>('#applySurfaceFieldButton')
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

const aggregatorSliderBindings: AggregatorSliderBinding[] = [
  {
    key: 'moduleCount',
    fallback: DEFAULT_AGGREGATOR_SETTINGS.moduleCount,
    min: 1,
    max: MAX_AGGREGATE_MODULES,
    integer: true,
    slider: requireElement<HTMLInputElement>('#moduleCountSlider'),
    valueInput: requireElement<HTMLInputElement>('#module-count-value'),
  },
  {
    key: 'seed',
    fallback: DEFAULT_AGGREGATOR_SETTINGS.seed,
    min: 1,
    max: MAX_AGGREGATE_SEED,
    integer: true,
    slider: requireElement<HTMLInputElement>('#aggregateSeedSlider'),
    valueInput: requireElement<HTMLInputElement>('#aggregate-seed-value'),
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
  {
    key: 'uSubdivisions',
    fallback: DEFAULT_TARGET_SURFACE_SETTINGS.uSubdivisions,
    min: 1,
    max: MAX_TARGET_SURFACE_SUBDIVISIONS,
    integer: true,
    slider: requireElement<HTMLInputElement>('#targetUSubdivisionsSlider'),
    valueInput: requireElement<HTMLInputElement>('#target-u-subdivisions-value'),
  },
  {
    key: 'vSubdivisions',
    fallback: DEFAULT_TARGET_SURFACE_SETTINGS.vSubdivisions,
    min: 1,
    max: MAX_TARGET_SURFACE_SUBDIVISIONS,
    integer: true,
    slider: requireElement<HTMLInputElement>('#targetVSubdivisionsSlider'),
    valueInput: requireElement<HTMLInputElement>('#target-v-subdivisions-value'),
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
let latticeCornerPointMesh: THREE.InstancedMesh<THREE.BoxGeometry, THREE.MeshBasicMaterial> | null = null
let latticeHighlightPointMesh: THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> | null = null
let latticeHoverPointMesh: THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> | null = null
let latticePivotMesh: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshBasicMaterial> | null = null
let latticeLineSegments: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial> | null = null
let latticeCornerPointIndices: number[] = []
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
  updateTargetSurfaceVisualGuides()
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
  DEFAULT_AGGREGATOR_SETTINGS,
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
  buildArrayBoxGuideGeometry(DEFAULT_ARRAY_SETTINGS, DEFAULT_AGGREGATOR_SETTINGS),
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
let viewportDisplayModeBeforeEdit: ViewportDisplayMode | null = null
let growthModeBeforeEdit: AggregatorGrowthMode | null = null
let adjacencyRuleBeforeEdit: AggregatorAdjacencyRule | null = null
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

function readAggregatorSliderNumber(binding: AggregatorSliderBinding): number {
  return normalizeAggregatorSliderValue(binding, readSliderNumber(binding.slider, binding.fallback))
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

function normalizeAggregatorSliderValue(binding: AggregatorSliderBinding, value: number): number {
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
  const snappedValue = snapValueToSlider(clampedValue, binding.slider)
  return binding.integer ? Math.round(clampNumber(snappedValue, binding.min, binding.max)) : snappedValue
}

function formatSymmetrySliderValue(binding: SymmetrySliderBinding, value: number): string {
  return binding.integer ? `${Math.round(value)}` : formatSliderValue(value)
}

function formatArraySliderValue(binding: ArraySliderBinding, value: number): string {
  return binding.integer ? `${Math.round(value)}` : formatSliderValue(value)
}

function formatAggregatorSliderValue(binding: AggregatorSliderBinding, value: number): string {
  return binding.integer ? `${Math.round(value)}` : formatSliderValue(value)
}

function formatTargetSurfaceSliderValue(binding: TargetSurfaceSliderBinding, value: number): string {
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

function getCurrentAggregatorSettings(): BatwingAggregatorSettings {
  const sliderSettings = aggregatorSliderBindings.reduce<Pick<BatwingAggregatorSettings, 'moduleCount' | 'seed'>>(
    (settings, binding) => {
      settings[binding.key] = readAggregatorSliderNumber(binding)
      return settings
    },
    {
      moduleCount: DEFAULT_AGGREGATOR_SETTINGS.moduleCount,
      seed: DEFAULT_AGGREGATOR_SETTINGS.seed,
    },
  )
  return {
    enabled: aggregatorToggle.checked,
    growthMode: getCurrentAggregatorGrowthMode(),
    adjacencyRule: getCurrentAggregatorAdjacencyRule(),
    ...sliderSettings,
  }
}

function getCurrentAggregatorGrowthMode(): AggregatorGrowthMode {
  const value = growthModeSelect.value
  if (value === 'compact' || value === 'vertical' || value === 'radial' || value === 'strata' || value === 'random-walk') {
    return value
  }
  return 'branching'
}

function getCurrentAggregatorAdjacencyRule(): AggregatorAdjacencyRule {
  const value = adjacencyRuleSelect.value
  if (value === 'edge' || value === 'corner' || value === 'bridge') {
    return value
  }
  return 'face'
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
      uSubdivisions: DEFAULT_TARGET_SURFACE_SETTINGS.uSubdivisions,
      vSubdivisions: DEFAULT_TARGET_SURFACE_SETTINGS.vSubdivisions,
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

function cloneAggregatorSettings(settings: BatwingAggregatorSettings): BatwingAggregatorSettings {
  return {
    enabled: settings.enabled,
    moduleCount: settings.moduleCount,
    seed: settings.seed,
    growthMode: settings.growthMode,
    adjacencyRule: settings.adjacencyRule,
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
    uSubdivisions: settings.uSubdivisions,
    vSubdivisions: settings.vSubdivisions,
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
    aggregatorSettings: cloneAggregatorSettings(state.aggregatorSettings),
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
    viewportDisplayMode: state.viewportDisplayMode,
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
    aggregatorSettings: getCurrentAggregatorSettings(),
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
    viewportDisplayMode: getCurrentViewportDisplayMode(),
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
    a.aggregatorSettings.enabled === b.aggregatorSettings.enabled &&
    a.aggregatorSettings.moduleCount === b.aggregatorSettings.moduleCount &&
    a.aggregatorSettings.seed === b.aggregatorSettings.seed &&
    a.aggregatorSettings.growthMode === b.aggregatorSettings.growthMode &&
    a.aggregatorSettings.adjacencyRule === b.aggregatorSettings.adjacencyRule &&
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
    a.targetSurfaceSettings.uSubdivisions === b.targetSurfaceSettings.uSubdivisions &&
    a.targetSurfaceSettings.vSubdivisions === b.targetSurfaceSettings.vSubdivisions &&
    latticePointPositionsEqual(a.latticePointPositions, b.latticePointPositions) &&
    a.showBaseGrid === b.showBaseGrid &&
    a.showWireframe === b.showWireframe &&
    a.reflectionsEnabled === b.reflectionsEnabled &&
    a.showBoxGuide === b.showBoxGuide &&
    a.showLatticeControls === b.showLatticeControls &&
    a.showBackFaces === b.showBackFaces &&
    a.showSeamDebug === b.showSeamDebug &&
    a.viewportDisplayMode === b.viewportDisplayMode &&
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
  applyAggregatorSettings(state.aggregatorSettings)
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
  applyViewportDisplayMode(state.viewportDisplayMode, false)
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
  if (
    value === 'scherks' ||
    value === 'schwarz-p' ||
    value === 'scherk-1' ||
    value === 'scherk-2' ||
    value === 'neovius'
  ) {
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

function setArrayControlValue(key: ArrayControlKey, value: number): void {
  const binding = arraySliderBindings.find((arrayBinding) => arrayBinding.key === key)
  if (!binding) {
    return
  }
  const nextValue = normalizeArraySliderValue(binding, value)
  binding.slider.value = `${nextValue}`
  binding.valueInput.value = formatArraySliderValue(binding, nextValue)
  updateRangeProgress(binding.slider)
}

function setTargetSurfaceControlValue(key: TargetSurfaceControlKey, value: number): void {
  const binding = targetSurfaceSliderBindings.find((targetBinding) => targetBinding.key === key)
  if (!binding) {
    return
  }
  const nextValue = normalizeTargetSurfaceSliderValue(binding, value)
  binding.slider.value = `${nextValue}`
  binding.valueInput.value = formatTargetSurfaceSliderValue(binding, nextValue)
  updateRangeProgress(binding.slider)
}

function ensureAggregateFieldCapacity(): void {
  const aggregatorSettings = getCurrentAggregatorSettings()
  if (!aggregatorSettings.enabled) {
    return
  }

  const targetCount = clampNumber(Math.round(aggregatorSettings.moduleCount), 1, MAX_AGGREGATE_MODULES)
  const targetCapacity = Math.min(
    MAX_ARRAY_COUNT * MAX_ARRAY_COUNT * MAX_ARRAY_COUNT,
    Math.ceil(targetCount * AGGREGATE_FIELD_CAPACITY_MULTIPLIER),
  )
  const arraySettings = getCurrentArraySettings()
  let lengthCount = arraySettings.lengthCount
  let widthCount = arraySettings.widthCount
  let heightCount = arraySettings.heightCount

  const getCapacity = (): number => lengthCount * widthCount * heightCount
  while (getCapacity() < targetCapacity) {
    if (lengthCount <= widthCount && lengthCount <= heightCount && lengthCount < MAX_ARRAY_COUNT) {
      lengthCount += 1
    } else if (widthCount <= heightCount && widthCount < MAX_ARRAY_COUNT) {
      widthCount += 1
    } else if (heightCount < MAX_ARRAY_COUNT) {
      heightCount += 1
    } else {
      break
    }
  }

  if (
    lengthCount !== arraySettings.lengthCount ||
    widthCount !== arraySettings.widthCount ||
    heightCount !== arraySettings.heightCount
  ) {
    setArrayControlValue('lengthCount', lengthCount)
    setArrayControlValue('widthCount', widthCount)
    setArrayControlValue('heightCount', heightCount)
  }
}

function applySurfaceFieldSettings(): void {
  const targetSettings = getCurrentTargetSurfaceSettings()
  aggregatorToggle.checked = false
  setArrayControlValue('widthCount', targetSettings.uSubdivisions)
  setArrayControlValue('lengthCount', targetSettings.vSubdivisions)
  if (Math.abs(targetSettings.offset) <= 1e-4) {
    setTargetSurfaceControlValue('offset', 1)
  }
  targetMappingEnabled = Boolean(loadedTargetSurface)
  updateTargetSurfaceVisualGuides()
  rebuildBatwing()
}

function applyAggregatorSettings(settings: BatwingAggregatorSettings): void {
  aggregatorToggle.checked = settings.enabled
  growthModeSelect.value = settings.growthMode
  adjacencyRuleSelect.value = settings.adjacencyRule
  for (const binding of aggregatorSliderBindings) {
    const nextValue = normalizeAggregatorSliderValue(binding, settings[binding.key])
    binding.slider.value = `${nextValue}`
    binding.valueInput.value = formatAggregatorSliderValue(binding, nextValue)
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
    binding.valueInput.value = formatTargetSurfaceSliderValue(binding, nextValue)
    updateRangeProgress(binding.slider)
  }
  updateTargetSurfaceVisualGuides()
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

function commitAggregatorValueInput(binding: AggregatorSliderBinding): void {
  const parsedValue = Number.parseFloat(binding.valueInput.value)
  const nextValue = normalizeAggregatorSliderValue(binding, parsedValue)
  binding.slider.value = `${nextValue}`
  binding.valueInput.value = formatAggregatorSliderValue(binding, nextValue)
  updateRangeProgress(binding.slider)
  ensureAggregateFieldCapacity()
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
  binding.valueInput.value = formatTargetSurfaceSliderValue(binding, nextValue)
  updateRangeProgress(binding.slider)
  updateTargetSurfaceVisualGuides()
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

function bindAggregatorSlider(binding: AggregatorSliderBinding): void {
  const syncFromSlider = (): void => {
    beginControlHistoryEdit()
    const value = readAggregatorSliderNumber(binding)
    binding.slider.value = `${value}`
    binding.valueInput.value = formatAggregatorSliderValue(binding, value)
    updateRangeProgress(binding.slider)
    ensureAggregateFieldCapacity()
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
    commitAggregatorValueInput(binding)
    finishControlHistoryEdit()
  })
  binding.valueInput.addEventListener('blur', () => {
    commitAggregatorValueInput(binding)
    finishControlHistoryEdit()
  })
  binding.valueInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitAggregatorValueInput(binding)
      finishControlHistoryEdit()
      binding.valueInput.blur()
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      binding.valueInput.value = formatAggregatorSliderValue(binding, readAggregatorSliderNumber(binding))
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
    binding.valueInput.value = formatTargetSurfaceSliderValue(binding, value)
    updateRangeProgress(binding.slider)
    updateTargetSurfaceVisualGuides()
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
  const aggregatorSettings = getCurrentAggregatorSettings()
  const depthGradientSettings = getCurrentDepthGradientSettings()
  const symmetrySettings = getCurrentSymmetrySettings()
  const sourceQuadMesh = buildSubdividedWeldedArrayQuadMesh(
    geometryType,
    batwingFamily,
    settings,
    arraySettings,
    aggregatorSettings,
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
    aggregatorSettings,
    depthGradientSettings,
    getCurrentTargetSurfaceSettings().offsetMode,
  )
  const nextGeometrySet = buildGeometrySetFromQuadMesh(displayQuadMesh, arraySettings, aggregatorSettings)

  batwingMesh.geometry.dispose()
  batwingMesh.geometry = nextGeometrySet.meshGeometry

  wireOverlay.geometry.dispose()
  wireOverlay.geometry = nextGeometrySet.wireGeometry

  boxGuide.geometry.dispose()
  boxGuide.geometry = buildArrayBoxGuideGeometry(arraySettings, aggregatorSettings)
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
  const aggregatorSettings = getCurrentAggregatorSettings()
  const depthGradientSettings = getCurrentDepthGradientSettings()
  const mappedQuadMesh = applyTargetSurfaceMapping(
    applyLatticeDeformation(sourceQuadMesh),
    getCurrentTargetSurfaceSettings(),
  )
  const displayQuadMesh = buildFinalDisplayQuadMesh(
    mappedQuadMesh,
    arraySettings,
    aggregatorSettings,
    depthGradientSettings,
    getCurrentTargetSurfaceSettings().offsetMode,
  )
  const nextGeometrySet = buildGeometrySetFromQuadMesh(displayQuadMesh, arraySettings, aggregatorSettings)
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

function getActiveArrayInstanceCount(
  arraySettings: BatwingArraySettings,
  aggregatorSettings: BatwingAggregatorSettings,
): number {
  if (!aggregatorSettings.enabled) {
    return getArrayInstanceCount(arraySettings)
  }
  return getAggregateArrayCells(arraySettings, aggregatorSettings).length
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

function getAllArrayCells(settings: BatwingArraySettings): ArrayCell[] {
  const cells: ArrayCell[] = []
  forEachArrayOffset(settings, (offset, instanceIndex, lengthIndex, widthIndex, heightIndex) => {
    cells.push({
      offset,
      instanceIndex,
      lengthIndex,
      widthIndex,
      heightIndex,
    })
  })
  return cells
}

function getAggregateArrayCells(
  arraySettings: BatwingArraySettings,
  aggregatorSettings: BatwingAggregatorSettings,
): ArrayCell[] {
  const allCells = getAllArrayCells(arraySettings)
  if (!aggregatorSettings.enabled) {
    return allCells
  }

  const targetCount = Math.min(
    Math.max(1, Math.round(aggregatorSettings.moduleCount)),
    allCells.length,
  )
  if (targetCount >= allCells.length) {
    return allCells
  }

  const cellLookup = new Map<string, ArrayCell>()
  for (const cell of allCells) {
    cellLookup.set(getArrayCellKey(cell.lengthIndex, cell.widthIndex, cell.heightIndex), cell)
  }

  const random = createSeededRandom(aggregatorSettings.seed)
  const startCell = getCenteredSeedCell(allCells, arraySettings, random)
  const selectedKeys = new Set<string>()
  const frontierKeys = new Set<string>()
  const selectedCells: ArrayCell[] = []

  const addCell = (cell: ArrayCell): void => {
    const key = getArrayCellKey(cell.lengthIndex, cell.widthIndex, cell.heightIndex)
    if (selectedKeys.has(key)) {
      return
    }
    selectedKeys.add(key)
    selectedCells.push(cell)
    for (const neighborKey of getArrayCellNeighborKeys(cell, arraySettings, aggregatorSettings.adjacencyRule)) {
      if (!selectedKeys.has(neighborKey) && cellLookup.has(neighborKey)) {
        frontierKeys.add(neighborKey)
      }
    }
  }

  addCell(startCell)
  while (selectedCells.length < targetCount && frontierKeys.size > 0) {
    const nextKey = chooseAggregateFrontierCellKey(
      [...frontierKeys],
      selectedCells,
      selectedKeys,
      cellLookup,
      arraySettings,
      aggregatorSettings,
      random,
    )
    frontierKeys.delete(nextKey)
    const nextCell = cellLookup.get(nextKey)
    if (nextCell) {
      addCell(nextCell)
    }
  }

  return selectedCells.sort((a, b) => a.instanceIndex - b.instanceIndex)
}

function getCenteredSeedCell(
  cells: readonly ArrayCell[],
  settings: BatwingArraySettings,
  random: () => number,
): ArrayCell {
  const center = new THREE.Vector3(
    (settings.lengthCount - 1) / 2,
    (settings.widthCount - 1) / 2,
    (settings.heightCount - 1) / 2,
  )
  const centerCells = cells
    .map((cell) => ({
      cell,
      distance: getArrayCellIndexVector(cell).distanceToSquared(center),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, Math.min(8, cells.length))
  return centerCells[Math.floor(random() * centerCells.length)]?.cell ?? cells[0]
}

function chooseAggregateFrontierCellKey(
  frontierKeys: readonly string[],
  selectedCells: readonly ArrayCell[],
  selectedKeys: ReadonlySet<string>,
  cellLookup: ReadonlyMap<string, ArrayCell>,
  settings: BatwingArraySettings,
  aggregatorSettings: BatwingAggregatorSettings,
  random: () => number,
): string {
  let bestKey = frontierKeys[0] ?? ''
  let bestScore = Number.NEGATIVE_INFINITY
  const centroid = getArrayCellCentroid(selectedCells)
  const fieldDiagonal = Math.max(
    new THREE.Vector3(settings.lengthCount, settings.widthCount, settings.heightCount).length(),
    1,
  )

  for (const key of frontierKeys) {
    const cell = cellLookup.get(key)
    if (!cell) {
      continue
    }

    const cellVector = getArrayCellIndexVector(cell)
    const selectedNeighborCount = getArrayCellNeighborKeys(cell, settings, aggregatorSettings.adjacencyRule).filter((neighborKey) =>
      selectedKeys.has(neighborKey),
    ).length
    const sameRuleNeighborCount = Math.max(selectedNeighborCount, 1)
    const faceNeighborCount = getArrayCellNeighborKeys(cell, settings, 'face').filter((neighborKey) =>
      selectedKeys.has(neighborKey),
    ).length
    const exposedSideCount = 6 - faceNeighborCount
    const spread = centroid ? cellVector.distanceTo(centroid) / fieldDiagonal : 0
    const fieldCenter = getArrayFieldCenter(settings)
    const radialSpread = cellVector.distanceTo(fieldCenter) / fieldDiagonal
    const lateralSpread = centroid
      ? new THREE.Vector2(cell.lengthIndex - centroid.x, cell.widthIndex - centroid.y).length() / fieldDiagonal
      : 0
    const verticalLevel = settings.heightCount <= 1 ? 0 : cell.heightIndex / Math.max(settings.heightCount - 1, 1)
    const sparseConnection = 1 / sameRuleNeighborCount
    const score = getAggregateGrowthScore({
      cell,
      centroid,
      exposedSideCount,
      faceNeighborCount,
      lateralSpread,
      radialSpread,
      random,
      sparseConnection,
      spread,
      verticalLevel,
      mode: aggregatorSettings.growthMode,
    })

    if (score > bestScore) {
      bestScore = score
      bestKey = key
    }
  }

  return bestKey
}

function getAggregateGrowthScore(options: {
  cell: ArrayCell
  centroid: THREE.Vector3 | null
  exposedSideCount: number
  faceNeighborCount: number
  lateralSpread: number
  radialSpread: number
  random: () => number
  sparseConnection: number
  spread: number
  verticalLevel: number
  mode: AggregatorGrowthMode
}): number {
  const noise = options.random()
  switch (options.mode) {
    case 'compact':
      return noise * 0.45 - options.spread * 2.4 + options.faceNeighborCount * 0.92
    case 'vertical':
      return noise * 0.62 + options.verticalLevel * 2.3 + options.spread * 0.7 + options.sparseConnection * 0.34
    case 'radial':
      return noise * 0.58 + options.radialSpread * 2.5 + options.exposedSideCount * 0.22
    case 'strata': {
      const centroidHeight = options.centroid?.z ?? options.cell.heightIndex
      const layerAffinity = 1 / (1 + Math.abs(options.cell.heightIndex - centroidHeight))
      return noise * 0.7 + options.lateralSpread * 1.8 + layerAffinity * 1.25 + options.exposedSideCount * 0.2
    }
    case 'random-walk':
      return noise * 2.4 + options.sparseConnection * 0.28
    case 'branching':
    default:
      return (
        noise * 0.8 +
        options.spread * 2.2 +
        options.exposedSideCount * 0.34 +
        options.sparseConnection * 0.75 +
        options.verticalLevel * 0.22
      )
  }
}

function getArrayCellCentroid(cells: readonly ArrayCell[]): THREE.Vector3 | null {
  if (cells.length === 0) {
    return null
  }
  const centroid = new THREE.Vector3()
  for (const cell of cells) {
    centroid.add(getArrayCellIndexVector(cell))
  }
  return centroid.multiplyScalar(1 / cells.length)
}

function getArrayCellIndexVector(cell: ArrayCell): THREE.Vector3 {
  return new THREE.Vector3(cell.lengthIndex, cell.widthIndex, cell.heightIndex)
}

function getArrayFieldCenter(settings: BatwingArraySettings): THREE.Vector3 {
  return new THREE.Vector3(
    (settings.lengthCount - 1) / 2,
    (settings.widthCount - 1) / 2,
    (settings.heightCount - 1) / 2,
  )
}

function getArrayCellKey(lengthIndex: number, widthIndex: number, heightIndex: number): string {
  return `${lengthIndex},${widthIndex},${heightIndex}`
}

function getArrayCellNeighborKeys(
  cell: ArrayCell,
  settings: BatwingArraySettings,
  adjacencyRule: AggregatorAdjacencyRule,
): string[] {
  const neighborOffsets = getArrayCellNeighborOffsets(adjacencyRule)
  const keys: string[] = []
  for (const [dLength, dWidth, dHeight] of neighborOffsets) {
    const lengthIndex = cell.lengthIndex + dLength
    const widthIndex = cell.widthIndex + dWidth
    const heightIndex = cell.heightIndex + dHeight
    if (
      lengthIndex >= 0 &&
      lengthIndex < settings.lengthCount &&
      widthIndex >= 0 &&
      widthIndex < settings.widthCount &&
      heightIndex >= 0 &&
      heightIndex < settings.heightCount
    ) {
      keys.push(getArrayCellKey(lengthIndex, widthIndex, heightIndex))
    }
  }
  return keys
}

function getArrayCellNeighborOffsets(adjacencyRule: AggregatorAdjacencyRule): Array<[number, number, number]> {
  const offsets: Array<[number, number, number]> = []
  for (let dLength = -1; dLength <= 1; dLength += 1) {
    for (let dWidth = -1; dWidth <= 1; dWidth += 1) {
      for (let dHeight = -1; dHeight <= 1; dHeight += 1) {
        if (dLength === 0 && dWidth === 0 && dHeight === 0) {
          continue
        }
        const activeAxisCount = Number(dLength !== 0) + Number(dWidth !== 0) + Number(dHeight !== 0)
        if (
          adjacencyRule === 'corner' ||
          (adjacencyRule === 'edge' && activeAxisCount <= 2) ||
          ((adjacencyRule === 'face' || adjacencyRule === 'bridge') && activeAxisCount === 1)
        ) {
          offsets.push([dLength, dWidth, dHeight])
        }
      }
    }
  }

  if (adjacencyRule === 'bridge') {
    offsets.push([2, 0, 0], [-2, 0, 0], [0, 2, 0], [0, -2, 0], [0, 0, 2], [0, 0, -2])
  }

  return offsets
}

function createSeededRandom(seed: number): () => number {
  let state = Math.max(1, Math.floor(Math.abs(seed))) >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function buildArrayLineGeometry(
  baseGeometry: THREE.BufferGeometry,
  settings: BatwingArraySettings,
  aggregatorSettings = DEFAULT_AGGREGATOR_SETTINGS,
): THREE.BufferGeometry {
  const basePosition = baseGeometry.getAttribute('position') as THREE.BufferAttribute
  const cells = getAggregateArrayCells(settings, aggregatorSettings)
  const instanceCount = cells.length
  const positions = new Float32Array(basePosition.count * instanceCount * 3)

  cells.forEach((cell, cellIndex) => {
    const instanceOffset = cellIndex * basePosition.count * 3
    for (let vertexIndex = 0; vertexIndex < basePosition.count; vertexIndex += 1) {
      const targetIndex = instanceOffset + vertexIndex * 3
      positions[targetIndex + 0] = basePosition.getX(vertexIndex) + cell.offset.x
      positions[targetIndex + 1] = basePosition.getY(vertexIndex) + cell.offset.y
      positions[targetIndex + 2] = basePosition.getZ(vertexIndex) + cell.offset.z
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
  aggregatorSettings: BatwingAggregatorSettings,
  depthGradientSettings: BatwingDepthGradientSettings,
  symmetrySettings: BatwingSymmetrySettings,
): BatwingGeometrySet {
  const quadMesh = buildSubdividedWeldedArrayQuadMesh(
    geometryType,
    batwingFamily,
    settings,
    arraySettings,
    aggregatorSettings,
    symmetrySettings,
  )
  currentSourceQuadMesh = cloneQuadMeshData(quadMesh)
  const displayQuadMesh = buildFinalDisplayQuadMesh(
    quadMesh,
    arraySettings,
    aggregatorSettings,
    depthGradientSettings,
    DEFAULT_TARGET_SURFACE_SETTINGS.offsetMode,
  )
  return buildGeometrySetFromQuadMesh(displayQuadMesh, arraySettings, aggregatorSettings)
}

function buildGeometrySetFromQuadMesh(
  quadMesh: QuadMeshData,
  arraySettings: BatwingArraySettings,
  aggregatorSettings: BatwingAggregatorSettings,
): BatwingGeometrySet {
  return {
    meshGeometry: buildGeometryFromQuadMesh(quadMesh, arraySettings, aggregatorSettings),
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
      const axis = getLatticeTransformControlAxis(control) ?? 'free'
      setViewportStatus(`${formatTransformModeLabel(mode)} ${axis}`, `Dragging selected handle group on ${axis} axis.`)
    } else {
      setExclusiveLatticeTransformControl(null)
      updateSelectionStatusHint()
    }
    updateLatticeTransformDraggingState()
  })
  control.addEventListener('mouseDown', () => {
    if (!getLatticeTransformControlAxis(control)) {
      return
    }
    setViewportStatus(formatTransformModeLabel(mode), 'Drag the highlighted axis to transform the selected lattice handles.')
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

function formatTransformModeLabel(mode: 'translate' | 'rotate' | 'scale'): string {
  if (mode === 'translate') {
    return 'Move'
  }
  if (mode === 'rotate') {
    return 'Rotate'
  }
  return 'Scale'
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

function getTransformedTargetSurfaceTriangles(
  settings: BatwingTargetSurfaceSettings,
): Array<[THREE.Vector3, THREE.Vector3, THREE.Vector3]> {
  if (!loadedTargetSurface) {
    return []
  }
  loadedTargetSurface.previewMesh.updateMatrixWorld(true)
  const meshMatrix = loadedTargetSurface.previewMesh.matrixWorld.clone()
  const targetScale = Math.max(settings.targetScale, 0.01)
  return loadedTargetSurface.triangles.map(([a, b, c]) => [
    a.clone().multiplyScalar(targetScale).applyMatrix4(meshMatrix),
    b.clone().multiplyScalar(targetScale).applyMatrix4(meshMatrix),
    c.clone().multiplyScalar(targetScale).applyMatrix4(meshMatrix),
  ] as [THREE.Vector3, THREE.Vector3, THREE.Vector3])
}

function updateTargetSurfaceVisualGuides(): void {
  if (!loadedTargetSurface) {
    return
  }

  const settings = getCurrentTargetSurfaceSettings()
  const transformedTriangles = getTransformedTargetSurfaceTriangles(settings)
  const panelGrid = buildTargetPanelGridGeometries(transformedTriangles, settings)
  loadedTargetSurface.panelGridLines.geometry.dispose()
  loadedTargetSurface.panelGridLines.geometry = panelGrid.lines
  loadedTargetSurface.panelGridMarkers.geometry.dispose()
  loadedTargetSurface.panelGridMarkers.geometry = panelGrid.markers
}

function buildTargetPanelGridGeometries(
  triangles: ReadonlyArray<[THREE.Vector3, THREE.Vector3, THREE.Vector3]>,
  settings: BatwingTargetSurfaceSettings,
): { lines: THREE.BufferGeometry; markers: THREE.BufferGeometry } {
  const parameterization = buildTargetSurfaceParameterization(triangles)
  const size = computeTriangleSetBounds(triangles).getSize(new THREE.Vector3())
  const linePositions: number[] = []
  const markerPositions: number[] = []
  const uCount = Math.max(1, Math.round(settings.uSubdivisions))
  const vCount = Math.max(1, Math.round(settings.vSubdivisions))
  const markerSize = Math.max(size.x, size.y, size.z, 1) / 95

  const addMarkerX = (center: THREE.Vector3): void => {
    const uArm = parameterization.uAxis.clone().multiplyScalar(markerSize)
    const vArm = parameterization.vAxis.clone().multiplyScalar(markerSize)
    const a = center.clone().sub(uArm).sub(vArm)
    const b = center.clone().add(uArm).add(vArm)
    const c = center.clone().sub(uArm).add(vArm)
    const d = center.clone().add(uArm).sub(vArm)
    markerPositions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z)
  }

  const sampleOnSurface = (u: number, v: number): THREE.Vector3 => {
    const sample = sampleTargetSurfaceParameterization(parameterization, u, v)
    const visualLift = 0.02
    return sample.position.clone().add(new THREE.Vector3(0, 0, settings.offset + visualLift))
  }

  for (let uIndex = 0; uIndex <= uCount; uIndex += 1) {
    for (let vIndex = 0; vIndex <= vCount; vIndex += 1) {
      addMarkerX(sampleOnSurface(uIndex / uCount, vIndex / vCount))
    }
  }

  const lines = new THREE.BufferGeometry()
  lines.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3))
  lines.computeBoundingSphere()
  const markers = new THREE.BufferGeometry()
  markers.setAttribute('position', new THREE.Float32BufferAttribute(markerPositions, 3))
  markers.computeBoundingSphere()
  return { lines, markers }
}

function computeTriangleSetBounds(
  triangles: ReadonlyArray<[THREE.Vector3, THREE.Vector3, THREE.Vector3]>,
): THREE.Box3 {
  const bounds = new THREE.Box3()
  for (const [a, b, c] of triangles) {
    bounds.expandByPoint(a)
    bounds.expandByPoint(b)
    bounds.expandByPoint(c)
  }
  return bounds
}

function buildTargetSurfaceParameterization(
  triangles: ReadonlyArray<[THREE.Vector3, THREE.Vector3, THREE.Vector3]>,
): TargetSurfaceParameterization {
  const vertices = triangles.flatMap(([a, b, c]) => [a, b, c])
  const origin = vertices.reduce((sum, vertex) => sum.add(vertex), new THREE.Vector3()).multiplyScalar(1 / Math.max(vertices.length, 1))
  const covariance = buildPointCovarianceMatrix(vertices, origin)
  const uAxis = getDominantCovarianceAxis(covariance, new THREE.Vector3(1, 0.37, 0.19))
  const uEigenvalue = uAxis.dot(multiplySymmetricMatrixVector(covariance, uAxis))
  const deflated = deflateSymmetricMatrix(covariance, uAxis, uEigenvalue)
  let vAxis = getDominantCovarianceAxis(deflated, new THREE.Vector3(-0.23, 1, 0.41))
  vAxis.addScaledVector(uAxis, -vAxis.dot(uAxis))
  if (vAxis.lengthSq() <= 1e-10) {
    vAxis.copy(getAnyPerpendicularUnitVector(uAxis))
  } else {
    vAxis.normalize()
  }

  let minU = Number.POSITIVE_INFINITY
  let maxU = Number.NEGATIVE_INFINITY
  let minV = Number.POSITIVE_INFINITY
  let maxV = Number.NEGATIVE_INFINITY
  const projectedTriangles: ProjectedTargetTriangle[] = []
  for (const [a, b, c] of triangles) {
    const auv = projectPointToTargetSurfaceFrame(a, origin, uAxis, vAxis)
    const buv = projectPointToTargetSurfaceFrame(b, origin, uAxis, vAxis)
    const cuv = projectPointToTargetSurfaceFrame(c, origin, uAxis, vAxis)
    minU = Math.min(minU, auv.x, buv.x, cuv.x)
    maxU = Math.max(maxU, auv.x, buv.x, cuv.x)
    minV = Math.min(minV, auv.y, buv.y, cuv.y)
    maxV = Math.max(maxV, auv.y, buv.y, cuv.y)
    projectedTriangles.push({
      a,
      b,
      c,
      au: auv.x,
      av: auv.y,
      bu: buv.x,
      bv: buv.y,
      cu: cuv.x,
      cv: cuv.y,
      normal: THREE.Triangle.getNormal(a, b, c, new THREE.Vector3()),
    })
  }

  return {
    origin,
    uAxis,
    vAxis,
    minU: Number.isFinite(minU) ? minU : 0,
    maxU: Number.isFinite(maxU) ? maxU : 1,
    minV: Number.isFinite(minV) ? minV : 0,
    maxV: Number.isFinite(maxV) ? maxV : 1,
    triangles: projectedTriangles,
  }
}

function sampleTargetSurfaceParameterization(
  parameterization: TargetSurfaceParameterization,
  u: number,
  v: number,
): TargetSurfaceSample {
  const targetU = parameterization.minU + (parameterization.maxU - parameterization.minU) * clampNumber(u, 0, 1)
  const targetV = parameterization.minV + (parameterization.maxV - parameterization.minV) * clampNumber(v, 0, 1)
  let nearestSample: TargetSurfaceSample | null = null
  let nearestDistanceSquared = Number.POSITIVE_INFINITY

  for (const triangle of parameterization.triangles) {
    const barycentric = getProjectedTriangleBarycentric(targetU, targetV, triangle)
    if (barycentric && barycentric.x >= -1e-5 && barycentric.y >= -1e-5 && barycentric.z >= -1e-5) {
      return getProjectedTriangleSample(triangle, barycentric)
    }

    const closest = getClosestProjectedTriangleSample(targetU, targetV, triangle)
    if (closest.distanceSquared < nearestDistanceSquared) {
      nearestDistanceSquared = closest.distanceSquared
      nearestSample = closest.sample
    }
  }

  return nearestSample ?? { position: parameterization.origin.clone(), normal: new THREE.Vector3(0, 1, 0) }
}

function getProjectedTriangleBarycentric(
  u: number,
  v: number,
  triangle: ProjectedTargetTriangle,
): THREE.Vector3 | null {
  const v0x = triangle.bu - triangle.au
  const v0y = triangle.bv - triangle.av
  const v1x = triangle.cu - triangle.au
  const v1y = triangle.cv - triangle.av
  const v2x = u - triangle.au
  const v2y = v - triangle.av
  const denominator = v0x * v1y - v1x * v0y
  if (Math.abs(denominator) <= 1e-10) {
    return null
  }
  const beta = (v2x * v1y - v1x * v2y) / denominator
  const gamma = (v0x * v2y - v2x * v0y) / denominator
  const alpha = 1 - beta - gamma
  return new THREE.Vector3(alpha, beta, gamma)
}

function getProjectedTriangleSample(
  triangle: ProjectedTargetTriangle,
  barycentric: THREE.Vector3,
): TargetSurfaceSample {
  return {
    position: triangle.a
      .clone()
      .multiplyScalar(barycentric.x)
      .addScaledVector(triangle.b, barycentric.y)
      .addScaledVector(triangle.c, barycentric.z),
    normal: triangle.normal.clone(),
  }
}

function getClosestProjectedTriangleSample(
  u: number,
  v: number,
  triangle: ProjectedTargetTriangle,
): { sample: TargetSurfaceSample; distanceSquared: number } {
  const point = new THREE.Vector2(u, v)
  const edges: Array<[[number, number], [number, number], [THREE.Vector3, THREE.Vector3]]> = [
    [[triangle.au, triangle.av], [triangle.bu, triangle.bv], [triangle.a, triangle.b]],
    [[triangle.bu, triangle.bv], [triangle.cu, triangle.cv], [triangle.b, triangle.c]],
    [[triangle.cu, triangle.cv], [triangle.au, triangle.av], [triangle.c, triangle.a]],
  ]
  let bestPosition = triangle.a
  let bestDistanceSquared = Number.POSITIVE_INFINITY

  for (const [[au, av], [bu, bv], [a3, b3]] of edges) {
    const a2 = new THREE.Vector2(au, av)
    const b2 = new THREE.Vector2(bu, bv)
    const edge = b2.clone().sub(a2)
    const lengthSquared = Math.max(edge.lengthSq(), 1e-12)
    const t = clampNumber(point.clone().sub(a2).dot(edge) / lengthSquared, 0, 1)
    const closest2 = a2.lerp(b2, t)
    const distanceSquared = closest2.distanceToSquared(point)
    if (distanceSquared < bestDistanceSquared) {
      bestDistanceSquared = distanceSquared
      bestPosition = a3.clone().lerp(b3, t)
    }
  }

  return {
    sample: { position: bestPosition.clone(), normal: triangle.normal.clone() },
    distanceSquared: bestDistanceSquared,
  }
}

function buildPointCovarianceMatrix(vertices: readonly THREE.Vector3[], origin: THREE.Vector3): number[] {
  const matrix = [0, 0, 0, 0, 0, 0]
  for (const vertex of vertices) {
    const x = vertex.x - origin.x
    const y = vertex.y - origin.y
    const z = vertex.z - origin.z
    matrix[0] += x * x
    matrix[1] += x * y
    matrix[2] += x * z
    matrix[3] += y * y
    matrix[4] += y * z
    matrix[5] += z * z
  }
  return matrix.map((value) => value / Math.max(vertices.length, 1))
}

function getDominantCovarianceAxis(matrix: readonly number[], seed: THREE.Vector3): THREE.Vector3 {
  let axis = seed.clone().normalize()
  for (let index = 0; index < 24; index += 1) {
    const nextAxis = multiplySymmetricMatrixVector(matrix, axis)
    if (nextAxis.lengthSq() <= 1e-14) {
      return axis.lengthSq() > 1e-10 ? axis.normalize() : new THREE.Vector3(1, 0, 0)
    }
    axis = nextAxis.normalize()
  }
  return axis
}

function multiplySymmetricMatrixVector(matrix: readonly number[], vector: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3(
    matrix[0] * vector.x + matrix[1] * vector.y + matrix[2] * vector.z,
    matrix[1] * vector.x + matrix[3] * vector.y + matrix[4] * vector.z,
    matrix[2] * vector.x + matrix[4] * vector.y + matrix[5] * vector.z,
  )
}

function deflateSymmetricMatrix(matrix: readonly number[], axis: THREE.Vector3, eigenvalue: number): number[] {
  return [
    matrix[0] - eigenvalue * axis.x * axis.x,
    matrix[1] - eigenvalue * axis.x * axis.y,
    matrix[2] - eigenvalue * axis.x * axis.z,
    matrix[3] - eigenvalue * axis.y * axis.y,
    matrix[4] - eigenvalue * axis.y * axis.z,
    matrix[5] - eigenvalue * axis.z * axis.z,
  ]
}

function getAnyPerpendicularUnitVector(axis: THREE.Vector3): THREE.Vector3 {
  const reference = Math.abs(axis.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
  return reference.cross(axis).normalize()
}

function projectPointToTargetSurfaceFrame(
  point: THREE.Vector3,
  origin: THREE.Vector3,
  uAxis: THREE.Vector3,
  vAxis: THREE.Vector3,
): THREE.Vector2 {
  const localPoint = point.clone().sub(origin)
  return new THREE.Vector2(localPoint.dot(uAxis), localPoint.dot(vAxis))
}

function applyTargetSurfaceMapping(
  quadMesh: QuadMeshData,
  settings: BatwingTargetSurfaceSettings,
): QuadMeshData {
  if (!targetMappingEnabled || !loadedTargetSurface || loadedTargetSurface.triangles.length === 0) {
    return quadMesh
  }
  loadedTargetSurface.previewMesh.updateMatrixWorld(true)
  const blend = clampNumber(settings.blend, 0, 1)
  const offset = settings.offset
  const sourceBounds = computeQuadMeshBounds(quadMesh)
  const sourceSize = sourceBounds.getSize(new THREE.Vector3())

  const transformedTriangles = getTransformedTargetSurfaceTriangles(settings)
  const parameterization = buildTargetSurfaceParameterization(transformedTriangles)

  const vertices = quadMesh.vertices.map((vertex) => {
    const nx = Math.abs(sourceSize.x) <= SCALE_EPSILON ? 0.5 : clampNumber((vertex.x - sourceBounds.min.x) / sourceSize.x, 0, 1)
    const ny = Math.abs(sourceSize.y) <= SCALE_EPSILON ? 0.5 : clampNumber((vertex.y - sourceBounds.min.y) / sourceSize.y, 0, 1)
    const nz = Math.abs(sourceSize.z) <= SCALE_EPSILON ? 0.5 : clampNumber((vertex.z - sourceBounds.min.z) / sourceSize.z, 0, 1)
    const sample = sampleTargetSurfaceParameterization(parameterization, nx, nz)
    const target = sample.position
    const offsetAlpha = settings.offsetMode === 'one-sided' ? ny : ny - 0.5
    const fieldTarget = target.clone().add(new THREE.Vector3(0, 0, offset * offsetAlpha))
    return vertex.clone().lerp(fieldTarget, blend)
  })

  return {
    vertices,
    quadFaces: quadMesh.quadFaces,
  }
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
  const panelGridLines = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      color: 0xffd47a,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      toneMapped: false,
    }),
  )
  panelGridLines.renderOrder = 7
  panelGridLines.frustumCulled = false
  scene.add(panelGridLines)
  const panelGridMarkers = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      color: 0xd00000,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      toneMapped: false,
    }),
  )
  panelGridMarkers.renderOrder = 8
  panelGridMarkers.frustumCulled = false
  scene.add(panelGridMarkers)

  if (loadedTargetSurface) {
    disposeLoadedTargetSurface(loadedTargetSurface)
  }

  loadedTargetSurface = {
    name: file.name,
    triangles,
    bounds,
    previewMesh,
    panelGridLines,
    panelGridMarkers,
  }
  targetTransformControl.attach(previewMesh)
  targetTransformControl.enabled = true
  targetTransformHelper.visible = true
  targetTransformControl.setMode('translate')
  snapTargetToBatwingBounds()
  syncTargetTransformInputsFromMesh()
  updateTargetSurfaceVisualGuides()
  targetMappingEnabled = false
  geometry.dispose()
  rebuildBatwing()
}

function disposeLoadedTargetSurface(surface: LoadedTargetSurface): void {
  scene.remove(surface.previewMesh)
  surface.previewMesh.geometry.dispose()
  surface.previewMesh.material.dispose()
  scene.remove(surface.panelGridLines)
  surface.panelGridLines.geometry.dispose()
  surface.panelGridLines.material.dispose()
  scene.remove(surface.panelGridMarkers)
  surface.panelGridMarkers.geometry.dispose()
  surface.panelGridMarkers.material.dispose()
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
  updateTargetSurfaceVisualGuides()
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
  updateTargetSurfaceVisualGuides()
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
  if (latticeCornerPointMesh) {
    latticeCornerPointMesh.visible = visible
  }
  if (latticeHighlightPointMesh) {
    latticeHighlightPointMesh.visible = visible
  }
  if (latticeHoverPointMesh) {
    latticeHoverPointMesh.visible = visible && hoveredLatticePointIndex !== null
  }
  if (latticePivotMesh) {
    latticePivotMesh.visible = visible && selectedLatticePointIndices.size > 0
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

  if (
    !latticePointMesh ||
    !latticeCornerPointMesh ||
    !latticeHighlightPointMesh ||
    !latticeHoverPointMesh ||
    !latticePivotMesh ||
    latticePointMesh.count !== latticeState.points.length
  ) {
    disposeLatticePointMesh()
    const pointMaterial = new THREE.MeshBasicMaterial({
      color: LATTICE_COLOR,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.46,
      toneMapped: false,
    })
    const cornerMaterial = new THREE.MeshBasicMaterial({
      color: LATTICE_CORNER_COLOR,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.34,
      toneMapped: false,
    })
    const highlightMaterial = new THREE.MeshBasicMaterial({
      color: LATTICE_SELECTED_COLOR,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.72,
      toneMapped: false,
    })
    const hoverMaterial = new THREE.MeshBasicMaterial({
      color: LATTICE_HOVER_COLOR,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.84,
      toneMapped: false,
    })
    const pivotMaterial = new THREE.MeshBasicMaterial({
      color: LATTICE_PIVOT_COLOR,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.92,
      toneMapped: false,
    })

    latticePointMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 12, 8),
      pointMaterial,
      latticeState.points.length,
    )
    latticeCornerPointMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.82, 0.82, 0.82),
      cornerMaterial,
      latticeState.points.length,
    )
    latticeHighlightPointMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 20, 12),
      highlightMaterial,
      latticeState.points.length,
    )
    latticeHoverPointMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 20, 12),
      hoverMaterial,
      1,
    )
    latticePivotMesh = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), pivotMaterial)
    latticePointMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    latticeCornerPointMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    latticeHighlightPointMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    latticeHoverPointMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    latticePointMesh.frustumCulled = false
    latticeCornerPointMesh.frustumCulled = false
    latticeHighlightPointMesh.frustumCulled = false
    latticeHoverPointMesh.frustumCulled = false
    latticePivotMesh.frustumCulled = false
    latticePointMesh.renderOrder = 7
    latticeCornerPointMesh.renderOrder = 7
    latticeHighlightPointMesh.renderOrder = 8
    latticeHoverPointMesh.renderOrder = 9
    latticePivotMesh.renderOrder = 9
    scene.add(latticePointMesh)
    scene.add(latticeCornerPointMesh)
    scene.add(latticeHighlightPointMesh)
    scene.add(latticeHoverPointMesh)
    scene.add(latticePivotMesh)
  }

  const displayScale = getLatticePointDisplayScale()
  let highlightCount = 0
  let cornerCount = 0
  latticeCornerPointIndices = []
  const hoverPoint = hoveredLatticePointIndex === null ? null : latticeState.points[hoveredLatticePointIndex] ?? null
  for (const point of latticeState.points) {
    const isCornerPoint = isLatticeCornerPoint(point, latticeState)
    latticeMatrixHelper.position.copy(point.position)
    latticeMatrixHelper.rotation.set(0, 0, 0)
    latticeMatrixHelper.scale.setScalar(isCornerPoint ? 0.001 : displayScale)
    latticeMatrixHelper.updateMatrix()
    latticePointMesh.setMatrixAt(point.index, latticeMatrixHelper.matrix)

    if (isCornerPoint) {
      latticeMatrixHelper.scale.setScalar(displayScale * 0.72)
      latticeMatrixHelper.updateMatrix()
      latticeCornerPointMesh.setMatrixAt(cornerCount, latticeMatrixHelper.matrix)
      latticeCornerPointIndices[cornerCount] = point.index
      cornerCount += 1
    }

    if (selectedLatticePointIndices.has(point.index)) {
      latticeMatrixHelper.scale.setScalar(displayScale * 1.25)
      latticeMatrixHelper.updateMatrix()
      latticeHighlightPointMesh.setMatrixAt(highlightCount, latticeMatrixHelper.matrix)
      highlightCount += 1
    }
  }

  if (hoverPoint) {
    latticeMatrixHelper.position.copy(hoverPoint.position)
    latticeMatrixHelper.rotation.set(0, 0, 0)
    latticeMatrixHelper.scale.setScalar(displayScale * 1.14)
    latticeMatrixHelper.updateMatrix()
    latticeHoverPointMesh.setMatrixAt(0, latticeMatrixHelper.matrix)
    latticeHoverPointMesh.count = 1
  } else {
    latticeHoverPointMesh.count = 0
  }

  const pivot = getSelectedLatticeAverage()
  if (pivot) {
    latticePivotMesh.position.copy(pivot)
    latticePivotMesh.rotation.set(0, Math.PI / 4, 0)
    latticePivotMesh.scale.setScalar(displayScale * 1.18)
    latticePivotMesh.visible = isLatticeControlsVisible()
  } else {
    latticePivotMesh.visible = false
  }

  latticeCornerPointMesh.count = cornerCount
  latticeHighlightPointMesh.count = highlightCount
  latticePointMesh.visible = isLatticeControlsVisible()
  latticeCornerPointMesh.visible = isLatticeControlsVisible()
  latticeHighlightPointMesh.visible = isLatticeControlsVisible()
  latticeHoverPointMesh.visible = isLatticeControlsVisible() && hoverPoint !== null
  latticePointMesh.instanceMatrix.needsUpdate = true
  latticeCornerPointMesh.instanceMatrix.needsUpdate = true
  latticeHighlightPointMesh.instanceMatrix.needsUpdate = true
  latticeHoverPointMesh.instanceMatrix.needsUpdate = true
  latticePointMesh.computeBoundingSphere()
  latticePointMesh.computeBoundingBox()
  latticeCornerPointMesh.computeBoundingSphere()
  latticeCornerPointMesh.computeBoundingBox()
  latticeHighlightPointMesh.computeBoundingSphere()
  latticeHighlightPointMesh.computeBoundingBox()
  latticeHoverPointMesh.computeBoundingSphere()
  latticeHoverPointMesh.computeBoundingBox()
}

function isLatticeCornerPoint(point: LatticePoint, state: LatticeState): boolean {
  const maxWidthIndex = getLatticeWidthPointCount(state.settings) - 1
  const maxHeightIndex = getLatticeHeightPointCount(state.settings) - 1
  const maxLengthIndex = getLatticeLengthPointCount(state.settings) - 1
  const atWidthBoundary = point.widthIndex === 0 || point.widthIndex === maxWidthIndex
  const atHeightBoundary = point.heightIndex === 0 || point.heightIndex === maxHeightIndex
  const atLengthBoundary = point.lengthIndex === 0 || point.lengthIndex === maxLengthIndex
  return atWidthBoundary && atHeightBoundary && atLengthBoundary
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

  if (latticeCornerPointMesh) {
    scene.remove(latticeCornerPointMesh)
    latticeCornerPointMesh.geometry.dispose()
    latticeCornerPointMesh.material.dispose()
    latticeCornerPointMesh = null
  }

  if (latticeHighlightPointMesh) {
    scene.remove(latticeHighlightPointMesh)
    latticeHighlightPointMesh.geometry.dispose()
    latticeHighlightPointMesh.material.dispose()
    latticeHighlightPointMesh = null
  }

  if (latticeHoverPointMesh) {
    scene.remove(latticeHoverPointMesh)
    latticeHoverPointMesh.geometry.dispose()
    latticeHoverPointMesh.material.dispose()
    latticeHoverPointMesh = null
  }

  if (latticePivotMesh) {
    scene.remove(latticePivotMesh)
    latticePivotMesh.geometry.dispose()
    latticePivotMesh.material.dispose()
    latticePivotMesh = null
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
    updateSelectionStatusHint()
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
  updateSelectionStatusHint()
}

function selectLatticePoints(indices: readonly number[], mode: LatticeSelectionMode): void {
  if (mode === 'remove') {
    for (const index of indices) {
      selectedLatticePointIndices.delete(index)
    }
    refreshLatticeVisuals()
    updateSelectionStatusHint()
    return
  }

  if (mode === 'replace') {
    selectedLatticePointIndices.clear()
  }

  for (const index of indices) {
    selectedLatticePointIndices.add(index)
  }

  refreshLatticeVisuals()
  updateSelectionStatusHint()
}

function clearLatticeSelection(): void {
  if (selectedLatticePointIndices.size === 0) {
    return
  }

  selectedLatticePointIndices.clear()
  refreshLatticeVisuals()
  updateSelectionStatusHint()
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
  updateLatticeTooltip(hitIndex, event)
  if (hoveredLatticePointIndex === hitIndex) {
    return
  }

  hoveredLatticePointIndex = hitIndex
  refreshLatticePointMesh()
}

function clearLatticeHover(): void {
  latticeTooltip.hidden = true
  canvas.style.cursor = ''
  updateSelectionStatusHint()
  if (hoveredLatticePointIndex === null) {
    return
  }

  hoveredLatticePointIndex = null
  refreshLatticePointMesh()
}

function updateLatticeTooltip(index: number | null, event: PointerEvent): void {
  if (index === null || !latticeState) {
    latticeTooltip.hidden = true
    canvas.style.cursor = ''
    updateSelectionStatusHint()
    return
  }

  const point = latticeState.points[index]
  if (!point) {
    latticeTooltip.hidden = true
    canvas.style.cursor = ''
    updateSelectionStatusHint()
    return
  }

  const role = isLatticeCornerPoint(point, latticeState) ? 'Corner handle' : 'Lattice handle'
  const selection = selectedLatticePointIndices.has(index) ? 'selected' : 'drag target'
  latticeTooltip.textContent = `${role} ${index + 1} · ${selection}`
  latticeTooltip.style.left = `${event.clientX + 14}px`
  latticeTooltip.style.top = `${event.clientY + 14}px`
  latticeTooltip.hidden = false
  canvas.style.cursor = 'pointer'
  setViewportStatus(role, selectedLatticePointIndices.has(index)
    ? 'This handle is selected. Drag an axis gizmo to transform the selected group.'
    : 'Click to select this handle. Shift-click adds to the selection.')
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
  if (latticeCornerPointMesh) {
    const cornerHits = latticeRaycaster.intersectObject(latticeCornerPointMesh, false)
    const cornerHit = cornerHits.find((candidate) => typeof candidate.instanceId === 'number')
    if (cornerHit?.instanceId !== undefined) {
      return latticeCornerPointIndices[cornerHit.instanceId] ?? null
    }
  }

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
  aggregatorSettings: BatwingAggregatorSettings,
  symmetrySettings: BatwingSymmetrySettings,
): QuadMeshData {
  const weldedMesh = buildWeldedArrayQuadMesh(
    geometryType,
    batwingFamily,
    settings,
    arraySettings,
    aggregatorSettings,
    symmetrySettings,
  )
  return weldQuadMeshByPositionPreservingFaceDirections(subdivideCatmullClark(weldedMesh, arraySettings.subdivisions))
}

function buildFinalDisplayQuadMesh(
  mappedQuadMesh: QuadMeshData,
  arraySettings: BatwingArraySettings,
  aggregatorSettings: BatwingAggregatorSettings,
  depthGradientSettings: BatwingDepthGradientSettings,
  offsetMode: BatwingTargetSurfaceSettings['offsetMode'],
): QuadMeshData {
  const depthThicknessScaleMap = buildDepthGradientThicknessScaleMap(mappedQuadMesh, depthGradientSettings)
  const thickenedMesh = createThickenedQuadMesh(
    mappedQuadMesh,
    arraySettings.thickness,
    buildArrayCenterThicknessNormalMap(arraySettings, aggregatorSettings),
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
  aggregatorSettings: BatwingAggregatorSettings,
  symmetrySettings: BatwingSymmetrySettings,
): QuadMeshData {
  return weldQuadMeshByPositionPreservingFaceDirections(
    buildCheckerboardArrayQuadMesh(
      geometryType,
      batwingFamily,
      settings,
      arraySettings,
      aggregatorSettings,
      symmetrySettings,
    ),
  )
}

function buildCheckerboardArrayQuadMesh(
  geometryType: TpmsGeometryType,
  batwingFamily: BatwingFamilyType,
  settings: BatwingSettings,
  arraySettings: BatwingArraySettings,
  aggregatorSettings: BatwingAggregatorSettings,
  symmetrySettings: BatwingSymmetrySettings,
): QuadMeshData {
  const baseMesh = buildTpmsQuadMeshData(settings, geometryType, batwingFamily)
  const vertices: THREE.Vector3[] = []
  const quadFaces: QuadFace[] = []
  const symmetryTransforms = buildSymmetryTransforms(symmetrySettings)

  for (const cell of getAggregateArrayCells(arraySettings, aggregatorSettings)) {
    for (const transform of symmetryTransforms) {
      const transformedVertices = baseMesh.vertices.map((vertex) => applySymmetryTransform(vertex, transform))
      const normalizedVertices = normalizeVerticesToCellBounds(transformedVertices)
      const vertexOffset = vertices.length
      for (const vertex of normalizedVertices) {
        vertices.push(vertex.clone().add(cell.offset))
      }

      const flipWinding = shouldFlipArrayCellWindingForGeometry(
        geometryType,
        cell.lengthIndex,
        cell.widthIndex,
        cell.heightIndex,
      )
      for (const baseFace of baseMesh.quadFaces) {
        quadFaces.push(offsetQuadFace(flipWinding ? reverseQuadFace(baseFace) : baseFace, vertexOffset))
      }
    }
  }

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

function shouldFlipArrayCellWindingForGeometry(
  geometryType: TpmsGeometryType,
  lengthIndex: number,
  widthIndex: number,
  heightIndex: number,
): boolean {
  if (geometryType === 'scherks') {
    return false
  }

  return shouldFlipArrayCellWinding(lengthIndex, widthIndex, heightIndex)
}

function reverseQuadFace([a, b, c, d]: QuadFace): QuadFace {
  return [a, d, c, b]
}

function offsetQuadFace([a, b, c, d]: QuadFace, vertexOffset: number): QuadFace {
  return [vertexOffset + a, vertexOffset + b, vertexOffset + c, vertexOffset + d]
}

function buildArrayCenterThicknessNormalMap(
  arraySettings: BatwingArraySettings,
  aggregatorSettings: BatwingAggregatorSettings,
): Map<string, THREE.Vector3> {
  const centerNormals = new Map<string, THREE.Vector3>()
  for (const cell of getAggregateArrayCells(arraySettings, aggregatorSettings)) {
    const yDirection = shouldFlipArrayCellWinding(cell.lengthIndex, cell.widthIndex, cell.heightIndex) ? -1 : 1
    centerNormals.set(getWeldKey(cell.offset.x, cell.offset.y, cell.offset.z), new THREE.Vector3(0, yDirection, 0))
  }
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
  aggregatorSettings: BatwingAggregatorSettings,
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
    rawVertexCount: getActiveArrayInstanceCount(arraySettings, aggregatorSettings) * 33,
    vertexCount: quadMesh.vertices.length,
    indexCount: indices.length,
    quadCount: quadMesh.quadFaces.length,
    instanceCount: getActiveArrayInstanceCount(arraySettings, aggregatorSettings),
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

function buildArrayBoxGuideGeometry(
  arraySettings: BatwingArraySettings,
  aggregatorSettings: BatwingAggregatorSettings,
): THREE.BufferGeometry {
  const baseGeometry = createBatwingBoxGuideGeometry()
  const geometry = buildArrayLineGeometry(baseGeometry, arraySettings, aggregatorSettings)
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

function getCurrentViewportDisplayMode(): ViewportDisplayMode {
  if (
    viewportModeSelect.value === 'solid' ||
    viewportModeSelect.value === 'wire' ||
    viewportModeSelect.value === 'uv-map'
  ) {
    return viewportModeSelect.value
  }
  return 'gloss'
}

function applyViewportDisplayMode(mode: ViewportDisplayMode, updateControls = true): void {
  viewportModeSelect.value = mode
  batwingMesh.visible = mode !== 'wire'
  batwingMesh.material.transparent = false
  batwingMesh.material.opacity = 1

  if (mode === 'gloss') {
    if (updateControls) {
      reflectionToggle.checked = true
    }
    applyMaterialStyle(FOIL_MATERIAL_STYLE)
    wireOverlay.visible = wireToggle.checked
    seamDebugPoints.visible = seamDebugToggle.checked
  } else if (mode === 'solid') {
    if (updateControls) {
      reflectionToggle.checked = false
      wireToggle.checked = true
    }
    applyMaterialStyle(MATTE_MATERIAL_STYLE)
    wireOverlay.visible = true
    seamDebugPoints.visible = seamDebugToggle.checked
  } else if (mode === 'wire') {
    if (updateControls) {
      reflectionToggle.checked = false
      wireToggle.checked = true
    }
    applyMaterialStyle(MATTE_MATERIAL_STYLE)
    wireOverlay.visible = true
    seamDebugPoints.visible = seamDebugToggle.checked
  } else {
    if (updateControls) {
      reflectionToggle.checked = false
      wireToggle.checked = true
      seamDebugToggle.checked = true
    }
    applyMaterialStyle(MATTE_MATERIAL_STYLE)
    batwingMesh.material.color.set(0xbdd7ff)
    wireOverlay.visible = true
    seamDebugPoints.visible = true
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
  if (getCurrentViewportDisplayMode() === 'uv-map') {
    batwingMesh.material.color.set(0xbdd7ff)
  }
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

function updatePanelTabs(): void {
  const tabButtons = app.querySelectorAll<HTMLButtonElement>('[data-panel-tab-button]')
  const tabSections = app.querySelectorAll<HTMLElement>('[data-panel-tab]')

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const activeTab = button.dataset.panelTabButton
      if (!activeTab) {
        return
      }

      tabButtons.forEach((tabButton) => {
        const isActive = tabButton === button
        tabButton.classList.toggle('is-active', isActive)
        tabButton.setAttribute('aria-pressed', isActive ? 'true' : 'false')
      })

      tabSections.forEach((section) => {
        section.hidden = section.dataset.panelTab !== activeTab
      })
    })
  })
}

function setViewportStatus(label: string, message: string): void {
  viewportStatus.dataset.statusLabel = label
  const labelElement = viewportStatus.querySelector<HTMLElement>('.viewport-status-label')
  if (labelElement) {
    labelElement.textContent = label
  }
  viewportStatusMessage.textContent = message
}

function resetViewportStatus(): void {
  setViewportStatus('Orbit', DEFAULT_STATUS_MESSAGE)
}

function updateSelectionStatusHint(): void {
  const count = selectedLatticePointIndices.size
  if (count > 0) {
    setViewportStatus('Selection', `${count} lattice handle${count === 1 ? '' : 's'} selected. Drag an axis gizmo to move, rotate, or scale.`)
    return
  }
  resetViewportStatus()
}

function getControlStatusHint(target: EventTarget | null): { label: string; message: string } | null {
  if (!(target instanceof HTMLElement)) {
    return null
  }

  const section = target.closest<HTMLElement>('.panel-section')
  const sectionLabel = section?.querySelector<HTMLElement>('.panel-section-label')?.textContent?.trim() ?? 'Control'
  const control = target.closest<HTMLElement>('.control, .toggle-control, .panel-tab-button, .pill-button')
  const controlText = control?.textContent?.replace(/\s+/g, ' ').trim()

  if (target instanceof HTMLInputElement && target.type === 'range') {
    return { label: sectionLabel, message: `Drag ${controlText ?? 'this slider'} to update the surface preview.` }
  }

  if (target instanceof HTMLInputElement && target.type === 'number') {
    return { label: sectionLabel, message: `Type a value for ${controlText ?? 'this setting'}, then press Enter to apply.` }
  }

  if (target instanceof HTMLSelectElement) {
    return { label: sectionLabel, message: `Choose a ${controlText ?? 'mode'} preset from the menu.` }
  }

  if (target instanceof HTMLInputElement && target.type === 'checkbox') {
    return { label: sectionLabel, message: `Toggle ${controlText ?? 'this layer'} in the viewport.` }
  }

  if (target instanceof HTMLButtonElement) {
    return { label: sectionLabel, message: controlText ? `${controlText}.` : 'Run this command.' }
  }

  if (controlText) {
    return { label: sectionLabel, message: controlText }
  }

  return null
}

function updateControlStatusHint(target: EventTarget | null): void {
  const hint = getControlStatusHint(target)
  if (!hint) {
    return
  }
  setViewportStatus(hint.label, hint.message)
}

function enableContextualStatusHints(): void {
  uiPanel.addEventListener('focusin', (event) => {
    updateControlStatusHint(event.target)
  })
  uiPanel.addEventListener('focusout', () => {
    updateSelectionStatusHint()
  })
  uiPanel.addEventListener('pointerover', (event) => {
    updateControlStatusHint(event.target)
  })
  uiPanel.addEventListener('pointerout', (event) => {
    if (!(event.relatedTarget instanceof Node) || !uiPanel.contains(event.relatedTarget)) {
      updateSelectionStatusHint()
    }
  })
}

function setButtonLoading(button: HTMLButtonElement, loading: boolean): void {
  button.classList.toggle('is-loading', loading)
  button.disabled = loading
  button.setAttribute('aria-busy', loading ? 'true' : 'false')
}

function runWithButtonLoading(button: HTMLButtonElement, action: () => void | Promise<void>): void {
  setButtonLoading(button, true)
  void Promise.resolve()
    .then(action)
    .finally(() => {
      window.setTimeout(() => {
        setButtonLoading(button, false)
      }, 180)
    })
}

function setActiveTargetTransformButton(activeButton: HTMLButtonElement): void {
  for (const button of [targetMoveModeButton, targetRotateModeButton, targetScaleModeButton]) {
    const isActive = button === activeButton
    button.classList.toggle('is-active', isActive)
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false')
  }
}

function updateTargetTransformButtonAvailability(): void {
  const enabled = loadedTargetSurface !== null
  for (const button of [targetMoveModeButton, targetRotateModeButton, targetScaleModeButton]) {
    button.disabled = !enabled
    button.classList.toggle('is-disabled', !enabled)
  }

  if (!enabled) {
    for (const button of [targetMoveModeButton, targetRotateModeButton, targetScaleModeButton]) {
      button.classList.remove('is-active')
      button.setAttribute('aria-pressed', 'false')
    }
  }
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
    disposeLoadedTargetSurface(loadedTargetSurface)
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

for (const binding of aggregatorSliderBindings) {
  bindAggregatorSlider(binding)
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
viewportModeSelect.value = DEFAULT_VIEWPORT_DISPLAY_MODE
aggregatorToggle.checked = DEFAULT_AGGREGATOR_SETTINGS.enabled
growthModeSelect.value = DEFAULT_AGGREGATOR_SETTINGS.growthMode
adjacencyRuleSelect.value = DEFAULT_AGGREGATOR_SETTINGS.adjacencyRule
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
aggregatorToggle.addEventListener('change', () => {
  const previousState = captureAppState()
  previousState.aggregatorSettings.enabled = !aggregatorToggle.checked
  ensureAggregateFieldCapacity()
  rebuildBatwing()
  commitHistoryCheckpoint(previousState)
})
growthModeSelect.addEventListener('pointerdown', () => {
  growthModeBeforeEdit = getCurrentAggregatorGrowthMode()
})
growthModeSelect.addEventListener('focus', () => {
  growthModeBeforeEdit = getCurrentAggregatorGrowthMode()
})
growthModeSelect.addEventListener('change', () => {
  const previousGrowthMode = growthModeBeforeEdit ?? DEFAULT_AGGREGATOR_SETTINGS.growthMode
  const previousState = captureAppState()
  previousState.aggregatorSettings.growthMode = previousGrowthMode
  rebuildBatwing()
  commitHistoryCheckpoint(previousState)
  growthModeBeforeEdit = null
})
adjacencyRuleSelect.addEventListener('pointerdown', () => {
  adjacencyRuleBeforeEdit = getCurrentAggregatorAdjacencyRule()
})
adjacencyRuleSelect.addEventListener('focus', () => {
  adjacencyRuleBeforeEdit = getCurrentAggregatorAdjacencyRule()
})
adjacencyRuleSelect.addEventListener('change', () => {
  const previousAdjacencyRule = adjacencyRuleBeforeEdit ?? DEFAULT_AGGREGATOR_SETTINGS.adjacencyRule
  const previousState = captureAppState()
  previousState.aggregatorSettings.adjacencyRule = previousAdjacencyRule
  ensureAggregateFieldCapacity()
  rebuildBatwing()
  commitHistoryCheckpoint(previousState)
  adjacencyRuleBeforeEdit = null
})
populateAggregateButton.addEventListener('click', () => {
  const previousState = captureAppState()
  const seedBinding = aggregatorSliderBindings.find((binding) => binding.key === 'seed')
  if (!seedBinding) {
    return
  }
  const currentSeed = readAggregatorSliderNumber(seedBinding)
  const nextSeed = currentSeed >= MAX_AGGREGATE_SEED ? 1 : currentSeed + 1
  aggregatorToggle.checked = true
  seedBinding.slider.value = `${nextSeed}`
  seedBinding.valueInput.value = formatAggregatorSliderValue(seedBinding, nextSeed)
  updateRangeProgress(seedBinding.slider)
  ensureAggregateFieldCapacity()
  rebuildBatwing()
  commitHistoryCheckpoint(previousState)
})
loadTargetSurfaceButton.addEventListener('click', () => {
  runWithButtonLoading(loadTargetSurfaceButton, async () => {
    await loadTargetSurfaceFromInput()
    updateTargetTransformButtonAvailability()
  })
})
clearTargetSurfaceButton.addEventListener('click', () => {
  if (loadedTargetSurface) {
    disposeLoadedTargetSurface(loadedTargetSurface)
  }
  loadedTargetSurface = null
  targetMappingEnabled = false
  targetTransformControl.detach()
  targetTransformControl.enabled = false
  targetTransformHelper.visible = false
  targetSurfaceFileInput.value = ''
  syncTargetTransformInputsFromMesh()
  updateTargetTransformButtonAvailability()
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
applySurfaceFieldButton.addEventListener('click', () => {
  const previousState = captureAppState()
  applySurfaceFieldSettings()
  commitHistoryCheckpoint(previousState)
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
  setActiveTargetTransformButton(targetMoveModeButton)
})
targetRotateModeButton.addEventListener('click', () => {
  if (!loadedTargetSurface) {
    return
  }
  targetTransformControl.setMode('rotate')
  setActiveTargetTransformButton(targetRotateModeButton)
})
targetScaleModeButton.addEventListener('click', () => {
  if (!loadedTargetSurface) {
    return
  }
  targetTransformControl.setMode('scale')
  setActiveTargetTransformButton(targetScaleModeButton)
})
targetOffsetModeSelect.addEventListener('change', () => {
  const previousState = captureAppState()
  previousState.targetSurfaceSettings.offsetMode =
    targetOffsetModeSelect.value === 'one-sided' ? 'two-sided' : 'one-sided'
  updateTargetSurfaceVisualGuides()
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
  applyViewportDisplayMode(getCurrentViewportDisplayMode(), false)
  commitHistoryCheckpoint(previousState)
})

reflectionToggle.addEventListener('change', () => {
  const previousState = captureAppState()
  previousState.reflectionsEnabled = !reflectionToggle.checked
  applyViewportDisplayMode(reflectionToggle.checked ? 'gloss' : 'solid')
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
  applyViewportDisplayMode(getCurrentViewportDisplayMode(), false)
  commitHistoryCheckpoint(previousState)
})

viewportModeSelect.addEventListener('pointerdown', () => {
  viewportDisplayModeBeforeEdit = getCurrentViewportDisplayMode()
})
viewportModeSelect.addEventListener('focus', () => {
  viewportDisplayModeBeforeEdit = getCurrentViewportDisplayMode()
})
viewportModeSelect.addEventListener('change', () => {
  const previousMode = viewportDisplayModeBeforeEdit ?? DEFAULT_VIEWPORT_DISPLAY_MODE
  const previousState = captureAppState()
  previousState.viewportDisplayMode = previousMode
  applyViewportDisplayMode(getCurrentViewportDisplayMode())
  commitHistoryCheckpoint(previousState)
  viewportDisplayModeBeforeEdit = null
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

exportObjButton.addEventListener('click', () => {
  runWithButtonLoading(exportObjButton, exportObj)
})
exportGlbButton.addEventListener('click', () => {
  runWithButtonLoading(exportGlbButton, exportGlb)
})
exportScreenshotButton.addEventListener('click', () => {
  runWithButtonLoading(exportScreenshotButton, exportScreenshot)
})

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
  uiPanel.classList.add('is-dragging')
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
  uiPanel.classList.remove('is-dragging')
  uiHandleTop.releasePointerCapture(event.pointerId)
})

uiHandleTop.addEventListener('pointercancel', (event) => {
  panelDragging = false
  uiPanel.classList.remove('is-dragging')
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
updatePanelTabs()
enableContextualStatusHints()
enablePerSectionScrolling()
updateTargetTransformButtonAvailability()
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
