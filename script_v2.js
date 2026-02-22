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

// =========================================================
// GESTÃO DE GRÁFICOS (REPLICAÇÃO NAS ETAPAS 1, 2 E 4)
// =========================================================

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

    criarEstruturaGraficos(containerId, telaPaiId, elementoAncoragemId, sufixo);

    const { labels, dVel, dRPM, dAce, dFreio } = dadosTelemetriaCache;

    renderizarGrafico('chartVelocidade' + sufixo, 'line', labels, dVel, '#00003c', 'Velocidade', true);
    renderizarGrafico('chartRPM' + sufixo, 'line', labels, dRPM, '#237804', 'RPM', true);
    renderizarGrafico('chartAcelerador' + sufixo, 'bar', labels, dAce, '#5ea2a6', 'Acelerador %', false);
    renderizarGrafico('chartFreio' + sufixo, 'bar', labels, dFreio, '#e84c4c', 'Pedal de Freio', false);
}

function criarEstruturaGraficos(containerId, telaId, ancoragemId, sufixo) {
    let container = document.getElementById(containerId);
    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.style.cssText = "margin-top: 20px; display: flex; flex-direction: column; gap: 12px; max-width: 800px;";
        
        const secoes = [
            {id: 'chartVelocidade' + sufixo, tit: 'Velocidade'},
            {id: 'chartRPM' + sufixo, tit: 'RPM'},
            {id: 'chartAcelerador' + sufixo, tit: 'Acelerador %'},
            {id: 'chartFreio' + sufixo, tit: 'Pedal de Freio'}
        ];

        container.innerHTML = secoes.map(s => `
            <div style="border: 1px solid #ccc; background: #fff;">
                <div style="background: #7b7878; color: white; padding: 6px 15px; font-weight: bold; font-size: 14px;">${s.tit}</div>
                <div style="height: 180px; padding: 10px;">
                    <canvas id="${s.id}"></canvas>
                </div>
            </div>
        `).join('');

        const tela = document.getElementById(telaId);
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
            events: [], 
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false } 
            },
            layout: {
                padding: { top: 30, left: 10, right: 10, bottom: 5 }
            },
            scales: {
                y: { 
                    display: !isPedal,
                    beginAtZero: true,
                    suggestedMax: Math.max(...data) * 1.2,
                    grid: { color: '#f5f5f5' },
                    ticks: { font: { size: 9 } }
                },
                x: { 
                    grid: { display: false },
                    ticks: { 
                        font: { size: 8 },
                        color: '#444',
                        maxRotation: 0,
                        autoSkip: false 
                    } 
                }
            }
        }
    });
}

// 3. NAVEGAÇÃO ENTRE ETAPAS
window.voltarParaInicio = () => { 
    document.getElementById('tela_ocorrencia').style.display = 'none'; 
    document.getElementById('formSinistro').style.display = 'block'; 
};

window.irParaGPS = () => { 
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
    if (!f1 || f1.length < 100 || !f2 || f2.length < 100) return alert("⚠️ Cole as fotos do local (3.0)");
    if (!vel) return alert("⚠️ Selecione a velocidade da via.");
    localStorage.setItem('rel_velocidade_via', vel);
    document.getElementById('tela_imagens_local').style.display = 'none';
    document.getElementById('tela_gps_conclusao').style.display = 'block';
    // GATILHO PARA ETAPA 4.0
    setTimeout(() => { atualizarInterfaceGraficos("_conclusao"); }, 150);
};

window.voltarParaImagensLocal = () => { 
    document.getElementById('tela_gps_conclusao').style.display = 'none'; 
    document.getElementById('tela_imagens_local').style.display = 'block'; 
};

window.irParaEtapa5 = function() {
    const f = localStorage.getItem('rel_foto_gps_conclusao');
    if (!f || f.length < 100) return alert("⚠️ Anexe a imagem do GPS Conclusão (4.0)");
    document.getElementById('tela_gps_conclusao').style.display = 'none';
    document.getElementById('tela_fotos_sinistro').style.display = 'block';
};

window.voltarParaGPSConclusao = () => { 
    document.getElementById('tela_fotos_sinistro').style.display = 'none'; 
    document.getElementById('tela_gps_conclusao').style.display = 'block'; 
    setTimeout(() => { atualizarInterfaceGraficos("_conclusao"); }, 150);
};

