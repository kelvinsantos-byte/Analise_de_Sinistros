// 1. CONFIGURAÇÕES
if (typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}
const URL_GOOGLE_SHEETS = "https://script.google.com/macros/s/AKfycbxlOqtz4yniLangqgsUqVC6c1dK9hJpjtwHGyaUwik6vuw_Wz-95T7ffJy89_eJUPtonA/exec";
const URL_DIM_VEICULOS = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSoKUctfHyh31vYwfkclbkBQvuNnTk7TNkCncybt1SckZUB1BhruYT5qlcKCFp5_-1oWYcE6WHIllnJ/pub?gid=153791661&single=true&output=csv";
const URL_TELEMETRIA_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSoKUctfHyh31vYwfkclbkBQvuNnTk7TNkCncybt1SckZUB1BhruYT5qlcKCFp5_-1oWYcE6WHIllnJ/pub?gid=1567566318&single=true&output=csv";

let charts = {}; 
let dadosTelemetriaCache = null; 

// 2. FUNÇÕES AUXILIARES
function formatarDataBR(dataISO) {
    if (!dataISO) return "";
    const partes = dataISO.split("-");
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

window.toggleAtivo = function(mostrar) {
    const container = document.getElementById('containerAtivo');
    if (container) container.style.display = mostrar ? 'block' : 'none';
}

window.toggleAtivoMultas = function(mostrar) {
    const container = document.getElementById('containerMultas');
    if (container) container.style.display = mostrar ? 'block' : 'none';
}

function validarEtapaComSwitch(idSwitch, storageKeyFoto, nomeEtapa, relExibirKey) {
    const sw = document.getElementById(idSwitch);
    const isAtivo = sw && sw.checked;

    if (isAtivo) {
        const foto = localStorage.getItem(storageKeyFoto);
        if (!foto) {
            alert(`⚠️ Atenção: O switch de "${nomeEtapa}" está ATIVO, mas nenhuma imagem foi detectada. Cole ou arraste a imagem ou desative o botão para continuar.`);
            return false;
        }
        localStorage.setItem(relExibirKey, "Sim");
    } else {
        localStorage.setItem(relExibirKey, "Não");
        localStorage.setItem(storageKeyFoto, `Condutor não possui ${nomeEtapa} no período de 2025/2026`);
    }
    return true;
}

// --- SISTEMA DE TRATAMENTO DE IMAGEM ---

function adicionarBotaoDeletar(areaId, prevId, storageKey) {
    const area = document.getElementById(areaId);
    if (!area) return;

    // Remove botão anterior se já existir
    const btnExistente = area.querySelector('.btn-deletar-foto');
    if (btnExistente) btnExistente.remove();

    const btn = document.createElement('button');
    btn.className = 'btn-deletar-foto';
    btn.innerHTML = '🗑';
    btn.title = 'Remover foto';
    btn.style.cssText = `
        position: absolute;
        top: 6px;
        right: 6px;
        background: rgba(220, 53, 69, 0.85);
        color: white;
        border: none;
        border-radius: 50%;
        width: 28px;
        height: 28px;
        font-size: 14px;
        cursor: pointer;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
    `;

    btn.addEventListener('click', function(e) {
        e.stopPropagation();
        // Limpa a imagem
        const prev = document.getElementById(prevId);
        if (prev) { prev.src = ''; prev.style.display = 'none'; }
        // Mostra o placeholder novamente
        const ph = area.querySelector('.placeholder-interno');
        if (ph) ph.style.display = 'block';
        // Remove do localStorage
        localStorage.removeItem(storageKey);
        // Remove o botão
        btn.remove();
    });

    area.appendChild(btn);
}

function processarImagem(file, prevId, storageKey, areaId) {
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width, height = img.height;
            const MAX_WIDTH = 800; 
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
            const prev = document.getElementById(prevId);
            const area = document.getElementById(areaId);

            if (prev) {
                prev.src = compressedBase64;
                prev.style.display = "block";
            }
            if (area) {
                const ph = area.querySelector('.placeholder-interno');
                if (ph) ph.style.display = "none";
            }
            localStorage.setItem(storageKey, compressedBase64);

            // Adiciona botão de deletar após inserir a foto
            adicionarBotaoDeletar(areaId, prevId, storageKey);
        };
    };
    reader.readAsDataURL(file);
}

