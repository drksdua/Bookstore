/* =================== CONFIG =================== */
const DATA_URL = "/data/books.json";

/* =================== HELPERS =================== */
async function loadBooks(){ const r=await fetch(DATA_URL,{cache:"no-store"}); return r.json(); }
function money(v,cur="UAH"){ return `${v} ${cur}`; }
function splitAuthors(b){ return (b.author||"").split(",").map(s=>s.trim()).filter(Boolean); }

/* опис: безпечний текст + обрізання */
function safeText(s){ return String(s ?? "").replace(/[<>]/g, ""); }

/* опис: форматування з переносами рядків (без HTML) */
function descToHtml(desc){
  const clean = safeText((desc||"").trim());
  if(!clean) return "";
  return clean.replace(/\n/g, "<br>");
}
function shortDesc(b, max=110){
  const d = safeText((b.description||"").trim());
  if(!d) return "";
  return d.length > max ? d.slice(0, max-1).trimEnd() + "…" : d;
}

/* =================== CART =================== */
const CART_KEY="litstore_cart";
function readCart(){ try{return JSON.parse(localStorage.getItem(CART_KEY)||"[]");}catch{return[];} }
function writeCart(items){ localStorage.setItem(CART_KEY,JSON.stringify(items)); document.dispatchEvent(new CustomEvent("cart:update",{detail:items})); }
function addToCart(id,qty=1){ const c=readCart(); const i=c.findIndex(x=>x.id===id); if(i>=0)c[i].qty+=qty; else c.push({id,qty}); writeCart(c); }
function setQty(id,qty){ writeCart(readCart().map(x=>x.id===id?{...x,qty}:x).filter(x=>x.qty>0)); }
function removeFromCart(id){ writeCart(readCart().filter(x=>x.id!==id)); }
function clearCart(){ writeCart([]); }
async function enrichCart(){
  const all=await loadBooks(); const map=new Map(all.map(b=>[b.id,b]));
  const items=readCart().map(c=>{const b=map.get(c.id); if(!b)return null; return {...c,book:b,lineTotal:b.price*c.qty};}).filter(Boolean);
  const total=items.reduce((s,x)=>s+x.lineTotal,0);
  return {items,total,currency:items[0]?.book?.currency||"UAH"};
}

/* badge */
function updateCartBadge(){
  const el=document.querySelector("#cartBadge"); if(!el) return;
  const q=readCart().reduce((s,x)=>s+(x.qty||0),0);
  if(q>0){ el.textContent=q; el.classList.remove("hidden"); } else { el.textContent="0"; el.classList.add("hidden"); }
}
document.addEventListener("cart:update",updateCartBadge);

/* =================== CARDS =================== */
function bookCard(b){
  return `
  <div class="card" data-id="${b.id}">
    <a class="card-link" href="/product.html?id=${encodeURIComponent(b.id)}" style="text-decoration:none;color:inherit">
      <div class="thumb">${b.cover?`<img src="${b.cover}" alt="${safeText(b.title)} обкладинка">`:""}</div>
      <div class="body">
        <div class="title">${safeText(b.title)}</div>
        <div class="meta">${safeText(b.author)}${b.genre?` • ${safeText(b.genre)}`:""}</div>
        <div class="price">${money(b.price,b.currency)}</div>
      </div>
    </a>
    <div class="actions">
      <button class="btn add-to-cart" data-id="${b.id}">У кошик</button>
      <a class="btn secondary" href="/product.html?id=${encodeURIComponent(b.id)}">Детальніше</a>
    </div>
  </div>`;
}


/* компактна картка ДЛЯ ГОЛОВНОЇ — тільки “Детальніше” */
function homeCard(b){
  return `
  <div class="card" data-id="${b.id}">
    <a class="card-link" href="/product.html?id=${encodeURIComponent(b.id)}" style="text-decoration:none;color:inherit">
      <div class="thumb">${b.cover?`<img src="${b.cover}" alt="${safeText(b.title)} обкладинка">`:""}</div>
      <div class="body">
        <div class="title">${safeText(b.title)}</div>
        <div class="meta">${safeText(b.author)}${b.genre?` • ${safeText(b.genre)}`:""}</div>
        <div class="price">${money(b.price,b.currency)}</div>
      </div>
    </a>
    <div class="actions">
      <a class="btn secondary" href="/product.html?id=${encodeURIComponent(b.id)}" style="flex:1">Детальніше</a>
    </div>
  </div>`;
}

