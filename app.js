// ====== Data & Storage ======
const LS_KEY = "softedia:data:v1";
const THEME_KEY = "softedia:theme";
const ADMIN_PASS = "admin123";

function uid(prefix="id"){ return `${prefix}_${Math.random().toString(36).slice(2,9)}`; }

function loadDB(){
  const raw = localStorage.getItem(LS_KEY);
  if (raw) return JSON.parse(raw);
  const now = Date.now();
  const pages = [
    { id: uid("page"), name: "Jeux vidéos", slug:"jeux", sort:1, description:"Trouve des perles gratuites et légales pour jouer sans te ruiner." },
    { id: uid("page"), name: "Streaming", slug:"streaming", sort:2, description:"Alternatives pour regarder ou écouter du contenu légalement." },
    { id: uid("page"), name: "Logiciels", slug:"logiciels", sort:3, description:"Remplace des logiciels payants par des équivalents gratuits." },
    { id: uid("page"), name: "Outils", slug:"outils", sort:4, description:"Utilitaires web et apps pour simplifier ton quotidien." },
  ];
  const cat = (pageId, name, icon, sort, description="") => ({ id: uid("cat"), pageId, name, icon, sort, description });
  const resources = [];
  const categories = [
    cat(pages[0].id, "Stores & DRM", "🎮", 1, "Jeux sans DRM, plateformes ouvertes"),
    cat(pages[0].id, "Indés & rétro", "🕹️", 2, ""),
    cat(pages[2].id, "Création", "✏️", 1, "Montage, graphisme, audio"),
    cat(pages[2].id, "Bureautique", "🧰", 2, ""),
    cat(pages[3].id, "Dev & Web", "🧪", 1, ""),
    cat(pages[3].id, "Productivité", "⚡", 2, ""),
  ];
  const addRes = (title, href, description, tags, pageId, categoryId) => resources.push({
    id: uid("res"), title, href, description, tags, pageId, categoryId, createdAt: now, updatedAt: now
  });
  addRes("GOG Games", "https://www.gog.com/", "Jeux sans DRM, téléchargement direct.", ["DRM-free"], pages[0].id, categories[0].id);
  addRes("Itch.io (gratuits)", "https://itch.io/", "Des milliers d'indés, plein de free/pay-what-you-want.", ["indé","communauté"], pages[0].id, categories[1].id);
  addRes("Krita", "https://krita.org/", "Peinture & illustration pro, open-source.", ["open-source","dessin"], pages[2].id, categories[2].id);
  addRes("LibreOffice", "https://www.libreoffice.org/", "Suite bureautique complète et gratuite.", ["bureautique","open-source"], pages[2].id, categories[3].id);
  addRes("CodeSandbox", "https://codesandbox.io/", "IDE web instantané.", ["web","ide"], pages[3].id, categories[4].id);
  addRes("Notion (free)", "https://www.notion.so/", "Pages, bases, gestion de tâches.", ["notes","orga"], pages[3].id, categories[5].id);

  const db = { pages, categories, resources };
  localStorage.setItem(LS_KEY, JSON.stringify(db));
  return db;
}
function saveDB(db){ localStorage.setItem(LS_KEY, JSON.stringify(db)); }

// ====== State ======
let DB = loadDB();
let currentPageId = DB.pages.sort((a,b)=>(a.sort??0)-(b.sort??0))[0]?.id;
let currentCategoryId = null;
let isAdmin = false;
let animateSidebar = true; // control sidebar animation

// ====== DOM refs ======
const yearSpan = document.getElementById("year");
yearSpan.textContent = new Date().getFullYear();
const searchInput = document.getElementById("search");
const searchInfo = document.getElementById("searchInfo");
const pageTitle = document.getElementById("pageTitle");
const pageDesc = document.getElementById("pageDesc");
const pageActions = document.getElementById("pageActions");
const categoriesEl = document.getElementById("categories");
const contentEl = document.getElementById("content");
const topPages = document.getElementById("topPages");
const modal = document.getElementById("modal");
const modalBody = document.getElementById("modalBody");
const modalTitle = document.getElementById("modalTitle");

