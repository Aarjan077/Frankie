'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const loginSection = $('login-section');
  const dashboardSection = $('dashboard-section');
  const loginForm = $('login-form');
  const uploadForm = $('upload-form');
  const fileInput = $('photo-file');
  const preview = $('file-preview');
  const previewImg = $('preview-image');
  let csrf = '';
  let previewURL = null;

  function status(id, message, kind = '') {
    const el = $(id);
    el.textContent = message;
    el.className = `form-status ${kind}`;
  }
  async function api(path, options = {}) {
    const response = await fetch(path, { ...options, credentials:'same-origin', cache:'no-store' });
    let data;
    try { data = await response.json(); }
    catch { throw new Error('The backend is not responding. Start the Node server; GitHub Pages alone cannot host it.'); }
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
    return data;
  }
  const masterPhotoSelect=$('master-photo-id');
  const originalTitles=[
    'Greyhound Portrait','Blue in Motion',"Elephant's Gaze",'Still Waters',
    'Coastal Wanderers','Shoreline Treasures','Fox Family','Midair Catch',
    'Looking Beyond','Between Shadows'
  ];
  function refreshMasterChoices(uploaded=[]){
    const chosen=masterPhotoSelect.value;
    masterPhotoSelect.replaceChildren();
    const all=[...originalTitles.map((title,i)=>({id:`original-${i+1}`,title})),...uploaded];
    for(const photo of all){
      const opt=document.createElement('option');opt.value=photo.id;opt.textContent=photo.title;
      masterPhotoSelect.append(opt);
    }
    if(all.some(p=>p.id===chosen))masterPhotoSelect.value=chosen;
    checkMasterAvailability();
  }
  async function checkMasterAvailability(){
    if(!masterPhotoSelect.value||!csrf)return;
    try{
      const data=await api(`/api/admin/masters/${encodeURIComponent(masterPhotoSelect.value)}`);
      status('master-status',data.exists?'Private original uploaded — ready for download after purchase.':'No private original uploaded yet.');
    }catch(error){status('master-status',error.message,'error');}
  }
  masterPhotoSelect.addEventListener('change',checkMasterAvailability);
  $('master-upload-form').addEventListener('submit',async event=>{
    event.preventDefault();
    const file=$('master-file').files?.[0];
    if(!file||!masterPhotoSelect.value)return status('master-status','Select a photograph and a high-resolution file.','error');
    if(file.size>25*1024*1024)return status('master-status','The image must be 25 MB or smaller.','error');
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))return status('master-status','Please select a JPG, PNG or WebP file.','error');
    const button=$('master-upload-submit');button.disabled=true;
    status('master-status','Saving the private download file…');
    try{
      await api(`/api/admin/masters/${encodeURIComponent(masterPhotoSelect.value)}`,{
        method:'PUT',headers:{'X-CSRF-Token':csrf,'Content-Type':file.type},body:file
      });
      $('master-file').value='';
      status('master-status','Private download saved. Customers who purchase this photograph can now download it.','success');
    }catch(error){status('master-status',error.message,'error');}
    finally{button.disabled=false;}
  });
  refreshMasterChoices();

  function showDashboard(session) {
    csrf = session.csrf || '';
    loginSection.hidden = true;
    dashboardSection.hidden = false;
    loadUploads();
  }
  function showLogin() {
    csrf = '';
    dashboardSection.hidden = true;
    loginSection.hidden = false;
  }
  $('admin-theme').addEventListener('click', () => {
    const html = document.documentElement;
    html.dataset.theme = html.dataset.theme === 'dark' ? 'light' : 'dark';
  });
  $('show-password').addEventListener('click', () => {
    const password = $('login-password');
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    $('show-password').textContent = show ? 'HIDE' : 'SHOW';
    $('show-password').setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });
  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    const username = $('login-username').value.trim();
    const password = $('login-password').value;
    if (!username || !password) return status('login-status', 'Please enter both username and password.', 'error');
    const button = $('login-submit'); button.disabled = true;
    status('login-status','Checking credentials…');
    try {
      const session = await api('api/admin/login', {
        method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ username, password })
      });
      $('login-password').value = '';
      status('login-status','');
      showDashboard(session);
    } catch(error) { status('login-status', error.message, 'error'); }
    finally { button.disabled = false; }
  });
  $('logout-button').addEventListener('click', async () => {
    try { await api('api/admin/logout', { method:'POST', headers:{'X-CSRF-Token':csrf} }); }
    catch(error) { status('library-status', error.message, 'error'); return; }
    showLogin();
    status('login-status', 'Signed out.');
  });
  function setFile(file) {
    if (previewURL) URL.revokeObjectURL(previewURL);
    if (!file) { preview.hidden = true; $('dropzone-name').textContent = 'Choose or drop a photograph'; return; }
    previewURL = URL.createObjectURL(file);
    previewImg.src = previewURL;
    $('preview-name').textContent = file.name;
    $('dropzone-name').textContent = file.name;
    preview.hidden = false;
  }
  fileInput.addEventListener('change', () => setFile(fileInput.files?.[0]));
  const dropzone = $('upload-dropzone');
  dropzone.addEventListener('dragover', event => { event.preventDefault(); dropzone.classList.add('is-dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
  dropzone.addEventListener('drop', event => {
    event.preventDefault(); dropzone.classList.remove('is-dragover');
    if (!event.dataTransfer?.files?.length) return;
    fileInput.files = event.dataTransfer.files;
    setFile(fileInput.files[0]);
  });
  uploadForm.addEventListener('submit', async event => {
    event.preventDefault();
    const title = $('photo-title').value.trim();
    const file = fileInput.files?.[0];
    if (title.length < 2 || title.length > 80) return status('upload-status', 'Please enter a photograph title (2–80 characters).', 'error');
    if (!file) return status('upload-status', 'Choose a photograph to upload.', 'error');
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) return status('upload-status', 'Choose a JPG, PNG or WebP photograph.', 'error');
    if (file.size > 10 * 1024 * 1024) return status('upload-status', 'Photographs must be smaller than 10 MB.', 'error');
    if (!csrf) return status('upload-status', 'Your login has expired. Please sign in again.', 'error');
    const button = $('upload-submit'); button.disabled = true;
    status('upload-status', 'Publishing your photograph…');
    try {
      await api('api/admin/photos', { method:'POST', headers: {
        'Content-Type':file.type, 'X-Photo-Title':encodeURIComponent(title), 'X-CSRF-Token':csrf
      }, body:file });
      uploadForm.reset();
      setFile(null);
      status('upload-status', `“${title}” was published successfully. It is now part of the public gallery.`, 'success');
      await loadUploads();
    } catch(error) { status('upload-status', error.message, 'error'); }
    finally { button.disabled = false; }
  });
  async function loadUploads() {
    const list = $('published-list');
    try {
      const photos = await api('api/admin/photos');
      $('published-count').textContent = `${photos.length} UPLOAD${photos.length === 1 ? '' : 'S'}`;
      refreshMasterChoices(photos);
      list.replaceChildren();
      if (!photos.length) {
        const empty = document.createElement('p'); empty.className = 'library-empty';
        empty.textContent = 'New photographs will appear here after you publish them.';
        list.appendChild(empty); return;
      }
      for (const photo of [...photos].reverse()) {
        const row = document.createElement('article'); row.className = 'published-item';
        const img = document.createElement('img'); img.src = photo.url; img.alt = photo.title;
        const info = document.createElement('div');
        const title = document.createElement('h3'); title.textContent = photo.title;
        const date = document.createElement('small');
        const parsed = new Date(photo.createdAt);
        date.textContent = Number.isNaN(parsed.getTime()) ? 'PUBLISHED' : `PUBLISHED ${parsed.toLocaleDateString('en-GB')}`;
        info.append(title,date);
        const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'REMOVE';
        remove.setAttribute('aria-label', `Remove ${photo.title} from the gallery`);
        remove.addEventListener('click', async () => {
          if (!confirm(`Remove “${photo.title}” from the website gallery?`)) return;
          remove.disabled = true;
          try {
            await api(`api/admin/photos/${encodeURIComponent(photo.id)}`, {method:'DELETE', headers:{'X-CSRF-Token':csrf}});
            status('library-status', 'Photograph removed.', 'success'); await loadUploads();
          } catch(error) { status('library-status', error.message, 'error'); remove.disabled = false; }
        });
        row.append(img,info,remove); list.append(row);
      }
    } catch(error) { status('library-status', error.message, 'error'); }
  }
  (async () => {
    try {
      const session = await api('api/admin/session');
      if (session.authenticated) showDashboard(session);
      else showLogin();
    } catch(error) {
      showLogin();
      status('login-status', error.message, 'error');
    }
  })();
})();
