document.addEventListener("DOMContentLoaded", () => {
    
    // ==========================================
    // 1. URL DA SUA API (GOOGLE APPS SCRIPT)
    // ==========================================
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwWD-pi7qf1Vlp01I8CO-7euJmqsNureruSEjeFc9bdYUZ_M13he6bqBC_ctJGHUpc4ow/exec'; 

    const userName = localStorage.getItem('usuarioLogado') || 'Administrador';

    // Variáveis Globais Vazias (Aguardando o Banco de Dados)
    window.caixaGlobal = { pixReais: 0.00, dinReais: 0.00 };
    window.todosEducandosBD = [];
    window.mockEducadoresBD = [];
    window.mockParceirosBD = [];
    window.logsDoSistema = [];

    // ==========================================
    // 2. FUNÇÕES DE INTERFACE (Selects, Sidebars)
    // ==========================================
    function ativarEventosSelectCustomizado(wrapperNode) {
        const select = wrapperNode.querySelector('.custom-select');
        const triggerText = wrapperNode.querySelector('.trigger-text');
        const hiddenInput = wrapperNode.querySelector('input[type="hidden"]');
        const options = wrapperNode.querySelectorAll('.custom-option');
        options.forEach(option => {
            option.removeEventListener('click', bindOptionClick);
            option.addEventListener('click', bindOptionClick);
        });
        function bindOptionClick(e) {
            if (this.style.display === 'none') return; 
            triggerText.textContent = this.textContent;
            hiddenInput.value = this.getAttribute('data-value');
            options.forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            select.classList.remove('open');
            triggerText.style.color = "var(--dim-grey)"; 
            hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
            e.stopPropagation();
        }
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

    const sidebar = document.getElementById('sidebar');
    const openSidebarBtn = document.getElementById('openSidebar');
    const closeSidebarBtn = document.getElementById('closeSidebar');
    
    if(sidebar) {
        if(openSidebarBtn) openSidebarBtn.addEventListener('click', () => sidebar.classList.add('open'));
        if(closeSidebarBtn) closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('open'));
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
                if (!sidebar.contains(e.target) && !openSidebarBtn.contains(e.target)) sidebar.classList.remove('open');
            }
        });
    }

    // ==========================================
    // 3. FUNÇÃO DE SINCRONIZAÇÃO COM A PLANILHA
    // ==========================================
    window.carregarDadosDoBanco = function() {
        const btnSync = document.getElementById('nomeEducador');
        if(btnSync) btnSync.innerText = "Sincronizando Banco...";

        fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'sincronizar_dados' })
        })
        .then(response => response.json())
        .then(data => {
            if(data.success) {
                window.todosEducandosBD = data.educandos.map(e => ({
                    nome: e['Nome_Educando'] || e['Nome'],
                    curso: e['Curso'],
                    turma: e['Turma'],
                    periodo: e['Periodo'],
                    foto: e['Foto_URL'] || `https://ui-avatars.com/api/?name=${e['Nome_Educando'] || e['Nome']}&background=BC68A1&color=fff`,
                    lotesPendentes: e['Lotes_Pendentes'] ? String(e['Lotes_Pendentes']).split(',').map(s=>s.trim()).filter(Boolean) : [],
                    lotesVendidos: e['Lotes_Vendidos'] ? String(e['Lotes_Vendidos']).split(',').map(s=>s.trim()).filter(Boolean) : [],
                    lotesDevolvidos: e['Lotes_Devolvidos'] ? String(e['Lotes_Devolvidos']).split(',').map(s=>s.trim()).filter(Boolean) : []
                }));

                window.mockEducadoresBD = data.educadores.map(e => {
                    let vendidos = 0; let pendentes = 0;
                    window.todosEducandosBD.forEach(al => {
                        if(al.curso === e['Curso Responsavel']) {
                            vendidos += al.lotesVendidos.length;
                            pendentes += al.lotesPendentes.length;
                        }
                    });
                    return {
                        nome: e['Nome'],
                        curso: e['Curso Responsavel'],
                        lotesRetiradosSede: parseInt(e['Lotes Retirados Sede']) || 0,
                        lotesVendidos: vendidos,
                        lotesPendentes: pendentes
                    };
                });

                window.mockParceirosBD = data.parceiros.map(p => ({
                    nome: p['Nome do Parceiro'] || p['Nome_Responsavel'],
                    lotes: parseInt(p['Qtd Lotes']) || 15,
                    pago: p['Status'] === 'Pago',
                    pagPix: parseFloat(p['Valor PIX']) || 0,
                    pagDin: parseFloat(p['Valor Dinheiro']) || 0
                }));

                window.caixaGlobal = { pixReais: 0, dinReais: 0 };
                if (data.caixaGlobal) {
                    data.caixaGlobal.forEach(transacao => {
                        let valor = parseFloat(transacao['Valor']) || 0;
                        if(transacao['Metodo_Pagamento'] === 'PIX') window.caixaGlobal.pixReais += valor;
                        if(transacao['Metodo_Pagamento'] === 'Dinheiro') window.caixaGlobal.dinReais += valor;
                    });
                }

                window.logsDoSistema = data.logs.reverse().map(l => ({ 
                    data: l['Data Hora'] || l['Data_Hora'],
                    responsavel: l['Responsavel'] || l['Usuario'] || 'Sistema',
                    sessao: l['Sessao Dispositivo'] || l['Sessao_Dispositivo'] || 'Desconhecido',
                    acao: l['Acao Registrada'] || l['Acao_Registrada'] || '-',
                    detalhe: l['Detalhes']
                }));

                if(btnSync) btnSync.innerText = userName;
                if(document.getElementById("adminPage")) window.atualizarDashboardsADM();
            } else {
                if(window.abrirModalErro) window.abrirModalErro("Erro ao carregar o Banco de Dados: " + data.message);
                else alert("Erro ao carregar o Banco de Dados: " + data.message);
            }
        })
        .catch(err => {
            console.error(err);
            if(btnSync) btnSync.innerText = "Erro de Conexão";
        });
    }

    // ==========================================
    // 4. LÓGICA DE LOGIN
    // ==========================================
    const loginForm = document.getElementById("loginForm");
    if(loginForm) {
        if (typeof gsap !== 'undefined') gsap.from(".login-container", { y: 40, opacity: 0, duration: 0.8, ease: "power3.out" });

        loginForm.addEventListener("submit", (e) => {
            e.preventDefault(); 
            const educador = document.getElementById('educadorSelect').value;
            const senha = document.getElementById("senhaInput").value;

            if(!educador || senha.length !== 6) {
                return window.abrirModalErro("Verifique se você selecionou o seu nome e se a senha tem exatamente 6 dígitos.");
            }

            const btn = document.querySelector(".btn-primary");
            btn.innerText = "Conectando ao Banco..."; btn.disabled = true;

            fetch(SCRIPT_URL, { 
                method: 'POST', 
                body: JSON.stringify({ action: 'login', educador: educador, senha: senha }) 
            })
            .then(response => response.json())
            .then(data => {
                btn.innerText = "Acessar Sistema"; btn.disabled = false;
                if (data.success) {
                    localStorage.setItem('usuarioLogado', educador);
                    window.location.href = (data.nivelAcesso === "ADM") ? "admin.html" : "educador.html"; 
                } else { 
                    window.abrirModalErro(data.message); 
                }
            }).catch((err) => { 
                btn.disabled = false; 
                btn.innerText = "Acessar Sistema";
                console.error(err);
                window.abrirModalErro("Conexão Bloqueada! O navegador não permite acessar o banco do Google direto de um arquivo local (file:///). Use um Servidor Local (Live Server) ou hospede os arquivos online.");
            });
        });
    }

    // ==========================================
    // 5. INICIALIZAÇÃO DA TELA ADM E GRÁFICOS
    // ==========================================
    const adminPage = document.getElementById("adminPage");
    let estoqueChartInst = null;
    let financeiroChartInst = null;

    if (adminPage) {
        window.carregarDadosDoBanco();

        const tabs = {
            visaoGeral: { nav: document.getElementById('navVisaoGeral'), sec: document.getElementById('secVisaoGeral') },
            engajamento: { nav: document.getElementById('navEngajamento'), sec: document.getElementById('secEngajamento') },
            gestaoLotes: { nav: document.getElementById('navGestaoLotes'), sec: document.getElementById('secGestaoLotes') },
            parceiros: { nav: document.getElementById('navParceiros'), sec: document.getElementById('secParceiros') },
            logs: { nav: document.getElementById('navLogs'), sec: document.getElementById('secLogs') },
            rankingAlunos: { nav: document.getElementById('navRankingAlunos'), sec: document.getElementById('secRankingAlunos') },
            rankingEducadores: { nav: document.getElementById('navRankingEducadores'), sec: document.getElementById('secRankingEducadores') }
        };

        function resetTabs() {
            Object.values(tabs).forEach(tab => {
                if(tab.nav) tab.nav.classList.remove('active');
                if(tab.sec) tab.sec.style.display = 'none';
            });
        }

        Object.values(tabs).forEach(tab => {
            if(tab.nav) {
                tab.nav.addEventListener('click', () => { 
                    resetTabs(); 
                    tab.nav.classList.add('active'); 
                    tab.sec.style.display = 'block'; 
                    if(tab.nav.id === 'navVisaoGeral') window.atualizarDashboardsADM();
                });
            }
        });

        const btnMenuTransferir = document.getElementById("btnMenuTransferir");
        if(btnMenuTransferir) btnMenuTransferir.addEventListener("click", () => {
            const listaLotesSede = document.getElementById("listaLotesSede");
            if(listaLotesSede) {
                listaLotesSede.innerHTML = `
                    <label class="checkbox-item"><input type="checkbox" value="WEB-100" class="lote-transferir-checkbox"> WEB-100</label>
                    <label class="checkbox-item"><input type="checkbox" value="WEB-101" class="lote-transferir-checkbox"> WEB-101</label>
                `;
            }
            abrirModal('modalTransferirLote');
        });

        const btnNovoEducador = document.getElementById("btnNovoEducador");
        if(btnNovoEducador) btnNovoEducador.addEventListener("click", () => abrirModal('modalCadastrarEducador'));

        document.addEventListener('change', (e) => {
            if(e.target.classList.contains('lote-transferir-checkbox') || e.target.id === 'educadorDestinoVal') {
                const btn = document.getElementById("btnConfirmarTransferencia");
                if(btn) btn.disabled = !(document.querySelectorAll('.lote-transferir-checkbox:checked').length > 0 && document.getElementById('educadorDestinoVal').value !== "");
            }
        });

        const formTransferirLote = document.getElementById("formTransferirLote");
        if(formTransferirLote) {
            formTransferirLote.addEventListener("submit", (e) => {
                e.preventDefault();
                fecharModal('modalTransferirLote');
                setTimeout(() => { window.abrirModalSucesso(`Lotes transferidos da Sede com sucesso!`); }, 150);
                formTransferirLote.reset();
            });
        }

        const formCadastrarEducador = document.getElementById("formCadastrarEducador");
        if(formCadastrarEducador) {
            formCadastrarEducador.addEventListener("submit", (e) => {
                e.preventDefault();
                const nome = document.getElementById('nomeNovoEducador').value;
                const curso = document.getElementById('cursoNovoEducador').value;
                if(!curso) return window.abrirModalErro("Por favor, selecione o curso responsável.");
                fecharModal('modalCadastrarEducador');
                setTimeout(() => { window.abrirModalSucesso(`Educador ${nome} cadastrado com sucesso!`); }, 150);
                formCadastrarEducador.reset();
            });
        }

        window.atualizarDashboardsADM = function() {
            const VALOR_POR_LOTE = 20.00;
            let totalPendentes = 0, totalVendidos = 0;
            
            window.todosEducandosBD.forEach(a => { 
                totalPendentes += a.lotesPendentes.length; 
                totalVendidos += a.lotesVendidos.length;
            });

            let maiorEstoqueNome = "Nenhum";
            let maiorEstoqueQtd = -1;
            window.mockEducadoresBD.forEach(ed => {
                let est = ed.lotesRetiradosSede - ed.lotesVendidos - ed.lotesPendentes;
                if (est > maiorEstoqueQtd) { maiorEstoqueQtd = est; maiorEstoqueNome = ed.nome; }
            });
            if(document.getElementById('kpiMaiorEstoque')) {
                document.getElementById('kpiMaiorEstoque').innerHTML = `<strong>${maiorEstoqueNome}</strong> <br><span style="font-size: 1rem; color: var(--dim-grey); font-weight: normal;">${maiorEstoqueQtd} lotes disponíveis</span>`;
            }

            const vVendasPix = window.caixaGlobal.pixReais;
            const vVendasDin = window.caixaGlobal.dinReais;
            const vVendas = vVendasPix + vVendasDin;
            const vPendentes = totalPendentes * VALOR_POR_LOTE;

            if(document.getElementById('kpiVendasReaisGlobal')) document.getElementById('kpiVendasReaisGlobal').innerText = `R$ ${vVendas.toFixed(2).replace('.', ',')}`;
            if(document.getElementById('kpiCaixaPix')) document.getElementById('kpiCaixaPix').innerText = `R$ ${vVendasPix.toFixed(2).replace('.', ',')}`;
            if(document.getElementById('kpiCaixaDinheiro')) document.getElementById('kpiCaixaDinheiro').innerText = `R$ ${vVendasDin.toFixed(2).replace('.', ',')}`;
            if(document.getElementById('kpiProjecaoGlobal')) document.getElementById('kpiProjecaoGlobal').innerText = `R$ ${vPendentes.toFixed(2).replace('.', ',')}`;
            if(document.getElementById('kpiLotesRua')) document.getElementById('kpiLotesRua').innerText = totalPendentes;

            const ctxEst = document.getElementById('estoqueChart');
            if (ctxEst && ctxEst.offsetParent !== null) { 
                if (!estoqueChartInst) {
                    estoqueChartInst = new Chart(ctxEst.getContext('2d'), { type: 'doughnut', data: { labels: ['Válidos', 'Pendentes', 'Estoque'], datasets: [{ data: [totalVendidos, totalPendentes, 440], backgroundColor: ['#BC68A1', '#F4B841', '#e0e0e0'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false } });
                } else {
                    estoqueChartInst.data.datasets[0].data = [totalVendidos, totalPendentes, 440];
                    estoqueChartInst.update();
                }
            }

            const ctxFin = document.getElementById('financeiroChart');
            if (ctxFin && ctxFin.offsetParent !== null) {
                if (!financeiroChartInst) {
                    financeiroChartInst = new Chart(ctxFin.getContext('2d'), { type: 'bar', data: { labels: ['Caixa Realizado', 'Projeção Restante'], datasets: [{ label: 'Valor em R$', data: [vVendas, vPendentes], backgroundColor: ['#BC68A1', '#F4B841'], borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } } });
                } else {
                    financeiroChartInst.data.datasets[0].data = [vVendas, vPendentes];
                    financeiroChartInst.update();
                }
            }

            const selectFiltro = document.getElementById('filtroCursoEngajamento');
            const cursoFiltro = selectFiltro ? selectFiltro.value : "Todos";
            let totalEng = 0, ativos = 0, inativos = 0, aM = 0, aT = 0, iM = 0, iT = 0;
            let htmlListaEng = "";

            window.todosEducandosBD.forEach(aluno => {
                if (cursoFiltro === "Todos" || aluno.curso === cursoFiltro) {
                    totalEng++;
                    const isAtivo = (aluno.lotesVendidos.length > 0 || aluno.lotesPendentes.length > 0);
                    if (isAtivo) { ativos++; aluno.periodo === "Manhã" ? aM++ : aT++; } 
                    else { inativos++; aluno.periodo === "Manhã" ? iM++ : iT++; }

                    const statusBadge = isAtivo 
                        ? '<span style="background: var(--petal-pink); color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">Ativo</span>'
                        : '<span style="color: #a0a0a0; font-weight: bold; font-size: 0.8rem;">Inativo</span>';

                    htmlListaEng += `
                        <tr style="border-bottom: 1px solid #eee;">
                            <td><img src="${aluno.foto}" class="table-avatar"></td>
                            <td style="padding: 10px;"><strong>${aluno.nome}</strong></td>
                            <td style="padding: 10px; color: var(--dim-grey);">${aluno.curso}<br><small style="color:#a0a0a0">${aluno.turma}</small></td>
                            <td style="padding: 10px; color: var(--dim-grey);">${aluno.periodo}</td>
                            <td class="text-center" style="padding: 10px;">${statusBadge}</td>
                        </tr>`;
                }
            });
            
            if(document.getElementById('kpiAtivos')) document.getElementById('kpiAtivos').innerText = ativos;
            if(document.getElementById('kpiInativos')) document.getElementById('kpiInativos').innerText = inativos;
            if(document.getElementById('kpiAdesao')) document.getElementById('kpiAdesao').innerText = `${totalEng === 0 ? 0 : Math.round((ativos / totalEng) * 100)}%`;
            if(document.getElementById('kpiTotalAlunos')) document.getElementById('kpiTotalAlunos').innerText = `De ${totalEng} alunos`;
            if(document.getElementById('kpiAtivosPeriodos')) document.getElementById('kpiAtivosPeriodos').innerText = `${aM} Manhã | ${aT} Tarde`;
            if(document.getElementById('kpiInativosPeriodos')) document.getElementById('kpiInativosPeriodos').innerText = `${iM} Manhã | ${iT} Tarde`;
            if(document.getElementById('tabelaEngajamentoAlunos')) document.getElementById('tabelaEngajamentoAlunos').innerHTML = htmlListaEng;

            let htmlGestao = "";
            window.todosEducandosBD.forEach((aluno, indexOrig) => {
                if (aluno.lotesPendentes.length > 0) {
                    htmlGestao += `
                        <tr style="cursor: pointer;" onclick="abrirDetalhesAluno(${indexOrig})">
                            <td><img src="${aluno.foto}" class="table-avatar"></td>
                            <td><strong>${aluno.nome}</strong></td>
                            <td style="color:var(--dim-grey);">${aluno.curso}<br><small style="color:#a0a0a0">${aluno.turma}</small></td>
                            <td class="td-center highlight-yellow" style="font-weight:bold; font-size:1.1rem;">${aluno.lotesPendentes.length}</td>
                        </tr>`;
                }
            });
            if(document.getElementById('tabelaGestaoLotes')) document.getElementById('tabelaGestaoLotes').innerHTML = htmlGestao || `<tr><td colspan="4" class="text-center" style="padding: 2rem; color: #a0a0a0;">Nenhum lote pendente.</td></tr>`;

            if(document.getElementById('tabelaParceiros')) {
                let arrParc = 0, projParc = 0;
                let htmlParceiros = "";
                
                window.mockParceirosBD.forEach((p, idx) => {
                    const valLotes = p.lotes * 20; 
                    if (p.pago) arrParc += valLotes; else projParc += valLotes;

                    const statusHTML = p.pago ? '<span style="color: var(--petal-pink); font-weight: bold; font-size: 0.95rem;">Pago</span>' : '<span style="color: #ccc; font-weight: bold; font-size: 0.95rem;">Pendente</span>';
                    const iconAcao = p.pago 
                        ? `<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1; color: var(--petal-pink); cursor: pointer; font-size: 26px; transition: transform 0.2s;" onclick="estornarPagamentoParceiro(${idx})" title="Desfazer Pagamento">thumb_up</span>`
                        : `<span class="material-symbols-outlined" style="color: #ccc; cursor: pointer; font-size: 26px; transition: transform 0.2s;" onclick="abrirAcaoParceiro(${idx})" title="Validar Pagamento">thumb_up</span>`;

                    htmlParceiros += `<tr>
                        <td style="font-size: 1.05rem;"><strong>${p.nome}</strong></td>
                        <td class="text-center" style="color: var(--dim-grey); font-weight: bold;">${p.lotes} Lotes</td>
                        <td class="text-center">${statusHTML}</td>
                        <td class="text-center">${iconAcao}</td>
                    </tr>`;
                });

                document.getElementById('tabelaParceiros').innerHTML = htmlParceiros;
                if(document.getElementById('kpiParceirosArrecadado')) document.getElementById('kpiParceirosArrecadado').innerText = `R$ ${arrParc.toFixed(2).replace('.',',')}`;
                if(document.getElementById('kpiParceirosProjetado')) document.getElementById('kpiParceirosProjetado').innerText = `R$ ${projParc.toFixed(2).replace('.',',')}`;
            }

            if(document.getElementById('tabelaLogs')) {
                document.getElementById('tabelaLogs').innerHTML = window.logsDoSistema.map(log => `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 15px 20px; text-align: left; color: var(--dim-grey); font-size: 0.85rem; white-space: nowrap;">${log.data}</td>
                        <td style="padding: 15px 20px; text-align: left;"><strong>${log.responsavel}</strong><br><small style="color: #a0a0a0; font-size: 0.75rem;">${log.sessao}</small></td>
                        <td style="padding: 15px 20px; text-align: left; white-space: nowrap;"><strong>${log.acao}</strong></td>
                        <td style="padding: 15px 20px; text-align: left; color: var(--dim-grey);">${log.detalhe}</td>
                    </tr>
                `).join('');
            }

            function renderTabelaAlunosADM(tabelaId, baseDados) {
                const tabela = document.getElementById(tabelaId);
                if (!tabela) return;
                tabela.innerHTML = "";
                baseDados.forEach((aluno, index) => {
                    const qtdVendidos = aluno.lotesVendidos.length;
                    const cartelasExtras = qtdVendidos >= 2 ? (qtdVendidos - 1) : 0;
                    const cartelasHTML = cartelasExtras > 0 ? `<div class="flex-center" style="font-weight:bold; color:var(--sunflower-gold);">${cartelasExtras} <span class="material-symbols-outlined icon-filled" style="font-variation-settings: 'FILL' 1; font-size: 1.2rem;">description</span></div>` : '-';
                    const foneHTML = qtdVendidos >= 2 ? '<span class="material-symbols-outlined" style="color:var(--petal-pink);">headphones</span>' : '-';
                    tabela.innerHTML += `
                        <tr onclick="abrirDetalhesAluno(${index})">
                            <td class="td-center" style="font-weight: bold; color: #BC68A1;">${index + 1}</td>
                            <td><img src="${aluno.foto}" class="table-avatar"></td>
                            <td><strong>${aluno.nome}</strong></td>
                            <td class="td-center">${qtdVendidos + aluno.lotesPendentes.length}</td>
                            <td class="td-center">${qtdVendidos}</td>
                            <td class="td-center ${aluno.lotesPendentes.length > 0 ? 'td-highlight' : ''}">${aluno.lotesPendentes.length}</td>
                            <td class="td-center">${cartelasHTML}</td>
                            <td class="td-center">${foneHTML}</td>
                        </tr>`;
                });
            }
            renderTabelaAlunosADM('tabelaRankingAlunosADM', [...window.todosEducandosBD].sort((a, b) => b.lotesVendidos.length - a.lotesVendidos.length));
            
            const tabelaEducadores = document.getElementById('tabelaRankingEducadores');
            if (tabelaEducadores) {
                let educadoresOrdenados = [...window.mockEducadoresBD].sort((a, b) => b.lotesVendidos - a.lotesVendidos);
                tabelaEducadores.innerHTML = "";
                educadoresOrdenados.forEach((educador, index) => {
                    tabelaEducadores.innerHTML += `<tr><td class="td-center" style="font-size: 1.1rem; font-weight: bold; color: #BC68A1;">${index + 1}</td><td><strong>${educador.nome}</strong></td><td style="color:var(--dim-grey);">${educador.curso}</td><td class="td-center">${educador.lotesRetiradosSede}</td><td class="td-center highlight-purple" style="font-weight:bold;">${educador.lotesVendidos}</td><td class="td-center ${educador.lotesPendentes > 0 ? 'td-highlight' : ''}">${educador.lotesPendentes}</td></tr>`;
                });
            }
        };

        const selectFiltroCursoEngajamento = document.getElementById('filtroCursoEngajamento');
        if(selectFiltroCursoEngajamento) selectFiltroCursoEngajamento.addEventListener('change', () => window.atualizarDashboardsADM());
    }
});

// ==========================================
// 6. FUNÇÕES DE MODAIS E GESTÃO FINANCEIRA
// ==========================================
window.abrirModal = function(id) { document.getElementById(id).classList.add('active'); }
window.fecharModal = function(id) { document.getElementById(id).classList.remove('active'); }
window.abrirModalSucesso = function(txt) { document.getElementById('textoModalSucesso').innerText = txt; abrirModal('modalSucesso'); }
window.abrirModalErro = function(txt) { const pErro = document.getElementById('textoModalErro'); if(pErro) pErro.innerText = txt; abrirModal('modalErro'); }

window.toggleMisto = function(mostrar) { document.getElementById('camposMisto').style.display = mostrar ? 'flex' : 'none'; }
window.toggleMistoParc = function(mostrar) { document.getElementById('camposMistoParc').style.display = mostrar ? 'flex' : 'none'; }

window.abrirDetalhesAluno = function(idx) {
    const isAdmin = document.getElementById('adminPage') !== null;
    const aluno = window.todosEducandosBD[idx]; 
    
    document.getElementById('detalheFoto').src = aluno.foto;
    document.getElementById('detalheNome').innerText = aluno.nome;
    document.getElementById('detalheTurma').innerText = `${aluno.curso} - ${aluno.turma}`;
    
    document.getElementById('detalheQtdVendidos').innerText = aluno.lotesVendidos.length;
    document.getElementById('detalheQtdPendentes').innerText = aluno.lotesPendentes.length;
    document.getElementById('detalheQtdDevolvidos').innerText = aluno.lotesDevolvidos ? aluno.lotesDevolvidos.length : 0;
    
    const badgeVendidos = aluno.lotesVendidos.length ? aluno.lotesVendidos.map(l => `<span class="badge-lote">${l}</span>`).join('') : '<span class="badge-lote vazio">Nenhum</span>';
    
    let badgePendentes = '<span class="badge-lote vazio">Nenhum</span>';
    if(aluno.lotesPendentes.length) {
        if(isAdmin) {
            document.getElementById('msgCliquePendente').style.display = 'block';
            badgePendentes = aluno.lotesPendentes.map(l => `<span class="badge-lote" style="border: 1px dashed var(--sunflower-gold); cursor:pointer;" title="Gerenciar Lote" onclick="abrirAcaoLote('${l}', ${idx}); event.stopPropagation();">${l} ⚙️</span>`).join('');
        } else {
            document.getElementById('msgCliquePendente').style.display = 'none';
            badgePendentes = aluno.lotesPendentes.map(l => `<span class="badge-lote">${l}</span>`).join('');
        }
    } else {
        if(document.getElementById('msgCliquePendente')) document.getElementById('msgCliquePendente').style.display = 'none';
    }
    
    const badgeDevolvidos = aluno.lotesDevolvidos && aluno.lotesDevolvidos.length ? aluno.lotesDevolvidos.map(l => `<span class="badge-lote">${l}</span>`).join('') : '<span class="badge-lote vazio">Nenhum</span>';
    
    document.getElementById('detalheBadgesVendidos').innerHTML = badgeVendidos;
    document.getElementById('detalheBadgesPendentes').innerHTML = badgePendentes;
    document.getElementById('detalheBadgesDevolvidos').innerHTML = badgeDevolvidos;
    
    abrirModal('modalDetalhesAluno');
}

window.abrirAcaoLote = function(lote, idxAluno) {
    const aluno = window.todosEducandosBD[idxAluno];
    document.getElementById('acaoLoteNome').innerText = lote;
    document.getElementById('acaoLoteAluno').innerText = aluno.nome;
    document.getElementById('acaoLoteInput').value = lote;
    document.getElementById('acaoAlunoIdxInput').value = idxAluno;
    
    const radioPix = document.querySelector('input[name="formaPagamentoLote"][value="PIX"]');
    if(radioPix) radioPix.checked = true;
    window.toggleMisto(false);
    document.getElementById('valorPixMisto').value = '';
    document.getElementById('valorDinMisto').value = '';

    fecharModal('modalDetalhesAluno'); 
    abrirModal('modalAcaoLote');
}

window.confirmarVendaLote = function() {
    const lote = document.getElementById('acaoLoteInput').value;
    const idx = document.getElementById('acaoAlunoIdxInput').value;
    const aluno = window.todosEducandosBD[idx];
    
    const formaPagamento = document.querySelector('input[name="formaPagamentoLote"]:checked').value;
    let vPix = 0, vDin = 0;

    if (formaPagamento === "PIX") { vPix = 20.00; } 
    else if (formaPagamento === "Dinheiro") { vDin = 20.00; } 
    else {
        vPix = parseFloat(document.getElementById('valorPixMisto').value) || 0;
        vDin = parseFloat(document.getElementById('valorDinMisto').value) || 0;
        if (vPix + vDin !== 20.00) return alert(`A soma (R$ ${(vPix+vDin).toFixed(2)}) deve dar exatamente R$ 20,00.`);
    }

    window.caixaGlobal.pixReais += vPix;
    window.caixaGlobal.dinReais += vDin;
    aluno.lotesPendentes = aluno.lotesPendentes.filter(l => l !== lote);
    aluno.lotesVendidos.push(lote);
    
    fecharModal('modalAcaoLote');
    setTimeout(() => { abrirDetalhesAluno(idx); }, 100); 
    if(document.getElementById("adminPage")) window.atualizarDashboardsADM();
}

window.confirmarDevolucaoLote = function() {
    const lote = document.getElementById('acaoLoteInput').value;
    const idx = document.getElementById('acaoAlunoIdxInput').value;
    const aluno = window.todosEducandosBD[idx];
    
    aluno.lotesPendentes = aluno.lotesPendentes.filter(l => l !== lote);
    if(!aluno.lotesDevolvidos) aluno.lotesDevolvidos = [];
    aluno.lotesDevolvidos.push(lote);
    
    fecharModal('modalAcaoLote');
    setTimeout(() => { abrirDetalhesAluno(idx); }, 100); 
    if(document.getElementById("adminPage")) window.atualizarDashboardsADM();
}

window.abrirAcaoParceiro = function(idx) {
    const parceiro = window.mockParceirosBD[idx];
    document.getElementById('acaoParceiroNome').innerText = parceiro.nome;
    document.getElementById('acaoParceiroLotes').innerText = parceiro.lotes;
    document.getElementById('acaoParceiroValor').innerText = (parceiro.lotes * 20).toFixed(2).replace('.', ',');
    document.getElementById('acaoParceiroIdxInput').value = idx;
    
    const radioPix = document.querySelector('input[name="formaPagamentoParc"][value="PIX"]');
    if(radioPix) radioPix.checked = true;
    window.toggleMistoParc(false);
    document.getElementById('valorPixMistoParc').value = '';
    document.getElementById('valorDinMistoParc').value = '';

    abrirModal('modalAcaoParceiro');
}

window.confirmarPagamentoParceiro = function() {
    const idx = document.getElementById('acaoParceiroIdxInput').value;
    const parceiro = window.mockParceirosBD[idx];
    const valorTotal = parceiro.lotes * 20;

    const formaPagamento = document.querySelector('input[name="formaPagamentoParc"]:checked').value;
    let vPix = 0, vDin = 0;

    if (formaPagamento === "PIX") { vPix = valorTotal; } 
    else if (formaPagamento === "Dinheiro") { vDin = valorTotal; } 
    else {
        vPix = parseFloat(document.getElementById('valorPixMistoParc').value) || 0;
        vDin = parseFloat(document.getElementById('valorDinMistoParc').value) || 0;
        if (vPix + vDin !== valorTotal) return alert(`A soma (R$ ${(vPix+vDin).toFixed(2)}) deve dar exatamente R$ ${valorTotal.toFixed(2)}.`);
    }

    parceiro.pago = true; parceiro.pagPix = vPix; parceiro.pagDin = vDin;
    window.caixaGlobal.pixReais += vPix; window.caixaGlobal.dinReais += vDin;

    fecharModal('modalAcaoParceiro');
    window.atualizarDashboardsADM();
}

window.estornarPagamentoParceiro = function(idx) {
    const parceiro = window.mockParceirosBD[idx];
    document.getElementById('estornoNomeParceiro').innerText = parceiro.nome;
    document.getElementById('estornoParceiroIdxInput').value = idx;
    abrirModal('modalConfirmarEstorno');
}

window.confirmarEstornoAction = function() {
    const idx = document.getElementById('estornoParceiroIdxInput').value;
    const parceiro = window.mockParceirosBD[idx];
    
    window.caixaGlobal.pixReais -= (parceiro.pagPix || 0);
    window.caixaGlobal.dinReais -= (parceiro.pagDin || 0);
    parceiro.pago = false; parceiro.pagPix = 0; parceiro.pagDin = 0;
    
    fecharModal('modalConfirmarEstorno');
    window.atualizarDashboardsADM();
}