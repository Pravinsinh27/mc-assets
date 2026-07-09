const { AdMob } = window.Capacitor.Plugins;
const firebaseConfig = {
    apiKey: "AIzaSyCKOxNReuaWYEVXyUpMp3Snq3HiRCpj6Cg",
    authDomain: "mc-assets-41793.firebaseapp.com",
    projectId: "mc-assets-41793",
    storageBucket: "mc-assets-41793.firebasestorage.app",
    messagingSenderId: "120552235197",
    appId: "1:120552235197:android:d2c4f9a40ec67893b117d4" 
};

document.addEventListener("deviceready", async () => {
    try {
        await AdMob.initialize();
        console.log("AdMob initialized");
    } catch (err) {
        console.error(err);
    }
});

const grid = document.getElementById('asset-grid');
let currentCategory = "All";
let scene, camera, renderer, currentMesh, animationFrameId;
let autoSlideInterval; 
let pendingDownloadUrl = ""; // NEW: Download link ko ad dekhne tak save rakhne ke liye

window.onerror = function(message, source, lineno, colno, error) {
    if (grid) {
        grid.innerHTML = `<div style="background:#221111; border:1px solid #ff4444; padding:15px; border-radius:10px; margin:20px 0; color:#ff8888; font-family:monospace; font-size:12px;"><strong>⚠️ JavaScript Error:</strong><br>${message}<br><strong>Line:</strong> ${lineno}</div>`;
    }
    return false;
};

if (typeof firebase === 'undefined') {
    setTimeout(() => { grid.innerHTML = `<div style="background:#221111; border:1px solid #ff4444; padding:15px; border-radius:10px; text-align:center; color:#ff8888;"><strong>⚠️ Firebase SDK Failed to Load</strong><br>Check internet connection.</div>`; }, 500);
} else {
    try {
        firebase.initializeApp(firebaseConfig);
        window.db = firebase.firestore();
        loadLiveAssets();
    } catch (e) {
        setTimeout(() => { grid.innerHTML = `<p style="color:#ef4444; text-align:center; padding:20px;">Init Error: ${e.message}</p>`; }, 500);
    }
}

function loadLiveAssets() {
    grid.innerHTML = "<p style='text-align:center; padding:30px; color:#6b7280; font-weight:600;'>Loading assets from cloud...</p>";
    
    window.db.collection("assets").get().then((querySnapshot) => {
        const liveItems = [];
        querySnapshot.forEach((doc) => { liveItems.push({ id: doc.id, ...doc.data() }); });
        window.allAssets = liveItems;
        
        if (liveItems.length === 0) {
            grid.innerHTML = `<p style='text-align:center; padding:30px; color:#8a8a93;'>Database is empty!</p>`;
        } else {
            displayPopularAssets(liveItems);
            displayAssets(liveItems);
        }
    }).catch((error) => {
        grid.innerHTML = `<div style="background:#221111; border:1px solid #ff4444; padding:15px; border-radius:10px; color:#ff8888; font-size:13px;"><strong>📂 Firestore Error:</strong><br>${error.message}</div>`;
    });
}

function displayPopularAssets(assets) {
    const slider = document.getElementById('popular-slider');
    if (!slider) return;
    
    slider.innerHTML = ""; 
    const popularMaps = assets.filter(item => item.type === 'Minecraft Map').slice(0, 4);
    const popularSection = document.querySelector('.popular-section');
    
    if(popularMaps.length === 0) {
        if(popularSection) popularSection.style.display = 'none';
        return;
    } else {
        if(popularSection) popularSection.style.display = 'block';
    }

    popularMaps.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'slider-card';
        const badgeText = index % 2 === 0 ? "HOT" : "TRENDING";
        
        card.innerHTML = `
            <span class="slider-badge">${badgeText}</span>
            <div class="slider-thumb" style="height: 160px;">
                <img src="${item.thumbnail || 'https://placehold.co/600x400/14141b/4caf50?text=No+Image'}" alt="Popular Map">
            </div>
        `;
        
        card.onclick = () => openDetailPage(item); 
        slider.appendChild(card);
    });

    clearInterval(autoSlideInterval);
    autoSlideInterval = setInterval(() => {
        if (slider.scrollLeft + slider.clientWidth >= slider.scrollWidth - 10) {
            slider.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
            slider.scrollBy({ left: 275, behavior: 'smooth' }); 
        }
    }, 2500); 
}

