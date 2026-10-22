import {SlashCommandBuilder, PermissionFlagsBits as P} from 'discord.js';
const base = (name,description,perm) => {
  const cmd = new SlashCommandBuilder().setName(name).setDescription(description).setDMPermission(false);
  if(perm) cmd.setDefaultMemberPermissions(perm);
  return cmd;
};
const user = c => c.addUserOption(o=>o.setName('user').setDescription('Target member').setRequired(true));
const reason = c => c.addStringOption(o=>o.setName('reason').setDescription('Reason for this action').setMaxLength(400));
export const commands = [
  base('help','View commands and chat instructions'),
  base('ping','Check bot latency'),
  base('invite','Get the bot invite link'),
  base('ask','Chat privately with TAVRENIQ').addStringOption(o=>o.setName('message').setDescription('Your message').setMaxLength(4000).setRequired(true)),
  base('forget','Clear your AI conversation in this channel'),
  reason(user(base('warn','Record a warning',P.ModerateMembers))),
  user(base('warnings','View the latest 10 warnings',P.ModerateMembers)),
  reason(user(base('timeout','Temporarily mute a member',P.ModerateMembers)).addStringOption(o=>o.setName('duration').setDescription('10m, 2h, 1d (maximum 28 days)').setRequired(true))),
  reason(user(base('untimeout','Remove a timeout',P.ModerateMembers))),
  reason(user(base('kick','Kick a member',P.KickMembers))),
  reason(user(base('ban','Ban a member',P.BanMembers))),
  reason(base('unban','Unban a user by ID',P.BanMembers).addStringOption(o=>o.setName('user_id').setDescription('Discord user ID').setRequired(true))),
  base('purge','Delete recent messages (under 14 days old)',P.ManageMessages).addIntegerOption(o=>o.setName('count').setDescription('Number of messages').setMinValue(1).setMaxValue(100).setRequired(true)),
  reason(user(base('role','Add or remove a non-administrative role',P.ManageRoles)).addRoleOption(o=>o.setName('role').setDescription('Role to change').setRequired(true)).addStringOption(o=>o.setName('action').setDescription('Operation').setRequired(true).addChoices({name:'Add',value:'add'},{name:'Remove',value:'remove'})))
].map(c=>c.toJSON());