window.abrirPagina51 = () => {
    document.getElementById('tela_fotos_sinistro').style.display = 'none';
    document.getElementById('tela_fotos_sinistro_51').style.display = 'block';
};

window.voltarParaEtapa50 = () => {
    document.getElementById('tela_fotos_sinistro_51').style.display = 'none';
    document.getElementById('tela_fotos_camera_52').style.display = 'none';
    document.getElementById('tela_fotos_sinistro').style.display = 'block';
};

window.irParaEtapa52 = function() {
    document.getElementById('tela_fotos_sinistro').style.display = 'none';
    document.getElementById('tela_fotos_sinistro_51').style.display = 'none';
    document.getElementById('tela_fotos_camera_52').style.display = 'block';
};

window.irParaEtapa6 = function() {
    document.getElementById('tela_fotos_sinistro').style.display = 'none';
    document.getElementById('tela_fotos_sinistro_51').style.display = 'none';
    document.getElementById('tela_historico_conducao').style.display = 'block';
};

window.irParaEtapa6Da52 = function() {
    const falhaS1 = document.getElementById('checkFalha52_1').checked ? "FALHA" : "OK";
    const falhaS2 = document.getElementById('checkFalha52_2').checked ? "FALHA" : "OK";
    localStorage.setItem('rel_falha_camera_1', falhaS1);
    localStorage.setItem('rel_falha_camera_2', falhaS2);
    document.getElementById('tela_fotos_camera_52').style.display = 'none';
    document.getElementById('tela_historico_conducao').style.display = 'block';
};

window.voltarParaEtapa5 = () => {
    document.getElementById('tela_historico_conducao').style.display = 'none';
    document.getElementById('tela_fotos_sinistro').style.display = 'block';
};

window.irParaEtapa7 = function() {
    const fotoHist = localStorage.getItem('rel_foto_historico');
    if (!fotoHist || fotoHist.length < 100) return alert("⚠️ O Histórico não foi detectado.");
    document.getElementById('tela_historico_conducao').style.display = 'none';
    document.getElementById('tela_escala_condutor').style.display = 'block';
};

window.voltarParaEtapa6 = () => {
    document.getElementById('tela_escala_condutor').style.display = 'none';
    document.getElementById('tela_historico_conducao').style.display = 'block';
};

window.irParaEtapa8 = function() {
    const fotoEscala = localStorage.getItem('rel_foto_escala');
    if (!fotoEscala || fotoEscala.length < 100) return alert("⚠️ A Escala não foi detectada.");
    document.getElementById('tela_escala_condutor').style.display = 'none';
    document.getElementById('tela_treinamentos').style.display = 'block';
};

window.voltarParaEtapa7 = () => {
    document.getElementById('tela_treinamentos').style.display = 'none';
    document.getElementById('tela_escala_condutor').style.display = 'block';
};

window.irParaEtapa9 = function() {
    document.getElementById('tela_treinamentos').style.display = 'none';
    document.getElementById('tela_sinistros_2526').style.display = 'block';
};

window.voltarParaEtapa8 = () => {
    document.getElementById('tela_sinistros_2526').style.display = 'none';
    document.getElementById('tela_treinamentos').style.display = 'block';
};

window.irParaEtapa10 = function() {
    document.getElementById('tela_sinistros_2526').style.display = 'none';
    document.getElementById('tela_reclamacoes').style.display = 'block';
};

window.voltarParaEtapa9 = () => {
    document.getElementById('tela_reclamacoes').style.display = 'none';
    document.getElementById('tela_sinistros_2526').style.display = 'block';
};

window.irParaEtapa11 = function() {
    document.getElementById('tela_reclamacoes').style.display = 'none';
    document.getElementById('tela_excessos').style.display = 'block';
};

window.voltarParaEtapa10 = () => {
    document.getElementById('tela_excessos').style.display = 'none';
    document.getElementById('tela_reclamacoes').style.display = 'block';
};

window.finalizarRelatorio = function() {
    const exc25 = localStorage.getItem('rel_foto_exc_2025');
    if (!exc25) return alert("⚠️ Anexe o print de excessos de velocidade 2025.");
    alert("Relatório processado com sucesso!");
    window.location.href = "relatorio.html";
};

// 4. LÓGICA DE LAYOUT DE FOTOS
window.ajustarLayoutFotos = function(containerId, orientacao) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.className = (orientacao === 'horizontal') ? 'layout-fotos-horizontal' : 'layout-fotos-vertical';
    localStorage.setItem('rel_orientacao_' + containerId, orientacao);
};

