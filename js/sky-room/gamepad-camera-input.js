const DISCONNECTED = Object.freeze({
  connected: false,
  id: '',
  moveX: 0,
  moveY: 0,
  lookX: 0,
  lookY: 0,
  rise: 0,
  descend: 0,
  takeoffPressed: false,
  landPressed: false,
  viewPressed: false,
  recenterPressed: false,
  interactPressed: false
});

const deadzone = (value, threshold = 0.16) => {
  const magnitude = Math.abs(Number(value) || 0);
  if (magnitude <= threshold) return 0;
  return Math.sign(value) * Math.min(1, (magnitude - threshold) / (1 - threshold));
};

const buttonDown = (gamepad, index) => {
  const button = gamepad?.buttons?.[index];
  return Boolean(button?.pressed || (Number(button?.value) || 0) > 0.5);
};

export function createGamepadCameraInput(getGamepads = () => navigator.getGamepads?.() || []) {
  const previous = { takeoff: false, land: false, view: false, recenter: false, interact: false };
  const state = { ...DISCONNECTED };

  const reset = () => {
    previous.takeoff = previous.land = previous.view = previous.recenter = previous.interact = false;
    Object.assign(state, DISCONNECTED);
    return state;
  };

  return {
    sample() {
      const gamepads = getGamepads?.() || [];
      const gamepad = Array.from(gamepads).find(candidate => candidate?.connected !== false && candidate?.mapping === 'standard')
        || Array.from(gamepads).find(candidate => candidate?.connected !== false);
      if (!gamepad) return reset();

      const takeoff = buttonDown(gamepad, 0); // A / Cross
      const land = buttonDown(gamepad, 1);    // B / Circle
      const view = buttonDown(gamepad, 3);    // Y / Triangle
      const recenter = buttonDown(gamepad, 10); // right stick / R3
      const interact = buttonDown(gamepad, 2); // X / Square
      state.connected = true;
      state.id = gamepad.id || 'standard gamepad';
      state.moveX = deadzone(gamepad.axes?.[0]);
      state.moveY = -deadzone(gamepad.axes?.[1]);
      state.lookX = deadzone(gamepad.axes?.[2]);
      state.lookY = deadzone(gamepad.axes?.[3]);
      state.rise = Math.max(takeoff ? 1 : 0, buttonDown(gamepad, 5) ? 1 : 0);    // A or RB
      state.descend = Math.max(land ? 1 : 0, buttonDown(gamepad, 4) ? 1 : 0);   // B or LB
      state.takeoffPressed = takeoff && !previous.takeoff;
      state.landPressed = land && !previous.land;
      state.viewPressed = view && !previous.view;
      state.recenterPressed = recenter && !previous.recenter;
      state.interactPressed = interact && !previous.interact;
      previous.takeoff = takeoff;
      previous.land = land;
      previous.view = view;
      previous.recenter = recenter;
      previous.interact = interact;
      return state;
    },
    reset
  };
}

export { deadzone as applyGamepadDeadzone };
