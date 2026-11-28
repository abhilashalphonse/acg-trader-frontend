import {useSyncExternalStore} from 'react';
import './agentCursor.css';

// Cropped and downsampled approved iridescent cursor artwork, transparent WebP.
const cursorImage='data:image/webp;base64,UklGRn4FAABXRUJQVlA4WAoAAAAQAAAAJwAALwAAQUxQSKQCAAABoLVtmyFJlv++mTW2bdv2zNq2bdu2bdu2bdvm0VjxxXsQkVGZHRETALQ+/PNFf96/cQvEWYx6W94l76WlT82ui3XwdJkzM9OSa/oBBFDEtEE/yszMmfP6aucMRDRCMmEXizpnZrL7xqAeFl0o5wIzc87pt32bgwBAFJCR21LMzEnPjgeIMEISjFngzJwzM9NfRzcBiTCC6HWyaGChk56bAbCucwrMhRY6/XtYC5AEQJIggEN9CWbSc+MAMoXbLiswM+eci5jpz0NzkEic869PsBSTHh0HkkVjf1RKnfptt0YgA5J9Pi7P5O8fiAiAjq9WYKZvtwUYsPmdlZjs6p6I1s6Sq8K8Pp4XMNvXW7VOC09tDRAbr67IzOvh3gCmLvVVmen9fuCQP1Sd6eHW7PxuQ7BV22UtHmgQujarXdIwbmJ2ZINwB4I7rKzMmZ4fScz/X5V4SStfXK87MeSb8ryk5f988dixCwa2Ijq9XppW/PD8DSftt9kaUwe2zsFmd5blfz1iq/XnTRk/tFf7xiRYO1uuHP04d0Tfbh1aN80JAORuVpLZoY1zkkQEmLvCJ0gpercziJAkyAG/q0DLv1nmE8zvEzCGrNWTBfrtvK3uVYo+aUOEJADmO6/wzpn869tPGrHp7z7BtD8YxGs9L14u+d+vWmd4x5Y9rpdLea8TEpm1Gbr3zfecv/HEvq0yNF/wr0+w1dskoda276gJowd2bUqg1ukGpehisAhg3qxV+zbNchJg0zX+9Cl3ZGkAMxIgyLzTrXIJV9WSEgmQzef/rwK/cpdGAMC6QtbaX1qkxwdGQtbHZmMek7xJenNe+6yoROYdJl/xwyq34vur1u3XDAxLIdm40/B19jli9w0m9G+VESBRJgGyUYc+g0cM7delWYZiVlA4ILQCAABQDgCdASooADAAPplAmEilpCKhMdZt+LATCWwAsR+FAe+7eZPYn7vuvpXITeUAZbXvHRQIvQ5zqfT3sEfqX/t+Aw/YopUkrJxouD+LGmT43sqax9BetKV3LNDw0NM44+CeC63psHd3JM05ligtSHcmVre3zufB1kh/egAA/vgZ6ZOsxSAMggW1j9qLXWht9szYOEKEHekzj2sZBQNrIeneK6gBD9vpd3oYgh79SeMFQLSULsQAkf7v+t9UW5c9AcHBLI/M60qdln1I4n+W3BOFv2++IYmlnjx20qYMT0PZZg8tio6Ky7oTVzpktKzEcAJ59Px35XKrpdqf1RhC4JYy/xaKwLhl7zc98LmsQeVCEc4iRM/X2wpE4YBkD/qG/G/n/3o9/KbL/8isLDeYqbNIrP+dssDS13Tqa/f3qA5trUTwQ1REoQASwYAnBt+KTXH4HxD9FzAvNuvhglQ1dig7SY/6tv62DFsfkpJDjQOc/Fw7wyV7a7lHrWyfgxVsqk1uydbiQ0sTYXh6AxNqRnYd/L1kHrjS5MPqpQOTGlZTgFucax7f8f3/YbPCNKbLTGWm0NwSZ8DLjDZ2peyf+O5+nES5zhJgMC5egAa8o8T5EYMOcA+qLdUhFUS0ySa1qdd54IVTeRUOTP4YOP2FyMHbM1b+7yV+lGte6cDCg0CEII733x9VVBSsh/amVZ1fe1oJ3zMc8DCmgtPtMVHvm9cNPQ2smuRqbNYZlFVwGO3UJUnYzvo1zGXu5m0WW4dkUhgMLRIRBvLcZtGx30Wn4hR6lN3mNrLvauGecdjkBpMMTG2rPkT4zmSC4G/dNACj8TaclEoO+dVPfh7QUOZm8FDq0IlbRoVBZdkubTfrwF6FQcCGPtyzm0iDVn/IaeYc/zO6//vJrOZP64FYtn6L3dBHwWwAAA==';

// Mount within a positioned workspace/chart surface. This layer is visual
// only: it never intercepts pointers, focus, keyboard or touch events.
export default function AgentCursor({controller}){
 const cursor=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getServerSnapshot);
 return (
  <div className="acg-agent-cursor-surface" aria-hidden="true">
   <div className={'acg-agent-cursor'+(cursor.visible?' is-visible':'')} style={{transform:'translate3d('+cursor.x+'px,'+cursor.y+'px,0)'}}>
    {cursor.ripple>0&&<span className="acg-agent-cursor-ripple" key={cursor.ripple}/>}
    <img className="acg-agent-cursor-image" src={cursorImage} alt="" draggable={false}/>
   </div>
  </div>
 );
}
