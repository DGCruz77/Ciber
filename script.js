/* ═══════════════════════════════════════════════
   NEXOCHAT — SCRIPT PRINCIPAL v2.0
═══════════════════════════════════════════════ */


/* ─────────────────────────────────────────────
   1. ESTADO GLOBAL
───────────────────────────────────────────── */

let peer;
let conn;
let currentCall;
let notificacoesPermitidas = false;

let dbLogs = JSON.parse(localStorage.getItem('nexo_logs')) || {};
let usuarioAtual = null;


/* ─────────────────────────────────────────────
   2. BANCO DE DADOS DE USUÁRIOS
   ─────────────────────────────────────────────
   Para adicionar usuários fixos sem usar o painel,
   insira entradas no objeto USUARIOS_PADRAO abaixo.
───────────────────────────────────────────── */

const USUARIOS_PADRAO = {
    "admin": { senha: "123", permissao: "admin" },
    "Davi": { senha: "2907", permissao: "usuario" },
    "Juju": { senha: "2907", permissao: "usuario" },
    "Moreti": { senha: "goldenboy", permissao: "usuario" }
    // Adicione mais aqui:
    // "joao": { senha: "minhasenha", permissao: "usuario" }
};

function carregarUsuarios() {
    const dados = localStorage.getItem('nexo_usuarios');
    const salvos = dados ? JSON.parse(dados) : {};
    // Mescla: usuários padrão + usuários cadastrados pelo painel
    // Os do painel têm prioridade caso o mesmo login exista nos dois
    const merged = { ...USUARIOS_PADRAO, ...salvos };
    localStorage.setItem('nexo_usuarios', JSON.stringify(merged));
    return merged;
}

function salvarUsuarios(usuarios) {
    localStorage.setItem('nexo_usuarios', JSON.stringify(usuarios));
}


/* ─────────────────────────────────────────────
   3. INICIALIZAÇÃO E PERMISSÕES
───────────────────────────────────────────── */

const somNotificacao = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');

function solicitarPermissaoNotificacao() {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
        Notification.requestPermission().then(p => {
            if (p === "granted") notificacoesPermitidas = true;
        });
    } else if (Notification.permission === "granted") {
        notificacoesPermitidas = true;
    }
}

solicitarPermissaoNotificacao();


/* ─────────────────────────────────────────────
   4. FLUXO DE LOGIN E NAVEGAÇÃO
───────────────────────────────────────────── */

function fazerLogin() {
    const login = document.getElementById('user-input').value.trim();
    const senha  = document.getElementById('pass-input').value;

    if (!login || !senha) { alert("Preencha usuário e senha."); return; }

    const usuarios = carregarUsuarios();
    const usuario  = usuarios[login];

    if (!usuario || usuario.senha !== senha) {
        alert("Acesso negado: credenciais inválidas.");
        return;
    }

    usuarioAtual = { login, permissao: usuario.permissao };

    const idPeer       = usuario.permissao === 'admin' ? 'ADMIN-SERVER' : login.toUpperCase();
    const nomeExibicao = login.charAt(0).toUpperCase() + login.slice(1);

    iniciarPeer(idPeer, nomeExibicao, usuario.permissao === 'admin');
}

function mostrarFormVisitante() {
    document.getElementById('box-principal').style.display = 'none';
    document.getElementById('box-visitante').style.display = 'block';
}

function voltarLogin() {
    document.getElementById('box-principal').style.display = 'block';
    document.getElementById('box-visitante').style.display  = 'none';
}

function finalizarCadastroVisitante() {
    const nome       = document.getElementById('visitante-nome').value.trim();
    const idSugerido = document.getElementById('visitante-id').value.trim().replace(/\s+/g, '-').toUpperCase();

    if (!nome || !idSugerido) { alert("Preencha todos os campos."); return; }

    usuarioAtual = { login: nome, permissao: 'visitante' };
    iniciarPeer(idSugerido, nome, false);
}


/* ─────────────────────────────────────────────
   5. CONEXÃO P2P (PEERJS)
───────────────────────────────────────────── */