function configurarCapturaImagem(idArea, idPreview, storageKey) {
    const area = document.getElementById(idArea);
    if (!area) return;

    area.addEventListener('paste', (e) => {
        const itens = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let i = 0; i < itens.length; i++) {
            if (itens[i].type.indexOf("image") !== -1) {
                processarImagem(itens[i].getAsFile(), idPreview, storageKey, idArea);
            }
        }
    });

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        area.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        area.addEventListener(eventName, () => {
            area.style.borderColor = '#00003c';
            area.style.backgroundColor = '#f0f0ff';
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        area.addEventListener(eventName, () => {
            area.style.borderColor = ''; 
            area.style.backgroundColor = '';
        }, false);
    });

    area.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files[0];
        processarImagem(file, idPreview, storageKey, idArea);
    });

    area.onclick = () => area.focus();
}

// 3. GESTÃO DE GRÁFICOS
async function carregarDadosTelemetria() {
    try {
        const response = await fetch(URL_TELEMETRIA_CSV + "&t=" + new Date().getTime());
        if (!response.ok) throw new Error("Falha ao baixar CSV");
        
        const csvData = await response.text();
        let linhasBrutas = csvData.split('\n');
        let sep = linhasBrutas[0].split(',').length < 5 ? ';' : ',';

        const linhas = linhasBrutas.map(l => l.split(sep).map(c => c.replace(/"/g, '').trim()));
        
        const idxTime = 53, idxAce = 1, idxFreio = 42, idxRPM = 45, idxVel = 51;
        let labels = [], dVel = [], dRPM = [], dAce = [], dFreio = [];
        const dadosDesejados = linhas.slice(1, 13).reverse(); 

        dadosDesejados.forEach(col => {
            if (col.length > 1) {
                labels.push(col[idxTime] || ""); 
                const limparNum = (val) => {
                    if (!val) return 0;
                    let limpo = val.replace(/[^\d,.-]/g, '');
                    if (limpo.includes(',') && limpo.includes('.')) limpo = limpo.replace(/\./g, '');
                    limpo = limpo.replace(',', '.');
                    return parseFloat(limpo) || 0;
                };
                dVel.push(limparNum(col[idxVel]));   
                dRPM.push(limparNum(col[idxRPM]));   
                dAce.push(limparNum(col[idxAce]));   
                dFreio.push(limparNum(col[idxFreio])); 
            }
        });

        dadosTelemetriaCache = { labels, dVel, dRPM, dAce, dFreio };
        localStorage.setItem('rel_grafico_labels', JSON.stringify(labels));
        localStorage.setItem('rel_grafico_vel', JSON.stringify(dVel));
        localStorage.setItem('rel_grafico_rpm', JSON.stringify(dRPM));
        localStorage.setItem('rel_grafico_ace', JSON.stringify(dAce));
        localStorage.setItem('rel_grafico_fre', JSON.stringify(dFreio));

        atualizarInterfaceGraficos(""); 
    } catch (err) { 
        console.error("Erro na Telemetria:", err);
    }
}

function atualizarInterfaceGraficos(sufixo) {
    if (!dadosTelemetriaCache) return;
    let containerId, telaPaiId, elementoAncoragemId;

    if (sufixo === "") {
        containerId = 'container_telemetria_graficos';
        telaPaiId = 'tela_ocorrencia';
        elementoAncoragemId = 'complemento_ocorrencia';
    } else if (sufixo === "_gps") {
        containerId = 'container_telemetria_gps';
        telaPaiId = 'tela_gps';
        elementoAncoragemId = 'areaCapturaFoto';
    } else if (sufixo === "_conclusao") {
        containerId = 'container_telemetria_conclusao';
        telaPaiId = 'tela_gps_conclusao';
        elementoAncoragemId = 'areaCapturaFotoConclusao';
    }

    let oldContainer = document.getElementById(containerId);
    if(oldContainer) oldContainer.remove();

    criarEstruturaGraficos(containerId, telaPaiId, elementoAncoragemId, sufixo);
    const { labels, dVel, dRPM, dAce, dFreio } = dadosTelemetriaCache;

    if (sufixo === "") {
        renderizarGrafico('chartVelocidade' + sufixo, 'line', labels, dVel, '#00003c', 'Velocidade', true);
        renderizarGrafico('chartRPM' + sufixo, 'line', labels, dRPM, '#237804', 'RPM', true);
        renderizarGrafico('chartAcelerador' + sufixo, 'bar', labels, dAce, '#5ea2a6', 'Acelerador %', false);
        renderizarGrafico('chartFreio' + sufixo, 'bar', labels, dFreio, '#e84c4c', 'Pedal de Freio', false);
    } else if (sufixo === "_gps") {
        renderizarGrafico('chartVelocidade' + sufixo, 'line', labels, dVel, '#00003c', 'Velocidade', true);
        renderizarGrafico('chartAcelerador' + sufixo, 'bar', labels, dAce, '#5ea2a6', 'Acelerador %', false);
    } else if (sufixo === "_conclusao") {
        renderizarGrafico('chartVelocidade' + sufixo, 'line', labels, dVel, '#00003c', 'Velocidade', true);
        renderizarGrafico('chartFreio' + sufixo, 'bar', labels, dFreio, '#e84c4c', 'Pedal de Freio', false);
    }
}

function criarEstruturaGraficos(containerId, telaId, ancoragemId, sufixo) {
    let container = document.getElementById(containerId);
    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.style.cssText = "margin-top: 20px; display: flex; flex-direction: column; gap: 12px; max-width: 800px;";
        
        let secoes = [];
        if (sufixo === "") {
            secoes = [
                {id: 'chartVelocidade' + sufixo, tit: 'Velocidade'},
                {id: 'chartRPM' + sufixo, tit: 'RPM'},
                {id: 'chartAcelerador' + sufixo, tit: 'Acelerador %'},
                {id: 'chartFreio' + sufixo, tit: 'Pedal de Freio'}
            ];
        } else if (sufixo === "_gps") {
            secoes = [
                {id: 'chartVelocidade' + sufixo, tit: 'Velocidade'},
                {id: 'chartAcelerador' + sufixo, tit: 'Acelerador %'}
            ];
        } else if (sufixo === "_conclusao") {
            secoes = [
                {id: 'chartVelocidade' + sufixo, tit: 'Velocidade'},
                {id: 'chartFreio' + sufixo, tit: 'Pedal de Freio'}
            ];
        }

        container.innerHTML = secoes.map(s => `
            <div style="border: 1px solid #ccc; background: #fff;">
                <div style="background: #7b7878; color: white; padding: 6px 15px; font-weight: bold; font-size: 14px;">${s.tit}</div>
                <div style="height: 180px; padding: 10px;">
                    <canvas id="${s.id}"></canvas>
                </div>
            </div>
        `).join('');

        const alvo = document.getElementById(ancoragemId);
        if (alvo && alvo.parentNode) {
             alvo.parentNode.insertBefore(container, alvo.nextSibling);
        }
    }
}

function renderizarGrafico(id, tipo, labels, data, cor, titulo, mostrarPontos) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (charts[id]) charts[id].destroy();

    const isPedal = id.includes('Acelerador') || id.includes('Freio');
    const labelsFormatados = labels.map(l => (l && l.includes(' ')) ? l.split(' ') : l);

    charts[id] = new Chart(ctx, {
        type: tipo,
        data: {
            labels: labelsFormatados,
            datasets: [{
                label: titulo,
                data: data,
                borderColor: cor,
                backgroundColor: tipo === 'bar' ? cor : 'transparent',
                borderWidth: 2,
                pointRadius: mostrarPontos ? 2 : 0,
                pointBackgroundColor: cor,
                tension: 0.2,
                fill: false,
                datalabels: {
                    display: true,
                    align: 'end',
                    anchor: 'end',
                    offset: 2,
                    color: '#333',
                    font: { weight: 'bold', size: 10 },
                    clip: false, 
                    formatter: (value) => value 
                }
            }]
        },
        plugins: [ChartDataLabels],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false, 
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false } 
            },
            layout: { padding: { top: 30, left: 10, right: 10, bottom: 5 } },
            scales: {
                y: { 
                    display: !isPedal,
                    beginAtZero: true,
                    suggestedMax: data.length ? Math.max(...data) * 1.2 : 100,
                    grid: { color: '#f5f5f5' },
                    ticks: { font: { size: 9 } }
                },
                x: { 
                    grid: { display: false },
                    ticks: { font: { size: 8 }, color: '#444', maxRotation: 0, autoSkip: false } 
                }
            }
        }
    });
}

