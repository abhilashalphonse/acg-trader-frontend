import React from 'react';
import {inlineParts,parseAssistantMarkdown} from './assistantMarkdown.js';
import {parseAnalysisReport,isNativeTable,outlookTone} from './analysisReport.js';

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
function AnalysisRows({block,kind}){
  return <dl className={'aic-analysis-rows aic-analysis-rows-'+kind}>
    {block.rows.map((row,i)=><div key={i} className="aic-analysis-row">
      <dt><Inline text={row[0]}/></dt>
      <dd className={kind==='timeframes'?'aic-outlook-'+outlookTone(row[1]):'aic-level-value'}><Inline text={row[1]}/></dd>
      {row[2]&&<dd className="aic-row-context"><Inline text={row[2]}/></dd>}
    </div>)}
  </dl>;
}
function AnalysisReport({groups}){
  return <div className="aic-analysis-report">
    {groups.map(group=><section key={group.kind} className={'aic-analysis-section aic-analysis-'+group.kind}>
      <h3 className="aic-analysis-label">{group.title}</h3>
      <div className="aic-markdown aic-analysis-content">
        {group.blocks.map((block,i)=>isNativeTable(block,group.kind)?<AnalysisRows key={i} block={block} kind={group.kind}/>:group.kind==='outlook'&&i===0&&block.type==='paragraph'?
          <React.Fragment key={i}><h4 className="aic-analysis-headline"><Inline text={block.text.split('\n')[0]}/></h4>{block.text.includes('\n')&&<p><Inline text={block.text.split('\n').slice(1).join('\n')}/></p>}</React.Fragment>:<Block key={i} block={block}/>)}
      </div>
    </section>)}
  </div>;
}
export default function AssistantMarkdown({text}){
  const report=parseAnalysisReport(text);
  if(report)return <AnalysisReport groups={report}/>;
  return <div className="aic-markdown">{parseAssistantMarkdown(text).map((block,i)=><Block key={i} block={block}/>)}</div>;
}
