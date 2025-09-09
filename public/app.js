const apiBase = '';
const socket = io();

let token = localStorage.getItem('token') || null;
let me = null;

const el = id => document.getElementById(id);
const show = (id) => { el(id).classList.remove('hidden'); };
const hide = (id) => { el(id).classList.add('hidden'); };

function setAuthMsg(s){ el('auth-msg').innerText = s; }

async function register(){
  const username = el('username').value.trim();
  const password = el('password').value;
  if(!username || !password) return setAuthMsg('isi username dan password...');
  const r = await fetch('/register', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({username,password})});
  const j = await r.json();
  if(j.ok) setAuthMsg('registrasi sukses, login aja...');
  else setAuthMsg('error: '+(j.error||'unknown'));
}

async function login(){
  const username = el('username').value.trim();
  const password = el('password').value;
  if(!username || !password) return setAuthMsg('isi username dan password...');
  const r = await fetch('/login', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({username,password})});
  const j = await r.json();
  if(j.ok){
    token = j.token;
    localStorage.setItem('token', token);
    me = { username: j.username, avatar: j.avatar };
    enterChat();
  } else {
    setAuthMsg('login gagal...');
  }
}

function logout(){
  token = null;
  localStorage.removeItem('token');
  location.reload();
}

function showUsers(list){
  const ul = el('users');
  ul.innerHTML = '';
  list.forEach(u => {
    const li = document.createElement('li');
    const img = document.createElement('img');
    img.src = u.avatar || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="100%" height="100%" fill="%23ccc"/></svg>';
    img.width=28; img.height=28;
    li.appendChild(img);
    const span = document.createElement('span');
    span.innerText = u.username;
    li.appendChild(span);
    ul.appendChild(li);
  });
}

function addMessage(m){
  const wrap = document.createElement('div');
  wrap.className = 'msg';
  const img = document.createElement('img');
  img.src = m.avatar || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="100%" height="100%" fill="%23ccc"/></svg>';
  img.width=36; img.height=36;
  const body = document.createElement('div');
  body.className = 'body';
  const who = document.createElement('div');
  who.className = 'who';
  who.innerText = m.user;
  const text = document.createElement('div');
  text.className = 'text';
  text.innerText = m.text;
  body.appendChild(who);
  body.appendChild(text);
  wrap.appendChild(img);
  wrap.appendChild(body);
  el('messages').appendChild(wrap);
  el('messages').scrollTop = el('messages').scrollHeight;
}

function enterChat(){
  hide('auth');
  show('chat');
  el('me-name').innerText = me.username;
  el('me-avatar').src = me.avatar || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="100%" height="100%" fill="%23ccc"/></svg>';
  socket.emit('auth', token);
}

el('btn-register').onclick = register;
el('btn-login').onclick = login;
el('btn-logout').onclick = logout;
el('btn-send').onclick = () => {
  const t = el('msginput').value.trim();
  if(!t) return;
  socket.emit('message', t);
  el('msginput').value = '';
};

el('avatar-file').onchange = async (e) => {
  const f = e.target.files[0];
  if(!f) return;
  const r = new FileReader();
  r.onload = async () => {
    const dataUrl = r.result;
    await fetch('/avatar', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ token, dataUrl })});
    el('me-avatar').src = dataUrl;
  };
  r.readAsDataURL(f);
};

// socket handlers
socket.on('init', (data) => {
  // data: { username, avatar, messages, users }
  me = { username: data.username, avatar: data.avatar };
  el('me-name').innerText = me.username;
  el('me-avatar').src = me.avatar || el('me-avatar').src;
  el('messages').innerHTML = '';
  data.messages.forEach(addMessage);
  showUsers(data.users);
});

socket.on('message', addMessage);

socket.on('user-joined', (u) => {
  // add notice
  showUsers([...(document.querySelectorAll('#users li')||[])]); // naive
  // refresh user list via request to /me?token to get full list is omitted for brevity
  const notice = { user: 'system', avatar: null, text: `${u.username} joined` };
  addMessage(notice);
});

socket.on('user-left', (u) => {
  addMessage({ user: 'system', avatar: null, text: `${u.username} left` });
});

socket.on('user-update', (u) => {
  // avatar changed
  if(u.username === me.username){
    el('me-avatar').src = u.avatar;
  }
});
