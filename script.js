// Registration link for the next session: every [data-cta="register"] element points here.
// Set to null to fall back to the #register block on the page.
const REGISTRATION_URL = "https://docs.google.com/forms/d/e/1FAIpQLScTt0elP_iOnpxz8ElBGx95eivFZ7lk1aZbZZigX70_-hIyKA/viewform";
if (REGISTRATION_URL) {
  document.querySelectorAll('[data-cta="register"]').forEach(el => {
    el.href = REGISTRATION_URL; el.target = '_blank'; el.rel = 'noopener';
  });
}

// 18+ gate: remembered per browser; the page still works if storage is blocked
(function(){
  const gate=document.getElementById('gate'); let ok=false;
  try{ ok=localStorage.getItem('rm202-18')==='1'; }catch(e){}
  if(!ok){ gate.hidden=false; document.body.classList.add('gated'); document.getElementById('gate-yes').focus(); }
  document.getElementById('gate-yes').addEventListener('click',()=>{
    try{ localStorage.setItem('rm202-18','1'); }catch(e){}
    gate.hidden=true; document.body.classList.remove('gated');
  });
})();

// Gallery from assets/photos/photos.json (built by develop.py)
(async function(){
  const grid=document.getElementById('grid'), filters=document.getElementById('filters');
  let photos=[];
  try{ photos=await (await fetch('assets/photos/photos.json',{cache:'no-cache'})).json(); }
  catch(e){ grid.textContent='Photos could not be loaded.'; return; }
  photos.sort((a,b)=>a.n-b.n);
  const sections=['All',...new Set(photos.map(p=>p.section))];
  let current=photos;

  function render(list){
    current=list; grid.innerHTML='';
    list.forEach((p,i)=>{
      const b=document.createElement('button'); b.setAttribute('aria-label',`Open photo ${i+1}: ${p.section}`);
      const img=new Image(); img.src=`assets/photos/thumb/${p.id}.jpg`; img.alt=p.section; img.loading='lazy';
      img.width=p.w; img.height=p.h;
      b.appendChild(img); b.addEventListener('click',()=>open(i)); grid.appendChild(b);
    });
  }
  sections.forEach((s,i)=>{
    const b=document.createElement('button'); b.textContent=s; b.setAttribute('role','tab');
    b.setAttribute('aria-selected',i===0); filters.appendChild(b);
    b.addEventListener('click',()=>{
      filters.querySelectorAll('button').forEach(x=>x.setAttribute('aria-selected',x===b));
      render(s==='All'?photos:photos.filter(p=>p.section===s));
    });
  });
  render(photos);

  // lightbox
  const lb=document.getElementById('lightbox'), lbImg=document.getElementById('lb-img'), cap=document.getElementById('lb-cap');
  let idx=0, lastFocus=null;
  function show(){ const p=current[idx]; lbImg.src=`assets/photos/full/${p.id}.jpg`; lbImg.alt=p.section; cap.textContent=`${p.section} · ${idx+1} / ${current.length}`; }
  function open(i){ idx=i; lastFocus=document.activeElement; show(); lb.hidden=false; document.getElementById('lb-close').focus(); }
  function close(){ lb.hidden=true; lbImg.src=''; if(lastFocus) lastFocus.focus(); }
  function step(d){ idx=(idx+d+current.length)%current.length; show(); }
  document.getElementById('lb-close').onclick=close;
  document.getElementById('lb-prev').onclick=()=>step(-1);
  document.getElementById('lb-next').onclick=()=>step(1);
  lb.addEventListener('click',e=>{ if(e.target===lb) close(); });
  document.addEventListener('keydown',e=>{
    if(lb.hidden) return;
    if(e.key==='Escape') close(); else if(e.key==='ArrowLeft') step(-1); else if(e.key==='ArrowRight') step(1);
  });
})();