// 4. NAVEGAÇÃO ENTRE ETAPAS
window.voltarParaInicio = () => { 
    document.getElementById('tela_ocorrencia').style.display = 'none'; 
    document.getElementById('formSinistro').style.display = 'block'; 
};

window.salvarEIrParaGPS = () => { 
    const complemento = document.getElementById('complemento_ocorrencia').value;
    localStorage.setItem('rel_complemento_ocorrencia', complemento);
    document.getElementById('tela_ocorrencia').style.display = 'none'; 
    document.getElementById('tela_gps').style.display = 'block'; 
    setTimeout(() => { atualizarInterfaceGraficos("_gps"); }, 150);
};

window.voltarParaOcorrencia = () => { 
    document.getElementById('tela_gps').style.display = 'none'; 
    document.getElementById('tela_ocorrencia').style.display = 'block'; 
    setTimeout(() => { atualizarInterfaceGraficos(""); }, 150);
};

window.irParaImagensLocal = function() {
    if (!localStorage.getItem('rel_foto_gps')) return alert("⚠️ Anexe a imagem do GPS (2.0)");
    document.getElementById('tela_gps').style.display = 'none';
    document.getElementById('tela_imagens_local').style.display = 'block';
};

window.voltarParaGPS = () => { 
    document.getElementById('tela_imagens_local').style.display = 'none'; 
    document.getElementById('tela_gps').style.display = 'block'; 
    setTimeout(() => { atualizarInterfaceGraficos("_gps"); }, 150);
};

