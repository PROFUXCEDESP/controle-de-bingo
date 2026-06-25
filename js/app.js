document.addEventListener("DOMContentLoaded", () => {
    
    function textoIgual(t1, t2) {
        if(!t1 || !t2) return false;
        return t1.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() === 
               t2.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    }

    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwWD-pi7qf1Vlp01I8CO-7euJmqsNureruSEjeFc9bdYUZ_M13he6bqBC_ctJGHUpc4ow/exec'; 
    const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dliu0ck6y/image/upload'; 
    const CLOUDINARY_PRESET = 'bingo_2026';
    
    const userName = localStorage.getItem('usuarioLogado') || 'Administrador';
    const nivelAcessoUsuario = localStorage.getItem('nivelAcesso') || '';
    
    window.fotoFileGlobal = null; 
    let cropperInstancia = null;
    window.alunoEmFocoIdx = null; 
    window.modoEdicaoFoto = false; 
    window.tipoCadastroFoto = 'aluno';
    window.tipoPessoaEmFoco = 'Educando';
    
    window.lotesValidadosNestaSessao = new Set(); 

    window.pages = {
        rankAdm: { current: 1, term: "" },
        gestaoLotes: { current: 1, term: "" },
        pendentesAdm: { current: 1, term: "" },
        pendentesEdu: { current: 1, term: "" },
        logs: { current: 1 },
        caixa: { current: 1 },
        caixaVD: { current: 1, term: "" },
        estoqueLotes: { current: 1, term: "", educador: "" },
        rankProfAdm: { current: 1 },
        minhaTurma: { current: 1, term: "", turma: "Todas" },
        rankEdu: { current: 1, term: "" },
        rankProfEdu: { current: 1 },
        rankEquipe: { current: 1 },
        parceiros: { current: 1 }
    };

    let estoqueChartInstEdu = null; let financeiroChartInstEdu = null;
    let estoqueChartInstAdm = null; let financeiroChartInstAdm = null;

    window.caixaGlobal = { pixReais: 0.00, dinReais: 0.00 };
    window.caixaGlobalBD = []; 
    window.caixaVendaDiretaBD = [];
    window.todosEducandosBD = []; window.mockEducadoresBD = [];
    window.todosParceirosBD = []; window.lotesSedeBD = []; window.logsDoSistema = [];
    window.historicoLotesBD = [];

    window.renderPaginationUI = function(containerId, key, totalItems, itemsPerPage, renderFunc) {
        const container = document.getElementById(containerId);
        if(!container) return;
        const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
        if(window.pages[key].current > totalPages) window.pages[key].current = totalPages;
        if(window.pages[key].current < 1) window.pages[key].current = 1;

        container.innerHTML = `
            <div class="discrete-pagination">
                <button class="btn-page-discrete" ${window.pages[key].current === 1 ? 'disabled' : ''} onclick="window.goPage('${key}', -1, '${renderFunc}')">&lt;</button>
                <input type="number" class="page-input-discrete" value="${window.pages[key].current}" min="1" max="${totalPages}" onchange="window.jumpPage('${key}', this, '${renderFunc}')">
                <span style="color:var(--dim-grey); font-size:0.9rem;">de ${totalPages}</span>
                <button class="btn-page-discrete" ${window.pages[key].current === totalPages ? 'disabled' : ''} onclick="window.goPage('${key}', 1, '${renderFunc}')">&gt;</button>
            </div>
        `;
    }

    window.goPage = (key, dir, func) => { window.pages[key].current += dir; if(window[func]) window[func](); };
    window.jumpPage = (key, input, func) => { 
        let val = parseInt(input.value) || 1;
        window.pages[key].current = val; 
        if(window[func]) window[func](); 
    };

    window.registrarLog = function(acao, detalhe) {
        const dataHora = new Date().toLocaleString('pt-BR');
        const sessao = window.innerWidth <= 768 ? 'Mobile' : 'Desktop';
        
        window.logsDoSistema.push({ 'Data/Hora': dataHora, 'Responsavel': userName, 'Sessão_Dispositivo': sessao, 'Ação_Registrada': acao, 'Detalhes': detalhe });
        if(document.getElementById('tabelaLogs') && window.renderLogsPaginado) window.renderLogsPaginado();
        
        fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'registrar_log', dataHora, responsavel: userName, sessao, acao, detalhe, localizacao: 'Sistema Web' }) }).catch(e => console.error("Erro log", e));
    }

    document.addEventListener('input', (e) => {
        if(e.target.classList.contains('search-custom-select')) {
            const term = e.target.value.toLowerCase();
            const options = e.target.closest('.custom-options').querySelectorAll('.custom-option');
            options.forEach(opt => {
                if(opt.textContent.toLowerCase().includes(term)) opt.style.display = 'block';
                else opt.style.display = 'none';
            });
        }
    });

    window.bindOptionClick = function(e) {
        const option = e.currentTarget;
        const wrapperNode = option.closest('.custom-select-wrapper');
        if (!wrapperNode) return;
        const select = wrapperNode.querySelector('.custom-select');
        const triggerText = wrapperNode.querySelector('.trigger-text');
        const hiddenInput = wrapperNode.querySelector('input[type="hidden"]');
        triggerText.textContent = option.textContent;
        hiddenInput.value = option.getAttribute('data-value');
        wrapperNode.querySelectorAll('.custom-option').forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        select.classList.remove('open');
        triggerText.style.color = "var(--dim-grey)"; 
        const searchInput = wrapperNode.querySelector('.search-custom-select');
        if(searchInput) { searchInput.value = ''; wrapperNode.querySelectorAll('.custom-option').forEach(opt => opt.style.display = 'block'); }
        hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
        e.stopPropagation();
    }

    function ativarEventosSelectCustomizado(wrapperNode) {
        const options = wrapperNode.querySelectorAll('.custom-option');
        options.forEach(option => { option.removeEventListener('click', window.bindOptionClick); option.addEventListener('click', window.bindOptionClick); });
    }

    const customSelectWrappers = document.querySelectorAll('.custom-select-wrapper');
    customSelectWrappers.forEach(wrapper => {
        const select = wrapper.querySelector('.custom-select');
        const trigger = wrapper.querySelector('.custom-select-trigger');
        if(trigger) {
            trigger.addEventListener('click', (e) => {
                document.querySelectorAll('.custom-select').forEach(s => { if (s !== select) s.classList.remove('open'); });
                select.classList.toggle('open');
                e.stopPropagation();
            });
            ativarEventosSelectCustomizado(wrapper);
        }
    });

    window.addEventListener('click', () => { document.querySelectorAll('.custom-select').forEach(s => s.classList.remove('open')); });

    window.mudarAbaEducador = function(secId, navId) {
        const todasSecoes = document.querySelectorAll('main.admin-container > section');
        todasSecoes.forEach(sec => sec.style.display = 'none');
        const todosNavs = document.querySelectorAll('.sidebar-nav .nav-item');
        todosNavs.forEach(nav => nav.classList.remove('active'));
        const secClicada = document.getElementById(secId); if(secClicada) secClicada.style.display = 'block';
        const navClicado = document.getElementById(navId); if(navClicado) navClicado.classList.add('active');
        if(window.innerWidth <= 768) { const side = document.getElementById('sidebar'); if(side) side.classList.remove('open'); }
        if(document.getElementById("educadorPage") && window.atualizarDashboardEducador) window.atualizarDashboardEducador();
        if(document.getElementById("adminPage") && window.atualizarDashboardsADM) window.atualizarDashboardsADM();
    }

    const sidebar = document.getElementById('sidebar');
    const openSidebarBtn = document.getElementById('openSidebar');
    const closeSidebarBtn = document.getElementById('closeSidebar');
    if(sidebar) {
        if(openSidebarBtn) openSidebarBtn.addEventListener('click', () => sidebar.classList.add('open'));
        if(closeSidebarBtn) closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('open'));
    }

    window.carregarDadosDoBanco = function(recarregarTelas = true) {
        const btnSync = document.getElementById('nomeEducador');
        if(btnSync) btnSync.innerText = "Sincronizando...";

        fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'sincronizar_dados' }) })
        .then(res => res.json())
        .then(data => {
            if(data.success) {
                window.lotesSedeBD = data.lotesSede.map(l => ({ codigo: l['Codigo_Lote'] || l['ID do Lote'], educador: l['Responsavel_Atual'] || l['Educador_Destino'] || '' })).filter(l => l.codigo);

                window.todosEducandosBD = data.educandos.map(e => ({
                    nome: e['Nome_Educando'] || e['Nome'], curso: e['Curso'], turma: e['Turma'], periodo: e['Periodo'], 
                    educadorResponsavel: e['Educador_Responsavel'] || '',
                    cadastroAtivo: e['Cadastro_Ativo'] || '',
                    foto: e['Foto_URL'] && String(e['Foto_URL']).trim() !== '' ? e['Foto_URL'] : `https://ui-avatars.com/api/?name=${encodeURIComponent(e['Nome_Educando'] || e['Nome'])}&background=BC68A1&color=fff`,
                    lotesPendentes: e['Lotes_Pendentes'] ? String(e['Lotes_Pendentes']).split(',').map(s=>s.trim()).filter(Boolean) : [],
                    lotesVendidos: e['Lotes_Vendidos'] ? String(e['Lotes_Vendidos']).split(',').map(s=>s.trim()).filter(Boolean) : [],
                    lotesDevolvidos: e['Lotes_Devolvidos'] ? String(e['Lotes_Devolvidos']).split(',').map(s=>s.trim()).filter(Boolean) : [],
                    cartelasEntregues: parseInt(e['Cartelas_Entregue']) || 0,
                    tipoOperacao: (normalizarCodigoLote(e['Turma']) === 'EQUIPE' || normalizarCodigoLote(e['Turma']) === 'VENDA DIRETA' || normalizarCodigoLote(e['Curso']) === 'VENDA DIRETA') ? 'Venda Direta' : 'Educando'
                }));

                window.todosParceirosBD = (data.parceiros || []).map(p => ({
                    nome: p['Nome'], cartela: p['Cartela_Retirada'] || '', turma: 'Parceiro', curso: 'Comércio/Apoiador',
                    foto: `https://ui-avatars.com/api/?name=${encodeURIComponent(p['Nome'])}&background=4CAF50&color=fff`,
                    lotesPendentes: p['Lotes_Pendentes'] ? String(p['Lotes_Pendentes']).split(',').map(s=>s.trim()).filter(Boolean) : [],
                    lotesVendidos: p['Lotes_Vendidos'] ? String(p['Lotes_Vendidos']).split(',').map(s=>s.trim()).filter(Boolean) : [],
                    lotesDevolvidos: []
                }));

                window.mockEducadoresBD = data.educadores.map(e => {
                    let vendidos = 0; let pendentes = 0;
                    window.todosEducandosBD.forEach(al => {
                        if(textoIgual(al.educadorResponsavel, e['Nome'])) { 
                            vendidos += al.lotesVendidos.length; 
                            pendentes += al.lotesPendentes.length; 
                        }
                    });
                    let retiradosSede = window.lotesSedeBD.filter(l => textoIgual(l.educador, e['Nome'])).length;
                    return { nome: e['Nome'], curso: e['Curso Responsavel'], nivelAcesso: e['Nivel_Acesso'] || e['Nível_Acesso'] || '', lotesRetiradosSede: retiradosSede, lotesVendidos: vendidos, lotesPendentes: pendentes };
                });

                window.caixaGlobal = { pixReais: 0, dinReais: 0 };
                window.caixaGlobalBD = data.caixaGlobal || [];
                window.caixaVendaDiretaBD = data.caixaVendaDireta || [];
                if (data.caixaGlobal) {
                    data.caixaGlobal.forEach(transacao => {
                        let valor = parseFloat(transacao['Valor']) || parseFloat(transacao['Valor_Total']) || parseFloat(transacao['Valor Recebido']) || 0;
                        let m = String(transacao['Metodo_Pagamento'] || transacao['Método'] || transacao['Metodo'] || transacao['Forma_Pagamento'] || '').toUpperCase();
                        if(m.includes('PIX')) window.caixaGlobal.pixReais += valor;
                        if(m.includes('DINHEIRO') || m.includes('ESPECIE') || m.includes('MISTO')) window.caixaGlobal.dinReais += valor;
                    });
                }
                
                window.logsDoSistema = data.logs || [];
                window.historicoLotesBD = (data.historicoLotes || []).map(h => ({
                    dataRetirada: h['Data_Retirada'] || h['Data Retirada'] || h['Data/Hora'] || '',
                    nome: h['Nome'] || '',
                    tipo: h['Tipo'] || 'Educando',
                    curso: h['Curso'] || '',
                    turma: h['Turma'] || '',
                    lote: h['Lote'] || '',
                    atribuidoPor: h['Atribuido_Por'] || h['Atribuído Por'] || h['Quem_Atribuiu'] || '',
                    status: h['Status'] || '',
                    dataFinalizacao: h['Data_Finalizacao'] || '',
                    finalizadoPor: h['Finalizado_Por'] || ''
                }));

                if(btnSync) btnSync.innerText = userName;
                if (recarregarTelas) {
                    if(document.getElementById("adminPage")) window.atualizarDashboardsADM();
                    if(document.getElementById("educadorPage")) window.atualizarDashboardEducador();
                }
            }
        }).catch(err => { console.error(err); if(btnSync) btnSync.innerText = "Erro de Conexão"; });
    }

    const loginForm = document.getElementById("loginForm");
    if(loginForm) {
        const loginOptions = loginForm.querySelector('.custom-options');
        const loginWrapper = loginForm.querySelector('.custom-select-wrapper');
        if (loginOptions && loginWrapper) {
            fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'sincronizar_dados' }) })
            .then(res => res.json())
            .then(data => {
                if (!data.success || !Array.isArray(data.educadores)) return;
                loginOptions.innerHTML = data.educadores
                    .filter(e => e['Nome'])
                    .map(e => `<span class="custom-option" data-value="${escaparHTML(e['Nome'])}">${escaparHTML(e['Nome'])}</span>`)
                    .join('') || loginOptions.innerHTML;
                ativarEventosSelectCustomizado(loginWrapper);
            })
            .catch(() => console.warn('Não foi possível atualizar a lista de login. Mantendo lista local.'));
        }

        loginForm.addEventListener("submit", (e) => {
            e.preventDefault(); 
            const educadorInput = document.getElementById('educadorSelect') || document.querySelector('input[type="hidden"]');
            const educador = educadorInput ? educadorInput.value : null;
            const senha = document.getElementById("senhaInput").value;
            if(!educador || senha.length !== 6) return window.abrirModalErro("Selecione seu nome e digite 6 números.");
            const btn = document.querySelector(".btn-primary");
            btn.innerText = "Conectando..."; btn.disabled = true;
            fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'login', educador: educador, senha: senha }) })
            .then(res => res.json()).then(data => {
                if (data.success) { 
                    localStorage.setItem('usuarioLogado', educador);
                    localStorage.setItem('nivelAcesso', data.nivelAcesso || '');
                    window.registrarLog("Login", "Acessou o sistema com sucesso.");
                    window.location.href = (data.nivelAcesso === "ADM") ? "admin.html" : "educador.html"; 
                } else { btn.innerText = "Acessar Sistema"; btn.disabled = false; window.abrirModalErro(data.message); }
            }).catch(() => { btn.disabled = false; btn.innerText = "Acessar Sistema"; window.abrirModalErro("Erro de rede."); });
        });
    }

    function calcularRecompensas(qtdVendidos) {
        let fone = qtdVendidos >= 10 ? 1 : 0;
        let cartelas = qtdVendidos >= 5 ? 1 + Math.floor((qtdVendidos - 5) / 5) : 0;
        return { fone, cartelas };
    }

    function normalizarCodigoLote(valor) {
        return String(valor || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
    }

    function ehVendaDireta(pessoa) {
        const turma = normalizarCodigoLote(pessoa?.turma || '');
        const curso = normalizarCodigoLote(pessoa?.curso || '');
        const tipo = normalizarCodigoLote(pessoa?.tipo || pessoa?.tipoOperacao || '');
        return turma === 'EQUIPE' || turma === 'VENDA DIRETA' || curso === 'VENDA DIRETA' || tipo === 'EQUIPE' || tipo === 'VENDA DIRETA';
    }

    function tipoPessoaVisual(pessoa, fallback = 'Educando') {
        if (!pessoa) return fallback;
        if (ehVendaDireta(pessoa)) return 'Venda Direta';
        if (pessoa.tipo === 'Parceiro' || pessoa.turma === 'Parceiro') return 'Parceiro';
        return fallback;
    }

    function obterPerfilVendaDiretaAtual() {
        return window.todosEducandosBD.find(p => textoIgual(p.nome, userName) && ehVendaDireta(p));
    }

    function coletarLotesUsadosGlobalmente(opcoes = {}) {
        const usados = new Set();
        const ignorarPendentesVendaDireta = !!opcoes.ignorarPendentesVendaDireta;

        (window.todosEducandosBD || []).forEach(p => {
            const vendaDireta = ehVendaDireta(p);
            if (!vendaDireta || !ignorarPendentesVendaDireta) {
                (p.lotesPendentes || []).forEach(l => usados.add(normalizarCodigoLote(l)));
            }
            (p.lotesVendidos || []).forEach(l => usados.add(normalizarCodigoLote(l)));
        });

        (window.todosParceirosBD || []).forEach(p => {
            (p.lotesPendentes || []).forEach(l => usados.add(normalizarCodigoLote(l)));
            (p.lotesVendidos || []).forEach(l => usados.add(normalizarCodigoLote(l)));
        });
        return usados;
    }

    function coletarLotesDisponiveisVendaDireta() {
        // Venda Direta pode consultar todos os lotes livres, devolvidos e também os lotes
        // já separados para Venda Direta. Esses lotes só ficam válidos após confirmação da venda.
        const usados = coletarLotesUsadosGlobalmente({ ignorarPendentesVendaDireta: true });
        const mapa = new Map();

        (window.todosEducandosBD || []).forEach(pessoa => {
            if (!ehVendaDireta(pessoa)) return;
            (pessoa.lotesPendentes || []).forEach(lote => {
                const chave = normalizarCodigoLote(lote);
                if (!chave || usados.has(chave)) return;
                if (!mapa.has(chave)) {
                    mapa.set(chave, { lote, origem: 'Atribuído à Venda Direta', responsavel: pessoa.nome || 'Vendedor direto', detalhe: pessoa.nome || 'Vendedor direto' });
                }
            });
        });

        (window.todosEducandosBD || []).forEach(pessoa => {
            if (ehVendaDireta(pessoa)) return;
            (pessoa.lotesDevolvidos || []).forEach(lote => {
                const chave = normalizarCodigoLote(lote);
                if (!chave || usados.has(chave)) return;
                if (!mapa.has(chave)) {
                    mapa.set(chave, { lote, origem: 'Devolvido', responsavel: pessoa.educadorResponsavel || 'Educador não informado', detalhe: `${pessoa.nome} • ${pessoa.curso || '-'} • ${pessoa.turma || '-'}` });
                }
            });
        });

        (window.lotesSedeBD || []).forEach(item => {
            const chave = normalizarCodigoLote(item.codigo);
            if (!chave || usados.has(chave)) return;
            if (!mapa.has(chave)) {
                mapa.set(chave, { lote: item.codigo, origem: item.educador ? 'Estoque com responsável' : 'Estoque/Sede', responsavel: item.educador || 'Sede', detalhe: item.educador || 'Disponível na base da sede' });
            }
        });

        return Array.from(mapa.values()).sort((a, b) => normalizarCodigoLote(a.lote).localeCompare(normalizarCodigoLote(b.lote), 'pt-BR'));
    }

    function lotesDisponiveisVendaDiretaFiltrados(termo = '', limite = 50) {
        const busca = normalizarCodigoLote(termo);
        return coletarLotesDisponiveisVendaDireta()
            .filter(item => !busca || normalizarCodigoLote(item.lote).includes(busca) || normalizarCodigoLote(item.origem).includes(busca) || normalizarCodigoLote(item.responsavel || '').includes(busca) || normalizarCodigoLote(item.detalhe || '').includes(busca))
            .slice(0, limite);
    }

    function renderLotesDisponiveisCompacto(itens, modo = 'consulta') {
        if (!itens.length) return '<div class="validador-help">Nenhum lote disponível encontrado com esse filtro.</div>';
        return itens.map(item => {
            const acao = modo === 'venda'
                ? `onclick="prepararVendaDireta('${escaparHTML(item.lote)}')"`
                : `onclick="selecionarLoteDisponivelVendaDireta('${escaparHTML(item.lote)}')"`;
            return `
                <button type="button" class="lote-consulta-card" ${acao}>
                    <strong>${escaparHTML(item.lote)}</strong>
                    <span>${escaparHTML(item.origem)}</span>
                    <small>Responsável: ${escaparHTML(item.responsavel || item.detalhe || '-')}</small>
                </button>
            `;
        }).join('');
    }

    function escaparHTML(valor) {
        return String(valor ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
    }

    function escaparCSV(valor) {
        const texto = String(valor ?? '').replace(/"/g, '""');
        return `"${texto}"`;
    }

    function baixarCSVExcel(nomeArquivo, linhas) {
        if (!linhas.length) return window.abrirModalErro("Não há pendências para exportar.");
        const cabecalhos = ["Nome", "Curso", "Turma", "Lote pendente", "Data de retirada", "Quem atribuiu o lote"];
        const csv = [cabecalhos, ...linhas.map(l => [l.nome, l.curso, l.turma, l.lote, l.dataRetirada, l.quemAtribuiu])]
            .map(row => row.map(escaparCSV).join(';')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = nomeArquivo;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }


    function valorTransacao(tx) {
        return parseFloat(tx?.['Valor']) || parseFloat(tx?.['Valor_Total']) || parseFloat(tx?.['Valor Recebido']) || parseFloat(tx?.['Valor(R$)']) || 0;
    }

    function metodoTransacao(tx) {
        return String(tx?.['Metodo_Pagamento'] || tx?.['Método de Pagamento'] || tx?.['Método'] || tx?.['Metodo'] || tx?.['Forma_Pagamento'] || tx?.['Forma de Pagamento'] || '').toUpperCase();
    }

    function statusConferenciaVD(tx) {
        return String(tx?.['Status_Conferencia'] || tx?.['Status Conferencia'] || tx?.['Status'] || 'Pendente').trim().toLowerCase();
    }

    function isCaixaVendaDiretaPendente(tx) {
        const st = statusConferenciaVD(tx);
        return !st || st === 'pendente' || st === 'pendente_conferencia' || st === 'a conferir' || st === 'aguardando conferencia' || st === 'aguardando conferência';
    }

    function isCaixaVendaDiretaConferido(tx) {
        const st = statusConferenciaVD(tx);
        return st === 'conferido' || st === 'consolidado' || st === 'validado' || st === 'lançado no caixa oficial' || st === 'lancado no caixa oficial';
    }

    function idTransacao(tx) {
        return tx?.['ID_Transacao'] || tx?.['ID Transação'] || tx?.['ID Transacao'] || tx?.['ID'] || tx?.['Id'] || '';
    }

    function vendedorTransacaoVD(tx) {
        return tx?.['Vendedor'] || tx?.['Educando'] || tx?.['Aluno'] || tx?.['Nome'] || tx?.['Responsavel'] || '-';
    }

    function dataTransacao(tx) {
        return tx?.['Data/Hora'] || tx?.['Data_Hora'] || tx?.['Data Hora'] || tx?.['Data'] || tx?.['Carimbo de data/hora'] || '-';
    }

    function resumirCaixaVendaDireta(filtroVendedor = null) {
        const linhas = (window.caixaVendaDiretaBD || []).filter(tx => !filtroVendedor || textoIgual(vendedorTransacaoVD(tx), filtroVendedor));
        const resumo = { pixPendente: 0, dinheiroPendente: 0, totalPendente: 0, pixConferido: 0, dinheiroConferido: 0, totalConferido: 0, qtdPendente: 0, qtdConferido: 0, linhas };
        linhas.forEach(tx => {
            const valor = valorTransacao(tx);
            const metodo = metodoTransacao(tx);
            const pendente = isCaixaVendaDiretaPendente(tx);
            const conferido = isCaixaVendaDiretaConferido(tx);
            if (pendente) {
                resumo.qtdPendente += 1;
                if (metodo.includes('PIX')) resumo.pixPendente += valor;
                else resumo.dinheiroPendente += valor;
                resumo.totalPendente += valor;
            } else if (conferido) {
                resumo.qtdConferido += 1;
                if (metodo.includes('PIX')) resumo.pixConferido += valor;
                else resumo.dinheiroConferido += valor;
                resumo.totalConferido += valor;
            }
        });
        return resumo;
    }

    function moedaBR(valor) {
        return `R$ ${(Number(valor) || 0).toFixed(2).replace('.', ',')}`;
    }

    function encontrarHistoricoPendente(nome, lote, tipo = 'Educando') {
        const loteNorm = normalizarCodigoLote(lote);
        const nomeNorm = String(nome || '').trim().toLowerCase();
        const tipoNorm = String(tipo || 'Educando').trim().toLowerCase();
        return [...window.historicoLotesBD].reverse().find(h => {
            return normalizarCodigoLote(h.lote) === loteNorm &&
                   String(h.nome || '').trim().toLowerCase() === nomeNorm &&
                   String(h.tipo || 'Educando').trim().toLowerCase() === tipoNorm &&
                   String(h.status || '').trim().toLowerCase() === 'pendente';
        });
    }

    function montarPendenciasLotes(escopo = 'admin') {
        let base = window.todosEducandosBD.filter(pessoa => !ehVendaDireta(pessoa) && pessoa.lotesPendentes.length > 0);
        if (escopo === 'educador') base = base.filter(pessoa => textoIgual(pessoa.educadorResponsavel, userName));

        return base.flatMap(pessoa => pessoa.lotesPendentes.map(lote => {
            const hist = encontrarHistoricoPendente(pessoa.nome, lote, 'Educando');
            return {
                nome: pessoa.nome,
                curso: pessoa.curso || '-',
                turma: pessoa.turma || '-',
                lote,
                dataRetirada: hist?.dataRetirada || 'Anterior à atualização',
                quemAtribuiu: hist?.atribuidoPor || pessoa.educadorResponsavel || 'Não registrado'
            };
        })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    }

    function renderTabelaPendentes(containerId, pagId, pageKey, linhas, renderFunc) {
        const tabela = document.getElementById(containerId);
        if (!tabela) return;
        const startIdx = (window.pages[pageKey].current - 1) * 10;
        const paginated = linhas.slice(startIdx, startIdx + 10);
        tabela.innerHTML = paginated.map(item => `
            <tr>
                <td><strong>${escaparHTML(item.nome)}</strong></td>
                <td>${escaparHTML(item.curso)}</td>
                <td>${escaparHTML(item.turma)}</td>
                <td class="td-center"><span class="badge-lote badge-lote-pendente">${escaparHTML(item.lote)}</span></td>
                <td>${escaparHTML(item.dataRetirada)}</td>
                <td>${escaparHTML(item.quemAtribuiu)}</td>
            </tr>
        `).join('') || `<tr><td colspan="6" class="text-center" style="padding: 2rem; color:#a0a0a0;">Nenhum lote pendente encontrado.</td></tr>`;
        renderPaginationUI(pagId, pageKey, linhas.length, 10, renderFunc);
    }

    window.renderPendentesAdminPaginado = function() {
        let linhas = montarPendenciasLotes('admin');
        if (window.pages.pendentesAdm.term) {
            const term = window.pages.pendentesAdm.term.toLowerCase();
            linhas = linhas.filter(item => `${item.nome} ${item.curso} ${item.turma} ${item.lote} ${item.quemAtribuiu}`.toLowerCase().includes(term));
        }
        const total = document.getElementById('totalPendentesADM');
        if (total) total.innerText = linhas.length;
        renderTabelaPendentes('tabelaPendentesADM', 'pagPendentesADM', 'pendentesAdm', linhas, 'renderPendentesAdminPaginado');
    }

    window.renderPendentesEducadorPaginado = function() {
        let linhas = montarPendenciasLotes('educador');
        if (window.pages.pendentesEdu.term) {
            const term = window.pages.pendentesEdu.term.toLowerCase();
            linhas = linhas.filter(item => `${item.nome} ${item.curso} ${item.turma} ${item.lote}`.toLowerCase().includes(term));
        }
        const total = document.getElementById('totalPendentesEducador');
        if (total) total.innerText = linhas.length;
        renderTabelaPendentes('tabelaPendentesEducador', 'pagPendentesEducador', 'pendentesEdu', linhas, 'renderPendentesEducadorPaginado');
    }

    window.exportarPendentesAdmin = function() {
        const linhas = montarPendenciasLotes('admin');
        if (!linhas.length) return baixarCSVExcel('', linhas);
        const data = new Date().toISOString().slice(0, 10);
        baixarCSVExcel(`pendentes_lotes_admin_${data}.csv`, linhas);
        window.registrarLog("Exportação Pendentes", `Exportou ${linhas.length} lote(s) pendente(s) do painel administrativo.`);
    }

    window.exportarPendentesEducador = function() {
        const linhas = montarPendenciasLotes('educador');
        if (!linhas.length) return baixarCSVExcel('', linhas);
        const data = new Date().toISOString().slice(0, 10);
        baixarCSVExcel(`pendentes_lotes_${userName.replace(/\s+/g, '_')}_${data}.csv`, linhas);
        window.registrarLog("Exportação Pendentes", `Exportou ${linhas.length} lote(s) pendente(s) do educador ${userName}.`);
    }

    function buscarCartelaNoSistema(codigoDigitado) {
        const codigo = normalizarCodigoLote(codigoDigitado);
        if (!codigo) return null;

        const pessoasBase = [
            ...window.todosEducandosBD.map(p => ({ ...p, tipo: tipoPessoaVisual(p) })),
            ...window.todosParceirosBD.map(p => ({ ...p, tipo: 'Parceiro' }))
        ];

        const vendedoresDiretos = pessoasBase.filter(ehVendaDireta);
        for (const pessoa of vendedoresDiretos) {
            if ((pessoa.lotesVendidos || []).some(l => normalizarCodigoLote(l) === codigo)) {
                return { status: 'VÁLIDO VENDA DIRETA', tipoAlerta: 'success', pessoa, lote: codigo, motivo: 'Venda direta confirmada no sistema. Esta cartela está válida para o bingo.' };
            }
        }

        for (const pessoa of vendedoresDiretos) {
            if ((pessoa.lotesPendentes || []).some(l => normalizarCodigoLote(l) === codigo)) {
                return { status: 'AGUARDANDO VENDA DIRETA', tipoAlerta: 'warning', pessoa, lote: codigo, motivo: 'Este lote foi separado para Venda Direta, mas ainda não teve venda confirmada. Portanto ainda não é válido para o bingo.' };
            }
        }

        const pessoas = pessoasBase.filter(p => !ehVendaDireta(p));
        for (const pessoa of pessoas) {
            if ((pessoa.lotesPendentes || []).some(l => normalizarCodigoLote(l) === codigo)) {
                return { status: 'VETADA', tipoAlerta: 'danger', pessoa, lote: codigo, motivo: 'A cartela/lote ainda está como PENDENTE. Não consta venda confirmada nem devolução no sistema.' };
            }
            if ((pessoa.lotesVendidos || []).some(l => normalizarCodigoLote(l) === codigo)) {
                return { status: 'VÁLIDA', tipoAlerta: 'success', pessoa, lote: codigo, motivo: 'Venda confirmada no sistema.' };
            }
            if ((pessoa.lotesDevolvidos || []).some(l => normalizarCodigoLote(l) === codigo)) {
                return { status: 'NÃO VÁLIDA', tipoAlerta: 'warning', pessoa, lote: codigo, motivo: 'A cartela/lote foi devolvida. Só ficará válida se um vendedor direto confirmar a venda.' };
            }
        }

        const loteSede = window.lotesSedeBD.find(l => normalizarCodigoLote(l.codigo) === codigo);
        if (loteSede) return { status: 'NÃO VÁLIDA', tipoAlerta: 'warning', pessoa: null, lote: codigo, motivo: loteSede.educador ? `Lote está com ${loteSede.educador}, mas sem venda confirmada.` : 'Lote está na Sede, sem venda confirmada.' };
        return { status: 'NÃO ENCONTRADA', tipoAlerta: 'danger', pessoa: null, lote: codigo, motivo: 'Não localizei essa cartela/lote nas bases carregadas. Confira a numeração antes de validar.' };
    }

    function montarDetalhesResultadoValidador(resultado) {
        const pessoa = resultado.pessoa || {};
        const nome = pessoa.nome || (resultado.tipoAlerta === 'danger' ? 'Cartela não localizada' : 'Lote sem educando vinculado');
        const curso = pessoa.curso || '-';
        const turma = pessoa.turma || pessoa.tipo || '-';
        const foto = pessoa.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(nome)}&background=BC68A1&color=fff`;
        const statusClasse = resultado.status.startsWith('VÁLID') ? 'valido' : (resultado.status === 'VETADA' || resultado.status.includes('PENDENTE') || resultado.status.includes('AGUARDANDO') ? 'pendente' : 'invalido');
        const statusTexto = resultado.status === 'VETADA' ? 'PENDENTE' : resultado.status;
        const tipoPessoa = pessoa.tipo || tipoPessoaVisual(pessoa, pessoa.nome ? 'Educando' : 'Lote');

        return `
            <div class="validador-card-horizontal ${resultado.tipoAlerta} status-${statusClasse}">
                <div class="validador-card-photo-wrap">
                    <img src="${escaparHTML(foto)}" alt="Foto de ${escaparHTML(nome)}" class="validador-card-photo" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(nome)}&background=BC68A1&color=fff'">
                </div>
                <div class="validador-card-main">
                    <div class="validador-card-titleline">
                        <span class="validador-card-lote">${escaparHTML(resultado.lote)}</span>
                        <span class="validador-card-separator">—</span>
                        <span class="validador-status-label ${statusClasse}">${escaparHTML(statusTexto)}</span>
                    </div>
                    <div class="validador-card-info-list">
                        <p><strong>Nome:</strong> ${escaparHTML(nome)}</p>
                        <p><strong>Curso:</strong> ${escaparHTML(curso)}</p>
                        <p><strong>Turma:</strong> ${escaparHTML(turma)}</p>
                        <p><strong>Origem:</strong> ${escaparHTML(tipoPessoa)}</p>
                    </div>
                    <p class="validador-card-motivo">${escaparHTML(resultado.motivo)}</p>
                </div>
            </div>
        `;
    }

    function coletarLotesParaValidador() {
        const pessoas = [
            ...window.todosEducandosBD.map(p => ({ ...p, tipo: tipoPessoaVisual(p) })),
            ...window.todosParceirosBD.map(p => ({ ...p, tipo: 'Parceiro' }))
        ];

        const itens = [];
        pessoas.forEach(pessoa => {
            if (ehVendaDireta(pessoa)) {
                (pessoa.lotesVendidos || []).forEach(lote => itens.push({ lote, status: 'VÁLIDO VENDA DIRETA', classe: 'success', pessoa }));
                return;
            }
            (pessoa.lotesPendentes || []).forEach(lote => itens.push({ lote, status: 'PENDENTE / VETADA', classe: 'danger', pessoa }));
            (pessoa.lotesVendidos || []).forEach(lote => itens.push({ lote, status: 'VENDIDA / VÁLIDA', classe: 'success', pessoa }));
            (pessoa.lotesDevolvidos || []).forEach(lote => itens.push({ lote, status: 'DEVOLVIDA / VENDA DIRETA DISPONÍVEL', classe: 'warning', pessoa }));
        });

        (window.lotesSedeBD || []).forEach(item => {
            itens.push({ lote: item.codigo, status: item.educador ? `COM ${item.educador} / NÃO VENDIDA` : 'SEDE / NÃO VENDIDA', classe: 'warning', pessoa: null });
        });

        const mapa = new Map();
        itens.forEach(item => {
            const chave = normalizarCodigoLote(item.lote);
            if (!chave) return;
            const atual = mapa.get(chave);
            if (!atual || item.status.includes('VÁLID')) mapa.set(chave, item);
        });
        return Array.from(mapa.values()).sort((a, b) => normalizarCodigoLote(a.lote).localeCompare(normalizarCodigoLote(b.lote), 'pt-BR'));
    }

    function renderSugestoesValidador(inputId, resultId, termo) {
        const codigo = normalizarCodigoLote(termo);
        const itens = coletarLotesParaValidador();
        const exato = itens.find(item => normalizarCodigoLote(item.lote) === codigo);
        if (exato) return montarDetalhesResultadoValidador(buscarCartelaNoSistema(exato.lote));

        const sugestoes = itens.filter(item => normalizarCodigoLote(item.lote).includes(codigo)).slice(0, 8);
        if (!sugestoes.length) {
            return `
                <div class="validador-result danger">
                    <div class="validador-status">NÃO ENCONTRADA</div>
                    <div class="validador-lote">${escaparHTML(termo)}</div>
                    <p>Nenhum lote parecido foi localizado na base carregada. Confira a numeração digitada.</p>
                </div>
            `;
        }

        return `
            <div class="validador-sugestoes">
                <div class="validador-sugestoes-title">Lotes encontrados enquanto você digita:</div>
                ${sugestoes.map(item => `
                    <button type="button" class="validador-sugestao-btn js-validador-sugestao" data-input-id="${escaparHTML(inputId)}" data-result-id="${escaparHTML(resultId)}" data-lote="${escaparHTML(item.lote)}">
                        <span class="sugestao-lote">${escaparHTML(item.lote)}</span>
                        <span class="sugestao-status ${item.classe}">${escaparHTML(item.status)}</span>
                        ${item.pessoa ? `<small>${escaparHTML(item.pessoa.nome)} • ${escaparHTML(item.pessoa.turma || item.pessoa.tipo || '-')}</small>` : '<small>Lote sem educando vinculado</small>'}
                    </button>
                `).join('')}
            </div>
        `;
    }

    window.validarCartelaPendente = function(inputId, resultId) {
        const input = document.getElementById(inputId);
        const result = document.getElementById(resultId);
        if (!input || !result) return;
        const codigo = input.value.trim();
        if (!codigo) return window.abrirModalErro('Digite o número da cartela/lote para validar.');

        const resultado = buscarCartelaNoSistema(codigo);
        if (!resultado) return;
        result.innerHTML = montarDetalhesResultadoValidador(resultado);
        window.registrarLog("Validador de Cartela", `Consultou ${resultado.lote}: ${resultado.status}`);
    }

    window.buscarValidadorCartelaAutomatico = function(inputId, resultId) {
        const input = document.getElementById(inputId);
        const result = document.getElementById(resultId);
        if (!input || !result) return;

        if (!window.__validadorTimers) window.__validadorTimers = {};
        clearTimeout(window.__validadorTimers[inputId]);

        window.__validadorTimers[inputId] = setTimeout(() => {
            const termo = input.value.trim();
            if (!termo) {
                result.innerHTML = '';
                return;
            }
            if (termo.length < 2) {
                result.innerHTML = `<div class="validador-help">Digite pelo menos 2 caracteres para buscar automaticamente.</div>`;
                return;
            }
            result.innerHTML = renderSugestoesValidador(inputId, resultId, termo);
        }, 180);
    }

    window.preencherValidadorCartela = function(inputId, resultId, lote) {
        const input = document.getElementById(inputId);
        if (input) input.value = lote;
        window.validarCartelaPendente(inputId, resultId);
    }

    window.limparValidadorCartela = function(inputId, resultId) {
        const input = document.getElementById(inputId);
        const result = document.getElementById(resultId);
        if (input) input.value = '';
        if (result) result.innerHTML = '';
        if (input) input.focus();
    }

    function validarDisponibilidadeVendaDireta(lote) {
        const codigo = normalizarCodigoLote(lote);
        if (!codigo) return { ok: false, message: 'Digite o número do lote vendido.' };
        const consulta = buscarCartelaNoSistema(codigo);
        if (!consulta) return { ok: false, message: 'Não foi possível consultar este lote.' };
        if (consulta.status === 'VETADA') return { ok: false, message: `Este lote está pendente com ${consulta.pessoa?.nome || 'um educando'} e não pode ser vendido pela Venda Direta.` };
        if (consulta.status.startsWith('VÁLID')) return { ok: false, message: 'Este lote já está vendido/validado no sistema.' };
        if (consulta.status === 'NÃO ENCONTRADA') return { ok: false, message: 'Lote não encontrado na base carregada.' };
        return { ok: true, consulta };
    }

    window.renderVendaDiretaPainel = function() {
        const perfil = obterPerfilVendaDiretaAtual();
        const elementosVendaDireta = document.querySelectorAll('.js-venda-direta-only:not(section)');
        elementosVendaDireta.forEach(el => { el.style.display = perfil ? '' : 'none'; });
        if (!perfil) return;

        const disponiveis = coletarLotesDisponiveisVendaDireta();
        const vendidos = perfil.lotesVendidos || [];
        const resumoVD = resumirCaixaVendaDireta(perfil.nome);
        const kpiDisp = document.getElementById('kpiVendaDiretaDisponiveis');
        const kpiVend = document.getElementById('kpiVendaDiretaVendidos');
        const kpiValor = document.getElementById('kpiVendaDiretaValor');
        const kpiPix = document.getElementById('kpiVendaDiretaPix');
        const kpiDin = document.getElementById('kpiVendaDiretaDinheiro');
        const kpiConferencia = document.getElementById('kpiVendaDiretaConferencia');
        const lista = document.getElementById('listaLotesVendaDireta');
        if (kpiDisp) kpiDisp.innerText = disponiveis.length;
        if (kpiVend) kpiVend.innerText = vendidos.length;
        if (kpiValor) kpiValor.innerText = moedaBR(resumoVD.totalPendente + resumoVD.totalConferido || vendidos.length * 20);
        if (kpiPix) kpiPix.innerText = moedaBR(resumoVD.pixPendente);
        if (kpiDin) kpiDin.innerText = moedaBR(resumoVD.dinheiroPendente);
        if (kpiConferencia) kpiConferencia.innerText = `${resumoVD.qtdPendente} lançamento(s)`;

        if (lista) {
            lista.innerHTML = disponiveis.slice(0, 80).map(item => `
                <button type="button" class="venda-direta-lote-btn" onclick="prepararVendaDireta('${escaparHTML(item.lote)}')">
                    <strong>${escaparHTML(item.lote)}</strong>
                    <span>${escaparHTML(item.origem)}</span>
                    <small>Responsável: ${escaparHTML(item.responsavel || item.detalhe || '-')}</small>
                </button>
            `).join('') || '<div class="validador-help">Nenhum lote disponível para venda direta no momento.</div>';
        }
        window.consultarDisponiveisVendaDireta('inputConsultaDisponiveisVendaDireta', 'resultadoConsultaDisponiveisVendaDireta');
    }

    window.buscarLotesVendaDireta = function() {
        const input = document.getElementById('inputBuscaVendaDireta');
        const result = document.getElementById('resultadoBuscaVendaDireta');
        if (!input || !result) return;
        const termo = normalizarCodigoLote(input.value);
        if (!termo || termo.length < 2) {
            result.innerHTML = '<div class="validador-help">Digite pelo menos 2 caracteres do lote vendido para buscar.</div>';
            return;
        }
        const itens = lotesDisponiveisVendaDiretaFiltrados(termo, 10);
        result.innerHTML = itens.map(item => `
            <button type="button" class="validador-sugestao-btn" onclick="prepararVendaDireta('${escaparHTML(item.lote)}')">
                <span class="sugestao-lote">${escaparHTML(item.lote)}</span>
                <span class="sugestao-status success">DISPONÍVEL PARA VENDA DIRETA</span>
                <small>${escaparHTML(item.origem)} • Responsável: ${escaparHTML(item.responsavel || item.detalhe || '-')}</small>
            </button>
        `).join('') || '<div class="validador-result danger"><div class="validador-status">NÃO DISPONÍVEL</div><p>Este lote não está disponível para Venda Direta ou já foi vendido/pendente.</p></div>';
    }

    window.consultarDisponiveisVendaDireta = function(inputId = 'inputConsultaDisponiveisVendaDireta', resultId = 'resultadoConsultaDisponiveisVendaDireta') {
        const input = document.getElementById(inputId);
        const result = document.getElementById(resultId);
        if (!result) return;
        const termo = input ? input.value : '';
        const itens = lotesDisponiveisVendaDiretaFiltrados(termo, 80);
        result.innerHTML = `
            <div class="consulta-lotes-resumo">
                <strong>${itens.length}</strong> lote(s) disponível(is) ${termo ? 'para o filtro informado' : 'para Venda Direta'}
            </div>
            <div class="consulta-lotes-grid">${renderLotesDisponiveisCompacto(itens, 'venda')}</div>
        `;
    }

    window.selecionarLoteDisponivelVendaDireta = function(lote) {
        const manual = document.getElementById('inputLotesVendaDiretaManual');
        if (manual) {
            const atuais = manual.value.split(/[\n,;]+/).map(v => v.trim()).filter(Boolean);
            if (!atuais.some(v => normalizarCodigoLote(v) === normalizarCodigoLote(lote))) atuais.push(lote);
            manual.value = atuais.join(', ');
        }
        const buscaVenda = document.getElementById('inputBuscaVendaDireta');
        if (buscaVenda && document.getElementById('educadorPage')) {
            buscaVenda.value = lote;
            window.buscarLotesVendaDireta();
        }
    }

    window.renderListaAtribuicaoVendaDireta = function() {
        const lista = document.getElementById('listaLotesEquipeCheckboxes');
        const input = document.getElementById('inputConsultaLotesVendaDiretaAdmin');
        const resumo = document.getElementById('resumoLotesVendaDiretaAdmin');
        if (!lista) return;
        const termo = input ? input.value : '';
        const itens = lotesDisponiveisVendaDiretaFiltrados(termo, 250);
        if (resumo) resumo.innerHTML = `<strong>${itens.length}</strong> lote(s) encontrado(s). Todos os vendedores diretos podem consultar os lotes disponíveis; esta atribuição é para controle/retirada operacional.`;
        lista.innerHTML = itens.map(item => `
            <label class="checkbox-item-row venda-direta-checkbox-row">
                <input type="checkbox" class="roxo-checkbox" value="${escaparHTML(item.lote)}">
                <span style="font-weight: 700; color: var(--dim-grey);">${escaparHTML(item.lote)}</span>
                <span style="margin-left:auto; font-size:0.78rem; color:var(--petal-pink); text-align:right;">${escaparHTML(item.origem)}<br><small style="color:#777;">Responsável: ${escaparHTML(item.responsavel || item.detalhe || '-')}</small></span>
            </label>
        `).join('') || '<div style="padding:15px; text-align:center; color:#a0a0a0;">Nenhum lote disponível para Venda Direta.</div>';
    }


    function coletarLotesEstoqueDetalhado() {
        return coletarLotesDisponiveisVendaDireta().map(item => {
            const origemNorm = normalizarCodigoLote(item.origem);
            let status = 'Disponível';
            let classe = 'sede';
            if (origemNorm.includes('DEVOLVIDO')) { status = 'Devolvido disponível'; classe = 'devolvido'; }
            else if (origemNorm.includes('VENDA DIRETA') || origemNorm.includes('ATRIBUIDO') || origemNorm.includes('ATRIBUÍDO')) { status = 'Separado Venda Direta'; classe = 'venda-direta'; }
            else if (origemNorm.includes('RESPONSAVEL')) { status = 'Estoque com responsável'; classe = 'responsavel'; }
            else { status = 'Estoque/Sede'; classe = 'sede'; }
            return { ...item, status, classe };
        });
    }

    function preencherSelectEducadoresEstoqueLotes() {
        const input = document.getElementById('filtroEducadorEstoqueLotes');
        const wrapper = document.getElementById('wrapperFiltroEducadorEstoqueLotes');
        const optionsBox = document.getElementById('opcoesFiltroEducadorEstoqueLotes');
        if (!input || !wrapper || !optionsBox) return;

        const valorAtual = String(window.pages.estoqueLotes?.educador || input.value || '').trim();
        const nomes = new Set();
        (window.mockEducadoresBD || []).forEach(ed => {
            const nome = String(ed.nome || '').trim();
            if (nome) nomes.add(nome);
        });
        coletarLotesEstoqueDetalhado().forEach(item => {
            const nome = String(item.responsavel || '').trim();
            if (nome && !textoIgual(nome, 'Sede') && !textoIgual(nome, 'Educador não informado')) nomes.add(nome);
        });
        const ordenados = Array.from(nomes).sort((a, b) => a.localeCompare(b, 'pt-BR'));
        const selecionado = valorAtual && ordenados.some(nome => textoIgual(nome, valorAtual)) ? ordenados.find(nome => textoIgual(nome, valorAtual)) : '';
        input.value = selecionado;
        window.pages.estoqueLotes.educador = selecionado;

        const triggerText = wrapper.querySelector('.trigger-text');
        if (triggerText) {
            triggerText.textContent = selecionado || 'Todos os educadores';
            triggerText.style.color = 'var(--dim-grey)';
        }

        optionsBox.innerHTML = `<span class="custom-option ${!selecionado ? 'selected' : ''}" data-value="">Todos os educadores</span>` +
            ordenados.map(nome => `<span class="custom-option ${textoIgual(nome, selecionado) ? 'selected' : ''}" data-value="${escaparHTML(nome)}">${escaparHTML(nome)}</span>`).join('');
        ativarEventosSelectCustomizado(wrapper);
    }



    window.renderEstoqueLotesAdminPaginado = function() {
        const tabela = document.getElementById('tabelaEstoqueLotes');
        if (!tabela) return;
        const todos = coletarLotesEstoqueDetalhado();
        preencherSelectEducadoresEstoqueLotes();
        let linhas = [...todos];
        const educadorSelecionado = String(window.pages.estoqueLotes?.educador || '').trim();
        if (educadorSelecionado) {
            linhas = linhas.filter(item => textoIgual(item.responsavel || '', educadorSelecionado));
        }
        const term = String(window.pages.estoqueLotes?.term || '').trim();
        const busca = normalizarCodigoLote(term);
        if (busca) {
            linhas = linhas.filter(item =>
                normalizarCodigoLote(item.lote).includes(busca) ||
                normalizarCodigoLote(item.status).includes(busca) ||
                normalizarCodigoLote(item.origem).includes(busca) ||
                normalizarCodigoLote(item.responsavel || '').includes(busca) ||
                normalizarCodigoLote(item.detalhe || '').includes(busca)
            );
        }

        const total = document.getElementById('kpiEstoqueTotal');
        const sede = document.getElementById('kpiEstoqueSede');
        const separados = document.getElementById('kpiEstoqueSeparadosVD');
        const totalEducador = document.getElementById('kpiEstoqueTotalEducador');
        const tituloEducador = document.getElementById('kpiEstoqueTituloEducador');
        if (total) total.innerText = todos.length;
        if (sede) sede.innerText = todos.filter(i => i.classe === 'sede' || i.classe === 'responsavel').length;
        if (separados) separados.innerText = todos.filter(i => i.classe === 'venda-direta').length;
        if (totalEducador) totalEducador.innerText = linhas.length;
        if (tituloEducador) {
            if (educadorSelecionado && busca) tituloEducador.innerText = 'Resultado filtrado';
            else if (educadorSelecionado) tituloEducador.innerText = 'Total do educador';
            else if (busca) tituloEducador.innerText = 'Total da busca';
            else tituloEducador.innerText = 'Total disponível';
        }

        const startIdx = (window.pages.estoqueLotes.current - 1) * 12;
        const paginated = linhas.slice(startIdx, startIdx + 12);
        tabela.innerHTML = paginated.map(item => `
            <tr>
                <td><span class="badge-lote estoque-lote-badge">${escaparHTML(item.lote)}</span></td>
                <td><span class="estoque-status-pill ${escaparHTML(item.classe)}">${escaparHTML(item.status)}</span></td>
                <td><strong>${escaparHTML(item.origem)}</strong></td>
                <td><strong style="color:var(--dim-grey);">${escaparHTML(item.responsavel || '-')}</strong></td>
                <td class="td-center">
                    <button type="button" class="icon-action-btn active-thumb" title="Separar este lote para Venda Direta" onclick="abrirModal('modalAtribuirLoteEquipe'); selecionarLoteDisponivelVendaDireta('${escaparHTML(item.lote)}'); if(window.renderListaAtribuicaoVendaDireta) window.renderListaAtribuicaoVendaDireta();">
                        <span class="material-symbols-outlined">add_task</span>
                    </button>
                </td>
            </tr>
        `).join('') || `<tr><td colspan="5" class="text-center" style="padding: 2rem; color:#a0a0a0;">Nenhum lote em estoque encontrado.</td></tr>`;

        renderPaginationUI('pagEstoqueLotes', 'estoqueLotes', linhas.length, 12, 'renderEstoqueLotesAdminPaginado');
    }

    function obterLotesDigitadosManual(inputId) {
        const el = document.getElementById(inputId);
        if (!el) return [];
        return el.value.split(/[\n,;]+/).map(v => v.trim()).filter(Boolean);
    }

    window.prepararVendaDireta = function(lote) {
        const perfil = obterPerfilVendaDiretaAtual();
        if (!perfil) return window.abrirModalErro('Seu usuário não está habilitado como vendedor direto. Peça para a diretoria cadastrar você em Cadastrar Vendedor Direto.');
        const validacao = validarDisponibilidadeVendaDireta(lote);
        if (!validacao.ok) return window.abrirModalErro(validacao.message);
        const idx = window.todosEducandosBD.indexOf(perfil);
        document.getElementById('acaoLoteNome').innerText = lote;
        document.getElementById('acaoLoteAluno').innerText = perfil.nome;
        const tituloModalAcao = document.getElementById('acaoModalTitulo');
        const contextoModalAcao = document.getElementById('acaoLoteContexto');
        const notaModalAcao = document.getElementById('acaoLoteNota');
        if (tituloModalAcao) tituloModalAcao.innerText = 'Confirmar Venda Direta';
        if (contextoModalAcao) contextoModalAcao.innerText = 'Venda Direta • caixa separado';
        if (notaModalAcao) notaModalAcao.style.display = 'flex';
        document.getElementById('acaoLoteInput').value = lote;
        document.getElementById('acaoAlunoIdxInput').value = idx;
        const modal = document.getElementById('modalAcaoLote');
        if (modal) modal.setAttribute('data-tipo', 'VendaDireta');
        const btnDev = document.getElementById('btnModalDevolverLote');
        const btnVenda = document.getElementById('btnModalConfirmarVendaLote');
        if (btnDev) btnDev.style.display = 'none';
        if (btnVenda) btnVenda.innerText = 'Validar Venda Direta';
        const radioPix = document.querySelector('input[name="formaPagamentoLote"][value="PIX"]');
        if(radioPix) radioPix.checked = true;
        window.toggleMisto(false);
        const pix = document.getElementById('valorPixMisto'); if (pix) pix.value = '';
        const din = document.getElementById('valorDinMisto'); if (din) din.value = '';
        abrirModal('modalAcaoLote');
    }

    window.iniciarCorteFoto = function(event) {
        const input = event.target;
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const imgToCrop = document.getElementById('imagemParaCorte'); imgToCrop.src = e.target.result;
                window.modoEdicaoFoto = false; window.tipoCadastroFoto = 'aluno'; abrirModal('modalCorteFoto');
                if(cropperInstancia) cropperInstancia.destroy();
                cropperInstancia = new Cropper(imgToCrop, { aspectRatio: 1, viewMode: 1 });
            }
            reader.readAsDataURL(input.files[0]);
        }
        input.value = ''; 
    }

    window.iniciarCorteColaborador = function(event) {
        const input = event.target;
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const imgToCrop = document.getElementById('imagemParaCorte'); imgToCrop.src = e.target.result;
                window.modoEdicaoFoto = false; window.tipoCadastroFoto = 'colaborador'; abrirModal('modalCorteFoto');
                if(cropperInstancia) cropperInstancia.destroy();
                cropperInstancia = new Cropper(imgToCrop, { aspectRatio: 1, viewMode: 1 });
            }
            reader.readAsDataURL(input.files[0]);
        }
        input.value = ''; 
    }

    window.iniciarCorteEdicao = function(event) {
        const input = event.target;
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const imgToCrop = document.getElementById('imagemParaCorte'); imgToCrop.src = e.target.result;
                window.modoEdicaoFoto = true; abrirModal('modalCorteFoto');
                if(cropperInstancia) cropperInstancia.destroy();
                cropperInstancia = new Cropper(imgToCrop, { aspectRatio: 1, viewMode: 1 });
            }
            reader.readAsDataURL(input.files[0]);
        }
        input.value = ''; 
    }

    const btnConfirmarCorte = document.getElementById('btnConfirmarCorte');
    if(btnConfirmarCorte) {
        btnConfirmarCorte.addEventListener('click', (e) => {
            e.preventDefault();
            if(cropperInstancia) {
                if (window.modoEdicaoFoto && window.alunoEmFocoIdx !== null) {
                    btnConfirmarCorte.innerText = "Enviando para a Nuvem..."; btnConfirmarCorte.disabled = true;
                    cropperInstancia.getCroppedCanvas({ width: 300, height: 300 }).toBlob((blob) => {
                        const formData = new FormData(); 
                        formData.append('file', blob); 
                        formData.append('upload_preset', CLOUDINARY_PRESET);

                        fetch(CLOUDINARY_URL, { method: 'POST', body: formData })
                        .then(r => r.json()).then(dataImg => {
                            if(dataImg.secure_url) {
                                const urlDaFoto = dataImg.secure_url;
                                const pessoa = (window.tipoPessoaEmFoco === 'Parceiro') ? window.todosParceirosBD[window.alunoEmFocoIdx] : window.todosEducandosBD[window.alunoEmFocoIdx];
                                pessoa.foto = urlDaFoto;
                                document.getElementById('detalheFoto').src = urlDaFoto;
                                
                                if(document.getElementById("educadorPage")) window.atualizarDashboardEducador();
                                if(document.getElementById("adminPage")) window.atualizarDashboardsADM();
                                
                                fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'atualizar_foto', nomeAluno: pessoa.nome, fotoUrl: urlDaFoto }) });
                                
                                fecharModal('modalCorteFoto'); window.abrirModalSucesso("Foto atualizada com sucesso!");
                            } else { window.abrirModalErro("Erro do Cloudinary."); }
                        }).catch(() => { window.abrirModalErro("Erro de rede."); })
                        .finally(() => { btnConfirmarCorte.innerText = "Cortar e Salvar Foto"; btnConfirmarCorte.disabled = false; window.modoEdicaoFoto = false; });
                    }, 'image/jpeg');
                } else {
                    cropperInstancia.getCroppedCanvas({ width: 300, height: 300 }).toBlob((blob) => {
                        window.fotoFileGlobal = blob;
                        if(window.tipoCadastroFoto === 'colaborador') {
                            document.getElementById('previewFotoColaborador').src = URL.createObjectURL(blob);
                            document.getElementById('previewFotoColaborador').style.display = 'block';
                            document.getElementById('iconCameraColaborador').style.display = 'none';
                        } else {
                            if(document.getElementById('previewFoto')) {
                                document.getElementById('previewFoto').src = URL.createObjectURL(blob);
                                document.getElementById('previewFoto').style.display = 'block';
                                document.getElementById('iconCamera').style.display = 'none';
                            }
                        }
                        fecharModal('modalCorteFoto');
                    }, 'image/jpeg');
                }
            }
        });
    }

    // ==========================================
    // RENDERIZADORES PAGINADOS
    // ==========================================

    window.renderRankingAlunosAdm = function() {
        const tabela = document.getElementById("tabelaRankingAlunosADM"); if(!tabela) return;
        let filtrados = [...window.todosEducandosBD].filter(a => !ehVendaDireta(a)).sort((a, b) => b.lotesVendidos.length - a.lotesVendidos.length);
        filtrados = filtrados.filter(a => a.lotesVendidos.length > 0 || a.lotesPendentes.length > 0);
        if (window.pages.rankAdm.term) filtrados = filtrados.filter(a => a.nome.toLowerCase().includes(window.pages.rankAdm.term.toLowerCase()));

        const startIdx = (window.pages.rankAdm.current - 1) * 10;
        const paginated = filtrados.slice(startIdx, startIdx + 10);
        
        tabela.innerHTML = paginated.map((aluno, index) => {
            const posReal = startIdx + index + 1;
            const rec = calcularRecompensas(aluno.lotesVendidos.length);
            const cartelasHTML = rec.cartelas > 0 ? `<div class="flex-center" style="font-weight:bold; color:var(--sunflower-gold);">${rec.cartelas}</div>` : '-';
            const foneHTML = rec.fone > 0 ? '<span class="material-symbols-outlined" style="color:var(--petal-pink);">headphones</span>' : '-';
            const tagMeu = `<br><small style="color:#a0a0a0">Edu: ${aluno.educadorResponsavel}</small>`;
            return `<tr onclick="abrirDetalhesAluno(${window.todosEducandosBD.indexOf(aluno)}, 'Educando')"><td class="td-center" style="font-weight: bold;">${posReal}º</td><td><img src="${aluno.foto}" class="table-avatar"></td><td><strong style="color:var(--obsidian);">${aluno.nome}</strong>${tagMeu}</td><td style="color:var(--dim-grey);">${aluno.turma}</td><td class="td-center">${aluno.lotesVendidos.length + aluno.lotesPendentes.length}</td><td class="td-center highlight-purple" style="font-weight:bold;">${aluno.lotesVendidos.length}</td><td class="td-center ${aluno.lotesPendentes.length > 0 ? 'td-highlight' : ''}">${aluno.lotesPendentes.length}</td><td class="td-center">${cartelasHTML}</td><td class="td-center">${foneHTML}</td></tr>`;
        }).join('') || '<tr><td colspan="9" class="text-center" style="padding: 20px; color: #a0a0a0;">Nenhum aluno encontrado.</td></tr>';
        
        renderPaginationUI('pagRankingAlunos', 'rankAdm', filtrados.length, 10, 'renderRankingAlunosAdm');
    }

    window.renderRankingAlunosEdu = function() {
        const tabela = document.getElementById("tabelaRankingEducador"); if(!tabela) return;
        let filtrados = [...window.todosEducandosBD].filter(a => !ehVendaDireta(a)).sort((a, b) => b.lotesVendidos.length - a.lotesVendidos.length);
        filtrados = filtrados.filter(a => a.lotesVendidos.length > 0 || a.lotesPendentes.length > 0);
        if (window.pages.rankEdu.term) filtrados = filtrados.filter(a => a.nome.toLowerCase().includes(window.pages.rankEdu.term.toLowerCase()));

        const startIdx = (window.pages.rankEdu.current - 1) * 10;
        const paginated = filtrados.slice(startIdx, startIdx + 10);
        
        tabela.innerHTML = paginated.map((aluno, index) => {
            const posReal = startIdx + index + 1;
            const rec = calcularRecompensas(aluno.lotesVendidos.length);
            const cartelasHTML = rec.cartelas > 0 ? `<div class="flex-center" style="font-weight:bold; color:var(--sunflower-gold);">${rec.cartelas}</div>` : '-';
            const foneHTML = rec.fone > 0 ? '<span class="material-symbols-outlined" style="color:var(--petal-pink);">headphones</span>' : '-';
            const destaque = textoIgual(aluno.educadorResponsavel, userName) ? 'background-color: rgba(188, 104, 161, 0.05);' : '';
            const tagMeu = textoIgual(aluno.educadorResponsavel, userName) ? ' <br><span style="font-size:0.7rem; background:var(--petal-pink); color:white; padding:2px 4px; border-radius:4px;">Seu Aluno</span>' : '';
            return `<tr style="${destaque}" onclick="abrirDetalhesAluno(${window.todosEducandosBD.indexOf(aluno)}, 'Educando')"><td class="td-center" style="font-weight: bold;">${posReal}º</td><td><img src="${aluno.foto}" class="table-avatar"></td><td><strong style="color:var(--obsidian);">${aluno.nome}</strong>${tagMeu}</td><td style="color:var(--dim-grey);">${aluno.turma}</td><td class="td-center">${aluno.lotesVendidos.length + aluno.lotesPendentes.length}</td><td class="td-center highlight-purple" style="font-weight:bold;">${aluno.lotesVendidos.length}</td><td class="td-center ${aluno.lotesPendentes.length > 0 ? 'td-highlight' : ''}">${aluno.lotesPendentes.length}</td><td class="td-center">${cartelasHTML}</td><td class="td-center">${foneHTML}</td></tr>`;
        }).join('') || '<tr><td colspan="9" class="text-center" style="padding: 20px; color: #a0a0a0;">Nenhum aluno encontrado.</td></tr>';
        
        renderPaginationUI('pagRankingEducador', 'rankEdu', filtrados.length, 10, 'renderRankingAlunosEdu');
    }

    window.renderRankingEquipeAdm = function() {
        const tabela = document.getElementById("tabelaRankingEquipeADM"); if(!tabela) return;
        let filtrados = window.todosEducandosBD.filter(a => ehVendaDireta(a)).sort((a, b) => b.lotesVendidos.length - a.lotesVendidos.length);
        
        const startIdx = (window.pages.rankEquipe.current - 1) * 10;
        const paginated = filtrados.slice(startIdx, startIdx + 10);

        tabela.innerHTML = paginated.map((colab, index) => {
            const valorArrecadado = (colab.lotesVendidos.length * 20).toFixed(2).replace('.', ',');
            return `<tr style="cursor: pointer;" onclick="abrirDetalhesAluno(${window.todosEducandosBD.indexOf(colab)}, 'VendaDireta')">
                <td class="td-center" style="font-weight: bold; color: var(--petal-pink);">${startIdx + index + 1}º</td>
                <td><img src="${colab.foto}" class="table-avatar" style="border: 2px solid var(--sunflower-gold);"></td>
                <td><strong>${colab.nome}</strong><br><small style="color:var(--sunflower-gold); font-weight:bold;">Vendedor Direto</small></td>
                <td class="td-center" style="font-weight: bold; font-size: 1.1rem;">${colab.lotesVendidos.length}</td>
                <td class="td-center highlight-purple" style="font-weight: bold;">R$ ${valorArrecadado}</td>
            </tr>`;
        }).join('') || '<tr><td colspan="5" class="text-center" style="padding: 20px; color: #a0a0a0;">Nenhum vendedor direto registrado.</td></tr>';
        
        renderPaginationUI('pagRankingEquipe', 'rankEquipe', filtrados.length, 10, 'renderRankingEquipeAdm');
    }

    window.renderParceirosListaPaginado = function() {
        const tabela = document.getElementById("tabelaParceirosLista"); if(!tabela) return;
        let filtrados = [...window.todosParceirosBD];
        
        const startIdx = (window.pages.parceiros.current - 1) * 10;
        const paginated = filtrados.slice(startIdx, startIdx + 10);

        tabela.innerHTML = paginated.map((parc, index) => {
            const valorArrecadado = (parc.lotesVendidos.length * 20).toFixed(2).replace('.', ',');
            return `<tr style="cursor: pointer;" onclick="abrirDetalhesAluno(${window.todosParceirosBD.indexOf(parc)}, 'Parceiro')">
                <td><img src="${parc.foto}" class="table-avatar" style="border: 2px solid #4CAF50;"></td>
                <td><strong>${parc.nome}</strong><br><small style="color:#4CAF50; font-weight:bold;">Comércio Parceiro</small></td>
                <td class="td-center" style="font-weight: bold; font-size: 1.1rem;">${parc.lotesVendidos.length}</td>
                <td class="td-center highlight-purple" style="font-weight: bold;">R$ ${valorArrecadado}</td>
            </tr>`;
        }).join('') || '<tr><td colspan="4" class="text-center" style="padding: 20px; color: #a0a0a0;">Nenhum parceiro registrado.</td></tr>';
        
        renderPaginationUI('pagParceiros', 'parceiros', filtrados.length, 10, 'renderParceirosListaPaginado');
    }

    window.renderGestaoLotesPaginado = function() {
        const tabela = document.getElementById('tabelaGestaoLotes'); if(!tabela) return;
        
        let listaUnificada = [
            ...window.todosEducandosBD.map(e => ({ ...e, tipo: ehVendaDireta(e) ? 'Venda Direta' : 'Educando', bdIdx: window.todosEducandosBD.indexOf(e) })),
            ...window.todosParceirosBD.map(p => ({ ...p, tipo: 'Parceiro', bdIdx: window.todosParceirosBD.indexOf(p) }))
        ];

        let filtrados = listaUnificada.filter(a => a.lotesPendentes.length > 0);
        if(window.pages.gestaoLotes.term) filtrados = filtrados.filter(a => a.nome.toLowerCase().includes(window.pages.gestaoLotes.term.toLowerCase()));

        const startIdx = (window.pages.gestaoLotes.current - 1) * 10;
        const paginated = filtrados.slice(startIdx, startIdx + 10);

        tabela.innerHTML = paginated.map((pessoa) => {
            let corBadge = pessoa.tipo === 'Parceiro' ? '#4CAF50' : (pessoa.tipo === 'Venda Direta' ? 'var(--sunflower-gold)' : 'var(--petal-pink)');
            let descCategoria = pessoa.tipo === 'Venda Direta' ? 'Venda Direta' : (pessoa.tipo === 'Parceiro' ? 'Parceiro' : `Educando (${pessoa.turma})`);
            return `<tr style="cursor: pointer;" onclick="abrirDetalhesAluno(${pessoa.bdIdx}, '${pessoa.tipo}')">
                <td><img src="${pessoa.foto}" class="table-avatar" style="border: 2px solid ${corBadge};"></td>
                <td><strong>${pessoa.nome}</strong><br><small style="color:${corBadge}; font-weight:bold;">${pessoa.tipo}</small></td>
                <td style="color:var(--dim-grey);">${pessoa.curso || '-'}<br><small style="color:var(--light-grey);">${descCategoria}</small></td>
                <td class="td-center highlight-yellow" style="font-weight:bold; font-size:1.1rem;">${pessoa.lotesPendentes.length}</td>
            </tr>`;
        }).join('') || `<tr><td colspan="4" class="text-center" style="padding: 2rem; color: #a0a0a0;">Nenhum lote pendente.</td></tr>`;
        
        renderPaginationUI('pagLotes', 'gestaoLotes', filtrados.length, 10, 'renderGestaoLotesPaginado');
    }

    window.renderLogsPaginado = function() {
        const tabela = document.getElementById('tabelaLogs'); if(!tabela) return;
        const filtrados = [...window.logsDoSistema].reverse(); 
        const startIdx = (window.pages.logs.current - 1) * 10;
        const paginated = filtrados.slice(startIdx, startIdx + 10);

        tabela.innerHTML = paginated.map(l => {
            const dt = l['Data/Hora'] || l['Data_Hora'] || l['Data Hora'] || l['Data'] || '-';
            const resp = l['Responsavel'] || l['Responsável'] || l['Usuário'] || l['Usuario'] || '-';
            const sessao = l['Sessão_Dispositivo'] || l['Sessao'] || l['Sessao Dispositivo'] || '-';
            const acao = l['Ação_Registrada'] || l['Ação'] || l['Ação'] || l['Acao Registrada'] || '-';
            const det = l['Detalhes'] || l['Detalhe'] || '-';
            return `<tr><td style="color:var(--dim-grey); font-size:0.85rem;">${dt}</td><td><strong>${resp}</strong><br><small style="color:#ccc;">${sessao}</small></td><td style="color:var(--petal-pink); font-weight:bold;">${acao}</td><td style="color:var(--dim-grey);">${det}</td></tr>`;
        }).join('') || `<tr><td colspan="4" class="text-center" style="padding: 2rem; color: #a0a0a0;">Nenhum log encontrado.</td></tr>`;
        renderPaginationUI('pagLogs', 'logs', filtrados.length, 10, 'renderLogsPaginado');
    }


    window.renderCaixaVendaDiretaAdminPaginado = function() {
        const tabela = document.getElementById('tabelaCaixaVendaDireta');
        if (!tabela) return;
        let linhas = [...(window.caixaVendaDiretaBD || [])].reverse();
        if (window.pages.caixaVD.term) {
            const term = window.pages.caixaVD.term.toLowerCase();
            linhas = linhas.filter(tx => `${idTransacao(tx)} ${tx['Lote'] || ''} ${vendedorTransacaoVD(tx)} ${tx['Metodo_Pagamento'] || ''} ${tx['Status_Conferencia'] || ''}`.toLowerCase().includes(term));
        }
        const resumo = resumirCaixaVendaDireta();
        const setText = (id, valor) => { const el = document.getElementById(id); if (el) el.innerText = valor; };
        setText('kpiVDPixPendente', moedaBR(resumo.pixPendente));
        setText('kpiVDDinheiroPendente', moedaBR(resumo.dinheiroPendente));
        setText('kpiVDTotalPendente', moedaBR(resumo.totalPendente));
        setText('kpiVDTotalConferido', moedaBR(resumo.totalConferido));
        const btnConferir = document.getElementById('btnConferirCaixaVendaDireta');
        if (btnConferir) btnConferir.disabled = resumo.qtdPendente === 0;

        const startIdx = (window.pages.caixaVD.current - 1) * 10;
        const paginated = linhas.slice(startIdx, startIdx + 10);
        tabela.innerHTML = paginated.map(tx => {
            const pendente = isCaixaVendaDiretaPendente(tx);
            const status = pendente ? 'A CONFERIR' : 'CONFERIDO';
            const statusClass = pendente ? 'pendente' : 'valido';
            const valor = valorTransacao(tx);
            const metodo = tx['Metodo_Pagamento'] || tx['Método'] || tx['Metodo'] || '-';
            return `<tr>
                <td>${escaparHTML(dataTransacao(tx))}</td>
                <td><span style="color:#a0a0a0; font-size:0.8rem;">${escaparHTML(idTransacao(tx) || '-')}</span></td>
                <td><strong>${escaparHTML(tx['Lote'] || '-')}</strong></td>
                <td>${escaparHTML(vendedorTransacaoVD(tx))}</td>
                <td class="highlight-purple" style="font-weight:bold;">${moedaBR(valor)}</td>
                <td>${escaparHTML(metodo)}</td>
                <td><span class="vd-status-badge ${statusClass}">${status}</span></td>
            </tr>`;
        }).join('') || `<tr><td colspan="7" class="text-center" style="padding: 2rem; color:#a0a0a0;">Nenhuma venda direta registrada.</td></tr>`;
        renderPaginationUI('pagCaixaVendaDireta', 'caixaVD', linhas.length, 10, 'renderCaixaVendaDiretaAdminPaginado');
    }

    function preencherModalConferenciaVendaDireta(resumo) {
        const setTxt = (id, valor) => { const el = document.getElementById(id); if (el) el.innerText = valor; };
        setTxt('modalVDPix', moedaBR(resumo.pixPendente));
        setTxt('modalVDDinheiro', moedaBR(resumo.dinheiroPendente));
        setTxt('modalVDTotal', moedaBR(resumo.totalPendente));
        setTxt('modalVDQtd', String(resumo.qtdPendente));
    }

    window.conferirCaixaVendaDireta = function() {
        const resumo = resumirCaixaVendaDireta();
        if (resumo.qtdPendente === 0) return window.abrirModalErro('Não há lançamentos de venda direta pendentes para conferir.');
        preencherModalConferenciaVendaDireta(resumo);
        window.abrirModal('modalConfirmarConferenciaVD');
    }

    window.executarConferenciaCaixaVendaDireta = function() {
        const resumo = resumirCaixaVendaDireta();
        if (resumo.qtdPendente === 0) {
            window.fecharModal('modalConfirmarConferenciaVD');
            return window.abrirModalErro('Não há lançamentos de venda direta pendentes para conferir.');
        }
        const btn = document.getElementById('btnExecutarConferenciaVD');
        const btnHeader = document.getElementById('btnConferirCaixaVendaDireta');
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="material-symbols-outlined">hourglass_top</span> Conferindo...'; }
        if (btnHeader) btnHeader.disabled = true;
        fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'conferir_caixa_venda_direta', responsavel: userName }) })
            .then(res => res.json())
            .then(data => {
                if (!data.success) throw new Error(data.message || 'Falha ao conferir caixa.');
                window.fecharModal('modalConfirmarConferenciaVD');
                window.abrirModalSucesso(data.message || 'Venda Direta conferida e juntada ao Caixa Oficial.');
                window.registrarLog('Conferência Caixa Venda Direta', `Conferiu ${data.qtd || resumo.qtdPendente} lançamento(s) e juntou ${moedaBR(data.total || resumo.totalPendente)} ao caixa oficial.`);
                window.carregarDadosDoBanco(true);
            })
            .catch(err => window.abrirModalErro(err.message || 'Erro ao conferir Venda Direta.'))
            .finally(() => {
                if (btn) { btn.disabled = false; btn.innerHTML = '<span class="material-symbols-outlined">verified</span> Confirmar conferência'; }
                if (btnHeader) { btnHeader.disabled = false; btnHeader.innerHTML = '<span class="material-symbols-outlined">verified</span> Conferir e juntar ao caixa oficial'; }
            });
    }

    window.renderLivroCaixaPaginado = function() {
        const tabela = document.getElementById('tabelaLivroCaixa'); if(!tabela) return;
        const filtrados = window.caixaGlobalBD ? [...window.caixaGlobalBD].reverse() : [];
        const startIdx = (window.pages.caixa.current - 1) * 10;
        const paginated = filtrados.slice(startIdx, startIdx + 10);

        tabela.innerHTML = paginated.map(tx => {
            const dt = tx['Data/Hora'] || tx['Data_Hora'] || tx['Data Hora'] || tx['Data'] || tx['Carimbo de data/hora'] || '-';
            const id = tx['ID_Transacao'] || tx['ID Transação'] || tx['ID Transacao'] || tx['ID'] || tx['Id'] || '-';
            const lote = tx['Lote'] || tx['Codigo_Lote'] || tx['Código Lote'] || tx['Código'] || '-';
            const edu = tx['Educando'] || tx['Aluno'] || tx['Nome'] || tx['Vendedor'] || tx['Parceiro'] || '-';
            const valRaw = tx['Valor'] || tx['Valor_Total'] || tx['Valor Recebido'] || tx['Valor(R$)'] || 0;
            const val = parseFloat(valRaw).toFixed(2).replace('.', ',');
            const met = tx['Metodo_Pagamento'] || tx['Método de Pagamento'] || tx['Método'] || tx['Metodo'] || tx['Forma_Pagamento'] || tx['Forma de Pagamento'] || '-';
            const resp = tx['Responsavel'] || tx['Responsável'] || tx['Educador Responsável'] || tx['Educador'] || '-';
            
            return `<tr><td>${dt}</td><td><span style="color:#a0a0a0; font-size:0.8rem;">${id}</span></td><td><strong>${lote}</strong></td><td>${edu}</td><td class="highlight-purple" style="font-weight:bold;">R$ ${val}</td><td>${met}</td><td>${resp}</td></tr>`;
        }).join('') || `<tr><td colspan="7" class="text-center" style="padding: 2rem; color: #a0a0a0;">Nenhuma transação registrada. Verifique se a linha 1 do Google Sheets possui cabeçalhos.</td></tr>`;
        
        renderPaginationUI('pagLivroCaixa', 'caixa', filtrados.length, 10, 'renderLivroCaixaPaginado');
    }

    window.renderMinhaTurmaPaginado = function() {
        const tabela = document.getElementById('tabelaAlunos'); if(!tabela) return;
        let filtrados = window.todosEducandosBD.filter(a => textoIgual(a.educadorResponsavel, userName) && (a.cadastroAtivo.toLowerCase() === 'sim' || a.lotesVendidos.length > 0 || a.lotesPendentes.length > 0)); 
        
        if(window.pages.minhaTurma.term) filtrados = filtrados.filter(a => a.nome.toLowerCase().includes(window.pages.minhaTurma.term.toLowerCase()));
        if(window.pages.minhaTurma.turma !== "Todas") filtrados = filtrados.filter(a => a.turma === window.pages.minhaTurma.turma);

        const startIdx = (window.pages.minhaTurma.current - 1) * 10;
        const paginated = filtrados.slice(startIdx, startIdx + 10);

        tabela.innerHTML = paginated.map((aluno, index) => {
            const posReal = startIdx + index + 1;
            const rec = calcularRecompensas(aluno.lotesVendidos.length);
            const cartelasHTML = rec.cartelas > 0 ? `<div class="flex-center" style="font-weight:bold; color:var(--sunflower-gold);">${rec.cartelas}</div>` : '-';
            const foneHTML = rec.fone > 0 ? '<span class="material-symbols-outlined" style="color:var(--petal-pink);">headphones</span>' : '-';
            return `<tr onclick="abrirDetalhesAluno(${window.todosEducandosBD.indexOf(aluno)}, 'Educando')"><td class="td-center" style="font-weight: bold; color: #BC68A1;">${posReal}</td><td><img src="${aluno.foto}" class="table-avatar"></td><td><strong>${aluno.nome}</strong><br><small style="color:#a0a0a0">${aluno.curso}</small></td><td class="td-center">${aluno.lotesVendidos.length + aluno.lotesPendentes.length}</td><td class="td-center highlight-purple" style="font-weight:bold;">${aluno.lotesVendidos.length}</td><td class="td-center ${aluno.lotesPendentes.length > 0 ? 'td-highlight' : ''}">${aluno.lotesPendentes.length}</td><td class="td-center">${cartelasHTML}</td><td class="td-center">${foneHTML}</td></tr>`;
        }).join('') || '<tr><td colspan="8" class="text-center" style="padding: 20px; color: #a0a0a0;">Nenhum aluno encontrado.</td></tr>';
        
        renderPaginationUI('pagMinhaTurma', 'minhaTurma', filtrados.length, 10, 'renderMinhaTurmaPaginado');
    }

    const srchRankA = document.getElementById("buscaRankingAluno");
    if(srchRankA) srchRankA.addEventListener('input', (e) => { window.pages.rankAdm.term = e.target.value; window.pages.rankAdm.current = 1; window.renderRankingAlunosAdm(); });
    
    const srchRankE = document.getElementById("buscaRankingAlunoEdu");
    if(srchRankE) srchRankE.addEventListener('input', (e) => { window.pages.rankEdu.term = e.target.value; window.pages.rankEdu.current = 1; window.renderRankingAlunosEdu(); });
    
    const srchLotes = document.getElementById("buscaGestaoLotes");
    if(srchLotes) srchLotes.addEventListener('input', (e) => { window.pages.gestaoLotes.term = e.target.value; window.pages.gestaoLotes.current = 1; window.renderGestaoLotesPaginado(); });

    const srchEstoque = document.getElementById("buscaEstoqueLotes");
    if(srchEstoque) srchEstoque.addEventListener('input', (e) => { window.pages.estoqueLotes.term = e.target.value; window.pages.estoqueLotes.current = 1; window.renderEstoqueLotesAdminPaginado(); });

    const filtroEducadorEstoque = document.getElementById('filtroEducadorEstoqueLotes');
    if(filtroEducadorEstoque) filtroEducadorEstoque.addEventListener('change', (e) => { window.pages.estoqueLotes.educador = e.target.value; window.pages.estoqueLotes.current = 1; window.renderEstoqueLotesAdminPaginado(); });

    const srchPendAdm = document.getElementById("buscaPendentesAdm");
    if(srchPendAdm) srchPendAdm.addEventListener('input', (e) => { window.pages.pendentesAdm.term = e.target.value; window.pages.pendentesAdm.current = 1; window.renderPendentesAdminPaginado(); });

    const srchPendEdu = document.getElementById("buscaPendentesEducador");
    if(srchPendEdu) srchPendEdu.addEventListener('input', (e) => { window.pages.pendentesEdu.term = e.target.value; window.pages.pendentesEdu.current = 1; window.renderPendentesEducadorPaginado(); });

    const srchCaixaVD = document.getElementById("buscaCaixaVendaDireta");
    if(srchCaixaVD) srchCaixaVD.addEventListener('input', (e) => { window.pages.caixaVD.term = e.target.value; window.pages.caixaVD.current = 1; window.renderCaixaVendaDiretaAdminPaginado(); });

    function ligarCliqueSeguro(id, callback) {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('click', (event) => {
            event.preventDefault();
            callback(event);
        });
    }

    ligarCliqueSeguro('btnExportarPendentesAdm', () => window.exportarPendentesAdmin());
    ligarCliqueSeguro('btnExportarPendentesMinhaTurma', () => window.exportarPendentesEducador());
    ligarCliqueSeguro('btnExportarPendentesEducador', () => window.exportarPendentesEducador());
    ligarCliqueSeguro('btnValidarCartelaAdm', () => window.validarCartelaPendente('inputValidadorCartelaAdm', 'resultadoValidadorCartelaAdm'));
    ligarCliqueSeguro('btnValidarCartelaEducador', () => window.validarCartelaPendente('inputValidadorCartelaEducador', 'resultadoValidadorCartelaEducador'));
    ligarCliqueSeguro('btnConferirCaixaVendaDireta', () => window.conferirCaixaVendaDireta());

    document.querySelectorAll('.js-validador-input').forEach(input => {
        const resultId = input.getAttribute('data-result-id');
        if (!resultId) return;
        input.addEventListener('input', () => window.buscarValidadorCartelaAutomatico(input.id, resultId));
    });

    document.addEventListener('click', (event) => {
        const botaoSugestao = event.target.closest('.js-validador-sugestao');
        if (!botaoSugestao) return;
        event.preventDefault();
        window.preencherValidadorCartela(
            botaoSugestao.getAttribute('data-input-id'),
            botaoSugestao.getAttribute('data-result-id'),
            botaoSugestao.getAttribute('data-lote')
        );
    });

    const inputBuscaVendaDireta = document.getElementById('inputBuscaVendaDireta');
    if (inputBuscaVendaDireta) {
        inputBuscaVendaDireta.addEventListener('input', () => window.buscarLotesVendaDireta());
        inputBuscaVendaDireta.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                window.prepararVendaDireta(inputBuscaVendaDireta.value);
            }
        });
    }
    const btnVendaDireta = document.getElementById('btnAbrirVendaDiretaLote');
    if (btnVendaDireta) btnVendaDireta.addEventListener('click', () => window.prepararVendaDireta(document.getElementById('inputBuscaVendaDireta')?.value));

    const inputConsultaVD = document.getElementById('inputConsultaDisponiveisVendaDireta');
    if (inputConsultaVD) inputConsultaVD.addEventListener('input', () => window.consultarDisponiveisVendaDireta('inputConsultaDisponiveisVendaDireta', 'resultadoConsultaDisponiveisVendaDireta'));

    const inputConsultaVDAdm = document.getElementById('inputConsultaLotesVendaDiretaAdmin');
    if (inputConsultaVDAdm) inputConsultaVDAdm.addEventListener('input', () => window.renderListaAtribuicaoVendaDireta());

    // ==========================================
    // SEÇÃO DO EDUCADOR
    // ==========================================
    const educadorPage = document.getElementById("educadorPage");
    if (educadorPage) {
        document.getElementById('nomeEducador').innerText = userName;

        const buscaNome = document.getElementById('buscaNomeAluno');
        const filtroTurma = document.getElementById('filtroTurmaAluno');
        if(buscaNome) buscaNome.addEventListener('input', (e) => { window.pages.minhaTurma.term = e.target.value; window.pages.minhaTurma.current = 1; window.atualizarDashboardEducador() });
        if(filtroTurma) filtroTurma.addEventListener('change', (e) => { window.pages.minhaTurma.turma = e.target.value; window.pages.minhaTurma.current = 1; window.atualizarDashboardEducador() });

        window.atualizarDashboardEducador = function() {
            window.renderMinhaTurmaPaginado();
            window.renderPendentesEducadorPaginado();
            window.renderVendaDiretaPainel();

            if (obterPerfilVendaDiretaAtual() && !window.__vendaDiretaAbaInicializada) {
                window.__vendaDiretaAbaInicializada = true;
                setTimeout(() => window.mudarAbaEducador('secVendaDireta', 'navVendaDireta'), 0);
            }

            let totalPendentesGeral = 0, totalVendidosGeral = 0;
            window.todosEducandosBD.forEach(a => { totalPendentesGeral += a.lotesPendentes.length; totalVendidosGeral += a.lotesVendidos.length; });

            const meuPerfil = window.mockEducadoresBD.find(e => textoIgual(e.nome, userName));
            if(meuPerfil) {
                const disponivel = meuPerfil.lotesRetiradosSede - (meuPerfil.lotesVendidos + meuPerfil.lotesPendentes);
                if(document.getElementById('kpiEducadorVendidos')) document.getElementById('kpiEducadorVendidos').innerText = meuPerfil.lotesVendidos;
                if(document.getElementById('kpiEducadorPendentes')) document.getElementById('kpiEducadorPendentes').innerText = meuPerfil.lotesPendentes;
                if(document.getElementById('kpiEducadorEstoque')) document.getElementById('kpiEducadorEstoque').innerText = disponivel >= 0 ? disponivel : 0;
            }

            const vVendasPix = window.caixaGlobal.pixReais; const vVendasDin = window.caixaGlobal.dinReais;
            const vVendas = vVendasPix + vVendasDin; const vPendentes = totalPendentesGeral * 20.00;
            
            const kpiGlobal = document.getElementById('kpiVendasReaisGlobal');
            const kpiPix = document.getElementById('kpiCaixaPix');
            const kpiDin = document.getElementById('kpiCaixaDinheiro');
            const kpiProj = document.getElementById('kpiProjecaoGlobal');

            if(kpiGlobal) kpiGlobal.innerText = `R$ ${vVendas.toFixed(2).replace('.', ',')}`;
            if(kpiPix) kpiPix.innerText = `R$ ${vVendasPix.toFixed(2).replace('.', ',')}`;
            if(kpiDin) kpiDin.innerText = `R$ ${vVendasDin.toFixed(2).replace('.', ',')}`;
            if(kpiProj) kpiProj.innerText = `R$ ${vPendentes.toFixed(2).replace('.', ',')}`;
            
            const ctxEstEdu = document.getElementById('estoqueChartEdu');
            if (ctxEstEdu && ctxEstEdu.offsetParent !== null) { 
                if (!estoqueChartInstEdu) estoqueChartInstEdu = new Chart(ctxEstEdu.getContext('2d'), { type: 'doughnut', data: { labels: ['Válidos', 'Pendentes', 'Estoque'], datasets: [{ data: [totalVendidosGeral, totalPendentesGeral, 440], backgroundColor: ['#BC68A1', '#F4B841', '#e0e0e0'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false } });
                else { estoqueChartInstEdu.data.datasets[0].data = [totalVendidosGeral, totalPendentesGeral, 440]; estoqueChartInstEdu.update(); }
            }
            const ctxFinEdu = document.getElementById('financeiroChartEdu');
            if (ctxFinEdu && ctxFinEdu.offsetParent !== null) {
                if (!financeiroChartInstEdu) financeiroChartInstEdu = new Chart(ctxFinEdu.getContext('2d'), { type: 'bar', data: { labels: ['Caixa Realizado', 'Projeção Restante'], datasets: [{ label: 'Valor em R$', data: [vVendas, vPendentes], backgroundColor: ['#BC68A1', '#F4B841'], borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } } });
                else { financeiroChartInstEdu.data.datasets[0].data = [vVendas, vPendentes]; financeiroChartInstEdu.update(); }
            }

            window.renderRankingAlunosEdu();

            const tabelaRankingEducadores = document.getElementById('tabelaRankingEducadoresLista');
            if(tabelaRankingEducadores) {
                let rankingProf = [...window.mockEducadoresBD].sort((a, b) => b.lotesVendidos - a.lotesVendidos);
                const startIdx = (window.pages.rankProfEdu.current - 1) * 10;
                const paginated = rankingProf.slice(startIdx, startIdx + 10);

                tabelaRankingEducadores.innerHTML = paginated.map((prof, index) => {
                    const destaque = textoIgual(prof.nome, userName) ? 'background-color: rgba(188, 104, 161, 0.05);' : '';
                    const valorArrecadado = (prof.lotesVendidos * 20).toFixed(2).replace('.', ',');
                    return `<tr style="${destaque}"><td class="td-center" style="font-weight: bold; color: var(--petal-pink);">${startIdx + index + 1}º</td><td><strong>${prof.nome}</strong></td><td style="color: var(--dim-grey);">${prof.curso}</td><td class="td-center" style="font-weight: bold; font-size: 1.1rem;">${prof.lotesVendidos}</td><td class="td-center highlight-purple" style="font-weight: bold;">R$ ${valorArrecadado}</td></tr>`;
                }).join('');
                renderPaginationUI('pagRankingEducadoresLista', 'rankProfEdu', rankingProf.length, 10, 'atualizarDashboardEducador');
            }

            let searchBox = `<div style="padding: 10px; position: sticky; top: 0; background: white; border-bottom: 1px solid #eee; z-index: 2;"><input type="text" class="purple-input search-custom-select" placeholder="Pesquisar nome..." style="padding: 0.5rem; font-size: 0.9rem;" onclick="event.stopPropagation()"></div>`;
            const todosMeusAlunosDB = window.todosEducandosBD.filter(a => textoIgual(a.educadorResponsavel, userName));
            
            const selectNomeCadastro = document.getElementById("opcoesNomeEducando");
            const wrapCad = document.getElementById("wrapperNomeEducando");
            if(selectNomeCadastro && wrapCad) {
                let optsCad = searchBox;
                if (todosMeusAlunosDB.length === 0) { optsCad += '<span class="custom-option" data-value="">Nenhum aluno no banco.</span>'; } 
                else {
                    todosMeusAlunosDB.forEach(a => { 
                        let lblFoto = a.foto.includes('ui-avatars') ? '<span style="color:#a0a0a0; font-size: 0.8rem;">(Sem Foto)</span>' : '<span style="color:var(--petal-pink); font-size: 0.8rem;">(Com Foto)</span>';
                        optsCad += `<span class="custom-option" data-value="${a.nome}">${a.nome} - ${lblFoto}</span>`; 
                    });
                }
                selectNomeCadastro.innerHTML = optsCad;
                ativarEventosSelectCustomizado(wrapCad);
            }

            const selectAlunoAtribuir = document.getElementById("opcoesAlunoAtribuir");
            const wrapAttr = document.getElementById("wrapperAlunoAtribuir");
            if (selectAlunoAtribuir && wrapAttr) {
                let optsAttr = searchBox;
                let alunosAtivosLocal = todosMeusAlunosDB.filter(a => a.cadastroAtivo.toLowerCase() === 'sim' || a.lotesVendidos.length > 0 || a.lotesPendentes.length > 0);
                if(alunosAtivosLocal.length === 0) optsAttr += '<span class="custom-option" data-value="">Nenhum aluno ativo.</span>';
                else alunosAtivosLocal.forEach(a => { optsAttr += `<span class="custom-option" data-value="${a.nome}">${a.nome}</span>`; });
                selectAlunoAtribuir.innerHTML = optsAttr;
                ativarEventosSelectCustomizado(wrapAttr);
            }

            const listaLotes = document.getElementById("listaLotesCheckboxes");
            if(listaLotes) {
                let htmlLotes = '';
                let lotesEmUso = [];
                window.todosEducandosBD.forEach(a => { lotesEmUso.push(...a.lotesPendentes); lotesEmUso.push(...a.lotesVendidos); });
                const meusLotes = window.lotesSedeBD.filter(l => textoIgual(l.educador, userName) || l.educador === '');
                
                meusLotes.forEach(l => { 
                    if(lotesEmUso.includes(l.codigo)) {
                        htmlLotes += `<label class="checkbox-item-row" style="opacity: 0.5; cursor: not-allowed;"><input type="checkbox" class="roxo-checkbox" value="${l.codigo}" disabled> <span style="color: var(--dim-grey); font-weight: 500; text-decoration: line-through;">${l.codigo}</span> <span style="margin-left:auto; font-size: 0.8rem; color:#a0a0a0;">Em uso</span></label>`; 
                    } else {
                        htmlLotes += `<label class="checkbox-item-row"><input type="checkbox" class="roxo-checkbox" value="${l.codigo}"> <span style="color: var(--dim-grey); font-weight: 500;">${l.codigo}</span></label>`; 
                    }
                });
                listaLotes.innerHTML = htmlLotes || '<div style="padding: 15px; color:#a0a0a0; text-align:center;">Nenhum lote liberado para você na Sede.</div>';
            }
        };

        const formCadastrarEducando = document.getElementById("formCadastrarEducando");
        if(formCadastrarEducando) {
            formCadastrarEducando.addEventListener("submit", (e) => {
                e.preventDefault();
                const btn = formCadastrarEducando.querySelector("button[type='submit']");
                btn.innerText = "Enviando para Nuvem..."; btn.disabled = true;

                const nome = document.getElementById("nomeSelectEducando").value;
                const turmaTexto = document.getElementById("turmaSelectEducando").value; 
                if(!nome || !turmaTexto) { btn.disabled = false; btn.innerText = "Ativar Educando"; return window.abrirModalErro("Preencha todos os campos."); }
                let periodo = (turmaTexto === "Turma 3" || turmaTexto === "Turma 4") ? "Tarde" : "Manhã";

                if(window.fotoFileGlobal && window.tipoCadastroFoto === 'aluno') {
                    const formData = new FormData(); 
                    formData.append('file', window.fotoFileGlobal); 
                    formData.append('upload_preset', CLOUDINARY_PRESET);
                    
                    fetch(CLOUDINARY_URL, { method: 'POST', body: formData })
                    .then(r => r.json()).then(dataImg => {
                        if(dataImg.secure_url) { salvarEducandoBanco(nome, turmaTexto, periodo, dataImg.secure_url, btn); } 
                        else { window.abrirModalErro("Falha no Cloudinary"); btn.innerText = "Ativar Educando"; btn.disabled = false; }
                    }).catch(() => { window.abrirModalErro("Erro de rede."); btn.innerText = "Ativar Educando"; btn.disabled = false; });
                } else { salvarEducandoBanco(nome, turmaTexto, periodo, "", btn); }
            });
        }

        function salvarEducandoBanco(nome, turmaTexto, periodo, fotoUrl, btn) {
            fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'cadastrar_educando', nome: nome, turma: turmaTexto, periodo: periodo, educadorResponsavel: userName, fotoUrl: fotoUrl })
            }).then(res => res.json()).then(data => {
                btn.innerText = "Ativar Educando"; btn.disabled = false;
                if(data.success) {
                    window.registrarLog("Cadastro", `Ativou e vinculou foto ao aluno ${nome}`);
                    fecharModal('modalCadastrarEducando'); 
                    const form = document.getElementById("formCadastrarEducando");
                    if(form) form.reset();
                    window.fotoFileGlobal = null; document.getElementById('previewFoto').style.display = 'none'; document.getElementById('iconCamera').style.display = 'block';
                    window.abrirModalSucesso(data.message); window.carregarDadosDoBanco();
                } else { window.abrirModalErro(data.message); }
            }).catch(() => { btn.disabled = false; window.abrirModalErro("Erro de rede."); });
        }

        const formAtribuirLote = document.getElementById("formAtribuirLote");
        if(formAtribuirLote) {
            formAtribuirLote.addEventListener("submit", (e) => {
                e.preventDefault();
                const alunoInput = document.getElementById("alunoAtribuirSelect").value;
                const checkboxesMarcados = document.querySelectorAll('#listaLotesCheckboxes input[type="checkbox"]:checked');
                const lotesArray = Array.from(checkboxesMarcados).map(cb => cb.value);

                if(!alunoInput || lotesArray.length === 0) return window.abrirModalErro("Selecione o aluno e marque pelo menos um lote.");
                const btn = formAtribuirLote.querySelector("button[type='submit']");
                btn.innerText = "Atribuindo..."; btn.disabled = true;

                fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'atribuir_lote', nomeAluno: alunoInput, lotes: lotesArray, tipoPessoa: 'Educando', responsavel: userName }) })
                .then(res => res.json()).then(data => {
                    btn.innerText = "Confirmar Atribuição"; btn.disabled = false;
                    if(data.success) {
                        window.registrarLog("Atribuição de Lote", `Atribuiu os lotes ${lotesArray.join(', ')} para ${alunoInput}`);
                        fecharModal('modalAtribuirLote'); formAtribuirLote.reset(); window.abrirModalSucesso("Lotes atribuídos!"); window.carregarDadosDoBanco(); 
                    } else { window.abrirModalErro(data.message); }
                }).catch(() => { btn.disabled = false; window.abrirModalErro("Erro de rede."); });
            });
        }
    }

    // ==========================================
    // SEÇÃO DO ADMINISTRADOR (BLINDADA CONTRA CRASHES)
    // ==========================================
    const adminPage = document.getElementById("adminPage");
    if (adminPage) {
        
        window.atualizarDashboardsADM = function() {
            const kpiVendasEducandos = document.getElementById('kpiVendasEducandos');
            const kpiVendasEquipe = document.getElementById('kpiVendasEquipe');
            const kpiVendasParceiros = document.getElementById('kpiVendasParceiros');
            const kpiCaixaPix = document.getElementById('kpiCaixaPix');
            const kpiCaixaDinheiro = document.getElementById('kpiCaixaDinheiro');
            const kpiVendasReaisGlobal = document.getElementById('kpiVendasReaisGlobal');
            const kpiProjecaoGlobal = document.getElementById('kpiProjecaoGlobal');
            const kpiParceirosArrecadado = document.getElementById('kpiParceirosArrecadado');
            const kpiParceirosProjetado = document.getElementById('kpiParceirosProjetado');

            let totalPendentes = 0, totalVendidos = 0; let ativos = 0; let inativos = 0; 
            let alunosNormais = window.todosEducandosBD.filter(a => !ehVendaDireta(a));
            let totalAlunos = alunosNormais.length;

            alunosNormais.forEach(a => { 
                totalPendentes += a.lotesPendentes.length; totalVendidos += a.lotesVendidos.length; 
                if(!ehVendaDireta(a)) {
                    if(a.cadastroAtivo === 'Sim' || a.lotesVendidos.length > 0 || a.lotesPendentes.length > 0) ativos++; else inativos++;
                }
            });

            let vEdu = 0, vEquipe = 0, vParc = 0;
            let vPix = 0, vDin = 0;

            window.caixaGlobalBD.forEach(tx => {
                let val = parseFloat(tx['Valor']) || parseFloat(tx['Valor_Total']) || parseFloat(tx['Valor Recebido']) || 0;
                let cat = tx['Categoria'] || 'Educando';
                let m = String(tx['Metodo_Pagamento'] || tx['Método'] || tx['Metodo'] || tx['Forma_Pagamento'] || '').toUpperCase();

                if(cat === 'Equipe' || cat === 'Venda Direta' || cat === 'VendaDireta') vEquipe += val;
                else if(cat === 'Parceiro') vParc += val;
                else vEdu += val;

                if(m.includes('PIX')) vPix += val;
                else if(m.includes('DINHEIRO') || m.includes('ESPECIE') || m.includes('MISTO')) vDin += val;
            });

            const vVendas = vPix + vDin; const vPendentes = totalPendentes * 20.00;

            let pendentesParceiros = 0;
            window.todosParceirosBD.forEach(p => { pendentesParceiros += p.lotesPendentes.length; });

            if(kpiVendasEducandos) kpiVendasEducandos.innerText = `R$ ${vEdu.toFixed(2).replace('.', ',')}`;
            if(kpiVendasEquipe) kpiVendasEquipe.innerText = `R$ ${vEquipe.toFixed(2).replace('.', ',')}`;
            if(kpiVendasParceiros) kpiVendasParceiros.innerText = `R$ ${vParc.toFixed(2).replace('.', ',')}`;
            if(kpiVendasReaisGlobal) kpiVendasReaisGlobal.innerText = `R$ ${vVendas.toFixed(2).replace('.', ',')}`;
            if(kpiCaixaPix) kpiCaixaPix.innerText = `R$ ${vPix.toFixed(2).replace('.', ',')}`;
            if(kpiCaixaDinheiro) kpiCaixaDinheiro.innerText = `R$ ${vDin.toFixed(2).replace('.', ',')}`;
            if(kpiProjecaoGlobal) kpiProjecaoGlobal.innerText = `R$ ${vPendentes.toFixed(2).replace('.', ',')}`;
            
            if(kpiParceirosArrecadado) kpiParceirosArrecadado.innerText = `R$ ${vParc.toFixed(2).replace('.', ',')}`;
            if(kpiParceirosProjetado) kpiParceirosProjetado.innerText = `R$ ${(pendentesParceiros * 20).toFixed(2).replace('.', ',')}`;

            if(document.getElementById('kpiAtivos')) document.getElementById('kpiAtivos').innerText = ativos;
            if(document.getElementById('kpiInativos')) document.getElementById('kpiInativos').innerText = inativos;
            if(document.getElementById('kpiAdesao')) document.getElementById('kpiAdesao').innerText = totalAlunos > 0 ? `${Math.round((ativos/totalAlunos)*100)}%` : '0%';

            let maiorEstoqueNome = "Nenhum"; let maiorEstoqueQtd = -1;
            window.mockEducadoresBD.forEach(ed => {
                let est = ed.lotesRetiradosSede - ed.lotesVendidos - ed.lotesPendentes;
                if (est > maiorEstoqueQtd) { maiorEstoqueQtd = est; maiorEstoqueNome = ed.nome; }
            });
            if(document.getElementById('kpiMaiorEstoque')) document.getElementById('kpiMaiorEstoque').innerHTML = `<strong>${maiorEstoqueNome}</strong> <br><span style="font-size: 1rem; color: var(--dim-grey); font-weight: normal;">${maiorEstoqueQtd} lotes disponíveis</span>`;

            const ctxEst = document.getElementById('estoqueChart');
            if (ctxEst && ctxEst.offsetParent !== null) { 
                if (!estoqueChartInstAdm) estoqueChartInstAdm = new Chart(ctxEst.getContext('2d'), { type: 'doughnut', data: { labels: ['Válidos', 'Pendentes', 'Estoque'], datasets: [{ data: [totalVendidos, totalPendentes, 440], backgroundColor: ['#BC68A1', '#F4B841', '#e0e0e0'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false } });
                else { estoqueChartInstAdm.data.datasets[0].data = [totalVendidos, totalPendentes, 440]; estoqueChartInstAdm.update(); }
            }
            const ctxFin = document.getElementById('financeiroChart');
            if (ctxFin && ctxFin.offsetParent !== null) {
                if (!financeiroChartInstAdm) financeiroChartInstAdm = new Chart(ctxFin.getContext('2d'), { type: 'bar', data: { labels: ['Caixa Realizado', 'Projeção Restante'], datasets: [{ label: 'Valor em R$', data: [vVendas, vPendentes], backgroundColor: ['#BC68A1', '#F4B841'], borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } } });
                else { financeiroChartInstAdm.data.datasets[0].data = [vVendas, vPendentes]; financeiroChartInstAdm.update(); }
            }

            window.renderRankingAlunosAdm();
            window.renderRankingEquipeAdm();
            window.renderParceirosListaPaginado();
            window.renderGestaoLotesPaginado();
            window.renderEstoqueLotesAdminPaginado();
            window.renderPendentesAdminPaginado();
            window.renderLogsPaginado();
            window.renderLivroCaixaPaginado();
            window.renderCaixaVendaDiretaAdminPaginado();

            const tabelaRankingEducadoresADM = document.getElementById('tabelaRankingEducadoresADM');
            if(tabelaRankingEducadoresADM) {
                const nomesExcluidos = ['jhersyka', 'debora', 'bruna'];
                let rankingProf = [...window.mockEducadoresBD].filter(e => {
                    let nomeLimpo = e.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                    return !nomesExcluidos.includes(nomeLimpo);
                }).sort((a, b) => b.lotesVendidos - a.lotesVendidos);

                const startIdx = (window.pages.rankProfAdm.current - 1) * 10;
                const paginated = rankingProf.slice(startIdx, startIdx + 10);

                tabelaRankingEducadoresADM.innerHTML = paginated.map((prof, index) => {
                    const valorArrecadado = (prof.lotesVendidos * 20).toFixed(2).replace('.', ',');
                    return `<tr><td class="td-center" style="font-weight: bold; color: var(--petal-pink);">${startIdx + index + 1}º</td><td><strong>${prof.nome}</strong></td><td style="color: var(--dim-grey);">${prof.curso}</td><td class="td-center" style="font-weight: bold; font-size: 1.1rem;">${prof.lotesVendidos}</td><td class="td-center highlight-purple" style="font-weight: bold;">R$ ${valorArrecadado}</td></tr>`;
                }).join('');
                renderPaginationUI('pagRankingEducadores', 'rankProfAdm', rankingProf.length, 10, 'atualizarDashboardsADM');
            }

            let searchBox = `<div style="padding: 10px; position: sticky; top: 0; background: white; border-bottom: 1px solid #eee; z-index: 2;"><input type="text" class="purple-input search-custom-select" placeholder="Pesquisar..." style="padding: 0.5rem; font-size: 0.9rem;" onclick="event.stopPropagation()"></div>`;
            const listaSede = document.getElementById("listaLotesSede");
            if(listaSede) {
                let htmlSede = '';
                let lotesEmUso = [];
                window.todosEducandosBD.forEach(a => { lotesEmUso.push(...a.lotesPendentes); lotesEmUso.push(...a.lotesVendidos); });
                window.todosParceirosBD.forEach(p => { lotesEmUso.push(...p.lotesPendentes); lotesEmUso.push(...p.lotesVendidos); });

                window.lotesSedeBD.forEach(l => {
                    const respInfo = l.educador ? ` (Com ${l.educador})` : ' (Na Sede)';
                    if(lotesEmUso.includes(l.codigo)) {
                        htmlSede += `<label class="checkbox-item-row" style="opacity: 0.5; cursor: not-allowed;"><input type="checkbox" class="roxo-checkbox" value="${l.codigo}" disabled> <span style="color: var(--dim-grey); font-weight: 500; text-decoration: line-through;">${l.codigo}</span> <span style="margin-left:auto; font-size: 0.8rem; color:#a0a0a0;">Em uso</span></label>`;
                    } else {
                        htmlSede += `<label class="checkbox-item-row"><input type="checkbox" class="roxo-checkbox" value="${l.codigo}"> <span style="color: var(--dim-grey); font-weight: 500;">${l.codigo}</span> <span style="margin-left:auto; font-size: 0.8rem; color:var(--petal-pink);">${respInfo}</span></label>`;
                    }
                });
                listaSede.innerHTML = htmlSede || '<div style="padding: 15px; color:#a0a0a0; text-align:center;">Nenhum lote na base.</div>';
            }

            const listaLotesParceiros = document.getElementById("listaLotesParceirosCheckboxes");
            if(listaLotesParceiros) {
                let htmlLotes = '';
                let lotesEmUso = [];
                window.todosParceirosBD.forEach(p => { lotesEmUso.push(...p.lotesPendentes); lotesEmUso.push(...p.lotesVendidos); });
                window.todosEducandosBD.forEach(a => { lotesEmUso.push(...a.lotesPendentes); lotesEmUso.push(...a.lotesVendidos); }); 
                const lotesFiltrados = window.lotesSedeBD.filter(l => l.codigo.toUpperCase().includes('PARC'));
                lotesFiltrados.forEach(l => {
                    if(lotesEmUso.includes(l.codigo)) {
                        htmlLotes += `<label class="checkbox-item-row" style="opacity: 0.5;"><input type="checkbox" class="roxo-checkbox" disabled> <span style="text-decoration: line-through;">${l.codigo}</span> <span style="margin-left:auto; font-size:0.8rem; color:#a0a0a0;">Em uso</span></label>`;
                    } else {
                        htmlLotes += `<label class="checkbox-item-row"><input type="checkbox" class="roxo-checkbox" value="${l.codigo}"> <span>${l.codigo}</span></label>`;
                    }
                });
                listaLotesParceiros.innerHTML = htmlLotes || '<div style="padding:15px; text-align:center; color:#a0a0a0;">Nenhum lote PARC livre na Sede.</div>';
            }

            const selectParceiroAttr = document.getElementById("opcoesParceiroAtribuir");
            const wrapParcAttr = document.getElementById("wrapperParceiroAtribuir");
            if(selectParceiroAttr && wrapParcAttr) {
                let opts = searchBox;
                if(window.todosParceirosBD.length === 0) opts += '<span class="custom-option" data-value="">Nenhum parceiro cadastrado.</span>';
                else window.todosParceirosBD.forEach(p => { opts += `<span class="custom-option" data-value="${p.nome}">${p.nome}</span>`; });
                selectParceiroAttr.innerHTML = opts;
                ativarEventosSelectCustomizado(wrapParcAttr);
            }

            if (window.renderListaAtribuicaoVendaDireta) window.renderListaAtribuicaoVendaDireta();

            const selectEquipeAttr = document.getElementById("opcoesEquipeAtribuir");
            const wrapEquipeAttr = document.getElementById("wrapperEquipeAtribuir");
            if(selectEquipeAttr && wrapEquipeAttr) {
                let optsEquipe = searchBox;
                let equipeDB = window.todosEducandosBD.filter(a => ehVendaDireta(a));
                if(equipeDB.length === 0) optsEquipe += '<span class="custom-option" data-value="">Nenhum colaborador cadastrado.</span>';
                else equipeDB.forEach(c => { optsEquipe += `<span class="custom-option" data-value="${c.nome}">${c.nome}</span>`; });
                selectEquipeAttr.innerHTML = optsEquipe;
                ativarEventosSelectCustomizado(wrapEquipeAttr);
            }

            const opcoesEducador = document.getElementById("opcoesEducadorDestino");
            const wrapEdu = document.getElementById("wrapperEducadorDestino");
            if(opcoesEducador && wrapEdu) {
                let optsEdu = searchBox;
                optsEdu += '<span class="custom-option" data-value="Sede">Devolver para Sede</span>';
                window.mockEducadoresBD.forEach(e => { optsEdu += `<span class="custom-option" data-value="${e.nome}">${e.nome}</span>`; });
                opcoesEducador.innerHTML = optsEdu;
                ativarEventosSelectCustomizado(wrapEdu);
            }
        };

        const formTransferirLote = document.getElementById("formTransferirLote");
        if(formTransferirLote) {
            formTransferirLote.addEventListener("submit", (e) => {
                e.preventDefault();
                const dest = document.getElementById("educadorDestinoVal").value;
                const checkboxes = document.querySelectorAll('#listaLotesSede input[type="checkbox"]:checked');
                const lotesSel = Array.from(checkboxes).map(cb => cb.value);

                if(!dest || lotesSel.length === 0) return window.abrirModalErro("Selecione os lotes e o destino.");
                const btn = formTransferirLote.querySelector("button[type='submit']");
                btn.innerText = "Transferindo..."; btn.disabled = true;

                window.registrarLog("Transferência (Sede)", `Moveu lotes ${lotesSel.join(', ')} para o destino: ${dest}`);
                lotesSel.forEach(cod => { let l = window.lotesSedeBD.find(x => x.codigo === cod); if(l) l.educador = (dest === 'Sede' ? '' : dest); });
                
                fecharModal('modalTransferirLote'); window.abrirModalSucesso("Transferência realizada!");
                window.atualizarDashboardsADM(); formTransferirLote.reset();

                fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'transferir_lotes', lotes: lotesSel, educadorDestino: dest === 'Sede' ? '' : dest }) })
                .then(() => { btn.innerText = "Confirmar Transferência"; btn.disabled = false; })
                .catch(err => { console.error(err); btn.disabled = false; });
            });
        }
        
        const formCadastrarParceiro = document.getElementById("formCadastrarParceiro");
        if(formCadastrarParceiro) {
            formCadastrarParceiro.addEventListener("submit", (e) => {
                e.preventDefault();
                const btn = formCadastrarParceiro.querySelector("button[type='submit']");
                btn.innerText = "Salvando..."; btn.disabled = true;
                const nome = document.getElementById("nomeParceiroInput").value;
                
                fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'cadastrar_parceiro', nome, cartela: "" })
                }).then(res => res.json()).then(data => {
                    btn.innerText = "Salvar Parceiro"; btn.disabled = false;
                    if(data.success) {
                        window.registrarLog("Cadastro Parceiro", `Cadastrou parceiro comercial ${nome}`);
                        fecharModal('modalCadastrarParceiro'); formCadastrarParceiro.reset();
                        window.abrirModalSucesso(data.message); window.carregarDadosDoBanco();
                    } else window.abrirModalErro(data.message);
                }).catch(() => { btn.disabled = false; btn.innerText = "Salvar Parceiro"; });
            });
        }

        const formAtribuirLoteParceiro = document.getElementById("formAtribuirLoteParceiro");
        if(formAtribuirLoteParceiro) {
            formAtribuirLoteParceiro.addEventListener("submit", (e) => {
                e.preventDefault();
                const nomeInput = document.getElementById("parceiroAtribuirSelect").value;
                const checkboxesMarcados = document.querySelectorAll('#listaLotesParceirosCheckboxes input[type="checkbox"]:checked');
                const lotesArray = Array.from(checkboxesMarcados).map(cb => cb.value);

                if(!nomeInput || lotesArray.length === 0) return window.abrirModalErro("Selecione o parceiro e marque pelo menos um lote PARC.");
                const btn = formAtribuirLoteParceiro.querySelector("button[type='submit']");
                btn.innerText = "Atribuindo..."; btn.disabled = true;

                fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'atribuir_lote_parceiro', nome: nomeInput, lotes: lotesArray, responsavel: userName }) })
                .then(res => res.json()).then(data => {
                    btn.innerText = "Confirmar Atribuição"; btn.disabled = false;
                    if(data.success) {
                        window.registrarLog("Atribuição Parceiro", `Atribuiu lotes ${lotesArray.join(', ')} para o parceiro ${nomeInput}`);
                        fecharModal('modalAtribuirLoteParceiro'); formAtribuirLoteParceiro.reset(); 
                        window.abrirModalSucesso("Lotes PARC atribuídos com sucesso!"); window.carregarDadosDoBanco(); 
                    } else window.abrirModalErro(data.message);
                }).catch(() => { btn.disabled = false; btn.innerText = "Confirmar Atribuição"; });
            });
        }

        const formCadastrarColaborador = document.getElementById("formCadastrarColaborador");
        if(formCadastrarColaborador) {
            formCadastrarColaborador.addEventListener("submit", (e) => {
                e.preventDefault();
                const btn = formCadastrarColaborador.querySelector("button[type='submit']");
                btn.innerText = "Enviando para Nuvem..."; btn.disabled = true;
                const nome = document.getElementById("nomeColaboradorInput").value;

                if(window.fotoFileGlobal && window.tipoCadastroFoto === 'colaborador') {
                    const formData = new FormData(); 
                    formData.append('file', window.fotoFileGlobal); 
                    formData.append('upload_preset', CLOUDINARY_PRESET);
                    
                    fetch(CLOUDINARY_URL, { method: 'POST', body: formData })
                    .then(r => r.json()).then(dataImg => {
                        if(dataImg.secure_url) { salvarColaboradorBanco(nome, dataImg.secure_url, btn); } 
                        else { window.abrirModalErro("Falha na imagem"); btn.innerText = "Salvar Vendedor Direto"; btn.disabled = false; }
                    }).catch(() => { window.abrirModalErro("Erro de rede."); btn.innerText = "Salvar Vendedor Direto"; btn.disabled = false; });
                } else { salvarColaboradorBanco(nome, "", btn); }
            });
        }

        function salvarColaboradorBanco(nome, fotoUrl, btn) {
            fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'cadastrar_colaborador_vendedor', nome: nome, cargo: 'Venda Direta', fotoUrl: fotoUrl })
            }).then(res => res.json()).then(data => {
                btn.innerText = "Salvar Vendedor Direto"; btn.disabled = false;
                if(data.success) {
                    window.registrarLog("Cadastro Venda Direta", `Cadastrou o vendedor direto ${nome}`);
                    fecharModal('modalCadastrarColaborador'); 
                    const form = document.getElementById("formCadastrarColaborador");
                    if(form) form.reset();
                    window.fotoFileGlobal = null; 
                    if(document.getElementById('previewFotoColaborador')) document.getElementById('previewFotoColaborador').style.display = 'none'; 
                    if(document.getElementById('iconCameraColaborador')) document.getElementById('iconCameraColaborador').style.display = 'block';
                    window.abrirModalSucesso(data.message); window.carregarDadosDoBanco();
                } else { window.abrirModalErro(data.message); }
            }).catch(() => { btn.disabled = false; window.abrirModalErro("Erro de rede."); });
        }

        const formAtribuirLoteEquipe = document.getElementById("formAtribuirLoteEquipe");
        if(formAtribuirLoteEquipe) {
            formAtribuirLoteEquipe.addEventListener("submit", (e) => {
                e.preventDefault();
                const nomeInput = document.getElementById("equipeAtribuirSelect").value;
                const checkboxesMarcados = document.querySelectorAll('#listaLotesEquipeCheckboxes input[type="checkbox"]:checked');
                const lotesMarcados = Array.from(checkboxesMarcados).map(cb => cb.value);
                const lotesDigitados = obterLotesDigitadosManual('inputLotesVendaDiretaManual');
                const lotesArray = Array.from(new Map([...lotesMarcados, ...lotesDigitados].map(l => [normalizarCodigoLote(l), l.trim()])).values()).filter(Boolean);

                if(!nomeInput || lotesArray.length === 0) return window.abrirModalErro("Selecione o vendedor direto e informe pelo menos um lote disponível.");

                const mapaDisponiveis = new Map(coletarLotesDisponiveisVendaDireta().map(item => [normalizarCodigoLote(item.lote), item.lote]));
                const invalidos = lotesArray.filter(lote => !mapaDisponiveis.has(normalizarCodigoLote(lote)));
                if (invalidos.length) return window.abrirModalErro(`Lote(s) indisponível(is) para Venda Direta: ${invalidos.join(', ')}. Confira se já estão vendidos ou pendentes com educando/parceiro.`);

                const btn = formAtribuirLoteEquipe.querySelector("button[type='submit']");
                btn.innerText = "Atribuindo..."; btn.disabled = true;

                fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'atribuir_lote', nomeAluno: nomeInput, lotes: lotesArray, tipoPessoa: 'Venda Direta', responsavel: userName }) })
                .then(res => res.json()).then(data => {
                    btn.innerText = "Confirmar Atribuição"; btn.disabled = false;
                    if(data.success) {
                        window.registrarLog("Atribuição Venda Direta", `Separou/atribuiu lotes ${lotesArray.join(', ')} para Venda Direta com referência em ${nomeInput}`);
                        fecharModal('modalAtribuirLoteEquipe'); formAtribuirLoteEquipe.reset(); 
                        window.abrirModalSucesso("Lotes separados para venda direta com sucesso! Eles continuam acessíveis para a Venda Direta e só ficarão válidos após confirmação da venda."); window.carregarDadosDoBanco(); 
                    } else window.abrirModalErro(data.message);
                }).catch(() => { btn.disabled = false; window.abrirModalErro("Erro de rede."); });
            });
        }
    }

    // ==========================================
    // MODAIS E DISPARO DE TRANSAÇÕES UNIFICADAS
    // ==========================================
    window.abrirModal = function(id) { document.getElementById(id).classList.add('active'); }
    window.fecharModal = function(id) { document.getElementById(id).classList.remove('active'); }
    window.abrirModalSucesso = function(txt) { document.getElementById('textoModalSucesso').innerText = txt; abrirModal('modalSucesso'); }
    window.abrirModalErro = function(txt) { const pErro = document.getElementById('textoModalErro'); if(pErro) pErro.innerText = txt; abrirModal('modalErro'); }
    window.toggleMisto = function(mostrar) { document.getElementById('camposMisto').style.display = mostrar ? 'flex' : 'none'; }

    window.abrirDetalhesAluno = function(idx, tipo = 'Educando') {
        window.alunoEmFocoIdx = idx; 
        window.tipoPessoaEmFoco = tipo;
        const isAdmin = document.getElementById('adminPage') !== null;
        
        const pessoa = (tipo === 'Parceiro') ? window.todosParceirosBD[idx] : window.todosEducandosBD[idx]; 
        
        const elFoto = document.getElementById('detalheFoto'); if(elFoto) elFoto.src = pessoa.foto;
        const elNome = document.getElementById('detalheNome'); if(elNome) elNome.innerText = pessoa.nome;
        
        const elTurma = document.getElementById('detalheTurma'); 
        if(elTurma) {
            if (tipo === 'Parceiro') elTurma.innerText = `Comércio - Parceiro`;
            else if (ehVendaDireta(pessoa)) elTurma.innerText = `Venda Direta`;
            else elTurma.innerText = `${pessoa.curso} - ${pessoa.turma}`;
        }
        
        const recompensas = calcularRecompensas(pessoa.lotesVendidos.length);
        const elFone = document.getElementById('detalheFone'); if(elFone) elFone.innerText = recompensas.fone;
        const elCartelas = document.getElementById('detalheCartelasGanhas'); if(elCartelas) elCartelas.innerText = recompensas.cartelas;
        
        let pendentesEntrega = recompensas.cartelas - (pessoa.cartelasEntregues || 0);
        const boxRetirar = document.getElementById('boxRetirarCartela');
        if (boxRetirar) {
            if (pendentesEntrega > 0 && !isAdmin) { 
                boxRetirar.style.display = 'block';
                document.getElementById('detalheCartelasPendentes').innerText = pendentesEntrega;
                document.getElementById('btnRetirarCartela').onclick = () => window.registrarRetiradaCartela(idx);
            } else { boxRetirar.style.display = 'none'; }
        }

        const elVendidos = document.getElementById('detalheQtdVendidos'); if(elVendidos) elVendidos.innerText = pessoa.lotesVendidos.length;
        const elPendentes = document.getElementById('detalheQtdPendentes'); if(elPendentes) elPendentes.innerText = pessoa.lotesPendentes.length;
        const elDevolvidos = document.getElementById('detalheQtdDevolvidos'); if(elDevolvidos) elDevolvidos.innerText = pessoa.lotesDevolvidos ? pessoa.lotesDevolvidos.length : 0;
        
        const badgeVendidos = pessoa.lotesVendidos.length ? pessoa.lotesVendidos.map(l => `<span class="badge-lote">${l}</span>`).join('') : '<span class="badge-lote vazio">Nenhum</span>';
        let badgePendentes = '<span class="badge-lote vazio">Nenhum</span>';
        if(pessoa.lotesPendentes.length) {
            if(isAdmin) {
                const cliquePend = document.getElementById('msgCliquePendente'); if(cliquePend) cliquePend.style.display = 'block';
                badgePendentes = pessoa.lotesPendentes.map(l => `<span class="badge-lote" style="border: 1px dashed var(--sunflower-gold); cursor:pointer;" title="Gerenciar Lote" onclick="abrirAcaoLote('${l}', ${idx}, '${tipo}'); event.stopPropagation();">${l} ⚙️</span>`).join('');
            } else {
                const cliquePend = document.getElementById('msgCliquePendente'); if(cliquePend) cliquePend.style.display = 'none';
                badgePendentes = pessoa.lotesPendentes.map(l => `<span class="badge-lote">${l}</span>`).join('');
            }
        } else {
            const cliquePend = document.getElementById('msgCliquePendente'); if(cliquePend) cliquePend.style.display = 'none';
        }
        
        const badgeDevolvidos = pessoa.lotesDevolvidos && pessoa.lotesDevolvidos.length ? pessoa.lotesDevolvidos.map(l => `<span class="badge-lote">${l}</span>`).join('') : '<span class="badge-lote vazio">Nenhum</span>';
        
        const bV = document.getElementById('detalheBadgesVendidos'); if(bV) bV.innerHTML = badgeVendidos;
        const bP = document.getElementById('detalheBadgesPendentes'); if(bP) bP.innerHTML = badgePendentes;
        const bD = document.getElementById('detalheBadgesDevolvidos'); if(bD) bD.innerHTML = badgeDevolvidos;
        
        abrirModal('modalDetalhesAluno');
    }

    window.registrarRetiradaCartela = function(idx) {
        const aluno = window.todosEducandosBD[idx];
        aluno.cartelasEntregues += 1; 
        window.registrarLog("Retirada Cartela Extra", `O Aluno ${aluno.nome} retirou +1 cartela física.`);
        abrirDetalhesAluno(idx); 
        fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'entregar_cartela', nomeAluno: aluno.nome }) }).catch(err => console.error(err));
    }

    window.abrirAcaoLote = function(lote, idxAluno, tipo = 'Educando') {
        if(window.lotesValidadosNestaSessao.has(lote)) {
            return window.abrirModalErro("Esse Lote já está faturado ou processado!");
        }
        const pessoa = (tipo === 'Parceiro') ? window.todosParceirosBD[idxAluno] : window.todosEducandosBD[idxAluno];
        document.getElementById('acaoLoteNome').innerText = lote;
        document.getElementById('acaoLoteAluno').innerText = pessoa.nome;
        const tituloModalAcao = document.getElementById('acaoModalTitulo');
        const contextoModalAcao = document.getElementById('acaoLoteContexto');
        const notaModalAcao = document.getElementById('acaoLoteNota');
        if (tituloModalAcao) tituloModalAcao.innerText = 'Validação de Lote';
        if (contextoModalAcao) contextoModalAcao.innerText = tipo === 'Parceiro' ? 'Parceiro • venda oficial' : 'Educando • venda oficial';
        if (notaModalAcao) notaModalAcao.style.display = 'none';
        document.getElementById('acaoLoteInput').value = lote;
        document.getElementById('acaoAlunoIdxInput').value = idxAluno;
        document.getElementById('modalAcaoLote').setAttribute('data-tipo', tipo);
        const btnDev = document.getElementById('btnModalDevolverLote');
        const btnVenda = document.getElementById('btnModalConfirmarVendaLote');
        if (btnDev) btnDev.style.display = '';
        if (btnVenda) btnVenda.innerText = 'Confirmar Venda';
        
        const radioPix = document.querySelector('input[name="formaPagamentoLote"][value="PIX"]');
        if(radioPix) radioPix.checked = true;
        window.toggleMisto(false); document.getElementById('valorPixMisto').value = ''; document.getElementById('valorDinMisto').value = '';

        fecharModal('modalDetalhesAluno'); abrirModal('modalAcaoLote');
    }

    window.confirmarVendaLote = function() {
        const lote = document.getElementById('acaoLoteInput').value;
        const idx = document.getElementById('acaoAlunoIdxInput').value;
        const tipo = document.getElementById('modalAcaoLote').getAttribute('data-tipo') || 'Educando';
        const isVendaDireta = tipo === 'VendaDireta' || tipo === 'Venda Direta';
        const pessoa = (tipo === 'Parceiro') ? window.todosParceirosBD[idx] : window.todosEducandosBD[idx];
        const formaPagamento = document.querySelector('input[name="formaPagamentoLote"]:checked').value;
        let vPix = 0, vDin = 0;

        if (formaPagamento === "PIX") { vPix = 20.00; } 
        else if (formaPagamento === "Dinheiro") { vDin = 20.00; } 
        else {
            vPix = parseFloat(document.getElementById('valorPixMisto').value) || 0;
            vDin = parseFloat(document.getElementById('valorDinMisto').value) || 0;
            if (vPix + vDin !== 20.00) return window.abrirModalErro(`A soma deve dar R$ 20,00.`);
        }

        if(window.lotesValidadosNestaSessao.has(lote)) {
            fecharModal('modalAcaoLote');
            return window.abrirModalErro("Você já faturou este lote. Aguarde a sincronização.");
        }

        if (isVendaDireta) {
            const validacao = validarDisponibilidadeVendaDireta(lote);
            if (!validacao.ok) return window.abrirModalErro(validacao.message);
        }

        window.lotesValidadosNestaSessao.add(lote); 
        const idTxAtual = "TX-" + new Date().getTime();
        const dataHoraAtual = new Date().toLocaleString('pt-BR');
        const categoria = isVendaDireta ? 'Venda Direta' : tipo;
        if (isVendaDireta) {
            if (vPix > 0) window.caixaVendaDiretaBD.push({ 'Data_Hora': dataHoraAtual, 'ID_Transacao': `${idTxAtual}-PIX`, 'Lote': lote, 'Vendedor': pessoa.nome, 'Valor': vPix, 'Metodo_Pagamento': 'PIX', 'Responsavel': userName, 'Status_Conferencia': 'Pendente' });
            if (vDin > 0) window.caixaVendaDiretaBD.push({ 'Data_Hora': dataHoraAtual, 'ID_Transacao': `${idTxAtual}-DIN`, 'Lote': lote, 'Vendedor': pessoa.nome, 'Valor': vDin, 'Metodo_Pagamento': 'Dinheiro', 'Responsavel': userName, 'Status_Conferencia': 'Pendente' });
        } else {
            if (vPix > 0) window.caixaGlobalBD.push({ 'Data_Hora': dataHoraAtual, 'ID_Transacao': idTxAtual, 'Lote': lote, 'Educando': pessoa.nome, 'Valor': vPix, 'Metodo_Pagamento': 'PIX', 'Responsavel': userName, 'Categoria': categoria });
            if (vDin > 0) window.caixaGlobalBD.push({ 'Data_Hora': dataHoraAtual, 'ID_Transacao': idTxAtual, 'Lote': lote, 'Educando': pessoa.nome, 'Valor': vDin, 'Metodo_Pagamento': 'Dinheiro', 'Responsavel': userName, 'Categoria': categoria });
            window.caixaGlobal.pixReais += vPix; window.caixaGlobal.dinReais += vDin;
        }
        if (!isVendaDireta) pessoa.lotesPendentes = pessoa.lotesPendentes.filter(l => normalizarCodigoLote(l) !== normalizarCodigoLote(lote));
        if (!pessoa.lotesVendidos.some(l => normalizarCodigoLote(l) === normalizarCodigoLote(lote))) pessoa.lotesVendidos.push(lote);
        if (isVendaDireta) {
            window.todosEducandosBD.forEach(p => {
                if (ehVendaDireta(p) && Array.isArray(p.lotesPendentes)) p.lotesPendentes = p.lotesPendentes.filter(l => normalizarCodigoLote(l) !== normalizarCodigoLote(lote));
                if (!ehVendaDireta(p) && Array.isArray(p.lotesDevolvidos)) p.lotesDevolvidos = p.lotesDevolvidos.filter(l => normalizarCodigoLote(l) !== normalizarCodigoLote(lote));
            });
        }
        
        fecharModal('modalAcaoLote'); window.abrirModalSucesso(isVendaDireta ? "Venda direta validada e enviada para conferência do admin!" : "Venda confirmada!"); 
        window.registrarLog(isVendaDireta ? "Validação Venda Direta" : "Validação Venda", `Lote ${lote} validado para ${pessoa.nome} (${categoria}). Pagamento: R$ ${vPix+vDin} via ${formaPagamento}`);
        if(document.getElementById("adminPage")) window.atualizarDashboardsADM(); 
        if(document.getElementById("educadorPage")) window.atualizarDashboardEducador();

        fetch(SCRIPT_URL, {
            method: 'POST', body: JSON.stringify({ action: isVendaDireta ? 'venda_direta_lote' : 'transacao_lote', acaoLote: 'venda', lote: lote, nome: pessoa.nome, nomeAluno: pessoa.nome, tipoPessoa: categoria, vPix: vPix, vDin: vDin, responsavel: userName })
        }).catch(err => console.error("Erro", err));
    }

    window.confirmarDevolucaoLote = function() {
        const lote = document.getElementById('acaoLoteInput').value;
        const idx = document.getElementById('acaoAlunoIdxInput').value;
        const tipo = document.getElementById('modalAcaoLote').getAttribute('data-tipo') || 'Educando';
        const pessoa = (tipo === 'Parceiro') ? window.todosParceirosBD[idx] : window.todosEducandosBD[idx];
        
        if(window.lotesValidadosNestaSessao.has(lote)) {
            fecharModal('modalAcaoLote');
            return window.abrirModalErro("Você já processou este lote. Aguarde a sincronização.");
        }
        window.lotesValidadosNestaSessao.add(lote);

        pessoa.lotesPendentes = pessoa.lotesPendentes.filter(l => l !== lote);
        if(!pessoa.lotesDevolvidos) pessoa.lotesDevolvidos = [];
        pessoa.lotesDevolvidos.push(lote);
        
        fecharModal('modalAcaoLote'); window.abrirModalSucesso("Lote devolvido com sucesso!"); 
        window.registrarLog("Devolução Lote", `Lote ${lote} devolvido por ${pessoa.nome} (${tipo})`);
        if(document.getElementById("adminPage")) window.atualizarDashboardsADM();
        if(document.getElementById("educadorPage")) window.atualizarDashboardEducador();

        fetch(SCRIPT_URL, {
            method: 'POST', body: JSON.stringify({ action: 'transacao_lote', acaoLote: 'devolucao', lote: lote, nome: pessoa.nome, nomeAluno: pessoa.nome, tipoPessoa: tipo, responsavel: userName })
        }).catch(err => console.error("Erro", err));
    }

    if (document.getElementById("adminPage") || document.getElementById("educadorPage")) {
        window.carregarDadosDoBanco();
    }
});
