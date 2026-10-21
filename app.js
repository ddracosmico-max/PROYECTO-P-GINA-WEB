(() => {
  'use strict';
  const categories = ["Celulares","Computación","Audio y TV","Videojuegos","Electrodomésticos","Hogar","Cocina","Muebles","Moda Mujer","Moda Hombre","Calzado","Accesorios","Deportes","Belleza","Salud y Bienestar","Juguetes","Bebés","Mascotas","Libros","Papelería","Herramientas","Automotriz","Jardín","Supermercado","Instrumentos"];
  const $ = id => document.getElementById(id);
  const grid = $('itemsGrid'), empty = $('emptyState'), addDialog = $('addDialog'), listDialog = $('listDialog'), confirmDialog = $('confirmDialog');
  const select = $('elementCategory');
  let activeCategory = 'Todas';
  let deleteTarget = null;
  let pendingProductImage = '';
  const STORAGE_KEY = 'umatronix.catalog.v2';
  const AUTH_KEY = 'umatronix.auth.v1';
  const USER_PROFILE_KEY = 'umatronix.user.profile.v1';
  const MAX_IMAGE_SIZE_BYTES = 500 * 1024;
  const safe = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));

  function normalizeEmail(email){ return String(email || '').trim().toLowerCase(); }
  function getLoggedUser(){
    try {
      const raw = localStorage.getItem(AUTH_KEY) || '';
      const profile = JSON.parse(localStorage.getItem(USER_PROFILE_KEY) || 'null');
      return normalizeEmail(raw || (profile && profile.email) || '');
    }
    catch { return ''; }
  }
  function getCurrentCatalogKey(){
    const email = normalizeEmail(getLoggedUser());
    return email ? `umatronix.catalog.${email.replace(/[^a-z0-9]/g, '_')}` : STORAGE_KEY;
  }

  function ensureStyles(){
    if (document.getElementById('umatronix-ux-styles')) return;
    const style = document.createElement('style');
    style.id = 'umatronix-ux-styles';
    style.textContent = `
      .product-photo-field {
        display: grid;
        gap: 10px;
        margin: 18px 0 12px;
      }
      .photo-label {
        font-size: 0.88rem;
        font-weight: 700;
        color: #2f3b52;
      }
      .product-photo-preview {
        width: 100%;
        max-height: 180px;
        object-fit: cover;
        border-radius: 14px;
        border: 1px solid rgba(69, 92, 145, 0.2);
        background: linear-gradient(135deg, #f2f6ff, #eef1f6);
      }
      .hidden {
        display: none !important;
      }
      .item-photo {
        width: 100%;
        height: 150px;
        overflow: hidden;
        border-radius: 12px 12px 0 0;
        background: linear-gradient(135deg, #eff4ff, #edf3f5);
      }
      .item-photo img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .item-photo-empty {
        display: grid;
        place-items: center;
        width: 100%;
        height: 100%;
        font-size: 0.8rem;
        color: #56657f;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .auth-toolbar {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .auth-button {
        border: 1px solid rgba(62, 90, 160, 0.25);
        background: white;
        color: #243b64;
        padding: 10px 14px;
        border-radius: 999px;
        font-weight: 700;
        cursor: pointer;
      }
      .auth-button:hover {
        background: #f3f7ff;
      }
      .auth-panel {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #243b64;
        font-size: 0.85rem;
      }
      .auth-dialog {
        width: min(430px, calc(100vw - 24px));
        margin: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        border-radius: 18px;
        padding: 0;
        box-shadow: 0 20px 45px rgba(20, 36, 62, 0.18);
      }
      .auth-dialog[open] {
        display: flex;
      }
      .auth-dialog::backdrop {
        background: rgba(16, 25, 38, 0.45);
      }
      .auth-card {
        padding: 24px;
      }
      .auth-card h2 {
        margin: 0 0 8px;
        font-size: 1.3rem;
      }
      .auth-card p {
        margin: 0 0 16px;
        color: #52627c;
      }
      .auth-card form {
        display: grid;
        gap: 12px;
      }
      .auth-card input {
        width: 100%;
        padding: 12px 14px;
        border-radius: 12px;
        border: 1px solid rgba(74, 93, 134, 0.25);
        font: inherit;
      }
      .auth-card-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
      .auth-card .secondary {
        background: #ecf2ff;
        color: #2a3d69;
      }
    `;
    document.head.appendChild(style);
  }

  function setLoggedUser(email){
    const normalized = normalizeEmail(email);
    try {
      if (normalized) {
        localStorage.setItem(AUTH_KEY, normalized);
        localStorage.setItem(USER_PROFILE_KEY, JSON.stringify({ email: normalized, updatedAt: Date.now() }));
      } else {
        localStorage.removeItem(AUTH_KEY);
        localStorage.removeItem(USER_PROFILE_KEY);
      }
    } catch {
      // La sesión puede quedar solo en memoria si el navegador bloquea el almacenamiento
    }
    items = loadItems();
    renderAuthState();
    render();
  }

  function ensureAuthUi(){
    const target = document.querySelector('header') || document.body;
    let loginButton = $('loginButton');
    if (!loginButton) {
      loginButton = document.createElement('button');
      loginButton.id = 'loginButton';
      loginButton.type = 'button';
      loginButton.className = 'auth-button';
      target.appendChild(loginButton);
    }

    let authDialog = $('authDialog');
    if (!authDialog) {
      authDialog = document.createElement('dialog');
      authDialog.id = 'authDialog';
      authDialog.className = 'auth-dialog';
      authDialog.innerHTML = `
        <div class="auth-card">
          <h2>Inicia sesión</h2>
          <p>Usa tu correo electrónico para gestionar tu catálogo.</p>
          <form id="loginForm" novalidate>
            <input id="loginEmail" type="email" placeholder="correo@ejemplo.com" autocomplete="email" required>
            <div class="auth-card-actions">
              <button type="button" class="small-action secondary" id="closeAuth">Cancelar</button>
              <button type="submit" class="small-action" id="submitAuth">Entrar</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(authDialog);
    }

    const loginForm = $('loginForm');
    const loginEmail = $('loginEmail');
    if (loginForm && loginEmail) {
      loginForm.addEventListener('submit', event => {
        event.preventDefault();
        const email = normalizeEmail(loginEmail.value);
        const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (!isValid) {
          loginEmail.focus();
          loginEmail.setCustomValidity('Escribe un correo válido.');
          loginEmail.reportValidity();
          return;
        }
        loginEmail.setCustomValidity('');
        setLoggedUser(email);
        authDialog.close();
      });
      $('closeAuth')?.addEventListener('click', () => authDialog.close());
      authDialog.addEventListener('click', event => {
        if (event.target === authDialog) authDialog.close();
      });
    }

    renderAuthState();
    return { loginButton, authDialog };
  }

  function renderAuthState(){
    const loginButton = $('loginButton');
    if (!loginButton) return;
    const email = getLoggedUser();
    loginButton.textContent = email ? `Conectado: ${email}` : 'Iniciar sesión';
    loginButton.title = email ? 'Cerrar sesión' : 'Iniciar sesión con correo';
    loginButton.onclick = () => {
      const activeEmail = getLoggedUser();
      if (activeEmail) {
        const wantLogout = window.confirm('¿Quieres cerrar sesión?');
        if (wantLogout) setLoggedUser('');
        return;
      }
      const dialog = $('authDialog');
      if (dialog) {
        const input = $('loginEmail');
        if (input) {
          input.value = '';
          input.setCustomValidity('');
        }
        dialog.showModal();
      }
    };
  }

  function loadItems(){
    const catalogKey = getCurrentCatalogKey();
    try {
      const value = JSON.parse(localStorage.getItem(catalogKey) || localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value)
        ? value.filter(x => x && typeof x.name === 'string' && typeof x.category === 'string').map(x => ({
            id: String(x.id || makeId()),
            name: x.name,
            category: x.category,
            inList: Boolean(x.inList),
            image: typeof x.image === 'string' ? x.image : ''
          }))
        : [];
    }
    catch { return []; }
  }
  let items = loadItems();
  function makeId(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
  function persist(){
    try {
      const key = getCurrentCatalogKey();
      localStorage.setItem(key, JSON.stringify(items));
      if (!getLoggedUser()) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error('No se pudo guardar en localStorage:', error);
      window.alert('La imagen es demasiado grande o el almacenamiento está lleno. Usa una imagen más pequeña o elimina elementos guardados.');
    }
  }
  categories.forEach(name => { const option = document.createElement('option'); option.value = name; option.textContent = name; if (select) select.appendChild(option); });

  function ensurePhotoControls(){
    const addForm = $('addForm');
    if (!addForm || $('productImageInput')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'product-photo-field';
    wrapper.innerHTML = `
      <label class="photo-label" for="productImageInput">Foto del producto</label>
      <input id="productImageInput" name="productImage" type="file" accept="image/*">
      <img id="productImagePreview" class="product-photo-preview hidden" alt="Vista previa del producto">
    `;
    const submitButton = addForm.querySelector('button[type="submit"]');
    if (submitButton) addForm.insertBefore(wrapper, submitButton);
  }

  function readFileAsDataUrl(file){
    return new Promise((resolve, reject) => {
      if (!(file instanceof File)) {
        reject(new Error('No se seleccionó un archivo válido.'));
        return;
      }
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        reject(new Error('La imagen supera el tamaño permitido (máximo 500 KB).'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      reader.readAsDataURL(file);
    });
  }

  function render(){
    const shown = items.filter(item => activeCategory === 'Todas' || item.category === activeCategory);
    grid.innerHTML = shown.map(item => `<article class="item-card"><div class="item-photo">${item.image ? `<img src="${item.image}" alt="${safe(item.name)}">` : '<div class="item-photo-empty">Sin foto</div>'}</div><div class="item-card-top"><div><div class="item-name">${safe(item.name)}</div><div class="item-category">${safe(item.category)}</div></div></div><div class="item-actions"><button class="small-action ${item.inList ? 'selected' : ''}" data-action="list" data-id="${safe(item.id)}" type="button">${item.inList ? '✓ En mi lista' : '+ Mi lista'}</button><button class="small-action" data-action="edit" data-id="${safe(item.id)}" type="button">Editar</button><button class="small-action remove" data-action="delete" data-id="${safe(item.id)}" type="button">Eliminar</button></div></article>`).join('');
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
    ensurePhotoControls();
    const addForm = $('addForm');
    const imageInput = $('productImageInput');
    const preview = $('productImagePreview');
    if (addForm) addForm.dataset.editing = item ? item.id : '';
    if ($('elementName')) $('elementName').value = item ? item.name : '';
    if (select) select.value = item ? item.category : (activeCategory === 'Todas' ? categories[0] : activeCategory);
    if (addDialog && addDialog.querySelector('h2')) addDialog.querySelector('h2').textContent = item ? 'Editar elemento' : 'Agregar elemento';
    if (addForm && addForm.querySelector('button[type="submit"]')) addForm.querySelector('button[type="submit"]').textContent = item ? 'Guardar cambios' : 'Guardar elemento';
    pendingProductImage = item?.image || '';
    if (preview) {
      preview.src = item?.image || '';
      preview.classList.toggle('hidden', !item?.image);
    }
    if (imageInput) imageInput.value = '';
    addDialog.showModal();
    requestAnimationFrame(() => $('elementName')?.focus());
  }
  function closeAdd(){ if (addDialog) addDialog.close(); }
  $('openAdd')?.addEventListener('click', () => openAdd());
  $('emptyAdd')?.addEventListener('click', () => openAdd());
  $('closeAdd')?.addEventListener('click', closeAdd);
  $('cancelAdd')?.addEventListener('click', closeAdd);
  const productImageInput = $('productImageInput');
  if (productImageInput) {
    productImageInput.addEventListener('change', async event => {
      const file = event.target.files?.[0];
      const preview = $('productImagePreview');
      if (!file) {
        pendingProductImage = '';
        if (preview) {
          preview.src = '';
          preview.classList.add('hidden');
        }
        return;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        pendingProductImage = dataUrl;
        if (preview) {
          preview.src = dataUrl;
          preview.classList.remove('hidden');
        }
      } catch (error) {
        console.error(error);
        pendingProductImage = '';
      }
    });
  }
  $('addForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const name = $('elementName').value.trim();
    if(!name) { $('elementName').focus(); return; }
    const editingId = event.currentTarget.dataset.editing;
    const nextItem = {
      id: editingId || makeId(),
      name,
      category: select.value,
      inList: false,
      image: pendingProductImage || ''
    };
    if(editingId){
      const item = items.find(x => x.id === editingId);
      if(item){
        item.name = name;
        item.category = select.value;
        item.image = pendingProductImage || item.image || '';
      }
    } else {
      items = [...items, nextItem];
    }
    pendingProductImage = '';
    try {
      const key = getCurrentCatalogKey();
      localStorage.setItem(key, JSON.stringify(items));
      if (!getLoggedUser()) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error('No se pudo guardar en localStorage:', error);
      if (editingId) {
        const item = items.find(x => x.id === editingId);
        if (item) item.image = '';
      } else {
        items = items.filter(x => x.id !== nextItem.id);
      }
      window.alert('No se pudo guardar el producto. La imagen es demasiado grande o el almacenamiento está lleno. Usa una imagen más pequeña.');
      return;
    }
    closeAdd(); render();
  });

  $('categoryBar')?.addEventListener('click', event => {
    const button = event.target.closest('[data-category]'); if(!button) return;
    activeCategory = button.dataset.category;
    document.querySelectorAll('.category').forEach(el => { const active = el === button; el.classList.toggle('active', active); if(active) el.setAttribute('aria-current','true'); else el.removeAttribute('aria-current'); });
    button.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
    render();
  });
  const categoryBar = $('categoryBar');
  $('scrollLeft')?.addEventListener('click', () => categoryBar.scrollBy({left:-Math.max(280,categoryBar.clientWidth*.7),behavior:'smooth'}));
  $('scrollRight')?.addEventListener('click', () => categoryBar.scrollBy({left:Math.max(280,categoryBar.clientWidth*.7),behavior:'smooth'}));
  categoryBar?.addEventListener('wheel', event => { if(Math.abs(event.deltaY) > Math.abs(event.deltaX)){ categoryBar.scrollLeft += event.deltaY; event.preventDefault(); } }, {passive:false});
  $('clearFilter')?.addEventListener('click', () => { const all = document.querySelector('[data-category="Todas"]'); all.click(); });
  $('backToTop')?.addEventListener('click', () => window.scrollTo({top:0,behavior:'smooth'}));

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
  $('openList')?.addEventListener('click', () => { renderList(); listDialog.showModal(); });
  $('closeList')?.addEventListener('click', () => listDialog.close());
  $('doneList')?.addEventListener('click', () => listDialog.close());
  $('listContents')?.addEventListener('click', event => { const button = event.target.closest('[data-unlist]'); if(!button) return; const item = items.find(x => x.id === button.dataset.unlist); if(item) item.inList = false; persist(); render(); });
  $('clearList')?.addEventListener('click', () => { items.forEach(item => item.inList = false); persist(); render(); });

  function askDelete(item){ deleteTarget = item.id; $('confirmText').textContent = `Se eliminará “${item.name}” del catálogo.`; confirmDialog.showModal(); }
  function closeConfirm(){ deleteTarget = null; confirmDialog.close(); }
  $('cancelDelete')?.addEventListener('click', closeConfirm); $('cancelDeleteX')?.addEventListener('click', closeConfirm);
  $('confirmDelete')?.addEventListener('click', () => { if(deleteTarget){ items = items.filter(item => item.id !== deleteTarget); persist(); render(); } closeConfirm(); });
  [addDialog,listDialog,confirmDialog].forEach(dialog => { if (dialog) dialog.addEventListener('click', event => { if(event.target === dialog) dialog.close(); }); });
  ensureStyles();
  ensureAuthUi();
  render();
})();
