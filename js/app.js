document.addEventListener("DOMContentLoaded", () => {
    
    function textoIgual(t1, t2) {
        if(!t1 || !t2) return false;
        return t1.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() === 
               t2.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    }

    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwWD-pi7qf1Vlp01I8CO-7euJmqsNureruSEjeFc9bdYUZ_M13he6bqBC_ctJGHUpc4ow/exec'; 
    const userName = localStorage.getItem('usuarioLogado') || 'Administrador';
    
    window.fotoBase64Global = ""; let cropperInstancia = null;
    let estoqueChartInstEdu = null; let financeiroChartInstEdu = null;
    window.caixaGlobal = { pixReais: 0.00, dinReais: 0.00 };
    window.todosEducandosBD = []; window.mockEducadoresBD = [];
    window.mockParceirosBD = []; window.lotesSedeBD = []; window.logsDoSistema = [];

    // ==========================================
    // CUSTOM SELECT RESTAURADO
    // ==========================================
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

    // GESTÃO ABAS
    window.mudarAbaEducador = function(secId, navId) {
        ['secMinhaTurma', 'secVendasGeral', 'secRankingEducandos'].forEach(id => { const el = document.getElementById(id); if(el) el.style.display = 'none'; });
        ['navMinhaTurma', 'navVendasGeral', 'navRankingEducandos'].forEach(id => { const el = document.getElementById(id); if(el) el.classList.remove('active'); });
        document.getElementById(secId).style.display = 'block'; document.getElementById(navId).classList.add('active');
        if(window.innerWidth <= 768) { document.getElementById('sidebar').classList.remove('open'); }
        if(window.atualizarDashboardEducador) window.atualizarDashboardEducador();
    }

    const sidebar = document.getElementById('sidebar');
    const openSidebarBtn = document.getElementById('openSidebar');
    const closeSidebarBtn = document.getElementById('closeSidebar');
    if(sidebar) {
        if(openSidebarBtn) openSidebarBtn.addEventListener('click', () => sidebar.classList.add('open'));
        if(closeSidebarBtn) closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('open'));
    }

    // ==========================================
    // CARGA DE DADOS
    // ==========================================
    window.carregarDadosDoBanco = function(recarregarTelas = true) {
        const btnSync = document.getElementById('nomeEducador');
        if(btnSync) btnSync.innerText = "Sincronizando Banco...";

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
                    cadastroAtivo: e['Cadastro_Ativo'] || '', // NOVO
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
    // RECOMPENSAS: 10 Lotes = 1 Fone + 1 Cartela. Depois, a cada 5 lotes = +1 Cartela.
    // ==========================================
    function calcularRecompensas(qtdVendidos) {
        let fone = qtdVendidos >= 10 ? 1 : 0;
        let cartelas = qtdVendidos >= 10 ? 1 + Math.floor((qtdVendidos - 10) / 5) : 0;
        return { fone, cartelas };
    }

    // ==========================================
    // LÓGICA DO EDUCADOR 
    // ==========================================
    const educadorPage = document.getElementById("educadorPage");
    if (educadorPage) {
        document.getElementById('nomeEducador').innerText = userName;
        window.carregarDadosDoBanco();

        const buscaNome = document.getElementById('buscaNomeAluno');
        const filtroTurma = document.getElementById('filtroTurmaAluno');
        if(buscaNome) buscaNome.addEventListener('input', () => window.atualizarDashboardEducador());
        if(filtroTurma) filtroTurma.addEventListener('change', () => window.atualizarDashboardEducador());

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
            // ALUNOS ATIVOS: Tem educador correto E Passaram pelo Cadastro (Cadastro_Ativo == 'Sim' ou têm lotes)
            let meusAlunosAtivos = window.todosEducandosBD.filter(a => 
                textoIgual(a.educadorResponsavel, userName) && 
                (a.cadastroAtivo.toLowerCase() === 'sim' || a.lotesVendidos.length > 0 || a.lotesPendentes.length > 0)
            ); 
            
            if(buscaNome && buscaNome.value.trim() !== "") {
                const termo = buscaNome.value.toLowerCase();
                meusAlunosAtivos = meusAlunosAtivos.filter(a => a.nome.toLowerCase().includes(termo));
            }
            if(filtroTurma && filtroTurma.value !== "Todas") {
                meusAlunosAtivos = meusAlunosAtivos.filter(a => a.turma === filtroTurma.value);
            }

            const tabela = document.getElementById("tabelaAlunos");
            if (tabela) {
                tabela.innerHTML = "";
                meusAlunosAtivos.forEach((aluno, index) => {
                    const rec = calcularRecompensas(aluno.lotesVendidos.length);
                    const cartelasHTML = rec.cartelas > 0 ? `<div class="flex-center" style="font-weight:bold; color:var(--sunflower-gold);">${rec.cartelas} <span class="material-symbols-outlined icon-filled" style="font-size: 1.1rem; vertical-align: middle;">description</span></div>` : '-';
                    const foneHTML = rec.fone > 0 ? '<span class="material-symbols-outlined" style="color:var(--petal-pink);">headphones</span>' : '-';
                    
                    tabela.innerHTML += `<tr onclick="abrirDetalhesAluno(${window.todosEducandosBD.indexOf(aluno)})"><td class="td-center" style="font-weight: bold; color: #BC68A1;">${index + 1}</td><td><img src="${aluno.foto}" class="table-avatar"></td><td><strong>${aluno.nome}</strong><br><small style="color:#a0a0a0">${aluno.curso}</small></td><td class="td-center">${aluno.lotesVendidos.length + aluno.lotesPendentes.length}</td><td class="td-center highlight-purple" style="font-weight:bold;">${aluno.lotesVendidos.length}</td><td class="td-center ${aluno.lotesPendentes.length > 0 ? 'td-highlight' : ''}">${aluno.lotesPendentes.length}</td><td class="td-center">${cartelasHTML}</td><td class="td-center">${foneHTML}</td></tr>`;
                });
                if(meusAlunosAtivos.length === 0) tabela.innerHTML = '<tr><td colspan="8" class="text-center" style="padding: 20px; color: #a0a0a0;">Nenhum aluno ativo encontrado. Faça o Cadastro do Educando primeiro.</td></tr>';
            }

            // KPIS GERAIS E GRÁFICOS (Aba Vendas Geral)
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
            if(document.getElementById('kpiVendasReaisGlobal')) document.getElementById('kpiVendasReaisGlobal').innerText = `R$ ${vVendas.toFixed(2).replace('.', ',')}`;
            if(document.getElementById('kpiCaixaPix')) document.getElementById('kpiCaixaPix').innerText = `R$ ${vVendasPix.toFixed(2).replace('.', ',')}`;
            if(document.getElementById('kpiCaixaDinheiro')) document.getElementById('kpiCaixaDinheiro').innerText = `R$ ${vVendasDin.toFixed(2).replace('.', ',')}`;
            if(document.getElementById('kpiProjecaoGlobal')) document.getElementById('kpiProjecaoGlobal').innerText = `R$ ${vPendentes.toFixed(2).replace('.', ',')}`;
            if(document.getElementById('kpiLotesRua')) document.getElementById('kpiLotesRua').innerText = totalPendentesGeral;

            const ctxEst = document.getElementById('estoqueChartEdu');
            if (ctxEst && ctxEst.offsetParent !== null) { 
                if (!estoqueChartInstEdu) estoqueChartInstEdu = new Chart(ctxEst.getContext('2d'), { type: 'doughnut', data: { labels: ['Válidos', 'Pendentes', 'Estoque'], datasets: [{ data: [totalVendidosGeral, totalPendentesGeral, 440], backgroundColor: ['#BC68A1', '#F4B841', '#e0e0e0'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false } });
                else { estoqueChartInstEdu.data.datasets[0].data = [totalVendidosGeral, totalPendentesGeral, 440]; estoqueChartInstEdu.update(); }
            }
            const ctxFin = document.getElementById('financeiroChartEdu');
            if (ctxFin && ctxFin.offsetParent !== null) {
                if (!financeiroChartInstEdu) financeiroChartInstEdu = new Chart(ctxFin.getContext('2d'), { type: 'bar', data: { labels: ['Caixa Realizado', 'Projeção Restante'], datasets: [{ label: 'Valor em R$', data: [vVendas, vPendentes], backgroundColor: ['#BC68A1', '#F4B841'], borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } } });
                else { financeiroChartInstEdu.data.datasets[0].data = [vVendas, vPendentes]; financeiroChartInstEdu.update(); }
            }

            // Ranking Educandos e Educadores
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
            const tabelaRankingEducadores = document.getElementById('tabelaRankingEducadoresLista');
            if(tabelaRankingEducadores) {
                tabelaRankingEducadores.innerHTML = "";
                let rankingProf = [...window.mockEducadoresBD].sort((a, b) => b.lotesVendidos - a.lotesVendidos);
                rankingProf.forEach((prof, index) => {
                    const destaque = textoIgual(prof.nome, userName) ? 'background-color: rgba(188, 104, 161, 0.05);' : '';
                    tabelaRankingEducadores.innerHTML += `<tr style="${destaque}"><td class="td-center" style="font-weight: bold; color: var(--petal-pink);">${index + 1}º</td><td><strong>${prof.nome}</strong></td><td style="color: var(--dim-grey);">${prof.curso}</td><td class="td-center" style="font-weight: bold; font-size: 1.1rem;">${prof.lotesVendidos}</td></tr>`;
                });
            }

            // POPULA CUSTOM SELECTS
            const todosMeusAlunosDB = window.todosEducandosBD.filter(a => textoIgual(a.educadorResponsavel, userName));
            
            const selectNomeCadastro = document.getElementById("opcoesNomeEducando");
            const wrapCad = document.getElementById("wrapperNomeEducando");
            if(selectNomeCadastro && wrapCad) {
                let optsCad = '';
                const alunosAguardandoCadastro = todosMeusAlunosDB.filter(a => a.cadastroAtivo !== 'Sim');
                if (alunosAguardandoCadastro.length === 0) {
                    optsCad += '<span class="custom-option" data-value="">Todos os alunos já foram ativados</span>';
                } else {
                    alunosAguardandoCadastro.forEach(a => { optsCad += `<span class="custom-option" data-value="${a.nome}">${a.nome} (${a.turma})</span>`; });
                }
                selectNomeCadastro.innerHTML = optsCad;
                wrapCad.querySelector('.trigger-text').textContent = "Selecione o aluno da lista...";
                wrapCad.querySelector('input[type="hidden"]').value = "";
                ativarEventosSelectCustomizado(wrapCad);
            }

            const selectAlunoAtribuir = document.getElementById("opcoesAlunoAtribuir");
            const wrapAttr = document.getElementById("wrapperAlunoAtribuir");
            if (selectAlunoAtribuir && wrapAttr) {
                let optsAttr = '';
                if(meusAlunosAtivos.length === 0) {
                    optsAttr += '<span class="custom-option" data-value="">Nenhum aluno ativo.</span>';
                } else {
                    meusAlunosAtivos.forEach(a => { optsAttr += `<span class="custom-option" data-value="${a.nome}">${a.nome}</span>`; });
                }
                selectAlunoAtribuir.innerHTML = optsAttr;
                wrapAttr.querySelector('.trigger-text').textContent = "Escolha um aluno da sua turma...";
                wrapAttr.querySelector('input[type="hidden"]').value = "";
                ativarEventosSelectCustomizado(wrapAttr);
            }

            const listaLotes = document.getElementById("listaLotesCheckboxes");
            if(listaLotes) {
                let htmlLotes = '';
                // Filtra Lotes da Sede que pertencem a ESTE educador ou estão livres
                const meusLotes = window.lotesSedeBD.filter(l => textoIgual(l.educador, userName) || l.educador === '');
                meusLotes.forEach(l => { 
                    htmlLotes += `<label class="checkbox-item-row"><input type="checkbox" class="roxo-checkbox" value="${l.codigo}"> <span style="color: var(--dim-grey); font-weight: 500;">${l.codigo}</span></label>`; 
                });
                listaLotes.innerHTML = htmlLotes || '<div style="padding: 15px; color:#a0a0a0; text-align:center;">Nenhum lote liberado para você na Sede.</div>';
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
                    return window.abrirModalErro("Por favor, preencha todos os campos do Custom Select.");
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
    // DETALHES ALUNO E OTIMISMO DE INTERFACE
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
        
        const recompensas = calcularRecompensas(aluno.lotesVendidos.length);
        document.getElementById('detalheFone').innerText = recompensas.fone;
        document.getElementById('detalheCartelasGanhas').innerText = recompensas.cartelas;
        
        let pendentesEntrega = recompensas.cartelas - aluno.cartelasEntregues;
        const boxRetirar = document.getElementById('boxRetirarCartela');
        if (pendentesEntrega > 0) {
            boxRetirar.style.display = 'block';
            document.getElementById('detalheCartelasPendentes').innerText = pendentesEntrega;
            document.getElementById('btnRetirarCartela').onclick = () => window.registrarRetiradaCartela(idx);
        } else {
            boxRetirar.style.display = 'none';
        }

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

    window.registrarRetiradaCartela = function(idx) {
        const aluno = window.todosEducandosBD[idx];
        aluno.cartelasEntregues += 1; 
        abrirDetalhesAluno(idx); 
        fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'entregar_cartela', nomeAluno: aluno.nome }) }).catch(err => console.error(err));
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
        
        fecharModal('modalAcaoLote'); window.abrirModalSucesso("Venda confirmada!"); 
        if(document.getElementById("adminPage")) window.atualizarDashboardsADM(); 
        if(document.getElementById("educadorPage")) window.atualizarDashboardEducador();

        fetch(SCRIPT_URL, {
            method: 'POST', body: JSON.stringify({ action: 'transacao_lote', acaoLote: 'venda', lote: lote, nomeAluno: aluno.nome, vPix: vPix, vDin: vDin, responsavel: userName })
        }).catch(err => console.error("Erro", err));
    }

    window.confirmarDevolucaoLote = function() {
        const lote = document.getElementById('acaoLoteInput').value;
        const idx = document.getElementById('acaoAlunoIdxInput').value;
        const aluno = window.todosEducandosBD[idx];
        
        aluno.lotesPendentes = aluno.lotesPendentes.filter(l => l !== lote);
        if(!aluno.lotesDevolvidos) aluno.lotesDevolvidos = [];
        aluno.lotesDevolvidos.push(lote);
        
        fecharModal('modalAcaoLote'); window.abrirModalSucesso("Lote devolvido com sucesso!"); 
        if(document.getElementById("adminPage")) window.atualizarDashboardsADM();
        if(document.getElementById("educadorPage")) window.atualizarDashboardEducador();

        fetch(SCRIPT_URL, {
            method: 'POST', body: JSON.stringify({ action: 'transacao_lote', acaoLote: 'devolucao', lote: lote, nomeAluno: aluno.nome, responsavel: userName })
        }).catch(err => console.error("Erro", err));
    }
});
