import {REST,Routes} from 'discord.js';
import {commands} from './commands.js';
export async function register(applicationId) {
  const route = process.env.DISCORD_GUILD_ID ? Routes.applicationGuildCommands(applicationId,process.env.DISCORD_GUILD_ID) : Routes.applicationCommands(applicationId);
  await new REST({version:'10'}).setToken(process.env.DISCORD_TOKEN).put(route,{body:commands});
  console.log(`Registered ${commands.length} commands.`);
}
if (process.argv[1]?.endsWith('/register.js')) {
  if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_CLIENT_ID) throw new Error('Set DISCORD_TOKEN and DISCORD_CLIENT_ID first.');
  await register(process.env.DISCORD_CLIENT_ID);
}
