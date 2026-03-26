import { GraphLoader } from './core/GraphLoader.js';
import { DijkstraStrategy } from './algorithms/Dijkstra.js';

if (sessionStorage.getItem('isLoggedIn') !== 'true') { window.location.href = 'auth.html'; }

// ตัวแปรส่วนแผนที่และข้อมูล
let graph, map, miniMap, currentMode = 'time', routeLayers = [];
let miniRouteLayer = L.layerGroup(); 
let currentLang = localStorage.getItem('urban_lang') || 'en';

const userEmail = sessionStorage.getItem('userEmail');
let userName = localStorage.getItem(`urban_name_${userEmail}`) || userEmail.split('@')[0];

const lineData = {
    'ARL': { en: 'Airport Rail Link', th: 'แอร์พอร์ตเรลลิงก์', color: '#8B0000' }, 
    'Blue': { en: 'MRT Blue Line', th: 'สายสีน้ำเงิน', color: '#1E90FF' },
    'Dark green': { en: 'BTS Silom Line', th: 'สายสีลม', color: '#006400' },
    'Light green': { en: 'BTS Sukhumvit Line', th: 'สายสุขุมวิท', color: '#32CD32' },
    'Purple': { en: 'MRT Purple Line', th: 'สายสีม่วง', color: '#800080' },
    'Gold': { en: 'Gold Line', th: 'สายสีทอง', color: '#DAA520' },
    'Yellow': { en: 'Yellow Line', th: 'สายสีเหลือง', color: '#FFD700' },
    'Pink': { en: 'Pink Line', th: 'สายสีชมพู', color: '#FF69B4' },
    'Orange': { en: 'Orange Line', th: 'สายสีส้ม', color: '#FF8C00' },
    'Brown': { en: 'Brown Line', th: 'สายสีน้ำตาล', color: '#8B4513' },
    'Grey': { en: 'Grey Line', th: 'สายสีเทา', color: '#808080' },
    'Red east': { en: 'SRT Light Red', th: 'สายสีแดงอ่อน', color: '#FF4500' },
    'Red north': { en: 'SRT Dark Red', th: 'สายสีแดงเข้ม', color: '#DC143C' },
    'Red south': { en: 'SRT Dark Red', th: 'สายสีแดงเข้ม', color: '#DC143C' },
    'Red west': { en: 'SRT Light Red', th: 'สายสีแดงอ่อน', color: '#FF4500' },
    'Red west south': { en: 'SRT Light Red', th: 'สายสีแดงอ่อน', color: '#FF4500' },
    'TRANSFER': { en: 'Transfer Walk', th: 'ทางเดินเชื่อมต่อ', color: '#FFFFFF' }
};

async function init() {
    updateProfileUI();

    const loader = new GraphLoader();
    graph = await loader.load('./data/transit_network.json');

    setupLanguage();
    populateDropdowns();
    setupNavigation();

    // Init Main Map
    map = L.map('map', { zoomControl: false }).setView([13.75, 100.53], 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
    renderMapNodes();

    // Init Mini Map
    miniMap = L.map('mini-map', {
        zoomControl: false, dragging: false, scrollWheelZoom: false, touchZoom: false, doubleClickZoom: false
    }).setView([13.75, 100.53], 11);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(miniMap);
    miniRouteLayer.addTo(miniMap);
    updateMiniMap();

    // ---------------- Event Listeners ---------------- //

    document.getElementById('startNode').addEventListener('change', updateMiniMap);
    document.getElementById('endNode').addEventListener('change', updateMiniMap);

    // Language Toggle
    document.getElementById('menuLangToggle').onclick = () => {
        currentLang = currentLang === 'en' ? 'th' : 'en';
        localStorage.setItem('urban_lang', currentLang);
        setupLanguage();
        populateDropdowns(); 
        renderMapNodes();    
        if (routeLayers.length > 0) calculateAndDraw(false);
    };

    // Toggle Switches (Settings)
    document.querySelectorAll('.toggle-switch').forEach(toggle => {
        toggle.onclick = (e) => e.currentTarget.classList.toggle('active');
    });

    // Swap Button
    document.getElementById('swapBtn').onclick = () => {
        const startNode = document.getElementById('startNode');
        const endNode = document.getElementById('endNode');
        const temp = startNode.value;
        startNode.value = endNode.value;
        endNode.value = temp;

        const btnIcon = document.querySelector('#swapBtn i');
        btnIcon.style.transition = "transform 0.3s ease";
        btnIcon.style.transform = btnIcon.style.transform === "rotate(270deg)" ? "rotate(90deg)" : "rotate(270deg)";
        updateMiniMap();
    };

    // Mode Cards
    document.querySelectorAll('.mode-card').forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll('.mode-card').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            currentMode = e.currentTarget.dataset.mode;
        };
    });

    // Calculate Button
    document.getElementById('searchBtn').onclick = () => {
        calculateAndDraw(true);
    };
}