window.irParaGPSConclusao = function() {
    const vel = document.getElementById('velocidade_via').value;
    const f1 = localStorage.getItem('rel_foto_sentido_v');
    const f2 = localStorage.getItem('rel_foto_sentido_o');
    if (!f1 || !f2) return alert("⚠️ Cole as fotos do local (3.0)");
    if (!vel) return alert("⚠️ Selecione a velocidade da via.");
    
    localStorage.setItem('rel_velocidade_via', vel);
    document.getElementById('tela_imagens_local').style.display = 'none';
    document.getElementById('tela_gps_conclusao').style.display = 'block';
    setTimeout(() => { atualizarInterfaceGraficos("_conclusao"); }, 150);
};

window.voltarParaImagensLocal = () => { 
    document.getElementById('tela_gps_conclusao').style.display = 'none'; 
    document.getElementById('tela_imagens_local').style.display = 'block'; 
};

window.irParaEtapa5 = function() {
    const f = localStorage.getItem('rel_foto_previa'); 
    if (!f) return alert("⚠️ Anexe a imagem do GPS Conclusão (4.0)");
    document.getElementById('tela_gps_conclusao').style.display = 'none';
    document.getElementById('tela_fotos_sinistro').style.display = 'block';
};

window.voltarParaGPSConclusao = () => { 
    document.getElementById('tela_fotos_sinistro').style.display = 'none'; 
    document.getElementById('tela_gps_conclusao').style.display = 'block'; 
    setTimeout(() => { atualizarInterfaceGraficos("_conclusao"); }, 150);
};

