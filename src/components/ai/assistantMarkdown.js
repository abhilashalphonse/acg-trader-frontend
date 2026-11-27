// Bounded, text-only Markdown subset for untrusted assistant output.
// Never interprets HTML, URLs, images, or executable content.
const MAX_LINES=600;
const listMatch=line=>/^( {0,12})([-+*]|\d{1,3}[.)])\s+(.+)$/.exec(line);
const headingMatch=line=>/^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
const rule=line=>/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line);
const fence=line=>/^\s*```[\w-]*\s*$/.test(line);
const cells=line=>line.trim().replace(/^\|/,'').replace(/\|$/,'').split(/(?<!\\)\|/).map(s=>s.trim().replace(/\\\|/g,'|'));
const tableStart=(a,b)=>Boolean(a?.includes('|')&&b?.includes('|')&&cells(a).length===cells(b).length&&cells(b).length>=2&&cells(b).every(x=>/^:?-{3,}:?$/.test(x)));
export function inlineParts(text){
  const parts=[],rx=/(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|(?<!\*)\*[^*\n]+\*(?!\*)|(?<!\w)_[^_\n]+_(?!\w))/g;
  let at=0;
  for(const m of text.matchAll(rx)){
    if(m.index>at)parts.push({type:'text',text:text.slice(at,m.index)});
    const s=m[0],n=s.startsWith('**')||s.startsWith('__')?2:1;
    parts.push({type:s[0]==='`'?'code':n===2?'strong':'em',text:s.slice(n,-n)});
    at=m.index+s.length;
  }
  if(at<text.length)parts.push({type:'text',text:text.slice(at)});
  return parts;
}
export function parseAssistantMarkdown(value){
  if(typeof value!=='string')return [];
  const lines=value.replace(/\r\n?/g,'\n').replace(/\t/g,'  ').split('\n').slice(0,MAX_LINES);
  const blocks=[];
  let i=0;
  const boundary=j=>!lines[j]?.trim()||headingMatch(lines[j])||listMatch(lines[j])||rule(lines[j])||fence(lines[j])||tableStart(lines[j],lines[j+1])||/^>\s?/.test(lines[j]);
  function parseList(indent,depth=0){
    const first=listMatch(lines[i]),ordered=/^\d/.test(first[2]),items=[];
    const start=ordered?parseInt(first[2],10):undefined;
    while(i<lines.length){
      const m=listMatch(lines[i]);
      if(!m||m[1].length!==indent||/^\d/.test(m[2])!==ordered)break;
      const item={text:m[3],children:[]};i++;
      while(i<lines.length){
        const next=listMatch(lines[i]);
        if(next&&next[1].length>indent&&depth<4){item.children.push(parseList(next[1].length,depth+1));continue;}
        if(next||boundary(i)||lines[i].match(/^ */)[0].length<=indent)break;
        item.text+=' '+lines[i++].trim();
      }
      items.push(item);
      // Preserve list structure through blank lines only when a same-level item follows.
      let j=i;while(j<lines.length&&!lines[j].trim())j++;
      const following=listMatch(lines[j]||'');
      if(following&&following[1].length===indent&&/^\d/.test(following[2])===ordered)i=j;
    }
    return {type:'list',ordered,start,items};
  }
  while(i<lines.length){
    const line=lines[i];
    if(!line.trim()){i++;continue;}
    if(fence(line)){
      const code=[];i++;
      while(i<lines.length&&!fence(lines[i]))code.push(lines[i++]);
      if(i<lines.length)i++;
      blocks.push({type:'codeBlock',text:code.join('\n')});continue;
    }
    const h=headingMatch(line);
    if(h){blocks.push({type:'heading',level:h[1].length,text:h[2]});i++;continue;}
    if(rule(line)){blocks.push({type:'rule'});i++;continue;}
    if(tableStart(line,lines[i+1])){
      const headers=cells(line),rows=[];i+=2;
      while(i<lines.length&&lines[i].includes('|')&&cells(lines[i]).length===headers.length)rows.push(cells(lines[i++]));
      blocks.push({type:'table',headers,rows});continue;
    }
    const l=listMatch(line);
    if(l){blocks.push(parseList(l[1].length));continue;}
    if(/^>\s?/.test(line)){
      const quoted=[];while(i<lines.length&&/^>\s?/.test(lines[i]))quoted.push(lines[i++].replace(/^>\s?/,''));
      blocks.push({type:'quote',text:quoted.join('\n')});continue;
    }
    const paragraph=[line];i++;
    while(i<lines.length&&!boundary(i))paragraph.push(lines[i++]);
    blocks.push({type:'paragraph',text:paragraph.join('\n')});
  }
  return blocks;
}