// ---- Mini Map Functions ----
function updateMiniMap() {
    if (!graph) return;
    const startId = document.getElementById('startNode').value;
    const endId = document.getElementById('endNode').value;

    miniRouteLayer.clearLayers();

    if (startId && endId && graph.nodes[startId] && graph.nodes[endId]) {
        const startNode = graph.nodes[startId];
        const endNode = graph.nodes[endId];

        const startIcon = L.circleMarker([startNode.lat, startNode.lng], { radius: 6, color: '#000', weight: 2, fillColor: '#00e676', fillOpacity: 1 });
        const endIcon = L.circleMarker([endNode.lat, endNode.lng], { radius: 6, color: '#000', weight: 2, fillColor: '#ff5252', fillOpacity: 1 });

        const previewLine = L.polyline([[startNode.lat, startNode.lng], [endNode.lat, endNode.lng]], {
            color: '#888', weight: 2, dashArray: '5, 5'
        });

        miniRouteLayer.addLayer(previewLine);
        miniRouteLayer.addLayer(startIcon);
        miniRouteLayer.addLayer(endIcon);

        const bounds = L.latLngBounds([startNode.lat, startNode.lng], [endNode.lat, endNode.lng]);
        miniMap.fitBounds(bounds, { padding: [20, 20], maxZoom: 14 });
    }
}

