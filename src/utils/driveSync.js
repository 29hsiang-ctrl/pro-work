const CLIENT_ID = '343315337087-g0p1bbhuocrj7au9t271emgvfjmfof5r.apps.googleusercontent.com';
const AUTO_SYNC_KEY = 'prowork_drive_auto_sync';

let _token = null, _tokenExpiry = 0;
let _rootId = null, _photoRootId = null, _noteRootId = null;
const _projFolders = {}, _dateFolders = {};

export const isAutoSyncEnabled = () => localStorage.getItem(AUTO_SYNC_KEY) === '1';
export const setAutoSync = v => localStorage.setItem(AUTO_SYNC_KEY, v ? '1' : '0');
export const isTokenValid = () => !!_token && Date.now() < _tokenExpiry;

function requestToken(interactive) {
    return new Promise(resolve => {
        if (!window.google?.accounts?.oauth2) return resolve(null);
        window.google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/drive.file',
            callback: r => {
                if (r.error || !r.access_token) return resolve(null);
                _token = r.access_token;
                _tokenExpiry = Date.now() + ((r.expires_in ?? 3600) - 120) * 1000;
                resolve(_token);
            },
        }).requestAccessToken({ prompt: interactive ? 'consent' : '' });
    });
}

export const authorize = () => requestToken(true);
export const trySilentAuth = () => requestToken(false);
const getToken = () => isTokenValid() ? Promise.resolve(_token) : requestToken(false);

async function findOrCreate(token, name, parentId) {
    let q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    if (parentId) q += ` and '${parentId}' in parents`;
    const r = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    const { files } = await r.json();
    if (files?.length) return files[0].id;
    const body = { name, mimeType: 'application/vnd.google-apps.folder' };
    if (parentId) body.parents = [parentId];
    const cr = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const d = await cr.json();
    if (d.error) throw new Error(d.error.message);
    return d.id;
}

async function ensureRoots(token) {
    if (!_rootId)      _rootId      = await findOrCreate(token, 'prowork', null);
    if (!_photoRootId) _photoRootId = await findOrCreate(token, '照片', _rootId);
    if (!_noteRootId)  _noteRootId  = await findOrCreate(token, '筆記', _rootId);
}

function base64ToBlob(b64) {
    const [hdr, data] = b64.split(',');
    const mime = hdr.match(/:(.*?);/)[1];
    return new Blob([Uint8Array.from(atob(data), c => c.charCodeAt(0))], { type: mime });
}

async function uploadFile(token, name, blob, parentId) {
    const boundary = 'prowork_drive_boundary';
    const meta = JSON.stringify({ name, parents: [parentId] });
    const enc = new TextEncoder();
    const mp = enc.encode(`--${boundary}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${blob.type}\r\n\r\n`);
    const cp = enc.encode(`\r\n--${boundary}--`);
    const fb = new Uint8Array(await blob.arrayBuffer());
    const body = new Uint8Array(mp.length + fb.length + cp.length);
    body.set(mp); body.set(fb, mp.length); body.set(cp, mp.length + fb.length);
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary="${boundary}"` },
        body,
    });
    const d = await res.json();
    if (d.error) throw new Error(d.error.message);
}

export async function syncEntry(entry, projectName) {
    const token = await getToken();
    if (!token) return;
    await ensureRoots(token);
    if (!_projFolders[entry.projectId])
        _projFolders[entry.projectId] = await findOrCreate(token, projectName || entry.projectId, _photoRootId);
    const dk = `${entry.projectId}|${entry.date}`;
    if (!_dateFolders[dk])
        _dateFolders[dk] = await findOrCreate(token, entry.date, _projFolders[entry.projectId]);
    for (let i = 0; i < (entry.images || []).length; i++) {
        const parts = [entry.date, entry.floor, entry.direction, i + 1].filter(Boolean);
        await uploadFile(token, `${parts.join('_')}.jpg`, base64ToBlob(entry.images[i].preview), _dateFolders[dk]);
    }
}

export async function syncNote(note) {
    const token = await getToken();
    if (!token) return;
    await ensureRoots(token);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${note.title || '未命名'}</title></head><body>${note.content || ''}</body></html>`;
    await uploadFile(token, `${note.title || '未命名'}.html`, new Blob([html], { type: 'text/html' }), _noteRootId);
}

export async function syncAll({ onProgress } = {}) {
    const token = await getToken();
    if (!token) throw new Error('未授權，請先授權 Google Drive');
    onProgress?.('載入資料...');
    const [photosRaw, notesRaw, initData] = await Promise.all([
        fetch('/api/calendarPhotos').then(r => r.json()),
        fetch('/api/storage').then(r => r.json()),
        fetch('/api/init').then(r => r.json()),
    ]);
    const photos = Array.isArray(photosRaw) ? photosRaw : [];
    const notes  = Array.isArray(notesRaw)  ? notesRaw  : [];
    const projectMap = {};
    (initData.projects || []).forEach(p => { projectMap[p.id] = p.name; });
    onProgress?.('建立資料夾...');
    await ensureRoots(token);
    let photoCount = 0, noteCount = 0;
    for (const entry of photos) {
        await syncEntry(entry, projectMap[entry.projectId] || '未知工地');
        photoCount += (entry.images || []).length;
        onProgress?.(`上傳照片... ${photoCount} 張`);
    }
    for (const note of notes) {
        await syncNote(note);
        onProgress?.(`上傳筆記... ${++noteCount} 筆`);
    }
    return { photoCount, noteCount };
}
