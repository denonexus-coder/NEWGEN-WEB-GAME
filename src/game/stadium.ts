import * as THREE from 'three';

export interface StadiumObjects {
  group: THREE.Group;
  pitchMesh: THREE.Mesh;
  goals: {
    left: { minX: number; maxX: number; minZ: number; maxZ: number; height: number };
    right: { minX: number; maxX: number; minZ: number; maxZ: number; height: number };
  };
  fieldBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
}

export function createFootballStadium(renderer: THREE.WebGLRenderer): StadiumObjects {
  const stadiumGroup = new THREE.Group();
  stadiumGroup.name = 'Stadium';

  const fieldLength = 100;
  const fieldWidth = 64;
  const halfL = fieldLength / 2; // 50
  const halfW = fieldWidth / 2;  // 32
  const goalWidth = 14.6;
  const goalHeight = 4.8;
  const goalDepth = 4.0;

  // 1. Procedural High-Res Pitch Canvas Texture (Grass stripes + Lines)
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Grass stripes
  const numStripes = 16;
  const stripeW = canvas.width / numStripes;
  for (let i = 0; i < numStripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#266928' : '#2d7830';
    ctx.fillRect(i * stripeW, 0, stripeW, canvas.height);
  }

  // Add subtle grass noise texture
  ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
  for (let y = 0; y < canvas.height; y += 4) {
    if (Math.random() > 0.5) {
      ctx.fillRect(0, y, canvas.width, 2);
    }
  }

  // Pitch line markings
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.fillStyle = '#ffffff';

  const marginX = 60;
  const marginY = 60;
  const pW = canvas.width - marginX * 2;
  const pH = canvas.height - marginY * 2;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  // Outer boundary
  ctx.strokeRect(marginX, marginY, pW, pH);

  // Halfway line
  ctx.beginPath();
  ctx.moveTo(centerX, marginY);
  ctx.lineTo(centerX, canvas.height - marginY);
  ctx.stroke();

  // Center circle & center spot
  const centerRadius = (9.15 / fieldLength) * pW;
  ctx.beginPath();
  ctx.arc(centerX, centerY, centerRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(centerX, centerY, 7, 0, Math.PI * 2);
  ctx.fill();

  // Left Penalty Box (16.5m)
  const penWidth = (16.5 / fieldLength) * pW;
  const penHeight = (40.3 / fieldWidth) * pH;
  ctx.strokeRect(marginX, centerY - penHeight / 2, penWidth, penHeight);

  // Left Goal Box (5.5m)
  const goalAreaWidth = (5.5 / fieldLength) * pW;
  const goalAreaHeight = (18.3 / fieldWidth) * pH;
  ctx.strokeRect(marginX, centerY - goalAreaHeight / 2, goalAreaWidth, goalAreaHeight);

  // Left Penalty Spot & Arc
  const penSpotDist = (11 / fieldLength) * pW;
  ctx.beginPath();
  ctx.arc(marginX + penSpotDist, centerY, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(marginX + penSpotDist, centerY, centerRadius, -0.9, 0.9);
  ctx.stroke();

  // Right Penalty Box
  ctx.strokeRect(canvas.width - marginX - penWidth, centerY - penHeight / 2, penWidth, penHeight);

  // Right Goal Box
  ctx.strokeRect(canvas.width - marginX - goalAreaWidth, centerY - goalAreaHeight / 2, goalAreaWidth, goalAreaHeight);

  // Right Penalty Spot & Arc
  ctx.beginPath();
  ctx.arc(canvas.width - marginX - penSpotDist, centerY, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(canvas.width - marginX - penSpotDist, centerY, centerRadius, Math.PI - 0.9, Math.PI + 0.9);
  ctx.stroke();

  // Corner arcs
  const cornerRadius = (1.5 / fieldLength) * pW;
  // Top-left
  ctx.beginPath();
  ctx.arc(marginX, marginY, cornerRadius, 0, Math.PI / 2);
  ctx.stroke();
  // Bottom-left
  ctx.beginPath();
  ctx.arc(marginX, canvas.height - marginY, cornerRadius, -Math.PI / 2, 0);
  ctx.stroke();
  // Top-right
  ctx.beginPath();
  ctx.arc(canvas.width - marginX, marginY, cornerRadius, Math.PI / 2, Math.PI);
  ctx.stroke();
  // Bottom-right
  ctx.beginPath();
  ctx.arc(canvas.width - marginX, canvas.height - marginY, cornerRadius, Math.PI, Math.PI * 1.5);
  ctx.stroke();

  const pitchTexture = new THREE.CanvasTexture(canvas);
  pitchTexture.colorSpace = THREE.SRGBColorSpace;
  pitchTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  // Pitch Mesh
  const pitchGeo = new THREE.PlaneGeometry(fieldLength + 8, fieldWidth + 8);
  const pitchMat = new THREE.MeshStandardMaterial({
    map: pitchTexture,
    roughness: 0.85,
    metalness: 0.05,
  });
  const pitchMesh = new THREE.Mesh(pitchGeo, pitchMat);
  pitchMesh.rotation.x = -Math.PI / 2;
  pitchMesh.position.y = 0;
  pitchMesh.receiveShadow = true;
  stadiumGroup.add(pitchMesh);

  // Extended outer apron turf
  const outerTurfGeo = new THREE.PlaneGeometry(160, 110);
  const outerTurfMat = new THREE.MeshStandardMaterial({
    color: 0x1d4a20,
    roughness: 0.9,
    metalness: 0.0,
  });
  const outerTurf = new THREE.Mesh(outerTurfGeo, outerTurfMat);
  outerTurf.rotation.x = -Math.PI / 2;
  outerTurf.position.y = -0.02;
  outerTurf.receiveShadow = true;
  stadiumGroup.add(outerTurf);

  // 2. 3D Goals with Posts, Crossbar and Net
  const postRadius = 0.16;
  const postMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.25,
    metalness: 0.6,
  });

  // Net procedural canvas texture (lattice)
  const netCanvas = document.createElement('canvas');
  netCanvas.width = 128;
  netCanvas.height = 128;
  const netCtx = netCanvas.getContext('2d')!;
  netCtx.strokeStyle = 'rgba(230, 230, 240, 0.75)';
  netCtx.lineWidth = 2;
  for (let i = 0; i < 128; i += 16) {
    netCtx.beginPath();
    netCtx.moveTo(i, 0);
    netCtx.lineTo(i, 128);
    netCtx.stroke();
    netCtx.beginPath();
    netCtx.moveTo(0, i);
    netCtx.lineTo(128, i);
    netCtx.stroke();
  }
  const netTexture = new THREE.CanvasTexture(netCanvas);
  netTexture.wrapS = THREE.RepeatWrapping;
  netTexture.wrapT = THREE.RepeatWrapping;
  netTexture.repeat.set(8, 4);

  const netMat = new THREE.MeshStandardMaterial({
    map: netTexture,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    roughness: 0.9,
  });

  const createGoal = (xPos: number, isLeft: boolean) => {
    const goalGroup = new THREE.Group();
    goalGroup.position.set(xPos, 0, 0);

    // Left post
    const postGeo = new THREE.CylinderGeometry(postRadius, postRadius, goalHeight, 16);
    const leftPost = new THREE.Mesh(postGeo, postMat);
    leftPost.position.set(0, goalHeight / 2, -goalWidth / 2);
    leftPost.castShadow = true;
    goalGroup.add(leftPost);

    // Right post
    const rightPost = new THREE.Mesh(postGeo, postMat);
    rightPost.position.set(0, goalHeight / 2, goalWidth / 2);
    rightPost.castShadow = true;
    goalGroup.add(rightPost);

    // Crossbar
    const crossbarGeo = new THREE.CylinderGeometry(postRadius, postRadius, goalWidth + postRadius * 2, 16);
    const crossbar = new THREE.Mesh(crossbarGeo, postMat);
    crossbar.rotation.x = Math.PI / 2;
    crossbar.position.set(0, goalHeight, 0);
    crossbar.castShadow = true;
    goalGroup.add(crossbar);

    // Back support frame
    const dir = isLeft ? -1 : 1;
    const backLeftPost = new THREE.Mesh(postGeo, postMat);
    backLeftPost.position.set(dir * goalDepth, goalHeight / 2, -goalWidth / 2);
    goalGroup.add(backLeftPost);

    const backRightPost = new THREE.Mesh(postGeo, postMat);
    backRightPost.position.set(dir * goalDepth, goalHeight / 2, goalWidth / 2);
    goalGroup.add(backRightPost);

    const backCrossbar = new THREE.Mesh(crossbarGeo, postMat);
    backCrossbar.rotation.x = Math.PI / 2;
    backCrossbar.position.set(dir * goalDepth, goalHeight, 0);
    goalGroup.add(backCrossbar);

    // Net back wall
    const netBackGeo = new THREE.PlaneGeometry(goalWidth, goalHeight);
    const netBack = new THREE.Mesh(netBackGeo, netMat);
    netBack.position.set(dir * goalDepth, goalHeight / 2, 0);
    netBack.rotation.y = isLeft ? Math.PI / 2 : -Math.PI / 2;
    goalGroup.add(netBack);

    // Net roof
    const netRoofGeo = new THREE.PlaneGeometry(goalDepth, goalWidth);
    const netRoof = new THREE.Mesh(netRoofGeo, netMat);
    netRoof.rotation.x = Math.PI / 2;
    netRoof.rotation.z = Math.PI / 2;
    netRoof.position.set(dir * (goalDepth / 2), goalHeight, 0);
    goalGroup.add(netRoof);

    // Net sides
    const netSideGeo = new THREE.PlaneGeometry(goalDepth, goalHeight);
    const netSide1 = new THREE.Mesh(netSideGeo, netMat);
    netSide1.position.set(dir * (goalDepth / 2), goalHeight / 2, -goalWidth / 2);
    goalGroup.add(netSide1);

    const netSide2 = new THREE.Mesh(netSideGeo, netMat);
    netSide2.position.set(dir * (goalDepth / 2), goalHeight / 2, goalWidth / 2);
    goalGroup.add(netSide2);

    return goalGroup;
  };

  const leftGoal = createGoal(-halfL, true);
  const rightGoal = createGoal(halfL, false);
  stadiumGroup.add(leftGoal);
  stadiumGroup.add(rightGoal);

  // 3. Corner Flags
  const flagPoleGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8);
  const flagPoleMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.5 });
  const flagMat = new THREE.MeshStandardMaterial({ color: 0xff3b30, roughness: 0.6 });

  const addCornerFlag = (x: number, z: number) => {
    const flagG = new THREE.Group();
    flagG.position.set(x, 0, z);

    const pole = new THREE.Mesh(flagPoleGeo, flagPoleMat);
    pole.position.y = 0.8;
    pole.castShadow = true;
    flagG.add(pole);

    const flagPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.3), flagMat);
    flagPlane.position.set(0.22, 1.4, 0);
    flagG.add(flagPlane);

    stadiumGroup.add(flagG);
  };

  addCornerFlag(-halfL, -halfW);
  addCornerFlag(-halfL, halfW);
  addCornerFlag(halfL, -halfW);
  addCornerFlag(halfL, halfW);

  // 4. Perimeter LED Electronic Advertising Boards
  const ledCanvas = document.createElement('canvas');
  ledCanvas.width = 1024;
  ledCanvas.height = 128;
  const ledCtx = ledCanvas.getContext('2d')!;
  ledCtx.fillStyle = '#0a1020';
  ledCtx.fillRect(0, 0, 1024, 128);

  // High-energy banner texts
  const banners = [
    'NEWGEN NEWS EGOISTS',
    'BLUE LOCK CUP 2026',
    'EGO STADIUM TOKYO',
    'UNLEASH YOUR MONSTER',
    'WORLD CLASS STRIKER',
  ];
  let curX = 20;
  for (const b of banners) {
    ledCtx.fillStyle = '#00f2fe';
    ledCtx.font = 'bold 36px "Segoe UI", Arial, sans-serif';
    ledCtx.fillText(b, curX, 75);
    curX += ledCtx.measureText(b).width + 60;
  }

  const ledTex = new THREE.CanvasTexture(ledCanvas);
  ledTex.wrapS = THREE.RepeatWrapping;
  ledTex.repeat.set(4, 1);

  const ledMat = new THREE.MeshStandardMaterial({
    map: ledTex,
    emissive: 0x00f2fe,
    emissiveMap: ledTex,
    emissiveIntensity: 0.45,
    roughness: 0.4,
  });

  // Top & bottom perimeter boards
  const horizBoardGeo = new THREE.BoxGeometry(fieldLength + 16, 1.1, 0.3);
  const topBoard = new THREE.Mesh(horizBoardGeo, ledMat);
  topBoard.position.set(0, 0.55, -halfW - 3);
  topBoard.castShadow = true;
  stadiumGroup.add(topBoard);

  const botBoard = new THREE.Mesh(horizBoardGeo, ledMat);
  botBoard.position.set(0, 0.55, halfW + 3);
  botBoard.castShadow = true;
  stadiumGroup.add(botBoard);

  // Behind goal boards (broken into 2 sections to leave goal open)
  const sideBoardGeo = new THREE.BoxGeometry(0.3, 1.1, (fieldWidth - goalWidth) / 2);
  // Left side top/bottom
  const leftBoard1 = new THREE.Mesh(sideBoardGeo, ledMat);
  leftBoard1.position.set(-halfL - 5, 0.55, -halfW / 2 - goalWidth / 4);
  stadiumGroup.add(leftBoard1);

  const leftBoard2 = new THREE.Mesh(sideBoardGeo, ledMat);
  leftBoard2.position.set(-halfL - 5, 0.55, halfW / 2 + goalWidth / 4);
  stadiumGroup.add(leftBoard2);

  // Right side top/bottom
  const rightBoard1 = new THREE.Mesh(sideBoardGeo, ledMat);
  rightBoard1.position.set(halfL + 5, 0.55, -halfW / 2 - goalWidth / 4);
  stadiumGroup.add(rightBoard1);

  const rightBoard2 = new THREE.Mesh(sideBoardGeo, ledMat);
  rightBoard2.position.set(halfL + 5, 0.55, halfW / 2 + goalWidth / 4);
  stadiumGroup.add(rightBoard2);

  // 5. Tiered Stadium Stands with Crowd Visuals
  const standColors = [0x1a2942, 0x111e33, 0x223555];
  const crowdCanvas = document.createElement('canvas');
  crowdCanvas.width = 512;
  crowdCanvas.height = 256;
  const crowdCtx = crowdCanvas.getContext('2d')!;
  // Crowd noise dots
  crowdCtx.fillStyle = '#1c2841';
  crowdCtx.fillRect(0, 0, 512, 256);
  const fanColors = ['#00d4ff', '#ff0055', '#ffffff', '#ffd700', '#202b42', '#3a506b'];
  for (let i = 0; i < 4000; i++) {
    crowdCtx.fillStyle = fanColors[Math.floor(Math.random() * fanColors.length)];
    crowdCtx.fillRect(Math.random() * 512, Math.random() * 256, 3, 4);
  }
  const crowdTex = new THREE.CanvasTexture(crowdCanvas);
  crowdTex.wrapS = THREE.RepeatWrapping;
  crowdTex.wrapT = THREE.RepeatWrapping;
  crowdTex.repeat.set(6, 2);

  const standMat = new THREE.MeshStandardMaterial({
    map: crowdTex,
    roughness: 0.8,
  });

  const standRoofMat = new THREE.MeshStandardMaterial({
    color: 0x0c1626,
    metalness: 0.8,
    roughness: 0.3,
  });

  // North Stand (top)
  const standGeo = new THREE.BoxGeometry(fieldLength + 24, 14, 18);
  const northStand = new THREE.Mesh(standGeo, standMat);
  northStand.position.set(0, 6, -halfW - 14);
  northStand.rotation.x = 0.3;
  stadiumGroup.add(northStand);

  // North Roof
  const roofGeo = new THREE.BoxGeometry(fieldLength + 28, 0.8, 16);
  const northRoof = new THREE.Mesh(roofGeo, standRoofMat);
  northRoof.position.set(0, 16, -halfW - 10);
  stadiumGroup.add(northRoof);

  // South Stand (bottom)
  const southStand = new THREE.Mesh(standGeo, standMat);
  southStand.position.set(0, 6, halfW + 14);
  southStand.rotation.x = -0.3;
  stadiumGroup.add(southStand);

  // South Roof
  const southRoof = new THREE.Mesh(roofGeo, standRoofMat);
  southRoof.position.set(0, 16, halfW + 10);
  stadiumGroup.add(southRoof);

  // West Stand (left goal side)
  const endStandGeo = new THREE.BoxGeometry(16, 14, fieldWidth + 14);
  const westStand = new THREE.Mesh(endStandGeo, standMat);
  westStand.position.set(-halfL - 14, 6, 0);
  westStand.rotation.z = -0.3;
  stadiumGroup.add(westStand);

  // East Stand (right goal side)
  const eastStand = new THREE.Mesh(endStandGeo, standMat);
  eastStand.position.set(halfL + 14, 6, 0);
  eastStand.rotation.z = 0.3;
  stadiumGroup.add(eastStand);

  // 6. 4 Massive Floodlight Towers
  const towerTrussGeo = new THREE.CylinderGeometry(0.3, 0.7, 30, 6);
  const towerMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    metalness: 0.7,
    roughness: 0.3,
  });
  const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  const addFloodlightTower = (x: number, z: number, targetX: number, targetZ: number) => {
    const tower = new THREE.Group();
    tower.position.set(x, 0, z);

    // Main column
    const mast = new THREE.Mesh(towerTrussGeo, towerMat);
    mast.position.y = 15;
    mast.castShadow = true;
    tower.add(mast);

    // Floodlight lamp array head
    const headGeo = new THREE.BoxGeometry(4.5, 3.0, 1.0);
    const headMesh = new THREE.Mesh(headGeo, towerMat);
    headMesh.position.set(0, 29, 0);
    headMesh.lookAt(targetX, 0, targetZ);
    tower.add(headMesh);

    // Glowing face
    const glowGeo = new THREE.PlaneGeometry(4.2, 2.7);
    const glowMesh = new THREE.Mesh(glowGeo, lampHeadMat);
    glowMesh.position.set(0, 29, 0.55);
    glowMesh.lookAt(targetX, 0, targetZ);
    tower.add(glowMesh);

    // Directional Spotlight onto pitch
    const spot = new THREE.SpotLight(0xfff7ea, 45, 120, Math.PI / 4, 0.45, 1.2);
    spot.position.set(x, 29, z);
    spot.target.position.set(targetX, 0, targetZ);
    stadiumGroup.add(spot.target);
    stadiumGroup.add(spot);

    stadiumGroup.add(tower);
  };

  addFloodlightTower(-halfL - 10, -halfW - 8, -20, -10);
  addFloodlightTower(halfL + 10, -halfW - 8, 20, -10);
  addFloodlightTower(-halfL - 10, halfW + 8, -20, 10);
  addFloodlightTower(halfL + 10, halfW + 8, 20, 10);

  return {
    group: stadiumGroup,
    pitchMesh,
    goals: {
      left: {
        minX: -halfL - goalDepth,
        maxX: -halfL,
        minZ: -goalWidth / 2,
        maxZ: goalWidth / 2,
        height: goalHeight,
      },
      right: {
        minX: halfL,
        maxX: halfL + goalDepth,
        minZ: -goalWidth / 2,
        maxZ: goalWidth / 2,
        height: goalHeight,
      },
    },
    fieldBounds: {
      minX: -halfL,
      maxX: halfL,
      minZ: -halfW,
      maxZ: halfW,
    },
  };
}
