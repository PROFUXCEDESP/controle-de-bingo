document.addEventListener("DOMContentLoaded", () => {
    
    // Utilitário para comparação robusta de strings (Turma 4 / Instalador)
    function textoIgual(t1, t2) {
        if(!t1 || !t2) return false;
        return t1.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() === 
               t2.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    }

    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwWD-pi7qf1Vlp01I8CO-7euJmqsNureruSEjeFc9bdYUZ_M13he6bqBC_ctJGHUpc4ow/exec'; 
    const userName = localStorage.getItem('usuarioLogado') || 'Administrador';
    
    // Estado do Banco e Paginação
    window.todosEducandosBD = [];
    window.caixaGlobal = { pixReais: 0.00, dinReais: 0.00 };
    window.paginacao = { minhaTurma: 0, itensPorPagina: 10 };

    window.mudarPagina = function(chave, direcao) {
        window.paginacao[chave] += direcao;
        if (window.paginacao[chave] < 0) window.paginacao[chave] = 0;
        window.atualizarDashboardEducador();
    };

    function gerarControlesPaginacao(chave, totalItens) {
        const totalPaginas = Math.ceil(totalItens / window.paginacao.itensPorPagina);
        if (totalPaginas <= 1) return "";
        const pg = window.paginacao[chave];
        return `
            <div class="paginacao-container">
                <button class="btn-secondary" ${pg === 0 ? 'disabled' : ''} onclick="window.mudarPagina('${chave}', -1)">Anterior</button>
                <span>Página ${pg + 1} de ${totalPaginas}</span>
                <button class="btn-secondary" ${pg >= totalPaginas - 1 ? 'disabled' : ''} onclick="window.mudarPagina('${chave}', 1)">Próximo</button>
            </div>`;
    }

    window.carregarDadosDoBanco = function() {
        fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'sincronizar_dados' }) })
        .then(res => res.json()).then(data => {
            if(data.success) {
                window.todosEducandosBD = data.educandos;
                window.caixaGlobalBD = data.caixaGlobal || [];
                // Processamento de KPIs Financeiros
                window.caixaGlobal = { pixReais: 0, dinReais: 0 };
                window.caixaGlobalBD.forEach(tx => {
                    let val = parseFloat(tx['Valor'] || 0);
                    if(tx['Metodo_Pagamento'] === 'PIX') window.caixaGlobal.pixReais += val;
                    else window.caixaGlobal.dinReais += val;
                });
                window.atualizarDashboardEducador();
            }
        });
    }

    window.atualizarDashboardEducador = function() {
        const filtroTurma = document.getElementById('filtroTurmaAluno').value;
        const busca = document.getElementById('buscaNomeAluno').value.toLowerCase();

        let filtrados = window.todosEducandosBD.filter(a => {
            const eMeu = textoIgual(a.Educador_Responsavel || a.educadorResponsavel, userName);
            const bateTurma = (filtroTurma === "Todas" || textoIgual(a.Turma || a.turma, filtroTurma));
            const bateNome = a.Nome_Educando?.toLowerCase().includes(busca) || a.nome?.toLowerCase().includes(busca);
            return eMeu && bateTurma && bateNome;
        });

        // Renderização da Tabela Paginada
        const tabela = document.getElementById("tabelaAlunos");
        const inicio = window.paginacao.minhaTurma * window.paginacao.itensPorPagina;
        const slice = filtrados.slice(inicio, inicio + window.paginacao.itensPorPagina);

        tabela.innerHTML = slice.map((aluno, i) => `
            <tr>
                <td class="td-center">${inicio + i + 1}</td>
                <td><img src="${aluno.Foto_URL || aluno.foto}" class="table-avatar"></td>
                <td><strong>${aluno.Nome_Educando || aluno.nome}</strong></td>
                <td class="td-center">${(aluno.Lotes_Vendidos?.length || 0) + (aluno.Lotes_Pendentes?.length || 0)}</td>
                <td class="td-center highlight-purple">${aluno.Lotes_Vendidos?.length || 0}</td>
                <td class="td-center">${aluno.Lotes_Pendentes?.length || 0}</td>
                <td class="td-center">-</td><td class="td-center">-</td>
            </tr>`).join('');

        // Injeção de Paginação
        const cont = tabela.closest('.table-container');
        if (cont.querySelector('.paginacao-container')) cont.querySelector('.paginacao-container').remove();
        cont.insertAdjacentHTML('beforeend', gerarControlesPaginacao('minhaTurma', filtrados.length));

        // Atualização dos KPIs restaurados no HTML
        document.getElementById('kpiVendasReaisGlobal').innerText = `R$ ${(window.caixaGlobal.pixReais + window.caixaGlobal.dinReais).toFixed(2)}`;
        document.getElementById('kpiCaixaPix').innerText = `R$ ${window.caixaGlobal.pixReais.toFixed(2)}`;
        document.getElementById('kpiCaixaDinheiro').innerText = `R$ ${window.caixaGlobal.dinReais.toFixed(2)}`;
    };

    window.carregarDadosDoBanco();
});

http://googleusercontent.com/immersive_entry_chip/0
http://googleusercontent.com/immersive_entry_chip/1
