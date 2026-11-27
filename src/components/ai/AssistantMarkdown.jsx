import React from 'react';
import {inlineParts,parseAssistantMarkdown} from './assistantMarkdown.js';

function Inline({text}){
  return inlineParts(text).map((p,i)=>{
    if(p.type==='strong')return <strong key={i}>{p.text}</strong>;
    if(p.type==='em')return <em key={i}>{p.text}</em>;
    if(p.type==='code')return <code key={i}>{p.text}</code>;
    return <React.Fragment key={i}>{p.text}</React.Fragment>;
  });
}
function Block({block:b}){
  switch(b.type){
    case 'heading':{
      const Heading=b.level<=2?'h3':b.level===3?'h4':'h5';
      return <Heading><Inline text={b.text}/></Heading>;
    }
    case 'list':{
      const Tag=b.ordered?'ol':'ul';
      return <Tag start={b.ordered?b.start:undefined}>{b.items.map((item,i)=><li key={i}><Inline text={item.text}/>{item.children.map((child,j)=><Block key={j} block={child}/>)}</li>)}</Tag>;
    }
    case 'table':return <div className="aic-markdown-table" tabIndex={0} role="region" aria-label="Analysis table"><table><thead><tr>{b.headers.map((cell,i)=><th key={i} scope="col"><Inline text={cell}/></th>)}</tr></thead><tbody>{b.rows.map((r,i)=><tr key={i}>{r.map((cell,j)=><td key={j}><Inline text={cell}/></td>)}</tr>)}</tbody></table></div>;
    case 'rule':return <hr/>;
    case 'quote':return <blockquote><Inline text={b.text}/></blockquote>;
    case 'codeBlock':return <pre><code>{b.text}</code></pre>;
    default:return <p><Inline text={b.text}/></p>;
  }
}
export default function AssistantMarkdown({text}){
  return <div className="aic-markdown">{parseAssistantMarkdown(text).map((block,i)=><Block key={i} block={block}/>)}</div>;
}
