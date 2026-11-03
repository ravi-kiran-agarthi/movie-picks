(function(){
var root=document.documentElement,tb=document.getElementById('theme'),modes=['system','light','dark'];
function setT(t){root.dataset.theme=t;localStorage.setItem('theme',t);tb.textContent=t[0].toUpperCase()+t.slice(1)}
setT(root.dataset.theme||'system');
tb.onclick=function(){setT(modes[(modes.indexOf(root.dataset.theme)+1)%3])};

var D,st='now',g='All',list=document.getElementById('list'),more=document.getElementById('more'),meta=document.getElementById('meta');
var MAIN=['Comedy','Drama','Action'];
function score(m){var a=[m.imdb,m.rt].filter(function(x){return x!=null});return a.length?a.reduce(function(s,x){return s+x},0)/a.length:-1}
function render(){
  var ms=D.movies.filter(function(m){return m.status===st&&(g==='All'||m.genres.indexOf(g)>-1)});
  ms.sort(function(a,b){return score(b)-score(a)});
  var h='';
  ms.forEach(function(m,i){
    h+='<div class="c"><'+(m.poster?'img src="'+m.poster+'" width="300" height="450" alt="" '+(i>5?'loading="lazy" ':'')+'decoding="async"':'div class="ph"')+'>'
    +'<div class="i"><div class="t"></div><div class="s"><a href="'+(m.imdbId?'https://www.imdb.com/title/'+m.imdbId+'/':'https://www.imdb.com/find/?s=tt&q='+encodeURIComponent(m.title+' '+(m.year||'')))+'" target="_blank" rel="noopener">IMDb '+(m.imdb!=null?m.imdb.toFixed(1):'–')+'</a><a href="https://www.rottentomatoes.com/'+(m.rtId||'search?search='+encodeURIComponent(m.title))+'" target="_blank" rel="noopener">Rotten Tomatoes'+(m.rt!=null?' '+m.rt+'%':' ↗')+'</a></div>'
    +'<button class="cp" type="button" data-i="'+i+'">Copy title</button></div></div>';
  });
  list.innerHTML=h||'<p class="meta">No movies.</p>';
  var t=list.querySelectorAll('.t');ms.forEach(function(m,i){t[i].textContent=m.title+(m.year?' ('+m.year+')':'')});
  list._ms=ms;
}
function on(id,fn){document.getElementById(id).addEventListener('click',fn)}
on('status',function(e){var b=e.target.closest('button');if(!b)return;st=b.dataset.s;[].forEach.call(this.children,function(x){x.classList.toggle('on',x===b)});render()});
on('tabs',function(e){var b=e.target.closest('button');if(!b)return;g=b.dataset.g;[].forEach.call(this.querySelectorAll('button'),function(x){x.classList.toggle('on',x===b)});more.value='';render()});
more.onchange=function(){if(!more.value)return;g=more.value;[].forEach.call(document.querySelectorAll('#tabs button'),function(x){x.classList.remove('on')});render()};
list.onclick=function(e){
  var b=e.target.closest('.cp');if(!b)return;
  var m=list._ms[b.dataset.i];
  var done=function(){b.textContent='Copied!';b.classList.add('ok');setTimeout(function(){b.textContent='Copy title';b.classList.remove('ok')},1200)};
  if(navigator.clipboard)navigator.clipboard.writeText(m.title).then(done);
  else{var a=document.createElement('textarea');a.value=m.title;document.body.appendChild(a);a.select();document.execCommand('copy');a.remove();done()}
};
fetch('data.json').then(function(r){return r.json()}).then(function(d){
  D=d;
  var set={};d.movies.forEach(function(m){m.genres.forEach(function(x){if(MAIN.indexOf(x)<0)set[x]=1})});
  Object.keys(set).sort().forEach(function(x){var o=document.createElement('option');o.value=o.textContent=x;more.appendChild(o)});
  meta.textContent=d.month+' · English · sorted by IMDb rating'+(d.sample?' · sample data':'');
  render();
});
})();
