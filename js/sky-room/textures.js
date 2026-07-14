 import * as THREE from 'three';
 
 function lancetPath(ctx, x, y, w, h) {
   ctx.beginPath();
   ctx.moveTo(x, y + h);
   ctx.lineTo(x, y + h * 0.38);
   ctx.quadraticCurveTo(x + w / 2, y - h * 0.08, x + w, y + h * 0.38);
   ctx.lineTo(x + w, y + h);
   ctx.closePath();
 }
 
 export function radialTexture(inner, outer, size = 256) {
   const c = document.createElement('canvas');
   c.width = c.height = size;
   const g = c.getContext('2d');
   const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
   grad.addColorStop(0, inner);
   grad.addColorStop(1, outer);
   g.fillStyle = grad;
   g.fillRect(0, 0, size, size);
   const tex = new THREE.CanvasTexture(c);
   tex.colorSpace = THREE.SRGBColorSpace;
   return tex;
 }
 
 // a real moon: sunlit disc with limb shading, dark maria, rim-lit craters
 export function moonTexture() {
   const S = 256;
   const c = document.createElement('canvas');
   c.width = c.height = S;
   const g = c.getContext('2d');
   let s = 20260709;
   const r = () => (s = (s * 48271) % 2147483647) / 2147483647;
   const cx = S / 2, cy = S / 2, R = 108;
 
   const disc = g.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
   disc.addColorStop(0, '#fdfaf0');
   disc.addColorStop(0.72, '#e8e4d6');
   disc.addColorStop(1, '#b9b7ae');
   g.fillStyle = disc;
   g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
 
   const mare = (x, y, rx, ry, rot, a) => {
     g.save(); g.translate(cx + x, cy + y); g.rotate(rot);
     g.fillStyle = `rgba(126,128,138,${a})`;
     g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); g.fill();
     g.restore();
   };
   mare(-26, -30, 40, 26, 0.5, 0.16);
   mare(22, -8, 30, 34, -0.3, 0.13);
   mare(-8, 34, 34, 20, 0.2, 0.12);
   mare(38, 30, 16, 12, 0, 0.1);
 
   for (let i = 0; i < 26; i++) {
     const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R * 0.82;
     const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
     const cr = 2 + r() * 7;
     g.fillStyle = `rgba(110,112,124,${0.08 + r() * 0.12})`;
     g.beginPath(); g.arc(x, y, cr, 0, Math.PI * 2); g.fill();
     g.strokeStyle = `rgba(255,252,240,${0.1 + r() * 0.14})`; // sun-catching rim
     g.lineWidth = 1.2;
     g.beginPath(); g.arc(x, y, cr, -2.4, -0.6); g.stroke();
   }
 
   // soft edge falloff so the disc melts into the night sky
   const edge = g.createRadialGradient(cx, cy, R * 0.86, cx, cy, R);
   edge.addColorStop(0, 'rgba(10,10,16,0)');
   edge.addColorStop(1, 'rgba(10,10,16,0.32)');
   g.fillStyle = edge;
   g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
 
   const tex = new THREE.CanvasTexture(c);
   tex.colorSpace = THREE.SRGBColorSpace;
   return tex;
 }
 
 // wispy horizontal cloud streak from overlapping soft blobs
 export function cloudTexture() {
   const c = document.createElement('canvas');
   c.width = 256; c.height = 128;
   const g = c.getContext('2d');
   let s = 1337;
   const r = () => (s = (s * 48271) % 2147483647) / 2147483647;
   for (let i = 0; i < 26; i++) {
     const x = 30 + r() * 196, y = 40 + r() * 48, rad = 14 + r() * 30;
     const gr = g.createRadialGradient(x, y, 0, x, y, rad);
     gr.addColorStop(0, `rgba(255,255,255,${0.05 + r() * 0.09})`);
     gr.addColorStop(1, 'rgba(255,255,255,0)');
     g.fillStyle = gr;
     g.fillRect(0, 0, 256, 128);
   }
   const tex = new THREE.CanvasTexture(c);
   tex.colorSpace = THREE.SRGBColorSpace;
   return tex;
 }
 
 // Coordinated albedo / height / roughness maps for old, damp castle flagstones.
 // Keeping the maps in sync is what makes joints recess instead of looking drawn on.