function iniciarPeer(idFixo, nomeExibicao, ehAdmin) {
    peer = new Peer(idFixo);

    peer.on('open', id => {
        document.getElementById('myId').innerText          = id;
        document.getElementById('display-name').innerText  = nomeExibicao;
        document.getElementById('login-screen').style.display   = 'none';
        document.getElementById('chat-container').style.display = 'flex';

        if (ehAdmin) document.getElementById('admin-btn').style.display = 'inline-flex';
    });

    peer.on('connection', conexaoEntrada => {
        conn = conexaoEntrada;
        configurarConexao();
    });

    peer.on('call', chamadaEntrada => {
        currentCall = chamadaEntrada;
        chamadaEntrada.answer();
        chamadaEntrada.on('stream', streamRemoto => {
            const videoEl = document.getElementById('remote-video');
            document.getElementById('video-grid').style.display = 'block';
            videoEl.srcObject = streamRemoto;
        });
    });

    peer.on('error', erro => {
        console.error("Erro PeerJS:", erro);
        if (erro.type === 'unavailable-id') alert("Este ID já está em uso. Escolha outro.");
    });
}

function conectar() {
    const idDestino = document.getElementById('peerId').value.trim().toUpperCase();
    if (!idDestino) { alert("Digite o ID do destinatário."); return; }
    if (!peer)      { alert("Você precisa estar autenticado."); return; }
    conn = peer.connect(idDestino);
    configurarConexao();
}

function configurarConexao() {
    conn.on('open', () => {
        renderizarMensagem(`Ponte segura estabelecida com: ${conn.peer}`, "system-msg");
    });

    conn.off('data');

    conn.on('data', dadosRecebidos => {
        if (dadosRecebidos.arquivo) {
            receberArquivo(dadosRecebidos);
            dispararAlerta(conn.peer, "[Enviou um arquivo]");
        } else {
            registrarLog(conn.peer, "Recebido", dadosRecebidos);
            renderizarMensagem(dadosRecebidos, "msg-peer");
            dispararAlerta(conn.peer, dadosRecebidos);
        }
    });

    conn.on('close', () => {
        renderizarMensagem("Conexão encerrada pelo outro usuário.", "system-msg");
        conn = null;
    });
}


/* ─────────────────────────────────────────────
   6. NOTIFICAÇÕES
───────────────────────────────────────────── */

function dispararAlerta(remetente, mensagem) {
    somNotificacao.play().catch(() => {});
    if (notificacoesPermitidas && document.hidden) {
        const corpo = mensagem.length > 60 ? mensagem.substring(0, 57) + "..." : mensagem;
        new Notification(`Mensagem de ${remetente}`, {
            body: corpo,
            icon: "https://cdn-icons-png.flaticon.com/512/564/564344.png"
        });
    }
}


/* ─────────────────────────────────────────────
   7. ENVIO E RECEBIMENTO DE ARQUIVOS
───────────────────────────────────────────── */

function enviarArquivo(inputEl) {
    const arquivo = inputEl.files[0];
    if (!arquivo) return;
    if (!conn || !conn.open) { alert("Conecte-se a um destinatário antes de enviar arquivos."); return; }

    const leitor = new FileReader();
    leitor.onload = (evento) => {
        const pacote = {
            arquivo:     true,
            nomeArquivo: arquivo.name,
            tipoArquivo: arquivo.type,
            conteudo:    evento.target.result
        };
        conn.send(pacote);
        registrarLog(conn.peer, "Enviado", `[Arquivo: ${arquivo.name}]`);
        renderizarMensagem(`📎 Arquivo enviado: ${arquivo.name}`, "msg-me");
    };
    leitor.readAsDataURL(arquivo);
    inputEl.value = '';
}

function receberArquivo(pacote) {
    const linkHTML = `<a href="${pacote.conteudo}" download="${pacote.nomeArquivo}" class="msg-file">📁 Baixar: ${pacote.nomeArquivo}</a>`;
    registrarLog(conn.peer, "Recebido", `[Arquivo: ${pacote.nomeArquivo}]`);
    renderizarMensagem(linkHTML, "msg-peer", true);
}


/* ─────────────────────────────────────────────
   8. COMPARTILHAMENTO DE TELA
───────────────────────────────────────────── */

async function alternarCompartilhamentoDeTela() {
    if (!conn || !conn.open) { alert("Conecte-se a um destinatário primeiro."); return; }
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        currentCall  = peer.call(conn.peer, stream);
        renderizarMensagem("Você está compartilhando sua tela.", "system-msg");
        stream.getVideoTracks()[0].onended = () => pararCompartilhamento();
    } catch (erro) {
        console.warn("Compartilhamento cancelado:", erro);
    }
}

