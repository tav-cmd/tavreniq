import {PermissionFlagsBits as P} from 'discord.js';
import {duration,hierarchy} from './policy.js';
import {warn,warnings,log} from './store.js';
const required = {warn:P.ModerateMembers,warnings:P.ModerateMembers,timeout:P.ModerateMembers,untimeout:P.ModerateMembers,kick:P.KickMembers,ban:P.BanMembers,unban:P.BanMembers,purge:P.ManageMessages,role:P.ManageRoles};
const privileged = P.Administrator | P.ManageGuild | P.ManageRoles | P.ManageChannels | P.ManageWebhooks | P.BanMembers | P.KickMembers | P.ModerateMembers | P.ManageMessages | P.MentionEveryone;
export async function moderate(guild, channel, actorId, input) {
  const {action,userId} = input;
  if (!required[action]) throw new Error('Unknown moderation action.');
  const actor = await guild.members.fetch({user:actorId,force:true});
  const me = await guild.members.fetchMe({force:true});
  if (!actor.permissions.has(required[action])) throw new Error('You do not have permission to use that command.');
  if (!me.permissions.has(required[action])) throw new Error('I am missing the required Discord permission.');
  const reason = (input.reason || 'No reason provided').slice(0,400);
  const auditReason = `${actor.user.tag} (${actor.id}): ${reason}`.slice(0,512);
  let result;
  if(action === 'purge') {
    if (!channel.isTextBased() || typeof channel.bulkDelete !== 'function') throw new Error('Use this in a server text channel.');
    if(!channel.permissionsFor(actor)?.has(P.ManageMessages) || !channel.permissionsFor(me)?.has([P.ManageMessages,P.ReadMessageHistory,P.ViewChannel])) throw new Error('Missing permissions in this channel.');
    if(!Number.isInteger(input.count) || input.count<1 || input.count>100) throw new Error('Count must be 1–100.');
    result = `Deleted ${(await channel.bulkDelete(input.count,true)).size} messages. Messages over 14 days old are skipped.`;
  } else if(action === 'unban') {
    if(!/^\d{17,20}$/.test(userId || '')) throw new Error('Enter a valid Discord user ID.');
    await guild.bans.remove(userId,auditReason);
    result = `Unbanned user ${userId}.`;
  } else if(action === 'warnings') {
    const rows = warnings(guild.id,userId);
    return rows.length ? rows.map(w=>`#${w.id} • ${w.created.slice(0,10)} • ${w.reason}`).join('\n') : 'No warnings recorded for this member.';
  } else {
    const target = await guild.members.fetch({user:userId,force:true}).catch(()=>null);
    if(!target) throw new Error('That member is not in this server.');
    hierarchy({actorId,targetId:target.id,ownerId:guild.ownerId,botId:me.id,actorRank:actor.roles.highest.position,targetRank:target.roles.highest.position,botRank:me.roles.highest.position});
    if(action === 'warn') result = `Warning #${warn(guild.id,userId,actorId,reason)} recorded for ${target.user.tag}.`;
    if(action === 'timeout' || action === 'untimeout') {
      if(!target.moderatable) throw new Error('Discord does not allow me to timeout this member.');
      await target.timeout(action === 'timeout' ? duration(input.duration) : null,auditReason);
      result = action === 'timeout' ? `${target.user.tag} timed out for ${input.duration}.` : `Timeout removed for ${target.user.tag}.`;
    }
    if(action === 'kick') {
      if(!target.kickable) throw new Error('I cannot kick this member.');
      await target.kick(auditReason); result = `Kicked ${target.user.tag}.`;
    }
    if(action === 'ban') {
      if(!target.bannable) throw new Error('I cannot ban this member.');
      await target.ban({reason:auditReason}); result = `Banned ${target.user.tag}.`;
    }
    if(action === 'role') {
      const role = await guild.roles.fetch(input.roleId);
      if(!role || role.id === guild.id || role.managed) throw new Error('That role cannot be managed.');
      if(role.permissions.any(privileged)) throw new Error('Manage administrative or moderation roles directly in Discord.');
      if(role.comparePositionTo(me.roles.highest)>=0 || (actor.id!==guild.ownerId && role.comparePositionTo(actor.roles.highest)>=0)) throw new Error('That role is too high for you or me to manage.');
      if(!['add','remove'].includes(input.roleAction)) throw new Error('Choose add or remove.');
      await target.roles[input.roleAction](role,auditReason);
      result = `${input.roleAction === 'add' ? 'Added' : 'Removed'} ${role.name} ${input.roleAction==='add'?'for':'from'} ${target.user.tag}.`;
    }
  }
  try { log(guild.id,actorId,action,userId || channel.id,reason); }
  catch { console.error('Audit storage failed after successful moderation.'); return `${result}\nWarning: audit record could not be saved.`; }
  return result;
}