export function ancientGroundTextures(renderer) {
   const S = 768;
   const albedo = document.createElement('canvas');
   const height = document.createElement('canvas');
   const rough = document.createElement('canvas');
   albedo.width = albedo.height = height.width = height.height = rough.width = rough.height = S;
   const a = albedo.getContext('2d'), h = height.getContext('2d'), q = rough.getContext('2d');
   let seed = 91357;
   const r = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
 
   a.fillStyle = '#0d1017'; a.fillRect(0, 0, S, S);
   h.fillStyle = '#282828'; h.fillRect(0, 0, S, S);
   q.fillStyle = '#f0f0f0'; q.fillRect(0, 0, S, S);
 
   const rowH = 82;
   for (let row = -1; row < 11; row++) {
     const y = row * rowH;
     const offset = row % 2 ? -70 : -5;
     for (let col = -1; col < 8; col++) {
       const x = offset + col * 118;
       const inset = 4 + r() * 3;
       const pts = [
         [x + inset + r() * 5, y + inset + r() * 5],
         [x + 112 - inset - r() * 6, y + inset + r() * 4],
         [x + 112 - inset - r() * 5, y + rowH - inset - r() * 5],
         [x + inset + r() * 6, y + rowH - inset - r() * 4]
       ];
       const path = g => {
         g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
         for (let p = 1; p < pts.length; p++) g.lineTo(pts[p][0], pts[p][1]);
         g.closePath();
       };
       const tone = 25 + Math.floor(r() * 17);
       path(a); a.fillStyle = `rgb(${tone},${tone + 3},${tone + 10})`; a.fill();
       path(h); h.fillStyle = `rgb(${142 + r() * 34},${142 + r() * 34},${142 + r() * 34})`; h.fill();
       path(q); q.fillStyle = `rgb(${205 + r() * 42},${205 + r() * 42},${205 + r() * 42})`; q.fill();
 
       // Worn edges catch a thin line of moonlight; the interior stays porous and matte.
       path(a); a.strokeStyle = 'rgba(132,145,174,0.13)'; a.lineWidth = 1.4; a.stroke();
       if (r() < 0.35) {
         const cx = x + 22 + r() * 68, cy = y + 18 + r() * 42;
         a.strokeStyle = 'rgba(3,4,7,0.62)'; a.lineWidth = 1 + r() * 1.5;
         h.strokeStyle = '#343434'; h.lineWidth = 2.5;
         a.beginPath(); h.beginPath();
         a.moveTo(cx, cy); h.moveTo(cx, cy);
         for (let k = 1; k < 4; k++) {
           const px = cx + k * (8 + r() * 6), py = cy + (r() - 0.5) * 18;
           a.lineTo(px, py); h.lineTo(px, py);
         }
         a.stroke(); h.stroke();
       }
     }
   }
 
   // Mineral blooms, soot and moss live mostly in the mortar and low spots.
   for (let i = 0; i < 90; i++) {
     const x = r() * S, y = r() * S, rad = 8 + r() * 38;
     const stain = a.createRadialGradient(x, y, 0, x, y, rad);
     stain.addColorStop(0, r() < 0.55 ? 'rgba(18,32,27,0.22)' : 'rgba(5,5,8,0.26)');
     stain.addColorStop(1, 'rgba(0,0,0,0)');
     a.fillStyle = stain; a.fillRect(x - rad, y - rad, rad * 2, rad * 2);
   }
   for (let i = 0; i < 7200; i++) {
     const x = r() * S, y = r() * S, v = r();
     a.fillStyle = v < 0.5 ? 'rgba(175,184,205,0.035)' : 'rgba(0,0,0,0.09)';
     a.fillRect(x, y, 1 + r() * 1.5, 1 + r() * 1.5);
     h.fillStyle = v < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)';
     h.fillRect(x, y, 1.2, 1.2);
   }
 
   const make = (canvas, color = false) => {
     const tex = new THREE.CanvasTexture(canvas);
     if (color) tex.colorSpace = THREE.SRGBColorSpace;
     tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
     tex.repeat.set(19, 19);
     tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
     return tex;
   };
   return { map: make(albedo, true), bumpMap: make(height), roughnessMap: make(rough) };
 }
 
