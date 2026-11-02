let stopRain=()=>{};

export function showConfetti(){
  stopRain();
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  if(reducedMotion.matches||document.hidden)return;

  const canvas=document.createElement('canvas');
  canvas.className='confetti-rain';
  canvas.setAttribute('aria-hidden','true');
  const context=canvas.getContext('2d');
  if(!context)return;
  const width=window.innerWidth,height=window.innerHeight,scale=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
  context.scale(scale,scale);
  document.body.append(canvas);

  const colors=['#ef5b69','#ffc83d','#35a9e8','#9965df','#f18ac2','#36b78b'];
  const pieces=Array.from({length:width<600?100:160},(_,i)=>({
    x:Math.random()*width,y:-20-Math.random()*height*.65,
    speed:height*(.48+Math.random()*.35),drift:Math.random()*50-25,
    size:6+Math.random()*7,phase:Math.random()*Math.PI*2,spin:Math.random()*5-2.5,
    color:colors[i%colors.length],round:i%4===0
  }));
  let frame=0,started=null,last=0;
  const stop=()=>{
    cancelAnimationFrame(frame);canvas.remove();
    document.removeEventListener('visibilitychange',stop);
    window.removeEventListener('resize',stop);
    reducedMotion.removeEventListener('change',stop);
    if(stopRain===stop)stopRain=()=>{};
  };
  stopRain=stop;
  document.addEventListener('visibilitychange',stop);
  window.addEventListener('resize',stop);
  reducedMotion.addEventListener('change',stop);

  const draw=now=>{
    if(started===null){started=now;last=now;}
    const elapsed=(now-started)/1000,delta=Math.min((now-last)/1000,.05);last=now;
    if(elapsed>3.2){stop();return;}
    context.clearRect(0,0,width,height);
    context.globalAlpha=Math.min(1,(3.2-elapsed)/.5);
    for(const piece of pieces){
      piece.y+=piece.speed*delta;piece.x+=piece.drift*delta;
      context.save();
      context.translate(piece.x+Math.sin(elapsed*3+piece.phase)*22,piece.y);
      context.rotate(piece.phase+elapsed*piece.spin);
      context.scale(1,.35+Math.abs(Math.cos(elapsed*5+piece.phase))*.65);
      context.fillStyle=piece.color;
      if(piece.round){context.beginPath();context.arc(0,0,piece.size*.45,0,Math.PI*2);context.fill();}
      else context.fillRect(-piece.size/2,-piece.size/3,piece.size,piece.size*.65);
      context.restore();
    }
    frame=requestAnimationFrame(draw);
  };
  frame=requestAnimationFrame(draw);
}