/* =================== HOME =================== */
async function renderHome(){
  const grid=document.querySelector("#homeGrid");
  if(!grid) return;

  const ROTATE_MS=18000;
  const FADE_MS=1200;
  grid.style.transition=`opacity ${FADE_MS}ms ease`;

  const books=await loadBooks();
  const shuffle=a=>{const b=a.slice(); for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [b[i],b[j]]=[b[j],b[i]];} return b;};

  function renderOnce(){
    grid.style.opacity="0";
    setTimeout(()=>{
      const pick=shuffle(books).slice(0,8);
      grid.innerHTML=pick.map(homeCard).join("");
      requestAnimationFrame(()=>{grid.style.opacity="1";});
    },FADE_MS);
  }
  grid.style.opacity="1";
  grid.innerHTML=shuffle(books).slice(0,8).map(homeCard).join("");
  setInterval(renderOnce,ROTATE_MS);
}

/* =================== CATALOG =================== */
async function renderCatalog(){
  const grid=document.querySelector("#catalogGrid");
  if(!grid) return;

  const books=await loadBooks();

  /* зробити кнопку "Завантажити ще" стабільною (без правки HTML) */
  const loadMoreBtn=document.querySelector("#loadMore");
  if(loadMoreBtn){
    loadMoreBtn.classList.add("load-more");
    loadMoreBtn.classList.add("btn");
    const wrap = loadMoreBtn.parentElement;
    if(wrap){
      wrap.classList.add("load-more-wrap");
      wrap.style.display=""; wrap.style.justifyContent=""; wrap.style.marginTop=""; // прибираємо інлайни, якщо були
    }
  }

  /* controls */
  const searchInput=document.querySelector("#catalogSearch");
  const searchBtn=document.querySelector("#catalogSearchBtn");

  const pillGenre=document.querySelector("#pillGenre");
  const pillAuthor=document.querySelector("#pillAuthor");
  const chooserTitle=document.querySelector("#chooserTitle");
  const optionsBox=document.querySelector("#options");
  const chooser=document.querySelector("#chooser");
  const clearBtn=document.querySelector("#clearFilters");

  /* price (inputs like "від/до") */
  const priceMinInput=document.querySelector("#priceMinInput");
  const priceMaxInput=document.querySelector("#priceMaxInput");
  const priceApplyBtn=document.querySelector("#priceApply");
  const priceMinLabel=document.querySelector("#priceMinLabel");
  const priceMaxLabel=document.querySelector("#priceMaxLabel");
  // панель ціни завжди відкрита — без toggle

  /* sort dd */
  const sortDd=document.querySelector("#sortDd");
  const sortMenu=document.querySelector("#sortMenu");
  const sortTrig=document.querySelector("#sortTrigger");
  const sortLab=document.querySelector("#sortLabel");
  let sortMode="relevance";

  /* state */
  let mode="genre";
  let selectedGenre=""; let selectedAuthor="";
  let filteredCache=[]; let shown=0; const PAGE=12;

  /* options */
  const genreMap={}, authorMap={};
  books.forEach(b=>{
    if(b.genre) genreMap[b.genre]=(genreMap[b.genre]||0)+1;
    splitAuthors(b).forEach(a=>authorMap[a]=(authorMap[a]||0)+1);
  });
  const toList=m=>Object.entries(m).map(([name,count])=>({name,count}));
  const byCountDesc=(a,b)=>b.count-a.count;
  const genreOptions=toList(genreMap).sort(byCountDesc);
  const authorOptions=toList(authorMap).sort(byCountDesc);

  /* ===== PRICE INPUTS ===== */
  const minPrice=Math.min(...books.map(b=>b.price));
  const maxPrice=Math.max(...books.map(b=>b.price));
  const STEP=1;

  let activeMin=minPrice;
  let activeMax=maxPrice;

  function clampPrice(v, fallback){
    const n = (v===null || v===undefined || v==="") ? fallback : parseInt(v, 10);
    if(Number.isNaN(n)) return fallback;
    return Math.max(minPrice, Math.min(maxPrice, Math.round(n/STEP)*STEP));
  }
  function syncPriceLabels(){
    if(priceMinLabel) priceMinLabel.textContent = String(activeMin);
    if(priceMaxLabel) priceMaxLabel.textContent = String(activeMax);
  }
  function setPriceInputs(lo, hi){
    if(priceMinInput) priceMinInput.value = String(lo);
    if(priceMaxInput) priceMaxInput.value = String(hi);
  }
  function readAndNormalizeInputs(){
    let lo = clampPrice(priceMinInput?.value, minPrice);
    let hi = clampPrice(priceMaxInput?.value, maxPrice);
    if(lo>hi){
      // якщо користувач ввів навпаки — просто міняємо місцями
      [lo,hi]=[hi,lo];
    }
    return [lo,hi];
  }
  function applyPriceInputs(){
    const [lo,hi]=readAndNormalizeInputs();
    activeMin=lo; activeMax=hi;
    setPriceInputs(lo,hi);
    syncPriceLabels();
    apply();
  }

  // Повертає поточний застосований діапазон цін.
  // (Поля вводу можуть відрізнятись, поки не натиснули "Застосувати".)
  function getRange(){
    return [activeMin, activeMax];
  }

  // init inputs
  if(priceMinInput){ priceMinInput.min=minPrice; priceMinInput.max=maxPrice; priceMinInput.step=STEP; }
  if(priceMaxInput){ priceMaxInput.min=minPrice; priceMaxInput.max=maxPrice; priceMaxInput.step=STEP; }
  setPriceInputs(minPrice, maxPrice);
  syncPriceLabels();

  // Apply button + Enter in inputs
  if(priceApplyBtn){
    priceApplyBtn.addEventListener('click', (e)=>{ e.preventDefault(); applyPriceInputs(); });
  }
  [priceMinInput, priceMaxInput].forEach(inp=>{
    if(!inp) return;
    inp.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); applyPriceInputs(); } });
    // легка валідація на виході з поля
    inp.addEventListener('blur', ()=>{ const [lo,hi]=readAndNormalizeInputs(); setPriceInputs(lo,hi); });
  });

  /* ===== BUILD OPTIONS ===== */
  function buildOptions(list){
    optionsBox.innerHTML="";
    const mk=(label,count,value="")=>{
      const btn=document.createElement("button");
      btn.className="option"; btn.dataset.value=value;
      btn.innerHTML=`${label} <span class="badge">${count}</span>`;
      return btn;
    };
    const all=mk("Усі", books.length, "");
    all.addEventListener("click", ()=>{ selectedGenre=""; selectedAuthor=""; apply(); highlight(); });
    optionsBox.appendChild(all);
    list.forEach(opt=>{
      const btn=mk(opt.name,opt.count,opt.name);
      btn.addEventListener("click", ()=>{
        if(mode==="genre"){ selectedGenre=opt.name; selectedAuthor=""; }
        else { selectedAuthor=opt.name; selectedGenre=""; }
        apply(); highlight();
      });
      optionsBox.appendChild(btn);
    });
  }

  function highlight(){
    optionsBox.querySelectorAll(".option").forEach(el=>el.classList.remove("selected"));
    const val= mode==="genre" ? selectedGenre : selectedAuthor;
    const m=[...optionsBox.querySelectorAll(".option")].find(el=>(el.dataset.value||"") === (val||""));
    if(m) m.classList.add("selected");
  }

  /* ===== SORTING ===== */
  const ukCollator=new Intl.Collator('uk',{sensitivity:'base'});
  function sortList(list){
    const n=x=> (typeof x==="number" && !isNaN(x)) ? x : 0;
    switch(sortMode){
      case "price-asc":  return list.slice().sort((a,b)=>a.price-b.price);
      case "price-desc": return list.slice().sort((a,b)=>b.price-a.price);
      case "title-uk":   return list.slice().sort((a,b)=>ukCollator.compare(a.title,b.title));
      case "newest":     return list.slice().sort((a,b)=>n(b.added)-n(a.added));
      default:           return list;
    }
  }

  let t; const debouncedApply=()=>{ clearTimeout(t); t=setTimeout(apply,80); };

  function apply(){
    const q=(searchInput?.value||"").trim().toLowerCase();
    const [vMin,vMax]=getRange();
    let arr=books.filter(b=>{
      const byQ=!q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) ||
        (b.genre||"").toLowerCase().includes(q) || (b.tags||[]).some(t=>t.toLowerCase().includes(q)) ||
        ((b.description||"").toLowerCase().includes(q));
      const byG=!selectedGenre || b.genre===selectedGenre;
      const byA=!selectedAuthor || splitAuthors(b).includes(selectedAuthor);
      return byQ && byG && byA && b.price>=vMin && b.price<=vMax;
    });
    arr=sortList(arr);
    filteredCache=arr; shown=0; renderMore(true);
  }

  function renderMore(reset=false){
    const btn=document.querySelector("#loadMore");
    if(reset) grid.innerHTML="";
    if(filteredCache.length===0){
      grid.innerHTML=`
        <div class="card" style="grid-column:1/-1">
          <div class="body">
            <div class="title">Нічого не знайдено</div>
            <p class="muted">За цими фільтрами немає результатів. Очистити?</p>
            <button id="btnClearInline" class="btn secondary">Очистити фільтри</button>
          </div>
        </div>`;
      btn?.classList.add("hidden");
      grid.querySelector("#btnClearInline")?.addEventListener("click", ()=>{
        if(searchInput) searchInput.value="";
        setInputs(minPrice,maxPrice);
        commitPrice(true);
        selectedGenre=""; selectedAuthor=""; setSort("relevance"); switchTo("genre");
      });
      return;
    }
    const next=filteredCache.slice(shown, shown+PAGE);
    grid.insertAdjacentHTML("beforeend", next.map(bookCard).join(""));
    grid.querySelectorAll(".add-to-cart").forEach(b=>{
      if(b.dataset.binded) return; b.dataset.binded="1";
      b.addEventListener("click", e=>{
        e.preventDefault(); e.stopPropagation();
        addToCart(b.dataset.id,1);
        b.textContent="Додано!";
        setTimeout(()=>b.textContent="У кошик",900);
      });
    });
    shown+=next.length;
    if(btn){
      (shown<filteredCache.length)?btn.classList.remove("hidden"):btn.classList.add("hidden");
      btn.onclick=()=>renderMore(false);
    }
  }

  /* ===== SWITCH MODE ===== */
  function switchTo(m){
    mode = (m==="author") ? "author" : "genre";
    pillGenre.classList.toggle("active", mode==="genre");
    pillAuthor.classList.toggle("active", mode==="author");
    chooserTitle.textContent = mode==="genre" ? "Оберіть жанр" : "Оберіть автора";
    if(searchInput) searchInput.value="";
    if(mode==="genre") selectedAuthor=""; else selectedGenre="";
    buildOptions(mode==="genre" ? genreOptions : authorOptions);
    highlight(); apply();
  }

  /* ===== SORT DROPDOWN ===== */
  function setSort(modeNew){
    sortMode = modeNew;
    const labels = {
      "relevance":"Релевантність",
      "newest":"Новизна",
      "price-asc":"Ціна ↑",
      "price-desc":"Ціна ↓",
      "title-uk":"Алфавітом"
    };
    sortLab.textContent = labels[sortMode] || "Релевантність";
    apply();
  }
  sortTrig.addEventListener("click", (e)=>{ e.preventDefault(); sortDd.classList.toggle("open"); });
  sortMenu.addEventListener("click", (e)=>{
    const b=e.target.closest("button"); if(!b) return;
    setSort(b.dataset.sort||"relevance");
    sortDd.classList.remove("open");
  });
  document.addEventListener("click",(e)=>{ if(!sortDd.contains(e.target)) sortDd.classList.remove("open"); });

  /* ===== EVENTS ===== */
  searchBtn.addEventListener("click", apply);
  searchInput?.addEventListener("keydown", e=>{ if(e.key==="Enter") apply(); });
  pillGenre.addEventListener("click", ()=>switchTo("genre"));
  pillAuthor.addEventListener("click", ()=>switchTo("author"));

  clearBtn.addEventListener("click", ()=>{
    if(searchInput) searchInput.value="";
    setInputs(minPrice,maxPrice);
    commitPrice(true);
    selectedGenre=""; selectedAuthor=""; setSort("relevance"); switchTo("genre");
  });

  /* стабільна висота chooser */
  function computeStableHeight(){
    if(!chooser) return;
    const measure=(list)=>{
      const tmp=document.createElement("div"); tmp.className="chooser-inline";
      tmp.style.cssText="position:absolute;visibility:hidden;pointer-events:none;left:-9999px;top:-9999px";
      const h3=document.createElement("h3"); h3.textContent="tmp"; tmp.appendChild(h3);
      const opts=document.createElement("div"); opts.className="options"; tmp.appendChild(opts);
      const mk=(l,c)=>{ const b=document.createElement("button"); b.className="option"; b.innerHTML=`${l} <span class="badge">${c}</span>`; return b; };
      opts.appendChild(mk("Усі", books.length)); list.forEach(o=>opts.appendChild(mk(o.name,o.count)));
      document.body.appendChild(tmp); const h=tmp.offsetHeight; document.body.removeChild(tmp); return h;
    };
    const h=Math.max(measure(genreOptions), measure(authorOptions));
    chooser.style.setProperty("--chooser-height", `${Math.max(h,160)}px`);
  }

  computeStableHeight();
  switchTo("genre");

  let resizeT;
  window.addEventListener("resize", ()=>{
    clearTimeout(resizeT);
    resizeT=setTimeout(()=>{
      computeStableHeight();
      switchTo(mode);
    },120);
  });
}

