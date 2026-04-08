/* ═══════════════════════════════════════════════
   VARIÁVEIS GLOBAIS E ESTADO DO SISTEMA
═══════════════════════════════════════════════ */
let peer;           // Objeto principal do PeerJS
let conn;           // Armazena a conexão ativa entre os dois usuários
let db = JSON.parse(localStorage.getItem('chat_privado_db')) || {}; // Banco de dados local (Admin)
let conversaSelecionada = null; // ID que está sendo monitorado no painel

// Credenciais de acesso ao Painel Admin
const credenciais = { "admin": "123" };

/* ═══════════════════════════════════════════════
   LÓGICA DE LOGIN E FLUXO DE TELAS
═══════════════════════════════════════════════ */

// Função para validar login de administrador
function fazerLogin() {
    const u = document.getElementById('user-input').value;
    const p = document.getElementById('pass-input').value;

    if (credenciais[u] && credenciais[u] === p) {
        // Se for admin, habilita o botão de monitoramento e inicia com ID fixo
        document.getElementById('admin-btn').style.display = 'block';
        startPeer("ADMIN-SERVER", "Administrador");
    } else {
        alert("Acesso negado: Credenciais de operador inválidas.");
    }
}

// Troca a visualização para o formulário de visitante
function prepararVisitante() {
    document.getElementById('box-principal').style.display = 'none';
    document.getElementById('box-visitante').style.display = 'block';
}

// Volta para a tela inicial de autenticação
function voltarLogin() {
    document.getElementById('box-principal').style.display = 'block';
    document.getElementById('box-visitante').style.display = 'none';
}

// Valida e inicia a sessão do visitante
function finalizarCadastroVisitante() {
    const nome = document.getElementById('visitante-nome').value.trim();
    const idSugerido = document.getElementById('visitante-id').value.trim().toUpperCase();

    if (!nome || !idSugerido) {
        alert("Identificação incompleta: Nome e ID são obrigatórios.");
        return;
    }

    // REGRA DE SEGURANÇA: Verifica se o ID já foi usado antes (evita sobrescrever logs)
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
    // Inicializa o servidor P2P com o ID escolhido
    peer = new Peer(idFixo);

    peer.on('open', id => {
        document.getElementById('myId').innerText = id;
        document.getElementById('display-name').innerText = nomeExibicao;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('chat-container').style.display = 'flex';
        console.log(`Sessão iniciada como: ${nomeExibicao} (${id})`);
    });

    // Tratamento de erro: ID já em uso ou queda de servidor
    peer.on('error', err => {
        if (err.type === 'unavailable-id') {
            alert("Erro de Rede: Este ID já está conectado em outra aba ou por outro usuário.");
            location.reload();
        } else {
            console.error("Erro PeerJS:", err);
        }
    });

    // Escuta quando ALGUÉM tenta se conectar a você
    peer.on('connection', c => {
        conn = c;
        configurarConexao();
    });
}

// Função para VOCÊ se conectar a alguém
function connect() {
    const idDestino = document.getElementById('peerId').value.trim().toUpperCase();
    if (!idDestino) return;
    
    // Inicia a tentativa de conexão
    conn = peer.connect(idDestino);
    configurarConexao();
}

// Configura os ouvintes de eventos da conexão (abertura, dados e fechamento)
function configurarConexao() {
    conn.on('open', () => {
        console.log("Ponte segura estabelecida com: " + conn.peer);
        renderizarChat(`Conectado a: ${conn.peer}`, "system-msg");
    });

    // Limpa ouvintes antigos para evitar que a mensagem chegue duplicada
    conn.off('data'); 

    conn.on('data', data => {
        // Quando recebe mensagem: salva no banco do admin e mostra no chat
        registrarMensagem(conn.peer, "Recebido", data);
        renderizarChat(data, "msg-peer");
    });

    conn.on('close', () => {
        renderizarChat("A conexão foi encerrada pelo outro usuário.", "system-msg");
        conn = null;
    });
}

// Função de envio de mensagens
function send() {
    const msgInput = document.getElementById('msg');
    const msg = msgInput.value.trim();

    // Bloqueia envio se não houver conexão ativa
    if (!conn || !conn.open) {
        alert("Erro: Não há uma conexão ativa. Conecte-se a um ID primeiro.");
        return;
    }

    if (msg) {
        conn.send(msg); // Envia via PeerJS
        registrarMensagem(conn.peer, "Enviado", msg); // Salva log para admin
        renderizarChat(msg, "msg-me"); // Mostra na sua tela
        msgInput.value = ""; // Limpa campo
    }
}

// Renderiza as mensagens e notificações na tela do chat
function renderizarChat(msg, classe) {
    const chatBox = document.getElementById('chat');
    const div = document.createElement('div');
    div.className = classe;
    div.innerText = msg;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll para baixo
}

/* ═══════════════════════════════════════════════
   SISTEMA DE MONITORAMENTO E DATABASE (ADMIN)
═══════════════════════════════════════════════ */

// Grava o histórico no LocalStorage (persistente)
function registrarMensagem(peerId, tipo, texto) {
    if (!db[peerId]) db[peerId] = [];
    db[peerId].push({
        time: new Date().toLocaleTimeString(),
        sender: tipo,
        body: texto
    });
    localStorage.setItem('chat_privado_db', JSON.stringify(db));
    
    // Se o painel estiver aberto, atualiza a lista de conversas na hora
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

// Gera a lista de IDs na barra lateral do Admin
function atualizarListaAdmin() {
    const lista = document.getElementById('lista-conversas');
    lista.innerHTML = "";
    
    Object.keys(db).forEach(id => {
        const div = document.createElement('div');
        div.className = 'conversa-item';
        div.innerHTML = `
            <span>ID: ${id}</span> 
            <button class="del-btn" onclick="apagarConversa('${id}')">🗑️</button>
        `;
        div.onclick = (e) => { 
            if(e.target.tagName !== 'BUTTON') verConversa(id); 
        };
        lista.appendChild(div);
    });
}

// Renderiza todas as mensagens de um ID selecionado para auditoria
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

// Apaga uma única linha de mensagem
function apagarMsgUnica(id, idx) {
    db[id].splice(idx, 1);
    if(db[id].length === 0) delete db[id]; // Remove o ID se não houver mais msgs
    localStorage.setItem('chat_privado_db', JSON.stringify(db));
    verConversa(id);
    atualizarListaAdmin();
}

// Apaga a conversa inteira de um ID
function apagarConversa(id) {
    if(confirm(`Remover permanentemente os logs de ${id}?`)) {
        delete db[id];
        localStorage.setItem('chat_privado_db', JSON.stringify(db));
        atualizarListaAdmin();
        document.getElementById('logs-adm-detalhado').innerHTML = "";
        document.getElementById('id-conversa-ativa').innerText = "Selecionar ID";
    }
}

// Reseta todo o banco de dados
function limparTudo() {
    if(confirm("AVISO: Isso apagará todos os registros de todas as conversas! Continuar?")) {
        db = {};
        localStorage.removeItem('chat_privado_db');
        atualizarListaAdmin();
        document.getElementById('logs-adm-detalhado').innerHTML = "";
    }
}