window.irParaEtapa52 = () => { 
    document.getElementById('tela_fotos_sinistro').style.display = 'none'; 
    document.getElementById('tela_fotos_camera_52').style.display = 'block'; 
};

window.irParaEtapa6Da52 = () => { 
    const checkboxHabilitar = document.getElementById('checkHabilitarEtapa52');
    const deveExibir = (checkboxHabilitar && checkboxHabilitar.checked) ? 'Sim' : 'Não';
    
    if (deveExibir === 'Sim') {
        if(!localStorage.getItem('rel_foto_52_1') || !localStorage.getItem('rel_foto_52_2')) {
            return alert("⚠️ Etapa 5.2 ativa: Por favor, anexe as imagens das câmeras.");
        }
    }

    localStorage.setItem('rel_exibir_cameras', deveExibir);
    localStorage.setItem('rel_falha_camera_1', document.getElementById('checkFalha52_1').checked ? "FALHA" : "OK");
    localStorage.setItem('rel_falha_camera_2', document.getElementById('checkFalha52_2').checked ? "FALHA" : "OK");
    document.getElementById('tela_fotos_camera_52').style.display = 'none'; 
    document.getElementById('tela_historico_conducao').style.display = 'block'; 
};

window.irParaEtapa6 = () => { 
    localStorage.setItem('rel_exibir_cameras', 'Não');
    document.getElementById('tela_fotos_sinistro').style.display = 'none'; 
    document.getElementById('tela_historico_conducao').style.display = 'block'; 
};

window.voltarParaEtapa5 = () => { 
    document.getElementById('tela_historico_conducao').style.display = 'none'; 
    document.getElementById('tela_fotos_sinistro').style.display = 'block'; 
};

window.irParaEtapa7 = () => { 
    if (!validarEtapaComSwitch('checkPossuiEtapa6', 'rel_foto_historico', 'Histórico de Condução', 'rel_exibir_etapa6')) return;
    document.getElementById('tela_historico_conducao').style.display = 'none'; 
    document.getElementById('tela_escala_condutor').style.display = 'block'; 
};

window.voltarParaEtapa6 = () => { 
    document.getElementById('tela_escala_condutor').style.display = 'none'; 
    document.getElementById('tela_historico_conducao').style.display = 'block'; 
};

window.irParaEtapa8 = () => { 
    if (!validarEtapaComSwitch('checkPossuiEtapa7', 'rel_foto_escala', 'Escala do Condutor', 'rel_exibir_etapa7')) return;
    document.getElementById('tela_escala_condutor').style.display = 'none'; 
    document.getElementById('tela_treinamentos').style.display = 'block'; 
};

window.voltarParaEtapa7 = () => { 
    document.getElementById('tela_treinamentos').style.display = 'none'; 
    document.getElementById('tela_escala_condutor').style.display = 'block'; 
};

window.irParaEtapa9 = () => { 
    if (!validarEtapaComSwitch('checkPossuiEtapa8', 'rel_foto_treinamento_1', 'Treinamentos', 'rel_exibir_etapa8')) return;
    document.getElementById('tela_treinamentos').style.display = 'none'; 
    document.getElementById('tela_sinistros_2526').style.display = 'block'; 
};

window.voltarParaEtapa8 = () => { 
    document.getElementById('tela_sinistros_2526').style.display = 'none'; 
    document.getElementById('tela_treinamentos').style.display = 'block'; 
};

window.irParaEtapa10 = () => { 
    if (!validarEtapaComSwitch('checkPossuiEtapa9', 'rel_foto_sinistro_2025', 'Sinistros Anteriores', 'rel_exibir_etapa9')) return;
    document.getElementById('tela_sinistros_2526').style.display = 'none'; 
    document.getElementById('tela_reclamacoes').style.display = 'block'; 
};