function displayAssets(assetsToRender) {
    grid.innerHTML = "";
    assetsToRender.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';
        
        if (item.type === "Minecraft Map") {
            card.style.gridColumn = "1 / -1"; 
        }

        const badgeClass = item.type === "3D Model" ? "badge model" : "badge";
        
        card.innerHTML = `
            <div class="thumb-box">
                <span class="${badgeClass}">${item.type}</span>
                <img src="${item.thumbnail || 'https://placehold.co/600x400/14141b/4caf50?text=No+Image'}" alt="${item.title}">
            </div>
            <div class="card-info">
                <h3>${item.title || 'Untitled'}</h3>
            </div>
        `;
        card.onclick = () => openDetailPage(item);
        grid.appendChild(card);
    });
}

function filterAssets() {
    const searchText = document.getElementById('search-input').value.toLowerCase();
    const filtered = (window.allAssets || []).filter(item => {
        const matchesSearch = (item.title || "").toLowerCase().includes(searchText) || (item.description || "").toLowerCase().includes(searchText);
        const matchesCategory = (currentCategory === "All" || item.type === currentCategory);
        return matchesSearch && matchesCategory;
    });
    displayAssets(filtered);
}

function selectCategory(categoryName) {
    currentCategory = categoryName;
    document.querySelectorAll('.cat-btn').forEach(btn => btn.classList.remove('active'));
    
    if(categoryName === 'All') document.getElementById('cat-all').classList.add('active');
    if(categoryName === 'Minecraft Map') document.getElementById('cat-maps').classList.add('active');
    if(categoryName === '3D Model') document.getElementById('cat-models').classList.add('active');
    
    filterAssets();
}

function init3DViewer(modelUrl) {
    const container = document.getElementById('viewer-3d');
    const loadingText = document.getElementById('viewer-loading');
    
    container.querySelectorAll('canvas').forEach(c => c.remove());
    if (animationFrameId) cancelAnimationFrame(animationFrameId);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 5;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);

    currentMesh = new THREE.Group(); 
    scene.add(currentMesh);

    if (modelUrl && modelUrl.trim() !== "") {
        loadingText.innerText = "Loading 3D Model...";
        const lowerUrl = modelUrl.toLowerCase();

        if (lowerUrl.includes(".glb") || lowerUrl.includes(".gltf")) {
            const loader = new THREE.GLTFLoader();
            loader.setCrossOrigin('anonymous'); 
            
            loader.load(
                modelUrl,
                function (gltf) {
                    loadingText.innerText = "";
                    const object = gltf.scene;
                    scaleAndCenterObject(object);
                    currentMesh.add(object);
                },
                function (xhr) {
                    if (xhr.lengthComputable) loadingText.innerText = "Loading: " + Math.round((xhr.loaded / xhr.total) * 100) + "%";
                },
                function (error) {
                    loadingText.innerText = "Error: Invalid link or CORS blocked.";
                    fallbackGeometry();
                }
            );
        } else {
            const loader = new THREE.OBJLoader();
            loader.setCrossOrigin('anonymous');
            
            loader.load(
                modelUrl,
                function (object) {
                    loadingText.innerText = "";
                    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.1 });
                    object.traverse(function (child) {
                        if (child.isMesh) child.material = material;
                    });
                    
                    scaleAndCenterObject(object);
                    currentMesh.add(object);
                },
                function (xhr) {
                    if (xhr.lengthComputable) loadingText.innerText = "Loading: " + Math.round((xhr.loaded / xhr.total) * 100) + "%";
                },
                function (error) {
                    loadingText.innerText = "Error: Invalid link or CORS blocked.";
                    fallbackGeometry();
                }
            );
        }
    } else {
        loadingText.innerText = "";
        fallbackGeometry();
    }

    function scaleAndCenterObject(object) {
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2.5 / maxDim;
        
        object.scale.set(scale, scale, scale);
        object.position.sub(center.multiplyScalar(scale));
    }

    function fallbackGeometry() {
        const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        const material = new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 0.3, metalness: 0.2, wireframe: true });
        const fallbackMesh = new THREE.Mesh(geometry, material);
        currentMesh.add(fallbackMesh);
    }

    let isDragging = false, previousTouchX = 0;
    
    container.addEventListener('touchstart', e => { 
        isDragging = true; 
        previousTouchX = e.touches[0].clientX; 
    });
    
    container.addEventListener('touchmove', e => {
        if (!isDragging || !currentMesh) return;
        let deltaX = e.touches[0].clientX - previousTouchX;
        currentMesh.rotation.y += deltaX * 0.01;
        previousTouchX = e.touches[0].clientX;
    });
    
    container.addEventListener('touchend', () => isDragging = false);

    function animate() {
        animationFrameId = requestAnimationFrame(animate);
        if(!isDragging) { currentMesh.rotation.y += 0.01; }
        renderer.render(scene, camera);
    }
    animate();
}

