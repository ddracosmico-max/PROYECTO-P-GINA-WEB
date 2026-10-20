(() => {
  'use strict';
  const categories = ["Celulares","Computación","Audio y TV","Videojuegos","Electrodomésticos","Hogar","Cocina","Muebles","Moda Mujer","Moda Hombre","Calzado","Accesorios","Deportes","Belleza","Salud y Bienestar","Juguetes","Bebés","Mascotas","Libros","Papelería","Herramientas","Automotriz","Jardín","Supermercado","Instrumentos"];
  const $ = id => document.getElementById(id);
  const grid = $('itemsGrid'), empty = $('emptyState'), addDialog = $('addDialog'), listDialog = $('listDialog'), confirmDialog = $('confirmDialog');
  const select = $('elementCategory');
  let activeCategory = 'Todas';
  let deleteTarget = null;
  const STORAGE_KEY = 'umatronix.catalog.v2';
  const safe = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function loadItems(){
    try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(value) ? value.filter(x => x && typeof x.name === 'string' && typeof x.category === 'string').map(x => ({id:String(x.id || makeId()),name:x.name,category:x.category,inList:Boolean(x.inList)})) : []; }
    catch { return []; }
  }
  let items = loadItems();
  function makeId(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
  function persist(){ try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* La página sigue funcionando si el navegador bloquea el almacenamiento. */ } }
  categories.forEach(name => { const option = document.createElement('option'); option.value = name; option.textContent = name; select.appendChild(option); });

  function render(){
    const shown = items.filter(item => activeCategory === 'Todas' || item.category === activeCategory);
    grid.innerHTML = shown.map(item => `<article class="item-card"><div class="item-card-top"><div><div class="item-name">${safe(item.name)}</div><div class="item-category">${safe(item.category)}</div></div></div><div class="item-actions"><button class="small-action ${item.inList ? 'selected' : ''}" data-action="list" data-id="${safe(item.id)}" type="button">${item.inList ? '✓ En mi lista' : '+ Mi lista'}</button><button class="small-action" data-action="edit" data-id="${safe(item.id)}" type="button">Editar</button><button class="small-action remove" data-action="delete" data-id="${safe(item.id)}" type="button">Eliminar</button></div></article>`).join('');
    const hasItems = shown.length > 0;
    empty.classList.toggle('hidden', hasItems);
    $('summary').textContent = `${items.length} ${items.length === 1 ? 'elemento' : 'elementos'}`;
    $('itemCount').textContent = items.filter(item => item.inList).length;
    $('activeCaption').textContent = activeCategory === 'Todas' ? 'Explora las categorías de la tienda.' : `Categoría: ${activeCategory}`;
    $('clearFilter').hidden = activeCategory === 'Todas';
    $('emptyTitle').textContent = activeCategory === 'Todas' ? 'Tu catálogo está vacío' : `Todavía no hay elementos en ${activeCategory}`;
    $('emptyText').textContent = activeCategory === 'Todas' ? 'Agrega un elemento cuando estés listo y asígnalo a una categoría.' : 'Puedes agregar un elemento directamente a esta categoría.';
    renderList();
  }
  function openAdd(item = null){
    $('addForm').dataset.editing = item ? item.id : '';
    $('elementName').value = item ? item.name : '';
    select.value = item ? item.category : (activeCategory === 'Todas' ? categories[0] : activeCategory);
    $('addDialog').querySelector('h2').textContent = item ? 'Editar elemento' : 'Agregar elemento';
    $('addForm').querySelector('button[type="submit"]').textContent = item ? 'Guardar cambios' : 'Guardar elemento';
    addDialog.showModal();
    requestAnimationFrame(() => $('elementName').focus());
  }
  function closeAdd(){ addDialog.close(); }
  $('openAdd').addEventListener('click', () => openAdd());
  $('emptyAdd').addEventListener('click', () => openAdd());
  $('closeAdd').addEventListener('click', closeAdd);
  $('cancelAdd').addEventListener('click', closeAdd);
  $('addForm').addEventListener('submit', event => {
    event.preventDefault();
    const name = $('elementName').value.trim();
    if(!name) { $('elementName').focus(); return; }
    const editingId = event.currentTarget.dataset.editing;
    if(editingId){ const item = items.find(x => x.id === editingId); if(item){ item.name = name; item.category = select.value; } }
    else items.push({id:makeId(),name,category:select.value,inList:false});
    persist(); closeAdd(); render();
  });

  $('categoryBar').addEventListener('click', event => {
    const button = event.target.closest('[data-category]'); if(!button) return;
    activeCategory = button.dataset.category;
    document.querySelectorAll('.category').forEach(el => { const active = el === button; el.classList.toggle('active', active); if(active) el.setAttribute('aria-current','true'); else el.removeAttribute('aria-current'); });
    button.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
    render();
  });
  const categoryBar = $('categoryBar');
  $('scrollLeft').addEventListener('click', () => categoryBar.scrollBy({left:-Math.max(280,categoryBar.clientWidth*.7),behavior:'smooth'}));
  $('scrollRight').addEventListener('click', () => categoryBar.scrollBy({left:Math.max(280,categoryBar.clientWidth*.7),behavior:'smooth'}));
  categoryBar.addEventListener('wheel', event => { if(Math.abs(event.deltaY) > Math.abs(event.deltaX)){ categoryBar.scrollLeft += event.deltaY; event.preventDefault(); } }, {passive:false});
  $('clearFilter').addEventListener('click', () => { const all = document.querySelector('[data-category="Todas"]'); all.click(); });
  $('backToTop').addEventListener('click', () => window.scrollTo({top:0,behavior:'smooth'}));

  grid.addEventListener('click', event => {
    const button = event.target.closest('[data-action]'); if(!button) return;
    const item = items.find(x => x.id === button.dataset.id); if(!item) return;
    if(button.dataset.action === 'list'){ item.inList = !item.inList; persist(); render(); }
    if(button.dataset.action === 'edit') openAdd(item);
    if(button.dataset.action === 'delete') askDelete(item);
  });
  function renderList(){
    const chosen = items.filter(item => item.inList);
    $('listContents').innerHTML = chosen.length ? chosen.map(item => `<div class="list-row"><div><strong>${safe(item.name)}</strong><span>${safe(item.category)}</span></div><button type="button" class="small-action remove" data-unlist="${safe(item.id)}">Quitar</button></div>`).join('') : '<div class="list-empty">Tu lista está vacía.<br>Marca un elemento con “+ Mi lista” para verlo aquí.</div>';
    $('clearList').disabled = chosen.length === 0;
  }
  $('openList').addEventListener('click', () => { renderList(); listDialog.showModal(); });
  $('closeList').addEventListener('click', () => listDialog.close());
  $('doneList').addEventListener('click', () => listDialog.close());
  $('listContents').addEventListener('click', event => { const button = event.target.closest('[data-unlist]'); if(!button) return; const item = items.find(x => x.id === button.dataset.unlist); if(item) item.inList = false; persist(); render(); });
  $('clearList').addEventListener('click', () => { items.forEach(item => item.inList = false); persist(); render(); });

  function askDelete(item){ deleteTarget = item.id; $('confirmText').textContent = `Se eliminará “${item.name}” del catálogo.`; confirmDialog.showModal(); }
  function closeConfirm(){ deleteTarget = null; confirmDialog.close(); }
  $('cancelDelete').addEventListener('click', closeConfirm); $('cancelDeleteX').addEventListener('click', closeConfirm);
  $('confirmDelete').addEventListener('click', () => { if(deleteTarget){ items = items.filter(item => item.id !== deleteTarget); persist(); render(); } closeConfirm(); });
  [addDialog,listDialog,confirmDialog].forEach(dialog => dialog.addEventListener('click', event => { if(event.target === dialog) dialog.close(); }));
  render();
})();
