import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

/*
 * Renders a realistic studio still of the car in a given paint, once.
 * Model: "Car Concept" by Eric Chadwick, Khronos glTF Sample Assets, CC BY 4.0
 * (credited in Settings). Callers cache the PNG, so this runs once per colour.
 */

const MODEL_URL = '/models/car-concept.glb'
const W = 960
const H = 540

let modelPromise: Promise<THREE.Group> | null = null
const loadModel = () => (modelPromise ??= new GLTFLoader().loadAsync(MODEL_URL).then(g => g.scene))

let studio: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera } | null = null

function makeStudio(size: THREE.Vector3) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(1)
  renderer.setSize(W, H, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.VSMShadowMap

  const scene = new THREE.Scene()
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.45))
  const d = Math.max(size.x, size.z)
  const key = new THREE.DirectionalLight(0xffffff, 1.7)
  key.position.set(d * 0.6, d * 1.6, d * 0.9)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.radius = 10
  key.shadow.camera.near = 0.1
  key.shadow.camera.far = d * 5
  Object.assign(key.shadow.camera, { left: -d, right: d, top: d, bottom: -d })
  scene.add(key)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(d * 4, d * 4), new THREE.ShadowMaterial({ opacity: 0.42 }))
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  // front three-quarter, slightly above, like a showroom photo
  const camera = new THREE.PerspectiveCamera(22, W / H, 0.05, 100)
  camera.position.set(-d * 1.1, size.y * 0.9 + d * 0.2, d * 1.2)
  camera.lookAt(0, size.y * 0.36, 0)
  return { renderer, scene, camera }
}

/** Crop to the car and its shadow, with a small margin, so every layout can size it freely. */
function cropToContent(src: HTMLCanvasElement) {
  const c = document.createElement('canvas')
  c.width = src.width
  c.height = src.height
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(src, 0, 0)
  const { data } = ctx.getImageData(0, 0, c.width, c.height)
  let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (data[(y * c.width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  if (x1 <= x0) return src.toDataURL('image/png')
  const m = 6
  x0 = Math.max(0, x0 - m)
  y0 = Math.max(0, y0 - m)
  x1 = Math.min(c.width - 1, x1 + m)
  y1 = Math.min(c.height - 1, y1 + m)
  const out = document.createElement('canvas')
  out.width = x1 - x0 + 1
  out.height = y1 - y0 + 1
  out.getContext('2d')!.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height)
  return out.toDataURL('image/png')
}

let queue: Promise<unknown> = Promise.resolve()

/** A transparent PNG (data URL) of the car painted `paint`. One render at a time. */
export function renderCar(paint: string): Promise<string> {
  const job = queue.then(async () => {
    const car = (await loadModel()).clone(true)
    const color = new THREE.Color(paint)
    car.traverse(o => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.castShadow = true
      const repaint = (mat: THREE.Material) => {
        if (!/^Paint/i.test(mat.name)) return mat
        const p = (mat as THREE.MeshPhysicalMaterial).clone()
        p.color = color.clone()
        p.map = null // the stock paint colour lives in a texture; use ours instead
        p.needsUpdate = true
        return p
      }
      m.material = Array.isArray(m.material) ? m.material.map(repaint) : repaint(m.material)
    })
    const box = new THREE.Box3().setFromObject(car)
    const c = box.getCenter(new THREE.Vector3())
    car.position.set(-c.x, -box.min.y, -c.z)
    studio ??= makeStudio(box.getSize(new THREE.Vector3()))
    studio.scene.add(car)
    studio.renderer.render(studio.scene, studio.camera)
    const url = cropToContent(studio.renderer.domElement)
    studio.scene.remove(car)
    return url
  })
  queue = job.catch(() => {})
  return job
}
