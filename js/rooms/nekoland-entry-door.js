// Lightweight Rain Room doorway into Nekoland.
// This stays separate from the full Nekoland scene so Rain Room does not load
// the large ramen-shop module until the player actually enters that room.

import * as THREE from "three";
import { scene, ROOM_W, S } from "../state.js";

export function buildNKEntryDoor() {
  const doorX = -ROOM_W / 2 + 0.05;
  const doorZ = 3.6;

  S.nkEntryDoor = new THREE.Mesh(
    new THREE.PlaneGeometry(1.05, 2.15),
    new THREE.MeshBasicMaterial({ color: 0x1a0c06 })
  );
  S.nkEntryDoor.rotation.y = Math.PI / 2;
  S.nkEntryDoor.position.set(doorX, 1.08, doorZ);
  scene.add(S.nkEntryDoor);

  S.nkEntryGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 2.7),
    new THREE.MeshBasicMaterial({ color: 0xc83020, transparent: true, opacity: 0.16, depthWrite: false })
  );
  S.nkEntryGlow.rotation.y = Math.PI / 2;
  S.nkEntryGlow.position.set(doorX + 0.01, 1.2, doorZ);
  scene.add(S.nkEntryGlow);

  const fMat = new THREE.MeshStandardMaterial({ color: 0x4a1a0a, roughness: 0.7, metalness: 0.2 });
  const fw = 0.04, doorW = 1.05, doorH = 2.15;
  [new THREE.BoxGeometry(doorW + fw * 2, fw, 0.02), new THREE.BoxGeometry(doorW + fw * 2, fw, 0.02)].forEach((geo, i) => {
    const m = new THREE.Mesh(geo, fMat);
    m.rotation.y = Math.PI / 2;
    m.position.set(doorX, i === 0 ? 1.08 + doorH / 2 + fw / 2 : 1.08 - doorH / 2 - fw / 2, doorZ);
    scene.add(m);
  });
  [new THREE.BoxGeometry(fw, doorH, 0.02), new THREE.BoxGeometry(fw, doorH, 0.02)].forEach((geo, i) => {
    const m = new THREE.Mesh(geo, fMat);
    m.rotation.y = Math.PI / 2;
    m.position.set(doorX, 1.08, i === 0 ? doorZ - doorW / 2 - fw / 2 : doorZ + doorW / 2 + fw / 2);
    scene.add(m);
  });

  S.nkEntrySpot = new THREE.SpotLight(0xff6030, 2.0, 7, Math.PI / 4.5, 0.72, 1.25);
  S.nkEntrySpot.position.set(doorX + 1.8, 2.6, doorZ);
  const nkT = new THREE.Object3D();
  nkT.position.set(doorX, 1.08, doorZ);
  scene.add(nkT);
  S.nkEntrySpot.target = nkT;
  scene.add(S.nkEntrySpot);

  const signCanvas = document.createElement("canvas");
  signCanvas.width = 400;
  signCanvas.height = 100;
  const sc = signCanvas.getContext("2d");
  sc.clearRect(0, 0, 400, 100);
  sc.font = "bold 52px Georgia, serif";
  sc.fillStyle = "#ff3a3a";
  sc.shadowColor = "#ff3a3a";
  sc.shadowBlur = 22;
  sc.textAlign = "center";
  sc.fillText("Nekoland", 200, 70);
  const signTex = new THREE.CanvasTexture(signCanvas);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 0.14),
    new THREE.MeshBasicMaterial({ map: signTex, transparent: true })
  );
  sign.rotation.y = Math.PI / 2;
  sign.position.set(doorX + 0.02, 1.08 + doorH / 2 + 0.14, doorZ);
  scene.add(sign);

  S.nkEntryDoorObj = { position: S.nkEntryDoor.position, type: "nkEntry" };
}