function pararCompartilhamento() {
    document.getElementById('video-grid').style.display = 'none';
    if (currentCall) { currentCall.close(); currentCall = null; }
    renderizarMensagem("Compartilhamento de tela encerrado.", "system-msg");
}


/* ─────────────────────────────────────────────
   9. MENSAGENS E INTERFACE DO CHAT
───────────────────────────────────────────── */

function enviarMensagem() {
    const inputEl = document.getElementById('msg');
    const texto   = inputEl.value.trim();
    if (!texto) return;
    if (!conn || !conn.open) { alert("Conecte-se a um destinatário primeiro."); return; }

    conn.send(texto);
    registrarLog(conn.peer, "Enviado", texto);
    renderizarMensagem(texto, "msg-me");
    inputEl.value = "";
}

function renderizarMensagem(conteudo, classe, ehHTML = false) {
    const chatBox = document.getElementById('chat');

    if (classe === 'system-msg') {
        const wrapper = document.createElement('div');
        wrapper.className = classe;
        wrapper.innerHTML = `<span>${conteudo}</span>`;
        chatBox.appendChild(wrapper);
    } else {
        const div = document.createElement('div');
        div.className = classe;
        if (ehHTML) div.innerHTML = conteudo;
        else        div.innerText = conteudo;
        chatBox.appendChild(div);
    }

    chatBox.scrollTop = chatBox.scrollHeight;
}


/* ─────────────────────────────────────────────
   10. PAINEL ADMIN — ABAS
───────────────────────────────────────────── */

function abrirPainel() {
    document.getElementById('painel-admin').style.display = 'flex';
    atualizarListaLogs();
    renderizarListaUsuarios();
}

function fecharPainel() {
    document.getElementById('painel-admin').style.display = 'none';
}

function trocarAba(abaId, botao) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    botao.classList.add('active');
    document.querySelectorAll('.aba-conteudo').forEach(el => el.style.display = 'none');
    const mapa = { logs: 'aba-logs', usuarios: 'aba-usuarios' };
    document.getElementById(mapa[abaId]).style.display = 'flex';
}


/* ─────────────────────────────────────────────
   11. PAINEL ADMIN — LOGS DE CONVERSA
───────────────────────────────────────────── */

function registrarLog(peerId, tipo, texto) {
    if (!dbLogs[peerId]) dbLogs[peerId] = [];
    dbLogs[peerId].push({ hora: new Date().toLocaleTimeString('pt-BR'), tipo, texto });
    localStorage.setItem('nexo_logs', JSON.stringify(dbLogs));
    if (document.getElementById('painel-admin').style.display !== 'none') atualizarListaLogs();
}

function atualizarListaLogs() {
    const lista = document.getElementById('lista-conversas');
    lista.innerHTML = "";
    const ids = Object.keys(dbLogs);
    if (ids.length === 0) {
        lista.innerHTML = '<p style="font-size:13px; color:var(--text-hint);">Nenhuma conversa registrada.</p>';
        return;
    }
    ids.forEach(id => {
        const div = document.createElement('div');
        div.className = 'conversa-item';
        div.innerHTML = `
            <span>${id} <small style="color:var(--text-hint)">(${dbLogs[id].length} msgs)</small></span>
            <button class="del-btn" onclick="excluirConversa('${id}', event)">✕</button>
        `;
        div.addEventListener('click', () => verLogs(id));
        lista.appendChild(div);
    });
}

function verLogs(peerId) {
    document.getElementById('id-conversa-ativa').innerText = peerId;
    const viewEl = document.getElementById('logs-adm-detalhado');
    viewEl.innerHTML = "";
    dbLogs[peerId].forEach(entrada => {
        const linha = document.createElement('div');
        linha.className = 'admin-msg-linha';
        linha.innerHTML = `<small>${entrada.hora}</small> <b>${entrada.tipo}:</b> ${entrada.texto}`;
        viewEl.appendChild(linha);
    });
}

function excluirConversa(peerId, evento) {
    evento.stopPropagation();
    if (!confirm(`Excluir histórico de ${peerId}?`)) return;
    delete dbLogs[peerId];
    localStorage.setItem('nexo_logs', JSON.stringify(dbLogs));
    atualizarListaLogs();
    document.getElementById('logs-adm-detalhado').innerHTML = '<div class="empty-state">Selecione uma conversa na lista ao lado.</div>';
    document.getElementById('id-conversa-ativa').innerText = '— selecione um ID —';
}

