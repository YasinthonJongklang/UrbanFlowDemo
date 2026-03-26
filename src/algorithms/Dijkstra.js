import { GraphLoader } from './core/GraphLoader.js';
import { DijkstraStrategy } from './algorithms/Dijkstra.js';

if (sessionStorage.getItem('isLoggedIn') !== 'true') { window.location.href = 'auth.html'; }

let graph, map, currentMode = 'time', routeLine = null;
let currentLang = localStorage.getItem('urban_lang') || 'en';

async function init() {
    const loader = new GraphLoader();
    graph = await loader.load('./data/transit_network.json');
    document.getElementById('uName').innerText = sessionStorage.getItem('userEmail');

    // Init Map
    map = L.map('map', { zoomControl: false }).setView([13.75, 100.53], 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);

    // Setup Language and UI
    setupLanguage();
    populateDropdowns();
    renderMapNodes();

    // Events
    document.getElementById('langToggleBtn').onclick = () => {
        currentLang = currentLang === 'en' ? 'th' : 'en';
        localStorage.setItem('urban_lang', currentLang);
        setupLanguage();
        populateDropdowns(); // Re-render dropdowns with new language
        renderMapNodes();    // Re-render map popups
    };

    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            currentMode = e.currentTarget.dataset.mode;
        };
    });

    document.getElementById('searchBtn').onclick = calculateAndDraw;
}

// ---------------- UI & Language Functions ----------------
function setupLanguage() {
    document.querySelectorAll('[data-en]').forEach(el => {
        el.innerText = el.getAttribute(`data-${currentLang}`);
    });
    document.body.className = currentLang === 'th' ? 'th-lang' : '';
    document.getElementById('langToggleBtn').innerText = currentLang === 'en' ? 'TH' : 'EN';
}

function getNodeName(node) {
    // ดึงชื่อตามภาษา หรือ fallback ไปใช้ชื่ออังกฤษถ้าไม่มีข้อมูล
    return currentLang === 'th' && node.name_th ? node.name_th : (node.name_en || node.name);
}

function populateDropdowns() {
    const startSel = document.getElementById('startNode');
    const endSel = document.getElementById('endNode');
    
    // เก็บค่าที่เลือกไว้ก่อนเปลี่ยนภาษา
    const currentStart = startSel.value;
    const currentEnd = endSel.value;

    startSel.innerHTML = '';
    endSel.innerHTML = '';

    const sortedNodes = Object.values(graph.nodes).sort((a,b) => getNodeName(a).localeCompare(getNodeName(b)));
    
    sortedNodes.forEach(node => {
        const name = getNodeName(node);
        const opt = `<option value="${node.id}">${name} (${node.line})</option>`;
        startSel.innerHTML += opt;
        endSel.innerHTML += opt;
    });

    // คืนค่าที่เลือกไว้
    if (currentStart) startSel.value = currentStart;
    if (currentEnd) endSel.value = currentEnd;
}

let nodeMarkers = [];
function renderMapNodes() {
    // ลบจุดเก่าออกก่อนวาดใหม่
    nodeMarkers.forEach(m => map.removeLayer(m));
    nodeMarkers = [];

    Object.values(graph.nodes).forEach(node => {
        const name = getNodeName(node);
        const marker = L.circleMarker([node.lat, node.lng], { radius: 4, color: '#00e676', fillOpacity: 0.6 })
            .bindPopup(`<b>${name}</b><br><small>Line: ${node.line}</small>`)
            .addTo(map);
        nodeMarkers.push(marker);
    });
}

// ---------------- Route Calculation ----------------
function calculateAndDraw() {
    const startSel = document.getElementById('startNode').value;
    const endSel = document.getElementById('endNode').value;
    const solver = new DijkstraStrategy(currentMode);
    const result = solver.calculate(graph, startSel, endSel);
    
    if (routeLine) map.removeLayer(routeLine);
    
    if (result) {
        const pts = result.path.map(s => [graph.nodes[s.from].lat, graph.nodes[s.from].lng]);
        pts.push([graph.nodes[result.path.at(-1).to].lat, graph.nodes[result.path.at(-1).to].lng]);
        routeLine = L.polyline(pts, { color: '#00e676', weight: 5 }).addTo(map);
        map.fitBounds(routeLine.getBounds());
        
        // สรุปผลลัพธ์เป็นภาษาที่เลือก
        const tTime = currentLang === 'th' ? 'เวลา' : 'Time';
        const tCost = currentLang === 'th' ? 'ค่าใช้จ่าย' : 'Cost';
        const tBaht = currentLang === 'th' ? 'บาท' : 'THB';
        const tMin = currentLang === 'th' ? 'นาที' : 'min';

        document.getElementById('results').innerHTML = `
            <div class="res-card">
                <b>${tTime}:</b> ${result.totals.time} ${tMin} | 
                <b>${tCost}:</b> ${result.totals.cost} ${tBaht}
            </div>`;
    }
}

window.logout = () => { sessionStorage.clear(); window.location.href = 'auth.html'; };
init();