// URL-driven camera presets for visual QA screenshots.
// Keeping these outside main.js makes the core game loop easier to scan.

import {
  camera, startOverlay,
  ROOM_W, ROOM_D, NL_CX
} from "../state.js";

export function applyRainQAView(initialRoom) {
  if (initialRoom !== "rain") return;
  const qaView = new URLSearchParams(window.location.search).get("qa");
  if (!qaView) return;

  const views = {
    rainEntry: {
      position: [0, 1.62, ROOM_D / 2 - 3.2],
      target: [0, 1.9, -1.0],
    },
    rainCourt: {
      position: [0.4, 1.72, 5.3],
      target: [0, 1.9, -1.0],
    },
    rainBackWall: {
      position: [0, 1.72, -4.4],
      target: [0, 2.35, -ROOM_D / 2 + 0.1],
    },
    rainNekolandDoor: {
      position: [-3.6, 1.68, 3.6],
      target: [-ROOM_W / 2 + 0.05, 1.55, 3.6],
    },
  };

  const view = views[qaView];
  if (!view) return;
  startOverlay.classList.add("mw-hidden");
  document.body.classList.add("mw-room-ready");
  camera.position.set(...view.position);
  camera.lookAt(...view.target);
}

export function applyNekolandQAView(initialRoom, { toggleDayNight }) {
  if (initialRoom !== "nekolan") return;
  const qaView = new URLSearchParams(window.location.search).get("qa");
  if (!qaView) return;

  startOverlay.classList.add("mw-hidden");
  document.body.classList.add("mw-room-ready");

  const views = {
    entry: {
      position: [NL_CX, 1.6, 11.45],
      target: [NL_CX - 2.15, 1.25, -0.65],
    },
    chef: {
      position: [NL_CX - 0.4, 1.58, 1.25],
      target: [NL_CX - 4.1, 1.25, -0.8],
    },
    cat: {
      position: [NL_CX - 0.35, 1.6, 11.25],
      target: [NL_CX - 2.15, 1.2, 9.15],
    },
    rainDoor: {
      position: [NL_CX, 1.58, 10.7],
      target: [NL_CX, 1.28, 13.95],
    },
    order: {
      position: [NL_CX - 1.4, 1.62, 2.6],
      target: [NL_CX - 3.6, 1.25, -0.6],
    },
    barSide: {
      position: [NL_CX - 1.8, 1.55, -3.8],
      target: [NL_CX - 4.8, 1.12, -0.25],
    },
    table: {
      position: [NL_CX + 0.2, 1.5, 6.2],
      target: [NL_CX - 2.4, 0.9, 6.2],
    },
    npcFace: {
      position: [NL_CX - 4.0, 1.55, -1.1],
      target: [NL_CX - 2.85, 1.55, -1.1],
    },
    seated: {
      position: [NL_CX - 1.55, 1.32, 6.2],
      target: [NL_CX - 2.72, 1.18, 6.2],
    },
    barBlocked: {
      position: [NL_CX - 2.42, 1.58, -0.2],
      target: [NL_CX - 4.05, 1.18, -0.2],
    },
  };

  const view = views[qaView];
  if (!view) return;
  camera.position.set(...view.position);
  camera.lookAt(...view.target);

  const dn = new URLSearchParams(window.location.search).get("dn");
  if (dn === "memory") toggleDayNight();
}