window.voltarParaEtapa9 = () => { 
    document.getElementById('tela_reclamacoes').style.display = 'none'; 
    document.getElementById('tela_sinistros_2526').style.display = 'block'; 
};

window.irParaEtapa11 = () => { 
    if (!validarEtapaComSwitch('checkPossuiEtapa10', 'rel_foto_rec_2025', 'Reclamações', 'rel_exibir_etapa10')) return;
    document.getElementById('tela_reclamacoes').style.display = 'none'; 
    document.getElementById('tela_excessos').style.display = 'block'; 
};

window.voltarParaEtapa10 = () => { 
    document.getElementById('tela_excessos').style.display = 'none'; 
    document.getElementById('tela_reclamacoes').style.display = 'block'; 
};

window.irParaEtapa12 = () => { 
    if (!validarEtapaComSwitch('checkPossuiEtapa11', 'rel_foto_exc_2025', 'Excessos de Velocidade', 'rel_exibir_etapa11')) return;
    document.getElementById('tela_excessos').style.display = 'none'; 
    document.getElementById('tela_multas').style.display = 'block'; 
};

window.voltarParaEtapa11 = () => { 
    document.getElementById('tela_multas').style.display = 'none'; 
    document.getElementById('tela_excessos').style.display = 'block'; 
};

window.finalizarRelatorio = function() {
    if (!validarEtapaComSwitch('checkPossuiEtapa12', 'rel_foto_multas', 'Multas', 'rel_exibir_etapa12')) return;
    if (!confirm("Deseja gerar o relatório final?")) return;
    
    localStorage.setItem('rel_gps_resumo', document.getElementById('editResumoGPS').value);
    localStorage.setItem('rel_previa_resumo', document.getElementById('editResumoGPSConclusao').value);

    // Garante que a orientação atual do select seja salva antes de abrir o relatório
    const selectOrientacao = document.getElementById('orientacao_fotos');
    if (selectOrientacao) {
        localStorage.setItem('rel_layout_fotos', selectOrientacao.value);
    }
    
    window.open('relatorio_v2.html', '_blank');
};

// 5. LÓGICA DE LAYOUT DE FOTOS
window.ajustarLayoutFotos = function(containerId, orientacao) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.className = (orientacao === 'horizontal') ? 'layout-fotos-horizontal' : 'layout-fotos-vertical';
    const btnH = document.getElementById('btnLayoutH');
    const btnV = document.getElementById('btnLayoutV');
    if (btnH && btnV) {
        btnH.classList.toggle('active', orientacao === 'horizontal');
        btnV.classList.toggle('active', orientacao === 'vertical');
    }
    localStorage.setItem('rel_layout_fotos', orientacao);
};

