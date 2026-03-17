// CAROUSEL
let cur=0;
function goSlide(i){ document.querySelectorAll('.slide').forEach((s,j)=>s.classList.toggle('active',j===i)); document.querySelectorAll('.cdot').forEach((d,j)=>d.classList.toggle('on',j===i)); cur=i; }
function moveSlide(d){ goSlide((cur+d+4)%4); resetAuto(); }
let autoT; function resetAuto(){ clearInterval(autoT); autoT=setInterval(()=>goSlide((cur+1)%4),5000); } resetAuto();

// FILTER
function filterCards(cat,el){
  document.querySelectorAll('.ftab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('.bcard[data-cat]').forEach(c=>{
    const cats=c.dataset.cat||'';
    c.style.display=(cat==='all'||cats.includes(cat))?'':'none';
  });
}

// LIVE TICKER