// 5. SISTEMA DE CAPTURA COM COMPRESSÃO (REVISADO PARA EVITAR ERRO DE TAMANHO)
function configurarSistemaPaste(idArea, idPreview, storageKey) {
    const area = document.getElementById(idArea);
    const prev = document.getElementById(idPreview);
    if (!area || !prev) return;

    area.addEventListener('paste', (e) => {
        const itens = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let i = 0; i < itens.length; i++) {
            if (itens[i].type.indexOf("image") !== -1) {
                const blob = itens[i].getAsFile();
                const reader = new FileReader();
                
                reader.onload = (event) => {
                    const img = new Image();
                    img.src = event.target.result;
                    
                    img.onload = () => {
                        // Criamos um canvas para redimensionar a imagem
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;

                        // Reduz a escala se a imagem for muito grande (max 1200px)
                        const MAX_WIDTH = 1200;
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }

                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);

                        // Exporta como JPEG com qualidade 0.7 (reduz 80% do peso sem notar diferença)
                        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                        
                        prev.src = compressedBase64;
                        prev.style.display = "block";
                        const ph = area.querySelector('.placeholder-interno');
                        if (ph) ph.style.display = "none";
                        
                        try {
                            localStorage.setItem(storageKey, compressedBase64);
                            console.log(`Sucesso: ${storageKey} comprimida.`);
                        } catch (err) {
                            console.error("Erro persistente de storage:", err);
                            alert("O navegador ainda diz que está cheio. Tente limpar o cache ou use uma imagem menor.");
                        }
                    };
                };
                reader.readAsDataURL(blob);
            }
        }
    });
    area.onclick = () => area.focus();
}

// 3. NAVEGAÇÃO REVISADA (ETAPA 3 PARA 4)
window.irParaGPSConclusao = function() {
    const vel = document.getElementById('velocidade_via').value;
    const f1 = localStorage.getItem('rel_foto_sentido_v');
    const f2 = localStorage.getItem('rel_foto_sentido_o');

    // Validação flexível: se existir qualquer dado, ele deixa passar
    if (!f1 || f1.length < 100 || !f2 || f2.length < 100) {
        return alert("⚠️ As fotos do local (3.0) não foram identificadas. Cole-as novamente.");
    }

    if (!vel) return alert("⚠️ Selecione a velocidade da via.");

    localStorage.setItem('rel_velocidade_via', vel);
    document.getElementById('tela_imagens_local').style.display = 'none';
    document.getElementById('tela_gps_conclusao').style.display = 'block';
    
    setTimeout(() => { atualizarInterfaceGraficos("_conclusao"); }, 150);
};