window.addEventListener('popstate', function(event) {
    executeShowHomePageUI();
});

function executeShowHomePageUI() {
    document.getElementById('home-page').style.display = 'block';
    document.getElementById('detail-page').style.display = 'none';
    document.getElementById('bottom-nav').style.display = 'flex';
    document.getElementById('nav-title').style.display = 'block';
    
    document.getElementById('back-button').style.display = 'none';
    document.getElementById('menu-button').style.display = 'flex';
    
    document.getElementById('nav-home').classList.add('active');
    
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
}

function openDetailPage(item) {
    history.pushState({ page: 'detail' }, 'Detail', '#detail');

    document.getElementById('detail-item-type').innerText = item.type;
    document.getElementById('detail-title').innerText = item.title;
    document.getElementById('detail-description').innerText = item.description;
    
    // CHANGED: Yahan naye unlock function ko call kiya hai
    document.getElementById('download-button').onclick = () => unlockAsset(item.fileUrl);
    
    document.getElementById('home-page').style.display = 'none';
    document.getElementById('bottom-nav').style.display = 'none'; 
    document.getElementById('detail-page').style.display = 'block';
    
    document.getElementById('nav-title').style.display = 'none';
    
    document.getElementById('back-button').style.display = 'block';
    document.getElementById('menu-button').style.display = 'none';
    
    const viewer3D = document.getElementById('viewer-3d');
    const viewer2DContainer = document.getElementById('viewer-2d-container');
    const viewer2D = document.getElementById('viewer-2d');
    const galleryHint = document.getElementById('gallery-hint');

    if (item.isImageOnly) {
        viewer3D.style.display = 'none';
        viewer2DContainer.style.display = 'block';
        
        let imagesHTML = `<img src="${item.thumbnail}" class="gallery-img">`;
        
        if (item.galleryUrls && item.galleryUrls.length > 0) {
            item.galleryUrls.forEach(url => {
                if (url) imagesHTML += `<img src="${url}" class="gallery-img">`;
            });
            galleryHint.style.display = 'block'; 
        } else {
            galleryHint.style.display = 'none'; 
        }
        
        viewer2D.innerHTML = imagesHTML;

        if (animationFrameId) cancelAnimationFrame(animationFrameId);

    } else {
        viewer2DContainer.style.display = 'none';
        viewer3D.style.display = 'flex';
        
        setTimeout(() => init3DViewer(item.modelUrl), 100);
    }
}

function showHomePage() {
    if (window.location.hash === '#detail') {
        history.back(); 
    } else {
        executeShowHomePageUI();
    }
}

// ==========================================
// NEW: REWARDED AD LOGIC
// ==========================================

async function unlockAsset(downloadUrl) {
    pendingDownloadUrl = downloadUrl;

    try {
        await AdMob.prepareRewardVideoAd({
            adId: "ca-app-pub-3303988035586005/9477951640"
        });

        await AdMob.showRewardVideoAd();

        rewardUserAndDownload();

    } catch (err) {
        console.error(err);
        alert("Ad failed to load.");
    }
}


// 3. Android app ad khatam hone par IS function ko call karega!
function rewardUserAndDownload() {
    if (!pendingDownloadUrl) return; // Agar koi link nahi hai toh ruk jao

    alert("✅ Thanks for watching! Download has started.");
    
    let finalUrl = pendingDownloadUrl;
    
    // Google Drive direct download fix
    if (pendingDownloadUrl.includes("drive.google.com/file/d/")) {
        const match = pendingDownloadUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            finalUrl = `https://drive.google.com/uc?export=download&id=${match[1]}`;
        }
    }
    
    // Download start karo
    window.location.href = finalUrl;
    
    // Download shuru hone ke baad link hata do security ke liye
    pendingDownloadUrl = ""; 
}

// ==========================================

function toggleMenu() {
    const sideMenu = document.getElementById('side-menu');
    const overlay = document.getElementById('menu-overlay');
    
    if (sideMenu.classList.contains('open')) {
        sideMenu.classList.remove('open');
        overlay.classList.remove('active');
    } else {
        sideMenu.classList.add('open');
        overlay.classList.add('active');
    }
}
