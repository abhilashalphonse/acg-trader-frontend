self.addEventListener('push',event=>{
  let data;try{data=event.data.json();}catch{return;}
  event.waitUntil(self.registration.showNotification(data.title||'ACG Trader alert',{
    body:data.body,tag:'acg-alert-'+data.eventId,icon:'/acg-logo.png',data:{symbol:data.symbol,timeframe:data.timeframe},
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const data=event.notification.data||{};
    const existing=windows.find(w=>new URL(w.url).origin===self.location.origin);
    if(existing){await existing.focus();existing.postMessage({type:'ACG_ALERT_OPEN',...data});}
    else{const url=new URL('/terminal',self.location.origin);if(data.symbol)url.searchParams.set('alertSymbol',data.symbol);if(data.timeframe)url.searchParams.set('alertTimeframe',data.timeframe);await self.clients.openWindow(url.href);}
  })());
});
