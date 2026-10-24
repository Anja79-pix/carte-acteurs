const map = L.map('map');

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap'
}).addTo(map);

// Couleur de chaque famille
const COULEURS = {
  A: '#1f78b4', B: '#d7191c', C: '#555555', D: '#e377c2',
  E: '#8c510a', F: '#2ca25f', G: '#7b3294', H: '#e6ab02'
};

// Type de commune d'un acteur
function typeCommune(d) {
  if (d.n === null) return 'Hors référentiel';
  return d.n >= 5 ? 'Rurale' : 'Urbaine';
}

// Nombre d'acteurs dans chaque commune (clé : code INSEE)
const nbParCommune = {};
DATA.forEach(d => { nbParCommune[d.i] = (nbParCommune[d.i] || 0) + 1; });
// 1. Créer un marqueur par acteur (on les garde dans une liste)
const acteurs = DATA.map(d => {
  const forme = typeCommune(d) === 'Rurale' ? 'carre' : 'rond';
  const icone = L.divIcon({
    className: '',
    html: '<span class="mk ' + forme + '" style="background:' + COULEURS[d.f] + '"></span>',
    iconSize: [13, 13]
  });
  const marqueur = L.marker([d.la, d.lo], { icon: icone }).bindPopup(
    '<b>' + d.v + '</b><br>' +
    'Famille ' + d.f + '<br>' +
    (d.n === null ? 'Hors référentiel de densité'
                  : typeCommune(d) + ' · niveau ' + d.n + ' (' + d.t + ')') + '<br>' +
    (d.d && d.d !== d.g ? d.d + ', ' : '') + d.g + '<br>' +
    nbParCommune[d.i] + (nbParCommune[d.i] > 1 ? ' acteurs' : ' acteur') + ' dans cette commune' +
    (d.p ? '<br>Pôle de services : ' + d.p : '')
  );
  return { d: d, marqueur: marqueur };
});

// 2. Remplir le panneau : cases à cocher des familles
const blocFamilles = document.getElementById('familles');
Object.keys(COULEURS).forEach(f => {
  blocFamilles.insertAdjacentHTML('beforeend',
    '<label><input type="checkbox" value="' + f + '" checked>' +
    '<span class="puce" style="background:' + COULEURS[f] + '"></span>Famille ' + f + '</label>');
});

// Ajouter un petit compteur à droite de chaque case
document.querySelectorAll('#familles label, #types label').forEach(l => {
  l.insertAdjacentHTML('beforeend', '<span class="num" style="float:right; color:#666;"></span>');
});

// 3. Remplir la liste des territoires
const listeRegions = document.getElementById('region');
const regions = [...new Set(DATA.map(d => d.g))].sort((a, b) => a.localeCompare(b, 'fr'));
listeRegions.innerHTML = '<option value="">Tous les territoires (' + DATA.length + ')</option>' +
  regions.map(r => '<option value="' + r + '">' + r + '</option>').join('');

// 4. Appliquer les filtres : afficher ou cacher chaque point
function filtrer() {
  const familles = [...document.querySelectorAll('#familles input:checked')].map(i => i.value);
  const types = [...document.querySelectorAll('#types input:checked')].map(i => i.value);
  const region = listeRegions.value;

    const rienCoche = familles.length === 0 && types.length === 0;
  let affiches = 0;
  acteurs.forEach(a => {
    const visible = !rienCoche &&(familles.length === 0 || familles.includes(a.d.f)) &&
                    (types.length === 0 || types.includes(typeCommune(a.d))) &&
                    (region === '' || a.d.g === region);
    if (visible) { a.marqueur.addTo(map); affiches++; }
    else { map.removeLayer(a.marqueur); }
  });

  document.getElementById('compteur').innerHTML =
    '<b>' + affiches + '</b> acteurs affichés sur ' + DATA.length;

  // Nombre d'acteurs par famille et par type (selon les autres filtres)
  const nbFamille = {}, nbType = {};
  acteurs.forEach(a => {
    const t = typeCommune(a.d);
    const okRegion = (region === '' || a.d.g === region);
    const okFamille = (familles.length === 0 || familles.includes(a.d.f));
    const okType = (types.length === 0 || types.includes(t));
    if (okRegion && okType) nbFamille[a.d.f] = (nbFamille[a.d.f] || 0) + 1;
    if (okRegion && okFamille) nbType[t] = (nbType[t] || 0) + 1;
  });
  document.querySelectorAll('#familles label').forEach(l => {
    l.querySelector('.num').textContent = nbFamille[l.querySelector('input').value] || 0;
  });
  document.querySelectorAll('#types label').forEach(l => {
    l.querySelector('.num').textContent = nbType[l.querySelector('input').value] || 0;
  });
}

// 5. Cadrer la carte (sur tous les points, ou sur la région choisie)
function cadrer() {
  const region = listeRegions.value;
  if (region === '') {
    map.fitBounds([[41.2, -5.6], [51.3, 9.9]]);      // France métropolitaine
  } else {
    const points = DATA.filter(d => d.g === region).map(d => [d.la, d.lo]);
    map.fitBounds(points, { maxZoom: 9 });
  }
}

// 6. Réagir aux clics
document.getElementById('panneau').addEventListener('change', e => {
  filtrer();
  if (e.target === listeRegions) cadrer();
});

filtrer();
cadrer();

// ===== Recherche par nom de commune =====
function norm(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
const champ = document.getElementById('recherche');
const zone = document.getElementById('resultats');

champ.addEventListener('input', () => {
  const q = norm(champ.value.trim());
  zone.innerHTML = '';
  if (q.length < 2) return;
  const trouves = acteurs.filter(a => norm(a.d.v).includes(q)).slice(0, 8);
  if (trouves.length === 0) {
    zone.innerHTML = '<div style="padding:6px; color:#888;">Aucun résultat</div>';
    return;
  }
  trouves.forEach(a => {
    const div = document.createElement('div');
    div.style.cssText = 'padding:6px; cursor:pointer; border-bottom:1px solid #eee; font-size:13px;';
    div.textContent = a.d.v + ' · ' + (a.d.d ? a.d.d + ' · ' : '') + 'Famille ' + a.d.f;
    div.addEventListener('click', () => aller(a));
    zone.appendChild(div);
  });
});

// Aller sur un acteur trouvé : on remet tous les filtres, puis on ouvre sa fiche
function aller(a) {
  document.querySelectorAll('#familles input, #types input').forEach(i => { i.checked = true; });
  listeRegions.value = '';
  filtrer();
  map.setView([a.d.la, a.d.lo], 13);
  a.marqueur.openPopup();
  zone.innerHTML = '';
}

// ===== Boutons : tout réinitialiser / tout décocher =====
document.getElementById('btn-tout').addEventListener('click', () => {
  document.querySelectorAll('#familles input, #types input').forEach(i => { i.checked = true; });
  listeRegions.value = '';
  champ.value = '';
  zone.innerHTML = '';
  filtrer();
  cadrer();
});

document.getElementById('btn-rien').addEventListener('click', () => {
  document.querySelectorAll('#familles input, #types input').forEach(i => { i.checked = false; });
  filtrer();
});
document.getElementById('btn-centrer').addEventListener('click', cadrer);