/* ═══════════════════════════════════════════════
   VARIÁVEIS GLOBAIS E ESTADO DO SISTEMA
═══════════════════════════════════════════════ */
let peer;           // Objeto PeerJS
let conn;           // Conexão ativa
let db = JSON.parse(localStorage.getItem('chat_privado_db')) || {}; // Banco de dados local
let conversaSelecionada = null; // Controle do Painel Admin

// Credenciais de acesso ao Painel Admin
const credenciais = { "admin": "123" };

/* ═══════════════════════════════════════════════
   LÓGICA DE LOGIN E FLUXO DE TELAS
═══════════════════════════════════════════════ */

// Autenticação de Admin
function fazerLogin() {
    const u = document.getElementById('user-input').value;
    const p = document.getElementById('pass-input').value;

    if (credenciais[u] && credenciais[u] === p) {
        // Se for admin, habilita o botão de monitoramento
        document.getElementById('admin-btn').style.display = 'block';
        startPeer("ADMIN-SERVER", "Administrador");
    } else {
        alert("Acesso negado: Credenciais de operador inválidas.");
    }
}

// Troca para a tela de registro de visitante
function prepararVisitante() {
    document.getElementById('box-principal').style.display = 'none';
    document.getElementById('box-visitante').style.display = 'block';
}

// Volta para a tela inicial de login
function voltarLogin() {
    document.getElementById('box-principal').style.display = 'block';
    document.getElementById('box-visitante').style.display = 'none';
}

// Valida e finaliza o cadastro do visitante
function finalizarCadastroVisitante() {
    const nome = document.getElementById('visitante-nome').value.trim();
    const idSugerido = document.getElementById('visitante-id').value.trim().toUpperCase();

    if (!nome || !idSugerido) {
        alert("Identificação incompleta: Nome e ID são obrigatórios.");
        return;
    }

    // REGRA PROFISSIONAL: Verifica se o ID já existe no banco de dados local
    if (db[idSugerido]) {
        alert("Conflito de ID: Este identificador já consta em nossos registros. Escolha outro.");
        return;
    }

    startPeer(idSugerido, nome);
}

/* ═══════════════════════════════════════════════
   LÓGICA DE CONEXÃO (PEERJS)
═══════════════════════════════════════════════ */

function startPeer(idFixo, nomeExibicao) {
    // Inicializa o Peer com o ID escolhido (seja admin ou visitante)
    peer = new Peer(idFixo);

    peer.on('open', id => {
        document.getElementById('myId').innerText = id;
        document.getElementById('display-name').innerText = nomeExibicao;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('chat-container').style.display = 'flex';
        
        // Log interno de entrada
        console.log(`Ponte estabelecida para: ${nomeExibicao} (${id})`);
    });

    // Erro caso o ID já esteja sendo usado agora no servidor PeerJS
    peer.on('error', err => {
        if (err.type === 'unavailable-id') {
            alert("Erro de Rede: O ID solicitado está em uso por outra sessão ativa.");
            location.reload();
        }
    });

    // Escuta novas conexões recebidas
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
    conn.on('open', () => {
        console.log("Conectado a: " + conn.peer);
    });

    conn.on('data', data => {
        registrarMensagem(conn.peer, "Recebido", data);
        renderizarChat(data, "msg-peer");
    });
}

function send() {
    const msgInput = document.getElementById('msg');
    const msg = msgInput.value;
    if (conn && conn.open && msg) {
        conn.send(msg);
        registrarMensagem(conn.peer, "Enviado", msg);
        renderizarChat(msg, "msg-me");
        msgInput.value = "";
    }
}

function renderizarChat(msg, classe) {
    const c = document.getElementById('chat');
    c.innerHTML += `<div class="${classe}">${msg}</div>`;
    c.scrollTop = c.scrollHeight;
}

/* ═══════════════════════════════════════════════
   SISTEMA DE MONITORAMENTO (ADMIN)
═══════════════════════════════════════════════ */

// Salva as mensagens no LocalStorage
function registrarMensagem(peerId, tipo, texto) {
    if (!db[peerId]) db[peerId] = [];
    db[peerId].push({
        time: new Date().toLocaleTimeString(),
        sender: tipo,
        body: texto
    });
    localStorage.setItem('chat_privado_db', JSON.stringify(db));
    
    // Atualiza o painel em tempo real se ele estiver aberto
    if (document.getElementById('painel-admin').style.display === 'flex') {
        atualizarListaAdmin();
    }
}

function abrirPainel() {
    document.getElementById('painel-admin').style.display = 'flex';
    atualizarListaAdmin();
}

function fecharPainel() { 
    document.getElementById('painel-admin').style.display = 'none'; 
}

// Lista os IDs na barra lateral do Admin
function atualizarListaAdmin() {
    const lista = document.getElementById('lista-conversas');
    lista.innerHTML = "";
    Object.keys(db).forEach(id => {
        const div = document.createElement('div');
        div.className = 'conversa-item';
        div.innerHTML = `
            <span>ID: ${id}</span> 
            <button class="del-btn" onclick="apagarConversa('${id}')" title="Excluir conversa">🗑️</button>
        `;
        div.onclick = (e) => { 
            if(e.target.tagName !== 'BUTTON') verConversa(id); 
        };
        lista.appendChild(div);
    });
}

// Mostra o histórico detalhado de um ID
function verConversa(id) {
    conversaSelecionada = id;
    document.getElementById('id-conversa-ativa').innerText = id;
    const view = document.getElementById('logs-adm-detalhado');
    view.innerHTML = "";
    
    db[id].forEach((m, idx) => {
        view.innerHTML += `
            <div class="admin-msg-linha">
                <span><small>${m.time}</small> <b>${m.sender}:</b> ${m.body}</span>
                <span class="del-btn" onclick="apagarMsgUnica('${id}', ${idx})">Excluir</span>
            </div>`;
    });
}

/* ═══════════════════════════════════════════════
   FUNÇÕES DE EXCLUSÃO (DATABASE)
═══════════════════════════════════════════════ */

function apagarMsgUnica(id, idx) {
    db[id].splice(idx, 1);
    if(db[id].length === 0) delete db[id];
    localStorage.setItem('chat_privado_db', JSON.stringify(db));
    verConversa(id);
    atualizarListaAdmin();
}

function apagarConversa(id) {
    if(confirm(`Remover permanentemente os logs de ${id}?`)) {
        delete db[id];
        localStorage.setItem('chat_privado_db', JSON.stringify(db));
        atualizarListaAdmin();
        document.getElementById('logs-adm-detalhado').innerHTML = "";
        document.getElementById('id-conversa-ativa').innerText = "Selecionar ID";
    }
}

function limparTudo() {
    if(confirm("AVISO CRÍTICO: Deletar todo o banco de dados de logs?")) {
        db = {};
        localStorage.clear();
        atualizarListaAdmin();
        document.getElementById('logs-adm-detalhado').innerHTML = "";
    }
}