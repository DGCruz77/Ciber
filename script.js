let peer;
let conn;
let db = JSON.parse(localStorage.getItem('chat_privado_db')) || {};
let conversaSelecionada = null;

const credenciais = { "admin": "123" };

function fazerLogin() {
    const u = document.getElementById('user-input').value;
    const p = document.getElementById('pass-input').value;

    if (credenciais[u] && credenciais[u] === p) {
        document.getElementById('admin-btn').style.display = 'block';
        startPeer();
    } else if (u === "visitante") {
        startPeer();
    } else {
        alert("Credenciais Inválidas");
    }
}

function startPeer() {
    peer = new Peer();
    peer.on('open', id => {
        document.getElementById('myId').innerText = id;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('chat-container').style.display = 'flex';
    });
    peer.on('connection', c => {
        conn = c;
        configurarConexao();
    });
}

function connect() {
    const id = document.getElementById('peerId').value;
    if (!id) return;
    conn = peer.connect(id);
    configurarConexao();
}

function configurarConexao() {
    conn.on('data', data => {
        registrarMensagem(conn.peer, "Recebido", data);
        renderizarChat(data, "msg-peer");
    });
}

function send() {
    const msg = document.getElementById('msg').value;
    if (conn && conn.open && msg) {
        conn.send(msg);
        registrarMensagem(conn.peer, "Enviado", msg);
        renderizarChat(msg, "msg-me");
        document.getElementById('msg').value = "";
    }
}

function renderizarChat(msg, classe) {
    const c = document.getElementById('chat');
    c.innerHTML += `<div class="${classe}">${msg}</div>`;
    c.scrollTop = c.scrollHeight;
}

// LOGICA DE MONITORAMENTO (BANCO DE DADOS)
function registrarMensagem(peerId, tipo, texto) {
    if (!db[peerId]) db[peerId] = [];
    db[peerId].push({
        time: new Date().toLocaleTimeString(),
        sender: tipo,
        body: texto
    });
    localStorage.setItem('chat_privado_db', JSON.stringify(db));
    if (document.getElementById('painel-admin').style.display === 'flex') atualizarListaAdmin();
}

function abrirPainel() {
    document.getElementById('painel-admin').style.display = 'flex';
    atualizarListaAdmin();
}

function fecharPainel() { document.getElementById('painel-admin').style.display = 'none'; }

function atualizarListaAdmin() {
    const lista = document.getElementById('lista-conversas');
    lista.innerHTML = "";
    Object.keys(db).forEach(id => {
        const div = document.createElement('div');
        div.className = 'conversa-item';
        div.innerHTML = `<span>ID: ${id}</span> <button class="del-btn" onclick="apagarConversa('${id}')">Apagar</button>`;
        div.onclick = (e) => { if(e.target.tagName !== 'BUTTON') verConversa(id); };
        lista.appendChild(div);
    });
}

function verConversa(id) {
    conversaSelecionada = id;
    document.getElementById('id-conversa-ativa').innerText = id;
    const view = document.getElementById('logs-adm-detalhado');
    view.innerHTML = "";
    db[id].forEach((m, idx) => {
        view.innerHTML += `
            <div class="admin-msg-linha">
                <span><small>${m.time}</small> <b>${m.sender}:</b> ${m.body}</span>
                <span class="del-btn" onclick="apagarMsgUnica('${id}', ${idx})">x</span>
            </div>`;
    });
}

function apagarMsgUnica(id, idx) {
    db[id].splice(idx, 1);
    if(db[id].length === 0) delete db[id];
    localStorage.setItem('chat_privado_db', JSON.stringify(db));
    verConversa(id);
    atualizarListaAdmin();
}

function apagarConversa(id) {
    delete db[id];
    localStorage.setItem('chat_privado_db', JSON.stringify(db));
    atualizarListaAdmin();
    document.getElementById('logs-adm-detalhado').innerHTML = "";
}

function limparTudo() {
    if(confirm("Deseja deletar permanentemente todos os logs?")) {
        db = {};
        localStorage.clear();
        atualizarListaAdmin();
        document.getElementById('logs-adm-detalhado').innerHTML = "";
    }
}