// ====== Theme ======
const themeBtn = document.getElementById("themeBtn");
function setTheme(t){
  document.documentElement.classList.toggle("dark", t==="dark");
  localStorage.setItem(THEME_KEY, t);
  themeBtn.textContent = t==="dark" ? "☀️" : "🌙";
}
(function initTheme(){
  const saved = localStorage.getItem(THEME_KEY);
  if (saved==="light" || saved==="dark") setTheme(saved);
  else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) setTheme("dark");
  else setTheme("light");
})();
themeBtn.addEventListener("click", ()=> setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark"));

// ====== Keyboard shortcut ======
window.addEventListener("keydown", (e)=>{
  if ((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==="k"){ e.preventDefault(); searchInput.focus(); }
});

// ====== Helper: Confirm dialog (modal) ======
function confirmDialog({title="Confirmer", message="Êtes-vous sûr ?", confirmText="Supprimer", cancelText="Annuler", danger=true}){
  return new Promise((resolve)=>{
    modalTitle.textContent = title;
    modalBody.innerHTML = `
      <p class="muted" style="margin-bottom:8px">${message}</p>
      <div class="table-actions">
        <button class="btn secondary" data-close>${cancelText}</button>
        <button id="confirmBtn" class="btn ${danger?'danger':''}">${confirmText}</button>
      </div>
    `;
    openModal();
    modalBody.querySelector("#confirmBtn").addEventListener("click", ()=>{ closeModal(); resolve(true); }, {once:true});
    modalBody.querySelectorAll("[data-close]").forEach(el=> el.addEventListener("click", ()=> resolve(false), {once:true}));
  });
}

// ====== Render ======
function renderTopNav(){
  topPages.innerHTML = "";
  DB.pages.sort((a,b)=>(a.sort??0)-(b.sort??0)).forEach(p=>{
    const btn = document.createElement("button");
    btn.textContent = p.name;
    btn.className = (p.id===currentPageId ? "active" : "");
    btn.addEventListener("click", ()=>{
      currentPageId=p.id;
      currentCategoryId=null;
      animateSidebar = true; // animate on page change
      searchInput.value="";
      swapIn(contentEl);
      renderAll();
    });
    topPages.appendChild(btn);
  });
  if (isAdmin){
    const add = document.createElement("button");
    add.className = "btn secondary";
    add.textContent = "+ Page";
    add.addEventListener("click", ()=> openPageEditor());
    topPages.appendChild(add);
  }
}
function renderSidebar(){
  categoriesEl.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "category-list" + (animateSidebar ? " fade-slow" : "");
  const allBtn = document.createElement("button");
  allBtn.textContent = "Toutes";
  allBtn.className = currentCategoryId===null ? "active" : "";
  allBtn.addEventListener("click", ()=>{
    currentCategoryId=null;
    animateSidebar = false; // don't animate on category switch
    swapIn(contentEl);
    renderAll();
  });
  wrap.appendChild(allBtn);

  const cats = DB.categories.filter(c=>c.pageId===currentPageId).sort((a,b)=>(a.sort??0)-(b.sort??0));
  cats.forEach(c=>{
    const b = document.createElement("button");
    b.textContent = `${c.icon||"•"}  ${c.name}`;
    b.className = (currentCategoryId===c.id) ? "active" : "";
    b.addEventListener("click", ()=>{
      currentCategoryId=c.id;
      animateSidebar = false; // don't animate on category switch
      swapIn(contentEl);
      renderAll();
    });
    wrap.appendChild(b);
  });
  if (isAdmin){
    const add = document.createElement("button");
    add.className = "btn secondary";
    add.textContent = "+ Ajouter une catégorie";
    add.addEventListener("click", ()=> openCategoryEditor());
    wrap.appendChild(add);
  }
  categoriesEl.appendChild(wrap);
}
function renderHeaderInfo(){
  const page = DB.pages.find(p=>p.id===currentPageId);
  pageTitle.textContent = page?.name || "";
  pageDesc.textContent = page?.description || "";
  pageActions.innerHTML = "";
  if (isAdmin && page){
    const edit = document.createElement("button");
    edit.className = "btn ghost"; edit.textContent = "Modifier la page";
    edit.addEventListener("click", ()=> openPageEditor(page));
    const del = document.createElement("button");
    del.className = "btn danger"; del.textContent = "Supprimer la page";
    del.addEventListener("click", async ()=> {
      const ok = await confirmDialog({
        title: "Supprimer la page",
        message: `La page « ${page.name} » et ses éléments associés seront supprimés. Continuer ?`
      });
      if (!ok) return;
      deletePage(page.id);
    });
    pageActions.append(edit, del);
  }
}
function renderContent(){
  const q = searchInput.value.trim().toLowerCase();
  const list = DB.resources.filter(r=>{
    if (r.pageId!==currentPageId) return false;
    if (currentCategoryId && r.categoryId!==currentCategoryId) return false;
    if (!q) return true;
    const hay = `${r.title} ${r.description||""} ${(r.tags||[]).join(" ")}`.toLowerCase();
    return hay.includes(q);
  });
  searchInfo.style.display = q ? "block" : "none";
  searchInfo.textContent = q ? `Résultats pour « ${q} » — ${list.length} élément(s)` : "";

  const cats = DB.categories.filter(c=>c.pageId===currentPageId).sort((a,b)=>(a.sort??0)-(b.sort??0));
  contentEl.innerHTML = "";
  cats.forEach(c=>{
    const items = list.filter(r=>r.categoryId===c.id);
    if (!items.length && !isAdmin) return;
    const section = document.createElement("section");
    section.className = "fade";
    const head = document.createElement("div");
    head.className = "section-head";
    head.innerHTML = `<h3>${c.icon||"•"} ${c.name}</h3> <span class="badge">${items.length} lien(s)</span>`;
    section.appendChild(head);

    if (isAdmin){
      const adminRow = document.createElement("div");
      adminRow.className = "table-actions";
      const editC = document.createElement("button"); editC.className="btn ghost"; editC.textContent="Modifier catégorie";
      editC.addEventListener("click", ()=> openCategoryEditor(c));
      const delC = document.createElement("button"); delC.className="btn danger"; delC.textContent="Supprimer catégorie";
      delC.addEventListener("click", async ()=> {
        const ok = await confirmDialog({
          title: "Supprimer la catégorie",
          message: `La catégorie « ${c.name} » et ses liens seront supprimés. Continuer ?`
        });
        if (!ok) return;
        deleteCategory(c.id);
      });
      const addR = document.createElement("button"); addR.className="btn secondary"; addR.textContent="+ Ajouter un titre";
      addR.addEventListener("click", ()=> openResourceEditor({ pageId: currentPageId, categoryId: c.id }));
      adminRow.append(editC, addR, delC);
      section.appendChild(adminRow);
    }

    items.sort((a,b)=> a.title.localeCompare(b.title)).forEach(r=>{
      section.appendChild(resourceCard(r));
    });
    contentEl.appendChild(section);
  });

  if (!contentEl.children.length){
    const empty = document.createElement("div");
    empty.className="card fade"; empty.innerHTML = "<div style='text-align:center'>Rien à afficher — ajuste la recherche ou change de catégorie.</div>";
    contentEl.appendChild(empty);
  }

  // trigger content swap animation
  swapIn(contentEl);
}
function resourceCard(r){
  const tpl = document.getElementById("tmpl-resource-card");
  const node = tpl.content.cloneNode(true);
  const t = node.querySelector(".title");
  t.textContent = r.title; t.href = r.href;
  const d = node.querySelector(".desc"); d.textContent = r.description||"";
  const tags = node.querySelector(".tags"); tags.innerHTML = "";
  (r.tags||[]).forEach(tag=>{
    const span = document.createElement("span"); span.className="tag"; span.textContent = tag; tags.appendChild(span);
  });
  node.querySelector(".date").textContent = `MAJ ${new Date(r.updatedAt).toLocaleDateString()}`;
  if (isAdmin){
    const admin = node.querySelector(".admin-actions");
    admin.classList.remove("hidden");
    admin.querySelector(".edit").addEventListener("click", ()=> openResourceEditor(r));
    admin.querySelector(".del").addEventListener("click", async ()=> {
      const ok = await confirmDialog({
        title: "Supprimer le titre",
        message: `Le lien « ${r.title} » sera supprimé. Continuer ?`
      });
      if (!ok) return;
      deleteResource(r.id);
    });
  }
  return node;
}
function renderAll(){
  renderTopNav();
  renderSidebar();
  renderHeaderInfo();
  renderContent();
}

// small helper to fade/swap containers
function swapIn(el){
  el.classList.remove("in");
  void el.offsetWidth; // reflow
  el.classList.add("in");
}

// ====== Admin toggle (inline) ======
const adminBtn = document.getElementById("adminBtn");
adminBtn.addEventListener("click", ()=>{
  if (!isAdmin){
    const pw = prompt("Mot de passe admin :");
    if (pw === null) return;
    if (pw === ADMIN_PASS){ isAdmin = true; adminBtn.textContent = "Admin (on)"; renderAll(); }
    else alert("Mot de passe incorrect");
  } else {
    isAdmin = false; adminBtn.textContent = "Admin"; renderAll();
  }
});

// ====== Editors (modals) ======
function openPageEditor(p={ id:uid("page"), name:"Nouvelle page", slug:"nouvelle-page", description:"", sort:(DB.pages.length+1) }){
  modalTitle.textContent = p.name ? "Modifier la page" : "Nouvelle page";
  modalBody.innerHTML = `
    <div class="field"><label>Nom</label><input id="p_name" class="input" value="${p.name||""}"></div>
    <div class="row">
      <div class="field"><label>Slug</label><input id="p_slug" class="input" value="${p.slug||""}"></div>
      <div class="field"><label>Ordre</label><input id="p_sort" class="input" type="number" value="${p.sort||0}"></div>
    </div>
    <div class="field"><label>Description</label><textarea id="p_desc" class="textarea">${p.description||""}</textarea></div>
    <div class="table-actions">
      <button class="btn secondary" data-close>Annuler</button>
      <button class="btn" id="save">Enregistrer</button>
    </div>
  `;
  openModal();
  modalBody.querySelector("#save").addEventListener("click", ()=>{
    const next = {
      ...p,
      name: modalBody.querySelector("#p_name").value.trim(),
      slug: modalBody.querySelector("#p_slug").value.trim().toLowerCase().replace(/\s+/g,'-'),
      sort: Number(modalBody.querySelector("#p_sort").value),
      description: modalBody.querySelector("#p_desc").value
    };
    const exists = DB.pages.some(x=>x.id===p.id);
    DB.pages = exists ? DB.pages.map(x=> x.id===p.id ? next : x) : [...DB.pages, next];
    saveDB(DB); closeModal(); renderAll();
  });
}

function openCategoryEditor(c={ id:uid("cat"), pageId: currentPageId, name:"", icon:"•", sort: (DB.categories.length+1), description:"" }){
  modalTitle.textContent = c.name ? "Modifier la catégorie" : "Nouvelle catégorie";
  modalBody.innerHTML = `
    <div class="row">
      <div class="field"><label>Nom</label><input id="c_name" class="input" value="${c.name||""}"></div>
      <div class="field"><label>Icône (emoji)</label><input id="c_icon" class="input" value="${c.icon||""}"></div>
    </div>
    <div class="row">
      <div class="field">
        <label>Page</label>
        <select id="c_page" class="select">
          ${DB.pages.map(p=>`<option value="${p.id}" ${p.id===c.pageId?"selected":""}>${p.name}</option>`).join("")}
        </select>
      </div>
      <div class="field"><label>Ordre</label><input id="c_sort" class="input" type="number" value="${c.sort||0}"></div>
    </div>
    <div class="field"><label>Description</label><textarea id="c_desc" class="textarea">${c.description||""}</textarea></div>
    <div class="table-actions">
      <button class="btn secondary" data-close>Annuler</button>
      <button class="btn" id="save">Enregistrer</button>
    </div>
  `;
  openModal();
  modalBody.querySelector("#save").addEventListener("click", ()=>{
    const next = {
      ...c,
      name: modalBody.querySelector("#c_name").value.trim(),
      icon: modalBody.querySelector("#c_icon").value.trim() || "•",
      pageId: modalBody.querySelector("#c_page").value,
      sort: Number(modalBody.querySelector("#c_sort").value),
      description: modalBody.querySelector("#c_desc").value
    };
    const exists = DB.categories.some(x=>x.id===c.id);
    DB.categories = exists ? DB.categories.map(x=> x.id===c.id ? next : x) : [...DB.categories, next];
    saveDB(DB); closeModal(); renderAll();
  });
}

function openResourceEditor(r={ id:uid("res"), title:"", href:"", description:"", tags:[], pageId: currentPageId, categoryId: (DB.categories.find(c=>c.pageId===currentPageId)?.id||"") , createdAt: Date.now(), updatedAt: Date.now() }){
  modalTitle.textContent = r.title ? "Modifier le titre" : "Nouveau titre";
  modalBody.innerHTML = `
    <div class="field"><label>Titre</label><input id="r_title" class="input" value="${r.title||""}" placeholder="Ex: GOG Games"></div>
    <div class="field"><label>Lien</label><input id="r_href" class="input" value="${r.href||""}" placeholder="https://…"></div>
    <div class="field"><label>Description</label><textarea id="r_desc" class="textarea" placeholder="Ex: Jeux sans DRM, téléchargement direct.">${r.description||""}</textarea></div>
    <div class="field"><label>Tags (séparés par des virgules)</label><input id="r_tags" class="input" value="${(r.tags||[]).join(', ')}"></div>
    <div class="row">
      <div class="field">
        <label>Page</label>
        <select id="r_page" class="select">
          ${DB.pages.map(p=>`<option value="${p.id}" ${p.id===r.pageId?"selected":""}>${p.name}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label>Catégorie</label>
        <select id="r_cat" class="select">
          ${DB.categories.filter(c=>c.pageId===r.pageId).map(c=>`<option value="${c.id}" ${c.id===r.categoryId?"selected":""}>${c.name}</option>`).join("")}
        </select>
      </div>
    </div>
    <div class="table-actions">
      <button class="btn secondary" data-close>Annuler</button>
      <button class="btn" id="save">Enregistrer</button>
    </div>
  `;
  openModal();
  const pageSelect = modalBody.querySelector("#r_page");
  const catSelect = modalBody.querySelector("#r_cat");
  pageSelect.addEventListener("change", ()=>{
    const pageId = pageSelect.value;
    catSelect.innerHTML = DB.categories.filter(c=>c.pageId===pageId).map(c=>`<option value="${c.id}">${c.name}</option>`).join("");
  });
  modalBody.querySelector("#save").addEventListener("click", ()=>{
    const next = {
      ...r,
      title: modalBody.querySelector("#r_title").value.trim(),
      href: modalBody.querySelector("#r_href").value.trim(),
      description: modalBody.querySelector("#r_desc").value,
      tags: modalBody.querySelector("#r_tags").value.split(",").map(s=>s.trim()).filter(Boolean),
      pageId: pageSelect.value,
      categoryId: catSelect.value,
      updatedAt: Date.now()
    };
    const exists = DB.resources.some(x=>x.id===r.id);
    DB.resources = exists ? DB.resources.map(x=> x.id===r.id ? next : x) : [...DB.resources, { ...next, createdAt: Date.now() }];
    saveDB(DB); closeModal(); renderAll();
  });
}

// ====== Delete helpers (called after confirm) ======
function deletePage(id){
  const cats = DB.categories.filter(c=>c.pageId===id).map(c=>c.id);
  DB.pages = DB.pages.filter(p=>p.id!==id);
  DB.categories = DB.categories.filter(c=>c.pageId!==id);
  DB.resources = DB.resources.filter(r=>r.pageId!==id || !cats.includes(r.categoryId));
  if (currentPageId===id) currentPageId = DB.pages[0]?.id || null;
  saveDB(DB); renderAll();
}
function deleteCategory(id){
  DB.categories = DB.categories.filter(c=>c.id!==id);
  DB.resources = DB.resources.filter(r=>r.categoryId!==id);
  if (currentCategoryId===id) currentCategoryId=null;
  saveDB(DB); renderAll();
}
function deleteResource(id){
  DB.resources = DB.resources.filter(r=>r.id!==id);
  saveDB(DB); renderAll();
}

// ====== Modal helpers ======
function openModal(){ modal.classList.remove("hidden"); }
function closeModal(){ modal.classList.add("hidden"); }
modal.addEventListener("click", (e)=>{ if (e.target.dataset.close!==undefined) closeModal(); });
modal.querySelectorAll("[data-close]").forEach(el=> el.addEventListener("click", closeModal));

// ====== Init ======
document.getElementById("year").textContent = new Date().getFullYear();
searchInput.addEventListener("input", renderContent);

renderAll();