export function addGroundDebris(scene) {
   const geo = new THREE.DodecahedronGeometry(0.13, 0);
   const mat = new THREE.MeshStandardMaterial({ color: 0x252a34, roughness: 1, metalness: 0 });
   const count = 360;
   const chips = new THREE.InstancedMesh(geo, mat, count);
   const dummy = new THREE.Object3D();
   let seed = 27182;
   const r = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
   for (let i = 0; i < count; i++) {
     const radius = 16 + Math.sqrt(r()) * 150;
     const angle = r() * Math.PI * 2;
     dummy.position.set(Math.cos(angle) * radius, 0.02 + r() * 0.06, Math.sin(angle) * radius);
     dummy.rotation.set(r() * Math.PI, r() * Math.PI, r() * Math.PI);
     const scale = 0.35 + r() * 1.9;
     dummy.scale.set(scale * (0.8 + r()), scale * (0.25 + r() * 0.45), scale);
     dummy.updateMatrix();
     chips.setMatrixAt(i, dummy.matrix);
   }
   chips.receiveShadow = true;
   chips.castShadow = false;
   scene.add(chips);
 }
 
 // slab rows for the causeway; v-axis repeats along its length
 export function causewayTexture(len) {
   const tex = canvasTex(128, 256, (g, r) => {
     g.fillStyle = '#20232f'; g.fillRect(0, 0, 128, 256);
     for (let y = 0; y < 256; y += 32) {
       const off = (y / 32) % 2 ? 32 : 0;
       for (let x = -32; x < 128; x += 64) {
         const tone = 30 + r() * 16;
         g.fillStyle = `rgb(${tone + 4},${tone + 6},${tone + 18})`;
         g.fillRect(x + off + 2, y + 2, 60, 28);
       }
     }
     for (let i = 0; i < 240; i++) {
       g.fillStyle = `rgba(${r() < 0.5 ? '190,200,235' : '0,0,0'},${0.02 + r() * 0.05})`;
       g.fillRect(r() * 128, r() * 256, 1.6, 1.6);
     }
   });
   tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
   tex.repeat.set(1, Math.max(2, len / 5.5));
   return tex;
 }
 
 /* ---------- great-hall interior textures ---------- */
 export function canvasTex(w, h, draw) {
   const c = document.createElement('canvas');
   c.width = w; c.height = h;
   let s = 4242;
   draw(c.getContext('2d'), () => (s = (s * 48271) % 2147483647) / 2147483647);
   const tex = new THREE.CanvasTexture(c);
   tex.colorSpace = THREE.SRGBColorSpace;
   return tex;
 }
 
 export function campusGrassTexture() {
   return canvasTex(256, 256, (g, r) => {
     const grad = g.createLinearGradient(0, 0, 256, 256);
     grad.addColorStop(0, '#61715b');
     grad.addColorStop(0.5, '#52654f');
     grad.addColorStop(1, '#71806a');
     g.fillStyle = grad;
     g.fillRect(0, 0, 256, 256);
     for (let i = 0; i < 1800; i++) {
       const x = r() * 256, y = r() * 256;
       const light = r() > 0.58;
       g.strokeStyle = light
         ? `rgba(178,194,151,${0.04 + r() * 0.1})`
         : `rgba(18,34,22,${0.05 + r() * 0.12})`;
       g.lineWidth = 0.45 + r() * 0.7;
       g.beginPath();
       g.moveTo(x, y + 1.8 + r() * 2.8);
       g.lineTo(x + (r() - 0.5) * 2.2, y);
       g.stroke();
     }
     // broad, quiet mowing bands stop the repeated texture reading as noise.
     for (let y = 0; y < 256; y += 32) {
       g.fillStyle = (y / 32) % 2 ? 'rgba(210,220,184,0.018)' : 'rgba(10,25,15,0.018)';
       g.fillRect(0, y, 256, 32);
     }
   });
 }
 
 export function campusBannerTexture() {
   return canvasTex(192, 384, (g, r) => {
     g.clearRect(0, 0, 192, 384);
     const grad = g.createLinearGradient(0, 0, 192, 384);
     grad.addColorStop(0, '#5e357c');
     grad.addColorStop(1, '#2b193e');
     g.fillStyle = grad;
     g.fillRect(8, 0, 176, 350);
     g.beginPath();
     g.moveTo(8, 350); g.lineTo(96, 310); g.lineTo(184, 350); g.lineTo(184, 0); g.lineTo(8, 0);
     g.closePath(); g.fill();
     g.strokeStyle = 'rgba(222,190,125,0.8)';
     g.lineWidth = 5; g.strokeRect(15, 14, 162, 285);
     g.fillStyle = 'rgba(242,224,190,0.92)';
     g.font = '700 24px sans-serif';
     g.textAlign = 'center';
     g.fillText('11:47', 96, 74);
     g.font = '16px serif';
     g.letterSpacing = '4px';
     g.fillText('SKY COURT', 96, 112);
     g.strokeStyle = 'rgba(242,224,190,0.78)';
     g.lineWidth = 3;
     g.beginPath(); g.arc(96, 190, 48, 0, Math.PI * 2); g.stroke();
     g.beginPath(); g.arc(96, 190, 29, 0, Math.PI * 2); g.stroke();
     for (let i = 0; i < 220; i++) {
       g.fillStyle = `rgba(255,255,255,${r() * 0.025})`;
       g.fillRect(10 + r() * 172, r() * 330, 1, 4 + r() * 10);
     }
   });
 }
 
 // warm-grey ashlar courses for the hall walls
 export function interiorStoneTexture() {
   return canvasTex(256, 256, (g, r) => {
     g.fillStyle = '#2a2636'; g.fillRect(0, 0, 256, 256);
     for (let y = 0; y < 256; y += 16) {
       g.fillStyle = 'rgba(0,0,0,0.32)';
       g.fillRect(0, y, 256, 1.6);
       const off = (y / 16) % 2 ? 16 : 0;
       for (let x = -off; x < 256; x += 32) {
         g.fillStyle = 'rgba(0,0,0,0.22)';
         g.fillRect(x + off, y, 1.4, 16);
         g.fillStyle = r() < 0.4 ? `rgba(214,182,140,${r() * 0.05})` : `rgba(150,160,210,${r() * 0.05})`;
         g.fillRect(x + off + 1, y + 1.6, 30, 14);
       }
     }
   });
 }
 
 // big two-tone stone slabs for the hall floor
 export function floorTileTexture() {
   return canvasTex(256, 256, (g, r) => {
     for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 4; tx++) {
       g.fillStyle = (tx + ty) % 2 ? '#2c2836' : '#232030';
       g.fillRect(tx * 64, ty * 64, 64, 64);
       g.fillStyle = `rgba(${r() < 0.5 ? '190,180,220' : '0,0,0'},${0.02 + r() * 0.05})`;
       g.fillRect(tx * 64 + 3, ty * 64 + 3, 58, 58);
       g.strokeStyle = 'rgba(0,0,0,0.4)';
       g.lineWidth = 2;
       g.strokeRect(tx * 64 + 1, ty * 64 + 1, 62, 62);
     }
   });
 }
 
 // dark oak planks for the ceiling
 export function ceilingWoodTexture() {
   return canvasTex(256, 128, (g, r) => {
     g.fillStyle = '#20150d'; g.fillRect(0, 0, 256, 128);
     for (let y = 0; y < 128; y += 16) {
       g.fillStyle = 'rgba(0,0,0,0.45)';
       g.fillRect(0, y, 256, 1.5);
       for (let i = 0; i < 8; i++) {
         g.fillStyle = `rgba(120,80,40,${r() * 0.08})`;
         g.fillRect(r() * 256, y + 2, 20 + r() * 60, 12);
       }
     }
   });
 }
 
 // deep red aisle runner with gold borders and diamond motifs
 export function carpetTexture() {
   return canvasTex(128, 512, (g, r) => {
     g.fillStyle = '#471016'; g.fillRect(0, 0, 128, 512);
     for (let i = 0; i < 500; i++) {
       g.fillStyle = `rgba(20,4,6,${r() * 0.25})`;
       g.fillRect(r() * 128, r() * 512, 2.5, 2.5);
     }
     g.strokeStyle = '#b08a46';
     g.lineWidth = 3; g.strokeRect(7, 7, 114, 498);
     g.lineWidth = 1.5; g.strokeRect(14, 14, 100, 484);
     g.save();
     g.strokeStyle = 'rgba(176,138,70,0.75)';
     g.lineWidth = 2;
     for (let y = 44; y < 490; y += 78) {
       g.beginPath();
       g.moveTo(64, y - 20); g.lineTo(84, y); g.lineTo(64, y + 20); g.lineTo(44, y);
       g.closePath(); g.stroke();
       g.beginPath(); g.arc(64, y, 5, 0, Math.PI * 2); g.stroke();
     }
     g.restore();
   });
 }
 
 // hanging banner with gold trim, emblem, and swallowtail bottom (transparent)
 export function bannerTexture(fieldColor) {
   return canvasTex(128, 320, (g, r) => {
     g.clearRect(0, 0, 128, 320);
     g.beginPath();
     g.moveTo(6, 0); g.lineTo(122, 0); g.lineTo(122, 268);
     g.lineTo(64, 236); g.lineTo(6, 268);
     g.closePath();
     g.fillStyle = fieldColor; g.fill();
     g.strokeStyle = '#b08a46'; g.lineWidth = 4; g.stroke();
     g.strokeStyle = 'rgba(176,138,70,0.9)';
     g.lineWidth = 2.5;
     g.beginPath(); g.arc(64, 96, 34, 0, Math.PI * 2); g.stroke();
     g.beginPath(); g.arc(64, 96, 22, 0, Math.PI * 2); g.stroke();
     g.beginPath(); g.moveTo(64, 62); g.lineTo(64, 130); g.stroke();
     g.beginPath(); g.moveTo(42, 82); g.lineTo(86, 110); g.stroke();
     g.beginPath(); g.moveTo(86, 82); g.lineTo(42, 110); g.stroke();
     for (let i = 0; i < 260; i++) { // cloth weave
       g.fillStyle = `rgba(0,0,0,${r() * 0.12})`;
       g.fillRect(8 + r() * 112, r() * 262, 2, 2);
     }
   });
 }
 
 // oak door panel with iron straps and studs
 export function doorWoodTexture() {
   return canvasTex(128, 256, (g, r) => {
     g.fillStyle = '#3a2817'; g.fillRect(0, 0, 128, 256);
     for (let x = 0; x < 128; x += 22) {
       g.fillStyle = 'rgba(0,0,0,0.4)';
       g.fillRect(x, 0, 1.6, 256);
       for (let i = 0; i < 6; i++) {
         g.fillStyle = `rgba(140,95,50,${r() * 0.1})`;
         g.fillRect(x + 2, r() * 256, 18, 12 + r() * 30);
       }
     }
     for (const y of [42, 128, 214]) { // iron straps
       g.fillStyle = '#15151c';
       g.fillRect(0, y - 7, 128, 14);
       for (let x = 10; x < 128; x += 24) {
         g.fillStyle = '#2c2c38';
         g.beginPath(); g.arc(x, y, 3.4, 0, Math.PI * 2); g.fill();
       }
     }
   });
 }
 
 // firebox interior: sooty bricks over a bed of glowing coals
 export function fireBackTexture() {
   return canvasTex(128, 128, (g, r) => {
     g.fillStyle = '#0a0708'; g.fillRect(0, 0, 128, 128);
     for (let y = 0; y < 128; y += 14) {
       const off = (y / 14) % 2 ? 12 : 0;
       for (let x = -12; x < 128; x += 24) {
         g.fillStyle = `rgba(60,40,36,${0.25 + r() * 0.2})`;
         g.fillRect(x + off + 1, y + 1, 22, 12);
       }
     }
     const glow = g.createRadialGradient(64, 118, 4, 64, 118, 84);
     glow.addColorStop(0, 'rgba(255,170,70,0.95)');
     glow.addColorStop(0.4, 'rgba(220,90,30,0.5)');
     glow.addColorStop(1, 'rgba(120,30,10,0)');
     g.fillStyle = glow; g.fillRect(0, 0, 128, 128);
   });
 }
 
 // moonlit lancet pane with stone tracery (transparent around the arch)
export function windowPaneTexture() {
   return canvasTex(64, 224, (g) => {
     g.clearRect(0, 0, 64, 224);
     const grad = g.createLinearGradient(0, 0, 0, 224);
     grad.addColorStop(0, 'rgba(200,214,248,0.95)');
     grad.addColorStop(1, 'rgba(120,140,190,0.75)');
     g.fillStyle = grad;
     lancetPath(g, 6, 6, 52, 212);
     g.fill();
     g.strokeStyle = 'rgba(10,10,18,0.85)';
     g.lineWidth = 3;
     g.beginPath(); g.moveTo(32, 10); g.lineTo(32, 218); g.stroke();
     for (const y of [64, 118, 172]) {
       g.beginPath(); g.moveTo(8, y); g.lineTo(56, y); g.stroke();
     }
     g.lineWidth = 4;
     lancetPath(g, 6, 6, 52, 212);
     g.stroke();
   });
 }
 
 /* ================= MobileControls ================= */
 
 
