import {SlashCommandBuilder,PermissionFlagsBits as P} from 'discord.js';
const base=(name,description)=>new SlashCommandBuilder().setName(name).setDescription(description).setDMPermission(false);
const amount=c=>c.addIntegerOption(o=>o.setName('amount').setDescription('Whole amount').setMinValue(1).setMaxValue(1_000_000_000_000).setRequired(true));
const user=(c,required=true)=>c.addUserOption(o=>o.setName('user').setDescription('Server member').setRequired(required));
const item=c=>c.addStringOption(o=>o.setName('item').setDescription('Item from this server’s shop/inventory').setRequired(true).setAutocomplete(true));
export const economyCommands=[
 user(base('balance','View wallet, bank and reserved funds'),false),
 amount(base('deposit','Move wallet money into your bank')),amount(base('withdraw','Move available bank money into your wallet')),
 base('daily','Claim your daily reward and streak bonus'),base('jobs','View available jobs and payouts'),
 base('work','Earn money from a job').addStringOption(o=>o.setName('job').setDescription('Choose a job (default: courier)').setAutocomplete(true)),
 base('crime','Attempt a crime: reward on success, wallet fine on failure'),
 amount(user(base('pay','Confirm a wallet transfer to another member'))),
 base('shop','Browse this server’s shop'),item(base('buy','Buy items using your wallet')).addIntegerOption(o=>o.setName('quantity').setDescription('Quantity (default 1)').setMinValue(1).setMaxValue(100)),
 base('inventory','View your items'),item(base('use','Activate an owned usable item')),
 user(base('profile','View economy stats and quiz earnings'),false),
 base('richest','View this server’s economy leaderboard').addStringOption(o=>o.setName('type').setDescription('Ranking').addChoices({name:'Total wealth',value:'wealth'},{name:'Quiz earnings',value:'quiz'})),
 base('transactions','View your recent economy transactions'),
 base('rob','Attempt a wallet or bank robbery')
  .addSubcommand(c=>user(c.setName('wallet').setDescription('Rob a wallet; Security Guards block and fine you')))
  .addSubcommand(c=>user(c.setName('bank').setDescription('Start a 30-second bank robbery for up to ten robbers'))),
 base('economy','Configure this server’s independent economy').setDefaultMemberPermissions(P.Administrator)
  .addSubcommand(c=>c.setName('config').setDescription('Open economy configuration menus (administrator/owner only)')),
 base('set','Administrator economy controls').setDefaultMemberPermissions(P.Administrator)
  .addSubcommand(c=>user(c.setName('balance').setDescription('Set a member’s wallet or bank balance'))
   .addStringOption(o=>o.setName('account').setDescription('Which account to change').setRequired(true).addChoices({name:'Wallet',value:'wallet'},{name:'Bank',value:'bank'}))
   .addIntegerOption(o=>o.setName('amount').setDescription('New balance; cannot remove reserved bank funds').setRequired(true).setMinValue(0).setMaxValue(1_000_000_000_000)))
].map(c=>c.toJSON());