function limparTudo() {
    if (!confirm("Limpar TODOS os logs? Esta ação não pode ser desfeita.")) return;
    dbLogs = {};
    localStorage.removeItem('nexo_logs');
    atualizarListaLogs();
    document.getElementById('logs-adm-detalhado').innerHTML = '<div class="empty-state">Selecione uma conversa na lista ao lado.</div>';
}


/* ─────────────────────────────────────────────
   12. PAINEL ADMIN — GESTÃO DE USUÁRIOS
   ─────────────────────────────────────────────
   Cadastre, liste e remova usuários do sistema.
   Dados salvos em localStorage ('nexo_usuarios').
───────────────────────────────────────────── */

function cadastrarUsuario() {
    const login      = document.getElementById('novo-usuario-login').value.trim().toLowerCase();
    const senha      = document.getElementById('novo-usuario-senha').value;
    const permissao  = document.getElementById('novo-usuario-permissao').value;
    const feedbackEl = document.getElementById('msg-feedback-usuario');

    feedbackEl.className = 'form-feedback';
    feedbackEl.innerText = '';

    if (!login) {
        feedbackEl.className = 'form-feedback error';
        feedbackEl.innerText = 'O campo "Usuário" é obrigatório.';
        return;
    }
    if (senha.length < 4) {
        feedbackEl.className = 'form-feedback error';
        feedbackEl.innerText = 'A senha deve ter pelo menos 4 caracteres.';
        return;
    }
    if (!/^[a-z0-9._-]+$/.test(login)) {
        feedbackEl.className = 'form-feedback error';
        feedbackEl.innerText = 'Use apenas letras, números, ponto ou hífen.';
        return;
    }

    const usuarios = carregarUsuarios();
    if (usuarios[login]) {
        feedbackEl.className = 'form-feedback error';
        feedbackEl.innerText = `O usuário "${login}" já existe.`;
        return;
    }

    usuarios[login] = { senha, permissao };
    salvarUsuarios(usuarios);

    feedbackEl.className = 'form-feedback success';
    feedbackEl.innerText = `Usuário "${login}" cadastrado com sucesso!`;

    document.getElementById('novo-usuario-login').value = '';
    document.getElementById('novo-usuario-senha').value = '';
    document.getElementById('novo-usuario-permissao').value = 'usuario';

    renderizarListaUsuarios();
}

function excluirUsuario(login) {
    if (usuarioAtual && usuarioAtual.login === login) {
        alert("Você não pode excluir o próprio usuário enquanto está logado.");
        return;
    }
    if (!confirm(`Excluir o usuário "${login}"?`)) return;
    const usuarios = carregarUsuarios();
    delete usuarios[login];
    salvarUsuarios(usuarios);
    renderizarListaUsuarios();
}

function renderizarListaUsuarios() {
    const listaEl = document.getElementById('lista-usuarios');
    if (!listaEl) return;

    listaEl.innerHTML = "";
    const usuarios = carregarUsuarios();
    const logins   = Object.keys(usuarios);

    if (logins.length === 0) {
        listaEl.innerHTML = '<p style="font-size:13px; color:var(--text-hint);">Nenhum usuário cadastrado.</p>';
        return;
    }

    logins.forEach(login => {
        const { permissao } = usuarios[login];
        const tagClasse  = permissao === 'admin' ? 'tag-admin' : 'tag-usuario';
        const tagTexto   = permissao === 'admin' ? 'Admin' : 'Usuário';
        const ehAtual    = usuarioAtual && usuarioAtual.login === login;

        const item = document.createElement('div');
        item.className = 'usuario-item';
        item.innerHTML = `
            <div class="usuario-info">
                <span class="usuario-login">${login}${ehAtual ? ' (você)' : ''}</span>
                <span class="usuario-tag ${tagClasse}">${tagTexto}</span>
            </div>
            ${!ehAtual
                ? `<button class="btn-del-usuario" onclick="excluirUsuario('${login}')">✕</button>`
                : '<span style="font-size:12px; color:var(--text-hint)">logado</span>'
            }
        `;
        listaEl.appendChild(item);
    });
}