// 7. BUSCA DE DADOS DIM
async function buscarDadosDIM(prefixoAlvo) {
    try {
        const response = await fetch(URL_DIM_VEICULOS + "&t=" + new Date().getTime());
        const csvData = await response.text();
        const separador = csvData.includes(';') ? ';' : ',';
        const linhas = csvData.split("\n");
        for (let i = 1; i < linhas.length; i++) {
            const regex = new RegExp(`${separador}(?=(?:(?:[^"]*"){2})*[^"]*$)`);
            const col = linhas[i].split(regex).map(c => c.replace(/"/g, '').trim());
            if (col[1] === prefixoAlvo) return { modelo: col[10], ano: parseInt(col[5]) };
        }
    } catch (e) { console.error("Erro DIM:", e); } 
    return null;
}

// 8. INICIALIZAÇÃO GERAL
window.onload = function() {
    const btnLayoutH = document.getElementById('btnLayoutH');
    const btnLayoutV = document.getElementById('btnLayoutV');
    if (btnLayoutH) btnLayoutH.onclick = () => window.ajustarLayoutFotos('containerFotos50', 'horizontal');
    if (btnLayoutV) btnLayoutV.onclick = () => window.ajustarLayoutFotos('containerFotos50', 'vertical');

    const colagens = [
        ['areaCapturaFoto', 'imgPreview', 'rel_foto_gps'],
        ['areaSentidoVeiculo', 'prevSentidoVeiculo', 'rel_foto_sentido_v'],
        ['areaSentidoOposto', 'prevSentidoOposto', 'rel_foto_sentido_o'],
        ['areaCapturaFotoConclusao', 'prevGPSConclusao', 'rel_foto_previa'],
        ['areaFotoHistorico', 'prevHistorico', 'rel_foto_historico'],
        ['areaFotoEscala', 'prevEscala', 'rel_foto_escala'],
        ['areaTreinamento1', 'prevTreinamento1', 'rel_foto_treinamento_1'],
        ['areaTreinamento2', 'prevTreinamento2', 'rel_foto_treinamento_2'],
        ['areaSinistro25', 'prevSinistro25', 'rel_foto_sinistro_2025'],
        ['areaSinistro26', 'prevSinistro26', 'rel_foto_sinistro_2026'],
        ['areaRec25', 'prevRec25', 'rel_foto_rec_2025'],
        ['areaExc25', 'prevExc25', 'rel_foto_exc_2025'],
        ['areaFoto52_1', 'prev52_1', 'rel_foto_52_1'],
        ['areaFoto52_2', 'prev52_2', 'rel_foto_52_2'],
        ['areaMultas', 'prevMultas', 'rel_foto_multas']
    ];
    
    colagens.forEach(c => configurarCapturaImagem(c[0], c[1], c[2]));

    for (let i = 1; i <= 6; i++) {
        configurarCapturaImagem(`areaFoto50_${i}`, `prev50_${i}`, `rel_foto_50_${i}`);
    }

    const formPrincipal = document.getElementById('formSinistro');
    if (formPrincipal) {
        formPrincipal.addEventListener('submit', async function(e) {
            e.preventDefault();
            const chavesParaLimpar = [
                'rel_foto_gps', 'rel_foto_sentido_v', 'rel_foto_sentido_o', 'rel_foto_previa',
                'rel_foto_historico', 'rel_foto_escala', 'rel_foto_treinamento_1', 'rel_foto_treinamento_2',
                'rel_foto_sinistro_2025', 'rel_foto_sinistro_2026', 'rel_foto_rec_2025', 'rel_foto_rec_2026',
                'rel_foto_exc_2025', 'rel_foto_52_1', 'rel_foto_52_2', 'rel_falha_camera_1', 'rel_falha_camera_2',
                'rel_exibir_etapa6', 'rel_exibir_etapa7', 'rel_exibir_etapa8', 'rel_exibir_etapa9', 'rel_exibir_etapa10', 
                'rel_exibir_etapa11', 'rel_exibir_etapa12', 'rel_foto_multas', 'rel_analista'
            ];
            chavesParaLimpar.forEach(key => localStorage.removeItem(key));

            const dados = {
                data_ocorrido: document.getElementById('data_ocorrido').value,
                prefixo: document.getElementById('prefixo').value.trim(),
                empresa: document.getElementById('empresa').value,
                motorista: document.getElementById('motorista').value,
                hora_ocorrido: document.getElementById('hora_ocorrido').value,
                local_ocorrencia: document.getElementById('local_ocorrencia').value,
                tipo_evento: document.getElementById('tipo_evento').value,
                origem: document.getElementById('origem').value,
                destino: document.getElementById('destino').value,
                data_viagem: document.getElementById('data_viagem').value,
                horario_viagem: document.getElementById('horario_viagem').value,
                fadiga: document.querySelector('input[name="fadiga"]:checked')?.value || "Não",
                ativo: document.querySelector('input[name="ativo"]:checked')?.value || "Não",
                analista: document.getElementById('analista').value
            };

            // Salva todos os dados incluindo o analista
            Object.entries(dados).forEach(([k, v]) => localStorage.setItem('rel_' + k, v));

            const dataBR = formatarDataBR(dados.data_ocorrido);
            const res1 = `No dia ${dataBR} às ${dados.hora_ocorrido}, o veículo ${dados.prefixo} da ${dados.empresa}, operando na linha ${dados.horario_viagem} ${dados.origem} X ${dados.destino}, se envolveu em um Sinistro ${dados.tipo_evento}, na ${dados.local_ocorrencia}.`;
            const res2 = `No momento do sinistro, às ${dados.hora_ocorrido}, o condutor se encontrava na velocidade de _____ km/h interagindo com o pedal de acelerador, conforme imagens abaixo:`;
            const res4 = `Consideramos o horário do sinistro às ${dados.hora_ocorrido}, visto que a sua velocidade diminui de _____ Km/h para _____ Km/h, conforme imagem abaixo:`;

            localStorage.setItem('rel_resumo_base', res1);
            localStorage.setItem('rel_gps_resumo', res2);
            localStorage.setItem('rel_previa_resumo', res4);
            localStorage.setItem('rel_txt_fadiga', dados.fadiga === "Não" ? "Veículo não possui Sensor de Fadiga" : `Veículo Possui Sensor de Fadiga: ${dados.ativo === "Sim" ? "Ativo" : "Inativo"}`);

            document.getElementById('textoResumoOcorrencia').innerText = res1;
            document.getElementById('diagnosticoFadiga').innerText = localStorage.getItem('rel_txt_fadiga');
            document.getElementById('textoResumoGPS').innerText = res2;
            document.getElementById('editResumoGPS').value = res2;
            document.getElementById('textoResumoGPSConclusao').innerText = res4;
            document.getElementById('editResumoGPSConclusao').value = res4;

            formPrincipal.style.display = 'none';
            document.getElementById('tela_ocorrencia').style.display = 'block';

            await carregarDadosTelemetria();
            const dim = await buscarDadosDIM(dados.prefixo);
            if (dim) {
                document.getElementById('modeloVeiculoDinamico').innerText = `${dados.prefixo} | ${dim.modelo} | ${dim.ano}`;
                localStorage.setItem('rel_modelo', dim.modelo);
                localStorage.setItem('rel_ano', dim.ano);
                const tecnologia = dim.ano >= 2019 ? "Veículo Possui Tecnologia ADAS/ABAS" : "Veículo Não possui Tecnologia ADAS/ABAS";
                document.getElementById('tecnologiaSeguranca').innerText = tecnologia;
                localStorage.setItem('rel_tecnologia_adas', tecnologia);
            }

            // ── ENVIO PARA O GOOGLE SHEETS ──────────────────────────
            // mode: 'no-cors' corrige o bloqueio de CORS que impedia
            // os dados de chegar na planilha
            fetch(URL_GOOGLE_SHEETS, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            }).catch(err => console.error("Erro no Sheets:", err));
            // ────────────────────────────────────────────────────────
        });
    }

    const setupEdit = (btnId, txtId, editId, key) => {
        const btn = document.getElementById(btnId);
        if(!btn) return;
        btn.onclick = () => {
            const t = document.getElementById(txtId), e = document.getElementById(editId);
            if(e.style.display === "none") {
                e.style.display="block"; t.style.display="none"; btn.innerText="[ Salvar ]";
            } else {
                e.style.display="none"; t.style.display="block"; t.innerText=e.value; btn.innerText="[ Editar resumo ]";
                localStorage.setItem(key, e.value);
            }
        };
    };
    setupEdit('btnEditarGPS', 'textoResumoGPS', 'editResumoGPS', 'rel_gps_resumo');
    setupEdit('btnEditarGPSConclusao', 'textoResumoGPSConclusao', 'editResumoGPSConclusao', 'rel_previa_resumo');
};