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

/* ---------- Figure → QR ----------
   Ported from the KSS site's tree → QR. A pixel-art figure on a 41x41 block
   grid that morphs into a real QR code for the RM202 Instagram page. Everything is generated in the browser: the QR
   is encoded here (version 4, error correction M, 33x33 modules) rather than
   shipped as an image, and the figure and the QR share the same grid so the
   blocks can fly between the two states instead of cross-fading.
   No libraries, one canvas, and the loop is idle whenever nothing is moving. */
(function(){
  const QR_URL = "https://www.instagram.com/rm_202_mkt/";
  const stage  = document.getElementById('qrTree');
  const canvas = document.getElementById('qrTreeCanvas');
  const cue    = document.getElementById('qrTreeCue');
  if(!stage || !canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');

  /* ============ QR encoder — byte mode, version 4, EC level M (33x33) ============
     Version 4-M holds 62 bytes; the Instagram URL is 47, too long for level H
     (34 bytes) at this size. M still tolerates ~15% damage, plenty for a clean
     on-screen code, and keeps the 33x33 grid the tree is drawn on. */
  function buildQR(text){
    const VERSION=4, SIZE=17+4*VERSION;                      // 33
    const EC_PER_BLOCK=18, BLOCKS=2, DATA_PER_BLOCK=32;      // 4-M block structure
    const TOTAL_DATA=BLOCKS*DATA_PER_BLOCK;                  // 64 data codewords

    /* GF(256), primitive polynomial 0x11d */
    const EXP=new Uint8Array(512), LOG=new Uint8Array(256);
    for(let i=0,x=1;i<255;i++){ EXP[i]=x; LOG[x]=i; x<<=1; if(x&0x100) x^=0x11d; }
    for(let i=255;i<512;i++) EXP[i]=EXP[i-255];
    const mul=(a,b)=>(a===0||b===0)?0:EXP[LOG[a]+LOG[b]];

    function genPoly(n){
      let p=[1];
      for(let i=0;i<n;i++){
        const q=p.concat([0]);
        for(let j=0;j<p.length;j++) q[j+1]^=mul(p[j],EXP[i]);
        p=q;
      }
      return p;
    }
    function ecc(data,n){
      const g=genPoly(n), res=new Uint8Array(data.length+n);
      res.set(data);
      for(let i=0;i<data.length;i++){
        const f=res[i]; if(!f) continue;
        for(let j=1;j<g.length;j++) res[i+j]^=mul(g[j],f);
      }
      return res.slice(data.length);
    }

    /* bitstream: mode + character count + payload + terminator + pad codewords */
    const bytes=Array.from(new TextEncoder().encode(text));
    if(bytes.length>62) throw new Error('payload too long for version 4-M');
    const bits=[];
    const put=(v,len)=>{ for(let i=len-1;i>=0;i--) bits.push((v>>i)&1); };
    put(0b0100,4);            // byte mode
    put(bytes.length,8);      // character count (byte mode, versions 1-9)
    for(const b of bytes) put(b,8);
    const cap=TOTAL_DATA*8;
    for(let i=0;i<4&&bits.length<cap;i++) bits.push(0);   // terminator
    while(bits.length%8) bits.push(0);
    const dataCw=[];
    for(let i=0;i<bits.length;i+=8){
      let v=0; for(let j=0;j<8;j++) v=(v<<1)|bits[i+j];
      dataCw.push(v);
    }
    const PAD=[0xEC,0x11];
    for(let i=0; dataCw.length<TOTAL_DATA; i++) dataCw.push(PAD[i%2]);

    /* split into blocks, then interleave data and error-correction codewords */
    const dBlocks=[], eBlocks=[];
    for(let b=0;b<BLOCKS;b++){
      const d=dataCw.slice(b*DATA_PER_BLOCK,(b+1)*DATA_PER_BLOCK);
      dBlocks.push(d); eBlocks.push(ecc(Uint8Array.from(d),EC_PER_BLOCK));
    }
    const final=[];
    for(let i=0;i<DATA_PER_BLOCK;i++) for(const d of dBlocks) final.push(d[i]);
    for(let i=0;i<EC_PER_BLOCK;i++)   for(const e of eBlocks) final.push(e[i]);

    /* function patterns */
    const m=Array.from({length:SIZE},()=>new Int8Array(SIZE).fill(-1));   // -1 = free
    const set=(r,c,v)=>{ m[r][c]=v; };

    function finder(r0,c0){
      for(let r=-1;r<=7;r++) for(let c=-1;c<=7;c++){
        const r1=r0+r, c1=c0+c;
        if(r1<0||r1>=SIZE||c1<0||c1>=SIZE) continue;
        const on=(r>=0&&r<=6&&(c===0||c===6))||(c>=0&&c<=6&&(r===0||r===6))||
                 (r>=2&&r<=4&&c>=2&&c<=4);
        set(r1,c1,on?1:0);
      }
    }
    finder(0,0); finder(0,SIZE-7); finder(SIZE-7,0);
    for(let i=8;i<SIZE-8;i++){ const v=(i%2===0)?1:0; set(6,i,v); set(i,6,v); }  // timing
    const AP=[6,SIZE-7];                                   // alignment centres: 6, 26
    for(const ar of AP) for(const ac of AP){
      if((ar===6&&ac===6)||(ar===6&&ac===SIZE-7)||(ar===SIZE-7&&ac===6)) continue;
      for(let r=-2;r<=2;r++) for(let c=-2;c<=2;c++)
        set(ar+r,ac+c, Math.max(Math.abs(r),Math.abs(c))!==1 ? 1 : 0);
    }
    set(4*VERSION+9,8,1);                                  // dark module
    for(let i=0;i<9;i++){ if(m[8][i]===-1) set(8,i,0); if(m[i][8]===-1) set(i,8,0); }
    for(let i=0;i<8;i++){
      if(m[8][SIZE-1-i]===-1) set(8,SIZE-1-i,0);
      if(m[SIZE-1-i][8]===-1) set(SIZE-1-i,8,0);
    }
    const reserved=m.map(row=>Array.from(row,v=>v!==-1));

    /* data placement, zigzag upward from the bottom-right */
    let bi=0;
    const nextBit=()=>{
      const byte=final[bi>>3];
      const bit=(byte===undefined)?0:(byte>>(7-(bi&7)))&1;
      bi++; return bit;
    };
    let up=true;
    for(let col=SIZE-1; col>0; col-=2){
      if(col===6) col--;                                   // skip the timing column
      for(let i=0;i<SIZE;i++){
        const row=up?SIZE-1-i:i;
        for(let k=0;k<2;k++){
          const c=col-k;
          if(reserved[row][c]) continue;
          m[row][c]=nextBit();
        }
      }
      up=!up;
    }

    /* mask selection */
    const MASKS=[
      (r,c)=>((r+c)%2)===0,
      (r,c)=>(r%2)===0,
      (r,c)=>(c%3)===0,
      (r,c)=>((r+c)%3)===0,
      (r,c)=>((((r/2)|0)+((c/3)|0))%2)===0,
      (r,c)=>(((r*c)%2)+((r*c)%3))===0,
      (r,c)=>((((r*c)%2)+((r*c)%3))%2)===0,
      (r,c)=>((((r+c)%2)+((r*c)%3))%2)===0
    ];
    function formatBits(mask){
      const data=(0b00<<3)|mask;                           // 0b00 = EC level M
      let v=data<<10;
      for(let i=4;i>=0;i--) if((v>>(i+10))&1) v^=0x537<<i; // BCH(15,5)
      return ((data<<10)|v)^0x5412;
    }
    function applyFormat(grid,mask){
      const f=formatBits(mask);
      for(let i=0;i<15;i++){
        const bit=(f>>i)&1;
        if(i<6)       grid[i][8]=bit;                      // column 8, skipping timing
        else if(i<8)  grid[i+1][8]=bit;
        else          grid[SIZE-15+i][8]=bit;
        if(i<8)       grid[8][SIZE-1-i]=bit;               // row 8, skipping timing
        else if(i<9)  grid[8][7]=bit;
        else          grid[8][14-i]=bit;
      }
      grid[SIZE-8][8]=1;                                   // dark module
    }
    function penalty(g){
      let p=0, dark=0;
      for(let i=0;i<SIZE;i++){                             // rule 1: runs of 5+
        let rc=1, cc=1;
        for(let j=1;j<SIZE;j++){
          if(g[i][j]===g[i][j-1]) rc++; else { if(rc>=5) p+=3+(rc-5); rc=1; }
          if(g[j][i]===g[j-1][i]) cc++; else { if(cc>=5) p+=3+(cc-5); cc=1; }
        }
        if(rc>=5) p+=3+(rc-5);
        if(cc>=5) p+=3+(cc-5);
      }
      for(let r=0;r<SIZE-1;r++) for(let c=0;c<SIZE-1;c++){ // rule 2: 2x2 blocks
        const v=g[r][c];
        if(v===g[r][c+1]&&v===g[r+1][c]&&v===g[r+1][c+1]) p+=3;
      }
      const P1=[1,0,1,1,1,0,1,0,0,0,0], P2=[0,0,0,0,1,0,1,1,1,0,1];
      const match=get=>{                                   // rule 3: finder look-alikes
        let n=0;
        for(let s=0;s+11<=SIZE;s++){
          let a=true,b=true;
          for(let k=0;k<11;k++){ const v=get(s+k); if(v!==P1[k]) a=false; if(v!==P2[k]) b=false; }
          if(a) n++; if(b) n++;
        }
        return n;
      };
      for(let i=0;i<SIZE;i++){ p+=40*match(k=>g[i][k]); p+=40*match(k=>g[k][i]); }
      for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) dark+=g[r][c];
      p+=10*Math.floor(Math.abs(dark*100/(SIZE*SIZE)-50)/5); // rule 4: dark ratio
      return p;
    }

    let best=null, bestScore=Infinity;
    for(let mask=0;mask<8;mask++){
      const g=m.map(row=>Array.from(row));
      for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++)
        if(!reserved[r][c]&&MASKS[mask](r,c)) g[r][c]^=1;
      applyFormat(g,mask);
      const s=penalty(g);
      if(s<bestScore){ bestScore=s; best=g; }
    }
    return best;
  }

  let qr;
  try { qr = buildQR(QR_URL); }
  catch(e){ stage.hidden = true; if(cue) cue.hidden = true; return; }

  const QN=qr.length;            // 33 QR modules
  const QUIET=4;                 // quiet zone, in modules, on every side
  const N=QN+2*QUIET;            // 41 grid cells

  /* ============ the figure ============
     A standing life-drawing pose (weight on one leg, a hand on the hip) built
     from capsules -- line segments with a radius -- rasterised onto the same
     33x33 area the QR occupies, on a small plinth. Shading is lit from the
     upper left so it reads as a drawn figure rather than a silhouette. */
  function buildFigure(){
    const g=Array.from({length:QN},()=>new Uint8Array(QN));
    const shade=Array.from({length:QN},()=>new Uint8Array(QN));
    const rnd=(x,y)=>{
      let h=Math.imul(x+41,73856093)^Math.imul(y+17,19349663);
      h=Math.imul(h^(h>>>13),1274126177); h^=h>>>16;
      return ((h>>>0)%1024)/1024;
    };
    // [x1,y1,x2,y2,radius] in module units
    const parts=[
      [16,4.3,16,4.3,2.7],                         // head
      [16,6.6,16,8.2,1.2],                         // neck
      [12.2,9.2,19.8,9.2,1.5],                     // shoulders
      [16,10,16,14.4,3.3],                         // chest
      [16,14.4,16,17.6,2.6],                       // waist
      [14.4,18.6,17.8,18.6,2.4],                   // hips
      [12.1,9.6,10.9,14.8,1.15],[10.9,14.8,10.6,20.2,1.0],   // arm hanging
      [10.6,20.6,10.6,20.6,1.05],                  // hand
      [19.9,9.6,21.8,13.6,1.15],[21.8,13.6,18.9,17.3,1.0],   // arm, hand on hip
      [14.6,19.6,14.3,25.2,1.75],[14.3,25.2,14.5,30.1,1.15], // standing leg
      [17.6,19.6,18.9,24.6,1.6],[18.9,24.6,18.1,30.0,1.05],  // relaxed leg
      [13.3,30.6,15.4,30.6,0.75],[17.3,30.5,19.4,30.7,0.75]  // feet
    ];
    const seg=(px,py,[x1,y1,x2,y2,rad])=>{
      const dx=x2-x1, dy=y2-y1, L=dx*dx+dy*dy;
      const t=L?Math.max(0,Math.min(1,((px-x1)*dx+(py-y1)*dy)/L)):0;
      return Math.hypot(px-(x1+t*dx),py-(y1+t*dy))-rad;
    };
    for(let r=0;r<31;r++) for(let c=0;c<QN;c++){
      // widen the pose a little about the centre line so it fills the grid
      const fx=16+(c-16)/1.3;
      let d=99;
      for(const p of parts) d=Math.min(d,seg(fx,r,p)*1.15);
      if(d<=0.15){
        g[r][c]=1;
        // light from the upper left; the far edge of every limb sits in shadow
        const lit=1-Math.hypot((c-10)*0.8,(r-5)*0.5)/16;
        const v=0.75*lit+0.12*(rnd(c>>1,r>>1)-0.5)-(d>-0.7?0.3:0);
        shade[r][c]= v>0.36 ? 2 : (v>0.1 ? 1 : 0);
      }
    }
    /* plinth: two rows, written out so it always reads as a solid block */
    for(const [r,c0,c1] of [[31,9,23],[32,8,24]])
      for(let c=c0;c<=c1;c++){ g[r][c]=1; shade[r][c]=3; }

    const cells=[];
    for(let r=0;r<QN;r++) for(let c=0;c<QN;c++)
      if(g[r][c]) cells.push({c:c+QUIET, r:r+QUIET, sh:shade[r][c]});
    return cells;
  }

  /* ============ pair figure blocks to QR modules ============
     Both sets are ordered by angle around the centre, then paired by
     proportional index, so the figure unwinds into the code (and back) as a
     sweep. Whichever set is smaller repeats: its blocks split apart on the way
     out and merge again on the way back. */
  const CX=(N-1)/2, CY=(N-1)/2;
  const qrCells=[];
  for(let r=0;r<QN;r++) for(let c=0;c<QN;c++)
    if(qr[r][c]) qrCells.push({c:c+QUIET, r:r+QUIET});
  const treeCells=buildFigure();

  const byAngle=(a,b)=>{
    const aa=Math.atan2(a.r-CY,a.c-CX), ba=Math.atan2(b.r-CY,b.c-CX);
    if(aa!==ba) return aa-ba;
    return Math.hypot(a.c-CX,a.r-CY)-Math.hypot(b.c-CX,b.r-CY);
  };
  const Q=qrCells.slice().sort(byAngle);
  const T=treeCells.slice().sort(byAngle);
  const COUNT=Math.max(Q.length,T.length);

  const DELAY_MAX=0.34;
  const blocks=[];
  for(let i=0;i<COUNT;i++){
    const q=Q[Math.floor(i*Q.length/COUNT)];
    const t=T[Math.floor(i*T.length/COUNT)];
    const rad=Math.hypot(q.c-CX,q.r-CY)/(N/2);
    blocks.push({
      qc:q.c, qr:q.r, tc:t.c, tr:t.r, sh:t.sh,
      delay:(0.55*(i/COUNT)+0.45*Math.min(1,rad))*DELAY_MAX,
      arc:((i%7)-3)*0.42,                             // deterministic flight bow
      seed:(i%13)/13
    });
  }

  /* ============ palette ============ */
  const readVar=(name,fallback)=>{
    const v=getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v||fallback;
  };
  function hexToRgb(h){
    h=h.replace('#','');
    if(h.length===3) h=h.split('').map(x=>x+x).join('');
    return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];
  }
  const QR_INK=hexToRgb(readVar('--qrtree-ink','#151515'));
  const SHADES=[
    QR_INK,                       // 0 shadow ink — the colour the QR settles on
    hexToRgb('#55514c'),          // 1 mid tone
    hexToRgb('#9a948a'),          // 2 lit skin, graphite on paper
    hexToRgb('#c4242b')           // 3 plinth, RM202 red
  ];
  const rgbCache=new Map();
  function mixToInk(shade,t){
    const key=shade*64+((t*63)|0);
    let s=rgbCache.get(key);
    if(s) return s;
    const a=SHADES[shade];
    s='rgb('+Math.round(a[0]+(QR_INK[0]-a[0])*t)+','
            +Math.round(a[1]+(QR_INK[1]-a[1])*t)+','
            +Math.round(a[2]+(QR_INK[2]-a[2])*t)+')';
    rgbCache.set(key,s);
    return s;
  }

  /* ============ sizing — snap a module to a whole number of device pixels ============
     Fractional module widths blur the code and cost scans, so the backing store
     is sized to N whole device pixels per module and the CSS size follows. */
  let mod=6, dpr=1, px=0;
  function resize(){
    dpr=Math.min(window.devicePixelRatio||1,3);
    const target=stage.clientWidth||240;
    mod=Math.max(3,Math.floor(target*dpr/N));
    px=mod*N;
    canvas.width=px; canvas.height=px;
    canvas.style.width=(px/dpr)+'px';
    canvas.style.height=(px/dpr)+'px';
    render(true);
  }

  /* ============ animation ============ */
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const DURATION=950;
  let progress=0, targetP=0, raf=0, lastTs=0, visible=true;

  const easeInOut=t=>t<0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;

  function render(force){
    const now=performance.now();
    ctx.clearRect(0,0,px,px);

    /* reduced motion: no flight, no sway — a short crossfade in place */
    if(reduce.matches){
      if(progress<1){
        ctx.globalAlpha=1-progress;
        for(const b of blocks){ ctx.fillStyle=mixToInk(b.sh,0); ctx.fillRect(b.tc*mod,b.tr*mod,mod,mod); }
      }
      if(progress>0){
        ctx.globalAlpha=progress;
        ctx.fillStyle=mixToInk(0,1);
        for(const b of blocks) ctx.fillRect(b.qc*mod,b.qr*mod,mod,mod);
      }
      ctx.globalAlpha=1;
      return;
    }

    const settledQR=progress>=1;
    for(const b of blocks){
      const lt=Math.min(1,Math.max(0,(progress-b.delay)/(1-DELAY_MAX)));
      if(settledQR){
        ctx.fillStyle=mixToInk(0,1);
        ctx.fillRect(b.qc*mod,b.qr*mod,mod,mod);
        continue;
      }
      const e=easeInOut(lt);
      let x=b.tc+(b.qc-b.tc)*e;
      let y=b.tr+(b.qr-b.tr)*e;
      /* idle: a slow breath while the figure holds the pose */
      if(progress<=0 && b.sh!==3){
        const h=Math.max(0,(34-b.tr)/30);
        y+=Math.sin(now*0.0011)*0.12*h;
        x+=Math.sin(now*0.0007+b.tr*0.12)*0.05*h;
      }
      const bow=Math.sin(Math.PI*e);
      x+=b.arc*bow;
      y-=bow*(0.7+b.seed);
      const s=mod*(1+0.42*bow);
      const off=(s-mod)/2;
      ctx.fillStyle=mixToInk(b.sh,e);
      ctx.fillRect(x*mod-off,y*mod-off,s,s);
    }
  }

  function tick(ts){
    raf=0;
    if(!lastTs) lastTs=ts;
    const dt=Math.min(64,ts-lastTs); lastTs=ts;
    if(progress!==targetP){
      const step=dt/DURATION;
      progress = targetP>progress ? Math.min(targetP,progress+step)
                                  : Math.max(targetP,progress-step);
    }
    render();
    const idling = progress<=0 && !reduce.matches && visible &&
                   document.visibilityState==='visible';
    if(progress!==targetP || idling) schedule(); else lastTs=0;
  }
  function schedule(){ if(!raf) raf=requestAnimationFrame(tick); }

  function toggle(){
    targetP = targetP>0.5 ? 0 : 1;
    const showQR = targetP>0.5;
    stage.setAttribute('aria-pressed', showQR?'true':'false');
    stage.setAttribute('aria-label', showQR
      ? 'QR code for the RM202 Instagram page — tap to return to the figure'
      : 'Interactive QR code — tap to reveal');
    if(cue) cue.textContent = showQR ? 'Scan · @rm_202_mkt' : 'Tap the figure';
    lastTs=0; schedule();
  }

  stage.addEventListener('click',toggle);   /* covers touch, mouse, Enter and Space */

  if('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
  else addEventListener('resize',resize);
  document.addEventListener('visibilitychange',()=>{ lastTs=0; schedule(); });
  reduce.addEventListener?.('change',()=>{ lastTs=0; schedule(); render(); });
  if('IntersectionObserver' in window){
    new IntersectionObserver(es=>{ visible=es[0].isIntersecting; lastTs=0; schedule(); },
      {threshold:0}).observe(stage);
  }

  resize();
  schedule();
})();
