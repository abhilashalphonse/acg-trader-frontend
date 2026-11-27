// Interpret only the explicit report structure; do not extract invented prices
// or infer directional bias from arbitrary prose. Unknown formats fall back to
// the existing safe Markdown renderer.
import {parseAssistantMarkdown} from './assistantMarkdown.js';
const sections=new Map([['market outlook','outlook'],['timeframe outlook','timeframes'],['key price levels','levels'],['bullish scenario','bullish'],['bearish scenario','bearish'],['current assessment','assessment']]);
const plain=s=>s.replace(/^\*\*|\*\*$/g,'').trim();
const headingKey=s=>sections.get(plain(s).toLowerCase());
export function parseAnalysisReport(text){
  const blocks=parseAssistantMarkdown(text);
  if(blocks[0]?.type!=='heading'||headingKey(blocks[0].text)!=='outlook')return null;
  const groups=[];
  for(const b of blocks){
    if(b.type==='heading'&&headingKey(b.text)){
      const kind=headingKey(b.text);
      if(groups.some(g=>g.kind===kind))return null;
      groups.push({kind,title:plain(b.text),blocks:[]});
    }else if(groups.length)groups.at(-1).blocks.push(b);
    else return null;
  }
  if(groups.length<2||groups.some(g=>!g.blocks.length))return null;
  return groups;
}
export function isNativeTable(block,kind){
  if(block?.type!=='table')return false;
  const expected=kind==='timeframes'?['timeframe','outlook','evidence']:kind==='levels'?['level','price','context']:null;
  return Boolean(expected&&block.headers.length===3&&block.headers.every((h,i)=>plain(h).toLowerCase()===expected[i]));
}
export function outlookTone(value){
  switch(plain(value).toLowerCase()){
    case 'bullish':return 'positive';
    case 'bearish':return 'negative';
    default:return 'neutral';
  }
}
