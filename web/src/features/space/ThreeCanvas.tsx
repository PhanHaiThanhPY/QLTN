import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Asset, FloorKey, ViewMode, ZoneLayout } from './types';
import { BLOCK_POSITIONS, BLOCK_FLOORS, BLOCK_TINTS } from './constants';
import { REPAIR_STAGES } from './constants';

interface Props {
  block: string;
  floor: FloorKey;
  view: ViewMode;
  assets: Asset[];
  zones: ZoneLayout[];
  onPickBlock: (id: string) => void;
  onPickAsset: (id: string) => void;
  onPickZone: (name: string) => void;
}

interface LabelInfo {
  element: HTMLButtonElement;
  position: THREE.Vector3;
  id: string;
  kind: 'block' | 'room' | 'asset';
}

export function ThreeCanvas({ block, floor, view, assets, zones, onPickBlock, onPickAsset, onPickZone }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    campusObjects: THREE.Object3D[];
    blockGroups: THREE.Group[];
    floorGroup: THREE.Group | null;
    campusLabels: LabelInfo[];
    floorLabels: LabelInfo[];
    activeLabels: LabelInfo[];
    theta: number;
    phi: number;
    radius: number;
    target: THREE.Vector3;
    desired: THREE.Vector3;
    animFrame: number;
  } | null>(null);

  const propsRef = useRef({ block, floor, view, assets, zones, onPickBlock, onPickAsset, onPickZone });
  propsRef.current = { block, floor, view, assets, zones, onPickBlock, onPickAsset, onPickZone };

  useEffect(() => {
    if (!hostRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const host = hostRef.current!;

    // ── Materials ──────────────────────────────────────────────
    const mat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });

    const mats = {
      stone: mat('#ddd7cb'),
      white: mat('#ecebe3'),
      dark: mat('#334e56'),
      glass: mat('#597f8c', { roughness: 0.2, metalness: 0.5 }),
      road: mat('#7f8988'),
      lawn: mat('#7c9e68'),
      walk: mat('#d9d4c4'),
      wood: mat('#9f8460'),
      water: mat('#55b6c9', { roughness: 0.18, metalness: 0.2 }),
      leaf: mat('#527d4c'),
      bark: mat('#7d6650'),
    };

    const cube = new THREE.BoxGeometry(1, 1, 1);

    function box(
      parent: THREE.Object3D,
      w: number, h: number, d: number,
      x: number, y: number, z: number,
      m: THREE.Material = mats.white,
    ) {
      const mesh = new THREE.Mesh(cube, m);
      mesh.scale.set(w, h, d);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    }

    // ── Scene ──────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, window.innerWidth < 720 ? 1.3 : 1.7));
    renderer.shadowMap.enabled = window.innerWidth >= 720;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.domElement.className = 'absolute inset-0 w-full h-full touch-none';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e9eee7');
    scene.fog = new THREE.Fog('#e9eee7', 160, 280);

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 350);

    scene.add(new THREE.HemisphereLight('#edf8ff', '#aaa28c', 2.4));
    const sun = new THREE.DirectionalLight('#fff2d7', 3);
    sun.position.set(-50, 90, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 190 });
    sun.shadow.bias = -0.0008;
    scene.add(sun);

    // Ground
    box(scene, 110, 0.6, 92, 0, -0.4, 0, mats.walk);
    box(scene, 105, 0.15, 86, 0, 0, 0, mats.road);
    box(scene, 91, 0.22, 71, 0, 0.15, 0, mats.walk);
    box(scene, 85, 0.2, 65, 0, 0.3, 0, mats.lawn);

    // Road markings
    for (let x = -47; x <= 47; x += 6) {
      box(scene, 2, 0.03, 0.15, x, 0.12, 39, mats.white);
      box(scene, 2, 0.03, 0.15, x, 0.12, -39, mats.white);
    }
    for (let z = -34; z <= 34; z += 6) {
      box(scene, 0.15, 0.03, 2, -49, 0.12, z, mats.white);
      box(scene, 0.15, 0.03, 2, 49, 0.12, z, mats.white);
    }

    // ── Tower builder ──────────────────────────────────────────
    const blockGroups: THREE.Group[] = [];
    const campusLabels: LabelInfo[] = [];

    function tree(x: number, z: number, scale = 1) {
      const g = new THREE.Group();
      g.position.set(x, 0.2, z);
      g.scale.setScalar(scale);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, 3, 6), mats.bark);
      trunk.position.y = 1.5;
      g.add(trunk);
      for (let i = 0; i < 3; i++) {
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), mats.leaf);
        crown.position.set((i - 1) * 0.7, 3.3 + i * 0.45, (i % 2) * 0.4);
        crown.scale.y = 1.3;
        crown.castShadow = true;
        g.add(crown);
      }
      scene.add(g);
    }

    function tower(id: string, x: number, z: number, floors: number, tint: string) {
      const g = new THREE.Group();
      g.userData.block = id;
      g.position.set(x, 0, z);
      scene.add(g);
      blockGroups.push(g);

      const accent = mat(tint);
      box(g, 21, 3.6, 16, 0, 2, 0, mats.stone);
      box(g, 17, 2.5, 0.2, 0, 2, 8.15, mats.glass);
      box(g, 6, 0.3, 4, 0, 3.7, 9, mats.white);
      box(g, 1, 3.5, 1, -4, 1.8, 10, mats.dark);
      box(g, 1, 3.5, 1, 4, 1.8, 10, mats.dark);

      const h = floors * 2.4;
      box(g, 15, h, 11, 0, 4 + h / 2, 0, accent);

      const windows = new THREE.InstancedMesh(cube, mats.glass, floors * 20);
      const matrix = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      let n = 0;
      for (let f = 0; f < floors; f++) {
        const y = 5.15 + f * 2.4;
        box(g, 16, 0.18, 12, 0, y - 1, 0, mats.white);
        for (const front of [-1, 1]) {
          for (let j = 0; j < 6; j++) {
            matrix.compose(new THREE.Vector3(-6.2 + j * 2.5, y, front * 5.56), q, new THREE.Vector3(1.65, 1.65, 0.08));
            windows.setMatrixAt(n++, matrix);
          }
        }
        for (const side of [-1, 1]) {
          for (let j = 0; j < 4; j++) {
            matrix.compose(new THREE.Vector3(side * 7.56, y, -4 + j * 2.6), q, new THREE.Vector3(0.08, 1.6, 1.6));
            windows.setMatrixAt(n++, matrix);
          }
        }
        for (const j of [-1, 1]) {
          box(g, 3.4, 0.18, 1.8, j * 4.5, y - 0.9, 6.1, mats.white);
          box(g, 3.4, 0.65, 0.1, j * 4.5, y - 0.5, 6.95, mats.glass);
          box(g, 0.14, 0.65, 1.7, j * 4.5 - 1.65, y - 0.5, 6.1, mats.dark);
          box(g, 0.14, 0.65, 1.7, j * 4.5 + 1.65, y - 0.5, 6.1, mats.dark);
        }
      }
      g.add(windows);
      box(g, 16, 0.6, 12, 0, 4 + h, 0, mats.white);
      box(g, 6, 2, 5, 0, 5.2 + h, 0, mats.stone);
      for (let i = 0; i < 3; i++) box(g, 3, 0.4, 2, -4 + i * 4, 4.6 + h, -3, mats.dark);

      const indicator = new THREE.Mesh(
        new THREE.BoxGeometry(16.5, 0.15, 12.5),
        new THREE.MeshBasicMaterial({ color: '#27c79b', transparent: true, opacity: 0 }),
      );
      indicator.position.y = 4.4 + h;
      g.add(indicator);
      g.userData.indicator = indicator;
      g.userData.height = h + 7;

      const btn = document.createElement('button');
      btn.className = 'absolute -translate-x-1/2 -translate-y-1/2 px-2 py-1 rounded-lg border border-[#cbdacf] bg-white/90 text-[#37594e] shadow-sm text-xs font-medium z-10 hover:bg-[#0a8e73] hover:text-white hover:border-[#0a8e73] transition-colors';
      btn.textContent = 'Block ' + id;
      btn.onclick = () => propsRef.current.onPickBlock(id);
      campusLabels.push({ element: btn, position: new THREE.Vector3(x, h + 10, z), id, kind: 'block' });

      return g;
    }

    tower('A', ...BLOCK_POSITIONS.A, BLOCK_FLOORS.A, BLOCK_TINTS.A);
    tower('B', ...BLOCK_POSITIONS.B, BLOCK_FLOORS.B, BLOCK_TINTS.B);
    tower('C', ...BLOCK_POSITIONS.C, BLOCK_FLOORS.C, BLOCK_TINTS.C);
    tower('D', ...BLOCK_POSITIONS.D, BLOCK_FLOORS.D, BLOCK_TINTS.D);

    // Pool
    box(scene, 17, 0.25, 19, 0, 0.45, -13, mats.walk);
    box(scene, 12, 0.3, 14, 0, 0.62, -13, mats.water);
    for (let i = 0; i < 6; i++) box(scene, 0.05, 0.04, 13, -5 + i * 2, 0.8, -13, mat('#80c9d6'));
    for (let i = 0; i < 4; i++) box(scene, 1.5, 0.35, 3, 9, 0.7, -19 + i * 4, mats.white);

    // Garden / community
    box(scene, 15, 0.05, 18, 0, 0.52, 10, mats.walk);
    box(scene, 10, 0.05, 12, 0, 0.56, 10, mats.lawn);
    box(scene, 13, 3, 7, 0, 1.7, 29, mats.wood);
    box(scene, 15, 0.4, 9, 0, 3.4, 29, mats.dark);
    box(scene, 11, 2, 0.1, 0, 1.8, 32.6, mats.glass);

    // Trees
    for (let i = 0; i < 10; i++) { tree(-44 + i * 9.5, -33, 0.8); tree(-44 + i * 9.5, 34, 0.8); }
    for (let i = 0; i < 7; i++) { tree(-43, -26 + i * 9, 0.7); tree(43, -26 + i * 9, 0.7); }
    tree(-7, 9, 0.8); tree(6, 7, 0.8); tree(0, 16, 0.7);

    // Paths + benches + lamps + cars
    box(scene, 4, 0.06, 65, 0, 0.45, 0, mats.walk);
    for (const z of [-3, 4, 19]) {
      box(scene, 3, 0.5, 0.8, -10, 0.8, z, mats.wood);
      box(scene, 3, 0.6, 0.15, -10, 1.1, z - 0.4, mats.wood);
    }
    for (const lx of [-40, 40]) {
      for (const lz of [-24, 0, 24]) {
        box(scene, 0.18, 3.2, 0.18, lx, 1.7, lz, mats.dark);
        box(scene, 1.2, 0.18, 0.6, lx, 3.3, lz, mats.white);
      }
    }
    for (let i = 0; i < 7; i++) {
      const cx = -34 + i * 10;
      box(scene, 3, 1.1, 1.7, cx, 0.7, 40, mat(['#f1eee4', '#415967', '#8b5249'][i % 3]));
      box(scene, 1.6, 0.55, 1.5, cx, 1.4, 40, mats.glass);
    }
    box(scene, 7, 2.6, 5, -40, 1.45, 35, mats.white);
    box(scene, 3.2, 1.4, 0.1, -40, 1.7, 37.6, mats.glass);

    const campusObjects = scene.children.filter(o => !(o instanceof THREE.Light));

    // ── Floor builder ──────────────────────────────────────────
    let floorGroup: THREE.Group | null = null;
    let floorLabels: LabelInfo[] = [];
    let floorKey = '';

    function makeFloorLabel(
      text: string,
      x: number,
      z: number,
      action: () => void,
      color?: string,
    ): LabelInfo {
      const e = document.createElement('button');
      e.className = 'absolute -translate-x-1/2 -translate-y-1/2 px-2 py-1 rounded-lg border text-xs z-10 transition-colors';
      if (color) {
        e.style.setProperty('--asset-color', color);
        e.className += ' bg-white/93 border-[#dae5de] font-semibold text-[#35594f] hover:border-[--asset-color]';
        const dot = document.createElement('span');
        dot.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:5px`;
        e.prepend(dot);
        e.append(text.replace(/ · .*/, '').replace(/-0(\d)/g, '-$1'));
      } else {
        e.textContent = text;
        e.className += ' bg-white/90 border-[#cbdacf] text-[#37594e] hover:bg-[#0a8e73] hover:text-white hover:border-[#0a8e73]';
      }
      e.onclick = action;
      return { element: e, position: new THREE.Vector3(x, 3.4, z), id: '', kind: color ? 'asset' : 'room' };
    }

    function buildFloor(floorId: FloorKey, _blockId: string, currentAssets: Asset[], currentZones: ZoneLayout[]) {
      if (floorGroup) {
        scene.remove(floorGroup);
        floorGroup.traverse(o => {
          if (o instanceof THREE.Mesh && o.geometry !== cube) o.geometry.dispose();
        });
      }
      for (const l of floorLabels) l.element.remove();
      floorGroup = new THREE.Group();
      scene.add(floorGroup);
      floorLabels = [];

      const wall = mat('#eeeae0');
      const wood = mat('#c5ad8a');
      const soft = mat('#9aae9f');

      box(floorGroup, 49, 0.5, 33, 0, -0.3, 0, mats.stone);
      box(floorGroup, 48, 0.1, 8, 0, 0.02, 0, mats.white);

      function roomShell(r: ZoneLayout) {
        const g = new THREE.Group();
        g.userData.zone = r.name;
        floorGroup!.add(g);
        const side = Math.sign(r.z);
        box(g, r.w - 0.25, 0.12, 12, r.x, 0.1, r.z, floorId === '5' ? wood : mats.walk);
        box(g, 0.2, 2.6, 12, r.x - r.w / 2, 1.4, r.z, wall);
        box(g, r.w, 2.6, 0.2, r.x, 1.4, side * 16, wall);
        if (floorId !== 'R') {
          box(g, r.w / 2 - 1, 2.6, 0.2, r.x - r.w / 4 - 0.5, 1.4, side * 4, wall);
          box(g, r.w / 2 - 1, 2.6, 0.2, r.x + r.w / 4 + 0.5, 1.4, side * 4, wall);
          box(g, 1.5, 2.1, 0.12, r.x, 1.1, side * 4, mats.wood);
        }
        const lbl = makeFloorLabel(r.name, r.x, side * 10, () => propsRef.current.onPickZone(r.name));
        floorLabels.push(lbl);
        return g;
      }

      for (const r of currentZones) {
        const g = roomShell(r);
        const side = Math.sign(r.z);

        if (floorId === '5') {
          box(g, r.w - 3, 1.4, 0.22, r.x, 1.7, side * 16, mats.glass);
          const studio = r.name.includes('Studio');
          const beds = r.name.includes('3PN') ? 3 : r.name.includes('2PN') ? 2 : 1;
          const bedroomWidth = (r.w - 1) / beds;
          for (let k = 0; k < beds; k++) {
            const bx = r.x - r.w / 2 + bedroomWidth * (k + 0.5) + 0.5;
            if (k > 0 && !studio) box(g, 0.12, 2.3, 4.5, r.x - r.w / 2 + k * bedroomWidth + 0.5, 1.25, side * 13.5, wall);
            box(g, Math.min(2.8, bedroomWidth - 0.6), 0.5, 3.4, bx, 0.4, side * 13.5, mats.wood);
            box(g, Math.min(2.7, bedroomWidth - 0.7), 0.25, 3.3, bx, 0.8, side * 13.5, mats.white);
            box(g, 1.8, 0.2, 0.6, bx, 1, side * 14.6, soft);
          }
          if (!studio) {
            box(g, r.w - 2.6, 2.3, 0.12, r.x - 0.6, 1.25, side * 11, wall);
            box(g, 0.12, 2.3, 3.2, r.x + r.w / 2 - 3, 1.25, side * 5.7, wall);
            box(g, 2.5, 2.3, 0.12, r.x + r.w / 2 - 1.5, 1.25, side * 7.3, wall);
            box(g, 1, 0.4, 1.5, r.x + r.w / 2 - 1.5, 0.35, side * 5.7, mats.white);
          }
          box(g, 3.2, 0.7, 1.3, r.x - r.w / 2 + 2.2, 0.5, side * 8.6, soft);
          box(g, 3.2, 0.6, 0.25, r.x - r.w / 2 + 2.2, 0.95, side * 9.2, soft);
          box(g, 2, 0.35, 1.1, r.x - r.w / 2 + 2.2, 0.3, side * 6.8, mats.wood);
          box(g, 3, 0.85, 0.9, r.x + 1, 0.55, side * 4.8, mats.white);
          box(g, 3, 0.1, 1, r.x + 1, 1, side * 4.8, mats.stone);
          box(g, r.w - 1, 0.1, 1.2, r.x, 0.2, side * 16.7, mats.walk);
          box(g, r.w - 1, 0.8, 0.1, r.x, 0.65, side * 17.3, mats.glass);
        } else if (floorId === 'B1') {
          if (r.index === 4 || r.index === 5) {
            for (let k = 0; k < 3; k++) {
              box(g, 2.2, 0.9, 4, r.x - 3 + k * 3, 0.6, r.z, mats.glass);
              box(g, 1.5, 0.5, 2, r.x - 3 + k * 3, 1.2, r.z, mats.dark);
              box(g, 0.08, 0.03, 5, r.x - 3 + k * 3 - 1.3, 0.2, r.z, mats.white);
            }
          } else if (r.index === 7) {
            const ramp = box(g, 7, 0.2, 10, r.x, 0.8, r.z, mats.road);
            ramp.rotation.x = 0.13;
          } else {
            box(g, 5, 1.6, 4, r.x, 1, r.z, r.index === 0 ? mats.water : mats.dark);
            box(g, 3, 0.3, 2, r.x, 2, r.z, mats.stone);
          }
        } else if (floorId === 'R') {
          if (r.index < 4) {
            box(g, 5, r.index === 0 ? 2.5 : 1.5, 4, r.x, 1.2, r.z, r.index === 0 ? mats.glass : mats.dark);
            box(g, 5.5, 0.2, 4.5, r.x, 2.6, r.z, mats.stone);
          } else {
            box(g, 8, 0.05, 0.15, r.x, 0.22, r.z, mats.dark);
            box(g, 0.15, 0.05, 8, r.x, 0.22, r.z, mats.dark);
          }
        } else {
          if (r.index === 0 || r.index === 2) {
            box(g, 4, 0.15, 1.6, r.x, 1, r.z, mats.wood);
            box(g, 2, 0.8, 0.6, r.x, 0.6, r.z - 2, soft);
          } else if (r.index === 1) {
            for (const dx of [-3, 3]) {
              box(g, 3, 0.15, 2, r.x + dx, 0.85, r.z, mats.wood);
              box(g, 2, 0.65, 0.6, r.x + dx, 0.5, r.z + 1.6, soft);
            }
          } else {
            box(g, 5, 0.7, 1.6, r.x, 0.55, r.z, soft);
            box(g, 5, 0.6, 0.25, r.x, 0.95, r.z + 0.8, soft);
            box(g, 2, 0.35, 1.2, r.x, 0.3, r.z - 2, mats.wood);
          }
        }
      }

      // Stair cores
      for (const sx of [-21, 21]) {
        const sg = new THREE.Group();
        sg.userData.zone = 'Buồng thang bộ ' + (sx < 0 ? '01' : '02');
        floorGroup.add(sg);
        box(sg, 5, 0.12, 6, sx, 0.12, 0, mats.stone);
        box(sg, 0.18, 2.6, 6, sx - 2.5, 1.4, 0, wall);
        box(sg, 0.18, 2.6, 6, sx + 2.5, 1.4, 0, wall);
        box(sg, 5, 2.6, 0.18, sx, 1.4, -3, wall);
        box(sg, 3, 2.6, 0.18, sx - 1, 1.4, 3, wall);
        for (let k = 0; k < 8; k++) {
          box(sg, 1.6, 0.15, 0.4, sx - 1, 0.3 + k * 0.17, -1.8 + k * 0.4, mats.white);
          box(sg, 1.6, 0.15, 0.4, sx + 1, 1.7 + k * 0.17, 1 - k * 0.4, mats.white);
        }
        box(sg, 4, 0.15, 1, sx, 1.6, 1.8, mats.stone);
        const slbl = makeFloorLabel('Thang bộ ' + (sx < 0 ? '01' : '02'), sx, 0, () => propsRef.current.onPickZone(sg.userData.zone));
        floorLabels.push(slbl);
      }

      // Elevator core
      const core = new THREE.Group();
      core.userData.zone = 'Cụm thang máy & sảnh';
      floorGroup.add(core);
      for (const cx of [-4, 0, 4]) {
        box(core, 3.5, 0.12, 3, cx, 0.14, -1.7, mats.dark);
        box(core, 3.5, 2.8, 0.18, cx, 1.5, -3.2, wall);
        box(core, 0.15, 2.8, 3, cx - 1.7, 1.5, -1.7, wall);
        box(core, 0.15, 2.8, 3, cx + 1.7, 1.5, -1.7, wall);
        box(core, 2.7, 2.2, 0.15, cx, 1.2, -0.2, mats.glass);
        box(core, 0.05, 2.2, 0.18, cx, 1.2, -0.1, mats.dark);
      }

      // Tech room
      const tech = new THREE.Group();
      tech.userData.zone = 'Phòng / hộp kỹ thuật';
      floorGroup.add(tech);
      box(tech, 4, 0.12, 3, 15, 0.12, -1.7, mats.walk);
      box(tech, 4, 2.6, 0.18, 15, 1.4, -3.2, wall);
      box(tech, 0.18, 2.6, 3, 13, 1.4, -1.7, wall);
      box(tech, 0.18, 2.6, 3, 17, 1.4, -1.7, wall);
      box(tech, 2, 1.5, 0.7, 15, 0.9, -2.5, mats.dark);
      const tlbl = makeFloorLabel('Kỹ thuật', 15, -2, () => propsRef.current.onPickZone(tech.userData.zone));
      floorLabels.push(tlbl);

      // Asset markers
      currentAssets.forEach(a => {
        const color = REPAIR_STAGES[a.stage]?.color ?? '#81939c';
        const m = mat(color);
        const marker = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 8), m);
        marker.position.set(a.px ?? 0, 1.1, a.pz ?? 0);
        marker.userData.assetId = a.id;
        floorGroup!.add(marker);
        if (a.shared) {
          const door = box(floorGroup!, 2.7, 2.2, 0.08, a.px ?? 0, 1.2, -0.08, m);
          door.userData.assetId = a.id;
        }
        const albl = makeFloorLabel(
          a.code + ' · ' + REPAIR_STAGES[a.stage].label,
          a.px ?? 0,
          a.pz ?? 0,
          () => propsRef.current.onPickAsset(a.id),
          color,
        );
        floorLabels.push(albl);
      });
    }

    // ── State ──────────────────────────────────────────────────
    const state = {
      renderer,
      scene,
      camera,
      campusObjects,
      blockGroups,
      floorGroup,
      campusLabels,
      floorLabels,
      activeLabels: campusLabels,
      theta: 0.65,
      phi: 0.95,
      radius: 125,
      target: new THREE.Vector3(0, 8, 0),
      desired: new THREE.Vector3(0, 8, 0),
      animFrame: 0,
    };
    sceneRef.current = state;

    // ── Camera + render ────────────────────────────────────────
    function updateCamera() {
      state.target.lerp(state.desired, 0.12);
      camera.position.set(
        state.target.x + state.radius * Math.sin(state.phi) * Math.sin(state.theta),
        state.target.y + state.radius * Math.cos(state.phi),
        state.target.z + state.radius * Math.sin(state.phi) * Math.cos(state.theta),
      );
      camera.lookAt(state.target);
    }

    function updateLabels() {
      const w = host.clientWidth;
      const h = host.clientHeight;
      for (const l of state.activeLabels) {
        const p = l.position.clone().project(camera);
        l.element.style.left = (p.x * 0.5 + 0.5) * w + 'px';
        l.element.style.top = (-p.y * 0.5 + 0.5) * h + 'px';
        const hidden = p.z > 1 || (isFloorMode() && l.kind === 'room' && !showRoomLabels);
        l.element.style.display = hidden ? 'none' : 'block';
        if (l.kind === 'block') {
          l.element.classList.toggle('!bg-[#0a8e73]', propsRef.current.block === l.id);
          l.element.classList.toggle('!text-white', propsRef.current.block === l.id);
        }
      }
    }

    function draw() {
      if (!host.isConnected || host.offsetWidth === 0) return;
      updateCamera();
      renderer.render(scene, camera);
      updateLabels();
      if (state.target.distanceTo(state.desired) > 0.05) {
        cancelAnimationFrame(state.animFrame);
        state.animFrame = requestAnimationFrame(draw);
      }
    }

    function resize() {
      if (!host.clientWidth) return;
      renderer.setSize(host.clientWidth, host.clientHeight);
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      draw();
    }

    // ── Pointer controls ───────────────────────────────────────
    const drag = new Map<number, { x: number; y: number }>();
    let previous: { x: number; y: number } | null = null;
    let moved = false;

    function isFloorMode() {
      return propsRef.current.view === 'floor3d';
    }

    renderer.domElement.addEventListener('pointerdown', e => {
      e.stopPropagation();
      drag.set(e.pointerId, { x: e.clientX, y: e.clientY });
      previous = { x: e.clientX, y: e.clientY };
      moved = false;
      renderer.domElement.setPointerCapture(e.pointerId);
    });

    renderer.domElement.addEventListener('pointermove', e => {
      e.stopPropagation();
      if (!drag.has(e.pointerId)) return;
      const old = [...drag.values()];
      drag.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const next = [...drag.values()];
      if (next.length === 2) {
        const a = Math.hypot(old[0].x - old[1].x, old[0].y - old[1].y);
        const b = Math.hypot(next[0].x - next[1].x, next[0].y - next[1].y);
        if (b > 0) state.radius = Math.max(isFloorMode() ? 25 : 60, Math.min(200, state.radius * a / b));
        moved = true;
      } else if (previous) {
        const dx = e.clientX - previous.x;
        const dy = e.clientY - previous.y;
        if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
        state.theta -= dx * 0.008;
        state.phi = Math.max(0.45, Math.min(1.3, state.phi + dy * 0.005));
      }
      previous = { x: e.clientX, y: e.clientY };
      draw();
    });

    renderer.domElement.addEventListener('pointerup', e => {
      e.stopPropagation();
      drag.delete(e.pointerId);
      previous = null;
      if (!moved) {
        const rect = renderer.domElement.getBoundingClientRect();
        const p = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1,
        );
        const ray = new THREE.Raycaster();
        ray.setFromCamera(p, camera);
        const targets = isFloorMode() && floorGroup ? [floorGroup] : blockGroups;
        const hits = ray.intersectObjects(targets, true);
        if (hits.length) {
          let g: THREE.Object3D | null = hits[0].object;
          while (g && !g.userData.block && !g.userData.assetId && !g.userData.zone) g = g.parent;
          if (g) {
            if (g.userData.assetId) propsRef.current.onPickAsset(g.userData.assetId as string);
            else if (g.userData.zone) propsRef.current.onPickZone(g.userData.zone as string);
            else if (g.userData.block) propsRef.current.onPickBlock(g.userData.block as string);
          }
        }
      }
      setTimeout(() => { moved = false; }, 80);
    });

    renderer.domElement.addEventListener('pointercancel', e => {
      drag.delete(e.pointerId);
      previous = null;
    });

    renderer.domElement.addEventListener('wheel', e => {
      e.preventDefault();
      e.stopPropagation();
      state.radius = Math.max(isFloorMode() ? 25 : 60, Math.min(200, state.radius * (e.deltaY > 0 ? 1.08 : 0.92)));
      draw();
    }, { passive: false });

    renderer.domElement.addEventListener('webglcontextlost', e => {
      e.preventDefault();
    });

    // ── Room label toggle ──────────────────────────────────────
    let showRoomLabels = window.innerWidth >= 720;

    // ── Mount canvas + labels ──────────────────────────────────
    host.appendChild(renderer.domElement);

    const observer = new ResizeObserver(resize);
    observer.observe(host);

    // ── Switch scene helper ────────────────────────────────────
    function switchScene(
      newView: ViewMode,
      newBlock: string,
      newFloor: FloorKey,
      newAssets: Asset[],
      newZones: ZoneLayout[],
    ) {
      const isFloor = newView === 'floor3d';

      for (const o of campusObjects) {
        o.visible = !isFloor;
      }

      if (isFloor) {
        // Remove campus block labels from the DOM so Block A/B/C/D tags don't linger over the floor view.
        for (const l of campusLabels) l.element.remove();
        const key = newBlock + newFloor + newAssets.map(a => a.stage).join('');
        if (key !== floorKey) {
          buildFloor(newFloor, newBlock, newAssets, newZones);
          floorKey = key;
        }
        state.activeLabels = [...floorLabels];
        if (floorGroup) floorGroup.visible = true;
        state.desired.set(0, 0, 0);
        if (state.radius > 80) {
          state.radius = 65;
          state.phi = 0.8;
          state.target.copy(state.desired);
        }
      } else {
        if (floorGroup) floorGroup.visible = false;
        for (const l of floorLabels) l.element.remove();
        state.activeLabels = [...campusLabels];
        if (state.radius < 80) {
          state.radius = 125;
          state.phi = 0.95;
          state.desired.copy(new THREE.Vector3(0, 8, 0));
        }
        // Highlight selected block
        for (const g of blockGroups) {
          (g.userData.indicator as THREE.Mesh).material instanceof THREE.MeshBasicMaterial
            ? ((g.userData.indicator as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity =
                g.userData.block === newBlock ? 0.9 : 0
            : null;
          if (newBlock && g.userData.block === newBlock) {
            state.desired.copy(g.position.clone().add(new THREE.Vector3(0, 12, 0)));
          }
        }
        if (!newBlock) state.desired.set(0, 8, 0);
      }

      // Append new labels to host
      for (const l of state.activeLabels) {
        if (!host.contains(l.element)) host.appendChild(l.element);
      }
    }

    // Run initial switch
    switchScene(propsRef.current.view, propsRef.current.block, propsRef.current.floor, propsRef.current.assets, propsRef.current.zones);
    resize();

    // ── Expose controls ────────────────────────────────────────
    (host as unknown as Record<string, unknown>).__threeRotate = (n: number) => { state.theta += (n * Math.PI) / 180; draw(); };
    (host as unknown as Record<string, unknown>).__threeZoom = (f: number) => {
      state.radius = Math.max(isFloorMode() ? 25 : 60, Math.min(200, state.radius / f));
      draw();
    };
    (host as unknown as Record<string, unknown>).__threeReset = () => {
      state.theta = 0.65;
      state.phi = 0.95;
      state.radius = isFloorMode() ? 65 : 125;
      state.desired.set(0, isFloorMode() ? 0 : 8, 0);
      draw();
    };
    (host as unknown as Record<string, unknown>).__switchScene = switchScene;
    (host as unknown as Record<string, unknown>).__toggleRoomLabels = () => {
      showRoomLabels = !showRoomLabels;
      draw();
      return showRoomLabels;
    };
    (host as unknown as Record<string, unknown>).__getRoomLabels = () => showRoomLabels;

    return () => {
      observer.disconnect();
      cancelAnimationFrame(state.animFrame);
      for (const l of [...campusLabels, ...floorLabels]) l.element.remove();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.remove();
      sceneRef.current = null;
    };
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to prop changes after initial mount
  useEffect(() => {
    if (!hostRef.current) return;
    const host = hostRef.current!;
    const switchScene = (host as unknown as Record<string, unknown>).__switchScene as (
      v: ViewMode, b: string, f: FloorKey, a: Asset[], z: ZoneLayout[]
    ) => void;
    if (switchScene) {
      switchScene(view, block, floor, assets, zones);
      const s = sceneRef.current;
      if (s) {
        const updateCamera = () => {
          s.target.lerp(s.desired, 0.12);
          s.camera.position.set(
            s.target.x + s.radius * Math.sin(s.phi) * Math.sin(s.theta),
            s.target.y + s.radius * Math.cos(s.phi),
            s.target.z + s.radius * Math.sin(s.phi) * Math.cos(s.theta),
          );
          s.camera.lookAt(s.target);
        };
        updateCamera();
        s.renderer.render(s.scene, s.camera);
        const w = host.clientWidth;
        const h = host.clientHeight;
        for (const l of s.activeLabels) {
          const p = l.position.clone().project(s.camera);
          l.element.style.left = (p.x * 0.5 + 0.5) * w + 'px';
          l.element.style.top = (-p.y * 0.5 + 0.5) * h + 'px';
          if (p.z > 1) l.element.style.display = 'none';
          else l.element.style.display = 'block';
        }
      }
    }
  }, [view, block, floor, assets, zones]);

  function rotate(n: number) {
    const h = hostRef.current;
    if (!h) return;
    ((h as unknown as Record<string, unknown>).__threeRotate as (n: number) => void)?.(n);
  }
  function zoom(f: number) {
    const h = hostRef.current;
    if (!h) return;
    ((h as unknown as Record<string, unknown>).__threeZoom as (f: number) => void)?.(f);
  }
  function reset() {
    const h = hostRef.current;
    if (!h) return;
    ((h as unknown as Record<string, unknown>).__threeReset as () => void)?.();
  }

  return (
    <div ref={hostRef} className="relative w-full h-full touch-none overflow-hidden bg-[#e9eee7]">
      {/* Controls overlay */}
      <div className="absolute right-3 top-3 flex gap-1 z-20">
        <button
          onClick={() => rotate(-20)}
          className="bg-white/90 text-[#416758] rounded-lg px-3 py-2 text-sm border border-white/60 hover:bg-white transition-colors"
          aria-label="Xoay trái"
        >↶</button>
        <button
          onClick={() => rotate(20)}
          className="bg-white/90 text-[#416758] rounded-lg px-3 py-2 text-sm border border-white/60 hover:bg-white transition-colors"
          aria-label="Xoay phải"
        >↷</button>
      </div>
      <div className="absolute right-3 bottom-3 flex bg-white rounded-lg border border-[#dbe7df] shadow-sm z-20 overflow-hidden">
        <button onClick={() => zoom(1.18)} className="px-3 py-2 text-sm text-[#385d54] hover:bg-gray-50" aria-label="Phóng to">+</button>
        <button onClick={() => zoom(0.85)} className="px-3 py-2 text-sm text-[#385d54] hover:bg-gray-50 border-l border-[#dbe7df]" aria-label="Thu nhỏ">−</button>
        <button onClick={reset} className="px-3 py-2 text-sm text-[#385d54] hover:bg-gray-50 border-l border-[#dbe7df]" aria-label="Đặt lại">⤢</button>
      </div>
      <p className="absolute left-3 bottom-3 text-[10px] text-[#6b877b] z-10 pointer-events-none">
        {view === 'floor3d' ? 'Kéo xoay · Hai ngón thu phóng · Chạm khu vực' : 'Kéo xoay · Phóng to bằng hai ngón tay'}
      </p>
    </div>
  );
}
