document.addEventListener("DOMContentLoaded", () => {
    
    // ==========================================
    // FUNÇÕES DE UTILIDADE (HELPER)
    // ==========================================
    /**
     * Compara dois textos ignorando acentos, espaços extras e maiúsculas.
     * Essencial para que filtros de "Turma 4" e "Instalador" não falhem.
     */
    function textoIgual(t1, t2) {
        if(!t1 || !t2) return false;
        return t1.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() === 
               t2.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    }

    // ==========================================
    // CONFIGURAÇÕES GERAIS E APIS
    // ==========================================
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwWD-pi7qf1Vlp01I8CO-7euJmqsNureruSEjeFc9bdYUZ_M13he6bqBC_ctJGHUpc4ow/exec'; 
    const IMGBB_API_KEY = '699c158483746240a585454fdfb09cac';
    
    const userName = localStorage.getItem('usuarioLogado') || 'Administrador';
    
    window.fotoFileGlobal = null; 
    let cropperInstancia = null;
    let estoqueChartInstEdu = null; 
    let financeiroChartInstEdu = null;
    let estoqueChartInstAdm = null; 
    let financeiroChartInstAdm = null;

    // ESTADO DO BANCO EM MEMÓRIA
    window.caixaGlobal = { pixReais: 0.00, dinReais: 0.00 };
    window.caixaGlobalBD = []; 
    window.todosEducandosBD = []; 
    window.mockEducadoresBD = [];
    window.lotesSedeBD = []; 
    window.logsDoSistema = [];

    // ==========================================
    // SISTEMA DE PAGINAÇÃO (ESTADO GLOBAL)
    // ==========================================
    window.paginacao = {
        minhaTurma: 0,
        rankingAlunosADM: 0,
        rankingEducadoresADM: 0,
        rankingGeralEdu: 0,
        livroCaixa: 0,
        logs: 0,
        itensPorPagina: 10
    };

    /**
     * Altera a página atual de uma lista e dispara a atualização da UI.
     */
    window.mudarPagina = function(chave, direcao) {
        window.paginacao[chave] += direcao;
        // Garante que não existam páginas negativas
        if (window.paginacao[chave] < 0) window.paginacao[chave] = 0;
        
        // Renderiza novamente a tela ativa
        if(document.getElementById("educadorPage")) window.atualizarDashboardEducador();
        if(document.getElementById("adminPage")) window.atualizarDashboardsADM();
    };

    /**
     * Gera o HTML dos botões de navegação da página.
     */
    function gerarControlesPaginacao(chave, totalItens) {
        const totalPaginas = Math.ceil(totalItens / window.paginacao.itensPorPagina);
        const paginaAtual = window.paginacao[chave];

        if (totalPaginas <= 1) return "";

        return `
            <div class="paginacao-container flex-center" style="margin-top: 15px; padding: 10px; gap: 15px; border-top: 1px solid #eee; background: #fafafa; border-radius: 0 0 12px 12px;">
                <button class="btn-secondary" style="padding: 5px 12px; font-size: 0.8rem;" ${paginaAtual === 0 ? 'disabled' : ''} onclick="window.mudarPagina('${chave}', -1)">Anterior</button>
                <span style="font-size: 0.85rem; font-weight: 600; color: var(--dim-grey);">Página ${paginaAtual + 1} de ${totalPaginas}</span>
                <button class="btn-secondary" style="padding: 5px 12px; font-size: 0.8rem;" ${paginaAtual >= totalPaginas - 1 ? 'disabled' : ''} onclick="window.mudarPagina('${chave}', 1)">Próximo</button>
            </div>
        `;
    }

    // ==========================================
    // LOGS E AUDITORIA
    // ==========================================
    window.registrarLog = function(acao, detalhe) {
        const dataHora = new Date().toLocaleString('pt-BR');
        const sessao = window.innerWidth <= 768 ? 'Mobile' : 'Desktop';
        fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'registrar_log', dataHora, responsavel: userName, sessao, acao, detalhe, localizacao: 'Sistema Web' })
        }).catch(e => console.error("Erro ao registrar log", e));
    }

    // ==========================================
    // CUSTOM SELECTS (LÓGICA DE INTERAÇÃO)
    // ==========================================
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
        if(searchInput) {
            searchInput.value = '';
            wrapperNode.querySelectorAll('.custom-option').forEach(opt => opt.style.display = 'block');
        }

        hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
        e.stopPropagation();
    }

    function ativarEventosSelectCustomizado(wrapperNode) {
        const options = wrapperNode.querySelectorAll('.custom-option');
        options.forEach(option => {
            option.removeEventListener('click', window.bindOptionClick);
            option.addEventListener('click', window.bindOptionClick);
        });
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

    // ==========================================
    // NAVEGAÇÃO SPA (SINGLE PAGE APPLICATION)
    // ==========================================
    window.mudarAbaEducador = function(secId, navId) {
        const todasSecoes = document.querySelectorAll('main.admin-container > section');
        todasSecoes.forEach(sec => sec.style.display = 'none');
        
        const todosNavs = document.querySelectorAll('.sidebar-nav .nav-item');
        todosNavs.forEach(nav => nav.classList.remove('active'));
        
        const secClicada = document.getElementById(secId);
        if(secClicada) secClicada.style.display = 'block';
        
        const navClicado = document.getElementById(navId);
        if(navClicado) navClicado.classList.add('active');
        
        if(window.innerWidth <= 768) { 
            const side = document.getElementById('sidebar');
            if(side) side.classList.remove('open'); 
        }
        
        if(document.getElementById("educadorPage")) window.atualizarDashboardEducador();
        if(document.getElementById("adminPage")) window.atualizarDashboardsADM();
    }

    const sidebar = document.getElementById('sidebar');
    const openSidebarBtn = document.getElementById('openSidebar');
    const closeSidebarBtn = document.getElementById('closeSidebar');
    if(sidebar) {
        if(openSidebarBtn) openSidebarBtn.addEventListener('click', () => sidebar.classList.add('open'));
        if(closeSidebarBtn) closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('open'));
    }

    // ==========================================
    // CARGA DE DADOS DO GOOGLE SHEETS
    // ==========================================
    window.carregarDadosDoBanco = function(recarregarTelas = true) {
        const btnSync = document.getElementById('nomeEducador');
        if(btnSync) btnSync.innerText = "Sincronizando...";

        fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'sincronizar_dados' }) })
        .then(res => res.json())
        .then(data => {
            if(data.success) {
                window.lotesSedeBD = data.lotesSede.map(l => ({
                    codigo: l['Codigo_Lote'] || l['ID do Lote'], educador: l['Responsavel_Atual'] || l['Educador_Destino'] || ''
                })).filter(l => l.codigo);

                window.todosEducandosBD = data.educandos.map(e => ({
                    nome: e['Nome_Educando'] || e['Nome'], curso: e['Curso'], turma: e['Turma'], periodo: e['Periodo'], 
                    educadorResponsavel: e['Educador_Responsavel'] || '',
                    cadastroAtivo: e['Cadastro_Ativo'] || '',
                    foto: e['Foto_URL'] && String(e['Foto_URL']).trim() !== '' ? e['Foto_URL'] : `https://ui-avatars.com/api/?name=${e['Nome_Educando'] || e['Nome']}&background=BC68A1&color=fff`,
                    lotesPendentes: e['Lotes_Pendentes'] ? String(e['Lotes_Pendentes']).split(',').map(s=>s.trim()).filter(Boolean) : [],
                    lotesVendidos: e['Lotes_Vendidos'] ? String(e['Lotes_Vendidos']).split(',').map(s=>s.trim()).filter(Boolean) : [],
                    lotesDevolvidos: e['Lotes_Devolvidos'] ? String(e['Lotes_Devolvidos']).split(',').map(s=>s.trim()).filter(Boolean) : [],
                    cartelasEntregues: parseInt(e['Cartelas_Entregue']) || 0
                }));

                window.mockEducadoresBD = data.educadores.map(e => {
                    let vendidos = 0; let pendentes = 0;
                    window.todosEducandosBD.forEach(al => {
                        if(textoIgual(al.educadorResponsavel, e['Nome'])) { vendidos += al.lotesVendidos.length; pendentes += al.lotesPendentes.length; }
                    });
                    let retiradosSede = window.lotesSedeBD.filter(l => textoIgual(l.educador, e['Nome'])).length;
                    return { nome: e['Nome'], curso: e['Curso Responsavel'], lotesRetiradosSede: retiradosSede, lotesVendidos: vendidos, lotesPendentes: pendentes };
                });

                window.caixaGlobal = { pixReais: 0, dinReais: 0 };
                window.caixaGlobalBD = data.caixaGlobal || []; 
                if (data.caixaGlobal) {
                    data.caixaGlobal.forEach(transacao => {
                        let valor = parseFloat(transacao['Valor']) || parseFloat(transacao['Valor_Total']) || 0;
                        if(transacao['Metodo_Pagamento'] === 'PIX') window.caixaGlobal.pixReais += valor;
                        if(transacao['Metodo_Pagamento'] === 'Dinheiro') window.caixaGlobal.dinReais += valor;
                    });
                }
                
                window.logsDoSistema = data.logs || [];

                if(btnSync) btnSync.innerText = userName;
                if (recarregarTelas) {
                    if(document.getElementById("adminPage")) window.atualizarDashboardsADM();
                    if(document.getElementById("educadorPage")) window.atualizarDashboardEducador();
                }
            }
        }).catch(err => { console.error(err); if(btnSync) btnSync.innerText = "Erro!"; });
    }

    // ==========================================
    // LÓGICA DE LOGIN
    // ==========================================
    const loginForm = document.getElementById("loginForm");
    if(loginForm) {
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault(); 
            const educadorInput = document.getElementById('educadorSelect') || document.querySelector('input[type="hidden"]');
            const educador = educadorInput ? educadorInput.value : null;
            const senha = document.getElementById("senhaInput").value;

            if(!educador || senha.length !== 6) return window.abrirModalErro("Selecione seu nome e digite a senha.");
            const btn = document.querySelector(".btn-primary");
            btn.innerText = "Conectando..."; btn.disabled = true;

            fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'login', educador: educador, senha: senha }) })
            .then(res => res.json()).then(data => {
                if (data.success) { 
                    localStorage.setItem('usuarioLogado', educador);
                    window.location.href = (data.nivelAcesso === "ADM") ? "admin.html" : "educador.html"; 
                } else { btn.innerText = "Acessar Sistema"; btn.disabled = false; window.abrirModalErro(data.message); }
            }).catch(() => { btn.disabled = false; btn.innerText = "Acessar Sistema"; window.abrirModalErro("Erro de rede."); });
        });
    }

    function calcularRecompensas(qtdVendidos) {
        let fone = qtdVendidos >= 10 ? 1 : 0;
        let cartelas = qtdVendidos >= 10 ? 1 + Math.floor((qtdVendidos - 10) / 5) : 0;
        return { fone, cartelas };
    }

    // ==========================================
    // LÓGICA DO EDUCADOR (MINHA TURMA E RANKINGS)
    // ==========================================
    const educadorPage = document.getElementById("educadorPage");
    if (educadorPage) {
        document.getElementById('nomeEducador').innerText = userName;
        window.carregarDadosDoBanco();

        const buscaNome = document.getElementById('buscaNomeAluno');
        const filtroTurmaInput = document.getElementById('filtroTurmaAluno');
        
        // Sempre que pesquisar, volta para a página 1 para não perder resultados
        if(buscaNome) buscaNome.addEventListener('input', () => { window.paginacao.minhaTurma = 0; window.atualizarDashboardEducador(); });
        if(filtroTurmaInput) filtroTurmaInput.addEventListener('change', () => { window.paginacao.minhaTurma = 0; window.atualizarDashboardEducador(); });

        window.atualizarDashboardEducador = function() {
            // FILTRO ROBUSTO PARA RESOLVER O PROBLEMA DA TURMA 4 (INSTALADOR)
            let meusAlunosFiltrados = window.todosEducandosBD.filter(a => {
                const eDoProfessor = textoIgual(a.educadorResponsavel, userName);
                const estaAtivo = (a.cadastroAtivo.toLowerCase() === 'sim' || a.lotesVendidos.length > 0 || a.lotesPendentes.length > 0);
                
                // Filtro por Nome na busca
                const termo = buscaNome ? buscaNome.value.toLowerCase() : "";
                const bateNome = a.nome.toLowerCase().includes(termo);
                
                // Filtro por Turma do Dropdown (Ignora acentos e espaços)
                const selecionada = filtroTurmaInput ? filtroTurmaInput.value : "Todas";
                const bateTurma = (selecionada === "Todas" || textoIgual(a.turma, selecionada));
                
                return eDoProfessor && estaAtivo && bateNome && bateTurma;
            }); 

            // RENDERIZAÇÃO DA TABELA "MINHA TURMA" COM PAGINAÇÃO
            const tabela = document.getElementById("tabelaAlunos");
            if (tabela) {
                const totalFiltrados = meusAlunosFiltrados.length;
                const inicio = window.paginacao.minhaTurma * window.paginacao.itensPorPagina;
                const sliceAlunos = meusAlunosFiltrados.slice(inicio, inicio + window.paginacao.itensPorPagina);

                tabela.innerHTML = "";
                sliceAlunos.forEach((aluno, indexLocal) => {
                    const posGlobal = inicio + indexLocal + 1;
                    const rec = calcularRecompensas(aluno.lotesVendidos.length);
                    const cartelasHTML = rec.cartelas > 0 ? `<div class="flex-center" style="font-weight:bold; color:var(--sunflower-gold);">${rec.cartelas} <span class="material-symbols-outlined" style="font-size:1.1rem;">description</span></div>` : '-';
                    const foneHTML = rec.fone > 0 ? '<span class="material-symbols-outlined" style="color:var(--petal-pink);">headphones</span>' : '-';
                    
                    tabela.innerHTML += `
                        <tr onclick="abrirDetalhesAluno(${window.todosEducandosBD.indexOf(aluno)})">
                            <td class="td-center" style="font-weight: bold; color: var(--petal-pink);">${posGlobal}</td>
                            <td><img src="${aluno.foto}" class="table-avatar"></td>
                            <td><strong>${aluno.nome}</strong><br><small style="color:#a0a0a0">${aluno.curso} - ${aluno.turma}</small></td>
                            <td class="td-center">${aluno.lotesVendidos.length + aluno.lotesPendentes.length}</td>
                            <td class="td-center highlight-purple" style="font-weight:bold;">${aluno.lotesVendidos.length}</td>
                            <td class="td-center ${aluno.lotesPendentes.length > 0 ? 'td-highlight' : ''}">${aluno.lotesPendentes.length}</td>
                            <td class="td-center">${cartelasHTML}</td>
                            <td class="td-center">${foneHTML}</td>
                        </tr>`;
                });

                if(totalFiltrados === 0) tabela.innerHTML = '<tr><td colspan="8" class="text-center" style="padding: 20px; color: #a0a0a0;">Nenhum aluno encontrado nesta seleção.</td></tr>';
                
                // Injetar os botões de controle de página
                const container = tabela.closest('.table-container');
                const controleAntigo = container.querySelector('.paginacao-container');
                if (controleAntigo) controleAntigo.remove();
                container.insertAdjacentHTML('beforeend', gerarControlesPaginacao('minhaTurma', totalFiltrados));
            }

            // ATUALIZAÇÃO DOS KPIs FINANCEIROS E GERAIS
            let totalPendentesGeral = 0, totalVendidosGeral = 0;
            window.todosEducandosBD.forEach(a => { totalPendentesGeral += a.lotesPendentes.length; totalVendidosGeral += a.lotesVendidos.length; });

            const meuPerfil = window.mockEducadoresBD.find(e => textoIgual(e.nome, userName));
            if(meuPerfil) {
                const disponivel = meuPerfil.lotesRetiradosSede - (meuPerfil.lotesVendidos + meuPerfil.lotesPendentes);
                if(document.getElementById('kpiEducadorVendidos')) document.getElementById('kpiEducadorVendidos').innerText = meuPerfil.lotesVendidos;
                if(document.getElementById('kpiEducadorPendentes')) document.getElementById('kpiEducadorPendentes').innerText = meuPerfil.lotesPendentes;
                if(document.getElementById('kpiEducadorEstoque')) document.getElementById('kpiEducadorEstoque').innerText = Math.max(0, disponivel);
            }

            const vVendas = window.caixaGlobal.pixReais + window.caixaGlobal.dinReais;
            const vPendentes = totalPendentesGeral * 20.00;
            if(document.getElementById('kpiVendasReaisGlobal')) document.getElementById('kpiVendasReaisGlobal').innerText = `R$ ${vVendas.toFixed(2).replace('.', ',')}`;
            if(document.getElementById('kpiCaixaPix')) document.getElementById('kpiCaixaPix').innerText = `R$ ${window.caixaGlobal.pixReais.toFixed(2).replace('.', ',')}`;
            if(document.getElementById('kpiCaixaDinheiro')) document.getElementById('kpiCaixaDinheiro').innerText = `R$ ${window.caixaGlobal.dinReais.toFixed(2).replace('.', ',')}`;
            if(document.getElementById('kpiProjecaoGlobal')) document.getElementById('kpiProjecaoGlobal').innerText = `R$ ${vPendentes.toFixed(2).replace('.', ',')}`;

            // RANKING DE EDUCANDOS (EDUCADOR) COM PAGINAÇÃO
            const tabelaRanking = document.getElementById("tabelaRankingEducador");
            if(tabelaRanking) {
                let rankingData = [...window.todosEducandosBD].filter(a => a.lotesVendidos.length > 0).sort((a, b) => b.lotesVendidos.length - a.lotesVendidos.length);
                const inicioR = window.paginacao.rankingGeralEdu * window.paginacao.itensPorPagina;
                const sliceRanking = rankingData.slice(inicioR, inicioR + window.paginacao.itensPorPagina);

                tabelaRanking.innerHTML = "";
                sliceRanking.forEach((aluno, idxLocal) => {
                    const pos = inicioR + idxLocal + 1;
                    const destaque = textoIgual(aluno.educadorResponsavel, userName) ? 'background-color: rgba(188, 104, 161, 0.05);' : '';
                    tabelaRanking.innerHTML += `
                        <tr style="${destaque}" onclick="abrirDetalhesAluno(${window.todosEducandosBD.indexOf(aluno)})">
                            <td class="td-center" style="font-weight: bold;">${pos}º</td>
                            <td><img src="${aluno.foto}" class="table-avatar"></td>
                            <td><strong>${aluno.nome}</strong></td>
                            <td>${aluno.turma}</td>
                            <td class="td-center">${aluno.lotesVendidos.length + aluno.lotesPendentes.length}</td>
                            <td class="td-center highlight-purple" style="font-weight:bold;">${aluno.lotesVendidos.length}</td>
                            <td class="td-center">${aluno.lotesPendentes.length}</td>
                        </tr>`;
                });
                
                const contRanking = tabelaRanking.closest('.table-container');
                const ctrlAnt = contRanking.querySelector('.paginacao-container');
                if (ctrlAnt) ctrlAnt.remove();
                contRanking.insertAdjacentHTML('beforeend', gerarControlesPaginacao('rankingGeralEdu', rankingData.length));
            }
        };
    }

    // ==========================================
    // LÓGICA DA DIRETORIA (ADM) COM PAGINAÇÃO
    // ==========================================
    const adminPage = document.getElementById("adminPage");
    if (adminPage) {
        window.carregarDadosDoBanco();
        
        window.atualizarDashboardsADM = function() {
            // 1. LIVRO CAIXA COM PAGINAÇÃO
            const tabelaCaixa = document.getElementById('tabelaLivroCaixa');
            if(tabelaCaixa && window.caixaGlobalBD) {
                const dadosCaixa = [...window.caixaGlobalBD].reverse();
                const total = dadosCaixa.length;
                const inicioC = window.paginacao.livroCaixa * window.paginacao.itensPorPagina;
                const sliceCaixa = dadosCaixa.slice(inicioC, inicioC + window.paginacao.itensPorPagina);

                tabelaCaixa.innerHTML = sliceCaixa.map(tx => {
                    const val = parseFloat(tx['Valor'] || tx['Valor_Total'] || 0).toFixed(2).replace('.', ',');
                    return `
                        <tr>
                            <td>${tx['Data/Hora'] || tx['Data'] || '-'}</td>
                            <td><span style="color:#a0a0a0; font-size:0.8rem;">${tx['ID_Transacao'] || ''}</span></td>
                            <td><strong>${tx['Lote'] || tx['Codigo_Lote'] || '-'}</strong></td>
                            <td>${tx['Educando'] || tx['Aluno'] || '-'}</td>
                            <td class="highlight-purple" style="font-weight:bold;">R$ ${val}</td>
                            <td>${tx['Metodo_Pagamento'] || '-'}</td>
                            <td>${tx['Responsavel'] || '-'}</td>
                        </tr>`;
                }).join('');

                const container = tabelaCaixa.closest('.table-container');
                const antigo = container.querySelector('.paginacao-container');
                if (antigo) antigo.remove();
                container.insertAdjacentHTML('beforeend', gerarControlesPaginacao('livroCaixa', total));
            }

            // 2. AUDITORIA / LOGS COM PAGINAÇÃO
            const tabelaLogs = document.getElementById('tabelaLogs');
            if(tabelaLogs && window.logsDoSistema) {
                const dadosLogs = [...window.logsDoSistema].reverse();
                const totalL = dadosLogs.length;
                const inicioL = window.paginacao.logs * window.paginacao.itensPorPagina;
                const sliceLogs = dadosLogs.slice(inicioL, inicioL + window.paginacao.itensPorPagina);

                tabelaLogs.innerHTML = sliceLogs.map(l => {
                    return `
                        <tr>
                            <td style="color:var(--dim-grey); font-size:0.85rem;">${l['Data/Hora'] || '-'}</td>
                            <td><strong>${l['Responsavel'] || '-'}</strong></td>
                            <td style="color:var(--petal-pink); font-weight:bold;">${l['Ação_Registrada'] || l['Acao'] || '-'}</td>
                            <td>${l['Detalhes'] || ''}</td>
                        </tr>`;
                }).join('');

                const containerLog = tabelaLogs.closest('.table-container');
                const antigoL = containerLog.querySelector('.paginacao-container');
                if (antigoL) antigoL.remove();
                containerLog.insertAdjacentHTML('beforeend', gerarControlesPaginacao('logs', totalL));
            }

            // 3. RANKING ALUNOS ADM COM PAGINAÇÃO
            const tabelaRankingAlunosADM = document.getElementById('tabelaRankingAlunosADM');
            if(tabelaRankingAlunosADM) {
                let rankingGlobal = [...window.todosEducandosBD].filter(a => a.lotesVendidos.length > 0 || a.lotesPendentes.length > 0).sort((a, b) => b.lotesVendidos.length - a.lotesVendidos.length);
                const totalR = rankingGlobal.length;
                const inicioR = window.paginacao.rankingAlunosADM * window.paginacao.itensPorPagina;
                const sliceR = rankingGlobal.slice(inicioR, inicioR + window.paginacao.itensPorPagina);

                tabelaRankingAlunosADM.innerHTML = sliceR.map((aluno, idx) => {
                    const pos = inicioR + idx + 1;
                    return `
                        <tr onclick="abrirDetalhesAluno(${window.todosEducandosBD.indexOf(aluno)})">
                            <td class="td-center">${pos}º</td>
                            <td><img src="${aluno.foto}" class="table-avatar"></td>
                            <td><strong>${aluno.nome}</strong></td>
                            <td class="td-center">${aluno.lotesVendidos.length + aluno.lotesPendentes.length}</td>
                            <td class="td-center highlight-purple">${aluno.lotesVendidos.length}</td>
                            <td class="td-center">${aluno.lotesPendentes.length}</td>
                            <td class="td-center">-</td>
                            <td class="td-center">-</td>
                        </tr>`;
                }).join('');

                const containerRank = tabelaRankingAlunosADM.closest('.table-container');
                const antigoR = containerRank.querySelector('.paginacao-container');
                if (antigoR) antigoR.remove();
                containerRank.insertAdjacentHTML('beforeend', gerarControlesPaginacao('rankingAlunosADM', totalR));
            }
        };
    }

    // ==========================================
    // MODAIS E TRANSAÇÕES (PADRÃO)
    // ==========================================
    window.abrirModal = function(id) { document.getElementById(id).classList.add('active'); }
    window.fecharModal = function(id) { document.getElementById(id).classList.remove('active'); }
    window.abrirModalSucesso = function(txt) { document.getElementById('textoModalSucesso').innerText = txt; abrirModal('modalSucesso'); }
    window.abrirModalErro = function(txt) { const pErro = document.getElementById('textoModalErro'); if(pErro) pErro.innerText = txt; abrirModal('modalErro'); }

    window.abrirDetalhesAluno = function(idx) {
        window.alunoEmFocoIdx = idx; 
        const aluno = window.todosEducandosBD[idx]; 
        
        document.getElementById('detalheFoto').src = aluno.foto;
        document.getElementById('detalheNome').innerText = aluno.nome;
        document.getElementById('detalheTurma').innerText = `${aluno.curso} - ${aluno.turma}`;
        document.getElementById('detalheQtdVendidos').innerText = aluno.lotesVendidos.length;
        document.getElementById('detalheQtdPendentes').innerText = aluno.lotesPendentes.length;
        
        const bV = document.getElementById('detalheBadgesVendidos');
        bV.innerHTML = aluno.lotesVendidos.length ? aluno.lotesVendidos.map(l => `<span class="badge-lote">${l}</span>`).join('') : '<span class="badge-lote vazio">Nenhum</span>';
        
        const bP = document.getElementById('detalheBadgesPendentes');
        bP.innerHTML = aluno.lotesPendentes.length ? aluno.lotesPendentes.map(l => `<span class="badge-lote">${l}</span>`).join('') : '<span class="badge-lote vazio">Nenhum</span>';
        
        abrirModal('modalDetalhesAluno');
    }
});
