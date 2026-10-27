const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
(async()=>{
  const box=document.querySelector('#railCods');
  if(box){try{const r=await fetch('/api/cods');const cods=await r.json();const groups=new Map();cods.forEach(c=>{const k=c.ec||'Без группы';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(c)});box.innerHTML=[...groups].map(([name,items])=>`<details class="rail-ec"><summary><span>${safe(name)}</span><b>${items.length}</b></summary><div class="rail-ec-items">${items.map(c=>`<a class="rail-cod" href="/#cods"><strong>${safe(c.name)}</strong><small>${safe(c.cidr||c.start||'')}</small></a>`).join('')}</div></details>`).join('')||'<div class="rail-empty">Нет ЦОДов</div>'}catch{box.innerHTML='<div class="rail-empty">Список ЦОДов недоступен</div>'}}
  const toc=[...document.querySelectorAll('.guide-toc a')],sections=toc.map(a=>document.querySelector(a.getAttribute('href'))).filter(Boolean);
  if('IntersectionObserver'in window){const io=new IntersectionObserver(entries=>{const active=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(active)toc.forEach(a=>a.classList.toggle('current',a.hash===`#${active.target.id}`))},{rootMargin:'-20% 0px -65% 0px',threshold:[0,.2,.5]});sections.forEach(s=>io.observe(s))}
})();
