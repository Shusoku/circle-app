import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { DialTextureController } from '../utils/dialTexture';
import { BiometricState, DeviceSpecs, EmergencyState, FriendContact, MaterialFinish } from '../types/compass';
import { hapticAudio } from '../audio/hapticAudio';

interface CompassCanvas3DProps {
  specs: DeviceSpecs;
  targetFriend: FriendContact;
  biometrics: BiometricState;
  emergency: EmergencyState;
  onDoubleTapNeedle: () => void;
  onTripleTapNeedle?: () => void;
  onCameraChange?: (preset: string) => void;
}

export const CompassCanvas3D: React.FC<CompassCanvas3DProps> = ({
  specs,
  targetFriend,
  biometrics,
  emergency,
  onDoubleTapNeedle,
  onTripleTapNeedle,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const onDoubleTapRef = useRef(onDoubleTapNeedle);
  onDoubleTapRef.current = onDoubleTapNeedle;
  const onTripleTapRef = useRef(onTripleTapNeedle);
  onTripleTapRef.current = onTripleTapNeedle;

  const [hoveredComponent, setHoveredComponent] = useState<string | null>(null);

  // References to keep mutable 3D entities
  const stateRef = useRef({
    specs,
    targetFriend,
    biometrics,
    emergency,
  });
  stateRef.current = { specs, targetFriend, biometrics, emergency };

  const threeRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    dialController: DialTextureController;
    needleGroup: THREE.Group;
    arrowBladesGroup: THREE.Group;
    hapticRingMesh: THREE.Mesh;
    ledRingMaterial: THREE.MeshStandardMaterial;
    jewelMaterial: THREE.MeshPhysicalMaterial;
    explodedLayers: {
      sapphire: THREE.Object3D;
      needle: THREE.Object3D;
      dial: THREE.Object3D;
      chassis: THREE.Object3D;
      pcb: THREE.Object3D;
      battery: THREE.Object3D;
      rearSensors: THREE.Object3D;
    } | null;
    materials: Record<string, THREE.Material>;
    targetCamPos: THREE.Vector3;
    targetCamLookAt: THREE.Vector3;
    isTransitioningCam: boolean;
  } | null>(null);

  // Function to move camera to presets
  const setCameraPreset = useCallback((preset: string) => {
    if (!threeRef.current) return;
    const { targetCamPos, targetCamLookAt } = threeRef.current;
    threeRef.current.isTransitioningCam = true;

    if (preset === 'front') {
      targetCamPos.set(0, 0, 4.4);
      targetCamLookAt.set(0, -0.15, 0);
    } else if (preset === 'perspective') {
      targetCamPos.set(2.4, 1.8, 3.4);
      targetCamLookAt.set(0, -0.1, 0);
    } else if (preset === 'back') {
      targetCamPos.set(0, 0.2, -4.4);
      targetCamLookAt.set(0, -0.1, 0);
    } else if (preset === 'macro') {
      targetCamPos.set(0.6, 0.8, 2.1);
      targetCamLookAt.set(0, 0, 0.1);
    } else if (preset === 'wear') {
      targetCamPos.set(0, 1.5, 5.8);
      targetCamLookAt.set(0, 0.6, 0);
    }
  }, []);

  // Expose camera presets helper
  useEffect(() => {
    (window as unknown as { setCompassView?: (view: string) => void }).setCompassView = setCameraPreset;
  }, [setCameraPreset]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Detect software WebGL per Three.js skill
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Setup WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 3. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
    camera.position.set(0, 0, 4.4);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.5;
    controls.maxDistance = 8.5;
    controls.target.set(0, -0.15, 0);

    // When user drags controls, disable scripted transition
    controls.addEventListener('start', () => {
      if (threeRef.current) threeRef.current.isTransitioningCam = false;
    });

    // 4. Studio Environment Reflection Map
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 5. Lighting Rig
    const ambientLight = new THREE.HemisphereLight(0xe2e8f0, 0x0f172a, 1.2);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.4);
    keyLight.position.set(3.5, 4.5, 4);
    keyLight.castShadow = !isSoftwareGl;
    if (keyLight.castShadow) {
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 12;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.8);
    rimLight.position.set(-3.5, -2, -3);
    scene.add(rimLight);

    const softFillLight = new THREE.DirectionalLight(0xffffff, 0.8);
    softFillLight.position.set(0, -3, 2);
    scene.add(softFillLight);

    // Subtle grounding contact shadow plane
    const shadowGeo = new THREE.PlaneGeometry(6, 6);
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sctx = shadowCanvas.getContext('2d')!;
    const grad = sctx.createRadialGradient(64, 64, 10, 64, 64, 60);
    grad.addColorStop(0, 'rgba(0,0,0,0.45)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.18)');
    grad.addColorStop(1, 'transparent');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 128, 128);
    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.position.set(0, -1.8, 0);
    shadowMesh.rotation.x = -Math.PI / 2;
    scene.add(shadowMesh);

    // 6. Materials Setup for Hardware Finishes
    const materials: Record<string, THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial> = {
      chassisTitanium: new THREE.MeshPhysicalMaterial({
        color: 0xc8cdd4,
        metalness: 0.92,
        roughness: 0.22,
        clearcoat: 0.1,
      }),
      chassisObsidian: new THREE.MeshPhysicalMaterial({
        color: 0x181a1f,
        metalness: 0.85,
        roughness: 0.32,
        clearcoat: 0.3,
      }),
      chassisRoseGold: new THREE.MeshPhysicalMaterial({
        color: 0xe0a18a,
        metalness: 0.94,
        roughness: 0.18,
        clearcoat: 0.15,
      }),
      chassisEmerald: new THREE.MeshPhysicalMaterial({
        color: 0x10382e,
        metalness: 0.88,
        roughness: 0.24,
        clearcoat: 0.4,
      }),
      sapphireLens: new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transmission: isSoftwareGl ? 0 : 0.92,
        transparent: true,
        opacity: isSoftwareGl ? 0.35 : 0.95,
        roughness: 0.05,
        ior: 1.76, // Real sapphire crystal IOR
        thickness: 0.4,
        clearcoat: 1.0,
        clearcoatRoughness: 0.02,
        depthWrite: false,
      }),
      needleNorth: new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.6,
        metalness: 0.8,
        roughness: 0.2,
      }),
      needleSouth: new THREE.MeshStandardMaterial({
        color: 0x334155,
        metalness: 0.9,
        roughness: 0.25,
      }),
      needleCenterJewel: new THREE.MeshPhysicalMaterial({
        color: 0x0284c7,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.8,
        metalness: 0.5,
        roughness: 0.1,
        clearcoat: 1.0,
      }),
      ledRing: new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x38bdf8,
        emissiveIntensity: 1.2,
        roughness: 0.2,
      }),
      cord: new THREE.MeshStandardMaterial({
        color: 0x1e2430,
        roughness: 0.65,
        metalness: 0.2,
      }),
      cordAccents: new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        metalness: 0.95,
        roughness: 0.15,
      }),
      pcbSubstrate: new THREE.MeshStandardMaterial({
        color: 0x0d2818,
        roughness: 0.4,
        metalness: 0.5,
      }),
      pcbChips: new THREE.MeshStandardMaterial({
        color: 0x0a0a0a,
        roughness: 0.3,
        metalness: 0.7,
      }),
      batteryLiPo: new THREE.MeshStandardMaterial({
        color: 0x334155,
        metalness: 0.85,
        roughness: 0.25,
      }),
      goldContacts: new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        metalness: 0.98,
        roughness: 0.1,
      }),
      opticalSensorLens: new THREE.MeshPhysicalMaterial({
        color: 0x10b981,
        emissive: 0x059669,
        emissiveIntensity: 1.4,
        roughness: 0.1,
        transmission: 0.8,
        transparent: true,
      }),
    };

    // 7. Dial Texture Controller
    const dialController = new DialTextureController(1024);
    const dialMaterial = new THREE.MeshBasicMaterial({
      map: dialController.texture,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    // 8. Build Complete 3D Assembly of Compass Pendant
    const rootPendantGroup = new THREE.Group();
    rootPendantGroup.name = 'CompassRoot';

    // A. Outer Bezel / Chassis (Layer 0)
    const chassisGroup = new THREE.Group();
    chassisGroup.name = 'ChassisLayer';

    // Outer knurled cylinder ring
    const outerRadius = 1.15;
    const innerRadius = 0.96;
    const chassisThickness = 0.32;
    const outerRingGeo = new THREE.CylinderGeometry(outerRadius, outerRadius, chassisThickness, 64, 1, true);
    const outerRingMesh = new THREE.Mesh(outerRingGeo, materials.chassisTitanium);
    outerRingMesh.rotation.x = Math.PI / 2;
    outerRingMesh.castShadow = !isSoftwareGl;
    outerRingMesh.receiveShadow = !isSoftwareGl;
    chassisGroup.add(outerRingMesh);

    // Bezel Front Chamfer Ring
    const frontChamferGeo = new THREE.RingGeometry(innerRadius, outerRadius, 64);
    const frontChamferMesh = new THREE.Mesh(frontChamferGeo, materials.chassisTitanium);
    frontChamferMesh.position.z = chassisThickness / 2;
    chassisGroup.add(frontChamferMesh);

    // Recessed Inner Bezel Wall
    const innerWallGeo = new THREE.CylinderGeometry(innerRadius, innerRadius, 0.16, 64, 1, true);
    const innerWallMesh = new THREE.Mesh(innerWallGeo, materials.cordAccents);
    innerWallMesh.rotation.x = Math.PI / 2;
    innerWallMesh.position.z = 0.08;
    chassisGroup.add(innerWallMesh);

    // Suspension Lug / Bail at Top (12 o'clock)
    const bailGeo = new THREE.TorusGeometry(0.18, 0.05, 16, 32);
    const bailMesh = new THREE.Mesh(bailGeo, materials.cordAccents);
    bailMesh.position.set(0, outerRadius + 0.14, 0);
    chassisGroup.add(bailMesh);

    // Bail mount collar
    const bailCollarGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.14, 24);
    const bailCollarMesh = new THREE.Mesh(bailCollarGeo, materials.cordAccents);
    bailCollarMesh.position.set(0, outerRadius + 0.04, 0);
    chassisGroup.add(bailCollarMesh);

    rootPendantGroup.add(chassisGroup);

    // B. Micro-OLED Circular Screen (Layer +1)
    const dialGroup = new THREE.Group();
    dialGroup.name = 'DialLayer';
    const dialPlaneGeo = new THREE.CircleGeometry(innerRadius * 0.99, 64);
    const dialMesh = new THREE.Mesh(dialPlaneGeo, dialMaterial);
    dialMesh.position.z = 0.04;
    dialGroup.add(dialMesh);
    rootPendantGroup.add(dialGroup);

    // C. Haptic Pulse Halo Ring (Around the perimeter of the dial)
    const hapticRingGeo = new THREE.RingGeometry(innerRadius * 0.92, innerRadius * 0.99, 64);
    const hapticRingMesh = new THREE.Mesh(hapticRingGeo, materials.ledRing);
    hapticRingMesh.position.z = 0.045;
    dialGroup.add(hapticRingMesh);

    // D. Tactile Center Needle & Touch Pivot (Layer +2)
    const needleGroup = new THREE.Group();
    needleGroup.name = 'NeedleLayer';

    // Sub-group for the directional arrow blade (Hidden until double-tapped)
    const arrowBladesGroup = new THREE.Group();
    arrowBladesGroup.name = 'ArrowBladesGroup';
    // Initially retracted (scale 0)
    arrowBladesGroup.scale.set(0, 0, 0);
    arrowBladesGroup.visible = false;

    // Stylish Sculpted Aero-Spear Arrow (Luminous North Pointer)
    const northShape = new THREE.Shape();
    northShape.moveTo(0, 0.74); // Sharp arrow apex
    northShape.lineTo(0.08, 0.52); // Beveled arrow barb right
    northShape.lineTo(0.045, 0.48); // Waist indent right
    northShape.lineTo(0.045, 0.08); // Blade shaft right
    northShape.lineTo(0, 0.02); // Center junction
    northShape.lineTo(-0.045, 0.08); // Blade shaft left
    northShape.lineTo(-0.045, 0.48); // Waist indent left
    northShape.lineTo(-0.08, 0.52); // Beveled arrow barb left
    northShape.closePath();

    const northExtrudeGeo = new THREE.ExtrudeGeometry(northShape, {
      depth: 0.035,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.012,
      bevelThickness: 0.012,
    });
    northExtrudeGeo.center();
    const northMesh = new THREE.Mesh(northExtrudeGeo, materials.needleNorth);
    northMesh.position.set(0, 0.38, 0.07);
    northMesh.castShadow = !isSoftwareGl;
    arrowBladesGroup.add(northMesh);

    // Glowing Laser Spine Conduit along arrow centerline
    const spineGeo = new THREE.BoxGeometry(0.016, 0.54, 0.012);
    const spineMesh = new THREE.Mesh(spineGeo, materials.ledRing);
    spineMesh.position.set(0, 0.38, 0.095);
    arrowBladesGroup.add(spineMesh);

    // Counterbalance Aero Tail
    const southShape = new THREE.Shape();
    southShape.moveTo(0, -0.42);
    southShape.lineTo(0.05, -0.12);
    southShape.lineTo(0, -0.04);
    southShape.lineTo(-0.05, -0.12);
    southShape.closePath();

    const southExtrudeGeo = new THREE.ExtrudeGeometry(southShape, {
      depth: 0.028,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.008,
      bevelThickness: 0.008,
    });
    southExtrudeGeo.center();
    const southMesh = new THREE.Mesh(southExtrudeGeo, materials.needleSouth);
    southMesh.position.set(0, -0.22, 0.07);
    southMesh.castShadow = !isSoftwareGl;
    arrowBladesGroup.add(southMesh);

    needleGroup.add(arrowBladesGroup);

    // Central Capacitive Jewel Pivot (PERMANENT TOUCH TARGET)
    const pivotGeo = new THREE.CylinderGeometry(0.13, 0.145, 0.08, 36);
    const pivotMesh = new THREE.Mesh(pivotGeo, materials.needleCenterJewel);
    pivotMesh.rotation.x = Math.PI / 2;
    pivotMesh.position.z = 0.088;
    pivotMesh.name = 'CenterNeedlePivot';
    needleGroup.add(pivotMesh);

    // Domed Jewel Lens on Top
    const jewelCapGeo = new THREE.SphereGeometry(0.125, 32, 16, 0, Math.PI * 2, 0, 0.55);
    const jewelCapMesh = new THREE.Mesh(jewelCapGeo, materials.needleCenterJewel);
    jewelCapMesh.position.set(0, 0, 0.1);
    needleGroup.add(jewelCapMesh);

    // Outer Jewel Halo Trim (Micro-knurled collar)
    const jewelTrimGeo = new THREE.TorusGeometry(0.145, 0.022, 16, 36);
    const jewelTrimMesh = new THREE.Mesh(jewelTrimGeo, materials.cordAccents);
    jewelTrimMesh.position.z = 0.088;
    needleGroup.add(jewelTrimMesh);

    rootPendantGroup.add(needleGroup);

    // E. Sapphire Crystal Dome (Layer +3)
    const sapphireGroup = new THREE.Group();
    sapphireGroup.name = 'SapphireLayer';
    const sapphireGeo = new THREE.SphereGeometry(innerRadius * 1.02, 64, 16, 0, Math.PI * 2, 0, 0.4);
    const sapphireMesh = new THREE.Mesh(sapphireGeo, materials.sapphireLens);
    sapphireMesh.position.set(0, 0, 0.06);
    sapphireGroup.add(sapphireMesh);
    rootPendantGroup.add(sapphireGroup);

    // F. Internal Logic Board PCB (Layer -1)
    const pcbGroup = new THREE.Group();
    pcbGroup.name = 'PCBLayer';
    const pcbGeo = new THREE.CylinderGeometry(innerRadius * 0.94, innerRadius * 0.94, 0.04, 48);
    const pcbMesh = new THREE.Mesh(pcbGeo, materials.pcbSubstrate);
    pcbMesh.rotation.x = Math.PI / 2;
    pcbMesh.position.z = -0.06;
    pcbGroup.add(pcbMesh);

    // Microchips on PCB (UWB chip, MCU, LRA Haptic Motor)
    const uwbChipGeo = new THREE.BoxGeometry(0.25, 0.25, 0.03);
    const uwbChip = new THREE.Mesh(uwbChipGeo, materials.pcbChips);
    uwbChip.position.set(-0.35, 0.25, -0.04);
    pcbGroup.add(uwbChip);

    // Linear Resonant Actuator (LRA) Haptic Motor disc
    const lraGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.05, 32);
    const lraMesh = new THREE.Mesh(lraGeo, materials.cordAccents);
    lraMesh.rotation.x = Math.PI / 2;
    lraMesh.position.set(0.3, 0.1, -0.04);
    pcbGroup.add(lraMesh);

    // Bluetooth 5.4 Antenna trace ring
    const antennaGeo = new THREE.RingGeometry(0.68, 0.74, 32);
    const antennaMesh = new THREE.Mesh(antennaGeo, materials.goldContacts);
    antennaMesh.position.z = -0.04;
    pcbGroup.add(antennaMesh);

    rootPendantGroup.add(pcbGroup);

    // G. Solid-State LiPo Battery Puck (Layer -2)
    const batteryGroup = new THREE.Group();
    batteryGroup.name = 'BatteryLayer';
    const batteryGeo = new THREE.CylinderGeometry(innerRadius * 0.82, innerRadius * 0.82, 0.06, 48);
    const batteryMesh = new THREE.Mesh(batteryGeo, materials.batteryLiPo);
    batteryMesh.rotation.x = Math.PI / 2;
    batteryMesh.position.z = -0.13;
    batteryGroup.add(batteryMesh);
    rootPendantGroup.add(batteryGroup);

    // H. Rear Biometric Sensor Cluster (Layer -3)
    const rearSensorsGroup = new THREE.Group();
    rearSensorsGroup.name = 'RearSensorsLayer';

    // Convex skin-contact ergonomic ceramic back plate
    const backPlateGeo = new THREE.SphereGeometry(innerRadius * 1.02, 64, 16, 0, Math.PI * 2, Math.PI - 0.4, 0.4);
    const backPlateMesh = new THREE.Mesh(backPlateGeo, materials.chassisTitanium);
    backPlateMesh.position.set(0, 0, -0.18);
    rearSensorsGroup.add(backPlateMesh);

    // Dual Optical PPG Sensor Emitter Wells (glowing emerald green photoplethysmography sensors)
    [-0.22, 0.22].forEach((xPos) => {
      const ppgGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.04, 24);
      const ppgMesh = new THREE.Mesh(ppgGeo, materials.opticalSensorLens);
      ppgMesh.rotation.x = Math.PI / 2;
      ppgMesh.position.set(xPos, 0, -0.21);
      rearSensorsGroup.add(ppgMesh);
    });

    // Electrodermal Activity (EDA) Galvanic Stress Electrodes (Gold-plated pads)
    [-0.22, 0.22].forEach((yPos) => {
      const edaGeo = new THREE.BoxGeometry(0.16, 0.08, 0.03);
      const edaMesh = new THREE.Mesh(edaGeo, materials.goldContacts);
      edaMesh.position.set(0, yPos, -0.21);
      rearSensorsGroup.add(edaMesh);
    });

    // Magnetic Fast-Charging Ring
    const chargeRingGeo = new THREE.RingGeometry(0.48, 0.56, 32);
    const chargeRingMesh = new THREE.Mesh(chargeRingGeo, materials.cordAccents);
    chargeRingMesh.rotation.y = Math.PI;
    chargeRingMesh.position.z = -0.215;
    rearSensorsGroup.add(chargeRingMesh);

    rootPendantGroup.add(rearSensorsGroup);

    // I. Necklace Cord / Chain Hanging Naturally
    const necklaceGroup = new THREE.Group();
    necklaceGroup.name = 'NecklaceChain';

    // Procedural smooth spline curve for necklace loop draped over a neck
    const cordCurvePoints = [
      new THREE.Vector3(-1.4, 2.4, -0.4), // Left neck curve
      new THREE.Vector3(-1.1, 1.8, -0.1),
      new THREE.Vector3(-0.5, 1.2, 0.05),
      new THREE.Vector3(-0.08, outerRadius + 0.26, 0.02), // Joins at top bail
      new THREE.Vector3(0, outerRadius + 0.16, 0.0), // Center apex
      new THREE.Vector3(0.08, outerRadius + 0.26, 0.02),
      new THREE.Vector3(0.5, 1.2, 0.05),
      new THREE.Vector3(1.1, 1.8, -0.1),
      new THREE.Vector3(1.4, 2.4, -0.4), // Right neck curve
    ];
    const cordCurve = new THREE.CatmullRomCurve3(cordCurvePoints, false, 'catmullrom', 0.25);
    const cordGeo = new THREE.TubeGeometry(cordCurve, 64, 0.036, 16, false);
    const cordMesh = new THREE.Mesh(cordGeo, materials.cord);
    cordMesh.castShadow = !isSoftwareGl;
    necklaceGroup.add(cordMesh);

    // Magnetic Clasp at rear of neck
    const claspGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.22, 24);
    const leftClasp = new THREE.Mesh(claspGeo, materials.cordAccents);
    leftClasp.position.set(-1.4, 2.4, -0.4);
    leftClasp.rotation.z = Math.PI / 4;
    necklaceGroup.add(leftClasp);

    const rightClasp = new THREE.Mesh(claspGeo, materials.cordAccents);
    rightClasp.position.set(1.4, 2.4, -0.4);
    rightClasp.rotation.z = -Math.PI / 4;
    necklaceGroup.add(rightClasp);

    rootPendantGroup.add(necklaceGroup);

    // Center pendant position slightly
    rootPendantGroup.position.set(0, -0.15, 0);
    scene.add(rootPendantGroup);

    // 9. Interactive Raycasting for Double-Tap & Hover
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let lastTapTimestamp = 0;
    let tapCount = 0;
    let gestureTimer: ReturnType<typeof setTimeout> | undefined;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
      const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects([needleGroup, sapphireGroup, dialGroup], true);

      if (intersects.length > 0) {
        const now = performance.now();
        const timeDiff = now - lastTapTimestamp;

        // Taps within 420ms of each other count as one gesture.
        // Two taps = double (arrow + "thinking of you"), three = triple ("call me").
        tapCount = timeDiff > 50 && timeDiff < 420 ? tapCount + 1 : 1;
        lastTapTimestamp = now;
        clearTimeout(gestureTimer);
        if (tapCount === 2) {
          hapticAudio.playDoubleTapFeedback();
          // Wait briefly in case a third tap is coming.
          gestureTimer = setTimeout(() => { tapCount = 0; onDoubleTapRef.current(); }, onTripleTapRef.current ? 380 : 0);
        } else if (tapCount >= 3) {
          tapCount = 0;
          hapticAudio.playDoubleTapFeedback();
          onTripleTapRef.current?.();
        }
      }
    };

    const handlePointerMove = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects([needleGroup, sapphireGroup, dialGroup, chassisGroup], true);

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        if (hit.name === 'CenterNeedlePivot' || hit.parent?.name === 'NeedleLayer' || hit.parent?.name === 'ArrowBladesGroup') {
          const isPinging = stateRef.current.specs.isDoubleTapPinging;
          setHoveredComponent(
            isPinging
              ? 'Tactile Center Jewel (Tracking active • Double-tap to stow arrow)'
              : 'Tactile Center Jewel (Double-tap to illuminate arrow)'
          );
          renderer.domElement.style.cursor = 'pointer';
        } else {
          setHoveredComponent(null);
          renderer.domElement.style.cursor = 'grab';
        }
      } else {
        setHoveredComponent(null);
        renderer.domElement.style.cursor = 'default';
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);

    // Save entity references
    threeRef.current = {
      scene,
      camera,
      renderer,
      controls,
      dialController,
      needleGroup,
      arrowBladesGroup,
      hapticRingMesh,
      ledRingMaterial: materials.ledRing as THREE.MeshStandardMaterial,
      jewelMaterial: materials.needleCenterJewel as THREE.MeshPhysicalMaterial,
      explodedLayers: {
        sapphire: sapphireGroup,
        needle: needleGroup,
        dial: dialGroup,
        chassis: chassisGroup,
        pcb: pcbGroup,
        battery: batteryGroup,
        rearSensors: rearSensorsGroup,
      },
      materials,
      targetCamPos: new THREE.Vector3(0, 0, 4.4),
      targetCamLookAt: new THREE.Vector3(0, -0.15, 0),
      isTransitioningCam: false,
    };

    // 10. Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    // 11. Animation Render Loop (Software WebGL guarded)
    let frameId = 0;
    let lastTime = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const animate = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const current = stateRef.current;
      const t3 = threeRef.current;

      if (t3) {
        // A. Update Material Finishes dynamically
        const finish = current.specs.finish;
        const mainMat =
          finish === 'obsidian'
            ? materials.chassisObsidian
            : finish === 'rosegold'
            ? materials.chassisRoseGold
            : finish === 'emerald'
            ? materials.chassisEmerald
            : materials.chassisTitanium;

        outerRingMesh.material = mainMat;
        frontChamferMesh.material = mainMat;
        backPlateMesh.material = mainMat;

        // B. Update Exploded View Layer Offsets smoothly
        const explodeP = current.specs.explodedProgress;
        if (t3.explodedLayers) {
          const { sapphire, needle, dial, pcb, battery, rearSensors } = t3.explodedLayers;
          // Smooth exponential damping
          sapphire.position.z = THREE.MathUtils.damp(sapphire.position.z, 0.06 + explodeP * 1.6, 8, dt);
          needle.position.z = THREE.MathUtils.damp(needle.position.z, explodeP * 1.1, 8, dt);
          dial.position.z = THREE.MathUtils.damp(dial.position.z, explodeP * 0.6, 8, dt);
          pcb.position.z = THREE.MathUtils.damp(pcb.position.z, -explodeP * 0.7, 8, dt);
          battery.position.z = THREE.MathUtils.damp(battery.position.z, -explodeP * 1.25, 8, dt);
          rearSensors.position.z = THREE.MathUtils.damp(rearSensors.position.z, -explodeP * 1.8, 8, dt);
        }

        // C. Smooth Arrow Blade Deployment & Needle Rotation
        const isPinging = current.specs.isDoubleTapPinging;
        const isEmergency = current.emergency.isActive;

        // Arrow only appears once double tapped!
        const targetScale = isPinging ? 1.0 : 0.0;
        t3.arrowBladesGroup.scale.x = THREE.MathUtils.damp(t3.arrowBladesGroup.scale.x, targetScale, 10, dt);
        t3.arrowBladesGroup.scale.y = THREE.MathUtils.damp(t3.arrowBladesGroup.scale.y, targetScale, 10, dt);
        t3.arrowBladesGroup.scale.z = THREE.MathUtils.damp(t3.arrowBladesGroup.scale.z, targetScale, 10, dt);
        t3.arrowBladesGroup.visible = t3.arrowBladesGroup.scale.x > 0.005;

        // Needle rotation toward friend target bearing
        const targetRad = (current.targetFriend.bearingDegrees * Math.PI) / 180;
        const needleTargetAngle = -targetRad;
        t3.needleGroup.rotation.z = THREE.MathUtils.damp(t3.needleGroup.rotation.z, needleTargetAngle, 6, dt);

        // Center Jewel breathing pulse in standby vs tactical ping glow
        if (isEmergency) {
          t3.jewelMaterial.color.setHex(0xef4444);
          t3.jewelMaterial.emissive.setHex(0xef4444);
          t3.jewelMaterial.emissiveIntensity = 1.2 + Math.sin(now * 0.01) * 0.8;
        } else if (isPinging) {
          t3.jewelMaterial.color.setHex(0x0284c7);
          t3.jewelMaterial.emissive.setHex(0x38bdf8);
          t3.jewelMaterial.emissiveIntensity = 0.9 + Math.sin(now * 0.008) * 0.4;
        } else {
          t3.jewelMaterial.color.setHex(0x0369a1);
          t3.jewelMaterial.emissive.setHex(0x38bdf8);
          t3.jewelMaterial.emissiveIntensity = 0.35 + Math.sin(now * 0.0025) * 0.25;
        }

        // D. Haptic LED Ring Glow and Wave Pulsing
        const dist = current.targetFriend.distanceMeters;

        // Pulse speed and intensity scale with proximity
        const pulseRate = Math.max(2, Math.min(10, 80 / Math.max(dist, 2)));
        const sineWave = Math.sin(now * 0.005 * pulseRate);

        if (isEmergency) {
          t3.ledRingMaterial.color.setHex(0xef4444);
          t3.ledRingMaterial.emissive.setHex(0xef4444);
          t3.ledRingMaterial.emissiveIntensity = 1.0 + Math.sin(now * 0.012) * 1.4;
        } else if (isPinging) {
          // Strong proximity haptic feedback
          t3.ledRingMaterial.color.setHex(0x38bdf8);
          t3.ledRingMaterial.emissive.setHex(0x38bdf8);
          const proximityNorm = Math.max(0.2, 1 - dist / 80);
          t3.ledRingMaterial.emissiveIntensity = 0.8 + Math.max(0, sineWave) * (1.2 + proximityNorm * 1.8);

          // Subtle physical vibration offset on root pendant
          const jitter = (Math.random() - 0.5) * 0.004 * proximityNorm;
          rootPendantGroup.position.x = jitter;
        } else {
          t3.ledRingMaterial.color.setHex(0x0284c7);
          t3.ledRingMaterial.emissive.setHex(0x0284c7);
          t3.ledRingMaterial.emissiveIntensity = 0.4 + Math.sin(now * 0.002) * 0.2;
          rootPendantGroup.position.x = 0;
        }

        // E. Update Dial Canvas Texture
        t3.dialController.update(
          current.specs.displayMode,
          current.targetFriend,
          current.biometrics,
          current.emergency,
          current.specs.isDoubleTapPinging,
          dt
        );

        // F. Smooth Camera Transitions
        if (t3.isTransitioningCam) {
          camera.position.lerp(t3.targetCamPos, 0.08);
          controls.target.lerp(t3.targetCamLookAt, 0.08);
          if (camera.position.distanceTo(t3.targetCamPos) < 0.02) {
            t3.isTransitioningCam = false;
          }
        }

        // Gentle idle necklace sway
        if (explodeP < 0.05 && !t3.isTransitioningCam) {
          rootPendantGroup.rotation.y = Math.sin(now * 0.0008) * 0.04;
          rootPendantGroup.rotation.x = Math.cos(now * 0.001) * 0.02;
        } else {
          rootPendantGroup.rotation.y = 0;
          rootPendantGroup.rotation.x = 0;
        }

        controls.update();
        renderer.render(scene, camera);
      }

      if (isSoftwareGl) {
        afterDraw(animate);
      } else {
        frameId = requestAnimationFrame(animate);
      }
    };

    if (isSoftwareGl) {
      afterDraw(animate);
    } else {
      frameId = requestAnimationFrame(animate);
    }

    // 12. Cleanup on Unmount
    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      clearTimeout(gestureTimer);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      dialController.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, []); // Run once

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-gradient-to-b from-[#090d16] via-[#05070a] to-[#020408]">
      {/* Three.js Canvas Container */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Interactive Needle Hover Tooltip */}
      {hoveredComponent && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-none px-3.5 py-1.5 rounded-full bg-sky-950/80 border border-sky-400/40 text-sky-200 text-xs font-mono tracking-wider backdrop-blur-md shadow-lg animate-fade-in flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping inline-block" />
          {hoveredComponent}
        </div>
      )}
    </div>
  );
};
