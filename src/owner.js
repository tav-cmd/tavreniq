export function isOwnerQuestion(prompt) {
  const s=prompt.toLowerCase().replace(/[’']/g,"'").trim().replace(/[?.!]+$/,'');
  return /\bwho\s+(?:(?:is|s|'s)\s+)?(?:your|ur|the bot'?s|tavreniq'?s)\s+(?:owner|creator|developer)\b/.test(s)
    || /\bwho's\s+(?:your|ur)\s+(?:owner|creator|developer)\b/.test(s)
    || /\bwho\s+(?:owns|created|made|developed|built)\s+(?:you|u|tavreniq|this bot)\b/.test(s);
}
export async function ownerReply(guild,{id=process.env.BOT_OWNER_ID,name=process.env.BOT_OWNER_NAME || 'Raymon'}={}) {
  const plain={parse:[],repliedUser:false};
  if(!/^\d{17,20}$/.test(id || '')) return {content:`My owner is ${name}. My owner’s Discord ID hasn’t been configured for tagging yet.`,allowedMentions:plain};
  try {
    const member=await guild.members.fetch({user:id,force:true});
    return {content:`My owner is <@${member.id}>.`,allowedMentions:{...plain,users:[member.id]}};
  } catch(error) {
    if(error.code===10007 || error.code===10013) return {content:`My owner is ${name}, but they aren’t in this server.`,allowedMentions:plain};
    return {content:`My owner is ${name}. I couldn’t verify their membership in this server just now.`,allowedMentions:plain};
  }
}