// 6. BUSCA DE DADOS DIM
async function buscarDadosDIM(prefixoAlvo) {
    try {
        const response = await fetch(URL_DIM_VEICULOS + "&t=" + new Date().getTime());
        const csvData = await response.text();
        if (csvData.includes("<!DOCTYPE html>")) return null;
        const separador = csvData.includes(';') ? ';' : ',';
        const linhas = csvData.split("\n");
        for (let i = 1; i < linhas.length; i++) {
            const regex = new RegExp(`${separador}(?=(?:(?:[^"]*"){2})*[^"]*$)`);
            const col = linhas[i].split(regex).map(c => c.replace(/"/g, '').trim());
            if (col[1] === prefixoAlvo) {
                return { modelo: col[10], ano: parseInt(col[5]?.replace(',', '.')) };
            }
        }
    } catch (e) { console.error("Erro DIM:", e); } 
    return null;
}

// 7. INICIALIZAÇÃO GERAL
window.onload = function() {
    configurarSistemaPaste('areaCapturaFoto', 'imgPreview', 'rel_foto_gps');
    configurarSistemaPaste('areaSentidoVeiculo', 'prevSentidoVeiculo', 'rel_foto_sentido_v');
    configurarSistemaPaste('areaSentidoOposto', 'prevSentidoOposto', 'rel_foto_sentido_o');
    configurarSistemaPaste('areaCapturaFotoConclusao', 'prevGPSConclusao', 'rel_foto_gps_conclusao');
    configurarSistemaPaste('areaFotoHistorico', 'prevHistorico', 'rel_foto_historico');
    configurarSistemaPaste('areaFotoEscala', 'prevEscala', 'rel_foto_escala');
    configurarSistemaPaste('areaTreinamento1', 'prevTreinamento1', 'rel_foto_treinamento_1');
    configurarSistemaPaste('areaTreinamento2', 'prevTreinamento2', 'rel_foto_treinamento_2');
    configurarSistemaPaste('areaSinistro25', 'prevSinistro25', 'rel_foto_sinistro_2025');
    configurarSistemaPaste('areaSinistro26', 'prevSinistro26', 'rel_foto_sinistro_2026');
    configurarSistemaPaste('areaRec25', 'prevRec25', 'rel_foto_rec_2025');
    configurarSistemaPaste('areaRec26', 'prevRec26', 'rel_foto_rec_2026');
    configurarSistemaPaste('areaExc25', 'prevExc25', 'rel_foto_exc_2025');
    configurarSistemaPaste('areaFoto52_1', 'prev52_1', 'rel_foto_52_1');
    configurarSistemaPaste('areaFoto52_2', 'prev52_2', 'rel_foto_52_2');

    for (let i = 1; i <= 6; i++) {
        configurarSistemaPaste(`areaFoto50_${i}`, `prev50_${i}`, `rel_foto_50_${i}`);
        configurarSistemaPaste(`areaFoto51_${i}`, `prev51_${i}`, `rel_foto_51_${i}`);
    }

    const selectVel = document.getElementById('velocidade_via');
    if (selectVel) {
        for (let i = 10; i <= 120; i += 10) {
            let opt = document.createElement('option');
            opt.value = i + " km/h"; opt.innerHTML = i + " km/h";
            selectVel.appendChild(opt);
        }
    }

    const formPrincipal = document.getElementById('formSinistro');
    if (formPrincipal) {
        formPrincipal.addEventListener('submit', async function(e) {
            e.preventDefault();
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

            fetch(URL_GOOGLE_SHEETS, { method: 'POST', mode: 'no-cors', body: JSON.stringify(dados) });

            const dataBR = formatarDataBR(dados.data_ocorrido);
            const res1 = `No dia ${dataBR} às ${dados.hora_ocorrido}, o veículo ${dados.prefixo} da ${dados.empresa}, operando na linha ${dados.horario_viagem} ${dados.origem} X ${dados.destino}, se envolveu em um Sinistro ${dados.tipo_evento}, na ${dados.local_ocorrencia}.`;
            const res2 = `No momento do sinistro, às ${dados.hora_ocorrido}, o condutor se encontrava na velocidade de _____ km/h interagindo com o pedal de acelerador, conforme imagens abaixo:`;
            const res4 = `Consideramos o horário do sinistro às ${dados.hora_ocorrido}, visto que a sua velocidade diminui de _____ Km/h para _____ Km/h, conforme imagem abaixo:`;

            localStorage.clear();
            localStorage.setItem('rel_resumo_base', res1);
            localStorage.setItem('rel_gps_resumo', res2);
            localStorage.setItem('rel_gps_conclusao_txt', res4);
            localStorage.setItem('rel_txt_fadiga', dados.fadiga === "Não" ? "Veículo não possui Sensor de Fadiga" : `Veículo Possui Sensor de Fadiga: ${dados.ativo === "Sim" ? "Ativo" : "Inativo"}`);
            localStorage.setItem('rel_prefixo', dados.prefixo);
            localStorage.setItem('rel_analista', dados.analista);

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
                const tecnologia = dim.ano >= 2019 ? "Veículo Possui Tecnologia ADAS/ABAS" : "Veículo Não possui Tecnologia ADAS/ABAS";
                document.getElementById('tecnologiaSeguranca').innerText = tecnologia;
                localStorage.setItem('rel_modelo_completo', `${dim.modelo} | ${dim.ano}`);
                localStorage.setItem('rel_tecnologia_adas', tecnologia);
            }
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
                e.style.display="none"; t.style.display="block"; t.innerText=e.value; btn.innerText="[ Editar ]";
                localStorage.setItem(key, e.value);
            }
        };
    };
    setupEdit('btnEditarGPS', 'textoResumoGPS', 'editResumoGPS', 'rel_gps_resumo');
    setupEdit('btnEditarGPSConclusao', 'textoResumoGPSConclusao', 'editResumoGPSConclusao', 'rel_gps_conclusao_txt');
};