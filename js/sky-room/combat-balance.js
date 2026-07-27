const freezeEntries = values => Object.freeze(Object.fromEntries(
  Object.entries(values).map(([key, value]) => [key, Object.freeze(value)])
));

export const ENEMY_ARCHETYPES = freezeEntries({
  stray: { hp: 11, detect: 40, seek: 7.8, dive: 18, turn: 1.25, windup: 0.85, hitRadius: 1.35, damage: 18, corruption: 8 },
  groundskeeper: { hp: 32, detect: 55, seek: 4.8, dive: 10.5, turn: 0.72, windup: 1.15, hitRadius: 2.05, damage: 24, corruption: 13 },
  bellwarden: { hp: 160, detect: 85, seek: 5.4, dive: 13, turn: 0.48, windup: 1.5, hitRadius: 2.5, damage: 32, corruption: 19 }
});

export const WEAPON_PROFILES = freezeEntries({
  ember: { id: 1, damage: 1, projectilesPerVolley: 1, cooldown: 0.3, drawTime: 0, speed: 42, ttl: 1.6, scale: 1, radius: 1.9 },
  scatter: { id: 2, damage: 0.65, pellets: 5, projectilesPerVolley: 4, cooldown: 0.9, drawTime: 0, speed: 34, ttl: 0.8, scale: 0.6, radius: 1.5 },
  moonbow: { id: 3, damageMin: 1.4, damageMax: 3, projectilesPerVolley: 1, cooldown: 0.8, drawTime: 1.1, speedMin: 55, speedMax: 130, ttl: 2.4, scaleMin: 0.55, scaleMax: 1.05, radiusMin: 1.6, radiusMax: 2.6, stretch: 5 }
});

export function idealTimeToKill(enemyType, weaponType, charge = 1) {
  const enemy = ENEMY_ARCHETYPES[enemyType];
  const weapon = WEAPON_PROFILES[weaponType];
  if (!enemy || !weapon) return null;
  const power = Math.max(0.12, Math.min(1, Number(charge) || 0));
  const damage = weaponType === 'moonbow'
    ? weapon.damageMin + (weapon.damageMax - weapon.damageMin) * power
    : weapon.damage * weapon.projectilesPerVolley;
  const volleys = Math.ceil(enemy.hp / damage);
  const interval = weapon.cooldown + weapon.drawTime;
  const seconds = weapon.drawTime + Math.max(0, volleys - 1) * interval;
  return Object.freeze({ enemy: enemyType, weapon: weaponType, damage, volleys, seconds });
}
