'use strict';
const $ = id => document.getElementById(id);
const KEY='ozbekali-reader-v1';
function loadState(){try{return JSON.parse(localStorage.getItem(KEY))||{};}catch{return {};}}
let saved=loadState();
let book=null,current=3,mode='text',tab='toc',searchTerm='',toastTimer,scrollTimer,resumeTarget=null;
let prefs={size:22,font:'serif',spacing:'1.9',theme:'paper',...saved.prefs};
let bookmarks=Array.isArray(saved.bookmarks)?saved.bookmarks.filter(n=>Number.isInteger(n)&&n>=1&&n<=351):[];
let last=saved.last&&Number.isInteger(saved.last.page)?saved.last:null;
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const pagePath=n=>`pages/${String(n).padStart(3,'0')}.webp`;
const escapeHTML=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function save(){try{localStorage.setItem(KEY,JSON.stringify({prefs,bookmarks,last}));}catch{}}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,2300);}
function applyPrefs(){
 prefs.size=clamp(Number(prefs.size)||22,16,34);
 if(!['paper','sepia','dark'].includes(prefs.theme))prefs.theme='paper';
 document.documentElement.dataset.theme=prefs.theme;
 document.documentElement.style.setProperty('--reader-size',prefs.size+'px');
 document.documentElement.style.setProperty('--line-space',['1.7','1.9','2.2'].includes(String(prefs.spacing))?prefs.spacing:'1.9');
 document.documentElement.style.setProperty('--book-font',prefs.font==='sans'?"Arial, 'Helvetica Neue', sans-serif":"Georgia, 'Times New Roman', serif");
 $('fontValue').textContent=prefs.size+' px';$('fontFamily').value=prefs.font;$('lineSpacing').value=prefs.spacing;
 $('themeButton').setAttribute('aria-label',prefs.theme==='dark'?'Күндізгі режимге ауысу':'Түнгі режимге ауысу');
 document.querySelectorAll('[data-theme-choice]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.themeChoice===prefs.theme));
 $('smallerFont').disabled=prefs.size<=16;$('largerFont').disabled=prefs.size>=34;
}
function changePref(key,value){prefs[key]=value;applyPrefs();save();}
applyPrefs();
function chapterAt(n){if(!book)return {page:3,title:'Алғысөз'};return [...book.chapters].reverse().find(c=>c.page<=n)||{page:1,title:'Кітап мұқабасы'};}
function renderSidebar(){
 if(!book)return;
 const active=chapterAt(current);
 $('tocTab').classList.toggle('active',tab==='toc');$('savedTab').classList.toggle('active',tab==='saved');
 $('tocTab').setAttribute('aria-selected',tab==='toc');$('savedTab').setAttribute('aria-selected',tab==='saved');
 $('savedCount').textContent=bookmarks.length;
 const list=tab==='toc'?book.chapters:[...bookmarks].sort((a,b)=>a-b).map(n=>({page:n,title:chapterAt(n).title}));
 $('chapters').replaceChildren();
 if(!list.length){const d=document.createElement('p');d.className='empty-bookmarks';d.textContent='Әзірге бетбелгі жоқ. Қажетті беттің жоғарғы жағындағы белгішені басыңыз.';$('chapters').append(d);return;}
 list.forEach((c,i)=>{
  const b=document.createElement('button');b.className='chapter-item';
  const isActive=tab==='toc'?c.page===active.page:c.page===current;
  b.classList.toggle('active',isActive);if(isActive)b.setAttribute('aria-current','page');
  b.innerHTML=`<span class="chapter-number">${String(i+1).padStart(2,'0')}</span><span class="chapter-title">${escapeHTML(c.title)}</span><span class="chapter-page">${c.page}</span>`;
  b.addEventListener('click',()=>{goTo(c.page);closeSidebar();});$('chapters').append(b);
 });
}
function updateBookmark(){const on=bookmarks.includes(current);$('bookmarkButton').setAttribute('aria-pressed',on);$('bookmarkButton').setAttribute('aria-label',on?'Осы беттен бетбелгіні алып тастау':'Осы бетке бетбелгі қою');$('savedCount').textContent=bookmarks.length;}
function highlight(text){if(!searchTerm)return escapeHTML(text);const lower=text.toLocaleLowerCase('kk');const q=searchTerm.toLocaleLowerCase('kk');let start=0,out='',pos;while((pos=lower.indexOf(q,start))!==-1){out+=escapeHTML(text.slice(start,pos))+'<mark>'+escapeHTML(text.slice(pos,pos+q.length))+'</mark>';start=pos+q.length;}return out+escapeHTML(text.slice(start));}
function renderPage({scroll=0,move=true}={}){
 if(!book)return;
 const page=book.pages[current-1],chapter=chapterAt(current);
 $('bookIntro').hidden=current!==3;
 $('sectionTitle').textContent=current===1?'Кітап мұқабасы':current===2?'Титул беті':chapter.title;
 $('sectionLabel').textContent=current<=7?'КІТАПТЫҢ БАСЫ':current>=349?'БАСЫЛЫМ ДЕРЕКТЕРІ':`МӘДЕНИ МАЙДАН · ${book.chapters.findIndex(c=>c.page===chapter.page)+1}-БӨЛІМ`;
 $('pageInput').value=current;$('pageLabel').textContent=`${current} / 351 бет`;$('bottomPage').textContent=current;
 $('prevButton').disabled=current<=1;$('nextButton').disabled=current>=351;
 $('bookText').replaceChildren();
 if(current<=2){const img=document.createElement('img');img.className='page-illustration';img.src=current===1?'cover.webp':pagePath(2);img.alt=current===1?'Кітап мұқабасы':'Кітаптың титул беті';$('bookText').append(img);}
 else if(page.blocks.length){page.blocks.forEach((b,i)=>{if(i===0&&b.type==='h'&&current===chapter.page&&b.text.toLocaleLowerCase('kk')===chapter.title.toLocaleLowerCase('kk'))return;const el=document.createElement(b.type==='h'?'h3':'p');el.innerHTML=highlight(b.text);$('bookText').append(el);});}
 else {const p=document.createElement('p');p.textContent='Бұл бетте сурет бар. Оны «Түпнұсқа» режимінде көріңіз.';$('bookText').append(p);}
 $('scanImage').src=pagePath(current);$('scanImage').alt=`Кітаптың ${current}-беті, түпнұсқа`;$('scanImage').classList.remove('zoomed');
 $('sourceNote').hidden=current<=2;
 resumeTarget=current===3&&last&&last.page>3?{...last}:null;
 $('resumeBanner').hidden=!resumeTarget;
 if(resumeTarget)$('resumeText').textContent=`Соңғы рет ${resumeTarget.page}-бетте тоқтадыңыз.`;
 updateBookmark();renderSidebar();renderMode();updateProgress(0);
 document.title=`${current}-бет · ${chapter.title} — Өзбекәлі`;
 if(move){requestAnimationFrame(()=>{
  if(scroll>0){const max=document.documentElement.scrollHeight-innerHeight;window.scrollTo({top:max*scroll,behavior:'instant'});}
  else if(current===3)window.scrollTo({top:0,behavior:'instant'});
  else window.scrollTo({top:Math.max(0,$('reader').offsetTop-105),behavior:'instant'});
 });}
 const next=current+1;if(next<=351){const img=new Image();img.src=pagePath(next);}
}
function renderMode(){const text=mode==='text';$('bookText').hidden=!text;$('scanView').hidden=text;$('textMode').classList.toggle('active',text);$('scanMode').classList.toggle('active',!text);$('textMode').setAttribute('aria-pressed',text);$('scanMode').setAttribute('aria-pressed',!text);$('sourceNote').hidden=!text||current<=2;}
function updateProgress(fraction){const value=clamp((current-1+fraction)/351*100,0,100);const pct=Math.round(value);$('sidePercent').textContent=pct+'%';$('sideProgress').style.width=value+'%';$('topProgress').style.width=value+'%';$('sidePage').textContent=`${current}-бет · ${351-current} бет қалды`;}
function remember(){if(!book)return;const max=document.documentElement.scrollHeight-innerHeight;const ratio=max>0?clamp(window.scrollY/max,0,1):0;last={page:current,scroll:ratio};updateProgress(ratio);save();}
function goTo(n){if(!book)return;n=clamp(Math.floor(Number(n))||1,1,351);remember();current=n;history.replaceState(null,'',`#page=${n}`);renderPage();last={page:n,scroll:0};save();}
function closeSidebar(){$('sidebar').classList.remove('open');$('shade').hidden=true;$('menuButton').setAttribute('aria-expanded','false');}
$('menuButton').addEventListener('click',()=>{const open=!$('sidebar').classList.contains('open');$('sidebar').classList.toggle('open',open);$('shade').hidden=!open;$('menuButton').setAttribute('aria-expanded',open);});
$('shade').addEventListener('click',closeSidebar);
$('tocTab').addEventListener('click',()=>{tab='toc';renderSidebar();});$('savedTab').addEventListener('click',()=>{tab='saved';renderSidebar();});
$('jumpForm').addEventListener('submit',e=>{e.preventDefault();goTo($('pageInput').value);closeSidebar();});
$('prevButton').addEventListener('click',()=>goTo(current-1));$('nextButton').addEventListener('click',()=>goTo(current+1));
$('resumeButton').addEventListener('click',()=>{if(resumeTarget){const target={...resumeTarget};goTo(target.page);if(target.scroll)requestAnimationFrame(()=>window.scrollTo({top:(document.documentElement.scrollHeight-innerHeight)*target.scroll,behavior:'instant'}));}});
$('bookmarkButton').addEventListener('click',()=>{if(!book)return;if(bookmarks.includes(current)){bookmarks=bookmarks.filter(n=>n!==current);toast('Бетбелгі алынды');}else{bookmarks.push(current);toast(`${current}-бет сақталды`);}save();updateBookmark();renderSidebar();});
$('textMode').addEventListener('click',()=>{mode='text';renderMode();});$('scanMode').addEventListener('click',()=>{mode='scan';renderMode();});$('scanImage').addEventListener('click',()=>$('scanImage').classList.toggle('zoomed'));
$('scanImage').addEventListener('error',()=>toast('Бет суреті жүктелмеді. Интернет байланысын тексеріңіз.'));
function closeSettings(){$('settingsPanel').hidden=true;$('settingsButton').setAttribute('aria-expanded','false');}
$('settingsButton').addEventListener('click',()=>{const on=$('settingsPanel').hidden;$('settingsPanel').hidden=!on;$('settingsButton').setAttribute('aria-expanded',on);});$('closeSettings').addEventListener('click',closeSettings);
document.addEventListener('click',e=>{if(!$('settingsPanel').hidden&&!$('settingsPanel').contains(e.target)&&!$('settingsButton').contains(e.target))closeSettings();});
$('smallerFont').addEventListener('click',()=>changePref('size',prefs.size-2));$('largerFont').addEventListener('click',()=>changePref('size',prefs.size+2));$('fontFamily').addEventListener('change',e=>changePref('font',e.target.value));$('lineSpacing').addEventListener('change',e=>changePref('spacing',e.target.value));
document.querySelectorAll('[data-theme-choice]').forEach(b=>b.addEventListener('click',()=>changePref('theme',b.dataset.themeChoice)));
$('themeButton').addEventListener('click',()=>changePref('theme',prefs.theme==='dark'?'paper':'dark'));
function openSearch(){closeSettings();$('searchDialog').showModal();$('searchInput').focus();}
$('searchButton').addEventListener('click',openSearch);$('closeSearch').addEventListener('click',()=>$('searchDialog').close());$('searchDialog').addEventListener('click',e=>{if(e.target===$('searchDialog')){const r=$('searchDialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('searchDialog').close();}});
let searchTimer;
$('searchInput').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(runSearch,130);});
function runSearch(){
 const q=$('searchInput').value.trim();$('searchResults').replaceChildren();
 if(!book){$('searchInfo').textContent='Кітап жүктелуде…';return;}
 if(q.length<2){$('searchInfo').textContent=q?'Кемінде 2 әріп жазыңыз.':'Кітаптың барлық 351 бетінен іздеңіз.';return;}
 const query=q.toLocaleLowerCase('kk');let hits=[];
 book.pages.forEach(p=>{const idx=p.text.toLocaleLowerCase('kk').indexOf(query);if(idx!==-1)hits.push({page:p.page,text:p.text,index:idx});});
 $('searchInfo').textContent=hits.length?`${hits.length} беттен табылды${hits.length>80?' · алғашқы 80 нәтиже көрсетілген':''}`:'Сәйкес сөз табылмады. Басқа сөзбен іздеп көріңіз.';
 hits.slice(0,80).forEach(hit=>{
  const start=Math.max(0,hit.index-65),end=Math.min(hit.text.length,hit.index+q.length+115);const excerpt=hit.text.slice(start,end);const pos=hit.index-start;
  const button=document.createElement('button');button.className='search-result';button.innerHTML=`<strong>${hit.page}-бет · ${escapeHTML(chapterAt(hit.page).title)}</strong><p>${start?'…':''}${escapeHTML(excerpt.slice(0,pos))}<mark>${escapeHTML(excerpt.slice(pos,pos+q.length))}</mark>${escapeHTML(excerpt.slice(pos+q.length))}${end<hit.text.length?'…':''}</p>`;
  button.addEventListener('click',()=>{searchTerm=q;mode='text';goTo(hit.page);$('searchDialog').close();closeSidebar();requestAnimationFrame(()=>$('bookText').querySelector('mark')?.scrollIntoView({block:'center',behavior:'instant'}));});$('searchResults').append(button);
 });
}
window.addEventListener('keydown',e=>{
 const editing=['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName);
 if(e.key==='Escape'){closeSettings();closeSidebar();return;}
 if(e.key==='/'&&!editing&&!$('searchDialog').open){e.preventDefault();openSearch();return;}
 if(editing||$('searchDialog').open||!$('settingsPanel').hidden||e.ctrlKey||e.metaKey||e.altKey)return;
 if(e.key==='ArrowRight'&&current<351){e.preventDefault();searchTerm='';goTo(current+1);}
 if(e.key==='ArrowLeft'&&current>1){e.preventDefault();searchTerm='';goTo(current-1);}
});
window.addEventListener('scroll',()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(remember,180);},{passive:true});
window.addEventListener('pagehide',remember);
window.addEventListener('hashchange',()=>{const match=location.hash.match(/page=(\d+)/);if(match)goTo(match[1]);});
fetch('book.json').then(r=>{if(!r.ok)throw new Error('Book unavailable');return r.json();}).then(data=>{
 if(data.pages.length!==351||data.pages.some(p=>!Array.isArray(p.blocks)))throw new Error('Invalid book data');
 book=data;const match=location.hash.match(/page=(\d+)/);current=clamp(match?Number(match[1]):(last?.page||3),1,351);
 const restore=!match||Number(match[1])===last?.page?last?.scroll||0:0;
 history.replaceState(null,'',`#page=${current}`);renderPage({scroll:restore});
}).catch(()=>{
 $('bookText').innerHTML='<div class="loading-state"><p>Кітап жүктелмеді. Интернет байланысын тексеріңіз.</p><button id="retryLoad" class="retry-button">Қайта жүктеу ↻</button></div>';$('retryLoad').addEventListener('click',()=>location.reload());
 $('chapters').innerHTML='<p class="empty-bookmarks">Мазмұнды ашу үшін бетті қайта жүктеңіз.</p>';
});