// ---- Profile Functions ----
function updateProfileUI() {
    document.getElementById('profileName').innerText = userName;
    document.getElementById('profileEmail').innerText = userEmail;
    
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=333&color=fff&size=150`;
    document.getElementById('userAvatar').src = avatarUrl;
    document.getElementById('editAvatarPreview').src = avatarUrl;
    
    document.getElementById('editNameInput').value = userName;
}

window.openSubPage = (pageId) => { document.getElementById(pageId).classList.add('active'); }
window.closeSubPage = (pageId) => { document.getElementById(pageId).classList.remove('active'); }

window.saveProfile = () => {
    const newName = document.getElementById('editNameInput').value.trim();
    if(newName) {
        userName = newName;
        localStorage.setItem(`urban_name_${userEmail}`, userName);
        updateProfileUI();
        closeSubPage('sub-edit-profile');
    }
}

// ---- Core Functions ----
function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active'));
            
            const targetId = e.currentTarget.dataset.target;
            e.currentTarget.classList.add('active');
            document.getElementById(targetId).classList.add('active');

            if(targetId === 'page-map') setTimeout(() => map.invalidateSize(), 100);
            if(targetId === 'page-route') setTimeout(() => miniMap.invalidateSize(), 100);
        };
    });
}

function setupLanguage() {
    document.querySelectorAll('[data-en]').forEach(el => el.innerText = el.getAttribute(`data-${currentLang}`));
    document.body.className = currentLang === 'th' ? 'th-lang' : '';
    document.getElementById('langStatusIndicator').innerText = currentLang === 'en' ? 'EN' : 'TH';
}

function getNodeName(node) { return currentLang === 'th' && node.name_th ? node.name_th : (node.name_en || node.name); }
function getLineName(code) { return lineData[code.trim()] ? lineData[code.trim()][currentLang] : code; }
function getLineColor(code) { return lineData[code.trim()] ? lineData[code.trim()].color : '#FFF'; }

function populateDropdowns() {
    const startSel = document.getElementById('startNode');
    const endSel = document.getElementById('endNode');
    const currStart = startSel.value, currEnd = endSel.value;

    startSel.innerHTML = ''; endSel.innerHTML = '';
    const sortedNodes = Object.values(graph.nodes).sort((a,b) => getNodeName(a).localeCompare(getNodeName(b)));
    
    sortedNodes.forEach(node => {
        const opt = `<option value="${node.id}">${getNodeName(node)} - [${getLineName(node.line)}]</option>`;
        startSel.innerHTML += opt; endSel.innerHTML += opt;
    });

    if (currStart) startSel.value = currStart;
    if (currEnd) endSel.value = currEnd;
}

let nodeMarkers = [];
function renderMapNodes() {
    nodeMarkers.forEach(m => map.removeLayer(m));
    nodeMarkers = [];
    Object.values(graph.nodes).forEach(node => {
        const color = getLineColor(node.line);
        const marker = L.circleMarker([node.lat, node.lng], { radius: 4, color: '#000', weight: 1, fillColor: color, fillOpacity: 0.8 })
            .bindPopup(`<div style="text-align:center;"><b>${getNodeName(node)}</b><br><span style="color:${color}; font-size:11px;">■ ${getLineName(node.line)}</span></div>`)
            .addTo(map);
        nodeMarkers.push(marker);
    });
}

function calculateAndDraw(switchToMap = false) {
    const startId = document.getElementById('startNode').value;
    const endId = document.getElementById('endNode').value;
    const solver = new DijkstraStrategy(currentMode);
    const result = solver.calculate(graph, startId, endId);
    
    routeLayers.forEach(l => map.removeLayer(l));
    routeLayers = [];
    
    if (result) {
        let bounds = L.latLngBounds();
        result.path.forEach(step => {
            const p1 = graph.nodes[step.from];
            const p2 = graph.nodes[step.to];
            const isTransfer = step.info.type === 'TRANSFER';

            const line = L.polyline([[p1.lat, p1.lng], [p2.lat, p2.lng]], {
                color: getLineColor(step.info.type),
                weight: isTransfer ? 4 : 6,
                dashArray: isTransfer ? '5, 5' : '',
                opacity: 0.9
            }).addTo(map);

            routeLayers.push(line);
            bounds.extend([p1.lat, p1.lng]); bounds.extend([p2.lat, p2.lng]);
        });
        map.fitBounds(bounds, { padding: [50, 50] });
        
        const tTime = currentLang === 'th' ? 'เวลา' : 'Time';
        const tCost = currentLang === 'th' ? 'ค่าโดยสาร' : 'Cost';
        const startName = getNodeName(graph.nodes[startId]);
        const endName = getNodeName(graph.nodes[endId]);

        document.getElementById('results').innerHTML = `
            <div class="res-card">
                <b style="color: #00e676; font-size: 16px;">${startName} <i class="fa-solid fa-arrow-right" style="margin: 0 5px; color:#888;"></i> ${endName}</b><br><br>
                <div style="display: flex; gap: 20px;">
                    <div><b style="color:#aaa; font-weight:normal;">⏱️ ${tTime}</b><br><span style="font-size: 18px; font-weight: bold;">${result.totals.time} <small>min</small></span></div>
                    <div><b style="color:#aaa; font-weight:normal;">💰 ${tCost}</b><br><span style="font-size: 18px; font-weight: bold;">${result.totals.cost} <small>THB</small></span></div>
                </div>
            </div>`;
            
        if(switchToMap) document.querySelector('[data-target="page-map"]').click();
        
    } else {
        document.getElementById('results').innerHTML = `<div class="res-card" style="border-left-color:red;">❌ ${currentLang === 'th' ? 'ไม่พบเส้นทางที่เชื่อมต่อกัน' : 'No route found'}</div>`;
    }
}

window.logout = () => { sessionStorage.clear(); window.location.href = 'auth.html'; };
init();