/* =================== PRODUCT =================== */
async function renderProduct(){
  const wrap=document.querySelector("#productView"); if(!wrap) return;
  const id=new URL(location.href).searchParams.get("id");
  const books=await loadBooks(); const b=books.find(x=>x.id===id);

  if(!b){
    wrap.innerHTML = `<p>Книгу не знайдено.</p>`;
    return;
  }

  const rawDesc = (b.description || "").trim();
  const desc = safeText(rawDesc);
  const hasDesc = desc.length > 0;
  const isLong = desc.length > 420;
  const short = isLong ? (desc.slice(0, 420).trimEnd() + "…") : desc;

  wrap.innerHTML = `
    <div class="preview">
      ${b.cover ? `<img src="${b.cover}" alt="${safeText(b.title)} — ${safeText(b.author)}">` : ""}
    </div>
    <div>
      <h1 style="margin:0 0 8px">${safeText(b.title)}</h1>
      <div class="meta" style="color:var(--muted);margin-bottom:8px">
        Автор: ${safeText(b.author)}${b.genre ? ` • ${safeText(b.genre)}` : ""}
      </div>
      ${b.tags?.length ? `
        <div class="meta" style="color:var(--muted);margin-bottom:12px">
          Теги: ${b.tags.map(safeText).join(", ")}
        </div>` : ""}

      <div class="price" style="font-size:20px;margin-top:6px;font-weight:900">${money(b.price,b.currency)}</div>

      <div class="card" style="margin-top:14px">
        <div class="body">
          <div class="title" style="margin-bottom:6px">Опис</div>
          <div class="book-desc" id="bookDesc">
            ${hasDesc ? descToHtml(isLong ? short : desc) : "<span class=\"muted\">Опис ще не додано.</span>"}
          </div>
          ${hasDesc && isLong ? `<button class="btn secondary btn-desc-toggle" id="btnDescToggle" style="margin-top:12px">Показати повністю</button>` : ""}
        </div>
      </div>

      <div class="buy" style="margin-top:16px;display:flex;gap:10px">
        <button class="btn" id="btnAddToCart">У кошик</button>
        <a class="btn secondary" href="/catalog.html">Повернутись</a>
      </div>
    </div>
  `;

  const btn=document.querySelector("#btnAddToCart");
  if(btn){
    btn.addEventListener("click", ()=>{
      addToCart(b.id,1);
      btn.textContent="Додано!";
      setTimeout(()=>btn.textContent="У кошик",900);
    });
  }

  const toggle=document.querySelector("#btnDescToggle");
  if(toggle){
    const box=document.querySelector("#bookDesc");
    let open=false;
    toggle.addEventListener("click", ()=>{
      open=!open;
      box.innerHTML = descToHtml(open ? desc : short);
      toggle.textContent = open ? "Згорнути" : "Показати повністю";
    });
  }
}

