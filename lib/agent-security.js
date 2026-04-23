import sql from '@/lib/db';

export async function ensureActiveUser(userId) {
  const [user] = await sql`
    SELECT id
    FROM users
    WHERE id = ${userId}
      AND status = 'active'
    LIMIT 1
  `;

  return user || null;
}

export async function ensureDeviceBelongsToUser(deviceId, userId) {
  const [device] = await sql`
    SELECT d.id, d.user_id
    FROM devices d
    JOIN users u ON u.id = d.user_id
    WHERE d.id = ${deviceId}
      AND d.user_id = ${userId}
      AND u.status = 'active'
    LIMIT 1
  `;

  return device || null;
}

export async function ensureDeviceExists(deviceId) {
  const [device] = await sql`
    SELECT id, user_id
    FROM devices
    WHERE id = ${deviceId}
    LIMIT 1
  `;

  return device || null;
}
