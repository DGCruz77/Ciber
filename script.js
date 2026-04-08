let peer;
let conn;
let db = JSON.parse(localStorage.getItem('chat_privado_db')) || {}; 
let conversaAtivaAdmin = null;

const usuarios = {
    "admin": { senha: "123", cargo: "admin" }
};

// --- LOGIN E INICIALIZAÇÃO ---
function fazerLogin() {
    const user = document.getElementById('user-input').value;
    const pass = document.getElementById('pass-input').value;

    if (usuarios[user] && usuarios[user].senha === pass) {
        document.getElementById('display-name').innerText = user;
        if (usuarios[user].cargo === "admin") document.getElementById('admin-btn').style.display = 'block';
        inicializarPeer();
    } else {
        alert("Credenciais Inválidas");
    }
}

function inicializarPeer() {
    peer = new Peer();
    peer.on('open', id => {
        document.getElementById("myId").innerText = id;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('chat-container').style.display = 'flex';
    });

    peer.on('connection', c => {
        conn = c;
        setupConn();
    });
}

// --- CONEXÃO E MENSAGENS ---
function connect() {
    const id = document.getElementById("peerId").value;
    if (!id) return;
    conn = peer.connect(id);
    setupConn();
}

function setupConn() {
    conn.on('open', () => {
        salvarNoDB(conn.peer, "Sistema", "Conexão Estabelecida");
    });
    
    conn.on('data', data => {
        salvarNoDB(conn.peer, "Recebido", data);
        if (document.getElementById('chat-container').style.display !== 'none') {
            exibirNoChat(data, "msg-peer");
        }
    });
}

function send() {
    const input = document.getElementById("msg");
    if (conn && conn.open && input.value) {
        conn.send(input.value);
        salvarNoDB(conn.peer, "Enviado", input.value);
        exibirNoChat(input.value, "msg-me");
        input.value = "";
    }
}

function exibirNoChat(msg, classe) {
    const chat = document.getElementById("chat");
    chat.innerHTML += `<div class="${classe}">${msg}</div>`;
    chat.scrollTop = chat.scrollHeight;
}

// --- SISTEMA DE BANCO DE DADOS (LOCAL STORAGE) ---
function salvarNoDB(peerId, remetente, texto) {
    if (!db[peerId]) db[peerId] = [];
    const msgObj = {
        id: Date.now(),
        horario: new Date().toLocaleTimeString(),
        remetente: remetente,
        texto: texto
    };
    db[peerId].push(msgObj);
    localStorage.setItem('chat_privado_db', JSON.stringify(db));
    if (document.getElementById('painel-admin').style.display === 'flex') atualizarPainel();
}

// --- FUNÇÕES DO PAINEL ADMIN ---
function abrirPainel() {
    document.getElementById('painel-admin').style.display = 'flex';
    atualizarPainel();
}

function fecharPainel() {
    document.getElementById('painel-admin').style.display = 'none';
}

function atualizarPainel() {
    const lista = document.getElementById('lista-conversas');
    lista.innerHTML = "";
    
    Object.keys(db).forEach(peerId => {
        const item = document.createElement('div');
        item.className = 'conversa-item';
        item.innerHTML = `
            <span>ID: ${peerId}</span>
            <button onclick="apagarConversa('${peerId}')">🗑️</button>
        `;
        item.onclick = (e) => {
            if (e.target.tagName !== 'BUTTON') selecionarConversa(peerId);
        };
        lista.appendChild(item);
    });
}

function selecionarConversa(peerId) {
    conversaAtivaAdmin = peerId;
    document.getElementById('id-conversa-ativa').innerText = peerId;
    renderizarMensagensAdmin();
}

function renderizarMensagensAdmin() {
    const view = document.getElementById('logs-adm-detalhado');
    view.innerHTML = "";
    
    if (!conversaAtivaAdmin || !db[conversaAtivaAdmin]) return;

    db[conversaAtivaAdmin].forEach((m, index) => {
        const msgLinha = document.createElement('div');
        msgLinha.className = 'admin-msg-linha';
        msgLinha.innerHTML = `
            <small>[${m.horario}]</small> <b>${m.remetente}:</b> ${m.texto}
            <span class="delete-msg" onclick="apagarMensagem('${conversaAtivaAdmin}', ${index})">Excluir</span>
        `;
        view.appendChild(msgLinha);
    });
}

// --- FUNÇÕES DE EXCLUSÃO (CRITICAL) ---
function apagarMensagem(peerId, index) {
    db[peerId].splice(index, 1);
    if (db[peerId].length === 0) delete db[peerId];
    localStorage.setItem('chat_privado_db', JSON.stringify(db));
    renderizarMensagensAdmin();
    atualizarPainel();
}

function apagarConversa(peerId) {
    if (confirm(`Deseja apagar todo o histórico de ${peerId}?`)) {
        delete db[peerId];
        localStorage.setItem('chat_privado_db', JSON.stringify(db));
        if (conversaAtivaAdmin === peerId) {
            conversaAtivaAdmin = null;
            document.getElementById('id-conversa-ativa').innerText = "Nenhum";
        }
        atualizarPainel();
        renderizarMensagensAdmin();
    }
}

function limparTudo() {
    if (confirm("AVISO: Isso apagará TODOS os registros de conversas do sistema.")) {
        db = {};
        localStorage.clear();
        atualizarPainel();
        renderizarMensagensAdmin();
    }
}