/* =================== CART =================== */
async function renderCart(){
  const host=document.querySelector("#cartView"); if(!host) return;

  function empty(){
    host.innerHTML=`<p class="muted">Кошик порожній.</p><a class="btn" href="/catalog.html">Перейти в каталог</a>`;
  }
  async function draw(){
    const {items,total,currency}=await enrichCart();
    if(items.length===0){ empty(); return; }
    host.innerHTML=`
      <div style="overflow:auto">
        <table class="cart-table" style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th style="text-align:left;padding:10px 8px;border-bottom:1px solid var(--line)">Книга</th>
            <th style="text-align:left;padding:10px 8px;border-bottom:1px solid var(--line)">Автор</th>
            <th style="text-align:right;padding:10px 8px;border-bottom:1px solid var(--line)">Ціна</th>
            <th style="text-align:center;padding:10px 8px;border-bottom:1px solid var(--line)">К-сть</th>
            <th style="text-align:right;padding:10px 8px;border-bottom:1px solid var(--line)">Разом</th>
            <th style="padding:10px 8px;border-bottom:1px solid var(--line)"></th>
          </tr></thead>
          <tbody>
            ${items.map(x=>`
            <tr data-id="${x.book.id}">
              <td style="padding:10px 8px">${safeText(x.book.title)}</td>
              <td style="padding:10px 8px">${safeText(x.book.author)}</td>
              <td style="padding:10px 8px;text-align:right">${money(x.book.price,x.book.currency)}</td>
              <td style="padding:10px 8px;text-align:center">
                <button class="qty-dec" style="min-width:28px">−</button>
                <input class="qty" type="number" min="1" value="${x.qty}" style="width:56px;text-align:center;margin:0 6px">
                <button class="qty-inc" style="min-width:28px">+</button>
              </td>
              <td class="line-total" style="padding:10px 8px;text-align:right">${money(x.lineTotal,x.book.currency)}</td>
              <td style="padding:10px 8px;text-align:center"><button class="remove">×</button></td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:12px;align-items:center;margin-top:16px">
        <div style="font-weight:900">Сума: ${money(total,currency)}</div>
        <button id="btnClear" class="btn secondary">Очистити</button>
        <a id="btnCheckout" class="btn" href="/checkout.html">Оформити</a>
      </div>`;
    host.querySelectorAll("tbody tr").forEach(tr=>{
      const id=tr.dataset.id;
      tr.querySelector(".qty-dec").addEventListener("click", ()=>{ const i=tr.querySelector(".qty"); const v=Math.max(1,(+i.value||1)-1); i.value=v; setQty(id,v); draw(); });
      tr.querySelector(".qty-inc").addEventListener("click", ()=>{ const i=tr.querySelector(".qty"); const v=(+i.value||1)+1; i.value=v; setQty(id,v); draw(); });
      tr.querySelector(".qty").addEventListener("change", e=>{ const v=Math.max(1, parseInt(e.target.value||"1",10)); setQty(id,v); draw(); });
      tr.querySelector(".remove").addEventListener("click", ()=>{ removeFromCart(id); draw(); });
    });
    host.querySelector("#btnClear").addEventListener("click", ()=>{ if(confirm("Очистити кошик?")){ clearCart(); draw(); } });
  }
  await draw();
  document.addEventListener("cart:update", draw);
}

/* =================== CHECKOUT =================== */
async function renderCheckout(){
  const box=document.querySelector("#checkoutView"); if(!box) return;
  const {items,total,currency}=await enrichCart();
  if(items.length===0){
    box.innerHTML=`<p class="muted">Кошик порожній.</p><a class="btn" href="/catalog.html">До каталогу</a>`;
    return;
  }
  box.innerHTML=`
    <div class="grid" style="grid-template-columns:2fr 1fr; gap:20px; padding:12px 0">
      <div class="card"><div class="body">
        <div class="title">Дані покупця</div>
        <form id="checkoutForm" class="form">
          <div class="field"><label>ПІБ</label><input type="text" name="name" required></div>
          <div class="field"><label>Email</label><input type="email" name="email" required></div>
          <div class="field"><label>Телефон</label><input type="tel" name="phone" required></div>
          <div class="field"><label>Доставка</label>
            <select name="delivery" required>
              <option value="nova">Нова Пошта (відділення)</option>
              <option value="courier">Кур'єр по місту</option>
              <option value="pickup">Самовивіз</option>
            </select>
          </div>
          <div class="field"><label>Адреса / Відділення</label><input type="text" name="address" required></div>
          <div class="field"><label>Оплата</label>
            <div class="radios">
              <label><input type="radio" name="pay" value="card" checked> Банківська картка</label>
              <label><input type="radio" name="pay" value="cod"> Післяплата</label>
            </div>
          </div>
          <div style="display:flex; gap:10px; margin-top:8px">
            <a class="btn secondary" href="/cart.html">Назад</a>
            <button type="submit" class="btn">Оплатити</button>
          </div>
        </form>
      </div></div>
      <div class="card"><div class="body">
        <div class="title">Ваше замовлення</div>
        <div id="orderList" style="display:flex;flex-direction:column;gap:8px;margin-top:6px"></div>
        <div style="margin-top:10px;font-weight:900">Сума: ${money(total,currency)}</div>
      </div></div>
    </div>`;
  const list=box.querySelector("#orderList");
  list.innerHTML=items.map(x=>`
    <div style="display:flex;justify-content:space-between;gap:8px;border-bottom:1px dashed var(--line);padding-bottom:6px">
      <div>${safeText(x.book.title)} <span class="muted">× ${x.qty}</span></div>
      <div>${money(x.lineTotal,x.book.currency)}</div>
    </div>`).join("");
  box.querySelector("#checkoutForm").addEventListener("submit", e=>{
    e.preventDefault();
    clearCart();
    box.innerHTML=`<div class="card"><div class="body">
      <h2 style="margin:0 0 10px">Дякуємо за замовлення! ✅</h2>
      <div style="margin-top:12px; display:flex; gap:10px">
        <a class="btn" href="/catalog.html">Продовжити покупки</a>
        <a class="btn secondary" href="/index.html">На головну</a>
      </div>
    </div></div>`;
  });
}

/* =================== NAV ACTIVE + BADGE =================== */
(function(){
  const seg=(p)=>{ const last=(p||"").split("/").pop()||"index.html"; return last.replace(/\.html$/i,"").toLowerCase(); };
  const current=seg(location.pathname);
  document.querySelectorAll(".nav a").forEach(a=>{
    const base=seg((a.getAttribute("href")||"").replace(/\/+$/,""));
    if(base===current) a.classList.add("active");
  });
  updateCartBadge();
})();

/* =================== RUN =================== */
renderHome().catch(console.error);
renderCatalog().catch(console.error);
renderProduct().catch(console.error);
renderCart().catch(console.error);
renderCheckout().catch(console.error);
