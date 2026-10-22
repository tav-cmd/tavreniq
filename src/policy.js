export function duration(value) {
  const match = /^(\d+)(s|m|h|d)$/.exec(value || '');
  if (!match) throw new Error('Use a duration such as 10m, 2h, or 1d.');
  const ms = Number(match[1]) * {s:1000,m:60000,h:3600000,d:86400000}[match[2]];
  if (!Number.isSafeInteger(ms) || ms < 1000 || ms > 28 * 86400000) throw new Error('Timeout must be between 1 second and 28 days.');
  return ms;
}
export function hierarchy({actorId, targetId, ownerId, botId, actorRank, targetRank, botRank}) {
  if ([actorId, ownerId, botId].includes(targetId)) throw new Error('You cannot moderate yourself, the server owner, or this bot.');
  if (actorId !== ownerId && actorRank <= targetRank) throw new Error('That member has an equal or higher role than you.');
  if (botRank <= targetRank) throw new Error('Move my role above the target member’s highest role first.');
}
export function parseAction(text) {
  const match = /^(timeout|untimeout|kick|ban|warn)\s+<@!?(\d{17,20})>(?:\s+([\s\S]+))?$/i.exec(text.trim());
  if (!match) return null;
  const [, raw, userId, rest = ''] = match;
  const action = raw.toLowerCase();
  if (action === 'timeout') {
    const [time, ...reason] = rest.split(/\s+/);
    duration(time);
    return {action, userId, duration:time, reason:reason.join(' ') || 'No reason provided'};
  }
  return {action, userId, reason:rest || 'No reason provided'};
}
