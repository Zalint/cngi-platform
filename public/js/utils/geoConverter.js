// Conversion de fichiers SIG vers GeoJSON, côté navigateur.
// Formats supportés :
//   - .geojson / .json : passé tel quel
//   - .kml             : converti via @tmcw/togeojson
//   - .zip (Shapefile) : converti via shpjs (lit le .prj et reprojette en WGS84)
//
// Les libs sont chargées à la demande (CDN unpkg) pour ne pas alourdir
// les pages qui ne font pas d'import.

const GeoConverter = {
    // URLs CDN — unpkg est whitelisté dans le CSP.
    // Versions pinnées + SRI (Subresource Integrity) : si unpkg sert un
    // contenu modifié pour ces URLs, le navigateur refuse l'exécution.
    // Pour mettre à jour une version : changer l'URL, recalculer le SHA-384
    // avec `curl <url> | openssl dgst -sha384 -binary | openssl base64 -A`.
    TOGEOJSON_URL: 'https://unpkg.com/@tmcw/togeojson@5.8.1/dist/togeojson.umd.js',
    TOGEOJSON_SRI: 'sha384-4a+9x4ql6wch9epMfqnC3bSjASMJDDqpSuVblbNd6thkfnwdBucHgePPyl0exaFY',
    SHPJS_URL: 'https://unpkg.com/shpjs@4.0.4/dist/shp.min.js',
    SHPJS_SRI: 'sha384-All+uTLkqRBeyGd6OkVGJGbq2ChIKDWUrewcZ+uQDZzF11/b9sgw5p714836LTKO',

    _loadedScripts: new Set(),

    /**
     * Charge un script externe une seule fois et résout quand il est prêt.
     * @param {string} url URL HTTPS du script
     * @param {string} [integrity] Hash SRI (sha384-...). Si fourni, le navigateur
     *   refuse l'exécution si le contenu a été altéré.
     */
    loadScript(url, integrity) {
        if (this._loadedScripts.has(url)) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[src="${url}"]`);
            if (existing) {
                if (existing.dataset.loaded === '1') { this._loadedScripts.add(url); resolve(); return; }
                existing.addEventListener('load', () => { this._loadedScripts.add(url); resolve(); });
                existing.addEventListener('error', () => reject(new Error(`Échec du chargement de ${url}`)));
                return;
            }
            const s = document.createElement('script');
            s.src = url;
            s.async = true;
            // SRI + crossorigin sont indispensables ensemble : sans crossorigin,
            // le navigateur n'a pas accès au contenu pour vérifier le hash et
            // bloque l'exécution.
            if (integrity) {
                s.integrity = integrity;
                s.crossOrigin = 'anonymous';
            }
            s.onload = () => { s.dataset.loaded = '1'; this._loadedScripts.add(url); resolve(); };
            s.onerror = () => reject(new Error(`Échec du chargement de ${url} (intégrité ou réseau)`));
            document.head.appendChild(s);
        });
    },

    /**
     * Détecte le format à partir du nom du fichier.
     * @returns {'geojson'|'kml'|'shapefile'|null}
     */
    detectFormat(filename) {
        if (!filename) return null;
        const lower = filename.toLowerCase();
        if (lower.endsWith('.geojson') || lower.endsWith('.json')) return 'geojson';
        if (lower.endsWith('.kml')) return 'kml';
        if (lower.endsWith('.zip')) return 'shapefile';
        return null;
    },

    /**
     * Convertit un File HTML en FeatureCollection GeoJSON.
     * Lance une exception lisible si le format n'est pas reconnu ou la conversion échoue.
     * @param {File} file
     * @returns {Promise<Object>} FeatureCollection
     */
    async fileToGeoJSON(file) {
        const fmt = this.detectFormat(file.name);
        if (!fmt) {
            throw new Error('Format non reconnu. Formats acceptés : .geojson, .json, .kml, .zip (Shapefile).');
        }

        if (fmt === 'geojson') {
            const text = await file.text();
            const data = JSON.parse(text);
            if (!data || data.type !== 'FeatureCollection') {
                throw new Error('Le fichier doit être un FeatureCollection GeoJSON.');
            }
            return data;
        }

        if (fmt === 'kml') {
            await this.loadScript(this.TOGEOJSON_URL, this.TOGEOJSON_SRI);
            if (typeof toGeoJSON === 'undefined' || !toGeoJSON.kml) {
                throw new Error('Bibliothèque KML non disponible (vérifier la connexion).');
            }
            const text = await file.text();
            const dom = new DOMParser().parseFromString(text, 'text/xml');
            const parserError = dom.querySelector('parsererror');
            if (parserError) throw new Error('Fichier KML invalide (XML mal formé).');
            const geojson = toGeoJSON.kml(dom);
            if (!geojson || geojson.type !== 'FeatureCollection') {
                throw new Error('Conversion KML échouée : aucune géométrie trouvée.');
            }
            return geojson;
        }

        if (fmt === 'shapefile') {
            await this.loadScript(this.SHPJS_URL, this.SHPJS_SRI);
            // shpjs s'expose en global "shp" et accepte un ArrayBuffer (zip).
            // Fallback : sur certaines versions UMD, l'export est dans window.shp.default.
            const shpFn = (typeof shp === 'function') ? shp
                        : (typeof shp === 'object' && shp && typeof shp.default === 'function') ? shp.default
                        : null;
            if (!shpFn) throw new Error('Bibliothèque Shapefile non disponible (vérifier la connexion).');
            const buffer = await file.arrayBuffer();
            let result;
            try {
                result = await shpFn(buffer);
            } catch (err) {
                throw new Error(`Conversion Shapefile échouée : ${err?.message || err}`);
            }
            // shpjs retourne soit un FeatureCollection, soit un tableau de FC
            // si le zip contient plusieurs jeux de données. On les fusionne.
            const merged = Array.isArray(result)
                ? { type: 'FeatureCollection', features: result.flatMap(r => r?.features || []) }
                : result;
            if (!merged || merged.type !== 'FeatureCollection' || !Array.isArray(merged.features)) {
                throw new Error('Le zip ne contient pas de Shapefile valide (.shp/.shx/.dbf attendus).');
            }
            if (merged.features.length === 0) {
                throw new Error('Le Shapefile ne contient aucune entité géographique.');
            }
            return merged;
        }

        throw new Error('Format non géré.');
    }
};

window.GeoConverter = GeoConverter;
