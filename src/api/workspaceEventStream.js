// The server sends bounded lifecycle events and exactly one terminal result.
// Never display partial model text or automatically replay a failed request.
const maxBytes=65536;
const stages=['CONTEXT','GENERATING'];
export async function readWorkspaceEventStream(response,onProgress,onDelta){
  const reader=response.body?.getReader();
  if(!reader)throw Error('Missing event stream');
  const decoder=new TextDecoder('utf-8',{fatal:true});
  let total=0,buffer='',stageIndex=0,terminal=false,result,preview='';
  const consume=block=>{
    if(terminal)throw Error('Event after terminal result');
    const lines=block.split('\n');
    if(lines.length!==2||!lines[0].startsWith('event: ')||!lines[1].startsWith('data: '))throw Error('Invalid event');
    const kind=lines[0].slice(7),data=JSON.parse(lines[1].slice(6));
    if(kind==='progress'){
      if(!data||Object.keys(data).length!==1||data.stage!==stages[stageIndex])throw Error('Invalid progress');
      stageIndex++;onProgress?.(data.stage);
    }else if(kind==='delta'){
      if(stageIndex!==stages.length||!data||Object.keys(data).length!==1||typeof data.text!=='string'||!data.text)throw Error('Invalid delta');
      preview+=data.text;
      if(new TextEncoder().encode(preview).byteLength>12000)throw Error('Answer stream limit');
      onDelta?.(data.text);
    }else if(kind==='result'){
      if(stageIndex!==stages.length||!data||typeof data!=='object'||Array.isArray(data))throw Error('Invalid result');
      if(preview&&data.state==='ANSWERED'&&(typeof data.answer!=='string'||data.answer.trim()!==preview.trim()))throw Error('Answer stream mismatch');
      result=data;terminal=true;
    }else if(kind==='error'){
      if(!data||Object.keys(data).length!==1||data.code!=='AI_UNAVAILABLE')throw Error('Invalid error');
      throw Error('AI request unavailable');
    }else throw Error('Unknown event');
  };
  const drain=()=>{let i;while((i=buffer.indexOf('\n\n'))!==-1){const block=buffer.slice(0,i);buffer=buffer.slice(i+2);consume(block);}};
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      total+=value.byteLength;if(total>maxBytes)throw Error('Event stream limit');
      buffer+=decoder.decode(value,{stream:true});drain();
    }
    buffer+=decoder.decode();drain();
    if(buffer.length||!terminal)throw Error('Incomplete event stream');
    return result;
  }finally{try{await reader.cancel();}catch{}reader.releaseLock();}
}
