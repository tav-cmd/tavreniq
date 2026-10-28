// Internal identifiers are allocated by code, never trusted to the language model.
// Display names and all non-reference properties remain unchanged.
const fail=message=>{throw new Error(`Invalid server plan: ${message}`);};
const fold=value=>String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
function allocator() {
  const used=new Set(['everyone']);
  return (base,fallback)=>{
    base=fold(base)||fallback;
    if(!/^[a-z]/.test(base))base=`${fallback}_${base}`;
    base=base.slice(0,32).replace(/_+$/,'');
    let key=base,n=2;
    while(used.has(key)) {const suffix=`_${n++}`;key=base.slice(0,32-suffix.length).replace(/_+$/,'')+suffix;}
    used.add(key);return key;
  };
}
function referenceResolver(source,normalized,kind) {
  const exactKeys=new Map(),exactNames=new Map(),foldedKeys=new Map(),foldedNames=new Map(),allocated=new Map();
  const add=(map,alias,index)=>{if(!map.has(alias))map.set(alias,new Set());map.get(alias).add(index);};
  source.forEach((item,index)=>{
    for(const [value,exact,folded] of [[item.key,exactKeys,foldedKeys],[item.name,exactNames,foldedNames]])if(typeof value==='string'&&value.trim()) {
      add(exact,value.trim(),index);if(fold(value))add(folded,fold(value),index);
    }
    allocated.set(normalized[index].key,new Set([index]));
  });
  return reference=>{
    if(typeof reference!=='string'||!reference.trim())fail(`missing ${kind} reference.`);
    const ref=reference.trim();
    if(kind==='role'&&/^@?everyone$/i.test(ref)) {
      // @everyone is always the Discord-wide role, never a generated member role.
      if(ref.startsWith('@')||!exactKeys.has(ref))return 'everyone';
      fail('a planned role uses the reserved everyone reference; give it a distinct key.');
    }
    // Explicit keys take precedence over display-name fallbacks, making a
    // normalized plan stable even when another display name resembles a key.
    const candidates=exactKeys.get(ref)||exactNames.get(ref)||foldedKeys.get(fold(ref))||foldedNames.get(fold(ref))||allocated.get(ref);
    if(!candidates?.size)fail(`unknown ${kind} reference “${ref}”. Use its original key or display name.`);
    if(candidates.size!==1)fail(`ambiguous ${kind} reference “${ref}” matches ${[...candidates].map(i=>source[i].name).join(', ')}. Use a distinct role/category name or original key; permissions were not changed.`);
    return normalized[[...candidates][0]].key;
  };
}
export function normalizePlanKeys(raw) {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('expected a plan object.');
  for(const kind of ['roles','categories','channels']) {
    if(!Array.isArray(raw[kind]))fail(`expected a ${kind} array.`);
    if(raw[kind].some(item=>!item||typeof item!=='object'||Array.isArray(item)))fail(`invalid ${kind} entry.`);
  }
  const allocate=allocator();
  const roles=raw.roles.map(r=>({...r,key:allocate(`role_${typeof r.name==='string'?r.name:''}`,'role')}));
  const categories=raw.categories.map(c=>({...c,key:allocate(typeof c.name==='string'?c.name:'','category')}));
  const roleRef=referenceResolver(raw.roles,roles,'role'),categoryRef=referenceResolver(raw.categories,categories,'category');
  const access=values=>Array.isArray(values)?[...new Set(values.map(roleRef))]:values;
  const channels=raw.channels.map(c=>{
    const category=categoryRef(c.category);
    return {...c,key:allocate(`${category}_${typeof c.name==='string'?c.name:''}`,'channel'),category,
      view:access(c.view),post:access(c.post),connect:access(c.connect)};
  });
  return {...raw,roles,categories:categories.map(c=>({...c,view:access(c.view)})),channels};
}
