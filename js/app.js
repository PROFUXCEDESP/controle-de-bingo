document.addEventListener("DOMContentLoaded", () => {
    
    // ==========================================
    // FUNÇÃO MÁGICA: IGNORA ACENTOS E MAIÚSCULAS
    // ==========================================
    function textoIgual(t1, t2) {
        if(!t1 || !t2) return false;
        return t1.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() === 
               t2.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    }

    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwWD-pi7qf1Vlp01I8CO-7euJmqsNureruSEjeFc9bdYUZ_M13he6bqBC_ctJGHUpc4ow/exec'; 
    const userName = localStorage.getItem('usuarioLogado') || 'Administrador';
    
    window.fotoBase64Global = ""; let cropperInstancia = null;
    window.caixaGlobal = { pixReais: 0.00, dinReais: 0.00 };
    window.todosEducandosBD = []; window.mockEducadoresBD = [];
    window.mockParceirosBD = []; window.lotesSedeBD = []; window.logsDoSistema = [];

    // ==========================================
    // GESTÃO BLINDADA DAS ABAS DO EDUCADOR
    // ==========================================
    window.mudarAbaEducador = function(secId, navId) {
        // Esconde todas as seções
        ['secMinhaTurma', 'secVendasGeral', 'secRankingEducandos'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.style.display = 'none';
        });
        // Tira o roxo de todos os botões do menu
        ['navMinhaTurma', 'navVendasGeral', 'navRankingEducandos'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.classList.remove('active');
        });

        // Ativa apenas a seção e o botão clicado
        document.getElementById(secId).style.display = 'block';
        document.getElementById(navId).classList.add('active');

        // Se estiver no celular, esconde o menu lateral automaticamente
        if(window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.remove('open');
        }

        // Atualiza as tabelas com os dados mais recentes
        if(window.atualizarDashboardEducador) window.atualizarDashboardEducador();
    }

    // Sidebar Mobile Trigger
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
        if(btnSync) btnSync.innerText = "Sincronizando Banco...";

        fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'sincronizar_dados' }) })
        .then(res => res.json())
        .then(data => {
            if(data.success) {
                window.lotesSedeBD = data.lotesSede.map(l => l['Codigo_Lote'] || l['ID do Lote']).filter(Boolean);
                window.todosEducandosBD = data.educandos.map(e => ({
                    nome: e['Nome_Educando'] || e['Nome'], curso: e['Curso'], turma: e['Turma'], periodo: e['Periodo'], educadorResponsavel: e['Educador_Responsavel'] || '',
                    foto: e['Foto_URL'] || `https://ui-avatars.com/api/?name=${e['Nome_Educando'] || e['Nome']}&background=BC68A1&color=fff`,
                    lotesPendentes: e['Lotes_Pendentes'] ? String(e['Lotes_Pendentes']).split(',').map(s=>s.trim()).filter(Boolean) : [],
                    lotesVendidos: e['Lotes_Vendidos'] ? String(e['Lotes_Vendidos']).split(',').map(s=>s.trim()).filter(Boolean) : [],
                    lotesDevolvidos: e['Lotes_Devolvidos'] ? String(e['Lotes_Devolvidos']).split(',').map(s=>s.trim()).filter(Boolean) : []
                }));

                window.mockEducadoresBD = data.educadores.map(e => {
                    let vendidos = 0; let pendentes = 0;
                    window.todosEducandosBD.forEach(al => {
                        if(textoIgual(al.educadorResponsavel, e['Nome'])) {
                            vendidos += al.lotesVendidos.length; pendentes += al.lotesPendentes.length;
                        }
                    });
                    return { nome: e['Nome'], curso: e['Curso Responsavel'], lotesRetiradosSede: parseInt(e['Lotes Retirados Sede']) || 0, lotesVendidos: vendidos, lotesPendentes: pendentes };
                });

                window.caixaGlobal = { pixReais: 0, dinReais: 0 };
                if (data.caixaGlobal) {
                    data.caixaGlobal.forEach(transacao => {
                        let valor = parseFloat(transacao['Valor']) || parseFloat(transacao['Valor_Total']) || 0;
                        if(transacao['Metodo_Pagamento'] === 'PIX') window.caixaGlobal.pixReais += valor;
                        if(transacao['Metodo_Pagamento'] === 'Dinheiro') window.caixaGlobal.dinReais += valor;
                    });
                }

                if(btnSync) btnSync.innerText = userName;
                if (recarregarTelas) {
                    if(document.getElementById("adminPage")) window.atualizarDashboardsADM();
                    if(document.getElementById("educadorPage")) window.atualizarDashboardEducador();
                }
            }
        }).catch(err => { console.error(err); if(btnSync) btnSync.innerText = "Erro de Conexão"; });
    }

    // ==========================================
    // LOGIN
    // ==========================================
    const loginForm = document.getElementById("loginForm");
    if(loginForm) {
        if (typeof gsap !== 'undefined') gsap.from(".login-container", { y: 40, opacity: 0, duration: 0.8, ease: "power3.out" });
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault(); 
            const educadorInput = document.getElementById('educadorSelect') || document.querySelector('input[type="hidden"]');
            const educador = educadorInput ? educadorInput.value : null;
            const senha = document.getElementById("senhaInput").value;

            if(!educador || senha.length !== 6) return window.abrirModalErro("Selecione seu nome e digite 6 números.");
            const btn = document.querySelector(".btn-primary");
            btn.innerText = "Conectando ao Banco..."; btn.disabled = true;

            fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'login', educador: educador, senha: senha }) })
            .then(res => res.json())
            .then(data => {
                btn.innerText = "Acessar Sistema"; btn.disabled = false;
                if (data.success) {
                    localStorage.setItem('usuarioLogado', educador);
                    window.location.href = (data.nivelAcesso === "ADM") ? "admin.html" : "educador.html"; 
                } else { window.abrirModalErro(data.message); }
            }).catch(() => { btn.disabled = false; btn.innerText = "Acessar Sistema"; window.abrirModalErro("Erro de rede."); });
        });
    }

    // ==========================================
    // LÓGICA DO EDUCADOR 
    // ==========================================
    const educadorPage = document.getElementById("educadorPage");
    if (educadorPage) {
        document.getElementById('nomeEducador').innerText = userName;
        window.carregarDadosDoBanco();

        window.iniciarCorteFoto = function(event) {
            const input = event.target;
            if (input.files && input.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const imgToCrop = document.getElementById('imagemParaCorte');
                    imgToCrop.src = e.target.result;
                    abrirModal('modalCorteFoto');
                    if(cropperInstancia) cropperInstancia.destroy();
                    cropperInstancia = new Cropper(imgToCrop, { aspectRatio: 1, viewMode: 1 });
                }
                reader.readAsDataURL(input.files[0]);
            }
        }

        const btnConfirmarCorte = document.getElementById('btnConfirmarCorte');
        if(btnConfirmarCorte) {
            btnConfirmarCorte.addEventListener('click', (e) => {
                e.preventDefault();
                if(cropperInstancia) {
                    const canvas = cropperInstancia.getCroppedCanvas({ width: 300, height: 300 });
                    window.fotoBase64Global = canvas.toDataURL('image/jpeg');
                    document.getElementById('previewFoto').src = window.fotoBase64Global;
                    document.getElementById('previewFoto').style.display = 'block';
                    document.getElementById('iconCamera').style.display = 'none';
                    fecharModal('modalCorteFoto');
                }
            });
        }

        window.atualizarDashboardEducador = function() {
            // Filtro seguro via textoIgual()
            const meusAlunos = window.todosEducandosBD.filter(a => textoIgual(a.educadorResponsavel, userName)); 
            
            const tabela = document.getElementById("tabelaAlunos");
            if (tabela) {
                tabela.innerHTML = "";
                meusAlunos.forEach((aluno, index) => {
                    const qtdVendidos = aluno.lotesVendidos.length;
                    const cartelasHTML = qtdVendidos >= 2 ? `<div class="flex-center" style="font-weight:bold; color:var(--sunflower-gold);">${qtdVendidos - 1}</div>` : '-';
                    const foneHTML = qtdVendidos >= 2 ? '<span class="material-symbols-outlined" style="color:var(--petal-pink);">headphones</span>' : '-';
                    tabela.innerHTML += `<tr onclick="abrirDetalhesAluno(${window.todosEducandosBD.indexOf(aluno)})"><td class="td-center" style="font-weight: bold; color: #BC68A1;">${index + 1}</td><td><img src="${aluno.foto}" class="table-avatar"></td><td><strong>${aluno.nome}</strong><br><small style="color:#a0a0a0">${aluno.curso}</small></td><td class="td-center">${qtdVendidos + aluno.lotesPendentes.length}</td><td class="td-center">${qtdVendidos}</td><td class="td-center ${aluno.lotesPendentes.length > 0 ? 'td-highlight' : ''}">${aluno.lotesPendentes.length}</td><td class="td-center">${cartelasHTML}</td><td class="td-center">${foneHTML}</td></tr>`;
                });
            }

            const meuPerfil = window.mockEducadoresBD.find(e => textoIgual(e.nome, userName));
            if(meuPerfil) {
                const disponivel = meuPerfil.lotesRetiradosSede - (meuPerfil.lotesVendidos + meuPerfil.lotesPendentes);
                if(document.getElementById('kpiEducadorVendidos')) document.getElementById('kpiEducadorVendidos').innerText = meuPerfil.lotesVendidos;
                if(document.getElementById('kpiEducadorPendentes')) document.getElementById('kpiEducadorPendentes').innerText = meuPerfil.lotesPendentes;
                if(document.getElementById('kpiEducadorEstoque')) document.getElementById('kpiEducadorEstoque').innerText = disponivel >= 0 ? disponivel : 0;
            }

            const tabelaRanking = document.getElementById("tabelaRankingEducador");
            if(tabelaRanking) {
                tabelaRanking.innerHTML = "";
                let rankingGeral = [...window.todosEducandosBD].filter(a => a.lotesVendidos.length > 0).sort((a, b) => b.lotesVendidos.length - a.lotesVendidos.length);
                rankingGeral.forEach((aluno, index) => {
                    const destaque = textoIgual(aluno.educadorResponsavel, userName) ? 'background-color: rgba(188, 104, 161, 0.05);' : '';
                    const tagMeu = textoIgual(aluno.educadorResponsavel, userName) ? ' <span style="font-size:0.7rem; background:var(--petal-pink); color:white; padding:2px 4px; border-radius:4px;">Seu Aluno</span>' : '';
                    tabelaRanking.innerHTML += `<tr style="${destaque}"><td class="td-center" style="font-weight: bold;">${index + 1}</td><td><img src="${aluno.foto}" class="table-avatar"></td><td><strong>${aluno.nome}</strong>${tagMeu}</td><td>${aluno.turma}</td><td class="td-center highlight-purple" style="font-weight:bold;">${aluno.lotesVendidos.length}</td><td class="td-center">${aluno.lotesPendentes.length}</td></tr>`;
                });
            }

            // ==========================================
            // PREENCHIMENTO DOS SELECTS DOS MODAIS
            // ==========================================
            const selectNomeCadastro = document.getElementById("nomeSelectEducando");
            if(selectNomeCadastro) {
                let optsCad = '<option value="">Selecione o aluno da sua lista...</option>';
                // AQUI FOI CORRIGIDO: Vai mostrar TODOS os alunos atrelados a Jéssica!
                if (meusAlunos.length === 0) {
                    optsCad += '<option value="" disabled>Nenhum aluno atrelado a você no Banco.</option>';
                } else {
                    meusAlunos.forEach(a => { 
                        let avisoFoto = a.foto.includes('ui-avatars') ? " (Sem Foto)" : "";
                        optsCad += `<option value="${a.nome}">${a.nome}${avisoFoto}</option>`; 
                    });
                }
                selectNomeCadastro.innerHTML = optsCad;
            }

            const listaLotes = document.getElementById("listaLotesCheckboxes");
            if(listaLotes) {
                let htmlLotes = '';
                window.lotesSedeBD.forEach(lote => { 
                    htmlLotes += `<label class="checkbox-item-row"><input type="checkbox" class="roxo-checkbox" value="${lote}"> <span style="color: var(--dim-grey); font-weight: 500;">${lote}</span></label>`; 
                });
                listaLotes.innerHTML = htmlLotes || '<div style="padding: 15px; color:#a0a0a0; text-align:center;">Nenhum lote liberado da Sede.</div>';
            }

            const selectAlunoAtribuir = document.getElementById("alunoAtribuirSelect");
            if (selectAlunoAtribuir) {
                let optsAttr = '<option value="">Escolha um aluno da sua turma...</option>';
                if(meusAlunos.length === 0) {
                    optsAttr += '<option value="" disabled>Nenhum aluno atrelado a você.</option>';
                } else {
                    meusAlunos.forEach(a => { optsAttr += `<option value="${a.nome}">${a.nome}</option>`; });
                }
                selectAlunoAtribuir.innerHTML = optsAttr;
            }
        };

        const formCadastrarEducando = document.getElementById("formCadastrarEducando");
        if(formCadastrarEducando) {
            formCadastrarEducando.addEventListener("submit", (e) => {
                e.preventDefault();
                const btn = formCadastrarEducando.querySelector("button[type='submit']");
                btn.innerText = "Salvando (Aguarde)..."; btn.disabled = true;

                const nome = document.getElementById("nomeSelectEducando").value;
                const turmaTexto = document.getElementById("turmaSelectEducando").value; 
                let periodo = (turmaTexto === "Turma 3" || turmaTexto === "Turma 4") ? "Tarde" : "Manhã";

                if(!nome || !turmaTexto) {
                    btn.disabled = false; btn.innerText = "Ativar Educando";
                    return window.abrirModalErro("Por favor, preencha todos os campos da lista.");
                }

                fetch(SCRIPT_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'cadastrar_educando', nome: nome, turma: turmaTexto, periodo: periodo, educadorResponsavel: userName, fotoBase64: window.fotoBase64Global })
                }).then(res => res.json()).then(data => {
                    btn.innerText = "Ativar Educando"; btn.disabled = false;
                    if(data.success) {
                        fecharModal('modalCadastrarEducando'); formCadastrarEducando.reset();
                        window.fotoBase64Global = ""; document.getElementById('previewFoto').style.display = 'none'; document.getElementById('iconCamera').style.display = 'block';
                        window.abrirModalSucesso(data.message); window.carregarDadosDoBanco();
                    } else { window.abrirModalErro(data.message); }
                }).catch(() => { btn.disabled = false; btn.innerText = "Ativar Educando"; window.abrirModalErro("Erro de rede."); });
            });
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

                fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'atribuir_lote', nomeAluno: alunoInput, lotes: lotesArray }) })
                .then(res => res.json()).then(data => {
                    btn.innerText = "Confirmar Atribuição"; btn.disabled = false;
                    if(data.success) {
                        fecharModal('modalAtribuirLote'); formAtribuirLote.reset(); window.abrirModalSucesso("Lotes atribuídos!"); window.carregarDadosDoBanco(); 
                    } else { window.abrirModalErro(data.message); }
                }).catch(err => { btn.disabled = false; btn.innerText = "Confirmar Atribuição"; window.abrirModalErro("Erro de rede."); });
            });
        }
    }

    // ==========================================
    // LÓGICA DO ADM (E Otimismo de Interface)
    // ==========================================
    const adminPage = document.getElementById("adminPage");
    let estoqueChartInst = null; let financeiroChartInst = null;

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

        function resetTabs() { Object.values(tabs).forEach(tab => { if(tab.nav) tab.nav.classList.remove('active'); if(tab.sec) tab.sec.style.display = 'none'; }); }
        Object.values(tabs).forEach(tab => {
            if(tab.nav) {
                tab.nav.addEventListener('click', () => { 
                    resetTabs(); tab.nav.classList.add('active'); tab.sec.style.display = 'block'; 
                    if(window.innerWidth <= 768) { sidebar.classList.remove('open'); }
                    if(tab.nav.id === 'navVisaoGeral') window.atualizarDashboardsADM();
                });
            }
        });

        window.atualizarDashboardsADM = function() {
            const VALOR_POR_LOTE = 20.00;
            let totalPendentes = 0, totalVendidos = 0;
            window.todosEducandosBD.forEach(a => { totalPendentes += a.lotesPendentes.length; totalVendidos += a.lotesVendidos.length; });

            const vVendasPix = window.caixaGlobal.pixReais; const vVendasDin = window.caixaGlobal.dinReais;
            const vVendas = vVendasPix + vVendasDin; const vPendentes = totalPendentes * VALOR_POR_LOTE;

            if(document.getElementById('kpiVendasReaisGlobal')) document.getElementById('kpiVendasReaisGlobal').innerText = `R$ ${vVendas.toFixed(2).replace('.', ',')}`;
            if(document.getElementById('kpiCaixaPix')) document.getElementById('kpiCaixaPix').innerText = `R$ ${vVendasPix.toFixed(2).replace('.', ',')}`;
            if(document.getElementById('kpiCaixaDinheiro')) document.getElementById('kpiCaixaDinheiro').innerText = `R$ ${vVendasDin.toFixed(2).replace('.', ',')}`;
            if(document.getElementById('kpiProjecaoGlobal')) document.getElementById('kpiProjecaoGlobal').innerText = `R$ ${vPendentes.toFixed(2).replace('.', ',')}`;
            if(document.getElementById('kpiLotesRua')) document.getElementById('kpiLotesRua').innerText = totalPendentes;

            const ctxEst = document.getElementById('estoqueChart');
            if (ctxEst && ctxEst.offsetParent !== null) { 
                if (!estoqueChartInst) estoqueChartInst = new Chart(ctxEst.getContext('2d'), { type: 'doughnut', data: { labels: ['Válidos', 'Pendentes', 'Estoque'], datasets: [{ data: [totalVendidos, totalPendentes, 440], backgroundColor: ['#BC68A1', '#F4B841', '#e0e0e0'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false } });
                else { estoqueChartInst.data.datasets[0].data = [totalVendidos, totalPendentes, 440]; estoqueChartInst.update(); }
            }

            const ctxFin = document.getElementById('financeiroChart');
            if (ctxFin && ctxFin.offsetParent !== null) {
                if (!financeiroChartInst) financeiroChartInst = new Chart(ctxFin.getContext('2d'), { type: 'bar', data: { labels: ['Caixa Realizado', 'Projeção Restante'], datasets: [{ label: 'Valor em R$', data: [vVendas, vPendentes], backgroundColor: ['#BC68A1', '#F4B841'], borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } } });
                else { financeiroChartInst.data.datasets[0].data = [vVendas, vPendentes]; financeiroChartInst.update(); }
            }

            let htmlGestao = "";
            window.todosEducandosBD.forEach((aluno, indexOrig) => {
                if (aluno.lotesPendentes.length > 0) {
                    htmlGestao += `<tr style="cursor: pointer;" onclick="abrirDetalhesAluno(${indexOrig})"><td><img src="${aluno.foto}" class="table-avatar"></td><td><strong>${aluno.nome}</strong></td><td style="color:var(--dim-grey);">${aluno.curso}<br><small style="color:#a0a0a0">${aluno.turma}</small></td><td class="td-center highlight-yellow" style="font-weight:bold; font-size:1.1rem;">${aluno.lotesPendentes.length}</td></tr>`;
                }
            });
            if(document.getElementById('tabelaGestaoLotes')) document.getElementById('tabelaGestaoLotes').innerHTML = htmlGestao || `<tr><td colspan="4" class="text-center" style="padding: 2rem; color: #a0a0a0;">Nenhum lote pendente.</td></tr>`;

            const tabelaRankingAlunosADM = document.getElementById('tabelaRankingAlunosADM');
            if(tabelaRankingAlunosADM) {
                tabelaRankingAlunosADM.innerHTML = "";
                let rankingGlobal = [...window.todosEducandosBD].sort((a, b) => b.lotesVendidos.length - a.lotesVendidos.length);
                rankingGlobal.forEach((aluno, index) => {
                    const qtdVendidos = aluno.lotesVendidos.length;
                    if(qtdVendidos === 0 && aluno.lotesPendentes.length === 0) return; 
                    const cartelasHTML = qtdVendidos >= 2 ? `<div class="flex-center" style="font-weight:bold; color:var(--sunflower-gold);">${qtdVendidos - 1}</div>` : '-';
                    const foneHTML = qtdVendidos >= 2 ? '<span class="material-symbols-outlined" style="color:var(--petal-pink);">headphones</span>' : '-';
                    tabelaRankingAlunosADM.innerHTML += `<tr onclick="abrirDetalhesAluno(${window.todosEducandosBD.indexOf(aluno)})"><td class="td-center" style="font-weight: bold;">${index + 1}</td><td><img src="${aluno.foto}" class="table-avatar"></td><td><strong>${aluno.nome}</strong></td><td class="td-center">${qtdVendidos + aluno.lotesPendentes.length}</td><td class="td-center highlight-purple" style="font-weight:bold;">${qtdVendidos}</td><td class="td-center ${aluno.lotesPendentes.length > 0 ? 'td-highlight' : ''}">${aluno.lotesPendentes.length}</td><td class="td-center">${cartelasHTML}</td><td class="td-center">${foneHTML}</td></tr>`;
                });
            }
        };
    }

    // ==========================================
    // MODAIS GENÉRICOS E TRANSAÇÕES
    // ==========================================
    window.abrirModal = function(id) { document.getElementById(id).classList.add('active'); }
    window.fecharModal = function(id) { document.getElementById(id).classList.remove('active'); }
    window.abrirModalSucesso = function(txt) { document.getElementById('textoModalSucesso').innerText = txt; abrirModal('modalSucesso'); }
    window.abrirModalErro = function(txt) { const pErro = document.getElementById('textoModalErro'); if(pErro) pErro.innerText = txt; abrirModal('modalErro'); }
    window.toggleMisto = function(mostrar) { document.getElementById('camposMisto').style.display = mostrar ? 'flex' : 'none'; }

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
        window.toggleMisto(false); document.getElementById('valorPixMisto').value = ''; document.getElementById('valorDinMisto').value = '';

        fecharModal('modalDetalhesAluno'); abrirModal('modalAcaoLote');
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
            if (vPix + vDin !== 20.00) return window.abrirModalErro(`A soma deve dar R$ 20,00.`);
        }

        window.caixaGlobal.pixReais += vPix; window.caixaGlobal.dinReais += vDin;
        aluno.lotesPendentes = aluno.lotesPendentes.filter(l => l !== lote);
        aluno.lotesVendidos.push(lote);
        
        fecharModal('modalAcaoLote'); 
        window.abrirModalSucesso("Venda confirmada!"); 
        if(document.getElementById("adminPage")) window.atualizarDashboardsADM(); 

        fetch(SCRIPT_URL, {
            method: 'POST', body: JSON.stringify({ action: 'transacao_lote', acaoLote: 'venda', lote: lote, nomeAluno: aluno.nome, vPix: vPix, vDin: vDin, responsavel: userName })
        }).catch(err => console.error("Erro no background", err));
    }

    window.confirmarDevolucaoLote = function() {
        const lote = document.getElementById('acaoLoteInput').value;
        const idx = document.getElementById('acaoAlunoIdxInput').value;
        const aluno = window.todosEducandosBD[idx];
        
        aluno.lotesPendentes = aluno.lotesPendentes.filter(l => l !== lote);
        if(!aluno.lotesDevolvidos) aluno.lotesDevolvidos = [];
        aluno.lotesDevolvidos.push(lote);
        
        fecharModal('modalAcaoLote'); 
        window.abrirModalSucesso("Lote devolvido com sucesso!"); 
        if(document.getElementById("adminPage")) window.atualizarDashboardsADM();

        fetch(SCRIPT_URL, {
            method: 'POST', body: JSON.stringify({ action: 'transacao_lote', acaoLote: 'devolucao', lote: lote, nomeAluno: aluno.nome, responsavel: userName })
        }).catch(err => console.error("Erro no background", err));
    }
});
