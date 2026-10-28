export function createBuilderStore(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS server_builds (
    id TEXT PRIMARY KEY,guild TEXT NOT NULL,requester TEXT NOT NULL,channel TEXT NOT NULL,
    prompt TEXT NOT NULL,plan TEXT,status TEXT NOT NULL,created INTEGER NOT NULL,expires INTEGER NOT NULL,
    result TEXT NOT NULL DEFAULT '[]',pending TEXT,error TEXT);
    CREATE UNIQUE INDEX IF NOT EXISTS server_one_build ON server_builds(guild) WHERE status='building';
    CREATE INDEX IF NOT EXISTS server_build_history ON server_builds(guild,created);`);
  const get=id=>{const r=db.prepare('SELECT * FROM server_builds WHERE id=?').get(id);return r?{...r,plan:r.plan?JSON.parse(r.plan):null,result:JSON.parse(r.result)}:null;};
  return {
    get,
    create(s) {db.prepare('INSERT INTO server_builds(id,guild,requester,channel,prompt,status,created,expires) VALUES(?,?,?,?,?,?,?,?)').run(s.id,s.guild,s.requester,s.channel,s.prompt,'planning',s.created,s.expires);},
    preview(id,plan,expires) {db.prepare("UPDATE server_builds SET status='preview',plan=?,expires=? WHERE id=? AND status='planning'").run(JSON.stringify(plan),expires,id);},
    close(id,status,error=null) {db.prepare('UPDATE server_builds SET status=?,error=? WHERE id=?').run(status,error,id);},
    cancel(id) {return db.prepare("UPDATE server_builds SET status='cancelled' WHERE id=? AND status='preview'").run(id).changes===1;},
    claim(id,now) {return db.prepare("UPDATE server_builds SET status='building' WHERE id=? AND status='preview' AND expires>?").run(id,now).changes===1;},
    pending(id,operation) {db.prepare('UPDATE server_builds SET pending=? WHERE id=?').run(operation,id);},
    record(id,item) {const s=get(id);s.result.push(item);db.prepare('UPDATE server_builds SET result=?,pending=NULL WHERE id=?').run(JSON.stringify(s.result),id);},
    latest(guild) {const row=db.prepare('SELECT id FROM server_builds WHERE guild=? ORDER BY rowid DESC LIMIT 1').get(guild);return row?get(row.id):null;},
    busy(guild) {return !!db.prepare("SELECT 1 FROM server_builds WHERE guild=? AND status='building'").get(guild);},
    recover() {
      const rows=db.prepare("SELECT id FROM server_builds WHERE status='building'").all();
      db.prepare("UPDATE server_builds SET status='interrupted',error='Bot restarted; inspect saved objects before building again.' WHERE status='building'").run();
      db.prepare("UPDATE server_builds SET status='failed',error='Plan generation was interrupted; please try again.' WHERE status='planning'").run();
      return rows.map(r=>get(r.id));
    }
  };
}
