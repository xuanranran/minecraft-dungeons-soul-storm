// Async interactions belong to the route and parent dialog that started them.
export function navigationGuard(){
 const url=location.href,parent=document.activeElement?.closest('dialog');
 return ()=>location.href===url&&(!parent||parent.open);
}
